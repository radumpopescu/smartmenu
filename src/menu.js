export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const themes = ['olive', 'wine', 'coast', 'ink'];
const layouts = ['editorial', 'classic', 'modern'];
const fonts = ['serif', 'sans'];
const currencies = ['RON', 'EUR', 'USD', 'GBP'];
export const uid = () => crypto.randomUUID();
export const isId = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
export const makeDraft = (name) => ({
  name, subtitle: '', currency: 'RON', theme: 'olive', layout: 'editorial',
  font: 'serif', accent: '', sections: []
});

function string(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new RequestError(400, `Check ${label}.`);
  }
  return value.trim();
}

export function cleanDraft(value) {
  if (!value || !Array.isArray(value.sections) || value.sections.length > 30 ||
      !themes.includes(value.theme) || !layouts.includes(value.layout) ||
      !fonts.includes(value.font) || !currencies.includes(value.currency) ||
      !(value.accent === '' || /^#[0-9a-f]{6}$/i.test(value.accent))) {
    throw new RequestError(400, 'Check menu settings.');
  }
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
      items: section.items.map((item) => {
        if (!item || (item.price !== null && (!Number.isInteger(item.price) || item.price < 0 || item.price > 9999999)) ||
            (item.calories !== null && (!Number.isInteger(item.calories) || item.calories < 0 || item.calories > 100000)) ||
            (item.photo !== null && !isId(item.photo)) ||
            (item.originalPhoto != null && !isId(item.originalPhoto))) throw new RequestError(400, 'Check the dish price, calories or photo.');
        return {
          id: checkId(item.id), name: string(item.name, 120, 'the dish name', true),
          description: string(item.description, 500, 'the description'),
          allergens: string(item.allergens, 200, 'the allergen text'),
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
    currency: value.currency, theme: value.theme, layout: value.layout,
    font: value.font, accent: value.accent, sections
  };
}

export const photosIn = (menu) => [...new Set(menu.sections.flatMap((section) =>
  section.items.map((dish) => dish.photo).filter(Boolean)))];

export const draftPhotosIn = (menu) => [...new Set([
  ...photosIn(menu),
  ...menu.sections.flatMap((section) => section.items.map((dish) => dish.originalPhoto).filter(Boolean))
])];

export function publishedMenu(draft) {
  return {
    ...draft,
    sections: draft.sections.filter((section) => section.items.length).map((section) => ({
      ...section,
      items: section.items.map(({ originalPhoto, review, ...dish }) => dish)
    }))
  };
}
