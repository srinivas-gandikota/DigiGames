/* SG.ui.charts — the hand-written SVG/DOM chart toolkit (design 03 §6). No libraries.
 *
 * Every function returns {el, text, table, update(size)}:
 *   el      an <svg role="img"> with <title>/<desc> (or a DOM element for the tile strips)
 *   text    string[]  sentences for the "Show as words" alternative (UX-057, DB-009)
 *   table   {caption, headers[], rows[][]}  the same data as a table
 *   update  update({width}) or update(width): redraw at a new pixel width (SVG charts are drawn at the
 *           container's real pixel width, so text stays >= 14 px and is never scaled)
 *
 *   barChart({orientation:"v"|"h", bars:[{label, value, valueLabel, band, segments:[{value, hatch, saved}],
 *             whisker:[lo,hi], placeholder, note}], max, yTicks, ariaLabel, caption, width, height, integerTicks})
 *   lineChart({xCats:[{key,label}], yDomain:[0,4.75], series:[{id,label,shape,style:"main"|"light"|"dashed",
 *             points:[{x,y,lo,hi,label,ring,hollow}]}], markers:[{x,label,kind:"knee"}],
 *             regions:[{from,to,label,hatch}], refLines:[{y,label}], legend, ariaLabel, caption, width, height})
 *   numberLine({min, max, band:{lo,hi,mid,label}, marks:[{value,label,shape:"diamond"|"triangle"}], ariaLabel, width})
 *   rangeLadder({rows:[{lo,hi}], total:27, label, sizes:true, secret:{index,label}, ariaLabel, width})
 *   sentenceTiles({chars, bands, ranks, revealed, roboRanks, mode:"surprise"|"fade", onSelect(i, info), ariaLabel})
 *        -> also .select(i), .setHideFaint(bool)
 *   alignedRows({chars, rows:[{label, values, bands, revealed}], perBlock, activeIndex})
 *        -> also .setActive(i), .showUpTo(n), .showAll()
 *   miniBars({values, bands, revealed, maxRows}) -> also .push(value, band, revealed)
 *   legend({items:[{band|hatch|saved|shape|swatchClass, label}]})
 *   compareStrip({cells:[{result:"you"|"same"|"robo"|"revealed"}]})
 *   describe(cardId, summary, record, ctx) -> {text[], table}   text alternatives for the nine Board cards
 *
 * Helpers: mount(container, chart) keeps an SVG chart sized to its container (ResizeObserver, cleaned up
 * by the router); disclosure(chart, {picture}) builds the "Show as words" toggle + panel; tableEl(table);
 * scaleLinear, scaleBand, niceTicks, extendMax.
 *
 * Colours come from CSS classes (sg-fill-b0..b4, sg-band-0..4 ...) bound to design tokens, so a theme
 * switch is instant. Patterns #sg-hatch (revealed) and #sg-dots (saved / placeholder) live in one hidden
 * <svg><defs> injected once. All user-derived text goes in with textContent (SG.ui.h / SG.ui.s).
 * The y-axis always extends when data exceeds the nominal maximum (Robo's gibberish curve can pass 4.75).
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.charts = (function () {
  var s = function () { return SG.ui.s.apply(null, arguments); };
  var h = function () { return SG.ui.h.apply(null, arguments); };
  var t = function (k, v) { return SG.ui.t(k, v); };
  var fmt = SG.ui.fmt;
  var uid = 0;
  function nextId(prefix) { uid++; return prefix + uid; }

  /* ================================================================ numeric helpers */

  function scaleLinear(domain, range) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    var span = d1 - d0 || 1;
    return function (x) { return r0 + (x - d0) / span * (r1 - r0); };
  }

  /** Evenly spaced bands: pos(i) = left edge of the inner band, bandwidth, step. */
  function scaleBand(labels, range, pad) {
    var n = Math.max(1, labels.length), step = (range[1] - range[0]) / n, p = pad == null ? 0.2 : pad;
    return {
      step: step, bandwidth: step * (1 - 2 * p),
      pos: function (i) { return range[0] + i * step + step * p; },
      center: function (i) { return range[0] + (i + 0.5) * step; }
    };
  }

  /** "Nice" tick values from min up to max (inclusive when it lands on a step). */
  function niceTicks(min, max, n, integer) {
    var range = max - min;
    if (!(range > 0)) return [min];
    var raw = range / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), norm = raw / mag;
    var step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    if (integer) step = Math.max(1, Math.round(step));
    var out = [];
    for (var k = Math.ceil(min / step - 1e-9); k * step <= max + 1e-9; k++) out.push(Math.round(k * step * 1e6) / 1e6);
    return out;
  }

  /**
   * The top of an axis: the nominal maximum, or, when the data goes beyond it, the data maximum rounded
   * up to the next `quantum` so nothing is ever clipped (Robo's gibberish curve can pass 4.75).
   */
  function extendMax(nominal, dataMax, quantum) {
    var nom = nominal > 0 ? nominal : 1, q = quantum || 0.25;
    if (!(dataMax > nom)) return nom;
    return Math.ceil(dataMax / q - 1e-9) * q;
  }

  function wrapText(str, maxChars, maxLines) {
    var words = String(str == null ? "" : str).split(/\s+/).filter(Boolean), lines = [], cur = "";
    words.forEach(function (w) {
      if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; }
      else cur = cur ? cur + " " + w : w;
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] += "...";
    }
    return lines;
  }

  function numStr(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : fmt.bits(v); }

  /* ================================================================ shared SVG plumbing */

  var defsDone = false;
  /** Inject the shared hatch/dot patterns once (referenced as url(#sg-hatch) / url(#sg-dots)). */
  function ensureDefs() {
    if (defsDone || !document.body) return;
    defsDone = true;
    var defs = s("defs", null,
      s("pattern", { id: "sg-hatch", patternUnits: "userSpaceOnUse", width: 5, height: 5, patternTransform: "rotate(45)" },
        s("line", { x1: 0, y1: 0, x2: 0, y2: 5, "class": "sg-hatch-line", "stroke-width": 2 })),
      s("pattern", { id: "sg-dots", patternUnits: "userSpaceOnUse", width: 6, height: 6 },
        s("circle", { cx: 3, cy: 3, r: 1.1, "class": "sg-dot" })));
    var holder = s("svg", { "class": "sg-defs", width: 0, height: 0, "aria-hidden": "true", focusable: "false" }, defs);
    document.body.insertBefore(holder, document.body.firstChild);
  }

  function txt(x, y, str, cls, anchor) {
    return s("text", { x: round1(x), y: round1(y), "class": "sg-ct " + (cls || ""), "text-anchor": anchor || "start" }, str);
  }
  function round1(v) { return Math.round(v * 10) / 10; }

  /** Multi-line text block starting at y (baseline of the first line), 16 px line height. */
  function textLines(x, y, lines, cls, anchor) {
    var g = s("g", null);
    lines.forEach(function (ln, i) { g.appendChild(txt(x, y + i * 16, ln, cls, anchor)); });
    return g;
  }

  /** A data-point marker: circle (You), square (Robo), diamond (reference), triangle. 10 px across. */
  function marker(shape, x, y, cls, hollow) {
    var c = "sg-pt " + (cls || "") + (hollow ? " is-hollow" : "");
    if (shape === "square") return s("rect", { x: x - 5, y: y - 5, width: 10, height: 10, "class": c });
    if (shape === "diamond") return s("polygon", { points: [x + "," + (y - 7), (x + 7) + "," + y, x + "," + (y + 7), (x - 7) + "," + y].join(" "), "class": c });
    if (shape === "triangle") return s("polygon", { points: [x + "," + (y - 7), (x + 7) + "," + (y + 5), (x - 7) + "," + (y + 5)].join(" "), "class": c });
    return s("circle", { cx: x, cy: y, r: 5, "class": c });
  }

  /**
   * Common frame: create the <svg>, give it title/desc (accessible name + description), and wire update().
   * `draw(width)` returns {height, nodes[]}.
   */
  function makeChart(spec, text, table, draw) {
    ensureDefs();
    var svg = s("svg", { "class": "sg-chart", role: "img", focusable: "false" });
    var tid = nextId("sg-t"), did = nextId("sg-d");
    svg.setAttribute("aria-labelledby", tid + " " + did);
    var chart = { el: svg, text: text, table: table, width: spec.width || 320 };

    function render() {
      SG.ui.clear(svg);
      svg.appendChild(s("title", { id: tid }, spec.ariaLabel || (table && table.caption) || ""));
      svg.appendChild(s("desc", { id: did }, text.join(" ")));
      var out = draw(chart.width);
      out.nodes.forEach(function (n) { svg.appendChild(n); });
      svg.setAttribute("viewBox", "0 0 " + chart.width + " " + out.height);
      svg.setAttribute("width", chart.width);
      svg.setAttribute("height", out.height);
    }
    chart.update = function (size) {
      var w = typeof size === "number" ? size : size && size.width;
      if (w && w >= 120) chart.width = Math.round(w);
      render();
      return chart;
    };
    render();
    return chart;
  }

  /* ================================================================ barChart */

  function barTotal(b) {
    if (b.segments && b.segments.length) return b.segments.reduce(function (a, sg) { return a + Math.max(0, sg.value); }, 0);
    return Math.max(0, b.value || 0);
  }
  function barValueLabel(b) { return b.valueLabel != null ? b.valueLabel : numStr(barTotal(b)); }

  function segmentNodes(b, x, w, y, plotBottom, horizontalLen) {
    // Vertical stack from the bottom. `y` is a function value -> pixel.
    var nodes = [], acc = 0;
    var segs = b.segments && b.segments.length ? b.segments : [{ value: Math.max(0, b.value || 0) }];
    segs.forEach(function (sg) {
      var v0 = acc, v1 = acc + Math.max(0, sg.value);
      acc = v1;
      var y1 = y(v1), y0 = y(v0);
      var fill = sg.saved ? "sg-seg-saved" : (b.band != null ? "sg-fill-b" + b.band : "sg-fill-primary");
      nodes.push(s("rect", { x: x, y: y1, width: w, height: Math.max(0, y0 - y1), "class": "sg-bar " + fill }));
      if (sg.hatch) nodes.push(s("rect", { x: x, y: y1, width: w, height: Math.max(0, y0 - y1), "class": "sg-bar-hatch" }));
    });
    return nodes;
  }

  function barChart(spec) {
    var bars = spec.bars || [];
    var horizontal = spec.orientation === "h";
    var totals = bars.map(barTotal);
    var whiskerMax = bars.map(function (b) { return b.whisker ? b.whisker[1] : 0; });
    var dataMax = Math.max.apply(null, totals.concat(whiskerMax).concat([0]));
    var top = extendMax(spec.max || dataMax || 1, dataMax, spec.integerTicks ? 1 : 0.25);

    var text = bars.map(function (b) {
      return b.label + ": " + barValueLabel(b) + (b.placeholder ? " (" + b.placeholder + ")" : "") + (b.note ? ". " + b.note : "");
    });
    var table = {
      caption: spec.caption || spec.ariaLabel || "",
      headers: [t("charts.headers.item"), t("charts.headers.value")],
      rows: bars.map(function (b) { return [b.label, b.placeholder || barValueLabel(b)]; })
    };

    return makeChart(spec, text, table, function (width) {
      return horizontal ? drawBarsH(spec, bars, top, width) : drawBarsV(spec, bars, top, width);
    });
  }

  function whiskerV(x, yLo, yHi) {
    return s("g", { "class": "sg-whisker" }, s("line", { x1: x, y1: yLo, x2: x, y2: yHi }),
      s("line", { x1: x - 6, y1: yLo, x2: x + 6, y2: yLo }), s("line", { x1: x - 6, y1: yHi, x2: x + 6, y2: yHi }));
  }

  function drawBarsV(spec, bars, top, width) {
    var left = spec.yAxis === false ? 8 : 40, right = 8, headroom = 26;
    var inner = width - left - right;
    var step = inner / Math.max(1, bars.length);
    var maxChars = Math.max(4, Math.floor(step / 8));
    var wrapped = bars.map(function (b) { return wrapText(b.label, maxChars, 3); });
    var labelLines = Math.max.apply(null, wrapped.map(function (l) { return l.length; }).concat([1]));
    var H = spec.height || 230;
    var bottom = 12 + labelLines * 16;
    var plotH = Math.max(90, H - headroom - bottom);
    var base = headroom + plotH;
    var y = scaleLinear([0, top], [base, headroom]);
    var band = scaleBand(bars, [left, left + inner], 0.18);
    var nodes = [];

    if (spec.yAxis !== false) {
      niceTicks(0, top, spec.yTicks || 4, spec.integerTicks !== false).forEach(function (v) {
        nodes.push(s("line", { x1: left, y1: y(v), x2: left + inner, y2: y(v), "class": v === 0 ? "sg-axis" : "sg-grid" }));
        nodes.push(txt(left - 6, y(v) + 5, numStr(v), "", "end"));
      });
    } else {
      nodes.push(s("line", { x1: left, y1: base, x2: left + inner, y2: base, "class": "sg-axis" }));
    }

    bars.forEach(function (b, i) {
      var x = band.pos(i), w = band.bandwidth, cx = band.center(i);
      var total = barTotal(b);
      if (b.placeholder) {
        var ph = Math.min(plotH * 0.4, 70);
        nodes.push(s("rect", { x: x, y: base - ph, width: w, height: ph, rx: 4, "class": "sg-placeholder" }));
        nodes.push(textLines(cx, base - ph + 18, wrapText(b.placeholder, Math.max(4, Math.floor(w / 7)), 3), "", "middle"));
      } else {
        segmentNodes(b, x, w, y).forEach(function (n) { nodes.push(n); });
        nodes.push(txt(cx, y(total) - 7, barValueLabel(b), "sg-ct-ink", "middle"));
        if (b.whisker) nodes.push(whiskerV(cx, y(b.whisker[0]), y(b.whisker[1])));
      }
      nodes.push(textLines(cx, base + 18, wrapped[i], "", "middle"));
    });
    return { height: base + bottom - 6 + 6, nodes: nodes };
  }

  function drawBarsH(spec, bars, top, width) {
    var left = 8, right = 8, inner = width - left - right;
    var rowH = 56, nodes = [], x = scaleLinear([0, top], [left, left + inner]);
    bars.forEach(function (b, i) {
      var y0 = 8 + i * rowH;
      nodes.push(txt(left, y0 + 14, b.label, "sg-ct-ink", "start"));
      nodes.push(txt(width - right, y0 + 14, barValueLabel(b), "sg-ct-ink", "end"));
      var barY = y0 + 22, barH = 24, acc = 0;
      var segs = b.segments && b.segments.length ? b.segments : [{ value: Math.max(0, b.value || 0) }];
      segs.forEach(function (sg) {
        var x0 = x(acc), x1 = x(acc + Math.max(0, sg.value));
        acc += Math.max(0, sg.value);
        var fill = sg.saved ? "sg-seg-saved" : (b.band != null ? "sg-fill-b" + b.band : "sg-fill-primary");
        nodes.push(s("rect", { x: x0, y: barY, width: Math.max(0, x1 - x0), height: barH, rx: 3, "class": "sg-bar " + fill }));
        if (sg.hatch) nodes.push(s("rect", { x: x0, y: barY, width: Math.max(0, x1 - x0), height: barH, "class": "sg-bar-hatch" }));
      });
      if (b.whisker) {
        var cy = barY + barH / 2;
        nodes.push(s("g", { "class": "sg-whisker" }, s("line", { x1: x(b.whisker[0]), y1: cy, x2: x(b.whisker[1]), y2: cy }),
          s("line", { x1: x(b.whisker[0]), y1: cy - 7, x2: x(b.whisker[0]), y2: cy + 7 }),
          s("line", { x1: x(b.whisker[1]), y1: cy - 7, x2: x(b.whisker[1]), y2: cy + 7 })));
      }
      if (b.note) nodes.push(txt(left, barY + barH + 14, b.note, "", "start"));
    });
    nodes.unshift(s("line", { x1: left, y1: 4, x2: left, y2: 8 + bars.length * rowH - 4, "class": "sg-axis" }));
    var hasNote = bars.some(function (b) { return b.note; });
    return { height: 8 + bars.length * rowH + (hasNote ? 12 : 0), nodes: nodes };
  }

  /* ================================================================ lineChart */

  function lineChart(spec) {
    var cats = spec.xCats || [], series = spec.series || [];
    var index = {};
    cats.forEach(function (c, i) { index[c.key] = i; });
    var domain = spec.yDomain || [0, 1];
    var dataMax = 0;
    series.forEach(function (sr) {
      (sr.points || []).forEach(function (p) {
        [p.y, p.hi].forEach(function (v) { if (isFinite(v) && v > dataMax) dataMax = v; });
      });
    });
    (spec.refLines || []).forEach(function (r) { if (isFinite(r.y) && r.y > dataMax) dataMax = r.y; });
    var top = extendMax(domain[1], dataMax, 0.25), bottomV = domain[0];

    var text = [], rows = [];
    series.forEach(function (sr) {
      var pts = (sr.points || []).filter(function (p) { return isFinite(p.y) && index[p.x] != null; });
      if (!pts.length) return;
      pts.sort(function (a, b) { return index[a.x] - index[b.x]; });
      text.push(sr.label + ": " + pts.map(function (p) { return cats[index[p.x]].label + " " + fmt.bits(p.y); }).join(", "));
      pts.forEach(function (p) { rows.push([sr.label, cats[index[p.x]].label, fmt.bits(p.y)]); });
    });
    var table = { caption: spec.caption || spec.ariaLabel || "", headers: [t("charts.headers.series"), t("charts.headers.lookBack"), t("charts.headers.bits")], rows: rows };

    return makeChart(spec, text, table, function (width) { return drawLines(spec, cats, series, index, bottomV, top, width); });
  }

  function legendHeight(items, width) {
    var x = 8, rows = 1;
    items.forEach(function (it) {
      var w = 34 + it.label.length * 7.6 + 14;
      if (x + w > width - 8 && x > 8) { rows++; x = 8; }
      x += w;
    });
    return rows * 22 + 6;
  }

  function drawLegendInSvg(items, width, y0) {
    var g = s("g", { "class": "sg-legend-svg" }), x = 8, y = y0;
    items.forEach(function (it) {
      var w = 34 + it.label.length * 7.6 + 14;
      if (x + w > width - 8 && x > 8) { x = 8; y += 22; }
      g.appendChild(s("line", { x1: x, y1: y + 8, x2: x + 24, y2: y + 8, "class": "sg-line sg-line-" + it.style }));
      g.appendChild(marker(it.shape, x + 12, y + 8, "sg-pt-" + it.style, it.style === "dashed"));
      g.appendChild(txt(x + 30, y + 13, it.label, "", "start"));
      x += w;
    });
    return g;
  }

  function drawLines(spec, cats, series, index, v0, top, width) {
    var left = 40, right = 16, headroom = 24;
    var inner = width - left - right, n = Math.max(1, cats.length), step = inner / n;
    var maxChars = Math.max(4, Math.floor(step / 8));
    var wrapped = cats.map(function (c) { return wrapText(c.label, maxChars, 3); });
    var tooLong = wrapped.some(function (ls) { return ls.some(function (l) { return l.length * 7.4 > step + 4; }); });
    var labelBlock = tooLong ? 70 : Math.max.apply(null, wrapped.map(function (l) { return l.length; }).concat([1])) * 16 + 8;
    var legendItems = spec.legend === false ? [] : series.filter(function (sr) { return sr.points && sr.points.length; })
      .map(function (sr) { return { label: sr.label, style: sr.style || "main", shape: sr.shape || "circle" }; });
    var lh = legendItems.length ? legendHeight(legendItems, width) : 0;
    var plotH = Math.max(120, (spec.height || 260) - headroom - labelBlock - lh);
    var base = headroom + plotH;
    var y = scaleLinear([v0, top], [base, headroom]);
    var xAt = function (i) { return left + (i + 0.5) * step; };
    var nodes = [];

    niceTicks(v0, top, 4, false).forEach(function (v) {
      nodes.push(s("line", { x1: left, y1: y(v), x2: left + inner, y2: y(v), "class": v === v0 ? "sg-axis" : "sg-grid" }));
      nodes.push(txt(left - 6, y(v) + 5, numStr(v), "", "end"));
    });

    // Shaded regions ("hardly any extra help") sit behind everything else.
    (spec.regions || []).forEach(function (r) {
      var a = index[r.from], b = index[r.to];
      if (a == null) return;
      var x0 = xAt(a), x1 = b == null ? left + inner : xAt(b);
      if (b != null && b === n - 1) x1 = left + inner;
      nodes.push(s("rect", { x: x0, y: headroom, width: Math.max(0, x1 - x0), height: plotH, "class": "sg-region" + (r.hatch ? " is-dots" : "") }));
      if (r.label) nodes.push(textLines((x0 + x1) / 2, headroom + 18, wrapText(r.label, Math.max(6, Math.floor((x1 - x0) / 7.5)), 3), "", "middle"));
    });

    (spec.refLines || []).forEach(function (r) {
      if (!isFinite(r.y)) return;
      nodes.push(s("line", { x1: left, y1: y(r.y), x2: left + inner, y2: y(r.y), "class": "sg-refline" }));
      if (r.label) nodes.push(txt(left + inner - 4, y(r.y) - 5, r.label, "", "end"));
    });

    (spec.markers || []).forEach(function (m) {
      var i = index[m.x];
      if (i == null) return;
      nodes.push(s("line", { x1: xAt(i), y1: headroom - 6, x2: xAt(i), y2: base, "class": "sg-knee" }));
      if (m.label) nodes.push(txt(Math.min(Math.max(xAt(i), left + 40), width - 40), headroom - 9, m.label, "sg-ct-ink", "middle"));
    });

    series.forEach(function (sr) {
      var style = sr.style || "main", pts = (sr.points || []).filter(function (p) { return isFinite(p.y) && index[p.x] != null; });
      pts.sort(function (a, b) { return index[a.x] - index[b.x]; });
      if (!pts.length) return;
      if (pts.length > 1 && !pts.every(function (p) { return p.hollow; })) {
        nodes.push(s("polyline", {
          points: pts.map(function (p) { return round1(xAt(index[p.x])) + "," + round1(y(p.y)); }).join(" "),
          "class": "sg-line sg-line-" + style
        }));
      }
      pts.forEach(function (p) {
        var px = xAt(index[p.x]), py = y(p.y);
        if (isFinite(p.lo) && isFinite(p.hi)) nodes.push(whiskerV(px, y(p.lo), y(p.hi)));
        if (p.ring) nodes.push(s("circle", { cx: px, cy: py, r: 11, "class": "sg-ring" }));
        nodes.push(marker(sr.shape || "circle", px, py, "sg-pt-" + style, p.hollow));
        if (p.label) nodes.push(txt(Math.min(Math.max(px, 30), width - 30), py - 14, p.label, "sg-ct-ink", "middle"));
      });
    });

    cats.forEach(function (c, i) {
      if (tooLong) {
        var g = txt(0, 0, c.label, "", "end");
        g.setAttribute("transform", "translate(" + round1(xAt(i)) + "," + (base + 14) + ") rotate(-35)");
        nodes.push(g);
      } else nodes.push(textLines(xAt(i), base + 18, wrapped[i], "", "middle"));
    });

    if (legendItems.length) nodes.push(drawLegendInSvg(legendItems, width, base + labelBlock));
    return { height: base + labelBlock + lh, nodes: nodes };
  }

  /* ================================================================ numberLine */

  function numberLine(spec) {
    var min = spec.min == null ? 0 : spec.min, max = spec.max;
    var band = spec.band || null, marks = spec.marks || [];
    var text = [];
    if (band) text.push(band.label || fmt.aboutBits(band.mid));
    marks.forEach(function (m) { text.push(m.label + " (" + numStr(m.value) + ")"); });
    var table = {
      caption: spec.caption || spec.ariaLabel || "",
      headers: [t("charts.headers.item"), t("charts.headers.value")],
      rows: (band ? [[band.label || fmt.aboutBits(band.mid), fmt.est(band.mid)]] : []).concat(marks.map(function (m) { return [m.label, numStr(m.value)]; }))
    };

    return makeChart(spec, text, table, function (width) {
      var pad = 16, x = scaleLinear([min, max], [pad, width - pad]);
      var trackY = 52, trackH = 24, nodes = [];
      nodes.push(s("rect", { x: pad, y: trackY, width: width - 2 * pad, height: trackH, rx: 12, "class": "sg-track" }));
      if (band) {
        var x0 = x(Math.max(min, band.lo)), x1 = x(Math.min(max, band.hi));
        var bw = Math.max(12, x1 - x0), bx = Math.min(x0, width - pad - bw);
        nodes.push(s("rect", { x: bx, y: trackY, width: bw, height: trackH, rx: 12, "class": "sg-band-bar" }));
        var mx = x(Math.min(max, Math.max(min, band.mid)));
        nodes.push(s("line", { x1: mx, y1: trackY - 10, x2: mx, y2: trackY + trackH + 6, "class": "sg-midtick" }));
        var lab = band.label || fmt.aboutBits(band.mid);
        var anchor = mx < 90 ? "start" : mx > width - 90 ? "end" : "middle";
        var lx = anchor === "start" ? Math.max(pad, mx - 8) : anchor === "end" ? Math.min(width - pad, mx + 8) : mx;
        nodes.push(txt(lx, trackY - 16, lab, "sg-ct-ink", anchor));
      }
      nodes.push(txt(pad, trackY + trackH + 22, numStr(min), "", "start"));
      nodes.push(txt(width - pad, trackY + trackH + 22, fmt.bits2(max), "", "end"));

      // Marks: shapes on the track, two-line labels below, alternating rows so neighbours do not collide.
      var sorted = marks.slice().sort(function (a, b) { return a.value - b.value; });
      var lastRightEdge = [-1e9, -1e9], rowsUsed = 1;
      sorted.forEach(function (m) {
        var mx2 = x(Math.min(max, Math.max(min, m.value)));
        nodes.push(marker(m.shape === "triangle" ? "triangle" : "diamond", mx2, trackY + trackH / 2, "sg-pt-ref"));
        var maxChars = Math.max(10, Math.floor(Math.min(width * 0.45, 200) / 7.4));
        var lines = wrapText(m.label, maxChars, 3);
        var w = Math.max.apply(null, lines.map(function (l) { return l.length; })) * 7.4;
        var anchor2 = mx2 < width * 0.3 ? "start" : mx2 > width * 0.7 ? "end" : "middle";
        var left2 = anchor2 === "start" ? mx2 - 8 : anchor2 === "end" ? mx2 - w + 8 : mx2 - w / 2;
        var row = 0;
        while (row < 3 && left2 < lastRightEdge[row] + 8) row++;
        if (row > 2) row = 2;
        lastRightEdge[row] = left2 + w;
        rowsUsed = Math.max(rowsUsed, row + 1);
        var ly = trackY + trackH + 50 + row * 60;
        nodes.push(s("line", { x1: mx2, y1: trackY + trackH + 6, x2: mx2, y2: ly - 14, "class": "sg-leader" }));
        nodes.push(textLines(anchor2 === "start" ? mx2 - 8 : anchor2 === "end" ? mx2 + 8 : mx2, ly, lines, "", anchor2));
      });
      return { height: trackY + trackH + 50 + rowsUsed * 60 + (sorted.length ? 0 : -50), nodes: nodes };
    });
  }

  /* ================================================================ rangeLadder */

  function rangeLadder(spec) {
    var total = spec.total || 27, rows = spec.rows || [];
    var sizes = [total].concat(rows.map(function (r) { return Math.max(0, r.hi - r.lo); }));
    var sizeText = sizes.join(" → ");
    var text = [spec.label ? spec.label + ": " + sizeText : sizeText];
    var table = {
      caption: spec.caption || spec.ariaLabel || spec.label || "",
      headers: [t("charts.headers.question"), t("charts.headers.possible")],
      rows: sizes.map(function (z, i) { return [String(i), String(z)]; })
    };

    return makeChart(spec, text, table, function (width) {
      var pad = 8, cell = Math.max(10, (width - 2 * pad) / total), rowH = 22, gap = 6, nodes = [];
      var y0 = spec.label ? 24 : 6;
      if (spec.label) nodes.push(txt(pad, 16, spec.label, "sg-ct-ink", "start"));
      var all = [{ lo: 0, hi: total }].concat(rows);
      all.forEach(function (r, i) {
        var y = y0 + i * (rowH + gap);
        for (var c = 0; c < total; c++) {
          var live = c >= r.lo && c < r.hi;
          nodes.push(s("rect", { x: pad + c * cell, y: y, width: cell, height: rowH, "class": "sg-cell" + (live ? " is-live" : "") }));
        }
        if (spec.secret && spec.secret.index >= r.lo && spec.secret.index < r.hi && i === all.length - 1) {
          nodes.push(s("rect", { x: pad + spec.secret.index * cell - 1, y: y - 2, width: cell + 2, height: rowH + 4, "class": "sg-secret-ring" }));
        }
      });
      var yEnd = y0 + all.length * (rowH + gap);
      if (spec.sizes !== false) nodes.push(textLines(pad, yEnd + 12, wrapText(sizeText, Math.floor((width - 2 * pad) / 7.4), 2), "sg-ct-ink", "start"));
      return { height: yEnd + (spec.sizes !== false ? 36 : 4), nodes: nodes };
    });
  }

  /* ================================================================ DOM widgets */

  function simpleResult(el, text, table, extra) {
    var out = { el: el, text: text || [], table: table || null, update: function () { return out; } };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  var BAND_HEIGHTS = [6, 9, 12, 15, 18];

  function miniBars(spec) {
    var maxRows = spec.maxRows || 2;
    var items = [];
    var el = h("div", { "class": "sg-minibars", "aria-hidden": "true" });
    function capacity() { return Math.max(8, Math.floor((el.clientWidth || 300) / 8)) * maxRows; }
    function paint() {
      SG.ui.clear(el);
      var shown = items.slice(-capacity());
      shown.forEach(function (it) {
        el.appendChild(h("span", { "class": "sg-mbar sg-fill-b" + it.band + (it.revealed ? " is-revealed" : ""), style: { height: BAND_HEIGHTS[it.band] + "px" } }));
      });
    }
    function setAll(values, bands, revealed) {
      items = (values || []).map(function (v, i) {
        var b = bands && bands[i] != null ? bands[i] : (v <= 1 ? 0 : Math.min(4, Math.ceil(Math.log(v) / Math.LN2)));
        return { band: Math.max(0, Math.min(4, b)), revealed: !!(revealed && revealed[i]) };
      });
      paint();
    }
    setAll(spec.values, spec.bands, spec.revealed);
    var out = simpleResult(el, [], null, {
      push: function (value, band, revealed) {
        var b = band != null ? band : (value <= 1 ? 0 : Math.min(4, Math.ceil(Math.log(value) / Math.LN2)));
        items.push({ band: Math.max(0, Math.min(4, b)), revealed: !!revealed });
        paint();
      },
      set: setAll
    });
    out.update = function () { paint(); return out; };
    return out;
  }

  function legend(spec) {
    var el = h("ul", { "class": "sg-legend" });
    var text = [];
    (spec.items || []).forEach(function (it) {
      var sw;
      if (it.band != null) sw = h("span", { "class": "sg-swatch sg-band-" + it.band });
      else if (it.hatch) sw = h("span", { "class": "sg-swatch sg-swatch--hatch" });
      else if (it.saved) sw = h("span", { "class": "sg-swatch sg-swatch--saved" });
      else if (it.shape === "eye") sw = h("span", { "class": "sg-swatch sg-swatch--eye" }, SG.ui.icon("eye", { size: 14 }));
      else if (it.shape) sw = h("span", { "class": "sg-swatch sg-swatch--shape sg-swatch--" + it.shape });
      else sw = h("span", { "class": "sg-swatch " + (it.swatchClass || "") });
      el.appendChild(h("li", null, sw, h("span", null, it.label)));
      text.push(it.label);
    });
    return simpleResult(el, text, null);
  }

  var CMP_GLYPH = { you: "▲", same: "=", robo: "▼" };

  function compareStrip(spec) {
    var cells = spec.cells || [];
    var el = h("div", { "class": "sg-cmp", role: "list" });
    var counts = { you: 0, same: 0, robo: 0, revealed: 0 };
    cells.forEach(function (c) {
      counts[c.result] = (counts[c.result] || 0) + 1;
      var label = t("charts.compare." + c.result);
      var inner = c.result === "revealed" ? SG.ui.icon("eye", { size: 14 }) : CMP_GLYPH[c.result];
      el.appendChild(h("span", { "class": "sg-cmp-cell sg-cmp-" + c.result, role: "listitem", "aria-label": label, title: label }, inner));
    });
    var text = [t("charts.compare.you") + ": " + counts.you, t("charts.compare.same") + ": " + counts.same, t("charts.compare.robo") + ": " + counts.robo];
    return simpleResult(el, text, { caption: spec.caption || "", headers: [t("charts.headers.item"), t("charts.headers.value")],
      rows: [[t("charts.compare.you"), String(counts.you)], [t("charts.compare.same"), String(counts.same)], [t("charts.compare.robo"), String(counts.robo)]] });
  }

  /* ---- roving-tabindex grid navigation shared by the tile strip ---- */
  function verticalNeighbour(list, btn, dir) {
    var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, best = null, bestScore = 1e9;
    list.forEach(function (b) {
      var q = b.getBoundingClientRect();
      var dy = (q.top + q.height / 2) - (r.top + r.height / 2);
      if (dir * dy < r.height / 3) return;
      var score = Math.abs(dy) * 4 + Math.abs(q.left + q.width / 2 - cx);
      if (score < bestScore) { bestScore = score; best = b; }
    });
    return best;
  }

  function fadeLevel(rank, revealed) { return revealed ? 2 : rank <= 1 ? 0 : rank <= 3 ? 1 : 2; }

  function tileAria(ch, rank, revealed) {
    var letter = fmt.letterName(ch);
    var base = rank === 1 ? t("charts.tile.one", { letter: letter }) : t("charts.tile.many", { letter: letter, g: rank });
    return revealed ? base + t("charts.tile.peekedSuffix") : base;
  }

  function sentenceTiles(spec) {
    var chars = typeof spec.chars === "string" ? spec.chars.split("") : (spec.chars || []);
    var ranks = spec.ranks || [], bands = spec.bands || [], revealed = spec.revealed || [], robo = spec.roboRanks || [];
    var mode = spec.mode === "fade" ? "fade" : "surprise";
    var root = h("div", { "class": "sg-tiles sg-tiles--" + mode, role: "group", "aria-label": spec.ariaLabel || "" });
    var buttons = [], selected = -1;

    function info(i) {
      return { index: i, char: chars[i], rank: ranks[i], band: bands[i], revealed: !!revealed[i], roboRank: robo[i] };
    }

    function select(i) {
      if (i < 0 || i >= buttons.length) return;
      buttons.forEach(function (b, j) { b.classList.toggle("is-selected", j === i); b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
      selected = i;
      if (spec.onSelect) spec.onSelect(i, info(i));
    }

    function tileFor(i) {
      var ch = chars[i], rank = ranks[i] == null ? 1 : ranks[i], isRev = !!revealed[i];
      var cls = "sg-tile" + (ch === " " ? " sg-tile--space" : "") + (isRev ? " is-revealed" : "");
      cls += mode === "surprise" ? " sg-band-" + (bands[i] != null ? bands[i] : 0) : " sg-fade-" + fadeLevel(rank, isRev);
      var kids = [h("span", { "class": "sg-tile-ch", "aria-hidden": "true" }, ch === " " ? SG.alphabet.label(" ") : ch)];
      if (mode === "surprise") kids.push(h("span", { "class": "sg-tile-num", "aria-hidden": "true" }, String(rank)));
      if (isRev) kids.push(h("span", { "class": "sg-tile-eye", "aria-hidden": "true" }, SG.ui.icon("eye", { size: 12 })));
      var b = h("button", { type: "button", "class": cls, "data-i": i, tabindex: "-1", "aria-pressed": "false", "aria-label": tileAria(ch, rank, isRev) }, kids);
      b.addEventListener("click", function () { select(i); });
      b.addEventListener("keydown", function (e) {
        var to = null, idx = buttons.indexOf(b);
        if (e.key === "ArrowRight") to = buttons[idx + 1];
        else if (e.key === "ArrowLeft") to = buttons[idx - 1];
        else if (e.key === "ArrowDown") to = verticalNeighbour(buttons, b, 1);
        else if (e.key === "ArrowUp") to = verticalNeighbour(buttons, b, -1);
        else return;
        e.preventDefault();
        if (to) { b.setAttribute("tabindex", "-1"); to.setAttribute("tabindex", "0"); to.focus(); }
      });
      buttons.push(b);
      return b;
    }

    // Words are wrap units: a word never splits across lines, only the gaps between words wrap.
    var word = null;
    chars.forEach(function (ch, i) {
      var tile = tileFor(i);
      if (ch === " ") { word = null; root.appendChild(tile); return; }
      if (!word) { word = h("span", { "class": "sg-word" }); root.appendChild(word); }
      word.appendChild(tile);
    });
    if (buttons.length) buttons[0].setAttribute("tabindex", "0");

    var rows = chars.map(function (ch, i) {
      return [String(i + 1), fmt.letterName(ch), String(ranks[i] == null ? "" : ranks[i]), revealed[i] ? t("charts.yes") : ""];
    });
    var out = simpleResult(root, [], {
      caption: spec.caption || spec.ariaLabel || "",
      headers: [t("charts.headers.position"), t("charts.headers.letter"), t("charts.headers.guesses"), t("charts.headers.peeked")],
      rows: rows
    }, {
      select: select,
      selectedIndex: function () { return selected; },
      setHideFaint: function (on) { root.classList.toggle("is-hide-faint", !!on); }
    });
    return out;
  }

  function alignedRows(spec) {
    var chars = typeof spec.chars === "string" ? spec.chars.split("") : (spec.chars || []);
    var rows = spec.rows || [];
    var perBlock = spec.perBlock || (SG.ui.theme && SG.ui.theme.sizeClass() === "desktop" ? 16 : SG.ui.theme && SG.ui.theme.sizeClass() === "tablet" ? 12 : 8);
    var root = h("div", { "class": "sg-aligned", role: "group", "aria-label": spec.ariaLabel || "" });
    var cells = []; // cells[col] = array of cell elements in that column (letter + each row)

    for (var start = 0; start < chars.length; start += perBlock) {
      var end = Math.min(chars.length, start + perBlock);
      var block = h("div", { "class": "sg-ablock", style: { "--cols": end - start } });
      block.appendChild(h("span", { "class": "sg-alabel" }));
      for (var c = start; c < end; c++) {
        var letterCell = h("span", { "class": "sg-acell sg-acell--letter" + (chars[c] === " " ? " is-space" : ""), "data-col": c }, chars[c] === " " ? SG.alphabet.label(" ") : chars[c]);
        (cells[c] = cells[c] || []).push(letterCell);
        block.appendChild(letterCell);
      }
      rows.forEach(function (row) {
        block.appendChild(h("span", { "class": "sg-alabel" }, row.label));
        for (var col = start; col < end; col++) {
          var v = row.values ? row.values[col] : null, isRev = !!(row.revealed && row.revealed[col]);
          var band = row.bands && row.bands[col] != null ? row.bands[col] : 0;
          var cell = h("span", {
            "class": "sg-acell sg-band-" + band + (isRev ? " is-revealed" : ""), "data-col": col,
            "aria-label": row.label + ": " + (v == null ? "" : v) + (isRev ? t("charts.tile.peekedSuffix") : "")
          }, v == null ? "" : String(v));
          if (isRev) cell.appendChild(h("span", { "class": "sg-acell-eye", "aria-hidden": "true" }, SG.ui.icon("eye", { size: 11 })));
          (cells[col] = cells[col] || []).push(cell);
          block.appendChild(cell);
        }
      });
      root.appendChild(block);
    }

    var active = -1;
    function setActive(i) {
      if (active >= 0 && cells[active]) cells[active].forEach(function (c) { c.classList.remove("is-active"); });
      active = i;
      if (i >= 0 && cells[i]) cells[i].forEach(function (c) { c.classList.add("is-active"); });
    }
    function showUpTo(n) {
      cells.forEach(function (col, i) { col.forEach(function (c) { c.classList.toggle("is-pending", i >= n); }); });
    }
    if (spec.activeIndex != null) setActive(spec.activeIndex);

    var table = {
      caption: spec.caption || spec.ariaLabel || "",
      headers: [t("charts.headers.position"), t("charts.headers.letter")].concat(rows.map(function (r) { return r.label; })),
      rows: chars.map(function (ch, i) {
        return [String(i + 1), fmt.letterName(ch)].concat(rows.map(function (r) { return r.values && r.values[i] != null ? String(r.values[i]) : ""; }));
      })
    };
    return simpleResult(root, [], table, {
      setActive: setActive, showUpTo: showUpTo, showAll: function () { showUpTo(chars.length + 1); setActive(-1); }
    });
  }

  /* ================================================================ helpers for screens */

  /** Keep an SVG chart as wide as its container (ResizeObserver, fallback: window resize). */
  function mount(container, chart) {
    container.appendChild(chart.el);
    function fit() {
      var w = container.clientWidth;
      if (w && Math.abs(w - chart.width) > 1 && chart.update) chart.update({ width: w });
    }
    fit();
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(fit);
      ro.observe(container);
      SG.ui.track(function () { ro.disconnect(); });
    } else {
      SG.ui.on(window, "resize", fit);
    }
    return chart;
  }

  /** A real <table> with a caption, for "Show as words". */
  function tableEl(table) {
    if (!table) return null;
    return h("table", { "class": "sg-table" },
      table.caption ? h("caption", null, table.caption) : null,
      h("thead", null, h("tr", null, table.headers.map(function (x) { return h("th", { scope: "col" }, x); }))),
      h("tbody", null, table.rows.map(function (r) { return h("tr", null, r.map(function (c) { return h("td", null, c); })); })));
  }

  /**
   * "Show as words" toggle + panel (UX-057, DB-009). opts.picture: element to hide while the words show.
   * Returns a <div class="sg-words"> to place under the chart.
   */
  function disclosure(chart, opts) {
    opts = opts || {};
    var panel = h("div", { "class": "sg-words-panel", hidden: true },
      (chart.text || []).map(function (line) { return h("p", null, line); }), tableEl(chart.table));
    var btn = h("button", { type: "button", "class": "sg-btn sg-btn--link", "aria-expanded": "false" }, t("board.nav.showAsWords"));
    btn.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = t(open ? "board.nav.showPicture" : "board.nav.showAsWords");
      if (opts.picture) opts.picture.hidden = open;
    });
    return h("div", { "class": "sg-words" }, btn, panel);
  }

  /* ================================================================ describe */

  function sumOf(a) { return fmt.sum(a || []); }

  function histText(hist) {
    var parts = [], tenPlus = 0;
    for (var g = 1; g <= 27; g++) {
      var n = hist[g] || 0;
      if (g < 10) { if (n) parts.push(g + ": " + t("board.cards.entropy.histogram.count", { n: n })); }
      else tenPlus += n;
    }
    if (tenPlus) parts.push(t("board.cards.entropy.histogram.tenPlus") + ": " + t("board.cards.entropy.histogram.count", { n: tenPlus }));
    return parts.join("; ");
  }

  function surpriseMost(S) {
    var best = -1;
    S.ranks.forEach(function (g, i) { if (best < 0 || g > S.ranks[best]) best = i; });
    if (best < 0) return "";
    return t(S.revealed[best] ? "board.cards.surprise.mostItemPeeked" : "board.cards.surprise.mostItem",
      { letter: fmt.letterName(S.sentence.charAt(best)), word: fmt.wordAt(S.sentence, best), g: S.ranks[best] });
  }

  /**
   * Text alternatives for the nine Board cards, in one place (design 03 §6). Never throws; a card with
   * too little data returns an empty alternative rather than NaN. `ctx` may carry {detective:{questions,best},
   * peepholePoints}. Uses the board.cards.<id>.alt sentences from the copy deck.
   */
  function describe(cardId, S, R, ctx) {
    var out = { text: [], table: null };
    if (!S || !S.n) return out;
    var c = "board.cards." + cardId + ".";
    var firstTry = S.ranks.filter(function (g) { return g === 1; }).length;
    var table = null;
    switch (cardId) {
      case "surprise":
        out.text.push(t(c + "alt", { most: surpriseMost(S), firstTry: firstTry, n: S.n }));
        table = { caption: t(c + "title"), headers: [t("charts.headers.position"), t("charts.headers.letter"), t("charts.headers.guesses"), t("charts.headers.peeked")],
          rows: S.ranks.map(function (g, i) { return [String(i + 1), fmt.letterName(S.sentence.charAt(i)), String(g), S.revealed[i] ? t("charts.yes") : ""]; }) };
        break;
      case "bit":
        if (ctx && ctx.detective) out.text.push(t(c + "alt", { size: SG.alphabet.SIZE, n: ctx.detective.questions, best: ctx.detective.best }));
        else out.text.push(t(c + "definition"));
        break;
      case "entropy":
        out.text.push(t(c + "alt", { mid: fmt.est(S.bounds.mid), low: fmt.est(S.bounds.low), high: fmt.est(S.bounds.up), max: fmt.bits2(SG.alphabet.HMAX), hist: histText(S.bounds.hist) }));
        table = { caption: t(c + "histogram.title"), headers: [t("charts.headers.guesses"), t("charts.headers.letters")], rows: [] };
        for (var g = 1; g <= 27; g++) if (S.bounds.hist[g]) table.rows.push([String(g), String(S.bounds.hist[g])]);
        break;
      case "context":
        var wp = S.wordPos, later = [wp.second, wp.third, wp.fourthPlus].filter(function (x) { return x.avg != null; });
        var laterAvg = later.length ? fmt.sum(later.map(function (x) { return x.avg; })) / later.length : null;
        var curve = (S.lookBack.corpus.length ? S.lookBack.corpus : S.lookBack.sentence) || [];
        if (wp.first.avg != null && laterAvg != null && curve.length) {
          out.text.push(t(c + "alt", { first: fmt.avg1(wp.first.avg), later: fmt.avg1(laterAvg), k0: fmt.bits(curve[0].bits), kLast: fmt.bits(curve[curve.length - 1].bits) }));
        } else out.text.push(t(c + "thin"));
        table = { caption: t(c + "curve.title"), headers: [t("charts.headers.lookBack"), t("charts.headers.bits")], rows: curve.map(function (p) { return [String(p.k), fmt.bits(p.bits)]; }) };
        break;
      case "redundancy":
        out.text.push(t(c + "alt", { pct: fmt.pct5(S.redundancy), a: firstTry, n: S.n }));
        break;
      case "twin":
        var order = S.robo && S.robo.order != null ? S.robo.order : SG.robo.maxOrder, rebuilt = "";
        try { rebuilt = SG.twin.decode(SG.robo, S.twin.numbers, order); } catch (e) { rebuilt = ""; }
        out.text.push(t(c + "alt", { numbers: S.twin.numbers.join(", "), text: rebuilt, result: rebuilt === S.sentence && S.twin.ok ? t(c + "matches") : t(c + "mismatch") }));
        break;
      case "enough":
        out.text.push(S.lookBack.kStar != null ? t(c + "alt", { n: S.lookBack.kStar }) : t(c + "headlineNoKnee"));
        break;
      case "squeeze":
        var orig = Math.round(S.n * SG.alphabet.HMAX), sq = Math.round(S.n * S.bounds.mid);
        out.text.push(t(c + "alt", { orig: orig, sq: sq, pct: fmt.pct5(S.bounds.mid / SG.alphabet.HMAX) }));
        break;
      case "robo":
        out.text.push(t(c + "alt", { you: sumOf(S.ranks), robo: sumOf(S.robo.ranks), youFewer: S.vs.youFewer, roboFewer: S.vs.roboFewer, same: S.vs.same }));
        break;
      default: break;
    }
    out.table = table;
    return out;
  }

  return {
    barChart: barChart, lineChart: lineChart, numberLine: numberLine, rangeLadder: rangeLadder,
    sentenceTiles: sentenceTiles, alignedRows: alignedRows, miniBars: miniBars, legend: legend,
    compareStrip: compareStrip, describe: describe,
    mount: mount, disclosure: disclosure, tableEl: tableEl, ensureDefs: ensureDefs,
    scaleLinear: scaleLinear, scaleBand: scaleBand, niceTicks: niceTicks, extendMax: extendMax
  };
})();
