import { RequestError } from './menu.js';
import { DEFAULTS, FEATURES, MODELS, SECRETS, modelOf, serves } from './models.js';

const labels = { assistant: 'The assistant', import: 'Menu import', photo: 'Photo editing', voice: 'Voice' };
const query = (env, sql, ...params) => env.DB.prepare(sql).bind(...params);
export const keyOf = (env, provider) => env[SECRETS[provider]] || null;

export async function loadSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value, updated_at, updated_by FROM settings').all();
  const settings = {};
  for (const row of results) {
    try {
      const { provider, model } = JSON.parse(row.value);
      if (FEATURES.includes(row.key) && serves(row.key, provider, model)) {
        settings[row.key] = { provider, model, updatedAt: row.updated_at, updatedBy: row.updated_by };
      }
    } catch {}
  }
  return settings;
}

export function choose(env, settings, feature) {
  const saved = settings[feature];
  if (saved) return { provider: saved.provider, model: saved.model, explicit: true };
  const [provider, model] = DEFAULTS[feature].find(([name]) => keyOf(env, name)) ?? DEFAULTS[feature][0];
  return { provider, model, explicit: false };
}

export function missingKey(env, feature, pick) {
  if (keyOf(env, pick.provider)) return null;
  if (pick.explicit) return `${labels[feature]} is set to ${pick.model}, which needs ${SECRETS[pick.provider]} on the server.`;
  const secrets = [...new Set(DEFAULTS[feature].map(([name]) => SECRETS[name]))];
  return `${labels[feature]} needs ${secrets.join(' or ')} on the server.`;
}

export function selected(env, settings, feature) {
  const pick = choose(env, settings, feature);
  const missing = missingKey(env, feature, pick);
  if (missing) throw new RequestError(503, missing);
  return pick;
}

export function settingsView(env, settings) {
  const view = (feature) => {
    const pick = choose(env, settings, feature);
    return { ...pick, label: modelOf(pick.provider, pick.model)?.label ?? pick.model, available: Boolean(keyOf(env, pick.provider)),
      error: missingKey(env, feature, pick) };
  };
  return {
    settings: Object.fromEntries(FEATURES.map((feature) => [feature, settings[feature] ?? null])),
    effective: Object.fromEntries(FEATURES.map((feature) => [feature, view(feature)])),
    options: Object.fromEntries(FEATURES.map((feature) => [feature, MODELS.filter((entry) => entry.features.includes(feature))
      .map(({ provider, model, label, prices }) => ({ provider, model, label, prices, available: Boolean(keyOf(env, provider)) }))]))
  };
}

export function settingInput(input) {
  const { feature, provider, model, reset } = input ?? {};
  if (!FEATURES.includes(feature)) throw new RequestError(400, 'Choose a feature.');
  if (reset === true) return { feature, reset: true };
  if (!serves(feature, provider, model)) throw new RequestError(400, 'This model cannot be used for this feature.');
  return { feature, provider, model };
}

export async function saveSetting(env, account, input) {
  const { feature, provider, model, reset } = settingInput(input);
  await (reset ? query(env, 'DELETE FROM settings WHERE key = ?', feature) :
    query(env, `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    feature, JSON.stringify({ provider, model }), Date.now(), account)).run();
  return { feature, provider: provider ?? null, model: model ?? null, reset: Boolean(reset) };
}
