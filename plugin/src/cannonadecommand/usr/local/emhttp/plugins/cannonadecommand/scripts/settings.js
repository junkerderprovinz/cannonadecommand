/* The CannonadeCommand settings page. Client-side only: it renders a card-based form into
 * #cc-settings and persists to localStorage under the cc.* keys, which the Docker-tab enhancer reads
 * and reacts to live through the storage event. */
(function () {
  "use strict";
  var root = document.getElementById("cc-settings");
  if (!root) return;
  // Page-local style additions, since docker.css is owned elsewhere. They live in <head> and so
  // survive render().
  (function () {
    if (document.getElementById("cc-set-xtra")) return;
    var st = document.createElement("style"); st.id = "cc-set-xtra";
    st.textContent =
      "#cc-settings .cc-set-xbtn{display:inline-flex;align-items:center;justify-content:center;height:var(--cc-md-h,30px);padding:var(--cc-md-btnpad,0 14px);font-size:var(--cc-md-fs,13px);font-weight:600;border-radius:var(--cc-b-radius,999px);box-sizing:border-box;margin:12px 10px 0 0}" +
      "#cc-settings .cc-set-xnote{margin-top:10px;font-size:12px;white-space:pre-wrap}" +
      // the flag picker's stripe swatches and its searchable dropdown
      "#cc-settings .cc-flag-sw{display:inline-block;width:22px;height:15px;border-radius:3px;flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}" +
      "#cc-settings .cc-flag-sw-lg{width:34px;height:22px}" +
      // the real flag image, at the same footprint as the stripe swatch
      "#cc-settings .cc-flag-img{display:inline-block;width:22px;height:15px;flex:0 0 auto;object-fit:cover;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}" +
      "#cc-settings .cc-flag-img-lg{width:34px;height:22px}" +
      // the palette rows fill the card width, with the reset as one more equal cell at the end
      "#cc-settings .cc-set-swatches.cc-fill{display:flex;gap:6px;align-items:center}" +
      // Every colour row is nine equal cells, so a swatch is the same size in every card. A swatch
      // and the reset take one cell each, the hex field two, since the code needs the room, and the
      // builder shows seven presets in a hex row to keep the total at nine.
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-sw{flex:1 1 0;height:30px;min-width:0;box-sizing:border-box;border-radius:var(--cc-b-radius,5px)}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-ibtn{flex:1 1 0;height:30px;min-width:0;box-sizing:border-box;margin:0;display:inline-flex;align-items:center;justify-content:center;background:#2e2e2e;border-radius:var(--cc-b-radius,5px);cursor:pointer;color:#cfcfcf;font-size:14px;transition:filter .12s,background .12s,color .12s}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-ibtn:hover{background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff)}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-hexin{flex:2 2 0;height:30px;min-width:0;box-sizing:border-box;padding:0 8px;align-self:center;font-size:11px;letter-spacing:0;margin:0}" +
      // the settings search and the reset-everything button
      "#cc-settings .cc-set-searchrow{margin:12px 0 2px}" +
      "#cc-settings .cc-set-search{box-sizing:border-box;width:100%;max-width:420px;background:#232323;color:#eaeaea;border:none;outline:none;border-radius:8px;padding:9px 13px;font-size:13px;transition:background-color .12s}" +
      // Unraid's default-base.css paints every placeholder in the theme's link colour, so a hint
      // reads as a link or as an already filled value. One rule per sheet covers every field; the
      // Docker half of the same guard lives in docker.css.
      "#cc-settings input::placeholder{color:#8d8d8d;opacity:1}" +
      "#cc-settings .cc-set-search:focus{background:#2e2e2e}" +
      // The search is a badge that expands into an input on click. Collapsed it follows the colour
      // mode; expanded it becomes a dark input box.
      "#cc-settings .cc-set-searchbadge{margin-left:auto;display:inline-flex;align-items:center;background:var(--cc-btn-accent,var(--cc-accent,#2f6feb));border-radius:min(var(--cc-b-radius,999px),17px);height:34px;overflow:hidden;transition:background-color .12s}" +
      "#cc-settings .cc-set-searchbadge .cc-set-searchicon{flex:0 0 auto;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;color:var(--cc-accent-text,#fff);cursor:pointer}" +
      "#cc-settings .cc-set-searchbadge.cc-open{background:#2e2e2e}" +
      "#cc-settings .cc-set-searchbadge:hover{filter:brightness(1.08)}" +
      "#cc-settings .cc-set-searchbadge.cc-open .cc-set-searchicon{color:#fff}" +
      "#cc-settings .cc-set-searchbadge .cc-set-search{box-sizing:border-box;width:0;max-width:0;padding:0;background:transparent;transition:width .2s,max-width .2s,padding .2s}" +
      "#cc-settings .cc-set-searchbadge.cc-open{background:#2e2e2e}" +
      "#cc-settings .cc-set-searchbadge.cc-open .cc-set-search{width:220px;max-width:220px;padding:0 12px 0 2px}" +
      // the version line at the very bottom, centred and muted
      "#cc-settings .cc-set-version-foot{margin:28px 0 6px;text-align:center;opacity:.55;font-size:12px}" +
      // the native-display link as an accent button rather than the grey chip
      "#cc-settings .cc-btn.cc-btn-accent{background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff)}" +
      "#cc-settings .cc-btn.cc-btn-accent:hover{filter:brightness(1.14);background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff)}" +
      "#cc-settings .cc-set-danger{background:#5a2a2a!important;color:#ffd7d7!important}" +
      "#cc-settings .cc-set-danger:hover{filter:brightness(1.18)}" +
      "#cc-settings .cc-flag-picker{position:relative;margin-top:6px;max-width:340px}" +
      "#cc-settings .cc-flag-trigger{display:flex;align-items:center;gap:9px;background:#232323;border-radius:8px;padding:7px 12px;cursor:pointer;user-select:none}" +
      "#cc-settings .cc-flag-trigger:hover{filter:brightness(1.1)}" +
      "#cc-settings .cc-flag-name{font-size:13px;color:#eaeaea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      // The trigger reads as a button, with no caret, and openPanel pins the panel fixed.
      "#cc-settings .cc-flag-panel{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:9999;background:#1c1c1c;border-radius:10px;box-shadow:0 12px 34px rgba(0,0,0,.6);overflow:hidden}" +
      "#cc-settings .cc-flag-search{box-sizing:border-box;background:#232323;color:#eaeaea;border:none;outline:none;border-radius:8px;padding:8px 10px;margin:8px;width:calc(100% - 16px);font-size:13px}" +
      "#cc-settings .cc-flag-list{max-height:260px;overflow-y:auto;padding:0 6px 6px}" +
      "#cc-settings .cc-flag-item{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:6px;cursor:pointer}" +
      "#cc-settings .cc-flag-item:hover,#cc-settings .cc-flag-item.cc-sel{background:rgba(255,255,255,.09)}" +   // the keyboard highlight too
      // The logo preview tile. Its coloured badge is this box, a real element with a radius and
      // overflow hidden, never an feFlood inside the filter: an feFlood fills the whole filter
      // region and ignores the radius, rendering a hard square where the live tab shows a rounded
      // tile. The real tabs split it the same way: the tile carries the badge, the child the pixels.
      "#cc-settings .cc-set-tile{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;flex:0 0 auto;transition:background-color .12s}" +
      "#cc-settings .cc-set-tile>img{width:100%;height:100%;object-fit:contain;display:block;box-sizing:border-box}" +
      "#cc-settings .cc-set-tile>i{display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;box-sizing:border-box}" +
      "#cc-settings .cc-set-tile-bg>img,#cc-settings .cc-set-tile-bg>i{padding:14%}" +
      // A per-area sub-heading inside one card is a muted caption, never a card inside a card.
      "#cc-settings .cc-set-sublbl{margin:12px 0 0;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;opacity:.55}" +
      "#cc-settings .cc-set-prev-empty{margin:6px 0 0;font-size:12px;opacity:.5}";
    document.head.appendChild(st);
  })();
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  var de = LANG === "de";
  function T(d, e) { return de ? d : e; }

  var COLS = [
    { key: "update", label: T("Update-Status", "Update status") },
    { key: "force", label: T("Update erzwingen", "Force update") },
    { key: "version", label: T("Image-Tag (latest)", "Image tag (latest)") },
    { key: "net", label: T("Netzwerk", "Network") },
    { key: "ip", label: T("Container-IP", "Container IP") },
    { key: "lan", label: T("LAN-IP", "LAN IP") },
    { key: "port", label: T("Ports", "Ports") },
    { key: "res", label: T("CPU / RAM", "CPU / RAM") },
    { key: "id", label: T("Container-ID", "Container ID") },
    { key: "von", label: T("Von / Quelle", "From / source") },
    { key: "vol", label: T("Volumes", "Volumes") },
    { key: "plan", label: T("Startplan", "Plan") },
    { key: "restart", label: T("Restart-Policy", "Restart policy") },
  ];
  var PRESETS = ["#2f6feb", "#1f9d55", "#ff8c2f", "#8b5cf6", "#e0912a", "#d9433f", "#0ea5a4", "#e05299", "#525252"];
  // The rainbow colour per column, in the order of COLS, so the matrix checkboxes echo the
  // Docker-tab badge colours. The four network columns share a family of related hues.
  var RB = ["#1f9d55", "#2f6feb", "#6b7280", "#8b5cf6", "#7c6df0", "#5b8def", "#4aa3c7", "#d9433f", "#0ea5a4", "#e05299", "#0891b2", "#6366f1", "#e0912a"];

  // Each column gets an object of its own from a factory call: chkCell mutates these in place, so a
  // shared reference would let one checkbox flip every column that aliased it. Stays in step with
  // docker.js defaultColview().
  function defColview() { var adv = function () { return { s: false, a: true }; }, both = function () { return { s: true, a: true }; }; return { update: both(), force: adv(), version: adv(), net: both(), ip: both(), lan: both(), port: both(), res: both(), id: adv(), von: adv(), vol: adv(), plan: both(), restart: adv() }; }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  // The default-view picker has to reach the server as well: docker.js treats the saved view mode
  // there as authoritative and overwrites a local-only pick on the next load. It reads, merges and
  // writes back, so a preference another feature adds later survives this picker.
  function syncViewModeServer(v) {
    if (typeof window.ccGql !== "function") return; // without header.js, localStorage still holds the value
    window.ccGql("{ docker { organizer { views { id prefs } } } }")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var view = j.data && j.data.docker && j.data.docker.organizer && j.data.docker.organizer.views && j.data.docker.organizer.views[0];
        if (!view) return;
        var merged = {}, cur = view.prefs;
        if (cur && typeof cur === "object") for (var k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) merged[k] = cur[k];
        merged.ccViewMode = v;
        return window.ccGql("mutation($v: String, $p: JSON!) { updateDockerViewPreferences(viewId: $v, prefs: $p) { version } }", { v: view.id, p: merged });
      })
      .catch(function () {});   // the picker reflects the choice either way
  }
  // Older builds stored the flag palette in the shared cc.rbpal key. With a flag selected and
  // cc.flagpal still absent, cc.rbpal holds exactly those flag colours, so they move across and the
  // rainbow palette returns to its default. No flag lookup is needed, since the value already is
  // the palette, so this cannot race the flag data loading. It runs at module load, before any
  // render, and once cc.flagpal exists the guard is false and it never runs again.
  (function migrateFlagPalette() {
    try {
      var rb = get("cc.rbpal", "");
      if (get("cc.flag", "") && rb) {
        var fp = get("cc.flagpal", "");
        if (!fp) { set("cc.flagpal", rb); del("cc.rbpal"); }
        else if (fp === rb) { del("cc.rbpal"); }                       // both hold the flag palette, so the rainbow one is redundant
        // a differing rbpal is a genuine custom rainbow palette and stays
      }
    } catch (e) {}
  })();
  function loadColview() { try { var j = JSON.parse(localStorage.getItem("cc.colview2") || "null"); if (j && typeof j === "object") { var d = defColview(); Object.keys(d).forEach(function (k) { if (j[k]) d[k] = { s: !!j[k].s, a: !!j[k].a }; }); return d; } } catch (e) {} return defColview(); }

  var accent = get("cc.accent", "#2f6feb");
  var rainbow = get("cc.rainbow", "0") === "1";
  var iconcolor = get("cc.iconcolor", "");
  var iconstrength = parseInt(get("cc.iconstrength", "100"), 10);
  var vmicons = get("cc.vmicons", "1") === "1"; // ON by default; the switch is an opt-OUT
  var density = get("cc.density", "normal");
  var view = get("cc.view", "list");
  var colview = loadColview();

  // Notifications are engine config rather than localStorage, loaded and saved through the
  // same-origin proxy. The whole config is kept, so a save here never drops the per-container
  // schedules and watchdogs set in the Docker tab.
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var fullConfig = { schedules: [], watchdogs: [], notify: { unraid: false, webhook: "" } };
  var notify = { unraid: false, webhook: "" };
  var shapeIface = "";       // the interface the egress shaping runs on; blank means eth0
  var notifyDirty = false;
  var shapeDirty = false;
  var configLoaded = false;  // only after a successful initial GET
  // Every cc.* write is mirrored into the engine config: localStorage is per origin, so without
  // this the toggles apply only to the origin they were set on.
  var uiSyncT = null, uiPending = {};
  (function () {
    try {
      var orig = localStorage.setItem.bind(localStorage);
      window.__ccLS = orig;
      localStorage.setItem = function (k, v) {
        orig(k, v);
        try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { uiPending[k] = 1; clearTimeout(uiSyncT); uiSyncT = setTimeout(pushUISettings, 800); } } catch (e) {}
      };
    } catch (e) {}
    // removeItem is intercepted too, or a cleared key never reaches the engine's mirror and the
    // next adopt resurrects the old value. pushUISettings() already reads a missing local value as
    // "delete the server key"; this is what queues the key at all. docker.js and cc-theme.js carry
    // the same interception, and a page runs exactly one of the three.
    try {
      var origRm = localStorage.removeItem.bind(localStorage);
      window.__ccLSRemove = origRm;
      localStorage.removeItem = function (k) {
        origRm(k);
        try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { uiPending[k] = 1; clearTimeout(uiSyncT); uiSyncT = setTimeout(pushUISettings, 800); } } catch (e) {}
      };
    } catch (e) {}
  })();
  function collectUISettings() { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^cc[a-z]*\./.test(k) && k !== "cc.stateCache") o[k] = localStorage.getItem(k); } return o; }
  // merges the changed keys into the server map rather than replacing it
  function pushUISettings() {
    var keys = Object.keys(uiPending); if (!keys.length) return;
    api("GET", "config").then(function (c) {
      if (!c || typeof c !== "object") return;
      var u = c.ui_settings || {};
      keys.forEach(function (k) { var v = localStorage.getItem(k); if (v === null) delete u[k]; else u[k] = v; });
      uiPending = {};
      c.ui_settings = u;
      return api("PUT", "config", c);
    }).catch(function () {});
  }
  function adoptUISettings(u) {
    var changed = false;
    // The same migration on the other side of the sync: the engine's ui_settings is the source of
    // truth, so cleaning localStorage alone would let the next adopt restore the old key. The
    // palette moves across in the incoming map, the local copy is cleared, and _migrated tells the
    // loader to persist the cleaned config back to the engine.
    adoptUISettings._migrated = false;
    try {
      if (u && u["cc.flag"] && u["cc.rbpal"]) {
        if (!u["cc.flagpal"]) { u["cc.flagpal"] = u["cc.rbpal"]; delete u["cc.rbpal"]; adoptUISettings._migrated = true; }
        else if (u["cc.flagpal"] === u["cc.rbpal"]) { delete u["cc.rbpal"]; adoptUISettings._migrated = true; }
        // a differing rbpal is a genuine custom rainbow palette and stays
      }
    } catch (e0) {}
    if (adoptUISettings._migrated) { try { localStorage.removeItem("cc.rbpal"); } catch (e1) {} }
    try { Object.keys(u || {}).forEach(function (k) { if (/^cc[a-z]*\./.test(k) && k !== "cc.stateCache" && localStorage.getItem(k) !== u[k]) { (window.__ccLS || localStorage.setItem.bind(localStorage))(k, u[k]); changed = true; } }); } catch (e) {}
    return changed;
  }
  function api(method, path, body) {
    var opts = { method: method, headers: { Accept: "application/json" } };
    var u = PROXY + "?path=" + encodeURIComponent(path);
    var tk = "";
    try { tk = (typeof window.csrf_token !== "undefined" && window.csrf_token) || (document.querySelector('input[name="csrf_token"]') || {}).value || ((document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/) || [])[1] || ""; } catch (e) {}
    if (method !== "GET") { // emhttp accepts the csrf_token in a form body only
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opts.body = (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body != null ? body : {}));
    }
    return fetch(u, opts).then(function (r) {
      return r.text().then(function (tx) { var d = null; try { d = tx ? JSON.parse(tx) : null; } catch (e) {} if (!r.ok) throw new Error((d && d.error) || ("HTTP " + r.status)); return d; });
    });
  }
  // an embedded colour picker, with no OS popup window
  function hexToHsv(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return null;
    var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
    if (h < 0) h += 360;
    return { h: h, s: mx ? d / mx : 0, v: mx };
  }
  function hsvToHex(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    var f = function (u) { return ("0" + Math.round((u + m) * 255).toString(16)).slice(-2); };
    return "#" + f(r) + f(g) + f(b);
  }
  // A saturation square and a hue bar; _set(hex) syncs it and _get() reads it back.
  function inlinePicker(hex, onChange) {
    var box = el("div", "cc-ip"), sv = el("div", "cc-ip-sv"), dot = el("span", "cc-ip-dot"), hue = el("div", "cc-ip-hue"), hdot = el("span", "cc-ip-hdot");
    sv.appendChild(dot); hue.appendChild(hdot); box.appendChild(sv); box.appendChild(hue);
    var st = hexToHsv(hex) || { h: 220, s: 0.8, v: 0.9 };
    function paint() {
      sv.style.background = "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(" + Math.round(st.h) + ",100%,50%))";
      dot.style.left = (st.s * 100) + "%"; dot.style.top = ((1 - st.v) * 100) + "%";
      hdot.style.left = (st.h / 360 * 100) + "%";
    }
    function emit() { onChange(hsvToHex(st.h, st.s, st.v)); }
    function drag(target, apply2) {
      function mv(e) {
        var r = target.getBoundingClientRect();
        var cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
        apply2(Math.min(1, Math.max(0, (cx - r.left) / r.width)), Math.min(1, Math.max(0, (cy - r.top) / r.height)));
        paint(); emit(); e.preventDefault();
      }
      function up() { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); document.removeEventListener("touchmove", mv); document.removeEventListener("touchend", up); }
      function down(e) { mv(e); document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up); document.addEventListener("touchmove", mv); document.addEventListener("touchend", up); }
      target.addEventListener("mousedown", down); target.addEventListener("touchstart", down);
    }
    drag(sv, function (x, y) { st.s = x; st.v = 1 - y; });
    drag(hue, function (x) { st.h = Math.min(359.9, x * 360); });
    box._set = function (h2) { var p = hexToHsv(h2); if (p) { st = p; paint(); } };
    box._get = function () { return hsvToHex(st.h, st.s, st.v); };
    paint(); return box;
  }

  // Serialises the config read, modify and write, so two cards saving at nearly the same moment
  // cannot lose each other's field: each cycle waits for the previous one to settle.
  var cfgChain = Promise.resolve();
  function withConfigLock(fn) { var p = cfgChain.then(fn, fn); cfgChain = p.catch(function () {}); return p; }

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  var cardN = 0;
  function card(title, sub) {
    var c = el("div", "cc-set-card");
    var h = el("div", "cc-set-h", title);
    if (sub) h.appendChild(infoIcon(sub)); // the explanation lives behind the bubble, never on the card
    c.appendChild(h); return c;
  }
  function elk(t) { var s = el("span", "cc-b-k"); s.textContent = t; return s; }
  function elv(t) { var s = el("span", "cc-b-v"); s.textContent = t; return s; }
  // The plugin's one info glyph, shared through cc-theme.js; this is the fallback for a page that
  // loads without it. Hover or keyboard focus shows the explanation in a bubble.
  function infoIcon(tip) { if (window.CCTheme && window.CCTheme.infoIcon) return window.CCTheme.infoIcon(tip); var s = el("span", "cc-info"); s.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>'; if (tip) { s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); } s.setAttribute("tabindex", "0"); return s; }
  // normalise a typed hex ("2f6feb" / "#2F6FEB") to "#rrggbb", or "" if invalid.
  function normHex(s) { var v = String(s || "").trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = "#" + v; return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ""; }

  // A badge-styled on/off toggle, built from a span rather than a button: Unraid's global button
  // CSS paints a border on it and limits the knob's travel.
  function toggle(on, onChange, disabled) {
    var t = el("span", "cc-set-toggle" + (on ? " cc-set-toggle-on" : "") + (disabled ? " cc-set-toggle-disabled" : ""));
    t.setAttribute("role", "switch"); t.setAttribute("tabindex", disabled ? "-1" : "0"); t.setAttribute("aria-checked", on ? "true" : "false");
    if (disabled) t.setAttribute("aria-disabled", "true");
    t.appendChild(el("span", "cc-set-knob"));
    function paint() { t.classList.toggle("cc-set-toggle-on", on); t.setAttribute("aria-checked", on ? "true" : "false"); }
    function flip() { if (t.classList.contains("cc-set-toggle-disabled")) return; on = !on; paint(); onChange(on); }
    t._setOn = function (v) { if (v === on) return; on = v; paint(); }; // a programmatic sync, which fires no onChange
    t._setDisabled = function (d) { t.classList.toggle("cc-set-toggle-disabled", !!d); t.setAttribute("tabindex", d ? "-1" : "0"); if (d) t.setAttribute("aria-disabled", "true"); else t.removeAttribute("aria-disabled"); };
    t.addEventListener("click", flip);
    t.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    return t;
  }
  function toggleRow(labelText, on, onChange) {
    var row = el("div", "cc-set-row"); row.appendChild(el("span", null, labelText)); var sp = el("span", "cc-set-spacer"); row.appendChild(sp);
    row.appendChild(toggle(on, onChange)); return row;
  }

  // Every colour row draws the same swatch, so the picked one is marked the same way everywhere.
  // The box never changes size, since a scaled swatch reads as a different size from its
  // neighbours; the mark is a tick on the fill, and that tick needs an ink contrasting with this
  // swatch's own colour, so the class and the ink are always set together.
  function swMark(sw, on, colour) {
    if (!sw) return;
    sw.classList.toggle("cc-set-sw-on", !!on);
    if (on) sw.style.setProperty("--cc-sw-tick", ccTick(idealText(colour || sw.dataset.c || "")));
    else sw.style.removeProperty("--cc-sw-tick");
  }
  // Marks the swatch in `row` whose colour matches and unmarks the rest; dataset.c is the one
  // attribute every preset swatch carries.
  function swMarkRow(row, colour) {
    if (!row) return;
    var want = String(colour || "").toLowerCase();
    Array.prototype.slice.call(row.querySelectorAll(".cc-set-sw")).forEach(function (sw) {
      var c = (sw.dataset.c || "").toLowerCase();
      swMark(sw, !!c && c === want, sw.dataset.c);
    });
  }

  // One logo preview for every card that has one. It runs the tabs' own icon pipeline, which
  // picks the treatment and may swap in a curated glyph, exactly as the area scripts do, so the
  // preview shows what the tab it previews will show. The badge is a real CSS box behind the
  // image, not an feFlood inside the filter, which fills the whole filter region and would ignore
  // the radius. `scope` is the pipeline's per-item scope, so a per-item pin shows up here too.
  function logoPreview(scope, fid) {
    var wrap = el("div", "cc-set-prev");
    var items = [];
    // The background and the tint are two independent pairs: the background draws the badge box
    // in its own colour, falling back to the tint colour and then the accent, while the tint
    // recolours the icon and has its own switch, so a badge alone never forces a recolour.
    var st = { bg: false, bgColor: "", tint: false, color: "", strength: 100, accent: "#2f6feb", size: null };
    var bound = false;
    function C() { return window.CCTheme && window.CCTheme.icons; }
    function hex6(c) { c = String(c == null ? "" : c).trim(); return /^#[0-9a-f]{3}$/i.test(c) ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c; }
    function badgeBg() {
      if (/^#[0-9a-f]{6}$/i.test(st.bgColor)) return st.bgColor;
      if (/^#[0-9a-f]{6}$/i.test(st.color)) return st.color;
      return st.accent;
    }
    // The same ink contract as docker.js iconInk(): nothing while the tint is off, and otherwise
    // the picked tint colour lifted out of the dark end, whether or not the badge is on too.
    // badgeBg() stays the box's own colour and is never the icon's ink. A luminance tint outputs
    // about half the target's luma, so that path doubles the floor.
    function ink(forTint) {
      if (!st.tint) return "";
      if (!/^#[0-9a-f]{6}$/i.test(st.color)) return "";
      var T = window.CCTheme;
      return (T && T.liftDark) ? hex6(T.liftDark(st.color, st.accent, T.LUM_FLOOR * (forTint ? 2 : 1))) : st.color;
    }
    function host(id) {
      var h = document.getElementById(id);
      if (!h) { h = document.createElement("div"); h.id = id; h.setAttribute("aria-hidden", "true"); h.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(h); }
      return h;
    }
    function flatFilter() {
      var m = /^#?([0-9a-f]{6})$/i.exec(ink(false) || ""); if (!m) return "";
      var n = parseInt(m[1], 16), r = ((n >> 16 & 255) / 255).toFixed(4), g = ((n >> 8 & 255) / 255).toFixed(4), b = ((n & 255) / 255).toFixed(4);
      var id = fid + "-flat";
      host(id + "-svg").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + id + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="0 0 0 0 ' + r + ' 0 0 0 0 ' + g + ' 0 0 0 0 ' + b + ' 0 0 0 1 0"/></filter></svg>';
      return "url(#" + id + ")";
    }
    function tintFilter() {
      var m = /^#?([0-9a-f]{6})$/i.exec(ink(true) || ""); if (!m) return "";
      var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
      var s = Math.max(10, st.strength || 100) / 100, i = 1 - s;
      function row(c, ix) { var v = [0.2126 * c * s, 0.7152 * c * s, 0.0722 * c * s, 0, 0]; v[ix] += i; return v.join(" "); }
      var id = fid + "-tint";
      host(id + "-svg").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + id + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + row(r, 0) + " " + row(g, 1) + " " + row(b, 2) + ' 0 0 0 1 0"/></filter></svg>';
      return "url(#" + id + ")";
    }
    function radius() {
      var sh = get("cc.badgeshape", "pill");
      return sh === "circle" ? "50%" : "min(" + ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" }[sh] || "999px") + ", 16px)";
    }
    function size() { return st.size || ({ s: "48px", m: "62px", l: "76px" })[get("cc.sgsize", "m")] || "62px"; }
    // A sample whose name starts with a font-icon prefix is a glyph, monochrome by construction:
    // it inks through the CSS colour and has no raster for a filter to work on.
    function add(src, name) {
      var tile = el("span", "cc-set-tile"), node;
      if (/^(fa-|icon-)/.test(src)) { node = el("i", (/^fa-/.test(src) ? "fa " : "") + src); }
      else { node = el("img"); node.alt = ""; node.src = src; node.onerror = function () { tile.style.display = "none"; }; }
      tile.appendChild(node); wrap.appendChild(tile);
      items.push({ tile: tile, node: node, name: name || "", glyph: node.tagName !== "IMG", src: src });
    }
    function paint() {
      var Ci = C(), bg = badgeBg(), rad = radius(), sz = size(), flat = flatFilter(), tint = tintFilter();
      if (Ci) { var names = []; items.forEach(function (it) { if (it.name) names.push(it.name); }); if (names.length) Ci.want(names); }
      items.forEach(function (it) {
        it.tile.style.width = it.tile.style.height = sz;
        it.tile.style.borderRadius = rad;
        it.tile.style.background = st.bg ? bg : "";
        it.tile.classList.toggle("cc-set-tile-bg", !!st.bg);
        // The plan comes from the pipeline, never from a local guess, so an unknown icon falls
        // through to the safe treatment exactly as it does on the real tab.
        var plan = { treat: "tint", url: "" };
        if (Ci) {
          var res = it.name ? Ci.result(it.name) : null, kind = (res && res.kind !== "pending") ? res.kind : "";
          var spread = it.glyph ? 0 : Ci.spread(it.src);
          var p = Ci.plan(it.name ? Ci.mode(scope, it.name) : Ci.globalMode(), kind, spread);
          plan = { treat: p.treat, url: (!it.glyph && it.name && (p.src === "glyph" || p.src === "color")) ? Ci.svgUrl(it.name) : "" };
        }
        var want = plan.treat === "native" ? "none" : (plan.treat === "flat" ? (flat || tint || "none") : (tint || "none"));
        if (it.glyph) {
          it.node.style.fontSize = "calc(" + sz + " * .46)";
          // ink() already answers the picked colour while the tint is on and nothing while it is
          // off, badge or no badge; branching on the badge here would colour the glyph regardless.
          it.node.style.color = plan.treat === "native" ? "" : (ink(false) || "");
          it.node.style.filter = "none";
        } else {
          var src = plan.url || it.src;
          if (it.node.getAttribute("src") !== src) it.node.src = src;
          it.node.style.filter = want;
        }
      });
    }
    // A "pending" name is still being looked up by the engine's workers; the pipeline calls back
    // when an answer lands, so the preview upgrades itself exactly like a real tab row does.
    function bind() { if (bound) return; var Ci = C(); if (Ci && Ci.onResolved) { Ci.onResolved(paint); bound = true; } }
    return {
      el: wrap,
      add: function (src, name) { add(src, name); },
      clear: function () { items = []; wrap.innerHTML = ""; },
      count: function () { return items.length; },
      set: function (o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) st[k] = o[k]; bind(); paint(); },
      paint: paint
    };
  }

  // The one background and icon control pair, for every card that has one: the global logos card,
  // the Docker tab's own and every other area's. Each control has its own on/off key and its own
  // colour key, which is what keeps turning the background on from silently switching the icon
  // tint on with it, and the DOM for both is built exactly once.
  //   io.getBg()/setBg(bool)             the background on or off
  //   io.getBgColor()/setBgColor(hex)    its own colour; empty falls back
  //   io.getTint()/setTint(bool)         the icon tint on or off
  //   io.getColor()/setColor(hex)        its own colour
  //   io.getAdopt()/setAdopt(bool)       the master adopt toggle
  //   io.getAccent()                     this scope's accent, for the fallback
  //   io.onChange()                      called after any of those writes
  // It returns the handles a caller may still need, such as the strength slider, and a sync() that
  // repaints every row from the stored values, which an adopt flip on an area card needs.
  //
  // The adopt toggle is one switch, not one per control. Two would each have to resolve the tint
  // to a single flat hue, since the tint is one shared SVG filter for the whole page, so rainbow
  // mode would paint every logo the same colour. With this one on, the background follows rainbow
  // or the accent as any other badge does, per item, and the icon's ink becomes an automatic black
  // or white contrast against whatever background that resolves to; both colour pickers are dimmed
  // and inert, since neither is consulted. With it off the two are independent. The colour
  // resolution itself lives on the read side in each area script; this control flips one key.
  function logoToggles(into, io) {
    function bgColorEff() {
      var c = io.getBgColor(); if (/^#[0-9a-f]{6}$/i.test(c)) return c;
      var ic = io.getColor(); if (/^#[0-9a-f]{6}$/i.test(ic)) return ic;
      return /^#[0-9a-f]{6}$/i.test(io.getAccent()) ? io.getAccent() : "#1f9d55";
    }
    // The master toggle is a global decision, so only the global card shows a switch for it. An
    // area card still reads getAdopt() to dim its colour pickers, it just has no row of its own;
    // that row is not built at all rather than built and hidden.
    var hideAdopt = !!io.hideAdoptRow;
    var adoptTg = null, adoptRow = null;
    if (!hideAdopt) {
      // the master toggle, first in the card and above every other row
      adoptTg = toggle(io.getAdopt(), function (v) { io.setAdopt(v); sync(); io.onChange(); });
      adoptRow = el("div", "cc-set-row cc-set-inline");
      var adoptLbl = el("span", "cc-set-lblwrap"); adoptLbl.appendChild(el("span", null, T("Badge-Einstellungen übernehmen", "Adopt badge settings")));
      adoptLbl.appendChild(infoIcon(T("An: Hintergrund und Icons folgen zusammen dem Regenbogen (rotierend, pro Symbol) oder der Akzentfarbe, wenn Regenbogen aus ist, genau wie jedes andere Badge. Das Symbol selbst wird dabei automatisch schwarz oder weiß eingefärbt, je nachdem was auf dem Hintergrund lesbar ist. Die beiden Farbwähler unten werden dabei ignoriert.", "On: background and icons together follow rainbow mode (rotating, per icon) or the plain accent when rainbow is off, exactly like every other badge. The icon itself is inked black or white, whichever reads on the resolved background. Both colour pickers below are ignored while this is on.")));
      adoptRow.appendChild(adoptLbl); adoptRow.appendChild(adoptTg);
    }

    var bgTg = toggle(io.getBg(), function (v) {
      io.setBg(v);
      if (v && !/^#[0-9a-f]{6}$/i.test(io.getBgColor())) { var seed = bgColorEff(); io.setBgColor(seed); bgPk._set(seed); bgHx.value = seed; }
      sync(); io.onChange();
    });
    var bgRow = el("div", "cc-set-row cc-set-inline"); bgRow.appendChild(el("span", null, T("Hintergrund", "Background"))); bgRow.appendChild(bgTg);
    var bgHx = el("input", "cc-set-hexin"); bgHx.type = "text"; bgHx.value = io.getBgColor() || ""; bgHx.placeholder = "#1f9d55"; bgHx.maxLength = 7; bgHx.spellcheck = false;
    var bgPk = inlinePicker(bgColorEff(), function (v) { io.setBgColor(v); bgHx.value = v; sync(); io.onChange(); });
    bgHx.addEventListener("input", function () { var v = normHex(bgHx.value); if (v) { io.setBgColor(v); bgPk._set(v); sync(); io.onChange(); } });
    var bgPickRow = el("div", "cc-set-pickrow"); bgPickRow.appendChild(bgPk); bgPickRow.appendChild(bgHx);

    var tintTg = toggle(io.getTint(), function (v) {
      io.setTint(v);
      if (v && !/^#[0-9a-f]{6}$/i.test(io.getColor())) { var seed2 = tintPk._get(); io.setColor(seed2); tintHx.value = seed2; }
      sync(); io.onChange();
    });
    // The label reads "Icons"; the storage key and every name in the code stay as the tint.
    var tintRow = el("div", "cc-set-row cc-set-inline"); tintRow.appendChild(el("span", null, T("Icons", "Icons"))); tintRow.appendChild(tintTg);
    var tintHx = el("input", "cc-set-hexin"); tintHx.type = "text"; tintHx.value = io.getColor() || ""; tintHx.placeholder = "#1f9d55"; tintHx.maxLength = 7; tintHx.spellcheck = false;
    var tintPk = inlinePicker(/^#[0-9a-f]{6}$/i.test(io.getColor()) ? io.getColor() : (/^#[0-9a-f]{6}$/i.test(io.getAccent()) ? io.getAccent() : "#1f9d55"), function (v) { io.setColor(v); tintHx.value = v; sync(); io.onChange(); });
    tintHx.addEventListener("input", function () { var v = normHex(tintHx.value); if (v) { io.setColor(v); tintPk._set(v); sync(); io.onChange(); } });
    var tintPickRow = el("div", "cc-set-pickrow"); tintPickRow.appendChild(tintPk); tintPickRow.appendChild(tintHx);

    var strRow = el("div", "cc-set-row"); strRow.appendChild(el("span", "cc-set-rl", T("Intensität", "Strength")));
    var strInput = el("input"); strInput.type = "range"; strInput.min = "10"; strInput.max = "100"; strInput.style.flex = "1"; strRow.appendChild(strInput);

    function sync() {
      if (adoptTg) adoptTg._setOn(io.getAdopt());
      var adopting = io.getAdopt();
      // Neither picker is consulted while the master toggle adopts, so both are dimmed and inert.
      bgTg._setOn(io.getBg());
      bgHx.value = io.getBgColor() || ""; try { bgPk._set(bgColorEff()); } catch (e9) {}
      bgPickRow.style.opacity = adopting ? ".4" : ""; bgPickRow.style.pointerEvents = adopting ? "none" : "";
      // The switches grey out and refuse clicks too, through toggle()'s own disabled state.
      bgTg._setDisabled(adopting);
      tintTg._setDisabled(adopting);
      tintTg._setOn(io.getTint());
      tintHx.value = io.getColor() || ""; try { if (/^#[0-9a-f]{6}$/i.test(io.getColor())) tintPk._set(io.getColor()); } catch (e9) {}
      tintPickRow.style.opacity = adopting ? ".4" : ""; tintPickRow.style.pointerEvents = adopting ? "none" : "";
      // The strength only means anything for the luminance tint, so it dims when the tint is off.
      // While adopting, the ink is a flat black or white contrast with no strength to tune.
      var dim = !io.getTint() || adopting;
      strRow.style.opacity = dim ? ".4" : ""; strRow.style.pointerEvents = dim ? "none" : "";
    }
    if (adoptRow) into.appendChild(adoptRow);
    into.appendChild(bgRow); into.appendChild(bgPickRow);
    into.appendChild(tintRow); into.appendChild(tintPickRow);
    into.appendChild(strRow);
    sync();
    return { sync: sync, strInput: strInput, bgToggle: bgTg, tintToggle: tintTg, adoptToggle: adoptTg };
  }

  // Real sample icons per area, for the previews. Fetching the native list pages cannot work:
  // all three ship an empty table body and fill it from their own jQuery after load, and fetch()
  // never executes a page's scripts, so the bytes it gets hold no icon at all. These are the same
  // row-fragment endpoints those pages call, plain server-rendered rows with the real icons in
  // them, identical by construction to what the live tab shows.
  // Three details in the parsing below:
  //  the VM endpoint answers the rows and a script separated by a NUL, and only the first part is
  //  markup; a bare row string handed to DOMParser is discarded, because the parser foster-parents
  //  a row with no table around it, so the fragment is wrapped first; and only the direct row
  //  children of that wrapper count, since a plugin's rendered README can carry its own tables
  //  and images. The plugin endpoint takes init=1 for the server-rendered icon markup and check=1
  //  to skip the remote version check, whose network path lives in the other branch.
  var ICON_SRC = {
    // The fragment carries the src the Docker tab itself renders, including Unraid's stand-in
    // image. Building a URL from the engine's container list instead is a guess, and it is wrong
    // for every container Unraid has no cached icon for: the file 404s and the row comes out as
    // a hole.
    docker: {
      url: "/plugins/dynamix.docker.manager/include/DockerContainers.php",
      cell: "td.ct-name",
      sels: ["span[id] > .img", "img.img", "img", "i.img"],
      name: function (cell) {
        var h = cell.querySelector("[onclick*='addDockerContainerContext']");
        var m = /addDockerContainerContext\('([^']+)'/.exec(h ? (h.getAttribute("onclick") || "") : "");
        return m ? m[1] : "";
      }
    },
    vm: {
      url: "/plugins/dynamix.vm.manager/include/VMMachines.php",
      cell: "td.vm-name",                                                     // a detail or disk row has no such cell and is skipped
      sels: ["span[id^='vm-'] > .img", "img.img", "img", "i.img"],            // the order vms.js uses
      // as vms.js does: a row's VM name is the first argument of its context handler
      name: function (cell) {
        var h = cell.querySelector("[onclick*='addVMContext']");
        var m = /addVMContext\('([^']+)'/.exec(h ? (h.getAttribute("onclick") || "") : "");
        return m ? m[1] : "";
      }
    },
    plugin: {
      url: "/plugins/dynamix.plugin.manager/include/ShowPlugins.php?init=1&check=1",
      cell: "td",
      sels: ["img.list", "i.list", "img", "i"],
      // as plugins.js does: the display name is the README heading in the description cell, with
      // the version cell's own id as the fallback.
      name: function (cell, row) {
        var tds = row.children; if (!tds || tds.length < 4) return "";
        var h = tds[1].querySelector("h1, h2, h3") || tds[1].querySelector("strong, b");
        return (h ? (h.textContent || "").trim() : String(tds[3].id || "").replace(/^vid-/, "")) || "";
      }
    }
  };
  // A disabled tab, no VMs or a slow box yields an empty list, and the caller shows its
  // "nothing to show" line rather than a broken row.
  function rowIcons(kind, max) {
    var cfg = ICON_SRC[kind];
    if (!cfg) return Promise.resolve([]);
    return fetch(cfg.url, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (raw) {
      var out = [];
      if (!raw) return out;
      try {
        var rows = String(raw).split("\0")[0];
        var doc = new DOMParser().parseFromString("<table><tbody>" + rows + "</tbody></table>", "text/html");
        var tb = doc.querySelector("tbody");
        var lim = max || 4;
        Array.prototype.slice.call(tb ? tb.children : []).forEach(function (row) {
          if (out.length >= lim || row.tagName !== "TR") return;
          var cell = row.children && row.children[0];
          if (!cell || !cell.matches || !cell.matches(cfg.cell)) return;
          var n = null;
          for (var i = 0; i < cfg.sels.length && !n; i++) n = cell.querySelector(cfg.sels[i]);
          if (!n) return;
          var nm = ""; try { nm = cfg.name(cell, row) || ""; } catch (e2) {}
          if (n.tagName === "IMG") { var s = n.getAttribute("src") || ""; if (s) out.push({ src: s, name: nm }); }
          else { var cls = (n.getAttribute("class") || "").split(/\s+/).filter(function (c) { return /^(fa-|icon-)/.test(c); })[0]; if (cls) out.push({ src: cls, name: nm }); }
        });
      } catch (e) {}
      return out;
    }).catch(function () { return []; });
  }

  function render() {
    root.innerHTML = "";
    // The theming snapshot is re-read on every render: these are module-level variables read once
    // at load, and a setting change calls render(), so without this the page repaints from the
    // value it started with and a freshly flipped switch snaps back.
    accent = get("cc.accent", "#2f6feb");
    rainbow = get("cc.rainbow", "0") === "1";
    iconcolor = get("cc.iconcolor", "");
    iconstrength = parseInt(get("cc.iconstrength", "100"), 10);
    root.classList.toggle("cc-rainbow", rainbow);
    root.style.setProperty("--cc-accent", accent);
    root.style.setProperty("--cc-accent-text", idealText(accent));

    var head = el("div", "cc-set-head");
    var hero = el("div", "cc-set-hero");
    var hleft = el("div", "cc-set-heroleft");
    var lg = el("img", "cc-set-logo"); lg.src = "/plugins/cannonadecommand/images/cannonadecommand-unraid.svg"; lg.alt = "";   // the double-ring variant, which reads on every Unraid theme
    hleft.appendChild(lg);
    var htx = el("div", null);
    var brand = el("div", "cc-set-brand"); brand.appendChild(el("b", null, "Cannonade")); brand.appendChild(el("span", null, "Command"));
    htx.appendChild(brand);
    htx.appendChild(el("div", "cc-set-claim", "Firepower and finish for Unraid's Docker, Plugins and VM tabs."));
    hleft.appendChild(htx);
    hero.appendChild(hleft);
    head.appendChild(hero);
    // The running engine's version, where it is easy to find: an old value after an update means
    // the update did not take, or the daemon was not restarted.
    var CC_VER = "@@CCVER@@"; if (CC_VER.indexOf("@@") === 0) CC_VER = "dev";
    // the GlimStone version this UI is built against, bumped by hand whenever its files are recopied
    var GLS_VER = "1.0.0";
    // the line itself is appended to root after every wrap, at the very bottom of the page
    var verLine = el("div", "cc-set-sub cc-set-version cc-set-version-foot", "UI v" + CC_VER + " · GlimStone v" + GLS_VER + " · " + T("Engine: verbinde…", "Engine: connecting…"));
    api("GET", "state").then(function (s) {
      verLine.textContent = "UI v" + CC_VER + " · GlimStone v" + GLS_VER + " · " + ((s && s.version) ? ("Engine " + String(s.version).replace(/^v/, "v")) + " · " + T("läuft", "running") : T("Engine läuft (Version unbekannt)", "Engine running (version unknown)"));
    }).catch(function (e) { verLine.textContent = "UI v" + CC_VER + " · GlimStone v" + GLS_VER + " · " + T("Engine nicht erreichbar", "Engine not reachable") + ": " + (e && e.message ? e.message : ""); verLine.style.color = "#d9433f"; });
    // The settings search filters cards and rows across every tab. It sits at the right of the
    // hero as a badge with a magnifier that expands into the input on click.
    var setSearch = el("input", "cc-set-search"); setSearch.type = "search"; setSearch.placeholder = T("Einstellungen durchsuchen …", "Search settings …"); setSearch.spellcheck = false;
    var searchBadge = el("div", "cc-set-searchbadge");
    var searchIcon = el("span", "cc-set-searchicon"); searchIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M14 3.072a8 8 0 0 1 2.32 11.834l5.387 5.387a1 1 0 0 1 -1.414 1.414l-5.388 -5.387a8 8 0 1 1 -.905 -13.249" /></svg>';   // tabler filled/search
    searchBadge.appendChild(searchIcon); searchBadge.appendChild(setSearch);
    searchIcon.addEventListener("click", function (e) { e.stopPropagation(); var open = searchBadge.classList.toggle("cc-open"); if (open) { setSearch.focus(); } else { setSearch.value = ""; if (typeof runFilter === "function") runFilter(""); } });
    hero.appendChild(searchBadge);
    // The search collapses again on a click beside it, clearing the query and resetting the filter
    // through an input event so the existing listener runs. Bound once, since render() re-enters.
    if (!window.__ccSetSearchDoc) {
      window.__ccSetSearchDoc = true;
      document.addEventListener("click", function (e) {
        var sb = document.querySelector(".cc-set-searchbadge.cc-open");
        if (sb && !sb.contains(e.target)) { sb.classList.remove("cc-open"); var si = sb.querySelector(".cc-set-search"); if (si && si.value) { si.value = ""; try { si.dispatchEvent(new Event("input", { bubbles: true })); } catch (e2) {} } }
      });
    }
    root.appendChild(head);

    // the Unraid title strip between the main menu and our hero is redundant here
    try { Array.prototype.slice.call(document.querySelectorAll("div.title")).forEach(function (tt) { tt.style.setProperty("display", "none", "important"); }); } catch (e9) {}
    // three sections: Docker Tab | Plugin Tab | VM Tab (minimal tab row)
    var tabRow = el("div", "cc-set-tabs");
    var wrap = el("div", "cc-set-wrap");
    var wrapPlugin = el("div", "cc-set-wrap"), wrapVms = el("div", "cc-set-wrap"), wrapHeader = el("div", "cc-set-wrap"), wrapShares = el("div", "cc-set-wrap");
    var wrapSettings = el("div", "cc-set-wrap");
    var wrapTools = el("div", "cc-set-wrap");   // Werkzeuge shares the /Settings grid config, since Unraid renders both landing pages alike
    var wrapFavorites = el("div", "cc-set-wrap");
    var wrapStart = el("div", "cc-set-wrap");
    var wrapMain = el("div", "cc-set-wrap");    // Allgemein, which also hosts the export and import card
    var adoptToggles = {}; // each adopt key's toggle element, which a colour pick flips live
    var styleCardSync = {}; // each adopt key's refresher, repainting an area card with the effective colour
    function syncAllStyleCards() { for (var k9 in styleCardSync) { try { styleCardSync[k9](); } catch (e9) {} } }
    // The master theming switch. Off keeps the Docker orchestration functions and disables every
    // visual change. It defaults on, so an existing install is unchanged, and the tabs pick a
    // change up through their storage listeners or on the next load.
    var themingCard; // the first Allgemein card, which the backup section moves into
    (function () {
      var tc = card(T("Theming", "Theming"), T("Aus: nur die Docker-Funktionen von CannonadeCommand bleiben (Startplan, Abhängigkeiten, Health-Gate, Watchdog, Zeitpläne, Limits, Bandbreite, Auto-Stop bei Leerlauf). Das gesamte visuelle Theming, also Badges, Farben, Rainbow, Karten und die Umgestaltung aller Tabs, wird abgeschaltet.", "Off: only CannonadeCommand's Docker functions remain (start plan, dependencies, health gate, watchdog, schedules, limits, bandwidth, idle auto-stop). All visual theming, meaning badges, colours, rainbow, cards and every tab's restyling, is turned off."));
      tc.appendChild(toggleRow(T("Theming aktiv", "Theming on"), localStorage.getItem("cc.theming") !== "0", function (v) { set("cc.theming", v ? "1" : "0"); render(); syncHeaderBar(); syncSharesBar(); }));
      themingCard = tc;
      wrapMain.appendChild(tc);
    })();
    // Unraid's display settings stay on Unraid's own page, which CC styles anyway, rather than
    // being mirrored field by field. The few controls kept here post the same field through
    // update.php and reload, so flipping one here flips the native setting too. A multipart body
    // times out, hence URLSearchParams. The favourites field also drives cc.hidefavtab.
    if (typeof csrf_token !== "undefined") (function () {
      var postDisplay = function (field, value) {
        try {
          var fd = new URLSearchParams();
          fd.append("#file", "dynamix/dynamix.cfg"); fd.append("#section", "display");
          fd.append("csrf_token", window.csrf_token); fd.append(field, value);
          if (field === "favorites") set("cc.hidefavtab", value === "no" ? "1" : "0");
          fetch("/update.php", { method: "POST", body: fd, credentials: "same-origin" }).then(function () { location.reload(); });
        } catch (e9) {}
      };
      // a short help text per field, since the native page ships none
      var H = {
        width: ["Verpackt hält den Inhalt in fester Breite; Unbegrenzt nutzt die volle Fensterbreite.", "Packed keeps a fixed content width; Unlimited uses the full window width."],
        locale: ["Sprache der WebGUI.", "Language of the WebGUI."],
        font: ["Grundschriftgröße der Oberfläche.", "Base UI font size."],
        tty: ["Schriftgröße im eingebauten Terminal.", "Font size in the built-in terminal."],
        terminalButton: ["Terminal-Knopf im Kopfbereich anzeigen.", "Show the terminal button in the header."],
        number: ["Dezimal- und Tausender-Trennzeichen für Zahlen.", "Decimal and thousands separators for numbers."],
        scale: ["Einheit für Dateigrößen (automatisch oder fest).", "Unit for file sizes (automatic or fixed)."],
        tabs: ["Unterseiten als Tabs oder als eine lange Abschnitts-Seite.", "Sub-pages as tabs or one long sectioned page."],
        users: ["Wo das Benutzermenü sitzt: Kopfzeile oder Einstellungsmenü.", "Where the user menu sits: header or settings menu."],
        resize: ["Listen automatisch mitwachsen lassen oder feste Höhe.", "Let lists grow automatically or use a fixed height."],
        raw: ["Datenträgernamen normalisiert oder roh anzeigen.", "Show disk names normalised or raw."],
        wwn: ["World-Wide-Name in der Geräte-ID einblenden.", "Show the World-Wide-Name in the device ID."],
        total: ["Summenzeile mit Array-Gesamtwerten anzeigen.", "Show a totals row with array totals."],
        usage: ["Auslastungsbalken pro Datenträger anzeigen.", "Show a usage bar per disk."],
        unit: ["Temperaturen in Celsius oder Fahrenheit.", "Temperatures in Celsius or Fahrenheit."],
        theme: ["Grund-Farbschema von Unraid (CannonadeCommand färbt darüber).", "Unraid's base colour scheme (CannonadeCommand paints over it)."],
        text: ["Darstellung der Belegt/Frei-Spalten (Text, Balken, Farbe).", "How the used/free columns look (text, bar, colour)."],
        headerdescription: ["Beschreibungstext im Kopfbereich anzeigen.", "Show the description text in the header."],
        banner: ["Eigenes Kopf-Banner ein-/ausblenden (Bild unten hochladen).", "Show/hide a custom header banner (upload the image below)."],
        showBannerGradient: ["Weichen Farbverlauf über dem Banner anzeigen.", "Show a soft gradient over the banner."],
        favorites: ["Favoriten-Funktion aktivieren; Nein blendet den Favoriten-Tab aus.", "Enable favourites; No hides the Favorites tab."],
        header: ["Native Kopfzeilen-Textfarbe. Sichtbar nur, wenn CannonadeCommands Kopfbereich AUS ist (sonst übermalt CannonadeCommand den Kopf).", "Native header text colour. Visible only when CannonadeCommand's header area is OFF (otherwise CannonadeCommand overpaints the header)."],
        headermetacolor: ["Native Kopfzeilen-Sekundärtextfarbe. Wirkt nur bei ausgeschaltetem CannonadeCommand-Kopfbereich.", "Native header secondary text colour. Only when CannonadeCommand's header area is off."],
        background: ["Native Kopf-Hintergrundfarbe. Wirkt nur bei ausgeschaltetem CannonadeCommand-Kopfbereich.", "Native header background colour. Only when CannonadeCommand's header area is off."]
      };
      function help(nm) { var h = H[nm]; return h ? T(h[0], h[1]) : ""; }
      function fieldLabel(c, nm) { var dd = c.closest("dd"), dt = dd ? dd.previousElementSibling : null; return (dt && dt.tagName === "DT") ? (dt.textContent || "").replace(/\s*:\s*$/, "").trim() : nm; }
      // A native header colour field becomes a picker and a hex input. It commits on a hex change
      // or once the picker has settled, since dragging must not reload on every frame.
      function colorRow(lbl, hexv, onCommit, helpTxt) {
        hexv = (hexv || "").replace(/^#/, "");
        var row = el("div", "cc-set-row"); var rl = el("span", "cc-set-rl", lbl); if (helpTxt) rl.appendChild(infoIcon(helpTxt)); row.appendChild(rl);
        var pr = el("div", "cc-set-pickrow"), colT;
        var hx = el("input", "cc-set-hexin"); hx.type = "text"; hx.value = hexv ? "#" + hexv : ""; hx.placeholder = "#000000"; hx.maxLength = 7; hx.spellcheck = false;
        var pk = inlinePicker(/^[0-9a-f]{6}$/i.test(hexv) ? "#" + hexv : "#161616", function (v) { hx.value = v; clearTimeout(colT); colT = setTimeout(function () { onCommit(v.replace(/^#/, "")); }, 700); });
        hx.addEventListener("change", function () { clearTimeout(colT); var v = normHex(hx.value); if (v) { pk._set(v); onCommit(v.replace(/^#/, "")); } else if (!hx.value) onCommit(""); });
        pr.appendChild(pk); pr.appendChild(hx); row.appendChild(pr); return row;
      }
      // The banner upload is a file drop on Unraid's page, which this links out to rather than
      // reimplementing a multipart upload through the proxy.
      function bannerUploadRow() {
        var row = el("div", "cc-set-row"); row.appendChild(el("span", "cc-set-rl", T("Eigenes Banner-Bild", "Custom banner image")));
        var b = el("button", "cc-btn", T("Hochladen / ändern …", "Upload / change …")); b.type = "button";
        b.addEventListener("click", function () { location.href = "/Settings/DisplaySettings"; });
        row.appendChild(b); return row;
      }
      // The header colour pickers live on Unraid's own page too; this card keeps the quick link
      // and the theme coupling below.
      var postDisplayMulti = function (fields) {
        try {
          var fd = new URLSearchParams();
          fd.append("#file", "dynamix/dynamix.cfg"); fd.append("#section", "display"); fd.append("csrf_token", window.csrf_token);
          Object.keys(fields).forEach(function (k9) { fd.append(k9, fields[k9]); });
          fetch("/update.php", { method: "POST", body: fd, credentials: "same-origin" }).then(function () { location.reload(); });
        } catch (e9) {}
      };
      // Matches the native header background and text colour to Unraid's active theme, read from
      // the theme's real body colour.
      function applyHdrAuto() {
        try {
          var bg = getComputedStyle(document.body).backgroundColor || "";
          var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (!m) return;
          var toHex = function (n) { return ("0" + (n & 255).toString(16)).slice(-2); };
          var bghex = toHex(+m[1]) + toHex(+m[2]) + toHex(+m[3]);
          var ink = idealText("#" + bghex).replace(/^#/, "");
          postDisplayMulti({ header: ink, headermetacolor: ink, background: bghex });
        } catch (e9) {}
      }
      // The header rows sit in the Theming card rather than in a card of their own.
      var cCard = themingCard;
      (function () {
        // the label and its bubble on the left, a short button beside it on the right
        var r = el("div", "cc-set-row cc-set-inline");
        var rl = el("span", "cc-set-lblwrap");
        rl.appendChild(el("span", null, T("Native Anzeige-Seite", "Native display page")));
        rl.appendChild(infoIcon(T("Öffnet Unraids Anzeige-Einstellungen im CannonadeCommand-Stil. Dort liegen unter anderem die Kopfzeilen-Farben, das Banner und die Favoriten-Option.", "Opens Unraid's Display Settings in CannonadeCommand style, where the header colours, the banner and the favourites option live.")));
        r.appendChild(rl);
        var b = el("button", "cc-btn cc-btn-accent", T("Öffnen", "Open")); b.type = "button";
        b.style.marginLeft = "auto";   // #3 (user): push the native-settings button flush right
        b.addEventListener("click", function () { location.href = "/Settings/DisplaySettings"; });
        r.appendChild(b); cCard.appendChild(r);
        var ar = el("div", "cc-set-row cc-set-inline");
        var arl = el("span", "cc-set-lblwrap");
        arl.appendChild(el("span", null, T("Kopf-Farben ans Thema koppeln", "Match header colours to the theme")));
        arl.appendChild(infoIcon(T("An: die Kopfzeilen-Hintergrund- und Textfarbe folgen automatisch Unraids Farbschema, also dunkler Hintergrund mit heller Schrift beim dunklen Thema und umgekehrt. Wirkt, wenn CannonadeCommands Kopfbereich aus ist.", "On: the header background and text colour follow Unraid's colour scheme automatically, dark background with light text on a dark theme and the reverse on a light one. Applies while CannonadeCommand's header area is off.")));
        ar.appendChild(arl);
        ar.appendChild(toggle(get("cc.hdrauto", "1") === "1", function (v) { set("cc.hdrauto", v ? "1" : "0"); if (v) applyHdrAuto(); }));
        cCard.appendChild(ar);
        // Apply the coupling once for a fresh default-on state. It only bites while the CC header
        // area is off, and the flag is set before the call, so the reload postDisplay triggers
        // cannot loop.
        try { if (get("cc.hdrauto", "1") === "1" && get("cc.hdrauto.done", "0") !== "1") { set("cc.hdrauto.done", "1"); applyHdrAuto(); } } catch (e9) {}
      })();
      // cCard is themingCard, already in the DOM, so re-appending it would reorder the cards. This
      // only keeps the favourites value in sync.
      fetch("/Settings/DisplaySettings", { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
        try {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var form = null;
          Array.prototype.forEach.call(doc.querySelectorAll("form"), function (f) { var s = f.querySelector('input[name="#section"]'); if (s && s.value === "display") form = f; });
          if (!form) return;
          var fav = form.querySelector('select[name="favorites"]'); if (fav) set("cc.hidefavtab", fav.value === "no" ? "1" : "0");
          try { if (window.ccFavGateSync) window.ccFavGateSync(); } catch (eG) {}   // the real native state is known now, so re-gate the Favoriten toggle
          syncHeaderBar();
        } catch (e9) {}
      }).catch(function () {});
    })();
    // Bereiche: enable/disable each area CannonadeCommand enhances
    (function () {
      var c = card(T("Bereiche", "Areas"), T("Aktiviere, welche Bereiche CannonadeCommand verschönert. Ein deaktivierter Bereich blendet seinen Tab hier sofort aus.", "Choose which areas CannonadeCommand enhances. Disabling an area hides its tab here immediately."));
      [["cc.enable.main", T("Start-Tab", "Start tab"), "0"], ["cc.enable.header", T("Kopfbereich", "Header area"), "0"], ["cc.enable.shares", T("Freigaben-Tab", "Shares tab"), "0"], ["cc.enable.docker", T("Docker-Tab", "Docker tab"), "1"], ["cc.enable.plugins", T("Plugin-Tab", "Plugins tab"), "1"], ["cc.enable.vms", T("VM-Tab", "VMs tab"), "1"], ["cc.enable.settings", T("Einstellungen- & Werkzeuge-Tabs", "Settings & Tools tabs"), "1"], ["cc.enable.favorites", T("Favoriten-Tab", "Favorites tab"), "1"]].forEach(function (a) {
        var row = el("div", "cc-set-row cc-set-inline");
        var cur = localStorage.getItem(a[0]);
        if (a[0] === "cc.enable.favorites") {
          // #3 (user): the CC Favoriten-Tab area is only switchable ON when Unraid's OWN favorites setting is
          // ON. cc.hidefavtab mirrors the native "favorites=no" state (synced by the fetch above + on the
          // Display Settings page). Native off => no tab to enhance => force the area off + disable the toggle
          // with a hint. window.ccFavGateSync re-evaluates it once the async native-state fetch resolves.
          var lw = el("span", "cc-set-lblwrap"); lw.appendChild(el("span", null, a[1])); row.appendChild(lw);
          var favOff = localStorage.getItem("cc.hidefavtab") === "1";
          if (favOff && localStorage.getItem("cc.enable.favorites") !== "0") localStorage.setItem("cc.enable.favorites", "0");
          var favOn = !favOff && (cur == null ? true : cur !== "0");
          var favTgl = toggle(favOn, function (v) { localStorage.setItem("cc.enable.favorites", v ? "1" : "0"); refreshTabs(); }, favOff);
          row.appendChild(favTgl);
          // the precondition rides a bubble on the label rather than sitting inline
          lw.appendChild(infoIcon(T("Nur verfügbar, wenn Favoriten in den Unraid-Anzeige-Einstellungen aktiviert sind.", "Only available when favourites are enabled in Unraid's display settings.")));
          try {
            window.ccFavGateSync = function () {
              var off = localStorage.getItem("cc.hidefavtab") === "1";
              favTgl._setDisabled(off);
              if (off) { favTgl._setOn(false); if (localStorage.getItem("cc.enable.favorites") !== "0") { localStorage.setItem("cc.enable.favorites", "0"); refreshTabs(); } }
            };
          } catch (eF) {}
          c.appendChild(row); return;
        }
        row.appendChild(el("span", null, a[1]));
        row.appendChild(toggle(cur == null ? a[2] !== "0" : cur !== "0", function (v) { localStorage.setItem(a[0], v ? "1" : "0"); refreshTabs(); }));
        c.appendChild(row);
      });
      wrapMain.appendChild(c);
    })();
    // The animation master has three settings: off, normal and wild. cc-anim-on covers normal and
    // wild alike, since the normal motion keeps running in wild, and cc-anim-wild layers the
    // exuberant extras on top. It overrides the OS reduce-motion preference, which is the point of
    // the setting.
    function applyAnim() { var v = get("cc.anim", "1"); var r = document.documentElement.classList; r.toggle("cc-anim-off", v === "0"); r.toggle("cc-anim-on", v !== "0"); r.toggle("cc-anim-wild", v === "2"); }
    applyAnim();   // stamped at once, so this page animates per the current setting
    if (themingCard) {
      themingCard.appendChild(segRow(T("Animationen", "Animations"),
        [["0", T("Aus", "Off")], ["1", T("Normal", "Normal")], ["2", T("Wild", "Wild")]],
        get("cc.anim", "1"),
        function (v) { set("cc.anim", v); applyAnim(); },
        T("Aus: keine Animationen. Normal: dezente Übergänge, Hover-Effekte und Einblendungen, überschreibt das „Bewegung reduzieren“ des Systems. Wild: sehr präsente Effekte, etwa hüpfende Hauptleisten-Tabs beim Überfahren.", "Off: no animations. Normal: subtle transitions, hovers and fades, overriding the system's reduce-motion setting. Wild: very present effects, such as bouncing main-tab pills on hover."),
        true));
    }
    // The section order follows the main menu. header.js persists a drag-reordered menu, and this
    // reads it loosely: either shape is accepted, and anything else falls back to the order below.
    var NAVDEF = ["Start", "Favorites", "Freigaben", "Einstellungen", "Docker", "Plugins", "VMs", "Werkzeuge", "Stats", "Apps"];
    var navOrder = NAVDEF;
    try { var no9 = JSON.parse(get("cc.navorder.all", "null")); var arr9 = no9 && no9.left ? no9.left : no9; if (arr9 && arr9.length && typeof arr9.forEach === "function") navOrder = arr9; } catch (e9b) {}
    // The on-screen menu order comes first, so these sub-tabs mirror the main tabs exactly; the
    // persisted snapshot and the default above are only fallbacks.
    try {
      var liveToks9 = [];
      Array.prototype.forEach.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]"), function (a9) {
        var h9 = (a9.getAttribute("href") || "").replace(/^\//, "").split(/[/?#]/)[0].toLowerCase();
        if (h9 && liveToks9.indexOf(h9) < 0) liveToks9.push(h9);
      });
      if (liveToks9.length >= 2) navOrder = liveToks9;
    } catch (e9x) {}
    // one normalised token per entry, so an href and a label compare equal
    var navToks = [];
    navOrder.forEach(function (k9) { navToks.push(String(k9).replace(/^\//, "").split(/[/?#]/)[0].toLowerCase()); });
    function navRank(aliases) { var best = -1; aliases.forEach(function (a9) { var i9 = navToks.indexOf(a9); if (i9 >= 0 && (best < 0 || i9 < best)) best = i9; }); return best; }
    // Allgemein comes first and Kopfbereich second, both chrome rather than menu tabs. The rest
    // follow the menu order, with anything missing from it keeping its relative order at the end.
    // Each section carries a stable id, which is what cc.settab persists.
    var SECS = [
      { id: "general", t: T("Allgemein", "General"), w: wrapMain, key: null },
      { id: "header", t: T("Kopfbereich", "Header area"), w: wrapHeader, key: "cc.enable.header" }
    ];
    [
      { id: "main", t: T("Start-Tab", "Start tab"), w: wrapStart, key: "cc.enable.main", tabs: ["start", "main"] },
      { id: "shares", t: T("Freigaben-Tab", "Shares tab"), w: wrapShares, key: "cc.enable.shares", tabs: ["freigaben", "shares"] },
      { id: "docker", t: T("Docker-Tab", "Docker tab"), w: wrap, key: "cc.enable.docker", tabs: ["docker"] },
      { id: "plugins", t: T("Plugin-Tab", "Plugins tab"), w: wrapPlugin, key: "cc.enable.plugins", tabs: ["plugins"] },
      { id: "vms", t: T("VM-Tab", "VMs tab"), w: wrapVms, key: "cc.enable.vms", tabs: ["vms"] },
      { id: "settings", t: T("Einstellungen-Tab", "Settings tab"), w: wrapSettings, key: "cc.enable.settings", tabs: ["einstellungen", "settings"] },
      { id: "tools", t: T("Werkzeuge-Tab", "Tools tab"), w: wrapTools, key: "cc.enable.settings", tabs: ["werkzeuge", "tools"] },
      { id: "favorites", t: T("Favoriten-Tab", "Favorites tab"), w: wrapFavorites, key: "cc.enable.favorites", tabs: ["favorites", "favoriten"] }
    ].map(function (s9, i9) { return { s: s9, i: i9, r: navRank(s9.tabs) }; })
      .sort(function (a9, b9) { return (a9.r < 0 ? 1e9 + a9.i : a9.r) - (b9.r < 0 ? 1e9 + b9.i : b9.r) || a9.i - b9.i; })
      .forEach(function (d9) { SECS.push(d9.s); });
    var tabBtns = [];
    function areaOn(key) { return !key || localStorage.getItem(key) !== "0"; }
    function showSec(i) {
      if (!SECS[i] || !areaOn(SECS[i].key)) i = 0; // never land on a hidden section
      localStorage.setItem("cc.settab", SECS[i].id); // the id, not the index, or a menu reorder restores the wrong tab
      SECS.forEach(function (sc, j) { sc.w.style.display = j === i ? "" : "none"; tabBtns[j].classList.toggle("cc-set-tab-on", j === i); });
      paintSetTabs();
      ccSetAlignSearch();
    }
    // The hero row spans the full settings width, but the card grid has fixed columns packed from
    // the left, so on a wide window the search badge sits well past where the cards end, by an
    // amount that depends on the active tab's card count. The correction goes on the badge's own
    // margin, not the hero's padding: the hero is content-box and shrinkable, so padding there is
    // absorbed into the content width without moving its border-box edge, and a correction
    // measured against that reference compounds rather than converging. Clearing the earlier
    // correction first and measuring the natural position avoids that.
    function ccSetAlignSearch() {
      try {
        var badge = document.querySelector(".cc-set-searchbadge");
        if (!badge) return;
        var activeWrap = null;
        for (var ai = 0; ai < SECS.length; ai++) { if (SECS[ai].w.style.display !== "none") { activeWrap = SECS[ai].w; break; } }
        if (!activeWrap) return;
        var cards = activeWrap.querySelectorAll(".cc-set-card");
        var contentRight = 0;
        for (var ci = 0; ci < cards.length; ci++) {
          var r = cards[ci].getBoundingClientRect();
          if (r.width > 0 && r.right > contentRight) contentRight = r.right;
        }
        if (!contentRight) return;
        badge.style.removeProperty("margin-right");
        var natural = badge.getBoundingClientRect().right;
        var delta = Math.round(natural - contentRight);
        if (delta > 0.5 && delta < 900) badge.style.setProperty("margin-right", delta + "px", "important");
      } catch (e) {}
    }
    // render() rebuilds the hero and the cards from scratch on every settings change, so a resize
    // listener bound to this call's function goes stale as soon as it runs again: the old closure
    // holds wrap elements that are no longer in the document, finds no cards and returns early.
    // A window-level pointer that every render() reassigns keeps the listener on the current one.
    window.__ccSetAlignSearch = ccSetAlignSearch;
    if (!window.__ccSetAlignResize) {
      window.__ccSetAlignResize = true;
      var alignTimer = null;
      window.addEventListener("resize", function () { clearTimeout(alignTimer); alignTimer = setTimeout(function () { window.__ccSetAlignSearch(); }, 120); });
    }
    // In rainbow mode every settings tab takes its own palette slot, not just the active one.
    function paintSetTabs() {
      var rb = get("cc.rainbow", "0") === "1";
      // In the neutral sub-mode an idle tab rests on the grey base and carries its colour only as
      // vars, which the hover rule paints from; the active tab keeps its direct colour.
      var reactive = rb && get("cc.rbmode", "all") === "active";
      // palG() is scoped inside buildStyleCards, so the palette is read directly here
      var DEF = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"], p = DEF;   // the shared palette, so the strip matches the rest of the UI
      try { var j = JSON.parse(get("cc.rbpal", "null")); if (j && j.length) p = j; } catch (e) {}
      tabBtns.forEach(function (b, i) {
        if (rb) {
          var c = p[i % p.length];
          b.style.setProperty("--cc-rb-c", c); b.style.setProperty("--cc-rb-ct", idealText(c));
          if (reactive && !b.classList.contains("cc-set-tab-on")) { b.style.removeProperty("background"); b.style.removeProperty("color"); return; }
          b.style.setProperty("background", c, "important"); b.style.setProperty("color", idealText(c), "important");
        } else {
          b.style.removeProperty("background"); b.style.removeProperty("color");
          b.style.removeProperty("--cc-rb-c"); b.style.removeProperty("--cc-rb-ct");
        }
      });
    }
    // hide the tab of any disabled area immediately; if we were ON it, fall back to Bereiche
    function refreshTabs() {
      var activeHidden = false;
      SECS.forEach(function (sc, j) {
        var on = areaOn(sc.key);
        // .cc-set-tab is `display: inline-flex !important` (badge sizing), so a plain
        // inline "none" can't hide it -> use inline !important, which outranks the sheet.
        if (on) tabBtns[j].style.removeProperty("display"); else tabBtns[j].style.setProperty("display", "none", "important");
        if (!on && tabBtns[j].classList.contains("cc-set-tab-on")) { activeHidden = true; sc.w.style.display = "none"; }
      });
      if (activeHidden) showSec(0);
    }
    SECS.forEach(function (sc, i) {
      var b = el("button", "cc-set-tab", sc.t); b.type = "button";
      b.addEventListener("click", function () { showSec(i); });
      tabBtns.push(b); tabRow.appendChild(b);
    });
    root.appendChild(tabRow);
    alignSetTabs(); // indent the strip to the first main-menu tab
    root.appendChild(wrapMain); root.appendChild(wrapStart); root.appendChild(wrapHeader); root.appendChild(wrapShares); root.appendChild(wrap); root.appendChild(wrapPlugin); root.appendChild(wrapVms); root.appendChild(wrapSettings); root.appendChild(wrapTools); root.appendChild(wrapFavorites);
    root.appendChild(verLine); // the version sits at the very bottom, after every wrap

    // The picker stays visible with a hex field beside it, both editing the same value and staying
    // in sync. It is embedded rather than an <input type=color>, which opens an OS dialog in a
    // window of its own.
    var c1 = card(T("Badges", "Badges"), T("Akzentfarbe und Farbmodus der Badges.", "Accent colour and colour mode of the badges."));
    var prow = el("div", "cc-set-pickrow");
    var hexIn = el("input", "cc-set-hexin"); hexIn.type = "text"; hexIn.value = accent; hexIn.placeholder = "#2f6feb"; hexIn.maxLength = 7; hexIn.spellcheck = false;
    // The handlers push the new colour onto the live bars as well: the header and the shares area
    // own isolated vars, so writing --cc-accent here alone would leave them until the next reload.
    var pick = inlinePicker(/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#2f6feb", function (v) { accent = v; hexIn.value = v; set("cc.accent", v); root.style.setProperty("--cc-accent", v); root.style.setProperty("--cc-accent-text", idealText(v)); paintPrev(); syncSwOn(); syncAllStyleCards(); syncHeaderBar(); syncSharesBar(); });
    function setAccent(v) { accent = v; pick._set(v); hexIn.value = v; set("cc.accent", accent); root.style.setProperty("--cc-accent", accent); root.style.setProperty("--cc-accent-text", idealText(accent)); paintPrev(); syncSwOn(); syncAllStyleCards(); syncHeaderBar(); syncSharesBar(); }
    hexIn.addEventListener("input", function () { var v = normHex(hexIn.value); if (v) setAccent(v); });
    prow.appendChild(pick); c1.appendChild(prow);
    // The preset swatches fill the row with the hex field as its rightmost cell, the same layout
    // every colour picker on this page uses. cc-set-swrow-global scopes syncSwOn() to this row:
    // sweeping every swatch on the page and marking it against the global accent would un-mark an
    // area card's own pick whenever the global colour changed.
    var srow = el("div", "cc-set-swatches cc-fill cc-set-swrow-global");
    PRESETS.slice(0, 7).forEach(function (c) {   // seven presets plus the two-cell hex field make nine
      // a span rather than a button, which Unraid's global CSS would bloat into a bordered box
      var sw = el("span", "cc-set-sw"); sw.setAttribute("data-tip", c); sw.style.background = c; sw.dataset.c = c;
      swMark(sw, c === accent, c);
      sw.addEventListener("click", function () { accent = c; set("cc.accent", accent); render(); syncHeaderBar(); syncSharesBar(); });
      srow.appendChild(sw);
    });
    srow.appendChild(hexIn); c1.appendChild(srow);
    // Rainbow and flag are two mutually exclusive palette modes sharing one colour engine.
    // cc.rainbow is the master flag every reader checks for an active palette, and cc.flagmode says
    // that palette is a country's flag. Turning one on turns the other off, and the UI greys out
    // the inactive one's controls.
    var flagOn = get("cc.flagmode", "0") === "1";
    var rbOnly = rainbow && !flagOn;
    var rr = el("div", "cc-set-row cc-set-inline");
    rr.appendChild(el("span", null, T("Regenbogen-Modus", "Rainbow mode")));
    rr.appendChild(toggle(rbOnly, function (v) { set("cc.rainbow", v ? "1" : "0"); set("cc.flagmode", "0"); if (!v) set("cc.rainbowrot", "0"); render(); syncHeaderBar(); syncSharesBar(); }));
    // Both master toggles stay clickable and flip each other; neither master row is greyed out.
    c1.appendChild(rr);
    // on: every reload deals a fresh colour mapping; off: the colours stay put
    var rrot = el("div", "cc-set-row cc-set-inline");
    var rrotL = el("span", "cc-set-lblwrap");
    rrotL.appendChild(el("span", null, T("Automatische Farbenrotation", "Automatic colour rotation")));
    rrotL.appendChild(infoIcon(T("Mischt die Rainbow-Farben bei jedem Neuladen der Seite neu durch, statt die Reihenfolge fest zu lassen.", "Reshuffles the rainbow colours on every page reload instead of keeping the order fixed.")));
    rrot.appendChild(rrotL);
    rrot.appendChild(toggle(get("cc.rainbowrot", "1") !== "0", function (v) { set("cc.rainbowrot", v ? "1" : "0"); syncHeaderBar(); syncSharesBar(); }));
    if (!rbOnly) { rrot.style.opacity = ".4"; rrot.style.pointerEvents = "none"; }
    c1.appendChild(rrot);
    // Every palette colour is editable: clicking a swatch opens the embedded picker below it. The
    // palette is stored as JSON in cc.rbpal, which the Docker tab reads live.
    var RBDEF = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"]; // the shared palette, or the swatches and the live UI disagree
    var rbpal = null; try { rbpal = JSON.parse(get("cc.rbpal", "null")); } catch (e) { rbpal = null; }
    if (!rbpal || rbpal.length !== RBDEF.length) rbpal = RBDEF.slice();
    var rbrow = el("div", "cc-set-swatches cc-fill");
    var rbPick = null, rbIdx = -1, rbPickWrap = el("div", "cc-set-pickrow"); rbPickWrap.style.display = "none";
    rbpal.forEach(function (cx, ix) {
      var sw = el("span", "cc-set-sw"); sw.style.background = cx; sw.setAttribute("data-tip", cx);
      sw.addEventListener("click", function () {
        rbIdx = ix; rbPickWrap.style.display = "";
        if (!rbPick) {
          rbPick = inlinePicker(rbpal[ix], function (v) { if (rbIdx >= 0) { rbpal[rbIdx] = v; rbrow.children[rbIdx].style.background = v; rbrow.children[rbIdx].setAttribute("data-tip", v); set("cc.rbpal", JSON.stringify(rbpal)); syncHeaderBar(); syncSharesBar(); } });   // its own key, so editing it never touches the flag palette
          rbPickWrap.appendChild(rbPick);
        } else rbPick._set(rbpal[ix]);
      });
      rbrow.appendChild(sw);
    });
    // an undo arrow right of the swatches, the same size as one of them
    var rbReset = el("span", "cc-set-ibtn");
    rbReset.setAttribute("data-tip", T("Farben zurücksetzen", "Reset colours"));
    var rbRi = document.createElement("i"); rbRi.className = "fa fa-undo"; rbReset.appendChild(rbRi);
    rbReset.addEventListener("click", function () { del("cc.rbpal"); render(); syncHeaderBar(); syncSharesBar(); });
    rbrow.appendChild(rbReset);
    c1.appendChild(rbrow); c1.appendChild(rbPickWrap);
    if (!rbOnly) { [rbrow, rbPickWrap].forEach(function (e9) { e9.style.opacity = ".4"; e9.style.pointerEvents = "none"; }); }
    // Flag mode has its own toggle and picker and excludes rainbow mode. A country's colours become
    // the active palette, cycled to fill every slot, and drive the same engine. The picker searches
    // by name and shows real flag images; an emoji flag renders as two letter boxes on Windows.
    if (window.CC_FLAGS && window.CC_FLAGS.length) {
      var FLAG_BASE = "/plugins/cannonadecommand/images/flags/";
      // The bundled SVG shows the country's actual pattern, and a code with no SVG falls back to
      // the colour-stripe swatch.
      var flagImg = function (f9, big) {
        var im = document.createElement("img");
        im.className = "cc-flag-img" + (big ? " cc-flag-img-lg" : "");
        im.src = FLAG_BASE + f9.code + ".svg"; im.alt = f9.name_de; im.loading = "lazy"; im.draggable = false;
        im.onerror = function () { try { if (im.parentNode) im.parentNode.replaceChild(flagSwatch(f9.colors, big), im); } catch (e9) {} };
        return im;
      };
      var flagSwatch = function (colors, big) {
        var s = el("span", "cc-flag-sw" + (big ? " cc-flag-sw-lg" : "")); var n = colors.length, stops = [];
        for (var i9 = 0; i9 < n; i9++) { stops.push(colors[i9] + " " + Math.round(i9 / n * 100) + "% " + Math.round((i9 + 1) / n * 100) + "%"); }
        s.style.background = "linear-gradient(to bottom, " + stops.join(", ") + ")"; return s;
      };
      var curFlag = function () { var c9 = get("cc.flag", ""); for (var j9 = 0; j9 < window.CC_FLAGS.length; j9++) if (window.CC_FLAGS[j9].code === c9) return window.CC_FLAGS[j9]; return null; };
      // The flag palette has its own key, never the rainbow one, so the editor above keeps the
      // rainbow colours and the engine paints flag colours only while flag mode is on.
      var applyFlag = function (f9) { var pal = []; for (var k9 = 0; k9 < RBDEF.length; k9++) pal.push(f9.colors[k9 % f9.colors.length]); set("cc.flag", f9.code); set("cc.flagpal", JSON.stringify(pal)); };
      var fr = el("div", "cc-set-row cc-set-inline");
      fr.appendChild(el("span", null, T("Flaggen-Modus", "Flag mode")));
      fr.appendChild(toggle(flagOn, function (v) {
        if (v) { set("cc.flagmode", "1"); set("cc.rainbow", "1"); var f0 = curFlag() || window.CC_FLAGS.filter(function (x9) { return x9.code === "de"; })[0] || window.CC_FLAGS[0]; applyFlag(f0); }
        else { set("cc.flagmode", "0"); set("cc.rainbow", "0"); }
        render(); syncHeaderBar(); syncSharesBar();
      }));
      c1.appendChild(fr);
      // A picker of its own, since a native select cannot show flag images: a real flag, the name,
      // and a search over both.
      var picker = el("div", "cc-flag-picker");
      var trigger = el("div", "cc-flag-trigger"); trigger.setAttribute("tabindex", "0");
      // the trigger reads as a button, with no caret
      var renderTrigger = function () { trigger.innerHTML = ""; var f0 = curFlag(); if (f0) { trigger.appendChild(flagImg(f0)); trigger.appendChild(el("span", "cc-flag-name", f0.name_de)); } else trigger.appendChild(el("span", "cc-flag-name", T("Land wählen …", "Pick a country …"))); };
      renderTrigger();
      var panel = el("div", "cc-flag-panel"); panel.style.display = "none";
      var search = el("input", "cc-flag-search"); search.type = "text"; search.placeholder = T("Suchen…", "Search…"); search.spellcheck = false; panel.appendChild(search);
      var list = el("div", "cc-flag-list");
      var buildList = function (q) {
        list.innerHTML = ""; q = (q || "").toLowerCase();
        window.CC_FLAGS.forEach(function (f0) {
          if (q && f0.name_de.toLowerCase().indexOf(q) < 0 && f0.name.toLowerCase().indexOf(q) < 0 && f0.code.indexOf(q) < 0) return;
          var row = el("div", "cc-flag-item"); row.appendChild(flagImg(f0)); row.appendChild(el("span", "cc-flag-name", f0.name_de));
          // Picking a country turns flag mode on, and with it rainbow mode off.
          row.addEventListener("click", function () { set("cc.flagmode", "1"); set("cc.rainbow", "1"); applyFlag(f0); render(); syncHeaderBar(); syncSharesBar(); });
          list.appendChild(row);
        });
      };
      buildList(""); panel.appendChild(list);
      search.addEventListener("input", function () { buildList(search.value); });
      var openPanel = function () {
        panel.style.display = ""; search.value = ""; buildList("");
        // Pinning the panel fixed at the trigger escapes the card's overflow clip, and capping the
        // list to the room below it keeps the whole country list scrollable.
        try {
          var r = trigger.getBoundingClientRect();
          panel.style.position = "fixed"; panel.style.left = Math.round(r.left) + "px"; panel.style.top = Math.round(r.bottom + 4) + "px"; panel.style.right = "auto"; panel.style.width = Math.round(r.width) + "px";
          list.style.maxHeight = Math.max(140, Math.min(300, window.innerHeight - r.bottom - 68)) + "px";
        } catch (e8) {}
        try { search.focus(); } catch (e9) {}
        var closer = function (e9) { if (!picker.contains(e9.target)) { panel.style.display = "none"; document.removeEventListener("click", closer, true); } };
        setTimeout(function () { document.addEventListener("click", closer, true); }, 0);   // removes itself, so it cannot leak across a render
      };
      var closePanel = function () { panel.style.display = "none"; try { trigger.focus(); } catch (e9) {} };
      trigger.addEventListener("click", function () { if (panel.style.display !== "none") panel.style.display = "none"; else openPanel(); });
      // The country picker is a closed field standing for one value, so it wheel-steps like the
      // other selection fields. It has no <select> behind it, so cc-theme.js's shared handler
      // cannot serve it and the step is spelled out here against the same list the panel uses,
      // clamped at both ends. The commit is the click path's, but the full render is debounced: it
      // rebuilds the page, which would tear the element out from under the cursor on every notch.
      var flagRenderT = null;
      trigger.addEventListener("wheel", function (e9) {
        if (e9.ctrlKey || e9.metaKey || e9.altKey) return;
        if (panel.style.display !== "none") return;                 // an open panel scrolls its own list
        var d9 = e9.deltaY || e9.deltaX; if (!d9) return;
        var list9 = window.CC_FLAGS, cur9 = get("cc.flag", ""), ix9 = -1;
        for (var j9 = 0; j9 < list9.length; j9++) if (list9[j9].code === cur9) { ix9 = j9; break; }
        var nx9 = ix9 < 0 ? (d9 > 0 ? 0 : list9.length - 1) : ix9 + (d9 > 0 ? 1 : -1);
        if (nx9 < 0 || nx9 >= list9.length) return;                 // clamped, so the page scrolls instead
        e9.preventDefault();
        set("cc.flagmode", "1"); set("cc.rainbow", "1"); applyFlag(list9[nx9]);
        renderTrigger();                                            // the field repaints as a pick would
        syncHeaderBar(); syncSharesBar();
        clearTimeout(flagRenderT); flagRenderT = setTimeout(function () { render(); }, 450);
      }, { passive: false });
      // Enter, space or the down arrow opens the panel; then the arrows move the highlight, Enter
      // picks and Escape closes. The search matches either name and the country code.
      trigger.addEventListener("keydown", function (e9) { if (e9.key === "Enter" || e9.key === " " || e9.key === "ArrowDown") { e9.preventDefault(); openPanel(); } });
      var moveSel = function (dir) { var items = list.querySelectorAll(".cc-flag-item"); if (!items.length) return; var cur = list.querySelector(".cc-flag-item.cc-sel"); var idx = cur ? Array.prototype.indexOf.call(items, cur) : -1; idx += dir; if (idx < 0) idx = 0; if (idx >= items.length) idx = items.length - 1; if (cur) cur.classList.remove("cc-sel"); items[idx].classList.add("cc-sel"); items[idx].scrollIntoView({ block: "nearest" }); };
      search.addEventListener("keydown", function (e9) { if (e9.key === "ArrowDown") { e9.preventDefault(); moveSel(1); } else if (e9.key === "ArrowUp") { e9.preventDefault(); moveSel(-1); } else if (e9.key === "Enter") { e9.preventDefault(); var sel = list.querySelector(".cc-flag-item.cc-sel") || list.querySelector(".cc-flag-item"); if (sel) sel.click(); } else if (e9.key === "Escape") { e9.preventDefault(); closePanel(); } });
      picker.appendChild(trigger); picker.appendChild(panel);
      fr.insertBefore(picker, fr.lastChild);   // the picker sits between the label and its toggle
      // the selected flag's colours, shown apart from the rainbow editor
      var f1 = curFlag();
      if (f1) {
        c1.appendChild(el("div", "cc-set-lbl", T("Flaggenfarben", "Flag colours")));
        var frow = el("div", "cc-set-swatches cc-fill");
        // The same count as the rainbow row, cycled from the flag's own colours, which matches the
        // palette the engine paints and keeps both rows the same shape.
        var fpal = []; for (var kf = 0; kf < RBDEF.length; kf++) fpal.push(f1.colors[kf % f1.colors.length]);
        fpal.forEach(function (c9) { var sw9 = el("span", "cc-set-sw"); sw9.style.background = c9; sw9.setAttribute("data-tip", c9); frow.appendChild(sw9); });
        var fReset = el("span", "cc-set-ibtn"); fReset.setAttribute("data-tip", T("Flagge zurücksetzen", "Reset flag"));
        var fRi = document.createElement("i"); fRi.className = "fa fa-undo"; fReset.appendChild(fRi);
        fReset.addEventListener("click", function () { del("cc.flag"); del("cc.flagpal"); set("cc.flagmode", "0"); set("cc.rainbow", "0"); render(); syncHeaderBar(); syncSharesBar(); });
        frow.appendChild(fReset);
        c1.appendChild(frow);
      }
    }
    // The badge shape options are ordered by rising roundness.
    c1.appendChild(segRow(T("Badge-Form", "Badge shape"), [["square", T("eckig", "square")], ["rounded", T("abgerundet", "rounded")], ["pill", "Pills"], ["circle", T("Kreise", "Circles")]], get("cc.badgeshape", "pill"), function (v) { set("cc.badgeshape", v); applyShape(); syncHeaderBar(); syncSharesBar(); }));
    // One global badge style: glass adds a sheen to every badge at once, flat is the solid look.
    c1.appendChild(segRow(T("Badge-Stil", "Badge style"), [["flat", "Flat"], ["glass", "Glass"]], get("cc.badgeglass", "0") === "1" ? "glass" : "flat", function (v) { set("cc.badgeglass", v === "glass" ? "1" : "0"); document.documentElement.classList.toggle("cc-badge-glass", v === "glass" && get("cc.theming", "1") !== "0"); syncHeaderBar(); syncSharesBar(); }));
    // The reactive toggle covers every colour mode: everything rests grey, colours on hover, and
    // the active item stays lit.
    var rmode = el("div", "cc-set-row cc-set-inline");
    var rmodeL = el("span", "cc-set-lblwrap");
    rmodeL.appendChild(el("span", null, T("Reaktiver Modus", "Reactive mode")));
    rmodeL.appendChild(infoIcon(T("An: alles ruht grau und färbt sich beim Überfahren, Aktives bleibt farbig. Gilt global für alle Farbmodi (Regenbogen, Flagge und Normal) und alle Bereiche, Logo-Hintergründe eingeschlossen.", "On: everything rests grey and colours on hover, and the active item stays coloured. Global across every colour mode (rainbow, flag and accent) and every area, logo backgrounds included.")));
    rmode.appendChild(rmodeL);
    rmode.appendChild(toggle(get("cc.rbmode", "all") === "active", function (v) { set("cc.rbmode", v ? "active" : "all"); paintSetTabs(); syncHeaderBar(); syncSharesBar(); }));
    c1.appendChild(rmode);
    var snR = el("div", "cc-set-row cc-set-inline");
    var snL = el("span", "cc-set-lblwrap");
    snL.appendChild(el("span", null, T("Zustandsanzeigen nativ färben", "Native state colours")));
    snL.appendChild(infoIcon(T("An: Auslastungsbalken und Status-Badges behalten ihre native Zustandsfarbe (grün, gelb, rot). Aus: sie werden in den aktuellen Farbmodus integriert. Zustands-Punkte bei Containern und Laufwerken sind immer nativ, denn bei ihnen ist die Farbe die einzige Information.", "On: usage bars and status badges keep their native state colour (green, amber, red). Off: they fold into the current colour mode. The state dots on containers and drives are always native, because for them the colour is the only information there is.")));
    snR.appendChild(snL);
    snR.appendChild(toggle(get("cc.statenative", "0") === "1", function (v) { set("cc.statenative", v ? "1" : "0"); syncHeaderBar(); syncSharesBar(); }));
    c1.appendChild(snR);
    c1.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
    var prev = el("div", "cc-set-prev");
    // Eight mixed badges, so the whole palette sweep is visible; paintPrev colours each by index.
    var pvName = el("span", "cc-b cc-b-lg", "nextcloud");
    var pvVal = el("span", "cc-b"); pvVal.appendChild(elk("CPU")); pvVal.appendChild(elv("2/8"));
    var pvVal2 = el("span", "cc-b"); pvVal2.appendChild(elk("RAM")); pvVal2.appendChild(elv("1.2G"));
    var pvName2 = el("span", "cc-b cc-b-lg", "plex");
    var pvVal3 = el("span", "cc-b"); pvVal3.appendChild(elk("IP")); pvVal3.appendChild(elv(".20.9"));
    var pvVal4 = el("span", "cc-b"); pvVal4.appendChild(elk("Port")); pvVal4.appendChild(elv("443"));
    var pvName3 = el("span", "cc-b cc-b-lg", "grafana");
    var pvTab = el("span", "cc-navtab cc-navtab-on", "Docker");
    [pvName, pvVal, pvVal2, pvName2, pvVal3, pvVal4, pvName3, pvTab].forEach(function (x9) { prev.appendChild(x9); });
    prev.id = "cc-set-prev"; c1.appendChild(prev);
    wrapMain.appendChild(c1);
    // Density and tile size are each one key every list reads, so they sit here with the other
    // global controls rather than being repeated per tab.
    if (themingCard) themingCard.appendChild(segRow(T("Dichte", "Density"), [["compact", T("Kompakt", "Compact")], ["normal", "Normal"], ["airy", T("Luftig", "Airy")]], density, function (v) { density = v; set("cc.density", v); }, T("Gilt global für alle Listen: Docker, Start, Freigaben und VMs.", "Applies globally to every list: Docker, Start, Shares and VMs."), true));
    if (themingCard) themingCard.appendChild(tileSizeRow());
    // The global logos card edits the shared icon keys every adopting tab resolves through eff().
    // It carries the same controls as a per-area card and the same preview: this is where the icon
    // treatment is decided, so it is the last card that should show no logo. Three sections, one
    // per area, each with that area's real icons.
    (function () {
      var cLI = card(T("Logos & Icons", "Logos & icons"), T("Globale Logo-/Icon-Farben. Tabs mit aktivem 'Globale Badge-Farbe übernehmen' folgen auch hier.", "Global logo/icon colours. Tabs adopting the global colour follow these too."));
      // the three previews at the bottom of this card, repainted by every control in it
      var gPrevs = [];
      function gpaint() {
        var acc9 = get("cc.accent", "#2f6feb");
        var strn = parseInt(get("cc.iconstrength", "100"), 10) || 100;
        // The preview does not simulate the rainbow rotation, so while adopting it approximates
        // the resolved background with the accent, as accurate as the rainbow-off case. The ink is
        // then the automatic contrast for that background rather than the accent hue itself, and
        // it is forced on, since while adopting it no longer depends on the tint's own switch.
        var adopt9 = get("cc.iconbgrainbow", "0") === "1";
        gPrevs.forEach(function (p9) { try { p9.set({ bg: get("cc.iconbg", "0") === "1", bgColor: adopt9 ? acc9 : get("cc.iconbgcolor", ""), tint: adopt9 ? true : gTintOnEff(), color: adopt9 ? idealText(acc9) : get("cc.iconcolor", ""), strength: strn, accent: acc9, size: "48px" }); } catch (e9) {} });
      }
      function gsync() { gpaint(); syncAllStyleCards(); syncHeaderBar(); syncSharesBar(); } // an adopting area card repaints with the new globals
      // An unset icontint means "on whenever a valid icon colour is set", which keeps the tint of
      // installs that predate the toggle.
      function gTintOnEff() { var v = get("cc.icontint", null); return v == null ? !!get("cc.iconcolor", "") : v === "1"; }
      var gLT = logoToggles(cLI, {
        getBg: function () { return get("cc.iconbg", "0") === "1"; },
        setBg: function (v) { set("cc.iconbg", v ? "1" : "0"); },
        getBgColor: function () { return get("cc.iconbgcolor", ""); },
        setBgColor: function (v) { set("cc.iconbgcolor", v); },
        getTint: gTintOnEff,
        setTint: function (v) { set("cc.icontint", v ? "1" : "0"); },
        getColor: function () { return get("cc.iconcolor", ""); },
        setColor: function (v) { set("cc.iconcolor", v); },
        getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
        setAdopt: function (v) { set("cc.iconbgrainbow", v ? "1" : "0"); },
        getAccent: function () { return get("cc.accent", "#2f6feb"); },
        onChange: gsync
      });
      gLT.strInput.value = String(parseInt(get("cc.iconstrength", "100"), 10) || 100);
      gLT.strInput.addEventListener("input", function () { set("cc.iconstrength", gLT.strInput.value); gsync(); });
      // ── Icon-Färbung (GLOBAL): how the two icon treatments are CHOSEN, as opposed to the
      // colour they use (that is the picker above). See cc-theme.js for the chain itself.
      // The default is "auto"; the other three are manual overrides and are respected even
      // where the automatic choice would have picked differently.
      cLI.appendChild(segRow(T("Icon-Färbung", "Icon colouring"),
        [["auto", T("Automatisch", "Automatic")], ["native", T("Natives Icon", "Native icon")], ["flat", T("Ink-Flatten", "Ink flatten")], ["tint", T("Luminanz-Tint", "Luminance tint")]],
        get("cc.iconmode", "auto"),
        function (v) { set("cc.iconmode", v); gsync(); },
        T("Ein Logo ist entweder eine einzelne durchgehende Form oder ein kleines mehrfarbiges Bild. Eine Form kann man komplett in deiner Farbe nachzeichnen und sie bleibt erkennbar; ein Bild würde dabei zum Farbklecks, weil Hintergrund und Motiv dieselbe Farbe bekämen. Darum zwei Behandlungen:\n\nAutomatisch (empfohlen): CannonadeCommand sieht sich jedes Logo an. Formen werden nachgezeichnet, für bekannte Programme wird dafür sogar ein echtes Marken-Logo geholt; Bilder werden nur eingefärbt.\nNatives Icon: nichts einfärben, jedes Logo bleibt wie geliefert.\nInk-Flatten: alles nachzeichnen, auch Bilder.\nLuminanz-Tint: alles nur einfärben, auch Formen.\n\nEinzelne Container, VMs und Plugins kannst du in ihrem eigenen Fenster abweichend einstellen; diese Einzelwahl gewinnt immer gegen die Einstellung hier.",
          "A logo is either one solid shape or a small multi-colour picture. A shape can be redrawn entirely in your colour and stays recognisable; a picture would turn into a blob, because its background and its mark would end up the same colour. Hence two treatments:\n\nAutomatic (recommended): CannonadeCommand looks at each logo. Shapes are redrawn, and for a well-known app a real brand logo is fetched to redraw; pictures are only tinted.\nNative icon: no colouring, every logo stays as shipped.\nInk flatten: redraw everything, pictures included.\nLuminance tint: only tint everything, shapes included.\n\nIndividual containers, VMs and plugins can be set differently in their own window; that per-item choice always wins over the setting here.")));
      // Three preview sections, each with that area's real icons, each running the same pipeline
      // the real tab runs, so the choice above is visible without leaving this tab.
      [
        ["docker", T("Docker-Container", "Docker containers")],
        ["vm", T("VMs", "VMs")],
        ["plugin", T("Plugins", "Plugins")]
      ].forEach(function (sec9) {
        cLI.appendChild(el("div", "cc-set-sublbl", sec9[1]));
        var p9 = logoPreview(sec9[0], "cc-set-gprev-" + sec9[0]);
        var empty9 = el("div", "cc-set-prev-empty", T("Keine Symbole gefunden.", "No icons found."));
        empty9.style.display = "none";
        cLI.appendChild(p9.el); cLI.appendChild(empty9);
        gPrevs.push(p9);
        var fill9 = function (list9) {
          (list9 || []).slice(0, 4).forEach(function (it9) { p9.add(it9.src, it9.name || ""); });
          if (!p9.count()) empty9.style.display = "";
          gpaint();
        };
        // One mechanism for all three: the same row-fragment endpoint that area's own page asks,
        // since the pages themselves only ever return an empty skeleton. An empty answer shows
        // the line above instead.
        rowIcons(sec9[0], 4).then(fill9);
      });
      gpaint();
      wrapMain.appendChild(cLI);
    })();
    // Docker is an area like the others: an adopt card and its own badges card at the top of its
    // tab. buildStyleCards writes the area's own accent key, which docker.js resolves through its
    // adopt-gated reader, so an install that never touches it follows the global colour.
    var cD = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cD.appendChild(styleToggle("cc.styledocker", null));
    wrap.appendChild(cD);
    buildStyleCards("ccd.", wrap, [], true);

    var c2 = card(T("Logos", "Logos"), T("Die Schalter aktivieren Hintergrund und Icons unabhängig voneinander, jeder hat seine eigene Farbe.", "The switches turn the background and the icons on independently, each with its own colour."));
    // As in the global card: an unset icontint means "on whenever a valid icon colour is set".
    // This Docker card edits the same global keys, not a scoped copy of them.
    function c2TintOnEff() { var v = get("cc.icontint", null); return v == null ? !!get("cc.iconcolor", "") : v === "1"; }
    function c2OnChange() {
      var on = get("cc.iconbg", "0") === "1";
      c2.classList.toggle("cc-bg-mode", on);
      tprevWrap.classList.toggle("cc-prev-bg", on);
      try { tintPrev(); } catch (e9) {}
      syncAllStyleCards(); // the global icon keys changed, so an adopting area card follows
    }
    var c2LT = logoToggles(c2, {
      getBg: function () { return get("cc.iconbg", "0") === "1"; },
      setBg: function (v) { set("cc.iconbg", v ? "1" : "0"); },
      getBgColor: function () { return get("cc.iconbgcolor", ""); },
      setBgColor: function (v) { set("cc.iconbgcolor", v); },
      getTint: c2TintOnEff,
      setTint: function (v) { set("cc.icontint", v ? "1" : "0"); },
      getColor: function () { return get("cc.iconcolor", ""); },
      setColor: function (v) { set("cc.iconcolor", v); },
      // These already read and write the global key, so hideAdoptRow is all it takes to keep this
      // card from showing a second copy of that switch.
      getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
      setAdopt: function (v) { set("cc.iconbgrainbow", v ? "1" : "0"); },
      getAccent: function () { return get("cc.accent", "#2f6feb"); },
      onChange: c2OnChange,
      hideAdoptRow: true
    });
    c2LT.strInput.value = String(iconstrength);
    c2LT.strInput.addEventListener("input", function () { iconstrength = parseInt(c2LT.strInput.value, 10); set("cc.iconstrength", c2LT.strInput.value); try { tintPrev(); } catch (e9) {} syncAllStyleCards(); });
    // The tile size is one global key, and its control lives once in the Theming card. This Docker
    // card keeps the preview, which sizePrev() resizes whenever that control changes.
    function tileSizeRow() {
      // the tip goes through `help`, so the icon lands inside the label as it does on every row
      return segRow(T("Kachelgröße", "Tile size"), [["s", T("Klein", "Small")], ["m", T("Mittel", "Medium")], ["l", T("Groß", "Large")]], get("cc.sgsize", "m"), function (v) { set("cc.sgsize", v); try { sizePrev(); } catch (e) {} }, T("Gilt global: dieselbe Größe steuert das Einstellungen- und Werkzeuge-Raster und die Docker- und Plugin-Logos.", "Global: the same size drives the Settings and Tools grid and the Docker and Plugin logos."));
    }
    c2.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
    var dockPrev = logoPreview("docker", "cc-set-dockprev");
    var tprevWrap = dockPrev.el;
    // the preview logos take the size the tile-size control selects, so a change shows at once
    function sizePrev() { tintPrev(); }
    // Up to four real container logos, from the Docker tab's own row fragment; the plugin's logo
    // is the fallback when the tab has nothing to show. The name rides along, since the pipeline
    // needs it to look a glyph up and to honour a per-container pin.
    rowIcons("docker", 4).then(function (l9) {
      (l9 || []).forEach(function (it9) { dockPrev.add(it9.src, it9.name || ""); });
      if (!dockPrev.count()) dockPrev.add("/plugins/cannonadecommand/images/cannonadecommand.png", "");
      tintPrev();
    }).catch(function () { dockPrev.add("/plugins/cannonadecommand/images/cannonadecommand.png", ""); tintPrev(); });
    function tintPrev() {
      var acc9 = get("cc.accent", "#2f6feb");
      // While adopting, the accent approximates the resolved background, as in gpaint() above, and
      // the ink is its automatic contrast, forced on whatever the tint's own switch says.
      var adopt9 = get("cc.iconbgrainbow", "0") === "1";
      dockPrev.set({ bg: get("cc.iconbg", "0") === "1", bgColor: adopt9 ? acc9 : get("cc.iconbgcolor", ""), tint: adopt9 ? true : c2TintOnEff(), color: adopt9 ? idealText(acc9) : get("cc.iconcolor", ""), strength: parseInt(get("cc.iconstrength", "100"), 10) || 100, accent: acc9 });
    }
    c2.appendChild(tprevWrap); tintPrev(); c2OnChange(); sizePrev();   // the preview is the card's last block, sized to the tile-size control
    wrap.appendChild(c2);

    var c3 = card(T("Spalten / Badges je Ansicht", "Columns / badges per view"), T("Welche Badges in der einfachen und in der Advanced-Ansicht erscheinen.", "Which badges appear in the Simple and the Advanced view."));
    var tbl = el("table", "cc-set-tbl");
    var thr = el("tr"); thr.appendChild(el("th")); thr.appendChild(thc(T("Einfach", "Simple"))); thr.appendChild(thc(T("Advanced", "Advanced"))); tbl.appendChild(thr);
    COLS.forEach(function (c, i) {
      var tr = el("tr"); tr.appendChild(el("td", "cc-set-cname", c.label));
      tr.appendChild(chkCell(c.key, "s", RB[i])); tr.appendChild(chkCell(c.key, "a", RB[i])); tbl.appendChild(tr);
    });
    c3.appendChild(tbl);
    wrap.appendChild(c3);

    var c4 = card(T("Ansicht", "View"), null);
    // The folder view is always offered here, unlike the Docker tab's own gear menu, which hides
    // it until the organizer has folders: the tab falls back to an ungrouped grid when it has
    // none, so picking it as a default preference shows a plain grid rather than anything broken.
    c4.appendChild(segRow(T("Standard-Ansicht", "Default view"), [["list", T("Liste", "List")], ["grid", T("Raster", "Grid")], ["folder", T("Ordner", "Folder")]], view, function (v) { view = v; set("cc.view", v); syncViewModeServer(v); }));
    function applyShape() { var m9 = { pill: "999px", rounded: "6px", square: "0px", circle: "999px" }; var sh9 = get("cc.badgeshape", "pill"); var r9 = m9[sh9] || "999px"; root.style.setProperty("--cc-b-radius", r9); document.documentElement.style.setProperty("--cc-b-radius", r9); document.documentElement.classList.toggle("cc-shape-circle", sh9 === "circle"); var d9 = { pill: "50%", rounded: "3px", square: "0px", circle: "50%" }[sh9] || "50%"; document.documentElement.style.setProperty("--cc-dot-r", d9); /* the preset swatches follow the badge shape too */ }
    wrap.appendChild(c4);
    // The badge shape is a single global control in the Badges card; this call is what sets the
    // radius on this page's first render.
    applyShape();

    // Notifications are engine-side and saved to the flash.
    var c5 = card(T("Benachrichtigungen", "Notifications"), T("Warnungen bei Watchdog-Neustarts, fehlgeschlagenen Starts und Zeitplan-Fehlern.", "Alerts on watchdog restarts, failed starts and schedule errors."));
    c5.appendChild(toggleRow(T("Unraid-Benachrichtigungen", "Unraid notifications"), notify.unraid, function (v) { notify.unraid = v; notifyDirty = true; }));
    var wrow = el("div", "cc-set-row"); wrow.appendChild(el("span", "cc-set-rl", T("Webhook-URL", "Webhook URL")));
    var win = el("input", "cc-set-txt"); win.type = "url"; win.placeholder = "https://…"; win.value = notify.webhook || "";
    win.addEventListener("input", function () { notify.webhook = win.value.trim(); notifyDirty = true; });
    wrow.appendChild(win); c5.appendChild(wrow);
    // Save stays disabled until the config has been read once, so a save never lands on top of a
    // config this page has not seen, and no initial read is left in flight to race it back.
    var save5 = el("span", "cc-btn cc-btn-primary cc-set-save" + (configLoaded ? "" : " cc-set-disabled"), configLoaded ? T("Speichern", "Save") : T("lädt…", "loading…"));
    save5.addEventListener("click", function () { if (configLoaded && !save5.classList.contains("cc-set-disabled")) saveNotify(save5); }); c5.appendChild(save5);
    wrap.appendChild(c5);

    // the engine's last CPU and RAM limit operations, with the values it verified afterwards
    var cd = card(T("Diagnose: CPU/RAM-Limits", "Diagnostics: CPU/RAM limits"), T("Die letzten Limit-Änderungen mit Docker-Ergebnis und verifizierten Werten danach.", "The most recent limit changes with docker's result and the verified values after."));
    var diag = el("div", "cc-set-diag"); diag.textContent = "…"; cd.appendChild(diag); wrap.appendChild(cd);
    api("GET", "limitlog").then(function (ops) {
      diag.textContent = "";
      if (!ops || !ops.length) { diag.textContent = T("Noch keine Limit-Änderung seit dem Daemon-Start.", "No limit change since the daemon started."); return; }
      ops.forEach(function (o) {
        var row = el("div", "cc-set-diag-row" + (o.result === "ok" ? "" : " cc-set-diag-bad"));
        row.textContent = o.time + "  " + o.name + "  [" + o.req + "]  → " + o.result + (o.after ? "  · " + T("danach", "after") + ": " + o.after : "");
        diag.appendChild(row);
      });
    }).catch(function (e) { diag.textContent = T("Diagnose nicht verfügbar: ", "Diagnostics unavailable: ") + e.message; });

    var c6 = card(T("Bandbreite", "Bandwidth"), T("Schnittstelle im Container, auf der die Limits gesetzt werden. Leer heißt automatisch, also die Default-Route des Containers, und ist die Empfehlung. Pro-Container-Limits stellst du im Docker-Tab ein.", "The interface inside the container the limits are applied to. Blank means automatic, the container's default route, which is the recommendation. Per-container limits are set in the Docker tab."));
    var ifrow = el("div", "cc-set-row"); ifrow.appendChild(el("span", "cc-set-rl", T("Schnittstelle", "Interface")));
    var ifin = el("input", "cc-set-txt"); ifin.type = "text"; ifin.placeholder = T("automatisch", "automatic"); ifin.value = shapeIface; ifin.maxLength = 15; ifin.spellcheck = false; ifin.setAttribute("list", "cc-iface-list");
    var dl = el("datalist"); dl.id = "cc-iface-list"; ["eth0", "eth1", "eth2"].forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
    ifin.addEventListener("input", function () { shapeIface = ifin.value.trim(); shapeDirty = true; });
    ifrow.appendChild(ifin); ifrow.appendChild(dl); c6.appendChild(ifrow);
    var save6 = el("span", "cc-btn cc-btn-primary cc-set-save" + (configLoaded ? "" : " cc-set-disabled"), configLoaded ? T("Speichern", "Save") : T("lädt…", "loading…"));
    save6.addEventListener("click", function () { if (configLoaded && !save6.classList.contains("cc-set-disabled")) saveShape(save6); }); c6.appendChild(save6);
    wrap.appendChild(c6);

    // A browser fires no storage event in the document that wrote the key, so the header and the
    // shares bar are pushed their new state directly on this page.
    function syncHeaderBar() { try { if (typeof window.ccHeaderApply === "function") window.ccHeaderApply(); } catch (e) {} }
    function syncSharesBar() { try { if (typeof window.ccSharesApply === "function") window.ccSharesApply(); } catch (e) {} }
    // each adopt key's own key prefix, for seeding that area's accent when adopt goes off
    var ADOPT_PREF = { "cc.styleheader": "cch.", "cc.styleshares": "ccsh.", "cc.styledocker": "ccd.", "cc.styleplugin": "ccp.", "cc.stylevms": "ccv.", "cc.stylesettings": "ccs.", "cc.stylefavorites": "ccf.", "cc.stylemain": "ccm." };
    function styleToggle(key, onChange, lbl) {
      var row = el("div", "cc-set-row cc-set-inline");
      row.appendChild(el("span", null, lbl || T("Globale Badge-Farbe übernehmen", "Adopt the global badge colour")));
      var tg = toggle(localStorage.getItem(key) !== "0", function (v) {
        localStorage.setItem(key, v ? "1" : "0");
        // Turning adopt off in an area that never had a colour of its own seeds it from the
        // current global accent, so the colour does not jump to the built-in default and the
        // area's picker shows what is actually in effect.
        var p = ADOPT_PREF[key];
        if (!v && p && localStorage.getItem(p + "accent") == null) set(p + "accent", get("cc.accent", "#2f6feb"));
        if (styleCardSync[key]) styleCardSync[key]();   // the picker and preview jump to the now effective colour
        if (onChange) onChange(); syncHeaderBar(); syncSharesBar();
      });
      adoptToggles[key] = tg; row.appendChild(tg);
      return row;
    }
    // The tabbed-view row reads inverted to its storage: on means the native Unraid sub-tabs,
    // which is the default, and off means the sub-tabs stacked as CC sections. Only an area that
    // has sub-tabs gets one.
    function tabviewRow(area, applyFn) {
      var row = el("div", "cc-set-row cc-set-inline");
      var lw = el("span", "cc-set-lblwrap");
      lw.appendChild(el("span", null, T("Tabansicht", "Tabbed view")));
      lw.appendChild(infoIcon(T("Aus: die Unterreiter dieses Tabs werden als CannonadeCommand-Abschnitte untereinander gestapelt. Unraids globale Tabansicht ist der Master: steht sie auf „Ohne Tabs“, rendert Unraid überall Abschnitte und dieser Schalter wirkt nicht.", "Off: this tab's sub-tabs stack as CannonadeCommand sections. Unraid's own tabbed view is the master: set to non-tabbed, Unraid renders sections everywhere and this switch has no effect.")));
      row.appendChild(lw);
      row.appendChild(toggle(get("cc.sections." + area, "0") === "0", function (v) { set("cc.sections." + area, v ? "0" : "1"); if (applyFn) applyFn(); }));
      return row;
    }
    var cP = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cP.appendChild(styleToggle("cc.styleplugin", null));
    cP.appendChild(tabviewRow("plugins", syncPluginsBar));
    // Every area carries the same style cards on its own key prefix, which apply while its adopt
    // toggle is off.
    function buildStyleCards(P, into, samples, noLogos) {
      // Picking a colour in an area's card means that area uses its own style, so its adopt
      // toggle goes off; otherwise the read side keeps resolving the global accent and the pick
      // has no visible effect. Turning adopt back on follows the global colour again.
      var ADOPT = { "ccd.": "cc.styledocker", "ccp.": "cc.styleplugin", "ccv.": "cc.stylevms", "cch.": "cc.styleheader", "ccs.": "cc.stylesettings", "ccsh.": "cc.styleshares", "ccf.": "cc.stylefavorites", "ccm.": "cc.stylemain" };
      var adoptKey = ADOPT[P];
      // The card always shows the effective colour: the global accent while adopt is on, the
      // area's own while it is off, so the fields jump the moment it is flipped.
      function effAcc() { return (adoptKey && localStorage.getItem(adoptKey) !== "0") ? get("cc.accent", "#2f6feb") : get(P + "accent", "#2f6feb"); }
      var acc = effAcc(), istr = parseInt(get(P + "iconstrength", "100"), 10) || 100;
      function useOwn() {
        if (adoptKey && localStorage.getItem(adoptKey) !== "0") {
          localStorage.setItem(adoptKey, "0");
          if (adoptToggles[adoptKey] && adoptToggles[adoptKey]._setOn) adoptToggles[adoptKey]._setOn(false);
        }
        syncHeaderBar(); syncSharesBar();
      }
      var cA = card(T("Badges", "Badges"), T("Akzentfarbe und Farbmodus der Badges.", "Accent colour and colour mode of the badges."));
      var pr = el("div", "cc-set-pickrow");
      var hx = el("input", "cc-set-hexin"); hx.type = "text"; hx.value = acc; hx.placeholder = "#2f6feb"; hx.maxLength = 7; hx.spellcheck = false;
      var pk = inlinePicker(/^#[0-9a-f]{6}$/i.test(acc) ? acc : "#2f6feb", function (v) { acc = v; hx.value = v; set(P + "accent", v); useOwn(); paintPv(); });
      hx.addEventListener("input", function () { var v = normHex(hx.value); if (v) { acc = v; pk._set(v); set(P + "accent", v); useOwn(); paintPv(); } });
      pr.appendChild(pk); cA.appendChild(pr);
      var sr = el("div", "cc-set-swatches cc-fill");
      PRESETS.slice(0, 7).forEach(function (c) {   // seven presets plus the two-cell hex field make nine
        var sw = el("span", "cc-set-sw"); sw.setAttribute("data-tip", c); sw.style.background = c; sw.dataset.c = c;   // the one attribute swMarkRow reads
        sw.addEventListener("click", function () { acc = c; pk._set(c); hx.value = c; set(P + "accent", c); useOwn(); paintPv(); });
        sr.appendChild(sw);
      });
      sr.appendChild(hx); cA.appendChild(sr);
      // Rainbow is a global mode with one switch and one palette in the Badges card, so an area
      // has no rainbow controls of its own, only the accent above. The preview still reflects it.
      var RB2 = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];   // the shared palette, so every preview matches the live UI
      function palG() { try { if (get("cc.flagmode", "0") === "1") { var fj = JSON.parse(get("cc.flagpal", "null")); if (fj && fj.length) return fj; } var pj = JSON.parse(get("cc.rbpal", "null")); if (pj && pj.length) return pj; } catch (e2) {} return RB2; }
      // The header and shares areas restyle Unraid tab bars, so their previews are tab pills, one
      // of them active; every other area previews the Docker badges.
      var isTabs = P === "cch." || P === "ccsh.";
      cA.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
      var pv = el("div", "cc-set-prev" + (isTabs ? " cc-set-navprev" : ""));
      var activeIx = P === "ccsh." ? 0 : 2; // one active tab, like the real bar
      var pvBadges;
      if (isTabs) {
        var TABS = P === "ccsh."
          ? [T("Benutzer-Freigaben", "User Shares"), T("Laufwerks-Freigaben", "Disk Shares")]
          : [T("Übersicht", "Main"), "Shares", "Docker", "VMs", T("Einstellungen", "Settings"), "Tools"];
        pvBadges = TABS.map(function (nm9, i9) {
          var t9 = el("span", "cc-navtab" + (i9 === activeIx ? " cc-navtab-on" : ""), nm9); pv.appendChild(t9); return t9;
        });
      } else {
        // The same eight samples the global Badges card shows, in the same order and painted by the
        // same rule, so the two previews agree. Three would cut a palette of eight off after three
        // hues and leave two of the badge tiers the tab paints out of the preview entirely.
        var mkName = function (t9) { return el("span", "cc-b cc-b-lg", t9); };
        var mkVal = function (k9, v9) { var b8 = el("span", "cc-b"); b8.appendChild(elk(k9)); b8.appendChild(elv(v9)); return b8; };
        pvBadges = [
          mkName("nextcloud"), mkVal("CPU", "2/8"), mkVal("RAM", "1.2G"), mkName("plex"),
          mkVal("IP", ".20.9"), mkVal("Port", "443"), mkName("grafana"), el("span", "cc-navtab cc-navtab-on", "Docker")
        ];
        pvBadges.forEach(function (b9) { pv.appendChild(b9); });
      }
      function paintPv() {
        var rbOn9 = get("cc.rainbow", "0") === "1", p9 = palG();
        pvBadges.forEach(function (b9, i9) {
          if (rbOn9) {
            var cr = p9[i9 % p9.length];
            b9.style.setProperty("background", cr, "important"); b9.style.setProperty("color", idealText(cr), "important");
            return;
          }
          if (isTabs && i9 !== activeIx) { b9.style.removeProperty("background"); b9.style.removeProperty("color"); return; } // an idle tab keeps its grey pill
          b9.style.setProperty("background", acc, "important"); b9.style.setProperty("color", idealText(acc), "important");
        });
        swMarkRow(sr, acc);   // the preset row's tick follows the colour the preview shows
      }
      paintPv();
      cA.appendChild(pv);
      // An adopt flip or a global edit repaints this card with the effective colour, and the Logos
      // card below with the effective icon values. cBLT, applyBgClasses and tp are assigned further
      // down, and this refresher only ever runs once buildStyleCards has finished.
      if (adoptKey) styleCardSync[adoptKey] = function () {
        acc = effAcc();
        try { pk._set(/^#[0-9a-f]{6}$/i.test(acc) ? acc : "#2f6feb"); } catch (e9) {}
        hx.value = acc;
        paintPv();
        cBLT.sync();
        cBLT.strInput.value = String(effIconStrength());
        applyBgClasses(); tp();
      };
      into.appendChild(cA);
      var cB = card(T("Logos", "Logos"), T("Die Schalter aktivieren Hintergrund und Icons unabhängig voneinander, jeder hat seine eigene Farbe.", "The switches turn the background and the icons on independently, each with its own colour."));
      // ga() says whether this area adopts: with it on the card reads and previews the global icon
      // values, with it off the area's own. Every change here means the area uses its own style,
      // so the setters below always write the area's own key whatever ga() currently answers.
      function ga() { return !!adoptKey && localStorage.getItem(adoptKey) !== "0"; }
      function tintOnAt(prefix) { var v = get(prefix + "icontint", null); return v == null ? !!get(prefix + "iconcolor", "") : v === "1"; }
      function bgColorAt(prefix) {
        var c = get(prefix + "iconbgcolor", ""); if (/^#[0-9a-f]{6}$/i.test(c)) return c;
        var ic = get(prefix + "iconcolor", ""); if (/^#[0-9a-f]{6}$/i.test(ic)) return ic;
        return acc;
      }
      function effIconBg() { return (ga() ? get("cc.iconbg", "0") : get(P + "iconbg", P === "ccs." ? "1" : "0")) === "1"; }
      function effIconStrength() { return parseInt(ga() ? get("cc.iconstrength", "100") : get(P + "iconstrength", "100"), 10) || 100; }
      function applyBgClasses() { var on = effIconBg(); cB.classList.toggle("cc-bg-mode", on); tpw.classList.toggle("cc-prev-bg", on); }
      var cBLT = logoToggles(cB, {
        getBg: effIconBg,
        setBg: function (v) { set(P + "iconbg", v ? "1" : "0"); useOwn(); },
        getBgColor: function () { return ga() ? bgColorAt("cc.") : bgColorAt(P); },
        setBgColor: function (v) { set(P + "iconbgcolor", v); useOwn(); },
        getTint: function () { return ga() ? tintOnAt("cc.") : tintOnAt(P); },
        setTint: function (v) { set(P + "icontint", v ? "1" : "0"); useOwn(); },
        getColor: function () { return ga() ? get("cc.iconcolor", "") : get(P + "iconcolor", ""); },
        setColor: function (v) { set(P + "iconcolor", v); useOwn(); },
        // Adopting the rainbow is a global decision, flipped only on the global logos card, so
        // this answers the global key whatever ga() says: an area's own icon colours and whether
        // they follow the rainbow are separate questions. setAdopt is never called while
        // hideAdoptRow is set, and stays as a no-op in case a caller shows the row again.
        getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
        setAdopt: function () {},
        getAccent: function () { return acc; },
        onChange: function () { applyBgClasses(); try { tp(); } catch (e9) {} },
        hideAdoptRow: true
      });
      cBLT.strInput.value = String(istr);
      cBLT.strInput.addEventListener("input", function () { set(P + "iconstrength", cBLT.strInput.value); useOwn(); try { tp(); } catch (e9) {} });
      cB.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
      // the pipeline scope this area's items live under, so a per-item pin shows up here too
      var PAREA = { "ccd.": "docker", "ccv.": "vm", "ccp.": "plugin" }[P];   // the areas whose rows carry real per-item logos
      var PSCOPE = PAREA || "docker";
      var pvl = logoPreview(PSCOPE, "cc-set-tint-" + P.replace(/[^a-z]/g, ""));
      var tpw = pvl.el;
      // A sample whose name starts with a font-icon prefix is a glyph, which logoPreview renders
      // as an <i> coloured through CSS; the Settings and Tools tiles pass those rather than
      // raster paths, which is why their sample list looks empty.
      var addSamples = function () { (samples || []).forEach(function (s9) { pvl.add(s9, ""); }); };
      // Docker, VMs and Plugins have real per-item logos, from the same row fragments the global
      // card uses, so the preview shows this box's own. The canned samples are the fallback for a
      // box with none of them, and could never be more than stand-ins anyway.
      if (PAREA && !noLogos) {
        rowIcons(PAREA, 4).then(function (l9) {
          (l9 || []).forEach(function (it9) { pvl.add(it9.src, it9.name || ""); });
          if (!pvl.count()) addSamples();
          tp();
        }).catch(function () { addSamples(); tp(); });
      } else {
        addSamples();
      }
      function tp() {
        var ga9 = ga();
        // While adopting, the effective accent approximates the resolved background and the ink is
        // its automatic contrast, as in the global card. It reads the global key, like getAdopt()
        // above, so the preview never disagrees with what that answers.
        var adopt9 = get("cc.iconbgrainbow", "0") === "1";
        pvl.set({
          bg: effIconBg(), bgColor: adopt9 ? acc : (ga9 ? get("cc.iconbgcolor", "") : get(P + "iconbgcolor", "")),
          tint: adopt9 ? true : (ga9 ? tintOnAt("cc.") : tintOnAt(P)), color: adopt9 ? idealText(acc) : (ga9 ? get("cc.iconcolor", "") : get(P + "iconcolor", "")),
          strength: effIconStrength(), accent: acc, size: "48px"
        });
      }
      cB.appendChild(tpw); tp(); applyBgClasses();
      // initial paint = the EFFECTIVE values (cA already initialises via effAcc(); run the
      // refresher once so cB starts on the global icon values while adopt is ON, own while OFF)
      if (adoptKey) { try { styleCardSync[adoptKey](); } catch (e9) {} }
      if (!noLogos) into.appendChild(cB); // header tab: badges only, no logo card
    }
    // the adopt "Stil" card is the FIRST card of every section (user call), then
    // the Badges/Logos cards. Same cards for the Kopfbereich (menu bar) as Plugins/VMs;
    // the Kopfbereich additionally carries the Fussleiste toggle + Status-Insel card.
    var cV = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cV.appendChild(styleToggle("cc.stylevms", null));
    cV.appendChild(tabviewRow("vms", syncVmsBar));
    var cH = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cH.appendChild(styleToggle("cc.styleheader", null));
    // The footer bar is hidden by default. header.js applies it, and it sits in the Theming card
    // rather than here: it is one global on/off for a page element, like density and tile size,
    // not part of the header area itself.
    if (themingCard) {
      var cHf = el("div", "cc-set-row cc-set-inline");
      var cHfL = el("span", "cc-set-lblwrap");
      cHfL.appendChild(el("span", null, T("Fußleiste ausblenden", "Hide footer bar")));
      cHfL.appendChild(infoIcon(T("Blendet die untere Statusleiste komplett aus.", "Hides the bottom status bar completely.")));
      cHf.appendChild(cHfL);
      cHf.appendChild(toggle(get("cc.footer", "1") !== "0", function (v) { set("cc.footer", v ? "1" : "0"); syncHeaderBar(); }));
      themingCard.appendChild(cHf);
    }
    var cSh = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cSh.appendChild(styleToggle("cc.styleshares", null));
    cSh.appendChild(tabviewRow("shares", syncSharesBar));
    var cSet = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cSet.appendChild(styleToggle("cc.stylesettings", null));
    // tile size of the /Settings + /Tools grid is the GLOBAL cc.sgsize control in Allgemein (no per-tab copy).
    var cFav = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cFav.appendChild(styleToggle("cc.stylefavorites", null));
    var cStart = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt.", "On: the global badge colour from General applies here too. Off: this section's own colour applies."));
    cStart.appendChild(styleToggle("cc.stylemain", null));
    cStart.appendChild(tabviewRow("main", syncSharesBar));
    wrapHeader.appendChild(cH); wrapShares.appendChild(cSh); wrapPlugin.appendChild(cP); wrapVms.appendChild(cV); wrapSettings.appendChild(cSet); wrapFavorites.appendChild(cFav); wrapStart.appendChild(cStart);
    // Unraid renders /Settings and /Tools with the identical tile grid, so both pages share one
    // flag; a per-tab copy of it would do nothing on one of them. This tab therefore carries the
    // same card and toggle wired to that same key, so either page can flip it.
    var cTools = card(T("Stil", "Style"), T("An: die globale Badge-Farbe aus Allgemein gilt auch hier. Aus: die eigene Farbe dieses Abschnitts gilt. Wirkt auf /Einstellungen und /Werkzeuge zugleich, da Unraid beide Seiten identisch rendert.", "On: the global badge colour from General applies here too. Off: this section's own colour applies. It affects /Settings and /Tools at once, since Unraid renders both pages identically."));
    cTools.appendChild(styleToggle("cc.stylesettings", null));
    wrapTools.appendChild(cTools);
    function syncPluginsBar() { try { if (typeof window.ccPluginsApply === "function") window.ccPluginsApply(); } catch (e) {} }
    function syncVmsBar() { try { if (typeof window.ccVmsApply === "function") window.ccVmsApply(); } catch (e) {} }
    buildStyleCards("cch.", wrapHeader, [], true);
    // Kopfbereich covers the main menu bar AND the top strip: the Status-Insel (top strip)
    // belongs to THIS area. header.js renders it and reads cc.island / cc.tempwarn live.
    (function () {
      var cI = card(T("Status-Insel", "Status island"), T("Die Status-Insel im oberen Streifen gehört zum Kopfbereich.", "The status island in the top strip belongs to the header area."));
      cI.appendChild(toggleRow(T("Status-Insel anzeigen", "Show status island"), get("cc.island", "1") !== "0", function (v) { set("cc.island", v ? "1" : "0"); syncHeaderBar(); }));
      // one checkbox per chip; header.js renders them in a fixed order and reads the keys live
      cI.appendChild(el("div", "cc-set-lbl", T("Angezeigte Elemente", "Shown elements")));
      [["uptime", T("Betriebszeit", "Uptime")], ["os", T("Unraid-Edition", "Unraid edition")], ["version", T("Unraid-Version", "Unraid version")], ["array", T("Array-Zustand", "Array state")], ["fill", T("Array-Füllstand", "Array usage")], ["ram", T("RAM-Auslastung", "RAM usage")], ["cpu", T("CPU-Last", "CPU load")], ["containers", T("Laufende Container", "Running containers")], ["net", T("Netzwerk-Traffic", "Network traffic")], ["temps", T("Temperaturen", "Temperatures")]].forEach(function (it) {
        cI.appendChild(toggleRow(it[1], get("cc.isl." + it[0], "1") !== "0", function (v) { set("cc.isl." + it[0], v ? "1" : "0"); syncHeaderBar(); }));
      });
      cI.appendChild(segRow(T("Temperatur-Warnschwelle", "Temperature warning threshold"), [["50", "50 °C"], ["60", "60 °C"], ["70", "70 °C"]], get("cc.tempwarn", "60"), function (v) { set("cc.tempwarn", v); syncHeaderBar(); }));
      wrapHeader.appendChild(cI);
    })();
    // The main-tab icons are markup CC inserts rather than a native element, so they get an on/off
    // of their own. header.js reads the key live and both inserts and removes them on a flip;
    // nothing else clears an icon already in the DOM.
    (function () {
      var cT = card(T("Haupttabs", "Main tabs"), T("Icon (Tabler, MIT-lizenziert) und/oder Text vor jedem Haupttab-Namen (Übersicht, Docker, VMs, …). Beides aus ist möglich, zeigt dann eine leere Pille.", "Icon (Tabler, MIT licensed) and/or text for every main tab label (Dashboard, Docker, VMs, …). Turning both off is possible and shows an empty pill."));
      cT.appendChild(toggleRow(T("Icons anzeigen", "Show icons"), get("cc.tabicons", "1") !== "0", function (v) { set("cc.tabicons", v ? "1" : "0"); try { window.ccTabIcons && window.ccTabIcons(); } catch (e) {} }));
      // an icon-only mode beside the icon switch, in the same card, since both fill the same pill
      cT.appendChild(toggleRow(T("Text anzeigen", "Show text"), get("cc.tabtext", "1") !== "0", function (v) { set("cc.tabtext", v ? "1" : "0"); try { window.ccTabIcons && window.ccTabIcons(); } catch (e) {} }));
      wrapHeader.appendChild(cT);
    })();
    // The server name's look. header.js reads the cc.brand.* keys live and inlines them, so the
    // real header is the preview. Every control is a dropdown, apart from the colour, which is a
    // picker like every other colour control here.
    (function () {
      var cB = card(T("Servername", "Server name"), T("Aussehen des Servernamens oben links. Änderungen erscheinen live im Kopfbereich.", "Look of the server name at the top left. Changes appear live in the header."));
      var SZ = ["16", "18", "20", "22", "24", "26", "28", "30", "32", "36", "40", "44", "48", "56", "64"].map(function (s) { return [s, s + " px"]; });
      cB.appendChild(dropRow(T("Größe", "Size"), SZ, get("cc.brand.size", "30"), function (v) { set("cc.brand.size", v); syncHeaderBar(); }));
      cB.appendChild(dropRow(T("Stärke", "Weight"), [["300", T("Dünn", "Thin")], ["400", "Normal"], ["500", "Medium"], ["650", T("Halbfett", "Semibold")], ["800", T("Fett", "Bold")]], get("cc.brand.weight", "650"), function (v) { set("cc.brand.weight", v); syncHeaderBar(); }));
      cB.appendChild(dropRow(T("Kursiv", "Italic"), [["0", T("Normal", "Normal")], ["1", T("Kursiv", "Italic")]], get("cc.brand.italic", "0"), function (v) { set("cc.brand.italic", v); syncHeaderBar(); }));
      // System faces, which render where the client has them. The Google families below are
      // downloaded, so they render anywhere.
      var SYS = [
        ['Arial,Helvetica,sans-serif', "Arial"],
        ['"Arial Black",Gadget,sans-serif', "Arial Black"],
        ['Bahnschrift,"DIN",sans-serif', "Bahnschrift"],
        ['Baskerville,"Baskerville Old Face",serif', "Baskerville"],
        ['"Bodoni MT","Didot",serif', "Bodoni"],
        ['"Book Antiqua","Palatino Linotype",serif', "Book Antiqua"],
        ['Calibri,"Segoe UI",sans-serif', "Calibri"],
        ['Cambria,Georgia,serif', "Cambria"],
        ['Candara,"Segoe UI",sans-serif', "Candara"],
        ['"Cascadia Code","Cascadia Mono",Consolas,monospace', "Cascadia"],
        ['"Century Gothic","Apple Gothic",sans-serif', "Century Gothic"],
        ['Consolas,"Lucida Console",monospace', "Consolas"],
        ['Constantia,Georgia,serif', "Constantia"],
        ['Corbel,"Segoe UI",sans-serif', "Corbel"],
        ['"Courier New",Courier,monospace', "Courier New"],
        ['Didot,"Bodoni MT",serif', "Didot"],
        ['"Franklin Gothic Medium","Arial Narrow",sans-serif', "Franklin Gothic"],
        ['Futura,"Trebuchet MS",sans-serif', "Futura"],
        ['Garamond,"Times New Roman",serif', "Garamond"],
        ['Geneva,Verdana,sans-serif', "Geneva"],
        ['Georgia,"Times New Roman",serif', "Georgia"],
        ['"Gill Sans","Gill Sans MT",sans-serif', "Gill Sans"],
        ['"Helvetica Neue",Helvetica,Arial,sans-serif', "Helvetica Neue"],
        ['"Hoefler Text",Georgia,serif', "Hoefler Text"],
        ['Impact,Charcoal,sans-serif', "Impact"],
        ['"Lucida Console",Monaco,monospace', "Lucida Console"],
        ['Menlo,Monaco,monospace', "Menlo"],
        ['Monaco,"Lucida Console",monospace', "Monaco"],
        ['Optima,Segoe,sans-serif', "Optima"],
        ['"Palatino Linotype","Book Antiqua",Palatino,serif', "Palatino"],
        ['Perpetua,Georgia,serif', "Perpetua"],
        ['"Segoe UI",system-ui,sans-serif', "Segoe UI"],
        ['Tahoma,Geneva,sans-serif', "Tahoma"],
        ['"Times New Roman",Times,serif', "Times New Roman"],
        ['"Trebuchet MS",Helvetica,sans-serif', "Trebuchet MS"],
        ['Verdana,Geneva,sans-serif', "Verdana"]
      ];
      var GF = (window.CCTheme && window.CCTheme.gfonts) ? window.CCTheme.gfonts : [];
      var rest = SYS.slice();
      GF.forEach(function (gf) { var val = '"' + gf[0] + '",' + gf[1]; rest.push([val, gf[0], val]); }); // Google faces (always render)
      rest.sort(function (a, b) { return a[1].localeCompare(b[1]); });   // the WHOLE list alphabetical (user)
      var FONTS = [["", T("Standard", "Default")], ['system-ui,-apple-system,"Segoe UI",sans-serif', "System"]]
        .concat(rest).map(function (f) { return [f[0], f[1], f[2] || f[0]]; }); // o[2] = self-preview face
      // load the Google faces so their dropdown previews (and any chosen one on this page) actually render
      try { if (window.CCTheme && window.CCTheme.loadGFonts) window.CCTheme.loadGFonts(GF.map(function (gf) { return gf[0]; })); } catch (e) {}
      cB.appendChild(dropRow(T("Schriftart", "Font"), FONTS, get("cc.brand.font", ""), function (v) { set("cc.brand.font", v); syncHeaderBar(); }));
      // colour picker + hex (empty = default light)
      var col = get("cc.brand.color", "");
      cB.appendChild(el("div", "cc-set-lbl", T("Farbe", "Colour")));
      var pr = el("div", "cc-set-pickrow");
      var hx = el("input", "cc-set-hexin"); hx.type = "text"; hx.value = col || ""; hx.placeholder = "#f4f4f4"; hx.maxLength = 7; hx.spellcheck = false;
      var pk = inlinePicker(/^#[0-9a-f]{6}$/i.test(col) ? col : "#f4f4f4", function (v) { hx.value = v; set("cc.brand.color", v); syncHeaderBar(); });
      hx.addEventListener("input", function () { var v = normHex(hx.value); if (v) { pk._set(v); set("cc.brand.color", v); syncHeaderBar(); } else if (!hx.value) { del("cc.brand.color"); syncHeaderBar(); } });
      pr.appendChild(pk); pr.appendChild(hx); cB.appendChild(pr);
      wrapHeader.appendChild(cB);
    })();
    // One show-and-hide per utility icon in the top right; on means visible. header.js stamps a
    // class per key, which the sheet hides the matching button on. The keys are the native button
    // classes.
    (function () {
      var cIc = card(T("Kopf-Icons", "Header icons"), T("Blende einzelne Icons oben rechts aus. Aus heißt versteckt.", "Hide individual icons in the top right. Off means hidden."));
      // The help icon is absent because its inline help moved into the bubbles, and the bell and
      // burger because they are integral: hiding one left its badge without an icon.
      [["lang", T("Sprache", "Language")], ["search", T("Suche", "Search")], ["logout", T("Abmelden", "Logout")], ["terminal", T("Terminal", "Terminal")], ["browse", T("Datei-Verwaltung", "File manager")], ["feedback", T("Feedback", "Feedback")], ["info", T("Info", "Info")], ["log", T("Protokoll", "Log")]].forEach(function (ic) {
        cIc.appendChild(toggleRow(ic[1], get("cc.hideicon." + ic[0], "0") === "0", function (v) { set("cc.hideicon." + ic[0], v ? "0" : "1"); syncHeaderBar(); }));
      });
      wrapHeader.appendChild(cIc);
    })();
    buildStyleCards("ccsh.", wrapShares, [], true); // the shares tab pills are glyphs, so badges only
    buildStyleCards("ccs.", wrapSettings, ["fa-cog", "fa-globe", "fa-star"], false); // the settings tiles are glyphs, so the preview shows sample ones
    buildStyleCards("ccp.", wrapPlugin, ["/plugins/dynamix.plugin.manager/images/dynamix.plugin.manager.png", "/plugins/dynamix.docker.manager/images/dynamix.docker.manager.png", "/plugins/cannonadecommand/images/cannonadecommand.png"]);
    buildStyleCards("ccv.", wrapVms, ["/plugins/dynamix.vm.manager/templates/images/linux.png", "/plugins/dynamix.vm.manager/templates/images/windows.png", "/plugins/cannonadecommand/images/cannonadecommand.png"]);
    buildStyleCards("ccf.", wrapFavorites, ["fa-star", "fa-heart", "fa-cog"], false); // glyph tiles again
    buildStyleCards("ccm.", wrapStart, [], true); // /Main has value and name badges but no per-row logos
    // Export and import of every cc-family setting, as a label row and two buttons in the Theming
    // card.
    (function () {
      var cX = themingCard;
      var lblw = el("div", "cc-set-lbl cc-set-lblwrap");
      lblw.appendChild(el("span", null, T("Sichern & Übertragen", "Backup & transfer")));
      lblw.appendChild(infoIcon(T("Exportiert alle CannonadeCommand-Einstellungen (cc.*-Schlüssel) als JSON-Datei. Der Import schreibt sie zurück und lädt die Seite neu.", "Exports every CannonadeCommand setting (cc.* keys) as a JSON file. Import writes them back and reloads the page.")));
      cX.appendChild(lblw);
      var note = el("div", "cc-set-xnote"); // an inline notice, since this page has no toast
      function say(msg, bad) { note.textContent = msg || ""; note.style.color = bad ? "#d9433f" : ""; }
      var ex = el("span", "cc-btn cc-set-xbtn", T("Exportieren", "Export"));
      ex.addEventListener("click", function () {
        try {
          // every cc-family key but cc.stateCache, the same set the engine mirrors
          var blob = new Blob([JSON.stringify(collectUISettings(), null, 2)], { type: "application/json" });
          var a = el("a"); a.href = URL.createObjectURL(blob); a.download = "cannonadecommand-settings.json";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          say("");
        } catch (e) { say(T("Export fehlgeschlagen: ", "Export failed: ") + ((e && e.message) || e), true); }
      });
      var im = el("span", "cc-btn cc-set-xbtn", T("Importieren", "Import"));
      var fin = el("input"); fin.type = "file"; fin.accept = ".json,application/json"; fin.style.display = "none";
      fin.addEventListener("change", function () {
        var f = fin.files && fin.files[0]; fin.value = ""; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          var o = null;
          try { o = JSON.parse(String(rd.result)); } catch (e) { say(T("Keine gültige JSON-Datei.", "Not a valid JSON file."), true); return; }
          // it has to be a flat object of cc-family string keys, and never cc.stateCache
          var ks = o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o) : [];
          var bad = ks.filter(function (k) { return !/^cc[a-z]*\./.test(k) || k === "cc.stateCache" || typeof o[k] !== "string"; });
          if (!ks.length || bad.length) { say(T("Ungültiges Format: erwartet wird ein flaches Objekt mit cc.*-Textwerten.", "Invalid format: expected a flat object of cc.* string values."), true); return; }
          var w = window.__ccLS || localStorage.setItem.bind(localStorage); // a raw write, bypassing the mirror debounce
          ks.forEach(function (k) { try { w(k, o[k]); } catch (e) {} });
          // The engine mirror is written before the reload: the reloaded page adopts ui_settings
          // from the engine, which would otherwise revert the import.
          withConfigLock(function () {
            return api("GET", "config").then(function (c) {
              if (!c || typeof c !== "object") return;
              var u = c.ui_settings || {};
              ks.forEach(function (k) { u[k] = o[k]; });
              c.ui_settings = u;
              return api("PUT", "config", c);
            });
          }).then(function () { location.reload(); }, function () { location.reload(); });
        };
        rd.onerror = function () { say(T("Datei konnte nicht gelesen werden.", "Could not read the file."), true); };
        rd.readAsText(f);
      });
      im.addEventListener("click", function () { fin.click(); });
      // A two-step reset that clears every cc.* key and the engine mirror, then reloads.
      var rs = el("span", "cc-btn cc-set-xbtn cc-set-danger", T("Alles zurücksetzen", "Reset all"));
      rs.addEventListener("click", function () {
        if (rs.getAttribute("data-armed") !== "1") { rs.setAttribute("data-armed", "1"); rs.textContent = T("Wirklich? Nochmal klicken", "Sure? Click again"); setTimeout(function () { rs.setAttribute("data-armed", "0"); rs.textContent = T("Alles zurücksetzen", "Reset all"); }, 3500); return; }
        try {
          var kill = []; for (var i9 = 0; i9 < localStorage.length; i9++) { var k9 = localStorage.key(i9); if (k9 && /^cc[a-z]*\./.test(k9) && k9 !== "cc.stateCache") kill.push(k9); }
          kill.forEach(function (k9) { try { localStorage.removeItem(k9); } catch (e9) {} });
          withConfigLock(function () { return api("GET", "config").then(function (c) { if (!c || typeof c !== "object") return; c.ui_settings = {}; return api("PUT", "config", c); }); })
            .then(function () { location.reload(); }, function () { location.reload(); });
        } catch (e) { say(T("Zurücksetzen fehlgeschlagen: ", "Reset failed: ") + ((e && e.message) || e), true); }
      });
      var brow = el("div", "cc-set-row"); brow.appendChild(ex); brow.appendChild(im); brow.appendChild(rs);
      cX.appendChild(brow); cX.appendChild(fin); cX.appendChild(note);
    })();
    refreshTabs();
    // cc.settab holds a section id; an older numeric index, or anything unknown, lands on the
    // first section.
    var st0 = localStorage.getItem("cc.settab"), ix0 = 0;
    SECS.forEach(function (sc9, j9) { if (sc9.id === st0) ix0 = j9; });
    showSec(ix0);
    // The search filters cards and rows across every tab; an empty query restores the tabbed view.
    (function () {
      function restore() {
        Array.prototype.forEach.call(root.querySelectorAll(".cc-set-card, .cc-set-row, .cc-set-lbl"), function (e9) { e9.style.removeProperty("display"); });
        tabRow.style.removeProperty("display");
        var st9 = localStorage.getItem("cc.settab"), ix9 = 0; SECS.forEach(function (sc9, j9) { if (sc9.id === st9) ix9 = j9; }); showSec(ix9);
      }
      function runFilter(q) {
        q = (q || "").trim().toLowerCase();
        if (!q) { restore(); return; }
        tabRow.style.setProperty("display", "none");
        SECS.forEach(function (sc9) { sc9.w.style.display = ""; });
        Array.prototype.forEach.call(root.querySelectorAll(".cc-set-card"), function (cardEl) {
          var h9 = cardEl.querySelector(".cc-set-h"); var titleHit = !!(h9 && (h9.textContent || "").toLowerCase().indexOf(q) >= 0), any = false;
          Array.prototype.forEach.call(cardEl.querySelectorAll(".cc-set-row, .cc-set-lbl"), function (r9) {
            var hit = titleHit || (r9.textContent || "").toLowerCase().indexOf(q) >= 0; r9.style.display = hit ? "" : "none"; if (hit) any = true;
          });
          cardEl.style.display = (titleHit || any) ? "" : "none";
        });
      }
      setSearch.addEventListener("input", function () { runFilter(setSearch.value); });
    })();
    paintPrev(); paintToggles(); paintSelects();
  }
  // #(user: "Alle drop down listen sind nicht in den farbmodi"): this page's own eleven .cc-dsel
  // dropdowns were built but never stamped, so in rainbow/flag mode every option showed the flat
  // accent. Same shared painter every area now uses (cc-theme.js), called from the same render
  // chokepoint as paintToggles() so the two can never drift apart.
  function paintSelects() { try { if (window.CCTheme && window.CCTheme.paintSelects) window.CCTheme.paintSelects(root || document); } catch (e) {} }
  function saveNotify(btn) {
    btn.textContent = T("Speichere…", "Saving…"); btn.classList.add("cc-set-disabled");
    function reset(txt) { btn.textContent = txt; setTimeout(function () { btn.textContent = T("Speichern", "Save"); btn.classList.remove("cc-set-disabled"); }, 1800); }
    // Reads the live config, changes only the notify block and writes it back, so the schedules
    // and watchdogs survive, including any set in the Docker tab since this page loaded. A failed
    // read aborts without writing, so an engine outage cannot wipe the automation.
    withConfigLock(function () {
      return api("GET", "config").then(function (c) {
        if (!c || typeof c !== "object") throw new Error("config unreadable");
        c.notify = { unraid: !!notify.unraid, webhook: notify.webhook || "" };
        return api("PUT", "config", c).then(function () { fullConfig = c; reset(T("Gespeichert ✓", "Saved ✓")); });
      });
    }).catch(function () { reset(T("Fehler, ist die Engine erreichbar?", "Error, is the engine reachable?")); });
  }
  // The same read, change and write for the shaping interface alone, so the notify block and
  // every container's own settings survive. A validation error from the engine is shown as such.
  function saveShape(btn) {
    btn.textContent = T("Speichere…", "Saving…"); btn.classList.add("cc-set-disabled");
    function reset(txt) { btn.textContent = txt; setTimeout(function () { btn.textContent = T("Speichern", "Save"); btn.classList.remove("cc-set-disabled"); }, 1800); }
    withConfigLock(function () {
      return api("GET", "config").then(function (c) {
        if (!c || typeof c !== "object") throw new Error("config unreadable");
        c.shape_iface = shapeIface || "";
        return api("PUT", "config", c).then(function () { fullConfig = c; reset(T("Gespeichert ✓", "Saved ✓")); });
      });
    }).catch(function (e) { reset(/bad shaping interface/.test(String(e && e.message)) ? T("Ungültige Schnittstelle", "Invalid interface") : T("Fehler, ist die Engine erreichbar?", "Error, is the engine reachable?")); });
  }
  // dark text on a light background and white on a dark one, by perceived luminance
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16); var L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  // The preview uses the real palette, so it matches what the Docker tab shows.
  function paintPrev() { var p = document.getElementById("cc-set-prev"); if (!p) return; var DEF = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"]; var pal = DEF; try { var fj = get("cc.flagmode", "0") === "1" ? JSON.parse(get("cc.flagpal", "null")) : null; var j = (fj && fj.length) ? fj : JSON.parse(get("cc.rbpal", "null")); if (j && j.length) pal = j; } catch (e) {} Array.prototype.slice.call(p.children).forEach(function (b, i) { var c = rainbow ? pal[i % pal.length] : accent; b.style.background = c; b.style.color = idealText(c); }); }
  // Every toggle on this page follows the colour engine. In rainbow mode each takes its own slot
  // from the shared seed, as the badges elsewhere do; otherwise the stamp is cleared and the
  // track's CSS falls back through the shared vars to the accent.
  function paintToggles() {
    if (!root) return;
    var rbC = (window.CCTheme && window.CCTheme.rbColor) || function (i, a) { return a; };
    var tgls = root.querySelectorAll(".cc-set-toggle");
    for (var i = 0; i < tgls.length; i++) {
      var t = tgls[i];
      if (rainbow) { var c = rbC(i, accent); t.style.setProperty("--cc-rb-c", c); t.style.setProperty("--cc-rb-ct", idealText(c)); }
      else { t.style.removeProperty("--cc-rb-c"); t.style.removeProperty("--cc-rb-ct"); }
    }
  }
  // live-highlight the preset swatch that matches the current accent (no re-render)
  function syncSwOn() { Array.prototype.slice.call(document.querySelectorAll("#cc-settings .cc-set-swrow-global")).forEach(function (row) { swMarkRow(row, accent); }); }
  function thc(t) { var e = el("th", null, t); return e; }
  // The badge-visibility matrix is the one place this page builds checkboxes. They use the shared
  // .cc-cb widget rather than tinting the OS box, and each cell carries its own badge's colour
  // with a matching contrast tick, since a white tick vanishes on a light one.
  function ccTick(c) { return "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3 8.5l3.2 3.2L13 5' fill='none' stroke='" + encodeURIComponent(c) + "' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")"; }
  function chkCell(key, v, color) { var td = el("td", "cc-set-chk"); var cb = el("input", "cc-cb"); cb.type = "checkbox"; cb.checked = !!(colview[key] && colview[key][v]); if (rainbow && color) { cb.style.setProperty("--cc-rb-c", color); cb.style.setProperty("--cc-rb-ct", idealText(color)); cb.style.setProperty("--cc-cb-tick", ccTick(idealText(color))); } else { cb.style.setProperty("--cc-cb-tick", ccTick(idealText(accent))); } cb.addEventListener("change", function () { var cur = colview[key] || { s: true, a: true }; colview[key] = { s: cur.s, a: cur.a }; colview[key][v] = cb.checked; set("cc.colview2", JSON.stringify(colview)); }); td.appendChild(cb); return td; }
  // Every option row is a dropdown, so segRow() delegates to dropRow() and its callers keep the
  // same options and handler; the select fires change, so the live effects still run. The old
  // layout argument is ignored, since a dropdown always puts its label on the left.
  function segRow(labelText, opts, cur, onChange, help) {
    return dropRow(labelText, opts, cur, onChange, help);
  }
  // A native select dressed as a CC control. An option is [value, label, face], and with a face it
  // renders in that font family, which the font picker uses.
  function dropRow(labelText, opts, cur, onChange, help) {
    var row = el("div", "cc-set-row"); var rl = el("span", "cc-set-rl", labelText); if (help) rl.appendChild(infoIcon(help)); row.appendChild(rl);
    var sel = el("select", "cc-set-sel");
    opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === cur) op.selected = true; if (o[2]) op.style.fontFamily = o[2]; sel.appendChild(op); });
    sel.addEventListener("change", function () { onChange(sel.value); });
    row.appendChild(ccDsel(sel)); return row;
  }
  // The dropdowns use the same widget the Docker network dropdown does, rather than a native
  // select, whose opened list the browser draws in its own colours. As in docker.js, the native
  // select stays hidden as the source of truth, so its change event still runs the live effects,
  // and a trigger with a floating panel of chips renders on top of it.
  function ccDsel(sel) {
    var wrap = el("span", "cc-dsel"); sel.style.display = "none"; wrap.appendChild(sel);
    var trig = el("span", "cc-dsel-trigger"); wrap.appendChild(trig);
    var panel = el("div", "cc-dsel-panel"); wrap.appendChild(panel);
    for (var k = 0; k < sel.options.length; k++) {
      var o = sel.options[k];
      var chip = el("div", "cc-dsel-opt", o.text); chip.setAttribute("data-i", k);
      if (o.style.fontFamily) chip.style.fontFamily = o.style.fontFamily;   // in the font picker a chip previews its own face
      chip.addEventListener("click", (function (idx) {
        return function (ev) {
          ev.stopPropagation();
          if (sel.options[idx].disabled) return;
          sel.selectedIndex = idx;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          ccDselSync(sel); wrap.classList.remove("cc-open");
        };
      })(k));
      panel.appendChild(chip);
    }
    trig.addEventListener("click", function (ev) {
      ev.stopPropagation();
      ccDselSync(sel);
      var open = wrap.classList.toggle("cc-open");
      if (open) { var o2 = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) o2[j].classList.remove("cc-open"); ccDselPosition(trig, panel); }
    });
    ccDselSync(sel); return wrap;
  }
  function ccDselSync(sel) {
    var w = sel.parentNode; if (!w || !w.classList || !w.classList.contains("cc-dsel")) return;
    var t2 = w.querySelector(".cc-dsel-trigger"), c = w.querySelectorAll(".cc-dsel-opt");
    var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
    if (t2 && t2.textContent !== label) t2.textContent = label;   // written only on a change, so nothing churns
    for (var k = 0; k < c.length; k++) { var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue; c[k].classList.toggle("is-selected", o.selected); c[k].classList.toggle("is-disabled", !!o.disabled); }
  }
  // The wheel handler for a closed field lives in cc-theme.js; this page builds its own widgets,
  // so it hands over its own repaint. docker.js registers the same shape for its copy, the two
  // never load on one page, and each sync is a no-op on a wrapper that is not its own.
  try { if (window.CCTheme && window.CCTheme.registerSelectSync) window.CCTheme.registerSelectSync(function (sel, wrap) { if (!wrap || !wrap.classList || !wrap.classList.contains("cc-dsel")) return false; ccDselSync(sel); return true; }); } catch (e) {}
  // The panel is fixed on open, so the page's overflow cannot clip a long list, and it flips up
  // where there is more room above. No transform-ancestor maths, since this page has no dialog.
  function ccDselPosition(trig, panel) {
    try {
      var r = trig.getBoundingClientRect(), gap = 4, edge = 14;
      var below = window.innerHeight - r.bottom - edge, above = r.top - edge;
      panel.style.position = "fixed"; panel.style.boxSizing = "border-box";
      panel.style.left = Math.round(r.left) + "px"; panel.style.minWidth = Math.round(r.width) + "px"; panel.style.maxWidth = "min(92vw, 420px)";
      if (below >= 200 || below >= above) { panel.style.top = Math.round(r.bottom + gap) + "px"; panel.style.bottom = "auto"; panel.style.maxHeight = Math.max(140, below - gap) + "px"; }
      else { panel.style.bottom = Math.round(window.innerHeight - r.top + gap) + "px"; panel.style.top = "auto"; panel.style.maxHeight = Math.max(140, above - gap) + "px"; }
    } catch (e) {}
  }
  if (!window.__ccSetDsel) {   // one document-level close handler for the page's lifetime
    window.__ccSetDsel = true;
    document.addEventListener("click", function () { var o = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); });
    window.addEventListener("scroll", function (e) { var tgt = e && e.target; if (tgt && tgt.closest && tgt.closest(".cc-dsel-panel")) return; var o = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); }, true);
  }
  // Indents the whole panel, hero, tab strip and cards alike, so it starts at the first main-menu
  // tab; header.js stamps the offset. Padding the root is safe to repeat, since the root's border
  // edge does not move with its own padding.
  function alignSetTabs() {
    try {
      var al = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cc-align-left")) || 15;
      var rr = root.getBoundingClientRect();
      var need = al - rr.left;
      if (need > 0 && need < 60) root.style.paddingLeft = need + "px"; else root.style.paddingLeft = "";
      // Unraid's #displaybox is a few pixels wider than the viewport, so the panel and the search
      // icon pinned to its right would spill past the edge. The right is padded to mirror the
      // left inset, which brings both back inside.
      var padR = Math.round(rr.right - (document.documentElement.clientWidth - al));
      if (padR > 0 && padR < 80) root.style.paddingRight = padR + "px"; else root.style.paddingRight = "";
    } catch (e) {}
  }
  var alignT = null; // one debounced resize listener for the page's lifetime
  window.addEventListener("resize", function () { clearTimeout(alignT); alignT = setTimeout(alignSetTabs, 150); });

  // The sub-tabs re-sort when the main menu order changes, whether by a drag or by an auto-mount.
  // A menu mutation re-runs render(), which re-reads the live order and rebuilds the strip while
  // cc.settab preserves the active tab. Gated on the order string itself, so an unrelated menu
  // mutation such as a badge stamp never triggers a rebuild.
  if (!window.__ccSetNavObs) {
    window.__ccSetNavObs = true;
    var menuEl9 = document.getElementById("menu");
    if (menuEl9 && window.MutationObserver) {
      var navT9 = null, lastOrd9 = "";
      new MutationObserver(function () {
        clearTimeout(navT9);
        navT9 = setTimeout(function () {
          try {
            var ord9 = Array.prototype.map.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]"), function (a9) { return a9.getAttribute("href"); }).join("|");
            if (ord9 && ord9 !== lastOrd9) { lastOrd9 = ord9; render(); }
          } catch (e9o) {}
        }, 200);
      }).observe(menuEl9, { childList: true, subtree: true });
    }
  }

  render();
  // Pulls the engine config so the Notifications card shows what is saved, then re-renders. With
  // the engine down the defaults stay. An edit made during the round trip is kept rather than
  // overwritten.
  api("GET", "config").then(function (c) {
    if (!c || typeof c !== "object") return; // unreadable, so Save stays disabled
    fullConfig = { schedules: c.schedules || [], watchdogs: c.watchdogs || [], bandwidths: c.bandwidths || [], notify: c.notify || { unraid: false, webhook: "" }, shape_iface: c.shape_iface || "", ui_settings: c.ui_settings || undefined };
    configLoaded = true;
    adoptUISettings(c.ui_settings); // render() below shows the adopted values
    // The palette migration cleaned the incoming map in place, so it is written back; otherwise
    // the next load's adopt would restore the old key from the mirror.
    if (adoptUISettings._migrated) { try { api("PUT", "config", c); } catch (e8) {} }
    if (!c.ui_settings || !Object.keys(c.ui_settings).length) { var seed9 = collectUISettings(); if (Object.keys(seed9).length) { Object.keys(seed9).forEach(function (k9) { uiPending[k9] = 1; }); pushUISettings(); } } // seed the mirror
    // An edit already in progress stays; otherwise the loaded values apply. Either way the
    // re-render enables Save.
    if (!notifyDirty) notify = { unraid: !!fullConfig.notify.unraid, webhook: fullConfig.notify.webhook || "" };
    if (!shapeDirty) shapeIface = fullConfig.shape_iface || "";
    render();
  }).catch(function () {});
})();
