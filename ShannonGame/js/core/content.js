/* SG.content — puzzles, gibberish and custom-sentence checks (A11, architecture §3). */
window.SG = window.SG || {};

SG.content = (function () {
  var puzzles = ((SG.data && SG.data.puzzles) || []).map(function (p) {
    return { id: p.id, tier: p.tier, theme: p.theme, text: p.text, clean: SG.alphabet.clean(p.text) };
  });

  var blocked = null; // Set of cleaned blocklist words, built on first use
  function blockedSet() {
    if (!blocked) {
      blocked = new Set();
      ((SG.data && SG.data.blocklist) || []).forEach(function (w) { blocked.add(SG.alphabet.clean(w)); });
    }
    return blocked;
  }

  /**
   * A12b + CT-021. Choose a puzzle of the tier with a shuffle-bag, so every puzzle is seen once
   * before any repeats. `playedIds` is the device's play history, NEWEST LAST (ids of other tiers
   * are ignored). We replay the history to find the current cycle (puzzles of this tier played since
   * the bag last became empty); candidates are the tier's puzzles not in that cycle and not the one
   * played last. On top of that, the last RECENT_AVOID plays of the tier are avoided when possible.
   * Returns null for a tier without puzzles (gibberish / custom).
   */
  function pick(tier, rand, playedIds) {
    var pool = puzzles.filter(function (p) { return p.tier === tier; });
    if (!pool.length) return null;
    var inPool = {};
    pool.forEach(function (p) { inPool[p.id] = true; });
    var played = (playedIds || []).filter(function (id) { return inPool[id]; });

    var cycle = {}, cycleSize = 0;
    played.forEach(function (id) {
      if (cycle[id]) { cycle = {}; cycleSize = 0; } // played twice in one cycle: a new bag started
      cycle[id] = true; cycleSize++;
      if (cycleSize === pool.length) { cycle = {}; cycleSize = 0; } // bag emptied
    });
    var last = played.length ? played[played.length - 1] : null;
    var recent = {};
    played.slice(-SG.config.RECENT_AVOID).forEach(function (id) { recent[id] = true; });

    var cands = pool.filter(function (p) { return !cycle[p.id] && p.id !== last; });
    if (!cands.length) cands = pool.filter(function (p) { return p.id !== last; });
    if (!cands.length) cands = pool;
    var fresh = cands.filter(function (p) { return !recent[p.id]; });
    return SG.rng.pick(rand, fresh.length ? fresh : cands);
  }

  var common = null; // Set of common English words (SG.data.commonWords, optional) for GP-111
  function commonSet() {
    if (!common) {
      common = new Set();
      ((SG.data && SG.data.commonWords) || []).forEach(function (w) { common.add(SG.alphabet.clean(w)); });
    }
    return common;
  }

  function randomWord(rand, len) {
    var w = "";
    for (var i = 0; i < len; i++) w += SG.alphabet.char(1 + Math.floor(rand() * 26));
    return w;
  }

  /**
   * A11 / GP-109-110: words of 2..7 random letters separated by single spaces, exactly T characters
   * long. Each word length is drawn so that whatever room is left can still be filled by words of
   * 2..7 letters: while more than one word's worth remains, the next word leaves at least
   * "space + 2 letters" for the rest. (`max` is kept for the signature; the result is always T <= max.)
   */
  function gibberishOnce(rand, T, max) {
    var words = [], used = 0;
    for (;;) {
      var room = T - used - (words.length ? 1 : 0);          // letters available for the next word
      if (room <= 7) { words.push(randomWord(rand, room)); break; }  // room >= 2 is guaranteed below
      var hi = Math.min(7, room - 3);                        // leave " " + at least 2 letters
      var L = 2 + Math.floor(rand() * (hi - 1));             // 2..hi
      words.push(randomWord(rand, L));
      used = words.join(" ").length;
    }
    return words.join(" ");
  }
  function gibberish(rand, len) {
    var T = len == null ? SG.config.GIBBERISH_MIN + Math.floor(rand() * (SG.config.GIBBERISH_MAX - SG.config.GIBBERISH_MIN + 1)) : len;
    var max = len == null ? SG.config.GIBBERISH_MAX : len;
    var out = "";
    for (var attempt = 0; attempt < 50; attempt++) {
      out = gibberishOnce(rand, T, max);
      var cs = commonSet();
      if (!cs.size || !out.split(" ").some(function (w) { return w.length >= 3 && cs.has(w); })) break;
    }
    return out;
  }

  /** CT-052: a word with each run of the same letter collapsed to one ("SHIIIT" -> "SHIT"). */
  function collapseRuns(word) {
    return word.replace(/(.)\1+/g, "$1");
  }

  /**
   * CT-052: true when a run of consecutive SHORT words (each <= 3 letters), with its spaces removed,
   * contains a blocklisted word of 5+ letters. Such a match must span at least two fragments, because
   * a single short word cannot hold 5 letters. Long words are never joined, so innocent text is safe.
   */
  function spacedBlocked(words) {
    var set = blockedSet();
    var run = [];
    function runBlocked() {
      var joined = run.join(""), hit = false;
      if (run.length >= 2) {
        set.forEach(function (b) { if (b.length >= 5 && joined.indexOf(b) >= 0) hit = true; });
      }
      run = [];
      return hit;
    }
    for (var i = 0; i < words.length; i++) {
      if (words[i].length <= 3) run.push(words[i]);
      else if (runBlocked()) return true;
    }
    return runBlocked();
  }

  /** Blocklist entries with their own letter runs collapsed ("BOOBS" -> "BOBS"), built once. */
  var collapsedCache = null;
  function collapsedBlockedSet() {
    if (collapsedCache === null) {
      collapsedCache = new Set();
      blockedSet().forEach(function (w) { collapsedCache.add(collapseRuns(w)); });
    }
    return collapsedCache;
  }

  /**
   * CT-051/052: whole cleaned words only. A word that is STRETCHED (has a run of 3+ equal letters,
   * e.g. "BAAAD") is also compared in collapsed form against collapsed entries — but an ordinary word
   * is never collapsed, so "AS" is not mistaken for a collapsed "ASS". Plus short fragments joined
   * across spaces (spacedBlocked).
   */
  function isBlocked(clean) {
    var set = blockedSet(), words = SG.alphabet.words(clean);
    return words.some(function (w) {
      if (set.has(w)) return true;
      return /(.)\1\1/.test(w) && collapsedBlockedSet().has(collapseRuns(w));
    }) || spacedBlocked(words);
  }

  /** Robo's cleaned reading text, built once on first use (for the "known" check). */
  var trainingCache = null;
  function trainingText() {
    if (trainingCache === null) {
      var parts = (SG.data && SG.data.corpusParts) || [];
      trainingCache = " " + SG.alphabet.clean(parts.join(" ")) + " ";
    }
    return trainingCache;
  }

  /**
   * GP-009/CT-032: true when `clean` shares a run of TWIN_MATCH_RUN characters with Robo's reading,
   * i.e. Robo has effectively read this sentence, so "Robo has never seen it" would be untrue.
   */
  function isKnownToRobo(clean) {
    var run = SG.config.TWIN_MATCH_RUN, t = trainingText();
    for (var i = 0; i + run <= clean.length; i++) {
      if (t.indexOf(clean.substring(i, i + run)) !== -1) return true;
    }
    return false;
  }

  /**
   * Validate a two-player sentence. Checks in this order: digits, empty, blocked (a blocklisted word,
   * also when stretched by repeated letters or split by spaces), short (< SENTENCE_MIN), long
   * (> SENTENCE_MAX), variety (fewer than 5 different symbols, SPACE included; GP-099), known
   * (shares TWIN_MATCH_RUN characters with Robo's reading, so "Robo never saw it" would be false; GP-009).
   * @returns {{ok:boolean, clean:string, reason:(null|"empty"|"digits"|"short"|"long"|"blocked"|"variety"|"known")}}
   */
  function checkCustom(text) {
    var clean = SG.alphabet.clean(text);
    var reason = null;
    if (SG.alphabet.hasDigits(text)) reason = "digits";
    else if (!clean) reason = "empty";
    else if (isBlocked(clean)) reason = "blocked";
    else if (clean.length < SG.config.SENTENCE_MIN) reason = "short";
    else if (clean.length > SG.config.SENTENCE_MAX) reason = "long";
    else if (new Set(clean.split("")).size < 5) reason = "variety";
    else if (isKnownToRobo(clean)) reason = "known";
    return { ok: reason === null, clean: clean, reason: reason };
  }

  return { puzzles: puzzles, pick: pick, gibberish: gibberish, checkCustom: checkCustom };
})();
