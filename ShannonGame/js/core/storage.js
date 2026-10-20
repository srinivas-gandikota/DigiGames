/* SG.storage — the saved Profile. The only core module allowed to touch the browser (localStorage),
   and only through guards: if storage is missing or throws, an in-memory copy keeps the game playable. */
window.SG = window.SG || {};

SG.storage = (function () {
  var memory = null; // JSON string of the last saved profile; the fallback when localStorage is unusable

  /** A fresh default Profile (architecture §5). */
  function defaults() {
    return {
      v: 1,
      nickname: "",
      settings: { sound: false, calmMotion: null, layout: "abc", bigKeys: false, highContrast: false,
                  quietRobo: false, tallyCollapsed: false },
      notices: { trimmed: false, storage: false, privacySeen: false },   // tell-once notes
      onboarded: false,
      practiced: false,   // the Classic practice round has been offered (GP-011)
      lastPeek: null,     // last Peephole window chosen in Setup ("0".."5" or "all")
      badges: {},
      rounds: [],
      detective: [],      // [{ts, secret, questions, best, ranges:[[lo,hi],…]}]
      cards: {},          // {[cardId]: {opened, gotIt}}
      lastTier: "easy",
      inProgress: null
    };
  }

  /** window.localStorage if it exists and works, else null (accessing it can itself throw). */
  function backend() {
    try {
      var ls = window.localStorage;
      if (!ls) return null;
      var probe = SG.config.STORAGE_KEY + ".probe";
      ls.setItem(probe, "1");
      ls.removeItem(probe);
      return ls;
    } catch (e) {
      return null;
    }
  }

  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }

  /** Defaults overlaid with whatever valid fields the stored object has (forward-compatible). */
  function merge(stored) {
    var p = defaults();
    if (!isObj(stored)) return p;
    Object.keys(stored).forEach(function (k) { p[k] = stored[k]; });
    p.v = 1;
    p.settings = Object.assign(defaults().settings, isObj(stored.settings) ? stored.settings : {});
    if (typeof p.nickname !== "string") p.nickname = "";
    p.onboarded = !!p.onboarded;
    if (!isObj(p.badges)) p.badges = {};
    if (!Array.isArray(p.rounds)) p.rounds = [];
    if (!Array.isArray(p.detective)) p.detective = [];
    if (!isObj(p.cards)) p.cards = {};
    if (typeof p.lastTier !== "string") p.lastTier = "easy";
    if (!isObj(p.inProgress)) p.inProgress = null;
    return p;
  }

  var api = {
    available: false,
    defaults: defaults,

    /** Re-check whether localStorage works; updates and returns `available`. */
    probe: function () {
      api.available = backend() !== null;
      return api.available;
    },

    /** Load the Profile (defaults merged in). Never throws. */
    load: function () {
      var raw = memory, ls = backend();
      api.available = ls !== null;
      if (ls) {
        try { raw = ls.getItem(SG.config.STORAGE_KEY); } catch (e) { api.available = false; raw = memory; }
      }
      if (raw == null) return defaults();
      try { return merge(JSON.parse(raw)); } catch (e) { return defaults(); }
    },

    /** Save the Profile; returns true if it reached localStorage (false = kept in memory only). */
    save: function (profile) {
      var raw = JSON.stringify(profile);
      memory = raw;
      var ls = backend();
      api.available = ls !== null;
      if (!ls) return false;
      try { ls.setItem(SG.config.STORAGE_KEY, raw); return true; }
      catch (e) { api.available = false; return false; }
    },

    /** Forget everything; returns a fresh default Profile. */
    reset: function () {
      memory = null;
      var ls = backend();
      if (ls) { try { ls.removeItem(SG.config.STORAGE_KEY); } catch (e) { /* ignore */ } }
      return defaults();
    },

    /** Append a RoundRecord (newest last), dropping the oldest beyond HISTORY_LIMIT. Mutates and returns profile. */
    addRound: function (profile, record) {
      profile.rounds.push(record);
      var extra = profile.rounds.length - SG.config.HISTORY_LIMIT;
      if (extra > 0) profile.rounds.splice(0, extra);
      return profile;
    },

    /**
     * Record a Bit Detective case {ts, secret, questions, best, ranges:[[lo,hi],…]} (architecture §5).
     * Mutates and returns profile.
     */
    addDetective: function (profile, entry) {
      profile.detective.push(entry);
      return profile;
    },

    /** Mark badge ids as earned at timestamp `ts` (existing ones keep their first date). */
    award: function (profile, ids, ts) {
      ids.forEach(function (id) { if (!(id in profile.badges)) profile.badges[id] = ts; });
      return profile;
    }
  };
  api.probe();
  return api;
})();
