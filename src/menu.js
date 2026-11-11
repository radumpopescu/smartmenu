import { TAGS, designOf, templates } from '../public/guest/render.js';

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const currencies = ['RON', 'EUR', 'USD', 'GBP'];
export const uid = () => crypto.randomUUID();
export const isId = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
export const makeDraft = (name) => ({
  name, subtitle: '', currency: 'RON', template: 'osteria',
  palette: templates.osteria.defaultPalette, accent: '', sections: []
});

function string(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new RequestError(400, `Check ${label}.`);
  }
  return value.trim();
}

function tagsOf(value = []) {
  if (!Array.isArray(value) || value.length > 20 || value.some((tag) => !TAGS.includes(tag))) {
    throw new RequestError(400, 'Check the dish tags.');
  }
  return TAGS.filter((tag) => value.includes(tag));
}

export function cleanDraft(value) {
  const accent = value?.accent ?? '';
  if (!value || !Array.isArray(value.sections) || value.sections.length > 30 ||
      (value.template !== undefined && !Object.hasOwn(templates, value.template)) ||
      !currencies.includes(value.currency) || !(accent === '' || /^#[0-9a-f]{6}$/i.test(accent))) {
    throw new RequestError(400, 'Check menu settings.');
  }
  const { template, palette } = designOf(value);
  const ids = new Set();
  const checkId = (id) => {
    if (!isId(id) || ids.has(id)) throw new RequestError(400, 'Invalid section or dish ID.');
    ids.add(id);
    return id;
  };
  let dishes = 0;
  const sections = value.sections.map((section) => {
    if (!section || !Array.isArray(section.items) || (dishes += section.items.length) > 300) {
      throw new RequestError(400, 'A menu supports up to 300 dishes.');
    }
    return {
      id: checkId(section.id),
      name: string(section.name, 80, 'the section name', true),
      note: string(section.note ?? '', 160, 'the section note'),
      items: section.items.map((item) => {
        if (!item || (item.price !== null && (!Number.isInteger(item.price) || item.price < 0 || item.price > 9999999)) ||
            (item.calories !== null && (!Number.isInteger(item.calories) || item.calories < 0 || item.calories > 100000)) ||
            (item.photo !== null && !isId(item.photo)) ||
            (item.originalPhoto != null && !isId(item.originalPhoto))) throw new RequestError(400, 'Check the dish price, calories or photo.');
        return {
          id: checkId(item.id), name: string(item.name, 120, 'the dish name', true),
          description: string(item.description, 500, 'the description'),
          allergens: string(item.allergens, 200, 'the allergen text'),
          portion: string(item.portion ?? '', 40, 'the portion'), tags: tagsOf(item.tags),
          price: item.price, calories: item.calories, photo: item.photo,
          originalPhoto: item.originalPhoto ?? null,
          featured: item.featured === true, available: item.available !== false,
          review: item.review === true
        };
      })
    };
  });
  return {
    name: string(value.name, 80, 'the restaurant name', true),
    subtitle: string(value.subtitle, 180, 'the introduction'),
    currency: value.currency, template, palette, accent, sections
  };
}

export const photosIn = (menu) => [...new Set(menu.sections.flatMap((section) =>
  section.items.map((dish) => dish.photo).filter(Boolean)))];

export const draftPhotosIn = (menu) => [...new Set([
  ...photosIn(menu),
  ...menu.sections.flatMap((section) => section.items.map((dish) => dish.originalPhoto).filter(Boolean))
])];

export const photoMap = (rows) => Object.fromEntries(rows.map((row) => [row.id, {
  ...(row.width && row.height ? { w: row.width, h: row.height } : {}), cutout: row.cutout === 1
}]));

export function publishedMenu(draft, photos = {}) {
  const menu = {
    ...draft,
    sections: draft.sections.filter((section) => section.items.length).map((section) => ({
      ...section,
      items: section.items.map(({ originalPhoto, review, ...dish }) => dish)
    }))
  };
  menu.photos = Object.fromEntries(photosIn(menu).filter((id) => Object.hasOwn(photos, id)).map((id) => [id, photos[id]]));
  return menu;
}

export const storedPublished = (json) => {
  const stored = JSON.parse(json);
  return publishedMenu(cleanDraft(stored), stored.photos);
};
