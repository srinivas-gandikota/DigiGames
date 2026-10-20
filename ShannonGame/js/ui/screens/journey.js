/* My Journey: a gentle diary of the child's own rounds (DB-094..104, UX-047). Params: none.
 *
 * Everything comes from profile.rounds (the same rounds History shows, DB-103) and the stored small numbers in
 * each record's `stats`; nothing leaves the device. Every number follows the Board's honest-number rules
 * (DB-102): "about", one decimal, never above 4.75. No scores, no streaks, no leaderboards (UX-024, UX-027).
 *
 * Sections: entropy over time (one series at a time, never averaged across kinds, DB-095) with Robo's companion
 * line (DB-097) and a trend sentence only from 6 rounds and a 0.3 bit change (DB-096); best rounds per tier
 * (DB-098); concepts (DB-099); Peephole panel (DB-100); Bit Detective panel (DB-101); "My discoveries" badges.
 * Replays and partial rounds are left out unless the child turns the switch on (DB-104).
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.journey = (function () {
  "use strict";
  var h = SG.ui.h, t = SG.ui.t, fmt = SG.ui.fmt, charts = SG.ui.charts;
  var lib = SG.screens.board.lib;
  var HMAX = SG.alphabet.HMAX;
  var FILTERS = ["easy", "medium", "hard", "gibberish", "peephole", "twoPlayer"];
  var TIERS = ["easy", "medium", "hard", "gibberish"];
  var MAX_POINTS = 40;        // a chart of more than this many points cannot be read on a phone; the trend still uses every round
  var PAGE = 8;               // rows of the "rounds in this view" list shown at a time

  /* ---------------------------------------------------------------- choosing the rounds of one series */

  /** Which filter a round belongs to: Classic rounds by tier, Peephole and Two-player by mode. */
  function inSeries(rec, filter) {
    if (filter === "peephole") return rec.mode === "peephole";
    if (filter === "twoPlayer") return rec.mode === "twoPlayer";
    return rec.mode === "classic" && rec.tier === filter;
  }

  function usable(rec, includeAll) {
    if (!rec || !rec.ranks || !rec.ranks.length || !lib.statsOf(rec)) return false;
    return includeAll ? true : lib.isPlain(rec);
  }

  /** Rounds of one series, oldest first (storage order is already chronological; ts breaks any tie). */
  function seriesRounds(profile, filter, includeAll) {
    return (profile.rounds || []).filter(function (r) { return inSeries(r, filter) && usable(r, includeAll); })
      .map(function (r, i) { return { r: r, i: i }; })
      .sort(function (a, b) { return ((a.r.ts || 0) - (b.r.ts || 0)) || (a.i - b.i); })
      .map(function (x) { return x.r; });
  }

  /** The filter to open on: the kind of the most recent round, else the first kind that has rounds, else Easy. */
  function defaultFilter(profile) {
    var rounds = profile.rounds || [];
    for (var i = rounds.length - 1; i >= 0; i--) {
      for (var f = 0; f < FILTERS.length; f++) if (inSeries(rounds[i], FILTERS[f])) return FILTERS[f];
    }
    return FILTERS[0];
  }

  function mean(list) { return list.length ? fmt.sum(list) / list.length : 0; }

  /** A12c / DB-096: "down" / "up" / "steady", or null while there are fewer than TREND_MIN rounds. */
  function trendKind(rounds) {
    if (rounds.length < SG.config.TREND_MIN) return null;
    var mids = rounds.map(function (r) { return lib.statsOf(r).mid; });
    var first = mean(mids.slice(0, 3)), last = mean(mids.slice(-3));
    if (last <= first - SG.config.TREND_DELTA) return "down";
    if (last >= first + SG.config.TREND_DELTA) return "up";
    return "steady";
  }

  /* ---------------------------------------------------------------- pieces */

  function section(title, id) {
    return h("section", { "class": "sg-card sgj-section", "aria-labelledby": id }, h("h2", { id: id }, title));
  }

  function openBoard(rec, extra) {
    SG.app.go("board", Object.assign({ recordId: rec.id, from: "journey" }, extra || {}));
  }

  function roundChips(rec) {
    var out = [];
    if (rec.mode === "peephole") out.push(h("span", { "class": "sg-chip" }, rec.peek == null ? t("board.header.peekAll") : t("board.header.peek", { k: rec.peek })));
    if (rec.complete === false) out.push(h("span", { "class": "sg-chip sg-chip--tag" }, t("history.tags.partial")));
    if (rec.replay) out.push(h("span", { "class": "sg-chip sg-chip--tag" }, t("history.tags.replay")));
    return out;
  }

  function emptyBox(text, buttonLabel, onClick) {
    return h("div", { "class": "sgj-empty" }, SG.ui.robo.create("neutral", 72, { layout: "stack", bubble: false }), h("p", null, text),
      buttonLabel ? SG.ui.button(buttonLabel, { kind: "primary", onClick: onClick }) : null);
  }

  /* ---------------------------------------------------------------- entropy over time */

  function chartLabels(count) {
    var every = Math.max(1, Math.ceil(count / 8));
    var out = [];
    for (var i = 0; i < count; i++) out.push(i % every === 0 || i === count - 1 ? String(i + 1) : "");
    return out;
  }

  function buildChart(rounds) {
    var shown = rounds.slice(-MAX_POINTS);
    var labels = chartLabels(shown.length);
    var you = [], robo = [];
    shown.forEach(function (r, i) {
      var st = lib.statsOf(r);
      you.push({ x: i, y: st.mid, lo: st.low, hi: st.up });
      robo.push({ x: i, y: st.roboMid });
    });
    return charts.lineChart({
      xCats: shown.map(function (r, i) { return { key: i, label: labels[i] }; }),
      yDomain: [0, HMAX], height: 280,
      series: [
        { id: "robo", shape: "square", style: "light", label: t("journey.chart.roboShort"), points: robo },
        { id: "you", shape: "circle", style: "main", label: t("journey.chart.yourLine"), points: you }
      ],
      ariaLabel: t("journey.chart.title"), caption: t("journey.chart.title")
    });
  }

  /** The "Rounds in this view" list; each row reopens that round's Board. */
  function roundList(rounds) {
    var shown = PAGE;
    var list = h("div", { "class": "sgj-rows" });
    var more = SG.ui.button(t("ui.more"), { cls: "sg-btn--pill", onClick: function () { shown += PAGE; draw(); } });
    function row(rec) {
      var st = lib.statsOf(rec);
      var btn = h("button", { type: "button", "class": "sgj-row" },
        rec.complete !== false ? h("span", { "class": "sgj-row-sentence" }, rec.sentence) : null,
        h("span", { "class": "sgj-row-meta" }, fmt.date(rec.ts), t("board.bitsPerLetter", { mid: lib.bitsStr(st.mid) }), roundChips(rec), t("journey.openBoard")));
      btn.addEventListener("click", function () { openBoard(rec); });
      return btn;
    }
    function draw() {
      SG.ui.clear(list);
      rounds.slice().reverse().slice(0, shown).forEach(function (r) { list.appendChild(row(r)); });
      more.hidden = rounds.length <= shown;
    }
    draw();
    return h("div", { "class": "sg-stack" }, h("h3", null, t("journey.roundsList.title")), list, h("div", { "class": "sg-center" }, more));
  }

  function buildOverTime(profile) {
    var sec = section(t("journey.chart.title"), "sgj-time-h");
    var state = { filter: defaultFilter(profile), includeAll: false };
    var buttons = FILTERS.map(function (f) {
      var b = SG.ui.button(t("journey.filters." + f), { cls: "sg-btn--pill", attrs: { "aria-pressed": "false", "data-filter": f } });
      b.addEventListener("click", function () { state.filter = f; draw(); });
      return b;
    });
    var toggle = SG.ui.button(t("journey.filters.includeExtra"), { cls: "sg-btn--pill", attrs: { "aria-pressed": "false" } });
    toggle.addEventListener("click", function () { state.includeAll = !state.includeAll; draw(); });
    var out = h("div", { "class": "sg-stack" });
    sec.appendChild(h("div", { "class": "sgj-filters", role: "group", "aria-label": t("journey.filters.title") }, buttons));
    sec.appendChild(h("div", { "class": "sgj-switch" }, toggle));
    sec.appendChild(out);

    function draw() {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filter") === state.filter ? "true" : "false"); });
      toggle.setAttribute("aria-pressed", state.includeAll ? "true" : "false");
      SG.ui.clear(out);
      var rounds = seriesRounds(profile, state.filter, state.includeAll);
      if (!rounds.length) {
        out.appendChild(emptyBox(profile.rounds.length ? t("journey.filters.empty") : t("journey.empty")));
        return;
      }
      var box = h("div", { "class": "sgj-chartbox" });
      out.appendChild(box);
      var chart = buildChart(rounds);
      charts.mount(box, chart);
      if (rounds.length > MAX_POINTS) out.appendChild(h("p", { "class": "sg-muted" }, t("journey.chart.latest", { n: MAX_POINTS })));
      out.appendChild(h("p", { "class": "sg-muted" }, t("journey.chart.xLabel") + ". " + t("journey.chart.roboLine")));
      var kind = trendKind(rounds);
      out.appendChild(h("p", { "class": "sgj-trend" }, t(kind ? "journey.trend." + kind : "journey.trend.tooEarly")));
      if (kind) out.appendChild(h("p", { "class": "sg-muted" }, t("journey.trend.caveat")));
      out.appendChild(charts.disclosure(chart));
      out.appendChild(roundList(rounds));
    }
    draw();
    return sec;
  }

  /* ---------------------------------------------------------------- best rounds */

  function bestRounds(profile, tier) {
    return (profile.rounds || []).filter(function (r) {
      return lib.isPlain(r) && r.tier === tier && r.mode !== "twoPlayer" && lib.statsOf(r);
    }).sort(function (a, b) { return (lib.statsOf(a).mid - lib.statsOf(b).mid) || ((b.ts || 0) - (a.ts || 0)); }).slice(0, 3);
  }

  function buildBest(profile) {
    var sec = section(t("journey.best.title"), "sgj-best-h");
    var any = false;
    TIERS.forEach(function (tier) {
      var best = bestRounds(profile, tier);
      if (!best.length) return;
      any = true;
      var rows = best.map(function (r) {
        var st = lib.statsOf(r);
        var btn = h("button", { type: "button", "class": "sgj-row" },
          h("span", { "class": "sgj-row-sentence" }, t("journey.best.row", { sentence: r.sentence, mid: lib.bitsStr(st.mid) })),
          h("span", { "class": "sgj-row-meta" }, fmt.date(r.ts), roundChips(r),
            st.totalGuesses < st.roboTotal ? h("span", { "class": "sg-chip" }, SG.ui.icon("check", { size: 14 }), t("journey.best.beatRobo")) : null));
        btn.addEventListener("click", function () { openBoard(r); });
        return btn;
      });
      sec.appendChild(h("div", { "class": "sgj-tier" }, h("h3", null, t("setup.tiers." + tier + ".name")), h("div", { "class": "sgj-rows" }, rows)));
    });
    if (!any) sec.appendChild(h("p", { "class": "sg-muted" }, t("journey.best.none")));
    sec.appendChild(h("p", { "class": "sg-muted" }, t("journey.best.caption")));
    return sec;
  }

  /* ---------------------------------------------------------------- concepts, Peephole, Bit Detective, badges */

  function buildConcepts(profile) {
    var sec = section(t("journey.concepts.title"), "sgj-concepts-h");
    var latest = null;
    (profile.rounds || []).forEach(function (r) { if (r.ranks && r.ranks.length) latest = r; });
    var rows = lib.CARDS.map(function (id, i) {
      var c = profile.cards[id] || {};
      var state = c.gotIt ? "gotIt" : c.opened > 0 ? "opened" : "notOpened";
      var icon = state === "gotIt" ? SG.ui.icon("star", { size: 18 }) : state === "opened" ? SG.ui.icon("check", { size: 18 }) : h("span", { "class": "sgb-dot", "aria-hidden": "true" });
      var b = h("button", { type: "button", "class": "sgj-concept" + (state === "gotIt" ? " is-gotit" : ""), "data-card": id, disabled: !latest },
        h("span", { "class": "sgb-rail-num" }, String(i + 1)),
        h("span", { "class": "sgj-concept-title" }, t("board.cards." + id + ".title")),
        h("span", { "class": "sgj-concept-state" }, icon, t("journey.concepts." + state)));
      b.addEventListener("click", function () { if (latest) openBoard(latest, { card: id }); });
      return b;
    });
    sec.appendChild(h("div", { "class": "sgj-concepts" }, rows));
    return sec;
  }

  function buildPeephole(profile) {
    var sec = section(t("journey.peepholePanel.title"), "sgj-peep-h");
    var groups = {}, keys = [];
    (profile.rounds || []).forEach(function (r) {
      if (r.mode !== "peephole" || !lib.isPlain(r)) return;
      var st = lib.statsOf(r);
      if (!st) return;
      var k = r.peek == null ? "all" : r.peek;
      if (!groups[k]) { groups[k] = { k: k, tot: 0, n: 0 }; keys.push(k); }
      groups[k].tot += st.mid; groups[k].n++;
    });
    if (!keys.length) {
      sec.appendChild(emptyBox(t("journey.peepholePanel.empty"), t("board.cards.context.curve.tryPeephole"), function () { SG.app.go("setup", { mode: "peephole" }); }));
      return sec;
    }
    keys.sort(function (a, b) { return (a === "all" ? 99 : a) - (b === "all" ? 99 : b); });
    sec.appendChild(h("ul", { "class": "sg-stack" }, keys.map(function (k) {
      var g = groups[k];
      return h("li", { "class": "sgj-panel-row" }, lib.pl("journey.peepholePanel.row", g.n, { k: k === "all" ? t("board.cards.context.curve.all") : k, mid: lib.bitsStr(g.tot / g.n), n: g.n }));
    })));
    sec.appendChild(h("p", { "class": "sg-muted" }, t("journey.best.caption")));
    return sec;
  }

  function buildDetective(profile) {
    var sec = section(t("journey.detectivePanel.title"), "sgj-det-h");
    var cases = profile.detective || [];
    if (!cases.length) {
      sec.appendChild(emptyBox(t("journey.detectivePanel.empty"), t("journey.detectivePanel.play"), function () { SG.app.go("detective"); }));
      return sec;
    }
    var avg = fmt.sum(cases.map(function (c) { return c.questions; })) / cases.length;
    sec.appendChild(h("p", { "class": "sgj-panel-row" }, lib.pl("journey.detectivePanel.row", cases.length, { n: cases.length, avg: fmt.avg1(avg), max: lib.HMAX_TXT })));
    return sec;
  }

  function buildBadges(profile) {
    var sec = section(t("badges.title"), "sgj-badges-h");
    sec.appendChild(h("p", { "class": "sg-muted" }, t("badges.intro")));
    var cards = SG.badges.ALL.map(function (b) {
      var info = (SG.copy.badges && SG.copy.badges[b.id]) || b;
      var ts = profile.badges && profile.badges[b.id];
      var earned = ts != null;
      return h("div", { "class": "sgj-badge" + (earned ? "" : " is-locked"), "data-badge": b.id },
        h("span", { "class": "sgj-badge-icon", "aria-hidden": "true" }, info.emoji || b.emoji || ""),
        h("div", null,
          h("h3", null, info.name || b.name),
          h("p", null, info.how || b.how),
          h("p", { "class": "sgj-badge-state" }, SG.ui.icon(earned ? "check" : "lock", { size: 16 }),
            earned ? t("badges.earned", { date: fmt.date(ts) || "" }) : t("badges.notYet"))));
    });
    sec.appendChild(h("div", { "class": "sgj-badges" }, cards));
    return sec;
  }

  /* ---------------------------------------------------------------- screen */

  function render(root) {
    var profile = SG.app.profile;
    if (!profile.cards) profile.cards = {};
    root.appendChild(h("div", { "class": "sgj" },
      h("header", { "class": "sgj-head" },
        SG.ui.h1(t("journey.title")),
        h("p", { "class": "sg-muted" }, t("journey.intro")),
        h("p", null, t("journey.roundsPlayed", { n: (profile.rounds || []).length }))),
      buildOverTime(profile), buildBest(profile), buildConcepts(profile), buildPeephole(profile), buildDetective(profile), buildBadges(profile),
      h("div", { "class": "sgj-actions" },
        SG.ui.button(t("home.tiles.history.name"), { onClick: function () { SG.app.go("history"); } }),
        SG.ui.button(t("journey.reset"), { onClick: function () { SG.app.go("settings"); } }))));
  }

  return { titleKey: "journey.title", render: render };
})();
