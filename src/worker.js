import qrcode from 'qrcode-generator';
import { RequestError, cleanDraft, draftPhotosIn, isId, makeDraft, photoMap, photosIn, publishedMenu, storedPublished, uid } from './menu.js';
import { editPhoto, extractMenu, imageProvider, lookOf, textProvider } from './ai.js';
import { agentInput, askAgent } from './agent.js';
import { getRevision, isAdmin, latestRevision, listRevisions, logEvent, revisionStatements, saveMeta, usageReport } from './records.js';
import { designOf, escape, renderDocument } from '../public/guest/render.js';
import { samples } from '../public/guest/samples.js';
import baseCss from '../public/guest/base.css';
import osteria from '../public/guest/osteria.css';
import carta from '../public/guest/carta.css';
import mercato from '../public/guest/mercato.css';
import notte from '../public/guest/notte.css';

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
const templateCss = { osteria, carta, mercato, notte };
const sampleAliases = new Map([['osteria-verde-example', 'demo-osteria']]);
const publicCache = 'public, max-age=30, s-maxage=60';
const jobLook = "COALESCE(look, CASE background WHEN 'transparent' THEN 'cutout' ELSE 'natural' END) AS look";
const originOf = (env, url) => env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).origin : url.origin;
const dimension = (value) => /^\d{1,9}$/.test(value ?? '') ? Math.min(10000, Math.max(1, Number(value))) : null;
const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

// Workers rejects PBKDF2 above 100000 iterations, and only in production.
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const digest = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256'
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
    await logEvent(env, id, null, 'signup');
  } else {
    const [salt, hash] = account?.password.split(':') ?? ['0'.repeat(32), '0'.repeat(64)];
    const candidate = await passwordHash(password, salt);
    if (!account || !equalHex(candidate, hash)) fail(401, 'Email or password is incorrect.');
    await logEvent(env, account.id, null, 'signin');
  }
  const token = random(32);
  await env.DB.batch([
    query(env, 'DELETE FROM sessions WHERE expires_at <= ?', now()),
    query(env, 'INSERT INTO sessions VALUES (?, ?, ?)', await sha(token), account.id, now() + days * 1000)
  ]);
  return json({ signedIn: true }, 200, { 'Set-Cookie': cookie(request, token, days) });
}

async function savePhoto(env, menuId, data, mime, { width = null, height = null, cutout = false } = {}) {
  const id = uid();
  await env.PHOTOS.put(id, data, { httpMetadata: { contentType: mime } });
  try {
    await query(env, 'INSERT INTO photos (id, menu_id, mime, width, height, cutout) VALUES (?, ?, ?, ?, ?, ?)',
      id, menuId, mime, width && height ? width : null, width && height ? height : null, cutout ? 1 : 0).run();
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

async function photoRows(env, menuId, ids) {
  const { results } = await query(env, `SELECT id, width, height, cutout FROM photos
    WHERE menu_id = ? AND id IN (SELECT value FROM json_each(?))`, menuId, JSON.stringify(ids)).all();
  return results;
}

async function view(env, row) {
  const draft = cleanDraft(JSON.parse(row.draft));
  draft.photos = photoMap(await photoRows(env, row.id, draftPhotosIn(draft)));
  return { id: row.id, slug: row.slug, draft, version: row.version, publishedAt: row.published_at };
}

async function revisionDraft(env, menuId, revision) {
  const draft = cleanDraft(JSON.parse(revision.draft));
  const rows = await photoRows(env, menuId, draftPhotosIn(draft));
  const owned = new Set(rows.map((row) => row.id));
  for (const dish of draft.sections.flatMap((section) => section.items)) {
    if (dish.photo && !owned.has(dish.photo)) dish.photo = null;
    if (dish.originalPhoto && !owned.has(dish.originalPhoto)) dish.originalPhoto = null;
  }
  return { draft, rows };
}

async function saveDraft(env, account, menu, draft, version, meta) {
  const encoded = JSON.stringify(draft);
  const ids = draftPhotosIn(draft);
  const rows = await photoRows(env, menu.id, ids);
  if (rows.length !== ids.length) fail(400, 'A photo does not belong to this menu.');
  const publishing = meta.published;
  if (publishing && !draft.sections.some((section) => section.items.length)) fail(400, 'Add a dish before publishing.');
  if (publishing && draft.sections.some((section) => section.items.some((item) => item.review))) {
    fail(400, 'Review the flagged dishes before publishing.');
  }
  const expected = version ?? 0;
  const at = now();
  const revisions = revisionStatements(env, menu.id, expected, await latestRevision(env, menu.id),
    { ...meta, account, draft: encoded, at });
  const statements = publishing ? [
    query(env, `UPDATE menus SET draft = ?, published = ?, published_at = ?, version = version + 1
      WHERE id = ? AND version = ?`, encoded, JSON.stringify(publishedMenu(draft, photoMap(rows))), at, menu.id, expected),
    query(env, `UPDATE photos SET published = (id IN (SELECT value FROM json_each(?)))
      WHERE menu_id = ? AND changes() = 1`, JSON.stringify(photosIn(draft)), menu.id)
  ] : [query(env, 'UPDATE menus SET draft = ?, version = version + 1 WHERE id = ? AND version = ?', encoded, menu.id, expected)];
  const results = await env.DB.batch([...revisions, ...statements]);
  if (!results[revisions.length].meta.changes) fail(409, 'This menu changed in another tab. Reopen it before saving.');
  if (publishing) await logEvent(env, account, menu.id, 'published', { source: meta.source });
  return json(await view(env, await query(env, 'SELECT * FROM menus WHERE id = ?', menu.id).first()));
}

async function privateMenu(request, env, account, menu, action, detail, extra) {
  const method = request.method;
  if (!action && method === 'GET') return json(await view(env, menu));
  if (action === 'qr' && method === 'GET' && menu.published) {
    const qr = qrcode(0, 'M');
    qr.addData(new URL('/m/' + menu.slug, originOf(env, new URL(request.url))).href);
    qr.make();
    return new Response(qr.createSvgTag({ cellSize: 5, margin: 20, scalable: true }), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store' }
    });
  }


  if ((!action && method === 'PUT') || (action === 'publish' && method === 'POST')) {
    const input = await body(request);
    return saveDraft(env, account, menu, cleanDraft(input.draft), input.version, { ...saveMeta(input), published: action === 'publish' });
  }
  if (action === 'revisions' && !detail && method === 'GET') return json(await listRevisions(env, menu.id));
  if (action === 'revisions' && detail && ((method === 'GET' && !extra) || (method === 'POST' && extra === 'restore'))) {
    const revision = isId(detail) && await getRevision(env, menu.id, detail);
    if (!revision) fail(404, 'Version not found.');
    const { draft, rows } = await revisionDraft(env, menu.id, revision);
    if (method === 'GET') {
      return json({
        id: revision.id, createdAt: revision.created_at, source: revision.source, summary: revision.summary,
        published: revision.published === 1, draft: { ...draft, photos: photoMap(rows) }
      });
    }
    const { version } = await body(request);
    const saved = await saveDraft(env, account, menu, draft, version, { source: 'restore', summary: '', published: false, restoredFrom: revision.id });
    await logEvent(env, account, menu.id, 'restored', { revision: revision.id });
    return saved;
  }
  if (action === 'agent' && method === 'POST') {
    const input = await body(request);
    const ask = agentInput(input);
    const draft = cleanDraft(input.draft);
    if (!textProvider(env)) fail(503, 'The assistant needs an xAI or OpenAI API key on the server.');
    await useQuota(env, account, 'agent', 200);
    const result = await askAgent(env, { account, menu: menu.id }, draft, ask);
    await logEvent(env, account, menu.id, 'assistant_asked', { length: ask.message.length, ops: result.ops.length });
    return json(result);
  }

  if (action === 'photos' && method === 'POST') {
    const file = await imageFile(request);
    await useQuota(env, account, 'upload', 150);
    const params = new URL(request.url).searchParams;
    const size = { width: dimension(params.get('w')), height: dimension(params.get('h')) };
    const id = await savePhoto(env, menu.id, file.stream(), file.type, size);
    await logEvent(env, account, menu.id, 'photo_uploaded', { photo: id });
    return json({ id }, 201);
  }
  if (action === 'import' && method === 'POST') {
    if (!textProvider(env)) fail(503, 'Menu import needs an xAI or OpenAI API key on the server.');
    const file = await imageFile(request);
    await useQuota(env, account, 'import', 30);
    const sections = await extractMenu(env, file, { account, menu: menu.id });
    await logEvent(env, account, menu.id, 'menu_imported', { sections: sections.length, dishes: sections.reduce((total, section) => total + section.items.length, 0) });
    return json({ sections });
  }
  if (action === 'edits' && !detail && method === 'POST') {
    const provider = imageProvider(env);
    if (!provider) fail(503, 'Photo editing needs an image API key on the server.');
    const input = await body(request);
    const look = lookOf(input.look ?? input.background);
    if (!isId(input.source) || !look) fail(400, 'Choose a valid photo and look.');
    if (!provider.looks.includes(look)) fail(400, 'This image model cannot cut out the background. Choose another look.');
    const photo = await query(env, 'SELECT id, mime FROM photos WHERE id = ? AND menu_id = ?', input.source, menu.id).first();
    if (!photo) fail(404, 'Photo not found.');
    if (!provider.images.includes(photo.mime)) fail(415, 'This image model needs a JPEG or PNG photo.');
    await useQuota(env, account, 'edit', 25);
    const id = uid();
    await query(env, 'INSERT INTO photo_jobs (id, menu_id, source_id, background, look, account_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, menu.id, photo.id, look, look, account, now()).run();
    await logEvent(env, account, menu.id, 'photo_edit_requested', { job: id, look, provider: provider.name });
    try { await env.PHOTO_JOBS.send({ id }); }
    catch (error) {
      await query(env, "UPDATE photo_jobs SET status = 'failed' WHERE id = ?", id).run();
      throw error;
    }
    return json({ id, status: 'queued' }, 202);
  }
  if (action === 'edits' && method === 'GET') {
    if (detail) {
      const job = await query(env, `SELECT id, CASE WHEN status IN ('processing', 'queued') AND updated_at < unixepoch() * 1000 - 900000 THEN 'failed' ELSE status END AS status, result_id, ${jobLook} FROM photo_jobs WHERE id = ? AND menu_id = ?`, detail, menu.id).first();
      if (!job) fail(404, 'Photo edit not found.');
      return json(job);
    }
    const source = new URL(request.url).searchParams.get('source');
    if (!isId(source)) fail(400, 'Choose a photo.');
    const { results } = await query(env, `SELECT id, CASE WHEN status IN ('processing', 'queued') AND updated_at < unixepoch() * 1000 - 900000 THEN 'failed' ELSE status END AS status, result_id, ${jobLook} FROM photo_jobs
      WHERE menu_id = ? AND source_id = ? ORDER BY updated_at DESC LIMIT 1`, menu.id, source).all();
    return json(results[0] ?? null);
  }
  fail(404, 'Page not found.');
}

async function api(request, env, url) {
  const method = request.method;
  const [, , resource, id, action, detail, extra] = url.pathname.split('/');
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
    return json(storedPublished(row.published), 200, { 'Cache-Control': publicCache });
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
  if (resource === 'admin' && id === 'usage' && !action && method === 'GET') {
    const { email } = await query(env, 'SELECT email FROM accounts WHERE id = ?', account.id).first();
    if (!isAdmin(env, email)) fail(404, 'Page not found.');
    return json(await usageReport(env, url.searchParams.get('days')));
  }
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
    await logEvent(env, account.id, menuId, 'menu_created');
    return json(await view(env, await query(env, 'SELECT * FROM menus WHERE id = ?', menuId).first()), 201);
  }
  if (resource === 'menus' && isId(id)) {
    const menu = await query(env, 'SELECT * FROM menus WHERE id = ? AND owner_id = ?', id, account.id).first();
    if (!menu) fail(404, 'Menu not found.');
    return privateMenu(request, env, account.id, menu, action, detail, extra);
  }
  fail(404, 'Page not found.');
}

const page = (html, status, cache) => new Response(html, { status, headers: { ...pageHeaders, 'Cache-Control': cache } });

const notice = (title, text) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#fbf7ed;color:#2d2b22;font:16px/1.5 system-ui,sans-serif;text-align:center}h1{font:400 2rem/1.2 Georgia,serif;margin:0 0 8px}p{margin:0;max-width:32em;color:#5d594b}</style>
</head>
<body><main><h1>${escape(title)}</h1><p>${escape(text)}</p></main></body>
</html>`;

async function guestPage(env, url, slug) {
  const key = sampleAliases.get(slug) ?? slug;
  let menu = Object.hasOwn(samples, key) ? samples[key] : null;
  if (!menu && slug) {
    const row = await query(env, 'SELECT published FROM menus WHERE slug = ? AND published IS NOT NULL', slug).first();
    menu = row && storedPublished(row.published);
  }
  if (!menu) {
    return page(notice('Menu not found', 'This menu is not available. Check the link, or ask the staff for the current QR code.'), 404, 'no-store');
  }
  const canonical = new URL('/m/' + key, originOf(env, url)).href;
  return page(renderDocument(menu, { css: baseCss + templateCss[designOf(menu).template], canonical }), 200, publicCache);
}

async function edgeCached(request, url, ctx, produce) {
  if (request.headers.has('Authorization') || /no-cache|no-store/i.test(request.headers.get('Cache-Control') ?? '')) return produce();
  const key = new URL(url.pathname, url.origin);
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const response = await produce();
  if (response.ok && response.headers.get('Cache-Control')?.startsWith('public,')) {
    ctx.waitUntil(caches.default.put(key, response.clone()).catch((error) => console.error('Edge cache write failed', error)));
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        if (request.method === 'GET' && /^\/api\/(?:public|photo)\/[a-z0-9-]+$/.test(url.pathname)) {
          return await edgeCached(request, url, ctx, () => api(request, env, url));
        }
        return await api(request, env, url);
      } catch (error) {
        if (error instanceof RequestError) return json({ error: error.message }, error.status);
        console.error(error);
        return json({ error: 'Something went wrong. Try again.' }, 500);
      }
    }
    if (['GET', 'HEAD'].includes(request.method) && url.pathname.startsWith('/m/')) {
      const slug = url.pathname.match(/^\/m\/([a-z0-9-]+)\/?$/)?.[1];
      try {
        return await edgeCached(request, url, ctx, () => guestPage(env, url, slug));
      } catch (error) {
        console.error(error);
        return page(notice('Something went wrong', 'The menu could not be loaded. Try again in a moment.'), 500, 'no-store');
      }
    }
    if (request.method === 'GET' && /^\/studio\/?$/.test(url.pathname)) return env.ASSETS.fetch(new URL('/', url));
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
      const account = job.account_id ?? (await query(env, 'SELECT owner_id FROM menus WHERE id = ?', job.menu_id).first())?.owner_id;
      try {
        const source = await env.PHOTOS.get(job.source_id);
        if (!source) throw new Error('Original image is missing');
        const look = job.look ?? lookOf(job.background);
        const result = await editPhoto(env, { account, menu: job.menu_id }, source, source.httpMetadata.contentType, look);
        const photo = await savePhoto(env, job.menu_id, result.data, result.mime,
          { width: result.width, height: result.height, cutout: look === 'cutout' });
        await query(env, "UPDATE photo_jobs SET status = 'ready', result_id = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
          photo, now(), job.id, lease).run();
        await logEvent(env, account, job.menu_id, 'photo_edit_finished', { job: job.id, look, status: 'ready', photo });
        message.ack();
      } catch (error) {
        console.error('Photo job failed', id, error.message);
        const status = message.attempts >= 3 ? 'failed' : 'queued';
        await query(env, 'UPDATE photo_jobs SET status = ?, updated_at = ? WHERE id = ? AND updated_at = ?', status, now(), job.id, lease).run();
        if (status === 'queued') message.retry({ delaySeconds: 30 });
        else {
          await logEvent(env, account, job.menu_id, 'photo_edit_finished', { job: job.id, status: 'failed' });
          message.ack();
        }
      }
    }
  }
};
