/**
 * Upcoming Shows: the landing-page "town crier" cards
 *
 * These cards live inside the hero now, standing where a second "Listen to
 * EHFM" button used to. They are the one place on the page that answers "when
 * is the next one". A card is rendered for anything on the schedule within the
 * next 7 days (the recurring show plus any ad-hoc specials), and when there is
 * nothing that close a single card still announces the next known broadcast,
 * so the answer is never missing.
 *
 * Data comes from scripts/schedule.js (window.BogFactorSchedule): getUpcoming()
 * for the 7-day window, getNextShowDate() for the fallback. Each occurrence
 * carries an `image` (town-crier motif by default, or a per-show override),
 * title, description, start/end and an optional announcement link.
 *
 * The card is a sheet of paper, not a gadget. Its "when" line is a date that
 * changes at most once a day, and only inside the final hour — when the wait is
 * short enough for seconds to mean anything — does it start ticking and turn
 * red. See whenText() and needsSeconds(). The timer paces itself to match, so
 * the page is not running a one-second interval to redraw a date three weeks
 * out.
 *
 * The "when" line always carries the `.countdown` class, whether it is ticking
 * or not, because the test pages read the live text from that hook.
 *
 * Landing page only. Re-renders when the schedule refreshes.
 */
(function () {
  'use strict';

  const CONTAINER_ID = 'upcoming-shows';
  const STANDING_SCHEDULE = 'Live on EHFM, first Friday of the month, 1pm to 2pm UK.';

  const SECOND = 1000;
  const HOUR = 60 * 60 * SECOND;
  const DAY = 24 * HOUR;

  // Inside this much of the start, the card ticks in seconds. Outside it, the
  // card is static paper.
  const TICKING_WINDOW = HOUR;

  // How many cards the hero will carry at once. See currentOccurrences().
  const MAX_CARDS = 2;

  // Set by render(): one entry per card on screen, holding its "when" element
  // and the identity of the occurrence it was built from. The tick rewrites
  // only the "when" lines, so a ticking countdown never rebuilds the cards
  // underneath a reader — but it compares identities first, so a schedule that
  // changes out from under us (or a test page driving the date) still gets a
  // full re-render.
  let rendered = [];
  let tickTimer = null;
  let tickInterval = null;

  function isLandingPage() {
    if (window.BogFactorTestConfig && window.BogFactorTestConfig.isLandingPage !== undefined) {
      return window.BogFactorTestConfig.isLandingPage;
    }
    return window.location.pathname === '/' || window.location.pathname === '/index.html';
  }

  function nextShowDate() {
    return window.BogFactorSchedule ? window.BogFactorSchedule.getNextShowDate() : null;
  }

  // live-stream.js owns the wording of the countdown ("9 days, 22 hours",
  // seconds inside the last day). Reuse it rather than growing a second copy
  // that drifts; fall back to a bare date if that script is not on the page.
  function timeUntil(date) {
    const api = window.BogFactorLiveStream;
    return api && api.formatTimeUntil ? api.formatTimeUntil(date) : null;
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'Europe/London',
    }).replace(',', '');
  }

  function isLive(occ, now) {
    const start = Date.parse(occ.startsAt);
    const end = occ.endsAt ? Date.parse(occ.endsAt) : start;
    return start <= now && now < end;
  }

  // Is this occurrence close enough that its line counts in seconds?
  function ticks(occ, now) {
    if (isLive(occ, now)) return true;
    const start = Date.parse(occ.startsAt);
    return !isNaN(start) && start - now < TICKING_WINDOW;
  }

  // The card's headline fact.
  //
  // For a monthly show, "in 15 hours 39 minutes 16 seconds" is precision nobody
  // asked for, and a line rewriting itself every second turns a proclamation
  // into a dashboard. So outside the final hour this is a date: days at the
  // coarsest, a clock time at the finest, changing once a day at most.
  //
  // Inside the final hour the wait is short enough that seconds genuinely mean
  // something, and the card wakes up: full countdown, no date pinned on the end
  // (that would say the same thing twice at twice the length).
  function whenText(occ) {
    const now = Date.now();
    if (isLive(occ, now)) return 'On air now!';

    const start = Date.parse(occ.startsAt);
    if (isNaN(start)) return 'Date to be announced';

    const away = start - now;

    if (away < TICKING_WINDOW) {
      const until = timeUntil(new Date(start));
      return until ? `In ${until}` : fmtDate(start);
    }

    // "In 3 days" is worth saying; "in 0 days" is not, and inside a day the
    // clock time alone already answers it.
    const days = Math.floor(away / DAY);
    return days >= 1
      ? `In ${days} day${days === 1 ? '' : 's'} · ${fmtDate(start)}`
      : fmtDate(start);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function buildCard(occ) {
    const now = Date.now();
    const live = isLive(occ, now);
    // `.countdown` is the stable hook the test pages read. The `--countdown`
    // modifier is the loud red styling, and it is earned only while the line is
    // actually counting down; the rest of the month it is quiet brown on paper.
    const whenClass = 'crier-card__when countdown' +
      (ticks(occ, now) ? ' crier-card__when--countdown' : '');

    const card = document.createElement(occ.link ? 'a' : 'div');
    card.className = 'crier-card' + (live ? ' crier-card--live' : '');
    if (occ.link) {
      card.href = occ.link;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }

    const img = occ.image || '/assets/town-crier.png';
    card.innerHTML = `
      <img class="crier-card__crier" src="${escapeHtml(img)}" alt="" aria-hidden="true">
      <div class="crier-card__body">
        <p class="${whenClass}">${escapeHtml(whenText(occ))}</p>
        <h3 class="crier-card__title">${escapeHtml(occ.title || 'Bog Factor')}</h3>
        ${occ.description ? `<p class="crier-card__desc">${escapeHtml(occ.description)}</p>` : ''}
      </div>
    `;

    rendered.push({
      el: card.querySelector('.crier-card__when'),
      key: occKey(occ),
    });
    return card;
  }

  // Enough of an occurrence to notice when it has been replaced rather than
  // merely ticked forward.
  function occKey(occ) {
    return (occ.startsAt || '') + '|' + (occ.title || '') + '|' + (occ.description || '');
  }

  // What the section should be showing right now. An empty 7-day window is no
  // longer a reason to hide anything: the next show's date lives here, so there
  // is always something to say.
  //
  // Capped here rather than at the render site so that every caller — render()
  // and the tick's has-it-changed check alike — is looking at the same list. A
  // capped render compared against an uncapped tick never matches, and the card
  // rebuilds itself on every pass.
  function currentOccurrences() {
    const upcoming = window.BogFactorSchedule.getUpcoming() || [];
    const occs = upcoming.length ? upcoming : [fallbackOccurrence()];
    // The hero is a proclamation, not a noticeboard: a third card would push
    // the fold, and /radio has the rest.
    return occs.slice(0, MAX_CARDS);
  }

  // Nothing inside the 7-day window: announce the next broadcast we know about
  // anyway, and fall back to the standing schedule when even that is unknown.
  function fallbackOccurrence() {
    const next = nextShowDate();
    return {
      startsAt: next ? next.toISOString() : null,
      title: 'Bog Factor',
      description: STANDING_SCHEDULE,
    };
  }

  // How often the cards on screen actually need looking at. A second while
  // something is ticking or on air; otherwise every five, which is quick enough
  // that a schedule edit or a crossing into the final hour never looks stuck,
  // without running a per-second loop to redraw a date three weeks out.
  //
  // Nothing depends on this for correctness: a show going on air is caught in
  // the same second by live-stream.js, which re-renders these cards with the
  // hero. This interval is only the backstop for changes that arrive without an
  // event to announce them.
  function tickRate(occs) {
    const now = Date.now();
    return occs.some((occ) => ticks(occ, now)) ? SECOND : 5 * SECOND;
  }

  function tick() {
    const occs = currentOccurrences();

    // The schedule moved on: a show started, ended, or was edited. Rebuild
    // rather than tick stale copy.
    const changed = occs.length !== rendered.length ||
      occs.some((occ, i) => occKey(occ) !== rendered[i].key);
    if (changed) { render(); return; }

    occs.forEach((occ, i) => {
      const entry = rendered[i];
      const el = entry && entry.el;
      if (!el || !el.isConnected) return;

      const text = whenText(occ);
      // Only touch the DOM when the wording actually changed, which off the
      // final hour is almost never.
      if (el.textContent !== text) el.textContent = text;

      // Crossing into the final hour is what turns the line red. Nothing else
      // about the card changes, so toggle the class rather than rebuild.
      el.classList.toggle('crier-card__when--countdown', ticks(occ, Date.now()));
    });

    // The rate itself changes as the show approaches, so re-pace every pass.
    startTicking(occs);
  }

  // Idempotent: restarts the timer only when the rate it should run at has
  // changed, so the common case (a static card, checked twice a minute) leaves
  // the existing timer alone.
  function startTicking(occs) {
    const rate = tickRate(occs || currentOccurrences());
    if (tickTimer && rate === tickInterval) return;
    if (tickTimer) clearInterval(tickTimer);
    tickInterval = rate;
    tickTimer = setInterval(tick, rate);
  }

  function render() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || !window.BogFactorSchedule) return;

    const occurrences = currentOccurrences();

    rendered = [];

    // One cry, above however many cards follow. It was briefly a kicker printed
    // on each card instead, which read as the same announcement made twice when
    // a special shared the week with the regular show — and left the second
    // card's date sitting a line higher than the first's.
    const heading = document.createElement('p');
    heading.className = 'crier-heading';
    heading.textContent = 'Hear ye! Coming up...';

    container.replaceChildren(heading, ...occurrences.map(buildCard));
    startTicking(occurrences);
  }

  function init() {
    if (!isLandingPage()) return;
    if (!window.BogFactorSchedule) return;
    // live-stream.js rebuilds the hero on every live/off-air transition and
    // announces it; re-render then, when the schedule first loads, and on each
    // refresh, so a show going on air flips this card with it.
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
