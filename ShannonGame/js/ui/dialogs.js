/* SG.ui.dialogs — accessible modal dialogs with a focus trap (design 03 §5.6; UX-054, UX-070).
 *
 *   SG.ui.dialogs.choose({
 *     title: "Leave this round?",           // text; shown in an <h2> (aria-labelledby)
 *     text: "You can come back to it.",     // optional paragraph (aria-describedby)
 *     body: Node,                            // optional extra content under the text
 *     mood: "neutral",                       // optional: show Robo in this mood above the title
 *     buttons: [{id, label, primary, danger}],   // in display order
 *     safeId: "keep"                         // the harmless answer: gets focus, and Esc chooses it
 *   }) -> Promise<id>
 *   SG.ui.dialogs.isOpen()      true while any dialog is showing (the keyboard module ignores keys then)
 *   SG.ui.dialogs.dismissAll()  close everything now; pending promises resolve with null (used by the router)
 *
 * Behaviour: the backdrop does not dismiss (a stray tap must not answer a question), Tab is trapped,
 * focus goes to the safe button and returns to whatever opened the dialog, the page behind is made inert,
 * and only one dialog shows at a time (extra ones wait in a queue). Text is inserted with textContent.
 * Only the final "Erase everything" button ever uses the danger style (design 03 §1.2).
 */
window.SG = window.SG || {};
SG.ui = SG.ui || {};

SG.ui.dialogs = (function () {
  var queue = [];
  var active = null;
  var idCounter = 0;

  function rootEl() {
    var r = document.getElementById("dialog-root");
    if (!r) { r = SG.ui.h("div", { id: "dialog-root" }); document.body.appendChild(r); }
    return r;
  }

  function setBackgroundInert(on) {
    var app = document.getElementById("app");
    if (!app) return;
    if (on) { app.setAttribute("inert", ""); app.setAttribute("aria-hidden", "true"); }
    else { app.removeAttribute("inert"); app.removeAttribute("aria-hidden"); }
  }

  function buttonClass(b) {
    return "sg-btn " + (b.danger ? "sg-btn--danger" : b.primary ? "sg-btn--primary" : "sg-btn--secondary");
  }

  function show(job) {
    var spec = job.spec, uid = "sg-dlg-" + (++idCounter);
    var buttons = spec.buttons && spec.buttons.length ? spec.buttons
      : [{ id: "ok", label: SG.ui.t("ui.ok"), primary: true }];
    var safe = buttons.filter(function (b) { return b.id === spec.safeId; })[0]
      || buttons.filter(function (b) { return b.primary; })[0] || buttons[0];

    var titleEl = SG.ui.h("h2", { id: uid + "-t", "class": "sg-dialog-title" }, spec.title || "");
    var textEl = spec.text ? SG.ui.h("p", { id: uid + "-d", "class": "sg-dialog-text" }, spec.text) : null;
    var robo = spec.mood ? SG.ui.robo.create(spec.mood, 72, { bubble: false }) : null;
    var actions = SG.ui.h("div", { "class": "sg-dialog-actions" });
    var btnEls = {};

    var dialog = SG.ui.h("div", {
      "class": "sg-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": uid + "-t",
      "aria-describedby": textEl ? uid + "-d" : null
    }, robo, titleEl, textEl, spec.body || null, actions);
    var backdrop = SG.ui.h("div", { "class": "sg-dialog-backdrop" }, dialog);

    function finish(id) {
      if (active !== job) return;
      document.removeEventListener("keydown", onEsc, true);
      job.release();
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      active = null;
      setBackgroundInert(false);
      SG.ui.a11y.restore();
      job.resolve(id);
      next();
    }

    function onEsc(e) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish(safe.id);          // Esc is always the harmless answer
    }

    buttons.forEach(function (b) {
      var btn = SG.ui.h("button", { type: "button", "class": buttonClass(b), "data-id": b.id }, b.label);
      btn.addEventListener("click", function () { finish(b.id); });
      btnEls[b.id] = btn;
      actions.appendChild(btn);
    });

    job.close = function (id) { finish(id); };
    active = job;
    SG.ui.a11y.remember();
    rootEl().appendChild(backdrop);
    setBackgroundInert(true);
    job.release = SG.ui.a11y.trap(dialog);
    document.addEventListener("keydown", onEsc, true);
    btnEls[safe.id].focus();
  }

  function next() {
    if (active || !queue.length) return;
    show(queue.shift());
  }

  function choose(spec) {
    return new Promise(function (resolve) {
      queue.push({ spec: spec || {}, resolve: resolve, release: function () {} });
      next();
    });
  }

  function dismissAll() {
    var pending = queue.splice(0);
    pending.forEach(function (j) { j.resolve(null); });
    if (active) active.close(null);
  }

  return {
    choose: choose,
    isOpen: function () { return !!active; },
    dismissAll: dismissAll
  };
})();
