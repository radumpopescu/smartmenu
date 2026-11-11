CREATE TABLE revisions (
  id TEXT PRIMARY KEY, menu_id TEXT NOT NULL REFERENCES menus(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  source TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0, restored_from TEXT,
  draft TEXT NOT NULL, started_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX revisions_menu ON revisions(menu_id, created_at);

CREATE TABLE events (
  id INTEGER PRIMARY KEY, created_at INTEGER NOT NULL,
  account_id TEXT, menu_id TEXT, type TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX events_account ON events(account_id, created_at);
CREATE INDEX events_menu ON events(menu_id, created_at);
CREATE INDEX events_type ON events(type, created_at);

CREATE TABLE ai_calls (
  id INTEGER PRIMARY KEY, created_at INTEGER NOT NULL,
  account_id TEXT, menu_id TEXT, feature TEXT NOT NULL,
  provider TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL,
  input_tokens INTEGER, output_tokens INTEGER, cached_tokens INTEGER, reasoning_tokens INTEGER,
  usage TEXT, duration_ms INTEGER NOT NULL, error TEXT
);
CREATE INDEX ai_calls_account ON ai_calls(account_id, created_at);
CREATE INDEX ai_calls_time ON ai_calls(created_at);

ALTER TABLE photo_jobs ADD COLUMN account_id TEXT;
ALTER TABLE photo_jobs ADD COLUMN look TEXT;
