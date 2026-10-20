/* History: every saved round, newest first (design 03 section 3.9; GP-118..121).
 * Params: none. Opening a row calls go("board", {recordId}); the Board recomputes the same numbers from
 * the stored sentence + guesses (GP-119). Rules shown here:
 *   - a partial round never shows its sentence (the unfinished rest stays hidden, DB-082);
 *   - a Two-player round shows its sentence only after it was completed (GP-104), otherwise a placeholder;
 *   - the first 30 rounds are listed, "Show more" adds 30 at a time;
 *   - "Delete this round" asks first (GP-121).
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.history = (function () {
  var h = SG.ui.h, t = SG.ui.t, fmt = SG.ui.fmt;
  var PAGE = 30;

  /** Stored stats, or (for a record that lacks them) the same numbers recomputed from the round. */
  function statsOf(rec) {
    if (rec.stats && isFinite(rec.stats.mid)) return rec.stats;
    try { return SG.info.summaryStats(SG.info.summarize(rec, SG.robo, null)); } catch (e) { return null; }
  }

  function chips(rec) {
    var out = [h("span", { "class": "sg-chip" }, t("setup.modes." + rec.mode))];
    if (rec.mode !== "twoPlayer" && SG.ui.has("setup.tiers." + rec.tier)) out.push(h("span", { "class": "sg-chip" }, t("setup.tiers." + rec.tier + ".name")));
    if (rec.mode === "peephole") out.push(h("span", { "class": "sg-chip" }, rec.peek == null ? t("board.header.peekAll") : t("board.header.peek", { k: rec.peek })));
    if (rec.complete === false) out.push(h("span", { "class": "sg-chip sg-chip--tag" }, t("history.tags.partial")));
    if (rec.replay) out.push(h("span", { "class": "sg-chip sg-chip--tag" }, t("history.tags.replay")));
    var peeked = (rec.revealed || []).filter(Boolean).length;
    if (peeked) out.push(h("span", { "class": "sg-chip sg-chip--tag" }, SG.ui.icon("eye", { size: 14 }), t("history.tags.peeked", { r: peeked })));
    return out;
  }

  function sentenceLine(rec) {
    if (rec.complete !== false) return h("span", { "class": "sg-hrow-sentence" }, rec.sentence);   // textContent: never markup
    return rec.mode === "twoPlayer" ? h("span", { "class": "sg-muted" }, t("history.secret")) : null;
  }

  function rowButton(rec) {
    var st = statsOf(rec);
    var btn = h("button", { type: "button", "class": "sg-hrow", "data-id": rec.id },
      h("span", { "class": "sg-hrow-top" }, h("span", { "class": "sg-hrow-date" }, fmt.date(rec.ts)), chips(rec)),
      sentenceLine(rec),
      st ? h("span", { "class": "sg-muted" }, t("history.estimate", { mid: fmt.bits(st.mid), robo: fmt.bits(st.roboMid) })) : null,
      st ? h("span", { "class": "sg-muted" }, t("history.guesses", { g: fmt.int(st.totalGuesses) })) : null);
    btn.addEventListener("click", function () { SG.app.historyFocus = rec.id; SG.app.go("board", { recordId: rec.id }); });
    return btn;
  }

  function render(root) {
    var profile = SG.app.profile;
    var shown = PAGE;
    var list = h("div", { "class": "sg-stack" });
    var more = SG.ui.button(t("ui.more"), { cls: "sg-btn--pill", onClick: function () { shown += PAGE; draw(); } });

    function confirmDelete(rec) {
      SG.ui.dialogs.choose({
        title: t("history.remove"), text: t("history.removeConfirm"),
        buttons: [{ id: "keep", label: t("history.removeNo"), primary: true }, { id: "delete", label: t("history.removeYes") }], safeId: "keep"
      }).then(function (id) {
        if (id !== "delete") return;
        profile.rounds = profile.rounds.filter(function (r) { return r.id !== rec.id; });
        SG.app.save();
        draw();
      });
    }

    function item(rec) {
      var del = h("button", { type: "button", "class": "sg-iconbtn", "aria-label": t("history.remove") }, SG.ui.icon("cross", { size: 22 }));
      del.addEventListener("click", function () { confirmDelete(rec); });
      return h("div", { "class": "sg-hitem" }, rowButton(rec), del);
    }

    function draw() {
      SG.ui.clear(list);
      var rounds = profile.rounds.slice().reverse();       // newest first
      if (!rounds.length) {
        list.appendChild(h("div", { "class": "sg-card sg-center" }, SG.ui.robo.create("neutral", 96, { layout: "stack", bubble: false }), h("p", null, t("history.empty"))));
      } else {
        rounds.slice(0, shown).forEach(function (rec) { list.appendChild(item(rec)); });
      }
      more.hidden = rounds.length <= shown;
    }

    root.appendChild(h("div", { "class": "sg-history" },
      SG.ui.h1(t("history.title")),
      profile.rounds.length >= SG.config.HISTORY_LIMIT ? h("div", { "class": "sg-note" }, h("p", null, t("history.trimmed"))) : null,
      list, h("div", { "class": "sg-center" }, more)));
    draw();

    // Coming back from a Board: land on the row that was open (design 5.4).
    var last = SG.app.historyFocus;
    SG.app.historyFocus = null;
    var target = last && list.querySelector('[data-id="' + last + '"]');
    if (target) { root.querySelector("h1").removeAttribute("data-sg-focus"); target.setAttribute("data-sg-focus", ""); }
  }

  return { titleKey: "history.title", render: render };
})();
