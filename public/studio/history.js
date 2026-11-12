import { S, api, load, tell, when } from './core.js';
import { flush, resetSaves } from './save.js';
import { sendPreview } from './preview.js';
import { escape as e } from '/guest/render.js';

let revisions = null;
let failure = '';
let request = 0;

const what = ({ source, summary }) =>
  source === 'agent' ? 'Assistant' + (summary ? ': ' + summary : '') :
  source === 'import' ? 'Imported a menu page' :
  source === 'restore' ? 'Restored an earlier version' : 'Edited by hand';

export function historyHTML() {
  const intro = '<div class="row spread"><h2>History</h2><button class="btn quiet" data-do="history-refresh">Refresh</button></div>' +
    '<p class="history-intro">SmartMenu keeps earlier versions of your menu. Choose one to see it in the preview, then restore it if you want it back.</p>';
  if (failure) return intro + `<div class="empty" role="alert"><p>${e(failure)}</p><button class="btn" data-do="history-refresh">Try again</button></div>`;
  if (!revisions) return intro + '<p class="history-loading" role="status">Loading history…</p>';
  if (!revisions.length) return intro + '<div class="empty"><p>No saved versions yet. Your changes will appear here as you work.</p></div>';
  return intro + `<ol class="revisions">${revisions.map((entry, index) => {
    const current = S.viewing?.entry.id === entry.id;
    return `<li><button class="revision" data-do="view-revision" data-value="${e(entry.id)}" ${current ? 'aria-current="true"' : ''}>
      <span class="revision-when">${e(when(entry.createdAt))}${index === 0 ? ' <span class="badge quiet">Latest</span>' : ''}</span>
      <span class="revision-what">${e(what(entry))}</span>
      ${entry.published ? '<span class="badge">Published</span>' : ''}
      ${current ? '<span class="revision-showing">Showing in preview</span>' : ''}</button></li>`;
  }).join('')}</ol>`;
}

export async function loadHistory() {
  const mine = ++request;
  failure = '';
  try {
    const result = await api('menus/' + S.state.id + '/revisions');
    if (mine !== request) return;
    revisions = Array.isArray(result) ? result : result.revisions ?? [];
  } catch (error) {
    if (mine !== request) return;
    failure = error.status === 404 ? 'History is not available yet.' : 'Could not load the history. ' + error.message;
  }
  if (S.tab === 'history') S.render();
}

export function resetHistory() {
  revisions = null;
  failure = '';
  S.viewing = null;
}

export async function viewRevision(id) {
  const entry = revisions?.find((revision) => revision.id === id);
  if (!entry) return;
  if (S.viewing?.entry.id === id) return;
  S.viewing = { entry, draft: null };
  S.render();
  if (matchMedia('(max-width: 800px)').matches) document.querySelector('.preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const { draft } = await api(`menus/${S.state.id}/revisions/${encodeURIComponent(id)}`);
    if (S.viewing?.entry !== entry) return;
    S.viewing.draft = draft;
    sendPreview();
  } catch (error) {
    if (S.viewing?.entry === entry) S.viewing = null;
    S.render();
    tell('Could not open that version. ' + error.message);
  }
}

export function leaveRevision() {
  S.viewing = null;
  S.render();
}

export async function restoreRevision() {
  const { entry } = S.viewing ?? {};
  if (!entry) return;
  await flush();
  const root = document.querySelector('.studio');
  root.inert = true;
  try {
    load(await api(`menus/${S.state.id}/revisions/${encodeURIComponent(entry.id)}/restore`, 'POST', { version: S.state.version }));
    resetSaves();
    S.onEdit?.();
    S.viewing = null;
    revisions = null;
    S.render();
    tell('Restored the version from ' + when(entry.createdAt) + '.');
    loadHistory();
  } catch (error) {
    tell(error.status === 409 ? 'This menu changed in another tab. Reload the page first.' : error.message);
  } finally {
    root.inert = false;
  }
}
