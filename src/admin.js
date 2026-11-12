import { RequestError } from './menu.js';
import { loadSettings, saveSetting, settingsView } from './settings.js';

const query = (env, sql, ...params) => env.DB.prepare(sql).bind(...params);
const sums = ['calls', 'failed', 'inputTokens', 'outputTokens', 'cachedTokens', 'reasoningTokens',
  'audioInputTokens', 'audioOutputTokens', 'costMicros', 'unpricedCalls', 'durationMs'];
const integer = (value, min, max, fallback) => /^\d{1,12}$/.test(value ?? '') ? Math.min(max, Math.max(min, Number(value))) : fallback;

export function usageTotals(rows) {
  const add = (total, row) => {
    for (const key of sums) total[key] = (total[key] ?? 0) + (row[key] ?? 0);
    return total;
  };
  const features = {};
  for (const row of rows) features[row.feature] = add(features[row.feature] ?? {}, row);
  return { all: rows.reduce(add, Object.fromEntries(sums.map((key) => [key, 0]))), features };
}

export async function usageReport(env, value) {
  const days = integer(value, 1, 366, 30);
  const since = Date.now() - days * 86400000;
  const { results } = await query(env, `SELECT ai_calls.account_id AS accountId, accounts.email, feature, provider, model,
      COUNT(*) AS calls, SUM(status != 'ok') AS failed,
      COALESCE(SUM(input_tokens), 0) AS inputTokens, COALESCE(SUM(output_tokens), 0) AS outputTokens,
      COALESCE(SUM(cached_tokens), 0) AS cachedTokens, COALESCE(SUM(reasoning_tokens), 0) AS reasoningTokens,
      COALESCE(SUM(audio_input_tokens), 0) AS audioInputTokens, COALESCE(SUM(audio_output_tokens), 0) AS audioOutputTokens,
      COALESCE(SUM(cost_micros), 0) AS costMicros, SUM(cost_micros IS NULL) AS unpricedCalls,
      SUM(duration_ms) AS durationMs
    FROM ai_calls LEFT JOIN accounts ON accounts.id = ai_calls.account_id
    WHERE ai_calls.created_at >= ?
    GROUP BY ai_calls.account_id, feature, provider, model
    ORDER BY costMicros DESC, inputTokens + outputTokens DESC`, since).all();
  return { days, since, rows: results, totals: usageTotals(results) };
}

export async function callLog(env, params) {
  const limit = integer(params.get('limit'), 1, 100, 50);
  const before = integer(params.get('before'), 1, Number.MAX_SAFE_INTEGER, null);
  const feature = params.get('feature');
  if (feature !== null && !/^[a-z_]{1,40}$/.test(feature)) throw new RequestError(400, 'Choose a valid feature.');
  const { results } = await query(env, `SELECT ai_calls.id, ai_calls.created_at AS createdAt, ai_calls.account_id AS accountId,
      accounts.email, menu_id AS menuId, feature, provider, model, status,
      input_tokens AS inputTokens, output_tokens AS outputTokens, cached_tokens AS cachedTokens, reasoning_tokens AS reasoningTokens,
      audio_input_tokens AS audioInputTokens, audio_output_tokens AS audioOutputTokens, cost_micros AS costMicros,
      duration_ms AS durationMs, error, request, response, call_ref AS callRef,
      COALESCE(json_extract(usage, '$.client_reported'), 0) = 1 AS clientReported
    FROM ai_calls LEFT JOIN accounts ON accounts.id = ai_calls.account_id
    WHERE (? IS NULL OR ai_calls.id < ?) AND (? IS NULL OR feature = ?)
    ORDER BY ai_calls.id DESC LIMIT ?`, before, before, feature, feature, limit).all();
  const calls = results.map((row) => ({ ...row, clientReported: row.clientReported === 1 }));
  return { calls, next: calls.length === limit ? calls.at(-1).id : null };
}

export async function adminApi(env, account, request, url, action, read) {
  const method = request.method;
  if (action === 'usage' && method === 'GET') return usageReport(env, url.searchParams.get('days'));
  if (action === 'calls' && method === 'GET') return callLog(env, url.searchParams);
  if (action === 'settings' && method === 'GET') return settingsView(env, await loadSettings(env));
  if (action === 'settings' && method === 'PUT') {
    await saveSetting(env, account, await read());
    return settingsView(env, await loadSettings(env));
  }
  throw new RequestError(404, 'Page not found.');
}
