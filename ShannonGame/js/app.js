/* SG.app — boot, router, profile and the last-resort error handler.
 *
 * ---------------------------------------------------------------------------------------------------
 * SCREEN CONTRACT
 *   Every screen file registers itself:   SG.screens.<name> = { titleKey?, render(root, params), onBack? }
 *     render(root, params)  draws into `root` (the <main> element) and may return a cleanup function.
 *                           Cleanup runs when the screen is left. Anything added with SG.ui.on / later /
 *                           every / track is cleaned automatically, so a cleanup function is only needed
 *                           for things the registry does not know about (e.g. a keyboard.destroy()).
 *     titleKey              optional copy key for the page title ("settings.title")
 *     onBack()              optional; called on the browser Back button, only while this screen is the one showing
 *                           (see BROWSER BACK below). Play asks "Leave this round?" (or goes on to Roboplays once
 *                           the round is finished); Detective runs its leave check, else goes Home.
 *   Navigate with SG.app.go(name, params). Only one screen is alive at a time.
 *
 * SCREENS AND THEIR PARAMS
 *   home {}  onboarding {practice?, then?}  help {section?: "how"|"about"|"teachers"}  settings {}
 *   setup {mode: "classic"|"peephole", tier?}  twoplayer {}  history {}  journey {}  detective {}
 *   play {mode, tier, peek, sentence?, puzzleId?, seed?, replay?, resume?}
 *   roboplays {record}      board {record} | {recordId}
 *
 * NAVIGATION CONTRACT (play -> roboplays -> board)
 *   Play, when the round finishes (or the child stops with >= MIN_PARTIAL letters), builds the
 *   RoundRecord (SG.game.toRecord + SG.info.summaryStats), SAVES it into profile.rounds with
 *   SG.storage.addRound(profile, record) + SG.app.save(), evaluates badges (SG.badges.evaluate +
 *   SG.storage.award), then calls SG.app.go("roboplays", {record, newBadges}).
 *   Roboplays -> SG.app.go("board", {record, newBadges}). Only `record` matters to the Board (it also accepts
 *   {recordId}); the Board ignores newBadges and saves nothing: the record is already stored.
 *   History opens a stored round with go("board", {recordId}).
 *
 * BROWSER BACK
 *   go() pushes a history entry only for "play" (pushHistory), so Play is the one screen that adds an entry.
 *   On popstate the router looks at the screen that is showing: if it has onBack, the router first pushes a
 *   fresh entry (same URL, so the page stays put) and then calls onBack(). A screen without onBack gets nothing:
 *   the browser moves back, the app does not route, and the screen stays. Detective has onBack but pushes no
 *   entry of its own, so Back there also reaches its handler.
 *
 * OTHER PUBLIC API
 *   SG.app.profile                 the live Profile (persisted by SG.app.save())
 *   SG.app.save()                  persist; returns true if it reached localStorage
 *   SG.app.go(name, params)        route
 *   SG.app.current()               {name, params}
 *   SG.app.shell.configure({title, home, sound, settings, hidden, onHome, extra})
 *                                  per-screen header. Every go() resets it to the defaults, then sets the title,
 *                                  home and settings buttons. `onHome` replaces the Home button action (quit rules);
 *                                  `extra` is a node placed before the sound and settings buttons; `hidden` removes
 *                                  the bar (no screen passes it today). Play keeps the bar and changes title,
 *                                  onHome and extra (its pause button) during a round.
 *   SG.app.corpusCurve()           Robo's look-back curve over the Medium + Hard puzzles, computed once
 *   SG.app.applySettings()         re-apply profile.settings (theme, sound) after a change
 *   SG.app.hasResume() / resume() / discardResume()   the saved in-progress round
 *   SG.app.resetProgress()         erase everything (the two-step dialog lives in the Settings screen)
 *   SG.app.storageNote()           the one-time "can't remember" text (or null)
 *   SG.app.now() / newSeed()       the clock and a fresh PRNG seed (the core never reads either)
 *   SG.app.setTitle(text)          document title
 *   SG.app.showError(err)          the friendly "Oops" dialog; while one is open no second dialog stacks. The window
 *                                  error and unhandledrejection handlers and a render() that throws all use it
 *   SG.app.boot()                  runs itself once the document is ready (an unsupported browser gets a plain
 *                                  message instead): builds the shell, trains Robo, then goes to onboarding on a
 *                                  first visit or home otherwise. Screens never call it.
 * ---------------------------------------------------------------------------------------------------
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.app = (function () {
  var profile = null;
  var root = null;                 // <main id="sg-screen">
  var cur = { name: null, params: {}, cleanup: null };
  var session = { storageNoteShown: false, errorAt: 0, errorOpen: false };
  var corpusCache = null;
  var shellParts = {};
  var shellCfg = null;

  function t(key, vars) { return SG.ui.t(key, vars); }

  /* ================================================================ profile */

  /** Fill in the fields the design added after storage.js defined its defaults (quietRobo etc.). */
  function normalize(p) {
    var st = p.settings || (p.settings = {});
    if (typeof st.quietRobo !== "boolean") st.quietRobo = false;
    if (typeof st.tallyCollapsed !== "boolean") st.tallyCollapsed = false;
    if (typeof st.sound !== "boolean") st.sound = false;
    if (st.layout !== "qwerty") st.layout = "abc";
    if (!p.notices || typeof p.notices !== "object") p.notices = {};
    if (typeof p.notices.trimmed !== "boolean") p.notices.trimmed = false;
    if (typeof p.notices.storage !== "boolean") p.notices.storage = false;
    if (typeof p.notices.privacySeen !== "boolean") p.notices.privacySeen = false;
    if (typeof p.practiced !== "boolean") p.practiced = false;
    return p;
  }

  function save() {
    var ok = SG.storage.save(profile);
    return ok;
  }

  function applySettings() {
    SG.ui.theme.apply(profile.settings);
    SG.sound.setEnabled(profile.settings.sound);
    updateSoundButton();
  }

  /* ================================================================ shell (header + main) */

  var DEFAULT_CFG = { title: null, home: true, sound: true, settings: false, hidden: false, onHome: null, extra: null };

  function goHome() { go("home"); }

  function updateSoundButton() {
    var b = shellParts.sound;
    if (!b) return;
    var on = !!profile.settings.sound;
    b.setAttribute("aria-pressed", on ? "true" : "false");
    SG.ui.clear(b);
    b.appendChild(SG.ui.icon(on ? "speakerOn" : "speakerOff", { size: 24 }));
  }

  function toggleSound() {
    profile.settings.sound = !profile.settings.sound;
    SG.sound.setEnabled(profile.settings.sound);   // a click is a user gesture, so the audio context may start
    if (profile.settings.sound) SG.sound.play("tap");
    save();
    updateSoundButton();
  }

  function buildShell() {
    var app = document.getElementById("app");
    SG.ui.clear(app);
    app.className = "sg-app";
    var h = SG.ui.h;
    shellParts.home = h("button", { type: "button", "class": "sg-iconbtn", "aria-label": t("ui.home") }, SG.ui.icon("home", { size: 24 }));
    shellParts.home.addEventListener("click", function () {
      if (shellCfg && shellCfg.onHome) shellCfg.onHome(); else goHome();
    });
    shellParts.robo = SG.ui.robo.create("neutral", 30, { bubble: false });
    shellParts.robo.classList.add("sg-robo-mini");
    shellParts.robo.setAttribute("aria-hidden", "true");
    shellParts.title = h("span", { "class": "sg-title-text" });
    shellParts.extra = h("span", { "class": "sg-topbar-extra" });
    shellParts.sound = h("button", { type: "button", "class": "sg-iconbtn", "aria-label": t("settings.sound"), "aria-pressed": "false" });
    shellParts.sound.addEventListener("click", toggleSound);
    shellParts.gear = h("button", { type: "button", "class": "sg-iconbtn", "aria-label": t("home.tiles.settings.name") }, SG.ui.icon("gear", { size: 24 }));
    shellParts.gear.addEventListener("click", function () { go("settings"); });
    shellParts.bar = h("header", { "class": "sg-topbar", id: "sg-topbar" },
      shellParts.home,
      h("div", { "class": "sg-topbar-title" }, shellParts.robo, shellParts.title),
      h("div", { "class": "sg-topbar-actions" }, shellParts.extra, shellParts.sound, shellParts.gear));
    root = h("main", { "class": "sg-screen", id: "sg-screen", tabindex: "-1" });
    app.appendChild(shellParts.bar);
    app.appendChild(root);
    updateSoundButton();
  }

  /** Per-screen header settings; every go() starts again from the defaults. */
  function configure(opts) {
    shellCfg = Object.assign({}, DEFAULT_CFG, shellCfg || {}, opts || {});
    var c = shellCfg;
    shellParts.bar.hidden = !!c.hidden;
    shellParts.home.hidden = !c.home;
    shellParts.sound.hidden = !c.sound;
    shellParts.gear.hidden = !c.settings;
    shellParts.title.textContent = c.title || t("app.title");
    SG.ui.clear(shellParts.extra);
    if (c.extra) shellParts.extra.appendChild(c.extra);
  }

  function resetShell() {
    shellCfg = null;
    configure(DEFAULT_CFG);
  }

  /* ================================================================ router */

  function setTitle(text) { document.title = text; }

  function runCleanup() {
    if (cur.cleanup) { try { cur.cleanup(); } catch (e) { /* never block navigation */ } }
    cur.cleanup = null;
    SG.ui.cleanup();
    SG.ui.dialogs.dismissAll();
  }

  function pushHistory(name) {
    // Play gets its own history entry so the browser Back button can ask "Leave this round?" (design 5.7).
    if (name !== "play") return;
    try { history.pushState({ sg: name }, ""); } catch (e) { /* file:// in some browsers: fine, Back just leaves */ }
  }

  function go(name, params) {
    var screen = SG.screens[name];
    if (!screen) {
      if (typeof console !== "undefined") console.warn("[app] unknown screen " + name);
      name = "home";
      screen = SG.screens.home;
    }
    runCleanup();
    cur = { name: name, params: params || {}, cleanup: null };
    SG.ui.clear(root);
    resetShell();
    var key = screen.titleKey;
    shellCfg.title = key ? t(key) : null;
    configure({ title: shellCfg.title, settings: name === "home", home: name !== "home" });
    setTitle(key && name !== "home" ? t(key) + " - " + t("app.title") : t("app.title"));
    try {
      var cleanup = screen.render(root, cur.params);
      if (typeof cleanup === "function") cur.cleanup = cleanup;
    } catch (e) {
      showError(e);
      return;
    }
    window.scrollTo(0, 0);
    if (!cur.params.keepFocus) SG.ui.a11y.focusHeading(root);
    pushHistory(name);
  }

  function onPopState() {
    var screen = SG.screens[cur.name];
    if (screen && typeof screen.onBack === "function") {
      try { history.pushState({ sg: cur.name }, ""); } catch (e) { /* ignore */ }
      screen.onBack();
    }
  }

  /* ================================================================ errors (NF-068, UX-074) */

  function showError(err) {
    if (typeof console !== "undefined" && console.error) console.error(err);
    if (session.errorOpen) return;      // one friendly dialog is enough; a second error must not stack another
    var now = Date.now();
    var repeated = now - session.errorAt < 3000;
    session.errorAt = now;
    session.errorOpen = true;
    var text = { title: "Oops! Robo tripped.", text: "Let's start again.", button: "Start again" };
    try {
      text = { title: t("errors.tripped.title"), text: t("errors.tripped.body"), button: t("errors.tripped.button") };
    } catch (e) { /* copy itself is broken: keep the fallback words */ }
    SG.ui.dialogs.choose({
      title: text.title, text: text.text, mood: "neutral",
      buttons: [{ id: "restart", label: text.button, primary: true }], safeId: "restart"
    }).then(function () {
      session.errorOpen = false;
      // Saved rounds are in localStorage already. A second crash right away means Home itself is broken:
      // a full reload is the most reliable restart.
      if (repeated) { window.location.reload(); return; }
      try { go("home"); } catch (e) { window.location.reload(); }
    });
  }

  function installErrorHandlers() {
    window.addEventListener("error", function (e) {
      if (e && /ResizeObserver/.test(String(e.message))) return;   // harmless browser notice
      showError(e && e.error ? e.error : (e && e.message) || "error");
    });
    window.addEventListener("unhandledrejection", function (e) { showError(e && e.reason); });
  }

  /* ================================================================ boot */

  function supported() {
    try {
      return !!(window.Promise && window.Set && window.Map && Array.from && Object.assign && document.querySelector && window.Float64Array);
    } catch (e) { return false; }
  }

  function trainRobo() {
    SG.robo = SG.model.train(SG.alphabet.clean(SG.data.corpusParts.join(" ")), SG.config.MAX_ORDER);
  }

  function boot() {
    var app = document.getElementById("app");
    if (!supported()) {
      app.textContent = SG.copy.app.browserOld;
      return;
    }
    profile = normalize(SG.storage.load());
    SG.app.profile = profile;
    installErrorHandlers();
    window.addEventListener("popstate", onPopState);
    buildShell();
    configure({ title: t("app.title"), home: false, sound: false, settings: false });
    applySettings();
    root.appendChild(SG.ui.h("p", { "class": "sg-center sg-muted", role: "status" }, t("app.loading")));
    // Let the loading text paint, then train Robo once (target < 300 ms, architecture 7).
    setTimeout(function () {
      try {
        trainRobo();
        go(profile.onboarded || profile.inProgress ? "home" : "onboarding");
      } catch (e) {
        showError(e);
      }
    }, 30);
  }

  /* ================================================================ small services */

  function corpusCurve() {
    if (!corpusCache) {
      var sentences = SG.content.puzzles
        .filter(function (p) { return p.tier === "medium" || p.tier === "hard"; })
        .map(function (p) { return p.clean; });
      corpusCache = SG.info.corpusLookBackCurve(SG.robo, sentences);
    }
    return corpusCache;
  }

  function resetProgress() {
    profile = normalize(SG.storage.reset());
    SG.app.profile = profile;
    save();
    applySettings();
  }

  function storageNote() {
    if (SG.storage.available || session.storageNoteShown) return null;
    session.storageNoteShown = true;
    return t("errors.storageUnavailable");
  }

  var api = {
    boot: boot,
    go: go,
    save: save,
    current: function () { return { name: cur.name, params: cur.params }; },
    shell: { configure: configure },
    corpusCurve: corpusCurve,
    applySettings: applySettings,
    hasResume: function () { return !!(profile && profile.inProgress); },
    resume: function () { go("play", { resume: true }); },
    discardResume: function () { profile.inProgress = null; save(); },
    resetProgress: resetProgress,
    storageNote: storageNote,
    now: function () { return Date.now(); },
    newSeed: function () { return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0; },
    setTitle: setTitle,
    showError: showError,
    profile: null
  };
  return api;
})();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", SG.app.boot);
else SG.app.boot();
