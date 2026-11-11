import test from 'node:test';
import assert from 'node:assert/strict';
import { editPhoto, extractMenu, structured } from '../src/ai.js';

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

const completed = (value, usage = { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 64 } }) =>
  Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage });
const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
const vars = {
  XAI_MODEL: 'grok-text', XAI_VISION_MODEL: 'grok-vision', XAI_IMAGE_MODEL: 'grok-image',
  OPENAI_MODEL: 'gpt-text', VISION_MODEL: 'gpt-vision', OPENAI_REASONING: 'low', IMAGE_MODEL: 'gpt-image-2.5-sunburst'
};

test('structured calls use the Responses API on xAI and record the call', async () => {
  const { requests, rows, DB } = harness(() => completed({ reply: 'ok', ops: [] }));
  const env = { ...vars, DB, XAI_API_KEY: 'x', OPENAI_API_KEY: 'o' };
  const result = await structured(env, { account: 'a', menu: 'm', feature: 'agent' }, { name: 'menu_changes', schema: {}, instructions: 'rules', input: [], maxTokens: 50 });
  assert.deepEqual(result, { reply: 'ok', ops: [] });
  assert.equal(requests[0].url, 'https://api.x.ai/v1/responses');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer x');
  assert.deepEqual(requests[0].body.text.format, { type: 'json_schema', name: 'menu_changes', strict: true, schema: {} });
  assert.equal(requests[0].body.model, 'grok-text');
  assert.equal(requests[0].body.max_output_tokens, 50);
  assert.equal('reasoning' in requests[0].body, false);
  const [, account, menu, feature, provider, model, status, input, output, cached] = rows[0];
  assert.deepEqual([account, menu, feature, provider, model, status, input, output, cached], ['a', 'm', 'agent', 'xai', 'grok-text', 'ok', 100, 20, 64]);
});

test('import falls back to OpenAI for WebP pages and failures are recorded', async () => {
  const { requests, rows, DB } = harness(() => completed({ sections: [{ name: 'Dolci', items: [{ name: 'Tiramisu', description: '', price: 24.5, review: false }] }] }));
  const env = { ...vars, DB, XAI_API_KEY: 'x', OPENAI_API_KEY: 'o' };
  const webp = new Blob([new Uint8Array(12)], { type: 'image/webp' });
  const sections = await extractMenu(env, webp, { account: 'a', menu: 'm' });
  assert.equal(sections[0].items[0].price, 2450);
  assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(requests[0].body.model, 'gpt-vision');
  assert.deepEqual(requests[0].body.reasoning, { effort: 'low' });
  assert.equal(requests[0].body.input[0].content[0].type, 'input_image');
  await assert.rejects(extractMenu({ ...vars, DB, XAI_API_KEY: 'x' }, webp, {}), /JPEG or PNG/);

  const failing = harness(() => new Response('no', { status: 500 }));
  await assert.rejects(structured({ ...vars, DB: failing.DB, XAI_API_KEY: 'x' }, { feature: 'agent' }, { name: 'n', schema: {}, input: [] }), /could not process/);
  assert.equal(failing.rows[0][6], 'error');
  assert.equal(failing.rows[0][13], 'HTTP 500');
  assert.equal(rows.length, 1);
});

test('OpenAI photo edits send the look prompt and only send input_fidelity to GPT Image 1 models', async () => {
  const { requests, rows, DB } = harness(() => Response.json({ data: [{ b64_json: btoa('RIFF0000WEBP') }], usage: { input_tokens: 500, output_tokens: 1000 } }));
  const env = { ...vars, DB, OPENAI_API_KEY: 'o' };
  const result = await editPhoto(env, { account: 'a', menu: 'm' }, image, 'image/jpeg', 'cutout');
  const form = requests[0].body;
  assert.equal(requests[0].url, 'https://api.openai.com/v1/images/edits');
  assert.equal(form.get('background'), 'transparent');
  assert.equal(form.get('model'), 'gpt-image-2.5-sunburst');
  assert.equal(form.has('input_fidelity'), false);
  assert.match(form.get('prompt'), /Remove the background completely/);
  assert.deepEqual([result.mime, result.width], ['image/webp', 1024]);
  assert.deepEqual([rows[0][3], rows[0][7], rows[0][8]], ['photo', 500, 1000]);
  await editPhoto({ ...env, IMAGE_MODEL: 'gpt-image-1.5' }, {}, image, 'image/jpeg', 'natural');
  assert.equal(requests[1].body.get('input_fidelity'), 'high');
  assert.equal(requests[1].body.get('background'), 'opaque');
});

test('xAI photo edits send JSON with a data URI and refuse cut-outs', async () => {
  const { requests, DB } = harness(() => Response.json({ data: [{ b64_json: btoa(String.fromCharCode(0xff, 0xd8, 0xff)) }] }));
  const env = { ...vars, DB, XAI_API_KEY: 'x', IMAGE_PROVIDER: 'xai' };
  const result = await editPhoto(env, {}, image, 'image/jpeg', 'bright');
  assert.equal(requests[0].url, 'https://api.x.ai/v1/images/edits');
  assert.equal(requests[0].body.model, 'grok-image');
  assert.equal(requests[0].body.response_format, 'b64_json');
  assert.match(requests[0].body.image.url, /^data:image\/jpeg;base64,/);
  assert.equal(requests[0].body.image.type, 'image_url');
  assert.equal(result.mime, 'image/jpeg');
  await assert.rejects(editPhoto(env, {}, image, 'image/jpeg', 'cutout'), /cannot produce/);
});
