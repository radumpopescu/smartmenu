import { S, api, normalize, tell } from './core.js';
import { blocker, edited, flush } from './save.js';
import { sendPreview } from './preview.js';
import { planOps } from '/studio/ops.js';
import { escape as e } from '/guest/render.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const kinds = { add: 'Add', change: 'Change', remove: 'Remove', move: 'Move' };
const turns = [];
let working = '';
let failure = '';
let note = '';
let answer = null;
let listening = null;

const icon = {
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'
};

export const assistantHTML = () => `<section class="assistant" aria-labelledby="assistant-title">
  <div class="assistant-intro"><h2 id="assistant-title">What would you like to change?</h2>
    <p>Ask in your own words. You will see every change before it happens.</p></div>
  <form class="composer" data-form="ask">
    <p class="composer-note" id="composer-note" role="status" aria-live="polite"></p>
    <div class="composer-row">
      <label class="sr-only" for="ask">Tell the assistant what to change</label>
      <textarea id="ask" name="message" rows="1" maxlength="1000" placeholder="Tell me what to change…" enterkeyhint="send" autocomplete="off"></textarea>
      <button type="button" class="round mic" data-do="mic" aria-label="Dictate" aria-pressed="false" ${Recognition ? '' : 'hidden'}>${icon.mic}</button>
      <button class="round send" aria-label="Send">${icon.send}</button>
    </div>
    <div class="examples" id="examples"></div>
  </form>
  <div class="assistant-feed" id="assistant-feed"></div>
</section>`;

function examples(draft) {
  const dishes = draft.sections.flatMap((section) => section.items);
  const list = [];
  const priced = draft.sections.find((section) => section.items.filter((dish) => dish.price).length >= 2);
  if (priced) list.push(`Raise all prices in ${priced.name} by 5%`);
  if (dishes.some((dish) => !dish.description?.trim())) list.push('Write a short description for dishes that have none');
  const described = dishes.filter((dish) => dish.description?.trim());
  if (described.length && described.some((dish) => /[^\x00-\x7f’‘“”–—…·]/.test(dish.description))) list.push('Translate the descriptions into English');
  if (!dishes.length) list.push('Add a Starters section and a Desserts section');
  if (dishes.length && !dishes.some((dish) => dish.tags?.length)) list.push('Mark the vegetarian dishes');
  const featured = dishes.find((dish) => dish.available !== false && dish.name);
  if (featured) list.push(`${featured.name} is sold out today`);
  if (list.length < 3) list.push('Make the menu feel darker and more elegant');
  return list.slice(0, 3);
}

function lineHTML({ label, before, after }) {
  const value = (text, tag) => text ? `<${tag}>${e(text)}</${tag}>` : '<span class="none">—</span>';
  return `<li><span class="line-label">${e(label)}</span><span class="line-values">${value(before, 'del')}
    <span class="arrow" aria-hidden="true">→</span><span class="sr-only">becomes</span> ${value(after, 'ins')}</span></li>`;
}

function guessTitle(op, draft) {
  const all = [...draft.sections, ...draft.sections.flatMap((section) => section.items)];
  return op?.name || all.find((entry) => entry.id === op?.id)?.name || 'A change';
}

function changeHTML(change, current) {
  const { proposal } = S;
  if (!change.ok) {
    const op = proposal.ops[change.index];
    return `<li class="change is-failed"><div class="change-head"><span class="kind">${kinds[op?.op?.split('_')[0]] ?? 'Skip'}</span>
      <span class="change-title"><strong>${e(guessTitle(op, S.state.draft))}</strong></span></div>
      <p class="change-error">Can’t be applied: ${e(change.error)}</p></li>`;
  }
  const ticked = proposal.ticked.has(change.index);
  const stuck = ticked && current && !current.ok;
  return `<li class="change kind-${change.kind}${ticked ? '' : ' is-off'}">
    <label class="change-head"><input type="checkbox" data-change="${change.index}" ${ticked ? 'checked' : ''}>
      <span class="kind">${kinds[change.kind]}</span>
      <span class="change-title"><strong>${e(change.title)}</strong>${change.where ? `<span class="where">${e(change.where)}</span>` : ''}</span></label>
    ${change.lines.length ? `<ul class="lines">${change.lines.map(lineHTML).join('')}</ul>` : ''}
    ${stuck ? `<p class="change-error">Needs a change you unticked: ${e(current.error)}</p>` : ''}</li>`;
}

const count = () => S.proposal.current.filter((change) => change.ok).length;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function feedHTML() {
  const asked = (message) => `<p class="asked"><span class="sr-only">You asked: </span>${e(message)}</p>`;
  if (working) return `<div class="assistant-card is-working">${asked(working)}<p class="thinking">Reading your menu<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p></div>`;
  const { proposal } = S;
  if (proposal) {
    const n = count();
    const valid = proposal.full.filter((change) => change.ok).length;
    return `<div class="assistant-card proposal">${asked(proposal.message)}
      <p class="reply" id="proposal-reply" tabindex="-1">${e(proposal.reply || 'Here is what I would change.')}</p>
      <p class="proposal-hint">${valid > 1 ? `${plural(valid, 'change')}. Untick anything you don’t want. The preview shows the result.` : 'The preview shows the result.'}</p>
      <ul class="changes">${proposal.full.map((change) => changeHTML(change, proposal.current[change.index])).join('')}</ul>
      <div class="proposal-actions"><button class="btn primary" data-do="apply-proposal" ${n ? '' : 'disabled'}>Apply ${plural(n, 'change')}</button>
        <button class="btn" data-do="discard-proposal">Discard</button></div></div>`;
  }
  if (answer) return `<div class="assistant-card">${asked(answer.message)}<p class="reply" tabindex="-1">${e(answer.reply)}</p>
    <div class="proposal-actions"><button class="btn quiet" data-do="dismiss-answer">OK</button></div></div>`;
  return '';
}

export function renderAssistant() {
  const feed = document.querySelector('#assistant-feed');
  if (!feed || !S.state) return;
  feed.innerHTML = feedHTML();
  const field = document.querySelector('#ask');
  const idle = !working && !S.proposal && !field.value.trim();
  document.querySelector('#examples').innerHTML = idle ? `<span class="examples-label">Try</span>${examples(S.state.draft).map((text) =>
    `<button type="button" class="example" data-do="example">${e(text)}</button>`).join('')}` : '';
  document.querySelector('#composer-note').innerHTML = failure ? `<span class="is-error">${e(failure)}</span>` :
    working ? 'Working on it…' : listening ? '<span class="is-listening">Listening… tap the microphone again to stop.</span>' : e(note);
  document.querySelector('.composer .send').disabled = Boolean(working);
  field.readOnly = Boolean(working);
  lock();
}

function lock() {
  const busy = Boolean(working || S.proposal);
  for (const element of document.querySelectorAll('.panel, #studio-actions')) {
    element.inert = busy;
    element.classList.toggle('is-held', busy);
  }
  document.querySelector('.workspace')?.classList.toggle('is-reviewing', Boolean(S.proposal));
}

function friendly(error) {
  if (error.status === 429) return 'You have reached today’s limit for the assistant. It will be back tomorrow.';
  if (error.status === 503) return 'The assistant is not switched on for this SmartMenu yet.';
  if (!error.status) return 'Could not reach SmartMenu. Check your connection and try again.';
  if (error.status === 404) return 'The assistant is not available yet.';
  return 'The assistant could not finish that. ' + error.message;
}

export async function ask(text) {
  const message = text.trim();
  if (!message || working || S.proposal) return;
  const problem = blocker();
  if (problem) {
    failure = 'Fix this first: ' + problem.message + '.';
    renderAssistant();
    return;
  }
  listening?.stop();
  S.viewing = null;
  working = message;
  failure = '';
  note = '';
  answer = null;
  S.render();
  try {
    const { reply = '', ops = [] } = await api('menus/' + S.state.id + '/agent', 'POST', { message, draft: S.state.draft, history: turns.slice(-6) });
    turns.push({ role: 'user', text: message }, { role: 'assistant', text: reply });
    document.querySelector('#ask').value = '';
    fit();
    if (ops.length) {
      const full = planOps(S.state.draft, ops).changes;
      S.proposal = { message, reply, ops, full, ticked: new Set(full.filter((change) => change.ok).map((change) => change.index)), view: 'after' };
      replan();
    } else answer = { message, reply: reply || 'I did not find anything to change.' };
  } catch (error) {
    failure = friendly(error);
  } finally {
    working = '';
    renderAssistant();
    sendPreview();
  }
  const focus = document.querySelector('#assistant-feed .reply');
  if (focus && !failure) {
    focus.focus({ preventScroll: true });
    focus.closest('.assistant-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else document.querySelector('#ask').focus();
}

function replan() {
  const { draft, changes } = planOps(S.state.draft, S.proposal.ops, { only: S.proposal.ticked });
  S.proposal.planned = draft;
  S.proposal.current = changes;
}

function tick(input) {
  const index = Number(input.dataset.change);
  S.proposal.ticked[input.checked ? 'add' : 'delete'](index);
  replan();
  renderAssistant();
  sendPreview();
  document.querySelector(`[data-change="${index}"]`)?.focus();
}

export function setView(view) {
  S.proposal.view = view;
  sendPreview();
}

export async function applyProposal() {
  const { proposal } = S;
  const n = count();
  if (!n) return;
  const before = structuredClone(S.state.draft);
  S.state.draft = normalize(proposal.planned);
  S.proposal = null;
  edited({ source: 'agent', summary: proposal.message });
  S.render();
  renderAssistant();
  document.querySelector('#ask').focus();
  tell(`Applied ${plural(n, 'change')}.`, { label: 'Undo', run: () => undo(before) });
  await flush();
}

async function undo(before) {
  S.state.draft = before;
  edited({ source: 'manual', summary: 'Undid an assistant change' });
  S.render();
  renderAssistant();
  tell('Change undone.');
  await flush();
}

export function discardProposal() {
  S.proposal = null;
  renderAssistant();
  sendPreview();
  document.querySelector('#ask').focus();
}

export function dismissAnswer() {
  answer = null;
  renderAssistant();
  document.querySelector('#ask').focus();
}

export function fit() {
  const field = document.querySelector('#ask');
  if (!field) return;
  field.style.height = 'auto';
  field.style.height = Math.min(field.scrollHeight + 2, 160) + 'px';
}

function typed() {
  fit();
  const idle = !working && !S.proposal && !document.querySelector('#ask').value.trim();
  if (failure || idle !== Boolean(document.querySelector('#examples').childElementCount)) {
    failure = '';
    renderAssistant();
  }
}

document.addEventListener('submit', (event) => {
  if (event.target.dataset.form !== 'ask') return;
  event.preventDefault();
  ask(event.target.elements.message.value);
});

document.addEventListener('keydown', (event) => {
  if (event.target.id !== 'ask' || event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  event.target.form.requestSubmit();
});

document.addEventListener('input', ({ target }) => {
  if (target.id === 'ask') typed();
  else if (target.matches('[data-change]')) tick(target);
});

export function toggleMic() {
  if (listening) { listening.stop(); return; }
  if (!Recognition || working) return;
  const field = document.querySelector('#ask');
  const button = document.querySelector('[data-do="mic"]');
  const base = field.value.trim() ? field.value.trimEnd() + ' ' : '';
  const recognition = new Recognition();
  recognition.lang = navigator.language || 'en';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    field.value = base + Array.from(event.results, (result) => result[0].transcript).join('');
    fit();
  };
  recognition.onerror = (event) => {
    note = ['not-allowed', 'service-not-allowed'].includes(event.error) ? 'Microphone access is blocked. You can allow it in the browser settings, or type instead.' :
      event.error === 'no-speech' ? 'I did not hear anything. Tap the microphone and try again.' :
      event.error === 'aborted' ? '' : 'Dictation stopped. You can type instead.';
  };
  recognition.onend = () => {
    listening = null;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Dictate');
    renderAssistant();
    field.focus();
  };
  failure = '';
  note = '';
  listening = recognition;
  recognition.start();
  button.setAttribute('aria-pressed', 'true');
  button.setAttribute('aria-label', 'Stop dictating');
  renderAssistant();
}
