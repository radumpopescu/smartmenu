import { S, api, when } from './core.js';
import { escape as e } from '/guest/render.js';

const delay = 1500;
let timer;
let retry;
let retryDelay = 5000;
let saving = null;
let edits = 0;
let savedEdits = 0;
let pendingMeta = null;
let conflict = false;
let status = { kind: 'saved' };

export const unsaved = () => edits !== savedEdits || Boolean(saving);
export const conflicted = () => conflict;
export const problem = () => status.kind === 'saved' || status.kind === 'saving' ? '' : status.text;

export function resetSaves() {
  clearTimeout(timer);
  clearTimeout(retry);
  savedEdits = edits;
  pendingMeta = null;
  setStatus('saved');
}

export function edited(meta) {
  edits++;
  S.onEdit?.();
  if (meta) pendingMeta = meta;
  if (conflict) return;
  clearTimeout(timer);
  timer = setTimeout(flush, delay);
  if (status.kind !== 'offline') setStatus('saving');
}

const quote = (name) => `“${name.trim() || 'Untitled'}”`;

function labelOf(input) {
  const label = input.getAttribute('aria-label') || input.closest('label')?.firstChild?.textContent?.trim() || 'a field';
  const dish = input.closest('[data-dish]') && S.state && findName(input.closest('[data-dish]').dataset.dish);
  return label.toLowerCase() + (dish !== undefined && dish !== null ? ' of ' + quote(dish) : '');
}

const findName = (id) => S.state.draft.sections.flatMap((section) => section.items).find((dish) => dish.id === id)?.name;

export function blocker() {
  const input = document.querySelector('.panel :is(input, textarea):invalid');
  if (input) return { message: 'check the ' + labelOf(input), find: () => document.querySelector('.panel :is(input, textarea):invalid') };
  const { draft } = S.state;
  if (!draft.name.trim()) return { message: 'the restaurant needs a name', tab: 'settings', selector: '[data-menu="name"]' };
  for (const section of draft.sections) {
    if (!section.name.trim()) return { message: 'every section needs a name', tab: 'dishes', selector: `[data-section="${section.id}"] [data-section-name]` };
    for (const item of section.items) {
      const at = (field) => ({ tab: 'dishes', dish: item.id, selector: `[data-dish="${item.id}"] [data-item="${field}"]` });
      if (!item.name.trim()) return { message: 'every dish needs a name', ...at('name') };
      if (Number.isNaN(item.price)) return { message: 'check the price of ' + quote(item.name), ...at('price') };
      if (Number.isNaN(item.calories)) return { message: 'check the calories of ' + quote(item.name), ...at('calories') };
    }
  }
  return null;
}

export function showBlocker() {
  const found = blocker();
  if (!found) { flush(); return; }
  if (found.tab && S.tab !== found.tab) S.tab = found.tab;
  if (found.dish) S.openDish = found.dish;
  if (found.tab || found.dish) S.render();
  const field = found.find?.() ?? document.querySelector(found.selector);
  field?.closest('details')?.setAttribute('open', '');
  field?.focus();
  field?.reportValidity?.();
}

export async function flush() {
  clearTimeout(timer);
  clearTimeout(retry);
  while (saving) await saving.catch(() => {});
  if (conflict) return false;
  if (edits === savedEdits) return true;
  const found = blocker();
  if (found) { setStatus('blocked', 'Not saved — ' + found.message); return false; }
  const sent = edits;
  const meta = pendingMeta ?? { source: 'manual' };
  pendingMeta = null;
  setStatus('saving');
  saving = api('menus/' + S.state.id, 'PUT', { draft: S.state.draft, version: S.state.version, ...meta, summary: meta.summary?.slice(0, 200) });
  try {
    const result = await saving;
    Object.assign(S.state, { version: result.version, publishedAt: result.publishedAt });
    S.state.draft.photos = { ...S.state.draft.photos, ...result.draft?.photos };
    savedEdits = sent;
    retryDelay = 5000;
    setStatus(edits === savedEdits ? 'saved' : 'saving');
    return true;
  } catch (error) {
    pendingMeta ??= meta;
    if (error.status === 409) {
      conflict = true;
      setStatus('conflict', 'Changed in another tab');
    } else if (!error.status || error.status >= 500) {
      setStatus('offline', 'Offline — will retry');
      retry = setTimeout(flush, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    } else setStatus('error', 'Not saved — ' + error.message);
    return false;
  } finally {
    saving = null;
  }
}

addEventListener('online', () => { if (S.state && status.kind === 'offline') flush(); });

function setStatus(kind, text = '') {
  status = { kind, text };
  renderStatus();
}

export function renderStatus() {
  const element = document.querySelector('#save-status');
  if (!element || !S.state) return;
  const { kind, text } = status;
  const published = S.state.publishedAt ? ` · Last published ${e(when(S.state.publishedAt))}` : ' · Not published yet';
  element.dataset.kind = kind;
  element.innerHTML = kind === 'saved' ? 'Saved' + published :
    kind === 'saving' ? 'Saving…' :
    kind === 'conflict' ? `${e(text)} — <button class="link" data-do="reload">Reload</button>` :
    kind === 'blocked' ? `${e(text)} <button class="link" data-do="show-blocker">Show me</button>` : e(text);
}
