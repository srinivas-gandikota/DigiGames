/* SG.ui.icon(name, opts) — small inline SVG icons, drawn in code so there are no image files (NF-002).
 *
 *   SG.ui.icon("home", {size: 24, cls: "extra-class"})  ->  <svg> element (decorative, aria-hidden)
 *
 * Small icons (24 box):  home gear speakerOn speakerOff eye check cross star magnifier chevronDown
 *                        chevronUp chevronLeft chevronRight pause play lock die arrowRight
 * Mode tile icons (48 box): tileDetective tileClassic tilePeephole tileTwoPlayer tileGibberish
 * Strokes use currentColor, so an icon takes the colour of the text around it. Icons never carry
 * meaning alone: callers always pair them with a text label (UX-015).
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.icon = (function () {
  var s = function () { return SG.ui.s.apply(null, arguments); };

  var STROKE = { fill: "none", stroke: "currentColor", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" };
  function line(x1, y1, x2, y2) { return s("line", { x1: x1, y1: y1, x2: x2, y2: y2 }); }
  function path(d, extra) { var a = { d: d }; if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; }); return s("path", a); }
  function rect(x, y, w, h, rx, extra) {
    var a = { x: x, y: y, width: w, height: h, rx: rx || 0 };
    if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
    return s("rect", a);
  }
  function circle(cx, cy, r, extra) {
    var a = { cx: cx, cy: cy, r: r };
    if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
    return s("circle", a);
  }
  var FILL = { fill: "currentColor", stroke: "none" };

  // 24x24 icons: each returns an array of shapes.
  var SMALL = {
    home: function () { return [path("M3.5 11.5 12 4l8.5 7.5"), path("M6 10.5V20h12v-9.5"), path("M10 20v-5h4v5")]; },
    gear: function () {
      var teeth = [];
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        teeth.push(line((12 + Math.cos(a) * 7.6).toFixed(2), (12 + Math.sin(a) * 7.6).toFixed(2),
          (12 + Math.cos(a) * 10).toFixed(2), (12 + Math.sin(a) * 10).toFixed(2)));
      }
      return [circle(12, 12, 5.6), circle(12, 12, 2)].concat(teeth);
    },
    speakerOn: function () { return [path("M4 9.5h4l5-4v13l-5-4H4z"), path("M16.5 9a4 4 0 0 1 0 6"), path("M19 6.5a8 8 0 0 1 0 11")]; },
    speakerOff: function () { return [path("M4 9.5h4l5-4v13l-5-4H4z"), line(17, 9.5, 22, 14.5), line(22, 9.5, 17, 14.5)]; },
    eye: function () { return [path("M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"), circle(12, 12, 3)]; },
    check: function () { return [path("M4.5 12.5 10 18 19.5 6.5")]; },
    cross: function () { return [line(6, 6, 18, 18), line(18, 6, 6, 18)]; },
    star: function () { return [path("M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z", { fill: "currentColor" })]; },
    magnifier: function () { return [circle(10.5, 10.5, 6), line(15, 15, 20.5, 20.5)]; },
    chevronDown: function () { return [path("M6 9l6 6 6-6")]; },
    chevronUp: function () { return [path("M6 15l6-6 6 6")]; },
    chevronLeft: function () { return [path("M15 6l-6 6 6 6")]; },
    chevronRight: function () { return [path("M9 6l6 6-6 6")]; },
    arrowRight: function () { return [line(4, 12, 19, 12), path("M13 6l6 6-6 6")]; },
    pause: function () { return [rect(6.5, 5, 4, 14, 1, FILL), rect(13.5, 5, 4, 14, 1, FILL)]; },
    play: function () { return [path("M8 5l11 7-11 7z", FILL)]; },
    lock: function () { return [rect(5.5, 10.5, 13, 9.5, 2.5), path("M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5")]; },
    die: function () { return [rect(4, 4, 16, 16, 4), circle(9, 9, 1.4, FILL), circle(15, 9, 1.4, FILL), circle(12, 12, 1.4, FILL), circle(9, 15, 1.4, FILL), circle(15, 15, 1.4, FILL)]; }
  };

  // 48x48 mode tile icons. These use theme colours through CSS classes (sg-ic-*) as well as currentColor.
  function letterBox(x, y, w, h, hl) {
    return rect(x, y, w, h, 3, { "class": hl ? "sg-ic-hl" : "sg-ic-box", "stroke-width": 2.2 });
  }
  var TILE = {
    tileDetective: function () {
      return [letterBox(3, 30, 8, 10), letterBox(12, 30, 8, 10), letterBox(21, 30, 8, 10, true), letterBox(30, 30, 8, 10), letterBox(39, 30, 6, 10),
        circle(20, 17, 9, { "class": "sg-ic-glass", "stroke-width": 3 }), line(26.5, 23.5, 34, 31)];
    },
    tileClassic: function () {
      return [letterBox(3, 14, 10, 16), letterBox(15, 14, 10, 16), letterBox(27, 14, 10, 16),
        rect(39, 14, 7, 16, 3, { "class": "sg-ic-cursor", "stroke-width": 2.4 }),
        path("M42.5 6v6M40 9.5l2.5 3 2.5-3", { "stroke-width": 2 }), line(6, 38, 42, 38)];
    },
    tilePeephole: function () {
      return [rect(3, 10, 14, 26, 6, { "class": "sg-ic-fog", "stroke-width": 2, "stroke-dasharray": "3 3" }),
        letterBox(20, 17, 8, 12), letterBox(30, 17, 8, 12, true), rect(17, 10, 28, 26, 8, { "stroke-width": 3 })];
    },
    tileTwoPlayer: function () {
      return [rect(3, 12, 14, 12, 5, { "class": "sg-ic-box" }), circle(7.5, 17, 1.4, FILL), circle(12.5, 17, 1.4, FILL),
        rect(31, 12, 14, 12, 5, { "class": "sg-ic-box" }), circle(35.5, 17, 1.4, FILL), circle(40.5, 17, 1.4, FILL),
        rect(18.5, 27, 11, 9, 2.5, { "class": "sg-ic-hl" }), path("M21 27v-3a3 3 0 0 1 6 0v3")];
    },
    tileGibberish: function () {
      return [rect(5, 12, 18, 18, 5, { "class": "sg-ic-box" }), circle(11, 18, 1.5, FILL), circle(17, 18, 1.5, FILL), circle(14, 21, 1.5, FILL), circle(11, 25, 1.5, FILL), circle(17, 25, 1.5, FILL),
        circle(36, 33, 7, { "class": "sg-ic-hl" }), circle(36, 33, 2.4), path("M5 40h12M5 44h8", { "stroke-width": 2 })];
    }
  };

  return function icon(name, opts) {
    opts = opts || {};
    var isTile = Object.prototype.hasOwnProperty.call(TILE, name);
    var drawer = isTile ? TILE[name] : SMALL[name];
    var box = isTile ? 48 : 24;
    var size = opts.size || box;
    var attrs = { "class": "sg-icon" + (opts.cls ? " " + opts.cls : ""), viewBox: "0 0 " + box + " " + box, width: size, height: size, "aria-hidden": "true", focusable: "false" };
    var svg = SG.ui.s("svg", attrs);
    if (!drawer) return svg;
    var g = SG.ui.s("g", STROKE);
    drawer().forEach(function (shape) { g.appendChild(shape); });
    svg.appendChild(g);
    return svg;
  };
})();
