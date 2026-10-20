/* SG.sound — tiny generated sound cues (design 03 §7; UX-065..067, NF-002). No audio files, no network.
 *
 *   SG.sound.play(name)       name: tap wrong correct1 correct2 correct3 correct4 reveal word finish
 *                             yes no flip tick badge. Does nothing while sound is off.
 *   SG.sound.setEnabled(bool) the Settings switch (off by default). The AudioContext is created lazily by the
 *                             first play()/unlock(), which browsers only allow inside a click/tap.
 *   SG.sound.isEnabled()
 *   SG.sound.unlock()         create/resume the AudioContext (call from any user gesture)
 *
 * Rules kept here: master gain 0.15, 5 ms attack, exponential release, at most 4 voices at once,
 * a lower-priority cue within 60 ms of another is dropped, every cue is shorter than 800 ms, and the
 * `tick` cue is silent under calm motion. Sound never carries information that is not also visible.
 * Also reachable as SG.ui.sound.
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.sound = SG.ui.sound = (function () {
  var enabled = false;
  var ctx = null, master = null;
  var last = { time: -1e9, priority: 0 };
  var MAX_VOICES = 4, MASTER_GAIN = 0.15, ATTACK = 0.005, DROP_WINDOW_MS = 60;

  // A note: f = Hz, f2 = glide target, at = start offset (ms), dur (ms), type, gain.
  function n(f, at, dur, extra) {
    var note = { f: f, at: at, dur: dur, type: "sine", gain: 0.5 };
    if (extra) Object.keys(extra).forEach(function (k) { note[k] = extra[k]; });
    return note;
  }

  var CUES = {
    tap: { priority: 0, notes: [n(520, 0, 30, { gain: 0.2 })] },
    wrong: { priority: 2, notes: [n(330, 0, 70, { type: "triangle", gain: 0.27 })] },
    correct1: { priority: 3, notes: [n(523.25, 0, 70), n(659.25, 70, 70), n(783.99, 140, 70)] },
    correct2: { priority: 3, notes: [n(523.25, 0, 80), n(659.25, 80, 80)] },
    correct3: { priority: 3, notes: [n(440, 0, 90), n(554.37, 90, 90), n(659.25, 180, 90), n(1318.5, 270, 60, { gain: 0.2 })] },
    correct4: { priority: 3, notes: [n(659.25, 0, 400), n(987.77, 0, 400, { gain: 0.35 }), n(1318.5, 120, 250, { gain: 0.2 })] },
    reveal: { priority: 2, notes: [n(392, 0, 150, { f2: 440 })] },
    word: { priority: 1, notes: [n(784, 0, 60)] },
    finish: { priority: 4, notes: [n(523.25, 0, 100), n(659.25, 100, 100), n(783.99, 200, 100), n(1046.5, 300, 100),
      n(523.25, 400, 300, { gain: 0.2 }), n(659.25, 400, 300, { gain: 0.2 }), n(783.99, 400, 300, { gain: 0.2 })] },
    yes: { priority: 2, notes: [n(660, 0, 80)] },
    no: { priority: 2, notes: [n(440, 0, 80)] },
    flip: { priority: 1, notes: [n(600, 0, 90, { f2: 800 })] },
    tick: { priority: 0, notes: [n(880, 0, 25, { gain: 0.13 })], silentWhenCalm: true },
    badge: { priority: 4, notes: [n(783.99, 0, 80), n(1046.5, 80, 80), n(1318.5, 160, 80)] }
  };

  function ensureContext() {
    if (ctx) { if (ctx.state === "suspended" && ctx.resume) ctx.resume(); return true; }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  /**
   * The 4-voice cap applies to notes that would sound AT THE SAME TIME. Counting every scheduled note
   * (the old rule) silenced the tail of long cues such as "finish", whose later notes start after the
   * first ones have ended. `scheduled` holds [start, end] of notes not yet finished.
   */
  var scheduled = [];
  function overlapping(start, end) {
    var now = ctx.currentTime;
    scheduled = scheduled.filter(function (n) { return n[1] > now; });
    return scheduled.filter(function (n) { return n[0] < end && n[1] > start; }).length;
  }

  function playNote(note, base) {
    var start = base + note.at / 1000, end = start + note.dur / 1000;
    if (overlapping(start, end) >= MAX_VOICES) return;
    scheduled.push([start, end]);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = note.type;
    osc.frequency.setValueAtTime(note.f, start);
    if (note.f2) osc.frequency.linearRampToValueAtTime(note.f2, end);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(note.gain, start + ATTACK);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g); g.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  function play(name) {
    if (!enabled) return;
    var cue = CUES[name];
    if (!cue) return;
    if (cue.silentWhenCalm && SG.ui.theme && SG.ui.theme.isCalm()) return;
    var nowMs = Date.now();
    if (nowMs - last.time < DROP_WINDOW_MS && cue.priority < last.priority) return;
    if (!ensureContext()) return;
    last = { time: nowMs, priority: cue.priority };
    var base = ctx.currentTime + 0.01;
    try { cue.notes.forEach(function (note) { playNote(note, base); }); } catch (e) { /* sound must never break play */ }
  }

  return {
    play: play,
    setEnabled: function (on) { enabled = !!on; },   // the AudioContext is created lazily by play()/unlock(), inside a user gesture
    isEnabled: function () { return enabled; },
    unlock: function () { if (enabled) ensureContext(); },
    cues: Object.keys(CUES)
  };
})();
