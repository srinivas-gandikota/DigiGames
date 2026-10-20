/* SG.info — every statistic the Discovery Board shows (A5–A8, A12). Pure functions. */
window.SG = window.SG || {};

SG.info = (function () {
  var LN2 = Math.LN2;
  function log2(x) { return Math.log(x) / LN2; }

  /**
   * A5. Shannon's bounds on the entropy of the guess-number distribution.
   * q_j = share of positions needing exactly j guesses.
   *  - upper = -sum q_j log2 q_j (entropy of the numbers themselves),
   *  - lower = sum_j j (q'_j - q'_{j+1}) log2 j with q' = q sorted non-increasing (Shannon 1951 needs
   *    that order; sorting leaves the upper bound unchanged and guarantees 0 <= low <= up).
   * Arrays are length 28 and use indices 1..27 (index 0 unused).
   */
  function shannonBounds(ranks) {
    var n = ranks.length;
    var hist = new Array(28), q = new Array(28), j;
    for (j = 0; j < 28; j++) { hist[j] = 0; q[j] = 0; }
    for (var i = 0; i < n; i++) hist[ranks[i]]++;
    var up = 0;
    if (n > 0) {
      for (j = 1; j <= 27; j++) {
        q[j] = hist[j] / n;
        if (q[j] > 0) up -= q[j] * log2(q[j]);
      }
    }
    var sorted = q.slice(1).sort(function (a, b) { return b - a; }); // sorted[0] = q'_1
    var low = 0;
    for (j = 1; j <= 27; j++) {
      var next = j < 27 ? sorted[j] : 0; // q'_{j+1}, with q'_28 = 0
      low += j * (sorted[j - 1] - next) * log2(j);
    }
    if (low > up) low = up; // guard against floating-point crumbs only
    if (low < 0) low = 0;
    return { n: n, hist: hist, q: q, low: low, up: up, mid: (low + up) / 2 };
  }

  /** A7. Share of the sentence that was predictable: 1 - H/log2(27), clamped to 0..1. */
  function redundancy(H) {
    var r = 1 - H / SG.alphabet.HMAX;
    return r < 0 ? 0 : r > 1 ? 1 : r;
  }

  /** floor(log2 g) per guess count: 1 -> 0, 2-3 -> 1, 4-7 -> 2, 8-15 -> 3, 16-27 -> 4. */
  function surpriseBuckets(ranks) {
    return ranks.map(function (g) { return 31 - Math.clz32(g); });
  }

  /**
   * A12 surprise bands (DB-021): min(4, ceil(log2 g)) -> 1:0, 2:1, 3-4:2, 5-8:3, 9+:4.
   * Monotone in g; the Board's colours/sizes are keyed to these.
   */
  function surpriseBands(ranks) {
    return ranks.map(function (g) {
      var c = g <= 1 ? 0 : 32 - Math.clz32(g - 1); // ceil(log2 g) for integers
      return c > 4 ? 4 : c;
    });
  }

  /**
   * A6a. Average guess count by position in word. `ranks` may be shorter than the sentence (partial
   * rounds). Revealed characters (optional 3rd argument, bool[]) are EXCLUDED (LG-004.2): their
   * rank is a proxy, not a real guess. For the four letter categories, fewer than WORDPOS_MIN
   * counted letters gives avg = null ("not enough letters yet", DB-038); `count` is always the
   * number of letters counted so the UI can say how many there were. SPACE is reported separately
   * and has no minimum. Empty categories give {avg:null, count:0}.
   */
  function contextByWordPosition(sentence, ranks, revealed) {
    var keys = ["first", "second", "third", "fourthPlus", "space"];
    var sum = {}, cnt = {};
    keys.forEach(function (k) { sum[k] = 0; cnt[k] = 0; });
    var inWord = 0;
    for (var i = 0; i < ranks.length; i++) {
      var key;
      if (sentence.charAt(i) === " ") { key = "space"; inWord = 0; }
      else { inWord++; key = inWord === 1 ? "first" : inWord === 2 ? "second" : inWord === 3 ? "third" : "fourthPlus"; }
      if (revealed && revealed[i]) continue;
      sum[key] += ranks[i];
      cnt[key]++;
    }
    var out = {};
    keys.forEach(function (k) {
      var min = k === "space" ? 1 : SG.config.WORDPOS_MIN;
      out[k] = { avg: cnt[k] >= min ? sum[k] / cnt[k] : null, count: cnt[k] };
    });
    return out;
  }

  /** The look-back orders of A6b: -1 (knows nothing) .. maxOrder. */
  function orders(model) {
    var K = model.maxOrder != null ? model.maxOrder : SG.config.MAX_ORDER;
    var ks = [];
    for (var k = -1; k <= K; k++) ks.push(k);
    return ks;
  }

  /** Bits Robo would pay for each position of `sentence` at look-back k, summed. */
  function totalBitsAtOrder(model, sentence, k) {
    var total = 0;
    for (var i = 0; i < sentence.length; i++) {
      var x = SG.alphabet.index(sentence.charAt(i));
      total += -log2(model.distribution(sentence.substring(0, i), k)[x]);
    }
    return total;
  }

  /** A6b. This sentence's curve: mean bits per character for each look-back k = -1..maxOrder. */
  function lookBackCurve(model, sentence) {
    return orders(model).map(function (k) {
      return { k: k, bits: sentence.length ? totalBitsAtOrder(model, sentence, k) / sentence.length : 0 };
    });
  }

  /**
   * A6b. The steady picture: average over many sentences, weighted by characters, i.e.
   * total bits / total characters (= average of per-sentence means weighted by length).
   */
  function corpusLookBackCurve(model, sentences) {
    var chars = 0;
    sentences.forEach(function (s) { chars += s.length; });
    return orders(model).map(function (k) {
      var total = 0;
      sentences.forEach(function (s) { total += totalBitsAtOrder(model, s, k); });
      return { k: k, bits: chars ? total / chars : 0 };
    });
  }

  /**
   * A6c. The "knee" k* = smallest k >= 0 with bits(k) <= bits(k_last) + SUFFICIENCY_EPS, where
   * k_last is the largest look-back on the curve. (Anchoring on the far end, not the minimum, makes
   * "peeking further back hardly helps" mean exactly that.) null if the curve has no k >= 0 point.
   */
  function sufficiencyPoint(curve) {
    var pts = curve.filter(function (p) { return p.k >= 0; });
    if (!pts.length) return null;
    var limit = pts[pts.length - 1].bits + SG.config.SUFFICIENCY_EPS;
    for (var i = 0; i < pts.length; i++) if (pts[i].bits <= limit) return pts[i].k;
    return pts[pts.length - 1].k;
  }

  /** A6c Gibberish rule: the curve is "flat" when bits(0) - bits(k_last) < FLAT_CURVE. */
  function isFlatCurve(curve) {
    var p0 = null, last = null;
    curve.forEach(function (p) { if (p.k === 0) p0 = p; if (last === null || p.k > last.k) last = p; });
    if (!p0 || !last || last.k <= 0) return false;
    return p0.bits - last.bits < SG.config.FLAT_CURVE;
  }

  /**
   * A8. Deterministic Huffman code over the distinct values, weighted by how often they occur.
   * Priority: weight asc, then smallest contained value asc; the first node popped becomes the "0"
   * branch. A single distinct value gets the code "0" (1 bit each).
   * @returns {{codeBook: Object<string,string>, totalBits:number}} codeBook keys are the values
   */
  function huffman(values) {
    var counts = {}, distinct = [];
    values.forEach(function (v) {
      if (counts[v] === undefined) { counts[v] = 0; distinct.push(v); }
      counts[v]++;
    });
    var codeBook = {};
    if (distinct.length === 0) return { codeBook: codeBook, totalBits: 0 };
    if (distinct.length === 1) {
      codeBook[distinct[0]] = "0";
      return { codeBook: codeBook, totalBits: values.length };
    }
    var nodes = distinct.map(function (v) { return { w: counts[v], min: v, value: v, kids: null }; });
    function byPriority(a, b) { return (a.w - b.w) || (a.min - b.min); }
    while (nodes.length > 1) {
      nodes.sort(byPriority);
      var a = nodes.shift(), b = nodes.shift();
      nodes.push({ w: a.w + b.w, min: Math.min(a.min, b.min), value: null, kids: [a, b] });
    }
    (function walk(node, code) {
      if (!node.kids) { codeBook[node.value] = code; return; }
      walk(node.kids[0], code + "0");
      walk(node.kids[1], code + "1");
    })(nodes[0], "");
    var totalBits = 0;
    values.forEach(function (v) { totalBits += codeBook[v].length; });
    return { codeBook: codeBook, totalBits: totalBits };
  }

  /**
   * A8. Three sizes in bits: plain (5 bits per symbol, 2^5 >= 27), Huffman (a real code) and ideal
   * (n x H_up, the best any code on these numbers can do on average). ratio = huffman / plain.
   */
  function compression(ranks) {
    var n = ranks.length;
    var h = huffman(ranks);
    var plain = n * 5;
    return {
      plain: plain,
      ideal: n * shannonBounds(ranks).up,
      huffman: h.totalBits,
      codeBook: h.codeBook,
      ratio: plain ? h.totalBits / plain : 0
    };
  }

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  /**
   * A12. Everything the Board needs for one round (also partial rounds: only the first
   * record.ranks.length characters of the sentence are analysed).
   *
   * Robo plays with the SAME window as the child (A2 roboOrder(record.peek)); the Magic Twin check
   * uses that order too. The look-back "main line" is the corpus curve when given, except for
   * Gibberish rounds where it is this sentence's own curve (DB §8); kStar and `flat` use it.
   *
   * @param {{sentence:string, ranks:number[], revealed:boolean[], peek?:(number|null), tier?:string, complete?:boolean}} record
   * @param {Object} model trained SG.model instance (Robo)
   * @param {Array<{k:number,bits:number}>} [corpusCurve] from corpusLookBackCurve; if omitted,
   *   lookBack.corpus is [] and the main line is this sentence's curve.
   * @returns {Object} Summary (A12 + the extras listed there: bands, vs, rough, roughReason, lookBack.flat)
   *   vs.verdict is "even" | "you" | "robo" (who predicted better by midpoint, within VERDICT_TIE = even).
   *   roughReason is null | "partial" | "short" | "revealed" (first that applies).
   */
  function summarize(record, model, corpusCurve) {
    var ranks = record.ranks.slice();
    var n = ranks.length;
    var revealed = (record.revealed || []).slice(0, n);
    while (revealed.length < n) revealed.push(false);
    var sentence = record.sentence.slice(0, n);
    var order = SG.model.roboOrder(record.peek, model.maxOrder);

    var bounds = shannonBounds(ranks);
    var firstTries = 0, maxPos = -1, minPos = -1, nRevealed = 0;
    for (var i = 0; i < n; i++) {
      if (ranks[i] === 1) firstTries++;
      if (revealed[i]) nRevealed++;
      if (maxPos < 0 || ranks[i] > ranks[maxPos]) maxPos = i; // strict: keeps the first occurrence
      if (minPos < 0 || ranks[i] < ranks[minPos]) minPos = i;
    }

    var play = model.play(sentence, order);
    var twinOk = SG.twin.decode(model, play.ranks, order) === sentence;
    var roboBounds = shannonBounds(play.ranks);

    // Robo vs You: only real guesses (not revealed characters) are compared.
    var youFewer = 0, same = 0, roboFewer = 0;
    for (var j = 0; j < n; j++) {
      if (revealed[j]) continue;
      if (ranks[j] < play.ranks[j]) youFewer++;
      else if (ranks[j] > play.ranks[j]) roboFewer++;
      else same++;
    }
    var verdict = Math.abs(bounds.mid - roboBounds.mid) < SG.config.VERDICT_TIE ? "even"
      : bounds.mid < roboBounds.mid ? "you" : "robo";

    var revealedShare = n ? nRevealed / n : 0;
    var partial = record.complete === false || (record.complete === undefined && n < record.sentence.length);
    var roughReason = partial ? "partial" : n < SG.config.ROUGH_N ? "short"
      : revealedShare > SG.config.ROUGH_REVEALED ? "revealed" : null;

    var sentenceCurve = lookBackCurve(model, sentence);
    var hasCorpus = !!(corpusCurve && corpusCurve.length);
    var main = hasCorpus && record.tier !== "gibberish" ? corpusCurve : sentenceCurve;
    return {
      n: n,
      sentence: sentence,
      ranks: ranks,
      revealed: revealed,
      bounds: bounds,
      redundancy: redundancy(bounds.mid),
      firstTryShare: n ? firstTries / n : 0,
      surprise: {
        maxPos: maxPos, minPos: minPos,
        maxRank: maxPos >= 0 ? ranks[maxPos] : null,
        minRank: minPos >= 0 ? ranks[minPos] : null,
        buckets: surpriseBuckets(ranks)
      },
      bands: surpriseBands(ranks),
      wordPos: contextByWordPosition(sentence, ranks, revealed),
      robo: { order: order, ranks: play.ranks, bits: play.bits, crossEntropy: play.crossEntropy, bounds: roboBounds },
      vs: { youFewer: youFewer, same: same, roboFewer: roboFewer, verdict: verdict },
      rough: roughReason !== null,
      roughReason: roughReason,
      lookBack: {
        sentence: sentenceCurve,
        corpus: hasCorpus ? corpusCurve : [],
        kStar: sufficiencyPoint(main),
        flat: isFlatCurve(main)
      },
      compression: compression(ranks),
      twin: { numbers: play.ranks.slice(), ok: twinOk }
    };
  }

  /**
   * The small `stats` cache stored in a RoundRecord (architecture §5), derived from a Summary.
   */
  function summaryStats(summary) {
    return {
      n: summary.n,
      low: summary.bounds.low, up: summary.bounds.up, mid: summary.bounds.mid,
      firstTryShare: summary.firstTryShare,
      roboMid: summary.robo.bounds.mid,
      roboCE: summary.robo.crossEntropy,
      totalGuesses: sum(summary.ranks),
      roboTotal: sum(summary.robo.ranks)
    };
  }

  return {
    shannonBounds: shannonBounds, redundancy: redundancy, surpriseBuckets: surpriseBuckets,
    surpriseBands: surpriseBands, isFlatCurve: isFlatCurve,
    contextByWordPosition: contextByWordPosition, lookBackCurve: lookBackCurve,
    corpusLookBackCurve: corpusLookBackCurve, sufficiencyPoint: sufficiencyPoint,
    huffman: huffman, compression: compression, summarize: summarize, summaryStats: summaryStats
  };
})();
