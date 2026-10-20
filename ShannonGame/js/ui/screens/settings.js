/* Settings (design 03 section 3.12; UX-059, UX-060, UX-066, UX-083, UX-098, NF-032, NF-066, GP-008).
 * Big 56 px rows; switches show the words On/Off, not only a colour. Params: none.
 * Every change is applied at once (theme, sound) and saved. Reset is two plain taps' worth of dialogs:
 * no timer, no hold (UX-083), at most 3 taps from the button (NF-032).
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.settings = (function () {
  var h = SG.ui.h, t = SG.ui.t;
  var uid = 0;

  function changed() {
    SG.app.save();
    SG.app.applySettings();
  }

  /** A labelled row: name + optional hint on the left, a control on the right. */
  function row(name, hint, control, stack) {
    var id = "sg-set-" + (++uid);
    var text = h("span", { "class": "sg-setting-text" },
      h("span", { "class": "sg-setting-name", id: id }, name),
      hint ? h("span", { "class": "sg-setting-hint" }, hint) : null);
    var el = h("div", { "class": "sg-setting" + (stack ? " sg-setting--stack" : "") }, text, control);
    el.labelId = id;
    return el;
  }

  function switchControl(labelId, value, onChange) {
    var word = h("span", { "class": "sg-switch-word" });
    var btn = h("button", { type: "button", role: "switch", "class": "sg-switch", "aria-labelledby": labelId }, h("span", { "class": "sg-switch-knob" }), word);
    function paint() {
      btn.setAttribute("aria-checked", value ? "true" : "false");
      word.textContent = t(value ? "ui.on" : "ui.off");
    }
    btn.addEventListener("click", function () { value = !value; paint(); onChange(value); });
    paint();
    return btn;
  }

  /** Radio-style buttons. Updated in place (not rebuilt) so keyboard focus stays on the pressed option. */
  function segmented(labelId, options, current, onPick) {
    var wrap = h("div", { "class": "sg-seg", role: "radiogroup", "aria-labelledby": labelId });
    var buttons = options.map(function (o) {
      var b = h("button", { type: "button", role: "radio", "class": "sg-seg-opt" }, o.label);
      b.addEventListener("click", function () { current = o.value; paint(); onPick(o.value); });
      wrap.appendChild(b);
      return b;
    });
    function paint() {
      buttons.forEach(function (b, i) { b.setAttribute("aria-checked", options[i].value === current ? "true" : "false"); });
    }
    paint();
    return wrap;
  }

  function switchRow(name, hint, getValue, onChange) {
    var placeholder = row(name, hint, h("span"));
    var ctl = switchControl(placeholder.labelId, getValue(), onChange);
    placeholder.replaceChild(ctl, placeholder.lastChild);
    return placeholder;
  }

  /* ---------------------------------------------------------------- nickname */

  /** "SRI NIVAS" -> "Sri Nivas". Letters and spaces only, at most 12 characters, blocklist-checked. */
  function tidyNickname(raw) {
    var clean = SG.alphabet.clean(raw).slice(0, 12).replace(/ +$/, "");
    return clean.split(" ").map(function (w) { return w ? w.charAt(0) + w.slice(1).toLowerCase() : w; }).join(" ");
  }

  function nicknameRow(profile) {
    var input = h("input", { type: "text", "class": "sg-field", maxlength: 12, autocomplete: "off", autocapitalize: "words", spellcheck: "false", value: profile.nickname || "" });
    var hint = h("span", { "class": "sg-setting-hint", role: "status" }, t("settings.nicknameHint"));
    var rowEl = row(t("settings.nickname"), null, h("div", { "class": "sg-grow", style: { width: "100%" } }, input, hint), true);
    input.setAttribute("aria-labelledby", rowEl.labelId);
    input.addEventListener("change", function () {
      var nick = tidyNickname(input.value);
      // A blocklisted word is caught by the same check the Two-player sentence uses (CT-051, CT-054).
      if (nick && SG.content.checkCustom(nick).reason === "blocked") {
        hint.textContent = t("settings.nicknameBlocked");
        hint.classList.add("is-problem");
        return;
      }
      hint.classList.remove("is-problem");
      hint.textContent = t("settings.nicknameHint");
      profile.nickname = nick;
      input.value = nick;
      SG.app.save();
    });
    return rowEl;
  }

  /* ---------------------------------------------------------------- reset (two steps) */

  function resetFlow() {
    var keep = { id: "keep", label: t("settings.reset.keep"), primary: true };
    SG.ui.dialogs.choose({
      title: t("settings.reset.question"), text: t("settings.reset.detail"),
      buttons: [keep, { id: "next", label: t("settings.reset.step1") }], safeId: "keep"
    }).then(function (first) {
      if (first !== "next") return null;
      return SG.ui.dialogs.choose({
        title: t("settings.reset.step2Title"), text: t("settings.reset.step2Body"),
        buttons: [keep, { id: "erase", label: t("settings.reset.step2Confirm"), danger: true }], safeId: "keep"
      });
    }).then(function (second) {
      if (second !== "erase") return;
      SG.app.resetProgress();
      SG.ui.a11y.announce(t("settings.reset.done"));
      SG.app.go("onboarding");     // "then behave as first launch"
    });
  }

  /* ---------------------------------------------------------------- screen */

  function render(root) {
    var profile = SG.app.profile, st = profile.settings;
    var calmValue = st.calmMotion === null || st.calmMotion === undefined ? "follow" : st.calmMotion ? "on" : "off";

    var soundRow = switchRow(t("settings.sound"), t("settings.soundHint"), function () { return st.sound; }, function (v) {
      st.sound = v;
      SG.sound.setEnabled(v);
      if (v) SG.sound.play("correct2");
      changed();
    });

    var calmRow = row(t("settings.calmMotion"), t("settings.calmMotionHint"), h("span"));
    calmRow.replaceChild(segmented(calmRow.labelId, [
      { value: "follow", label: t("settings.calm.follow") }, { value: "on", label: t("settings.calm.on") }, { value: "off", label: t("settings.calm.off") }
    ], calmValue, function (v) { st.calmMotion = v === "follow" ? null : v === "on"; changed(); }), calmRow.lastChild);

    var layoutRow = row(t("settings.layout"), null, h("span"));
    layoutRow.replaceChild(segmented(layoutRow.labelId, [
      { value: "abc", label: t("settings.layoutAbc") }, { value: "qwerty", label: t("settings.layoutQwerty") }
    ], st.layout, function (v) { st.layout = v; changed(); }), layoutRow.lastChild);

    var bigRow = switchRow(t("settings.bigKeys"), null, function () { return st.bigKeys; }, function (v) { st.bigKeys = v; changed(); });
    var hcRow = switchRow(t("settings.highContrast"), null, function () { return st.highContrast; }, function (v) { st.highContrast = v; changed(); });
    var quietRow = switchRow(t("settings.quietRobo"), t("settings.quietRoboHint"), function () { return st.quietRobo; }, function (v) { st.quietRobo = v; changed(); });

    var links = h("div", { "class": "sg-pillrow" },
      SG.ui.button(t("settings.replayIntro"), { onClick: function () { profile.onboarded = false; SG.app.save(); SG.app.go("onboarding"); } }),
      SG.ui.button(t("settings.replayPractice"), { onClick: function () { SG.app.go("onboarding", { practice: true }); } }),
      SG.ui.button(t("home.tiles.aboutRobo.name"), { onClick: function () { SG.app.go("help", { section: "about" }); } }),
      SG.ui.button(t("settings.teachers.title"), { onClick: function () { SG.app.go("help", { section: "teachers" }); } }));

    root.appendChild(h("div", { "class": "sg-settings" },
      SG.ui.h1(t("settings.title")),
      soundRow, calmRow, layoutRow, bigRow, hcRow, quietRow,
      nicknameRow(profile),
      links,
      h("div", { "class": "sg-note" }, h("div", null, h("strong", null, t("settings.adultsTitle")), h("p", null, t("settings.adultsNote")))),
      h("div", null, SG.ui.button(t("settings.reset.button"), { cls: "sg-btn--pill", onClick: resetFlow })),
      h("p", { "class": "sg-version" }, t("settings.version", { v: SG.VERSION }) + " · " + t("settings.contentVersion", { c: SG.data.CONTENT_VERSION }))));
  }

  return { titleKey: "settings.title", render: render };
})();
