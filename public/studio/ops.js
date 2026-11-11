import { TAGS, TAG_LABELS, designOf, formatPrice, templates } from '../guest/render.js';

const currencies = ['RON', 'EUR', 'USD', 'GBP'];
const limits = { name: 120, description: 500, portion: 40, allergens: 200 };
const labels = {
  name: 'Name', description: 'Description', price: 'Price', portion: 'Portion', tags: 'Tags',
  allergens: 'Allergens', calories: 'Calories', featured: 'Featured', available: 'Available',
  note: 'Note', subtitle: 'Introduction', currency: 'Currency', template: 'Template', palette: 'Palette', accent: 'Accent'
};

class Skip extends Error {}
const skip = (message) => { throw new Skip(message); };
const has = (object, key) => Object.hasOwn(object, key) && object[key] !== undefined;
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : skip('Expected text.');
const yesNo = (value) => value ? 'Yes' : 'No';

function show(key, value, draft) {
  if (value === null || value === undefined || value === '') return '';
  if (key === 'price') return formatPrice(value, draft.currency);
  if (key === 'calories') return value + ' kcal';
  if (key === 'tags') return value.map((tag) => TAG_LABELS[tag]).join(', ');
  if (key === 'featured' || key === 'available') return yesNo(value);
  if (key === 'template') return templates[value]?.name ?? value;
  if (key === 'palette') return templates[designOf(draft).template].palettes[value]?.name ?? value;
  return String(value);
}

function dishValue(key, value) {
  if (key in limits) {
    const result = text(value, limits[key]);
    return key === 'name' && !result ? skip('A dish needs a name.') : result;
  }
  if (key === 'price') return value === null ? null : Number.isInteger(value) && value >= 0 && value <= 9999999 ? value : skip('The price is not valid.');
  if (key === 'calories') return value === null ? null : Number.isInteger(value) && value >= 0 && value <= 100000 ? value : skip('The calories are not valid.');
  if (key === 'tags') return Array.isArray(value) ? TAGS.filter((tag) => value.includes(tag)) : skip('The tags are not valid.');
  return value === true;
}

const dishKeys = ['name', 'description', 'price', 'portion', 'tags', 'allergens', 'calories', 'featured', 'available'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function locate(draft, id) {
  for (const section of draft.sections) {
    const index = section.items.findIndex((dish) => dish.id === id);
    if (index >= 0) return { section, index, dish: section.items[index] };
  }
  return skip('That dish is no longer on the menu.');
}

const sectionOf = (draft, id) => draft.sections.find((section) => section.id === id) ?? skip('That section is no longer on the menu.');

function insert(list, item, before) {
  const index = before ? list.findIndex((entry) => entry.id === before) : -1;
  list.splice(index < 0 ? list.length : index, 0, item);
}

function setFields(target, op, keys, convert, draft) {
  const lines = [];
  for (const key of keys) {
    if (!has(op, key)) continue;
    const value = convert(key, op[key]);
    if (same(target[key], value)) continue;
    lines.push({ label: labels[key], before: show(key, target[key], draft), after: show(key, value, draft) });
    target[key] = value;
  }
  return lines.length ? lines : skip('Nothing to change.');
}

const handlers = {
  set_menu(draft, op) {
    const lines = setFields(draft, op, ['name', 'subtitle', 'currency'], (key, value) =>
      key === 'currency' ? (currencies.includes(value) ? value : skip('That currency is not supported.')) :
      key === 'name' ? (text(value, 80) || skip('The menu needs a name.')) : text(value, 180), draft);
    return { kind: 'change', title: 'Menu details', where: '', lines };
  },
  set_design(draft, op) {
    const current = designOf(draft);
    const template = has(op, 'template') ? (Object.hasOwn(templates, op.template) ? op.template : skip('That template does not exist.')) : current.template;
    const { palettes, defaultPalette } = templates[template];
    const palette = has(op, 'palette') ? (Object.hasOwn(palettes, op.palette) ? op.palette : skip('That palette does not exist.')) :
      template === current.template ? current.palette : defaultPalette;
    const accent = has(op, 'accent') ? (op.accent === '' || /^#[0-9a-f]{6}$/i.test(op.accent) ? op.accent : skip('That colour is not valid.')) : draft.accent ?? '';
    const next = { template, palette, accent };
    const before = { template: current.template, palette: current.palette, accent: draft.accent ?? '' };
    const lines = Object.keys(next).filter((key) => next[key] !== before[key]).map((key) => ({
      label: labels[key], before: show(key, before[key], draft), after: show(key, next[key], { ...draft, ...next })
    }));
    if (!lines.length) skip('Nothing to change.');
    Object.assign(draft, next);
    return { kind: 'change', title: 'Design', where: '', lines };
  },
  add_section(draft, op) {
    if (draft.sections.length >= 30) skip('A menu supports up to 30 sections.');
    const section = { id: op.id ?? crypto.randomUUID(), name: text(op.name, 80) || skip('A section needs a name.'), note: has(op, 'note') ? text(op.note, 160) : '', items: [] };
    if (draft.sections.some((entry) => entry.id === section.id)) skip('That section already exists.');
    insert(draft.sections, section, op.before);
    return { kind: 'add', title: section.name, where: 'New section', lines: section.note ? [{ label: labels.note, before: '', after: section.note }] : [] };
  },
  update_section(draft, op) {
    const section = sectionOf(draft, op.id);
    const title = section.name;
    const lines = setFields(section, op, ['name', 'note'], (key, value) =>
      key === 'name' ? (text(value, 80) || skip('A section needs a name.')) : text(value, 160), draft);
    return { kind: 'change', title, where: 'Section', lines };
  },
  move_section(draft, op) {
    const section = sectionOf(draft, op.id);
    const order = draft.sections.map((entry) => entry.id).join();
    draft.sections = draft.sections.filter((entry) => entry !== section);
    insert(draft.sections, section, op.before);
    if (order === draft.sections.map((entry) => entry.id).join()) skip('Nothing to change.');
    const next = draft.sections[draft.sections.indexOf(section) + 1];
    return { kind: 'move', title: section.name, where: 'Section', lines: [{ label: 'Position', before: '', after: next ? 'Before ' + next.name : 'Last' }] };
  },
  remove_section(draft, op) {
    const section = sectionOf(draft, op.id);
    draft.sections = draft.sections.filter((entry) => entry !== section);
    const count = section.items.length;
    return { kind: 'remove', title: section.name, where: 'Section', lines: count ? [{ label: 'Dishes removed', before: String(count), after: '' }] : [] };
  },
  add_dish(draft, op) {
    const section = sectionOf(draft, op.section);
    if (draft.sections.reduce((total, entry) => total + entry.items.length, 0) >= 300) skip('A menu supports up to 300 dishes.');
    const dish = {
      id: op.id ?? crypto.randomUUID(), name: '', description: '', allergens: '', portion: '', tags: [],
      price: null, calories: null, photo: null, originalPhoto: null, featured: false, available: true, review: false
    };
    if (draft.sections.some((entry) => entry.items.some((item) => item.id === dish.id))) skip('That dish already exists.');
    if (!has(op, 'name')) skip('A dish needs a name.');
    const lines = setFields(dish, op, dishKeys, dishValue, draft).filter((line) => line.label !== labels.name);
    insert(section.items, dish, op.before);
    return { kind: 'add', title: dish.name, where: section.name, lines };
  },
  update_dish(draft, op) {
    const { section, dish } = locate(draft, op.id);
    const title = dish.name;
    return { kind: 'change', title, where: section.name, lines: setFields(dish, op, dishKeys, dishValue, draft) };
  },
  move_dish(draft, op) {
    const from = locate(draft, op.id);
    const to = has(op, 'section') ? sectionOf(draft, op.section) : from.section;
    const order = (section) => section.items.map((entry) => entry.id).join();
    const before = order(from.section) + '|' + order(to);
    from.section.items.splice(from.index, 1);
    insert(to.items, from.dish, op.before);
    if (before === order(from.section) + '|' + order(to)) skip('Nothing to change.');
    const next = to.items[to.items.indexOf(from.dish) + 1];
    return {
      kind: 'move', title: from.dish.name, where: from.section.name,
      lines: [{ label: to === from.section ? 'Position' : 'Moved to', before: '', after: (to === from.section ? '' : to.name + ', ') + (next ? 'before ' + next.name : 'last') }]
    };
  },
  remove_dish(draft, op) {
    const { section, index, dish } = locate(draft, op.id);
    section.items.splice(index, 1);
    return { kind: 'remove', title: dish.name, where: section.name, lines: [] };
  }
};

export const OPS = Object.keys(handlers);

export function planOps(draft, ops, { only } = {}) {
  let current = structuredClone(draft);
  const changes = (Array.isArray(ops) ? ops : []).map((op, index) => {
    if (only && !only.has(index)) return { index, ok: false, skipped: true };
    const attempt = structuredClone(current);
    try {
      if (!op || !Object.hasOwn(handlers, op.op)) skip('Unknown change.');
      const change = handlers[op.op](attempt, op);
      current = attempt;
      return { index, ok: true, ...change };
    } catch (error) {
      if (!(error instanceof Skip)) throw error;
      return { index, ok: false, error: error.message };
    }
  });
  return { draft: current, changes };
}
