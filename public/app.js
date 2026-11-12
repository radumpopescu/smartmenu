import { TAGS, TAG_LABELS, designOf, escape as e, photoURL, templates } from '/guest/render.js';
import { S, api, app, dialog, findDish, load, runToastAction, showDialog, tell, withDefaults } from '/studio/core.js';
import { deviceHTML, deviceToggle, mountDevice, sendPreview, setDevice } from '/studio/preview.js';
import { edited, flush, problem, renderStatus, resetSaves, showBlocker, unsaved } from '/studio/save.js';
import { applyProposal, assistantHTML, discardProposal, dismissAnswer, ask, endVoice, fit, renderAssistant, setView, toggleMic } from '/studio/assistant.js';
import { historyHTML, leaveRevision, loadHistory, resetHistory, restoreRevision, viewRevision } from '/studio/history.js';
import { openPhotoEditor, requestEdit, sourcePhoto } from '/studio/photos.js';

const route = location.pathname.replace(/\/$/, '');
let busy = false;
let demo = 'demo-osteria';
let fontsLoaded = false;

function top(right = '') {
  const admin = S.session?.admin && route !== '/admin' ? '<a class="btn quiet" href="/admin">Admin</a>' : '';
  return `<header class="top"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">S</span>SmartMenu</a><div class="actions">${admin}${right}</div></header>`;
}

function auth(mode) {
  const register = mode === 'register';
  showDialog(register ? 'Create your account' : 'Welcome back', `<form class="stack" data-form="${mode}">
    <label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
    <label>Password<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="12" maxlength="128" required></label>
    ${register ? '<label>Signup code<input name="code" maxlength="200" required></label>' : ''}
    <p class="form-error" role="alert"></p><button class="btn primary">${register ? 'Create account' : 'Sign in'}</button>
  </form>`);
}

const pressed = (value) => `aria-pressed="${value}"`;

async function welcome() {
  app.innerHTML = top('<button class="btn" data-do="login">Sign in</button><button class="btn primary" data-do="register">Create account</button>') +
    `<main class="welcome"><div class="welcome-copy">
    <h1>A better menu<br>starts here.</h1>
    <p>Turn your paper menu into a digital menu guests can browse at the table. Bring your own photos, find a look that fits, and publish with a QR code.</p>
    <div class="actions"><button class="btn primary" data-do="register">Create your menu</button><a class="btn" id="example-link" href="/m/${demo}">View example menu ↗</a></div>
    </div><div class="showcase">
      <div class="segmented demo-tabs" role="group" aria-label="Example menus">${Object.entries(templates).map(([key, template]) =>
        `<button data-do="demo" data-value="demo-${key}" ${pressed(demo === 'demo-' + key)}>${template.name}</button>`).join('')}</div>
      ${deviceHTML('Example guest menu')}
    </div></main>`;
  document.querySelector('.device').dataset.max = 600;
  mountDevice();
  try {
    const { samples } = await import('/guest/samples.js');
    S.samples = samples;
    S.sample = samples[demo];
    sendPreview();
  } catch (error) { console.error(error); }
}

async function dashboard() {
  const menus = await api('menus');
  app.innerHTML = top('<button class="btn" data-do="logout">Sign out</button>') + `<main class="dashboard">
  <div class="row spread"><h1 class="list-title">Your menus</h1><button class="btn primary" data-do="create">+ New menu</button></div>
  ${menus.length ? `<div class="menu-grid">${menus.map((menu) => `<a href="/studio?id=${menu.id}" class="menu-card"><strong>${e(menu.name)}</strong><span class="status">${menu.published_at ? 'Published' : 'Draft'} · Open editor →</span></a>`).join('')}</div>` :
    '<div class="empty"><p>Start with a photo of your current menu or add dishes by hand.</p></div>'}
  </main>`;
}

function optionList(options, selected) {
  return Object.entries(options).map(([key, name]) => `<option value="${key}" ${selected === key ? 'selected' : ''}>${e(name)}</option>`).join('');
}

const checked = (value) => value ? 'checked' : '';
const field = (scope, key, label, value, attrs = '') =>
  `<label>${label}<input data-${scope}="${key}" value="${e(value ?? '')}" ${attrs}></label>`;

function dishHTML(dish, index, items) {
  const cents = dish.price === null ? '' : (dish.priceInput ?? String(dish.price / 100));
  return `<div class="dish-edit" data-dish="${dish.id}"><details ${S.openDish === dish.id ? 'open' : ''}>
    <summary>${e(dish.name || 'New dish')}${dish.review ? '<span>Review needed</span>' : ''}</summary>
    <div class="fields">
      ${field('item', 'name', 'Name', dish.name, 'maxlength="120" required')}
      ${field('item', 'price', 'Price', cents, 'type="text" inputmode="decimal" placeholder="0.00" maxlength="9"')}
      <label class="full">Description<textarea data-item="description" rows="2" maxlength="500">${e(dish.description)}</textarea></label>
      ${field('item', 'portion', 'Portion', dish.portion, 'maxlength="40" placeholder="350 g"')}
      ${field('item', 'calories', 'Calories', dish.calories, 'type="number" min="0" max="100000" placeholder="kcal"')}
      <label class="full">Allergens<input data-item="allergens" value="${e(dish.allergens ?? '')}" maxlength="200"></label>
      <fieldset class="full chips"><legend>Dietary tags</legend>${TAGS.map((tag) =>
        `<label class="chip"><input type="checkbox" data-tag="${tag}" ${checked(dish.tags?.includes(tag))}><span>${TAG_LABELS[tag]}</span></label>`).join('')}</fieldset>
    </div>
    <div class="row flags">
      <label><input type="checkbox" data-item="available" ${checked(dish.available)}> Available</label>
      <label><input type="checkbox" data-item="featured" ${checked(dish.featured)}> Featured</label>
      ${dish.review ? '<button class="btn" data-do="reviewed">Mark reviewed</button>' : ''}
    </div>
    <div class="row">
      ${dish.originalPhoto ? '<button class="btn quiet" data-do="restore-photo">Restore original</button>' : ''}
      ${dish.photo ? `<img class="photo-inline" src="${photoURL(dish.photo)}" alt=""><button class="btn" data-do="edit-photo">Improve photo</button><button class="btn quiet" data-do="remove-photo">Remove photo</button>` : ''}
      <button class="btn" data-do="upload-photo">${dish.photo ? 'Replace photo' : '+ Upload photo'}</button>
      <button class="btn quiet danger" data-do="remove-dish">Delete dish</button>
    </div></details>
    <div class="order" role="group" aria-label="Order">
      <button class="btn quiet" data-do="dish-up" aria-label="Move dish up" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn quiet" data-do="dish-down" aria-label="Move dish down" ${index === items.length - 1 ? 'disabled' : ''}>↓</button>
    </div></div>`;
}

function dishesHTML(menu) {
  const last = menu.sections.length - 1;
  return `<div class="row spread"><h2>Sections and dishes</h2><button class="btn" data-do="import">↑ Import menu photo</button></div>
    ${menu.sections.length ? menu.sections.map((section, index) => `<div class="section-edit" data-section="${section.id}">
      <div class="row section-head"><input data-section-name value="${e(section.name)}" aria-label="Section name" maxlength="80" required>
      <button class="btn quiet" data-do="section-up" aria-label="Move section up" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn quiet" data-do="section-down" aria-label="Move section down" ${index === last ? 'disabled' : ''}>↓</button>
      <button class="btn quiet danger" data-do="remove-section" aria-label="Delete section">✕</button></div>
      <input class="section-note" data-section-note value="${e(section.note ?? '')}" aria-label="Section note, shown under the title" placeholder="Served until 12:00" maxlength="160">
      ${section.items.map(dishHTML).join('')}
      <div class="section-actions"><button class="btn quiet" data-do="add-dish">+ Add dish</button></div>
    </div>`).join('') : '<div class="empty"><p>Import a menu photo, ask the assistant, or create your first section.</p></div>'}
    <button class="btn" data-do="add-section">+ Add section</button>`;
}

const minis = {
  osteria: '<i class="mini-photo"></i><b>Osteria</b><i class="mini-text"></i><i class="mini-text short"></i>',
  carta: '<b>Carta</b><i class="mini-rule"></i><i class="mini-entry"></i><i class="mini-entry"></i><i class="mini-entry"></i>',
  mercato: '<b>Mercato</b><span class="mini-cards"><i></i><i></i><i></i><i></i></span>',
  notte: '<i class="mini-glow"></i><b>Notte</b><i class="mini-text short"></i>'
};

const miniStyle = ({ bg, surface, text, accent, line }) =>
  `--m-bg:${bg};--m-surface:${surface};--m-text:${text};--m-accent:${accent};--m-line:${line}`;

function loadTemplateFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  for (const { fonts } of Object.values(templates)) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${e(fonts)}">`);
}

function designHTML(menu) {
  const current = designOf(menu);
  const { palettes } = templates[current.template];
  return `<div class="row spread"><h2>Template</h2><button class="btn" data-do="random">✦ Surprise me</button></div>
    <div class="template-grid" role="group" aria-label="Template">${Object.entries(templates).map(([key, template]) => {
      const colors = key === current.template ? current.colors : template.palettes[template.defaultPalette];
      return `<button class="template-card" data-do="template" data-value="${key}" ${pressed(key === current.template)}>
        <span class="mini mini-${key}" style="${miniStyle(colors)}" aria-hidden="true">${minis[key]}</span>
        <span class="template-copy"><strong>${e(template.name)}</strong><span>${e(template.blurb)}</span></span></button>`;
    }).join('')}</div>
    <h2 class="design-label">Palette</h2>
    <div class="palettes" role="group" aria-label="Palette">${Object.entries(palettes).map(([key, palette]) =>
      `<button class="palette" data-do="palette" data-value="${key}" ${pressed(key === current.palette)} style="${miniStyle(palette)}">
        <span class="palette-chip" aria-hidden="true"><i></i><i></i></span>${e(palette.name)}</button>`).join('')}</div>
    <div class="accent-row"><label class="accent-pick"><input type="color" data-menu="accent" value="${current.colors.accent}">
      <span>Accent colour<small>Buttons, prices and highlights</small></span></label>
      <button class="btn quiet" data-do="reset-color">Reset to palette</button></div>`;
}

function settingsHTML(menu) {
  return `<div class="fields">
    ${field('menu', 'name', 'Restaurant name', menu.name, 'maxlength="80" required')}
    <label>Currency<select data-menu="currency">${optionList({ RON: 'RON', EUR: 'EUR', USD: 'USD', GBP: 'GBP' }, menu.currency)}</select></label>
    <label class="full">Menu introduction<textarea data-menu="subtitle" rows="3" maxlength="180">${e(menu.subtitle)}</textarea></label>
  </div>`;
}

const tabs = { dishes: 'Dishes', design: 'Design', settings: 'Settings', history: 'History' };
const tabPanel = { dishes: dishesHTML, design: designHTML, settings: settingsHTML, history: historyHTML };

function renderStudio() {
  const { draft, publishedAt } = S.state;
  if (!document.querySelector('.studio')) {
    app.innerHTML = top('<a class="btn" href="/">Your menus</a>') + `<main class="studio">
      <div class="studio-head"><div><a class="breadcrumb" href="/">Your menus</a>
        <h1 class="studio-title"></h1><p class="status" id="save-status" role="status"></p></div>
        <div class="actions" id="studio-actions"></div>
      </div>
      <div class="workspace">${assistantHTML()}<section class="panel" aria-label="Menu editor"></section>
        <aside class="preview" aria-label="Guest preview"><div class="row spread preview-head"><h2>Guest preview</h2>${deviceToggle()}</div>
        <div class="preview-banner" id="preview-banner" hidden></div>
        ${deviceHTML('Guest menu preview')}</aside></div>
    </main>`;
    mountDevice();
  }
  if (S.tab === 'design') loadTemplateFonts();
  document.querySelector('.studio-title').textContent = draft.name;
  document.querySelector('#studio-actions').innerHTML = `${publishedAt ? '<button class="btn" data-do="share">Share & QR</button>' : ''}
    <button class="btn primary" data-do="publish">Publish menu</button>`;
  document.querySelector('.panel').innerHTML = `<nav class="tabs" role="tablist" aria-label="Editor tabs">${Object.entries(tabs).map(([key, label]) =>
    `<button role="tab" data-do="tab" data-value="${key}" aria-selected="${key === S.tab}">${label}</button>`).join('')}</nav>
    <div role="tabpanel" aria-label="${tabs[S.tab]}">${tabPanel[S.tab](draft)}</div>`;
  renderStatus();
  renderAssistant();
  sendPreview();
}

S.render = renderStudio;

function changed(redraw = false, meta) {
  edited(meta);
  if (redraw) renderStudio();
  else sendPreview();
}

function selected(target) {
  const section = S.state.draft.sections.find((entry) => entry.id === target.closest('[data-section]')?.dataset.section);
  const item = section?.items.find((entry) => entry.id === target.closest('[data-dish]')?.dataset.dish);
  return { section, item };
}

function setItemValue(target, item) {
  const key = target.dataset.item;
  if (key === 'price') {
    const value = target.value.trim().replace(',', '.');
    const valid = !value || /^\d{1,5}(?:\.\d{1,2})?$/.test(value);
    item.priceInput = valid ? undefined : target.value;
    target.setCustomValidity(valid ? '' : 'Enter a price with up to two decimal places.');
    item.price = !value ? null : valid ? Math.round(Number(value) * 100) : NaN;
  } else if (key === 'calories') {
    item.calories = target.value === '' ? null : target.valueAsNumber;
  } else {
    item[key] = target.type === 'checkbox' ? target.checked : target.value;
    if (key === 'name') {
      const summary = target.closest('details').querySelector('summary');
      summary.firstChild.textContent = target.value || 'New dish';
    }
  }
}

app.addEventListener('input', ({ target }) => {
  if (!S.state || !target.closest('.panel')) return;
  if (target.dataset.menu) {
    S.state.draft[target.dataset.menu] = target.value;
    if (target.dataset.menu === 'name') document.querySelector('.studio-title').textContent = target.value;
    if (target.dataset.menu === 'accent') document.querySelector('.template-card[aria-pressed="true"] .mini')?.style.setProperty('--m-accent', target.value);
  } else if (target.hasAttribute('data-section-name')) {
    selected(target).section.name = target.value;
  } else if (target.hasAttribute('data-section-note')) {
    selected(target).section.note = target.value;
  } else if (target.dataset.tag) {
    const { item } = selected(target);
    const tags = new Set(item.tags);
    tags[target.checked ? 'add' : 'delete'](target.dataset.tag);
    item.tags = TAGS.filter((tag) => tags.has(tag));
    S.openDish = item.id;
  } else if (target.dataset.item) {
    const { item } = selected(target);
    setItemValue(target, item);
    S.openDish = item.id;
  } else return;
  changed();
});

function newDish() {
  return {
    id: crypto.randomUUID(), name: 'New dish', description: '', allergens: '', portion: '', tags: [],
    price: null, calories: null, photo: null, originalPhoto: null, featured: false, available: true, review: false
  };
}

function share() {
  const href = new URL('/m/' + S.state.slug, location.origin).href;
  const qr = '/api/menus/' + S.state.id + '/qr';
  showDialog('Share your menu', `<p class="dialog-copy">Use the same link and QR code whenever you publish changes.</p>
    <img class="qr" src="${qr}" alt="QR code for the published menu">
    <div class="stack"><label>Menu link<input id="share-url" readonly value="${e(href)}"></label>
    <div class="actions"><button class="btn" data-do="copy">Copy link</button><a class="btn" download="smartmenu-qr.svg" href="${qr}">Download QR</a>
    <a class="btn primary" target="_blank" rel="noopener" href="${e(href)}">Open guest menu ↗</a></div></div>`);
}

function uploadDialog(item) {
  const isImport = !item;
  showDialog(isImport ? 'Import a menu page' : 'Upload a dish photo',
    `<form data-form="${isImport ? 'import' : 'upload'}" data-dish="${item?.id ?? ''}" class="stack">
    <p class="dialog-copy">${isImport ? 'Take a clear photo of one page. You can review the extracted dishes before publishing.' :
      'Choose a photo of the dish as it’s served. You can improve it after uploading.'}</p>
    <label>Photo<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required></label>
    <p class="form-error" role="alert"></p>
    <button class="btn primary">${isImport ? 'Read menu photo' : 'Upload photo'}</button></form>`);
}

const pick = (options) => options[Math.floor(Math.random() * options.length)];

async function publish() {
  if (busy) return;
  if (!await flush()) {
    tell('Publishing needs your changes saved first. ' + (problem() || ''));
    return;
  }
  busy = true;
  const root = document.querySelector('.studio');
  root.inert = true;
  try {
    load(await api('menus/' + S.state.id + '/publish', 'POST', { draft: S.state.draft, version: S.state.version, source: 'manual' }));
    resetSaves();
    resetHistory();
    renderStudio();
    share();
    tell('Menu published.');
  } finally {
    busy = false;
    root.inert = false;
  }
}

function move(list, item, step) {
  const index = list.indexOf(item);
  const to = index + step;
  if (to < 0 || to >= list.length) return false;
  list.splice(index, 1);
  list.splice(to, 0, item);
  return true;
}

function refocus(selector, action, opposite) {
  const scope = document.querySelector(selector);
  const button = scope?.querySelector(`:scope > .row [data-do="${action}"], :scope > .order [data-do="${action}"]`);
  (button && !button.disabled ? button : scope?.querySelector(`[data-do="${opposite}"]`))?.focus();
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-do]');
  if (!target) return;
  const action = target.dataset.do;
  try {
    if (action === 'close') { dialog.close(); return; }
    if (action === 'toast-action') { await runToastAction(); return; }
    if (action === 'register' || action === 'login') { auth(action); return; }
    if (action === 'logout') { await api('auth/logout', 'POST'); location.href = '/'; return; }
    if (action === 'create') {
      showDialog('New menu', '<form data-form="create" class="stack"><label>Restaurant name<input name="name" required maxlength="80"></label><p class="form-error" role="alert"></p><button class="btn primary">Create menu</button></form>');
      return;
    }
    if (action === 'copy') {
      const input = dialog.querySelector('#share-url');
      if (navigator.clipboard) await navigator.clipboard.writeText(input.value);
      else { input.select(); document.execCommand('copy'); }
      tell('Menu link copied.');
      return;
    }
    if (action === 'device') { setDevice(target.dataset.value); return; }
    if (action === 'demo') {
      demo = target.dataset.value;
      document.querySelector('#example-link').href = '/m/' + demo;
      for (const button of document.querySelectorAll('[data-do="demo"]')) button.setAttribute('aria-pressed', button.dataset.value === demo);
      S.sample = S.samples?.[demo];
      sendPreview();
      return;
    }
    if (!S.state) return;
    if (action === 'reload') { location.reload(); return; }
    if (action === 'show-blocker') { showBlocker(); return; }
    if (action === 'publish') { await publish(); return; }
    if (action === 'share') { share(); return; }
    if (action === 'example') { const input = document.querySelector('#ask'); input.value = target.textContent; fit(); await ask(input.value); return; }
    if (action === 'mic') { toggleMic(); return; }
    if (action === 'voice-end') { endVoice(); document.querySelector('[data-do="mic"]')?.focus(); return; }
    if (action === 'apply-proposal') { await applyProposal(); return; }
    if (action === 'discard-proposal') { discardProposal(); return; }
    if (action === 'dismiss-answer') { dismissAnswer(); return; }
    if (action === 'proposal-view') { setView(target.dataset.value); return; }
    if (action === 'view-revision') { await viewRevision(target.dataset.value); return; }
    if (action === 'history-back') { leaveRevision(); return; }
    if (action === 'restore-revision') { await restoreRevision(); return; }
    if (action === 'history-refresh') { resetHistory(); renderStudio(); loadHistory(); return; }
    if (action === 'tab') {
      if (S.tab === target.dataset.value) return;
      S.tab = target.dataset.value;
      if (S.tab === 'history') resetHistory();
      else S.viewing = null;
      renderStudio();
      document.querySelector(`[data-do="tab"][data-value="${S.tab}"]`).focus();
      if (S.tab === 'history') loadHistory();
      return;
    }
    const { section, item } = selected(target);
    if (item) S.openDish = item.id;
    if (action === 'import' || action === 'upload-photo') { uploadDialog(item); return; }
    if (action === 'edit-photo') { await openPhotoEditor(item); return; }
    if (action === 'apply-photo') {
      const dish = findDish(target.dataset.dishId);
      dish.originalPhoto = sourcePhoto(dish);
      dish.photo = target.dataset.value;
      S.openDish = dish.id;
      dialog.close();
    } else if (action === 'add-section') {
      S.state.draft.sections.push({ id: crypto.randomUUID(), name: 'New section', note: '', items: [] });
    } else if (action === 'remove-section') {
      if (section.items.length && !confirm('Delete this section and all its dishes?')) return;
      S.state.draft.sections = S.state.draft.sections.filter((entry) => entry !== section);
    } else if (action === 'section-up' || action === 'section-down') {
      if (!move(S.state.draft.sections, section, action === 'section-up' ? -1 : 1)) return;
      changed(true);
      refocus(`[data-section="${section.id}"]`, action, action === 'section-up' ? 'section-down' : 'section-up');
      return;
    } else if (action === 'dish-up' || action === 'dish-down') {
      if (!move(section.items, item, action === 'dish-up' ? -1 : 1)) return;
      S.openDish = '';
      changed(true);
      refocus(`[data-dish="${item.id}"]`, action, action === 'dish-up' ? 'dish-down' : 'dish-up');
      return;
    } else if (action === 'add-dish') {
      const dish = newDish();
      section.items.push(dish);
      S.openDish = dish.id;
    } else if (action === 'remove-dish') {
      if (!confirm('Delete this dish?')) return;
      section.items = section.items.filter((entry) => entry !== item);
    } else if (action === 'restore-photo') {
      item.photo = item.originalPhoto;
      item.originalPhoto = null;
    } else if (action === 'remove-photo') {
      item.photo = null;
      item.originalPhoto = null;
    } else if (action === 'reviewed') {
      item.review = false;
    } else if (action === 'template') {
      const key = target.dataset.value;
      if (key === S.state.draft.template) return;
      Object.assign(S.state.draft, { template: key, palette: templates[key].defaultPalette });
    } else if (action === 'palette') {
      Object.assign(S.state.draft, { palette: target.dataset.value, accent: '' });
    } else if (action === 'reset-color') {
      S.state.draft.accent = '';
    } else if (action === 'random') {
      const template = pick(Object.keys(templates).filter((key) => key !== S.state.draft.template));
      Object.assign(S.state.draft, { template, palette: pick(Object.keys(templates[template].palettes)), accent: '' });
    } else return;
    changed(true);
  } catch (error) { tell(error.message); }
});

function hasAlpha(context, width, height) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let index = 3; index < data.length; index += 4) if (data[index] < 255) return true;
  return false;
}

// A menu page is always sent as JPEG or PNG: Grok cannot read WebP, and a page needs no transparency.
async function prepareImage(file, max, page = false) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Choose a JPEG, PNG, or WebP photo.'); }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  if (scale === 1 && file.size <= 700 * 1024 && ['image/jpeg', 'image/png', ...(page ? [] : ['image/webp'])].includes(file.type)) {
    bitmap.close();
    return { blob: file, width, height };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (page) {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const alpha = !page && ['image/png', 'image/webp'].includes(file.type) && hasAlpha(context, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, alpha ? 'image/webp' : 'image/jpeg', alpha || page ? 0.9 : 0.85));
  if (!blob) throw new Error('This photo could not be prepared. Try another one.');
  return { blob, width, height };
}

dialog.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const action = form.dataset.form;
  const errorField = form.querySelector('.form-error');
  const data = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('button:not([type="button"])');
  submit.disabled = true;
  errorField.textContent = '';
  try {
    if (action === 'register' || action === 'login') {
      await api('auth/' + action, 'POST', data);
      dialog.close();
      await dashboard();
    } else if (action === 'create') {
      const menu = await api('menus', 'POST', data);
      location.href = '/studio?id=' + menu.id;
    } else if (action === 'import') {
      submit.textContent = 'Reading menu…';
      const { blob } = await prepareImage(data.file, 2000, true);
      const { sections } = await api('menus/' + S.state.id + '/import', 'POST', blob);
      if (!form.isConnected) return;
      if (!sections.length) throw new Error('No dishes found. Try a sharper photo.');
      const next = structuredClone(S.state.draft.sections);
      for (const section of sections.map(withDefaults)) {
        const match = next.find((entry) => entry.name.trim().toLowerCase() === section.name.toLowerCase());
        if (match) match.items.push(...section.items);
        else next.push(section);
      }
      const count = next.reduce((total, section) => total + section.items.length, 0);
      if (next.length > 30 || count > 300) throw new Error('The import would exceed 30 sections or 300 dishes.');
      S.state.draft.sections = next;
      S.openDish = sections[0].items[0].id;
      dialog.close();
      const added = sections.reduce((total, section) => total + section.items.length, 0);
      changed(true, { source: 'import', summary: `Imported ${added} dish${added === 1 ? '' : 'es'}` });
      flush();
      tell('Page imported. Check the extracted text and prices before publishing.');
    } else if (action === 'upload') {
      submit.textContent = 'Uploading…';
      const { blob, width, height } = await prepareImage(data.file, 1600);
      const { id } = await api(`menus/${S.state.id}/photos?w=${width}&h=${height}`, 'POST', blob);
      const item = findDish(form.dataset.dish);
      if (!item || !form.isConnected) return;
      item.photo = id;
      item.originalPhoto = null;
      S.state.draft.photos = { ...S.state.draft.photos, [id]: { w: width, h: height } };
      dialog.close();
      changed(true);
    } else if (action === 'edit') {
      await requestEdit(findDish(form.dataset.dish), data.look);
    }
  } catch (error) {
    if (errorField.isConnected) errorField.textContent = error.message;
    else tell(error.message);
  } finally {
    submit.disabled = false;
    if (action === 'import') submit.textContent = 'Read menu photo';
    if (action === 'upload') submit.textContent = 'Upload photo';
  }
});

window.addEventListener('beforeunload', (event) => {
  if (S.state && unsaved()) { event.preventDefault(); event.returnValue = ''; }
});

async function adminPage() {
  if (!S.session?.admin) {
    app.innerHTML = top() + '<main class="page-error"><h1>Not available</h1><p>This page is only for SmartMenu administrators.</p><a href="/">Back to SmartMenu</a></main>';
    return;
  }
  app.innerHTML = top('<a class="btn" href="/">Your menus</a>') + '<main class="admin" id="admin"></main>';
  const { mountAdmin } = await import('/studio/admin.js');
  mountAdmin(document.querySelector('#admin'));
}

async function start() {
  try {
    S.session = await api('session').catch((error) => {
      if (error.status === 401 && route !== '/admin') throw error;
      return { signedIn: error.status !== 401 };
    });
    if (route === '/admin') await adminPage();
    else if (route === '/studio') {
      const id = new URLSearchParams(location.search).get('id');
      if (!id) { await dashboard(); return; }
      load(await api('menus/' + encodeURIComponent(id)));
      resetSaves();
      renderStudio();
    } else await dashboard();
  } catch (error) {
    if (error.status === 401) await welcome();
    else throw error;
  }
}

start().catch((error) => {
  app.innerHTML = `<main class="page-error"><h1>${e(error.message)}</h1><a href="/">SmartMenu</a></main>`;
});
