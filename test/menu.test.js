import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestError, cleanDraft, makeDraft, photoMap, publishedMenu, storedPublished } from '../src/menu.js';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dish = (n, extra = {}) => ({
  id: id(n), name: 'Dish ' + n, description: '', allergens: '', price: 1250, calories: null,
  photo: null, featured: false, available: true, ...extra
});
const draft = (extra = {}) => ({
  name: 'Osteria', subtitle: '', currency: 'RON', template: 'carta', palette: 'bordeaux', accent: '',
  sections: [{ id: id(1), name: 'Mains', note: 'Until 22:00', items: [dish(2, { portion: '350 g', tags: ['spicy'] })] }],
  ...extra
});
const rejects = (value, message) => assert.throws(() => cleanDraft(value),
  (error) => error instanceof RequestError && error.status === 400 && (!message || message.test(error.message)));

test('keeps a valid v2 draft', () => {
  const clean = cleanDraft(draft());
  assert.equal(clean.template, 'carta');
  assert.equal(clean.palette, 'bordeaux');
  assert.equal(clean.sections[0].note, 'Until 22:00');
  assert.deepEqual(clean.sections[0].items[0], {
    ...dish(2), portion: '350 g', tags: ['spicy'], originalPhoto: null, review: false
  });
  assert.deepEqual(cleanDraft(clean), clean);
});

test('makeDraft produces a valid v2 draft', () => {
  const made = makeDraft('Bistro');
  assert.deepEqual(cleanDraft(made), made);
  assert.equal(made.template, 'osteria');
  assert.equal(made.palette, 'olive');
  assert.equal('theme' in made || 'layout' in made || 'font' in made, false);
});

test('upgrades legacy drafts', () => {
  const legacy = (layout, theme) => {
    const { template, palette, ...rest } = draft();
    return { ...rest, theme, layout, font: 'sans', sections: [{ id: id(1), name: 'Mains', items: [dish(2)] }] };
  };
  const classic = cleanDraft(legacy('classic', 'olive'));
  assert.deepEqual([classic.template, classic.palette], ['carta', 'ivory']);
  const modern = cleanDraft(legacy('modern', 'ink'));
  assert.deepEqual([modern.template, modern.palette], ['mercato', 'citrus']);
  const editorial = cleanDraft(legacy('editorial', 'wine'));
  assert.deepEqual([editorial.template, editorial.palette], ['osteria', 'wine']);
  assert.equal('theme' in editorial || 'layout' in editorial || 'font' in editorial, false);
  assert.equal(editorial.sections[0].note, '');
  assert.equal(editorial.sections[0].items[0].portion, '');
  assert.deepEqual(editorial.sections[0].items[0].tags, []);
});

test('falls back to the template default palette', () => {
  assert.equal(cleanDraft(draft({ palette: 'olive' })).palette, 'ivory');
  assert.equal(cleanDraft(draft({ palette: undefined })).palette, 'ivory');
  assert.equal(cleanDraft(draft({ palette: 'toString' })).palette, 'ivory');
});

test('discards client photos', () => {
  const clean = cleanDraft(draft({ photos: { [id(9)]: { w: 1, h: 1, cutout: true } } }));
  assert.equal('photos' in clean, false);
});

test('validates and normalizes tags', () => {
  const tagged = (tags) => cleanDraft(draft({ sections: [{ id: id(1), name: 'A', items: [dish(2, { tags })] }] })).sections[0].items[0].tags;
  assert.deepEqual(tagged(['spicy', 'vegan', 'spicy']), ['vegan', 'spicy']);
  assert.deepEqual(tagged(undefined), []);
  rejects(draft({ sections: [{ id: id(1), name: 'A', items: [dish(2, { tags: ['halal'] })] }] }), /tags/);
  rejects(draft({ sections: [{ id: id(1), name: 'A', items: [dish(2, { tags: 'vegan' })] }] }), /tags/);
});

test('enforces limits', () => {
  const withItem = (extra) => draft({ sections: [{ id: id(1), name: 'A', items: [dish(2, extra)] }] });
  assert.equal(cleanDraft(withItem({ portion: 'x'.repeat(40) })).sections[0].items[0].portion.length, 40);
  rejects(withItem({ portion: 'x'.repeat(41) }), /portion/);
  assert.equal(cleanDraft(draft({ sections: [{ id: id(1), name: 'A', note: 'x'.repeat(160), items: [] }] })).sections[0].note.length, 160);
  rejects(draft({ sections: [{ id: id(1), name: 'A', note: 'x'.repeat(161), items: [] }] }), /note/);
  rejects(draft({ name: 'x'.repeat(81) }));
  rejects(draft({ sections: Array.from({ length: 31 }, (_, n) => ({ id: id(n + 1), name: 'S', items: [] })) }));
  rejects(draft({ sections: [{ id: id(1), name: 'A', items: Array.from({ length: 301 }, (_, n) => dish(n + 2)) }] }), /300/);
});

test('rejects bad input', () => {
  rejects(null);
  rejects({});
  rejects(draft({ template: 'bistro' }), /settings/);
  rejects(draft({ currency: 'BTC' }), /settings/);
  rejects(draft({ accent: 'red' }), /settings/);
  rejects(draft({ sections: [{ id: 'nope', name: 'A', items: [] }] }), /ID/);
  rejects(draft({ sections: [{ id: id(1), name: 'A', items: [dish(1)] }] }), /ID/);
  rejects(draft({ sections: [{ id: id(1), name: 'A', items: [dish(2, { price: 12.5 })] }] }), /price/);
  rejects(draft({ sections: [{ id: id(1), name: 'A', items: [dish(2, { photo: '/images/pasta.jpg' })] }] }), /photo/);
  rejects(draft({ sections: [{ id: id(1), name: ' ', items: [] }] }), /section name/);
});

test('publishedMenu drops drafts-only fields and freezes photo metadata', () => {
  const clean = cleanDraft(draft({
    sections: [
      { id: id(1), name: 'Empty', items: [] },
      { id: id(2), name: 'Mains', items: [dish(3, { photo: id(10), originalPhoto: id(11), review: true })] }
    ]
  }));
  const photos = photoMap([
    { id: id(10), width: 1024, height: 1024, cutout: 1 },
    { id: id(11), width: null, height: null, cutout: 0 }
  ]);
  const published = publishedMenu(clean, photos);
  assert.deepEqual(published.sections.map((section) => section.name), ['Mains']);
  assert.equal('originalPhoto' in published.sections[0].items[0], false);
  assert.equal('review' in published.sections[0].items[0], false);
  assert.deepEqual(published.photos, { [id(10)]: { w: 1024, h: 1024, cutout: true } });
  assert.deepEqual(photos[id(11)], { cutout: false });
});

test('storedPublished upgrades a legacy snapshot', () => {
  const legacy = { name: 'Old', subtitle: '', currency: 'EUR', theme: 'coast', layout: 'editorial', font: 'serif', accent: '',
    sections: [{ id: id(1), name: 'Mains', items: [{ ...dish(2) }] }] };
  const menu = storedPublished(JSON.stringify(legacy));
  assert.deepEqual([menu.template, menu.palette], ['osteria', 'coast']);
  assert.deepEqual(menu.photos, {});
  assert.deepEqual(menu.sections[0].items[0].tags, []);
});
