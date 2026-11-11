import { designOf, escape as e } from '/guest/render.js';

export const app = document.querySelector('#app');
export const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');

export const S = { state: null, tab: 'dishes', openDish: '', proposal: null, viewing: null, sample: null, render() {} };

export async function api(path, method = 'GET', data) {
  const options = { method };
  if (data instanceof Blob) {
    options.body = data;
    options.headers = { 'Content-Type': data.type };
  } else if (data !== undefined) {
    options.body = JSON.stringify(data);
    options.headers = { 'Content-Type': 'application/json' };
  }
  let response;
  try { response = await fetch('/api/' + path, options); } catch {
    throw Object.assign(new Error('Could not reach SmartMenu. Check your connection.'), { status: 0 });
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || 'Something went wrong. Try again.'), { status: response.status });
  return result;
}

let notice;
let toastAction;

export function tell(message, action) {
  clearTimeout(notice);
  toastAction = action?.run;
  if (!message) { toast.textContent = ''; return; }
  toast.innerHTML = `<span>${e(message)}</span>${action ? `<button class="toast-action" data-do="toast-action">${e(action.label)}</button>` : ''}`;
  notice = setTimeout(() => tell(''), action ? 12000 : 5000);
}

export function runToastAction() {
  const run = toastAction;
  tell('');
  return run?.();
}

export function showDialog(title, content) {
  dialog.innerHTML = `<div class="row spread"><h2>${title}</h2><button class="btn quiet" data-do="close" aria-label="Close dialog">✕</button></div>${content}`;
  if (!dialog.open) dialog.showModal();
}

export function withDefaults(section) {
  section.note ??= '';
  for (const item of section.items) {
    item.portion ??= '';
    item.tags ??= [];
  }
  return section;
}

export function normalize(draft) {
  const { template, palette } = designOf(draft);
  Object.assign(draft, { template, palette });
  for (const key of ['theme', 'layout', 'font']) delete draft[key];
  draft.sections.forEach(withDefaults);
  return draft;
}

export function load(result) {
  normalize(result.draft);
  S.state = result;
}

const clock = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function when(value) {
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return '';
  const day = (offset) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offset); return d; };
  if (date >= day(0)) return 'Today ' + clock(date);
  if (date >= day(1)) return 'Yesterday ' + clock(date);
  if (date >= day(6)) return date.toLocaleDateString([], { weekday: 'long' }) + ' ' + clock(date);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }) + ' ' + clock(date);
}

export const findDish = (id) => S.state.draft.sections.flatMap((section) => section.items).find((dish) => dish.id === id);
