/**
 * Toolbar dropdown menu
 *
 * Collapses the always-visible toolbar links behind a single "Menu" trigger.
 *
 * This enhances the existing `<nav class="toolbar-nav">` in place rather than
 * asking every page to carry the trigger markup: the nav is duplicated across
 * seven files, and a button pasted into each one would drift. It also means the
 * links stay visible and usable when this script does not run, so the nav never
 * depends on JavaScript to be reachable.
 *
 * The LIVE NOW controls are deliberately left alone. They are appended to the
 * toolbar by toolbar-live-widget.js as a sibling of the nav, and burying the
 * on-air prompt inside a closed menu would work against the whole point of it.
 */
(function () {
  'use strict';

  function init() {
    var nav = document.querySelector('.toolbar-nav');
    if (!nav) return;

    var toolbar = nav.parentNode;

    // ---- build the trigger + wrapper ----------------------------------
    var wrap = document.createElement('div');
    wrap.className = 'toolbar-menu';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'toolbar-menu-trigger';
    trigger.id = 'toolbar-menu-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'true');
    // The bars are decoration, so the button needs a name of its own: with no
    // text content left there is nothing for a screen reader to announce.
    trigger.setAttribute('aria-label', 'Menu');
    trigger.innerHTML =
      '<span class="toolbar-menu-icon" aria-hidden="true">' +
      '<span></span><span></span><span></span>' +
      '</span>';

    // The panel is the original nav, restyled. Same links, same aria-current,
    // so the "you are here" marker and every existing link rule carry over.
    nav.classList.add('toolbar-menu-panel');
    nav.id = 'toolbar-menu-panel';
    trigger.setAttribute('aria-controls', 'toolbar-menu-panel');

    toolbar.insertBefore(wrap, nav);
    wrap.appendChild(trigger);
    wrap.appendChild(nav);

    // ---- open / close --------------------------------------------------
    var open = false;

    function setOpen(next) {
      open = next;
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function close(refocus) {
      if (!open) return;
      setOpen(false);
      if (refocus) trigger.focus();
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!open);
    });

    // Escape closes and hands focus back, so keyboard users are not stranded
    // inside a panel they just dismissed.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close(true);
    });

    // A click anywhere else dismisses. Listening on the document rather than
    // on a backdrop element keeps the toolbar free of an overlay that would
    // sit over the draggable suns.
    document.addEventListener('click', function (e) {
      if (open && !wrap.contains(e.target)) close(false);
    });

    // Tabbing out of the panel closes it too, otherwise the menu is left
    // hanging open behind whatever the user moved on to.
    wrap.addEventListener('focusout', function (e) {
      if (open && !wrap.contains(e.relatedTarget)) close(false);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
