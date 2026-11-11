import { designOf, renderMenu, templates } from './render.js';
import { enhance } from './guest.js';

const fonts = new Set();
let shown = '';

function loadFonts(template) {
  if (fonts.has(template)) return;
  fonts.add(template);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = templates[template].fonts;
  document.head.append(link);
}

addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'sm-preview' || !event.data.menu) return;
  const top = document.scrollingElement.scrollTop;
  const highlight = new Set(event.data.highlight ?? []);
  loadFonts(designOf(event.data.menu).template);
  document.body.innerHTML = renderMenu(event.data.menu, { ids: true });
  enhance(document.body.firstElementChild);
  document.scrollingElement.scrollTop = top;
  const changed = [...document.querySelectorAll('[data-id]')].filter((element) => highlight.has(element.dataset.id));
  for (const element of changed) element.classList.add('sm-changed');
  const key = [...highlight].join();
  if (changed.length && key !== shown) changed[0].scrollIntoView({ block: 'center', behavior: 'instant' });
  shown = key;
});

parent.postMessage({ type: 'sm-frame-ready' }, location.origin);
