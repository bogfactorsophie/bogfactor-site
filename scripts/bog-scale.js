/**
 * Bog Scale Interactive Hover Effect
 * Reveals the sacred bog factor scale on hover
 */

(function() {
  'use strict';

  function init() {
    const bogImg = document.querySelector('.bog-factor-scale');

    if (!bogImg) return;

    bogImg.addEventListener('mouseenter', () => {
      bogImg.style.width = '800px';
      bogImg.style.maxWidth = '90vw';
    });

    bogImg.addEventListener('mouseleave', () => {
      bogImg.style.width = '120px';
      bogImg.style.maxWidth = '120px';
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
