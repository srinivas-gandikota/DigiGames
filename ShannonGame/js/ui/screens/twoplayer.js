/* Two-player: the Setter hides a sentence, the device is handed over, the Guesser plays
 * (design 03 section 3.11; GP-095..107, CT-049..057, UX-075, UX-076).
 * Params: none. Ends with go("play", {mode: "twoPlayer", tier: "custom", peek: null, sentence}).
 *
 * Five neutral steps: intro -> secret entry (masked, Show/Hide toggle) -> private preview -> handoff
 * ("Pass the device") -> ready (a second, separate tap) -> Play. The secret sentence is only in the DOM on
 * the entry and preview steps; afterwards it lives in this closure. It is dropped when the screen is left:
 * the render cleanup clears it on any go() (e.g. Home), and it is cleared just before the hand-off to Play (E16).
 * The screen has no onBack, so the browser Back button does not leave it: the router ignores Back here.
 * Nothing here ever shows the sentence on a handoff step.
 * Typed text is read from the input's value and shown with textContent, never as markup.
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.twoplayer = (function () {
  var h = SG.ui.h, t = SG.ui.t;

  /** Map a SG.content.checkCustom reason to a kind hint (never names a blocked word, CT-053). */
  function hintFor(check, len) {
    var cfg = SG.config;
    switch (check.reason) {
      case "empty": return t("twoPlayer.hints.empty");
      case "short": return t("twoPlayer.hints.short", { need: cfg.SENTENCE_MIN - len });
      case "long": return t("twoPlayer.hints.long", { cut: len - cfg.SENTENCE_MAX });
      case "digits": return t("twoPlayer.hints.digits");
      case "blocked": return t("twoPlayer.hints.blocked");
      case "variety": return t("twoPlayer.hints.mixItUp");
      case "known": return t("twoPlayer.hints.known");   // GP-009: Robo has read this one
      default: return "";
    }
  }

  function counterText(len) {
    return t("twoPlayer.setter.counter", { n: len, minLen: SG.config.SENTENCE_MIN, maxLen: SG.config.SENTENCE_MAX });
  }

  function render(root) {
    var secret = null;      // cleaned sentence, kept only after "This is the one"
    var typed = "";         // what the Setter typed, kept so an error never loses their work (UX-075)

    function show(children, focusSelector) {
      SG.ui.clear(root);
      root.appendChild(h("div", { "class": "sg-twop" }, children));
      var target = focusSelector ? root.querySelector(focusSelector) : root.querySelector("h1");
      if (target) SG.ui.a11y.focus(target, { preventScroll: true });
    }

    function backTo(fn) { return SG.ui.button(t("ui.back"), { kind: "link", onClick: fn }); }

    /* ---- 1. Setter's turn */
    function stageIntro() {
      secret = null; typed = "";
      var robo = SG.ui.robo.create("waving", 110, { layout: "stack" });
      robo.say(t("twoPlayer.setter.lookAway"), { essential: true, silent: true });
      show([
        robo,
        SG.ui.h1(t("twoPlayer.title")),
        h("p", null, t("twoPlayer.intro")),
        h("div", { "class": "sg-note" }, h("p", null, t("twoPlayer.setter.nudge"))),
        SG.ui.button(t("twoPlayer.setter.iAmSetter"), { kind: "primary", big: true, onClick: stageEntry })
      ]);
    }

    /* ---- 2. Secret entry */
    function stageEntry() {
      var shown = false, pendingShown = null;
      var input = h("input", {
        type: "password", "class": "sg-field", name: "s", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
        "aria-label": t("twoPlayer.setter.placeholder"), placeholder: t("twoPlayer.setter.placeholder"), maxlength: 400, value: typed
      });
      var counter = h("span", { "class": "sg-chip sg-counter", role: "status" });
      var message = h("p", { "class": "sg-hint is-problem", role: "status" });
      var toggle = h("button", { type: "button", "class": "sg-btn", "aria-pressed": "false" });

      function paintToggle() {
        SG.ui.clear(toggle);
        toggle.appendChild(SG.ui.icon("eye", { size: 20 }));
        toggle.appendChild(document.createTextNode(t(shown ? "twoPlayer.setter.hide" : "twoPlayer.setter.show")));
        toggle.setAttribute("aria-pressed", shown ? "true" : "false");
        input.type = shown ? "text" : "password";
      }
      function hideNow() { if (shown) { shown = false; paintToggle(); } }

      // A tap on the toggle blurs the input first; remember the state from before so blur does not undo the tap.
      ["pointerdown", "mousedown", "touchstart"].forEach(function (ev) {
        toggle.addEventListener(ev, function () { pendingShown = shown; }, { passive: true });
      });
      toggle.addEventListener("click", function () {
        shown = pendingShown !== null ? !pendingShown : !shown;
        pendingShown = null;
        paintToggle();
      });
      input.addEventListener("blur", function (e) { if (e.relatedTarget !== toggle) hideNow(); });
      SG.ui.on(window, "blur", hideNow);
      SG.ui.on(document, "visibilitychange", function () { if (document.hidden) hideNow(); });

      function update() {
        typed = input.value;
        counter.textContent = counterText(SG.alphabet.clean(input.value).length);
        message.textContent = "";
      }
      function check() {
        typed = input.value;
        var result = SG.content.checkCustom(typed);
        if (!result.ok) {
          message.textContent = hintFor(result, result.clean.length);
          SG.ui.a11y.focus(input);
          return;
        }
        secret = result.clean;
        stagePreview();
      }
      input.addEventListener("input", update);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });

      show([
        SG.ui.h1(t("twoPlayer.setter.title")),
        h("p", { "class": "sg-muted" }, t("twoPlayer.setter.hint")),
        h("div", { "class": "sg-entry-row" }, input, toggle),
        h("div", { "class": "sg-row" }, counter),
        message,
        h("div", { "class": "sg-row" }, backTo(stageIntro), h("span", { "class": "sg-grow" }),
          SG.ui.button(t("twoPlayer.setter.check"), { kind: "primary", big: true, onClick: check }))
      ], "input");
      paintToggle();
      update();
    }

    /* ---- 3. Private preview (only the Setter looks) */
    function stagePreview() {
      show([
        SG.ui.h1(t("twoPlayer.setter.preview")),
        h("div", { "class": "sg-note" }, h("p", null, h("strong", null, t("twoPlayer.setter.lookWarning")))),
        h("div", { "class": "sg-preview", "aria-live": "off" }, secret),
        h("p", { "class": "sg-hint sg-center" }, counterText(secret.length)),
        h("div", { "class": "sg-row", style: { "justify-content": "center" } },
          SG.ui.button(t("twoPlayer.setter.change"), { onClick: function () { secret = null; stageEntry(); } }),
          SG.ui.button(t("twoPlayer.setter.confirm"), { kind: "primary", big: true, onClick: stageHandoff }))
      ]);
    }

    /* ---- 4. Handoff: no sentence content anywhere, so the typed text and the preview are gone from the DOM */
    function stageHandoff() {
      typed = "";
      var robo = SG.ui.robo.create("waving", 120, { layout: "stack" });
      show([
        robo,
        SG.ui.h1(t("twoPlayer.handoff.title")),
        h("p", { "class": "sg-center" }, t("twoPlayer.handoff.body")),
        h("p", { "class": "sg-hint sg-center" }, t("onboarding.stepOf", { n: 1, max: 2 })),
        h("div", { "class": "sg-row", style: { "justify-content": "center" } },
          SG.ui.button(t("twoPlayer.handoff.iAmGuesser"), { kind: "primary", big: true, onClick: stageReady })),
        h("div", null, backTo(stageIntro))
      ]);
    }

    /* ---- 5. Ready: a separate screen with the button on the other side (two plain taps, no hold) */
    function stageReady() {
      show([
        SG.ui.h1(t("twoPlayer.handoff.ready")),
        h("p", { "class": "sg-hint sg-center" }, t("onboarding.stepOf", { n: 2, max: 2 })),
        h("p", { "class": "sg-center" }, t("twoPlayer.guesserIntro")),
        h("div", { "class": "sg-row" }, backTo(stageIntro), h("span", { "class": "sg-grow" }),
          SG.ui.button(t("twoPlayer.handoff.start"), { kind: "primary", big: true, onClick: start }))
      ]);
    }

    function start() {
      var sentence = secret;
      secret = null; typed = "";
      SG.app.go("play", { mode: "twoPlayer", tier: "custom", peek: null, sentence: sentence });
    }

    stageIntro();
    // The secret must not outlive this screen (E16).
    return function () { secret = null; typed = ""; };
  }

  return { titleKey: "twoPlayer.title", render: render };
})();
