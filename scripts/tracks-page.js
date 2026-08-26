// Render layer for the public /tracks page. All track logic lives in
// track-utils.js (window.BogTracks); this file only fetches data and paints
// DOM, so the UI can be reworked freely without touching the logic.
(function () {
  'use strict';

  const T = window.BogTracks;
  const $ = function (id) { return document.getElementById(id); };

  const TOP_N = 15; // how many rows in the "most played" charts
  const MIN_PLAYS_FOR_TRACK_CHART = 2; // a track has to repeat to chart
  const MAX_SEARCH_RESULTS = 60;

  let index = []; // flat occurrences
  let trackGroups = []; // distinct tracks

  // ---- formatting helpers ----

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return String(value);
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }

  function showLink(show) {
    const a = document.createElement('a');
    a.href = '/radio/index.html#' + encodeURIComponent(show.showId);
    a.textContent = show.showTitle || show.showId;
    return a;
  }

  // "<strong>Title</strong> <span>by Artist</span>"
  function trackLineEl(track) {
    const span = document.createElement('span');
    span.className = 'track-line';
    const t = document.createElement('strong');
    t.textContent = track.title || '(untitled)';
    span.appendChild(t);
    if (track.artist) {
      const by = document.createElement('span');
      by.className = 'by';
      by.textContent = ' by ' + track.artist;
      span.appendChild(by);
    }
    const query = [track.artist, track.title].filter(Boolean).join(' ');
    if (query) {
      const yt = document.createElement('a');
      yt.className = 'youtube-search-btn track-yt-btn';
      yt.textContent = '🔍';
      yt.title = 'Search "' + query + '" on YouTube';
      // the glyph alone gives a screen reader nothing to read out
      yt.setAttribute('aria-label', 'Search for ' + query + ' on YouTube');
      yt.href = 'https://www.youtube.com/results?search_query=' +
        encodeURIComponent(query);
      yt.target = '_blank';
      yt.rel = 'noopener noreferrer';
      span.appendChild(yt);
    }
    return span;
  }

  // "Played on Show A, Show B" with links. Dedupes repeated shows.
  function whereEl(shows) {
    const wrap = document.createElement('div');
    wrap.className = 'track-where';
    wrap.appendChild(document.createTextNode('Played on '));
    const seen = new Set();
    let first = true;
    shows.forEach(function (s) {
      if (seen.has(s.showId)) return;
      seen.add(s.showId);
      if (!first) wrap.appendChild(document.createTextNode(', '));
      const link = showLink(s);
      const date = formatDate(s.date);
      if (date) link.title = date;
      wrap.appendChild(link);
      first = false;
    });
    return wrap;
  }

  // ---- renderers ----

  function renderMetrics() {
    const shows = window.__bogShows || [];
    const m = T.metrics(index, shows);
    const tiles = [
      { num: m.uniqueTracks, label: 'unique tracks' },
      { num: m.uniqueArtists, label: 'artists' },
      { num: m.showCount, label: 'shows' },
      { num: index.length, label: 'tracks played' },
    ];
    // "on air" comes from each show's durationMin. That column exists and the
    // API returns it, but no show has a duration recorded yet, so the tile read
    // a flat "0h". Show it only once there is something real to show, rather
    // than printing a zero or inventing an hour count per show.
    if (m.hours > 0) {
      tiles.push({ num: Math.round(m.hours) + 'h', label: 'on air' });
    }
    const grid = $('metrics');
    grid.innerHTML = '';
    tiles.forEach(function (tile) {
      const cell = document.createElement('div');
      cell.className = 'metric-tile';
      const num = document.createElement('div');
      num.className = 'metric-num';
      num.textContent = tile.num;
      const label = document.createElement('div');
      label.className = 'metric-label';
      label.textContent = tile.label;
      cell.append(num, label);
      grid.appendChild(cell);
    });
  }

  function renderTopTracks() {
    const top = trackGroups
      .filter(function (g) { return g.count >= MIN_PLAYS_FOR_TRACK_CHART; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, TOP_N);
    const ul = $('top-tracks');
    ul.innerHTML = '';
    if (!top.length) {
      ul.innerHTML = '<li>No track has been played more than once yet.</li>';
      return;
    }
    top.forEach(function (g) {
      const li = document.createElement('li');
      const count = document.createElement('span');
      count.className = 'play-count';
      count.textContent = g.count;
      count.title = g.count + ' plays';
      li.append(count, trackLineEl(g), whereEl(g.shows));
      ul.appendChild(li);
    });
  }

  function renderTopArtists() {
    const top = T.groupArtists(index)
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return (a.artist || '').localeCompare(b.artist || '');
      })
      .slice(0, TOP_N);
    const ul = $('top-artists');
    ul.innerHTML = '';
    top.forEach(function (a) {
      const li = document.createElement('li');
      const count = document.createElement('span');
      count.className = 'play-count';
      count.textContent = a.count;
      count.title = a.count + ' plays';
      // A <button>, not a <span>. This was a click handler on a plain span, so
      // it could not be reached or triggered from the keyboard at all.
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'track-line artist-link';
      name.textContent = a.artist;
      name.title = 'Search for ' + a.artist;
      name.addEventListener('click', function () {
        const box = $('track-search');
        box.value = a.artist;
        runSearch();
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      const meta = document.createElement('span');
      meta.className = 'by';
      meta.textContent = ' · ' + a.uniqueTracks + (a.uniqueTracks === 1 ? ' track' : ' tracks');
      li.append(count, name, meta);
      ul.appendChild(li);
    });
  }

  function runSearch() {
    const q = $('track-search').value;
    const results = T.searchTracks(trackGroups, q);
    const meta = $('search-meta');
    const ul = $('search-results');
    ul.innerHTML = '';

    if (!q.trim()) {
      meta.textContent = '';
      return;
    }
    meta.textContent = results.length
      ? results.length + (results.length === 1 ? ' track' : ' tracks') + ' found'
      : 'No tracks found. Looks like a fresh one.';

    results.slice(0, MAX_SEARCH_RESULTS).forEach(function (g) {
      const li = document.createElement('li');
      if (g.count > 1) {
        const count = document.createElement('span');
        count.className = 'play-count';
        count.textContent = g.count;
        count.title = g.count + ' plays';
        li.appendChild(count);
      }
      li.append(trackLineEl(g), whereEl(g.shows));
      ul.appendChild(li);
    });
    if (results.length > MAX_SEARCH_RESULTS) {
      const li = document.createElement('li');
      li.textContent = '…and ' + (results.length - MAX_SEARCH_RESULTS) + ' more. Refine your search.';
      ul.appendChild(li);
    }
  }

  let spinAngle = 0;
  let spinning = false;

  function renderSpin() {
    if (spinning) return;
    const result = $('spin-result');
    const pick = T.randomTrack(index);
    if (!pick) { result.textContent = 'Nothing to spin yet.'; return; }

    const wheel = $('bog-wheel');
    const btn = $('spin-btn');

    // No wheel element (or animations disabled), so reveal immediately.
    if (!wheel) {
      result.innerHTML = '';
      result.append(trackLineEl(pick), whereEl([pick]));
      return;
    }

    spinning = true;
    btn.disabled = true;
    result.classList.add('spinning');

    // Spin several full turns plus a random landing offset.
    spinAngle += 360 * (4 + Math.floor(Math.random() * 4)) + Math.floor(Math.random() * 360);
    wheel.style.transform = 'rotate(' + spinAngle + 'deg)';

    function reveal() {
      wheel.removeEventListener('transitionend', reveal);
      result.classList.remove('spinning');
      result.innerHTML = '';
      result.append(trackLineEl(pick), whereEl([pick]));
      btn.disabled = false;
      spinning = false;
    }
    wheel.addEventListener('transitionend', reveal);
  }

  // ---- boot ----

  async function init() {
    try {
      const res = await fetch('/api/shows');
      const shows = await res.json();
      window.__bogShows = shows;
      index = T.flatten(shows);
      trackGroups = T.groupTracks(index);

      renderMetrics();
      renderTopTracks();
      renderTopArtists();

      $('track-search').addEventListener('input', runSearch);
      $('spin-btn').addEventListener('click', renderSpin);
    } catch (err) {
      console.error('Failed to load tracks:', err);
      $('search-meta').textContent = 'Could not load tracks. Please try again later.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
