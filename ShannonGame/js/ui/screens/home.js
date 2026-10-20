/* Home screen (design 03 section 3.3; GP-001..005, GP-010, UX-098).
 * Robo greets, the five game tiles carry "Start here" / "Try next" suggestions (GP-004, never locks or
 * reorders tiles, GP-003), a saved round offers "Keep going / Start fresh", and one-time notes appear
 * for adults. Params: none.
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.home = (function () {
  var h = SG.ui.h, t = SG.ui.t;

  var TILES = [
    { id: "detective", icon: "tileDetective", open: function () { SG.app.go("detective"); } },
    { id: "classic", icon: "tileClassic", open: function () { SG.app.go("setup", { mode: "classic" }); } },
    { id: "peephole", icon: "tilePeephole", open: function () { SG.app.go("setup", { mode: "peephole" }); } },
    { id: "twoPlayer", icon: "tileTwoPlayer", open: function () { SG.app.go("twoplayer"); } },
    { id: "gibberish", icon: "tileGibberish", open: function () { SG.app.go("setup", { mode: "classic", tier: "gibberish" }); } }
  ];

  /**
   * GP-004: first Bit Detective, then Classic; once the child has seen one Board, Peephole is "Try next".
   * Markers are suggestions only. Returns {tileId: "startHere" | "tryNext"}.
   */
  function markersFor(p) {
    if (!p.rounds.length) return p.detective.length ? { classic: "startHere" } : { detective: "startHere" };
    var triedPeephole = p.rounds.some(function (r) { return r.mode === "peephole"; });
    return triedPeephole ? {} : { peephole: "tryNext" };
  }

  function tile(def, marker) {
    var kids = [
      SG.ui.icon(def.icon, { size: 48 }),
      h("span", { "class": "sg-modetile-name" }, t("home.tiles." + def.id + ".name")),
      h("span", { "class": "sg-modetile-desc" }, t("home.tiles." + def.id + ".desc"))
    ];
    if (marker) kids.push(h("span", { "class": "sg-ribbon" }, SG.ui.icon("star", { size: 14 }), t("home.markers." + marker)));
    var btn = h("button", { type: "button", "class": "sg-modetile" + (marker ? " sg-modetile--marked" : ""), "data-tile": def.id }, kids);
    btn.addEventListener("click", function () { SG.app.homeFocus = def.id; def.open(); });
    return btn;
  }

  function resumeCard(profile) {
    var twoPlayer = profile.inProgress && profile.inProgress.mode === "twoPlayer";
    return h("section", { "class": "sg-card sg-resume", "aria-labelledby": "sg-resume-t" },
      h("div", { "class": "sg-robo sg-robo--row" }, SG.ui.robo.create("waving", 64, { bubble: false })),
      h("div", { "class": "sg-grow" },
        h("h2", { id: "sg-resume-t" }, t("dialogs.resume.title")),
        // A Two-Player round never says anything about its sentence (GP-056, GP-104).
        twoPlayer ? h("p", null, t("dialogs.resume.twoPlayer")) : null,
        h("div", { "class": "sg-resume-actions" },
          SG.ui.button(t("dialogs.resume.keep"), { kind: "primary", onClick: function () { SG.app.resume(); } }),
          SG.ui.button(t("dialogs.resume.fresh"), { onClick: function () { SG.app.discardResume(); SG.app.go("home"); } }))));
  }

  function dismissibleNote(children, onDismiss) {
    var note = h("div", { "class": "sg-note", role: "note" }, h("div", { "class": "sg-grow" }, children));
    note.appendChild(SG.ui.button(t("ui.ok"), { cls: "sg-btn--pill", onClick: function () {
      if (note.parentNode) note.parentNode.removeChild(note);
      if (onDismiss) onDismiss();
    } }));
    return note;
  }

  function notices(profile) {
    var out = [];
    var storage = SG.app.storageNote();
    if (storage) out.push(dismissibleNote(h("p", null, storage)));
    if (!profile.notices.privacySeen) {
      out.push(dismissibleNote([h("strong", null, t("settings.adultsTitle")), h("p", null, t("settings.adultsNote"))],
        function () { profile.notices.privacySeen = true; SG.app.save(); }));
    }
    return out;
  }

  function render(root) {
    var profile = SG.app.profile;
    var greeting = profile.nickname ? SG.ui.pick("home.greetingNamed", { nickname: profile.nickname }) : SG.ui.pick("home.greeting");
    var robo = SG.ui.robo.create("waving", 160, { layout: "stack" });
    robo.say(greeting, { essential: true, silent: true });

    var markers = markersFor(profile);
    var grid = h("div", { "class": "sg-tilegrid" }, TILES.map(function (def) { return tile(def, markers[def.id]); }));

    var secondary = h("div", { "class": "sg-pillrow" },
      SG.ui.button(t("home.tiles.journey.name"), { cls: "sg-btn--pill", onClick: function () { SG.app.go("journey"); } }),
      SG.ui.button(t("home.tiles.history.name"), { cls: "sg-btn--pill", onClick: function () { SG.app.go("history"); } }),
      SG.ui.button(t("home.tiles.howToPlay.name"), { cls: "sg-btn--pill", onClick: function () { SG.app.go("help", { section: "how" }); } }));

    var footer = h("div", { "class": "sg-footerlinks" },
      SG.ui.button(t("home.tiles.aboutRobo.name"), { kind: "link", onClick: function () { SG.app.go("help", { section: "about" }); } }),
      SG.ui.button(t("home.tiles.settings.name"), { kind: "link", onClick: function () { SG.app.go("settings"); } }));

    var title = SG.ui.h1(t("home.heading"));
    var main = h("div", { "class": "sg-stack sg-home-main" },
      title,
      SG.app.hasResume() ? resumeCard(profile) : null,
      notices(profile),
      grid, secondary, footer);

    root.appendChild(h("div", { "class": "sg-home" }, h("div", { "class": "sg-home-hero" }, robo), main));

    // Coming back from a sub-screen: put focus on the tile the child used last (design 5.4).
    var last = SG.app.homeFocus && grid.querySelector('[data-tile="' + SG.app.homeFocus + '"]');
    if (last) { title.removeAttribute("data-sg-focus"); last.setAttribute("data-sg-focus", ""); }
    SG.app.homeFocus = null;
  }

  return { render: render };
})();
