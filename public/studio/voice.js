import { menuView, toOps } from './agent-view.js';

export const limits = { idle: 60000, total: 600000, hidden: 20000, resend: 2000 };
export const shownOutput = 'Shown to the owner for review.';
const fatal = /session|expired|quota|api_key|unauthorized/i;

export const initial = (at = 0) => ({
  phase: 'connecting', call: '', model: '', startedAt: at, lastSpeech: at, menuText: '', handles: new Map(),
  items: {}, turn: [], turnDone: false, reply: '', reviewing: false, fromVoice: false, waitingHeard: false, last: null, ended: ''
});

export const heardOf = (state) => state.turn.map((id) => state.items[id] ?? '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
const send = (event) => ({ type: 'send', event });
const userText = (text) => send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
const output = (call, text) => send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call, output: text } });

function withMenu(state, draft, force) {
  const { text, handles } = menuView(draft);
  if (!force && text === state.menuText) return { state, effects: [] };
  return { state: { ...state, menuText: text, handles }, effects: [userText('Menu:\n' + text)] };
}

export function parseChanges(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return { reply: typeof value.reply === 'string' ? value.reply.trim().slice(0, 2000) : '', ops: Array.isArray(value.ops) ? value.ops : [] };
}

function track(state, id) {
  if (!id) return state;
  const turn = state.turnDone ? [] : state.turn;
  return { ...state, turnDone: false, turn: turn.includes(id) ? turn : [...turn, id] };
}

function propose(state, event) {
  const heard = heardOf(state);
  if (event.name !== 'propose_changes') return { state, effects: [output(event.call_id, 'Unknown function.')] };
  if (state.reviewing) {
    return { state, effects: [output(event.call_id, 'Not shown: the owner is still reviewing earlier changes.')] };
  }
  const parsed = parseChanges(event.arguments);
  if (!parsed) {
    return {
      state: { ...state, last: { heard, reply: '', ops: [] } },
      effects: [output(event.call_id, 'The changes could not be read, so nothing was shown.'),
        { type: 'notice', text: 'I could not make sense of that. Try saying it again.' }]
    };
  }
  const ops = toOps(parsed, state.handles);
  const last = { heard, reply: parsed.reply, ops };
  if (!ops.length) {
    return {
      state: { ...state, last },
      effects: [output(event.call_id, 'No valid changes, so nothing was shown.'),
        { type: 'answer', heard, reply: parsed.reply || 'I could not turn that into changes to this menu.' }]
    };
  }
  return {
    state: { ...state, last, phase: 'reviewing', reviewing: true, fromVoice: true, waitingHeard: !heard },
    effects: [{ type: 'proposal', heard, reply: parsed.reply, ops }, { type: 'mic', on: false }, output(event.call_id, shownOutput)]
  };
}

export function step(state, event) {
  const at = event.at ?? state.lastSpeech;
  const none = { state, effects: [] };
  if (state.phase === 'ended') return none;
  switch (event.type) {
    case 'local.connected':
      return { state: { ...state, call: event.call ?? '', model: event.model ?? '' }, effects: [] };
    case 'local.open': {
      const result = withMenu(state, event.draft, true);
      return { state: { ...result.state, phase: state.reviewing ? 'reviewing' : 'listening', lastSpeech: at }, effects: result.effects };
    }
    case 'local.menu':
      return state.phase === 'connecting' ? none : withMenu(state, event.draft, false);
    case 'local.review':
      return state.reviewing ? none : { state: { ...state, reviewing: true, fromVoice: false, phase: 'reviewing' }, effects: [{ type: 'mic', on: false }] };
    case 'local.resolved': {
      if (!state.reviewing) return none;
      const note = !state.fromVoice ? [] : event.applied ? [userText(`The owner applied ${event.applied} of ${event.total} changes.`)] : [userText('The owner discarded the changes.')];
      const menu = withMenu(state, event.draft, state.fromVoice);
      return {
        state: { ...menu.state, reviewing: false, fromVoice: false, waitingHeard: false, phase: 'listening', lastSpeech: at },
        effects: [...note, ...menu.effects, { type: 'mic', on: true }]
      };
    }
    case 'local.tick':
      if (at - state.startedAt >= limits.total) return step(state, { type: 'local.end', reason: 'limit' });
      if (!state.reviewing && state.phase === 'listening' && at - state.lastSpeech >= limits.idle) return step(state, { type: 'local.end', reason: 'idle' });
      return none;
    case 'local.end':
      return { state: { ...state, phase: 'ended', ended: event.reason ?? 'stopped' }, effects: [{ type: 'close' }] };
    case 'input_audio_buffer.speech_started':
      if (state.reviewing) return none;
      return { state: { ...track(state, event.item_id), phase: 'hearing', lastSpeech: at }, effects: [] };
    case 'input_audio_buffer.speech_stopped':
      if (state.reviewing) return none;
      return { state: { ...track(state, event.item_id), phase: 'thinking', lastSpeech: at }, effects: [] };
    case 'conversation.item.input_audio_transcription.delta': {
      const next = track(state, event.item_id);
      return { state: { ...next, items: { ...next.items, [event.item_id]: (next.items[event.item_id] ?? '') + (event.delta ?? '') } }, effects: [] };
    }
    case 'conversation.item.input_audio_transcription.completed': {
      const known = state.turn.includes(event.item_id);
      const next = known || state.turnDone ? state : track(state, event.item_id);
      const items = { ...next.items, [event.item_id]: typeof event.transcript === 'string' ? event.transcript.trim() : next.items[event.item_id] ?? '' };
      const updated = { ...next, items };
      const heard = String(items[event.item_id] ?? '').slice(0, 4000);
      const effects = [];
      if (event.usage && state.call) effects.push({ type: 'usage', body: { call: state.call, kind: 'transcription', usage: event.usage, heard } });
      if (state.waitingHeard && heardOf(updated)) {
        effects.push({ type: 'heard', text: heardOf(updated) });
        return { state: { ...updated, waitingHeard: false }, effects };
      }
      return { state: updated, effects };
    }
    case 'response.created':
      return { state: { ...state, reply: '', last: null, turn: state.turnDone ? [] : state.turn, turnDone: false, phase: state.reviewing ? 'reviewing' : 'thinking' }, effects: [] };
    case 'response.output_text.delta':
      return { state: { ...state, reply: state.reply + (event.delta ?? '') }, effects: [] };
    case 'response.output_text.done': {
      const reply = (typeof event.text === 'string' ? event.text : state.reply).trim();
      const heard = heardOf(state);
      return { state: { ...state, reply, last: { heard, reply, ops: [] } }, effects: reply ? [{ type: 'answer', heard, reply }] : [] };
    }
    case 'response.function_call_arguments.done':
      return propose(state, event);
    case 'response.done': {
      const response = event.response ?? {};
      const last = state.last ?? { heard: heardOf(state), reply: state.reply, ops: [] };
      const effects = [];
      if (response.usage && state.call) effects.push({ type: 'usage', body: { call: state.call, kind: 'response', usage: response.usage, ...last } });
      if (response.status === 'failed') effects.push({ type: 'notice', text: 'The assistant could not finish that. Try saying it again.' });
      return { state: { ...state, turnDone: true, last: null, phase: state.reviewing ? 'reviewing' : 'listening', lastSpeech: at }, effects };
    }
    case 'error': {
      const error = event.error ?? {};
      if (fatal.test(`${error.code ?? ''} ${error.type ?? ''}`)) {
        const ended = step(state, { type: 'local.end', reason: 'error' });
        return { state: ended.state, effects: [{ type: 'notice', text: 'Voice stopped because of a problem with the connection. Tap the microphone to try again.' }, ...ended.effects] };
      }
      return { state, effects: [{ type: 'notice', text: 'Something went wrong with that request. Try saying it again.' }] };
    }
    default:
      return none;
  }
}

export const endings = {
  stopped: 'Voice is off.',
  idle: 'Voice turned off after a minute without speech.',
  limit: 'Voice turned off after 10 minutes. Tap the microphone to keep going.',
  hidden: 'Voice turned off while the page was in the background.',
  dropped: 'The voice connection dropped. Tap the microphone to try again.',
  error: 'Voice stopped because of a problem with the connection.'
};

function startError(error) {
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Microphone access is blocked. You can allow it in the browser settings, or type instead.';
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No microphone was found. You can type instead.';
  if (error.name === 'NotReadableError') return 'The microphone is in use by another app. Close it and try again.';
  return 'The microphone could not start. You can type instead.';
}

let session = null;

export const voiceOn = () => Boolean(session);
export const voiceState = () => session?.state ?? null;

export function voiceEvent(event) {
  if (session) dispatch(session, { at: Date.now(), ...event });
}

export function voiceMenuChanged() {
  if (!session) return;
  const current = session;
  clearTimeout(current.resend);
  current.resend = setTimeout(() => dispatch(current, { type: 'local.menu', at: Date.now(), draft: current.hooks.draft() }), limits.resend);
}

export function endVoice(reason = 'stopped') {
  if (session) dispatch(session, { type: 'local.end', reason, at: Date.now() });
}

function dispatch(current, event) {
  if (session !== current) return;
  const result = step(current.state, event);
  current.state = result.state;
  for (const effect of result.effects) run(current, effect);
  current.hooks.change(current.state);
}

function run(current, effect) {
  const { hooks } = current;
  if (effect.type === 'send') {
    if (current.channel?.readyState === 'open') current.channel.send(JSON.stringify(effect.event));
  } else if (effect.type === 'mic') {
    for (const track of current.stream?.getAudioTracks() ?? []) track.enabled = effect.on;
  } else if (effect.type === 'usage') {
    fetch(`/api/menus/${current.menuId}/voice/usage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(effect.body), keepalive: true })
      .then((response) => { if (!response.ok) console.warn('Voice usage was not recorded', response.status); })
      .catch((error) => console.warn('Voice usage was not recorded', error));
  } else if (effect.type === 'close') {
    teardown(current);
    hooks.ended(endings[current.state.ended] ?? endings.stopped, current.state.ended);
  } else hooks[effect.type]?.(effect);
}

function teardown(current) {
  if (session === current) session = null;
  clearInterval(current.clock);
  clearTimeout(current.resend);
  clearTimeout(current.away);
  cancelAnimationFrame(current.frame);
  removeEventListener('pagehide', current.leave);
  document.removeEventListener('visibilitychange', current.visibility);
  for (const track of current.stream?.getTracks() ?? []) track.stop();
  current.audio?.close().catch(() => {});
  try { current.channel?.close(); } catch {}
  try { current.pc?.close(); } catch {}
}

function meter(current) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try {
    current.audio = new Context();
    const analyser = current.audio.createAnalyser();
    analyser.fftSize = 512;
    current.audio.createMediaStreamSource(current.stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let shown = 0;
    const tick = () => {
      if (session !== current) return;
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
      const live = current.state.phase === 'listening' || current.state.phase === 'hearing';
      const level = live ? Math.min(1, peak / 48) : 0;
      if (Math.abs(level - shown) > 0.04) {
        shown = level;
        current.hooks.level(level);
      }
      current.frame = requestAnimationFrame(tick);
    };
    tick();
  } catch (error) { console.warn('No microphone level meter', error); }
}

export async function startVoice(menuId, hooks) {
  if (session) return;
  const current = { menuId, hooks, state: initial(Date.now()) };
  session = current;
  hooks.change(current.state);
  const fail = (message) => {
    if (session !== current) return;
    teardown(current);
    current.state = { ...current.state, phase: 'ended', ended: 'failed' };
    hooks.ended(message, 'failed');
  };
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { fail('This browser cannot use voice. You can type instead.'); return; }
    try { current.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (error) { fail(startError(error)); return; }
    if (session !== current) { for (const track of current.stream.getTracks()) track.stop(); return; }
    for (const track of current.stream.getAudioTracks()) track.enabled = !current.state.reviewing;
    current.pc = new RTCPeerConnection();
    for (const track of current.stream.getAudioTracks()) current.pc.addTrack(track, current.stream);
    current.channel = current.pc.createDataChannel('oai-events');
    current.channel.addEventListener('open', () => dispatch(current, { type: 'local.open', at: Date.now(), draft: hooks.draft() }));
    current.channel.addEventListener('message', ({ data }) => {
      let event;
      try { event = JSON.parse(data); } catch { return; }
      if (event && typeof event.type === 'string') dispatch(current, { ...event, at: Date.now() });
    });
    current.channel.addEventListener('close', () => { if (session === current) endVoice('dropped'); });
    current.pc.addEventListener('connectionstatechange', () => {
      if (session === current && current.pc.connectionState === 'failed') endVoice('dropped');
    });
    const offer = await current.pc.createOffer();
    await current.pc.setLocalDescription(offer);
    if (session !== current) return;
    let response;
    try {
      response = await fetch(`/api/menus/${menuId}/voice`, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp });
    } catch { fail('Could not reach SmartMenu. Check your connection and try again.'); return; }
    if (!response.ok) {
      const { error } = await response.json().catch(() => ({}));
      fail(error || (response.status === 429 ? 'You have reached today’s limit for voice. It will be back tomorrow.' :
        response.status === 503 ? 'Voice is not switched on for this SmartMenu.' :
        response.status === 404 ? 'Voice is not available yet.' : 'Voice could not start. Try again.'));
      return;
    }
    const sdp = await response.text();
    if (session !== current) return;
    dispatch(current, { type: 'local.connected', at: Date.now(), call: response.headers.get('X-Voice-Call') ?? '', model: response.headers.get('X-Voice-Model') ?? '' });
    await current.pc.setRemoteDescription({ type: 'answer', sdp });
    current.clock = setInterval(() => dispatch(current, { type: 'local.tick', at: Date.now() }), 1000);
    current.leave = () => endVoice('stopped');
    current.visibility = () => {
      clearTimeout(current.away);
      if (document.hidden) current.away = setTimeout(() => endVoice('hidden'), limits.hidden);
    };
    addEventListener('pagehide', current.leave);
    document.addEventListener('visibilitychange', current.visibility);
    meter(current);
  } catch (error) {
    console.error(error);
    fail('Voice could not start. Try again, or type instead.');
  }
}
