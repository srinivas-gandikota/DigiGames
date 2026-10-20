/* SG.badges — gentle concept badges. evaluate() is pure: it returns ids, never mutates the profile. */
window.SG = window.SG || {};

SG.badges = (function () {
  /** Completed rounds, one entry per record.id: a round already in the history is not counted twice. */
  function completeDistinct(rounds) {
    var seen = {}, out = [];
    rounds.forEach(function (r) {
      if (!r || !r.complete) return;
      if (r.id != null) {
        if (seen[r.id]) return;
        seen[r.id] = true;
      }
      out.push(r);
    });
    return out;
  }

  function isCard(event, card) {
    return !!(event && event.type === "cardOpened" && event.card === card);
  }

  /** Each badge: id, display data and a `test(ctx)`; ctx = {rounds (complete, distinct, incl. event's), detective:int[], event}. */
  var DEFS = [
    { id: "shannon-starter", name: "Shannon Starter", emoji: "🌟", how: "Finish your first guessing round.",
      test: function (c) { return c.rounds.length >= 1; } },
    { id: "pattern-spotter", name: "Pattern Spotter", emoji: "🧩", how: "Finish 5 rounds.",
      test: function (c) { return c.rounds.length >= 5; } },
    { id: "bit-detective", name: "Bit Detective", emoji: "🕵️", how: "Solve one Bit Detective case.",
      test: function (c) { return c.detective.length >= 1; } },
    { id: "surprise-spotter", name: "Surprise Spotter", emoji: "😲", how: "Open the Surprise-o-meter card.",
      test: function (c) { return isCard(c.event, "surprise"); } },
    { id: "context-champion", name: "Context Champion", emoji: "🏆", how: "Finish a Peephole round.",
      test: function (c) { return c.rounds.some(function (r) { return r.mode === "peephole"; }); } },
    { id: "twin-maker", name: "Twin Maker", emoji: "👯", how: "Watch the Magic Twin rebuild a sentence.",
      test: function (c) { return !!(c.event && c.event.type === "twin"); } },
    { id: "squeeze-master", name: "Squeeze Master", emoji: "🤏", how: "Open the Squeeze-o-matic card.",
      test: function (c) { return isCard(c.event, "squeeze"); } },
    { id: "gibberish-explorer", name: "Gibberish Explorer", emoji: "🌪️", how: "Finish a Robot Gibberish round.",
      test: function (c) { return c.rounds.some(function (r) { return r.tier === "gibberish"; }); } },
    { id: "robo-buddy", name: "Robo Buddy", emoji: "🤖", how: "Open the You vs Robo card.",
      test: function (c) { return isCard(c.event, "robo"); } },
    { id: "grownup-peeker", name: "Grown-up Peeker", emoji: "🔍", how: "Open a Grown-up corner.",
      test: function (c) { return !!(c.event && c.event.type === "grownUp"); } }
  ];

  var ALL = DEFS.map(function (d) { return { id: d.id, name: d.name, emoji: d.emoji, how: d.how }; });

  /**
   * Which badges does this event newly earn? The conditions look at the profile's history PLUS the
   * event itself, so it does not matter whether the caller adds the record to the profile before or
   * after calling (a round with an id already in the history is not counted twice).
   * @param {Object} profile
   * @param {{type:"round", record:Object}|{type:"bitDetective", questions:number}|{type:"twin"}|
   *         {type:"cardOpened", card:string}|{type:"grownUp"}} event
   * @returns {string[]} ids not yet in profile.badges
   */
  function evaluate(profile, event) {
    var have = (profile && profile.badges) || {};
    var rounds = ((profile && profile.rounds) || []).slice();
    var detective = ((profile && profile.detective) || []).map(function (d) { return d.questions; });
    if (event && event.type === "round" && event.record) rounds.push(event.record);
    if (event && event.type === "bitDetective" && typeof event.questions === "number") {
      detective.push(event.questions);
    }
    var ctx = { rounds: completeDistinct(rounds), detective: detective, event: event };
    return DEFS.filter(function (d) { return !Object.prototype.hasOwnProperty.call(have, d.id) && d.test(ctx); })
      .map(function (d) { return d.id; });
  }

  return { ALL: ALL, evaluate: evaluate };
})();
