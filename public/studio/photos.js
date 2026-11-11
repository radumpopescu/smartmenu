import { S, api, dialog, showDialog } from './core.js';
import { designOf, escape as e, photoURL } from '/guest/render.js';

const looks = {
  natural: { name: 'Natural', text: 'Soft window light on a pale wood or stone table.' },
  bright: { name: 'Bright', text: 'Even daylight on a clean, light surface. Fresh and airy.' },
  moody: { name: 'Moody', text: 'Low side light on a dark surface, for evening menus.' },
  cutout: { name: 'Cut-out', text: 'No background. Just the plate, on transparent.' }
};
const lookFor = { osteria: 'natural', carta: 'natural', mercato: 'bright', notte: 'moody' };

let session = 0;
let chosen = '';

export const sourcePhoto = (item) => item.originalPhoto || item.photo;

function compareHTML(item, job) {
  const meta = S.state.draft.photos?.[sourcePhoto(item)];
  const ratio = meta?.w && meta?.h ? `${Number(meta.w)} / ${Number(meta.h)}` : '1';
  const ready = job?.status === 'ready';
  const pending = job?.status === 'queued' || job?.status === 'processing';
  const message = pending ? 'Retouching your photo… this usually takes under a minute.' : job?.status === 'failed' ? 'That edit did not work. Choose a look and try again.' : '';
  return `<div class="compare${ready ? ' is-ready' : ''}${chosen === 'cutout' && ready ? ' is-cutout' : ''}" style="aspect-ratio: ${ratio}; --pos: 50%">
    <img src="${photoURL(sourcePhoto(item))}" alt="${ready ? 'Original photo, left of the divider' : 'Original photo'}">
    ${ready ? `<div class="compare-after"><img src="${photoURL(job.result_id)}" alt="Retouched photo, right of the divider"></div>
      <span class="compare-tag left" aria-hidden="true">Original</span><span class="compare-tag right" aria-hidden="true">Retouched</span>
      <span class="compare-handle" aria-hidden="true"></span>
      <input type="range" min="0" max="100" value="50" data-compare aria-label="Compare original and retouched photo" aria-valuetext="Divider in the middle">` :
      message ? `<p class="compare-status" aria-live="polite">${message}</p>` : ''}
  </div>`;
}

function editorHTML(item, job) {
  const pending = job?.status === 'queued' || job?.status === 'processing';
  const ready = job?.status === 'ready';
  const preferred = lookFor[designOf(S.state.draft).template];
  const selected = chosen || preferred;
  return `<p class="dialog-copy">${ready ? 'Drag the divider to compare.' : 'Choose a look. SmartMenu retouches the light and the background, never the food.'}</p>
    ${compareHTML(item, job)}
    ${ready ? `<div class="check-food" role="note"><strong>Check the food is unchanged</strong>
      <span>Same pieces, same portion, same garnish, same plate. If anything was added, removed or tidied up, try another look or keep your original.</span></div>` : ''}
    ${pending ? '' : `<form class="stack" data-form="edit" data-dish="${item.id}">
      <fieldset class="looks"><legend>${ready ? 'Try another look' : 'Look'}</legend>${Object.entries(looks).map(([key, look]) =>
        `<label class="look"><input type="radio" name="look" value="${key}" ${key === selected ? 'checked' : ''}>
        <span><strong>${look.name}${key === preferred ? ' <small>Suits your template</small>' : ''}</strong>${look.text}</span></label>`).join('')}</fieldset>
      <p class="form-error" role="alert"></p><div class="actions">
      ${ready ? `<button type="button" class="btn primary" data-do="apply-photo" data-dish-id="${item.id}" data-value="${e(job.result_id)}">Use this photo</button>` : ''}
      <button class="btn${ready ? '' : ' primary'}">${ready ? 'Try another' : 'Retouch photo'}</button></div>
    </form>`}`;
}

function show(item, job) {
  const focused = dialog.contains(document.activeElement) ? document.activeElement.dataset.do ?? (document.activeElement.type === 'radio' ? 'look' : '') : '';
  showDialog('Improve dish photo', editorHTML(item, job));
  if (focused === 'look') dialog.querySelector('input[name="look"]:checked')?.focus();
  else if (job?.status === 'ready') dialog.querySelector('[data-compare]')?.focus();
}

async function watch(item, job, mine) {
  show(item, job);
  while (job && ['queued', 'processing'].includes(job.status)) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (!dialog.open || mine !== session) return;
    job = await api('menus/' + S.state.id + '/edits/' + job.id);
    if (dialog.open && mine === session) show(item, job);
  }
}

export async function openPhotoEditor(item) {
  const mine = ++session;
  chosen = '';
  const job = await api('menus/' + S.state.id + '/edits?source=' + sourcePhoto(item));
  if (job?.look) chosen = job.look;
  if (mine === session) await watch(item, job, mine);
}

export async function requestEdit(item, look) {
  const mine = ++session;
  chosen = look;
  const job = await api('menus/' + S.state.id + '/edits', 'POST', { source: sourcePhoto(item), look });
  if (dialog.open && mine === session) await watch(item, job, mine);
}

dialog.addEventListener('close', () => { session++; });

dialog.addEventListener('input', ({ target }) => {
  if (!target.matches('[data-compare]')) return;
  const value = Number(target.value);
  target.closest('.compare').style.setProperty('--pos', value + '%');
  target.setAttribute('aria-valuetext', value < 5 ? 'Showing the retouched photo' : value > 95 ? 'Showing the original photo' : `${value}% original, ${100 - value}% retouched`);
});
