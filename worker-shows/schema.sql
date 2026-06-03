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

-- Broadcast schedule. Two kinds of row:
--   'recurring' — a structured nth-weekday rule (e.g. 1st Friday monthly, 13:00)
--   'oneoff'    — an ad-hoc show / special at a specific instant
-- The site derives isLive / next-show / upcoming from these by expanding
-- recurring rules into concrete occurrences in the Worker.
CREATE TABLE IF NOT EXISTS schedule_events (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,                       -- 'recurring' | 'oneoff'
  title         TEXT NOT NULL,
  description   TEXT,
  timezone      TEXT NOT NULL DEFAULT 'Europe/London',
  duration_min  INTEGER NOT NULL DEFAULT 60,
  is_active     INTEGER NOT NULL DEFAULT 1,
  starts_at     TEXT,        -- oneoff: ISO 8601 UTC instant
  rec_freq      TEXT,        -- recurring: 'monthly' | 'weekly'
  rec_week      INTEGER,     -- recurring monthly: nth weekday (1..5)
  rec_weekday   INTEGER,     -- recurring: 0=Sun .. 6=Sat
  rec_time      TEXT,        -- recurring: 'HH:MM' wall-clock in `timezone`
  rec_from      TEXT,        -- recurring: effective-from 'YYYY-MM-DD' (nullable)
  rec_until     TEXT,        -- recurring: effective-until 'YYYY-MM-DD' (nullable)
  image_key     TEXT,        -- optional card image override; NULL => town-crier motif
  link_url      TEXT,        -- optional announcement link
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedule_kind ON schedule_events(kind);

-- Per-rule cancellations: a recurring occurrence whose local date is listed
-- here is skipped (month off, or moved/replaced by an ad-hoc show).
CREATE TABLE IF NOT EXISTS schedule_skips (
  event_id  TEXT NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
  skip_date TEXT NOT NULL,    -- 'YYYY-MM-DD' local date of the skipped occurrence
  PRIMARY KEY (event_id, skip_date)
);
