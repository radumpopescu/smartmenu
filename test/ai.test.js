import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, editPhoto, extractMenu, structured } from '../src/ai.js';
import { askAgent } from '../src/agent.js';
import { cleanDraft } from '../src/menu.js';

function harness(reply) {
  const requests = [];
  const rows = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    return reply(url);
  };
  const DB = { prepare: () => ({ bind: (...params) => ({ run: async () => rows.push(params) }) }) };
  return { requests, rows, DB };
}

const row = (params) => {
  const names = ['createdAt', 'account', 'menu', 'feature', 'provider', 'model', 'status', 'input', 'output', 'cached', 'reasoning',
    'usage', 'duration', 'error', 'cost', 'audioInput', 'audioOutput', 'request', 'response', 'callRef'];
  return Object.fromEntries(names.map((name, index) => [name, params[index]]));
};
const completed = (value, usage = { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 64 } }) =>
  Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage });
const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
const keys = { XAI_API_KEY: 'x', OPENAI_API_KEY: 'o', OPENAI_REASONING: 'low' };
const xai = (env, model = 'grok-4.20-non-reasoning') => connect(env, { provider: 'xai', model });
const openai = (env, model = 'gpt-6-luna') => connect(env, { provider: 'openai', model });

test('connections carry the key, base URL and what the provider accepts', () => {
  const env = { ...keys, XAI_BASE_URL: 'http://localhost:8789/v1' };
  assert.deepEqual([xai(env).base, xai(env).key, xai(env).reasoning], ['http://localhost:8789/v1', 'x', null]);
  assert.equal(xai(env).looks.includes('cutout'), false);
  assert.deepEqual([openai(env).base, openai(env).reasoning], ['https://api.openai.com/v1', 'low']);
  assert.equal(openai({ ...env, OPENAI_BASE_URL: 'http://stub/v1' }).base, 'http://stub/v1');
  assert.equal(openai({}).key, null);
  assert.equal(openai({}).images.includes('image/webp'), true);
});

test('structured calls use the Responses API and record cost, request and response', async () => {
  const { requests, rows, DB } = harness(() => completed({ reply: 'ok', ops: [] }));
  const env = { ...keys, DB };
  const result = await structured(env, { account: 'a', menu: 'm', feature: 'assistant', request: 'hello' }, xai(env),
    { name: 'menu_changes', schema: {}, instructions: 'rules', input: [], maxTokens: 50 });
  assert.deepEqual(result, { reply: 'ok', ops: [] });
  assert.equal(requests[0].url, 'https://api.x.ai/v1/responses');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer x');
  assert.deepEqual(requests[0].body.text.format, { type: 'json_schema', name: 'menu_changes', strict: true, schema: {} });
  assert.equal(requests[0].body.model, 'grok-4.20-non-reasoning');
  assert.equal(requests[0].body.max_output_tokens, 50);
  assert.equal('reasoning' in requests[0].body, false);
  const call = row(rows[0]);
  assert.deepEqual([call.account, call.menu, call.feature, call.provider, call.model, call.status, call.input, call.output, call.cached],
    ['a', 'm', 'assistant', 'xai', 'grok-4.20-non-reasoning', 'ok', 100, 20, 64]);
  assert.equal(call.cost, Math.round(36 * 1.25 + 64 * 0.2 + 20 * 2.5));
  assert.equal(call.request, 'hello');
  assert.equal(call.response, '{"reply":"ok","ops":[]}');
});

test('the assistant records the owner message and the validated proposal', async () => {
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const draft = cleanDraft({ name: 'Osteria', subtitle: '', currency: 'RON', template: 'osteria', palette: 'olive', accent: '',
    sections: [{ id: id(1), name: 'Dolci', note: '', items: [{ id: id(2), name: 'Tiramisu', description: '', allergens: '', portion: '', tags: [], price: 2500, calories: null, photo: null }] }] });
  const nulls = { name: null, description: null, price: null, portion: null, allergens: null, calories: null, tags: null, featured: null, available: null };
  const { requests, rows, DB } = harness(() => completed({ reply: 'Raising it.', ops: [{ op: 'update_dish', id: 'd1', ...nulls, price: 27, clear: [] }, { op: 'remove_dish', id: 'd9' }] }));
  const env = { ...keys, DB };
  const result = await askAgent(env, { account: 'a', menu: 'm' }, openai(env), draft, { message: 'Tiramisu to 27', history: [] });
  assert.deepEqual(result, { reply: 'Raising it.', ops: [{ op: 'update_dish', id: id(2), price: 2700 }] });
  assert.deepEqual(requests[0].body.reasoning, { effort: 'low' });
  const call = row(rows[0]);
  assert.equal(call.feature, 'assistant');
  assert.equal(call.request, 'Tiramisu to 27');
  assert.deepEqual(JSON.parse(call.response), result);
  assert.equal(call.cost, Math.round(36 * 0.1 + 64 * 0.01 + 20 * 0.5));
});

test('menu reading sends the page at original detail to OpenAI, never stores the image, and refuses WebP on Grok', async () => {
  const { requests, rows, DB } = harness(() => completed({ sections: [{ name: 'Dolci', items: [{ name: 'Tiramisu', description: '', price: 24.5, review: false }] }] }));
  const env = { ...keys, DB };
  const webp = new Blob([new Uint8Array(12)], { type: 'image/webp' });
  const sections = await extractMenu(env, webp, { account: 'a', menu: 'm' }, openai(env, 'gpt-6.1-terra'));
  assert.equal(sections[0].items[0].price, 2450);
  assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(requests[0].body.model, 'gpt-6.1-terra');
  assert.deepEqual(requests[0].body.reasoning, { effort: 'low' });
  assert.equal(requests[0].body.input[0].content[0].type, 'input_image');
  assert.equal(requests[0].body.input[0].content[0].detail, 'original');
  const call = row(rows[0]);
  assert.deepEqual(JSON.parse(call.request), { mime: 'image/webp', bytes: 12 });
  assert.equal(JSON.parse(call.response)[0].items[0].name, 'Tiramisu');
  assert.doesNotMatch(call.request + call.response, /base64/);
  await assert.rejects(extractMenu(env, webp, {}, xai(env, 'grok-4.3')), /JPEG or PNG/);
  assert.equal(rows.length, 1);

  await extractMenu(env, image, {}, xai(env, 'grok-4.3'));
  assert.equal('detail' in requests[1].body.input[0].content[0], false);
});

test('failures and unreadable output are recorded', async () => {
  const failing = harness(() => new Response('no', { status: 500 }));
  const env = { ...keys, DB: failing.DB };
  await assert.rejects(structured(env, { feature: 'assistant' }, xai(env), { name: 'n', schema: {}, input: [] }), /could not process/);
  assert.deepEqual([row(failing.rows[0]).status, row(failing.rows[0]).error, row(failing.rows[0]).cost], ['error', 'HTTP 500', null]);

  const garbled = harness(() => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'not json' }] }], usage: { input_tokens: 10, output_tokens: 2 } }));
  await assert.rejects(extractMenu({ ...keys, DB: garbled.DB }, image, {}, xai(keys, 'grok-4.3')), /could not be read/);
  const call = row(garbled.rows[0]);
  assert.deepEqual([call.status, call.response, call.cost], ['ok', 'not json', 18]);
  assert.match(call.error, /could not be read/);
});

test('OpenAI photo edits send the look prompt, store the result and record its photo id and cost', async () => {
  const usage = { input_tokens: 500, input_tokens_details: { text_tokens: 300, image_tokens: 200 }, output_tokens: 1000 };
  const { requests, rows, DB } = harness(() => Response.json({ data: [{ b64_json: btoa('RIFF0000WEBP') }], usage }));
  const env = { ...keys, DB };
  const stored = [];
  const store = async (result) => { stored.push(result); return 'photo-1'; };
  const photo = await editPhoto(env, { account: 'a', menu: 'm' }, openai(env, 'gpt-image-2.5-sunburst'), { image, mime: 'image/jpeg', look: 'cutout', source: 'src-1' }, store);
  const form = requests[0].body;
  assert.equal(photo, 'photo-1');
  assert.equal(requests[0].url, 'https://api.openai.com/v1/images/edits');
  assert.equal(form.get('background'), 'transparent');
  assert.equal(form.get('model'), 'gpt-image-2.5-sunburst');
  assert.equal(form.has('input_fidelity'), false);
  assert.match(form.get('prompt'), /Remove the background completely/);
  assert.deepEqual([stored[0].mime, stored[0].width], ['image/webp', 1024]);
  const call = row(rows[0]);
  assert.deepEqual([call.feature, call.input, call.output, call.cost], ['photo', 500, 1000, 300 * 5 + 200 * 8 + 1000 * 30]);
  assert.deepEqual(JSON.parse(call.request), { look: 'cutout', source: 'src-1' });
  assert.deepEqual(JSON.parse(call.response), { photo: 'photo-1' });
  await editPhoto(env, {}, openai(env, 'gpt-image-1.5'), { image, mime: 'image/jpeg', look: 'natural' }, store);
  assert.equal(requests[1].body.get('input_fidelity'), 'high');
  assert.equal(requests[1].body.get('background'), 'opaque');
});

test('xAI photo edits send JSON with a data URI, cost per image and refuse cut-outs', async () => {
  const { requests, rows, DB } = harness(() => Response.json({ data: [{ b64_json: btoa(String.fromCharCode(0xff, 0xd8, 0xff)) }] }));
  const env = { ...keys, DB };
  const model = xai(env, 'grok-imagine-image-2.0');
  let stored;
  await editPhoto(env, {}, model, { image, mime: 'image/jpeg', look: 'bright' }, async (result) => { stored = result; return 'p'; });
  assert.equal(requests[0].url, 'https://api.x.ai/v1/images/edits');
  assert.equal(requests[0].body.model, 'grok-imagine-image-2.0');
  assert.equal(requests[0].body.response_format, 'b64_json');
  assert.match(requests[0].body.image.url, /^data:image\/jpeg;base64,/);
  assert.equal(requests[0].body.image.type, 'image_url');
  assert.equal(stored.mime, 'image/jpeg');
  assert.equal(row(rows[0]).cost, 40000);
  await assert.rejects(editPhoto(env, {}, model, { image, mime: 'image/jpeg', look: 'cutout' }, async () => 'p'), /cannot produce/);
});
