import test from 'node:test';
import assert from 'node:assert/strict';
import { designOf, formatPrice, renderDocument, renderMenu } from '../public/guest/render.js';

const dish = (name, extra = {}) => ({
  id: name, name, description: '', allergens: '', price: 1000, calories: null, portion: '', tags: [],
  photo: null, featured: false, available: true, ...extra
});
const menu = (sections, extra = {}) => ({
  name: 'Test', subtitle: '', currency: 'EUR', template: 'osteria', palette: 'olive', accent: '',
  sections: sections.map((items, index) => ({ id: 's' + index, name: 'Section ' + index, note: '', items })), photos: {}, ...extra
});
const modes = (html) => [...html.matchAll(/sm-section is-(\w+)/g)].map((match) => match[1]);
const heroSrc = (html) => html.match(/<header class="sm-hero[^"]*">\s*<figure class="sm-hero-photo"><img src="([^"]+)"/)?.[1];

test('designOf falls back safely', () => {
  assert.equal(designOf(null).template, 'osteria');
  assert.equal(designOf({ template: 'nope' }).template, 'osteria');
  assert.equal(designOf({ template: 'notte', palette: 'nope' }).palette, 'brass');
  assert.equal(designOf({ template: 'carta', palette: '__proto__' }).palette, 'ivory');
  const classic = designOf({ layout: 'classic', theme: 'wine' });
  assert.deepEqual([classic.template, classic.palette], ['carta', 'ivory']);
  assert.equal(designOf({ layout: 'modern' }).template, 'mercato');
  assert.equal(designOf({ layout: 'editorial', theme: 'ink' }).palette, 'ink');
  assert.equal(designOf({ accent: 'javascript:' }).colors.accent, '#55602f');
  assert.equal(designOf({ accent: '#123456' }).colors.accent, '#123456');
});

test('escapes hostile text', () => {
  const evil = '<script>alert("x")</script>';
  const html = renderDocument(menu([[dish(evil, { description: evil, portion: evil, allergens: evil })]], {
    name: evil, subtitle: evil, sections: [{ id: 's', name: evil, note: evil, items: [dish(evil, { description: evil })] }]
  }), { canonical: 'https://example.com/m/x' });
  assert.equal(html.includes('<script>alert'), false);
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.equal(renderMenu(menu([[dish('a', { tags: ['"><img>'] })]])).includes('<img>'), false);
});

test('chooses section modes from content', () => {
  const photo = { photo: '/images/pasta.jpg' };
  const html = renderMenu(menu([
    [dish('a', photo), dish('b', photo), dish('c')],
    [dish('d'), dish('e')],
    [dish('f', photo), dish('g'), dish('h')],
    [dish('i', photo)]
  ]));
  assert.deepEqual(modes(html), ['rich', 'plain', 'mixed', 'mixed']);
});

test('never uses a cut-out as the hero', () => {
  const html = renderMenu(menu([[
    dish('cut', { photo: 'cut', featured: true }),
    dish('off', { photo: 'off', available: false }),
    dish('table', { photo: 'table' })
  ]], { photos: { cut: { w: 1024, h: 1024, cutout: true } } }));
  assert.equal(heroSrc(html), '/api/photo/table');
  const only = renderMenu(menu([[dish('cut', { photo: 'cut' })]], { photos: { cut: { cutout: true } } }));
  assert.equal(heroSrc(only), undefined);
  assert.equal(heroSrc(renderMenu(menu([[dish('table', { photo: 'table' })]], { template: 'carta' }))), undefined);
});

test('prefers a featured tabletop photo for the hero', () => {
  const html = renderMenu(menu([[dish('plain', { photo: 'plain' }), dish('star', { photo: 'star', featured: true })]]));
  assert.equal(heroSrc(html), '/api/photo/star');
});

test('formats prices', () => {
  assert.equal(formatPrice(4500, 'RON'), '45 lei');
  assert.equal(formatPrice(4550, 'RON'), '45,50 lei');
  assert.equal(formatPrice(1250, 'EUR'), '€12.50');
  assert.equal(formatPrice(1200, 'GBP'), '£12');
  assert.equal(formatPrice(0, 'USD'), '$0');
  assert.equal(formatPrice(null, 'EUR'), '');
});
