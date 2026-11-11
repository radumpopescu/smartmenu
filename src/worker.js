import qrcode from 'qrcode-generator';
import { RequestError, cleanDraft, draftPhotosIn, isId, makeDraft, photosIn, publishedMenu, uid } from './menu.js';
import { editPhoto, extractMenu } from './ai.js';

const days = 14 * 86400;
const maxImage = 6 * 1024 * 1024;
const mimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const encoder = new TextEncoder();
const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const random = (size) => hex(crypto.getRandomValues(new Uint8Array(size)));
const sha = async (value) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
const now = () => Date.now();
const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (status, message) => { throw new RequestError(status, message); };
const query = (env, sql, ...params) => env.DB.prepare(sql).bind(...params);

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const digest = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: encoder.encode(salt), iterations: 600000, hash: 'SHA-256'
  }, key, 256);
  return hex(new Uint8Array(digest));
}

function equalHex(a, b) {
  if (a.length !== b.length) return false;
  const left = Uint8Array.from(a, (character) => character.charCodeAt(0));
  const right = Uint8Array.from(b, (character) => character.charCodeAt(0));
  return crypto.subtle.timingSafeEqual(left, right);
}

function cookie(request, token, age) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `sm_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`;
}

function tokenFrom(request) {
  return request.headers.get('Cookie')?.match(/(?:^|;\s*)sm_session=([a-f0-9]{64})(?:;|$)/)?.[1];
}

async function identity(request, env) {
  const token = tokenFrom(request);
  if (!token) return null;
  return query(env, 'SELECT account_id AS id FROM sessions WHERE token_hash = ? AND expires_at > ?', await sha(token), now()).first();
}

async function readBounded(request, max) {
  if (Number(request.headers.get('Content-Length')) > max) fail(413, 'The upload is too large.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'A request body is required.');
  const parts = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      fail(413, 'The upload is too large.');
    }
    parts.push(value);
  }
  return new Blob(parts);
}

async function body(request) {
  const payload = await readBounded(request, 1200000);
  try { return JSON.parse(await payload.text()) ?? {}; }
  catch { fail(400, 'Invalid request data.'); }
}

async function imageFile(request) {
  const mime = request.headers.get('Content-Type');
  if (!mimeTypes.has(mime)) fail(415, 'Choose a JPEG, PNG, or WebP image.');
  const blob = await readBounded(request, maxImage);
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const valid = {
    'image/jpeg': head[0] === 255 && head[1] === 216 && head[2] === 255,
    'image/png': hex(head.slice(0, 8)) === '89504e470d0a1a0a',
    'image/webp': hex(head.slice(0, 4)) === '52494646' && hex(head.slice(8, 12)) === '57454250'
  };
  if (!valid[mime]) fail(415, 'The file does not match its image format.');
  return new Blob([blob], { type: mime });
}

async function auth(request, env, action) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (!(await env.AUTH_LIMIT.limit({ key: ip })).success) fail(429, 'Try again in a minute.');
  const { email, password, code } = await body(request);
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^\S+@\S+\.\S+$/.test(address) || address.length > 254 ||
      typeof password !== 'string' || password.length < 12 || password.length > 128) {
    fail(400, 'Use a valid email and a password between 12 and 128 characters.');
  }
  let account = await query(env, 'SELECT * FROM accounts WHERE email = ?', address).first();
  if (action === 'register') {
    if (!env.SIGNUP_CODE || typeof code !== 'string' || code.length > 200 || !equalHex(await sha(code), await sha(env.SIGNUP_CODE))) {
      fail(403, 'A valid signup code is required.');
    }
    if (account) fail(409, 'An account already uses this email.');
    const id = uid();
    const salt = random(16);
    const stored = salt + ':' + await passwordHash(password, salt);
    const inserted = await query(env, 'INSERT INTO accounts VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING', id, address, stored).run();
    if (!inserted.meta.changes) fail(409, 'An account already uses this email.');
    account = { id };
  } else {
    const [salt, hash] = account?.password.split(':') ?? ['0'.repeat(32), '0'.repeat(64)];
    const candidate = await passwordHash(password, salt);
    if (!account || !equalHex(candidate, hash)) fail(401, 'Email or password is incorrect.');
  }
  const token = random(32);
  await env.DB.batch([
    query(env, 'DELETE FROM sessions WHERE expires_at <= ?', now()),
    query(env, 'INSERT INTO sessions VALUES (?, ?, ?)', await sha(token), account.id, now() + days * 1000)
  ]);
  return json({ signedIn: true }, 200, { 'Set-Cookie': cookie(request, token, days) });
}

async function savePhoto(env, menuId, data, mime, id = uid()) {
  await env.PHOTOS.put(id, data, { httpMetadata: { contentType: mime } });
  try {
    await query(env, 'INSERT INTO photos (id, menu_id, mime) VALUES (?, ?, ?)', id, menuId, mime).run();
  } catch (error) {
    await env.PHOTOS.delete(id).catch((cleanupError) => console.error('Photo cleanup failed', cleanupError));
    throw error;
  }
  return id;
}

async function useQuota(env, account, feature, cap) {
  const result = await query(env, `INSERT INTO usage VALUES (?, ?, ?, 1)
    ON CONFLICT(account_id, feature, day) DO UPDATE SET count = count + 1 WHERE count < ?`,
    account, feature, new Date().toISOString().slice(0, 10), cap).run();
  if (!result.meta.changes) fail(429, 'Your daily limit has been reached.');
}

function view(row) {
  return { id: row.id, slug: row.slug, draft: JSON.parse(row.draft), version: row.version, publishedAt: row.published_at };
}

async function privateMenu(request, env, account, menu, action, detail) {
  const method = request.method;
  if (!action && method === 'GET') return json(view(menu));
  if (action === 'qr' && method === 'GET' && menu.published) {
    const qr = qrcode(0, 'M');
    qr.addData(new URL('/m/' + menu.slug, request.url).href);
    qr.make();
    return new Response(qr.createSvgTag({ cellSize: 5, margin: 20, scalable: true }), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store' }
    });
  }


  if ((!action && method === 'PUT') || (action === 'publish' && method === 'POST')) {
    const input = await body(request);
    const draft = cleanDraft(input.draft);
    const encoded = JSON.stringify(draft);
    const ids = JSON.stringify(draftPhotosIn(draft));
    const { count } = await query(env, `SELECT count(*) AS count FROM photos
      WHERE menu_id = ? AND id IN (SELECT value FROM json_each(?))`, menu.id, ids).first();
    if (count !== JSON.parse(ids).length) fail(400, 'A photo does not belong to this menu.');
    const publishing = action === 'publish';
    if (publishing && !draft.sections.some((section) => section.items.length)) fail(400, 'Add a dish before publishing.');
    if (publishing && draft.sections.some((section) => section.items.some((item) => item.review))) {
      fail(400, 'Review the flagged dishes before publishing.');
    }
    const statements = publishing ? [
      query(env, `UPDATE menus SET draft = ?, published = ?, published_at = ?, version = version + 1
        WHERE id = ? AND version = ?`, encoded, JSON.stringify(publishedMenu(draft)), now(), menu.id, input.version ?? 0),
      query(env, `UPDATE photos SET published = (id IN (SELECT value FROM json_each(?)))
        WHERE menu_id = ? AND changes() = 1`, JSON.stringify(photosIn(draft)), menu.id)
    ] : [query(env, 'UPDATE menus SET draft = ?, version = version + 1 WHERE id = ? AND version = ?',
      encoded, menu.id, input.version ?? 0)];
    const [result] = await env.DB.batch(statements);
    if (!result.meta.changes) fail(409, 'This menu changed in another tab. Reopen it before saving.');
    return json(view(await query(env, 'SELECT * FROM menus WHERE id = ?', menu.id).first()));
  }

  if (action === 'photos' && method === 'POST') {
    const file = await imageFile(request);
    await useQuota(env, account, 'upload', 150);
    return json({ id: await savePhoto(env, menu.id, file.stream(), file.type) }, 201);
  }
  if (action === 'import' && method === 'POST') {
    if (!env.OPENAI_API_KEY) fail(503, 'Menu import needs an OpenAI API key on the server.');
    const file = await imageFile(request);
    await useQuota(env, account, 'import', 30);
    return json({ sections: await extractMenu(env, file) });
  }
  if (action === 'edits' && !detail && method === 'POST') {
    if (!env.OPENAI_API_KEY) fail(503, 'Photo editing needs an OpenAI API key on the server.');
    const { source, background } = await body(request);
    if (!isId(source) || !['studio', 'transparent'].includes(background)) fail(400, 'Choose a valid photo and background.');
    if (!await query(env, 'SELECT id FROM photos WHERE id = ? AND menu_id = ?', source, menu.id).first()) fail(404, 'Photo not found.');
    await useQuota(env, account, 'edit', 25);
    const id = uid();
    await query(env, 'INSERT INTO photo_jobs (id, menu_id, source_id, background, updated_at) VALUES (?, ?, ?, ?, ?)',
      id, menu.id, source, background, now()).run();
    try { await env.PHOTO_JOBS.send({ id }); }
    catch (error) {
      await query(env, "UPDATE photo_jobs SET status = 'failed' WHERE id = ?", id).run();
      throw error;
    }
    return json({ id, status: 'queued' }, 202);
  }
  if (action === 'edits' && method === 'GET') {
    if (detail) {
      const job = await query(env, "SELECT id, CASE WHEN status IN ('processing', 'queued') AND updated_at < unixepoch() * 1000 - 900000 THEN 'failed' ELSE status END AS status, result_id FROM photo_jobs WHERE id = ? AND menu_id = ?", detail, menu.id).first();
      if (!job) fail(404, 'Photo edit not found.');
      return json(job);
    }
    const source = new URL(request.url).searchParams.get('source');
    if (!isId(source)) fail(400, 'Choose a photo.');
    const { results } = await query(env, `SELECT id, CASE WHEN status IN ('processing', 'queued') AND updated_at < unixepoch() * 1000 - 900000 THEN 'failed' ELSE status END AS status, result_id FROM photo_jobs
      WHERE menu_id = ? AND source_id = ? ORDER BY updated_at DESC LIMIT 1`, menu.id, source).all();
    return json(results[0] ?? null);
  }
  fail(404, 'Page not found.');
}

async function api(request, env, url) {
  const method = request.method;
  const [, , resource, id, action, detail] = url.pathname.split('/');
  if (method !== 'GET' && request.headers.get('Origin') !== url.origin) fail(403, 'Request origin is invalid.');
  if (method === 'POST' && resource === 'auth' && ['register', 'login'].includes(id)) return auth(request, env, id);
  if (resource === 'auth' && id === 'logout' && method === 'POST') {
    const token = tokenFrom(request);
    if (token) await query(env, 'DELETE FROM sessions WHERE token_hash = ?', await sha(token)).run();
    return json({}, 200, { 'Set-Cookie': cookie(request, '', 0) });
  }
  if (resource === 'public' && method === 'GET') {
    const row = await query(env, 'SELECT published FROM menus WHERE slug = ? AND published IS NOT NULL', id ?? '').first();
    if (!row) fail(404, 'This menu is unavailable.');
    return json(JSON.parse(row.published), 200, { 'Cache-Control': 'public, max-age=30, s-maxage=60' });
  }
  if (resource === 'photo' && method === 'GET') {
    const photo = await query(env, `SELECT photos.*, menus.owner_id FROM photos
      JOIN menus ON menus.id = photos.menu_id WHERE photos.id = ?`, id ?? '').first();
    if (!photo || (!photo.published && (await identity(request, env))?.id !== photo.owner_id)) fail(404, 'Photo not found.');
    const object = await env.PHOTOS.get(photo.id);
    if (!object) fail(404, 'Photo not found.');
    return new Response(object.body, { headers: {
      'Content-Type': photo.mime, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': photo.published ? 'public, max-age=60, s-maxage=300' : 'private, no-store'
    } });
  }

  const account = await identity(request, env);
  if (!account) fail(401, 'Sign in to continue.');
  if (resource === 'session' && method === 'GET') return json({ signedIn: true });
  if (resource === 'menus' && !id && method === 'GET') {
    const { results } = await query(env, `SELECT id, slug, json_extract(draft, '$.name') AS name, published_at
      FROM menus WHERE owner_id = ? ORDER BY rowid DESC`, account.id).all();
    return json(results);
  }
  if (resource === 'menus' && !id && method === 'POST') {
    const { name } = await body(request);
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) fail(400, 'Enter a restaurant name up to 80 characters.');
    const menuId = uid();
    const label = name.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    const slug = (label || 'menu') + '-' + menuId.slice(0, 12);
    await query(env, 'INSERT INTO menus (id, owner_id, slug, draft) VALUES (?, ?, ?, ?)',
      menuId, account.id, slug, JSON.stringify(makeDraft(name.trim()))).run();
    return json(view(await query(env, 'SELECT * FROM menus WHERE id = ?', menuId).first()), 201);
  }
  if (resource === 'menus' && isId(id)) {
    const menu = await query(env, 'SELECT * FROM menus WHERE id = ? AND owner_id = ?', id, account.id).first();
    if (!menu) fail(404, 'Menu not found.');
    return privateMenu(request, env, account.id, menu, action, detail);
  }
  fail(404, 'Page not found.');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        const cacheable = request.method === 'GET' &&
          /^\/api\/(?:public|photo)\/[a-z0-9-]+$/.test(url.pathname) &&
          !request.headers.has('Authorization') &&
          !/no-cache|no-store/i.test(request.headers.get('Cache-Control') ?? '');
        if (!cacheable) return await api(request, env, url);
        const key = new URL(url.pathname, url.origin);
        const cached = await caches.default.match(key);
        if (cached) return cached;
        const response = await api(request, env, url);
        if (response.ok && response.headers.get('Cache-Control')?.startsWith('public,')) {
          ctx.waitUntil(caches.default.put(key, response.clone()).catch((error) => console.error('Edge cache write failed', error)));
        }
        return response;
      } catch (error) {
        if (error instanceof RequestError) return json({ error: error.message }, error.status);
        console.error(error);
        return json({ error: 'Something went wrong. Try again.' }, 500);
      }
    }
    if (request.method === 'GET' && /^\/(?:m\/[a-z0-9-]+|studio)\/?$/.test(url.pathname)) {
      return env.ASSETS.fetch(new URL('/', url));
    }
    return env.ASSETS.fetch(request);
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      const { id } = message.body;
      const lease = now();
      const job = await query(env, `UPDATE photo_jobs SET status = 'processing', updated_at = ?
        WHERE id = ? AND (status = 'queued' OR (status = 'processing' AND updated_at < ?))
        RETURNING *`, lease, id, lease - 180000).first();
      if (!job) {
        const existing = await query(env, 'SELECT status FROM photo_jobs WHERE id = ?', id).first();
        if (existing?.status === 'processing' && message.attempts < 3) message.retry({ delaySeconds: 185 });
        else message.ack();
        continue;
      }
      try {
        const source = await env.PHOTOS.get(job.source_id);
        if (!source) throw new Error('Original image is missing');
        const data = await editPhoto(env, source, source.httpMetadata.contentType, job.background);
        const photo = await savePhoto(env, job.menu_id, data, 'image/webp');
        await query(env, "UPDATE photo_jobs SET status = 'ready', result_id = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
          photo, now(), job.id, lease).run();
        message.ack();
      } catch (error) {
        console.error('Photo job failed', id, error.message);
        const status = message.attempts >= 3 ? 'failed' : 'queued';
        await query(env, 'UPDATE photo_jobs SET status = ?, updated_at = ? WHERE id = ? AND updated_at = ?', status, now(), job.id, lease).run();
        if (status === 'queued') message.retry({ delaySeconds: 30 });
        else message.ack();
      }
    }
  }
};
