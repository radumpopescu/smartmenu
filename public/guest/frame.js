import { designOf, renderMenu, templates } from './render.js';
import { enhance } from './guest.js';

const fonts = new Set();

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
  loadFonts(designOf(event.data.menu).template);
  document.body.innerHTML = renderMenu(event.data.menu);
  enhance(document.body.firstElementChild);
  document.scrollingElement.scrollTop = top;
});

parent.postMessage({ type: 'sm-frame-ready' }, location.origin);
