/* SG.ui.a11y — screen-reader announcements and focus helpers (design 03 §5.4, §5.5; UX-054..056).
 *
 *   announce(text)            polite live announcement; bursts coalesce, the latest message wins (250 ms)
 *   focus(el, opts)           focus without scrolling the page away; makes non-focusables focusable
 *   focusHeading(root)        focus the screen's <h1> (or [data-sg-focus]) after a route change
 *   isTypingTarget(el)        true for input / textarea / select / contenteditable
 *   remember() / restore()    remember the focused element, put focus back later (dialogs, sub-screens)
 *   trap(container)           keep Tab inside `container`; returns a release function
 *   setTitle(text)            document.title
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.a11y = (function () {
  var pending = null, timer = null;
  var remembered = [];

  function liveRegion() { return document.getElementById("sg-live"); }

  /**
   * Announce text politely. The region is cleared first so the same sentence twice in a row (for
   * example two wrong guesses) is still read out again by screen readers.
   */
  function announce(text) {
    if (!text) return;
    pending = String(text);
    if (timer) return; // a flush is already scheduled: just replace the pending message
    timer = setTimeout(function () {
      timer = null;
      var el = liveRegion();
      if (!el) return;
      el.textContent = "";
      var msg = pending;
      // Re-insert on the next tick; some readers ignore a change made in the same task as the clear.
      setTimeout(function () { el.textContent = msg; }, 20);
    }, 250);
  }

  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
  }

  function focus(el, opts) {
    if (!el) return;
    if (!el.hasAttribute("tabindex") && !/^(a|button|input|select|textarea)$/i.test(el.tagName)) {
      el.setAttribute("tabindex", "-1");
    }
    try { el.focus({ preventScroll: !!(opts && opts.preventScroll) }); } catch (e) { el.focus(); }
  }

  function focusHeading(root) {
    var target = (root || document).querySelector("[data-sg-focus]") || (root || document).querySelector("h1");
    if (target) focus(target, { preventScroll: true });
  }

  function remember() { remembered.push(document.activeElement); }

  function restore() {
    var el = remembered.pop();
    if (el && el.focus && document.body.contains(el)) focus(el);
  }

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
    'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /** Tab / Shift+Tab wrap inside the container. */
  function trap(container) {
    function onKey(e) {
      if (e.key !== "Tab") return;
      var nodes = Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE))
        .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
      if (!nodes.length) { e.preventDefault(); return; }
      var first = nodes[0], last = nodes[nodes.length - 1];
      var active = document.activeElement;
      if (!container.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return function release() { document.removeEventListener("keydown", onKey, true); };
  }

  function setTitle(text) { document.title = text; }

  return {
    announce: announce, focus: focus, focusHeading: focusHeading, isTypingTarget: isTypingTarget,
    remember: remember, restore: restore, trap: trap, setTitle: setTitle
  };
})();
