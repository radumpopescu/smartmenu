CREATE TABLE settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL,
  updated_at INTEGER NOT NULL, updated_by TEXT
);

ALTER TABLE ai_calls ADD COLUMN cost_micros INTEGER;
ALTER TABLE ai_calls ADD COLUMN audio_input_tokens INTEGER;
ALTER TABLE ai_calls ADD COLUMN audio_output_tokens INTEGER;
ALTER TABLE ai_calls ADD COLUMN request TEXT;
ALTER TABLE ai_calls ADD COLUMN response TEXT;
ALTER TABLE ai_calls ADD COLUMN call_ref TEXT;
UPDATE ai_calls SET feature = 'assistant' WHERE feature = 'agent';
CREATE INDEX ai_calls_feature ON ai_calls(feature, id);

CREATE TABLE voice_calls (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
  menu_id TEXT NOT NULL REFERENCES menus(id), model TEXT NOT NULL,
  created_at INTEGER NOT NULL, reports INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX voice_calls_account ON voice_calls(account_id, created_at);

ALTER TABLE photo_jobs ADD COLUMN provider TEXT;
ALTER TABLE photo_jobs ADD COLUMN model TEXT;
