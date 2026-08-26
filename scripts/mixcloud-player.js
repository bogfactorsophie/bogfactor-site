/**
 * Bog Factor Mixcloud Player
 * Fixed player at bottom of page for Mixcloud show playback
 */

(function() {
  'use strict';

  const MixcloudPlayer = {
    widget: null,
    currentTrack: null,

    init() {
      this.createPlayerContainer();
      this.loadMixcloudWidgetAPI();
    },

    createPlayerContainer() {
      // Create player container
      const playerContainer = document.createElement('div');
      playerContainer.id = 'mixcloud-player';
      playerContainer.className = 'player-hidden';
      playerContainer.innerHTML = `
        <div class="player-controls">
          <button id="player-close" class="player-btn" title="Close player">&times;</button>
          <div class="player-info">
            <span id="player-title">No track loaded</span>
          </div>
        </div>
        <div class="player-iframe-container">
          <iframe
            id="mixcloud-widget"
            src="https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&feed=%2Fehfm%2F"
            width="100%"
            height="120"
            frameborder="0"
            allow="autoplay">
          </iframe>
        </div>
      `;

      document.body.appendChild(playerContainer);

      // Setup close button
      document.getElementById('player-close').addEventListener('click', () => {
        this.hidePlayer();
        if (this.widget) {
          this.widget.pause();
        }
      });
    },

    loadMixcloudWidgetAPI() {
      // Load Mixcloud Widget API
      const script = document.createElement('script');
      script.src = 'https://widget.mixcloud.com/media/js/widgetApi.js';
      script.onload = () => {
        const iframe = document.getElementById('mixcloud-widget');
        this.widget = Mixcloud.PlayerWidget(iframe);

        // Listen to ready event
        this.widget.ready.then(() => {
          console.log('Mixcloud widget ready');

          // Listen to play events to update UI
          this.widget.events.play.on(() => {
            this.showPlayer();
          });
        });
      };
      document.head.appendChild(script);
    },

    playTrack(mixcloudPath, title) {
      if (!this.widget) {
        console.error('Mixcloud widget not ready');
        return;
      }

      // Stop live stream if it's playing and clear its state
      if (window.BogFactorLiveStream) {
        if (window.BogFactorLiveStream.stopStream) {
          window.BogFactorLiveStream.stopStream();
        }
        // Clear the playing state so it doesn't auto-resume on next page
        if (window.BogFactorLiveStream.clearPlayingState) {
          window.BogFactorLiveStream.clearPlayingState();
        }
      }

      this.currentTrack = { mixcloudPath, title };

      // Update player title
      document.getElementById('player-title').textContent = title;

      // Load and play the track
      this.widget.load(mixcloudPath, true); // true = autoplay
      this.showPlayer();
    },

    showPlayer() {
      const player = document.getElementById('mixcloud-player');

      // Force a reflow to ensure the hidden state is rendered before animating
      player.offsetHeight;

      // Use requestAnimationFrame to ensure animation triggers
      requestAnimationFrame(() => {
        player.classList.remove('player-hidden');
        player.classList.add('player-visible');
      });

      // Add class to body so other elements can respond
      document.body.classList.add('mixcloud-player-active');

      // Update floating player to show mute icon
      if (window.BogFactorLiveStream && window.BogFactorLiveStream.updateFloatingPlayer) {
        window.BogFactorLiveStream.updateFloatingPlayer();
      }

      // Publish the player's real height. Modals cap themselves against it, and
      // the EHFM dock rides above it, so both follow the player rather than
      // guessing at it. Also drives the body padding below, which used to be a
      // hardcoded 140px that did not match the player at every breakpoint.
      const height = player.offsetHeight;
      document.documentElement.style.setProperty('--player-height', height + 'px');

      // Add padding to body to prevent content from being hidden
      document.body.style.paddingBottom = height + 'px';
    },

    hidePlayer() {
      const player = document.getElementById('mixcloud-player');
      player.classList.remove('player-visible');
      player.classList.add('player-hidden');

      // Remove class from body
      document.body.classList.remove('mixcloud-player-active');

      // Update floating player to restore normal state
      if (window.BogFactorLiveStream && window.BogFactorLiveStream.updateFloatingPlayer) {
        window.BogFactorLiveStream.updateFloatingPlayer();
      }

      // Remove body padding
      document.body.style.paddingBottom = '0';
      document.documentElement.style.setProperty('--player-height', '0px');
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MixcloudPlayer.init());
  } else {
    MixcloudPlayer.init();
  }

  // Expose to window for play buttons to use
  window.BogFactorPlayer = MixcloudPlayer;

})();
