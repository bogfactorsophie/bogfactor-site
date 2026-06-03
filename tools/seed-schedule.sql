-- Seed the default Bog Factor broadcast rule: 1st Friday of every month,
-- 13:00–14:00 Europe/London. Apply after schema.sql.
--
-- Local:  npx wrangler d1 execute bogfactor --local  --file=tools/seed-schedule.sql -c worker-shows/wrangler.dev.toml
-- Remote: npx wrangler d1 execute bogfactor --remote --file=tools/seed-schedule.sql -c worker-shows/wrangler.toml
INSERT OR IGNORE INTO schedule_events
  (id, kind, title, description, timezone, duration_min, is_active,
   rec_freq, rec_week, rec_weekday, rec_time)
VALUES
  ('bog-factor-monthly', 'recurring', 'Bog Factor',
   'Psychedelic, folk and sleazy sounds from the bog. Live on EHFM.',
   'Europe/London', 60, 1,
   'monthly', 1, 5, '13:00');
