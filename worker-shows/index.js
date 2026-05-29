// Bog Factor shows API.
//
// Public:
//   GET  /api/shows            -> archive, newest first
//   GET  /api/images/:key      -> R2-backed image
//
// Admin (gated by Cloudflare Access on /api/admin/*):
//   GET    /api/admin/shows
//   POST   /api/admin/shows
//   PUT    /api/admin/shows/:id
//   DELETE /api/admin/shows/:id
//   POST   /api/admin/images   (multipart, field "file") -> { key }

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
