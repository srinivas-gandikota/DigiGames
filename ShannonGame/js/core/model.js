/* SG.model — Robo's brain: a character n-gram model with Witten–Bell smoothing (A2). */
window.SG = window.SG || {};

SG.model = (function () {
  var SIZE = 27;
  var UNIFORM = 1 / SIZE;

  /**
   * Train on clean text. Training stream T = " " + text + " ": the leading space makes the start of
   * a sentence look like the start of a word, which is how play-time histories are built too.
   * For each position j and each look-back k = 0..maxOrder we count how often symbol T[j] followed
   * the k-letter context T[j-k..j-1]. Each context keeps counts[27], total and types (distinct
   * symbols seen) — the two numbers Witten–Bell needs.
   * @param {string} cleanText
   * @param {number} [maxOrder] default SG.config.MAX_ORDER
   * @returns {Model}
   */
  function train(cleanText, maxOrder) {
    var K = maxOrder == null ? SG.config.MAX_ORDER : maxOrder;
    var text = SG.alphabet.clean(cleanText); // idempotent; guarantees only the 27 symbols
    var T = " " + text + " ";
    var sym = new Int8Array(T.length);
    for (var i = 0; i < T.length; i++) sym[i] = SG.alphabet.index(T.charAt(i));

    var map = new Map();
    for (var j = 1; j < T.length; j++) {
      var x = sym[j];
      var kmax = j < K ? j : K;
      for (var k = 0; k <= kmax; k++) {
        var key = T.substring(j - k, j);
        var e = map.get(key);
        if (e === undefined) {
          e = { counts: new Uint32Array(SIZE), total: 0, types: 0 };
          map.set(key, e);
        }
        if (e.counts[x] === 0) e.types++;
        e.counts[x]++;
        e.total++;
      }
    }

    /**
     * A2. Probability of every next symbol given the revealed `prefix`.
     * Recursion from the bottom: P_-1 = 1/27, then for k = 0..order
     *   P_k = (C(c,x) + T(c) * P_{k-1}) / (C(c) + T(c))   if the k-letter context c was seen,
     *   P_k = P_{k-1}                                      otherwise (fall through).
     * T(c) acts as "how likely is a brand-new symbol here": contexts that have always been followed
     * by the same letter (T small) trust their counts, busy contexts lean on the shorter context.
     * That keeps every probability > 0 and the total exactly 1.
     * @param {string} prefix revealed text (ONE start space is prepended internally)
     * @param {number} [order] look-back; capped at maxOrder and at the history length; -1 = uniform
     * @returns {Float64Array} length 27
     */
    function distribution(prefix, order) {
      var h = " " + prefix;
      var top = order == null ? K : order;
      if (top > K) top = K;
      if (top > h.length) top = h.length;
      var p = new Float64Array(SIZE);
      for (var s = 0; s < SIZE; s++) p[s] = UNIFORM;
      var hl = h.length;
      for (var kk = 0; kk <= top; kk++) {
        var e = map.get(kk === 0 ? "" : h.substring(hl - kk));
        if (e === undefined) continue;
        var c = e.counts, ty = e.types, den = e.total + ty;
        for (var y = 0; y < SIZE; y++) p[y] = (c[y] + ty * p[y]) / den;
      }
      return p;
    }

    /** Symbols by probability desc, ties by symbol index asc; `exclude` (Set of ints) removed. */
    function ranking(prefix, order, exclude) {
      var p = distribution(prefix, order);
      var idx = [];
      for (var s = 0; s < SIZE; s++) if (!exclude || !exclude.has(s)) idx.push(s);
      idx.sort(function (a, b) { return (p[b] - p[a]) || (a - b); });
      return idx;
    }

    /** rank in p of sym among non-excluded symbols, using the same order as ranking(). */
    function rankIn(p, sym, exclude) {
      var r = 1, ps = p[sym];
      for (var s = 0; s < SIZE; s++) {
        if (s === sym || (exclude && exclude.has(s))) continue;
        if (p[s] > ps || (p[s] === ps && s < sym)) r++;
      }
      return r;
    }

    /**
     * 1-based rank of `sym` in ranking(prefix, order, exclude); -1 if `sym` is excluded.
     * Counts instead of sorting, so it is cheap.
     */
    function rankOf(prefix, sym, order, exclude) {
      if (exclude && exclude.has(sym)) return -1;
      return rankIn(distribution(prefix, order), sym, exclude);
    }

    /**
     * A2 "Robo plays a sentence": for each position, rank and surprise (bits) of the true letter.
     * @returns {{ranks:number[], bits:number[], crossEntropy:number}}
     */
    function play(sentence, order) {
      var ranks = [], bits = [], sum = 0;
      for (var i = 0; i < sentence.length; i++) {
        var x = SG.alphabet.index(sentence.charAt(i));
        if (x < 0) throw new Error("model.play: not a clean symbol at " + i);
        var p = distribution(sentence.substring(0, i), order);
        ranks.push(rankIn(p, x, null));
        var b = -Math.log(p[x]) / Math.LN2;
        bits.push(b);
        sum += b;
      }
      return { ranks: ranks, bits: bits, crossEntropy: sentence.length ? sum / sentence.length : 0 };
    }

    return {
      maxOrder: K,
      distribution: distribution,
      ranking: ranking,
      rankOf: rankOf,
      play: play,
      stats: { contexts: map.size, trainChars: text.length }
    };
  }

  /**
   * A2 "Which order Robo uses": Robo sees the same window as the child. Classic / two-player
   * (peek null) -> maxOrder; Peephole peek k -> min(k, maxOrder). The one rule shared by Robo's
   * play, the give-up rank (A4) and the Magic Twin.
   */
  function roboOrder(peek, maxOrder) {
    var K = maxOrder == null ? SG.config.MAX_ORDER : maxOrder;
    return peek == null ? K : Math.min(peek, K);
  }

  return { train: train, roboOrder: roboOrder };
})();
