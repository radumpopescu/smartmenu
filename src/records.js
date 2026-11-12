import { RequestError, uid } from './menu.js';
import { costMicros } from './models.js';

export const SOURCES = ['manual', 'agent', 'import'];
export const collapseWindow = 10 * 60 * 1000;
const keepRevisions = 200;
const query = (env, sql, ...params) => env.DB.prepare(sql).bind(...params);

export function saveMeta(input) {
  const source = input.source ?? 'manual';
  const summary = input.summary ?? '';
  if (!SOURCES.includes(source) || typeof summary !== 'string' || summary.trim().length > 200) {
    throw new RequestError(400, 'Check the change source and summary.');
  }
  return { source, summary: summary.trim() };
}

export const collapses = (latest, save) => Boolean(latest) && save.source === 'manual' && !save.published &&
  latest.source === 'manual' && !latest.published && latest.account_id === save.account &&
  save.at - latest.started_at < collapseWindow;

export async function latestRevision(env, menuId) {
  return query(env, 'SELECT id, account_id, source, published, started_at FROM revisions WHERE menu_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', menuId).first();
}

export function revisionStatements(env, menu, expectedVersion, latest, save) {
  const current = 'SELECT version FROM menus WHERE id = ?';
  const write = collapses(latest, save) ?
    query(env, `UPDATE revisions SET draft = ?, summary = ?, created_at = ? WHERE id = ? AND (${current}) = ?`,
      save.draft, save.summary, save.at, latest.id, menu, expectedVersion) :
    query(env, `INSERT INTO revisions (id, menu_id, account_id, source, summary, published, restored_from, draft, started_at, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (${current}) = ?`,
      uid(), menu, save.account, save.source, save.summary, save.published ? 1 : 0, save.restoredFrom ?? null,
      save.draft, save.at, save.at, menu, expectedVersion);
  return [write, query(env, `DELETE FROM revisions WHERE menu_id = ? AND id NOT IN
    (SELECT id FROM revisions WHERE menu_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)`, menu, menu, keepRevisions)];
}

export async function listRevisions(env, menuId) {
  const { results } = await query(env, `SELECT id, created_at AS createdAt, source, summary, published, restored_from AS restoredFrom
    FROM revisions WHERE menu_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100`, menuId).all();
  return results.map((row) => ({ ...row, published: row.published === 1 }));
}

export const getRevision = (env, menuId, id) =>
  query(env, 'SELECT * FROM revisions WHERE id = ? AND menu_id = ?', id, menuId).first();

export async function logEvent(env, account, menu, type, detail = {}) {
  try {
    await query(env, 'INSERT INTO events (created_at, account_id, menu_id, type, detail) VALUES (?, ?, ?, ?, ?)',
      Date.now(), account ?? null, menu ?? null, type, JSON.stringify(detail)).run();
  } catch (error) {
    console.error('Event write failed', type, error.message);
  }
}

const count = (value) => Number.isInteger(value) ? value : null;
export const maxRecord = 16000;

export function tokensOf(usage) {
  if (!usage) return { input: null, output: null, cached: null, reasoning: null, audioInput: null, audioOutput: null };
  return {
    input: count(usage.input_tokens ?? usage.prompt_tokens),
    output: count(usage.output_tokens ?? usage.completion_tokens),
    cached: count((usage.input_tokens_details ?? usage.prompt_tokens_details ?? usage.input_token_details)?.cached_tokens),
    reasoning: count((usage.output_tokens_details ?? usage.completion_tokens_details)?.reasoning_tokens),
    audioInput: count(usage.input_token_details?.audio_tokens),
    audioOutput: count(usage.output_token_details?.audio_tokens)
  };
}

export function clip(value) {
  if (value === null || value === undefined) return null;
  const text = (typeof value === 'string' ? value : JSON.stringify(value))
    .replace(/data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]*/g, '[image]');
  return text.length > maxRecord ? text.slice(0, maxRecord - 1) + '…' : text;
}

export async function logCall(env, meta, call) {
  const tokens = tokensOf(call.usage);
  try {
    await query(env, `INSERT INTO ai_calls (created_at, account_id, menu_id, feature, provider, model, status,
      input_tokens, output_tokens, cached_tokens, reasoning_tokens, usage, duration_ms, error,
      cost_micros, audio_input_tokens, audio_output_tokens, request, response, call_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      Date.now(), meta.account ?? null, meta.menu ?? null, meta.feature, call.provider, call.model, call.status,
      tokens.input, tokens.output, tokens.cached, tokens.reasoning, call.usage ? JSON.stringify(call.usage) : null,
      call.duration, call.error ? String(call.error).slice(0, 300) : null,
      costMicros(call.provider, call.model, call.usage), tokens.audioInput, tokens.audioOutput,
      clip(call.request), clip(call.response), meta.callRef ?? null).run();
  } catch (error) {
    console.error('AI call record failed', meta.feature, error.message);
  }
}

export const isAdmin = (env, email) => (env.ADMIN_EMAILS ?? '').split(',')
  .map((entry) => entry.trim().toLowerCase()).filter(Boolean).includes(email);
