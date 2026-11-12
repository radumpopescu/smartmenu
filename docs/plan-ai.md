# Build plan, phase 3: voice, switchable models, and what each request costs

Phase 2 ([plan-studio.md](plan-studio.md)) gave the studio a typed assistant on Grok. This phase adds a spoken assistant on OpenAI's Realtime models, makes the model behind each feature a setting, and records what every request cost, so the choice of model can be made from real numbers.

## Status

Built and checked locally: the model catalog and costs, switchable models, the request log, the admin page at `/admin`, and the voice session up to the point where OpenAI answers. `npm run check` passes.

Not yet verified: any real call to xAI or OpenAI, and therefore the whole voice path with a real microphone. The details most likely to need adjusting on first use are listed at the end of this document.

## The ideas this phase rests on

1. **Voice is the same assistant with a different front door.** The Realtime model hears the owner and calls one function, `propose_changes`, with the same reply and operations the typed assistant returns. The proposal card, the tick boxes, the preview and Apply stay exactly as they are. Nothing about reviewing a change depends on how it was asked for.
2. **The model writes, it does not talk.** Spoken output is the most expensive thing a Realtime model produces ($64 per million tokens on the main model, against $24 for text). The owner is looking at the screen, so the reply is text and the session asks for text output only.
3. **The API key never reaches the browser.** The browser sends its WebRTC offer to our Worker, the Worker forwards it to OpenAI together with the session rules, and hands back the answer. The instructions and the tool are fixed on the server.
4. **Usage for a voice session is reported by the browser.** The audio flows directly between the browser and OpenAI, so the Worker never sees the token counts. The browser forwards each `usage` object it receives, and the Worker accepts it only for a call it started for that account. These rows are marked as client-reported.
5. **One catalog of models.** A single file lists every model the app can use, what it can be used for, and its price. The settings page, the cost calculation and the validation all read from it. Adding a model is one entry.
6. **Cost is fixed at the time of the call.** Each record stores its cost in millionths of a dollar, computed from the catalog when the call was made. A later price change does not rewrite history.
7. **Switching is a setting, not a deployment.** The provider and model for each feature are rows in the database, changed from an admin page. Switching and comparing takes seconds.
8. **Keep what was asked and what came back.** Comparing two models by cost alone is half the decision. Each record keeps a compact copy of the request and the response, without images, so the same menu photo or the same request can be compared across models.

## Models and prices

Checked against the providers' documentation on 2026-11-12. Prices are US dollars per million tokens.

| Model | Used for | Input | Cached input | Output |
| --- | --- | --- | --- | --- |
| `grok-4.20-non-reasoning` (xAI) | assistant | 1.25 | 0.20 | 2.50 |
| `grok-4.3` (xAI) | assistant, menu reading | 1.25 | 0.20 | 2.50 |
| `gpt-6-luna` (OpenAI) | assistant, menu reading | 0.10 | 0.01 | 0.50 |
| `gpt-6.1-terra` (OpenAI) | assistant, menu reading | 1.00 | 0.05 | 5.00 |
| `gpt-6.1-sol` (OpenAI) | assistant, menu reading | 2.00 | 0.10 | 10.00 |
| `gpt-6-astra` (OpenAI) | menu reading | 10.00 | 1.00 | 50.00 |

| Realtime model | Text in | Cached text in | Text out | Audio in | Cached audio in | Audio out |
| --- | --- | --- | --- | --- | --- | --- |
| `gpt-realtime-2.1` | 4.00 | 0.40 | 24.00 | 32.00 | 0.40 | 64.00 |
| `gpt-realtime-2.1-mini` | 0.60 | 0.06 | 2.40 | 10.00 | 0.30 | 20.00 |

Photo edits: `gpt-image-2.5-sunburst` at 5.00 text in, 8.00 image in, 30.00 image out; `grok-imagine-image-2.0` at $0.04 per image.

Not confirmed in the documentation: strict structured output on `gpt-6.1-terra`, `gpt-6.1-sol` and `gpt-6-astra` (confirmed for `gpt-6-luna`), how xAI bills image input, and whether a Realtime session with microphone input and text-only output is officially supported (the two are configured separately and nothing forbids it). The first real call to each settles it.

Defaults when nothing is set: the assistant and menu reading use Grok if its key is present, otherwise `gpt-6-luna`. Voice uses `gpt-realtime-2.1-mini`. Photo edits use `gpt-image-2.5-sunburst`. When a feature is explicitly set to a provider whose key is missing, the request fails with a message naming the missing key. It does not silently use another provider, because that would make the cost figures misleading.

## The contract

### Shared assistant module: `public/studio/agent-view.js`

The parts of `src/agent.js` that turn a draft into what the model sees and turn the model's output into operations move here, so the browser can use them for voice.

- `menuView(draft)` returns `{ text, handles }`.
- `toOps(output, handles)` returns operations in the `ops.js` shape.
- `changesSchema` is the JSON schema for `{ reply, ops }`.

### Session

`GET /api/session` returns `{ signedIn: true, admin, voice }`. `voice` is true when an OpenAI key is configured and voice is not switched off.

### Voice

- `POST /api/menus/:id/voice` with `Content-Type: application/sdp` and the browser's offer as the body. The Worker forwards it to `POST https://api.openai.com/v1/realtime/calls` as multipart with the session configuration: the Realtime model from settings, text output only, input transcription on, the assistant's rules adapted for speech, and one function tool `propose_changes` whose parameters are `changesSchema`. The response is the SDP answer with `X-Voice-Call` (the call id) and `X-Voice-Model` headers. Errors are JSON: 503 when voice is unavailable, 429 over the daily limit.
- The browser creates the data channel `oai-events` before making the offer. After it opens, the browser sends the menu as a user message starting with `Menu:` and nothing else. It sends the menu again after every applied change.
- The model answers either with text (a question) or with a `propose_changes` call. The browser answers the call with a `function_call_output` saying the changes are shown to the owner, and does not ask for another response.
- `POST /api/menus/:id/voice/usage` with `{ call, kind, usage, heard, reply, ops }`. `kind` is `response` or `transcription`. The Worker checks the call belongs to this account and menu and records it.
- A session ends when the owner stops it, after 60 seconds without speech, or after 10 minutes.

### Settings and records

- `GET /api/admin/settings` returns `{ settings, effective, options }`. `options` lists, per feature (`assistant`, `import`, `photo`, `voice`), the catalog entries that can serve it, each with its provider, model, a label, its prices and whether its key is present.
- `PUT /api/admin/settings` with `{ feature, provider, model }` sets a feature, and `{ feature, reset: true }` returns it to the default.
- `GET /api/admin/usage?days=N` adds `costMicros` and the audio token counts to each row, and returns `totals`.
- `GET /api/admin/calls?limit=&feature=&before=` returns recent requests, newest first, each with its account email, feature, provider, model, status, tokens, `costMicros`, duration, error, and the stored `request` and `response`.
- All four answer only to accounts listed in `ADMIN_EMAILS`.

Every model call stores `cost_micros`, and a `request` and `response` of at most 16,000 characters each: for the assistant, the owner's message and the reply with its operations; for menu reading, the extracted sections; for photo edits, the look and the photo ids; for voice, what was heard and what was proposed. Images are never stored in these records.

## Workstreams

### A. Server (Opus)

The model catalog and cost calculation, settings, the extra record columns, the admin endpoints, the voice endpoints, moving the shared assistant code, explicit provider selection for the assistant and for menu reading, and tests.

### B. Studio (Opus)

The voice session in the assistant bar, and the admin page: model settings, costs, and the request log.

### C. Contract and review (Fable)

This document and the review of both in the browser.

## Not verified until real keys are used

Every call to xAI and OpenAI, including the whole voice path. A voice session cannot be imitated locally, because the audio connection is made directly between the browser and OpenAI.
