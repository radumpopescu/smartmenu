# SmartMenu

AI-powered restaurant menu builder: import menus from photos (Grok), enhance dish images (Nano Banana / OpenAI), publish a mobile-first public menu.

See [AGENT.md](./AGENT.md) for product and architecture details for coding agents.

## Quick start

```bash
cp .env.example .env
# Add AUTH_SECRET and API keys as needed

npm install
npm run db:seed
npm run dev
```

- **Admin:** http://localhost:3000/admin (default `admin@example.com` / `changeme`)
- **Demo menu:** http://localhost:3000/bistro-luna

## Environment

| Variable | Required for |
|----------|----------------|
| `AUTH_SECRET` | Sessions |
| `XAI_API_KEY` | Menu import from images |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Nano Banana dish photos |
| `OPENAI_API_KEY` | OpenAI dish photos (optional) |

## Prompts

Edit text files under **`prompts/`** (no code changes needed):

| File | Used for |
|------|----------|
| `menu-extraction-system.txt` | Grok system prompt for menu OCR |
| `menu-extraction-user.txt` | Grok user instruction |
| `dish-enhancement.txt` | Dish photo enhancement (manual + API) |

Restart `npm run dev` after editing. The exact prompt text sent on each call is recorded in `llm.log`.

## LLM logging

Every Grok menu extraction (and optional API image enhance) appends to **`llm.log`**: timestamp, model, **full prompts**, sanitized input/output, token usage, and estimated cost in USD. Set `LLM_LOG_PATH` to change the file location.

## Scripts

- `npm run dev` — development server
- `npm run db:seed` — create tables, admin user, demo restaurant
- `npm run build` — production build