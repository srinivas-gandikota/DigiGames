/* SG.ui.fmt — number and text formatting for the Board and friends (DB-016, DB-017, DB-093).
 *
 * The rules, in one place so every card agrees:
 *   bits      one decimal            "2.9"      (step savings may use bits2, two decimals, C11)
 *   pct5      nearest 5 %, no % sign "65"       (the copy already contains the % sign)
 *   avg1      one decimal            "3.4"
 * Every function accepts anything: null / NaN / Infinity / negative numbers become 0, so a thin or
 * odd round can never print "NaN" or "-0.3" (DB-093). Results are STRINGS ready for {placeholders};
 * the *n variants return numbers for comparisons.
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.fmt = (function () {
  /** A finite, non-negative number (anything else becomes 0). */
  function safe(x) {
    x = Number(x);
    return isFinite(x) && x > 0 ? x : 0;
  }

  /** Round half-up (DB-016). The tiny nudge undoes binary floating point: e.g. 1.005 * 100 is 100.4999…, and 0.145 * 100 is 14.4999…, which would otherwise round down. */
  function fixed(x, dp) {
    var f = Math.pow(10, dp);
    return (Math.round(safe(x) * f + 1e-9) / f).toFixed(dp);
  }

  /** Bits, one decimal: 2.94 -> "2.9". Use for Robo's surprise/curve values, which CAN exceed 4.75. */
  function bits(x) { return fixed(x, 1); }

  /**
   * An entropy ESTIMATE (L, U, M — the child's or Robo's guess-count bounds), one decimal, but the
   * maximum is always written "4.75" and nothing is ever shown above it (DB-016, LG-003.2).
   */
  function est(x) {
    var max = SG.alphabet.HMAX;
    return Math.round(safe(x) * 10 + 1e-9) / 10 > max ? max.toFixed(2) : fixed(x, 1);
  }

  /** Two decimals, only for the "saved about 0.02 bits" step labels (C11) and axis end labels. */
  function bits2(x) { return fixed(x, 2); }

  /** An average (guesses per letter, questions per case), one decimal. */
  function avg1(x) { return fixed(x, 1); }

  /** Whole number, rounded. */
  function int(x) { return String(Math.round(safe(x))); }

  /** Fraction 0..1 -> nearest 5 as a number 0..100 (0.62 -> 60). */
  function pct5n(frac) {
    var p = Math.round(safe(frac) * 100 / 5 + 1e-9) * 5;   // half-up (DB-016)
    return p > 100 ? 100 : p;
  }

  /** Fraction 0..1 -> nearest 5 as a string ("60"), without the % sign. */
  function pct5(frac) { return String(pct5n(frac)); }

  /** "about 2.9" (board.about with {x}); pass an already formatted value. */
  function about(x) { return SG.ui.t("board.about", { x: x }); }

  /** "about 2.9 bits per letter". */
  function aboutBits(mid) { return SG.ui.t("board.bitsPerLetter", { mid: est(mid) }); }

  /** "between 2.1 and 3.4". */
  function range(low, high) { return SG.ui.t("board.range", { low: est(low), high: est(high) }); }

  /** Short kid-friendly date ("12 Oct"); "" for a missing/invalid timestamp. */
  function date(ts) {
    var d = new Date(Number(ts));
    if (!isFinite(d.getTime())) return "";
    try { return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
    catch (e) { return d.getDate() + "/" + (d.getMonth() + 1); }
  }

  /** The text used for {letter}: SPACE for the space symbol (CT placeholder dictionary). */
  function letterName(ch) {
    return ch === " " ? SG.ui.t("play.spaceKey") : String(ch || "");
  }

  /**
   * The word containing position i of a clean sentence, for {word}. For a SPACE it returns the word
   * just before it, so "the SPACE after FOX" still reads sensibly.
   */
  function wordAt(sentence, i) {
    if (!sentence) return "";
    var pos = Math.max(0, Math.min(i, sentence.length - 1));
    if (sentence.charAt(pos) === " ") pos = Math.max(0, pos - 1);
    var start = sentence.lastIndexOf(" ", pos);
    var end = sentence.indexOf(" ", pos);
    return sentence.slice(start < 0 ? 0 : start + 1, end < 0 ? sentence.length : end);
  }

  /** Sum of a number array (0 for empty). */
  function sum(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s;
  }

  return {
    safe: safe, bits: bits, est: est, bits2: bits2, avg1: avg1, int: int, pct5: pct5, pct5n: pct5n,
    about: about, aboutBits: aboutBits, range: range, date: date,
    letterName: letterName, wordAt: wordAt, sum: sum
  };
})();
