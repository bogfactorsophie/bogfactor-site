/**
 * Upcoming Shows: the landing-page "town crier" cards
 *
 * Renders a little list of cards for anything on the schedule within the next
 * 7 days (the recurring show plus any ad-hoc specials). Data comes from
 * scripts/schedule.js (window.BogFactorSchedule.getUpcoming()); each occurrence
 * carries an `image` (town-crier motif by default, or a per-show override),
 * title, description, start/end and an optional announcement link.
 *
 * Landing page only. Re-renders when the schedule refreshes.
 */
(function () {
  'use strict';

  const CONTAINER_ID = 'upcoming-shows';

  function isLandingPage() {
    if (window.BogFactorTestConfig && window.BogFactorTestConfig.isLandingPage !== undefined) {
      return window.BogFactorTestConfig.isLandingPage;
    }
    return window.location.pathname === '/' || window.location.pathname === '/index.html';
  }

  function fmtWhen(occ, now) {
    const start = Date.parse(occ.startsAt);
    const end = occ.endsAt ? Date.parse(occ.endsAt) : start;
    if (start <= now && now < end) return 'On air now!';

    const opts = {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'Europe/London',
    };
    return new Date(start).toLocaleString('en-GB', opts).replace(',', '');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function buildCard(occ, now) {
    const isLive = (() => {
      const s = Date.parse(occ.startsAt);
      const e = occ.endsAt ? Date.parse(occ.endsAt) : s;
      return s <= now && now < e;
    })();

    const card = document.createElement(occ.link ? 'a' : 'div');
    card.className = 'crier-card' + (isLive ? ' crier-card--live' : '');
    if (occ.link) {
      card.href = occ.link;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }

    const img = occ.image || '/assets/town-crier.png';
    card.innerHTML = `
      <img class="crier-card__crier" src="${escapeHtml(img)}" alt="" aria-hidden="true">
      <div class="crier-card__body">
        <p class="crier-card__when">${escapeHtml(fmtWhen(occ, now))}</p>
        <h3 class="crier-card__title">${escapeHtml(occ.title || 'Bog Factor')}</h3>
        ${occ.description ? `<p class="crier-card__desc">${escapeHtml(occ.description)}</p>` : ''}
      </div>
    `;
    return card;
  }

  function render() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || !window.BogFactorSchedule) return;

    // The cards now live in their own section below the hero rather than inside
    // the old fixed widget, so an empty schedule has to hide the whole section
    // (heading included) and not just the list.
    const section = container.closest('.upcoming-section');
    const upcoming = window.BogFactorSchedule.getUpcoming() || [];

    if (!upcoming.length) {
      container.innerHTML = '';
      if (section) section.hidden = true;
      return;
    }

    const now = Date.now();
    if (section) section.hidden = false;
    container.innerHTML = '<p class="crier-heading">Hear ye! Coming up...</p>';
    upcoming.forEach((occ) => container.appendChild(buildCard(occ, now)));
  }

  function init() {
    if (!isLandingPage()) return;
    if (!window.BogFactorSchedule) return;
    // The #upcoming-shows container lives inside the live-stream widget, which
    // live-stream.js builds (and rebuilds on live/off-air transitions). Render
    // whenever it's (re)built, when the schedule first loads, and on refresh.
    document.addEventListener('bogfactor:widget-rendered', render);
    document.addEventListener('bogfactor:schedule-updated', render);
    window.BogFactorSchedule.onReady(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
