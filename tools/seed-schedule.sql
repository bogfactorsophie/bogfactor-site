-- Seed the Bog Factor broadcast schedule. Apply after schema.sql.
--
--   ehfm-mornings       — residents on EHFM Mornings: every Monday,
--                         10:00–12:00 Europe/London, from 23 Nov 2026.
--   bog-factor-monthly  — the old 1st-Friday 13:00–14:00 show, ended 22 Nov
--                         2026. Kept so local dev mirrors production.
--
-- Local:  npx wrangler d1 execute bogfactor --local  --file=tools/seed-schedule.sql -c worker-shows/wrangler.dev.toml
-- Remote: npx wrangler d1 execute bogfactor --remote --file=tools/seed-schedule.sql -c worker-shows/wrangler.toml
INSERT OR IGNORE INTO schedule_events
  (id, kind, title, description, timezone, duration_min, is_active,
   rec_freq, rec_week, rec_weekday, rec_time, rec_from, rec_until)
VALUES
  ('ehfm-mornings', 'recurring', 'Bog Factor on EHFM Mornings',
   'Psychedelic folk, pagan boogie and sleaze to start the week. Live on EHFM, 10am to 12pm.',
   'Europe/London', 120, 1,
   'weekly', NULL, 1, '10:00', '2026-11-23', NULL),
  ('bog-factor-monthly', 'recurring', 'Bog Factor',
   'Psychedelic, folk and sleazy sounds from the bog. Live on EHFM.',
   'Europe/London', 60, 1,
   'monthly', 1, 5, '13:00', NULL, '2026-11-22');
