import { escape, templates } from './render.js';
import { samples } from './samples.js';

const only = new URLSearchParams(location.search).get('only');
const palette = new URLSearchParams(location.search).get('palette');
const slugs = Object.keys(templates).map((id) => 'demo-' + id).filter((slug) => !only || slug === only);
document.body.classList.toggle('solo', Boolean(only));

document.querySelector('#gallery').innerHTML = slugs.map((slug) => {
  const template = templates[samples[slug].template];
  return `<section class="gallery-item"><h2>${escape(template.name)}</h2><p>${escape(template.blurb)}</p>
    <iframe src="/guest/frame.html" data-slug="${slug}" title="${escape(template.name)} template preview"></iframe>
    <a href="/m/${slug}">Open full size ↗</a></section>`;
}).join('');

addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'sm-frame-ready') return;
  const frame = [...document.querySelectorAll('iframe')].find((entry) => entry.contentWindow === event.source);
  if (!frame) return;
  const menu = samples[frame.dataset.slug];
  event.source.postMessage({ type: 'sm-preview', menu: palette ? { ...menu, palette } : menu }, location.origin);
});
