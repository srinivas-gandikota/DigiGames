/* SG.twin — Magic Twin (A9): a sentence as Robo's numbers, and back again. */
window.SG = window.SG || {};

SG.twin = (function () {
  /** Robo's guess numbers for the sentence. `order` defaults to model.maxOrder (use roboOrder(peek) for Peephole rounds). */
  function encode(model, sentence, order) {
    return model.play(sentence, order == null ? model.maxOrder : order).ranks;
  }

  /**
   * Rebuild the partial sentence after each number. Works because ranking() is deterministic
   * (ties by symbol index) and depends only on the already-decoded prefix.
   * @returns {string[]} frames[i] = text after i+1 numbers
   */
  function decodeFrames(model, ranks, order) {
    var ord = order == null ? model.maxOrder : order;
    var out = "", frames = [];
    for (var i = 0; i < ranks.length; i++) {
      var r = ranks[i];
      if (!(r >= 1 && r <= SG.alphabet.SIZE) || r !== Math.floor(r)) throw new RangeError("twin: bad rank " + r);
      out += SG.alphabet.char(model.ranking(out, ord)[r - 1]);
      frames.push(out);
    }
    return frames;
  }

  function decode(model, ranks, order) {
    var frames = decodeFrames(model, ranks, order);
    return frames.length ? frames[frames.length - 1] : "";
  }

  return { encode: encode, decode: decode, decodeFrames: decodeFrames };
})();
