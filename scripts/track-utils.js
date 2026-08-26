// Bog Factor track utilities: pure logic, no DOM.
//
// One source of truth for how we read, normalise, search, and count tracks.
// Both the public /tracks page and the admin "have we played it?" checker use
// this, so matching behaves identically in both places.
//
// Normalisation is deliberately light (per design): we fold away case,
// punctuation, and accents, but we trust every word. No "the"-stripping, no
// "feat." handling, no reordering, so "Golden Brown" == "golden brown," but
// "Song (feat. X)" stays distinct from "Song". The result: matching is fully
// deterministic, unlike the remote Spotify/Tidal search the sync tool relies on.
//
// Exposed as window.BogTracks (plain IIFE, no build step).
(function () {
  'use strict';

  // ---- normalisation ----

  // Lowercase, strip accents, drop punctuation, collapse whitespace.
  function normalise(str) {
    if (typeof str !== 'string') return '';
    return str
      .normalize('NFKD') // split accented chars into base + combining mark
      .replace(/\p{Diacritic}/gu, '') // remove the combining marks
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ') // anything not a letter/digit/space -> space
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Split a "Title - Artist" line (the canonical site format). Splits on the
  // first " - "; if there's no separator we keep the whole thing as the title.
  function parseLine(line) {
    const text = typeof line === 'string' ? line.trim() : '';
    const idx = text.indexOf(' - ');
    if (idx === -1) return { title: text, artist: '' };
    return {
      title: text.slice(0, idx).trim(),
      artist: text.slice(idx + 3).trim(),
    };
  }

  // Canonical key for a track: a track is "the same" iff this key matches.
  function keyFor(artist, title) {
    return normalise(artist) + '|' + normalise(title);
  }

  // ---- building the index ----

  // Flatten an array of show objects (as returned by /api/shows or
  // /api/admin/shows) into one occurrence per track played.
  function flatten(shows) {
    const out = [];
    (shows || []).forEach(function (show) {
      (show.tracklist || []).forEach(function (line) {
        const parsed = parseLine(line);
        if (!parsed.title && !parsed.artist) return;
        out.push({
          artist: parsed.artist,
          title: parsed.title,
          line: line,
          key: keyFor(parsed.artist, parsed.title),
          showId: show.id,
          showTitle: show.title,
          date: show.airedAt,
        });
      });
    });
    return out;
  }

  // Group occurrences into distinct tracks, newest play first for the show list.
  // Returns [{ artist, title, key, count, shows: [{showId, showTitle, date}] }].
  function groupTracks(index) {
    const map = new Map();
    (index || []).forEach(function (e) {
      let g = map.get(e.key);
      if (!g) {
        g = { artist: e.artist, title: e.title, key: e.key, count: 0, shows: [] };
        map.set(e.key, g);
      }
      g.count += 1;
      g.shows.push({ showId: e.showId, showTitle: e.showTitle, date: e.date });
    });
    return Array.from(map.values());
  }

  // Group occurrences by artist (normalised). count = total plays across tracks.
  function groupArtists(index) {
    const map = new Map();
    (index || []).forEach(function (e) {
      const k = normalise(e.artist);
      if (!k) return;
      let g = map.get(k);
      if (!g) {
        g = { artist: e.artist, key: k, count: 0, trackKeys: new Set() };
        map.set(k, g);
      }
      g.count += 1;
      g.trackKeys.add(e.key);
    });
    return Array.from(map.values()).map(function (g) {
      return { artist: g.artist, key: g.key, count: g.count, uniqueTracks: g.trackKeys.size };
    });
  }

  // ---- search (deterministic, transparent ranking) ----

  // Score a haystack against a normalised query. Higher = better; 0 = no match.
  // exact (4) > starts-with (3) > substring (2) > all query tokens present (1).
  function scoreField(haystack, query, tokens) {
    if (!haystack || !query) return 0;
    if (haystack === query) return 4;
    if (haystack.startsWith(query)) return 3;
    if (haystack.indexOf(query) !== -1) return 2;
    const all = tokens.every(function (t) {
      return haystack.indexOf(t) !== -1;
    });
    return all ? 1 : 0;
  }

  // Search grouped tracks by artist OR title. Returns matching groups, best
  // first, each annotated with a _score. Empty query -> [].
  function searchTracks(groups, rawQuery) {
    const query = normalise(rawQuery);
    if (!query) return [];
    const tokens = query.split(' ').filter(Boolean);
    const scored = [];
    (groups || []).forEach(function (g) {
      const artist = normalise(g.artist);
      const title = normalise(g.title);
      const score = Math.max(
        scoreField(title, query, tokens),
        scoreField(artist, query, tokens),
        scoreField(artist + ' ' + title, query, tokens)
      );
      if (score > 0) scored.push(Object.assign({ _score: score }, g));
    });
    scored.sort(function (a, b) {
      if (b._score !== a._score) return b._score - a._score;
      return (a.title || '').localeCompare(b.title || '');
    });
    return scored;
  }

  // ---- checker lookup ----

  // For a single pasted "Title - Artist" line, against a prebuilt index:
  // returns { parsed, played (exact track), artistPlays (same artist, other tracks) }.
  function lookup(index, line) {
    const parsed = parseLine(line);
    const key = keyFor(parsed.artist, parsed.title);
    const artistKey = normalise(parsed.artist);
    const played = [];
    const artistPlays = [];
    (index || []).forEach(function (e) {
      if (e.key === key) {
        played.push(e);
      } else if (artistKey && normalise(e.artist) === artistKey) {
        artistPlays.push(e);
      }
    });
    return { parsed: parsed, line: line, played: played, artistPlays: artistPlays };
  }

  // ---- metrics ----

  function metrics(index, shows) {
    const tracks = groupTracks(index);
    const artists = groupArtists(index);
    let minutes = 0;
    (shows || []).forEach(function (s) {
      if (typeof s.durationMin === 'number') minutes += s.durationMin;
    });
    const showCount = (shows || []).length;
    return {
      uniqueTracks: tracks.length,
      uniqueArtists: artists.length,
      showCount: showCount,
      hours: minutes / 60,
    };
  }

  // A random played track occurrence (for "Spin the Bog Wheel").
  function randomTrack(index) {
    if (!index || !index.length) return null;
    return index[Math.floor(Math.random() * index.length)];
  }

  window.BogTracks = {
    normalise: normalise,
    parseLine: parseLine,
    keyFor: keyFor,
    flatten: flatten,
    groupTracks: groupTracks,
    groupArtists: groupArtists,
    searchTracks: searchTracks,
    lookup: lookup,
    metrics: metrics,
    randomTrack: randomTrack,
  };
})();
