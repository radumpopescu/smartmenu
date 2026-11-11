import { S, when } from './core.js';
import { escape as e } from '/guest/render.js';

let device = 'phone';
const pressed = (value) => `aria-pressed="${value}"`;

export function deviceHTML(label) {
  return `<div class="device" data-size="${device}"><div class="device-stage">
    <div class="device-frame"><iframe id="preview-frame" src="/guest/frame" title="${label}"></iframe></div>
  </div></div>`;
}

export const deviceToggle = () => `<div class="segmented" role="group" aria-label="Preview size">${['phone', 'tablet'].map((size) =>
  `<button data-do="device" data-value="${size}" ${pressed(size === device)}>${size === 'phone' ? 'Phone' : 'Tablet'}</button>`).join('')}</div>`;

export function setDevice(size) {
  device = size;
  document.querySelector('.device').dataset.size = device;
  for (const button of document.querySelectorAll('[data-do="device"]')) button.setAttribute('aria-pressed', button.dataset.value === device);
  fitDevice();
}

function fitDevice() {
  const root = document.querySelector('.device');
  if (!root) return;
  const stage = root.querySelector('.device-stage');
  const frame = root.querySelector('.device-frame');
  const bezel = root.dataset.size === 'tablet' ? 10 : 7;
  const width = (root.dataset.size === 'tablet' ? 820 : 390) + bezel * 2;
  const scale = Math.min(1, stage.clientWidth / width);
  const height = Math.round(Math.min(Number(root.dataset.max) || 700, Math.max(385, innerHeight * 0.73)));
  stage.style.height = height + 'px';
  frame.style.width = width + 'px';
  frame.style.height = height / scale + 'px';
  frame.style.setProperty('--scale', scale);
}

const fitter = new ResizeObserver(fitDevice);
addEventListener('resize', fitDevice);

export function mountDevice() {
  fitter.disconnect();
  const stage = document.querySelector('.device-stage');
  if (stage) fitter.observe(stage);
  fitDevice();
}

function previewMenu() {
  if (!S.state) return S.sample;
  if (S.proposal) return S.proposal.view === 'before' ? S.state.draft : S.proposal.planned;
  return S.viewing?.draft ?? S.state.draft;
}

export function sendPreview() {
  const frame = document.querySelector('#preview-frame');
  const menu = previewMenu();
  const highlight = S.proposal ? S.proposal.current.filter((change) => change.ok).map((change) => S.proposal.ops[change.index].id).filter(Boolean) : [];
  if (frame?.dataset.ready && menu) frame.contentWindow.postMessage({ type: 'sm-preview', menu, highlight }, location.origin);
  renderBanner();
}

addEventListener('message', (event) => {
  const frame = document.querySelector('#preview-frame');
  if (event.origin !== location.origin || event.source !== frame?.contentWindow || event.data?.type !== 'sm-frame-ready') return;
  frame.dataset.ready = 'true';
  sendPreview();
});

function renderBanner() {
  const banner = document.querySelector('#preview-banner');
  if (!banner) return;
  const { proposal, viewing } = S;
  const html = proposal ? `<div class="banner-copy"><strong>${proposal.view === 'before' ? 'Your menu now' : 'Proposed menu'}</strong>
      <span>${proposal.view === 'before' ? 'As it is before the change' : 'Nothing changes until you apply'}</span></div>
      <div class="segmented" role="group" aria-label="Show menu">${['before', 'after'].map((view) =>
        `<button data-do="proposal-view" data-value="${view}" ${pressed(proposal.view === view)}>${view === 'before' ? 'Before' : 'After'}</button>`).join('')}</div>` :
    viewing ? `<div class="banner-copy"><strong>Viewing an earlier version</strong><span>${e(when(viewing.entry.createdAt))}${viewing.draft ? '' : ' · loading…'}</span></div>
      <div class="actions"><button class="btn" data-do="history-back">Back to current</button>
      <button class="btn primary" data-do="restore-revision" ${viewing.draft ? '' : 'disabled'}>Restore this version</button></div>` : '';
  if (banner.dataset.html === html) return;
  const focused = banner.contains(document.activeElement) && document.activeElement;
  banner.dataset.html = html;
  banner.innerHTML = html;
  if (focused) banner.querySelector(`[data-do="${focused.dataset.do}"]${focused.dataset.value ? `[data-value="${focused.dataset.value}"]` : ''}`)?.focus();
  banner.hidden = !html;
  banner.closest('.preview').classList.toggle('is-other', Boolean(html));
}
