/**
 * Bog Factor live stream
 *
 * Two things live in here:
 *
 *   1. The landing-page hero status. The hero itself is static markup in
 *      index.html (so it renders without JS and gives a crawler something to
 *      read); this file fills in the "next show in ..." line, and swaps the
 *      hero into its on-air state when we are broadcasting.
 *
 *   2. The EHFM dock, on every page. This is not a Bog Factor control. It
 *      streams EHFM whether or not our show is on, which is why it is
 *      everywhere and why its label now says whose sound you are about to get.
 *
 * It replaces the old fixed 350px corner widget, which carried the countdown,
 * the listen button and the coming-up list all at once, and the unlabelled
 * circle that used to sit in the bottom-left of every page.
 */

(function () {
  'use strict';

  const STREAM_URLS = [
    'https://ehfm.out.airtime.pro/ehfm_a',
    'https://ehfm.out.airtime.pro/ehfm_b',
  ];
  const STREAM_URL = STREAM_URLS[Math.floor(Math.random() * STREAM_URLS.length)];
  const EHFM_LOGO = 'https://thumbnailer.mixcloud.com/unsafe/640x640/profile/4/5/d/0/f256-daaa-4954-86cc-aa43b7af4e6e';
  const CHAT_URL = 'https://www.ehfm.live/chat';

  const PLAY_GLYPH = '&#9654;&#xFE0E;';
  const PAUSE_GLYPH = '&#9208;&#xFE0E;';
  const MUTED_GLYPH = '&#128263;';

  let audioElement = null;
  let isPlaying = false;
  let dock = null;
  let updateIntervalId;
  let currentInterval;
  // The off-air hero actions as authored in index.html, so going off air can
  // put them back rather than rebuild them from strings in here.
  let heroActionsDefault = '';
  let lastRenderedLive = null;

  // ---- playing state, carried across page navigation ----------------------

  function savePlayingState() {
    sessionStorage.setItem('bogFactorLiveStreamPlaying', isPlaying ? 'true' : 'false');
  }

  function getPlayingState() {
    return sessionStorage.getItem('bogFactorLiveStreamPlaying') === 'true';
  }

  function clearPlayingState() {
    sessionStorage.removeItem('bogFactorLiveStreamPlaying');
  }

  // ---- schedule ------------------------------------------------------------
  // Live/next-show state comes from the DB-backed schedule (scripts/schedule.js),
  // which itself honours window.BogFactorTestConfig for the test pages.

  function getNextShowDate() {
    return window.BogFactorSchedule ? window.BogFactorSchedule.getNextShowDate() : null;
  }

  function isLiveNow() {
    return window.BogFactorSchedule ? window.BogFactorSchedule.isLiveNow() : false;
  }

  function getTimeUntilShow(nextShow) {
    if (!nextShow) return 'soon';
    const now = new Date();
    const diff = nextShow - now;

    if (diff < 0) {
      return 'Starting now...';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Under a day, count down in words with seconds.
    if (days === 0) {
      const parts = [];
      if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
      if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
      if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
      }
      return parts.join(' ');
    }

    return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  function isLandingPage() {
    if (window.BogFactorTestConfig && window.BogFactorTestConfig.isLandingPage !== undefined) {
      return window.BogFactorTestConfig.isLandingPage;
    }
    return window.location.pathname === '/' || window.location.pathname === '/index.html';
  }

  // ---- audio ---------------------------------------------------------------

  function archiveHasAudio() {
    return document.body.classList.contains('mixcloud-player-active');
  }

  function startPlaying() {
    if (archiveHasAudio()) return;
    if (!audioElement) audioElement = new Audio(STREAM_URL);
    audioElement.play();
    isPlaying = true;
    afterPlayStateChange();
  }

  function stopPlaying() {
    if (audioElement) audioElement.pause();
    isPlaying = false;
    afterPlayStateChange();
  }

  function togglePlay() {
    if (isPlaying) {
      stopPlaying();
    } else {
      startPlaying();
    }
  }

  function afterPlayStateChange() {
    updateHeroPlayButton();
    renderDock();
    savePlayingState();
    if (window.BogFactorToolbarWidget) {
      window.BogFactorToolbarWidget.updateUI(isPlaying);
    }
  }

  // ---- the dock ------------------------------------------------------------

  function dockState() {
    if (archiveHasAudio()) return 'blocked';
    return isPlaying ? 'playing' : 'idle';
  }

  function createDock() {
    const el = document.createElement('div');
    el.className = 'ehfm-dock';
    el.dataset.state = 'idle';
    el.dataset.show = 'ehfm';
    el.innerHTML = `
      <button type="button" class="ehfm-dock-btn">
        <span class="ehfm-dock-mark">
          <img class="ehfm-dock-logo" src="${EHFM_LOGO}" alt="" aria-hidden="true"
               width="44" height="44">
          <span class="ehfm-dock-glyph" aria-hidden="true">${PLAY_GLYPH}</span>
        </span>
        <span class="ehfm-dock-copy">
          <span class="ehfm-dock-kicker"></span>
          <span class="ehfm-dock-action"></span>
        </span>
      </button>
      <p class="ehfm-dock-note" id="ehfm-dock-note" role="tooltip"></p>
    `;

    el.querySelector('.ehfm-dock-btn').addEventListener('click', () => {
      // Inert rather than disabled, so it stays focusable and the note below
      // can explain itself to a screen reader.
      if (dockState() === 'blocked') return;
      togglePlay();
    });

    return el;
  }

  function renderDock() {
    if (!dock) return;

    const state = dockState();
    const live = isLiveNow();

    dock.dataset.state = state;
    dock.dataset.show = live ? 'bogfactor' : 'ehfm';

    const btn = dock.querySelector('.ehfm-dock-btn');
    const kicker = dock.querySelector('.ehfm-dock-kicker');
    const action = dock.querySelector('.ehfm-dock-action');
    const glyph = dock.querySelector('.ehfm-dock-glyph');
    const note = dock.querySelector('.ehfm-dock-note');

    // Whose sound is this? Off air it is the station, on air it is us. The old
    // circle looked identical either way, which wasted the one hour a month
    // where the answer actually matters.
    if (live) {
      kicker.innerHTML = '<span class="live-dot"></span>Bog Factor, live';
    } else {
      kicker.textContent = 'EHFM, live';
    }

    if (state === 'blocked') {
      action.textContent = 'Paused for the archive';
      glyph.innerHTML = MUTED_GLYPH;
      note.textContent = 'The archive player has the sound. Close it to come back to the live stream.';
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-pressed', 'false');
      // The tooltip is only drawn on hover, so point at it explicitly: that is
      // what gets the reason read out to someone arriving by keyboard.
      btn.setAttribute('aria-describedby', 'ehfm-dock-note');
    } else if (state === 'playing') {
      action.textContent = 'Stop listening';
      glyph.innerHTML = PAUSE_GLYPH;
      note.textContent = '';
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-describedby');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      action.textContent = 'Listen live';
      glyph.innerHTML = PLAY_GLYPH;
      note.textContent = '';
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-describedby');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function mountDock() {
    if (dock) return;
    dock = createDock();
    document.body.appendChild(dock);
    renderDock();
  }

  // ---- the landing hero ----------------------------------------------------

  function updateHeroPlayButton() {
    const btn = document.getElementById('stream-play-btn');
    if (!btn) return;
    btn.textContent = isPlaying ? 'Stop listening' : 'Listen live';
    btn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  }

  // Full hero render. Only called on a live/off-air change, so a returning
  // listener is not having their CTA rebuilt underneath them every second.
  function renderHero() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    const status = document.getElementById('hero-status');
    const actions = document.getElementById('hero-actions');
    const live = isLiveNow();

    hero.dataset.live = live ? 'true' : 'false';

    if (live) {
      status.innerHTML = '<span class="live-dot"></span>On air right now on EHFM';

      const listen = document.createElement('button');
      listen.type = 'button';
      listen.className = 'play-btn';
      listen.id = 'stream-play-btn';
      listen.textContent = 'Listen live';

      const chat = document.createElement('a');
      chat.className = 'hero-link';
      chat.href = CHAT_URL;
      chat.target = '_blank';
      chat.rel = 'noopener noreferrer';
      chat.textContent = 'Join the chat';

      actions.replaceChildren(listen, chat);
      listen.addEventListener('click', togglePlay);
      updateHeroPlayButton();
    } else {
      updateHeroCountdown();
      // Back to the archive link exactly as index.html authored it.
      actions.innerHTML = heroActionsDefault;
    }

    // The test pages listen for this to know the panel was (re)built.
    document.dispatchEvent(new CustomEvent('bogfactor:widget-rendered'));
  }

  // The cheap per-second update: just the countdown text.
  function updateHeroCountdown() {
    const status = document.getElementById('hero-status');
    if (!status) return;
    const next = getNextShowDate();
    status.textContent = next
      ? `Next show in ${getTimeUntilShow(next)}`
      : 'Next show to be announced';
  }

  // ---- ticking -------------------------------------------------------------

  function updateCountdownAndStatus() {
    const live = isLiveNow();

    if (live !== lastRenderedLive) {
      lastRenderedLive = live;
      renderHero();
      renderDock();
      return;
    }

    if (!live) updateHeroCountdown();
  }

  function getUpdateInterval() {
    const nextShow = getNextShowDate();
    if (!nextShow) return 60000;
    const diff = nextShow - new Date();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    // Every second while live or inside the last day, every minute otherwise.
    if (isLiveNow() || days === 0) return 1000;
    return 60000;
  }

  function startUpdateInterval() {
    if (updateIntervalId) clearInterval(updateIntervalId);
    updateIntervalId = setInterval(() => {
      updateCountdownAndStatus();
      const newInterval = getUpdateInterval();
      if (newInterval !== currentInterval) {
        currentInterval = newInterval;
        startUpdateInterval();
      }
    }, currentInterval);
  }

  function restoreAudioState() {
    if (!getPlayingState() || archiveHasAudio()) return;

    setTimeout(() => {
      if (!audioElement) audioElement = new Audio(STREAM_URL);
      audioElement
        .play()
        .then(() => {
          isPlaying = true;
          updateHeroPlayButton();
          renderDock();
          if (window.BogFactorToolbarWidget) {
            window.BogFactorToolbarWidget.updateUI(true);
          }
        })
        .catch((err) => {
          console.log('Could not auto-play audio:', err);
          isPlaying = false;
          savePlayingState();
        });
    }, 100);
  }

  function updateToolbarHeight() {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      document.documentElement.style.setProperty(
        '--toolbar-height',
        `${toolbar.offsetHeight}px`
      );
    }
  }

  function init() {
    updateToolbarHeight();
    window.addEventListener('resize', updateToolbarHeight);

    const actions = document.getElementById('hero-actions');
    if (actions) heroActionsDefault = actions.innerHTML;

    // The dock is on every page, on air or not.
    mountDock();

    restoreAudioState();
    window.addEventListener('beforeunload', savePlayingState);

    // Wait for the schedule before touching the hero, so the first paint is
    // not a wrong state that then corrects itself.
    const startScheduleUI = () => {
      lastRenderedLive = isLiveNow();
      if (isLandingPage()) renderHero();
      renderDock();
      currentInterval = getUpdateInterval();
      startUpdateInterval();
    };

    if (window.BogFactorSchedule) {
      window.BogFactorSchedule.onReady(startScheduleUI);
      document.addEventListener('bogfactor:schedule-updated', () => {
        updateCountdownAndStatus();
      });
    } else {
      startScheduleUI();
    }
  }

  // ---- public API ----------------------------------------------------------

  window.BogFactorLiveStream = {
    toggleStream() {
      togglePlay();
    },
    stopStream() {
      if (isPlaying) stopPlaying();
    },
    getPlayingState() {
      return isPlaying;
    },
    // Kept under its old name: mixcloud-player.js calls this when the archive
    // player takes or releases the audio.
    updateFloatingPlayer() {
      renderDock();
    },
    clearPlayingState() {
      clearPlayingState();
    },
    forceUpdate() {
      updateCountdownAndStatus();
      const newInterval = getUpdateInterval();
      if (newInterval !== currentInterval) currentInterval = newInterval;
      startUpdateInterval();
    },
    getCurrentInterval() {
      return currentInterval;
    },
    getNextShowDate() {
      return getNextShowDate();
    },
    isLiveNow() {
      return isLiveNow();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
