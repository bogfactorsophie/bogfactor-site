/**
 * Toolbar Live Widget
 * Shows "LIVE NOW" indicator in toolbar when Bog Factor is broadcasting
 * Plays EHFM stream when clicked
 */

(function() {
  'use strict';

  // Live state comes from the DB-backed schedule (scripts/schedule.js), which
  // also honours window.BogFactorTestConfig for the test pages.
  function isLiveNow() {
    return window.BogFactorSchedule ? window.BogFactorSchedule.isLiveNow() : false;
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
