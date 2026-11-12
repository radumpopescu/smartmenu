import { api, when } from './core.js';
import { escape as e } from '/guest/render.js';

const FEATURES = ['assistant', 'import', 'photo', 'voice'];
const featureNames = { assistant: 'Assistant', agent: 'Assistant', import: 'Menu reading', photo: 'Photo edits', voice: 'Voice', voice_transcript: 'Voice transcription' };
const providers = { xai: 'xAI', openai: 'OpenAI' };
const secrets = { xai: 'XAI_API_KEY', openai: 'OPENAI_API_KEY' };
const pageSize = 25;

const models = { data: null, error: '', notes: {} };
const costs = { days: 30, data: null, error: '', request: 0 };
const log = { feature: '', rows: null, error: '', more: false, loading: false, open: new Set(), request: 0 };
let root;

const featureName = (key) => featureNames[key] ?? key ?? '—';
const pick = (row, ...keys) => keys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null) ?? null;
const number = (value) => value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('en-US');
const plain = (value) => Number(value) || 0;

export function dollars(micros) {
  if (micros === null || micros === undefined || !Number.isFinite(Number(micros))) return '—';
  const value = Number(micros) / 1e6;
  if (value === 0) return '$0.00';
  const places = Math.min(6, Math.max(2, Math.ceil(-Math.log10(Math.abs(value))) + 1));
  return '$' + value.toFixed(places);
}

const seconds = (ms) => ms === null || ms === undefined || !Number.isFinite(Number(ms)) ? '—' :
  Number(ms) < 1000 ? Math.round(ms) + ' ms' : (Number(ms) / 1000).toFixed(Number(ms) < 10000 ? 1 : 0) + ' s';

function priceSummary(prices = {}) {
  const $ = (value) => '$' + (Number(value) < 0.1 ? Number(value).toString() : Number(value).toFixed(2).replace(/\.00$/, ''));
  if (prices.perImage !== undefined) return `${$(prices.perImage)} per image`;
  if (prices.perMinute !== undefined) return `${$(prices.perMinute)} per minute`;
  const parts = prices.audioIn !== undefined ? [[prices.textIn, 'text in'], [prices.audioIn, 'audio in'], [prices.textOut, 'text out']] :
    prices.imageOut !== undefined ? [[prices.textIn, 'text in'], [prices.imageIn, 'image in'], [prices.imageOut, 'image out']] :
    [[prices.input, 'in'], [prices.output, 'out']];
  return parts.filter(([value]) => value !== undefined).map(([value, label]) => `${$(value)} ${label}`).join(' · ') + ' per 1M tokens';
}

const state = (kind, text, retry) => `<div class="${kind === 'error' ? 'empty is-error' : kind === 'empty' ? 'empty' : 'admin-loading'}" ${kind === 'error' ? 'role="alert"' : 'role="status"'}>
  <p>${e(text)}</p>${retry ? `<button class="btn" data-admin="${retry}">Try again</button>` : ''}</div>`;

function failed(error, what) {
  if (error.status === 404) return `${what} is not available on this server yet.`;
  if (error.status === 401) return 'Your session has ended. Sign in again.';
  return `Could not load ${what.toLowerCase()}. ${error.message}`;
}

function modelsHTML() {
  const head = '<h2 id="models-title">Models</h2><p class="admin-intro">Which model serves each feature. A change applies to the next request.</p>';
  if (models.error) return head + state('error', models.error, 'models-retry');
  if (!models.data) return head + state('loading', 'Loading models…');
  const { settings = {}, effective = {}, options = {} } = models.data;
  const features = FEATURES.filter((feature) => options[feature] || effective[feature]);
  return head + `<div class="model-rows">${features.map((feature) => {
    const now = effective[feature] ?? {};
    const list = options[feature] ?? [];
    const current = list.findIndex((option) => option.provider === now.provider && option.model === now.model);
    const explicit = Boolean(settings[feature]);
    const note = models.notes[feature];
    return `<form class="model-row" data-admin-form="model" data-feature="${e(feature)}">
      <div class="model-copy"><h3>${e(featureName(feature))}</h3>
        <p class="model-now"><span>${e(providers[now.provider] ?? now.provider ?? '—')} · ${e(now.label ?? now.model ?? '—')}</span>
          <span class="badge quiet">${explicit ? 'Set here' : 'Default'}</span></p>
        ${now.error ? `<p class="model-warning">${e(now.error)}</p>` : ''}</div>
      <label class="model-pick"><span class="sr-only">Model for ${e(featureName(feature))}</span>
        <select name="option" ${list.length ? '' : 'disabled'}>${list.map((option, index) =>
          `<option value="${index}" ${index === current ? 'selected' : ''}>${e(option.label ?? option.model)} — ${e(priceSummary(option.prices))}${option.available === false ? ` — needs ${e(secrets[option.provider] ?? 'a key')}` : ''}</option>`).join('')}</select></label>
      <div class="model-actions"><button class="btn primary">Save</button>
        <button type="button" class="btn quiet" data-admin="reset" ${explicit ? '' : 'disabled'}>Use default</button></div>
      <p class="model-note${note?.error ? ' is-error' : ''}" role="status">${e(note?.text ?? '')}</p>
    </form>`;
  }).join('')}</div>`;
}

function group(rows, keyOf, seed) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, { ...seed(row), calls: 0, failed: 0, input: 0, output: 0, audioIn: 0, audioOut: 0, audio: false, cost: 0, priced: 0, unpriced: 0, duration: 0 });
    const entry = groups.get(key);
    const calls = plain(pick(row, 'calls', 'requests'));
    entry.calls += calls;
    entry.failed += plain(row.failed);
    entry.input += plain(row.inputTokens);
    entry.output += plain(row.outputTokens);
    const audioIn = pick(row, 'audioInputTokens', 'audioInTokens');
    const audioOut = pick(row, 'audioOutputTokens', 'audioOutTokens');
    if (audioIn !== null || audioOut !== null) entry.audio = entry.audio || plain(audioIn) + plain(audioOut) > 0;
    entry.audioIn += plain(audioIn);
    entry.audioOut += plain(audioOut);
    const cost = pick(row, 'costMicros');
    const unpriced = cost === null ? calls : Math.min(calls, plain(row.unpricedCalls));
    entry.unpriced += unpriced;
    entry.priced += calls - unpriced;
    entry.cost += plain(cost);
    entry.duration += plain(row.durationMs);
  }
  return [...groups.values()].sort((a, b) => b.cost - a.cost || b.calls - a.calls);
}

function costCell(entry) {
  if (!entry.priced && entry.unpriced) return '—';
  const text = dollars(entry.cost);
  return entry.unpriced ? `<span title="${entry.unpriced} request${entry.unpriced === 1 ? '' : 's'} without a known cost">≥ ${text}</span>` : text;
}

const average = (entry) => entry.priced ? dollars(entry.cost / entry.priced) : '—';
const table = (caption, head, body) => `<div class="table-wrap" tabindex="0" role="region" aria-label="${e(caption)}"><table>
  <caption class="sr-only">${e(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
const th = (label, numeric) => `<th scope="col"${numeric ? ' class="num"' : ''}>${label}</th>`;
const td = (value, numeric) => `<td${numeric ? ' class="num"' : ''}>${value}</td>`;

function costsHTML() {
  const head = `<div class="row spread"><h2 id="costs-title">Costs</h2>
    <div class="segmented" role="group" aria-label="Period">${[7, 30, 90].map((days) =>
      `<button data-admin="days" data-value="${days}" aria-pressed="${costs.days === days}">${days} days</button>`).join('')}</div></div>`;
  if (costs.error) return head + state('error', costs.error, 'costs-retry');
  if (!costs.data) return head + state('loading', 'Loading costs…');
  const rows = Array.isArray(costs.data.rows) ? costs.data.rows : [];
  if (!rows.length) return head + state('empty', `No model requests in the last ${costs.days} days.`);
  const all = group(rows, () => 'all', () => ({}))[0];
  const models = group(rows, (row) => [row.feature, row.provider, row.model].join('|'), (row) => ({ feature: row.feature, provider: row.provider, model: row.model }));
  const audio = models.some((entry) => entry.audio);
  const accounts = group(rows, (row) => pick(row, 'email', 'accountId') ?? 'none', (row) => ({ email: pick(row, 'email') ?? (row.accountId ? 'Deleted account' : 'No account') }));
  return head + `<dl class="totals">
      <div><dt>Total cost</dt><dd>${costCell(all)}</dd></div>
      <div><dt>Requests</dt><dd>${number(all.calls)}</dd></div>
      <div><dt>Failures</dt><dd>${number(all.failed)}</dd></div></dl>
    <h3 class="admin-sub">By feature and model</h3>
    ${table('Costs by feature and model', th('Feature') + th('Model') + th('Requests', 1) + th('Failed', 1) + th('Input tokens', 1) + th('Output tokens', 1) +
      (audio ? th('Audio in', 1) + th('Audio out', 1) : '') + th('Cost', 1) + th('Avg / request', 1) + th('Avg time', 1),
      models.map((entry) => `<tr>${td(e(featureName(entry.feature)))}${td(`<span class="nowrap">${e(entry.model ?? '—')}</span><span class="cell-note">${e(providers[entry.provider] ?? entry.provider ?? '')}</span>`)}
        ${td(number(entry.calls), 1)}${td(number(entry.failed), 1)}${td(number(entry.input), 1)}${td(number(entry.output), 1)}
        ${audio ? td(entry.audio ? number(entry.audioIn) : '—', 1) + td(entry.audio ? number(entry.audioOut) : '—', 1) : ''}
        ${td(costCell(entry), 1)}${td(average(entry), 1)}${td(entry.calls && entry.duration ? seconds(entry.duration / entry.calls) : '—', 1)}</tr>`).join(''))}
    <h3 class="admin-sub">By account</h3>
    ${table('Costs by account', th('Account') + th('Requests', 1) + th('Failed', 1) + th('Input tokens', 1) + th('Output tokens', 1) + th('Cost', 1) + th('Avg / request', 1),
      accounts.map((entry) => `<tr>${td(`<span class="nowrap">${e(entry.email)}</span>`)}${td(number(entry.calls), 1)}${td(number(entry.failed), 1)}
        ${td(number(entry.input), 1)}${td(number(entry.output), 1)}${td(costCell(entry), 1)}${td(average(entry), 1)}</tr>`).join(''))}`;
}

function shown(value) {
  if (value === null || value === undefined || value === '') return '';
  let data = value;
  if (typeof value === 'string') {
    try { data = JSON.parse(value); } catch { return value; }
  }
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function tokens(row) {
  const input = pick(row, 'inputTokens', 'input_tokens');
  const output = pick(row, 'outputTokens', 'output_tokens');
  const audio = plain(row.audioInputTokens) + plain(row.audioOutputTokens);
  if (input === null && output === null) return '—';
  return `<span class="nowrap">${number(input)} in · ${number(output)} out</span>${audio ? `<span class="cell-note">audio ${number(row.audioInputTokens ?? 0)} in · ${number(row.audioOutputTokens ?? 0)} out</span>` : ''}`;
}

function callHTML(row) {
  const id = String(row.id);
  const open = log.open.has(id);
  const status = String(row.status ?? '');
  const error = pick(row, 'error');
  const request = shown(row.request);
  const response = shown(row.response);
  const block = (label, text) => `<div class="call-part"><h4>${label}</h4>${text ? `<pre>${e(text)}</pre>` : '<p class="cell-note">Not stored.</p>'}</div>`;
  return `<tr class="call${open ? ' is-open' : ''}">
    <td><button class="call-toggle" data-admin="call" data-value="${e(id)}" aria-expanded="${open}" aria-controls="call-${e(id)}">
      <span aria-hidden="true">${open ? '▾' : '▸'}</span><span class="nowrap">${e(when(pick(row, 'createdAt', 'created_at')))}</span><span class="sr-only">, show details</span></button></td>
    ${td(`<span class="nowrap">${e(pick(row, 'email') ?? '—')}</span>`)}${td(e(featureName(row.feature)))}
    ${td(`<span class="nowrap">${e(row.model ?? '—')}</span><span class="cell-note">${e(providers[row.provider] ?? row.provider ?? '')}</span>`)}
    ${td(`<span class="call-status${status === 'ok' ? '' : ' is-failed'}">${e(status || '—')}</span>${row.clientReported ? '<span class="cell-note">reported by browser</span>' : ''}`)}
    ${td(tokens(row), 1)}${td(dollars(pick(row, 'costMicros', 'cost_micros')), 1)}${td(row.clientReported && !row.durationMs ? '—' : seconds(pick(row, 'durationMs', 'duration_ms')), 1)}</tr>
    <tr class="call-detail" id="call-${e(id)}" ${open ? '' : 'hidden'}><td colspan="8">
      ${error ? `<p class="call-error"><strong>Error:</strong> ${e(error)}</p>` : ''}
      ${row.callRef ? `<p class="cell-note">Call ${e(row.callRef)}</p>` : ''}
      <div class="call-parts">${block('Request', request)}${block('Response', response)}</div></td></tr>`;
}

function logHTML() {
  const filter = `<label class="log-filter">Feature<select data-admin-filter>${['', ...FEATURES, 'voice_transcript'].map((feature) =>
    `<option value="${feature}" ${feature === log.feature ? 'selected' : ''}>${feature ? e(featureName(feature)) : 'All features'}</option>`).join('')}</select></label>`;
  const head = `<div class="row spread"><h2 id="requests-title">Requests</h2>${filter}</div>`;
  if (log.error && !log.rows?.length) return head + state('error', log.error, 'log-retry');
  if (!log.rows) return head + state('loading', 'Loading requests…');
  if (!log.rows.length) return head + state('empty', log.feature ? `No requests for ${featureName(log.feature).toLowerCase()} yet.` : 'No model requests yet.');
  return head + table('Recent requests, newest first', th('Time') + th('Account') + th('Feature') + th('Model') + th('Status') + th('Tokens', 1) + th('Cost', 1) + th('Duration', 1),
    log.rows.map(callHTML).join('')) +
    (log.error ? `<p class="form-error" role="alert">${e(log.error)}</p>` : '') +
    (log.more ? `<button class="btn log-more" data-admin="more" ${log.loading ? 'disabled' : ''}>${log.loading ? 'Loading…' : 'Load more'}</button>` : '');
}

function paint(id, html) {
  const section = root?.querySelector('#' + id);
  if (!section) return;
  const focused = section.contains(document.activeElement) ? document.activeElement : null;
  const selector = focused && (focused.dataset.admin ? `[data-admin="${focused.dataset.admin}"]${focused.dataset.value ? `[data-value="${focused.dataset.value}"]` : ''}` :
    focused.matches('[data-admin-filter]') ? '[data-admin-filter]' : focused.name === 'option' ? `[data-feature="${focused.form?.dataset.feature}"] select` : '');
  const feature = focused?.closest('[data-feature]')?.dataset.feature;
  section.innerHTML = html;
  if (!selector) return;
  const scoped = feature && !selector.includes('data-feature') ? section.querySelector(`[data-feature="${feature}"] ${selector}`) : section.querySelector(selector);
  (scoped && !scoped.disabled ? scoped : section.querySelector('h2'))?.focus();
}

const renderModels = () => paint('admin-models', modelsHTML());
const renderCosts = () => paint('admin-costs', costsHTML());
const renderLog = () => paint('admin-requests', logHTML());

async function loadModels() {
  models.error = '';
  try { models.data = await api('admin/settings'); } catch (error) { models.error = failed(error, 'Model settings'); }
  renderModels();
}

async function loadCosts() {
  const mine = ++costs.request;
  costs.error = '';
  costs.data = null;
  renderCosts();
  try {
    const data = await api('admin/usage?days=' + costs.days);
    if (mine === costs.request) costs.data = data;
  } catch (error) { if (mine === costs.request) costs.error = failed(error, 'Costs'); }
  if (mine === costs.request) renderCosts();
}

async function loadLog(more = false) {
  const mine = ++log.request;
  log.error = '';
  log.loading = true;
  if (!more) { log.rows = null; log.open.clear(); }
  renderLog();
  const params = new URLSearchParams({ limit: pageSize });
  if (log.feature) params.set('feature', log.feature);
  if (more && log.rows?.length) params.set('before', log.rows[log.rows.length - 1].id);
  try {
    const result = await api('admin/calls?' + params);
    if (mine !== log.request) return;
    const rows = Array.isArray(result) ? result : result.calls ?? result.rows ?? [];
    log.rows = more ? [...(log.rows ?? []), ...rows] : rows;
    log.more = result.next !== undefined ? result.next !== null : rows.length >= pageSize;
  } catch (error) {
    if (mine !== log.request) return;
    log.error = failed(error, 'Requests');
  }
  log.loading = false;
  renderLog();
}

async function saveModel(form, reset) {
  const feature = form.dataset.feature;
  const option = models.data.options[feature]?.[Number(form.elements.option.value)];
  if (!reset && !option) return;
  for (const button of form.querySelectorAll('button')) button.disabled = true;
  models.notes[feature] = { text: 'Saving…' };
  form.querySelector('.model-note').textContent = 'Saving…';
  try {
    const result = await api('admin/settings', 'PUT', reset ? { feature, reset: true } : { feature, provider: option.provider, model: option.model });
    models.data = result.effective ? result : await api('admin/settings');
    const now = models.data.effective?.[feature];
    models.notes[feature] = { text: reset ? `Back to the default: ${now?.label ?? now?.model ?? ''}.` : `Saved. ${featureName(feature)} now uses ${option.label ?? option.model}.` };
  } catch (error) {
    models.notes[feature] = { text: 'Not saved. ' + error.message, error: true };
  }
  renderModels();
}

function onClick(event) {
  const target = event.target.closest('[data-admin]');
  if (!target || !root.contains(target)) return;
  const action = target.dataset.admin;
  if (action === 'models-retry') { models.data = null; renderModels(); loadModels(); }
  else if (action === 'costs-retry') loadCosts();
  else if (action === 'log-retry') loadLog();
  else if (action === 'more') loadLog(true);
  else if (action === 'reset') saveModel(target.form, true);
  else if (action === 'days') {
    const days = Number(target.dataset.value);
    if (days === costs.days) return;
    costs.days = days;
    loadCosts();
  } else if (action === 'call') {
    const id = target.dataset.value;
    const open = !log.open.has(id);
    log.open[open ? 'add' : 'delete'](id);
    target.setAttribute('aria-expanded', String(open));
    target.firstElementChild.textContent = open ? '▾' : '▸';
    target.closest('tr').classList.toggle('is-open', open);
    document.getElementById('call-' + id).hidden = !open;
  }
}

export function mountAdmin(element) {
  root = element;
  root.innerHTML = `<h1 class="list-title">Admin</h1>
    <section class="admin-section" id="admin-models" aria-labelledby="models-title"></section>
    <section class="admin-section" id="admin-costs" aria-labelledby="costs-title"></section>
    <section class="admin-section" id="admin-requests" aria-labelledby="requests-title"></section>`;
  root.addEventListener('click', onClick);
  root.addEventListener('submit', (event) => {
    if (event.target.dataset.adminForm !== 'model') return;
    event.preventDefault();
    saveModel(event.target, false);
  });
  root.addEventListener('change', ({ target }) => {
    if (!target.matches('[data-admin-filter]')) return;
    log.feature = target.value;
    loadLog();
  });
  renderModels();
  loadModels();
  loadCosts();
  loadLog();
}
