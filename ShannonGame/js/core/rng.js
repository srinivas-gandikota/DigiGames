/* SG.rng — seeded randomness (A11). The core never calls Math.random; callers pass a `rand` function. */
window.SG = window.SG || {};

SG.rng = (function () {
  /**
   * mulberry32: tiny, fast, well-distributed 32-bit PRNG. Same seed -> same sequence, which is what
   * makes rounds, gibberish and the bit-detective reproducible in tests.
   * @param {number} seed integer seed
   * @returns {function(): number} generator of floats in [0, 1)
   */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Integer in [0, n). */
  function randInt(rand, n) {
    return Math.floor(rand() * n);
  }

  /** One random element of a non-empty array (undefined if empty). */
  function pick(rand, array) {
    return array[randInt(rand, array.length)];
  }

  /** Fisher–Yates shuffle; returns a NEW array and leaves the input untouched. */
  function shuffle(rand, array) {
    var out = array.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = randInt(rand, i + 1);
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  return { mulberry32: mulberry32, randInt: randInt, pick: pick, shuffle: shuffle };
})();
