# Implementation and deployment status

The initial application lives in this repository and is configured for Cloudflare. The [README](../README.md) covers local setup, binding configuration, and deployment commands.

## Implemented

| Area | Current behavior |
| --- | --- |
| Accounts | Invite-code signup, sign-in, and one owner per menu. Owners can manage multiple menus. |
| Menu studio | Editable sections and dishes, featured items, prices, descriptions, calories, allergens, and availability. The mobile guest preview updates during editing. |
| Design | Three layouts, four palettes, two heading styles, a custom accent color, and **Surprise me**. |
| Menu import | OpenAI vision extracts one menu page at a time. Matching section names merge into the draft. Flagged entries must be marked reviewed before publishing. |
| Dish photos | Upload originals to private R2. Queue an AI edit with a natural tabletop or transparent background. Compare the result before selecting it and restore the original after accepting an edit. |
| Guest menu | Responsive public menu with section navigation and featured dishes. Publishing creates a snapshot separate from the draft. The guest URL and downloadable QR code retain the same menu slug across updates. |

## Architecture

- **Cloudflare Workers** serves the staff studio, guest view, and API. Public menu data and public photos can be cached at the edge.
- **D1** stores accounts, sessions, draft and published menu data, photo metadata, edit jobs, and usage. A version check rejects stale draft writes.
- **R2** stores originals and edited images. The Worker authorizes access to unpublished photos and serves published photos to guests.
- **Cloudflare Queues** runs photo edits asynchronously with concurrency limits and retries. Menu extraction runs on demand. Daily account quotas limit uploads and AI requests.
- **OpenAI** handles structured menu extraction and image edits. Model settings live in [wrangler.jsonc](../wrangler.jsonc). The API key stays in server-side configuration.

## Verified locally

- The D1 migration applied and Wrangler built the Worker in a deployment dry run.
- The local smoke test covered account isolation, photo upload and visibility, draft and published snapshots, stale-write rejection, QR generation, and missing API key behavior.
- The guest layout and section navigation were checked in the browser.
- Mocked OpenAI responses verified request construction and response handling. Live extraction quality, photo fidelity, transparency, and queue behavior with the provider still need to be checked.

## Remaining work

- Cloudflare deployment is pending. The local Wrangler login had expired during the implementation pass. Provision D1, R2, and the queue, configure the production secrets, and deploy under the intended guest hostname before printing QR codes.
- Run a real menu import and compare both photo background options using restaurant-approved images. The current editor flags uncertain entries. A side-by-side source-page review and optional AI copy suggestions were discussed but are outside this version.
- Staff invitations, password recovery, billing, and photo storage cleanup are future work. The Cloudflare architecture gives the app a path to scale. Production capacity and costs have yet to be measured.
