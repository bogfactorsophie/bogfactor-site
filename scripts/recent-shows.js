/**
 * Recent shows, landing page only.
 *
 * Fills the "Latest from the bog" section with the three most recent shows from
 * /api/shows: artwork, title, a trimmed description and a link through to the
 * show's own anchor on /radio/. Play goes through the same Mixcloud player the
 * radio page uses when that script is present; otherwise the card is a link.
 *
 * The section starts hidden and only reveals itself once there is something to
 * show, so a failed fetch leaves no empty frame on the page.
 */
(function () {
  'use strict';

  const HOW_MANY = 3;
  const BLURB_LIMIT = 130;

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

    const when = formatWhen(show.airedAt);
    if (when) {
      const whenEl = document.createElement('p');
      whenEl.className = 'recent-card__when';
      whenEl.textContent = when;
      body.appendChild(whenEl);
    }

    const title = document.createElement('h3');
    title.className = 'recent-card__title';
    const link = document.createElement('a');
    link.href = '/radio/index.html#' + encodeURIComponent(show.id);
    link.textContent = show.title;
    title.appendChild(link);
    body.appendChild(title);

    const text = blurb(show.description);
    if (text) {
      const desc = document.createElement('p');
      desc.className = 'recent-card__desc';
      desc.textContent = text;
      body.appendChild(desc);
    }

    // A link, not a Play button. The Mixcloud player deliberately does not load
    // on the landing page (it costs a third-party iframe and script on the page
    // that gets the most traffic), so a control labelled Play would have to
    // navigate to do its job, which is not what Play means. This says where it
    // goes and goes there.
    const listen = document.createElement('a');
    listen.className = 'recent-card__listen';
    listen.href = '/radio/index.html#' + encodeURIComponent(show.id);
    listen.textContent = 'Listen';
    listen.setAttribute('aria-label', 'Listen to ' + show.title + ' on the radio page');
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
