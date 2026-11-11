export const palettes = {
  olive: { name: 'Olive & linen', bg: '#fbf7ed', text: '#302d24', accent: '#555838', line: '#e1d9c7' },
  wine: { name: 'Wine & rose', bg: '#fff5f4', text: '#39252b', accent: '#862c45', line: '#ecd8da' },
  coast: { name: 'Blue & salt', bg: '#f4f8f8', text: '#203439', accent: '#296878', line: '#d3e1e2' },
  ink: { name: 'Ink & brass', bg: '#232421', text: '#fff9e8', accent: '#e5bd79', line: '#48473e' }
};
export const layouts = { editorial: 'Editorial', classic: 'Classic', modern: 'Modern' };
export const fonts = { serif: 'Serif', sans: 'Sans serif' };
export const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const photoURL = (id) => id?.startsWith('/images/') ? id : id ? '/api/photo/' + encodeURIComponent(id) : '';
export const price = (value, currency) => value === null ? '' : new Intl.NumberFormat('en', {
  style: 'currency', currency, minimumFractionDigits: value % 100 === 0 ? 0 : 2
}).format(value / 100);

export function menuHTML(menu, prefix = 'guest') {
  const palette = palettes[menu.theme] ?? palettes.olive;
  const accent = /^#[0-9a-f]{6}$/i.test(menu.accent) ? menu.accent : palette.accent;
  const sections = menu.sections.filter((section) => section.items.length);
  const all = sections.flatMap((section) => section.items);
  const hero = all.find((dish) => dish.featured && dish.photo && dish.available) ?? all.find((dish) => dish.photo && dish.available);
  const image = (dish, className, lazy = true) => dish.photo ? `<img class="${className}" src="${escape(photoURL(dish.photo))}" alt="${escape(dish.name)}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'}>` : '';
  const sectionLinks = sections.map((section, index) => `<a href="#${prefix}-${index}">${escape(section.name)}</a>`).join('');
  return `<div class="guest-menu layout-${layouts[menu.layout] ? menu.layout : 'editorial'} font-${fonts[menu.font] ? menu.font : 'serif'}" style="--menu-bg:${palette.bg};--menu-text:${palette.text};--menu-accent:${accent};--menu-line:${palette.line}">
    <header class="menu-hero ${hero && menu.layout !== 'classic' ? 'with-image' : ''}">
      ${hero && menu.layout !== 'classic' ? image(hero, 'hero-photo', false) : ''}
      <div class="hero-type"><span>THE MENU</span><h1>${escape(menu.name)}</h1>${menu.subtitle ? `<p>${escape(menu.subtitle)}</p>` : ''}</div>
    </header>
    ${sectionLinks ? `<nav class="section-nav" aria-label="Menu sections">${sectionLinks}</nav>` : ''}
    <div class="menu-content">
    ${sections.length ? sections.map((section, index) => `<section class="guest-section" id="${prefix}-${index}">
      <h2>${escape(section.name)}</h2>
      <div class="dish-list">${section.items.map((dish) => `<article class="guest-dish ${dish.featured && dish.photo ? 'featured' : ''}">
        ${image(dish, 'dish-photo')}
        <div class="dish-copy">
          <div class="dish-title"><h3>${escape(dish.name)}</h3><span>${escape(price(dish.price, menu.currency))}</span></div>
          ${dish.description ? `<p>${escape(dish.description)}</p>` : ''}
          ${dish.calories !== null || dish.allergens || !dish.available ? `<div class="dish-meta">${dish.calories !== null ? `<span>${dish.calories} kcal</span>` : ''}${dish.allergens ? `<span>Allergens · ${escape(dish.allergens)}</span>` : ''}${!dish.available ? '<strong>Unavailable</strong>' : ''}</div>` : ''}
        </div></article>`).join('')}</div>
    </section>`).join('') : '<p class="empty-menu">Your dishes will appear here.</p>'}
    </div><footer class="menu-footer">${escape(menu.name)}</footer>
  </div>`;
}

export const sample = {
  name: 'Osteria Verde', subtitle: 'Seasonal Italian cooking. Made to be shared.',
  theme: 'olive', layout: 'editorial', font: 'serif', accent: '', currency: 'EUR',
  sections: [
    { name: 'From the kitchen', items: [
      { name: 'Woodland mushroom tagliatelle', description: 'Ribbon pasta with sautéed mushrooms, herbs and Parmigiano.', price: 1800, photo: '/images/pasta.jpg', featured: true },
      { name: 'Pesto alla Genovese', description: 'Basil, toasted pine nuts and aged Parmesan.', price: 1600, photo: '/images/pesto.jpg' },
      { name: 'Lemon and thyme risotto', description: 'Carnaroli rice, lemon zest and fresh thyme.', price: 1900, photo: null }
    ]},
    { name: 'To start', items: [
      { name: 'Market greens', description: 'Seasonal leaves and a bright lemon dressing.', price: 950, photo: '/images/salad.jpg' },
      { name: 'Rosemary focaccia', description: 'Warm from the oven, with extra virgin olive oil.', price: 650, photo: null }
    ]}
  ]
};
for (const section of sample.sections) for (const item of section.items) Object.assign(item, { available: true, calories: null, allergens: '' });
