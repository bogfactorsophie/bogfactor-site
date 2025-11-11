/**
 * Bog Factor Persistent Player
 * Enables continuous Mixcloud playback across page navigation
 */

(function() {
  'use strict';

  const PersistentPlayer = {
    player: null,
    widget: null,
    currentTrack: null,

    init() {
      this.createPlayerContainer();
      this.loadMixcloudWidgetAPI();
    },

    createPlayerContainer() {
      // Create persistent player container
      const playerContainer = document.createElement('div');
      playerContainer.id = 'persistent-player';
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

      this.currentTrack = { mixcloudPath, title };

      // Update player title
      document.getElementById('player-title').textContent = title;

      // Load and play the track
      this.widget.load(mixcloudPath, true); // true = autoplay
      this.showPlayer();
    },

    showPlayer() {
      const player = document.getElementById('persistent-player');
      player.classList.remove('player-hidden');
      player.classList.add('player-visible');

      // Add padding to body to prevent content from being hidden
      document.body.style.paddingBottom = '140px';
    },

    hidePlayer() {
      const player = document.getElementById('persistent-player');
      player.classList.remove('player-visible');
      player.classList.add('player-hidden');

      // Remove body padding
      document.body.style.paddingBottom = '0';
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PersistentPlayer.init());
  } else {
    PersistentPlayer.init();
  }

  // Expose to window for play buttons to use
  window.BogFactorPlayer = PersistentPlayer;

})();
