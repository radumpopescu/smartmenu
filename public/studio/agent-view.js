import { TAGS, templates } from '../guest/render.js';
import { planOps } from './ops.js';

const record = (properties) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false
});
const nullable = (type) => ({ type: [type, 'null'] });
const choice = (values) => ({ type: ['string', 'null'], enum: [...values, null] });
const handle = nullable('string');
const op = (name, fields) => record({ op: { type: 'string', enum: [name] }, ...fields });
const dishFields = {
  name: nullable('string'), description: nullable('string'), price: nullable('number'),
  portion: nullable('string'), allergens: nullable('string'), calories: nullable('integer'),
  tags: { type: ['array', 'null'], items: { type: 'string', enum: TAGS } },
  featured: nullable('boolean'), available: nullable('boolean')
};
const palettes = [...new Set(Object.values(templates).flatMap((template) => Object.keys(template.palettes)))];

export const changesSchema = record({
  reply: { type: 'string' },
  ops: {
    type: 'array',
    items: {
      anyOf: [
        op('set_menu', { name: nullable('string'), subtitle: nullable('string'), currency: choice(['RON', 'EUR', 'USD', 'GBP']) }),
        op('set_design', { template: choice(Object.keys(templates)), palette: choice(palettes), accent: nullable('string') }),
        op('add_section', { ref: { type: 'string' }, name: { type: 'string' }, note: handle, before: handle }),
        op('update_section', { id: { type: 'string' }, name: nullable('string'), note: nullable('string') }),
        op('move_section', { id: { type: 'string' }, before: handle }),
        op('remove_section', { id: { type: 'string' } }),
        op('add_dish', { ref: { type: 'string' }, section: { type: 'string' }, before: handle, ...dishFields }),
        op('update_dish', { id: { type: 'string' }, ...dishFields, clear: { type: 'array', items: { type: 'string', enum: ['price', 'calories'] } } }),
        op('move_dish', { id: { type: 'string' }, section: handle, before: handle }),
        op('remove_dish', { id: { type: 'string' } }),
        op('change_prices', { ids: { type: 'array', items: { type: 'string' } }, percent: nullable('number'), amount: nullable('number'), round_to: nullable('number') })
      ]
    }
  }
});

const money = (minor) => Number.isInteger(minor) ? minor / 100 : undefined;
const prune = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) =>
  value !== undefined && value !== '' && value !== null && value !== false && !(Array.isArray(value) && !value.length)));

export function menuView(draft) {
  const handles = new Map();
  let dishes = 0;
  const sections = draft.sections.map((section, index) => {
    handles.set('s' + (index + 1), { kind: 'section', id: section.id });
    return prune({
      h: 's' + (index + 1), name: section.name, note: section.note,
      dishes: section.items.map((dish) => {
        const h = 'd' + ++dishes;
        handles.set(h, { kind: 'dish', id: dish.id, price: dish.price, section: section.id });
        return { ...prune({
          h, name: dish.name, description: dish.description, price: money(dish.price), portion: dish.portion,
          tags: dish.tags, allergens: dish.allergens, calories: dish.calories, featured: dish.featured
        }), ...(dish.available === false ? { available: false } : {}) };
      })
    });
  });
  const view = prune({
    name: draft.name, subtitle: draft.subtitle, currency: draft.currency,
    template: draft.template, palette: draft.palette, accent: draft.accent, sections
  });
  return { text: JSON.stringify(view), handles };
}

export const toMinor = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : undefined;

function roundTo(minor, step) {
  const unit = typeof step === 'number' && step > 0 ? Math.round(step * 100) : 1;
  return Math.round(minor / unit) * unit;
}

export function toOps(output, handles) {
  const refs = new Map();
  const resolve = (value, kind) => {
    if (value === null || value === undefined) return null;
    const target = refs.get(value) ?? handles.get(value);
    return target?.kind === kind ? target.id : undefined;
  };
  const fields = (raw, keys) => {
    const result = {};
    for (const key of keys) {
      if (raw[key] === null || raw[key] === undefined) continue;
      result[key] = key === 'price' ? toMinor(raw[key]) : raw[key];
      if (result[key] === undefined) return null;
    }
    return result;
  };
  const dishKeys = Object.keys(dishFields);
  const ops = [];
  for (const raw of Array.isArray(output?.ops) ? output.ops : []) {
    if (!raw || typeof raw !== 'object') continue;
    const kind = raw.op;
    if (kind === 'change_prices') {
      const ids = new Set();
      for (const value of Array.isArray(raw.ids) ? raw.ids : []) {
        const target = handles.get(value);
        if (target?.kind === 'dish') ids.add(value);
        if (target?.kind === 'section') for (const [key, entry] of handles) if (entry.kind === 'dish' && entry.section === target.id) ids.add(key);
      }
      const percent = typeof raw.percent === 'number' ? raw.percent : null;
      const amount = toMinor(raw.amount) ?? null;
      if (percent === null && amount === null) continue;
      for (const key of ids) {
        const dish = handles.get(key);
        if (dish.price === null || dish.price === undefined) continue;
        const next = roundTo(percent !== null ? dish.price * (1 + percent / 100) : dish.price + amount, raw.round_to);
        ops.push({ op: 'update_dish', id: dish.id, price: Math.max(0, next) });
      }
      continue;
    }
    let result = null;
    if (kind === 'set_menu') result = fields(raw, ['name', 'subtitle', 'currency']);
    if (kind === 'set_design') result = fields(raw, ['template', 'palette', 'accent']);
    if (kind === 'add_section' || kind === 'add_dish') {
      const id = crypto.randomUUID();
      const parent = kind === 'add_dish' ? resolve(raw.section, 'section') : null;
      const before = resolve(raw.before, kind === 'add_dish' ? 'dish' : 'section');
      result = fields(raw, kind === 'add_dish' ? dishKeys : ['name', 'note']);
      if (result && parent !== undefined && before !== undefined) {
        result = { id, ...(kind === 'add_dish' ? { section: parent } : {}), ...(before ? { before } : {}), ...result };
        if (typeof raw.ref === 'string' && !handles.has(raw.ref) && !refs.has(raw.ref)) {
          refs.set(raw.ref, { kind: kind === 'add_dish' ? 'dish' : 'section', id });
        }
      } else result = null;
    }
    if (['update_section', 'move_section', 'remove_section'].includes(kind)) {
      const id = resolve(raw.id, 'section');
      const before = resolve(raw.before, 'section');
      result = id && before !== undefined ? { id, ...(kind === 'move_section' ? { before } : {}),
        ...(kind === 'update_section' ? fields(raw, ['name', 'note']) : {}) } : null;
    }
    if (['update_dish', 'move_dish', 'remove_dish'].includes(kind)) {
      const id = resolve(raw.id, 'dish');
      const section = resolve(raw.section, 'section');
      const before = resolve(raw.before, 'dish');
      if (!id || section === undefined || before === undefined) continue;
      if (kind === 'move_dish') result = { id, ...(section ? { section } : {}), before };
      if (kind === 'remove_dish') result = { id };
      if (kind === 'update_dish') {
        const changed = fields(raw, dishKeys);
        const clear = Array.isArray(raw.clear) ? raw.clear.filter((key) => key === 'price' || key === 'calories') : [];
        result = changed && { id, ...changed, ...Object.fromEntries(clear.map((key) => [key, null])) };
      }
    }
    if (result) ops.push({ op: kind, ...result });
  }
  return ops;
}

export function validOps(draft, ops) {
  const { changes } = planOps(draft, ops);
  return ops.filter((_, index) => changes[index].ok);
}
