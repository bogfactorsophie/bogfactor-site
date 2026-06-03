/**
 * Bog Factor Schedule
 *
 * Single source of truth for "is the show live / when is the next one / what's
 * coming up". Fetches /api/schedule once, caches the absolute timestamps it
 * returns, and answers isLiveNow() / getNextShowDate() / getUpcoming() locally
 * so the per-second countdown stays smooth between refetches.
 *
 * Test pages override behaviour via window.BogFactorTestConfig (the same hooks
 * used before this was DB-backed): isLiveNow(), getNextShowDate(), and the new
 * getUpcoming(). When a test config is present we don't depend on the network.
 *
 * Exposes window.BogFactorSchedule. Consumers: live-stream.js,
 * toolbar-live-widget.js, upcoming-shows.js.
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/schedule';
  const REFRESH_MS = 5 * 60 * 1000;  // periodic freshness poll
  const MAX_BOUNDARY_MS = 8 * 24 * 60 * 60 * 1000; // don't arm timers further out than this

  // Cached server response: { live, next, upcoming } (occurrences keep their
  // ISO startsAt/endsAt; we parse to ms on demand).
  let cache = { live: null, next: null, upcoming: [] };
  let ready = false;
  const readyCallbacks = [];
  let boundaryTimer = null;

  function testCfg() {
    return window.BogFactorTestConfig || null;
  }

  function markReady() {
    if (ready) return;
    ready = true;
    while (readyCallbacks.length) {
      try { readyCallbacks.shift()(); } catch (e) { console.error(e); }
    }
    document.dispatchEvent(new CustomEvent('bogfactor:schedule-ready'));
  }

  // Combined, de-duplicated list of every occurrence we currently know about,
  // as { start, end } in epoch-ms. Used for local live/next computation.
  function knownOccurrences() {
    const seen = new Set();
    const list = [];
    const add = (o) => {
      if (!o || !o.startsAt) return;
      if (seen.has(o.startsAt)) return;
      const start = Date.parse(o.startsAt);
      const end = o.endsAt ? Date.parse(o.endsAt) : start;
      if (isNaN(start)) return;
      seen.add(o.startsAt);
      list.push({ start, end });
    };
    add(cache.live);
    add(cache.next);
    (cache.upcoming || []).forEach(add);
    list.sort((a, b) => a.start - b.start);
    return list;
  }

  async function refresh() {
    try {
      const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      cache = {
        live: data.live || null,
        next: data.next || null,
        upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
      };
      document.dispatchEvent(new CustomEvent('bogfactor:schedule-updated'));
      armBoundaryRefetch();
    } catch (err) {
      console.warn('Schedule fetch failed:', err.message);
    } finally {
      markReady();
    }
  }

  // Refetch a few seconds after the next live/off-air boundary so newly-current
  // or freshly-finished shows reflect promptly (local math handles the instant).
  function armBoundaryRefetch() {
    if (boundaryTimer) { clearTimeout(boundaryTimer); boundaryTimer = null; }
    const now = Date.now();
    let boundary = Infinity;
    for (const o of knownOccurrences()) {
      if (o.start > now) boundary = Math.min(boundary, o.start);
      else if (o.end > now) boundary = Math.min(boundary, o.end);
    }
    if (boundary !== Infinity && boundary - now < MAX_BOUNDARY_MS) {
      boundaryTimer = setTimeout(refresh, (boundary - now) + 3000);
    }
  }

  const Schedule = {
    isLiveNow() {
      const t = testCfg();
      if (t && typeof t.isLiveNow === 'function') {
        const r = t.isLiveNow();
        if (r !== null) return r;
      }
      const now = Date.now();
      return knownOccurrences().some((o) => o.start <= now && now < o.end);
    },

    getNextShowDate() {
      const t = testCfg();
      if (t && typeof t.getNextShowDate === 'function') {
        const r = t.getNextShowDate();
        if (r !== null) return r;
      }
      const now = Date.now();
      const occ = knownOccurrences();
      const future = occ.find((o) => o.start > now);
      if (future) return new Date(future.start);
      const live = occ.find((o) => o.start <= now && now < o.end);
      return live ? new Date(live.end) : null;
    },

    // Occurrences within the next 7 days, for the landing-page town-crier cards.
    getUpcoming() {
      const t = testCfg();
      if (t && typeof t.getUpcoming === 'function') {
        const r = t.getUpcoming();
        if (r !== null) return r;
      }
      return cache.upcoming || [];
    },

    // Run cb once the first fetch has settled (or immediately if already ready).
    onReady(cb) {
      if (ready) { cb(); return; }
      readyCallbacks.push(cb);
    },

    isReady() { return ready; },
    refresh,
  };

  window.BogFactorSchedule = Schedule;

  // Kick off. With a test config we don't need the network to be useful, so
  // mark ready immediately; still attempt a fetch in case the page wants live data.
  if (testCfg() && (typeof testCfg().isLiveNow === 'function' ||
                    typeof testCfg().getNextShowDate === 'function')) {
    markReady();
  }
  refresh();
  setInterval(refresh, REFRESH_MS);
})();
