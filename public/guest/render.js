const font = (families) => 'https://fonts.googleapis.com/css2?' + families.map((family) => 'family=' + family).join('&') + '&display=swap';

export const TAGS = ['vegetarian', 'vegan', 'gluten-free', 'spicy', 'new'];
export const TAG_LABELS = {
  vegetarian: 'Vegetarian', vegan: 'Vegan', 'gluten-free': 'Gluten-free', spicy: 'Spicy', new: 'New'
};

const palette = (name, bg, surface, text, accent, line) => ({ name, bg, surface, text, accent, line });

export const templates = {
  osteria: {
    name: 'Osteria',
    blurb: 'Editorial, with a full-bleed opening photo and big spreads for signature dishes.',
    fonts: font(['Instrument+Serif:ital@0;1', 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700']),
    defaultPalette: 'olive',
    palettes: {
      olive: palette('Olive & linen', '#fbf7ed', '#f2ebd9', '#2d2b22', '#55602f', '#e1d9c7'),
      wine: palette('Wine & rose', '#fff6f3', '#f8e8e4', '#38232a', '#862c45', '#ecd8da'),
      coast: palette('Blue & salt', '#f4f8f8', '#e5eeee', '#1f3338', '#24687a', '#d3e1e2'),
      ink: palette('Ink & brass', '#20211e', '#2b2c28', '#fbf5e4', '#e5bd79', '#45443c')
    }
  },
  carta: {
    name: 'Carta',
    blurb: 'A printed carte. Typographic and centred, beautiful with no photos at all.',
    fonts: font(['Cormorant+Garamond:ital,wght@0,500;0,600;1,500', 'EB+Garamond:ital,wght@0,400;0,500;1,400']),
    defaultPalette: 'ivory',
    palettes: {
      ivory: palette('Ivory', '#faf6ec', '#f1ead9', '#2a2620', '#8a5a2b', '#d9cfba'),
      bordeaux: palette('Bordeaux', '#f8f1ea', '#eee2d7', '#33161c', '#7a1f33', '#dcc9bd'),
      forest: palette('Forest', '#1f2d26', '#27382f', '#f1ead8', '#d3b574', '#3d5247'),
      noir: palette('Noir', '#171614', '#211f1c', '#efe9dc', '#c9a86a', '#3a3732')
    }
  },
  mercato: {
    name: 'Mercato',
    blurb: 'Bright and graphic. Photo cards in a grid, made for cafés and brunch.',
    fonts: font(['Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800', 'Figtree:wght@400;500;600;700']),
    defaultPalette: 'citrus',
    palettes: {
      citrus: palette('Citrus', '#fff8ee', '#ffffff', '#231f1a', '#e2452c', '#f0e3d0'),
      mint: palette('Mint', '#f1f8f3', '#ffffff', '#17302a', '#1f8a5f', '#d6e8dd'),
      cobalt: palette('Cobalt', '#f3f5fd', '#ffffff', '#161c3a', '#2f49d1', '#dbe0f5'),
      charcoal: palette('Charcoal', '#1c1c1e', '#29292c', '#f6f3ee', '#ffb938', '#3a3a3e')
    }
  },
  notte: {
    name: 'Notte',
    blurb: 'Dark and quiet. Thin capitals and generous space, for bars and evening menus.',
    fonts: font(['Marcellus', 'Manrope:wght@400;500;700']),
    defaultPalette: 'brass',
    palettes: {
      brass: palette('Brass', '#0f1011', '#191a1c', '#ece6da', '#c8a56a', '#2b2c2f'),
      ember: palette('Ember', '#140e0d', '#1f1615', '#f1e4dc', '#e0774f', '#33221f'),
      jade: palette('Jade', '#0c1413', '#14201e', '#e3ece8', '#7fc8a9', '#23332f'),
      pearl: palette('Pearl', '#f4f1ec', '#ffffff', '#1b1b1d', '#7d6742', '#ddd7cc')
    }
  }
};

const legacyLayouts = { classic: 'carta', modern: 'mercato' };
const isHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

function luminance(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function designOf(menu) {
  const template = Object.hasOwn(templates, menu?.template) ? menu.template : legacyLayouts[menu?.layout] ?? 'osteria';
  const { palettes, defaultPalette } = templates[template];
  const wanted = menu?.palette ?? menu?.theme;
  const key = Object.hasOwn(palettes, wanted) ? wanted : defaultPalette;
  const accent = isHex(menu?.accent) ? menu.accent : palettes[key].accent;
  return {
    template, palette: key,
    colors: {
      ...palettes[key], accent,
      onAccent: luminance(accent) > 0.4 ? '#16150f' : '#ffffff',
      dark: luminance(palettes[key].bg) < 0.2
    }
  };
}

export const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export const photoURL = (id) => !id ? '' : id.startsWith('/images/') ? id : '/api/photo/' + encodeURIComponent(id);

export function formatPrice(value, currency) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const digits = value % 100 === 0 ? 0 : 2;
  if (currency === 'RON') return (value / 100).toFixed(digits).replace('.', ',') + ' lei';
  return new Intl.NumberFormat('en', {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits
  }).format(value / 100);
}

function sectionMode(items) {
  const withPhoto = items.filter((dish) => dish.photo).length;
  if (!withPhoto) return 'plain';
  return items.length >= 2 && withPhoto / items.length >= 0.6 ? 'rich' : 'mixed';
}

function heroOf(menu, dishes) {
  const usable = (dish) => dish.photo && dish.available !== false && !menu.photos?.[dish.photo]?.cutout;
  return dishes.find((dish) => dish.featured && usable(dish)) ?? dishes.find(usable);
}

function photoHTML(menu, dish, { eager = false, className = 'sm-photo' } = {}) {
  const meta = menu.photos?.[dish.photo];
  const size = meta?.w && meta?.h ? ` width="${Number(meta.w)}" height="${Number(meta.h)}"` : '';
  return `<figure class="${className}"><img src="${escape(photoURL(dish.photo))}" alt="${escape(dish.name)}"${size} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>`;
}

function dishHTML(menu, dish, ids) {
  const tags = (dish.tags ?? []).filter((tag) => TAGS.includes(tag));
  const cutout = dish.photo && menu.photos?.[dish.photo]?.cutout;
  const classes = ['sm-dish', dish.featured && 'is-featured', dish.photo && 'has-photo', cutout && 'is-cutout', dish.available === false && 'is-off']
    .filter(Boolean).join(' ');
  const price = formatPrice(dish.price, menu.currency);
  const facts = [
    dish.portion && `<span class="sm-fact">${escape(dish.portion)}</span>`,
    dish.calories !== null && dish.calories !== undefined && !Number.isNaN(dish.calories) && `<span class="sm-fact">${Number(dish.calories)} kcal</span>`,
    dish.allergens && `<span class="sm-fact sm-allergens">Allergens: ${escape(dish.allergens)}</span>`
  ].filter(Boolean).join('');
  return `<article class="${classes}"${tags.length ? ` data-tags="${tags.join(' ')}"` : ''}${ids && dish.id ? ` data-id="${escape(dish.id)}"` : ''}>
    ${dish.photo ? photoHTML(menu, dish) : ''}
    <div class="sm-copy">
      <div class="sm-line"><h3>${escape(dish.name)}</h3><span class="sm-dots" aria-hidden="true"></span>${price ? `<span class="sm-price">${escape(price)}</span>` : ''}</div>
      ${dish.description ? `<p class="sm-desc">${escape(dish.description)}</p>` : ''}
      ${tags.length ? `<p class="sm-tags">${tags.map((tag) => `<span class="sm-tag" data-tag="${tag}">${TAG_LABELS[tag]}</span>`).join('')}</p>` : ''}
      ${facts ? `<p class="sm-facts">${facts}</p>` : ''}
      ${dish.available === false ? '<p class="sm-off">Not available today</p>' : ''}
    </div>
  </article>`;
}

export function renderMenu(menu, { idPrefix = 'm', ids = false } = {}) {
  const { template, palette: paletteKey, colors } = designOf(menu);
  const sections = (menu.sections ?? []).filter((section) => section.items?.length);
  const dishes = sections.flatMap((section) => section.items);
  const hero = template === 'carta' ? null : heroOf(menu, dishes);
  const usedTags = TAGS.filter((tag) => dishes.some((dish) => dish.tags?.includes(tag)));
  const style = `--bg:${colors.bg};--surface:${colors.surface};--text:${colors.text};--accent:${colors.accent};--on-accent:${colors.onAccent};--line:${colors.line}`;
  return `<div class="sm t-${template} p-${paletteKey}${colors.dark ? ' is-dark' : ''}" style="${style}">
  <header class="sm-hero${hero ? ' has-photo' : ''}">
    ${hero ? photoHTML(menu, hero, { eager: true, className: 'sm-hero-photo' }) : ''}
    <div class="sm-hero-copy">
      <p class="sm-kicker">Menu</p>
      <h1>${escape(menu.name)}</h1>
      ${menu.subtitle ? `<p class="sm-sub">${escape(menu.subtitle)}</p>` : ''}
    </div>
  </header>
  ${sections.length > 1 ? `<nav class="sm-nav" aria-label="Menu sections"><div class="sm-nav-track">${sections.map((section, index) =>
    `<a href="#${idPrefix}-${index}">${escape(section.name)}</a>`).join('')}</div></nav>` : ''}
  ${usedTags.length ? `<div class="sm-filters" role="group" aria-label="Show only" hidden>${usedTags.map((tag) =>
    `<button type="button" class="sm-filter" data-tag="${tag}" aria-pressed="false">${TAG_LABELS[tag]}</button>`).join('')}</div>` : ''}
  <main class="sm-body">
    ${sections.length ? sections.map((section, index) => `<section class="sm-section is-${sectionMode(section.items)}" id="${idPrefix}-${index}"${ids && section.id ? ` data-id="${escape(section.id)}"` : ''}>
      <header class="sm-section-head"><h2>${escape(section.name)}</h2>${section.note ? `<p class="sm-note">${escape(section.note)}</p>` : ''}</header>
      <div class="sm-items">${section.items.map((dish) => dishHTML(menu, dish, ids)).join('')}</div>
    </section>`).join('') : '<p class="sm-empty">Your dishes will appear here.</p>'}
  </main>
  <footer class="sm-footer">
    <p class="sm-footer-name">${escape(menu.name)}</p>
    <p class="sm-footer-note">Please tell your server about any allergies.</p>
  </footer>
</div>`;
}

export function renderDocument(menu, { css = '', canonical = '', scriptSrc = '/guest/guest.js', lang = 'en' } = {}) {
  const { template, colors } = designOf(menu);
  const dishes = (menu.sections ?? []).flatMap((section) => section.items ?? []);
  const hero = heroOf(menu, dishes);
  const description = menu.subtitle || `The menu at ${menu.name}.`;
  const image = hero && canonical ? new URL(photoURL(hero.photo), canonical).href : '';
  return `<!doctype html>
<html lang="${escape(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${colors.bg}">
<meta name="color-scheme" content="${colors.dark ? 'dark' : 'light'}">
<title>${escape(menu.name)} · Menu</title>
<meta name="description" content="${escape(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escape(menu.name)} · Menu">
<meta property="og:description" content="${escape(description)}">
${image ? `<meta property="og:image" content="${escape(image)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
${canonical ? `<link rel="canonical" href="${escape(canonical)}">\n<meta property="og:url" content="${escape(canonical)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${escape(templates[template].fonts)}">
<style>${css}</style>
</head>
<body>
${renderMenu(menu)}
${scriptSrc ? `<script type="module" src="${escape(scriptSrc)}"></script>` : ''}
</body>
</html>`;
}
