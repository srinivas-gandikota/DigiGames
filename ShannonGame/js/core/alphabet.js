/* SG.alphabet — the 27 symbols and text cleaning (A1). Symbols are ints: 0 = SPACE, 1..26 = A..Z. */
window.SG = window.SG || {};

SG.alphabet = (function () {
  var SYMBOLS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var SIZE = 27;
  var HMAX = Math.log(27) / Math.LN2; // log2(27) = 4.7549 bits: a letter picked blindly

  /**
   * A1. Fold accents (e-acute -> e, via NFD and dropping combining marks), uppercase, drop
   * apostrophes (DON'T -> DONT), turn everything else that is not A-Z into a space, collapse space
   * runs, trim. Result only contains symbols from SYMBOLS.
   */
  function clean(text) {
    var s = String(text == null ? "" : text);
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s
      .toUpperCase()
      .replace(/['’]/g, "")
      .replace(/[^A-Z]+/g, " ")
      .replace(/^ +| +$/g, "");
  }

  /** True when the text contains any digit (two-player input is rejected rather than silently cleaned). */
  function hasDigits(text) {
    return /[0-9]/.test(String(text == null ? "" : text));
  }

  /** Symbol index of a single character, or -1 if it is not one of the 27 symbols. */
  function index(ch) {
    if (typeof ch !== "string" || ch.length !== 1) return -1;
    return SYMBOLS.indexOf(ch);
  }

  /** Character of a symbol index ("" for out-of-range). */
  function char(i) {
    return i >= 0 && i < SIZE ? SYMBOLS.charAt(i) : "";
  }

  /** Display label: the open-box symbol for SPACE, otherwise the letter itself. */
  function label(ch) {
    return ch === " " ? "␣" : ch;
  }

  /** Words of an (already clean) sentence. */
  function words(sentence) {
    return sentence ? sentence.split(" ").filter(function (w) { return w.length > 0; }) : [];
  }

  return {
    SYMBOLS: SYMBOLS, SIZE: SIZE, HMAX: HMAX,
    clean: clean, hasDigits: hasDigits, index: index, char: char, label: label, words: words
  };
})();
