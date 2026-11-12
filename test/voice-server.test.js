import test from 'node:test';
import assert from 'node:assert/strict';
import { callIdOf, recordVoiceUsage, sdpOffer, startVoice, usageInput, voiceEnabled, voiceSession } from '../src/voice.js';
import { changesSchema } from '../public/studio/agent-view.js';
import { voiceInstructions } from '../src/agent.js';
import { connect } from '../src/ai.js';

const offer = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';

test('the session asks for text output, transcription and one propose_changes tool', () => {
  const session = voiceSession('gpt-realtime-2.1-mini');
  assert.deepEqual(Object.keys(session).sort(), ['audio', 'instructions', 'max_output_tokens', 'model', 'output_modalities', 'tool_choice', 'tools', 'type']);
  assert.equal(session.type, 'realtime');
  assert.equal(session.model, 'gpt-realtime-2.1-mini');
  assert.deepEqual(session.output_modalities, ['text']);
  assert.equal(session.instructions, voiceInstructions);
  assert.equal(session.tool_choice, 'auto');
  assert.equal(session.max_output_tokens, 4096);
  assert.equal(session.tools.length, 1);
  assert.deepEqual({ ...session.tools[0], description: undefined }, { type: 'function', name: 'propose_changes', description: undefined, parameters: changesSchema });
  assert.deepEqual(session.audio, { input: { transcription: { model: 'gpt-transcribe' }, turn_detection: { type: 'semantic_vad' } } });
});

test('offers must be bounded SDP with audio', () => {
  assert.equal(sdpOffer('application/sdp', offer), offer);
  assert.throws(() => sdpOffer('application/json', offer), (error) => error.status === 415);
  assert.throws(() => sdpOffer('application/sdp', 'hello'), (error) => error.status === 400);
  assert.throws(() => sdpOffer('application/sdp', 'v=0\r\ns=-\r\n'), (error) => error.status === 400);
  assert.throws(() => sdpOffer('application/sdp', offer + 'a=x\r\n'.repeat(5000)), (error) => error.status === 400);
});

test('the call id is the last segment of Location', () => {
  assert.equal(callIdOf('/v1/realtime/calls/rtc_u1_9c6574da8b8a41a18da9308f4ad974ce'), 'rtc_u1_9c6574da8b8a41a18da9308f4ad974ce');
  assert.equal(callIdOf('https://api.openai.com/v1/realtime/calls/rtc_abc'), 'rtc_abc');
  assert.equal(callIdOf(null), null);
  assert.equal(callIdOf('/calls/a b'), 'b');
});

test('voice is on with an OpenAI key unless switched off', () => {
  assert.equal(voiceEnabled({ OPENAI_API_KEY: 'o' }), true);
  assert.equal(voiceEnabled({ OPENAI_API_KEY: 'o', VOICE: 'off' }), false);
  assert.equal(voiceEnabled({ XAI_API_KEY: 'x' }), false);
});

test('usage reports keep only known numeric fields', () => {
  const input = usageInput({
    call: 'rtc_1', kind: 'response', heard: ' raise desserts ', reply: 'Raising them.', ops: [{ op: 'remove_dish', id: 'x' }],
    usage: { total_tokens: 30, input_tokens: 20, output_tokens: 10, extra: 'drop', input_token_details: { text_tokens: 15, audio_tokens: -1, cached_tokens: 'x' }, output_token_details: { text_tokens: 10 } }
  });
  assert.deepEqual(input.usage, { total_tokens: 30, input_tokens: 20, output_tokens: 10, input_token_details: { text_tokens: 15 }, output_token_details: { text_tokens: 10 } });
  assert.equal(input.heard, 'raise desserts');
  assert.deepEqual(usageInput({ call: 'rtc_1', kind: 'transcription', usage: { type: 'duration', seconds: 2.5 } }).usage, { type: 'duration', seconds: 2.5 });
  assert.throws(() => usageInput({ call: 'rtc 1', kind: 'response', usage: { input_tokens: 1 } }), /voice call/);
  assert.throws(() => usageInput({ call: 'rtc_1', kind: 'audio', usage: { input_tokens: 1 } }), /usage kind/);
  assert.throws(() => usageInput({ call: 'rtc_1', kind: 'response', usage: { nothing: 1 } }), /Check the usage/);
  assert.throws(() => usageInput({ call: 'rtc_1', kind: 'response', usage: [1] }), /Check the usage/);
  assert.throws(() => usageInput({ call: 'rtc_1', kind: 'response', usage: { input_tokens: 1, pad: 'x'.repeat(5000) } }), (error) => error.status === 413);
  assert.throws(() => usageInput({ call: 'rtc_1', kind: 'response', usage: { input_tokens: 1 }, heard: 'x'.repeat(4001) }), /transcript/);
  assert.throws(() => usageInput({ call: 'rtc_1', kind: 'response', usage: { input_tokens: 1 }, ops: Array(301).fill({}) }), /proposed changes/);
});

function database(voiceRow) {
  const statements = [];
  const DB = { prepare: (sql) => ({ bind: (...params) => {
    statements.push({ sql, params });
    return { run: async () => ({ meta: { changes: 1 } }), first: async () => sql.startsWith('UPDATE voice_calls') ? voiceRow?.update ?? null : voiceRow?.known ?? null };
  } }) };
  return { DB, statements };
}

test('a usage report for a known call writes a client-reported, costed record', async () => {
  const { DB, statements } = database({ update: { model: 'gpt-realtime-2.1-mini' } });
  const usage = { input_tokens: 900, output_tokens: 50, input_token_details: { text_tokens: 700, audio_tokens: 200, cached_tokens: 0 }, output_token_details: { text_tokens: 50, audio_tokens: 0 } };
  assert.deepEqual(await recordVoiceUsage({ DB }, { account: 'a', menu: 'm' }, { call: 'rtc_1', kind: 'response', usage, heard: 'cheaper desserts', reply: 'Lowering.', ops: [] }), { recorded: true });
  const [check, insert] = statements;
  assert.deepEqual(check.params.slice(0, 3), ['rtc_1', 'a', 'm']);
  const p = insert.params;
  assert.deepEqual([p[3], p[4], p[5], p[6], p[7], p[8], p[15]], ['voice', 'openai', 'gpt-realtime-2.1-mini', 'ok', 900, 50, 200]);
  assert.equal(JSON.parse(p[11]).client_reported, true);
  assert.equal(p[14], Math.round(700 * 0.6 + 200 * 10 + 50 * 2.4));
  assert.deepEqual([p[17], JSON.parse(p[18]), p[19]], ['cheaper desserts', { reply: 'Lowering.', ops: [] }, 'rtc_1']);

  const transcript = database({ update: { model: 'gpt-realtime-2.1' } });
  await recordVoiceUsage({ DB: transcript.DB }, { account: 'a', menu: 'm' }, { call: 'rtc_1', kind: 'transcription', usage: { type: 'duration', seconds: 60 }, heard: 'cheaper desserts' });
  const t = transcript.statements[1].params;
  assert.deepEqual([t[3], t[5], t[14], t[17], t[18]], ['voice_transcript', 'gpt-transcribe', 4500, null, 'cheaper desserts']);
});

test('a usage report for an unknown, foreign or exhausted call is refused', async () => {
  const report = { call: 'rtc_1', kind: 'response', usage: { input_tokens: 1, output_tokens: 1 } };
  const foreign = database(null);
  await assert.rejects(recordVoiceUsage({ DB: foreign.DB }, { account: 'b', menu: 'm' }, report), (error) => error.status === 404);
  assert.equal(foreign.statements.some((statement) => statement.sql.includes('ai_calls')), false);
  const exhausted = database({ known: { reports: 300 } });
  await assert.rejects(recordVoiceUsage({ DB: exhausted.DB }, { account: 'a', menu: 'm' }, report), (error) => error.status === 429);
});

test('starting a call forwards the offer as multipart and returns the answer with the call headers', async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response('v=0\r\nanswer\r\n', { status: 201, headers: { Location: '/v1/realtime/calls/rtc_test123' } });
  };
  const { DB, statements } = database();
  const env = { DB, OPENAI_API_KEY: 'o', OPENAI_BASE_URL: 'http://stub/v1' };
  const response = await startVoice(env, { account: 'a', menu: 'm' }, connect(env, { provider: 'openai', model: 'gpt-realtime-2.1-mini' }), offer);
  assert.equal(requests[0].url, 'http://stub/v1/realtime/calls');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer o');
  assert.equal(requests[0].init.body.get('sdp'), offer);
  assert.equal(JSON.parse(requests[0].init.body.get('session')).model, 'gpt-realtime-2.1-mini');
  assert.equal(await response.text(), 'v=0\r\nanswer\r\n');
  assert.deepEqual([response.headers.get('X-Voice-Call'), response.headers.get('X-Voice-Model'), response.headers.get('Cache-Control'), response.headers.get('Content-Type')],
    ['rtc_test123', 'gpt-realtime-2.1-mini', 'no-store', 'application/sdp']);
  assert.deepEqual(statements[0].params.slice(0, 4), ['rtc_test123', 'a', 'm', 'gpt-realtime-2.1-mini']);

  globalThis.fetch = async () => new Response('{"error":{}}', { status: 400 });
  await assert.rejects(startVoice(env, { account: 'a', menu: 'm' }, connect(env, { provider: 'openai', model: 'gpt-realtime-2.1-mini' }), offer), (error) => error.status === 502);
});
