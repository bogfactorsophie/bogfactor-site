CREATE TABLE IF NOT EXISTS shows (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  mixcloud_path   TEXT NOT NULL,
  soundcloud_url  TEXT,
  aired_at        TEXT NOT NULL,
  duration_min    INTEGER,
  producer        TEXT,
  image_key       TEXT,
  is_published    INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shows_aired_at ON shows(aired_at DESC);

CREATE TABLE IF NOT EXISTS tracks (
  show_id   TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  artist    TEXT NOT NULL,
  title     TEXT NOT NULL,
  PRIMARY KEY (show_id, position)
);
