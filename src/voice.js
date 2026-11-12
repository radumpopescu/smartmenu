import { RequestError } from './menu.js';
import { changesSchema } from '../public/studio/agent-view.js';
import { voiceInstructions } from './agent.js';
import { TRANSCRIBE_MODEL } from './models.js';
import { logCall, logEvent } from './records.js';

export const maxOffer = 20000;
export const callWindow = 20 * 60 * 1000;
export const maxReports = 300;
const query = (env, sql, ...params) => env.DB.prepare(sql).bind(...params);
const fail = (status, message) => { throw new RequestError(status, message); };

export const voiceEnabled = (env) => Boolean(env.OPENAI_API_KEY) && env.VOICE !== 'off';

export const voiceSession = (model) => ({
  type: 'realtime', model, instructions: voiceInstructions, output_modalities: ['text'],
  tools: [{
    type: 'function', name: 'propose_changes',
    description: 'Propose changes to the menu. The owner reviews them on screen before anything changes.',
    parameters: changesSchema
  }],
  tool_choice: 'auto', max_output_tokens: 4096,
  audio: { input: { transcription: { model: TRANSCRIBE_MODEL }, turn_detection: { type: 'semantic_vad' } } }
});

export function sdpOffer(type, text) {
  if (!/^application\/sdp\b/i.test(type ?? '')) fail(415, 'Send the voice offer as application/sdp.');
  if (text.length > maxOffer || !/^v=0\r?\n/.test(text) || !/^m=audio /m.test(text)) fail(400, 'The voice offer is not valid.');
  return text;
}

export const callIdOf = (location) => location?.match(/([A-Za-z0-9_-]{1,100})\/?$/)?.[1] ?? null;

export async function startVoice(env, meta, provider, offer) {
  const form = new FormData();
  form.set('sdp', offer);
  form.set('session', JSON.stringify(voiceSession(provider.model)));
  let response;
  try {
    response = await fetch(provider.base + '/realtime/calls', {
      method: 'POST', headers: { Authorization: `Bearer ${provider.key}` }, body: form, signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    console.error('Voice call failed', error.message);
  }
  const call = response?.ok ? callIdOf(response.headers.get('Location')) : null;
  const answer = call ? await response.text() : '';
  if (!call || !answer.startsWith('v=')) {
    console.error('Voice call refused', response?.status, response?.headers.get('x-request-id'));
    await logEvent(env, meta.account, meta.menu, 'voice_failed', { status: response?.status ?? null, model: provider.model });
    fail(502, 'Voice could not start. Try again later.');
  }
  await query(env, 'INSERT INTO voice_calls (id, account_id, menu_id, model, created_at) VALUES (?, ?, ?, ?, ?)',
    call, meta.account, meta.menu, provider.model, Date.now()).run();
  await logEvent(env, meta.account, meta.menu, 'voice_started', { call, model: provider.model });
  return new Response(answer, { headers: {
    'Content-Type': 'application/sdp', 'Cache-Control': 'no-store', 'X-Voice-Call': call, 'X-Voice-Model': provider.model
  } });
}

const int = 'int';
const tokenShape = {
  total_tokens: int, input_tokens: int, output_tokens: int,
  input_token_details: { text_tokens: int, audio_tokens: int, image_tokens: int, cached_tokens: int,
    cached_tokens_details: { text_tokens: int, audio_tokens: int, image_tokens: int } },
  output_token_details: { text_tokens: int, audio_tokens: int }
};
const shapes = {
  response: tokenShape,
  transcription: { type: ['tokens', 'duration'], seconds: 'seconds', ...tokenShape }
};

function pick(value, shape) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result = {};
  for (const [key, rule] of Object.entries(shape)) {
    const entry = value[key];
    const kept = rule === int ? (Number.isInteger(entry) && entry >= 0 && entry <= 1e8 ? entry : undefined) :
      rule === 'seconds' ? (Number.isFinite(entry) && entry >= 0 && entry <= 3600 ? entry : undefined) :
      Array.isArray(rule) ? (rule.includes(entry) ? entry : undefined) : pick(entry, rule);
    if (kept !== undefined) result[key] = kept;
  }
  return result;
}

const textOf = (value, max, label) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) fail(400, `Check ${label}.`);
  return value.trim();
};

export function usageInput(input) {
  const { call, kind, usage } = input ?? {};
  if (typeof call !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(call)) fail(400, 'Check the voice call.');
  if (!Object.hasOwn(shapes, kind)) fail(400, 'Check the usage kind.');
  if (JSON.stringify(usage ?? null).length > 4000) fail(413, 'The usage report is too large.');
  const picked = pick(usage, shapes[kind]);
  if (!picked || !Object.keys(picked).length) fail(400, 'Check the usage.');
  const ops = input.ops ?? [];
  if (!Array.isArray(ops) || ops.length > 300 || JSON.stringify(ops).length > 16000) fail(400, 'Check the proposed changes.');
  return { call, kind, usage: picked, heard: textOf(input.heard, 4000, 'the transcript'), reply: textOf(input.reply, 2000, 'the reply'), ops };
}

export async function recordVoiceUsage(env, meta, input) {
  const { call, kind, usage, heard, reply, ops } = usageInput(input);
  const at = Date.now();
  const row = await query(env, `UPDATE voice_calls SET reports = reports + 1
    WHERE id = ? AND account_id = ? AND menu_id = ? AND created_at > ? AND reports < ? RETURNING model`,
    call, meta.account, meta.menu, at - callWindow, maxReports).first();
  if (!row) {
    const known = await query(env, 'SELECT reports FROM voice_calls WHERE id = ? AND account_id = ? AND menu_id = ? AND created_at > ?',
      call, meta.account, meta.menu, at - callWindow).first();
    fail(known ? 429 : 404, known ? 'This voice session has reported too often.' : 'Voice session not found.');
  }
  const response = kind === 'response';
  await logCall(env, { ...meta, feature: response ? 'voice' : 'voice_transcript', callRef: call }, {
    provider: 'openai', model: response ? row.model : TRANSCRIBE_MODEL, status: 'ok',
    usage: { ...usage, client_reported: true }, duration: 0, error: null,
    request: response ? heard || null : null, response: response ? { reply, ops } : heard || null
  });
  return { recorded: true };
}
