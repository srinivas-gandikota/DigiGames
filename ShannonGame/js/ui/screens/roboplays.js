/* Robo plays screen (design 03 section 3.7; GP-086..094, UX-014, UX-025).
 *
 * Params: {record}   (a stored RoundRecord; Play has already saved it. `newBadges` is passed through to the Board.)
 * Robo plays the SAME sentence with the SAME window as the child (SG.model.roboOrder(record.peek)); for a partial
 * round only the letters the child finished. Aligned rows show each character with the child's guess count and
 * Robo's, peeked positions marked. Playback runs one column per SG.config.ROBO_STEP_MS (and never longer than
 * 20 s), can be skipped at any moment, and under calm motion everything appears at once. No win/lose words.
 * Continue -> go("board", {record}).
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.roboplays = (function () {
  "use strict";
  var h = SG.ui.h, t = SG.ui.t;
  var MAX_PLAYBACK_MS = 20000;            // GP-092
  var BIG_GAP = 3;                        // a difference of this many guesses is worth a remark

  /** Characters per block: the same 8 / 12 / 16 as charts.alignedRows would pick, but known here for scrolling. */
  function perBlockFor(sizeClass) { return sizeClass === "desktop" ? 16 : sizeClass === "tablet" ? 12 : 8; }

  /** Robo's guess counts for the first n characters (deterministic, never stored: GP-090). */
  function roboRanks(record, n) {
    var order = SG.model.roboOrder(record.peek, SG.robo.maxOrder);
    return SG.robo.play(record.sentence.slice(0, n), order).ranks;
  }

  /**
   * GP-093: one or two kind remarks about where the two differed most. Peeked positions are skipped (their count
   * is Robo-assisted) and letters are preferred to spaces so "{letter} in {word}" reads naturally.
   * @returns {Array<{index:number, key:string}>} at most two entries
   */
  function pickRemarks(chars, you, robo, revealed) {
    var best = { robo: null, you: null, same: null };       // largest gap each way; first equal letter
    function consider(i, spaceOk) {
      if (revealed[i]) return;
      var d = you[i] - robo[i], isSpace = chars[i] === " ";
      if (isSpace !== spaceOk) return;
      if (d >= BIG_GAP && (!best.robo || d > best.robo.d)) best.robo = { i: i, d: d };
      else if (d <= -BIG_GAP && (!best.you || -d > best.you.d)) best.you = { i: i, d: -d };
      else if (d === 0 && !best.same) best.same = { i: i, d: 0 };
    }
    var pass, i;
    for (pass = 0; pass < 2; pass++) {                      // letters first, spaces only if nothing else qualifies
      for (i = 0; i < chars.length; i++) consider(i, pass === 1);
      if (best.robo || best.you) break;
    }
    var picks = [];
    if (best.robo) picks.push({ index: best.robo.i, key: "roboQuick", d: best.robo.d });
    if (best.you) picks.push({ index: best.you.i, key: "youQuick", d: best.you.d });
    picks.sort(function (a, b) { return b.d - a.d; });
    if (!picks.length && best.same) picks.push({ index: best.same.i, key: "same", d: 0 });
    return picks.slice(0, 2);
  }

  function legendItems(hasPeeked) {
    var items = [0, 1, 2, 3, 4].map(function (b) { return { band: b, label: t("roboPlays.bands.b" + b) }; });
    if (hasPeeked) items.push({ shape: "eye", label: t("roboPlays.legendPeeked") });
    return items;
  }

  function emptyState(root) {
    root.appendChild(h("div", { "class": "sg-rp" },
      SG.ui.h1(t("roboPlays.title")),
      SG.ui.button(t("ui.home"), { kind: "primary", onClick: function () { SG.app.go("home"); } })));
  }

  function render(root, params) {
    var record = params && params.record;
    if (!record || !Array.isArray(record.ranks) || !record.ranks.length || typeof record.sentence !== "string") {
      emptyState(root);
      return;
    }

    var n = record.ranks.length;                                    // a partial round: only what the child finished
    var chars = record.sentence.slice(0, n).split("");
    var you = record.ranks, revealed = (record.revealed || []).slice(0, n);
    while (revealed.length < n) revealed.push(false);
    var robo = roboRanks(record, n);
    var perBlock = perBlockFor(SG.ui.theme.sizeClass());
    var alive = true;
    var calm = SG.ui.theme.isCalm();
    var step = Math.max(10, Math.min(SG.config.ROBO_STEP_MS, Math.floor(MAX_PLAYBACK_MS / n)));   // never past 20 s (GP-092)

    var youTotal = SG.ui.fmt.sum(you), roboTotal = SG.ui.fmt.sum(robo);
    var summary = t("roboPlays.ariaSummary", { you: youTotal, robo: roboTotal });

    /* ---- the chart (rebuilt when a rotation or resize changes the number of columns per block) */
    function makeChart() {
      var c = SG.ui.charts.alignedRows({
        chars: chars, perBlock: perBlock, ariaLabel: summary,
        caption: t("roboPlays.title"),
        rows: [
          { label: t("ui.you"), values: you, bands: SG.info.surpriseBands(you), revealed: revealed },
          { label: t("ui.robo"), values: robo, bands: SG.info.surpriseBands(robo), revealed: null }
        ]
      });
      c.text = [summary];
      return c;
    }
    var chart = makeChart();

    /* ---- parts of the page */
    var roboFig = SG.ui.robo.create("thinking", 72, { layout: "row" });
    var totals = h("p", { "class": "sg-rp-totals", hidden: true },
      h("span", null, t("roboPlays.youTotal", { n: youTotal })), h("span", null, t("roboPlays.roboTotal", { n: roboTotal })));
    var remarksEl = h("div", { "class": "sg-rp-remarks", hidden: true });
    var legend = SG.ui.charts.legend({ items: legendItems(revealed.some(Boolean)) });

    var skipBtn = SG.ui.button(t("ui.skip"), { cls: "sg-btn--pill", onClick: function () { skip(); } });
    var continueBtn = SG.ui.button(t("roboPlays.continue"), { kind: "primary", cls: "sg-btn--pill", onClick: function () {
      SG.app.go("board", { record: record, newBadges: params.newBadges || [] });
    } });
    var aboutBtn = SG.ui.button(t("robo.about.title"), { kind: "link", onClick: showAbout });

    var chartWrap = h("div", { "class": "sg-rp-chart" }, chart.el);
    root.appendChild(h("div", { "class": "sg-rp" },
      h("div", { "class": "sg-rp-head" }, SG.ui.h1(t("roboPlays.title")), h("p", { "class": "sg-muted" }, t("roboPlays.subtitle")), roboFig),
      record.complete === false ? h("p", { "class": "sg-note sg-rp-note" }, t("roboPlays.partialNote")) : null,
      chartWrap,
      totals, remarksEl,
      legend.el,
      SG.ui.charts.disclosure(chart, { picture: chartWrap }),
      h("div", null, aboutBtn),
      h("div", { "class": "sg-bottombar sg-rp-bottom" }, skipBtn, continueBtn)));

    /* ---- playback */
    var timer = null, col = 0, playing = false;

    function relayout() {
      var size = perBlockFor(SG.ui.theme.sizeClass());
      if (!alive || size === perBlock) return;
      perBlock = size;
      var fresh = makeChart();
      chartWrap.replaceChild(fresh.el, chart.el);
      chart = fresh;
      chart.showUpTo(col);                                   // keep the playback position
      if (!playing && col >= n) paintRemarks();
      else if (playing) chart.setActive(col - 1);
    }
    SG.ui.track(SG.ui.theme.onChange(relayout));

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } playing = false; }

    function scrollToColumn(i) {
      var cell = chart.el.querySelector('.sg-acell--letter[data-col="' + i + '"]');
      if (cell && cell.scrollIntoView && i % perBlock === 0) cell.scrollIntoView({ block: "nearest" });
    }

    function tick() {
      col++;
      chart.showUpTo(col);
      chart.setActive(col - 1);
      scrollToColumn(col - 1);
      SG.sound.play("tick");
      if (col >= n) finish();
    }

    function startPlayback() {
      stopTimer();
      col = 0; playing = true;
      chart.showUpTo(0);
      totals.hidden = true; remarksEl.hidden = true;
      roboFig.setMood("thinking");
      roboFig.say(SG.ui.pick("robo.remarks.start"), { mood: "thinking" });
      skipBtn.textContent = t("ui.skip");
      timer = setInterval(tick, step);
    }

    /** Everything shown, numbers unchanged by skipping (GP-092). */
    function showEverything() {
      stopTimer();
      col = n;
      chart.showAll();
      totals.hidden = false;
      paintRemarks();
    }

    function finish() {
      showEverything();
      roboFig.say(SG.ui.pick("robo.remarks.end"), { mood: "happy", silent: true });
      SG.ui.a11y.announce(summary);
      skipBtn.textContent = t(calm ? "roboPlays.stepByStep" : "roboPlays.watchAgain");
      SG.ui.a11y.focus(continueBtn, { preventScroll: true });
    }

    function skip() {
      if (playing) finish();
      else startPlayback();                                  // "Watch again" / "Show step by step"
    }

    function paintRemarks() {
      SG.ui.clear(remarksEl);
      pickRemarks(chars, you, robo, revealed).forEach(function (r) {
        var ch = chars[r.index];
        var text = SG.ui.pick("robo.remarks." + r.key, { letter: SG.ui.fmt.letterName(ch), word: SG.ui.fmt.wordAt(chars.join(""), r.index) });
        chart.el.querySelectorAll('[data-col="' + r.index + '"]').forEach(function (c) { c.classList.add("is-remark"); });
        remarksEl.appendChild(h("div", { "class": "sg-rp-remark" }, SG.ui.robo.create("happy", 48, { bubble: false }), h("p", { "class": "sg-bubble" }, text)));
      });
      remarksEl.hidden = !remarksEl.firstChild;
    }

    function onKey(e) {
      if (!playing || SG.ui.dialogs.isOpen()) return;
      if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); finish(); }     // design 3.7: Esc / Enter skip
    }
    SG.ui.on(document, "keydown", onKey);

    function showAbout() {
      var body = h("div", null, h("p", null, t("robo.about.p1")), h("p", null, t("robo.about.p2")), h("p", null, t("robo.about.p3")));
      SG.ui.dialogs.choose({
        title: t("robo.about.title"), body: body, mood: "happy",
        buttons: [{ id: "ok", label: t("robo.about.close"), primary: true }], safeId: "ok"
      });
    }

    if (calm) {                         // calm motion: all at once, with a way to watch step by step (design 1.5)
      finish();
    } else {
      startPlayback();
      SG.ui.a11y.focus(skipBtn, { preventScroll: true });
    }

    return function () { alive = false; stopTimer(); };
  }

  return { titleKey: "roboPlays.title", render: render };
})();
