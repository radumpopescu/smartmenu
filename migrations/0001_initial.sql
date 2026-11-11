CREATE TABLE accounts (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE menus (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id),
  slug TEXT NOT NULL UNIQUE, draft TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  published TEXT, published_at INTEGER
);
CREATE INDEX menus_owner ON menus(owner_id);
CREATE TABLE photos (
  id TEXT PRIMARY KEY, menu_id TEXT NOT NULL REFERENCES menus(id),
  mime TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX photos_menu ON photos(menu_id);
CREATE TABLE photo_jobs (
  id TEXT PRIMARY KEY, menu_id TEXT NOT NULL REFERENCES menus(id),
  source_id TEXT NOT NULL REFERENCES photos(id),
  background TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
  result_id TEXT REFERENCES photos(id), updated_at INTEGER NOT NULL
);
CREATE TABLE usage (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  feature TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY(account_id, feature, day)
);
