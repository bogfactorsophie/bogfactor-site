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

  // The --z-drag / --z-base layers from styles.css, with fallbacks in case the
  // stylesheet has not applied yet.
  function layer(name, fallback) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }

  function dragLayer() {
    return layer('--z-drag', '50');
  }

  function restLayer() {
    return layer('--z-base', '1');
  }

  // Suns rest behind the page's material, so content passes over them on scroll.
  // Whichever ones are actually exposed stay draggable for free, because the
  // browser hit-tests to the topmost element under the pointer.
  //
  // Placement only needs to keep them off the furniture that is on screen when
  // the page opens: a sun that starts life hidden behind the hero copy is both
  // invisible and unpickable, which is a wasted sun. Dodging the lower sections
  // too would be pointless, since these are position: fixed and slide under
  // those sections as soon as you scroll.
  // .wordmark is in here because its letters are hollow outlines: a sun landing
  // inside a letter fills the counter and the word stops reading, even though
  // the type is correctly painted on top of it.
  // .hero-inner replaces the old .hero-plate: the hero copy sits straight on
  // the photograph now, with no plate behind it, so the column of type is the
  // thing to dodge.
  const CONTENT_SELECTOR =
    '.toolbar, .wordmark, .hero-inner, .hero-scroll, .footer, .ehfm-dock, ' +
    '.textbox, .page-masthead, .page-arc-svg';
  const PLACEMENT_ATTEMPTS = 30;
  const CLEARANCE = 8; // px of breathing room around content

  function occupiedRects() {
    return Array.prototype.map
      .call(document.querySelectorAll(CONTENT_SELECTOR), function (el) {
        return el.getBoundingClientRect();
      })
      .filter(function (r) {
        return r.width > 0 && r.height > 0;
      });
  }

  function overlaps(x, y, size, rects) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (
        x < r.right + CLEARANCE &&
        x + size > r.left - CLEARANCE &&
        y < r.bottom + CLEARANCE &&
        y + size > r.top - CLEARANCE
      ) {
        return true;
      }
    }
    return false;
  }

  // Returns {top, left} as percentages. Falls back to the last try rather than
  // looping forever on a page too full to fit another sun.
  function findSpot(size, rects) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let pick;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const topPct = Math.random() * 60 + 15; // 15% to 75%
      const leftPct = Math.random() * 80 + 10; // 10% to 90%
      pick = { top: topPct, left: leftPct };
      if (!overlaps((leftPct / 100) * w, (topPct / 100) * h, size, rects)) break;
    }
    return pick;
  }

  function makeDraggable(element) {
    element.style.cursor = 'grab';

    element.addEventListener('mousedown', startDrag);
    element.addEventListener('touchstart', startDrag, { passive: false });
  }

  function startDrag(e) {
    e.preventDefault();
    activeSun = e.currentTarget;
    activeSun.style.cursor = 'grabbing';
    // Lets the reduced-motion rules keep the sun spinning while it is held: that
    // motion is a response to the reader's own hand, not something happening at
    // them unbidden.
    activeSun.classList.add('sun-dragging');
    // Read the layer off --z-drag rather than hardcoding it, so the ladder in
    // styles.css stays the single source of truth. This used to be 1000, which
    // tied with the toolbar and let a dragged sun ride over the navigation.
    activeSun.style.zIndex = dragLayer();

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
      activeSun.style.zIndex = restLayer();
      activeSun.classList.remove('sun-dragging');
      activeSun = null;
    }

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
  }

  function init() {
    const rects = occupiedRects();

    // Create suns
    for (let i = 0; i < numSuns; i++) {
      const sunContainer = document.createElement('div');
      sunContainer.className = 'sun-container';

      // Random size between 30px and 100px
      const size = Math.random() * 70 + 30;

      // A starting spot that clears the toolbar, the plates and the footer
      const spot = findSpot(size, rects);
      sunContainer.style.top = `${spot.top}%`;
      sunContainer.style.left = `${spot.left}%`;

      const img = document.createElement('img');
      img.src = '/assets/sun_image.png';
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
