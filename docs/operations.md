# Operations

This page lists the queries the owner runs against the D1 database to answer common questions about usage, cost and menu history. Run them with Wrangler. Use `--remote` for production and `--local` for the local database:

```sh
npx wrangler d1 execute DB --remote --command "SELECT …"
```

Timestamps are milliseconds since 1970 in UTC. `created_at / 1000` with `'unixepoch'` turns them into dates.

## What is recorded

- `ai_calls` has one row per model call: `account_id`, `menu_id`, `feature` (`agent`, `import`, `photo`), `provider` (`xai`, `openai`), `model`, `status` (`ok`, `error`, or the provider's status such as `incomplete`), `input_tokens`, `output_tokens`, `cached_tokens`, `reasoning_tokens`, the provider's full `usage` object as JSON, `duration_ms` and a short `error`. Token columns are empty when the provider reported no usage, which is the case for failed calls and for xAI image edits.
- `events` has one row per action: `signup`, `signin`, `menu_created`, `published`, `restored`, `photo_uploaded`, `photo_edit_requested`, `photo_edit_finished`, `menu_imported` and `assistant_asked`, with the account, the menu and a small JSON `detail`.
- `revisions` has the whole draft of every save: `menu_id`, `account_id`, `source` (`manual`, `agent`, `import`, `restore`), `summary`, `published`, `restored_from` and `created_at`.
- `usage` has the daily quota counters per account and feature.

## Tokens per account per feature per month

```sql
SELECT strftime('%Y-%m', ai_calls.created_at / 1000, 'unixepoch') AS month, accounts.email, feature, provider, model,
  COUNT(*) AS calls, SUM(status != 'ok') AS failed,
  SUM(input_tokens) AS input, SUM(cached_tokens) AS cached, SUM(output_tokens) AS output
FROM ai_calls LEFT JOIN accounts ON accounts.id = ai_calls.account_id
GROUP BY month, ai_calls.account_id, feature, provider, model
ORDER BY month DESC, input + output DESC;
```

Signed-in admins get the same totals for the last N days from `GET /api/admin/usage?days=30`.

## Most expensive accounts

Prices are not stored, because they change. Put the current price per million tokens of each model in the `prices` list and the query applies them to every recorded call. The figures below are examples. Check the providers' pricing pages before relying on them. Cached input tokens are part of the input count, so the query charges them at the cached price and the rest at the full price. Image edits on OpenAI report image and text tokens together in `input_tokens`, so treat their cost as approximate. xAI image edits are billed per image and report no tokens, so they are priced per call.

```sql
WITH prices(model, input, cached, output, per_call) AS (VALUES
  ('grok-4.20-non-reasoning', 1.25, 0.20, 2.50, 0),
  ('grok-4.3', 1.25, 0.20, 2.50, 0),
  ('gpt-6-luna', 0.10, 0.01, 0.50, 0),
  ('gpt-image-2.5-sunburst', 8.00, 2.00, 30.00, 0),
  ('grok-imagine-image-2.0', 0, 0, 0, 0.04)
)
SELECT accounts.email,
  ROUND(SUM((COALESCE(input_tokens, 0) - COALESCE(cached_tokens, 0)) * prices.input
    + COALESCE(cached_tokens, 0) * prices.cached + COALESCE(output_tokens, 0) * prices.output) / 1e6
    + SUM(CASE WHEN status = 'ok' THEN prices.per_call ELSE 0 END), 4) AS usd,
  COUNT(*) AS calls
FROM ai_calls
JOIN prices ON prices.model = ai_calls.model
LEFT JOIN accounts ON accounts.id = ai_calls.account_id
WHERE ai_calls.created_at >= (unixepoch('now', '-30 days') * 1000)
GROUP BY ai_calls.account_id
ORDER BY usd DESC
LIMIT 20;
```

Calls to a model missing from `prices` are left out. This query lists them:

```sql
SELECT DISTINCT provider, model FROM ai_calls
WHERE model NOT IN ('grok-4.20-non-reasoning', 'grok-4.3', 'gpt-6-luna', 'gpt-image-2.5-sunburst', 'grok-imagine-image-2.0');
```

## Assistant requests per day

```sql
SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS requests,
  COUNT(DISTINCT account_id) AS accounts, SUM(status != 'ok') AS failed,
  ROUND(AVG(duration_ms)) AS avg_ms, SUM(input_tokens) AS input, SUM(output_tokens) AS output
FROM ai_calls WHERE feature = 'agent'
GROUP BY day ORDER BY day DESC LIMIT 30;
```

How many proposals were empty (the assistant asked a question or declined) is in the events:

```sql
SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS requests,
  SUM(json_extract(detail, '$.ops') = 0) AS without_changes
FROM events WHERE type = 'assistant_asked'
GROUP BY day ORDER BY day DESC LIMIT 30;
```

## A menu's history

Find the menu by its guest link or name:

```sql
SELECT menus.id, slug, json_extract(draft, '$.name') AS name, accounts.email, version, published_at
FROM menus JOIN accounts ON accounts.id = menus.owner_id
WHERE slug = 'osteria-test-1a2b3c4d5e6f' OR json_extract(draft, '$.name') LIKE '%Osteria%';
```

List its revisions, newest first:

```sql
SELECT id, datetime(created_at / 1000, 'unixepoch') AS at, source, summary, published, restored_from,
  json_array_length(draft, '$.sections') AS sections, length(draft) AS bytes
FROM revisions WHERE menu_id = '<menu id>' ORDER BY created_at DESC;
```

Read one revision's draft with `SELECT draft FROM revisions WHERE id = '<revision id>';`. The owner restores a revision from the studio's History tab, which calls `POST /api/menus/:id/revisions/:rid/restore`. A restore records a new revision and never deletes the later ones.

What happened to the menu, in order:

```sql
SELECT datetime(created_at / 1000, 'unixepoch') AS at, type, detail
FROM events WHERE menu_id = '<menu id>' ORDER BY created_at DESC LIMIT 100;
```

## Grants and quotas

`ADMIN_EMAILS` in `wrangler.jsonc` lists the accounts allowed to read the usage report. Daily quota use per account:

```sql
SELECT day, accounts.email, feature, count FROM usage
JOIN accounts ON accounts.id = usage.account_id
ORDER BY day DESC, count DESC LIMIT 50;
```

The limits per account per day are 150 uploads, 30 imports, 25 photo edits and 200 assistant requests. They are set in `src/worker.js`.
