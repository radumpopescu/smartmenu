# Operations

This page lists the queries the owner runs against the D1 database to answer common questions about usage, cost and menu history. Run them with Wrangler. Use `--remote` for production and `--local` for the local database:

```sh
npx wrangler d1 execute DB --remote --command "SELECT …"
```

Timestamps are milliseconds since 1970 in UTC. `created_at / 1000` with `'unixepoch'` turns them into dates.

## What is recorded

- `ai_calls` has one row per model call: `account_id`, `menu_id`, `feature` (`assistant`, `import`, `photo`, `voice`, `voice_transcript`; rows before migration `0004` said `agent` and were renamed), `provider` (`xai`, `openai`), `model`, `status` (`ok`, `error`, or the provider's status such as `incomplete`), `input_tokens`, `output_tokens`, `cached_tokens`, `reasoning_tokens`, `audio_input_tokens`, `audio_output_tokens`, the provider's `usage` object as JSON, `duration_ms`, a short `error`, `cost_micros` (millionths of a dollar, from the prices in `src/models.js` when the call was made), `request` and `response` (compact text, at most 16,000 characters, never images) and `call_ref` (the OpenAI call id for voice). `cost_micros` is empty for rows written before `0004`, for failed calls without usage and for models missing from the catalog.
- Voice rows are reported by the browser, not by OpenAI: their `usage` has `"client_reported": true` and `duration_ms` is 0. `voice` rows are model responses; `voice_transcript` rows are the transcription of what the owner said. `voice_calls` holds each started session: the call id, account, menu, model and how many usage reports it sent.
- What `request` and `response` hold: for `assistant`, the owner's message and the reply with its operations as JSON; for `import`, the page's type and size and the extracted sections as JSON; for `photo`, the look and source photo id and the result photo id; for `voice`, what was heard and the reply with its operations; for `voice_transcript`, the transcript in `response`.
- `settings` holds the explicit model choice per feature as `{ "provider", "model" }` JSON, with who set it and when.
- `events` has one row per action: `signup`, `signin`, `menu_created`, `published`, `restored`, `photo_uploaded`, `photo_edit_requested`, `photo_edit_finished`, `menu_imported`, `assistant_asked`, `voice_started` and `voice_failed`, with the account, the menu and a small JSON `detail`.
- `revisions` has the whole draft of every save: `menu_id`, `account_id`, `source` (`manual`, `agent`, `import`, `restore`), `summary`, `published`, `restored_from` and `created_at`.
- `usage` has the daily quota counters per account and feature.

Admins see the same data on `/admin`: `GET /api/admin/usage?days=30` for totals and `GET /api/admin/calls` for the request log.

## Cost per account per month

```sql
SELECT strftime('%Y-%m', ai_calls.created_at / 1000, 'unixepoch') AS month, accounts.email,
  COUNT(*) AS calls, ROUND(SUM(cost_micros) / 1e6, 4) AS usd, SUM(cost_micros IS NULL) AS unpriced
FROM ai_calls LEFT JOIN accounts ON accounts.id = ai_calls.account_id
GROUP BY month, ai_calls.account_id
ORDER BY month DESC, usd DESC;
```

## Cost per feature and model

```sql
SELECT feature, provider, model, COUNT(*) AS calls, SUM(status != 'ok') AS failed,
  ROUND(SUM(cost_micros) / 1e6, 4) AS usd, ROUND(AVG(cost_micros) / 1e6, 6) AS usd_per_call,
  SUM(input_tokens) AS input, SUM(cached_tokens) AS cached, SUM(output_tokens) AS output,
  SUM(audio_input_tokens) AS audio_in, SUM(audio_output_tokens) AS audio_out
FROM ai_calls
WHERE created_at >= (unixepoch('now', '-30 days') * 1000)
GROUP BY feature, provider, model
ORDER BY usd DESC;
```

## Average cost per assistant request, imported page and voice session

One assistant request and one imported page are one row each:

```sql
SELECT feature, model, COUNT(*) AS requests, ROUND(AVG(cost_micros) / 1e6, 6) AS avg_usd
FROM ai_calls
WHERE feature IN ('assistant', 'import') AND status = 'ok' AND cost_micros IS NOT NULL
  AND created_at >= (unixepoch('now', '-30 days') * 1000)
GROUP BY feature, model;
```

A voice session is every `voice` and `voice_transcript` row with the same `call_ref`:

```sql
SELECT model, COUNT(*) AS sessions, ROUND(AVG(usd), 6) AS avg_usd, ROUND(MAX(usd), 6) AS max_usd, ROUND(AVG(responses), 1) AS avg_responses
FROM (
  SELECT call_ref, MAX(CASE WHEN feature = 'voice' THEN model END) AS model,
    SUM(cost_micros) / 1e6 AS usd, SUM(feature = 'voice') AS responses
  FROM ai_calls
  WHERE feature IN ('voice', 'voice_transcript') AND created_at >= (unixepoch('now', '-30 days') * 1000)
  GROUP BY call_ref
)
GROUP BY model;
```

Sessions that were started but never reported usage are in `voice_calls` with `reports = 0`.

## Reading a stored request and response

List the newest calls of a feature, then read one in full:

```sql
SELECT id, datetime(created_at / 1000, 'unixepoch') AS at, model, status, cost_micros, substr(request, 1, 80) AS request
FROM ai_calls WHERE feature = 'assistant' ORDER BY id DESC LIMIT 20;

SELECT request, response, usage, error FROM ai_calls WHERE id = 123;
```

`response` is JSON for the assistant, import and voice; `json_extract(response, '$.reply')` and `json_array_length(response, '$.ops')` pick out the reply and the number of proposed operations. Comparing two models on the same request is a matter of finding rows with the same `request`:

```sql
SELECT request, model, cost_micros, json_extract(response, '$.reply') AS reply, json_array_length(response, '$.ops') AS ops
FROM ai_calls WHERE feature = 'assistant' AND request IN
  (SELECT request FROM ai_calls WHERE feature = 'assistant' GROUP BY request HAVING COUNT(DISTINCT model) > 1)
ORDER BY request, model;
```

## Which model each feature uses

```sql
SELECT key AS feature, json_extract(value, '$.provider') AS provider, json_extract(value, '$.model') AS model,
  datetime(updated_at / 1000, 'unixepoch') AS since, accounts.email AS set_by
FROM settings LEFT JOIN accounts ON accounts.id = settings.updated_by;
```

A feature without a row uses the default described in the README. Change it from `/admin`; deleting the row (`DELETE FROM settings WHERE key = 'assistant'`) is the same as "Reset".

## Assistant requests per day

```sql
SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS requests,
  COUNT(DISTINCT account_id) AS accounts, SUM(status != 'ok') AS failed,
  ROUND(AVG(duration_ms)) AS avg_ms, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
  ROUND(SUM(cost_micros) / 1e6, 4) AS usd
FROM ai_calls WHERE feature = 'assistant'
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

The `ADMIN_EMAILS` secret (`npx wrangler secret put ADMIN_EMAILS`, or `.dev.vars` locally) lists the accounts allowed to open `/admin`, change the model settings and read the usage report and request log. Daily quota use per account:

```sql
SELECT day, accounts.email, feature, count FROM usage
JOIN accounts ON accounts.id = usage.account_id
ORDER BY day DESC, count DESC LIMIT 50;
```

The limits per account per day are 150 uploads, 30 imports, 25 photo edits, 200 assistant requests and 40 voice sessions. They are set in `src/worker.js`.
