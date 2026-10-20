/* SG.ui.keyboard — the on-screen 27-key keyboard plus physical-key handling (design 03 §3.6.1, §5.1).
 *
 *   var kb = SG.ui.keyboard.create({
 *     onKey: function (symIndex, source) {},   // 0 = SPACE, 1..26 = A..Z; source = "tap" | "key"
 *     onInvalid: function () {},                // optional: a digit/punctuation key was pressed (throttled to once per 10 s)
 *     layout: "abc" | "qwerty",                 // default: the profile setting
 *     physical: true                            // false -> on-screen keys only (practice demos)
 *   });
 *   kb.el              the keyboard element to insert in the page
 *   kb.setUsed(set)    Set or array of symbol indexes already tried at this position (greyed + cross + aria-disabled)
 *   kb.markUsed(sym)   add one
 *   kb.reset()         clear all used marks (next position, GP-031)
 *   kb.enable(bool)    false -> every key press is ignored (pause, animations that must block, dialogs)
 *   kb.wobble(sym)     brief sideways shake of one key (normal motion only; calm = no animation)
 *   kb.focusKey(sym)   move focus to a key
 *   kb.setLayout(l)    switch ABC / QWERTY
 *   kb.destroy()       remove listeners and the element (also done automatically when the screen changes)
 *
 * Rules (GP-024..032, UX-004, UX-008, E5..E8, E14): the page-level keydown listener ignores auto-repeat,
 * modifier combos, IME composition, a held key until its keyup, keys typed into an input/textarea/select,
 * and anything while a dialog is open. Used keys stay focusable (aria-disabled, not disabled) and a press
 * on one does nothing. Space always means the SPACE symbol, never "click the focused button".
 * Taps use `click`, not pointerdown, so a scroll never registers a guess (GP-027).
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.keyboard = (function () {
  var QWERTY = "QWERTYUIOPASDFGHJKLZXCVBNM";
  var ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var INVALID_HINT_GAP_MS = 10000;

  function order(layout) { return (layout === "qwerty" ? QWERTY : ABC); }

  function keyLabel(sym, used) {
    if (sym === 0) return SG.ui.t(used ? "play.aria.spaceUsed" : "play.aria.spaceFree");
    return SG.ui.t(used ? "play.aria.keyUsed" : "play.aria.keyFree", { letter: SG.alphabet.char(sym) });
  }

  function create(o) {
    o = o || {};
    var onKey = o.onKey || function () {};
    var layout = o.layout || (SG.app && SG.app.profile && SG.app.profile.settings.layout) || "abc";
    var used = new Set();
    var enabled = true;
    var lastInvalid = -1e9;
    var held = new Set();
    var spaceHandled = false;
    var keys = {};          // sym -> button
    var list = [];          // buttons in DOM order

    var el = SG.ui.h("div", { "class": "sg-kb", role: "group", "aria-label": SG.ui.t("play.keyboardLabel"), "data-layout": layout });

    function buildKey(sym) {
      var isSpace = sym === 0;
      var cap = isSpace
        ? [SG.ui.h("span", { "class": "sg-key-glyph", "aria-hidden": "true" }, SG.alphabet.label(" ")),
           SG.ui.h("span", { "class": "sg-key-word", "aria-hidden": "true" }, SG.ui.t("play.spaceKey"))]
        : SG.ui.h("span", { "class": "sg-key-cap", "aria-hidden": "true" }, SG.alphabet.char(sym));
      var btn = SG.ui.h("button", {
        type: "button", "class": "sg-key" + (isSpace ? " sg-key--space" : ""),
        "data-sym": sym, "aria-label": keyLabel(sym, false), tabindex: "-1"
      }, cap, SG.ui.h("span", { "class": "sg-key-x", "aria-hidden": "true" }, SG.ui.icon("cross", { size: 12 })));
      btn.addEventListener("click", function () { press(sym, "tap"); });
      btn.addEventListener("keydown", onKeyNav);
      keys[sym] = btn;
      return btn;
    }

    function build() {
      SG.ui.clear(el);
      keys = {}; list = [];
      var letters = order(layout);
      for (var i = 0; i < letters.length; i++) list.push(buildKey(SG.alphabet.index(letters.charAt(i))));
      list.push(buildKey(0));
      list.forEach(function (b) { el.appendChild(b); });
      list[0].setAttribute("tabindex", "0");
      el.setAttribute("data-layout", layout);
      paintUsed();
    }

    function paintUsed() {
      Object.keys(keys).forEach(function (k) {
        var sym = Number(k), isUsed = used.has(sym), btn = keys[k];
        btn.classList.toggle("is-used", isUsed);
        if (isUsed) btn.setAttribute("aria-disabled", "true"); else btn.removeAttribute("aria-disabled");
        btn.setAttribute("aria-label", keyLabel(sym, isUsed));
      });
    }

    /** One path for taps and physical keys; the core game decides what the guess means. */
    function press(sym, source) {
      if (!enabled || used.has(sym)) return;
      onKey(sym, source);
    }

    /* ---- arrow-key navigation between keys (roving tabindex); never guesses ---- */
    function moveFocus(from, to) {
      if (!to) return;
      from.setAttribute("tabindex", "-1");
      to.setAttribute("tabindex", "0");
      to.focus();
    }
    function vertical(btn, dir) {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, best = null, bestDx = 1e9;
      list.forEach(function (b) {
        var q = b.getBoundingClientRect();
        var dy = (q.top + q.height / 2) - (r.top + r.height / 2);
        if (dir * dy < r.height / 2) return;          // not in a later/earlier row
        var rowDist = Math.abs(dy);
        var dx = Math.abs(q.left + q.width / 2 - cx) + rowDist * 4; // prefer the nearest row, then nearest column
        if (dx < bestDx) { bestDx = dx; best = b; }
      });
      return best;
    }
    function onKeyNav(e) {
      var btn = e.currentTarget, i = list.indexOf(btn), to = null;
      if (e.key === "ArrowRight") to = list[i + 1];
      else if (e.key === "ArrowLeft") to = list[i - 1];
      else if (e.key === "ArrowDown") to = vertical(btn, 1);
      else if (e.key === "ArrowUp") to = vertical(btn, -1);
      else return;
      e.preventDefault();
      e.stopPropagation();
      moveFocus(btn, to);
    }

    /* ---- physical keyboard ---- */
    function symFor(e) {
      var k = e.key;
      if (k === " ") return 0;
      if (k && k.length === 1 && /^[a-z]$/i.test(k)) return SG.alphabet.index(k.toUpperCase());
      return -1;
    }

    function shouldIgnore(e) {
      if (!enabled) return true;
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return true;
      if (SG.ui.a11y && SG.ui.a11y.isTypingTarget(document.activeElement)) return true;
      if (SG.ui.dialogs && SG.ui.dialogs.isOpen()) return true;
      return false;
    }

    function onDocKeyDown(e) {
      if (e.repeat) { if (symFor(e) === 0) e.preventDefault(); return; }   // auto-repeat never guesses (E6)
      if (shouldIgnore(e)) return;
      var sym = symFor(e);
      if (sym < 0) {
        // Printable but not a letter/space (digits, punctuation, other scripts): a soft hint, rarely (E14).
        if (e.key && e.key.length === 1 && o.onInvalid) {
          var now = Date.now();
          if (now - lastInvalid > INVALID_HINT_GAP_MS) { lastInvalid = now; o.onInvalid(); }
        }
        return;
      }
      if (sym === 0) { e.preventDefault(); spaceHandled = true; }
      if (held.has(e.code)) return;            // some browsers drop the repeat flag: also guard by key code
      held.add(e.code);
      press(sym, "key");
    }

    function onDocKeyUp(e) {
      held.delete(e.code);
      if (e.key === " " && spaceHandled) { e.preventDefault(); spaceHandled = false; } // no stray button click
    }

    function clearHeld() { held.clear(); }

    function onVisibility() { if (document.hidden) clearHeld(); }

    if (o.physical !== false) {
      document.addEventListener("keydown", onDocKeyDown);
      document.addEventListener("keyup", onDocKeyUp);
      window.addEventListener("blur", clearHeld);
      document.addEventListener("visibilitychange", onVisibility);
    }

    build();

    var api = {
      el: el,
      setUsed: function (set) {
        used = new Set(set ? Array.from(set) : []);
        paintUsed();
      },
      markUsed: function (sym) { used.add(sym); paintUsed(); },
      reset: function () { used = new Set(); paintUsed(); },
      enable: function (on) {
        enabled = !!on;
        el.classList.toggle("is-disabled", !enabled);
        el.setAttribute("aria-disabled", enabled ? "false" : "true");
      },
      wobble: function (sym) {
        var b = keys[sym];
        if (!b) return;
        b.classList.remove("is-wobble");
        void b.offsetWidth; // restart the CSS animation
        b.classList.add("is-wobble");
        setTimeout(function () { b.classList.remove("is-wobble"); }, 160);
      },
      focusKey: function (sym) {
        var b = keys[sym];
        if (b) { list.forEach(function (x) { x.setAttribute("tabindex", "-1"); }); b.setAttribute("tabindex", "0"); b.focus(); }
      },
      setLayout: function (l) { layout = l === "qwerty" ? "qwerty" : "abc"; build(); },
      destroy: function () {
        document.removeEventListener("keydown", onDocKeyDown);
        document.removeEventListener("keyup", onDocKeyUp);
        window.removeEventListener("blur", clearHeld);
        document.removeEventListener("visibilitychange", onVisibility);
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
    SG.ui.track(function () { api.destroy(); });   // a screen change always releases the page-level key listeners
    return api;
  }

  return { create: create };
})();
