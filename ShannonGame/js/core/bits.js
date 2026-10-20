/* SG.bits — Bit Detective (A10): find a secret letter with yes/no halving questions. */
window.SG = window.SG || {};

SG.bits = (function () {
  /** Display order of the 27 candidates: A..Z then SPACE last. */
  var ORDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
  var WORST = 5;               // ceil(log2 27)
  var AVERAGE = 130 / 27;      // (5*4 + 22*5) / 27, just above log2(27) = 4.75

  /**
   * Start a game. `secret` is a character of ORDER; the candidate range is [lo, hi) over ORDER.
   * @returns {{secret:string, lo:number, hi:number, questions:number, answers:string, done:boolean}}
   */
  function create(rand) {
    var secret = ORDER.charAt(Math.floor(rand() * ORDER.length));
    return { secret: secret, lo: 0, hi: ORDER.length, questions: 0, answers: "", done: false };
  }

  /**
   * "Is it before ORDER[m]?" Requires lo < m < hi. yes -> range [lo, m) and bit "1";
   * no -> range [m, hi) and bit "0". Returns a NEW detective; the input is not modified.
   */
  function ask(det, m) {
    if (det.done) throw new Error("bits.ask: game is already finished");
    if (!(m > det.lo && m < det.hi)) throw new RangeError("bits.ask: m must satisfy lo < m < hi");
    var yes = ORDER.indexOf(det.secret) < m;
    var lo = yes ? det.lo : m, hi = yes ? m : det.hi;
    var next = {
      secret: det.secret, lo: lo, hi: hi,
      questions: det.questions + 1,
      answers: det.answers + (yes ? "1" : "0"),
      done: hi - lo === 1
    };
    return { answer: yes, det: next };
  }

  /** The halving hint: split the remaining range in the middle. */
  function bestSplit(det) {
    return Math.floor((det.lo + det.hi) / 2);
  }

  return { ORDER: ORDER, WORST: WORST, AVERAGE: AVERAGE, create: create, ask: ask, bestSplit: bestSplit };
})();
