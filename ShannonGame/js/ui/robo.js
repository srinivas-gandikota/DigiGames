/* SG.ui.robo — Robo the mascot, as inline SVG with seven moods (design 03 §2).
 *
 *   SG.ui.robo.create(mood, size, opts)  ->  <div class="sg-robo"> (figure + speech bubble) with methods:
 *        el.setMood(mood)                 instant mood swap (no animation, so it is calm-safe)
 *        el.say(text, moodOrOpts)         show a speech bubble (<= 15 words) and announce it politely.
 *                                         opts: {mood, essential, silent}. With Quiet Robo on, non-essential
 *                                         remarks are skipped (the mood still changes). Returns the element.
 *        el.clearSay()                    remove the bubble text
 *        el.mood                          current mood name
 *      create opts: {layout: "row"|"stack", bubble: false to omit the bubble}
 *   SG.ui.robo.svg({mood, size})         just the figure: <svg role="img"> with an aria-label from robo.alt
 *   SG.ui.robo.MOODS                     neutral happy curious cheering thinking sleepy waving
 *   SG.ui.robo.isQuiet()                 the Quiet Robo setting (GP-008)
 *
 * Robo is never sad, angry or disappointed (UX-012): no down-turned mouths, no angled brows, no tears.
 * Colours come from CSS classes (r-*) bound to design tokens in base.css, so themes switch instantly.
 * Geometry follows the anatomy table in design 03 §2; a few open mouths are drawn slightly shorter than
 * the table so they stay inside the face screen.
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.robo = (function () {
  var MOODS = ["neutral", "happy", "curious", "cheering", "thinking", "sleepy", "waving"];
  var MAX_WORDS = 15;

  function S(tag, cls, attrs) {
    var a = attrs || {};
    if (cls) a["class"] = cls;
    return SG.ui.s(tag, a);
  }
  function g(cls, attrs, kids) {
    var el = S("g", cls, attrs);
    (kids || []).forEach(function (k) { if (k) el.appendChild(k); });
    return el;
  }

  /* ----- parts ------------------------------------------------------------------------------- */

  /** An arm from the shoulder (x1,y1) to a hand at (x2,y2): outline, capsule, hand. */
  function arm(x1, y1, x2, y2) {
    return g("r-arm", null, [
      S("line", "r-arm-out", { x1: x1, y1: y1, x2: x2, y2: y2 }),
      S("line", "r-arm-in", { x1: x1, y1: y1, x2: x2, y2: y2 }),
      S("circle", "r-sun r-out", { cx: x2, cy: y2, r: 6 })
    ]);
  }

  function rays(cx, cy, angles) {
    return g("r-rays", null, angles.map(function (deg) {
      var a = (deg - 90) * Math.PI / 180;
      return S("line", "r-ray", {
        x1: (cx + Math.cos(a) * 10).toFixed(1), y1: (cy + Math.sin(a) * 10).toFixed(1),
        x2: (cx + Math.cos(a) * 14).toFixed(1), y2: (cy + Math.sin(a) * 14).toFixed(1)
      });
    }));
  }

  function eyesOpen(rxL, ryL, rxR, ryR) {
    return g("r-eyes", null, [
      S("ellipse", "r-eye", { cx: 47, cy: 52, rx: rxL, ry: ryL }),
      S("ellipse", "r-eye", { cx: 73, cy: 52, rx: rxR, ry: ryR })
    ]);
  }
  function eyesArcs(up) {
    // up: ^ ^ (happy). !up: u u (sleepy, closed eyes, not sad).
    var d1 = up ? "M41 56 Q47 46 53 56" : "M41 52 Q47 58 53 52";
    var d2 = up ? "M67 56 Q73 46 79 56" : "M67 52 Q73 58 79 52";
    return g("r-eyes", null, [S("path", "r-eyeline", { d: d1 }), S("path", "r-eyeline", { d: d2 })]);
  }

  var SMILE = "M49 64 Q60 70 71 64";

  function cheeks() {
    return g("r-cheeks", null, [
      S("circle", "r-cheek", { cx: 36, cy: 62, r: 5 }),
      S("circle", "r-cheek", { cx: 84, cy: 62, r: 5 })
    ]);
  }

  function star(cx, cy, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 ? r * 0.45 : r, a = (i * 36 - 90) * Math.PI / 180;
      pts.push((cx + Math.cos(a) * rad).toFixed(1) + "," + (cy + Math.sin(a) * rad).toFixed(1));
    }
    return S("polygon", "r-sun r-out-thin", { points: pts.join(" ") });
  }

  /** The head with its face for one mood. Returns {group, antennaBulbAt}. */
  function head(mood) {
    var antenna, bulb;
    if (mood === "curious") {
      antenna = S("path", "r-stalk", { d: "M60 22 Q60 12 68 10" });
      bulb = g(null, null, [S("circle", "r-sun r-out", { cx: 69, cy: 8, r: 6 }), S("circle", "r-ring", { cx: 69, cy: 8, r: 10 })]);
    } else {
      antenna = S("line", "r-stalk", { x1: 60, y1: 22, x2: 60, y2: 8 });
      bulb = S("circle", "r-sun r-out", { cx: 60, cy: 7, r: 6 });
    }
    var antennaGroup = g(null, mood === "sleepy" ? { transform: "rotate(30 60 22)" } : null, [antenna, bulb]);
    if (mood === "happy") antennaGroup.appendChild(rays(60, 7, [-50, -20, 20, 50]));
    if (mood === "cheering") antennaGroup.appendChild(rays(60, 7, [0, 45, 90, 135, 180, 225, 270, 315]));

    var face = [S("rect", mood === "sleepy" ? "r-screen-dim" : "r-screen", { x: 30, y: 34, width: 60, height: 40, rx: 16 })];
    if (mood === "happy" || mood === "cheering") face.push(eyesArcs(true));
    else if (mood === "sleepy") face.push(eyesArcs(false));
    else if (mood === "curious") face.push(eyesOpen(7.5, 10, 5.5, 7));
    else if (mood === "waving") face.push(eyesOpen(5.5, 7.5, 5.5, 7.5));
    else face.push(eyesOpen(6.5, 8.5, 6.5, 8.5));

    if (mood === "thinking") {
      face.push(S("circle", "r-pupil", { cx: 50, cy: 49, r: 3.2 }), S("circle", "r-pupil", { cx: 76, cy: 49, r: 3.2 }));
    }
    if (mood === "curious") {
      face.push(S("circle", "r-glint", { cx: 49.5, cy: 47.5, r: 2.2 }), S("circle", "r-glint", { cx: 74.5, cy: 49.5, r: 1.6 }));
    }

    // Mouths
    if (mood === "happy") face.push(S("path", "r-mouth-open", { d: "M48 62 Q60 72 72 62 Z" }));
    else if (mood === "cheering") face.push(S("path", "r-mouth-open", { d: "M46 60 H74 Q74 72 60 72 Q46 72 46 60 Z" }));
    else if (mood === "curious") face.push(S("ellipse", "r-mouth-o", { cx: 60, cy: 67, rx: 4, ry: 5 }));
    else if (mood === "thinking") face.push(S("path", "r-eyeline", { d: "M52 66 H68", transform: "rotate(4 60 66)" }));
    else if (mood === "sleepy") face.push(S("path", "r-eyeline", { d: "M56 66 H64" }));
    else face.push(S("path", "r-eyeline", { d: SMILE }));
    if (mood === "happy" || mood === "cheering" || mood === "waving") face.push(cheeks());

    var headParts = [
      antennaGroup,
      S("circle", "r-sun r-out", { cx: 15, cy: 54, r: 7 }),
      S("circle", "r-sun r-out", { cx: 105, cy: 54, r: 7 }),
      S("rect", "r-shell", { x: 20, y: 22, width: 80, height: 64, rx: 24 }),
      // Shade along the bottom 10 units of the head, following the rounded corners (no clipPath needed).
      S("path", "r-shade", { d: "M24.51 76 H95.49 A24 24 0 0 1 76 86 H44 A24 24 0 0 1 24.51 76 Z" }),
      S("rect", "r-out-only", { x: 20, y: 22, width: 80, height: 64, rx: 24 })
    ].concat(face);
    var attrs = mood === "curious" ? { transform: "rotate(-8 60 86)" } : null;
    return g("r-head", attrs, headParts);
  }

  function body() {
    return g("r-body", null, [
      S("rect", "r-shade r-out", { x: 52, y: 86, width: 16, height: 6 }),
      S("rect", "r-shell r-out", { x: 32, y: 92, width: 56, height: 40, rx: 16 }),
      S("circle", "r-sun r-out", { cx: 60, cy: 110, r: 8 }),
      S("circle", "r-white", { cx: 60, cy: 110, r: 3 })
    ]);
  }

  function confetti() {
    return g("r-confetti", null, [
      S("circle", "r-sun r-out-thin", { cx: 12, cy: 26, r: 3.5 }),
      S("polygon", "r-primary r-out-thin", { points: "108,14 113,23 103,23" }),
      star(100, 36, 5),
      S("circle", "r-cheek r-out-thin", { cx: 20, cy: 6, r: 3 })
    ]);
  }

  function thoughts() {
    return g("r-thoughts", null, [
      S("circle", "r-white r-out-thin", { cx: 98, cy: 16, r: 2 }),
      S("circle", "r-white r-out-thin", { cx: 106, cy: 8, r: 3 }),
      S("circle", "r-white r-out-thin", { cx: 114, cy: 2, r: 4 })
    ]);
  }

  function zzz() {
    return g("r-z", null, [
      S("path", "r-zline", { d: "M92 22 H100 L92 30 H100" }),
      S("path", "r-zline", { d: "M105 8 H110 L105 14 H110" })
    ]);
  }

  /** All the nodes of one pose, in painting order. */
  function pose(mood) {
    var nodes = [];
    var rightHandUp = mood === "waving";
    if (mood === "cheering") nodes.push(arm(32, 100, 16, 78), arm(88, 100, 104, 78));
    else if (rightHandUp) nodes.push(arm(32, 100, 20, 122), arm(88, 100, 104, 76));
    else if (mood === "thinking") nodes.push(arm(32, 100, 20, 122));
    else nodes.push(arm(32, 100, 20, 122), arm(88, 100, 100, 122));
    nodes.push(body(), head(mood));
    if (mood === "thinking") nodes.push(arm(88, 100, 74, 84), thoughts());
    if (mood === "cheering") nodes.push(confetti());
    if (mood === "sleepy") nodes.push(zzz());
    if (rightHandUp) {
      nodes.push(S("path", "r-motion", { d: "M112 68 Q117 76 112 84" }), S("path", "r-motion", { d: "M116 64 Q124 76 116 88" }));
    }
    return nodes;
  }

  function fillSvg(svg, mood) {
    SG.ui.clear(svg);
    var bob = g("sg-robo-bob", null, pose(mood));
    svg.appendChild(bob);
    svg.setAttribute("data-mood", mood);
  }

  /* ----- public ------------------------------------------------------------------------------ */

  function validMood(m) { return MOODS.indexOf(m) >= 0 ? m : "neutral"; }

  function svg(o) {
    o = o || {};
    var mood = validMood(o.mood), size = o.size || 80;
    var el = SG.ui.s("svg", {
      "class": "sg-robo-svg", viewBox: "0 0 120 140", width: size, height: Math.round(size * 140 / 120),
      role: "img", "aria-label": SG.ui.t("robo.alt." + mood), focusable: "false"
    });
    fillSvg(el, mood);
    return el;
  }

  function isQuiet() {
    return !!(SG.app && SG.app.profile && SG.app.profile.settings && SG.app.profile.settings.quietRobo);
  }

  function limitWords(text) {
    var words = String(text).split(/\s+/).filter(Boolean);
    if (words.length <= MAX_WORDS) return String(text);
    if (typeof console !== "undefined" && console.warn) console.warn("[robo] bubble longer than " + MAX_WORDS + " words: " + text);
    return words.slice(0, MAX_WORDS).join(" ");
  }

  function create(mood, size, opts) {
    opts = opts || {};
    var figure = svg({ mood: mood, size: size || 80 });
    var hasBubble = opts.bubble !== false;
    var bubble = hasBubble ? SG.ui.h("p", { "class": "sg-bubble", hidden: true }) : null;
    var el = SG.ui.h("div", { "class": "sg-robo sg-robo--" + (opts.layout || "row"), "data-mood": validMood(mood) },
      SG.ui.h("div", { "class": "sg-robo-figure" }, figure), bubble);
    el.mood = validMood(mood);

    function syncAria() {
      // With a bubble showing, the bubble text is the announcement; the figure would only repeat it.
      if (bubble && !bubble.hidden) { figure.setAttribute("aria-hidden", "true"); figure.removeAttribute("role"); }
      else { figure.removeAttribute("aria-hidden"); figure.setAttribute("role", "img"); }
    }

    el.setMood = function (m) {
      m = validMood(m);
      el.mood = m;
      el.setAttribute("data-mood", m);
      figure.setAttribute("aria-label", SG.ui.t("robo.alt." + m));
      fillSvg(figure, m);
      return el;
    };

    el.say = function (text, o) {
      var options = typeof o === "string" ? { mood: o } : (o || {});
      if (options.mood) el.setMood(options.mood);
      if (!bubble || !text) return el;
      if (isQuiet() && !options.essential) return el;
      var clipped = limitWords(text);
      bubble.textContent = clipped;
      bubble.hidden = false;
      syncAria();
      if (!options.silent && SG.ui.a11y) SG.ui.a11y.announce(clipped);
      return el;
    };

    el.clearSay = function () {
      if (bubble) { bubble.textContent = ""; bubble.hidden = true; syncAria(); }
      return el;
    };

    el.figure = figure;
    return el;
  }

  return { create: create, svg: svg, MOODS: MOODS, isQuiet: isQuiet };
})();
