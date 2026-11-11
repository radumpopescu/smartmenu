# Implementation and deployment status

The initial application lives in this repository and is configured for Cloudflare. The [README](../README.md) covers local setup, binding configuration, and deployment commands.

## Implemented

| Area | Current behavior |
| --- | --- |
| Accounts | Invite-code signup, sign-in, and one owner per menu. Owners can manage multiple menus. |
| Menu studio | Editable sections and dishes, section notes, featured items, prices, descriptions, portions, dietary tags, calories, allergens, and availability. The mobile guest preview updates during editing. |
| Design | Four templates (Osteria, Carta, Mercato, Notte), each with four palettes, plus a custom accent color. Drafts saved before templates existed are upgraded when they are read. |
| Menu import | OpenAI vision extracts one menu page at a time. Matching section names merge into the draft. Flagged entries must be marked reviewed before publishing. |
| Dish photos | Upload originals to private R2 with the size the browser reports. Queue an AI edit with a natural tabletop or transparent background. Edits are stored as 1024 × 1024, and transparent ones are marked as cut-outs. Compare the result before selecting it and restore the original after accepting an edit. |
| Guest menu | The Worker renders `/m/:slug` from the published snapshot with `public/guest/render.js`, inlines the template's CSS, and caches the page at the edge. Demo slugs render from `public/guest/samples.js` without the database. Unknown or unpublished slugs return a 404 page. Publishing creates a snapshot separate from the draft. The guest URL and downloadable QR code retain the same menu slug across updates. |

## Architecture

- **Cloudflare Workers** serves the staff studio, guest view, and API. Static assets come from `public/`. Requests to `/m/*` always reach the Worker (`run_worker_first`), which server-renders the guest page with its own security headers. The guest CSS files are bundled into the Worker as text modules. Guest pages, public menu data and public photos are cached at the edge for up to a minute.
- **Menu data** is version 2 (see [the plan](plan.md#the-contract)). `src/menu.js` validates drafts, upgrades stored drafts that still use `theme`, `layout` and `font`, and builds the published snapshot. The API attaches a server-owned `photos` map with each referenced photo's size and cut-out flag to every draft it returns, and freezes it into the snapshot at publish time.
- **D1** stores accounts, sessions, draft and published menu data, photo metadata (including width, height and cut-out, added in migration `0002`), edit jobs, and usage. A version check rejects stale draft writes.
- **R2** stores originals and edited images. The Worker authorizes access to unpublished photos and serves published photos to guests.
- **Cloudflare Queues** runs photo edits asynchronously with concurrency limits and retries. Menu extraction runs on demand. Daily account quotas limit uploads and AI requests.
- **OpenAI** handles structured menu extraction and image edits. Model settings live in [wrangler.jsonc](../wrangler.jsonc). The API key stays in server-side configuration.
- **`PUBLIC_ORIGIN`** in `wrangler.jsonc` sets the hostname used in QR codes and canonical links. It is empty by default, which falls back to the request's hostname.
- **Tests** in `test/` cover draft validation, the legacy upgrade, the published snapshot, and the renderer. `npm run check` runs them, and `.github/workflows/check.yml` runs the check on every push and pull request.

## Verified locally

- The D1 migration applied and Wrangler built the Worker in a deployment dry run.
- The local smoke test covered account isolation, photo upload and visibility, draft and published snapshots, stale-write rejection, QR generation, and missing API key behavior.
- The guest layout and section navigation were checked in the browser.
- With migration `0002` applied, a local run covered signup, menu creation, photo upload with reported dimensions, publishing, the server-rendered guest page with `PUBLIC_ORIGIN` set and unset, the 404 page, and the upgrade of a legacy draft and snapshot on read.
- Mocked OpenAI responses verified request construction and response handling. Live extraction quality, photo fidelity, transparency, and queue behavior with the provider still need to be checked.

## Remaining work

- Cloudflare deployment is pending. The local Wrangler login had expired during the implementation pass. Provision D1, R2, and the queue, configure the production secrets, and deploy under the intended guest hostname before printing QR codes.
- Run a real menu import and compare both photo background options using restaurant-approved images. The current editor flags uncertain entries. A side-by-side source-page review and optional AI copy suggestions were discussed but are outside this version.
- Staff invitations, password recovery, billing, and photo storage cleanup are future work. The Cloudflare architecture gives the app a path to scale. Production capacity and costs have yet to be measured.
