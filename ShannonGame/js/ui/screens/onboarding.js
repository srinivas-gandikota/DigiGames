/* Onboarding (3 steps + sound invitation) and the practice round (design 03 section 3.4; UX-030, UX-031,
 * UX-066, UX-098, GP-011..013).
 *
 * Params:
 *   {}                          the three-step intro; Skip is on every step; sets profile.onboarded
 *   {practice: true, then: P}   the practice round on a tiny sentence (not recorded, no Board). `then` is
 *                               the params for go("play", then): "Play a real sentence" starts it. Without
 *                               `then` the buttons lead Home.
 * The practice round runs on the same SG.game state machine and the same keyboard component as the real
 * Play screen, so what the child learns here is exactly what they will use.
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.onboarding = (function () {
  var h = SG.ui.h, s = SG.ui.s, t = SG.ui.t;

  /* ---------------------------------------------------------------- the three pictures */

  function key(x, y, label, state) {
    var cls = "sg-ob-key" + (state ? " is-" + state : "");
    var g = s("g", { "class": cls },
      s("rect", { x: x, y: y, width: 44, height: 44, rx: 10, "class": "sg-ob-keybox" }),
      s("text", { x: x + 22, y: y + 30, "text-anchor": "middle", "class": "sg-ob-t" }, label));
    if (state === "used") {
      g.appendChild(s("path", { d: "M" + (x + 30) + " " + (y + 6) + " l8 8 M" + (x + 38) + " " + (y + 6) + " l-8 8", "class": "sg-ob-x" }));
    }
    return g;
  }

  function cell(x, y, label, mode, badge) {
    var g = s("g", null, s("rect", { x: x, y: y, width: 40, height: 52, rx: 8, "class": "sg-ob-cell" + (mode ? " is-" + mode : "") }));
    if (label) g.appendChild(s("text", { x: x + 20, y: y + 36, "text-anchor": "middle", "class": "sg-ob-t" }, label));
    if (badge) g.appendChild(s("text", { x: x + 34, y: y + 12, "text-anchor": "middle", "class": "sg-ob-badge" }, badge));
    return g;
  }

  function picture(step) {
    var alt = t("onboarding.pictures." + ["one", "two", "three"][step - 1]);
    if (step === 1) {
      var sentence = s("svg", { viewBox: "0 0 230 110", width: 230, height: 110, "aria-hidden": "true" },
        s("rect", { x: 2, y: 2, width: 226, height: 106, rx: 16, "class": "sg-ob-card" }),
        s("rect", { x: 18, y: 24, width: 34, height: 26, rx: 6, "class": "sg-ob-fog" }),
        s("rect", { x: 58, y: 24, width: 34, height: 26, rx: 6, "class": "sg-ob-fog" }),
        s("rect", { x: 98, y: 24, width: 34, height: 26, rx: 6, "class": "sg-ob-fog" }),
        s("g", { "class": "sg-pulse" }, s("rect", { x: 150, y: 18, width: 40, height: 38, rx: 8, "class": "sg-ob-cell is-cursor" }),
          s("text", { x: 170, y: 46, "text-anchor": "middle", "class": "sg-ob-t" }, "?")));
      return h("div", { "class": "sg-onb-picture", role: "img", "aria-label": alt },
        h("div", { "class": "sg-row", style: { "flex-wrap": "nowrap", "justify-content": "center" }, "aria-hidden": "true" }, SG.ui.robo.svg({ mood: "waving", size: 110 }), sentence));
    }
    var svg;
    if (step === 2) {
      svg = s("svg", { viewBox: "0 0 240 190", width: 240, height: 190, "aria-hidden": "true" },
        cell(100, 8, "", "cursor"),
        s("path", { d: "M120 66 V84", "class": "sg-ob-arrow" }), s("path", { d: "M112 78 L120 88 L128 78", "class": "sg-ob-arrow" }),
        key(40, 96, "D"), key(98, 96, "E", "hl"), key(156, 96, "F"),
        s("path", { d: "M121 148 l0 22 l-7 -6 l-5 12 l-6 -3 l5 -12 l-9 0 z", "class": "sg-ob-hand" }));
    } else {
      svg = s("svg", { viewBox: "0 0 240 190", width: 240, height: 190, "aria-hidden": "true" },
        cell(100, 8, "E", "done", "2"),
        key(40, 96, "Z", "used"), key(98, 96, "E"), key(156, 96, "F"),
        s("text", { x: 62, y: 164, "text-anchor": "middle", "class": "sg-ob-small" }, "1"),
        s("text", { x: 120, y: 164, "text-anchor": "middle", "class": "sg-ob-small" }, "2"));
    }
    return h("div", { "class": "sg-onb-picture", role: "img", "aria-label": alt }, svg);
  }

  /* ---------------------------------------------------------------- shared finishing */

  function finishIntro(goHome) {
    var profile = SG.app.profile;
    profile.onboarded = true;
    SG.app.save();
    if (goHome !== false) SG.app.go("home");
  }

  function dots(step) {
    var wrap = h("div", { "class": "sg-dots", role: "img", "aria-label": t("onboarding.stepOf", { n: Math.min(step, 3), max: 3 }) });
    for (var i = 1; i <= 3; i++) wrap.appendChild(h("span", { "class": "sg-dot-step" + (i <= step ? " is-on" : "") }));
    return wrap;
  }

  /* ---------------------------------------------------------------- the intro */

  function renderIntro(root) {
    var step = 1;

    function sound(on) {
      var profile = SG.app.profile;
      profile.settings.sound = on;
      SG.sound.setEnabled(on);               // this click is the user gesture the browser wants before audio
      if (on) SG.sound.play("correct2");     // a short sample so they know what it sounds like
      SG.app.applySettings();
      finishIntro();
    }

    function drawSoundInvite() {
      SG.ui.clear(root);
      var robo = SG.ui.robo.create("happy", 120, { bubble: false, layout: "stack" });
      root.appendChild(h("div", { "class": "sg-onb" },
        robo,
        SG.ui.h1(t("onboarding.soundAsk"), "sg-onb-text"),
        h("div", { "class": "sg-row", style: { "justify-content": "center" } },
          SG.ui.button(t("onboarding.soundYes"), { kind: "primary", big: true, onClick: function () { sound(true); } }),
          SG.ui.button(t("onboarding.soundNo"), { big: true, onClick: function () { sound(false); } })),
        h("div", { "class": "sg-note" }, h("div", null, h("strong", null, t("onboarding.adultsTitle")), h("p", null, t("settings.adultsNote"))))));
      SG.ui.a11y.focus(root.querySelector("h1"));
    }

    function draw() {
      if (step > 3) { drawSoundInvite(); return; }
      SG.ui.clear(root);
      var last = step === 3;
      var heading = SG.ui.h1(t("onboarding.steps." + ["one", "two", "three"][step - 1] + ".text"), "sg-onb-text");
      root.appendChild(h("div", { "class": "sg-onb" },
        h("div", { "class": "sg-onb-top" },
          h("p", { "class": "sg-muted", style: { margin: 0 } }, t("onboarding.stepOf", { n: step, max: 3 })),
          SG.ui.button(t("onboarding.skip"), { kind: "link", cls: "sg-onb-skip", onClick: function () { finishIntro(); } })),
        picture(step),
        heading,
        dots(step),
        SG.ui.button(last ? t("onboarding.start") : t("onboarding.next"), { kind: "primary", big: true, onClick: function () { step++; draw(); } })));
      SG.ui.a11y.focus(heading);
    }
    draw();
  }

  /* ---------------------------------------------------------------- the practice round */

  function feedbackKey(rank) {
    return rank <= 1 ? "play.feedback.first" : rank <= 3 ? "play.feedback.nice" : "play.feedback.tricky";
  }

  function renderPractice(root, params) {
    var profile = SG.app.profile;
    var round = SG.game.createRound({ sentence: SG.ui.pick("practice.sentence"), mode: "classic", tier: "custom", peek: null, now: SG.app.now() });
    var robo = SG.ui.robo.create("curious", 72, { layout: "row" });
    var panel = h("div", { "class": "sg-practice-panel", role: "group" });
    var actions = h("div", { "class": "sg-row", style: { "justify-content": "center" } });
    var told = { greyed: false, space: false };

    function proceed() {
      profile.practiced = true;
      SG.app.save();
      if (params.then) SG.app.go("play", params.then);
      else SG.app.go("home");
    }

    function readout() {
      var parts = [];
      for (var i = 0; i < round.pos; i++) parts.push(round.sentence.charAt(i) === " " ? t("play.spaceWord") : round.sentence.charAt(i));
      return t("play.aria.revealedSoFar", { text: parts.length ? parts.join(", ") : t("play.aria.blank") });
    }

    function paint() {
      SG.ui.clear(panel);
      panel.setAttribute("aria-label", readout());
      for (var i = 0; i < round.pos; i++) {
        var ch = round.sentence.charAt(i);
        panel.appendChild(h("span", { "class": "sg-pcell" + (ch === " " ? " sg-pcell--space" : "") },
          ch === " " ? "" : ch, h("span", { "class": "sg-pbadge", "aria-hidden": "true" }, String(round.ranks[i]))));
      }
      if (!round.done) panel.appendChild(h("span", { "class": "sg-pcell sg-pcell--cursor", "aria-label": t("play.aria.current") }));
    }

    function finish() {
      kb.enable(false);
      robo.say(t("practice.done"), { mood: "cheering", essential: true });
      SG.sound.play("finish");
      SG.ui.clear(actions);
      var go = SG.ui.button(t("practice.go"), { kind: "primary", big: true, onClick: proceed });
      actions.appendChild(go);
      SG.ui.a11y.focus(go);
    }

    function onKey(sym) {
      var r = SG.game.guess(round, sym, SG.robo);
      if (r.type === "wrong") {
        kb.setUsed(round.wrong);
        kb.wobble(sym);
        SG.sound.play("wrong");
        robo.say(told.greyed ? SG.ui.pick("play.notThis") : t("practice.greyed"), { mood: "neutral", essential: true });
        told.greyed = true;
      } else if (r.type === "correct") {
        kb.reset();
        SG.sound.play(r.rank <= 1 ? "correct1" : r.rank <= 3 ? "correct2" : "correct3");
        paint();
        if (r.done) { finish(); return; }
        var nextIsSpace = round.sentence.charAt(round.pos) === " ";
        if (nextIsSpace && !told.space) { told.space = true; robo.say(t("practice.space"), { mood: "curious", essential: true }); }
        else robo.say(SG.ui.pick(feedbackKey(r.rank)), { mood: r.rank <= 3 ? "happy" : "curious", essential: true });
      }
    }

    var kb = SG.ui.keyboard.create({
      onKey: onKey,
      onInvalid: function () { robo.say(t("play.invalidKey"), { essential: true }); }
    });

    var title = SG.ui.h1(t("practice.title"));
    root.appendChild(h("div", { "class": "sg-practice" },
      h("div", { "class": "sg-row", style: { "justify-content": "space-between", "flex-wrap": "nowrap" } },
        title,
        SG.ui.button(t("practice.skip"), { kind: "link", onClick: proceed })),
      h("p", { "class": "sg-muted", style: { margin: 0 } }, t("practice.intro")),
      robo,
      panel,
      h("p", { "class": "sg-hint sg-center" }, t("practice.input")),
      actions,
      kb.el));
    paint();
    robo.say(t("practice.highlight"), { mood: "curious", essential: true });
    return function () { kb.destroy(); };
  }

  function render(root, params) {
    if (params && params.practice) return renderPractice(root, params);
    return renderIntro(root);
  }

  return { titleKey: null, render: render };
})();
