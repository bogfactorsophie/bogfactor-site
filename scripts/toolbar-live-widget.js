/**
 * Toolbar Live Widget
 * Shows "LIVE NOW" indicator in toolbar when Bog Factor is broadcasting
 * Plays EHFM stream when clicked
 */

(function() {
  'use strict';

  const SHOW_START_HOUR = 13; // 1pm UK time (24h format)
  const SHOW_END_HOUR = 14;   // 2pm UK time

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
    if (window.BogFactorTestConfig && typeof window.BogFactorTestConfig.isLiveNow === 'function') {
      const result = window.BogFactorTestConfig.isLiveNow();
      if (result !== null) return result;
    }

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
    // Use shared audio from live-stream.js if available
    if (window.BogFactorLiveStream && window.BogFactorLiveStream.toggleStream) {
      window.BogFactorLiveStream.toggleStream();
    }
  }

  function updateToolbarButton(isPlaying) {
    const btn = document.getElementById('toolbar-live-btn');
    if (btn) {
      const playIcon = btn.querySelector('.toolbar-play-icon');
      if (playIcon) {
        playIcon.innerHTML = isPlaying ? '&#9208;&#xFE0E;' : '&#9654;&#xFE0E;';
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

      // Sync initial state with live stream player
      if (window.BogFactorLiveStream && window.BogFactorLiveStream.getPlayingState) {
        updateToolbarButton(window.BogFactorLiveStream.getPlayingState());
      }
    }

    // Check every second for live/off-air transitions in either direction
    setInterval(() => {
      const live = isLiveNow();
      const widgetExists = !!document.getElementById('toolbar-live-widget');

      if (live && !widgetExists) {
        createToolbarWidget();
      } else if (!live && widgetExists) {
        document.getElementById('toolbar-live-widget').remove();
      }
    }, 1000);
  }

  // Expose API for other scripts (like live-stream.js)
  window.BogFactorToolbarWidget = {
    updateUI(isPlaying) {
      updateToolbarButton(isPlaying);
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
