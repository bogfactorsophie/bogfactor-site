// Bog Factor shows API.
//
// Public:
//   GET  /api/shows            -> archive, newest first
//   GET  /api/schedule         -> { now, live, next, upcoming } from the schedule
//   GET  /api/images/:key      -> R2-backed image
//
// Admin (gated by Cloudflare Access on /api/admin/*):
//   GET    /api/admin/shows
//   POST   /api/admin/shows
//   PUT    /api/admin/shows/:id
//   DELETE /api/admin/shows/:id
//   POST   /api/admin/images   (multipart, field "file") -> { key }
//   GET    /api/admin/schedule
//   POST   /api/admin/schedule
//   PUT    /api/admin/schedule/:id
//   DELETE /api/admin/schedule/:id

const PUBLIC_CACHE_SECONDS = 60;
const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30; // 30d

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      if (method === 'OPTIONS') return preflight(request);

      if (pathname === '/api/shows' && method === 'GET') {
        return await listShows(env, { includeUnpublished: false });
      }

      if (pathname === '/api/schedule' && method === 'GET') {
        return await getSchedule(env);
      }

      const imageMatch = pathname.match(/^\/api\/images\/([^/]+)$/);
      if (imageMatch && method === 'GET') {
        return await serveImage(env, decodeURIComponent(imageMatch[1]));
      }

      if (pathname.startsWith('/api/admin/')) {
        const accessError = await requireAccess(request, env);
        if (accessError) return accessError;

        if (pathname === '/api/admin/shows' && method === 'GET') {
          return await listShows(env, { includeUnpublished: true });
        }
        if (pathname === '/api/admin/shows' && method === 'POST') {
          return await createShow(request, env);
        }
        const adminShowMatch = pathname.match(/^\/api\/admin\/shows\/([^/]+)$/);
        if (adminShowMatch && method === 'PUT') {
          return await updateShow(request, env, adminShowMatch[1]);
        }
        if (adminShowMatch && method === 'DELETE') {
          return await deleteShow(env, adminShowMatch[1]);
        }
        if (pathname === '/api/admin/images' && method === 'POST') {
          return await uploadImage(request, env);
        }

        if (pathname === '/api/admin/schedule' && method === 'GET') {
          return await listSchedule(env);
        }
        if (pathname === '/api/admin/schedule' && method === 'POST') {
          return await createScheduleEvent(request, env);
        }
        const adminSchedMatch = pathname.match(/^\/api\/admin\/schedule\/([^/]+)$/);
        if (adminSchedMatch && method === 'PUT') {
          return await updateScheduleEvent(request, env, adminSchedMatch[1]);
        }
        if (adminSchedMatch && method === 'DELETE') {
          return await deleteScheduleEvent(env, adminSchedMatch[1]);
        }
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'Internal error' }, 500);
    }
  },
};

// ---------- Public ----------

async function listShows(env, { includeUnpublished }) {
  const where = includeUnpublished ? '' : 'WHERE is_published = 1';
  const showsRes = await env.DB.prepare(
    `SELECT id, title, description, mixcloud_path, soundcloud_url, aired_at,
            duration_min, producer, image_key, is_published
       FROM shows
       ${where}
       ORDER BY aired_at DESC`
  ).all();

  const ids = showsRes.results.map((s) => s.id);
  const tracksByShow = new Map(ids.map((id) => [id, []]));

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const tracksRes = await env.DB.prepare(
      `SELECT show_id, position, artist, title
         FROM tracks
         WHERE show_id IN (${placeholders})
         ORDER BY show_id, position`
    ).bind(...ids).all();
    for (const t of tracksRes.results) {
      tracksByShow.get(t.show_id).push(`${t.title} - ${t.artist}`);
    }
  }

  const shows = showsRes.results.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    mixcloudPath: s.mixcloud_path,
    soundcloudUrl: s.soundcloud_url || undefined,
    airedAt: s.aired_at,
    durationMin: s.duration_min || undefined,
    producer: s.producer || undefined,
    image: s.image_key ? `/api/images/${encodeURIComponent(s.image_key)}` : undefined,
    isPublished: includeUnpublished ? Boolean(s.is_published) : undefined,
    tracklist: tracksByShow.get(s.id) || [],
  }));

  return json(shows, 200, {
    'Cache-Control': includeUnpublished
      ? 'no-store'
      : `public, max-age=${PUBLIC_CACHE_SECONDS}, s-maxage=${PUBLIC_CACHE_SECONDS}`,
  });
}

async function serveImage(env, key) {
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', `public, max-age=${IMAGE_CACHE_SECONDS}, immutable`);
  headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { headers });
}

// ---------- Public: schedule ----------

const TOWN_CRIER_IMAGE = '/assets/town-crier.png';
const SCHEDULE_WINDOW_BACK_MS = 2 * 60 * 60 * 1000;        // 2h before now
const SCHEDULE_WINDOW_FWD_MS = 90 * 24 * 60 * 60 * 1000;   // 90d ahead (find next monthly show)
const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;        // landing cards: next 7 days

async function getSchedule(env) {
  const events = (await env.DB.prepare(
    `SELECT * FROM schedule_events WHERE is_active = 1`
  ).all()).results;
  const skipsByEvent = await loadSkips(env, events.map((e) => e.id));

  const now = new Date();
  const nowMs = now.getTime();
  const windowStart = new Date(nowMs - SCHEDULE_WINDOW_BACK_MS);
  const windowEnd = new Date(nowMs + SCHEDULE_WINDOW_FWD_MS);
  const occ = expandOccurrences(events, skipsByEvent, windowStart, windowEnd);

  const live = occ.find((o) => o.startMs <= nowMs && o.endMs > nowMs) || null;
  const next = occ.find((o) => o.startMs > nowMs) || null;
  const upcomingCutoff = nowMs + UPCOMING_WINDOW_MS;
  const upcoming = occ.filter((o) => o.endMs > nowMs && o.startMs <= upcomingCutoff);

  return json({
    now: now.toISOString(),
    live: cleanOccurrence(live),
    next: cleanOccurrence(next),
    upcoming: upcoming.map(cleanOccurrence),
  }, 200, {
    'Cache-Control': `public, max-age=${PUBLIC_CACHE_SECONDS}, s-maxage=${PUBLIC_CACHE_SECONDS}`,
  });
}

async function loadSkips(env, ids) {
  const map = new Map(ids.map((id) => [id, new Set()]));
  if (!ids.length) return map;
  const placeholders = ids.map(() => '?').join(',');
  const res = await env.DB.prepare(
    `SELECT event_id, skip_date FROM schedule_skips WHERE event_id IN (${placeholders})`
  ).bind(...ids).all();
  for (const r of res.results) {
    if (!map.has(r.event_id)) map.set(r.event_id, new Set());
    map.get(r.event_id).add(r.skip_date);
  }
  return map;
}

// Expand active events into concrete occurrences within [windowStart, windowEnd).
function expandOccurrences(events, skipsByEvent, windowStart, windowEnd) {
  const out = [];
  for (const e of events) {
    if (!e.is_active) continue;
    if (e.kind === 'oneoff') {
      if (!e.starts_at) continue;
      const start = new Date(e.starts_at);
      if (isNaN(start)) continue;
      const end = new Date(start.getTime() + (e.duration_min || 60) * 60000);
      if (end > windowStart && start < windowEnd) out.push(makeOccurrence(e, start, end));
    } else if (e.kind === 'recurring') {
      out.push(...expandRecurring(e, skipsByEvent.get(e.id) || new Set(), windowStart, windowEnd));
    }
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

function expandRecurring(e, skips, windowStart, windowEnd) {
  const tz = e.timezone || 'Europe/London';
  const [h, m] = String(e.rec_time || '13:00').split(':').map((n) => parseInt(n, 10));
  const durMs = (e.duration_min || 60) * 60000;
  const from = e.rec_from ? new Date(e.rec_from + 'T00:00:00Z') : null;
  const until = e.rec_until ? new Date(e.rec_until + 'T23:59:59Z') : null;
  const out = [];

  const emit = (y, mo, day) => {
    if (day == null) return;
    const start = localToUtc(y, mo, day, h, m, tz);
    const end = new Date(start.getTime() + durMs);
    const localDate = `${y}-${pad2(mo + 1)}-${pad2(day)}`;
    if (from && start < from) return;
    if (until && start > until) return;
    if (skips.has(localDate)) return;
    if (end > windowStart && start < windowEnd) out.push(makeOccurrence(e, start, end, localDate));
  };

  if (e.rec_freq === 'monthly') {
    // Step back a month so an occurrence landing just before windowStart is considered.
    let y = windowStart.getUTCFullYear();
    let mo = windowStart.getUTCMonth() - 1;
    if (mo < 0) { mo = 11; y--; }
    for (;;) {
      emit(y, mo, nthWeekdayOfMonth(y, mo, e.rec_weekday, e.rec_week));
      mo++;
      if (mo > 11) { mo = 0; y++; }
      if (new Date(Date.UTC(y, mo, 1)) > windowEnd) break;
    }
  } else if (e.rec_freq === 'weekly') {
    const cursor = new Date(Date.UTC(
      windowStart.getUTCFullYear(), windowStart.getUTCMonth(), windowStart.getUTCDate()
    ));
    while (cursor <= windowEnd) {
      if (cursor.getUTCDay() === e.rec_weekday) {
        emit(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return out;
}

// nth (1..5) weekday (0=Sun..6=Sat) of a 0-indexed month; null if it doesn't exist.
function nthWeekdayOfMonth(year, month, weekday, nth) {
  if (weekday == null || nth == null) return null;
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const day = 1 + ((weekday - firstDow + 7) % 7) + (nth - 1) * 7;
  if (new Date(Date.UTC(year, month, day)).getUTCMonth() !== month) return null;
  return day;
}

// Convert a local wall-clock time in `timeZone` to the corresponding UTC instant.
// Mirrors the trick formerly in scripts/live-stream.js, parameterised by timezone.
function localToUtc(year, month, day, hour, minute, timeZone) {
  const noonUtc = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const localHourAtNoon = parseInt(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', hour12: false,
  }).format(noonUtc), 10);
  const offsetHours = localHourAtNoon - 12; // +1 during BST, 0 during GMT
  return new Date(Date.UTC(year, month, day, hour - offsetHours, minute, 0));
}

function makeOccurrence(e, start, end, localDate) {
  return {
    id: e.id,
    title: e.title,
    description: e.description || '',
    kind: e.kind,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    image: e.image_key ? `/api/images/${encodeURIComponent(e.image_key)}` : TOWN_CRIER_IMAGE,
    link: e.link_url || null,
    startMs: start.getTime(),
    endMs: end.getTime(),
    localDate: localDate || null,
  };
}

function cleanOccurrence(o) {
  if (!o) return null;
  const { startMs, endMs, localDate, ...rest } = o;
  return rest;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ---------- Admin: schedule ----------

async function listSchedule(env) {
  const events = (await env.DB.prepare(
    `SELECT * FROM schedule_events ORDER BY kind, COALESCE(starts_at, ''), title`
  ).all()).results;
  const skipsByEvent = await loadSkips(env, events.map((e) => e.id));
  return json(
    events.map((e) => toAdminEvent(e, skipsByEvent.get(e.id))),
    200,
    { 'Cache-Control': 'no-store' }
  );
}

function toAdminEvent(e, skips) {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    description: e.description || '',
    timezone: e.timezone,
    durationMin: e.duration_min,
    isActive: Boolean(e.is_active),
    startsAt: e.starts_at || null,
    recFreq: e.rec_freq || null,
    recWeek: e.rec_week ?? null,
    recWeekday: e.rec_weekday ?? null,
    recTime: e.rec_time || null,
    recFrom: e.rec_from || null,
    recUntil: e.rec_until || null,
    imageKey: e.image_key || null,
    image: e.image_key ? `/api/images/${encodeURIComponent(e.image_key)}` : null,
    linkUrl: e.link_url || null,
    skips: skips ? Array.from(skips).sort() : [],
  };
}

async function createScheduleEvent(request, env) {
  const body = await request.json();
  const err = validateSchedulePayload(body);
  if (err) return json({ error: err }, 400);
  const id = body.id && String(body.id).trim() ? String(body.id).trim() : crypto.randomUUID();
  const existing = await env.DB.prepare('SELECT id FROM schedule_events WHERE id = ?').bind(id).first();
  if (existing) return json({ error: `Schedule id "${id}" already exists` }, 409);
  await writeScheduleEvent(env, { ...body, id }, { mode: 'insert' });
  return json({ ok: true, id }, 201);
}

async function updateScheduleEvent(request, env, id) {
  const body = await request.json();
  body.id = id;
  const err = validateSchedulePayload(body);
  if (err) return json({ error: err }, 400);
  const existing = await env.DB.prepare('SELECT id FROM schedule_events WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Not found' }, 404);
  await writeScheduleEvent(env, body, { mode: 'update' });
  return json({ ok: true, id });
}

async function deleteScheduleEvent(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM schedule_events WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Not found' }, 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM schedule_skips WHERE event_id = ?').bind(id),
    env.DB.prepare('DELETE FROM schedule_events WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

async function writeScheduleEvent(env, body, { mode }) {
  const now = new Date().toISOString();
  const isOneoff = body.kind === 'oneoff';
  const stmts = [];

  const vals = {
    kind: body.kind,
    title: body.title.trim(),
    description: (body.description || '').trim() || null,
    timezone: (body.timezone || 'Europe/London').trim(),
    durationMin: body.durationMin != null ? Number(body.durationMin) : 60,
    isActive: body.isActive === false ? 0 : 1,
    startsAt: isOneoff ? body.startsAt : null,
    recFreq: isOneoff ? null : body.recFreq,
    recWeek: isOneoff ? null : (body.recWeek ?? null),
    recWeekday: isOneoff ? null : (body.recWeekday ?? null),
    recTime: isOneoff ? null : (body.recTime || null),
    recFrom: isOneoff ? null : (body.recFrom || null),
    recUntil: isOneoff ? null : (body.recUntil || null),
    imageKey: body.imageKey || null,
    linkUrl: body.linkUrl || null,
  };

  if (mode === 'insert') {
    stmts.push(env.DB.prepare(
      `INSERT INTO schedule_events
         (id, kind, title, description, timezone, duration_min, is_active,
          starts_at, rec_freq, rec_week, rec_weekday, rec_time, rec_from, rec_until,
          image_key, link_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.id, vals.kind, vals.title, vals.description, vals.timezone, vals.durationMin,
      vals.isActive, vals.startsAt, vals.recFreq, vals.recWeek, vals.recWeekday, vals.recTime,
      vals.recFrom, vals.recUntil, vals.imageKey, vals.linkUrl, now, now
    ));
  } else {
    stmts.push(
      env.DB.prepare(
        `UPDATE schedule_events
            SET kind = ?, title = ?, description = ?, timezone = ?, duration_min = ?,
                is_active = ?, starts_at = ?, rec_freq = ?, rec_week = ?, rec_weekday = ?,
                rec_time = ?, rec_from = ?, rec_until = ?, image_key = ?, link_url = ?,
                updated_at = ?
          WHERE id = ?`
      ).bind(
        vals.kind, vals.title, vals.description, vals.timezone, vals.durationMin,
        vals.isActive, vals.startsAt, vals.recFreq, vals.recWeek, vals.recWeekday, vals.recTime,
        vals.recFrom, vals.recUntil, vals.imageKey, vals.linkUrl, now, body.id
      ),
      env.DB.prepare('DELETE FROM schedule_skips WHERE event_id = ?').bind(body.id)
    );
  }

  const skips = Array.isArray(body.skips) ? [...new Set(body.skips)] : [];
  for (const d of skips) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      stmts.push(env.DB.prepare(
        'INSERT OR IGNORE INTO schedule_skips (event_id, skip_date) VALUES (?, ?)'
      ).bind(body.id, d));
    }
  }

  await env.DB.batch(stmts);
}

function validateSchedulePayload(body) {
  if (!body || typeof body !== 'object') return 'Body must be JSON object';
  if (body.kind !== 'recurring' && body.kind !== 'oneoff') return "kind must be 'recurring' or 'oneoff'";
  if (!body.title || !String(body.title).trim()) return 'title required';
  if (body.durationMin != null && (!Number.isInteger(Number(body.durationMin)) || Number(body.durationMin) <= 0)) {
    return 'durationMin must be a positive integer';
  }
  if (body.kind === 'oneoff') {
    if (!body.startsAt) return 'startsAt required for one-off';
    if (Number.isNaN(Date.parse(body.startsAt))) return 'startsAt must be ISO 8601';
  } else {
    if (body.recFreq !== 'monthly' && body.recFreq !== 'weekly') return "recFreq must be 'monthly' or 'weekly'";
    if (!Number.isInteger(Number(body.recWeekday)) || body.recWeekday < 0 || body.recWeekday > 6) {
      return 'recWeekday must be 0..6';
    }
    if (body.recFreq === 'monthly' && (!Number.isInteger(Number(body.recWeek)) || body.recWeek < 1 || body.recWeek > 5)) {
      return 'recWeek must be 1..5 for monthly';
    }
    if (!/^\d{2}:\d{2}$/.test(String(body.recTime || ''))) return 'recTime must be HH:MM';
    if (body.recFrom && !/^\d{4}-\d{2}-\d{2}$/.test(body.recFrom)) return 'recFrom must be YYYY-MM-DD';
    if (body.recUntil && !/^\d{4}-\d{2}-\d{2}$/.test(body.recUntil)) return 'recUntil must be YYYY-MM-DD';
  }
  if (body.skips != null && !Array.isArray(body.skips)) return 'skips must be an array';
  return null;
}

// ---------- Admin: shows ----------

async function createShow(request, env) {
  const body = await request.json();
  const err = validateShowPayload(body, { requireId: true });
  if (err) return json({ error: err }, 400);

  const existing = await env.DB.prepare('SELECT id FROM shows WHERE id = ?').bind(body.id).first();
  if (existing) return json({ error: `Show id "${body.id}" already exists` }, 409);

  await writeShow(env, body, { mode: 'insert' });
  return json({ ok: true, id: body.id }, 201);
}

async function updateShow(request, env, id) {
  const body = await request.json();
  body.id = id;
  const err = validateShowPayload(body, { requireId: true });
  if (err) return json({ error: err }, 400);

  const existing = await env.DB.prepare('SELECT image_key FROM shows WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Not found' }, 404);

  await writeShow(env, body, { mode: 'update' });
  // Best-effort: delete old image if replaced.
  if (existing.image_key && existing.image_key !== body.imageKey) {
    await env.IMAGES.delete(existing.image_key).catch(() => {});
  }
  return json({ ok: true, id });
}

async function deleteShow(env, id) {
  const existing = await env.DB.prepare('SELECT image_key FROM shows WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Not found' }, 404);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM tracks WHERE show_id = ?').bind(id),
    env.DB.prepare('DELETE FROM shows WHERE id = ?').bind(id),
  ]);
  if (existing.image_key) {
    await env.IMAGES.delete(existing.image_key).catch(() => {});
  }
  return json({ ok: true });
}

async function writeShow(env, body, { mode }) {
  const tracks = Array.isArray(body.tracklist) ? body.tracklist : [];
  const trackRows = tracks
    .map((line) => splitTrack(line))
    .filter((row) => row.artist && row.title);

  const now = new Date().toISOString();
  const stmts = [];

  if (mode === 'insert') {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO shows (id, title, description, mixcloud_path, soundcloud_url,
                            aired_at, duration_min, producer, image_key, is_published,
                            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.id,
        body.title,
        body.description,
        body.mixcloudPath,
        body.soundcloudUrl || null,
        body.airedAt,
        body.durationMin ?? null,
        body.producer || null,
        body.imageKey || null,
        body.isPublished === false ? 0 : 1,
        now,
        now
      )
    );
  } else {
    stmts.push(
      env.DB.prepare(
        `UPDATE shows
            SET title = ?, description = ?, mixcloud_path = ?, soundcloud_url = ?,
                aired_at = ?, duration_min = ?, producer = ?, image_key = ?,
                is_published = ?, updated_at = ?
          WHERE id = ?`
      ).bind(
        body.title,
        body.description,
        body.mixcloudPath,
        body.soundcloudUrl || null,
        body.airedAt,
        body.durationMin ?? null,
        body.producer || null,
        body.imageKey || null,
        body.isPublished === false ? 0 : 1,
        now,
        body.id
      ),
      env.DB.prepare('DELETE FROM tracks WHERE show_id = ?').bind(body.id)
    );
  }

  trackRows.forEach((row, idx) => {
    stmts.push(
      env.DB.prepare(
        'INSERT INTO tracks (show_id, position, artist, title) VALUES (?, ?, ?, ?)'
      ).bind(body.id, idx + 1, row.artist, row.title)
    );
  });

  await env.DB.batch(stmts);
}

function validateShowPayload(body, { requireId }) {
  if (!body || typeof body !== 'object') return 'Body must be JSON object';
  if (requireId && !body.id) return 'id required';
  if (!body.title) return 'title required';
  if (!body.description) return 'description required';
  if (!body.mixcloudPath) return 'mixcloudPath required';
  if (!body.airedAt) return 'airedAt required';
  if (Number.isNaN(Date.parse(body.airedAt))) return 'airedAt must be ISO 8601';
  if (body.durationMin != null && (!Number.isInteger(body.durationMin) || body.durationMin < 0)) {
    return 'durationMin must be a non-negative integer';
  }
  return null;
}

function splitTrack(line) {
  if (typeof line !== 'string') return { artist: '', title: '' };
  const trimmed = line.trim();
  const idx = trimmed.indexOf(' - ');
  if (idx === -1) return { artist: '', title: trimmed };
  return {
    artist: trimmed.slice(idx + 3).trim(),
    title: trimmed.slice(0, idx).trim(),
  };
}

// ---------- Admin: images ----------

async function uploadImage(request, env) {
  const contentType = request.headers.get('Content-Type') || '';
  let bytes;
  let ext = 'bin';
  let mime = 'application/octet-stream';

  if (contentType.startsWith('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'file field required' }, 400);
    bytes = new Uint8Array(await file.arrayBuffer());
    mime = file.type || mime;
    ext = extFromName(file.name) || extFromMime(mime) || ext;
  } else {
    bytes = new Uint8Array(await request.arrayBuffer());
    mime = contentType || mime;
    ext = extFromMime(mime) || ext;
  }

  if (bytes.byteLength === 0) return json({ error: 'empty body' }, 400);

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const key = `${hash}.${ext}`;

  await env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mime },
  });

  return json({ key, url: `/api/images/${encodeURIComponent(key)}` }, 201);
}

function extFromName(name) {
  if (!name) return null;
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : null;
}

function extFromMime(mime) {
  return {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  }[mime?.toLowerCase()] || null;
}

// ---------- Auth ----------

async function requireAccess(request, env) {
  // Dev-only escape hatch. Cloudflare Access doesn't exist in local dev, so the
  // Cf-Access-Jwt-Assertion header is never present and admin routes would 401.
  // worker-shows/wrangler.dev.toml sets DEV_BYPASS_ACCESS so the admin pages can
  // be exercised locally. This MUST NOT be set in production (the prod
  // wrangler.toml does not define it).
  if (env.DEV_BYPASS_ACCESS === 'true') return null;

  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return json({ error: 'Unauthorized' }, 401);

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    // Edge has already verified the JWT before forwarding (Access app gates
    // the route). We log so misconfig is visible, but allow the request.
    console.warn('ACCESS_TEAM_DOMAIN / ACCESS_AUD unset; relying on edge gating only');
    return null;
  }

  const ok = await verifyAccessJwt(jwt, env);
  if (!ok) return json({ error: 'Unauthorized' }, 401);
  return null;
}

let cachedJwks = null;
let cachedJwksAt = 0;

async function verifyAccessJwt(token, env) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return false;
    const header = JSON.parse(atob(b64urlToB64(headerB64)));
    const payload = JSON.parse(atob(b64urlToB64(payloadB64)));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;
    if (payload.nbf && payload.nbf > now + 30) return false;
    const expectedIss = `https://${env.ACCESS_TEAM_DOMAIN}`;
    if (payload.iss !== expectedIss) return false;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(env.ACCESS_AUD)) return false;

    const jwks = await getJwks(env);
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sig = b64urlToBytes(sigB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  } catch (err) {
    console.error('JWT verify error:', err);
    return false;
  }
}

async function getJwks(env) {
  const now = Date.now();
  if (cachedJwks && now - cachedJwksAt < 10 * 60 * 1000) return cachedJwks;
  const res = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  cachedJwks = await res.json();
  cachedJwksAt = now;
  return cachedJwks;
}

function b64urlToB64(s) {
  return s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
}

function b64urlToBytes(s) {
  const bin = atob(b64urlToB64(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- helpers ----------

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function preflight(request) {
  // Same-origin Worker route, but allow Pages preview origins.
  const origin = request.headers.get('Origin') || '';
  const allowed =
    origin === 'https://bogfactor.co.uk' ||
    origin === 'https://www.bogfactor.co.uk' ||
    origin.endsWith('.pages.dev') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowed ? origin : 'https://bogfactor.co.uk',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Jwt-Assertion',
    },
  });
}
