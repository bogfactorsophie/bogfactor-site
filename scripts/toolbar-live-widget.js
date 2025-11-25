/**
 * Toolbar Live Widget
 * Shows "LIVE NOW" indicator in toolbar when Bog Factor is broadcasting
 * Plays EHFM stream when clicked
 */

(function() {
  'use strict';

  const STREAM_URL = 'https://ehfm.out.airtime.pro/ehfm_a';
  const SHOW_START_HOUR = 13; // 1pm UK time (24h format)
  const SHOW_END_HOUR = 14;   // 2pm UK time

  let toolbarAudio = null;
  let isToolbarPlaying = false;

  function getFirstFridayOfMonth(year, month) {
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay();
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && firstDay.getDate() !== 1) {
      daysUntilFriday = 7;
    }
    const firstFriday = new Date(year, month, 1 + daysUntilFriday);
    return firstFriday;
  }

  function isLiveNow() {
    const now = new Date();
    const ukNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));

    const year = ukNow.getFullYear();
    const month = ukNow.getMonth();
    const firstFriday = getFirstFridayOfMonth(year, month);

    const isFirstFriday = ukNow.getDate() === firstFriday.getDate() &&
                          ukNow.getMonth() === firstFriday.getMonth() &&
                          ukNow.getFullYear() === firstFriday.getFullYear();

    const hour = ukNow.getHours();
    const isShowTime = hour >= SHOW_START_HOUR && hour < SHOW_END_HOUR;

    return isFirstFriday && isShowTime;
  }

  function toggleToolbarPlay() {
    // Check if landing page player is playing and pause it
    if (window.BogFactorPlayer && window.BogFactorPlayer.widget) {
      try {
        window.BogFactorPlayer.widget.pause();
      } catch (e) {
        // Widget might not be ready
      }
    }

    if (!toolbarAudio) {
      toolbarAudio = new Audio(STREAM_URL);
    }

    if (isToolbarPlaying) {
      toolbarAudio.pause();
      isToolbarPlaying = false;
      updateToolbarButton();
    } else {
      toolbarAudio.play();
      isToolbarPlaying = true;
      updateToolbarButton();
    }
  }

  function updateToolbarButton() {
    const btn = document.getElementById('toolbar-live-btn');
    if (btn) {
      const playIcon = btn.querySelector('.toolbar-play-icon');
      if (playIcon) {
        playIcon.innerHTML = isToolbarPlaying ? '&#9208;&#xFE0E;' : '&#9654;&#xFE0E;';
      }
    }
  }

  function createToolbarWidget() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    const liveWidget = document.createElement('div');
    liveWidget.id = 'toolbar-live-widget';
    liveWidget.className = 'toolbar-live-widget';

    liveWidget.innerHTML = `
      <button id="toolbar-live-btn" class="toolbar-live-btn">
        <span class="toolbar-live-dot"></span>
        <span class="toolbar-live-text">LIVE NOW</span>
        <span class="toolbar-play-icon">&#9654;&#xFE0E;</span>
      </button>
      <a href="https://www.ehfm.live/chat" target="_blank" rel="noopener noreferrer" class="toolbar-chat-btn">
        <span class="toolbar-chat-icon">🗨</span>
        <span class="toolbar-chat-text">Chat</span>
      </a>
    `;

    toolbar.appendChild(liveWidget);

    // Attach click handler
    const btn = document.getElementById('toolbar-live-btn');
    if (btn) {
      btn.addEventListener('click', toggleToolbarPlay);
    }
  }

  function init() {
    if (isLiveNow()) {
      createToolbarWidget();

      // Check every minute if we're still live
      setInterval(() => {
        if (!isLiveNow()) {
          const widget = document.getElementById('toolbar-live-widget');
          if (widget) {
            widget.remove();
          }
          if (toolbarAudio) {
            toolbarAudio.pause();
            toolbarAudio = null;
          }
        }
      }, 60000);
    } else {
      // Check every minute if we've gone live
      setInterval(() => {
        if (isLiveNow() && !document.getElementById('toolbar-live-widget')) {
          createToolbarWidget();
        }
      }, 60000);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
