/* The Discovery Board: nine concept cards built from one round (docs/requirements/04-discovery-board.md).
 *
 * Params: {record} (play -> roboplays -> board) or {recordId} (History, Journey); optional {card: cardId}
 * to open on that card and {from: "journey"} so the back link goes to the right place.
 *
 * Shape of the screen
 *   header   sentence, mode/tier chips, counts, partial / replay / rough tags, "Why 'about'?"   (DB-003, 018, 019, 080, 082)
 *   controls one card at a time (default) | show all | quick view                                  (DB-010, UX-040, UX-041)
 *   cards    nine, fixed order. Each card = Layer 1 picture + Layer 2 wonder line + Grown-up corner (DB-002, DB-004)
 *   after    Next sentence, Play this again, Change mode, Home, My Journey                         (DB-015, GP-116)
 *
 * Rules this file keeps (so a future edit does not break them):
 *   - Every number comes from ONE summary S = SG.info.summarize(record, SG.robo, corpusCurve) (DB-014). Nothing is
 *     random: even the Layer 2 line rotates by how often the card was opened before, not by Math.random.
 *   - Bits are written with bitsStr(): half-up, one decimal, and anything that would round above the maximum is
 *     written 4.75 (DB-016). Sizes use the exact log2(27).
 *   - Formal terms live only inside the Grown-up corner (DB-008). Corners start collapsed on every Board (UX-043).
 *   - The Magic Twin is handed only Robo's numbers; the sentence is never given to it (DB-053).
 *   - Cards never claim a pattern their data does not show (DB-020): wording is chosen from the data, with a
 *     neutral fallback. The Gibberish story is used only when the child's own numbers support it (DB-086).
 *   - Every picture has "Show as words" (DB-009). Colour is always paired with a number, size, shape or hatch.
 *
 * SG.screens.board.lib exposes a few pure helpers (bitsStr, statsOf, ...) that the Journey screen reuses.
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.board = (function () {
  "use strict";
  var h = SG.ui.h, t = SG.ui.t, fmt = SG.ui.fmt, charts = SG.ui.charts;

  var CARDS = ["surprise", "bit", "entropy", "context", "redundancy", "twin", "enough", "squeeze", "robo"];
  var HMAX = SG.alphabet.HMAX;
  var HMAX_TXT = fmt.bits2(HMAX);              // "4.75": the maximum is always written like this (DB-016)
  var TWIN_MAX_MS = 20000;                     // the Twin replay never takes longer than this (DB-056)
  // Thresholds that decide which sentence a card may say (DB-020). They only select wording; no number shown depends on them.
  var GIB_HIGH = 3.2;       // bits per letter: "well above an ordinary round" (a random 25-30 letter sample gives about 3.7)
  var GIB_FADE_MAX = 0.30;  // Gibberish "almost nothing was predictable" needs redundancy at or below this
  var GIB_SURPRISE = 0.6;   // share of letters in the two warmest bands for "almost every letter was a surprise"
  var GIB_ONES = 0.25;      // fewer 1s than this share of Robo's numbers: "few 1s"
  var FIRST_GAP = 0.3;      // guesses: first letters must be this much harder (or easier) than later ones to say so
  var THIN_N = 10;          // fewer letters than this: the "very short sentence" notes appear
  var EASY_SHARE = 0.6, HARD_SHARE = 0.3;   // share of letters needing 1 or 2 guesses: easy / hard summary line

  /* ================================================================ pure helpers (shared with Journey) */

  /** Bits per letter for display: one decimal, half-up, never above the written maximum (DB-016, DB-093). */
  /** Entropy estimates: capped at the 4.75 maximum, half-up (shared rule lives in SG.ui.fmt.est). */
  function bitsStr(x) { return fmt.est(x); }

  var statsCache = {};
  /** The stored small numbers of a round, or the same numbers recomputed (older / hand-made records). */
  function statsOf(rec) {
    if (!rec) return null;
    if (rec.stats && isFinite(rec.stats.mid)) return rec.stats;
    if (rec.id != null && statsCache[rec.id]) return statsCache[rec.id];
    var st = null;
    try { st = SG.info.summaryStats(SG.info.summarize(rec, SG.robo, null)); } catch (e) { st = null; }
    if (rec.id != null) statsCache[rec.id] = st;
    return st;
  }

  /** A completed round that is not a replay: the kind that feeds charts and trends by default. */
  function isPlain(rec) { return !!rec && rec.complete !== false && !rec.replay; }

  function sum(a) { return fmt.sum(a || []); }

  /** Copy with a singular twin: uses `<key>One` when n is exactly 1 and that key exists ("1 letter", not "1 letters"). */
  function pl(key, n, vars) {
    return t(n === 1 && SG.ui.has(key + "One") ? key + "One" : key, vars);
  }
  function countIf(a, fn) { var n = 0; for (var i = 0; i < a.length; i++) if (fn(a[i], i)) n++; return n; }
  function share(a, fn) { return a.length ? countIf(a, fn) / a.length : 0; }

  function resolveRecord(profile, params) {
    if (params.record) return params.record;
    var rounds = profile.rounds || [];
    for (var i = rounds.length - 1; i >= 0; i--) if (rounds[i].id === params.recordId) return rounds[i];
    return null;
  }

  /* ---------------------------------------------------------------- places in the sentence (for kid wording) */

  function isSpace(S, i) { return S.sentence.charAt(i) === " "; }

  /** First position (earliest on ties) with the best score among the allowed ones; -1 if none. */
  function bestPos(S, allowed, score) {
    var best = -1, bestScore = -Infinity;
    for (var i = 0; i < S.n; i++) {
      if (allowed && !allowed(i)) continue;
      var sc = score(i);
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    return best;
  }

  function notSpace(S) { return function (i) { return !isSpace(S, i); }; }

  /** {letter, word, g} for a position, or {} so that pool lines which need them are skipped. */
  function spotVars(S, i) {
    if (i == null || i < 0 || i >= S.n) return {};
    return { letter: fmt.letterName(S.sentence.charAt(i)), word: fmt.wordAt(S.sentence, i), g: S.ranks[i] };
  }

  /** Spot for each card's personalised Layer 2 line, chosen from the child's own round. */
  function spotFor(S, id) {
    var ns = notSpace(S);
    var hardest = bestPos(S, ns, function (i) { return S.ranks[i]; });
    if (id === "context") {
      var firstOfWord = bestPos(S, function (i) { return ns(i) && !S.revealed[i] && (i === 0 || isSpace(S, i - 1)); }, function (i) { return S.ranks[i]; });
      return firstOfWord >= 0 ? firstOfWord : hardest;
    }
    if (id === "redundancy" || id === "squeeze") {
      return bestPos(S, function (i) { return ns(i) && !S.revealed[i] && S.ranks[i] === 1; }, function () { return 0; });
    }
    if (id === "twin") return bestPos(S, ns, function (i) { return S.robo.ranks[i]; });
    if (id === "robo") {
      var gap = bestPos(S, function (i) { return ns(i) && !S.revealed[i] && S.ranks[i] !== S.robo.ranks[i]; },
        function (i) { return Math.abs(S.ranks[i] - S.robo.ranks[i]); });
      return gap >= 0 ? gap : hardest;
    }
    return hardest;
  }

  /* ---------------------------------------------------------------- what the data supports (DB-020, DB-086) */

  function gibberishStory(B, id) {
    var S = B.S;
    if (B.record.tier !== "gibberish") return false;
    var mid = S.bounds.mid;
    switch (id) {
      case "surprise": return share(S.bands, function (b) { return b >= 3; }) >= GIB_SURPRISE;
      case "bit": case "entropy": case "squeeze": return mid >= GIB_HIGH;
      case "context": case "enough": return !!S.lookBack.flat;
      case "redundancy": return S.redundancy <= GIB_FADE_MAX;
      case "twin": return share(S.twin.numbers, function (g) { return g === 1; }) < GIB_ONES;
      case "robo": return S.vs.verdict === "even" && mid >= GIB_HIGH && S.robo.bounds.mid >= GIB_HIGH;
      default: return false;
    }
  }

  /** first-letters vs later-letters comparison of the Context card: "higher" | "same" | "lower" | null (not enough). */
  function firstVsLater(S) {
    var wp = S.wordPos;
    if (wp.first.avg == null) return null;
    var tot = 0, cnt = 0;
    ["second", "third", "fourthPlus"].forEach(function (k) {
      if (wp[k].avg != null) { tot += wp[k].avg * wp[k].count; cnt += wp[k].count; }
    });
    if (!cnt) return null;
    var later = tot / cnt, diff = wp.first.avg - later;
    return { first: wp.first.avg, later: later, kind: diff >= FIRST_GAP ? "higher" : diff <= -FIRST_GAP ? "lower" : "same" };
  }

  function roughReasons(B) {
    var S = B.S, out = [];
    if (B.record.complete === false) out.push("partial");
    if (S.n < SG.config.ROUGH_N) out.push("short");
    if (share(S.revealed, Boolean) > SG.config.ROUGH_REVEALED) out.push("revealed");
    return out;
  }

  var REASON_KEY = { partial: "board.rough.partial", short: "board.rough.shortSentence", revealed: "board.rough.manyRevealed" };

  /** The "estimate" chip, plus the "rough" chip with its reason when the Board is rough (DB-016, DB-018). */
  function estimateTags(B) {
    var tags = [h("span", { "class": "sg-chip" }, t("board.estimate"))];
    var why = roughReasons(B);
    if (B.S.rough || why.length) {
      tags.push(h("span", { "class": "sg-chip sg-chip--tag" }, t("board.rough.tag") + ": " + why.map(function (r) { return t(REASON_KEY[r]); }).join(", ")));
    }
    return h("span", { "class": "sgb-tags" }, tags);
  }

  /* ---------------------------------------------------------------- the child's own history (Context / Enough) */

  /** Peephole results are plotted per look-back; Classic rounds sit at "all" (DB-040). k above Robo's longest is drawn at Robo's longest. */
  function plotKey(rec) {
    if (rec.mode !== "peephole" || rec.peek == null) return "all";
    return Math.min(rec.peek, SG.robo.maxOrder);
  }

  function ownEligible(rec) {
    return isPlain(rec) && (rec.mode === "peephole" || (rec.mode === "classic" && rec.tier !== "gibberish"));
  }

  /** Rounds that count as the child's own points: stored plain rounds plus this one if it qualifies. */
  function ownRounds(B) {
    var list = (B.profile.rounds || []).filter(ownEligible);
    var r = B.record;
    if (ownEligible(r) && !list.some(function (x) { return x.id === r.id; })) list.push(r);
    return list;
  }

  /** {groups:[{x, mid, lo, hi, n, mine}], hasPeephole} averaged per plotted look-back (DB-040). */
  function ownPoints(B) {
    var rounds = ownRounds(B);
    var hasPeephole = rounds.some(function (r) { return r.mode === "peephole"; });
    var groups = {}, order = [];
    if (hasPeephole) {
      rounds.forEach(function (r) {
        var st = statsOf(r);
        if (!st) return;
        var key = String(plotKey(r));
        var g = groups[key] || (groups[key] = { x: plotKey(r), mid: 0, lo: 0, hi: 0, n: 0, mine: false });
        if (!groups[key].n) order.push(key);
        g.mid += st.mid; g.lo += st.low; g.hi += st.up; g.n++;
        if (r.id === B.record.id) g.mine = true;
      });
    }
    var list = order.map(function (k) {
      var g = groups[k];
      return { x: g.x, mid: g.mid / g.n, lo: g.lo / g.n, hi: g.hi / g.n, n: g.n, mine: g.mine };
    });
    list.sort(function (a, b) { return xRank(a.x) - xRank(b.x); });
    return { hasPeephole: hasPeephole, groups: list };
  }

  function xRank(x) { return x === "all" ? 99 : x; }

  /** Hedged pattern sentence from points at two or more different looks-back (DB-043); null otherwise. */
  function ownPattern(points) {
    var g = points.groups;
    if (g.length < 2) return null;
    var diff = g[0].mid - g[g.length - 1].mid;     // fewer bits with more peeking = positive
    var kind = diff >= SG.config.TREND_DELTA ? "down" : diff <= -SG.config.TREND_DELTA ? "up" : "flat";
    return kind;
  }

  /** Average bits of the child's other Classic rounds, for the Peephole comparison note (DB-088). */
  function classicAverage(B) {
    var rounds = (B.profile.rounds || []).filter(function (r) {
      return isPlain(r) && r.mode === "classic" && r.tier !== "gibberish" && r.id !== B.record.id;
    });
    var tot = 0, n = 0;
    rounds.forEach(function (r) { var st = statsOf(r); if (st) { tot += st.mid; n++; } });
    return n ? tot / n : null;
  }

  /** The latest finished ordinary round, for the Gibberish comparison (DB-087). */
  function latestOrdinary(B) {
    var rounds = B.profile.rounds || [];
    for (var i = rounds.length - 1; i >= 0; i--) {
      var r = rounds[i];
      if (r.id !== B.record.id && r.complete !== false && r.tier !== "gibberish" && r.mode !== "twoPlayer" && statsOf(r)) return r;
    }
    return null;
  }

  /* ================================================================ small DOM pieces */

  function para(cls, text) { return h("p", { "class": cls }, text); }

  /** Layer 2 line. The pool rotates with how often this card was opened before, never at random (DB-014). */
  function pickLine(B, id, vars, allowed, gibberish) {
    var key = "board.cards." + id + "." + (gibberish ? "gibberish.layer2" : "layer2");
    var pool = SG.ui.raw(key) || [];
    var usable = [];
    pool.forEach(function (tpl, i) {
      if (allowed && allowed.indexOf(i) < 0) return;
      if (/\{([A-Za-z0-9]+)\}/.test(tpl) && needsMissing(tpl, vars)) return;
      usable.push(i);
    });
    if (!usable.length) return gibberish ? pickLine(B, id, vars, allowed, false) : null;
    return t(key + "." + usable[(B.rot[id] || 0) % usable.length], vars);
  }

  function needsMissing(tpl, vars) {
    var re = /\{([A-Za-z0-9]+)\}/g, m;
    while ((m = re.exec(tpl)) !== null) if (vars[m[1]] == null) return true;
    return false;
  }

  /** Make a small icon + label chip. */
  function chip(text, opts) {
    opts = opts || {};
    return h("span", { "class": "sg-chip" + (opts.tag ? " sg-chip--tag" : "") }, opts.icon ? SG.ui.icon(opts.icon, { size: 14 }) : null, text);
  }

  /**
   * The "Show as words" panel: sentences + every table (UX-057, DB-009). The elements in `pics` are hidden
   * while the words show, so a reader gets one or the other, never both at once.
   */
  function wordsToggle(words, pics) {
    var box = charts.disclosure({ text: words.text, table: words.tables[0] || null });
    var panel = box.querySelector(".sg-words-panel");
    var btn = box.querySelector("button");
    words.tables.slice(1).forEach(function (tb) { panel.appendChild(charts.tableEl(tb)); });
    btn.addEventListener("click", function () {      // runs after the toolkit's own handler, which has already flipped aria-expanded
      var open = btn.getAttribute("aria-expanded") === "true";
      (pics || []).forEach(function (el) { el.hidden = open; });
    });
    return box;
  }

  /** Collect text sentences and tables from describe() plus the pictures' own alternatives. */
  function collectWords(B, id, extras, dctx) {
    var d = charts.describe(id, B.S, B.record, dctx || {});
    var words = { text: d.text.slice(), tables: d.table ? [d.table] : [] };
    (extras || []).forEach(function (x) {
      if (!x) return;
      if (x.text) x.text.forEach(function (line) { words.text.push(line); });
      if (x.table && x.table.rows && x.table.rows.length) words.tables.push(x.table);
    });
    return words;
  }

  /** Mount an SVG chart into `box` so it follows the box width; remembered so a card shown later can refit. */
  function mountChart(cc, box, chart) {
    charts.mount(box, chart);
    cc.charts.push({ box: box, chart: chart });
    return chart;
  }

  function refit(cc) {
    cc.charts.forEach(function (c) {
      var w = c.box.clientWidth;
      if (w && Math.abs(w - c.chart.width) > 1) c.chart.update({ width: w });
    });
  }

  /** The visually quiet list under a chart ("1st letter: 2.4 guesses (12 letters)"). */
  function plainList(lines, cls) {
    return h("ul", { "class": "sgb-list " + (cls || "") }, lines.map(function (l) { return h("li", null, l); }));
  }

  /* ================================================================ card 1: surprise */

  function mostPositions(S) {
    var max = 0, out = [];
    S.ranks.forEach(function (g) { if (g > max) max = g; });
    S.ranks.forEach(function (g, i) { if (g === max && out.length < 3) out.push(i); });
    return out;
  }

  function placeText(S, i, key, extra) {
    var sp = isSpace(S, i);
    var base = "board.cards.surprise.";
    var useKey = sp && SG.ui.has(base + key + "Space") ? key + "Space" : key;
    var v = spotVars(S, i);
    if (extra) Object.keys(extra).forEach(function (k) { v[k] = extra[k]; });
    return pl(base + useKey, v.g, v);
  }

  function mostText(S) {
    return mostPositions(S).map(function (i) {
      return placeText(S, i, S.revealed[i] ? "mostItemPeeked" : "mostItem");
    }).join("; ");
  }

  /** DB-024: longest run of first-try letters (2+, earliest on ties), else the first first-try letter, else the lowest count. */
  function leastText(S) {
    var bestStart = -1, bestLen = 0, runStart = -1, runLen = 0, firstTry = -1, i;
    for (i = 0; i < S.n; i++) {
      if (S.ranks[i] === 1 && !S.revealed[i]) {
        if (firstTry < 0) firstTry = i;
        if (runLen === 0) runStart = i;
        runLen++;
        if (runLen > bestLen) { bestLen = runLen; bestStart = runStart; }
      } else runLen = 0;
    }
    if (bestLen >= 2) return placeText(S, bestStart, "leastRun", { n: bestLen });
    if (firstTry >= 0) return placeText(S, firstTry, "leastFirst");
    var low = bestPos(S, null, function (j) { return -S.ranks[j]; });
    return low >= 0 ? placeText(S, low, "leastLowest") : "";
  }

  function surpriseLegend() {
    return charts.legend({ items: [
      { band: 0, label: t("board.legend.b1") }, { band: 1, label: t("board.legend.b2") }, { band: 2, label: t("board.legend.b3") },
      { band: 3, label: t("board.legend.b4") }, { band: 4, label: t("board.legend.b5") },
      { shape: "eye", label: t("board.legend.peeked") }, { swatchClass: "sgb-sw-space", label: t("board.legend.space") }
    ] });
  }

  function buildSurprise(B) {
    var S = B.S, c = "board.cards.surprise.";
    var tapNote = h("p", { "class": "sgb-tapnote sgb-secondary", role: "status", "aria-live": "polite" }, t(c + "tapHint"));
    var tiles = charts.sentenceTiles({
      chars: S.sentence, bands: S.bands, ranks: S.ranks, revealed: S.revealed, roboRanks: S.robo.ranks, mode: "surprise",
      ariaLabel: t(c + "title"), caption: t(c + "title"),
      onSelect: function (i, info) {
        tapNote.textContent = t(c + "tapTitle", spotVars(S, i)) + " " +
          t(info.revealed ? c + "tapCountsPeeked" : c + "tapCounts", { you: info.rank, robo: info.roboRank });
      }
    });
    var legend = surpriseLegend();
    var gib = gibberishStory(B, "surprise");
    var callouts = h("ul", { "class": "sgb-callouts" },
      h("li", null, h("strong", null, t(c + "most")), " ", mostText(S)),
      h("li", null, h("strong", null, t(c + "least")), " ", leastText(S)));
    var pic = h("div", { "class": "sgb-pic" }, tiles.el, legend.el, tapNote);
    var l1 = h("div", { "class": "sgb-l1-body" },
      gib ? para("sgb-headline", t(c + "gibberish.line")) : null,
      pic, callouts,
      S.n < 3 ? para("sgb-note-line sgb-secondary", t(c + "thin")) : null);
    var sp = spotFor(S, "surprise");
    return {
      l1: l1, pics: [pic], words: collectWords(B, "surprise", []),
      l2: pickLine(B, "surprise", spotVars(S, sp), [0, 1, 2, 3, 4], gib),
      cornerVars: { max: HMAX_TXT }
    };
  }

  /* ================================================================ card 2: bit */

  /** The halving path for a secret letter, as range rows (deterministic: SG.bits.bestSplit). */
  function halvingRows(secretIdx) {
    var det = { secret: SG.bits.ORDER.charAt(secretIdx), lo: 0, hi: SG.bits.ORDER.length, questions: 0, answers: "", done: false };
    var rows = [];
    while (!det.done) {
      det = SG.bits.ask(det, SG.bits.bestSplit(det)).det;
      rows.push({ lo: det.lo, hi: det.hi });
    }
    return rows;
  }

  /**
   * The child's own path as range rows. Bit Detective stores `ranges` ([lo,hi] per question) when it can; if it
   * stored only the remaining sizes (`path`) we rebuild nested ranges that keep the secret letter in view.
   */
  function caseRows(entry, secretIdx) {
    var total = SG.bits.ORDER.length;
    if (Array.isArray(entry.ranges) && entry.ranges.length) {
      return entry.ranges.map(function (r) { return Array.isArray(r) ? { lo: r[0], hi: r[1] } : { lo: r.lo, hi: r.hi }; });
    }
    var sizes = (entry.path || []).slice();
    if (sizes.length && sizes[0] === total) sizes.shift();
    var lo = 0, hi = total, rows = [];
    sizes.forEach(function (sz) {
      sz = Math.max(1, Math.min(sz, hi - lo));
      var left = { lo: lo, hi: lo + sz }, right = { lo: hi - sz, hi: hi };
      var pick = secretIdx >= left.lo && secretIdx < left.hi ? left : right;
      rows.push(pick);
      lo = pick.lo; hi = pick.hi;
    });
    return rows;
  }

  function exampleSecretIndex(S) {
    var i = S.surprise.maxPos;
    var idx = i >= 0 ? SG.bits.ORDER.indexOf(S.sentence.charAt(i)) : -1;
    return idx >= 0 ? idx : SG.bits.ORDER.indexOf("E");
  }

  function buildBit(B, cc) {
    var S = B.S, c = "board.cards.bit.";
    var cases = B.profile.detective || [];
    var latest = cases.length ? cases[cases.length - 1] : null;
    var secretIdx = latest ? Math.max(0, SG.bits.ORDER.indexOf(latest.secret)) : exampleSecretIndex(S);
    var half = halvingRows(secretIdx);
    var gib = gibberishStory(B, "bit");
    var vars = { worst: SG.bits.WORST, max: HMAX_TXT, size: SG.alphabet.SIZE };

    var box = h("div", { "class": "sgb-pic sgb-ladders" });
    var picsBit = [box];
    var extras = [];
    if (latest) {
      var mine = caseRows(latest, secretIdx);
      var youBox = h("div", { "class": "sgb-ladder" });
      box.appendChild(youBox);
      extras.push(mountChart(cc, youBox, charts.rangeLadder({
        rows: mine, total: 27, label: pl(c + "you", latest.questions, { n: latest.questions }), secret: { index: secretIdx }, ariaLabel: pl(c + "you", latest.questions, { n: latest.questions })
      })));
    }
    var halfBox = h("div", { "class": "sgb-ladder" });
    box.appendChild(halfBox);
    var halfLabel = latest ? t(c + "halving", { best: half.length }) : t(c + "example") + ": " + t(c + "halving", { best: half.length });
    extras.push(mountChart(cc, halfBox, charts.rangeLadder({ rows: half, total: 27, label: halfLabel, secret: { index: secretIdx }, ariaLabel: halfLabel })));

    var l1 = h("div", { "class": "sgb-l1-body" },
      gib ? para("sgb-headline", t(c + "gibberish.line", vars)) : null,
      para("sgb-strong", t(c + "definition")),
      para("", t(c + "maxFive", vars)),
      box);

    if (!latest) {
      l1.appendChild(para("sgb-note-line", t(c + "noCases")));
      l1.appendChild(SG.ui.button(t(c + "playDetective"), { kind: "primary", onClick: function () { SG.app.go("detective"); } }));
    }
    if (cases.length >= 3) {
      var avg = sum(cases.map(function (x) { return x.questions; })) / cases.length;
      var lineBox = h("div", { "class": "sgb-pic" });
      extras.push(mountChart(cc, lineBox, charts.numberLine({
        min: 0, max: Math.max(HMAX, Math.ceil(avg * 2) / 2),
        band: { lo: avg, hi: avg, mid: avg, label: t(c + "avgLabel", { avg: fmt.avg1(avg) }) },
        marks: [{ value: HMAX, label: t("board.cards.entropy.numberLine.refMax", { max: HMAX_TXT }), shape: "diamond" }],
        ariaLabel: t(c + "average", { avg: fmt.avg1(avg), max: HMAX_TXT })
      })));
      l1.appendChild(para("", t(c + "average", { avg: fmt.avg1(avg), max: HMAX_TXT })));
      l1.appendChild(lineBox);
      picsBit.push(lineBox);
    }
    // DB-031: ties the card to this round's most surprising letter.
    if (S.n) l1.appendChild(para("sgb-note-line sgb-secondary", pl(c + "link", Math.max.apply(null, S.ranks), { g: Math.max.apply(null, S.ranks) })));

    var dctx = latest ? { detective: { questions: latest.questions, best: half.length } } : {};
    var words = collectWords(B, "bit", extras, dctx);
    return {
      l1: l1, pics: picsBit, words: words,
      l2: pickLine(B, "bit", Object.assign({}, vars, spotVars(S, spotFor(S, "bit"))), [0, 1, 2, 3], gib),
      cornerVars: vars
    };
  }

  /* ================================================================ card 3: entropy */

  function histogramBars(S) {
    var bars = [], g, revCount = new Array(28);
    for (g = 0; g < 28; g++) revCount[g] = 0;
    S.ranks.forEach(function (r, i) { if (S.revealed[i]) revCount[r]++; });
    function bar(label, from, to, band) {
      var total = 0, rev = 0;
      for (var x = from; x <= to; x++) { total += S.bounds.hist[x] || 0; rev += revCount[x] || 0; }
      var segs = [{ value: total - rev }];
      if (rev) segs.push({ value: rev, hatch: true });
      return { label: label, segments: segs, band: band, valueLabel: String(total) };
    }
    for (g = 1; g <= 9; g++) bars.push(bar(String(g), g, g, SG.info.surpriseBands([g])[0]));
    bars.push(bar("10+", 10, 27, 4));
    return bars;
  }

  function buildEntropy(B, cc) {
    var S = B.S, c = "board.cards.entropy.", b = S.bounds;
    var gib = gibberishStory(B, "entropy");
    var aboutLabel = t(c + "numberLine.about", { mid: bitsStr(b.mid) });
    var lineBox = h("div", { "class": "sgb-pic" });
    var nl = mountChart(cc, lineBox, charts.numberLine({
      min: 0, max: HMAX,
      band: { lo: b.low, hi: b.up, mid: b.mid, label: aboutLabel },
      marks: [{ value: HMAX, label: t(c + "numberLine.refMax", { max: HMAX_TXT }), shape: "diamond" },
        { value: 1, label: t(c + "numberLine.refEnglish"), shape: "triangle" }],
      ariaLabel: t(c + "numberLine.title")
    }));
    var histBox = h("div", { "class": "sgb-pic" });
    var hist = mountChart(cc, histBox, charts.barChart({
      orientation: "v", bars: histogramBars(S), integerTicks: true, ariaLabel: t(c + "histogram.title"), caption: t(c + "histogram.title"),
      max: 4
    }));
    var easyShare = share(S.ranks, function (g) { return g <= 2; });
    var summaryKey = easyShare >= EASY_SHARE ? "summaryEasy" : easyShare <= HARD_SHARE ? "summaryHard" : "summaryMixed";
    var peekedKey = S.revealed.some(Boolean) ? charts.legend({ items: [{ hatch: true, label: t(c + "histogram.peekedHatch") }] }).el : null;
    var l1 = h("div", { "class": "sgb-l1-body" },
      h("p", { "class": "sgb-headline" }, t(c + "numberLine.about", { mid: bitsStr(b.mid) }), " ", estimateTags(B)),
      para("", t(c + "numberLine.range", { low: bitsStr(b.low), high: bitsStr(b.up) })),
      b.up - b.low > 1 ? para("sgb-note-line", t(c + "wideRange")) : null,
      gib ? para("sgb-note-line", t(c + "gibberish.line")) : null,
      S.n < THIN_N ? para("sgb-note-line", t(c + "thin")) : null,
      lineBox,
      h("h3", { "class": "sgb-subhead" }, t(c + "histogram.title")),
      histBox,
      para("sgb-note-line sgb-secondary", t(c + "histogram.axisNote")),
      peekedKey,
      para("", t(c + summaryKey)));
    var words = collectWords(B, "entropy", [nl, hist]);
    var vars = { max: HMAX_TXT, size: SG.alphabet.SIZE };
    return {
      l1: l1, pics: [lineBox, histBox], words: words,
      l2: pickLine(B, "entropy", Object.assign({}, vars, spotVars(S, spotFor(S, "entropy"))),
        easyShare >= 0.5 ? [0, 1, 2, 3] : [1, 2, 3], gib),
      cornerVars: vars
    };
  }

  /* ================================================================ cards 4 and 7: Robo's look-back curve */

  function kLabel(k) { return k < 0 ? t("board.cards.context.curve.xNone") : String(k); }

  /**
   * One chart spec for both Context and Enough Context. Main line = ordinary-English curve (Gibberish: this
   * sentence), the other one lighter; the child's Peephole points on top (DB-039, DB-040, DB-062).
   */
  function lookBackSpec(B, withKnee) {
    var S = B.S, cc = "board.cards.context.curve.";
    var gib = B.record.tier === "gibberish";
    var corpus = S.lookBack.corpus, sentence = S.lookBack.sentence;
    var useSentenceMain = gib || !corpus.length;
    var main = useSentenceMain ? sentence : corpus;
    var other = useSentenceMain ? corpus : sentence;
    var cats = main.map(function (p) { return { key: p.k, label: kLabel(p.k) }; });
    cats.push({ key: "all", label: t(cc + "all") });
    function pts(curve) {
      var out = curve.map(function (p) { return { x: p.k, y: p.bits }; });
      if (curve.length) out.push({ x: "all", y: curve[curve.length - 1].bits });     // Robo's longest look-back is its "all"
      return out;
    }
    var series = [{
      id: "main", shape: "square", style: "main", points: pts(main),
      label: useSentenceMain ? t(cc + "sentenceLine") : t(cc + "roboLine")
    }];
    if (other.length) {
      series.push({
        id: "other", shape: "diamond", style: "dashed", points: pts(other),
        label: useSentenceMain ? t(cc + "roboLine") : t(cc + "sentenceLine")
      });
    }
    var own = ownPoints(B);
    if (own.groups.length) {
      series.push({
        id: "you", shape: "circle", style: "light", label: t(cc + "yours"),
        points: own.groups.map(function (g) {
          return { x: g.x, y: g.mid, lo: g.lo, hi: g.hi, ring: g.mine };
        })
      });
    }
    var spec = { xCats: cats, yDomain: [0, HMAX], series: series, ariaLabel: t(cc + "title"), caption: t(cc + "title"), height: 280 };
    if (withKnee) {
      var lastK = main.length ? main[main.length - 1].k : 0;
      var knee = S.lookBack.kStar;
      B.knee = (knee != null && knee < lastK && !(gib && S.lookBack.flat)) ? knee : null;
      if (B.knee != null) {
        spec.markers = [{ x: B.knee, label: pl("board.cards.enough.knee", B.knee, { n: B.knee }), kind: "knee" }];
        spec.regions = [{ from: B.knee, to: "all", hatch: true }];
      }
    }
    return { spec: spec, own: own, main: main };
  }

  /** x labels under the line chart: what "none", "0" and "1..4" mean for Robo (text for kids, not formal terms). */
  function curveKey(main) {
    var cc = "board.cards.context.curve.";
    var lines = [t(cc + "xNone") + ": " + t(cc + "knowsNothing"), "0: " + t(cc + "common")];
    var top = main.length ? main[main.length - 1].k : 0;
    if (top >= 1) lines.push(t(cc + "peeksRange", { to: top }));
    lines.push(t(cc + "allKey", { k: top }));
    return lines;
  }

  /** Under the chart: each of the child's points with its average and "n rounds" (DB-040). */
  function ownList(own) {
    if (!own.groups.length) return null;
    var lines = own.groups.map(function (g) {
      return pl("journey.peepholePanel.row", g.n, { k: g.x === "all" ? t("board.cards.context.curve.all") : g.x, mid: bitsStr(g.mid), n: g.n });
    });
    return h("div", null, h("p", { "class": "sgb-strong" }, t("board.cards.context.curve.yours")), plainList(lines, "sgb-ownlist"));
  }

  function ownPatternLines(B, own, key) {
    var kind = ownPattern(own);
    if (!kind) return [];
    return [para("sgb-note-line", t("board.cards." + key + ".yourPattern." + kind)),
      para("sgb-note-line sgb-secondary", t("board.cards." + key + ".yourPattern.caveat"))];
  }

  function placeholderBox() {
    return h("div", { "class": "sgb-placeholder" },
      h("p", null, t("board.cards.context.curve.placeholder")),
      SG.ui.button(t("board.cards.context.curve.tryPeephole"), { kind: "primary", onClick: function () { SG.app.go("setup", { mode: "peephole" }); } }));
  }

  function wordPosBars(S) {
    var wp = S.wordPos, c = "board.cards.context.wordPos.";
    var defs = [["first", "pos1"], ["second", "pos2"], ["third", "pos3"], ["fourthPlus", "pos4"]];
    var maxAvg = 0;
    var bars = defs.map(function (d) {
      var x = wp[d[0]];
      if (x.avg != null && x.avg > maxAvg) maxAvg = x.avg;
      return x.avg == null
        ? { label: t(c + d[1]), value: 0, placeholder: t(c + "notEnough") }
        : { label: t(c + d[1]), value: x.avg, valueLabel: fmt.avg1(x.avg) };
    });
    var lines = defs.map(function (d) {
      var x = wp[d[0]];
      return t(c + d[1]) + ": " + (x.avg == null ? t(c + "notEnough") + " (" + x.count + ")" : t(c + "bar", { avg: fmt.avg1(x.avg), n: x.count }));
    });
    return { bars: bars, lines: lines, max: Math.max(2, Math.ceil(maxAvg)) };
  }

  function buildContext(B, cc) {
    var S = B.S, c = "board.cards.context.";
    var gib = gibberishStory(B, "context");
    var wp = wordPosBars(S);
    var wpBox = h("div", { "class": "sgb-pic" });
    var wpChart = mountChart(cc, wpBox, charts.barChart({
      orientation: "v", bars: wp.bars, max: wp.max, integerTicks: true, height: 220,
      ariaLabel: t(c + "wordPos.title"), caption: t(c + "wordPos.title")
    }));
    var fl = firstVsLater(S);
    var flLine = fl ? t(c + (fl.kind === "higher" ? "firstHigher" : fl.kind === "lower" ? "firstLower" : "firstSame"),
      { first: fmt.avg1(fl.first), later: fmt.avg1(fl.later) }) : t(c + "firstFallback");

    var lb = lookBackSpec(B, false);
    var lineBox = h("div", { "class": "sgb-pic" });
    var lineChart = mountChart(cc, lineBox, charts.lineChart(lb.spec));
    var r = B.record;
    var thisRound = r.mode === "peephole" ? para("sgb-note-line", r.peek == null ? t(c + "thisRoundAll") : pl(c + "thisRound", r.peek, { k: r.peek })) : null;

    var l1 = h("div", { "class": "sgb-l1-body" },
      gib ? para("sgb-headline", t(c + "gibberish.line")) : null,
      h("h3", { "class": "sgb-subhead" }, t(c + "wordPos.title")),
      wpBox,
      plainList(wp.lines, "sgb-wordpos-list"),
      para("sgb-note-line sgb-secondary", t(c + "wordPos.note")),
      para("sgb-note-line", flLine),
      S.wordPos.first.count < 1 ? para("sgb-note-line", t(c + "thinWords")) : null,
      h("h3", { "class": "sgb-subhead" }, t(c + "curve.title")),
      para("sgb-note-line", t(c + "curve.intro")),
      para("sgb-note-line sgb-secondary", t(c + "curve.xLabel") + " / " + t(c + "curve.yLabel")),
      lineBox,
      plainList(curveKey(lb.main), "sgb-curvekey sgb-secondary"),
      gib ? para("sgb-note-line sgb-secondary", t(c + "gibberish.faint")) : null,
      ownList(lb.own),
      thisRound,
      lb.own.hasPeephole ? null : placeholderBox());
    ownPatternLines(B, lb.own, "context").forEach(function (n) { l1.appendChild(n); });
    var words = collectWords(B, "context", [wpChart, lineChart]);
    words.text.push.apply(words.text, wp.lines);
    var vars = { max: HMAX_TXT };
    // First-letter claims are only used when the child's own numbers show them (DB-020).
    var allowed = fl && fl.kind === "higher" ? [0, 1, 2, 3] : [3];
    var l2 = pickLine(B, "context", Object.assign({}, vars, spotVars(S, spotFor(S, "context"))), allowed, gib) || t(c + "layer2Neutral");
    return { l1: l1, pics: [wpBox, lineBox], words: words, l2: l2, cornerVars: vars };
  }

  /* ================================================================ card 7: enough context */

  /** "5 to 6 letters saved about 0.02 bits" for the steps around the knee (two decimals: they are small, C11). */
  function savingLines(B, main) {
    var ks = main.filter(function (p) { return p.k >= 0; });
    if (ks.length < 2) return [];
    var from = B.knee != null ? Math.max(0, B.knee - 1) : Math.max(0, ks.length - 3);
    var out = [];
    for (var i = from; i < from + 3 && i + 1 < ks.length; i++) {
      var saved = Math.max(0, ks[i].bits - ks[i + 1].bits);
      out.push(t("board.cards.enough.saving", { from: ks[i].k, to: ks[i + 1].k, saved: fmt.bits2(saved) }));
    }
    return out;
  }

  function buildEnough(B, cc) {
    var S = B.S, c = "board.cards.enough.";
    var gib = gibberishStory(B, "enough");
    var lb = lookBackSpec(B, true);
    var lineBox = h("div", { "class": "sgb-pic" });
    var lineChart = mountChart(cc, lineBox, charts.lineChart(lb.spec));
    var headline = gib ? t(c + "gibberish.line") : B.knee != null ? pl(c + "headline", B.knee, { n: B.knee }) : t(c + "headlineNoKnee");
    var savings = gib ? [] : savingLines(B, lb.main);
    var legend = B.knee != null ? charts.legend({ items: [{ saved: true, label: t(c + "shaded") }] }) : null;
    var r = B.record;
    var l1 = h("div", { "class": "sgb-l1-body" },
      para("sgb-headline", headline),
      lineBox, legend ? legend.el : null,
      plainList(curveKey(lb.main), "sgb-curvekey sgb-secondary"),
      savings.length ? plainList(savings, "sgb-savings") : null,
      ownList(lb.own),
      r.mode === "peephole" ? para("sgb-note-line", r.peek == null ? t("board.cards.context.thisRoundAll") : pl("board.cards.context.thisRound", r.peek, { k: r.peek })) : null,
      lb.own.hasPeephole ? null : para("sgb-note-line", t(c + "thin")));
    ownPatternLines(B, lb.own, "enough").forEach(function (n) { l1.appendChild(n); });
    var words = collectWords(B, "enough", [lineChart]);
    words.text = [headline].concat(words.text.slice(1), savings);      // the headline is the knee rule of DB-061 as shown
    var vars = { max: HMAX_TXT };
    return {
      l1: l1, pics: [lineBox], words: words,
      l2: pickLine(B, "enough", Object.assign({}, vars, spotVars(S, spotFor(S, "enough"))), [0, 1, 2, 3], gib),
      cornerVars: vars
    };
  }

  /* ================================================================ card 5: redundancy */

  function buildRedundancy(B) {
    var S = B.S, c = "board.cards.redundancy.";
    var gib = gibberishStory(B, "redundancy");
    var tiles = charts.sentenceTiles({
      chars: S.sentence, ranks: S.ranks, revealed: S.revealed, mode: "fade", ariaLabel: t(c + "title"), caption: t(c + "title")
    });
    var hide = SG.ui.button(t(c + "toggleHide"), { cls: "sg-btn--pill", attrs: { "aria-pressed": "false" } });
    hide.addEventListener("click", function () {
      var on = hide.getAttribute("aria-pressed") !== "true";
      hide.setAttribute("aria-pressed", on ? "true" : "false");
      hide.textContent = t(on ? c + "toggleShow" : c + "toggleHide");
      tiles.setHideFaint(on);
    });
    var key = charts.legend({ items: [
      { swatchClass: "sgb-sw-fade0", label: t(c + "fade.light") }, { swatchClass: "sgb-sw-fade1", label: t(c + "fade.medium") },
      { swatchClass: "sgb-sw-fade2", label: t(c + "fade.solid") }, { shape: "eye", label: t(c + "fade.peeked") }
    ] });
    var a = countIf(S.ranks, function (g, i) { return g === 1 && !S.revealed[i]; });
    var pic = h("div", { "class": "sgb-pic" }, tiles.el, key.el);
    var l1 = h("div", { "class": "sgb-l1-body" },
      h("p", { "class": "sgb-headline" }, t(c + "headline", { pct: fmt.pct5(S.redundancy) }), " ", estimateTags(B)),
      para("", t(c + "firstTries", { a: a, n: S.n })),
      gib ? para("sgb-note-line", t(c + "gibberish.line")) : null,
      pic, h("div", { "class": "sgb-actions" }, hide),
      para("sgb-note-line sgb-secondary", t(c + "benefit")),
      para("sgb-note-line sgb-secondary", t(c + "reference")),
      S.n < THIN_N ? para("sgb-note-line", t(c + "thin")) : null);
    // The reading toggle needs the words of the whole sentence to remain available: the table is the tile list.
    var words = collectWords(B, "redundancy", [tiles]);
    var allowed = S.redundancy >= 0.3 ? [0, 1, 2, 3] : [1, 2, 3];
    var firstTrySpot = spotVars(S, spotFor(S, "redundancy"));
    return { l1: l1, pics: [pic], words: words, l2: pickLine(B, "redundancy", firstTrySpot, allowed, gib), cornerVars: {} };
  }

  /* ================================================================ card 6: magic twin */

  function perBlock() {
    var s = SG.ui.theme && SG.ui.theme.sizeClass ? SG.ui.theme.sizeClass() : "phone";
    return s === "desktop" ? 16 : s === "tablet" ? 12 : 8;
  }

  /**
   * The Twin's grid: Robo's numbers on top, rebuilt letters below, the child's own numbers last. It is built from
   * NUMBERS ONLY: the sentence is never passed in (DB-053); a rebuilt cell stays empty until the decode puts a letter in.
   */
  function twinGrid(B) {
    var S = B.S, n = S.n, size = perBlock();
    var roboBands = SG.info.surpriseBands(S.twin.numbers);
    var root = h("div", { "class": "sg-aligned sgb-twingrid", role: "group", "aria-label": t("board.cards.twin.numbersLabel") });
    var rebuilt = [], cols = [];
    for (var start = 0; start < n; start += size) {
      var end = Math.min(n, start + size);
      var block = h("div", { "class": "sg-ablock", style: { "--cols": end - start } });
      block.appendChild(h("span", { "class": "sg-alabel" }, t("ui.robo")));
      var c;
      for (c = start; c < end; c++) {
        var rc = h("span", { "class": "sg-acell sg-band-" + roboBands[c], "data-col": c, "aria-label": t("ui.robo") + ": " + S.twin.numbers[c] }, String(S.twin.numbers[c]));
        (cols[c] = cols[c] || []).push(rc);
        block.appendChild(rc);
      }
      block.appendChild(h("span", { "class": "sg-alabel" }, t("board.cards.twin.twinLabel")));
      for (c = start; c < end; c++) {
        var tc = h("span", { "class": "sg-acell sgb-rebuilt", "data-col": c, "aria-hidden": "true" });
        rebuilt[c] = tc;
        (cols[c] = cols[c] || []).push(tc);
        block.appendChild(tc);
      }
      block.appendChild(h("span", { "class": "sg-alabel sgb-yours" }, t("ui.you")));
      for (c = start; c < end; c++) {
        var yc = h("span", { "class": "sg-acell sgb-yours sg-band-" + S.bands[c] + (S.revealed[c] ? " is-revealed" : ""), "data-col": c,
          "aria-label": t("ui.you") + ": " + S.ranks[c] + (S.revealed[c] ? t("charts.tile.peekedSuffix") : "") }, String(S.ranks[c]));
        if (S.revealed[c]) yc.appendChild(h("span", { "class": "sg-acell-eye", "aria-hidden": "true" }, SG.ui.icon("eye", { size: 11 })));
        (cols[c] = cols[c] || []).push(yc);
        block.appendChild(yc);
      }
      root.appendChild(block);
    }
    return {
      el: root,
      put: function (i, ch) {
        rebuilt[i].textContent = ch === " " ? SG.alphabet.label(" ") : ch;
        rebuilt[i].classList.add("is-filled");
      },
      clear: function (i) { rebuilt[i].textContent = ""; rebuilt[i].classList.remove("is-filled"); },
      active: function (i) {
        cols.forEach(function (col, j) { col.forEach(function (cell) { cell.classList.toggle("is-active", j === i); }); });
      }
    };
  }

  function buildTwin(B, cc) {
    var S = B.S, c = "board.cards.twin.", n = S.n;
    var gib = gibberishStory(B, "twin");
    var order = SG.model.roboOrder(B.record.peek, SG.robo.maxOrder);
    var frames = [];
    try { frames = SG.twin.decodeFrames(SG.robo, S.twin.numbers, order); }
    catch (e) { if (typeof console !== "undefined") console.error("[board] twin decode failed", e); }

    var grid = twinGrid(B);
    var pos = 0, timer = null, finished = false, started = false;
    var result = h("div", { "class": "sgb-twin-result", role: "status", "aria-live": "polite" });
    var btnMain = SG.ui.button("", { kind: "primary" });
    var btnStep = SG.ui.button(t(c + "stepNext"), { cls: "sg-btn--pill" });
    var btnSkip = SG.ui.button(t(c + "skip"), { cls: "sg-btn--pill" });
    var stepMs = Math.max(30, Math.min(SG.config.TWIN_STEP_MS, Math.floor(TWIN_MAX_MS / Math.max(1, n))));

    function paint() {
      for (var i = 0; i < n; i++) {
        if (i < pos) grid.put(i, frames[i] ? frames[i].charAt(i) : "");
        else grid.clear(i);
      }
      grid.active(pos < n && pos > 0 ? pos - 1 : -1);
    }
    function stop() { if (timer) { timer(); timer = null; } }
    function calm() { return !!(SG.ui.theme && SG.ui.theme.isCalm()); }
    function label() {
      btnMain.textContent = finished ? t(c + "replay") : timer ? t(c + "pause") : t(c + "play");
      btnMain.hidden = calm() && !finished;          // calm motion: no running animation, only "Next step" and "Watch again"
      btnStep.disabled = finished || !!timer;
      btnSkip.disabled = finished;
    }
    function finish() {
      stop();
      pos = n; paint(); finished = true;
      var rebuiltText = frames.length ? frames[frames.length - 1] : "";
      var ok = n > 0 && rebuiltText === S.sentence && S.twin.ok;      // the UI compares for itself (DB-054)
      SG.ui.clear(result);
      if (ok) {
        result.appendChild(h("p", { "class": "sgb-match" }, SG.ui.icon("check", { size: 22 }), t(c + "matches")));
        result.appendChild(h("p", { "class": "sgb-twin-line" }, h("strong", null, t(c + "rebuiltLabel") + ": "), rebuiltText));
        result.appendChild(h("p", { "class": "sgb-twin-line" }, h("strong", null, t(c + "originalLabel") + ": "), S.sentence));
        SG.ui.a11y.announce(t(c + "matches"));
        if (!B.twinSeen) { B.twinSeen = true; award(B, { type: "twin" }); }
      } else {
        result.appendChild(para("sgb-twin-line", t(c + "mismatch")));
        if (typeof console !== "undefined") console.error("[board] Magic Twin mismatch", rebuiltText, S.sentence);
      }
      label();
    }
    function step() { if (pos < n) { pos++; paint(); } if (pos >= n) finish(); }
    function play() {
      if (finished) { pos = 0; finished = false; SG.ui.clear(result); paint(); }
      stop();
      if (!calm()) timer = SG.ui.every(step, stepMs);
      label();
    }
    function pause() { stop(); label(); }
    btnMain.addEventListener("click", function () { if (timer) pause(); else play(); });
    btnStep.addEventListener("click", function () {
      if (finished) return;
      stop(); step(); label();
    });
    btnSkip.addEventListener("click", function () { finish(); });

    var hero = h("div", { "class": "sgb-twin-hero", "aria-hidden": "true" },
      SG.ui.robo.svg({ mood: "thinking", size: 44 }), SG.ui.icon("arrowRight", { size: 28 }), SG.ui.robo.svg({ mood: "curious", size: 44 }));
    var ones = countIf(S.twin.numbers, function (g) { return g === 1; });
    var pic = h("div", { "class": "sgb-pic" }, grid.el, result);
    var l1 = h("div", { "class": "sgb-l1-body" },
      gib ? para("sgb-headline", t(c + "gibberish.line")) : null,
      hero,
      para("", t(c + "step1")), para("sgb-secondary", t(c + "step2")),
      pic,
      h("div", { "class": "sgb-actions sgb-twin-controls" }, btnMain, btnStep, btnSkip),
      para("", pl(c + "ones", ones, { b: ones, n: n })),
      para("sgb-note-line", t(c + "whyRobo")),
      para("sgb-note-line sgb-secondary", t(c + "samePredictor")),
      para("sgb-note-line sgb-secondary", t(c + "yourStrip") + ": " + t(c + "yourStripNote")),
      n < 3 ? para("sgb-note-line", t(c + "thin")) : null);

    var words = collectWords(B, "twin", []);
    var sp = spotVars(S, spotFor(S, "twin"));
    var started1 = function () {
      if (started) return;
      started = true;
      if (!frames.length) { label(); return; }
      if (calm()) { finish(); return; }     // calm motion: everything at once; "Watch again" then steps one number at a time
      play();
    };
    label();
    return {
      l1: l1, pics: [pic], words: words, l2: pickLine(B, "twin", sp, [0, 1, 2, 3], gib), cornerVars: {},
      onShow: function () { if (!started) whenVisible(l1, started1); }
    };
  }

  /** Run fn once when `el` is on screen (a card shown in "all" view should not play off-screen). */
  function whenVisible(el, fn) {
    if (typeof IntersectionObserver === "undefined") { fn(); return; }
    var done = false, io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !done) { done = true; io.disconnect(); fn(); }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    SG.ui.track(function () { io.disconnect(); });
  }

  /* ================================================================ card 8: squeeze */

  function buildSqueeze(B, cc) {
    var S = B.S, c = "board.cards.squeeze.", n = S.n, b = S.bounds;
    var gib = gibberishStory(B, "squeeze");
    var orig = n * HMAX, sq = n * b.mid;
    var saved = Math.max(0, orig - sq);
    var pct = fmt.pct5(b.mid / HMAX);
    var bars = [
      { label: t(c + "originalName"), value: orig, valueLabel: t(c + "bitsValue", { bits: fmt.bits(orig) }) },
      { label: t(c + "squeezedName"), segments: [{ value: sq }, { value: saved, saved: true }], valueLabel: t(c + "aboutBitsValue", { bits: fmt.bits(sq) }),
        whisker: [n * b.low, n * b.up] },
      { label: t(c + "roboName"), value: n * S.robo.bounds.mid, valueLabel: t(c + "aboutBitsValue", { bits: fmt.bits(n * S.robo.bounds.mid) }) }
    ];
    var box = h("div", { "class": "sgb-pic" });
    var chart = mountChart(cc, box, charts.barChart({
      orientation: "h", bars: bars, max: orig, ariaLabel: t(c + "headline", { pct: pct }), caption: t(c + "headline", { pct: pct })
    }));
    var legend = charts.legend({ items: [{ saved: true, label: t(c + "savedNote", { saved: fmt.bits(saved) }) }] });

    // MAY (DB-068): the 8-bits-per-letter bar lives behind "More", on its own scale, apart from the main comparison.
    var comp = h("div", { "class": "sgb-more", hidden: true });
    var compBox = h("div", { "class": "sgb-pic" });
    comp.appendChild(compBox);
    comp.appendChild(para("sgb-note-line", t(c + "computerNote")));
    var compChart = mountChart(cc, compBox, charts.barChart({
      orientation: "h", max: n * 8, ariaLabel: t(c + "computerBar", { bits8: fmt.int(n * 8) }),
      bars: [{ label: t(c + "computerName"), value: n * 8, valueLabel: t(c + "bitsValue", { bits: fmt.int(n * 8) }) }]
    }));
    var moreBtn = SG.ui.button(t(c + "computerName"), { kind: "link", attrs: { "aria-expanded": "false" } });
    moreBtn.addEventListener("click", function () {
      var open = comp.hidden;
      comp.hidden = !open;
      moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) refit(cc);
    });

    // Notes live outside the SVG: the toolkit's bar notes would overlap the next bar on a narrow screen.
    var pic = h("div", { "class": "sgb-pic-group" }, box, para("sgb-note-line", t(c + "roboCaption")), legend.el);
    var l1 = h("div", { "class": "sgb-l1-body" },
      h("p", { "class": "sgb-headline" }, t(c + "headline", { pct: pct }), " ", estimateTags(B)),
      pct === "100" ? para("sgb-note-line", t(c + "noSaving")) : null,
      gib ? para("sgb-note-line", t(c + "gibberish.line")) : null,
      pic,
      para("sgb-note-line", t(c + "possible")),
      para("sgb-note-line sgb-secondary", t(c + "reversible")),
      n < THIN_N ? para("sgb-note-line", t(c + "thin")) : null,
      h("div", { "class": "sgb-actions" }, moreBtn), comp);

    var words = collectWords(B, "squeeze", [chart, compChart]);
    var sp = spotVars(S, spotFor(S, "squeeze"));
    return {
      l1: l1, pics: [pic], words: words, l2: pickLine(B, "squeeze", sp, [0, 1, 2, 3], gib),
      cornerVars: {}, cornerExtra: squeezeTable(S)
    };
  }

  /** Grown-up corner extra: a real prefix code for the child's numbers (A8). */
  function squeezeTable(S) {
    var c = "board.cards.squeeze.codeBook.";
    var comp = S.compression;
    var keys = Object.keys(comp.codeBook).map(Number).sort(function (a, b) { return a - b; });
    return h("div", { "class": "sgb-corner-extra" },
      para("", t(c + "sizes", { plain: fmt.int(comp.plain), huffman: fmt.int(comp.huffman), ideal: fmt.bits(comp.ideal) })),
      charts.tableEl({
        caption: t(c + "caption"), headers: [t(c + "headers.guess"), t(c + "headers.code")],
        rows: keys.map(function (k) { return [String(k), comp.codeBook[k]]; })
      }));
  }

  /* ================================================================ card 9: you vs robo */

  function panel(who, ranks, bounds, n) {
    var c = "board.cards.robo.panel.";
    var total = sum(ranks);
    return h("div", { "class": "sgb-vs-panel sgb-vs-" + who },
      h("h3", null, t(c + who)),
      h("p", null, t(c + "total", { n: total })),
      h("p", null, t(c + "average", { avg: fmt.avg1(n ? total / n : 0) })),
      h("p", { "class": "sgb-strong" }, t(c + "bits", { mid: bitsStr(bounds.mid), low: bitsStr(bounds.low), high: bitsStr(bounds.up) })));
  }

  function buildRobo(B, cc) {
    var S = B.S, c = "board.cards.robo.";
    var gib = gibberishStory(B, "robo");
    var cells = S.ranks.map(function (g, i) {
      if (S.revealed[i]) return { result: "revealed" };
      return { result: g < S.robo.ranks[i] ? "you" : g > S.robo.ranks[i] ? "robo" : "same" };
    });
    var strip = charts.compareStrip({ cells: cells, caption: t(c + "title") });
    var counts = h("ul", { "class": "sgb-vs-counts" },
      h("li", null, h("span", { "class": "sgb-glyph", "aria-hidden": "true" }, "▲"), t(c + "strip.youFewer", { n: S.vs.youFewer })),
      h("li", null, h("span", { "class": "sgb-glyph", "aria-hidden": "true" }, "="), t(c + "strip.same", { n: S.vs.same })),
      h("li", null, h("span", { "class": "sgb-glyph", "aria-hidden": "true" }, "▼"), t(c + "strip.roboFewer", { n: S.vs.roboFewer })));
    var verdict = S.vs.verdict === "robo" ? "robo" : S.vs.verdict === "you" ? "you" : "even";
    var pic = h("div", { "class": "sgb-pic" },
      h("div", { "class": "sgb-vs" }, panel("you", S.ranks, S.bounds, S.n), panel("robo", S.robo.ranks, S.robo.bounds, S.n)),
      h("div", { "class": "sgb-strip" }, strip.el), counts,
      para("sgb-note-line sgb-secondary", t(c + "strip.note")));
    var l1 = h("div", { "class": "sgb-l1-body" },
      para("sgb-secondary", t(c + "twoWays")),
      h("div", { "class": "sgb-tagline" }, estimateTags(B)),
      pic,
      para("sgb-headline", t(c + "line." + verdict)),
      para("", t(c + "celebrate")),
      gib ? para("sgb-note-line", t(c + "gibberish.line")) : null,
      B.record.mode === "peephole" && B.record.peek != null ? para("sgb-note-line", pl(c + "peekNote", B.record.peek, { k: B.record.peek })) : null,
      para("sgb-note-line", t(c + "neverSeen")),
      para("sgb-llm", t(c + "llm")),
      S.n < 3 ? para("sgb-note-line", t(c + "thin")) : null);
    var words = collectWords(B, "robo", [strip]);
    return {
      l1: l1, pics: [pic], words: words,
      l2: pickLine(B, "robo", spotVars(S, spotFor(S, "robo")), [0, 1, 2, 3], gib), cornerVars: {}
    };
  }

  var BUILDERS = {
    surprise: buildSurprise, bit: buildBit, entropy: buildEntropy, context: buildContext, redundancy: buildRedundancy,
    twin: buildTwin, enough: buildEnough, squeeze: buildSqueeze, robo: buildRobo
  };

  /* ================================================================ card shell: layers 1, 2, 3 */

  /** Layer 3. A button + a region, closed on every new Board; the open state lives only in B.corner (UX-043, DB-007). */
  function grownUp(B, id, built) {
    var c = "board.cards." + id + ".grownUp.";
    var vars = Object.assign({ size: SG.alphabet.SIZE, max: HMAX_TXT, worst: SG.bits.WORST }, built.cornerVars || {});
    var bodyId = "sgb-gu-" + id;
    var btn = h("button", { type: "button", "class": "sg-accordion-btn sgb-gu-btn", "aria-expanded": "false", "aria-controls": bodyId },
      h("span", { "class": "sgb-gu-label" }, SG.ui.icon("magnifier", { size: 20 }), t("board.grownUpLabel")),
      SG.ui.icon("chevronDown", { size: 22 }));
    var body = h("div", { id: bodyId, "class": "sg-accordion-panel sgb-gu-body", hidden: true, role: "region", "aria-label": t("board.grownUpLabel") },
      h("p", { "class": "sgb-gu-term" }, t(c + "term")),
      h("p", { "class": "sgb-gu-formula" }, h("span", { "class": "sgb-gu-flabel" }, t("board.formulaLabel") + ": "), h("code", null, t(c + "formula"))),
      h("p", null, t(c + "reading", vars)),
      h("p", null, t(c + "shannon", vars)),
      built.cornerExtra || null);
    btn.addEventListener("click", function () {
      var open = body.hidden;
      body.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.classList.toggle("is-open", open);
      B.corner[id] = open;
      if (open) award(B, { type: "grownUp", card: id });
    });
    return h("section", { "class": "sg-accordion sgb-l3 sgb-grownup" }, btn, body);
  }

  function gotItButton(B, id) {
    var btn = SG.ui.button("", { cls: "sg-btn--pill sgb-gotit" });
    function paint() {
      var on = !!(B.profile.cards[id] && B.profile.cards[id].gotIt);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      SG.ui.clear(btn);
      btn.appendChild(SG.ui.icon("star", { size: 20 }));
      btn.appendChild(document.createTextNode(t(on ? "board.nav.gotItDone" : "board.nav.gotIt")));
    }
    btn.addEventListener("click", function () {
      var c = B.profile.cards[id] || (B.profile.cards[id] = { opened: 0, gotIt: false });
      c.gotIt = !c.gotIt;
      SG.app.save();
      paint();
      refreshRail(B);
    });
    paint();
    return btn;
  }

  function ribbons(B, id) {
    var out = [];
    if (B.spotlight === id) out.push(h("span", { "class": "sg-ribbon" }, SG.ui.icon("star", { size: 14 }), t("board.spotlight")));
    out.push(h("span", { "class": "sg-chip" }, t(B.seen[id] ? "board.seenBefore" : "board.isNew")));
    return h("span", { "class": "sgb-ribbons" }, out);
  }

  /** One finished card element, built from a builder's parts. */
  function buildCard(B, idx) {
    var id = CARDS[idx];
    var cc = { charts: [], onShow: null };
    var built = BUILDERS[id](B, cc);
    cc.onShow = built.onShow || null;
    var title = h("h2", { id: "sgb-h-" + id, "class": "sgb-card-title", tabindex: "-1" }, t("board.cards." + id + ".title"));
    var head = h("header", { "class": "sgb-card-head" },
      h("span", { "class": "sgb-num", "aria-hidden": "true" }, String(idx + 1)), title, ribbons(B, id));
    var l2 = h("div", { "class": "sgb-l2" },
      built.l2 ? h("p", { "class": "sgb-wonder" }, SG.ui.icon("magnifier", { size: 22 }), built.l2) : null,
      gotItButton(B, id));
    var l1 = h("div", { "class": "sgb-l1" }, built.l1, h("div", { "class": "sgb-secondary" }, wordsToggle(built.words, built.pics)));
    var card = h("article", { "class": "sg-card sgb-card sgb-card--" + id, "aria-labelledby": "sgb-h-" + id }, head, l1, l2, grownUp(B, id, built));
    return { el: card, title: title, cc: cc };
  }

  /* ================================================================ badges, toast, opening cards */

  /** Evaluate a badge event, award what is new, tell the child gently, save. */
  function award(B, event) {
    var ids = SG.badges.evaluate(B.profile, event);
    if (!ids.length) return;
    SG.storage.award(B.profile, ids, SG.app.now());
    SG.app.save();
    ids.forEach(function (id) { toast(B, id); });
  }

  function toast(B, badgeId) {
    var info = SG.copy.badges && SG.copy.badges[badgeId];
    var text = t("badges.newBadge", { name: info ? info.name : badgeId });
    var el = h("div", { "class": "sgb-toast", role: "status" }, SG.ui.icon("star", { size: 20 }), text);
    B.toasts.appendChild(el);
    SG.ui.a11y.announce(text);
    SG.ui.later(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
  }

  /** The first time a card shows on this Board: count it once (DB-012) and look for badges. */
  function openCards(B, ids) {
    var fresh = ids.filter(function (id) { return !B.opened[id]; });
    if (!fresh.length) return;
    fresh.forEach(function (id) {
      B.opened[id] = true;
      var c = B.profile.cards[id] || (B.profile.cards[id] = { opened: 0, gotIt: false });
      c.opened = (c.opened || 0) + 1;
    });
    SG.app.save();
    fresh.forEach(function (id) { award(B, { type: "cardOpened", card: id }); });
    refreshRail(B);
  }

  /** DB-011: first ever Board -> Surprise; afterwards the least-opened card, ties to the earliest. */
  function pickSpotlight(profile) {
    var counts = CARDS.map(function (id) { return (profile.cards[id] && profile.cards[id].opened) || 0; });
    if (!sum(counts)) return CARDS[0];
    var best = 0;
    counts.forEach(function (n, i) { if (n < counts[best]) best = i; });
    return CARDS[best];
  }

  /* ================================================================ screen parts: header, controls, rail, bars */

  function modeChips(B) {
    var r = B.record, out = [chip(t("setup.modes." + r.mode))];
    if (r.mode !== "twoPlayer" && SG.ui.has("setup.tiers." + r.tier)) out.push(chip(t("setup.tiers." + r.tier + ".name")));
    if (r.mode === "peephole") out.push(chip(r.peek == null ? t("board.header.peekAll") : t("board.header.peek", { k: r.peek })));
    return out;
  }

  function sentenceBlock(B) {
    var r = B.record, S = B.S, partial = r.complete === false && S.n < r.sentence.length;
    var text = h("span", { "class": "sgb-sentence-text" }, S.sentence + (partial ? "…" : ""));
    var box = h("p", { "class": "sgb-sentence" }, text);
    var rest = null;
    if (partial) {
      rest = SG.ui.button(t("board.header.showRest"), { kind: "link", onClick: function () {
        text.textContent = r.sentence;                       // shown only on request, and changes no statistics (DB-085)
        rest.hidden = true;
      } });
    }
    return h("div", null, h("p", { "class": "sgb-label" }, t("board.header.sentence")), box, rest);
  }

  function notesBlock(B) {
    var r = B.record, S = B.S, out = [];
    if (r.complete === false) out.push(h("div", { "class": "sg-note" }, h("p", null, t("board.header.partialBanner", { n: S.n }))));
    if (r.replay) out.push(h("div", { "class": "sg-note" }, h("p", null, t("board.header.replayNote"))));
    var peeked = countIf(S.revealed, Boolean);
    if (peeked) out.push(h("p", { "class": "sgb-note-line" }, pl("board.header.revealedNote", peeked, { r: peeked })));
    if (r.mode === "peephole") {
      var classic = classicAverage(B);
      if (classic != null) {
        out.push(h("p", { "class": "sgb-note-line" },
          t("board.cards.context.compareClassic", { classic: bitsStr(classic), k: r.peek == null ? t("board.cards.context.curve.all") : r.peek, "this": bitsStr(S.bounds.mid) }),
          " ", t("board.cards.context.yourPattern.caveat")));
      }
    }
    if (r.tier === "gibberish") {
      var ord = latestOrdinary(B);
      var st = ord && statsOf(ord);
      if (st) out.push(h("p", { "class": "sgb-note-line" }, t("board.ordinary", { mid: bitsStr(st.mid), pct: fmt.pct5(SG.info.redundancy(st.mid)) })));
    }
    return out;
  }

  function buildHeader(B) {
    var S = B.S, r = B.record;
    var tags = [];
    if (r.complete === false) tags.push(chip(t("board.header.tagPartial"), { tag: true }));
    if (r.replay) tags.push(chip(t("board.header.tagReplay"), { tag: true }));
    var why = roughReasons(B);
    if (S.rough || why.length) tags.push(chip(t("board.rough.tag") + ": " + why.map(function (k) { return t(REASON_KEY[k]); }).join(", "), { tag: true }));
    var aboutText = h("p", { "class": "sgb-whytext", hidden: true, id: "sgb-why" }, t("board.whyAbout.text"));
    var aboutBtn = h("button", { type: "button", "class": "sg-btn sg-btn--link", "aria-expanded": "false", "aria-controls": "sgb-why" }, t("board.whyAbout.button"));
    aboutBtn.addEventListener("click", function () {
      var open = aboutText.hidden;
      aboutText.hidden = !open;
      aboutBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    var back = null;
    if (B.params.from === "journey") back = SG.ui.button(t("home.tiles.journey.name"), { kind: "link", icon: "chevronLeft", onClick: function () { SG.app.go("journey"); } });
    else if (B.params.recordId && SG.app.historyFocus === B.params.recordId) {
      back = SG.ui.button(t("board.nav.backToHistory"), { kind: "link", icon: "chevronLeft", onClick: function () { SG.app.go("history"); } });
    }
    var hideBtn = SG.ui.button(t("board.header.hideDetails"), { kind: "link", cls: "sgb-phone-only", onClick: function () { B.userExpanded = false; setCompact(B, true); } });
    B.showBtn = SG.ui.button(t("board.header.showDetails"), { kind: "link", attrs: { "aria-expanded": "false" }, onClick: function () { B.userExpanded = true; setCompact(B, false); } });
    var summary = h("div", { "class": "sgb-head-summary" },
      h("span", { "class": "sgb-head-line" }, S.sentence + (r.complete === false ? "…" : "")),
      h("span", { "class": "sgb-head-count" }, pl("board.header.letters", S.n, { n: S.n })), B.showBtn);
    var detail = h("div", { "class": "sgb-head-detail" },
      sentenceBlock(B),
      h("div", { "class": "sgb-chips" }, modeChips(B),
        h("span", { "class": "sgb-stat" }, pl("board.header.letters", S.n, { n: S.n })),
        h("span", { "class": "sgb-stat" }, pl("board.header.guesses", sum(S.ranks), { g: sum(S.ranks) })),
        countIf(S.revealed, Boolean) ? h("span", { "class": "sgb-stat" }, SG.ui.icon("eye", { size: 16 }), t("board.header.peeked", { r: countIf(S.revealed, Boolean) })) : null),
      h("div", { "class": "sgb-chips" }, tags),
      notesBlock(B),
      h("div", { "class": "sgb-whyrow" }, aboutBtn, hideBtn), aboutText);
    return h("section", { "class": "sg-card sgb-head", "aria-label": t("board.title") },
      h("div", { "class": "sgb-head-top" }, SG.ui.h1(t("board.title")), back), summary, detail);
  }

  /**
   * On a phone the header (sentence, tags, notes) plus the view buttons fill the screen, so a new card would
   * start below the fold. After the first card they fold into one line; "Show the sentence and details" opens them.
   */
  function setCompact(B, on) {
    B.root.classList.toggle("is-compact", on);
    if (B.showBtn) B.showBtn.setAttribute("aria-expanded", on ? "false" : "true");
  }

  /** Scroll a card (or panel) to the top of the page just below the app header, smoothly unless calm motion is on. */
  function scrollToEl(el) {
    if (!el || !el.getBoundingClientRect) return;
    var bar = document.getElementById("sg-topbar");
    var sticky = bar && window.getComputedStyle(bar).position === "sticky" ? bar.offsetHeight : 0;
    var top = el.getBoundingClientRect().top + (window.pageYOffset || 0) - sticky - 8;
    var calm = !!(SG.ui.theme && SG.ui.theme.isCalm());
    try { window.scrollTo({ top: Math.max(0, top), behavior: calm ? "auto" : "smooth" }); }
    catch (e) { /* no scrolling in this environment */ }
  }

  function stateIcon(state) {
    if (state === "gotIt") return SG.ui.icon("star", { size: 18 });
    if (state === "opened") return SG.ui.icon("check", { size: 18 });
    return h("span", { "class": "sgb-dot", "aria-hidden": "true" });
  }

  function stateOf(B, id) {
    var c = B.profile.cards[id] || {};
    return c.gotIt ? "gotIt" : c.opened > 0 ? "opened" : "notOpened";
  }

  /** The list of nine cards: a sheet on phones (opened by the "3 / 9" button), a left rail on desktop. */
  function buildRail(B) {
    var list = h("ol", { "class": "sgb-rail-list" });
    B.railBtns = CARDS.map(function (id, i) {
      var b = h("button", { type: "button", "class": "sgb-rail-btn", "data-card": id });
      b.addEventListener("click", function () { B.rail.classList.remove("is-open"); goTo(B, i, true); });
      list.appendChild(h("li", null, b));
      return b;
    });
    B.rail = h("nav", { "class": "sgb-rail", "aria-label": t("board.nav.cards") }, list);
    refreshRail(B);
    return B.rail;
  }

  function refreshRail(B) {
    if (!B.railBtns) return;
    CARDS.forEach(function (id, i) {
      var b = B.railBtns[i], st = stateOf(B, id);
      SG.ui.clear(b);
      b.appendChild(stateIcon(st));
      b.appendChild(h("span", { "class": "sgb-rail-num" }, String(i + 1)));
      b.appendChild(h("span", { "class": "sgb-rail-title" }, t("board.cards." + id + ".title")));
      b.appendChild(h("span", { "class": "sg-visually-hidden" }, t("journey.concepts." + st)));
      if (B.spotlight === id) b.appendChild(h("span", { "class": "sgb-rail-flag" }, SG.ui.icon("star", { size: 12 }), t("board.spotlight")));
      if (B.view === "one" && B.index === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
  }

  /* ---------------------------------------------------------------- showing cards */

  function ensureCard(B, i) {
    if (B.built[i]) return B.built[i];
    var card = buildCard(B, i);
    B.built[i] = card;
    B.slots[i].appendChild(card.el);
    return card;
  }

  function cardShown(B, i) {
    var card = ensureCard(B, i);
    refit(card.cc);
    if (card.cc.onShow) card.cc.onShow();
    return card;
  }

  /** Move to card i in the one-by-one view. `focus` moves the keyboard / reader to the new card's title (design 5.4). */
  function goTo(B, i, focus) {
    if (B.view === "all") {
      var slot = B.slots[i];
      cardShown(B, i);
      if (focus) { SG.ui.a11y.focus(B.built[i].title, { preventScroll: true }); scrollToEl(slot); }
      return slot;
    }
    B.index = Math.max(0, Math.min(CARDS.length - 1, i));
    if (!B.userExpanded) setCompact(B, B.index > 0);
    B.slots.forEach(function (s, j) { s.hidden = j !== B.index; });
    var card = cardShown(B, B.index);
    B.slots[B.index].classList.remove("is-entering");
    void B.slots[B.index].offsetWidth;            // restart the short entrance fade (calm motion switches it off in CSS)
    B.slots[B.index].classList.add("is-entering");
    openCards(B, [CARDS[B.index]]);
    updateBar(B);
    if (focus) {
      SG.ui.a11y.focus(card.title, { preventScroll: true });
      scrollToEl(B.slots[B.index]);
      SG.ui.a11y.announce(t("board.cardOf", { n: B.index + 1, max: CARDS.length }) + ": " + t("board.cards." + CARDS[B.index] + ".title"));
    }
    return B.slots[B.index];
  }

  function updateBar(B) {
    var last = B.index === CARDS.length - 1;
    B.btnBack.disabled = B.index === 0;
    B.btnNext.textContent = last ? t("board.nav.finish") : t("board.nav.nextCard");
    B.btnIndex.textContent = (B.index + 1) + " / " + CARDS.length;
    B.btnIndex.setAttribute("aria-label", t("board.cardOf", { n: B.index + 1, max: CARDS.length }) + ". " + t("board.nav.jump"));
    refreshRail(B);
  }

  function setView(B, view) {
    B.view = view;
    B.root.classList.toggle("is-all", view === "all");
    B.bar.hidden = view === "all";
    B.btnOne.setAttribute("aria-pressed", view === "one" ? "true" : "false");
    B.btnAll.setAttribute("aria-pressed", view === "all" ? "true" : "false");
    stopWatching(B);
    if (view === "all") {
      setCompact(B, false);
      B.slots.forEach(function (s, i) { s.hidden = false; cardShown(B, i); });
      B.after.hidden = false;
      watchOpening(B);
      refreshRail(B);
    } else {
      B.after.hidden = !B.finished;
      goTo(B, B.index, false);
    }
  }

  function stopWatching(B) {
    if (B.watcher) { B.watcher.disconnect(); B.watcher = null; }
  }

  /**
   * Show-all view: a card counts as opened only once half of it (or half the screen, for a card taller than the
   * screen) is in view, so scrolling past the top does not hand out Squeeze Master. Without IntersectionObserver
   * everything counts at once.
   */
  function watchOpening(B) {
    if (typeof IntersectionObserver === "undefined") { openCards(B, CARDS.slice()); return; }
    B.watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var screenH = (e.rootBounds && e.rootBounds.height) || window.innerHeight || 600;
        var seen = e.intersectionRatio >= 0.5 || e.intersectionRect.height >= screenH * 0.5;
        if (e.isIntersecting && seen) {
          var id = e.target.getAttribute("data-card");
          B.watcher.unobserve(e.target);
          openCards(B, [id]);
        }
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    B.slots.forEach(function (slot, i) { if (!B.opened[CARDS[i]]) B.watcher.observe(slot); });
    SG.ui.track(function () { stopWatching(B); });
  }

  function finish(B) {
    B.finished = true;
    B.after.hidden = false;
    SG.ui.a11y.focus(B.afterTitle, { preventScroll: true });
    scrollToEl(B.after);
    SG.ui.a11y.announce(t("board.nav.whatNext"));
  }

  function buildControls(B) {
    B.btnOne = SG.ui.button(t("board.nav.oneAtATime"), { cls: "sg-btn--pill", attrs: { "aria-pressed": "true" }, onClick: function () { if (B.view !== "one") setView(B, "one"); } });
    B.btnAll = SG.ui.button(t("board.nav.showAll"), { cls: "sg-btn--pill", attrs: { "aria-pressed": "false" }, onClick: function () { if (B.view !== "all") setView(B, "all"); } });
    var quick = SG.ui.button(t("board.nav.quickView"), { cls: "sg-btn--pill", attrs: { "aria-pressed": "false" } });
    quick.addEventListener("click", function () {
      var on = quick.getAttribute("aria-pressed") !== "true";
      quick.setAttribute("aria-pressed", on ? "true" : "false");
      quick.textContent = t(on ? "board.nav.fullView" : "board.nav.quickView");
      B.root.classList.toggle("is-quick", on);
    });
    var spotBtn = SG.ui.button(t("board.nav.goSpotlight", { title: t("board.cards." + B.spotlight + ".title") }), {
      kind: "link", icon: "star", onClick: function () { jumpTo(B, CARDS.indexOf(B.spotlight)); }
    });
    return h("div", { "class": "sgb-controls" },
      h("div", { "class": "sgb-seg", role: "group", "aria-label": t("board.title") }, B.btnOne, B.btnAll, quick),
      h("p", { "class": "sgb-spot" }, h("strong", null, t("board.spotlight") + ": "), spotBtn));
  }

  /** Jump from anywhere (spotlight link, Journey concepts): open that card, or scroll to it in the all view. */
  function jumpTo(B, i) {
    if (B.view === "all") {
      var card = cardShown(B, i);
      SG.ui.a11y.focus(card.title, { preventScroll: true });
      scrollToEl(B.slots[i]);
    } else goTo(B, i, true);
  }

  function buildBar(B) {
    B.btnBack = SG.ui.button(t("board.nav.prevCard"), { icon: "chevronLeft", onClick: function () { goTo(B, B.index - 1, true); } });
    B.btnIndex = h("button", { type: "button", "class": "sg-btn sg-btn--pill sgb-index", "aria-controls": "sgb-rail" });
    B.btnIndex.addEventListener("click", function () { B.rail.classList.toggle("is-open"); });
    B.btnNext = SG.ui.button("", { kind: "primary", onClick: function () {
      if (B.index >= CARDS.length - 1) finish(B); else goTo(B, B.index + 1, true);
    } });
    B.bar = h("div", { "class": "sg-bottombar sgb-bar" }, B.btnBack, B.btnIndex, B.btnNext);
    return B.bar;
  }

  /** The "what next" panel (DB-015, GP-116, GP-107). */
  function buildAfter(B) {
    var r = B.record, two = r.mode === "twoPlayer";
    var base = { mode: r.mode, tier: r.tier, peek: r.peek };
    function nextSentence() {
      if (two) SG.app.go("twoplayer");
      else SG.app.go("play", Object.assign({}, base, { seed: SG.app.newSeed() }));
    }
    function again() {
      SG.app.go("play", Object.assign({}, base, { sentence: r.sentence, puzzleId: r.puzzleId, seed: r.seed, replay: true }));
    }
    function change() {
      if (two) SG.app.go("home");
      else SG.app.go("setup", { mode: r.mode === "peephole" ? "peephole" : "classic", tier: r.tier });
    }
    B.afterTitle = h("h2", { "class": "sgb-after-title", tabindex: "-1" }, t("board.nav.whatNext"));
    B.after = h("section", { "class": "sg-card sgb-after", hidden: true, "aria-labelledby": "sgb-after-h" }, B.afterTitle,
      h("div", { "class": "sgb-after-grid" },
        SG.ui.button(two ? t("board.after.swap") : t("board.after.next"), { kind: "primary", onClick: nextSentence }),
        SG.ui.button(t("board.after.again"), { onClick: again }),
        SG.ui.button(t("board.after.change"), { onClick: change }),
        SG.ui.button(t("board.after.home"), { onClick: function () { SG.app.go("home"); } }),
        SG.ui.button(t("board.after.journey"), { onClick: function () { SG.app.go("journey"); } })));
    B.afterTitle.id = "sgb-after-h";
    return B.after;
  }

  /* ================================================================ screen */

  function renderMissing(root) {
    root.appendChild(h("div", { "class": "sg-stack" },
      SG.ui.h1(t("board.title")),
      h("div", { "class": "sg-card sg-center" }, SG.ui.robo.create("neutral", 96, { layout: "stack", bubble: false }), h("p", null, t("board.missing"))),
      SG.ui.button(t("ui.home"), { kind: "primary", onClick: function () { SG.app.go("home"); } })));
  }

  function render(root, params) {
    params = params || {};
    var profile = SG.app.profile;
    var record = resolveRecord(profile, params);
    if (!record || !record.ranks || !record.ranks.length) { renderMissing(root); return; }
    if (!profile.cards) profile.cards = {};

    var S = SG.info.summarize(record, SG.robo, SG.app.corpusCurve());   // once; every card reads from this (DB-014)
    var B = {
      root: null, profile: profile, record: record, S: S, params: params,
      rot: {}, seen: {}, opened: {}, corner: {}, built: [], slots: [], view: "one", index: 0, finished: false, knee: null
    };
    var salt = 0;
    String(record.id || record.ts || "").split("").forEach(function (ch) { salt += ch.charCodeAt(0); });
    CARDS.forEach(function (id, i) {
      var n = (profile.cards[id] && profile.cards[id].opened) || 0;
      B.rot[id] = n + salt + i;           // rotates with every visit and differs per round, but never uses a random number
      B.seen[id] = n > 0;
    });
    B.spotlight = pickSpotlight(profile);

    var stage = h("div", { "class": "sgb-stage" });
    CARDS.forEach(function (id) {
      var slot = h("div", { "class": "sgb-slot", hidden: true, "data-card": id });
      B.slots.push(slot);
      stage.appendChild(slot);
    });
    B.toasts = h("div", { "class": "sgb-toasts" });
    var rail = buildRail(B);
    rail.id = "sgb-rail";
    var main = h("div", { "class": "sgb-main" }, buildControls(B), stage, buildAfter(B));
    B.root = h("div", { "class": "sgb" }, buildHeader(B), h("div", { "class": "sgb-body" }, rail, main), buildBar(B), B.toasts);
    root.appendChild(B.root);

    var startAt = params.card ? CARDS.indexOf(params.card) : 0;
    B.index = startAt >= 0 ? startAt : 0;
    setView(B, "one");
  }

  return {
    titleKey: "board.title",
    render: render,
    lib: { pl: pl, bitsStr: bitsStr, statsOf: statsOf, isPlain: isPlain, CARDS: CARDS, HMAX_TXT: HMAX_TXT }
  };
})();
