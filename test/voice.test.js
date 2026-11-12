import test from 'node:test';
import assert from 'node:assert/strict';
import { heardOf, initial, limits, parseChanges, shownOutput, step } from '../public/studio/voice.js';
import { planOps } from '../public/studio/ops.js';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dish = (n, extra = {}) => ({
  id: id(n), name: 'Dish ' + n, description: '', allergens: '', portion: '', tags: [], price: 1000, calories: null,
  photo: null, originalPhoto: null, featured: false, available: true, review: false, ...extra
});
const draft = {
  name: 'Osteria', subtitle: '', currency: 'RON', template: 'osteria', palette: 'olive', accent: '', photos: {},
  sections: [
    { id: id(1), name: 'Mains', note: '', items: [dish(10), dish(11, { price: null })] },
    { id: id(2), name: 'Desserts', note: '', items: [dish(20, { name: 'Tiramisu', price: 2500 })] }
  ]
};

function run(events, state = initial(0)) {
  const effects = [];
  for (const event of events) {
    const result = step(state, event);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const live = () => run([
  { type: 'local.connected', call: 'call_1', model: 'gpt-realtime-2.1-mini', at: 1 },
  { type: 'local.open', draft, at: 2 }
]).state;
const sent = (effects) => effects.filter((effect) => effect.type === 'send').map((effect) => effect.event);
const texts = (effects) => sent(effects).filter((event) => event.item.type === 'message').map((event) => event.item.content[0].text);
const call = (args, extra = {}) => ({ type: 'response.function_call_arguments.done', name: 'propose_changes', call_id: 'fc_1', arguments: args, at: 10, ...extra });

test('opening the channel sends the menu and nothing else', () => {
  const { state, effects } = run([{ type: 'local.connected', call: 'call_1', at: 1 }, { type: 'local.open', draft, at: 2 }]);
  assert.equal(state.phase, 'listening');
  assert.equal(effects.length, 1);
  const [event] = sent(effects);
  assert.equal(event.type, 'conversation.item.create');
  assert.equal(event.item.role, 'user');
  assert.match(event.item.content[0].text, /^Menu:\n\{/);
  assert.equal(event.item.content[0].text.includes(id(10)), false);
  assert.equal(state.handles.get('d1').id, id(10));
  assert.equal(effects.some((effect) => effect.event?.type === 'response.create'), false);
});

test('the transcript assembles from deltas and is replaced by the completed text', () => {
  let { state } = run([
    { type: 'input_audio_buffer.speech_started', item_id: 'i1', at: 5 },
    { type: 'conversation.item.input_audio_transcription.delta', item_id: 'i1', delta: 'Raise the ' },
    { type: 'conversation.item.input_audio_transcription.delta', item_id: 'i1', delta: 'desserts' }
  ], live());
  assert.equal(state.phase, 'hearing');
  assert.equal(heardOf(state), 'Raise the desserts');
  ({ state } = run([
    { type: 'input_audio_buffer.speech_stopped', item_id: 'i1', at: 6 },
    { type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: ' Raise the desserts by 10%. ' },
    { type: 'input_audio_buffer.speech_started', item_id: 'i2', at: 7 },
    { type: 'conversation.item.input_audio_transcription.delta', item_id: 'i2', delta: 'please' }
  ], state));
  assert.equal(state.phase, 'hearing');
  assert.equal(heardOf(state), 'Raise the desserts by 10%. please');
  ({ state } = run([{ type: 'response.done', response: {}, at: 9 }, { type: 'input_audio_buffer.speech_started', item_id: 'i3', at: 12 }], state));
  assert.equal(heardOf(state), '', 'a new turn starts after a response');
  const quiet = run([{ type: 'response.done', response: {} }, { type: 'response.created' }], state).state;
  assert.equal(heardOf(quiet), '', 'a response without new speech does not reuse the last transcript');
});

test('a propose_changes call becomes ops for the proposal card and is acknowledged without a new response', () => {
  const start = run([
    { type: 'input_audio_buffer.speech_started', item_id: 'i1', at: 5 },
    { type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'Tiramisu costs 30 now and add Mains to the top' }
  ], live()).state;
  const args = JSON.stringify({ reply: 'Tiramisu goes to 30.', ops: [
    { op: 'update_dish', id: 'd3', price: 30, name: null, description: null, portion: null, allergens: null, calories: null, tags: null, featured: null, available: null, clear: [] },
    { op: 'remove_dish', id: 'd99' }
  ] });
  const { state, effects } = step(start, call(args));
  const proposal = effects.find((effect) => effect.type === 'proposal');
  assert.equal(proposal.heard, 'Tiramisu costs 30 now and add Mains to the top');
  assert.equal(proposal.reply, 'Tiramisu goes to 30.');
  assert.deepEqual(proposal.ops, [{ op: 'update_dish', id: id(20), price: 3000 }]);
  assert.equal(planOps(draft, proposal.ops).changes[0].ok, true);
  const [ack] = sent(effects);
  assert.deepEqual(ack.item, { type: 'function_call_output', call_id: 'fc_1', output: shownOutput });
  assert.equal(sent(effects).some((event) => event.type === 'response.create'), false);
  assert.equal(state.reviewing, true);
  assert.equal(state.phase, 'reviewing');
});

test('malformed arguments show a plain notice, still answer the call, and propose nothing', () => {
  for (const args of ['{"reply": "x", "ops": [', '"just text"', '[1,2]', 'null']) {
    const { state, effects } = step(live(), call(args));
    assert.equal(effects.some((effect) => effect.type === 'proposal'), false, args);
    assert.equal(effects.find((effect) => effect.type === 'notice').text.length > 0, true);
    assert.equal(sent(effects)[0].item.type, 'function_call_output');
    assert.equal(state.reviewing, false);
  }
  assert.deepEqual(parseChanges('{"reply": 3, "ops": {"op": "remove_dish"}}'), { reply: '', ops: [] });
  const empty = step(live(), call(JSON.stringify({ reply: 'Which dish?', ops: [{ op: 'remove_dish', id: 'nope' }] })));
  assert.deepEqual(empty.effects.find((effect) => effect.type === 'answer'), { type: 'answer', heard: '', reply: 'Which dish?' });
  assert.equal(empty.state.reviewing, false);
});

test('a text-only answer is shown like a plain assistant message', () => {
  const { state, effects } = run([
    { type: 'input_audio_buffer.speech_started', item_id: 'i1', at: 5 },
    { type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'What is the weather?' },
    { type: 'response.created' },
    { type: 'response.output_text.delta', delta: 'I can only ' },
    { type: 'response.output_text.delta', delta: 'help with the menu.' },
    { type: 'response.output_text.done', text: 'I can only help with the menu.' }
  ], live());
  assert.deepEqual(effects.filter((effect) => effect.type === 'answer'), [{ type: 'answer', heard: 'What is the weather?', reply: 'I can only help with the menu.' }]);
  assert.equal(state.reviewing, false);
});

test('usage is forwarded with the call id, what was heard and what was proposed', () => {
  const usage = { input_tokens: 900, output_tokens: 40, input_token_details: { audio_tokens: 120, text_tokens: 780 } };
  const transcription = { type: 'tokens', input_tokens: 50, output_tokens: 9 };
  const { effects } = run([
    { type: 'input_audio_buffer.speech_started', item_id: 'i1', at: 5 },
    { type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'Remove Dish 10', usage: transcription },
    { type: 'response.created' },
    call(JSON.stringify({ reply: 'Removing it.', ops: [{ op: 'remove_dish', id: 'd1' }] })),
    { type: 'response.done', response: { status: 'completed', usage }, at: 11 }
  ], live());
  const bodies = effects.filter((effect) => effect.type === 'usage').map((effect) => effect.body);
  assert.deepEqual(bodies, [
    { call: 'call_1', kind: 'transcription', usage: transcription, heard: 'Remove Dish 10' },
    { call: 'call_1', kind: 'response', usage, heard: 'Remove Dish 10', reply: 'Removing it.', ops: [{ op: 'remove_dish', id: id(10) }] }
  ]);
  const answered = run([{ type: 'response.created' }, { type: 'response.output_text.done', text: 'Which one?' }, { type: 'response.done', response: { usage } }], live());
  assert.deepEqual(answered.effects.find((effect) => effect.type === 'usage').body, { call: 'call_1', kind: 'response', usage, heard: '', reply: 'Which one?', ops: [] });
  assert.equal(run([{ type: 'response.done', response: { usage } }]).effects.length, 0, 'nothing is forwarded before the call is known');
});

test('the microphone is muted while a proposal is reviewed and unmuted after Apply or Discard', () => {
  const proposed = step(live(), call(JSON.stringify({ reply: '', ops: [{ op: 'remove_dish', id: 'd1' }] })));
  assert.deepEqual(proposed.effects.filter((effect) => effect.type === 'mic'), [{ type: 'mic', on: false }]);
  const ignored = step(proposed.state, { type: 'input_audio_buffer.speech_started', item_id: 'x', at: 20 });
  assert.equal(ignored.state.phase, 'reviewing');
  const again = step(proposed.state, call(JSON.stringify({ reply: '', ops: [{ op: 'remove_dish', id: 'd2' }] }), { call_id: 'fc_2' }));
  assert.equal(again.effects.some((effect) => effect.type === 'proposal'), false);
  assert.equal(sent(again.effects)[0].item.call_id, 'fc_2');
  assert.equal(step(proposed.state, { type: 'local.tick', at: 10 + limits.idle * 2 }).state.phase, 'reviewing', 'reviewing does not count as silence');

  const applied = { ...draft, sections: [{ ...draft.sections[0], items: [dish(11, { price: null })] }, draft.sections[1]] };
  const after = step(proposed.state, { type: 'local.resolved', applied: 1, total: 1, draft: applied, at: 30 });
  assert.deepEqual(after.effects.filter((effect) => effect.type === 'mic'), [{ type: 'mic', on: true }]);
  assert.deepEqual(texts(after.effects).map((text) => text.split('\n')[0]), ['The owner applied 1 of 1 changes.', 'Menu:']);
  assert.equal(after.state.handles.get('d1').id, id(11), 'handles follow the current draft');
  assert.equal(after.state.reviewing, false);

  const discarded = step(proposed.state, { type: 'local.resolved', applied: 0, total: 1, draft, at: 30 });
  assert.deepEqual(texts(discarded.effects).map((text) => text.split('\n')[0]), ['The owner discarded the changes.', 'Menu:']);

  const typed = run([{ type: 'local.review' }, { type: 'local.resolved', applied: 0, total: 2, draft, at: 40 }], live());
  assert.deepEqual(typed.effects.map((effect) => effect.type), ['mic', 'mic'], 'a typed proposal mutes too, without telling the model');
});

test('hand edits resend the menu only when it changed, and the session ends on silence or after ten minutes', () => {
  const state = live();
  assert.equal(step(state, { type: 'local.menu', draft }).effects.length, 0);
  const renamed = step(state, { type: 'local.menu', draft: { ...draft, name: 'Trattoria' } });
  assert.match(texts(renamed.effects)[0], /Trattoria/);
  assert.equal(step(state, { type: 'local.tick', at: 2 + limits.idle - 1 }).state.phase, 'listening');
  assert.deepEqual(step(state, { type: 'local.tick', at: 2 + limits.idle }).effects, [{ type: 'close' }]);
  const talking = step(state, { type: 'input_audio_buffer.speech_started', item_id: 'i', at: limits.total - 5 }).state;
  const ended = step(talking, { type: 'local.tick', at: limits.total });
  assert.equal(ended.state.ended, 'limit');
  assert.equal(step(ended.state, { type: 'input_audio_buffer.speech_started', at: limits.total + 1 }).state.phase, 'ended');
  const fatal = step(state, { type: 'error', error: { type: 'invalid_request_error', code: 'session_expired', message: 'x' } });
  assert.equal(fatal.state.phase, 'ended');
  assert.equal(step(state, { type: 'error', error: { type: 'invalid_request_error', code: 'unknown_parameter' } }).state.phase, 'listening');
});
