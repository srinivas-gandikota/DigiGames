/* SG.config — every tunable constant lives here (see docs/design/02-algorithms.md §A13). */
window.SG = window.SG || {};

SG.VERSION = "1.0.0";        // game version (NF-066); content version lives in SG.data

SG.config = {
  // Robo's predictor
  MAX_ORDER: 4,              // longest look-back (letters) Robo uses; chosen by measurement — see docs/implementation/07 D4

  // Guessing
  GIVE_UP_AFTER: 6,          // wrong guesses before "Show me" (give up) is offered

  // Analyses
  SUFFICIENCY_EPS: 0.1,      // bits: knee = first look-back within this of the farthest look-back (DB-061)
  FLAT_CURVE: 0.3,           // bits: a look-back curve that improves less than this is "flat" (Gibberish)
  MIN_PARTIAL: 15,           // characters needed for a partial Discovery Board
  ROUGH_N: 30,               // fewer characters than this → estimates tagged "rough" (DB-018)
  ROUGH_REVEALED: 0.25,      // more than this share revealed → "rough"
  VERDICT_TIE: 0.2,          // bits: Robo-vs-You midpoints closer than this are "about even" (DB-074)
  WORDPOS_MIN: 3,            // letters needed before a word-position bar shows a value (DB-038)
  TREND_MIN: 6,              // rounds needed before a Journey trend sentence (DB-096)
  TREND_DELTA: 0.3,          // bits of change needed to say "gone down/up"

  // Content
  SENTENCE_MIN: 25,
  SENTENCE_MAX: 70,
  GIBBERISH_MIN: 25,         // GP-110
  GIBBERISH_MAX: 30,
  TWIN_MATCH_RUN: 20,        // no puzzle may share this many characters with Robo's training text
  RECENT_AVOID: 15,          // never repeat one of the last N puzzles of a tier (CT-021)

  // Modes
  PEEK_OPTIONS: [0, 1, 2, 3, 5],

  // Storage
  STORAGE_KEY: "shannonGame.v1",
  HISTORY_LIMIT: 200,

  // UI timings (ms)
  ROBO_STEP_MS: 90,          // Robo replay speed per character
  TWIN_STEP_MS: 140,         // Magic Twin rebuild speed per character
  CURIOUS_AT: 4              // guess count from which Robo looks curious (UX-012, GP §5.3 "tricky")
};
