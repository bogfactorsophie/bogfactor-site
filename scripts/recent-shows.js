/**
 * Recent shows, landing page only.
 *
 * Fills the "Latest from the bog" section with the three most recent shows from
 * /api/shows: artwork, date and title on one line, a trimmed description, and a
 * Listen button.
 *
 * Listen plays the show in place, in the same fixed Mixcloud player the radio
 * page uses. That player is fetched on the first press rather than with the
 * page — it is a third-party script and iframe, and this is the busiest page on
 * the site, so only the readers who ask for it pay for it. Every button is
 * still authored as a link to the show on /radio/, which is what runs with no
 * JavaScript, on a middle click, and if the player fails to load.
 *
 * The section starts hidden and only reveals itself once there is something to
 * show, so a failed fetch leaves no empty frame on the page.
 */
(function () {
  'use strict';

  const HOW_MANY = 3;
  const BLURB_LIMIT = 130;
  const PLAYER_SRC = '/scripts/mixcloud-player.js';
  // How long to wait for Mixcloud's widget API to come back before giving up and
  // sending the reader to /radio/ instead. Generous: this is a third-party
  // script on whatever connection they happen to have.
  const PLAYER_TIMEOUT = 8000;

  // The in-flight (or settled) load of the player script, so three cards on the
  // page share one copy and a double click does not fetch it twice.
  let playerLoad = null;

  function isLandingPage() {
    if (window.BogFactorTestConfig && window.BogFactorTestConfig.isLandingPage !== undefined) {
      return window.BogFactorTestConfig.isLandingPage;
    }
    return window.location.pathname === '/' || window.location.pathname === '/index.html';
  }

  // Show descriptions can carry anchor markup and newlines. This section wants a
  // short plain-text blurb, so strip tags and collapse whitespace, then cut on a
  // word boundary rather than mid-word.
  function blurb(description) {
    if (!description) return '';
    const text = String(description)
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length <= BLURB_LIMIT) return text;
    const cut = text.slice(0, BLURB_LIMIT);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]$/, '') + '...';
  }

  function formatWhen(airedAt) {
    if (!airedAt) return '';
    const d = new Date(airedAt);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  // Load scripts/mixcloud-player.js once, on the first press of Listen.
  function loadPlayer() {
    if (window.BogFactorPlayer) return Promise.resolve(window.BogFactorPlayer);
    if (playerLoad) return playerLoad;

    playerLoad = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = PLAYER_SRC;
      script.onload = function () {
        if (window.BogFactorPlayer) resolve(window.BogFactorPlayer);
        else reject(new Error('player script loaded but exposed nothing'));
      };
      script.onerror = function () { reject(new Error('player script failed to load')); };
      document.head.appendChild(script);
    });

    // A failed load must not be cached as the answer: let the next press retry.
    playerLoad.catch(function () { playerLoad = null; });
    return playerLoad;
  }

  // Two separate waits, and the second one is easy to miss: the player builds
  // its iframe immediately, but `player.widget` only appears once Mixcloud's own
  // API script has run — and even then the object exists before its methods do.
  // Calling load() on a widget whose `ready` has not settled throws
  // "this.widget.load is not a function". So poll for the widget, then await the
  // readiness it hands us.
  function whenPlayable(player) {
    return new Promise(function (resolve, reject) {
      const deadline = Date.now() + PLAYER_TIMEOUT;
      (function check() {
        if (player.widget && player.widget.ready) {
          player.widget.ready.then(function () { resolve(player); }, reject);
          return;
        }
        if (Date.now() > deadline) return reject(new Error('player did not become ready'));
        setTimeout(check, 60);
      })();
    });
  }

  // Press Listen: fetch the player if this is the first press, then hand it the
  // show. If any of that fails, fall back to the link's own destination rather
  // than leaving the reader with a button that did nothing.
  function playHere(button, show) {
    const label = button.textContent;
    button.textContent = 'Loading...';
    button.setAttribute('aria-busy', 'true');

    const done = function () {
      button.textContent = label;
      button.removeAttribute('aria-busy');
    };

    loadPlayer()
      .then(whenPlayable)
      .then(function (player) {
        player.playTrack(show.mixcloudPath, show.title);
        done();
      })
      .catch(function (err) {
        console.warn('Could not open the player here:', err.message);
        done();
        window.location.href = button.href;
      });
  }

  function buildCard(show) {
    const card = document.createElement('article');
    card.className = 'recent-card';

    if (show.image) {
      const img = document.createElement('img');
      img.className = 'recent-card__image';
      img.src = show.image;
      // The title is already the adjacent heading, so naming it again here just
      // makes a screen reader say it twice.
      img.alt = '';
      img.loading = 'lazy';
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'recent-card__body';

    // Date and title ride on one line, the date first and quiet. They were
    // stacked, which spent two rows of every card on what is really one fact —
    // which show, and when.
    const meta = document.createElement('div');
    meta.className = 'recent-card__meta';

    const when = formatWhen(show.airedAt);
    if (when) {
      const whenEl = document.createElement('p');
      whenEl.className = 'recent-card__when';
      whenEl.textContent = when;
      meta.appendChild(whenEl);
    }

    const title = document.createElement('h3');
    title.className = 'recent-card__title';
    const link = document.createElement('a');
    link.href = '/radio/index.html#' + encodeURIComponent(show.id);
    link.textContent = show.title;
    title.appendChild(link);
    meta.appendChild(title);
    body.appendChild(meta);

    const text = blurb(show.description);
    if (text) {
      const desc = document.createElement('p');
      desc.className = 'recent-card__desc';
      desc.textContent = text;
      body.appendChild(desc);
    }

    // Still authored as a link to the show on /radio/, so it works with no
    // JavaScript, opens in a new tab on a middle click, and has somewhere to
    // fall back to. With scripting it plays here instead: the click loads the
    // Mixcloud player on demand and hands it the show.
    //
    // On demand rather than up front because that is the whole reason this used
    // to be a plain link — the player costs a third-party script and iframe, and
    // this is the page that gets the most traffic. Nobody who never presses
    // Listen now pays for it.
    const listen = document.createElement('a');
    listen.className = 'recent-card__listen';
    listen.href = '/radio/index.html#' + encodeURIComponent(show.id);
    listen.textContent = 'Listen';
    listen.setAttribute('aria-label', 'Listen to ' + show.title);

    if (show.mixcloudPath) {
      listen.addEventListener('click', function (event) {
        // Leave the modified clicks alone: they mean "open this somewhere else",
        // and the href is exactly what the reader is asking for.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
            event.button !== 0) {
          return;
        }
        event.preventDefault();
        playHere(listen, show);
      });
    }

    body.appendChild(listen);

    card.appendChild(body);
    return card;
  }

  async function init() {
    if (!isLandingPage()) return;

    const section = document.getElementById('recent-section');
    const grid = document.getElementById('recent-shows');
    if (!section || !grid) return;

    try {
      const res = await fetch('/api/shows', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const shows = await res.json();
      if (!Array.isArray(shows) || !shows.length) return;

      // /api/shows already comes back newest first.
      shows.slice(0, HOW_MANY).forEach(function (show) {
        grid.appendChild(buildCard(show));
      });
      section.hidden = false;

      // This section was hidden when the suns picked their spots, so it had no
      // rectangle for them to avoid. Now it does.
      document.dispatchEvent(new CustomEvent('bog:content-changed'));
    } catch (err) {
      // Leave the section hidden. The hero and the about block still stand on
      // their own, and the nav still reaches the archive.
      console.warn('Could not load recent shows:', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
