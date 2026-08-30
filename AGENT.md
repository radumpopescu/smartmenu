# SmartMenu — Agent Guide

## What this product is

**SmartMenu** is a restaurant menu platform with two surfaces:

1. **Admin** — Authenticated back office for a restaurant owner or staff.
2. **Public menu** — Mobile-first customer site at `/{restaurantSlug}`.

The goal is to go from a paper/photo menu and rough dish photos to a polished, publishable digital menu with minimal manual work.

## Core workflows

### 1. Menu import from image (Grok)

- Upload a photo or scan of an existing menu (PDF page export, chalkboard, laminated card, etc.).
- The image is sent to **xAI Grok** (vision) with a structured extraction prompt.
- Output: categories, dish names, descriptions, prices, and any notes (allergens, size variants) as editable JSON before save.
- Admin reviews, edits, and commits items to the database.

### 2. Dish photo enhancement (manual first, API optional)

**Preferred workflow (no tokens):**

- Upload original dish photo in admin.
- Copy dish prompt from Products page (loaded from `prompts/dish-enhancement.txt`).
- Run manually in **Gemini** (or any editor): attach original, paste prompt, download result.
- Upload result via **Upload enhanced** → sets `enhancedImageUrl`.

**Optional API workflow:**

- Same prompt, sent automatically via **Nano Banana (Gemini)** or **OpenAI** when API keys are set (uses tokens).

The prompt instructs the model to keep the **same dish** (no AI slop) and only improve lighting, color, sharpness, background, and framing.

- Store `originalImageUrl` and `enhancedImageUrl`; public menu prefers enhanced when present.

### 3. Public menu

- Each restaurant has a unique **slug** (e.g. `/bistro-luna`).
- Mobile-first layout: category navigation, full-bleed dish imagery, typography-led cards (not a boring left-thumb / right-text list).
- Shows name, description, price, dietary tags, and hero image per item.

## Architecture (high level)

The codebase follows the **Edge Monolith** pattern in `docs/edge-monolith-blueprint.html`,
adapted to a single npm package. Cloudflare deployment is **not** in scope yet — the
point of the structure is that adopting it later is a driver swap, not a rewrite.

```
                 ┌──────────────── two entry paths ────────────────┐
   HTTP ────▶ Hono router ──▶ middleware ──▶┐
                                            ├──▶ controller ──▶ service ──▶ D1/SQLite
   RSC  ────▶ withServices() ───────────────┘         │            │
   server action                                      │            └─ policy (pure)
                                                      └─ DTO (wire shape)
```

### Layers, and what each may not do

| Layer | Location | Rule |
|-------|----------|------|
| route | `src/server/http/routes/` | Parse input, call one controller method, shape the response. No business logic, no DB. |
| middleware | `src/server/http/middleware.ts` | Context, auth guards. **Never the sole place authorization happens.** |
| controller | `src/server/controllers/` | Orchestrates a use case; resolves the active store. Takes an `Actor`, never a bare user id. |
| service | `src/server/services/` | The business logic. Stateless, built via `make(ctx)`. Owns all DB access. |
| policy | `src/server/policies/` | Pure `(actor, resource) -> boolean`. No I/O. |
| dto | `src/server/dto/` | Explicit wire shapes. Rows are never serialized directly. |

### The rule that prevents privilege escalation

Business logic is reachable **two ways**: over HTTP, and in-process from a server
component via `withServices()`. The in-process path never runs route middleware, so a
check that lives only there is absent for half the callers.

**Scopes are enforced inside the service method**, via `requireStoreScope(actor, storeId, scope)`
in `src/server/services/guard.ts`. Route middleware is kept as defense in depth and for a
clean 403 envelope — it is the second line, not the line. `/api/stores` demonstrates this:
its route only requires auth, and an operator is still refused by the service.

### The actor

`src/server/actor.ts` models the caller as a discriminated union, so "logged out" can
never be confused with "logged in but unprivileged". It carries `storeIds`, which is what
lets policies stay pure — no policy reaches for the database to answer "may they touch
this store".

### The error envelope

Every failure is `{ error: { code, message, detail? } }` with a SCREAMING_SNAKE_CASE code
(`src/server/errors.ts`). Throw `AppError`; never hand-roll a response body. Field issues
go through the single `validationFailed()` serializer. The browser maps codes to text in
`src/shared/api-error.ts` — call `readError(res, fallback)`, which always returns a
string, so an envelope object can never reach JSX.

### The client-safe boundary

`src/shared/` may be imported by browser components: pure types (`types.ts`), Zod schemas
shared by form and endpoint (`schemas.ts`), the error mapper, and display helpers. It must
never import from `src/server/` or `src/db/`. `src/server/` is server-only.

### Database portability

Services depend on `Database` in `src/server/db.ts` — the *base* Drizzle SQLite type in
both sync and async modes, not the better-sqlite3 client. Local dev binds better-sqlite3;
D1 would bind the async driver. Two rules keep that true:

1. **No `db.transaction()`.** D1 has no interactive transactions. Write sequential awaited
   statements. (The pre-migration code passed un-executed query builders into a sync
   transaction callback, which silently wrote nothing — product and category reordering
   never persisted.)
2. **No driver escape hatches** (`.run()`, `sqlite.pragma`, the raw handle) outside `src/db`.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 App Router |
| HTTP API | Hono, mounted at `app/api/[[...route]]` |
| DB | Drizzle ORM + SQLite (`better-sqlite3`); D1-portable |
| Auth | Auth.js (credentials) for admin |
| Menu OCR | xAI Grok API (`grok-4.3` with image, override via `XAI_MODEL`) |
| Image enhance | `nano-banana` → Gemini image API; `openai` → OpenAI Images |
| Styling | Tailwind CSS v4, custom editorial public theme |

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Session signing |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed admin (dev) |
| `XAI_API_KEY` | Grok menu extraction |
| `XAI_MODEL` | Grok model (default `grok-4.3`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Nano Banana / Gemini image |
| `OPENAI_API_KEY` | Optional OpenAI image enhancement |
| `DATABASE_URL` | Optional; defaults to `file:./data/smartmenu.db` |

## Admin routes

| Path | Purpose |
|------|---------|
| `/admin/login` | Sign in |
| `/admin` | Dashboard |
| `/admin/restaurant` | Restaurant profile & slug |
| `/admin/import` | Upload menu image → Grok extract |
| `/admin/products` | List/edit dishes, upload & enhance photos |
| `/admin/publish` | Preview public URL |

## HTTP API

The entire API is one Next route (`src/app/api/[[...route]]/route.ts`) that hands off to
Hono. `/api/auth/*` stays on NextAuth's own more-specific catch-all and never reaches it.

| Path | Scope required |
|------|----------------|
| `/api/products*` | `products.read` at the route, `products.write` in the service for mutations |
| `/api/categories*` | `products.read` at the route, `categories.write` in the service |
| `/api/store` | `store.read` / `store.write` |
| `/api/stores` | auth at the route, **`admin.stores.write` in the service** |
| `/api/users*` | `admin.users.write` |
| `/api/menu/import*` | `menu.import` |
| `/api/session/store` | auth; validates access before setting the cookie |
| `/api/prompts` | auth (was public before the migration) |
| `/api/dev/users` | development only |

## Public routes

| Path | Purpose |
|------|---------|
| `/[slug]` | Live menu for restaurant |
| `/[slug]/item/[id]` | Optional deep link to one dish |

## Data model (summary)

> Note the naming split: the TS table is `stores` but the SQL table is still
> `restaurants`, and `categories` / `menu_items` still carry `restaurant_id` columns while
> the TS fields are `storeId`. Matters when writing raw SQL.

- **users** — admin accounts
- **restaurants** — name, slug, description, branding
- **categories** — ordered sections (Starters, Mains, …)
- **menu_items** — name, description, priceCents, images, tags, sort order

## Git workflow (required)

After **any** development work in this repo (features, fixes, refactors, docs tied to the app):

1. `git status` — confirm what changed; do not commit `.env`, `llm.log`, `data/`, or `public/uploads/`.
2. `git add` only intentional files.
3. **`git commit`** with a clear message (what + why).
4. **`git push`** to `origin` when the remote exists and the user expects work to be saved.

Do not end a task with a dirty working tree unless the user explicitly asked to leave changes uncommitted.

## Agent implementation notes

- Always validate Grok JSON before insert; never trust raw LLM output.
- Image enhancement prompts must emphasize **fidelity** over creativity.
- Public UI: prefer CSS grid / overlapping type, large imagery, sticky category chips — avoid generic “list row” patterns.
- Uploads live under `public/uploads/` or blob storage in production.
- When API keys are missing, show clear admin errors; public site still renders cached menu.
- All LLM/API calls append to **`llm.log`**: full **prompts** (from `prompts/*.txt`), sanitized inputs/outputs, token usage, estimated `cost_usd`. Override path via `LLM_LOG_PATH`. File is gitignored.
- **Editable prompts** live in `prompts/` (not hardcoded). Loader: `src/lib/prompts.ts`. Restart dev server after edits.
- **Never add a scope check only to a route.** Put it in the service method; see "The rule that prevents privilege escalation".
- **Never call `db.transaction()`.** See "Database portability".
- **Never widen a DTO to a raw row.** If a component needs a new field, add it to `src/shared/types.ts` and map it in `src/server/dto/`.
- **Data migrations do not belong in a render path.** Use `src/scripts/` and an npm script (e.g. `npm run db:backfill-images`).
- Run the app with the `run-smartmenu` skill; `npm rebuild better-sqlite3` after any Node version change.

## Roles & stores

| Role | Access |
|------|--------|
| **superadmin** | All stores, `/admin/stores`, `/admin/users`, full menu tools on active store |
| **operator** | Only assigned stores (via `user_stores`), menu tools on active store |

Active store is stored in cookie `smartmenu_active_store`. Dev login: dropdown on `/admin/login` (`dev-login` provider, development only).

## Out of scope (v1)

- Multi-restaurant SaaS billing
- POS / ordering / payments
- QR code generator (easy follow-up)
- i18n (structure ready via description fields)

## Success criteria

1. Admin can log in, import a menu photo, and see structured items.
2. Admin can enhance a dish photo with either provider and see before/after.
3. Public `/{slug}` looks intentional on phone width and lists all published items.