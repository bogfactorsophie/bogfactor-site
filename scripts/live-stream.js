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

  // Drag state for widget
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Physics for throwing
  let velocityX = 0;
  let velocityY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let animationFrameId = null;
  const FRICTION = 0.99; // Deceleration factor (0.95 = loses 5% per frame)
  const BOUNCE_DAMPING = 0.1; // Energy retained on bounce (0.6 = loses 40%)
  const MIN_VELOCITY = 0.5; // Stop animating below this velocity
  const MAX_VELOCITY = 20; // Maximum velocity in pixels per frame

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

  // Get current time components in UK timezone
  function getUKTimeComponents(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find(p => p.type === type).value;

    return {
      year: parseInt(get('year')),
      month: parseInt(get('month')) - 1, // 0-indexed for JavaScript Date
      day: parseInt(get('day')),
      hour: parseInt(get('hour')),
      minute: parseInt(get('minute')),
      second: parseInt(get('second'))
    };
  }

  // Create a Date object representing a specific time in UK timezone
  function createDateInUKTimezone(year, month, day, hour, minute = 0) {
    // Create a test date at noon UTC on the target day
    const testDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

    // Get what hour that appears as in UK timezone
    const ukHourAtNoonUTC = parseInt(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      hour12: false
    }).format(testDate));

    // Calculate UK offset: if noon UTC shows as 13:00 UK, offset is +1 (BST)
    // if noon UTC shows as 12:00 UK, offset is 0 (GMT)
    const ukOffsetHours = ukHourAtNoonUTC - 12;

    // To create a date at "hour:minute" UK time, we need UTC time to be (hour - offset)
    const utcHour = hour - ukOffsetHours;

    return new Date(Date.UTC(year, month, day, utcHour, minute, 0));
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
    const ukNow = getUKTimeComponents(now);

    let year = ukNow.year;
    let month = ukNow.month;

    // Get first Friday of current month
    const firstFriday = getFirstFridayOfMonth(year, month);
    const firstFridayDay = firstFriday.getDate();

    // Create show date at 1pm UK time on first Friday
    let nextShow = createDateInUKTimezone(year, month, firstFridayDay, SHOW_START_HOUR, 0);

    // If we've passed this month's show (after 2pm UK time), get next month's show
    const showEndTime = createDateInUKTimezone(year, month, firstFridayDay, SHOW_END_HOUR, 0);

    if (now > showEndTime) {
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
      const nextFirstFriday = getFirstFridayOfMonth(year, month);
      nextShow = createDateInUKTimezone(year, month, nextFirstFriday.getDate(), SHOW_START_HOUR, 0);
    }

    return nextShow;
  }

  function isLiveNow() {
    const now = new Date();
    const ukNow = getUKTimeComponents(now);

    const year = ukNow.year;
    const month = ukNow.month;
    const firstFriday = getFirstFridayOfMonth(year, month);

    // Check if today is first Friday in UK timezone
    const isFirstFriday = ukNow.day === firstFriday.getDate() &&
                          ukNow.month === firstFriday.getMonth();

    // Check if time is between 1pm-2pm UK
    const isShowTime = ukNow.hour >= SHOW_START_HOUR && ukNow.hour < SHOW_END_HOUR;

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

    // Notify toolbar widget to update its UI
    if (window.BogFactorToolbarWidget) {
      window.BogFactorToolbarWidget.updateUI(isPlaying);
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
            // Set initial hidden state
            mainWidget.style.display = 'block';
            mainWidget.style.opacity = '0';
            mainWidget.style.transform = 'translateY(-20px)';

            // Force reflow to ensure initial state is rendered
            mainWidget.offsetHeight;

            // Animate to visible state
            requestAnimationFrame(() => {
              mainWidget.style.opacity = '1';
              mainWidget.style.transform = 'translateY(0)';
            });

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

  function clampVelocity() {
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed > MAX_VELOCITY) {
      const scale = MAX_VELOCITY / speed;
      velocityX *= scale;
      velocityY *= scale;
    }
  }

  function makeDraggable(element) {
    element.style.cursor = 'grab';

    element.addEventListener('mousedown', startDrag);
    element.addEventListener('touchstart', startDrag, { passive: false });
  }

  function startDrag(e) {
    // Don't start drag if clicking on interactive elements
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) {
      return;
    }

    e.preventDefault();

    // Cancel any ongoing animation
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    isDragging = true;
    mainWidget.style.cursor = 'grabbing';

    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    const rect = mainWidget.getBoundingClientRect();
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    // Initialize velocity tracking
    lastX = clientX;
    lastY = clientY;
    lastTime = Date.now();
    velocityX = 0;
    velocityY = 0;

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }

  function drag(e) {
    if (!isDragging || !mainWidget) return;
    e.preventDefault();

    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const currentTime = Date.now();

    // Calculate velocity
    const deltaTime = currentTime - lastTime;
    if (deltaTime > 0) {
      velocityX = (clientX - lastX) / deltaTime * 16; // Normalize to ~60fps
      velocityY = (clientY - lastY) / deltaTime * 16;
    }

    // Clamp velocity to maximum speed
    clampVelocity();

    lastX = clientX;
    lastY = clientY;
    lastTime = currentTime;

    // Calculate new position
    let newLeft = clientX - dragOffsetX;
    let newTop = clientY - dragOffsetY;

    // Get viewport and widget dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const widgetRect = mainWidget.getBoundingClientRect();
    const widgetWidth = widgetRect.width;
    const widgetHeight = widgetRect.height;

    // Get toolbar height to constrain top edge
    const toolbar = document.querySelector('.toolbar');
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

    // Constrain to viewport boundaries
    newLeft = Math.max(0, Math.min(newLeft, viewportWidth - widgetWidth));
    newTop = Math.max(toolbarHeight, Math.min(newTop, viewportHeight - widgetHeight));

    mainWidget.style.left = `${newLeft}px`;
    mainWidget.style.top = `${newTop}px`;
  }

  function stopDrag() {
    if (isDragging && mainWidget) {
      isDragging = false;
      mainWidget.style.cursor = 'grab';

      // Start physics animation if there's significant velocity
      const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      if (speed > MIN_VELOCITY) {
        animate();
      }
    }

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
  }

  function animate() {
    if (!mainWidget) return;

    // Get current position
    const rect = mainWidget.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;

    // Apply velocity
    left += velocityX;
    top += velocityY;

    // Get viewport and widget dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const widgetWidth = rect.width;
    const widgetHeight = rect.height;

    // Get toolbar height
    const toolbar = document.querySelector('.toolbar');
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

    // Check for collisions and bounce
    let bounced = false;

    // Left edge
    if (left < 0) {
      left = 0;
      velocityX = Math.abs(velocityX) * BOUNCE_DAMPING;
      bounced = true;
    }

    // Right edge
    if (left + widgetWidth > viewportWidth) {
      left = viewportWidth - widgetWidth;
      velocityX = -Math.abs(velocityX) * BOUNCE_DAMPING;
      bounced = true;
    }

    // Top edge (toolbar)
    if (top < toolbarHeight) {
      top = toolbarHeight;
      velocityY = Math.abs(velocityY) * BOUNCE_DAMPING;
      bounced = true;
    }

    // Bottom edge
    if (top + widgetHeight > viewportHeight) {
      top = viewportHeight - widgetHeight;
      velocityY = -Math.abs(velocityY) * BOUNCE_DAMPING;
      bounced = true;
    }

    // Apply position
    mainWidget.style.left = `${left}px`;
    mainWidget.style.top = `${top}px`;

    // Apply friction (deceleration)
    if (!bounced) {
      velocityX *= FRICTION;
      velocityY *= FRICTION;
    }

    // Check if we should continue animating
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed > MIN_VELOCITY) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      animationFrameId = null;
      velocityX = 0;
      velocityY = 0;
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

      // Make widget draggable
      makeDraggable(widget);

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

      // Check if we should switch to live mode
      if (isLiveNow() && !document.querySelector('.stream-live-indicator')) {
        const oldWidget = document.getElementById('stream-widget');
        if (oldWidget) {
          // Check if widget was minimized
          const wasMinimized = oldWidget.style.display === 'none';

          const newWidget = createWidget();
          oldWidget.replaceWith(newWidget);
          mainWidget = newWidget; // Update reference

          // If it was minimized, keep the new widget minimized
          if (wasMinimized) {
            newWidget.style.display = 'none';
            newWidget.style.opacity = '0';
            newWidget.style.transform = 'translateY(-20px)';
            // Floating player should remain visible
          }

          // Make new widget draggable
          makeDraggable(newWidget);

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
    toggleStream() {
      if (!audioElement) {
        audioElement = new Audio(STREAM_URL);
      }

      if (isPlaying) {
        audioElement.pause();
        isPlaying = false;
      } else {
        audioElement.play();
        isPlaying = true;
      }

      updatePlayButton();
      updateFloatingPlayer();
      savePlayingState();

      // Notify toolbar widget to update its UI
      if (window.BogFactorToolbarWidget) {
        window.BogFactorToolbarWidget.updateUI(isPlaying);
      }
    },
    stopStream() {
      if (audioElement && isPlaying) {
        audioElement.pause();
        isPlaying = false;
        updatePlayButton();
        updateFloatingPlayer();
        savePlayingState();

        // Notify toolbar widget to update its UI
        if (window.BogFactorToolbarWidget) {
          window.BogFactorToolbarWidget.updateUI(false);
        }
      }
    },
    getPlayingState() {
      return isPlaying;
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
