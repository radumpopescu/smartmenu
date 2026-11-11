import test from 'node:test';
import assert from 'node:assert/strict';
import { OPS, planOps } from '../public/studio/ops.js';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dish = (n, extra = {}) => ({
  id: id(n), name: 'Dish ' + n, description: '', allergens: '', portion: '', tags: [], price: 1000, calories: null,
  photo: null, originalPhoto: null, featured: false, available: true, review: false, ...extra
});
const draft = () => ({
  name: 'Osteria', subtitle: '', currency: 'RON', template: 'osteria', palette: 'olive', accent: '',
  sections: [
    { id: id(1), name: 'Mains', note: '', items: [dish(10), dish(11)] },
    { id: id(2), name: 'Desserts', note: '', items: [dish(20, { name: 'Tiramisu', price: 2500 })] }
  ]
});
const one = (op) => planOps(draft(), [op]);
const names = (menu) => menu.sections.map((section) => section.name + ':' + section.items.map((item) => item.name).join(','));

test('every operation applies', () => {
  assert.deepEqual(OPS.sort(), ['add_dish', 'add_section', 'move_dish', 'move_section', 'remove_dish', 'remove_section',
    'set_design', 'set_menu', 'update_dish', 'update_section'].sort());
  assert.equal(one({ op: 'set_menu', name: 'Bistro', currency: 'EUR' }).draft.currency, 'EUR');
  const design = one({ op: 'set_design', template: 'notte' });
  assert.deepEqual([design.draft.template, design.draft.palette], ['notte', 'brass']);
  const section = one({ op: 'add_section', id: id(3), name: 'Drinks', before: id(2) });
  assert.deepEqual(names(section.draft), ['Mains:Dish 10,Dish 11', 'Drinks:', 'Desserts:Tiramisu']);
  assert.equal(one({ op: 'update_section', id: id(1), note: 'Until 22:00' }).draft.sections[0].note, 'Until 22:00');
  assert.deepEqual(names(one({ op: 'move_section', id: id(2), before: id(1) }).draft), ['Desserts:Tiramisu', 'Mains:Dish 10,Dish 11']);
  assert.deepEqual(names(one({ op: 'remove_section', id: id(2) }).draft), ['Mains:Dish 10,Dish 11']);
  const added = one({ op: 'add_dish', id: id(12), section: id(1), before: id(11), name: 'Risotto', price: 4200 });
  assert.deepEqual(names(added.draft)[0], 'Mains:Dish 10,Risotto,Dish 11');
  assert.equal(added.changes[0].kind, 'add');
  const updated = one({ op: 'update_dish', id: id(20), price: 2750, featured: true });
  assert.deepEqual(updated.changes[0].lines.map((line) => line.label), ['Price', 'Featured']);
  assert.deepEqual(names(one({ op: 'move_dish', id: id(10), section: id(2), before: null }).draft), ['Mains:Dish 11', 'Desserts:Tiramisu,Dish 10']);
  assert.deepEqual(names(one({ op: 'remove_dish', id: id(11) }).draft)[0], 'Mains:Dish 10');
});

test('bad operations are skipped and reported, not thrown', () => {
  const before = draft();
  const { draft: after, changes } = planOps(before, [
    { op: 'update_dish', id: id(99), price: 100 },
    { op: 'update_dish', id: id(10), price: -5 },
    { op: 'explode' },
    null,
    { op: 'set_design', template: 'nope' },
    { op: 'update_dish', id: id(10), price: 1000 },
    { op: 'update_dish', id: id(10), photo: id(50), review: true, name: 'Ok' }
  ]);
  assert.deepEqual(changes.slice(0, 6).map((change) => change.ok), [false, false, false, false, false, false]);
  assert.equal(changes[5].error, 'Nothing to change.');
  assert.equal(changes[6].ok, true);
  assert.equal(after.sections[0].items[0].photo, null);
  assert.equal(after.sections[0].items[0].review, false);
  assert.deepEqual(before, draft());
});

test('only applies the chosen indexes, and dependent operations follow their parent', () => {
  const ops = [
    { op: 'add_section', id: id(3), name: 'Drinks' },
    { op: 'add_dish', id: id(30), section: id(3), name: 'Spritz', price: 3000 },
    { op: 'update_dish', id: id(20), price: 2600 }
  ];
  const skipped = planOps(draft(), ops, { only: new Set([1, 2]) });
  assert.deepEqual(skipped.changes.map((change) => change.ok), [false, false, true]);
  assert.equal(skipped.changes[0].skipped, true);
  assert.match(skipped.changes[1].error, /section/);
  const all = planOps(draft(), ops);
  assert.deepEqual(all.changes.map((change) => change.ok), [true, true, true]);
  assert.deepEqual(names(all.draft)[2], 'Drinks:Spritz');
});
