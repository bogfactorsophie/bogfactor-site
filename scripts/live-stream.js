/**
 * Bog Factor Live Stream Widget
 * Shows live player when broadcasting, next show info when off-air
 */

(function() {
  'use strict';

  const STREAM_URL = 'https://ehfm.out.airtime.pro/ehfm_a';
  const SHOW_START_HOUR = 13; // 1pm UK time (24h format)
  const SHOW_END_HOUR = 14;   // 2pm UK time
  const EHFM_LOGO = 'https://thumbnailer.mixcloud.com/unsafe/640x640/profile/4/5/d/0/f256-daaa-4954-86cc-aa43b7af4e6e';

  let audioElement = null;
  let isPlaying = false;
  let floatingPlayer = null;
  let mainWidget = null;

  // Store/restore playing state across page navigation
  function savePlayingState() {
    sessionStorage.setItem('bogFactorLiveStreamPlaying', isPlaying ? 'true' : 'false');
  }

  function getPlayingState() {
    return sessionStorage.getItem('bogFactorLiveStreamPlaying') === 'true';
  }

  function clearPlayingState() {
    sessionStorage.removeItem('bogFactorLiveStreamPlaying');
  }

  function getFirstFridayOfMonth(year, month) {
    // month is 0-indexed (0 = January)
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay();

    // Calculate days until Friday (5)
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && firstDay.getDate() !== 1) {
      daysUntilFriday = 7;
    }

    const firstFriday = new Date(year, month, 1 + daysUntilFriday);
    return firstFriday;
  }

  function getNextShowDate() {
    const now = new Date();
    const ukNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));

    let year = ukNow.getFullYear();
    let month = ukNow.getMonth();

    // Get first Friday of current month
    let nextShow = getFirstFridayOfMonth(year, month);
    nextShow.setHours(SHOW_START_HOUR, 0, 0, 0);

    // Convert to UK time for comparison
    const nextShowUK = new Date(nextShow.toLocaleString('en-US', { timeZone: 'Europe/London' }));

    // If we've passed this month's show, get next month's
    if (ukNow > new Date(nextShowUK.getTime() + 60 * 60 * 1000)) { // after 2pm of first Friday
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
      nextShow = getFirstFridayOfMonth(year, month);
      nextShow.setHours(SHOW_START_HOUR, 0, 0, 0);
    }

    return nextShow;
  }

  function isLiveNow() {
    const now = new Date();
    const ukNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));

    const year = ukNow.getFullYear();
    const month = ukNow.getMonth();
    const firstFriday = getFirstFridayOfMonth(year, month);

    // Check if today is first Friday
    const isFirstFriday = ukNow.getDate() === firstFriday.getDate() &&
                          ukNow.getMonth() === firstFriday.getMonth() &&
                          ukNow.getFullYear() === firstFriday.getFullYear();

    // Check if time is between 1pm-2pm UK
    const hour = ukNow.getHours();
    const isShowTime = hour >= SHOW_START_HOUR && hour < SHOW_END_HOUR;

    return isFirstFriday && isShowTime;
  }

  function formatNextShowDate(date) {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Europe/London',
      timeZoneName: 'short'
    };
    return date.toLocaleString('en-GB', options);
  }

  function getTimeUntilShow(nextShow) {
    const now = new Date();
    const diff = nextShow - now;

    // If we've passed the show time (negative diff), return "Starting now..."
    if (diff < 0) {
      return 'Starting now...';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // If less than 1 day, show detailed textual format with seconds
    if (days === 0) {
      const parts = [];

      if (hours > 0) {
        parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
      }
      if (minutes > 0) {
        parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
      }
      if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
      }

      return parts.join(' ');
    }

    // If more than 1 day, show original format
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  }

  function togglePlay() {
    if (!audioElement) {
      audioElement = new Audio(STREAM_URL);
    }

    if (isPlaying) {
      audioElement.pause();
      isPlaying = false;
      updatePlayButton();
      updateFloatingPlayer();
      savePlayingState();
    } else {
      audioElement.play();
      isPlaying = true;
      updatePlayButton();
      updateFloatingPlayer();
      savePlayingState();
    }
  }

  function updatePlayButton() {
    const playBtn = document.getElementById('stream-play-btn');
    if (playBtn) {
      playBtn.innerHTML = isPlaying ? '&#9208;&#xFE0E;' : '&#9654;&#xFE0E;';
      playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }
  }

  function updateFloatingPlayer() {
    if (!floatingPlayer) return;

    const logo = floatingPlayer.querySelector('.floating-player-logo');
    const pauseBtn = floatingPlayer.querySelector('.floating-player-pause');
    const muteIcon = floatingPlayer.querySelector('.floating-player-mute');
    const isMixcloudActive = document.body.classList.contains('mixcloud-player-active');

    if (isMixcloudActive && muteIcon) {
      // Show mute icon when Mixcloud is playing
      logo.style.display = 'none';
      pauseBtn.style.display = 'none';
      muteIcon.style.display = 'flex';
    } else if (isPlaying) {
      logo.style.display = 'none';
      pauseBtn.style.display = 'flex';
      if (muteIcon) muteIcon.style.display = 'none';
    } else {
      logo.style.display = 'block';
      pauseBtn.style.display = 'none';
      if (muteIcon) muteIcon.style.display = 'none';
    }
  }

  function createToolbarLiveLabel() {
    const label = document.createElement('div');
    label.className = 'toolbar-live-label';
    label.innerHTML = '<span class="toolbar-live-dot"></span>Live Now';
    label.style.cursor = 'pointer';
    label.addEventListener('click', togglePlay);
    return label;
  }

  function updateToolbarLiveLabel() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    const existingLabel = toolbar.querySelector('.toolbar-live-label');
    const live = isLiveNow();

    if (live && !existingLabel) {
      // Add label to toolbar
      const label = createToolbarLiveLabel();
      toolbar.insertBefore(label, toolbar.firstChild);
    } else if (!live && existingLabel) {
      // Remove label if not live
      existingLabel.remove();
    }
  }

  function createFloatingPlayer() {
    const isLandingPage = window.location.pathname === '/' || window.location.pathname === '/index.html';

    const player = document.createElement('div');
    player.className = 'floating-audio-player';
    player.innerHTML = `
      <div class="floating-player-wrapper">
        <div class="floating-player-circle">
          <img src="${EHFM_LOGO}" alt="Play EHFM Live" class="floating-player-logo" />
          <button class="floating-player-pause" aria-label="Pause">&#9208;&#xFE0E;</button>
          <div class="floating-player-mute" title="Live stream paused while show is playing">&#128263;</div>
        </div>
        ${isLandingPage ? '<button class="floating-player-expand" aria-label="Expand widget">+</button>' : ''}
      </div>
    `;

    // Function to start playing
    const startPlaying = () => {
      // Don't allow playing if Mixcloud is active
      if (document.body.classList.contains('mixcloud-player-active')) {
        return;
      }

      if (!audioElement) {
        audioElement = new Audio(STREAM_URL);
      }
      audioElement.play();
      isPlaying = true;
      updateFloatingPlayer();
      updatePlayButton();
      savePlayingState();
    };

    // Logo click - start playing
    const logo = player.querySelector('.floating-player-logo');
    logo.addEventListener('click', startPlaying);

    // Pause button click - stop playing
    const pauseBtn = player.querySelector('.floating-player-pause');
    pauseBtn.addEventListener('click', () => {
      // Don't allow pausing if Mixcloud is active
      if (document.body.classList.contains('mixcloud-player-active')) {
        return;
      }

      if (audioElement) {
        audioElement.pause();
      }
      isPlaying = false;
      updateFloatingPlayer();
      updatePlayButton();
      savePlayingState();
    });

    // Expand button click - show main widget (only on landing page)
    if (isLandingPage) {
      const expandBtn = player.querySelector('.floating-player-expand');
      if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering parent click events
          if (mainWidget) {
            // Show the main widget
            mainWidget.style.display = 'block';
            mainWidget.style.opacity = '1';
            mainWidget.style.transform = 'translateY(0)';
            // Hide floating player
            hideFloatingPlayer();
          }
        });
      }
    }

    return player;
  }

  function showFloatingPlayer() {
    if (!floatingPlayer) {
      floatingPlayer = createFloatingPlayer();
      document.body.appendChild(floatingPlayer);
      updateFloatingPlayer();
    } else {
      floatingPlayer.style.display = 'block';
      updateFloatingPlayer(); // Update state when showing existing player
    }
  }

  function hideFloatingPlayer() {
    if (floatingPlayer) {
      floatingPlayer.style.display = 'none';
    }
  }

  function createWidget() {
    const widget = document.createElement('div');
    widget.id = 'stream-widget';
    widget.className = 'stream-widget';

    const live = isLiveNow();
    const nextShow = getNextShowDate();

    if (live) {
      // We're live!
      widget.innerHTML = `
        <button class="stream-minimize-btn" aria-label="Minimize widget">&#9866;</button>
        <div class="stream-live-indicator">
          <span class="live-dot"></span>
          <span class="live-text">LIVE NOW!</span>
        </div>
        <div class="stream-player">
          <button id="stream-play-btn" class="stream-play-button" aria-label="Play">&#9654;&#xFE0E;</button>
          <a href="https://www.ehfm.live/" target="_blank" rel="noopener noreferrer">
            <img src="${EHFM_LOGO}" alt="EHFM Logo" class="ehfm-logo">
          </a>
        </div>
        <p class="stream-subtitle">Broadcasting from the bog &#8226; 1-2pm UK</p>
      `;
    } else {
      // Off-air
      widget.innerHTML = `
        <button class="stream-minimize-btn" aria-label="Minimize widget">&#9866;</button>
        <div class="stream-header">
          <p class="countdown">Next show in ${getTimeUntilShow(nextShow)}</p>
        </div>
        <div class="stream-player">
          <button id="stream-play-btn" class="stream-play-button" aria-label="Play">&#9654;&#xFE0E;</button>
          <a href="https://www.ehfm.live/" target="_blank" rel="noopener noreferrer">
            <img src="${EHFM_LOGO}" alt="EHFM Logo" class="ehfm-logo">
          </a>
        </div>
      `;
    }

    return widget;
  }

  function updateToolbarHeight() {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      const height = toolbar.offsetHeight;
      document.documentElement.style.setProperty('--toolbar-height', `${height}px`);
    }
  }

  function restoreAudioState() {
    // Check if audio was playing in previous page
    const wasPlaying = getPlayingState();
    const isMixcloudActive = document.body.classList.contains('mixcloud-player-active');

    // Only restore if it was playing and Mixcloud isn't active
    if (wasPlaying && !isMixcloudActive) {
      // Small delay to ensure UI is ready
      setTimeout(() => {
        if (!audioElement) {
          audioElement = new Audio(STREAM_URL);
        }
        audioElement.play().then(() => {
          isPlaying = true;
          updatePlayButton();
          updateFloatingPlayer();
        }).catch(err => {
          console.log('Could not auto-play audio:', err);
          // Clear state if autoplay fails
          isPlaying = false;
          savePlayingState();
        });
      }, 100);
    }
  }

  function init() {
    // Check if we're on the landing page or another page
    const isLandingPage = window.location.pathname === '/' || window.location.pathname === '/index.html';

    // Set toolbar height CSS variable (needed on all pages)
    updateToolbarHeight();
    window.addEventListener('resize', updateToolbarHeight);

    // Add live label to toolbar if live
    updateToolbarLiveLabel();

    if (isLandingPage) {
      // Landing page: show widget
      const widget = createWidget();
      mainWidget = widget; // Store reference to widget for expand functionality

      // Insert after toolbar
      const toolbar = document.querySelector('.toolbar');
      if (toolbar) {
        toolbar.insertAdjacentElement('afterend', widget);
      } else {
        document.body.insertBefore(widget, document.body.firstChild);
      }

      // Attach play button event listener
      const playBtn = document.getElementById('stream-play-btn');
      if (playBtn) {
        playBtn.addEventListener('click', togglePlay);
      }

      // Attach minimize button event listener
      const minimizeBtn = widget.querySelector('.stream-minimize-btn');
      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
          // Don't stop audio - keep it playing if it was playing
          // Hide widget with animation
          widget.style.opacity = '0';
          widget.style.transform = 'translateY(-20px)';
          setTimeout(() => {
            widget.style.display = 'none';
            // Show floating player after widget is minimized
            showFloatingPlayer();
          }, 300);
        });
      }
    } else {
      // Other pages (radio, about): just show floating player
      showFloatingPlayer();
    }

    // Restore audio state from previous page
    restoreAudioState();

    // Save state before page unload
    window.addEventListener('beforeunload', savePlayingState);

    // Function to update countdown and other elements
    function updateCountdownAndStatus() {
      const countdownEl = document.querySelector('.countdown');
      if (countdownEl) {
        const nextShow = getNextShowDate();
        countdownEl.textContent = `Next show in ${getTimeUntilShow(nextShow)}`;
      }

      // Update toolbar live label
      updateToolbarLiveLabel();

      // Check if we should switch to live mode
      if (isLiveNow() && !document.querySelector('.stream-live-indicator')) {
        const oldWidget = document.getElementById('stream-widget');
        if (oldWidget) {
          const newWidget = createWidget();
          oldWidget.replaceWith(newWidget);

          // Reattach play button listener
          const playBtn = document.getElementById('stream-play-btn');
          if (playBtn) {
            playBtn.addEventListener('click', togglePlay);
          }

          // Reattach minimize button listener
          const minimizeBtn = newWidget.querySelector('.stream-minimize-btn');
          if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
              // Don't stop audio - keep it playing if it was playing
              // Hide widget with animation
              newWidget.style.opacity = '0';
              newWidget.style.transform = 'translateY(-20px)';
              setTimeout(() => {
                newWidget.style.display = 'none';
                // Show floating player after widget is minimized
                showFloatingPlayer();
              }, 300);
            });
          }
        }
      }
    }

    // Determine update interval based on time until show
    function getUpdateInterval() {
      const nextShow = getNextShowDate();
      const now = new Date();
      const diff = nextShow - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      // Update every second if currently live OR less than 1 day until show
      // Otherwise, update every minute
      if (isLiveNow() || days === 0) {
        return 1000;
      }
      return 60000;
    }

    // Start with appropriate interval
    let updateIntervalId;
    let currentInterval = getUpdateInterval();

    function startUpdateInterval() {
      if (updateIntervalId) {
        clearInterval(updateIntervalId);
      }
      updateIntervalId = setInterval(() => {
        updateCountdownAndStatus();

        // Check if we need to change the update frequency
        const newInterval = getUpdateInterval();
        if (newInterval !== currentInterval) {
          currentInterval = newInterval;
          startUpdateInterval(); // Restart with new interval
        }
      }, currentInterval);
    }

    startUpdateInterval();
  }

  // Expose API for other scripts
  window.BogFactorLiveStream = {
    stopStream() {
      if (audioElement && isPlaying) {
        audioElement.pause();
        isPlaying = false;
        updatePlayButton();
        updateFloatingPlayer();
        savePlayingState();
      }
    },
    updateFloatingPlayer() {
      updateFloatingPlayer();
    },
    clearPlayingState() {
      clearPlayingState();
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
