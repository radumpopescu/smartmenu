# SmartMenu

SmartMenu is a Cloudflare Workers app for creating and publishing restaurant menus. The staff studio has a live guest preview, photo imports, editable sections and dishes, menu design controls, and printable QR codes. Guests browse the published menu without an account.

## Project docs

- [Product vision and workflows](docs/product.md)
- [Finding the first restaurant customers](docs/restaurant-sales.md)
- [Implementation and deployment status](docs/implementation.md)

## Run locally

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Open [the local studio](http://localhost:8787) and create an account with the signup code in `.dev.vars`. The [sample menu](http://localhost:8787/m/osteria-verde-example) is available without signing in.

Set `OPENAI_API_KEY` in `.dev.vars` to enable menu extraction and photo edits. The manual editor, original photo uploads, publishing, and QR codes work without the key. Menu extraction handles one page at a time and merges sections with the same name. Review text and prices before publishing. Photo edits run in a queue and can use a neutral tabletop or a transparent background. Compare the original and edited images before selecting one.

## Deploy to Cloudflare

1. Run `npx wrangler login` and select the Cloudflare account you want to use. Enable R2 on that account.
2. Create the D1 database with `npx wrangler d1 create smartmenu`. Add the returned `database_id` to the `DB` entry in `wrangler.jsonc`. Create the bucket with `npx wrangler r2 bucket create smartmenu-photos` and the queue with `npx wrangler queues create smartmenu-photo-jobs`. Use your chosen names in the config if these names are taken.
3. Run `npx wrangler d1 migrations apply DB --remote` and `npm run deploy`.
4. Run `npx wrangler secret put SIGNUP_CODE` with a strong private signup code. Run `npx wrangler secret put OPENAI_API_KEY` with the AI project's key. Accounts can be created only when the signup code is set and supplied. Existing accounts can sign in when signup is closed.
5. Set the final guest hostname before distributing QR codes. A QR code uses the hostname from which it was downloaded and the menu’s stable slug. Republishing preserves that slug.

Use separate bindings and secrets for staging and production. Account-level daily quotas apply to uploads, menu extraction, and photo edits. The Worker uses a Cloudflare rate-limit binding for signup and sign-in. D1 holds accounts, sessions, drafts, published snapshots and job status. R2 is private, with the Worker serving only currently published images to guests. The Worker caches guest menu data and public images at the edge. Published changes can take up to a minute to appear at every edge location. The queue limits concurrent image edits and retries failed jobs. Menu updates use a version check to prevent an older browser tab from overwriting a newer draft.

Current scope is a single owner account per menu. Staff invitations, password recovery, billing, storage lifecycle cleanup, and measured capacity limits are future work.

## Checks

Run `npm run check` and `npx wrangler deploy --dry-run`. For a deployment smoke test, create a menu, add a dish and photo, save a draft, and verify that its link is unavailable before publishing. Publish it, open the guest link in a signed-out browser, and verify the QR. Change the draft without publishing and confirm the guest menu still shows the last published version. With the API key set, check one menu import and both photo backgrounds with images you can use.

Sample photos are from [Unsplash](https://unsplash.com/license). The [pasta](https://images.unsplash.com/photo-1551183053-bf91a1d81141), [pesto](https://images.unsplash.com/photo-1473093295043-cdd812d0e601) and [salad](https://images.unsplash.com/photo-1547592180-85f173990554) are bundled as example assets.
