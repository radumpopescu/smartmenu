import test from 'node:test';
import assert from 'node:assert/strict';
import { collapses, isAdmin, saveMeta, tokensOf } from '../src/records.js';
import { imageProvider, lookOf, photoPrompt, textProvider } from '../src/ai.js';

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

test('token counts are read from either usage shape', () => {
  assert.deepEqual(tokensOf({ input_tokens: 10, output_tokens: 4, input_tokens_details: { cached_tokens: 8 }, output_tokens_details: { reasoning_tokens: 2 } }),
    { input: 10, output: 4, cached: 8, reasoning: 2 });
  assert.deepEqual(tokensOf({ prompt_tokens: 3, completion_tokens: 1 }), { input: 3, output: 1, cached: null, reasoning: null });
  assert.deepEqual(tokensOf(null), { input: null, output: null, cached: null, reasoning: null });
});

test('admin emails come from a comma-separated list', () => {
  assert.equal(isAdmin({ ADMIN_EMAILS: '' }, 'a@b.co'), false);
  assert.equal(isAdmin({}, 'a@b.co'), false);
  assert.equal(isAdmin({ ADMIN_EMAILS: ' A@b.co , c@d.co' }, 'a@b.co'), true);
});

test('text goes to xAI first, then OpenAI, else nowhere', () => {
  const vars = { XAI_MODEL: 'grok-text', XAI_VISION_MODEL: 'grok-vision', OPENAI_MODEL: 'gpt-text', VISION_MODEL: 'gpt-vision' };
  const both = textProvider({ ...vars, XAI_API_KEY: 'x', OPENAI_API_KEY: 'o' });
  assert.deepEqual([both.name, both.base, both.model, both.vision], ['xai', 'https://api.x.ai/v1', 'grok-text', 'grok-vision']);
  assert.equal(textProvider({ ...vars, XAI_API_KEY: 'x', XAI_BASE_URL: 'http://localhost:8789/v1' }).base, 'http://localhost:8789/v1');
  assert.deepEqual(Object.values(textProvider({ ...vars, OPENAI_API_KEY: 'o' })).slice(0, 4), ['openai', 'https://api.openai.com/v1', 'o', 'gpt-text']);
  assert.equal(textProvider(vars), null);
});

test('photo edits use OpenAI unless IMAGE_PROVIDER is xai', () => {
  const keys = { XAI_API_KEY: 'x', OPENAI_API_KEY: 'o', IMAGE_MODEL: 'gpt-image', XAI_IMAGE_MODEL: 'grok-image' };
  assert.equal(imageProvider(keys).model, 'gpt-image');
  const xai = imageProvider({ ...keys, IMAGE_PROVIDER: 'xai' });
  assert.equal(xai.model, 'grok-image');
  assert.equal(xai.looks.includes('cutout'), false);
  assert.equal(imageProvider({ IMAGE_PROVIDER: 'xai', OPENAI_API_KEY: 'o' }), null);
  assert.equal(imageProvider({ XAI_API_KEY: 'x' }), null);
});

test('looks accept the old background values and build the plan prompt', () => {
  assert.deepEqual(['natural', 'moody', 'studio', 'transparent', 'nope'].map(lookOf), ['natural', 'moody', 'natural', 'cutout', null]);
  const prompt = photoPrompt('moody');
  assert.match(prompt, /^Retouch this photograph of a real restaurant dish\./);
  assert.match(prompt, /Low directional light from one side\./);
  assert.match(prompt, /taken by a professional with good light\.$/);
});
