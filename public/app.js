import { escape as e, fonts, layouts, menuHTML, palettes, photoURL, sample } from './menu-view.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const route = location.pathname.replace(/\/$/, '');
let state;
let tab = 'dishes';
let dirty = false;
let busy = false;
let notice;
let openDish = '';
let editDialogVersion = 0;

async function api(path, method = 'GET', data) {
  const options = { method };
  if (data instanceof Blob) {
    options.body = data;
    options.headers = { 'Content-Type': data.type };
  } else if (data !== undefined) {
    options.body = JSON.stringify(data);
    options.headers = { 'Content-Type': 'application/json' };
  }
  const response = await fetch('/api/' + path, options);
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
  return result;
}

function tell(message) {
  clearTimeout(notice);
  toast.textContent = message;
  notice = setTimeout(() => { toast.textContent = ''; }, 5000);
}

function top(right = '') {
  return `<header class="top"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">S</span>SmartMenu</a><div class="actions">${right}</div></header>`;
}

function showDialog(title, content) {
  dialog.innerHTML = `<div class="row spread"><h2>${title}</h2><button class="btn quiet" data-do="close" aria-label="Close dialog">✕</button></div>${content}`;
  if (!dialog.open) dialog.showModal();
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

function welcome() {
  app.innerHTML = top('<button class="btn" data-do="login">Sign in</button><button class="btn primary" data-do="register">Create account</button>') +
    `<main class="welcome"><div class="welcome-copy">
    <h1>A better menu<br>starts here.</h1>
    <p>Turn your paper menu into a digital menu guests can browse at the table. Bring your own photos, find a look that fits, and publish with a QR code.</p>
    <div class="actions"><button class="btn primary" data-do="register">Create your menu</button><a class="btn" href="/m/osteria-verde-example">View example menu ↗</a></div>
    </div><div class="showcase"><div class="phone" aria-label="Example guest menu">${menuHTML(sample, 'sample')}</div></div></main>`;
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

function dishHTML(dish) {
  const cents = dish.price === null ? '' : (dish.priceInput ?? String(dish.price / 100));
  return `<details class="dish-edit" data-dish="${dish.id}" ${openDish === dish.id ? 'open' : ''}>
    <summary>${e(dish.name || 'New dish')}${dish.review ? '<span>Review needed</span>' : ''}</summary>
    <div class="fields">
      ${field('item', 'name', 'Name', dish.name, 'maxlength="120"')}
      ${field('item', 'price', 'Price', cents, 'type="text" inputmode="decimal" placeholder="0.00" maxlength="9"')}
      <label class="full">Description<textarea data-item="description" rows="2" maxlength="500">${e(dish.description)}</textarea></label>
      ${field('item', 'allergens', 'Allergens', dish.allergens, 'maxlength="200"')}
      ${field('item', 'calories', 'Calories', dish.calories, 'type="number" min="0" max="100000"')}
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
    </div></details>`;
}

function dishesHTML(menu) {
  return `<div class="row spread"><h2>Sections and dishes</h2><button class="btn" data-do="import">↑ Import menu photo</button></div>
    ${menu.sections.length ? menu.sections.map((section, index) => `<div class="section-edit" data-section="${section.id}">
      <div class="row"><input data-section-name value="${e(section.name)}" aria-label="Section name" maxlength="80">
      <button class="btn quiet" data-do="up-section" aria-label="Move section up" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn quiet danger" data-do="remove-section" aria-label="Delete section">✕</button></div>
      ${section.items.map(dishHTML).join('')}
      <div class="section-actions"><button class="btn quiet" data-do="add-dish">+ Add dish</button></div>
    </div>`).join('') : '<div class="empty"><p>Import a menu photo or create your first section.</p></div>'}
    <button class="btn" data-do="add-section">+ Add section</button>`;
}

function designHTML(menu) {
  return `<div class="row spread"><h2>Color palette</h2><button class="btn" data-do="random">✦ Surprise me</button></div>
    <div class="swatches">${Object.entries(palettes).map(([key, style]) => `<button class="swatch" style="--sw-bg:${style.bg};--sw-text:${style.text}" data-do="palette" data-value="${key}" aria-pressed="${menu.theme === key}">${style.name}</button>`).join('')}</div>
    <div class="fields">
      <label>Layout<select data-menu="layout">${optionList(layouts, menu.layout)}</select></label>
      <label>Heading type<select data-menu="font">${optionList(fonts, menu.font)}</select></label>
      <label>Accent color<input type="color" data-menu="accent" value="${menu.accent || palettes[menu.theme].accent}"></label>
      <div class="row"><button class="btn" data-do="reset-color">Reset accent</button></div>
    </div>`;
}

function settingsHTML(menu) {
  return `<div class="fields">
    ${field('menu', 'name', 'Restaurant name', menu.name, 'maxlength="80"')}
    <label>Currency<select data-menu="currency">${optionList({ RON: 'RON', EUR: 'EUR', USD: 'USD', GBP: 'GBP' }, menu.currency)}</select></label>
    <label class="full">Menu introduction<textarea data-menu="subtitle" rows="3" maxlength="180">${e(menu.subtitle)}</textarea></label>
  </div>`;
}

function renderStudio() {
  const { draft, publishedAt } = state;
  const tabs = { dishes: 'Dishes', design: 'Design', settings: 'Settings' };
  app.innerHTML = top('<a class="btn" href="/">Your menus</a>') + `<main class="studio">
    <div class="studio-head"><div><a class="breadcrumb" href="/">Your menus</a>
      <h1 class="studio-title">${e(draft.name)}</h1><p class="status" id="save-status"></p></div>
      <div class="actions">${publishedAt ? '<button class="btn" data-do="share">Share & QR</button>' : ''}
      <button class="btn" data-do="save">Save draft</button><button class="btn primary" data-do="publish">Publish menu</button></div>
    </div>
    <div class="workspace"><section class="panel" aria-label="Menu editor">
      <nav class="tabs" role="tablist" aria-label="Editor tabs">${Object.entries(tabs).map(([key, label]) =>
        `<button role="tab" data-do="tab" data-value="${key}" aria-selected="${key === tab}">${label}</button>`).join('')}</nav>
      <div role="tabpanel">${tab === 'dishes' ? dishesHTML(draft) : tab === 'design' ? designHTML(draft) : settingsHTML(draft)}</div>
      </section><aside class="preview"><div class="row spread preview-head"><h2>Guest preview</h2><span class="status">Mobile</span></div>
      <div class="phone" id="preview-menu">${menuHTML(draft, 'preview')}</div></aside></div>
    </main>`;
  updateStatus();
}

function updateStatus() {
  const status = document.querySelector('#save-status');
  if (status) status.textContent = dirty ? 'Unsaved changes' : state.publishedAt ? 'Published · draft saved' : 'Draft saved';
}

function changed(redraw = false) {
  dirty = true;
  if (redraw) renderStudio();
  else {
    updateStatus();
    const preview = document.querySelector('#preview-menu');
    if (preview) {
      const previous = preview.scrollTop;
      preview.innerHTML = menuHTML(state.draft, 'preview');
      preview.scrollTop = previous;
    }
  }
}

function selected(target) {
  const section = state.draft.sections.find((entry) => entry.id === target.closest('[data-section]')?.dataset.section);
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
  if (!state) return;
  if (target.dataset.menu) {
    state.draft[target.dataset.menu] = target.value;
    if (target.dataset.menu === 'name') document.querySelector('.studio-title').textContent = target.value;
  } else if (target.hasAttribute('data-section-name')) {
    selected(target).section.name = target.value;
  } else if (target.dataset.item) {
    const { item } = selected(target);
    setItemValue(target, item);
    openDish = item.id;
  } else return;
  changed();
});

function newDish() {
  return {
    id: crypto.randomUUID(), name: 'New dish', description: '', allergens: '',
    price: null, calories: null, photo: null, featured: false, available: true, review: false
  };
}

function share() {
  const href = new URL('/m/' + state.slug, location.origin).href;
  const qr = '/api/menus/' + state.id + '/qr';
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

function photoEditor(item, job) {
  const pending = job?.status === 'queued' || job?.status === 'processing';
  const ready = job?.status === 'ready';
  showDialog('Improve dish photo', `<p class="dialog-copy">Compare the result with the original before using it. Check the food, portion and plating.</p>
    <div class="photo-pair"><figure><img src="${photoURL(sourcePhoto(item))}" alt="Original dish photo"><figcaption>Source photo</figcaption></figure>
    <figure>${ready ? `<img src="${photoURL(job.result_id)}" alt="Edited dish photo">` :
      `<div class="pending" aria-live="polite">${pending ? 'Editing your photo…' : job?.status === 'failed' ? 'The edit failed. Try again.' : 'Edited photo will appear here'}</div>`}
    <figcaption>AI edit</figcaption></figure></div>
    ${pending ? '' : `<form class="stack" data-form="edit" data-dish="${item.id}">
      <label>Background<select name="background"><option value="studio">Natural tabletop</option><option value="transparent">Transparent</option></select></label>
      <p class="form-error" role="alert"></p><div class="actions"><button class="btn">${ready ? 'Try another edit' : 'Improve photo'}</button>
      ${ready ? `<button type="button" class="btn primary" data-do="apply-photo" data-dish-id="${item.id}" data-value="${job.result_id}">Use this photo</button>` : ''}</div>
    </form>`}`);
}

const sourcePhoto = (item) => item.originalPhoto || item.photo;
const findDish = (id) => state.draft.sections.flatMap((section) => section.items).find((dish) => dish.id === id);

async function watchEdit(item, job, version) {
  photoEditor(item, job);
  while (job && ['queued', 'processing'].includes(job.status)) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (!dialog.open || version !== editDialogVersion) return;
    job = await api('menus/' + state.id + '/edits/' + job.id);
    if (dialog.open && version === editDialogVersion) photoEditor(item, job);
  }
}

async function save(publish) {
  if (busy) return;
  const input = document.querySelector('.panel input:invalid');
  if (input) { input.reportValidity(); return; }
  if (state.draft.sections.some((section) => section.items.some((item) => Number.isNaN(item.price) || Number.isNaN(item.calories)))) {
    throw new Error('Check the price and calories on your dishes.');
  }
  busy = true;
  const root = document.querySelector('.studio');
  root.inert = true;
  try {
    const path = 'menus/' + state.id + (publish ? '/publish' : '');
    state = await api(path, publish ? 'POST' : 'PUT', { draft: state.draft, version: state.version });
    dirty = false;
    renderStudio();
    if (publish) share();
    tell(publish ? 'Menu published.' : 'Draft saved.');
  } finally {
    busy = false;
    root.inert = false;
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-do]');
  if (!target) return;
  const action = target.dataset.do;
  try {
    if (action === 'close') { dialog.close(); return; }
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
    if (!state) return;
    if (action === 'save' || action === 'publish') { await save(action === 'publish'); return; }
    if (action === 'share') { share(); return; }
    if (action === 'tab') { tab = target.dataset.value; renderStudio(); return; }
    const { section, item } = selected(target);
    if (item) openDish = item.id;
    if (action === 'import' || action === 'upload-photo') { uploadDialog(item); return; }
    if (action === 'edit-photo') {
      const version = ++editDialogVersion;
      const job = await api('menus/' + state.id + '/edits?source=' + sourcePhoto(item));
      if (version === editDialogVersion) await watchEdit(item, job, version);
      return;
    }
    if (action === 'apply-photo') {
      const dish = findDish(target.dataset.dishId);
      dish.originalPhoto = sourcePhoto(dish);
      dish.photo = target.dataset.value;
      openDish = dish.id;
      dialog.close();
    } else if (action === 'add-section') {
      state.draft.sections.push({ id: crypto.randomUUID(), name: 'New section', items: [] });
    } else if (action === 'remove-section') {
      if (section.items.length && !confirm('Delete this section and all its dishes?')) return;
      state.draft.sections = state.draft.sections.filter((entry) => entry !== section);
    } else if (action === 'up-section') {
      const index = state.draft.sections.indexOf(section);
      state.draft.sections.splice(index - 1, 2, section, state.draft.sections[index - 1]);
    } else if (action === 'add-dish') {
      const dish = newDish();
      section.items.push(dish);
      openDish = dish.id;
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
    } else if (action === 'palette') {
      state.draft.theme = target.dataset.value;
      state.draft.accent = '';
    } else if (action === 'reset-color') {
      state.draft.accent = '';
    } else if (action === 'random') {
      const choose = (options, current) => {
        const entries = Object.keys(options).filter((entry) => entry !== current);
        return entries[Math.floor(Math.random() * entries.length)];
      };
      state.draft.theme = choose(palettes, state.draft.theme);
      state.draft.layout = choose(layouts, state.draft.layout);
      state.draft.font = Math.random() < 0.75 ? 'serif' : 'sans';
      state.draft.accent = '';
    } else return;
    changed(true);
  } catch (error) { tell(error.message); }
});

dialog.addEventListener('close', () => { editDialogVersion++; });

async function prepareImage(file) {
  if (file.size <= 6 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const result = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (result) return result;
  } catch {}
  throw new Error('Choose a JPEG, PNG, or WebP photo under 6 MB.');
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
      const { sections } = await api('menus/' + state.id + '/import', 'POST', await prepareImage(data.file));
      if (!form.isConnected) return;
      if (!sections.length) throw new Error('No dishes found. Try a sharper photo.');
      const next = structuredClone(state.draft.sections);
      for (const section of sections) {
        const match = next.find((entry) => entry.name.trim().toLowerCase() === section.name.toLowerCase());
        if (match) match.items.push(...section.items);
        else next.push(section);
      }
      const count = next.reduce((total, section) => total + section.items.length, 0);
      if (next.length > 30 || count > 300) throw new Error('The import would exceed 30 sections or 300 dishes.');
      state.draft.sections = next;
      openDish = sections[0].items[0].id;
      dialog.close();
      changed(true);
      tell('Page imported. Check the extracted text and prices before publishing.');
    } else if (action === 'upload') {
      submit.textContent = 'Uploading…';
      const { id } = await api('menus/' + state.id + '/photos', 'POST', await prepareImage(data.file));
      const item = findDish(form.dataset.dish);
      if (!item || !form.isConnected) return;
      item.photo = id;
      item.originalPhoto = null;
      dialog.close();
      changed(true);
    } else if (action === 'edit') {
      const item = findDish(form.dataset.dish);
      const version = ++editDialogVersion;
      const job = await api('menus/' + state.id + '/edits', 'POST', { source: sourcePhoto(item), background: data.background });
      if (dialog.open && version === editDialogVersion) await watchEdit(item, job, version);
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
  if (dirty) { event.preventDefault(); event.returnValue = ''; }
});

async function start() {
  const slug = route.match(/^\/m\/([a-z0-9-]+)$/)?.[1];
  if (slug) {
    const menu = slug === 'osteria-verde-example' ? sample : await api('public/' + slug);
    document.title = menu.name + ' · Menu';
    app.className = 'guest-page';
    app.innerHTML = `<main>${menuHTML(menu)}</main>`;
    return;
  }
  try {
    if (route === '/studio') {
      const id = new URLSearchParams(location.search).get('id');
      if (!id) { await dashboard(); return; }
      state = await api('menus/' + encodeURIComponent(id));
      renderStudio();
    } else await dashboard();
  } catch (error) {
    if (error.status === 401) welcome();
    else throw error;
  }
}

start().catch((error) => {
  app.innerHTML = `<main class="page-error"><h1>${e(error.message)}</h1><a href="/">SmartMenu</a></main>`;
});
