import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, FEATURES, MODELS, costMicros, modelOf, serves } from '../src/models.js';
import { choose, missingKey, selected, settingInput, settingsView } from '../src/settings.js';

test('the catalog holds the plan prices', () => {
  const prices = (model) => MODELS.find((entry) => entry.model === model).prices;
  assert.deepEqual(prices('grok-4.20-non-reasoning'), { input: 1.25, cached: 0.2, output: 2.5 });
  assert.deepEqual(prices('grok-4.3'), { input: 1.25, cached: 0.2, output: 2.5 });
  assert.deepEqual(prices('gpt-6-luna'), { input: 0.1, cached: 0.01, output: 0.5 });
  assert.deepEqual(prices('gpt-6.1-terra'), { input: 1, cached: 0.05, output: 5 });
  assert.deepEqual(prices('gpt-6.1-sol'), { input: 2, cached: 0.1, output: 10 });
  assert.deepEqual(prices('gpt-6-astra'), { input: 10, cached: 1, output: 50 });
  assert.deepEqual(prices('gpt-realtime-2.1'), { textIn: 4, cachedTextIn: 0.4, textOut: 24, audioIn: 32, cachedAudioIn: 0.4, audioOut: 64, imageIn: 5, cachedImageIn: 0.5 });
  assert.deepEqual(prices('gpt-realtime-2.1-mini'), { textIn: 0.6, cachedTextIn: 0.06, textOut: 2.4, audioIn: 10, cachedAudioIn: 0.3, audioOut: 20, imageIn: 0.8, cachedImageIn: 0.08 });
  assert.deepEqual(prices('gpt-image-2.5-sunburst'), { textIn: 5, imageIn: 8, imageOut: 30 });
  assert.deepEqual(prices('grok-imagine-image-2.0'), { perImage: 0.04 });
  assert.deepEqual(prices('gpt-transcribe'), { perMinute: 0.0045 });
});

test('each feature lists the models that can serve it, and every default is in the catalog', () => {
  const served = (feature) => MODELS.filter((entry) => entry.features.includes(feature)).map((entry) => entry.model);
  assert.deepEqual(served('assistant'), ['grok-4.20-non-reasoning', 'grok-4.3', 'gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol']);
  assert.deepEqual(served('import'), ['grok-4.3', 'gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra']);
  assert.deepEqual(served('photo'), ['gpt-image-2.5-sunburst', 'grok-imagine-image-2.0']);
  assert.deepEqual(served('voice'), ['gpt-realtime-2.1', 'gpt-realtime-2.1-mini']);
  for (const feature of FEATURES) for (const [provider, model] of DEFAULTS[feature]) assert.ok(serves(feature, provider, model));
  assert.equal(serves('import', 'xai', 'grok-4.20-non-reasoning'), false);
  assert.equal(serves('assistant', 'xai', 'gpt-6-luna'), false);
  assert.equal(modelOf('openai', 'nope'), null);
});

test('text token cost bills cached tokens at the cached rate only', () => {
  // 1000 input of which 400 cached, 200 output on gpt-6.1-terra: 600 × 1 + 400 × 0.05 + 200 × 5 = 1620 µ$
  assert.equal(costMicros('openai', 'gpt-6.1-terra', { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 400 } }), 1620);
  // Chat-style names: 2000 prompt (500 cached), 300 completion on Grok 4.3: 1500 × 1.25 + 500 × 0.2 + 300 × 2.5 = 2725
  assert.equal(costMicros('xai', 'grok-4.3', { prompt_tokens: 2000, completion_tokens: 300, prompt_tokens_details: { cached_tokens: 500 } }), 2725);
  // No cache details: 10 000 × 0.1 + 1000 × 0.5 = 1500 on Luna
  assert.equal(costMicros('openai', 'gpt-6-luna', { input_tokens: 10000, output_tokens: 1000 }), 1500);
  // Astra: 3 × 10 + 7 × 50 = 380
  assert.equal(costMicros('openai', 'gpt-6-astra', { input_tokens: 3, output_tokens: 7 }), 380);
  // Fractions round to the nearest micro-dollar: 3 × 0.1 + 1 × 0.5 = 0.8 → 1
  assert.equal(costMicros('openai', 'gpt-6-luna', { input_tokens: 3, output_tokens: 1 }), 1);
  // Cached never exceeds input
  assert.equal(costMicros('openai', 'gpt-6.1-sol', { input_tokens: 10, output_tokens: 0, input_tokens_details: { cached_tokens: 99 } }), 1);
});

test('xAI doubles every rate once the prompt reaches 200k tokens', () => {
  const below = { input_tokens: 199999, output_tokens: 1000, input_tokens_details: { cached_tokens: 100000 } };
  // 99 999 × 1.25 + 100 000 × 0.2 + 1000 × 2.5 = 124 998.75 + 20 000 + 2500 = 147 498.75 → 147 499
  assert.equal(costMicros('xai', 'grok-4.20-non-reasoning', below), 147499);
  // 200 000 prompt (100 000 cached): (100 000 × 1.25 + 100 000 × 0.2 + 1000 × 2.5) × 2 = 295 000
  assert.equal(costMicros('xai', 'grok-4.20-non-reasoning', { ...below, input_tokens: 200000 }), 295000);
  // OpenAI has no long-context tier in the catalog: 200 000 × 0.1 + 1000 × 0.5 = 20 500
  assert.equal(costMicros('openai', 'gpt-6-luna', { input_tokens: 200000, output_tokens: 1000 }), 20500);
});

test('Realtime cost splits text, audio and image tokens and their cached parts', () => {
  const usage = {
    total_tokens: 2600, input_tokens: 2400, output_tokens: 200,
    input_token_details: { text_tokens: 1800, audio_tokens: 600, image_tokens: 0, cached_tokens: 1200,
      cached_tokens_details: { text_tokens: 1000, audio_tokens: 200, image_tokens: 0 } },
    output_token_details: { text_tokens: 200, audio_tokens: 0 }
  };
  // mini: 800 × 0.6 + 1000 × 0.06 + 400 × 10 + 200 × 0.3 + 200 × 2.4 = 480 + 60 + 4000 + 60 + 480 = 5080
  assert.equal(costMicros('openai', 'gpt-realtime-2.1-mini', usage), 5080);
  // full: 800 × 4 + 1000 × 0.4 + 400 × 32 + 200 × 0.4 + 200 × 24 = 3200 + 400 + 12 800 + 80 + 4800 = 21 280
  assert.equal(costMicros('openai', 'gpt-realtime-2.1', usage), 21280);
  // Audio output at 64: 100 × 64 = 6400
  assert.equal(costMicros('openai', 'gpt-realtime-2.1', { output_token_details: { text_tokens: 0, audio_tokens: 100 } }), 6400);
  // Cached total without a breakdown is taken from text first: 100 text (all cached) + 50 audio (30 cached) on mini
  // 100 × 0.06 + 20 × 10 + 30 × 0.3 = 6 + 200 + 9 = 215
  assert.equal(costMicros('openai', 'gpt-realtime-2.1-mini', { input_token_details: { text_tokens: 100, audio_tokens: 50, cached_tokens: 130 } }), 215);
  // Images: 1000 image tokens, 400 cached, on full: 600 × 5 + 400 × 0.5 = 3200
  assert.equal(costMicros('openai', 'gpt-realtime-2.1', { input_token_details: { image_tokens: 1000, cached_tokens: 400, cached_tokens_details: { image_tokens: 400 } } }), 3200);
  assert.equal(costMicros('openai', 'gpt-realtime-2.1', { input_tokens: 10, output_tokens: 5 }), null);
});

test('image edits bill text in, image in and image out; Grok images bill per image', () => {
  // 120 × 5 + 1500 × 8 + 4000 × 30 = 600 + 12 000 + 120 000 = 132 600
  assert.equal(costMicros('openai', 'gpt-image-2.5-sunburst', { input_tokens: 1620, input_tokens_details: { text_tokens: 120, image_tokens: 1500 }, output_tokens: 4000 }), 132600);
  // Without details all input is text: 100 × 5 + 10 × 30 = 800
  assert.equal(costMicros('openai', 'gpt-image-2.5-sunburst', { input_tokens: 100, output_tokens: 10 }), 800);
  assert.equal(costMicros('xai', 'grok-imagine-image-2.0', { images: 1 }), 40000);
  assert.equal(costMicros('xai', 'grok-imagine-image-2.0', { images: 3, cost_in_usd_ticks: 1 }), 120000);
  assert.equal(costMicros('xai', 'grok-imagine-image-2.0', {}), null);
});

test('transcription bills per minute of audio', () => {
  // 40 s at $0.0045 per minute = $0.003 = 3000 µ$
  assert.equal(costMicros('openai', 'gpt-transcribe', { type: 'duration', seconds: 40 }), 3000);
  assert.equal(costMicros('openai', 'gpt-transcribe', { type: 'duration', seconds: 1.5 }), 113);
  assert.equal(costMicros('openai', 'gpt-transcribe', { type: 'tokens', input_tokens: 10, output_tokens: 3 }), null);
});

test('unknown models and missing or malformed usage cost nothing known', () => {
  assert.equal(costMicros('openai', 'gpt-unknown', { input_tokens: 1, output_tokens: 1 }), null);
  assert.equal(costMicros('xai', 'gpt-6-luna', { input_tokens: 1, output_tokens: 1 }), null);
  assert.equal(costMicros('openai', 'gpt-6-luna', null), null);
  assert.equal(costMicros('openai', 'gpt-6-luna', { input_tokens: 10 }), null);
  assert.equal(costMicros('openai', 'gpt-6-luna', { input_tokens: -5, output_tokens: 1 }), null);
  assert.equal(costMicros('openai', 'gpt-6-luna', { input_tokens: '10', output_tokens: 1 }), null);
});

test('defaults reproduce the old behaviour: Grok when its key is set, then OpenAI', () => {
  const both = { XAI_API_KEY: 'x', OPENAI_API_KEY: 'o' };
  const pick = (env, feature, settings = {}) => { const { provider, model, explicit } = choose(env, settings, feature); return [provider, model, explicit]; };
  assert.deepEqual(pick(both, 'assistant'), ['xai', 'grok-4.20-non-reasoning', false]);
  assert.deepEqual(pick(both, 'import'), ['xai', 'grok-4.3', false]);
  assert.deepEqual(pick(both, 'photo'), ['openai', 'gpt-image-2.5-sunburst', false]);
  assert.deepEqual(pick(both, 'voice'), ['openai', 'gpt-realtime-2.1-mini', false]);
  assert.deepEqual(pick({ OPENAI_API_KEY: 'o' }, 'assistant'), ['openai', 'gpt-6-luna', false]);
  assert.deepEqual(pick({ OPENAI_API_KEY: 'o' }, 'import'), ['openai', 'gpt-6-luna', false]);
  assert.deepEqual(pick({ XAI_API_KEY: 'x' }, 'photo'), ['xai', 'grok-imagine-image-2.0', false]);
  assert.deepEqual(pick(both, 'assistant', { assistant: { provider: 'openai', model: 'gpt-6.1-sol' } }), ['openai', 'gpt-6.1-sol', true]);
});

test('a missing key fails with the secret named, and an explicit choice never falls back', () => {
  assert.throws(() => selected({}, {}, 'assistant'), (error) => error.status === 503 && /XAI_API_KEY or OPENAI_API_KEY/.test(error.message));
  assert.throws(() => selected({ XAI_API_KEY: 'x' }, {}, 'voice'), (error) => error.status === 503 && /Voice needs OPENAI_API_KEY/.test(error.message));
  const explicit = { assistant: { provider: 'openai', model: 'gpt-6.1-terra' } };
  assert.throws(() => selected({ XAI_API_KEY: 'x' }, explicit, 'assistant'),
    (error) => error.status === 503 && error.message === 'The assistant is set to gpt-6.1-terra, which needs OPENAI_API_KEY on the server.');
  assert.throws(() => selected({ OPENAI_API_KEY: 'o' }, { import: { provider: 'xai', model: 'grok-4.3' } }, 'import'), /needs XAI_API_KEY/);
  assert.deepEqual(selected({ OPENAI_API_KEY: 'o' }, explicit, 'assistant'), { provider: 'openai', model: 'gpt-6.1-terra', explicit: true });
  assert.equal(missingKey({ OPENAI_API_KEY: 'o' }, 'assistant', { provider: 'openai', model: 'gpt-6-luna' }), null);
});

test('settings input is checked against the catalog', () => {
  assert.deepEqual(settingInput({ feature: 'assistant', provider: 'openai', model: 'gpt-6-luna' }), { feature: 'assistant', provider: 'openai', model: 'gpt-6-luna' });
  assert.deepEqual(settingInput({ feature: 'voice', reset: true }), { feature: 'voice', reset: true });
  assert.throws(() => settingInput({ feature: 'assistant', provider: 'openai', model: 'gpt-6-astra' }), /cannot be used/);
  assert.throws(() => settingInput({ feature: 'assistant', provider: 'xai', model: 'gpt-6-luna' }), /cannot be used/);
  assert.throws(() => settingInput({ feature: 'billing', provider: 'openai', model: 'gpt-6-luna' }), /Choose a feature/);
  assert.throws(() => settingInput(null), /Choose a feature/);
});

test('the settings view lists options with prices and key availability', () => {
  const view = settingsView({ XAI_API_KEY: 'x' }, { import: { provider: 'openai', model: 'gpt-6-astra', updatedAt: 1, updatedBy: 'a' } });
  assert.deepEqual(Object.keys(view.options), FEATURES);
  assert.equal(view.settings.assistant, null);
  assert.equal(view.settings.import.model, 'gpt-6-astra');
  assert.deepEqual(view.options.voice[1], { provider: 'openai', model: 'gpt-realtime-2.1-mini', label: 'GPT Realtime 2.1 mini',
    prices: MODELS.find((entry) => entry.model === 'gpt-realtime-2.1-mini').prices, available: false });
  assert.equal(view.options.assistant[0].available, true);
  assert.deepEqual(view.effective.assistant, { provider: 'xai', model: 'grok-4.20-non-reasoning', explicit: false, label: 'Grok 4.20 (non-reasoning)', available: true, error: null });
  assert.equal(view.effective.import.available, false);
  assert.match(view.effective.import.error, /needs OPENAI_API_KEY/);
});
