/* Play screen (design 03 section 3.6, 5.1, 5.2, 5.6, 5.7; GP-021..057, GP-075..081, GP-103..117, UX-002..009, UX-012, UX-020..023, UX-034, UX-070..072).
 *
 * Params: {mode: "classic"|"peephole"|"twoPlayer", tier, peek, sentence?, puzzleId?, seed?, replay?, resume?}
 *   - twoPlayer / replay of a stored sentence: `sentence` is given (already clean).
 *   - replay of a library puzzle: `puzzleId`;  replay of Gibberish: `seed` (+ replay: true).
 *   - resume: true restores profile.inProgress exactly.
 * Navigation: when the round ends (last letter, or "Stop here" with >= MIN_PARTIAL letters) the RoundRecord is
 * built and stored HERE, then go("roboplays", {record, newBadges}). Nothing about the sentence's length or
 * unrevealed text is ever drawn (GP-019, GP-022); Peephole draws ONE fixed-size fog tile (GP-076).
 *
 * The screen keeps one state object `S` (the round plus a few handles to DOM nodes). All state lives in
 * the core Round (SG.game) so resizing or re-rendering can never change a guess count (UX-072).
 */
window.SG = window.SG || {};
SG.screens = SG.screens || {};

SG.screens.play = (function () {
  "use strict";
  var h = SG.ui.h, t = SG.ui.t;

  var S = null;                    // state of the round on screen (only one screen is alive at a time)
  var TOAST_MS = 1400;             // "Got it in 3!" stays at least 1 s (UX-007)
  var IDLE_MS = 60000;             // Robo dozes off after a minute of nothing (UX-022): no text, no sound
  var MODES = ["classic", "peephole", "twoPlayer"];
  var REAL_TIERS = ["easy", "medium", "hard"];

  /* ================================================================ 1. choosing and restoring the round */

  function findPuzzle(id) {
    var list = SG.content.puzzles;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /** Library puzzle ids this device has played, oldest first (SG.content.pick wants newest last). */
  function playedPuzzleIds(profile) {
    return profile.rounds.map(function (r) { return r.puzzleId; }).filter(Boolean);
  }

  /**
   * Decide the sentence of a new round. Priority: a given sentence (two-player, stored replays), a given
   * puzzleId (replay), Gibberish from the seed, otherwise the shuffle-bag pick of the tier (GP-018).
   * A library puzzle this device has already finished is flagged as a replay (GP-117), so the Journey
   * trends can leave it out: remembering helps.
   */
  function chooseSentence(params, profile) {
    var seed = params.seed != null ? params.seed : SG.app.newSeed();
    var spec = { sentence: null, tier: params.tier || "easy", puzzleId: params.puzzleId || null, seed: seed, replay: !!params.replay };
    if (typeof params.sentence === "string" && params.sentence) {
      spec.sentence = SG.alphabet.clean(params.sentence);
      return spec;
    }
    var known = params.puzzleId ? findPuzzle(params.puzzleId) : null;
    if (known) {
      spec.sentence = known.clean; spec.tier = known.tier;
      return spec;
    }
    spec.puzzleId = null;
    if (spec.tier === "gibberish") {
      spec.sentence = SG.content.gibberish(SG.rng.mulberry32(seed));
      return spec;
    }
    if (REAL_TIERS.indexOf(spec.tier) < 0) spec.tier = "easy";   // "surprise" is resolved by Setup; stay safe anyway
    var puzzle = SG.content.pick(spec.tier, SG.rng.mulberry32(seed), playedPuzzleIds(profile));
    spec.sentence = puzzle.clean;
    spec.puzzleId = puzzle.id;
    if (profile.rounds.some(function (r) { return r.puzzleId === puzzle.id; })) spec.replay = true;
    return spec;
  }

  function newRound(params, profile) {
    var mode = MODES.indexOf(params.mode) >= 0 ? params.mode : "classic";
    var spec = chooseSentence(params, profile);
    return SG.game.createRound({
      sentence: spec.sentence, mode: mode, tier: mode === "twoPlayer" ? "custom" : spec.tier,
      peek: mode === "peephole" && params.peek != null ? params.peek : null,
      puzzleId: spec.puzzleId, now: SG.app.now(), seed: spec.seed, replay: spec.replay,
      // Record which content the round was played with (CT-064); explicit so a replay keeps its version.
      contentVersion: SG.data.CONTENT_VERSION
    });
  }

  function isCleanText(s) { return typeof s === "string" && s.length > 0 && SG.alphabet.clean(s) === s; }

  /** The saved round, or null if it is not trustworthy (a broken snapshot must never crash the game). */
  function restoreRound(snap) {
    try {
      if (!snap || !isCleanText(snap.sentence) || MODES.indexOf(snap.mode) < 0) return null;
      var ranks = snap.ranks, revealed = snap.revealed, wrong = snap.wrong || [];
      if (!Array.isArray(ranks) || !Array.isArray(revealed) || !Array.isArray(wrong)) return null;
      if (ranks.length >= snap.sentence.length || revealed.length !== ranks.length) return null;
      if (!ranks.every(function (g) { return g >= 1 && g <= 27; })) return null;
      var target = SG.alphabet.index(snap.sentence.charAt(ranks.length));
      if (!wrong.every(function (s) { return s >= 0 && s <= 26 && s !== target; })) return null;
      var round = SG.game.createRound({
        sentence: snap.sentence, mode: snap.mode, tier: snap.tier, peek: snap.peek, puzzleId: snap.puzzleId,
        now: snap.startedAt, seed: snap.seed, replay: snap.replay, contentVersion: snap.contentVersion
      });
      round.ranks = ranks.slice();
      round.revealed = revealed.map(Boolean);
      round.pos = ranks.length;
      round.wrong = new Set(wrong);
      round.done = false;
      return round;
    } catch (e) { return null; }
  }

  /**
   * Everything needed to restore this exact moment (UX-071). For Two-Player the sentence is stored on
   * this device like any round, but it is never drawn on screen (resume card, History) before the round
   * ends (GP-104). It is not encrypted: a determined grown-up with browser dev tools could read it.
   */
  function snapshot() {
    var r = S.round;
    return {
      v: 1, mode: r.mode, tier: r.tier, peek: r.peek, puzzleId: r.puzzleId, sentence: r.sentence,
      seed: r.seed, replay: r.replay, contentVersion: r.contentVersion, startedAt: r.startedAt,
      ranks: r.ranks.slice(), revealed: r.revealed.slice(), wrong: Array.from(r.wrong),
      streak: S.streak, gibberishHardSaid: S.gibberishHardSaid, savedAt: SG.app.now()
    };
  }

  /** Write the round to the profile and to localStorage. Cheap enough to do after every guess (UX-070). */
  function persist() {
    if (!S || S.finished || (S.round.pos === 0 && S.round.wrong.size === 0)) return;   // nothing to lose yet
    S.profile.inProgress = snapshot();
    SG.app.save();
  }

  /* ================================================================ 2. feedback bands (design 5.2) */

  var CUES = {
    first:  { id: "first",  mood: "happy",  sound: "correct1", pool: "play.feedback.first",  icon: "star",       sparks: 6,  radius: 24, ms: 500, ring: false },
    nice:   { id: "nice",   mood: "happy",  sound: "correct2", pool: "play.feedback.nice",   icon: "check",      sparks: 3,  radius: 20, ms: 300, ring: false },
    tricky: { id: "tricky", mood: "curious", sound: "correct3", pool: "play.feedback.tricky", icon: "magnifier", sparks: 8,  radius: 36, ms: 600, ring: false },
    sneaky: { id: "sneaky", mood: "curious", sound: "correct4", pool: "play.feedback.sneaky", icon: "magnifier", sparks: 12, radius: 56, ms: 700, ring: true }
  };

  /** Bands 1 / 2-3 / 4-9 / 10+ (GP 5.3). "Curious" starts at SG.config.CURIOUS_AT. A bigger count never gets a smaller cue (UX-021). */
  function cueOf(g) {
    if (g === 1) return CUES.first;
    if (g < SG.config.CURIOUS_AT) return CUES.nice;
    return g < 10 ? CUES.tricky : CUES.sneaky;
  }

  function bandOf(g) { return SG.info.surpriseBands([g])[0]; }

  /* ================================================================ 3. building the screen */

  function captionText(round) {
    var mode = t("setup.modes." + round.mode);
    if (round.mode === "twoPlayer") return mode;                 // no tier for a friend's secret sentence
    return t("play.caption", { mode: mode, tier: t("setup.tiers." + round.tier + ".name") });
  }

  function peekLine(round) {
    if (round.mode !== "peephole") return "";
    if (round.peek == null) return t("play.peekWindowAll");
    if (round.peek === 0) return t("play.peekWindowNone");
    return round.peek === 1 ? t("play.peekWindowOne") : t("play.peekWindow", { k: round.peek });
  }

  /** The one fixed-size fog tile: its size never depends on how much text it hides (GP-076). aria-hidden: the panel label speaks for it. */
  function fogTile() {
    var path = SG.ui.s("path", {
      "class": "sg-pl-fog-shape",
      d: "M14 31 C6 31 4 21 11 19 C10 11 20 7 25 12 C29 5 42 8 41 17 C50 15 54 28 45 31 Z"
    });
    return h("span", { "class": "sg-pl-fog", "aria-hidden": "true" },
      SG.ui.s("svg", { viewBox: "0 0 56 36", width: 56, height: 36, focusable: "false" }, path));
  }

  function buildTally() {
    var bars = SG.ui.charts.miniBars({ values: [], maxRows: 2 });
    var text = h("p", { "class": "sg-pl-tally-text" });
    var toggle = h("button", { type: "button", "class": "sg-iconbtn sg-pl-tally-toggle", "aria-expanded": "true" });
    var el = h("section", { "class": "sg-pl-tally", "aria-label": t("play.tally.title") },
      h("div", { "class": "sg-pl-tally-main" }, text, h("div", { "class": "sg-pl-tally-bars" }, bars.el)), toggle);
    return { el: el, bars: bars, text: text, toggle: toggle };
  }

  function buildScreen(root) {
    var round = S.round;
    S.flow = h("div", { "class": "sg-pl-flow" });
    S.fxLayer = h("div", { "class": "sg-pl-fxlayer", "aria-hidden": "true" });
    S.panel = h("div", { "class": "sg-pl-panel", role: "group", tabindex: "0" }, S.flow, S.fxLayer);
    S.hint = h("span", { "class": "sg-pl-hint", "aria-hidden": "true" });
    var peek = peekLine(round);
    var card = h("section", { "class": "sg-pl-card" },
      h("div", { "class": "sg-pl-captionrow" }, h("p", { "class": "sg-pl-caption" }, captionText(round)), S.hint),
      peek ? h("p", { "class": "sg-pl-peekline" }, peek) : null,
      S.panel);

    S.tally = buildTally();
    S.robo = SG.ui.robo.create("neutral", 56, { layout: "row" });
    S.giveBtn = h("button", { type: "button", "class": "sg-btn sg-btn--pill sg-pl-give", "aria-disabled": "true" });
    S.kb = SG.ui.keyboard.create({ onKey: onGuess, onInvalid: showKeyHint });

    S.pauseBtn = h("button", { type: "button", "class": "sg-iconbtn", "aria-label": t("play.pause.label") }, SG.ui.icon("pause", { size: 24 }));
    S.pauseBtn.addEventListener("click", function () { setPaused(true); });
    S.resumeBtn = SG.ui.button(t("play.pause.resume"), { kind: "primary", big: true, onClick: function () { setPaused(false); } });
    S.pauseEl = h("div", { "class": "sg-pl-pause", hidden: true },
      SG.ui.robo.create("sleepy", 96, { bubble: false, layout: "stack" }),
      h("p", { "class": "sg-pl-pause-text" }, t("play.pause.title")), S.resumeBtn);

    S.main = h("div", { "class": "sg-pl-main" },
      card,
      S.tally.el,
      h("div", { "class": "sg-pl-robo" }, S.robo),
      h("div", { "class": "sg-pl-give-row" }, S.giveBtn),
      h("div", { "class": "sg-pl-kb" }, S.kb.el));
    root.appendChild(h("div", { "class": "sg-play", "data-mode": round.mode },
      h("h1", { "class": "sg-visually-hidden", tabindex: "-1" }, captionText(round)), S.main, S.pauseEl));

    S.giveBtn.addEventListener("click", confirmGiveUp);
    S.tally.toggle.addEventListener("click", toggleTally);
  }

  /* ---- the sentence ---------------------------------------------------------------------------------------- */

  function badgeEl(g) {
    var kids = [String(g)];
    if (g === 1) kids.push(SG.ui.icon("star", { size: 9 }));
    return h("span", { "class": "sg-pl-badge sg-band-" + bandOf(g), "aria-hidden": "true" }, kids);
  }

  /** A finished position: the letter (or a soft space marker), a guess-count badge, and for a peek the eye. */
  function letterCell(i, v) {
    var g = S.round.ranks[i], isSpace = v.ch === " ", peeked = v.state === "revealed";
    var cell = h("span", { "class": "sg-pl-cell" + (isSpace ? " is-space" : "") + (peeked ? " is-peeked" : ""), "data-i": i, "aria-hidden": "true" },
      h("span", { "class": "sg-pl-ch" }, isSpace ? "·" : v.ch), badgeEl(g));
    if (peeked) cell.appendChild(h("span", { "class": "sg-pl-eye" }, SG.ui.icon("eye", { size: 11 })));
    return cell;
  }

  /** Redraw the revealed text and the cursor from the core round. Unrevealed positions are never drawn (GP-022). */
  function renderSentence() {
    var round = S.round, view = SG.game.view(round);
    SG.ui.clear(S.flow);
    S.cells = {};
    S.cursorEl = null;
    var group = null, spoken = [], masked = 0;

    function openGroup() {
      group = h("span", { "class": "sg-pl-word" });   // a word is one wrap unit; so is "fog + the first visible part"
      S.flow.appendChild(group);
      return group;
    }

    while (masked < view.length && view[masked].state === "masked") masked++;
    if (masked > 0) openGroup().appendChild(fogTile());      // ALL masked cells collapse into this single tile (GP-076)

    for (var i = masked; i < view.length; i++) {
      var v = view[i];
      if (v.state === "hidden") break;
      if (!group) openGroup();
      if (v.state === "current") {
        S.cursorEl = h("span", { "class": "sg-pl-cell sg-pl-cursor", "aria-hidden": "true" });
        group.appendChild(S.cursorEl);
        break;
      }
      S.cells[i] = letterCell(i, v);
      group.appendChild(S.cells[i]);
      spoken.push(v.ch === " " ? t("play.spaceWord") : v.ch);
      if (v.ch === " ") group = null;                        // the next letter starts a new word
    }

    var label = spoken.length ? t("play.aria.revealedSoFar", { text: spoken.join(", ") }) : t("play.aria.current");
    S.panel.setAttribute("aria-label", masked > 0 ? t("play.fog.label") + " " + label : label);
    ensureCursorVisible();
  }

  /** Keep the cursor line inside the panel without ever scrolling the page (measured, not scrollIntoView). */
  function ensureCursorVisible() {
    var el = S.cursorEl, p = S.panel;
    if (!el || !p) return;
    var top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < p.scrollTop + 22) p.scrollTop = Math.max(0, top - 22);          // 22 px lane for the arrow and the toast
    else if (bottom > p.scrollTop + p.clientHeight - 4) p.scrollTop = bottom - p.clientHeight + 6;
  }

  /* ---- counters, tally, Show me ---------------------------------------------------------------------------- */

  function lettersFoundText(n) { return n === 1 ? t("play.lettersFoundOne") : t("play.lettersFound", { n: n }); }

  function updateCounts() {
    var r = S.round, total = SG.ui.fmt.sum(r.ranks);
    SG.app.shell.configure({ title: lettersFoundText(r.pos) });
    var text = t("play.tally.guesses", { n: total });
    if (r.pos > 0) text += " · " + t("play.tally.last", { n: r.ranks[r.pos - 1] });   // allowed numbers only (GP-040)
    S.tally.text.textContent = text;
  }

  function paintTally(collapsed) {
    S.tally.el.classList.toggle("is-collapsed", collapsed);
    S.tally.toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    S.tally.toggle.setAttribute("aria-label", t(collapsed ? "play.tally.show" : "play.tally.hide"));
    SG.ui.clear(S.tally.toggle);
    S.tally.toggle.appendChild(SG.ui.icon(collapsed ? "chevronDown" : "chevronUp", { size: 20 }));
  }

  function toggleTally() {
    var st = S.profile.settings;
    st.tallyCollapsed = !st.tallyCollapsed;
    paintTally(st.tallyCollapsed);
    SG.app.save();
  }

  /** Disabled with a gentle countdown until SG.config.GIVE_UP_AFTER wrong tries; then "Show me" (GP-042, GP-043). */
  function updateGiveUp() {
    var round = S.round, can = SG.game.canGiveUp(round), left = SG.config.GIVE_UP_AFTER - round.wrong.size;
    S.giveBtn.setAttribute("aria-disabled", can ? "false" : "true");
    SG.ui.clear(S.giveBtn);
    if (can) S.giveBtn.appendChild(SG.ui.icon("eye", { size: 20 }));
    S.giveBtn.appendChild(document.createTextNode(can ? t("play.giveUp.label")
      : left === 1 ? t("play.giveUp.countdownOne") : t("play.giveUp.countdown", { n: left })));
    var justReady = can && !S.giveReady;
    S.giveReady = can;
    return justReady;
  }

  /* ================================================================ 4. a guess */

  /** The ONE path for taps and physical keys (design 5.1). It never blocks: all state changes are synchronous. */
  function onGuess(sym) {
    if (!S || S.finished || S.paused) return;
    wake();
    var res = SG.game.guess(S.round, sym, SG.robo);
    if (res.type === "wrong") afterWrong(sym);
    else if (res.type === "correct") afterCorrect(res.rank, false);
    // "repeat" and "done" change nothing (E5..E8, GP-032)
  }

  /** Robo's bubble + the live announcement. With Quiet Robo on, the optional line is skipped (and not read out). */
  function react(o) {
    S.robo.say(o.line || "", { mood: o.mood, silent: true, essential: !!o.essential });
    S.lastMood = o.mood;
    var spoken = [o.live];
    if (o.line && (o.essential || !SG.ui.robo.isQuiet())) spoken.push(o.line);
    if (o.extra) spoken.push(o.extra);
    // one sentence per part, so a screen reader pauses between "Correct. ... took 3 guesses" and Robo's line
    SG.ui.a11y.announce(spoken.filter(Boolean).map(function (x) { return x.replace(/[.!?]+$/, ""); }).join(". ") + ".");
  }

  function afterWrong(sym) {
    S.kb.setUsed(S.round.wrong);
    S.kb.wobble(sym);
    SG.sound.play("wrong");
    var ready = updateGiveUp();
    var mood = "neutral", line = SG.ui.pick("play.notThis");
    if (ready && S.round.tier === "gibberish" && !S.gibberishHardSaid) {   // GP-113: once, the first time "Show me" opens
      S.gibberishHardSaid = true;
      mood = "curious";
      line = t("robo.gibberishHard");
    }
    react({ mood: mood, line: line, live: t("play.aria.wrong"), extra: ready ? t("play.giveUp.available") : null });
    persist();
  }

  function letterWord(ch) { return ch === " " ? t("play.spaceWord") : ch; }

  /** A position was just resolved by a correct guess or a peek. `peeked` positions never celebrate (GP-048). */
  function afterCorrect(g, peeked) {
    var round = S.round, idx = round.pos - 1, ch = round.sentence.charAt(idx);
    S.kb.reset();
    S.streak = !peeked && g === 1 ? S.streak + 1 : 0;
    if (round.done) return finishRound();       // the Finished screen shows the whole sentence itself
    renderSentence();
    S.tally.bars.push(g, bandOf(g), peeked);
    updateCounts();
    updateGiveUp();
    if (peeked) {
      SG.sound.play("reveal");
      react({ mood: "thinking", line: SG.ui.pick("play.giveUp.revealed"), live: t("play.aria.revealed", { letter: letterWord(ch) }) });
    } else {
      celebrate(idx, ch, g);
    }
    persist();
    if (!S.corpusWarm) {                                  // pay for the look-back curve while the child is busy, not at the end
      S.corpusWarm = true;
      S.timers.push(setTimeout(function () { try { SG.app.corpusCurve(); } catch (e) { /* the Board will retry */ } }, 2500));
    }
  }

  /** Feedback for a correct guess: cue size grows with the guess count, never with speed (UX-020, UX-021). */
  function celebrate(idx, ch, g) {
    var cue = cueOf(g), mood = cue.mood, line, wordEnd = ch === " ";
    var streak = g === 1 && S.streak > 0 && S.streak % 3 === 0;
    if (streak) { mood = "cheering"; line = SG.ui.pick("play.streak3"); }
    else if (wordEnd && cue.id === "nice") line = SG.ui.pick("play.wordDone");
    else line = SG.ui.pick(cue.pool);
    SG.sound.play(cue.sound);
    if (wordEnd) pulseWord(idx);
    showCue(idx, cue, g);
    var live = g === 1 ? t("play.aria.rightOne", { letter: letterWord(ch) }) : t("play.aria.right", { letter: letterWord(ch), n: g });
    var extra = S.round.pos % 5 === 0 ? lettersFoundText(S.round.pos) : null;    // "{n} letters found" every 5 (design 5.5)
    react({ mood: mood, line: line, live: live, extra: extra });
  }

  function pulseWord(idx) {
    var cell = S.cells[idx], word = cell && cell.parentNode;
    if (!word) return;
    word.classList.add("is-pulse");
    later(function () { word.classList.remove("is-pulse"); }, 700);
  }

  /** My own tracked timeout (SG.ui.later would pile one cleanup closure per guess into the router). */
  function later(fn, ms) {
    var id = setTimeout(function () { if (S && S.alive) fn(); }, ms);
    S.timers.push(id);
  }

  /** The toast "Got it in N!", a badge pop and a burst of sparkles around the new letter, in a layer that survives redraws. */
  function showCue(idx, cue, g) {
    var cell = S.cells[idx];
    if (!cell) return;
    cell.classList.add("is-new", "is-cue-" + cue.id);
    var cx = cell.offsetLeft + cell.offsetWidth / 2, top = cell.offsetTop;
    var toast = h("span", { "class": "sg-pl-toast is-cue-" + cue.id, role: "presentation" },
      SG.ui.icon(cue.icon, { size: 14 }), t("play.gotItIn", { n: g }));
    if (S.toast && S.toast.parentNode) S.toast.parentNode.removeChild(S.toast);   // one toast at a time, even when typing fast
    S.toast = toast;
    S.fxLayer.appendChild(toast);
    var w = toast.offsetWidth || 0;
    var maxLeft = S.panel.clientWidth ? S.panel.clientWidth - w - 2 : cx;
    toast.style.left = Math.max(2, Math.min(cx + 14 - w, maxLeft)) + "px";   // right-aligned to the letter: clear of the cursor arrow
    toast.style.top = (top - 2) + "px";
    later(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, TOAST_MS);

    var fx = h("span", { "class": "sg-pl-fx", style: { left: cx + "px", top: (top + cell.offsetHeight / 2) + "px", "--fx-ms": cue.ms + "ms" } });
    for (var k = 0; k < cue.sparks; k++) {
      var a = (k / cue.sparks) * Math.PI * 2;
      fx.appendChild(h("span", { "class": "sg-pl-spark", style: { "--dx": Math.round(Math.cos(a) * cue.radius) + "px", "--dy": Math.round(Math.sin(a) * cue.radius) + "px" } }));
    }
    if (cue.ring) fx.appendChild(h("span", { "class": "sg-pl-ringpulse" }));
    S.fxLayer.appendChild(fx);
    later(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, cue.ms + 100);
  }

  function showKeyHint() {
    S.hint.textContent = t("play.invalidKey");
    SG.ui.a11y.announce(t("play.invalidKey"));
    later(function () { S.hint.textContent = ""; }, 3000);
  }

  /* ================================================================ 5. "Show me" */

  function confirmGiveUp() {
    if (!S || S.finished || S.paused || S.asking || !SG.game.canGiveUp(S.round)) return;   // aria-disabled buttons still click
    var mine = S;
    S.asking = true;                                    // pressed twice: ask once (E9)
    SG.ui.dialogs.choose({
      title: t("play.giveUp.confirmTitle"), text: t("play.giveUp.confirmBody"), mood: "thinking",
      buttons: [{ id: "keep", label: t("play.giveUp.confirmNo"), primary: true }, { id: "yes", label: t("play.giveUp.confirmYes") }],
      safeId: "keep"
    }).then(function (id) {
      if (S !== mine) return;                           // the screen was left meanwhile
      S.asking = false;
      if (id !== "yes") return;
      var res = SG.game.giveUp(S.round, SG.robo);       // Robo's order for this window (A4); game.js uses roboOrder(round.peek)
      if (res.type === "revealed") afterCorrect(res.rank, true);
    });
  }

  /* ================================================================ 6. pause, idle */

  function setPaused(on) {
    if (!S || S.finished) return;
    S.paused = on;
    S.kb.enable(!on);
    S.main.hidden = on;                                 // hides the sentence and the keys (UX-035)
    S.pauseEl.hidden = !on;
    SG.ui.a11y.focus(on ? S.resumeBtn : S.pauseBtn);
  }

  function armIdle() {
    clearTimeout(S.idleTimer);
    S.idleTimer = setTimeout(function () { if (S && !S.finished) S.robo.setMood("sleepy"); }, IDLE_MS);
  }

  /** Any input wakes Robo (UX-022); never any text or sound. */
  function wake() {
    if (!S) return;
    if (S.robo.mood === "sleepy") S.robo.setMood(S.lastMood || "neutral");
    armIdle();
  }

  /* ================================================================ 7. leaving: keep / save / stop (design 5.7) */

  function goHomeQuietly(announce) {
    SG.app.go("home");
    if (announce) SG.ui.a11y.announce(announce);
  }

  /** "Leave this round?" - Esc and the backdrop choose the harmless answer (keep playing). */
  function askLeave() {
    if (!S || S.finished || S.leaving) return;
    var mine = S;
    S.leaving = true;
    SG.ui.dialogs.choose({
      title: t("dialogs.quit.title"), text: t("dialogs.quit.body"), mood: "neutral",
      buttons: [{ id: "keep", label: t("dialogs.quit.keep"), primary: true },
        { id: "save", label: t("dialogs.quit.save") }, { id: "stop", label: t("dialogs.quit.stop") }],
      safeId: "keep"
    }).then(function (id) {
      if (S !== mine) return;                          // the screen was left meanwhile
      S.leaving = false;
      if (id === "save") saveForLater();
      else if (id === "stop") stopHere();
    });
  }

  function saveForLater() {
    S.profile.inProgress = snapshot();
    SG.app.save();
    goHomeQuietly(t("dialogs.quit.saved"));
  }

  /** GP-053/054: with enough letters offer the partial Board, otherwise nothing is saved. */
  function stopHere() {
    var enough = S.round.pos >= SG.config.MIN_PARTIAL, mine = S;
    S.leaving = true;
    SG.ui.dialogs.choose({
      title: t("dialogs.quit.stopTitle"), text: t(enough ? "dialogs.quit.partialBody" : "dialogs.quit.tooShortBody"), mood: "neutral",
      buttons: enough
        ? [{ id: "board", label: t("dialogs.quit.seeBoard"), primary: true }, { id: "home", label: t("dialogs.quit.justHome") }]
        : [{ id: "keep", label: t("dialogs.quit.keep"), primary: true }, { id: "home", label: t("dialogs.quit.goHome") }],
      safeId: enough ? "board" : "keep"
    }).then(function (id) {
      if (S !== mine) return;
      S.leaving = false;
      if (id === "board") { var done = storeRound(); SG.app.go("roboplays", { record: done.record, newBadges: done.badges }); }
      else if (id === "home") { discardRound(); goHomeQuietly(t("dialogs.quit.stoppedShort")); }
    });
  }

  function discardRound() {
    S.profile.inProgress = null;
    SG.app.save();
  }

  /* ================================================================ 8. finishing */

  /** RoundRecord with its small stats cache (architecture 5). A stats failure must never lose the round. */
  function buildRecord(round, now) {
    var record = SG.game.toRecord(round, null, now);
    try {
      record.stats = SG.info.summaryStats(SG.info.summarize(record, SG.robo, SG.app.corpusCurve()));
    } catch (e) {
      if (typeof console !== "undefined" && console.error) console.error(e);
      record.stats = null;
    }
    return record;
  }

  /** Store the (complete or partial) round, clear the saved copy, award badges. Returns {record, badges}. */
  function storeRound() {
    var now = SG.app.now(), profile = S.profile;
    var record = buildRecord(S.round, now);
    SG.storage.addRound(profile, record);
    profile.inProgress = null;
    var badges = SG.badges.evaluate(profile, { type: "round", record: record });
    SG.storage.award(profile, badges, now);
    SG.app.save();
    S.finished = true;
    return { record: record, badges: badges };
  }

  function finishRound() {
    var done = storeRound();
    S.record = done.record;
    S.newBadges = done.badges;
    SG.sound.play("finish");
    showFinished(done.record, done.badges);
  }

  /** "You finished!": the whole sentence, no numbers (GP-051). Fog lifts for Peephole (GP-081). */
  function showFinished(record, newBadges) {
    clearTimeout(S.idleTimer);
    S.kb.destroy();
    var root = S.root;
    root.classList.remove("sg-screen--play");
    SG.ui.clear(root);
    SG.app.shell.configure({ title: t("play.finished.title"), onHome: function () { SG.app.go("home"); }, extra: null });
    SG.app.setTitle(t("play.finished.title") + " - " + t("app.title"));
    var robo = SG.ui.robo.create("cheering", 120, { layout: "stack" });
    var next = SG.ui.button(t("play.finished.next"), { kind: "primary", big: true, onClick: function () { goRoboPlays(); } });
    var notes = newBadges.map(function (id) {
      var b = SG.copy.badges[id] || {};
      return h("div", { "class": "sg-note", role: "status" }, h("span", { "aria-hidden": "true" }, b.emoji || ""),
        h("p", null, t("badges.newBadge", { name: b.name || id })));
    });
    root.appendChild(h("div", { "class": "sg-pl-done" },
      robo,
      SG.ui.h1(t("play.finished.title")),
      h("p", { "class": "sg-muted" }, t("play.finished.sentenceLabel")),
      h("p", { "class": "sg-pl-fullsentence" }, record.sentence),   // textContent only: it may be a child's own sentence
      notes, next));
    robo.say(SG.ui.pick("play.finished.lines"), { mood: "cheering", essential: true });
    if (newBadges.length) SG.sound.play("badge");
    SG.ui.a11y.announce(t("play.aria.finished"));
    SG.ui.a11y.focus(next, { preventScroll: true });
  }

  function goRoboPlays() {
    if (S && S.record) SG.app.go("roboplays", { record: S.record, newBadges: S.newBadges });
  }

  /* ================================================================ 9. render */

  function cleanup(root) {
    if (S) {
      S.alive = false;
      clearTimeout(S.idleTimer);
      S.timers.forEach(clearTimeout);
    }
    root.classList.remove("sg-screen--play");
    S = null;
  }

  function render(root, params) {
    params = params || {};
    var profile = SG.app.profile;
    var round = null;
    if (params.resume) {
      round = restoreRound(profile.inProgress);
      if (!round) {                                  // a damaged or missing save: drop it and go home
        SG.app.discardResume();
        SG.ui.later(function () { SG.app.go("home"); }, 0);
        return;
      }
    } else {
      round = newRound(params, profile);
      if (round.mode !== "twoPlayer" && !round.replay && profile.lastTier !== "surprise") profile.lastTier = round.tier;   // GP-017
    }

    S = {
      alive: true, root: root, profile: profile, round: round, timers: [], finished: false, paused: false,
      streak: params.resume && profile.inProgress ? profile.inProgress.streak | 0 : 0,
      giveReady: false, gibberishHardSaid: params.resume && profile.inProgress ? !!profile.inProgress.gibberishHardSaid : false, asking: false, leaving: false, lastMood: "neutral", corpusWarm: false
    };
    root.classList.add("sg-screen--play");
    buildScreen(root);
    SG.app.setTitle(captionText(round) + " - " + t("app.title"));
    SG.app.shell.configure({ title: lettersFoundText(round.pos), onHome: askLeave, extra: S.pauseBtn });
    paintTally(!!profile.settings.tallyCollapsed);
    renderSentence();
    S.kb.setUsed(round.wrong);
    round.ranks.forEach(function (g, i) { S.tally.bars.push(g, bandOf(g), round.revealed[i]); });
    updateCounts();
    updateGiveUp();
    if (SG.game.canGiveUp(round)) S.gibberishHardSaid = true;       // "Show me" is already open: the moment has passed
    if (round.tier === "gibberish" && !params.resume) S.robo.say(t("robo.gibberishIntro"), { mood: "happy" });   // GP-112: framing only

    SG.ui.on(document, "keydown", wake);
    SG.ui.on(document, "pointerdown", wake);
    SG.ui.on(document, "visibilitychange", function () { if (document.hidden) persist(); });
    SG.ui.on(window, "pagehide", persist);                                // closing the tab loses nothing (UX-070)
    armIdle();
    return function () { cleanup(root); };
  }

  /** Browser Back during a round asks "Leave this round?" (app.js re-pushes history before calling this). */
  function onBack() {
    if (!S) return;
    if (S.finished) goRoboPlays(); else askLeave();
  }

  return { render: render, onBack: onBack };
})();
