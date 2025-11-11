/**
 * Shared Audio Manager
 * Single audio stream shared between landing page player and toolbar widget
 */

(function() {
  'use strict';

  const STREAM_URL = 'https://ehfm.out.airtime.pro/ehfm_a';

  // Shared state
  const SharedAudio = {
    audio: null,
    isPlaying: false,
    listeners: [],

    init() {
      this.audio = new Audio(STREAM_URL);

      // Listen to audio events
      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this.notifyListeners();
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.notifyListeners();
      });
    },

    play() {
      if (!this.audio) this.init();
      this.audio.play();
    },

    pause() {
      if (!this.audio) return;
      this.audio.pause();
    },

    toggle() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },

    // Register a callback to be notified when play state changes
    addListener(callback) {
      this.listeners.push(callback);
    },

    notifyListeners() {
      this.listeners.forEach(callback => callback(this.isPlaying));
    }
  };

  // Expose globally
  window.BogFactorAudio = SharedAudio;

})();
