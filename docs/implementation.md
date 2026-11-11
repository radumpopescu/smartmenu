# Implementation and deployment status

The initial application lives in this repository and is configured for Cloudflare. The [README](../README.md) covers local setup, binding configuration, and deployment commands.

## Implemented

| Area | Current behavior |
| --- | --- |
| Accounts | Invite-code signup, sign-in, and one owner per menu. Owners can manage multiple menus. |
| Menu studio | Editable sections and dishes, section notes, featured items, prices, descriptions, portions, dietary tags, calories, allergens, and availability. The mobile guest preview updates during editing. |
| Design | Four templates (Osteria, Carta, Mercato, Notte), each with four palettes, plus a custom accent color. Drafts saved before templates existed are upgraded when they are read. |
| Menu import | Grok (or OpenAI without an xAI key) reads one menu page at a time with a strict JSON schema. Matching section names merge into the draft. Flagged entries must be marked reviewed before publishing. |
| Assistant | `POST /api/menus/:id/agent` turns an owner's request into a list of operations from `public/studio/ops.js`. The model sees a compact menu with short handles and prices in major units, answers with a strict schema, and the server maps the answer back to real ids and minor units and drops any operation `planOps` rejects. 200 requests per account per day. |
| History | Every save and publish stores the whole draft as a revision with its source and summary. Manual saves by the same account collapse into one revision for ten minutes. Each menu keeps its newest 200 revisions. Any revision can be opened and restored. |
| Dish photos | Upload originals to private R2 with the size the browser reports. Queue an AI edit with a look: natural, bright, moody or cut-out, each with the retouch prompt from the plan. OpenAI edits are stored as 1024 × 1024 WebP, and cut-outs are marked as such. Compare the result before selecting it and restore the original after accepting an edit. |
| Records | `events` holds sign-ups, sign-ins, menu creation, publishing, restores, photo uploads, photo edits requested and finished, imports and assistant requests. `ai_calls` holds one row per model call, successful or not, with provider, model, token counts, duration and status. `GET /api/admin/usage` totals them for the accounts in `ADMIN_EMAILS`. |
| Guest menu | The Worker renders `/m/:slug` from the published snapshot with `public/guest/render.js`, inlines the template's CSS, and caches the page at the edge. Demo slugs render from `public/guest/samples.js` without the database. Unknown or unpublished slugs return a 404 page. Publishing creates a snapshot separate from the draft. The guest URL and downloadable QR code retain the same menu slug across updates. |

## Architecture

- **Cloudflare Workers** serves the staff studio, guest view, and API. Static assets come from `public/`. Requests to `/m/*` always reach the Worker (`run_worker_first`), which server-renders the guest page with its own security headers. The guest CSS files are bundled into the Worker as text modules. Guest pages, public menu data and public photos are cached at the edge for up to a minute.
- **Menu data** is version 2 (see [the plan](plan.md#the-contract)). `src/menu.js` validates drafts, upgrades stored drafts that still use `theme`, `layout` and `font`, and builds the published snapshot. The API attaches a server-owned `photos` map with each referenced photo's size and cut-out flag to every draft it returns, and freezes it into the snapshot at publish time.
- **D1** stores accounts, sessions, draft and published menu data, photo metadata (including width, height and cut-out, added in migration `0002`), edit jobs, and usage. Migration `0003` adds `revisions`, `events` and `ai_calls`, and the account and look on edit jobs. A version check rejects stale draft writes. The revision is written in the same batch as the menu update and is guarded by the same version, so a rejected save leaves no revision.
- **R2** stores originals and edited images. The Worker authorizes access to unpublished photos and serves published photos to guests.
- **Cloudflare Queues** runs photo edits asynchronously with concurrency limits and retries. Menu extraction runs on demand. Daily account quotas limit uploads and AI requests.
- **Models.** `src/ai.js` is the provider layer. Text and vision calls use the Responses API (`POST /v1/responses`) with a strict JSON schema, which xAI and OpenAI both accept in the same shape, so the assistant and import run on either. xAI is used when `XAI_API_KEY` is set, OpenAI otherwise. Photo edits use OpenAI's `POST /v1/images/edits` by default and xAI's JSON `POST /v1/images/edits` when `IMAGE_PROVIDER` is `xai`. Every call is timed and written to `ai_calls` whether it succeeds or fails. Model ids live in [wrangler.jsonc](../wrangler.jsonc). Keys stay in secrets.
- **Modules.** `src/worker.js` routes requests. `src/agent.js` builds the assistant's menu view, schema and prompt and translates its answer into operations. `src/records.js` holds revisions, events, AI call records and the usage report. `src/menu.js` validates drafts.
- **`PUBLIC_ORIGIN`** in `wrangler.jsonc` sets the hostname used in QR codes and canonical links. It is empty by default, which falls back to the request's hostname.
- **Tests** in `test/` cover draft validation, the legacy upgrade, the published snapshot, the renderer, every operation in `ops.js`, the assistant's handle mapping, price conversion and schema, the revision collapse rule, and provider selection. `npm run check` runs them, and `.github/workflows/check.yml` runs the check on every push and pull request.

## Verified locally

- The D1 migration applied and Wrangler built the Worker in a deployment dry run.
- The local smoke test covered account isolation, photo upload and visibility, draft and published snapshots, stale-write rejection, QR generation, and missing API key behavior.
- The guest layout and section navigation were checked in the browser.
- With migration `0002` applied, a local run covered signup, menu creation, photo upload with reported dimensions, publishing, the server-rendered guest page with `PUBLIC_ORIGIN` set and unset, the 404 page, and the upgrade of a legacy draft and snapshot on read.
- Mocked OpenAI responses verified request construction and response handling. Live extraction quality, photo fidelity, transparency, and queue behavior with the provider still need to be checked.
- With migration `0003` applied and the Worker pointed at `scripts/mock-xai.mjs`, a local run covered the assistant (price changes, a new dish, removal, translation, design, an unclear request, an over-long message and a provider failure), applying its operations with `planOps`, saves with each source, the collapse rule, stale-save and stale-restore rejection, restore, publish, photo edits through the queue, import, the `ai_calls` and `events` rows, and the usage report with and without `ADMIN_EMAILS`. No call reached the real xAI or OpenAI APIs.

## Remaining work

- Cloudflare deployment is pending. The local Wrangler login had expired during the implementation pass. Provision D1, R2, and the queue, configure the production secrets, and deploy under the intended guest hostname before printing QR codes.
- Run a real menu import, real assistant requests on a full menu, and compare the photo looks with both image providers using restaurant-approved images. Check that the chosen model ids are still current before deploying. The current editor flags uncertain entries. A side-by-side source-page review and optional AI copy suggestions were discussed but are outside this version.
- Staff invitations, password recovery, billing, and photo storage cleanup are future work. The Cloudflare architecture gives the app a path to scale. Production capacity and costs have yet to be measured.
