# SmartMenu

SmartMenu is a Cloudflare Workers app for creating and publishing restaurant menus. The staff studio has a live guest preview, photo imports, editable sections and dishes, menu design controls, and printable QR codes. Guests browse the published menu without an account.

## Project docs

- [Product vision and workflows](docs/product.md)
- [Finding the first restaurant customers](docs/restaurant-sales.md)
- [Implementation and deployment status](docs/implementation.md)
- [Build plan for templates and the guest menu](docs/plan.md)

## Run locally

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Open [the local studio](http://localhost:8787) and create an account with the signup code in `.dev.vars`. Four demo menus, one per template, are available without signing in: [Osteria](http://localhost:8787/m/demo-osteria), [Carta](http://localhost:8787/m/demo-carta), [Mercato](http://localhost:8787/m/demo-mercato) and [Notte](http://localhost:8787/m/demo-notte). The old `/m/osteria-verde-example` link shows the Osteria demo.

`npm run db:local` applies every migration in `migrations/`. Run it again after pulling a new migration.

Set `OPENAI_API_KEY` in `.dev.vars` to enable menu extraction and photo edits. The manual editor, original photo uploads, publishing, and QR codes work without the key. Menu extraction handles one page at a time and merges sections with the same name. Review text and prices before publishing. Photo edits run in a queue and can use a neutral tabletop or a transparent background. Compare the original and edited images before selecting one.

## Deploy to Cloudflare

1. Run `npx wrangler login` and select the Cloudflare account you want to use. Enable R2 on that account.
2. Create the D1 database with `npx wrangler d1 create smartmenu`. Add the returned `database_id` to the `DB` entry in `wrangler.jsonc`. Create the bucket with `npx wrangler r2 bucket create smartmenu-photos` and the queue with `npx wrangler queues create smartmenu-photo-jobs`. Use your chosen names in the config if these names are taken.
3. Run `npx wrangler d1 migrations apply DB --remote` and `npm run deploy`.
4. Run `npx wrangler secret put SIGNUP_CODE` with a strong private signup code. Run `npx wrangler secret put OPENAI_API_KEY` with the AI project's key. Accounts can be created only when the signup code is set and supplied. Existing accounts can sign in when signup is closed.
5. Set `PUBLIC_ORIGIN` in the `vars` of `wrangler.jsonc` to the guest hostname, for example `https://menu.example.com`, before distributing QR codes. QR codes and canonical links use it. When it is empty, they use the hostname of the request, so a code downloaded from a preview or `workers.dev` hostname would point there. Republishing preserves the menu’s slug.

Use separate bindings and secrets for staging and production. Account-level daily quotas apply to uploads, menu extraction, and photo edits. The Worker uses a Cloudflare rate-limit binding for signup and sign-in. D1 holds accounts, sessions, drafts, published snapshots and job status. R2 is private, with the Worker serving only currently published images to guests. The Worker renders the guest page at `/m/:slug` as one HTML response with the template's CSS inline, and caches it, guest menu data and public images at the edge. Published changes can take up to a minute to appear at every edge location. The queue limits concurrent image edits and retries failed jobs. Menu updates use a version check to prevent an older browser tab from overwriting a newer draft.

Current scope is a single owner account per menu. Staff invitations, password recovery, billing, storage lifecycle cleanup, and measured capacity limits are future work.

## Checks

Run `npm run check` and `npx wrangler deploy --dry-run`. `npm run check` parses every script in `src/`, `public/` and `public/guest/`, then runs the tests in `test/` with Node's built-in test runner. GitHub Actions runs the same check on every push and pull request. For a deployment smoke test, create a menu, add a dish and photo, save a draft, and verify that its link is unavailable before publishing. Publish it, open the guest link in a signed-out browser, and verify the QR. Change the draft without publishing and confirm the guest menu still shows the last published version. With the API key set, check one menu import and both photo backgrounds with images you can use.

The demo photos in `public/images` are from [Unsplash](https://unsplash.com/license), resized to 1200 px: [pasta](https://images.unsplash.com/photo-1551183053-bf91a1d81141), [pesto](https://images.unsplash.com/photo-1473093295043-cdd812d0e601), [salad](https://images.unsplash.com/photo-1547592180-85f173990554), [tagliata](https://images.unsplash.com/photo-1432139555190-58524dae6a55), [tiramisu](https://images.unsplash.com/photo-1571877227200-a0d98ea607e9), [pannacotta](https://images.unsplash.com/photo-1488477181946-6428a0291777), [soup](https://images.unsplash.com/photo-1547592166-23ac45744acd), [bowl](https://images.unsplash.com/photo-1546069901-ba9599a7e63c), [buddha](https://images.unsplash.com/photo-1512621776951-a57141f2eefd), [eggtoast](https://images.unsplash.com/photo-1525351484163-7529414344d8), [pancakes](https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445), [frenchtoast](https://images.unsplash.com/photo-1484723091739-30a097e8f929), [doughnut](https://images.unsplash.com/photo-1551024601-bec78aea704b), [flatwhite](https://images.unsplash.com/photo-1541167760496-1628856ab772), [cappuccino](https://images.unsplash.com/photo-1509042239860-f550ce710b93), [negroni](https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b), [oldfashioned](https://images.unsplash.com/photo-1470337458703-46ad1756a187), [spritz](https://images.unsplash.com/photo-1536935338788-846bb9981813).
