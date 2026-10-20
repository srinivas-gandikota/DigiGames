/* SG.ui.theme — turns Settings into attributes/classes on <html> so CSS does all the styling (design 03 §1.1).
 *
 *   SG.ui.theme.apply(settings)   set data-theme / data-calm / data-bigkeys / data-layout / data-size
 *   SG.ui.theme.isCalm()          current calm-motion state (setting, or the OS preference when null)
 *   SG.ui.theme.onChange(fn)      fn() when calm motion or the size class changes (e.g. OS preference flips)
 *
 * Both data-* attributes (the design contract) and sg-* classes are set so stylesheets can use either.
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.theme = (function () {
  var root = document.documentElement;
  var settings = {};
  var listeners = [];
  var calmQuery = null;
  var calm = false;

  function mq(q) {
    try { return window.matchMedia ? window.matchMedia(q) : null; } catch (e) { return null; }
  }

  /** Calm if the child said so; if they said nothing (null) follow the operating system (UX-059). */
  function computeCalm() {
    if (settings.calmMotion === true) return true;
    if (settings.calmMotion === false) return false;
    return !!(calmQuery && calmQuery.matches);
  }

  function setFlag(name, cls, on) {
    root.setAttribute("data-" + name, on ? "1" : "0");
    root.classList.toggle(cls, !!on);
  }

  function sizeClass() {
    var w = window.innerWidth || 360;
    return w < 600 ? "phone" : w < 1024 ? "tablet" : "desktop";
  }

  function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  function refresh() {
    var wasCalm = calm;
    calm = computeCalm();
    setFlag("calm", "sg-calm", calm);
    setFlag("bigkeys", "sg-bigkeys", !!settings.bigKeys);
    var hc = !!settings.highContrast;
    root.setAttribute("data-theme", hc ? "hc" : "light");
    root.classList.toggle("sg-hc", hc);
    root.setAttribute("data-layout", settings.layout === "qwerty" ? "qwerty" : "abc");
    var size = sizeClass();
    var sizeChanged = root.getAttribute("data-size") !== size;
    root.setAttribute("data-size", size);
    if (wasCalm !== calm || sizeChanged) notify();
  }

  function init() {
    calmQuery = mq("(prefers-reduced-motion: reduce)");
    if (calmQuery) {
      var onCalm = function () { if (settings.calmMotion == null) refresh(); };
      if (calmQuery.addEventListener) calmQuery.addEventListener("change", onCalm);
      else if (calmQuery.addListener) calmQuery.addListener(onCalm);
    }
    window.addEventListener("resize", refresh);
  }
  init();

  return {
    /** Apply a Profile.settings object (missing fields mean "default"). */
    apply: function (s) { settings = s || {}; refresh(); },
    isCalm: function () { return calm; },
    /** Subscribe to calm-motion / size-class changes. Returns an unsubscribe function — screens
     *  should pass it to SG.ui.track() so it is removed when the screen is left. */
    onChange: function (fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
    },
    sizeClass: sizeClass
  };
})();
