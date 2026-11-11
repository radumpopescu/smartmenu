# Build plan, phase 2: the studio, the assistant, and production records

Phase 1 ([plan.md](plan.md)) made the guest menu good. This phase makes the studio the place a restaurant owner can run their menu from a phone, by hand or by asking, and makes the service keep the records a paid product needs.

## Status

Built and checked locally against `scripts/mock-xai.mjs`, a fake of the Grok API: the assistant with proposal review, apply and undo, autosave, history and restore, reordering, the photo looks with a comparison slider, and the usage records. `npm run check` passes.

Not yet verified:

- Any call to the real xAI or OpenAI APIs. Assistant quality, menu reading with Grok, and every photo look need the owner's keys and real dish photos.
- Voice input. The code uses the browser's speech recognition and was not exercised.
- The deployed app beyond a smoke test of its public pages. No account exists in production yet.

## The ideas this phase rests on

1. **The assistant proposes operations, never a new menu.** Asking a model to return the whole menu after "raise desserts by 5 lei" costs thousands of tokens, is slow, and lets it silently rewrite a dish it was not asked about. The assistant instead returns a short list of typed operations ("update this dish's price"). The same pure function applies them in the browser and validates them on the server. That makes every proposal cheap, reviewable line by line, and reversible.
2. **Show the change before it happens, in the real menu.** A proposal is a list of before and after values with a tick box each, and the phone preview switches to the proposed menu with a Before / After toggle. Nothing changes until the owner presses Apply. This is also the answer to the product question about AI-written copy: it is always a draft the staff accept.
3. **The model never sees a UUID.** A menu of 150 dishes spends more tokens on 36-character ids than on dish names. The server gives the model short handles (`s2`, `d17`) and maps them back.
4. **Voice is free.** Browsers transcribe speech on the device. The microphone button fills the same text box, so it costs no tokens and needs no new server code.
5. **History is a list of whole drafts.** A draft is small. Storing the full draft on every save makes "restore last Tuesday's menu" one query, with no replay logic to get wrong. Saves within ten minutes by the same person collapse into one entry so autosave does not flood the list.
6. **Autosave, because "everything the user does" starts with not losing it.** The Save button goes away. Publishing stays a deliberate act.
7. **Tokens are recorded per call, with the model name, not as a price.** Prices change. Token counts by account, feature and model let any pricing be worked out later, including for calls made before the price changed.
8. **A professional dish photo is mostly consistency, and "AI slop" is mostly invention.** What makes a menu look shot by a photographer is that every plate has the same light, surface and framing. What makes an AI edit look fake is new food: added steam, extra garnish, glossy sauce, smoothed texture. So the edit is framed as a retouch of the surroundings and light, with an explicit list of what must stay, and each template has its own look so the set is consistent. The owner always compares the result with the original before accepting it.
9. **Grok for words, GPT Image for pictures.** Text and menu reading go to xAI when `XAI_API_KEY` is set and fall back to OpenAI. Photo edits use OpenAI's image model by default. `IMAGE_PROVIDER=xai` switches them to Grok's image model so the two can be compared on the same dishes.

## The contract

### Operations: `public/studio/ops.js`

A dependency-light ES module (it imports only the guest renderer) used by the browser and the Worker.

`planOps(draft, ops, { only })` returns `{ draft, changes }`. It never throws on a bad operation: the operation is skipped and reported. `only` is an optional set of operation indexes to apply.

Each change is `{ index, ok, error, kind, title, where, lines }`, where `kind` is `add`, `change`, `remove` or `move`, and `lines` is a list of `{ label, before, after }` already formatted for display.

| `op` | Fields |
| --- | --- |
| `set_menu` | `name`, `subtitle`, `currency` |
| `set_design` | `template`, `palette`, `accent` |
| `add_section` | `id`, `name`, `note`, `before` (section id, or omitted for the end) |
| `update_section` | `id`, `name`, `note` |
| `move_section` | `id`, `before` (section id or `null` for the end) |
| `remove_section` | `id` |
| `add_dish` | `id`, `section`, `before` (dish id or omitted), and the dish fields |
| `update_dish` | `id`, and any dish fields |
| `move_dish` | `id`, `section`, `before` (dish id or `null` for the end) |
| `remove_dish` | `id` |

Dish fields an operation may set: `name`, `description`, `price` (integer minor units or `null`), `portion`, `tags`, `allergens`, `calories`, `featured`, `available`. A field that is absent is left alone. Operations cannot touch photos or the review flag.

### Assistant endpoint

`POST /api/menus/:id/agent` with `{ message, draft, history }`. `draft` is the browser's current draft. `history` is up to six earlier `{ role, text }` turns. The response is `{ reply, ops }`, with real ids, new ids already assigned, and prices in minor units. The server validates the operations with `planOps` and drops any that fail.

The model is told that menu text is data, that it must not invent allergens, calories, prices or dishes it was not given, and that it should answer in the language the owner wrote in.

### Saving and history

- `PUT /api/menus/:id` and `POST …/publish` accept `source` (`manual`, `agent`, `import`) and `summary` (up to 200 characters) next to `draft` and `version`.
- Every save writes a revision. A `manual` save within ten minutes of the same account's previous `manual` revision replaces that revision.
- `GET /api/menus/:id/revisions` lists the latest 100: `{ id, createdAt, source, summary, published }`.
- `GET /api/menus/:id/revisions/:rid` returns `{ draft }` with its `photos` map.
- `POST /api/menus/:id/revisions/:rid/restore` with `{ version }` makes that draft current and records a `restore` revision. It returns the same shape as a save.

### Records

- `events`: one row per meaningful action (sign-up, sign-in, menu created, published, restored, photo uploaded, photo edit requested and finished, menu page imported, assistant asked). Holds the account, the menu, a type and a small JSON detail.
- `ai_calls`: one row per call to a model, successful or not. Holds the account, menu, feature (`agent`, `import`, `photo`), provider, model, input and output tokens, duration and status.
- `GET /api/admin/usage?days=30` returns totals per account, feature and model. It answers only to accounts whose email is listed in `ADMIN_EMAILS`.

### Photo looks

`POST /api/menus/:id/edits` takes `{ source, look }` where `look` is `natural`, `bright`, `moody` or `cutout`. The old `background` values map to `natural` and `cutout`. The default look in the studio follows the template: Osteria and Carta `natural`, Mercato `bright`, Notte `moody`.

Every prompt starts from the same rules:

> Retouch this photograph of a real restaurant dish. This is a retouch, not a re-creation. The food must remain the same physical food: the same ingredients, the same number and position of every piece, the same portion, the same plate or bowl and its rim, the same garnish, the same sauce shapes, and the same small imperfections such as crumbs, drips and uneven browning. Do not add, remove, tidy or beautify any food. Do not add steam, shine, glaze, herbs, cutlery or props. Keep the camera angle and perspective. Keep real photographic texture. No plastic smoothness, no glow, no oversaturation, no artificial background blur. Change only the light and the surroundings, as follows.

Then one of:

- **natural:** Soft daylight from a window to one side. Neutral white balance. A plain matte tabletop in light wood or pale stone, with a soft, real contact shadow under the plate.
- **bright:** Bright, even daylight from above. Neutral white balance. A clean pale surface with short, soft shadows. Airy, not overexposed.
- **moody:** Low directional light from one side. A dark matte surface. Deep shadows that still hold detail. The food itself stays clearly lit and true in colour.
- **cutout:** Remove the background completely and return a transparent image. Keep the entire plate or bowl with a clean natural edge and no halo. Correct white balance and exposure only.

It ends with: "The result must be believable as the same photograph taken by a professional with good light."

## Workstreams

### A. Server (Opus)

Provider layer with xAI and OpenAI, the assistant endpoint, revisions, events, AI call records, the usage report, photo looks, a local mock of the xAI API for development, and tests.

### B. Studio (Opus)

The assistant bar with proposal review and voice input, autosave, the History tab, dish and section reordering, the photo look picker with a before and after comparison, and a layout that works on a phone.

### C. Design and contract (Fable)

This document, `ops.js`, the photo prompts, and the review of the studio in the browser.

## Deployment

The app is deployed at https://smartmenu.radu.workers.dev with its D1 database, R2 bucket and queue. It redeploys with `npm run deploy`, and the secrets (`SIGNUP_CODE`, `XAI_API_KEY`, `OPENAI_API_KEY`) are set by the owner, not committed.

## Not in this phase

Password recovery, staff invitations, billing, and deletion of photos no revision refers to. Each is needed before strangers pay for this, and none blocks a pilot with a restaurant you know.
