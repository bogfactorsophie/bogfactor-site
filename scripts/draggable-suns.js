/**
 * Draggable Suns for Bog Factor Home Page
 * Generates random rotating suns that can be repositioned by dragging
 */

(function() {
  'use strict';

  // Generate multiple random suns
  const numSuns = 10;

  // Drag state
  let activeSun = null;
  let offsetX = 0;
  let offsetY = 0;

  function makeDraggable(element) {
    element.style.cursor = 'grab';

    element.addEventListener('mousedown', startDrag);
    element.addEventListener('touchstart', startDrag, { passive: false });
  }

  function startDrag(e) {
    e.preventDefault();
    activeSun = e.currentTarget;
    activeSun.style.cursor = 'grabbing';
    activeSun.style.zIndex = '1000';

    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    const rect = activeSun.getBoundingClientRect();
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }

  function drag(e) {
    if (!activeSun) return;
    e.preventDefault();

    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    const newLeft = clientX - offsetX;
    const newTop = clientY - offsetY;

    activeSun.style.left = `${newLeft}px`;
    activeSun.style.top = `${newTop}px`;
  }

  function stopDrag() {
    if (activeSun) {
      activeSun.style.cursor = 'grab';
      activeSun.style.zIndex = '1';
      activeSun = null;
    }

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
  }

  function init() {
    // Create suns
    for (let i = 0; i < numSuns; i++) {
      const sunContainer = document.createElement('div');
      sunContainer.className = 'sun-container';

      // Random position (avoid top 80px for toolbar and bottom 100px for footer)
      const top = Math.random() * 60 + 15; // 15% to 75%
      const left = Math.random() * 80 + 10; // 10% to 90%

      // Random size between 30px and 100px
      const size = Math.random() * 70 + 30;

      sunContainer.style.top = `${top}%`;
      sunContainer.style.left = `${left}%`;

      const img = document.createElement('img');
      // Detect if we're in a subfolder by checking if path contains /radio/, /about/, or /blog/
      const pathname = window.location.pathname;
      const isSubfolder = pathname.includes('/radio/') || pathname.includes('/about/') || pathname.includes('/blog/');
      img.src = isSubfolder ? '../assets/sun_image.png' : 'assets/sun_image.png';
      img.className = 'rotating-image';
      img.alt = 'Rotating Sun';
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;

      sunContainer.appendChild(img);
      document.body.appendChild(sunContainer);

      // Make draggable
      makeDraggable(sunContainer);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
