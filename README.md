# SmartMenu

SmartMenu is a Cloudflare Workers app for creating and publishing restaurant menus. The staff studio has a live guest preview, photo imports, editable sections and dishes, menu design controls, and printable QR codes. Guests browse the published menu without an account.

## Project docs

- [Product vision and workflows](docs/product.md)
- [Finding the first restaurant customers](docs/restaurant-sales.md)
- [Implementation and deployment status](docs/implementation.md)
- [Build plan for templates and the guest menu](docs/plan.md)
- [Build plan for the studio, the assistant and production records](docs/plan-studio.md)
- [Build plan for voice, switchable models and costs](docs/plan-ai.md)
- [Operations: usage, costs and menu history queries](docs/operations.md)

## Run locally

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

The dev server listens on all interfaces, so a phone on the same Wi-Fi can open `http://<your-computer's-IP>:8787`, which is handy for scanning the guest menu on a real phone.

Open [the local studio](http://localhost:8787) and create an account with the signup code in `.dev.vars`. Four demo menus, one per template, are available without signing in: [Osteria](http://localhost:8787/m/demo-osteria), [Carta](http://localhost:8787/m/demo-carta), [Mercato](http://localhost:8787/m/demo-mercato) and [Notte](http://localhost:8787/m/demo-notte). The old `/m/osteria-verde-example` link shows the Osteria demo.

`npm run db:local` applies every migration in `migrations/`. Run it again after pulling a new migration.

The manual editor, original photo uploads, publishing, history and QR codes work without any AI key.

### Keys and settings

Secrets go in `.dev.vars` locally (copied from `.dev.vars.example`, never committed) and are set with `npx wrangler secret put NAME` in production. Vars live in the `vars` of `wrangler.jsonc`; locally, `--var NAME:value` on `wrangler dev` overrides both.

| Setting | Kind | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | secret | Lets features use xAI (Grok). |
| `OPENAI_API_KEY` | secret | Lets features use OpenAI, and turns voice on. |
| `SIGNUP_CODE` | secret | Required to create an account. |
| `ADMIN_EMAILS` | secret | Comma-separated emails of the accounts that may open the admin page at `/admin` and call `/api/admin/*`. Empty means nobody; everyone else gets a 404. Set it with `npx wrangler secret put ADMIN_EMAILS` so the addresses stay out of the repository; locally, put it in `.dev.vars`. |
| `OPENAI_REASONING` | var | Reasoning effort sent with OpenAI text and menu-reading calls (`low` by default; empty to omit it). |
| `VOICE` | var | `off` hides and refuses the spoken assistant even when the OpenAI key is set. |
| `XAI_BASE_URL`, `OPENAI_BASE_URL` | var | Override `https://api.x.ai/v1` and `https://api.openai.com/v1`, for the local mock or a stub. |
| `PUBLIC_ORIGIN` | var | The hostname for QR codes and canonical links. |

### Choosing models

Which provider and model serves each feature (`assistant`, `import` for menu reading, `photo` for photo edits, `voice`) is a setting, changed on the admin page at `/admin` (or `PUT /api/admin/settings`) and stored in the `settings` table. It takes effect on the next request; nothing is redeployed. The models on offer and their prices are in `src/models.js`; adding a model is one entry there.

With nothing set, the assistant uses `grok-4.20-non-reasoning` and menu reading uses `grok-4.3` when `XAI_API_KEY` is set, otherwise `gpt-6-luna`. Photo edits use `gpt-image-2.5-sunburst` when `OPENAI_API_KEY` is set, otherwise `grok-imagine-image-2.0`. Voice uses `gpt-realtime-2.1-mini`. Once a feature is set explicitly, it never falls back: if that provider's key is missing, the feature answers 503 with a message naming the missing secret. "Reset" on the admin page returns a feature to the default.

The earlier model vars (`XAI_MODEL`, `XAI_VISION_MODEL`, `XAI_IMAGE_MODEL`, `OPENAI_MODEL`, `VISION_MODEL`, `IMAGE_MODEL`, `IMAGE_PROVIDER`) are gone; their values are the catalog defaults above.

Menu import handles one page at a time and merges sections with the same name. Grok reads JPEG and PNG pages only, so a WebP page with Grok selected is refused with a 415; choose an OpenAI model for import or upload a JPEG. Photo edits run in a queue with one of four looks: natural, bright, moody or cut-out. Grok's image model cannot return a transparent image, so the cut-out look is refused while photo edits are on Grok. Compare the original and edited images before selecting one.

Every model call records its cost in millionths of a dollar, computed from the catalog at the time of the call, and a compact copy of the request and response without images. The admin page shows totals per feature and model and the request log; [operations](docs/operations.md) has the SQL.

### Voice

The spoken assistant runs on OpenAI's Realtime API over WebRTC. The browser posts its offer to `POST /api/menus/:id/voice`; the Worker forwards it to OpenAI with the session rules and returns the answer, so the key never reaches the browser. The model answers in text and proposes changes through the same review card as the typed assistant. Each account may start 40 voice sessions a day. Token usage for a session is reported by the browser and recorded as client-reported. Voice cannot be tried without a real OpenAI key.

### Running against the mock xAI API

`scripts/mock-xai.mjs` is a dependency-free imitation of the two xAI endpoints the Worker calls. It answers a few assistant commands (a price change on a named dish or a percentage on a section, "add a dish … to … for …", "remove …", "translate"/"rewrite descriptions", "switch to notte"), returns a fixed two-section page for imports, echoes the photo back for edits, and reports plausible token usage. A message containing "mock error" returns HTTP 500. In two terminals:

```sh
npm run mock:xai
npm run dev:mock
```

`dev:mock` is `wrangler dev --var XAI_API_KEY:mock --var XAI_BASE_URL:http://localhost:8789/v1`. Add `--port` or `--var ADMIN_EMAILS:you@example.com` as needed. The `--var` flags override `.dev.vars`, so a real xAI key there is not used. A real `OPENAI_API_KEY` in `.dev.vars` is still used: photo edits default to OpenAI when it is set, so set photo edits to Grok on `/admin` to keep them on the mock. The mock speaks the Responses API shape OpenAI also uses, so `--var OPENAI_API_KEY:mock --var OPENAI_BASE_URL:http://localhost:8789/v1` sends OpenAI text and menu-reading models to it as well.

## Deploy to Cloudflare

1. Run `npx wrangler login` and select the Cloudflare account you want to use. Enable R2 on that account.
2. Create the D1 database with `npx wrangler d1 create smartmenu`. Add the returned `database_id` to the `DB` entry in `wrangler.jsonc`. Create the bucket with `npx wrangler r2 bucket create smartmenu-photos` and the queue with `npx wrangler queues create smartmenu-photo-jobs`. Use your chosen names in the config if these names are taken.
3. Run `npx wrangler d1 migrations apply DB --remote` and `npm run deploy`. Apply new migrations before deploying a Worker that needs them.
4. Run `npx wrangler secret put SIGNUP_CODE` with a strong private signup code. Run `npx wrangler secret put XAI_API_KEY` and `npx wrangler secret put OPENAI_API_KEY` with the AI projects' keys. Set `ADMIN_EMAILS` in `wrangler.jsonc` to the accounts that may open `/admin`, then choose the models there. Accounts can be created only when the signup code is set and supplied. Existing accounts can sign in when signup is closed.
5. Set `PUBLIC_ORIGIN` in the `vars` of `wrangler.jsonc` to the guest hostname, for example `https://menu.example.com`, before distributing QR codes. QR codes and canonical links use it. When it is empty, they use the hostname of the request, so a code downloaded from a preview or `workers.dev` hostname would point there. Republishing preserves the menu’s slug.

Use separate bindings and secrets for staging and production. Account-level daily quotas apply to uploads, menu extraction, photo edits, assistant requests and voice sessions. The Worker uses a Cloudflare rate-limit binding for signup and sign-in. D1 holds accounts, sessions, drafts, published snapshots and job status. R2 is private, with the Worker serving only currently published images to guests. The Worker renders the guest page at `/m/:slug` as one HTML response with the template's CSS inline, and caches it, guest menu data and public images at the edge. Published changes can take up to a minute to appear at every edge location. The queue limits concurrent image edits and retries failed jobs. Menu updates use a version check to prevent an older browser tab from overwriting a newer draft.

Current scope is a single owner account per menu. Staff invitations, password recovery, billing, storage lifecycle cleanup, and measured capacity limits are future work.

## Checks

Run `npm run check` and `npx wrangler deploy --dry-run`. `npm run check` parses every script in `src/`, `public/`, `public/guest/`, `public/studio/` and `scripts/`, then runs the tests in `test/` with Node's built-in test runner. GitHub Actions runs the same check on every push and pull request. For a deployment smoke test, create a menu, add a dish and photo, save a draft, and verify that its link is unavailable before publishing. Publish it, open the guest link in a signed-out browser, and verify the QR. Change the draft without publishing and confirm the guest menu still shows the last published version. With the API key set, check one menu import and both photo backgrounds with images you can use.

The demo photos in `public/images` are from [Unsplash](https://unsplash.com/license), resized to 1200 px: [pasta](https://images.unsplash.com/photo-1551183053-bf91a1d81141), [pesto](https://images.unsplash.com/photo-1473093295043-cdd812d0e601), [salad](https://images.unsplash.com/photo-1547592180-85f173990554), [tagliata](https://images.unsplash.com/photo-1432139555190-58524dae6a55), [tiramisu](https://images.unsplash.com/photo-1571877227200-a0d98ea607e9), [pannacotta](https://images.unsplash.com/photo-1488477181946-6428a0291777), [soup](https://images.unsplash.com/photo-1547592166-23ac45744acd), [bowl](https://images.unsplash.com/photo-1546069901-ba9599a7e63c), [buddha](https://images.unsplash.com/photo-1512621776951-a57141f2eefd), [eggtoast](https://images.unsplash.com/photo-1525351484163-7529414344d8), [pancakes](https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445), [frenchtoast](https://images.unsplash.com/photo-1484723091739-30a097e8f929), [doughnut](https://images.unsplash.com/photo-1551024601-bec78aea704b), [flatwhite](https://images.unsplash.com/photo-1541167760496-1628856ab772), [cappuccino](https://images.unsplash.com/photo-1509042239860-f550ce710b93), [negroni](https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b), [oldfashioned](https://images.unsplash.com/photo-1470337458703-46ad1756a187), [spritz](https://images.unsplash.com/photo-1536935338788-846bb9981813).
