import test from 'node:test';
import assert from 'node:assert/strict';
import { clip, collapses, isAdmin, maxRecord, saveMeta, tokensOf } from '../src/records.js';
import { lookOf, photoPrompt } from '../src/ai.js';
import { usageTotals } from '../src/admin.js';

const minute = 60000;
const latest = { id: 'r1', account_id: 'a', source: 'manual', published: 0, started_at: 0 };
const save = { account: 'a', source: 'manual', published: false, at: 9 * minute };

test('manual saves collapse within ten minutes of the same account', () => {
  assert.equal(collapses(latest, save), true);
  assert.equal(collapses(latest, { ...save, at: 10 * minute }), false);
  assert.equal(collapses(latest, { ...save, account: 'b' }), false);
  assert.equal(collapses(latest, { ...save, source: 'agent' }), false);
  assert.equal(collapses(latest, { ...save, published: true }), false);
  assert.equal(collapses({ ...latest, source: 'restore' }, save), false);
  assert.equal(collapses({ ...latest, published: 1 }, save), false);
  assert.equal(collapses(null, save), false);
});

test('save source and summary are checked', () => {
  assert.deepEqual(saveMeta({}), { source: 'manual', summary: '' });
  assert.deepEqual(saveMeta({ source: 'agent', summary: ' Raised desserts ' }), { source: 'agent', summary: 'Raised desserts' });
  assert.throws(() => saveMeta({ source: 'restore' }));
  assert.throws(() => saveMeta({ summary: 'x'.repeat(201) }));
});

test('token counts are read from every usage shape', () => {
  assert.deepEqual(tokensOf({ input_tokens: 10, output_tokens: 4, input_tokens_details: { cached_tokens: 8 }, output_tokens_details: { reasoning_tokens: 2 } }),
    { input: 10, output: 4, cached: 8, reasoning: 2, audioInput: null, audioOutput: null });
  assert.deepEqual(tokensOf({ prompt_tokens: 3, completion_tokens: 1 }), { input: 3, output: 1, cached: null, reasoning: null, audioInput: null, audioOutput: null });
  assert.deepEqual(tokensOf({ input_tokens: 900, output_tokens: 60, input_token_details: { text_tokens: 700, audio_tokens: 200, cached_tokens: 512 }, output_token_details: { text_tokens: 60, audio_tokens: 0 } }),
    { input: 900, output: 60, cached: 512, reasoning: null, audioInput: 200, audioOutput: 0 });
  assert.deepEqual(tokensOf({ type: 'duration', seconds: 4.2 }), { input: null, output: null, cached: null, reasoning: null, audioInput: null, audioOutput: null });
  assert.equal(tokensOf(null).input, null);
});

test('stored requests and responses are compact text without images', () => {
  assert.equal(clip(null), null);
  assert.equal(clip('Raise desserts'), 'Raise desserts');
  assert.equal(clip({ reply: 'ok', ops: [] }), '{"reply":"ok","ops":[]}');
  assert.equal(clip('see data:image/png;base64,iVBORw0KGgo= now'), 'see [image] now');
  assert.equal(clip({ image_url: 'data:image/webp;base64,AAAA' }), '{"image_url":"[image]"}');
  const long = clip('x'.repeat(40000));
  assert.equal(long.length, maxRecord);
  assert.equal(maxRecord, 16000);
  assert.ok(long.endsWith('…'));
  assert.equal(clip('y'.repeat(16000)).length, 16000);
});

test('usage totals add up overall and per feature', () => {
  const rows = [
    { feature: 'assistant', calls: 2, failed: 0, inputTokens: 100, outputTokens: 10, costMicros: 150, unpricedCalls: 0 },
    { feature: 'assistant', calls: 1, failed: 1, inputTokens: 50, outputTokens: 0, costMicros: 20, unpricedCalls: 1 },
    { feature: 'voice', calls: 3, failed: 0, inputTokens: 900, outputTokens: 40, audioInputTokens: 600, costMicros: 7000, unpricedCalls: 0 }
  ];
  const { all, features } = usageTotals(rows);
  assert.deepEqual([all.calls, all.failed, all.inputTokens, all.audioInputTokens, all.costMicros, all.unpricedCalls], [6, 1, 1050, 600, 7170, 1]);
  assert.deepEqual([features.assistant.calls, features.assistant.costMicros, features.voice.audioInputTokens], [3, 170, 600]);
  assert.equal(usageTotals([]).all.costMicros, 0);
});

test('admin emails come from a comma-separated list', () => {
  assert.equal(isAdmin({ ADMIN_EMAILS: '' }, 'a@b.co'), false);
  assert.equal(isAdmin({}, 'a@b.co'), false);
  assert.equal(isAdmin({ ADMIN_EMAILS: ' A@b.co , c@d.co' }, 'a@b.co'), true);
});

test('looks accept the old background values and build the plan prompt', () => {
  assert.deepEqual(['natural', 'moody', 'studio', 'transparent', 'nope'].map(lookOf), ['natural', 'moody', 'natural', 'cutout', null]);
  const prompt = photoPrompt('moody');
  assert.match(prompt, /^Retouch this photograph of a real restaurant dish\./);
  assert.match(prompt, /Low directional light from one side\./);
  assert.match(prompt, /taken by a professional with good light\.$/);
});
