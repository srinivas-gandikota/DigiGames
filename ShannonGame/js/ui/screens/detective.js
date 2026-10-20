/* Bit Detective — the warm-up screen (design 03 section 3.10; GP-058..071, DB-028, LG-002, algorithm A10).
 *
 * The child finds a secret symbol among the 27 (A..Z, then SPACE) by asking "Is it before <letter>?".
 * Only AFTER the first finished case does the screen name the idea ("bit") or show how halving works
 * (GP-063, GP-067). Params: none.
 *
 * A case moves through three phases, all drawn inside this one screen:
 *   "play"    tiles + Ask; counters always visible (GP-062); quitting here records nothing (GP-064)
 *   "found"   "Found it!" (not a question); the case is stored HERE, the moment it is solved
 *   "result"  your questions vs the halving best, two shrink ladders, the 0/1 secret code, and, after the
 *             first case only, the naming line; a trick offer when you needed more than 5; a summary after
 *             every third case; links on to the next case, Home and Classic
 *
 * Controls (GP-060, UX-061, design C9): the control is the TILE. Choosing tile T proposes the divider just
 * before it ("Is it before T?"; T belongs to the "after" side), then the 56 px Ask button asks. Two taps, so a
 * stray tap never costs a question. A tile that would not split the remaining range (a ruled-out tile, or the
 * first one still possible) is aria-disabled and never costs anything (GP-061).
 * Keyboard: letter keys (and the space bar for SPACE) choose a tile, Enter asks, arrows move between tiles.
 *
 * Stored per finished case in profile.detective (architecture section 5):
 *   {ts, secret, questions, best, ranges:[[lo,hi],...], answers:"10011", variant:"plain"}
 * `ranges` has one [lo,hi) pair per question asked (the range left AFTER that question; the starting range
 * [0,27) is implicit), so sizes are 27 -> hi-lo -> ...; `answers` is the 1 (yes) / 0 (no) string.
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.detective = (function () {
  var h = SG.ui.h, t = SG.ui.t;
  var ORDER = SG.bits.ORDER;
  var SIZE = ORDER.length;               // 27
  var SET_SIZE = 3;                      // cases come in sets of three (GP-069)
  var TRICK_FRAME_MS = 1500;             // 4 frames = the "6-second animation" of design 3.10
  var TRICK_FRAMES = 4;

  var lastSecret = null;                 // the previous case's secret in this page session (GP-058)
  var leaveHook = null;                  // requestLeave of the screen on show (null when the screen is left)

  /* ================================================================ small helpers */

  function name(i) { return SG.ui.fmt.letterName(ORDER.charAt(i)); }

  function isCalm() { return !!(SG.ui.theme && SG.ui.theme.isCalm()); }

  function profile() { return SG.app.profile; }

  function scrollTop() { try { window.scrollTo(0, 0); } catch (e) { /* not available */ } }

  /**
   * The reference "halving best" for one secret: always ask about the middle of what is left
   * (SG.bits.bestSplit), starting from the full range. Deterministic, so it is 4 or 5 for every symbol
   * (GP-065). Returns {questions, answers, ranges:[[lo,hi],...]}.
   */
  function halving(secretCh) {
    var det = { secret: secretCh, lo: 0, hi: SIZE, questions: 0, answers: "", done: false };
    var ranges = [];
    while (!det.done) {
      det = SG.bits.ask(det, SG.bits.bestSplit(det)).det;
      ranges.push([det.lo, det.hi]);
    }
    return { questions: det.questions, answers: det.answers, ranges: ranges };
  }

  /** A fresh secret that differs from the one before (GP-058). */
  function drawDetective() {
    var storedLast = profile().detective.length ? profile().detective[profile().detective.length - 1].secret : null;
    var avoid = lastSecret != null ? lastSecret : storedLast;
    var rand = SG.rng.mulberry32(SG.app.newSeed());
    var det = SG.bits.create(rand), guard = 0;
    while (det.secret === avoid && guard++ < 100) det = SG.bits.create(rand);
    lastSecret = det.secret;
    return det;
  }

  /** Wrap the first whole word "bit" in <strong> (text nodes only; no HTML from copy). */
  function emphasiseBit(text) {
    var m = /\bbits?\b/i.exec(text);
    if (!m) return [text];
    return [text.slice(0, m.index), h("strong", null, m[0]), text.slice(m.index + m[0].length)];
  }

  /** "1 0 0 1 1" as chips: the digit AND the fill carry the meaning (never colour alone). */
  function codeChips(answers, who) {
    var words = answers.split("").map(function (b) { return t(b === "1" ? "detective.yes" : "detective.no"); }).join(", ");
    var row = h("span", { "class": "sg-det-code", role: "img", "aria-label": t("detective.codeAria", { who: who, list: words }) });
    answers.split("").forEach(function (b) {
      row.appendChild(h("span", { "class": "sg-det-bit " + (b === "1" ? "is-one" : "is-zero"), "aria-hidden": "true" }, b));
    });
    return row;
  }

  /* ================================================================ the screen */

  function render(root) {
    var st = null;               // the current case (see startCase)
    var tiles = [];              // 27 tile buttons
    var els = {};                // named pieces of the play view
    var heldSpace = false;

    leaveHook = requestLeave;
    SG.app.shell.configure({ onHome: function () { requestLeave(function () { SG.app.go("home"); }); } });

    /* ---------------------------------------------------------- leaving (GP-064, UX-070) */

    /** Quitting mid-case stores nothing; if questions were asked, a light dialog checks first. */
    function requestLeave(leave) {
      if (!st || st.phase !== "play" || st.det.questions === 0) { leave(); return; }
      SG.ui.dialogs.choose({
        title: t("detective.leave.title"), text: t("detective.leave.body"), mood: "neutral",
        buttons: [
          { id: "keep", label: t("detective.leave.keep"), primary: true },
          { id: "leave", label: t("detective.leave.leave") }
        ],
        safeId: "keep"
      }).then(function (id) { if (id === "leave") leave(); });
    }

    /* ---------------------------------------------------------- starting a case */

    function startCase() {
      var p = profile();
      st = {
        det: drawDetective(),
        ranges: [],                       // [lo,hi] after each question
        selected: null,                   // tile index of the proposed divider
        hint: "",
        phase: "play",
        roving: 1,
        caseNo: (p.detective.length % SET_SIZE) + 1,
        firstEver: p.detective.length === 0,
        result: null
      };
      mountPlay();
    }

    /* ---------------------------------------------------------- play view */

    function mountPlay() {
      SG.ui.clear(root);
      tiles = [];
      els = {};
      var det = st.det;

      els.title = SG.ui.h1(t("detective.caseOf", { n: st.caseNo, max: SET_SIZE }));
      els.robo = SG.ui.robo.create("thinking", 64, { layout: "row" });
      els.robo.say(SG.ui.pick("detective.robo.start"), { essential: true, silent: true });

      els.asked = h("span", { "class": "sg-det-stat" });
      els.possible = h("span", { "class": "sg-det-stat" });

      els.strip = h("div", { "class": "sg-det-strip", role: "group", "aria-label": t("detective.stripLabel", { size: SIZE }) });
      for (var i = 0; i < SIZE; i++) els.strip.appendChild(buildTile(i));

      els.question = h("p", { "class": "sg-det-q" });
      els.ask = SG.ui.button(t("detective.ask"), { kind: "primary", big: true, cls: "sg-det-ask", onClick: onAsk });
      els.bar = h("div", { "class": "sg-det-bar" }, els.question, els.ask);

      els.logList = h("ol", { "class": "sg-det-loglist" });
      els.log = h("section", { "class": "sg-det-log", "aria-labelledby": "sg-det-log-t", hidden: true },
        h("h2", { id: "sg-det-log-t" }, t("detective.logTitle")), els.logList);

      els.root = h("div", { "class": "sg-det sg-stack" },
        els.title,
        st.firstEver ? h("p", { "class": "sg-det-goal" }, t("detective.goal")) : null,   // GP-063: the goal only, first case only
        els.robo,
        h("div", { "class": "sg-det-counters" }, els.asked, els.possible),
        els.strip, els.bar, els.log);
      root.appendChild(els.root);

      paint();
      SG.ui.a11y.focus(els.title, { preventScroll: true });
    }

    function buildTile(i) {
      var ch = ORDER.charAt(i), isSpace = ch === " ";
      var cap = isSpace
        ? [h("span", { "class": "sg-det-glyph", "aria-hidden": "true" }, SG.alphabet.label(" ")),
           h("span", { "class": "sg-det-word", "aria-hidden": "true" }, t("play.spaceKey"))]
        : h("span", { "class": "sg-det-cap", "aria-hidden": "true" }, ch);
      var b = h("button", {
        type: "button", "class": "sg-det-tile" + (isSpace ? " sg-det-tile--space" : ""),
        "data-i": i, tabindex: "-1"
      }, cap, h("span", { "class": "sg-det-x", "aria-hidden": "true" }, SG.ui.icon("cross", { size: 14 })));
      b.addEventListener("click", function () { choose(i, false); });
      b.addEventListener("keydown", onTileNav);
      tiles.push(b);
      return b;
    }

    /** Redraw tiles, counters and the question bar from the case state. */
    function paint() {
      var det = st.det, lo = det.lo, hi = det.hi, over = det.done;
      tiles.forEach(function (b, i) {
        var out = i < lo || i >= hi;
        var selectable = !over && i > lo && i < hi;      // GP-061: only dividers that split the rest
        b.classList.toggle("is-out", out);
        b.classList.toggle("is-first", !over && i === lo);
        b.classList.toggle("is-selected", st.selected === i);
        b.classList.toggle("is-secret", over && i === lo);
        if (selectable) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true");
        b.setAttribute("aria-pressed", st.selected === i ? "true" : "false");
        b.setAttribute("aria-label", t(out ? "detective.tileOut" : "detective.tileLeft", { letter: name(i) }));
        b.setAttribute("tabindex", i === st.roving ? "0" : "-1");
      });
      els.asked.textContent = t("detective.asked", { n: det.questions });
      els.possible.textContent = t("detective.possible", { n: hi - lo });
      paintBar();
    }

    function paintBar() {
      if (st.selected != null) {
        els.question.textContent = t("detective.question", { letter: name(st.selected) });
        els.question.classList.remove("is-hint");
        els.ask.removeAttribute("aria-disabled");
      } else {
        els.question.textContent = st.hint || t("detective.pickHint");
        els.question.classList.toggle("is-hint", true);
        els.ask.setAttribute("aria-disabled", "true");
      }
    }

    /* ---------------------------------------------------------- choosing and asking */

    function selectable(i) { return !st.det.done && i > st.det.lo && i < st.det.hi; }

    /** A tile was tapped (or its letter typed). `moveFocus`: physical keys focus the chosen tile. */
    function choose(i, moveFocus) {
      if (!st || st.phase !== "play") return;
      if (!selectable(i)) {                       // GP-061: free, with a gentle reason
        st.hint = t("detective.dividerOff");
        st.selected = null;
        paintBar();
        SG.ui.a11y.announce(st.hint);
        return;
      }
      st.hint = "";
      st.selected = i;
      st.roving = i;
      paint();
      if (moveFocus) tiles[i].focus({ preventScroll: true });
      SG.ui.a11y.announce(t("detective.question", { letter: name(i) }));
    }

    function onAsk() {
      if (!st || st.phase !== "play") return;
      if (st.selected == null || !selectable(st.selected)) return;   // aria-disabled: nothing happens
      var m = st.selected, letter = name(m);
      var res = SG.bits.ask(st.det, m);
      st.det = res.det;
      st.ranges.push([res.det.lo, res.det.hi]);
      st.selected = null;
      st.hint = "";
      var fromSize = st.ranges.length > 1 ? st.ranges[st.ranges.length - 2][1] - st.ranges[st.ranges.length - 2][0] : SIZE;
      var toSize = res.det.hi - res.det.lo;
      addLogEntry(st.ranges.length, letter, res.answer, fromSize, toSize);
      SG.sound.play(res.answer ? "yes" : "no");

      if (res.det.done) { finishCase(); return; }

      st.roving = res.det.lo + 1;                 // the first tile that can still split the rest
      paint();
      els.robo.say(SG.ui.pick(res.answer ? "detective.robo.yes" : "detective.robo.no", { letter: letter }),
        { mood: "neutral", essential: true, silent: true });
      SG.ui.a11y.announce(t("detective.liveAnswer", {
        letter: letter, answer: t(res.answer ? "detective.yes" : "detective.no"), n: toSize
      }));
      tiles[st.roving].focus({ preventScroll: true });   // design 5.4: focus goes back to the strip
    }

    function addLogEntry(n, letter, yes, from, to) {
      els.log.hidden = false;
      els.logList.appendChild(h("li", null,
        t("detective.question", { letter: letter }), " ",
        h("span", { "class": "sg-det-ans " + (yes ? "is-yes" : "is-no") },
          SG.ui.icon(yes ? "check" : "cross", { size: 16 }), t(yes ? "detective.yes" : "detective.no")), " ",
        h("span", { "class": "sg-det-sizes" }, "(" + t("detective.logCount", { from: from, to: to }) + ")")));
    }

    /* ---------------------------------------------------------- keyboard (GP-060; design 5.1 patterns) */

    /** Arrow keys move between tiles (roving tabindex); they never ask anything. */
    function onTileNav(e) {
      var b = e.currentTarget, i = Number(b.getAttribute("data-i")), to = -1;
      if (e.key === "ArrowRight") to = i + 1;
      else if (e.key === "ArrowLeft") to = i - 1;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = SIZE - 1;
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") to = verticalTile(b, e.key === "ArrowDown" ? 1 : -1);
      else return;
      e.preventDefault();
      if (to < 0 || to >= SIZE) return;
      st.roving = to;
      tiles.forEach(function (x, k) { x.setAttribute("tabindex", k === to ? "0" : "-1"); });
      tiles[to].focus({ preventScroll: true });
    }

    /** Index of the tile in the next/previous grid row that is closest in column (-1 if none). */
    function verticalTile(btn, dir) {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, best = -1, bestScore = 1e9;
      tiles.forEach(function (b, k) {
        var q = b.getBoundingClientRect();
        var dy = (q.top + q.height / 2) - (r.top + r.height / 2);
        if (dir * dy < r.height / 2) return;
        var score = Math.abs(dy) * 4 + Math.abs(q.left + q.width / 2 - cx);
        if (score < bestScore) { bestScore = score; best = k; }
      });
      return best;
    }

    function onDocKeyDown(e) {
      if (!st || st.phase !== "play") return;
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (SG.ui.dialogs.isOpen() || SG.ui.a11y.isTypingTarget(document.activeElement)) return;
      var k = e.key, idx = -1;
      if (k === " ") idx = SIZE - 1;                              // the space bar chooses SPACE, never "press the button"
      else if (k && k.length === 1 && /^[a-z]$/i.test(k)) idx = ORDER.indexOf(k.toUpperCase());
      if (idx >= 0) {
        e.preventDefault();
        if (k === " ") heldSpace = true;
        if (!e.repeat) choose(idx, true);
        return;
      }
      if (k === "Enter" && !e.repeat && st.selected != null) {
        var tgt = e.target, onTile = tgt && tgt.classList && tgt.classList.contains("sg-det-tile");
        if (tgt && tgt.tagName === "BUTTON" && !onTile) return;                        // Ask / other buttons: native
        if (onTile && Number(tgt.getAttribute("data-i")) !== st.selected) return;      // native: choose that tile
        e.preventDefault();
        onAsk();
      }
    }

    function onDocKeyUp(e) {
      if (e.key === " " && heldSpace) { e.preventDefault(); heldSpace = false; }       // no stray button click
    }

    SG.ui.on(document, "keydown", onDocKeyDown);
    SG.ui.on(document, "keyup", onDocKeyUp);

    /* ---------------------------------------------------------- found it (and storing the case) */

    function finishCase() {
      var p = profile(), det = st.det;
      var best = halving(det.secret);
      var wasFirst = p.detective.length === 0;
      var badgeIds = SG.badges.evaluate(p, { type: "bitDetective", questions: det.questions });
      var entry = {
        ts: SG.app.now(), secret: det.secret, questions: det.questions, best: best.questions,
        ranges: st.ranges.map(function (r) { return [r[0], r[1]]; }),
        answers: det.answers, variant: "plain"
      };
      SG.storage.addDetective(p, entry);
      if (badgeIds.length) SG.storage.award(p, badgeIds, entry.ts);
      SG.app.save();

      st.phase = "found";
      st.selected = null;
      st.result = { entry: entry, best: best, wasFirst: wasFirst, badgeIds: badgeIds, total: p.detective.length };
      paint();                                    // the secret tile is now the only bright one and enlarges
      showFound();
    }

    function showFound() {
      var letter = name(st.det.lo);
      var line = t("detective.foundLine", { letter: letter });
      SG.sound.play("finish");
      els.robo.say(t("detective.found") + " " + line, { mood: "happy", essential: true, silent: true });
      SG.ui.a11y.announce(t("detective.found") + " " + line);
      var head = h("h2", { tabindex: "-1", "data-sg-focus": "" }, t("detective.found"));
      var seeBtn = SG.ui.button(t("detective.seeResult"), { kind: "primary", big: true, onClick: showResult });
      var box = h("div", { "class": "sg-det-found" }, head, h("p", null, line), seeBtn);
      els.bar.replaceWith(box);
      els.found = box;
      SG.ui.a11y.focus(seeBtn, { preventScroll: true });
    }

    /* ---------------------------------------------------------- result view (GP-065..071) */

    function showResult() {
      var res = st.result, entry = res.entry, best = res.best, p = profile();
      st.phase = "result";
      SG.ui.clear(root);
      var q = entry.questions, secretIdx = ORDER.indexOf(entry.secret);
      var good = q <= best.questions;

      var title = SG.ui.h1(t("detective.result.title"));
      var robo = SG.ui.robo.create(good ? "happy" : "curious", 64, { layout: "row" });
      robo.say(SG.ui.pick(good ? "detective.result.robo.good" : "detective.result.robo.more"), { essential: true, silent: true });

      // Your questions next to the halving best, and the fixed claim (GP-065).
      var score = h("section", { "class": "sg-card sg-det-score", "aria-label": t("detective.result.title") },
        h("span", { "class": "sg-det-bigtile", "aria-hidden": "true" },
          entry.secret === " " ? t("play.spaceKey") : entry.secret),
        h("div", { "class": "sg-det-lines" },
          h("p", { "class": "sg-det-line" }, q === 1 ? t("detective.result.youOne") : t("detective.result.you", { n: q })),
          h("p", { "class": "sg-det-line" }, t("detective.result.best", { best: best.questions })),
          h("p", { "class": "sg-det-never" }, t("detective.result.never", { worst: SG.bits.WORST }))));

      // Two shrink paths, 27 -> ... -> 1 (GP-066).
      function ladderCard(label, ranges) {
        var box = h("div", { "class": "sg-det-chartbox" });
        var card = h("div", { "class": "sg-card sg-det-ladder" }, box);
        card._mount = function () {
          SG.ui.charts.mount(box, SG.ui.charts.rangeLadder({
            rows: ranges.map(function (r) { return { lo: r[0], hi: r[1] }; }),
            total: SIZE, label: label, ariaLabel: label, secret: { index: secretIdx }
          }));
        };
        return card;
      }
      var youCard = ladderCard(t("detective.result.pathYou"), entry.ranges);
      var halfCard = ladderCard(t("detective.result.pathHalving"), best.ranges);
      var ladders = h("div", { "class": "sg-det-ladders" }, youCard, halfCard);

      // The yes/no answers as a 0/1 secret code (A10).
      var code = h("section", { "class": "sg-card sg-det-codebox" },
        h("p", { "class": "sg-det-codetitle" }, t("detective.codeTitle")),
        h("div", { "class": "sg-det-coderow" },
          h("span", { "class": "sg-det-codewho" }, t("detective.codeYou")), codeChips(entry.answers, t("detective.codeYou"))),
        h("div", { "class": "sg-det-coderow" },
          h("span", { "class": "sg-det-codewho" }, t("detective.codeHalving")), codeChips(best.answers, t("detective.codeHalving"))));

      // After the FIRST case only: name the idea (GP-067).
      var naming = res.wasFirst
        ? h("section", { "class": "sg-note sg-det-naming" },
            h("p", null, emphasiseBit(t("detective.naming", { worst: SG.bits.WORST, max: SG.ui.fmt.bits2(SG.alphabet.HMAX) }))))
        : null;

      // Optional trick when more than 5 questions were used (GP-068).
      var trick = q > SG.bits.WORST ? buildTrick(secretIdx) : null;

      // Sets of three: after the third case, average vs the 4.75 of "no clues" (GP-069).
      var summary = null;
      if (res.total % SET_SIZE === 0) {
        var lastThree = p.detective.slice(-SET_SIZE), sum = 0;
        lastThree.forEach(function (d) { sum += d.questions; });
        summary = h("section", { "class": "sg-card sg-det-summary" },
          h("h2", null, t("detective.setSummary.title")),
          h("p", null, t("detective.setSummary.line", { avg: SG.ui.fmt.avg1(sum / lastThree.length), max: SG.ui.fmt.bits2(SG.alphabet.HMAX) })));
      }

      // A gentle toast for a newly earned badge (never about speed).
      var toast = null;
      if (res.badgeIds.length) {
        toast = h("div", { "class": "sg-det-toast" }, res.badgeIds.map(function (id) {
          return h("p", null, t("badges." + id + ".emoji") + " " + t("badges.newBadge", { name: t("badges." + id + ".name") }));
        }));
        SG.sound.play("badge");
      }

      var actions = h("div", { "class": "sg-det-actions" },
        SG.ui.button(t("detective.another"), { kind: "primary", big: true, onClick: nextCase }),
        SG.ui.button(t("ui.home"), { onClick: function () { SG.app.go("home"); } }),
        SG.ui.button(t("detective.toClassic"), { kind: "link", onClick: function () { SG.app.go("setup", { mode: "classic" }); } }));

      root.appendChild(h("div", { "class": "sg-det sg-det--result sg-stack" },
        title, robo, score, toast, naming, ladders, code, trick, summary, actions));
      youCard._mount();
      halfCard._mount();
      res.badgeIds = [];
      scrollTop();
      SG.ui.a11y.focus(title, { preventScroll: true });
    }

    function nextCase() {
      startCase();
      scrollTop();
    }

    /* ---------------------------------------------------------- the trick: try the middle (GP-068) */

    function buildTrick(secretIdx) {
      // Frames follow the halving path for THIS secret: the full range, then what is left after each middle question.
      var path = [[0, SIZE]].concat(halving(ORDER.charAt(secretIdx)).ranges)
        .filter(function (r) { return r[1] - r[0] >= 2; }).slice(0, TRICK_FRAMES);
      var calm = false;                        // re-read at every play(): the setting may change between shows
      var stage = h("div", { "class": "sg-det-trickstage", role: "group", "aria-label": t("detective.trickLabel"), tabindex: "-1", hidden: true });
      var again = SG.ui.button(t("detective.trickAgain"), { cls: "sg-btn--pill", onClick: function () { play(); } });
      again.hidden = true;
      var cancelTimer = null;

      function frameEl(range, n) {
        var m = SG.bits.bestSplit({ lo: range[0], hi: range[1] });
        var cells = h("div", { "class": "sg-det-mini", "aria-hidden": "true" });
        for (var i = 0; i < SIZE; i++) {
          var cls = "sg-det-cell" + (i >= range[0] && i < range[1] ? " is-live" : "") + (i === m ? " is-cut" : "");
          cells.appendChild(h("span", { "class": cls }));
        }
        var caption = t("detective.trickFrame", { letter: name(m), a: m - range[0], b: range[1] - m });
        return h("figure", { "class": "sg-det-frame" }, cells,
          h("figcaption", null, calm ? t("detective.trickStill", { n: n }) + ": " + caption : caption));
      }

      function play() {
        calm = isCalm();
        if (cancelTimer) cancelTimer();
        SG.ui.clear(stage);
        again.hidden = true;
        if (calm) {                               // calm: three still frames, nothing moves (UX-059)
          path.slice(0, 3).forEach(function (r, i) { stage.appendChild(frameEl(r, i + 1)); });
          return;
        }
        var i = 0;
        // Sighted viewers watch the frames in turn; screen readers get every step as plain text.
        var sr = h("ol", { "class": "sg-visually-hidden" }, path.map(function (r) {
          var m = SG.bits.bestSplit({ lo: r[0], hi: r[1] });
          return h("li", null, t("detective.trickFrame", { letter: name(m), a: m - r[0], b: r[1] - m }));
        }));
        var holder = h("div", { "aria-hidden": "true" });
        stage.appendChild(holder);
        stage.appendChild(sr);
        (function step() {
          SG.ui.clear(holder);
          holder.appendChild(frameEl(path[i], i + 1));
          i++;
          if (i < path.length) cancelTimer = SG.ui.later(step, TRICK_FRAME_MS);
          else again.hidden = false;
        })();
      }

      var show = SG.ui.button(t("detective.trickButton"), { cls: "sg-btn--pill", onClick: function () {
        show.hidden = true;
        stage.hidden = false;
        play();
        SG.ui.a11y.focus(stage, { preventScroll: true });
      } });
      return h("section", { "class": "sg-card sg-det-trick" },
        h("h2", null, t("detective.trick")), h("p", null, t("detective.trickBody")), show, stage, again);
    }

    /* ---------------------------------------------------------- go */

    startCase();
    return function cleanup() { leaveHook = null; st = null; };
  }

  /** Browser Back: the same "Leave this case?" check as the Home button (the router has already re-pushed history). */
  function onBack() {
    var goHome = function () { SG.app.go("home"); };
    if (leaveHook) leaveHook(goHome); else goHome();
  }

  return { titleKey: "detective.title", render: render, onBack: onBack };
})();
