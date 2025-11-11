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

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
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
    } else {
      audioElement.play();
      isPlaying = true;
      updatePlayButton();
    }
  }

  function updatePlayButton() {
    const playBtn = document.getElementById('stream-play-btn');
    if (playBtn) {
      playBtn.innerHTML = isPlaying ? '&#9208;&#xFE0E;' : '&#9654;&#xFE0E;';
      playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
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

  function init() {
    const widget = createWidget();

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

    // Update countdown every minute
    setInterval(() => {
      const countdownEl = document.querySelector('.countdown');
      if (countdownEl) {
        const nextShow = getNextShowDate();
        countdownEl.textContent = `In ${getTimeUntilShow(nextShow)}`;
      }

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
        }
      }
    }, 60000); // Every minute
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
