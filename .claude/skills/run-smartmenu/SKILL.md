---
name: run-smartmenu
description: Launch and drive the SmartMenu Next.js app locally — dev server, admin sign-in, public menu. Use when asked to run, start, preview, or screenshot the app, or to confirm a change works in the real app rather than only in tests or a typecheck.
---

# Running SmartMenu

Next.js 15/16 App Router + Drizzle + better-sqlite3. Local-only; no
containers, no external services required to boot. AI features (Grok
import, Gemini/OpenAI enhance) need API keys but are not needed to run
the app.

## 0. Preflight: rebuild the native module if Node changed

`better-sqlite3` is a native addon. If the committed binary was built
against a different Node ABI than the one in your shell, **every
DB-backed route fails** and `npm run build` dies with
`Failed to collect page data for /api/products/[id]/upload`.

Symptom in the log:

```
The module '.../better_sqlite3.node' was compiled against a different
Node.js version using NODE_MODULE_VERSION 131. This version of Node.js
requires NODE_MODULE_VERSION 127.
```

Fix — takes ~20s, changes nothing tracked in git:

```bash
npm rebuild better-sqlite3
```

Run this whenever you switch Node versions (nvm/asdf/Homebrew upgrade).
Node 22 = ABI 127, Node 23 = ABI 131.

## 1. Start the dev server

Use `preview_start` with the `smartmenu-dev` config in
`.claude/launch.json` — never a raw `Bash` `npm run dev`.

**Port 3000 is usually occupied by an unrelated project on this
machine** (a different next-server that redirects to `/en`). The launch
config sets `"autoPort": true`, so the preview grabs a free port and
reports it. Read the assigned port out of the result; don't assume 3000.

Nothing in SmartMenu hardcodes a port — there are no OAuth callbacks or
webhooks — so a random port is fine. Auth.js infers its origin from the
request.

## 2. Sign in (no password needed)

`/admin/*` is gated by `src/middleware.ts`, which redirects anonymous
requests to `/admin/login`.

The login page has a **Dev quick login** block: a user dropdown plus a
"Sign in as selected user" button, backed by the `dev-login` credentials
provider in `src/auth.ts`. It authorizes by user id, so no password is
typed. It is hard-gated — `authorize()` returns `null` unless
`NODE_ENV === "development"` — so it cannot be reached in production.

Click "Sign in as selected user" with the default selection to land as
superadmin. Seeded accounts:

| Email | Role |
|---|---|
| `admin@example.com` | superadmin — all stores, `/admin/stores`, `/admin/users` |
| `operator@example.com` | operator — only stores assigned via `user_stores` |

If the dropdown is empty the DB has not been seeded — run `npm run db:seed`.

## 3. Where to look

Seeded stores (slug is the public URL):

| Path | What it shows |
|---|---|
| `/bistro-luna` | Public menu — collage layout, 4 items, 2 categories |
| `/bread-n-spices` | Second store — 4 categories, different `accentColor`; good for testing the store switcher and per-store theming |
| `/admin` | Dashboard — item counts, active-store name |
| `/admin/products` | The complex screen: dnd-kit category board, product modal |
| `/admin/import` | Grok menu extraction (needs `XAI_API_KEY`) |

Active store lives in the `smartmenu_active_store` cookie; switch it
with the sidebar dropdown.

## 4. Drive it, don't just boot it

A screenshot of a booted server proves nothing. Minimum smoke run:

1. `/bistro-luna` → screenshot. Expect the serif "Bistro Luna" header,
   category chips ("To Start" / "Mains"), and a real dish photo. Grey
   boxes where photos belong mean `public/uploads/` is missing (it is
   gitignored and never cloned) — the menu still renders, so this is
   not a launch failure.
2. `/admin/login` → dev quick login → expect `/admin` dashboard.
3. `/admin/products` → expect the category board with draggable cards.
4. `read_console_messages` with `onlyErrors` → expect none.

## 5. Gotchas

- **Don't `curl localhost:3000` to check if it's up** — that's the other
  project. Use the port `preview_start` returned.
- Editing anything in `prompts/*.txt` requires a dev-server restart;
  `src/lib/prompts.ts` reads from disk but Next caches the module.
- The DB is a real file at `data/smartmenu.db` (WAL mode, gitignored).
  Admin actions you take while driving **persist**. Don't delete
  products to "test delete" unless you intend to lose seed data.
- `npm run lint` and `npx tsc --noEmit` both pass; lint reports 3
  `react-hooks/set-state-in-effect` errors that are prop→state resets,
  not launch blockers.
- The whole HTTP API is one Hono app behind `/api/[[...route]]`. To probe it
  while signed in, run `fetch()` from the page via the browser JS tool rather
  than `curl` — the session is an httpOnly cookie.
- Errors come back as `{error:{code,message,detail?}}`. A 403 with
  `Missing required scope: …` means the *service* refused, which is the
  intended enforcement point, not a bug in the route.
