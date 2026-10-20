/* SG.ui (dom.js) — the tiny DOM toolkit every screen uses.
 *
 *   SG.ui.h(tag, attrs, ...children)   build an HTML element (SG.ui.s does the same for SVG)
 *   SG.ui.$(sel, root) / $$(sel, root) querySelector helpers ($$ returns a real Array)
 *   SG.ui.clear(node)                  remove all children
 *   SG.ui.on(target, type, fn, opts)   add a listener that the router removes on screen change
 *   SG.ui.later(fn, ms) / every(fn, ms) timers that the router cancels on screen change
 *   SG.ui.track(cleanupFn)             register any other cleanup for the router
 *   SG.ui.cleanup()                    run and forget everything registered above (router only)
 *
 *   SG.ui.t(key, vars)      one copy string by dotted key, {placeholders} filled from vars
 *   SG.ui.pick(key, vars)   a pool (array) leaf: one variant, never the same twice in a row per key
 *   SG.ui.has(key)          does the key exist?
 *   SG.ui.setRand(fn)       inject the random source used by pick (tests)
 *
 * Safety rule: children given as strings are ALWAYS text nodes. There is deliberately no way to pass
 * HTML through h(), so child-typed text (nicknames, secret sentences) can never become markup (NF-038).
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";

  /* ---------------------------------------------------------------- element builders */

  // Properties that must be set as JS properties, not attributes, to behave (live form state).
  var PROP_ATTRS = { value: 1, checked: 1, selected: 1, indeterminate: 1 };

  function applyStyle(el, style) {
    if (typeof style === "string") { el.setAttribute("style", style); return; }
    Object.keys(style).forEach(function (k) {
      if (style[k] == null) return;
      // CSS custom properties and dashed names need setProperty; camelCase names can use the property.
      if (k.indexOf("-") >= 0) el.style.setProperty(k, String(style[k]));
      else el.style[k] = style[k];
    });
  }

  function applyAttr(el, name, val, isSvg) {
    if (val == null || val === false) return;
    if (name === "class" || name === "className") { el.setAttribute("class", String(val)); return; }
    if (name === "style") { applyStyle(el, val); return; }
    if (name === "dataset") { Object.keys(val).forEach(function (k) { el.dataset[k] = val[k]; }); return; }
    if (name === "ref") { val(el); return; }
    if (name === "on") {
      Object.keys(val).forEach(function (type) { el.addEventListener(type, val[type]); });
      return;
    }
    if (typeof val === "function") {
      // onclick: fn style shorthand -> addEventListener("click", fn)
      if (name.indexOf("on") === 0) el.addEventListener(name.slice(2).toLowerCase(), val);
      return;
    }
    if (!isSvg && PROP_ATTRS[name]) { el[name] = val; return; }
    el.setAttribute(name, val === true ? "" : String(val));
  }

  function appendChildren(el, children) {
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c == null || c === false || c === true) continue;
      if (Array.isArray(c)) appendChildren(el, c);
      else if (c.nodeType) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
  }

  function build(isSvg, tag, attrs, rest) {
    var el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    var children = rest;
    // Allow h("p", "text") and h("p", [children]) without an attrs object.
    if (attrs != null && (typeof attrs !== "object" || attrs.nodeType || Array.isArray(attrs))) {
      children = [attrs].concat(rest);
      attrs = null;
    }
    if (attrs) Object.keys(attrs).forEach(function (k) { applyAttr(el, k, attrs[k], isSvg); });
    appendChildren(el, children);
    return el;
  }

  /** Build an HTML element. attrs: class, style (string|object), dataset, on:{type:fn}, onclick:fn, ref:fn, aria-*, ... */
  SG.ui.h = function (tag, attrs) {
    return build(false, tag, attrs, Array.prototype.slice.call(arguments, 2));
  };

  /** Build an SVG element (namespace-correct). Same signature as h. */
  SG.ui.s = function (tag, attrs) {
    return build(true, tag, attrs, Array.prototype.slice.call(arguments, 2));
  };

  SG.ui.$ = function (sel, root) { return (root || document).querySelector(sel); };
  SG.ui.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  SG.ui.clear = function (node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  /* ---------------------------------------------------------------- small shared builders */

  /** The screen heading: focusable so the router can move focus to it (design 03 §5.4). */
  SG.ui.h1 = function (text, cls) {
    return build(false, "h1", { tabindex: "-1", "data-sg-focus": "", "class": cls || null }, [text]);
  };

  /**
   * A button. opts: kind "primary"|"secondary"|"danger"|"link"|"pill" (default secondary), big (56 px),
   * icon (name for SG.ui.icon, placed before the label), onClick, cls, attrs (extra attributes).
   */
  SG.ui.button = function (label, opts) {
    opts = opts || {};
    var cls = "sg-btn sg-btn--" + (opts.kind || "secondary") + (opts.big ? " sg-btn--big" : "") + (opts.cls ? " " + opts.cls : "");
    var attrs = { type: "button", "class": cls };
    if (opts.attrs) Object.keys(opts.attrs).forEach(function (k) { attrs[k] = opts.attrs[k]; });
    var btn = build(false, "button", attrs, [opts.icon && SG.ui.icon ? SG.ui.icon(opts.icon, { size: 20 }) : null, label]);
    if (opts.onClick) btn.addEventListener("click", opts.onClick);
    return btn;
  };

  /* ---------------------------------------------------------------- auto-cleanup registry */

  var cleanups = [];

  /** Register any cleanup function; the router calls them all when the screen changes. Returns it. */
  SG.ui.track = function (fn) { cleanups.push(fn); return fn; };

  /** addEventListener whose removal is automatic. Returns an `off` function for early removal. */
  SG.ui.on = function (target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    var off = function () { target.removeEventListener(type, fn, opts); };
    cleanups.push(off);
    return off;
  };

  /** setTimeout that the router cancels. Returns a cancel function. */
  SG.ui.later = function (fn, ms) {
    var id = setTimeout(fn, ms);
    var cancel = function () { clearTimeout(id); };
    cleanups.push(cancel);
    return cancel;
  };

  /** setInterval that the router cancels. Returns a cancel function. */
  SG.ui.every = function (fn, ms) {
    var id = setInterval(fn, ms);
    var cancel = function () { clearInterval(id); };
    cleanups.push(cancel);
    return cancel;
  };

  /** Run and forget every registered cleanup (called by SG.app.go before rendering the next screen). */
  SG.ui.cleanup = function () {
    var list = cleanups;
    cleanups = [];
    list.forEach(function (fn) { try { fn(); } catch (e) { /* a failing cleanup must not block navigation */ } });
  };

  /* ---------------------------------------------------------------- copy helper */

  var rand = Math.random;          // the UI may use Math.random; the core never does
  var lastPick = {};               // key -> index of the variant returned last time
  var warned = {};                 // keys already reported, so a missing key logs once
  SG.ui.debugCopy = false;         // true -> a missing key renders as [[key]] instead of ""

  function warnOnce(msg) {
    if (warned[msg]) return;
    warned[msg] = true;
    if (typeof console !== "undefined" && console.warn) console.warn("[SG.copy] " + msg);
  }

  function lookup(key) {
    var node = SG.copy;
    var parts = String(key).split(".");
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== "object") return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  var PLACEHOLDER = /\{([A-Za-z0-9]+)\}/g;

  /** Placeholders a template needs that vars does not supply. */
  function missingVars(template, vars) {
    var missing = [], m;
    PLACEHOLDER.lastIndex = 0;
    while ((m = PLACEHOLDER.exec(template)) !== null) {
      if (!vars || vars[m[1]] == null) missing.push(m[1]);
    }
    return missing;
  }

  function fill(template, vars, key) {
    return template.replace(PLACEHOLDER, function (all, name) {
      if (vars && vars[name] != null) return String(vars[name]);
      warnOnce("placeholder {" + name + "} not supplied for " + key);
      return "";
    });
  }

  function missingKey(key) {
    warnOnce("missing key " + key);
    return SG.ui.debugCopy ? "[[" + key + "]]" : "";
  }

  /**
   * One copy string. A leaf string is returned with {placeholders} filled from `vars`.
   * If the leaf is a pool (array) this behaves like pick(), so a caller never gets an array back.
   */
  SG.ui.t = function (key, vars) {
    var leaf = lookup(key);
    if (typeof leaf === "string") return fill(leaf, vars, key);
    if (Array.isArray(leaf)) return SG.ui.pick(key, vars);
    return missingKey(key);
  };

  /**
   * One variant from a pool leaf, random but never the one returned immediately before for this key
   * (GP-035, CT-044). Variants whose placeholders `vars` cannot fill are skipped (CT 5.1 rule 3);
   * if none is fillable the first variant is used with blanks. A plain string leaf also works.
   */
  SG.ui.pick = function (key, vars) {
    var leaf = lookup(key);
    if (typeof leaf === "string") return fill(leaf, vars, key);
    if (!Array.isArray(leaf) || !leaf.length) return missingKey(key);
    var usable = [];
    leaf.forEach(function (v, i) { if (!missingVars(v, vars).length) usable.push(i); });
    if (!usable.length) usable = [0];
    var choices = usable.length > 1 ? usable.filter(function (i) { return i !== lastPick[key]; }) : usable;
    var idx = choices[Math.floor(rand() * choices.length)];
    lastPick[key] = idx;
    return fill(leaf[idx], vars, key);
  };

  /** True when the dotted key exists in SG.copy. */
  SG.ui.has = function (key) { return lookup(key) !== undefined; };

  /** Raw leaf (for lists such as the teachers' questions, which are shown in full, not picked). */
  SG.ui.raw = function (key) { return lookup(key); };

  /** Swap the random source used by pick (unit tests, seeded demos). */
  SG.ui.setRand = function (fn) { rand = typeof fn === "function" ? fn : Math.random; };

  SG.t = SG.ui.t; // the short name used in docs/design/04-content-and-copy.md §5.1
})();
