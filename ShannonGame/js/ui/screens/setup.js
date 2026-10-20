/* Setup: pick the kind of sentence (and, for Peephole, how far back to peek), then Start
 * (design 03 section 3.5; GP-014..017, GP-075..078, GP-082, GP-083, UX-033).
 *
 * Params: {mode: "classic" | "peephole", tier?}   (Home's Gibberish tile passes tier "gibberish")
 * Start -> go("play", {mode, tier, peek, seed}). `tier` is concrete ("surprise" is resolved here, at Start,
 * to easy/medium/hard, GP-016); `peek` is null for Classic and for Peephole "All".
 * The first time a child starts Classic, a practice round is offered first (GP-011): the real play params
 * travel along as `then` and the practice screen forwards to Play.
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.setup = (function () {
  var h = SG.ui.h, t = SG.ui.t;
  var TIERS = ["easy", "medium", "hard", "gibberish", "surprise"];
  var PEEKS = SG.config.PEEK_OPTIONS.map(String).concat(["all"]);   // single source: SG.config
  var REAL_TIERS = ["easy", "medium", "hard"];

  /**
   * Make a set of buttons behave as one radio group: aria-checked, a roving tabindex and arrow keys that
   * move AND select (the usual radio behaviour). Returns select(index).
   */
  function radioGroup(buttons, startIndex, onChange) {
    var current = -1;
    function select(i, fromUser) {
      current = i;
      buttons.forEach(function (b, j) {
        b.setAttribute("aria-checked", j === i ? "true" : "false");
        b.setAttribute("tabindex", j === i ? "0" : "-1");
      });
      if (fromUser) buttons[i].focus();
      onChange(i);
    }
    buttons.forEach(function (b, i) {
      b.addEventListener("click", function () { select(i, false); });
      b.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        select((current + step + buttons.length) % buttons.length, true);
      });
    });
    select(startIndex, false);
    return select;
  }

  function tierIcon(id) {
    var stars = { easy: 1, medium: 2, hard: 3 }[id];
    if (stars) {
      var wrap = h("span", { "class": "sg-row", style: { gap: "2px", "flex-wrap": "nowrap", width: "56px", "justify-content": "center" }, "aria-hidden": "true" });
      for (var i = 0; i < stars; i++) wrap.appendChild(SG.ui.icon("star", { size: 16 }));
      return wrap;
    }
    return SG.ui.icon(id === "gibberish" ? "tileGibberish" : "die", { size: id === "gibberish" ? 40 : 32 });
  }

  function tierCard(id) {
    return h("button", { type: "button", role: "radio", "class": "sg-radiocard" + (id === "surprise" ? " sg-radiocard--dashed" : ""), "data-tier": id },
      tierIcon(id),
      h("span", { "class": "sg-radiocard-text" },
        h("span", { "class": "sg-radiocard-name" }, t("setup.tiers." + id + ".name")),
        h("span", { "class": "sg-radiocard-desc" }, t("setup.tiers." + id + ".desc"))),
      h("span", { "class": "sg-radiocard-check" }, SG.ui.icon("check", { size: 24 })));
  }

  /** A 56x24 picture of the peek window: fog on the left, a frame over the last k letters, the cursor box. */
  function peekPicture(k) {
    var HISTORY = 5;
    var shown = k === "all" ? HISTORY : Math.min(Number(k), HISTORY);
    var foggy = HISTORY - shown;
    var pic = h("span", { "class": "sg-peekpic", "aria-hidden": "true" });
    for (var i = 0; i < foggy; i++) pic.appendChild(h("span", { "class": "sg-peekbox is-fog" }));
    var win = h("span", { "class": "sg-peekwin" });
    for (var j = 0; j < shown; j++) win.appendChild(h("span", { "class": "sg-peekbox" }));
    pic.appendChild(win);
    pic.appendChild(h("span", { "class": "sg-peekbox is-cursor" }));
    return pic;
  }

  function peekOption(k) {
    return h("button", { type: "button", role: "radio", "class": "sg-peekopt", "data-k": k },
      peekPicture(k), h("span", null, t("setup.peek.labels." + k)));
  }

  function render(root, params) {
    var profile = SG.app.profile;
    var mode = params && params.mode === "peephole" ? "peephole" : "classic";
    var tierChoice = (params && TIERS.indexOf(params.tier) >= 0) ? params.tier
      : TIERS.indexOf(profile.lastTier) >= 0 ? profile.lastTier : "easy";      // GP-017
    var peekChoice = PEEKS.indexOf(String(profile.lastPeek)) >= 0 ? String(profile.lastPeek) : "2";

    // ---- tier picker
    var tierButtons = TIERS.map(tierCard);
    var tierGroup = h("div", { "class": "sg-radiogroup", role: "radiogroup", "aria-labelledby": "sg-tier-h" }, tierButtons);
    radioGroup(tierButtons, TIERS.indexOf(tierChoice), function (i) { tierChoice = TIERS[i]; });

    var sections = [
      h("div", { "class": "sg-setup-head" },
        h("div", null, SG.ui.h1(t("setup.modes." + mode)), h("p", { "class": "sg-muted" }, t("setup.modeIntro." + mode))),
        SG.ui.button(t("setup.change"), { kind: "link", onClick: function () { SG.app.go("home"); } })),
      h("section", null, h("h2", { id: "sg-tier-h" }, t("setup.tierHeading")), tierGroup)
    ];

    // ---- Peephole picker
    if (mode === "peephole") {
      var peekButtons = PEEKS.map(peekOption);
      var hint = h("p", { "class": "sg-hint", role: "status" });
      radioGroup(peekButtons, PEEKS.indexOf(peekChoice), function (i) {
        peekChoice = PEEKS[i];
        hint.textContent = t("setup.peek.hints." + peekChoice);
      });
      var finishedClassic = profile.rounds.filter(function (r) { return r.mode === "classic" && r.complete; }).length;
      sections.push(h("section", null,
        h("h2", { id: "sg-peek-h" }, t("setup.peek.heading")),
        h("p", { "class": "sg-muted" }, t("setup.peek.intro")),
        h("div", { "class": "sg-peekgrid", role: "radiogroup", "aria-labelledby": "sg-peek-h" }, peekButtons),
        hint,
        // GP-083: after two finished Classic rounds Robo suggests the experiment (kind, never says more is better).
        finishedClassic >= 2 ? h("div", { "class": "sg-note" }, SG.ui.robo.create("curious", 48, { bubble: false }), h("p", null, t("setup.peek.experiment"))) : null));
    }

    function start() {
      var tier = tierChoice === "surprise" ? REAL_TIERS[Math.floor(Math.random() * REAL_TIERS.length)] : tierChoice;
      profile.lastTier = tierChoice;
      if (mode === "peephole") profile.lastPeek = peekChoice;
      SG.app.save();
      var playParams = {
        mode: mode, tier: tier, seed: SG.app.newSeed(),
        peek: mode === "peephole" && peekChoice !== "all" ? Number(peekChoice) : null
      };
      if (mode === "classic" && !profile.practiced) SG.app.go("onboarding", { practice: true, then: playParams });
      else SG.app.go("play", playParams);
    }

    sections.push(h("div", { "class": "sg-startbar" }, SG.ui.button(t("setup.start"), { kind: "primary", big: true, onClick: start })));
    root.appendChild(h("div", { "class": "sg-setup" }, sections));
  }

  return { titleKey: "setup.title", render: render };
})();
