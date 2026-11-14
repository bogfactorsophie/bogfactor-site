-- Bog Factor become residents on EHFM Mornings from Monday 23 November 2026.
--
--   1. Shows gain an `is_morning_show` tag. Every existing 120-minute show was
--      an EHFM Mornings cover, so those are tagged now.
--   2. The monthly first-Friday rule ends: its last occurrence was 6 Nov 2026.
--      It is ended rather than deleted so the admin keeps a record of it.
--   3. A weekly rule is added: every Monday, 10:00-12:00 Europe/London,
--      starting 23 Nov 2026.
--
-- Run ONCE per database (ALTER TABLE fails if the column already exists):
--   Remote: npx wrangler d1 execute bogfactor --remote --file=worker-shows/migrations/2026-11-ehfm-mornings.sql -c worker-shows/wrangler.toml
--   Local:  npx wrangler d1 execute bogfactor --local  --file=worker-shows/migrations/2026-11-ehfm-mornings.sql -c worker-shows/wrangler.dev.toml

ALTER TABLE shows ADD COLUMN is_morning_show INTEGER NOT NULL DEFAULT 0;

UPDATE shows SET is_morning_show = 1 WHERE duration_min = 120;

UPDATE schedule_events
   SET rec_until = '2026-11-22', updated_at = datetime('now')
 WHERE kind = 'recurring' AND rec_freq = 'monthly' AND rec_weekday = 5
   AND (rec_until IS NULL OR rec_until > '2026-11-22');

INSERT OR IGNORE INTO schedule_events
  (id, kind, title, description, timezone, duration_min, is_active,
   rec_freq, rec_week, rec_weekday, rec_time, rec_from)
VALUES
  ('ehfm-mornings', 'recurring', 'Bog Factor on EHFM Mornings',
   'Psychedelic folk, pagan boogie and sleaze to start the week. Live on EHFM, 10am to 12pm.',
   'Europe/London', 120, 1,
   'weekly', NULL, 1, '10:00', '2026-11-23');
