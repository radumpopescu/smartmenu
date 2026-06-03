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

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Admin (auth)   │────▶│  Next.js API     │────▶│  SQLite + files │
│  import/enhance │     │  Grok / Gemini / │     │  (uploads)      │
│  CRUD menu      │     │  OpenAI          │     └─────────────────┘
└─────────────────┘     └──────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  Public menu     │
                          │  /[slug]         │
                          └──────────────────┘
```

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router |
| DB | Drizzle ORM + SQLite (`better-sqlite3`) |
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

## Public routes

| Path | Purpose |
|------|---------|
| `/[slug]` | Live menu for restaurant |
| `/[slug]/item/[id]` | Optional deep link to one dish |

## Data model (summary)

- **users** — admin accounts
- **restaurants** — name, slug, description, branding
- **categories** — ordered sections (Starters, Mains, …)
- **menu_items** — name, description, priceCents, images, tags, sort order

## Agent implementation notes

- Always validate Grok JSON before insert; never trust raw LLM output.
- Image enhancement prompts must emphasize **fidelity** over creativity.
- Public UI: prefer CSS grid / overlapping type, large imagery, sticky category chips — avoid generic “list row” patterns.
- Uploads live under `public/uploads/` or blob storage in production.
- When API keys are missing, show clear admin errors; public site still renders cached menu.
- All LLM/API calls append to **`llm.log`**: full **prompts** (from `prompts/*.txt`), sanitized inputs/outputs, token usage, estimated `cost_usd`. Override path via `LLM_LOG_PATH`. File is gitignored.
- **Editable prompts** live in `prompts/` (not hardcoded). Loader: `src/lib/prompts.ts`. Restart dev server after edits.

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