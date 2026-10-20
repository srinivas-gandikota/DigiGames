/* Help: How to Play, About Robo, and For teachers and parents (design 03 section 3.13, UX-081, GP-009,
 * GP-013, GP-049). One screen with three sections so Home, Settings and the Board can all link to the
 * right one. Params: {section?: "how" | "about" | "teachers"} (default "how").
 * Adult text is plain text only: no links, nothing external (UX-091).
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.help = (function () {
  var h = SG.ui.h, t = SG.ui.t;
  var CONCEPTS = ["surprise", "bit", "entropy", "context", "redundancy", "twin", "enough", "squeeze", "robo"];
  var STEPS = ["guess", "grey", "space", "showMe", "board"];

  function howToPlay() {
    var cards = STEPS.map(function (id, i) {
      var text = [h("p", null, t("help.how." + id + ".text"))];
      // GP-049: say plainly how a revealed letter is counted.
      if (id === "showMe") text.push(h("p", null, t("play.giveUp.confirmBody")));
      return h("section", { "class": "sg-card sg-help-card" },
        h("span", { "class": "sg-help-num", "aria-hidden": "true" }, String(i + 1)),
        h("div", null, h("h3", null, t("help.how." + id + ".title")), text));
    });
    return [
      h("p", null, t("help.how.intro")),
      cards,
      h("div", { "class": "sg-row" },
        SG.ui.button(t("settings.replayIntro"), { onClick: function () { SG.app.profile.onboarded = false; SG.app.save(); SG.app.go("onboarding"); } }),
        SG.ui.button(t("settings.replayPractice"), { onClick: function () { SG.app.go("onboarding", { practice: true }); } }))
    ];
  }

  function aboutRobo() {
    return [
      h("div", { "class": "sg-home-hero" }, SG.ui.robo.create("happy", 140, { bubble: false, layout: "stack" })),
      h("p", null, t("robo.about.p1")),
      h("p", null, t("robo.about.p2")),
      h("p", null, t("robo.about.p3")),
      h("div", null, SG.ui.button(t("robo.about.close"), { kind: "primary", onClick: function () { SG.app.go("home"); } }))
    ];
  }

  function accordion(id) {
    var base = "settings.teachers.grownUp." + id;
    var panel = h("div", { "class": "sg-accordion-panel", hidden: true },
      h("p", null, t(base + ".goal")),
      h("ul", null, (SG.ui.raw(base + ".questions") || []).map(function (q) { return h("li", null, q); })));
    var btn = h("button", { type: "button", "class": "sg-accordion-btn", "aria-expanded": "false" },
      h("span", null, t(base + ".name")), SG.ui.icon("chevronDown", { size: 22 }));
    btn.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    return h("div", { "class": "sg-accordion" }, btn, panel);
  }

  function teachers() {
    return [
      h("p", null, t("settings.teachers.intro")),
      h("p", null, t("settings.teachers.grownUp.goals")),
      h("div", null, CONCEPTS.map(accordion))
    ];
  }

  var SECTIONS = {
    how: { title: function () { return t("help.title"); }, body: howToPlay },
    about: { title: function () { return t("robo.about.title"); }, body: aboutRobo },
    teachers: { title: function () { return t("settings.teachers.title"); }, body: teachers }
  };

  function render(root, params) {
    var current = SECTIONS[params && params.section] ? params.section : "how";
    var tabs = h("div", { "class": "sg-tabs", role: "radiogroup", "aria-label": t("help.title") });
    var content = h("div", { "class": "sg-stack" });
    root.appendChild(h("div", { "class": "sg-help" }, tabs, content));

    function draw() {
      SG.ui.clear(tabs);
      Object.keys(SECTIONS).forEach(function (id) {
        var b = h("button", { type: "button", "class": "sg-seg-opt", role: "radio", "aria-checked": id === current ? "true" : "false" }, t("help.tabs." + id));
        b.addEventListener("click", function () { current = id; draw(); });
        tabs.appendChild(b);
      });
      SG.ui.clear(content);
      content.appendChild(SG.ui.h1(SECTIONS[current].title()));
      content.appendChild(h("div", { "class": "sg-stack" }, SECTIONS[current].body())); // h() flattens nested arrays
      SG.app.setTitle(SECTIONS[current].title() + " - " + t("app.title"));
    }
    draw();
  }

  return { render: render };
})();
