/* SG.game — the state machine of one round (A3 guess loop, A4 fair give-up rank). */
window.SG = window.SG || {};

SG.game = (function () {
  /**
   * Start a round. `now` (ms timestamp) is supplied by the caller; the core never reads the clock.
   * `seed` (Gibberish replay, CT-029), `replay` (GP-117) and `contentVersion` (CT-064) are carried
   * through to the RoundRecord; they do not affect play.
   * @param {{sentence:string, mode?:string, tier?:string, peek?:(number|null), puzzleId?:(string|null), now?:number, seed?:(number|null), replay?:boolean, contentVersion?:number}} o
   * @returns {Object} Round
   */
  function createRound(o) {
    return {
      sentence: o.sentence,
      mode: o.mode || "classic",
      tier: o.tier || "custom",
      peek: o.peek == null ? null : o.peek,
      puzzleId: o.puzzleId == null ? null : o.puzzleId,
      pos: 0,
      wrong: new Set(),
      ranks: [],
      revealed: [],
      seed: o.seed == null ? null : o.seed,
      replay: !!o.replay,
      contentVersion: o.contentVersion == null ? null : o.contentVersion,
      startedAt: o.now == null ? null : o.now,
      done: o.sentence.length === 0
    };
  }

  /** Close the current position with guess count g and move on. */
  function advance(round, g, wasRevealed) {
    round.ranks.push(g);
    round.revealed.push(wasRevealed);
    round.pos++;
    round.wrong = new Set(); // fresh set: the next position starts with nothing tried
    round.done = round.pos >= round.sentence.length;
  }

  /**
   * A3. Guess symbol `sym` (int 0..26; a single character is also accepted) for the current position.
   * A repeat is ignored (no count). Correct: g = |wrong| + 1, so 1 <= g <= 27 always.
   * `model` is unused here (kept for a uniform call shape with giveUp).
   * @returns {{type:"repeat"|"wrong"|"correct"|"done", rank?:number, tries?:number, done:boolean}}
   */
  function guess(round, sym, model) {
    if (round.done) return { type: "done", done: true };
    if (typeof sym === "string") sym = SG.alphabet.index(sym);
    // GP-025/GP-032: anything that is not one of the 27 symbols is ignored and never counted.
    if (typeof sym !== "number" || sym !== Math.floor(sym) || sym < 0 || sym >= SG.alphabet.SIZE) {
      return { type: "invalid", done: false };
    }
    if (round.wrong.has(sym)) return { type: "repeat", done: false };
    var target = SG.alphabet.index(round.sentence.charAt(round.pos));
    if (sym === target) {
      var g = round.wrong.size + 1;
      advance(round, g, false);
      return { type: "correct", rank: g, done: round.done };
    }
    round.wrong.add(sym);
    return { type: "wrong", tries: round.wrong.size, done: false };
  }

  /** "Show me" is offered after GIVE_UP_AFTER wrong guesses at the current position. */
  function canGiveUp(round) {
    return !round.done && round.wrong.size >= SG.config.GIVE_UP_AFTER;
  }

  /**
   * A4. Reveal the current letter and give it a fair rank: |wrong| + 1 + (0-based position of the
   * letter in Robo's ordering of the letters NOT yet tried). Bounded by |wrong|+1 .. 27.
   * Robo uses the child's window: order = roboOrder(round.peek, model.maxOrder).
   * Returns {type:"done"} on a finished round and {type:"notyet"} if giving up is not allowed yet.
   */
  function giveUp(round, model) {
    if (round.done) return { type: "done", done: true };
    if (!canGiveUp(round)) return { type: "notyet", done: false };
    var x = SG.alphabet.index(round.sentence.charAt(round.pos));
    var prefix = round.sentence.substring(0, round.pos);
    // rankOf(..., exclude) is 1-based among the remaining letters, so this equals |wrong|+1+index0.
    var order = SG.model.roboOrder(round.peek, model.maxOrder);
    var rank = round.wrong.size + model.rankOf(prefix, x, order, round.wrong);
    advance(round, rank, true);
    return { type: "revealed", rank: rank, done: round.done };
  }

  /**
   * What to draw: one entry per character. `ch` is only given for done/revealed characters (the
   * answer is never leaked for current/hidden/masked). Peephole (peek != null): characters with
   * index < pos - peek are "masked" - identical blank tiles, spaces included.
   */
  function view(round) {
    var out = [];
    var maskBelow = round.peek == null ? 0 : round.pos - round.peek;
    for (var i = 0; i < round.sentence.length; i++) {
      var state;
      if (i < maskBelow) state = "masked";
      else if (i < round.pos) state = round.revealed[i] ? "revealed" : "done";
      else if (i === round.pos && !round.done) state = "current";
      else state = "hidden";
      out.push({ ch: state === "done" || state === "revealed" ? round.sentence.charAt(i) : "", state: state });
    }
    return out;
  }

  /**
   * Freeze the round into a RoundRecord (architecture §5). `stats` is the small numbers cache
   * (see SG.info.summaryStats) or null; `now` is the caller's timestamp.
   */
  function toRecord(round, stats, now) {
    return {
      v: 1,
      id: "r" + now,
      ts: now,
      mode: round.mode,
      tier: round.tier,
      peek: round.peek,
      puzzleId: round.puzzleId,
      sentence: round.sentence,
      seed: round.seed,
      contentVersion: round.contentVersion != null ? round.contentVersion
        : (SG.data && SG.data.CONTENT_VERSION != null ? SG.data.CONTENT_VERSION : 1),
      ranks: round.ranks.slice(),
      revealed: round.revealed.slice(),
      complete: round.done,
      replay: round.replay,
      stats: stats || null
    };
  }

  return { createRound: createRound, guess: guess, canGiveUp: canGiveUp, giveUp: giveUp, view: view, toRecord: toRecord };
})();
