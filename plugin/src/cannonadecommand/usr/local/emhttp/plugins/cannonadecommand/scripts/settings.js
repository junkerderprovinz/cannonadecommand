/* CannonadeCommand settings page. Client-side only: renders a polished,
 * card-based form (ShipLog-style, Carbon dark) into #cc-settings and persists to
 * localStorage (cc.accent / cc.rainbow / cc.iconcolor / cc.iconstrength /
 * cc.density / cc.view / cc.colview). The Docker-tab enhancer reads the same keys
 * and reacts live via the storage event. */
(function () {
  "use strict";
  var root = document.getElementById("cc-settings");
  if (!root) return;
  // tiny page-local style additions (docker.css is owned elsewhere): md-tier buttons for the
  // backup section (30px line, pad 0 14px, grey fill + hover accent via .cc-btn) + its inline
  // notice. NO borders/outlines/rings anywhere (house law); lives in <head>, survives render().
  (function () {
    if (document.getElementById("cc-set-xtra")) return;
    var st = document.createElement("style"); st.id = "cc-set-xtra";
    st.textContent =
      "#cc-settings .cc-set-xbtn{display:inline-flex;align-items:center;justify-content:center;height:var(--cc-md-h,30px);padding:var(--cc-md-btnpad,0 14px);font-size:var(--cc-md-fs,13px);font-weight:600;border-radius:var(--cc-b-radius,999px);box-sizing:border-box;margin:12px 10px 0 0}" +
      "#cc-settings .cc-set-xnote{margin-top:10px;font-size:12px;white-space:pre-wrap}" +
      // #17 flag picker: colour-stripe swatches + searchable custom dropdown (emoji flags fail on Windows)
      "#cc-settings .cc-flag-sw{display:inline-block;width:22px;height:15px;border-radius:3px;flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}" +
      "#cc-settings .cc-flag-sw-lg{width:34px;height:22px}" +
      // #2 real flag image (4:3 SVG); same footprint as the stripe swatch, subtle hairline
      "#cc-settings .cc-flag-img{display:inline-block;width:22px;height:15px;flex:0 0 auto;object-fit:cover;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}" +
      "#cc-settings .cc-flag-img-lg{width:34px;height:22px}" +
      // #7/#10 rainbow palette + flag colours stretch to fill the card width; the reset is the SAME
      // size as a swatch (its own equal flex cell at the end of the row), not a small right-pushed icon.
      "#cc-settings .cc-set-swatches.cc-fill{display:flex;gap:6px;align-items:center}" +
      // #5 (user redo): EVERY colour row is 9 equal flex cells so a swatch is the IDENTICAL size in every card.
      // A swatch = 1 cell. The reset = 1 cell (same size as a swatch). The hex field = 2 cells (wider than a
      // reset, as the hex code needs the room) — and the builder shows 7 presets instead of 9 in a hex row so
      // 7 + 2 = 9. All three are the SAME 30px height (box-sizing:border-box) so the whole row lines up flush.
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-sw{flex:1 1 0;height:30px;min-width:0;box-sizing:border-box;border-radius:var(--cc-b-radius,5px)}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-ibtn{flex:1 1 0;height:30px;min-width:0;box-sizing:border-box;margin:0;display:inline-flex;align-items:center;justify-content:center;background:#2e2e2e;border-radius:var(--cc-b-radius,5px);cursor:pointer;color:#cfcfcf;font-size:14px;transition:filter .12s,background .12s,color .12s}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-ibtn:hover{background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff)}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-hexin{flex:2 2 0;height:30px;min-width:0;box-sizing:border-box;padding:0 8px;align-self:center;font-size:11px;letter-spacing:0;margin:0}" +
      // #26 settings search + nuke-reset button
      "#cc-settings .cc-set-searchrow{margin:12px 0 2px}" +
      "#cc-settings .cc-set-search{box-sizing:border-box;width:100%;max-width:420px;background:#232323;color:#eaeaea;border:none;outline:none;border-radius:8px;padding:9px 13px;font-size:13px;transition:background-color .12s}" +
      // Unraid's default-base.css paints EVERY placeholder in the theme's link colour
      // (`input::-webkit-input-placeholder{color:var(--link-text-color)}`), i.e. blue on Theme--black — a
      // hint that reads as a link, or worse as an already-filled value. This used to be guarded for the
      // search box ALONE, which left the hex fields, the webhook URL and the interface name blue; the
      // Docker/popup half of the same guard lives in docker.css. One rule per sheet, every field.
      "#cc-settings input::placeholder{color:#8d8d8d;opacity:1}" +
      "#cc-settings .cc-set-search:focus{background:#2e2e2e}" +
      // #13 settings search as an expandable hero badge (magnifier -> input on click)
      // #6 (user): the collapsed search badge FOLLOWS the colour mode (accent/rainbow); it turns into a dark input box only while expanded
      "#cc-settings .cc-set-searchbadge{margin-left:auto;display:inline-flex;align-items:center;background:var(--cc-btn-accent,var(--cc-accent,#2f6feb));border-radius:min(var(--cc-b-radius,999px),17px);height:34px;overflow:hidden;transition:background-color .12s}" +
      "#cc-settings .cc-set-searchbadge .cc-set-searchicon{flex:0 0 auto;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;color:var(--cc-accent-text,#fff);cursor:pointer}" +
      "#cc-settings .cc-set-searchbadge.cc-open{background:#2e2e2e}" +
      "#cc-settings .cc-set-searchbadge:hover{filter:brightness(1.08)}" +
      "#cc-settings .cc-set-searchbadge.cc-open .cc-set-searchicon{color:#fff}" +
      "#cc-settings .cc-set-searchbadge .cc-set-search{box-sizing:border-box;width:0;max-width:0;padding:0;background:transparent;transition:width .2s,max-width .2s,padding .2s}" +
      "#cc-settings .cc-set-searchbadge.cc-open{background:#2e2e2e}" +
      "#cc-settings .cc-set-searchbadge.cc-open .cc-set-search{width:220px;max-width:220px;padding:0 12px 0 2px}" +
      // #14 version pinned to the very bottom, centred + muted
      "#cc-settings .cc-set-version-foot{margin:28px 0 6px;text-align:center;opacity:.55;font-size:12px}" +
      // #11 the native-display link is a proper CC accent button (not the grey chip)
      "#cc-settings .cc-btn.cc-btn-accent{background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff)}" +
      "#cc-settings .cc-btn.cc-btn-accent:hover{filter:brightness(1.14);background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff)}" +
      "#cc-settings .cc-set-danger{background:#5a2a2a!important;color:#ffd7d7!important}" +
      "#cc-settings .cc-set-danger:hover{filter:brightness(1.18)}" +
      "#cc-settings .cc-flag-picker{position:relative;margin-top:6px;max-width:340px}" +
      "#cc-settings .cc-flag-trigger{display:flex;align-items:center;gap:9px;background:#232323;border-radius:8px;padding:7px 12px;cursor:pointer;user-select:none}" +
      "#cc-settings .cc-flag-trigger:hover{filter:brightness(1.1)}" +
      "#cc-settings .cc-flag-name{font-size:13px;color:#eaeaea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      // #8: the trigger reads as a button (no caret). The panel is pinned FIXED at open time (see openPanel).
      "#cc-settings .cc-flag-panel{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:9999;background:#1c1c1c;border-radius:10px;box-shadow:0 12px 34px rgba(0,0,0,.6);overflow:hidden}" +
      "#cc-settings .cc-flag-search{box-sizing:border-box;background:#232323;color:#eaeaea;border:none;outline:none;border-radius:8px;padding:8px 10px;margin:8px;width:calc(100% - 16px);font-size:13px}" +
      "#cc-settings .cc-flag-list{max-height:260px;overflow-y:auto;padding:0 6px 6px}" +
      "#cc-settings .cc-flag-item{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:6px;cursor:pointer}" +
      "#cc-settings .cc-flag-item:hover,#cc-settings .cc-flag-item.cc-sel{background:rgba(255,255,255,.09)}" +   // #25 keyboard highlight
      // ── the LOGO PREVIEW TILE (logoPreview below). The coloured badge is THIS BOX — a real element with a
      // real border-radius and overflow:hidden — never an feFlood baked into the filter: an feFlood fills the
      // whole filter region, so the "badge" ignored border-radius and rendered a hard square where the live
      // tab shows a rounded tile. Same split the real tabs use (docker/vms span.hand, plugins .cc-plugico):
      // the TILE carries the badge, the child carries the pixels.
      "#cc-settings .cc-set-tile{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;flex:0 0 auto;transition:background-color .12s}" +
      "#cc-settings .cc-set-tile>img{width:100%;height:100%;object-fit:contain;display:block;box-sizing:border-box}" +
      "#cc-settings .cc-set-tile>i{display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;box-sizing:border-box}" +
      "#cc-settings .cc-set-tile-bg>img,#cc-settings .cc-set-tile-bg>i{padding:14%}" +
      // per-area sub-heading inside ONE card (the global Logos card's Docker/VM/Plugin sections) — a plain
      // muted caption, not a second card (Rule 1: one raised surface, never a card inside a card)
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
  // rainbow-mode colour per column (same order as COLS): the matrix checkboxes take
  // these when rainbow mode is on, so the settings echo the Docker-tab badge colours.
  // net/ip/lan/port share a network-ish family (net kept its old purple; ip/lan/port added after it).
  var RB = ["#1f9d55", "#2f6feb", "#6b7280", "#8b5cf6", "#7c6df0", "#5b8def", "#4aa3c7", "#d9433f", "#0ea5a4", "#e05299", "#0891b2", "#6366f1", "#e0912a"];

  // Each column gets its OWN object via a factory call — chkCell mutates colview[key][v] IN PLACE, so a
  // SHARED `both`/`adv` reference let one checkbox flip every aliased column (net/ip/lan/port all aliased
  // `both`, blanking the whole Simple-view network area). Must stay in lock-step with docker.js defaultColview().
  function defColview() { var adv = function () { return { s: false, a: true }; }, both = function () { return { s: true, a: true }; }; return { update: both(), force: adv(), version: adv(), net: both(), ip: both(), lan: both(), port: both(), res: both(), id: adv(), von: adv(), vol: adv(), plan: both(), restart: adv() }; }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  // The "Standard-Ansicht" picker below only ever wrote localStorage — the Docker tab's own
  // organizer-probe reconcile (docker.js boot()) treats the SERVER's saved ccViewMode as
  // authoritative and silently overwrites a local-only pick on the next load (live-caught:
  // picking Grid here never survived a reload once the server remembered a different mode).
  // window.ccGql is header.js's shared GraphQL transport (exposed globally since docker.js's
  // organizer code needs it too) — read-then-merge-then-write so an unrelated prefs key some
  // other feature adds later never gets clobbered by this picker.
  function syncViewModeServer(v) {
    if (typeof window.ccGql !== "function") return; // header.js missing/too old — degrade silently, localStorage still has the value
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
      .catch(function () {}); // best-effort — the picker already reflects the choice either way
  }
  // ONE-TIME upgrade migration (runs at module load, BEFORE any render/applyFlag): builds before 2.66
  // stored the FLAG palette in the shared cc.rbpal key. If a flag is selected but cc.flagpal is still
  // absent, cc.rbpal currently HOLDS exactly those flag colours — so move them into cc.flagpal and clear
  // cc.rbpal, returning the rainbow palette to its clean default. No flag-data lookup needed (the value
  // is already the flag palette), so it can't race CC_FLAGS loading. Idempotent: once cc.flagpal exists
  // the guard is false, so it never runs again and never touches a legit custom rainbow palette.
  (function migrateFlagPalette() {
    try {
      var rb = get("cc.rbpal", "");
      if (get("cc.flag", "") && rb) {
        var fp = get("cc.flagpal", "");
        if (!fp) { set("cc.flagpal", rb); del("cc.rbpal"); }          // pre-2.66: rbpal IS the flag palette -> move it, clear rbpal
        else if (fp === rb) { del("cc.rbpal"); }                       // 2.66.1/2.66.2: both hold the flag palette -> drop the redundant rbpal
        // else: rbpal differs from flagpal -> it is a legit custom rainbow palette, leave it alone
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

  // Notifications are engine-side config (not localStorage): loaded/saved through
  // the same-origin proxy. We keep the WHOLE config so a notify save never drops
  // the per-container schedules/watchdogs set in the Docker tab.
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var fullConfig = { schedules: [], watchdogs: [], notify: { unraid: false, webhook: "" } };
  var notify = { unraid: false, webhook: "" };
  var shapeIface = "";       // engine config: interface the egress shaping runs on (blank = eth0)
  var notifyDirty = false;   // true once the user has touched the Notifications card
  var shapeDirty = false;    // true once the user has touched the shaping-interface field
  var configLoaded = false;  // true only after a SUCCESSFUL initial GET /config
  // mirror every cc.* write into the engine config — localStorage is per-origin,
  // so without this the toggles only ever applied to the origin they were set on
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
    // removeItem was never intercepted (only setItem was) — a key cleared via del()/
    // localStorage.removeItem() (this file's own del(), the cc.rbpal migration cleanup below,
    // the kill.forEach cleanup further down) never got queued into uiPending, so the deletion
    // never reached the engine's ui_settings mirror and adoptUISettings() resurrected the old
    // value on the next load. pushUISettings() already treats a null local read as "delete the
    // server key" — this was the missing half that queues the key at all. Mirrors the same
    // patch in docker.js/cc-theme.js (each page runs exactly one of the three, never doubled).
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
  // merge ONLY the changed keys into the server map (never replace it wholesale)
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
    // Two-way-sync migration: old builds stored the FLAG palette in the shared cc.rbpal key. The engine's
    // ui_settings is the sync's source of truth, so if we only cleaned localStorage the very next adopt
    // would restore cc.rbpal=flag. Move it into cc.flagpal and drop cc.rbpal IN u, clear the local copy,
    // and flag _migrated so the loader persists the cleaned config back to the engine.
    adoptUISettings._migrated = false;
    try {
      if (u && u["cc.flag"] && u["cc.rbpal"]) {
        if (!u["cc.flagpal"]) { u["cc.flagpal"] = u["cc.rbpal"]; delete u["cc.rbpal"]; adoptUISettings._migrated = true; }        // pre-2.66: move the flag palette out of rbpal
        else if (u["cc.flagpal"] === u["cc.rbpal"]) { delete u["cc.rbpal"]; adoptUISettings._migrated = true; }                  // 2.66.1/2.66.2: drop the redundant contaminated rbpal
        // else: rbpal differs from flagpal -> a legit custom rainbow palette, keep it
      }
    } catch (e0) {}
    if (adoptUISettings._migrated) { try { localStorage.removeItem("cc.rbpal"); } catch (e1) {} }   // u no longer carries cc.rbpal -> clear the local contaminated value explicitly
    try { Object.keys(u || {}).forEach(function (k) { if (/^cc[a-z]*\./.test(k) && k !== "cc.stateCache" && localStorage.getItem(k) !== u[k]) { (window.__ccLS || localStorage.setItem.bind(localStorage))(k, u[k]); changed = true; } }); } catch (e) {}
    return changed;
  }
  function api(method, path, body) {
    var opts = { method: method, headers: { Accept: "application/json" } };
    var u = PROXY + "?path=" + encodeURIComponent(path);
    var tk = "";
    try { tk = (typeof window.csrf_token !== "undefined" && window.csrf_token) || (document.querySelector('input[name="csrf_token"]') || {}).value || ((document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/) || [])[1] || ""; } catch (e) {}
    if (method !== "GET") { // emhttp accepts the csrf_token ONLY in a form body
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opts.body = (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body != null ? body : {}));
    }
    return fetch(u, opts).then(function (r) {
      return r.text().then(function (tx) { var d = null; try { d = tx ? JSON.parse(tx) : null; } catch (e) {} if (!r.ok) throw new Error((d && d.error) || ("HTTP " + r.status)); return d; });
    });
  }
  // ── permanently embedded colour picker (no OS popup window) ──
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
  // An always-visible SV-square + hue bar; el._set(hex) syncs it, el._get() reads it.
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

  // Serialise config read-modify-write so the Notifications and Bandwidth cards saving
  // near-simultaneously can't lose each other's field: each GET-modify-PUT waits for the
  // previous to settle, so the second GET always sees the first's PUT.
  var cfgChain = Promise.resolve();
  function withConfigLock(fn) { var p = cfgChain.then(fn, fn); cfgChain = p.catch(function () {}); return p; }

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  var cardN = 0;
  function card(title, sub) {
    var c = el("div", "cc-set-card"); // no coloured top bar (user call)
    var h = el("div", "cc-set-h", title);
    if (sub) h.appendChild(infoIcon(sub)); // info text lives behind the ⓘ bubble, never on the card (user call)
    c.appendChild(h); return c;
  }
  function elk(t) { var s = el("span", "cc-b-k"); s.textContent = t; return s; }
  function elv(t) { var s = el("span", "cc-b-v"); s.textContent = t; return s; }
  // Systemwide INFO ICON: a small "i" in a circle; hover OR keyboard-focus shows a CSS bubble with
  // the explanation (styled in docker.css). Lets us tuck long info texts behind a clean glyph so the
  // cards stay uncluttered — reuse this anywhere a control needs a "what does this do?" hint.
  // ONE (i) for the whole plugin — glyph + markup live in cc-theme.js (window.CCTheme.infoIcon).
  function infoIcon(tip) { if (window.CCTheme && window.CCTheme.infoIcon) return window.CCTheme.infoIcon(tip); var s = el("span", "cc-info"); s.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>'; if (tip) { s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); } s.setAttribute("tabindex", "0"); return s; }
  // normalise a typed hex ("2f6feb" / "#2F6FEB") to "#rrggbb", or "" if invalid.
  function normHex(s) { var v = String(s || "").trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = "#" + v; return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ""; }

  // a badge-styled on/off toggle. A <span> (NOT a <button>): Unraid's global button
  // CSS was painting an orange border and limiting the knob travel to mid-way.
  function toggle(on, onChange, disabled) {
    var t = el("span", "cc-set-toggle" + (on ? " cc-set-toggle-on" : "") + (disabled ? " cc-set-toggle-disabled" : ""));
    t.setAttribute("role", "switch"); t.setAttribute("tabindex", disabled ? "-1" : "0"); t.setAttribute("aria-checked", on ? "true" : "false");
    if (disabled) t.setAttribute("aria-disabled", "true");
    t.appendChild(el("span", "cc-set-knob"));
    function paint() { t.classList.toggle("cc-set-toggle-on", on); t.setAttribute("aria-checked", on ? "true" : "false"); }
    function flip() { if (t.classList.contains("cc-set-toggle-disabled")) return; on = !on; paint(); onChange(on); }   // #3: a gated toggle refuses to flip
    t._setOn = function (v) { if (v === on) return; on = v; paint(); }; // programmatic sync, fires NO onChange
    t._setDisabled = function (d) { t.classList.toggle("cc-set-toggle-disabled", !!d); t.setAttribute("tabindex", d ? "-1" : "0"); if (d) t.setAttribute("aria-disabled", "true"); else t.removeAttribute("aria-disabled"); };
    t.addEventListener("click", flip);
    t.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    return t;
  }
  function toggleRow(labelText, on, onChange) {
    var row = el("div", "cc-set-row"); row.appendChild(el("span", null, labelText)); var sp = el("span", "cc-set-spacer"); row.appendChild(sp);
    row.appendChild(toggle(on, onChange)); return row;
  }

  // ── THE SELECTED SWATCH, in ONE place ────────────────────────────────────────────────
  // Every colour row on this page draws the same swatch, so "which one is picked" has to be
  // marked the same way in every one of them. It used to be a CSS-only `transform: scale()`,
  // which made the picked swatch a DIFFERENT SIZE from its neighbours (measured live: 33x35
  // against 28x30) — see the long note on .cc-set-sw-on in docker.css. The box never changes
  // now; the mark is a tick drawn on the fill, and the tick needs an ink that contrasts with
  // THIS swatch's colour, so the class and the ink are always set together. Going through one
  // helper is what keeps the global card, every area card and syncSwOn() from drifting apart.
  function swMark(sw, on, colour) {
    if (!sw) return;
    sw.classList.toggle("cc-set-sw-on", !!on);
    if (on) sw.style.setProperty("--cc-sw-tick", ccTick(idealText(colour || sw.dataset.c || "")));
    else sw.style.removeProperty("--cc-sw-tick");
  }
  // Mark exactly the swatch whose colour is `colour` inside `row` (and unmark the rest).
  // dataset.c is the swatch's own colour — the ONE attribute every preset swatch carries.
  function swMarkRow(row, colour) {
    if (!row) return;
    var want = String(colour || "").toLowerCase();
    Array.prototype.slice.call(row.querySelectorAll(".cc-set-sw")).forEach(function (sw) {
      var c = (sw.dataset.c || "").toLowerCase();
      swMark(sw, !!c && c === want, sw.dataset.c);
    });
  }

  // ── ONE LOGO PREVIEW FOR EVERY CARD THAT HAS ONE ─────────────────────────────────────
  // There were THREE private copies of this (the Docker tab's Logos card, every area's own
  // Logos card, and nothing at all in the global card), and all three painted something the
  // real tabs never paint. Two concrete faults, both reported as "the preview doesn't work":
  //   · they applied a RAW luminance tint / ink flatten and never once looked at cc.iconmode,
  //     so with the global Icon-Färbung on anything but the raw treatment the preview showed a
  //     different picture from the tab it is a preview OF;
  //   · the coloured badge was an feFlood INSIDE the SVG filter. An feFlood fills the whole
  //     filter region, which is the element's border box — so the badge ignored border-radius
  //     and came out a hard square while the live tab shows a rounded tile.
  // This runs the tabs' OWN pipeline instead: CCTheme.icons.plan() picks native/flat/tint and
  // may swap in a curated glyph, exactly as docker.js/plugins.js/vms.js do it, and the badge is
  // a real CSS box (.cc-set-tile) behind the image. `scope` is the pipeline's per-item scope
  // ("docker"/"vm"/"plugin"), so a per-item pin set in a row's own window shows up here too.
  function logoPreview(scope, fid) {
    var wrap = el("div", "cc-set-prev");
    var items = [];                                   // {tile, node, name, glyph, src}
    // bg/bgColor and tint/color are two INDEPENDENT pairs (v4.32.5): bg draws the badge box (in
    // ITS OWN bgColor, falling back to `color` then `accent` — same chain as bgColor() in
    // docker.js/vms.js/plugins.js), tint recolours the icon itself (in `color`) and is gated by
    // its OWN on/off — a background badge alone no longer forces the icon to be recoloured.
    var st = { bg: false, bgColor: "", tint: false, color: "", strength: 100, accent: "#2f6feb", size: null };
    var bound = false;
    function C() { return window.CCTheme && window.CCTheme.icons; }
    function hex6(c) { c = String(c == null ? "" : c).trim(); return /^#[0-9a-f]{3}$/i.test(c) ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c; }
    function badgeBg() {
      if (/^#[0-9a-f]{6}$/i.test(st.bgColor)) return st.bgColor;
      if (/^#[0-9a-f]{6}$/i.test(st.color)) return st.color;
      return st.accent;
    }
    // Same ink contract as docker.js iconInk()/plugins.js plugIconInk(): "" whenever tint is off
    // (regardless of the badge); ALWAYS the picked TINT colour, lifted out of the dark end —
    // regardless of whether the badge is also on (v4.32.6 fix: this used to return
    // hex6(idealText(badgeBg())) whenever the badge was on, discarding the user's own picked
    // tint colour — see docker.js iconInk() for the full writeup). badgeBg() stays the badge
    // box's OWN colour, never the icon's ink. A luminance tint outputs about half the target's
    // luma, so the tint path doubles the floor.
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
    // A sample starting with "fa-"/"icon-" is a FONT GLYPH (the Settings/Tools tiles, most VM rows),
    // which is monochrome by construction: it inks via CSS colour and has no raster to matrix.
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
        // The plan is the pipeline's, never a local guess: an unmeasured/unknown icon falls through
        // to the safe treatment exactly as it does on the real tab.
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
          // ink(false) already answers the picked tint colour whenever tint is on (badge or not),
          // and "" whenever tint is off (badge or not) — branching on st.bg directly here instead
          // (as this used to) would force a colour onto the glyph even with tint off.
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

  // ── ONE "Hintergrund" (background) + "Einfärben" (tint) control pair, for every card that
  // has one — the global "Logos & Icons" card, the Docker tab's own Logos card and every other
  // area's Logos card (buildStyleCards' cB). Before 4.32.5 there were THREE hand-rolled copies
  // of "a toggle whose on/off state IS a colour key's presence" (gOn/iconOn/on2 further down in
  // this file), and the confirmed bug — turning Hintergrund on silently switched icon tinting on
  // too — was exactly that BOTH controls read and wrote the SAME cc.iconcolor key. This gives
  // each control its own on/off key AND its own colour key, and builds the DOM for both exactly
  // once, so a future change to the row's shape (or another conflation bug) only has to be fixed
  // in one place instead of three.
  //   io.getBg()/setBg(bool)             — background on/off
  //   io.getBgColor()/setBgColor(hex)    — background's OWN colour ("" = unset -> falls back)
  //   io.getTint()/setTint(bool)         — tint on/off
  //   io.getColor()/setColor(hex)        — tint's OWN colour (the pre-existing *iconcolor key)
  //   io.getAdopt()/setAdopt(bool)       — the ONE master "Badge-Einstellungen übernehmen"
  //                                         toggle (v4.33.1, see below)
  //   io.getAccent()                     — this scope's effective accent, for the colour fallback
  //   io.onChange()                      — called after ANY of the eight writes above (repaint hook)
  // Returns the toggle/picker handles a caller may still need (e.g. the strength slider) plus a
  // sync() that repaints every row from the CURRENT stored values (an adopt-toggle flip on an
  // area card needs this to jump to the newly-effective values).
  //
  // ── BADGE-EINSTELLUNGEN ÜBERNEHMEN — ONE toggle, not two (v4.33.1) ──────────────────
  // v4.32.4-v4.32.7 deliberately made Hintergrund's/Einfärben's OWN picked colour win over
  // Rainbow mode's rotating colour unconditionally — correct as the default, but it removed a
  // capability an install could rely on: making the icon FOLLOW Rainbow (or the plain accent)
  // like every other badge, exactly as it behaved before v4.32.4. v4.33.0's first attempt at
  // restoring that gave EACH control its own independent adopt toggle — user-tested minutes
  // after release and immediately redesigned: two toggles meant Einfärben's adopt state still
  // had to pick ONE flat rotating hue for the tint (never per-item, since the tint is one shared
  // SVG filter for the whole page — see iconInk()/vmIconInk()/plugIconInk()), so "rainbow mode"
  // never actually looked like a rainbow — every logo showed the SAME colour. The fix the user
  // asked for: collapse both toggles into ONE, sitting at the very TOP of this block (above both
  // colour-picker rows, not as a third row per control). When it is ON, Hintergrund follows
  // Rainbow/accent exactly as before (unchanged mechanism — bgColor() and its mirrors answer ""
  // so the existing --cc-rb-c/--cc-accent CSS fallback chain resolves it, now genuinely PER-ITEM
  // in every view via the new per-card/per-row rainbow stamping), and Einfärben's ink stops being
  // a separately-adopted colour altogether: it becomes an AUTOMATIC black-or-white contrast
  // colour for whatever the resolved background actually is — exactly the contrast-ink treatment
  // settingsgrid.js's own badge mode already computes unconditionally for its tiles. Both colour
  // pickers below are dimmed + inert while this ONE toggle is on (neither is consulted), the same
  // convention the Intensität row already uses for "this control is not currently in effect".
  // When it is OFF, Hintergrund/Einfärben are exactly as independent as v4.32.6/v4.32.7 left them
  // — unchanged. The actual colour resolution lives entirely on the read side
  // (docker.js/vms.js/plugins.js/settingsgrid.js's bgColor()/iconInk() and mirrors) — this
  // control only flips ONE storage key.
  function logoToggles(into, io) {
    function bgColorEff() {
      var c = io.getBgColor(); if (/^#[0-9a-f]{6}$/i.test(c)) return c;
      var ic = io.getColor(); if (/^#[0-9a-f]{6}$/i.test(ic)) return ic;
      return /^#[0-9a-f]{6}$/i.test(io.getAccent()) ? io.getAccent() : "#1f9d55";
    }
    // v4.35.0 (item 5, jdp: "den kann man von den Docker/Plugins/VMs tabs weg lassen... man muss
    // ihn eh nur global an/aus machen, sonst ist er redundant"): the master toggle now lives on the
    // GLOBAL "Logos & Icons" card ONLY — every area card (Docker/Plugins/VMs/Settings…) still needs
    // io.getAdopt() internally (sync() below dims the colour pickers exactly as before, now purely
    // reading whatever the caller's getAdopt() resolves to — see the "always global" getAdopt()s at
    // the area call sites), it just never gets its OWN visible row/switch to flip. Skips building
    // adoptTg/adoptRow at all when set, rather than building-then-hiding — nothing to leak inert
    // DOM for a control this card can never show.
    var hideAdopt = !!io.hideAdoptRow;
    var adoptTg = null, adoptRow = null;
    if (!hideAdopt) {
      // the ONE master toggle — first thing in the card, above every other row.
      adoptTg = toggle(io.getAdopt(), function (v) { io.setAdopt(v); sync(); io.onChange(); });
      adoptRow = el("div", "cc-set-row cc-set-inline");
      var adoptLbl = el("span", "cc-set-lblwrap"); adoptLbl.appendChild(el("span", null, T("Badge-Einstellungen übernehmen", "Adopt badge settings")));
      adoptLbl.appendChild(infoIcon(T("AN: Hintergrund UND Icons folgen zusammen Regenbogen (rotierend, pro Symbol) bzw. der Akzentfarbe, wenn Regenbogen aus ist — genau wie jedes andere Badge. Das Symbol selbst wird dabei automatisch schwarz oder weiß eingefärbt, je nachdem was auf dem Hintergrund lesbar ist. Die beiden Farbwähler unten werden dabei ignoriert.", "ON: Background AND Icons together follow Rainbow mode (rotating, per icon) or the plain accent when Rainbow is off — exactly like every other badge. The icon itself is then automatically inked black or white, whichever reads on the resolved background. Both colour pickers below are ignored while this is on.")));
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
    // v4.35.0 (item 4, jdp: "Einfärben soll eigentlich Icons heißen"): display label only — the
    // storage key (cc.icontint/P+icontint), the getter/setter names (getTint/setTint/io.getTint())
    // and every internal variable (tintTg, tintRow, tintOn, …) keep their existing names unchanged.
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
      // NEITHER picker is consulted while the master toggle adopts — dim + inert both, the same
      // convention the Intensität row below already uses for "this control is not currently in
      // effect".
      bgTg._setOn(io.getBg());
      bgHx.value = io.getBgColor() || ""; try { bgPk._set(bgColorEff()); } catch (e9) {}
      bgPickRow.style.opacity = adopting ? ".4" : ""; bgPickRow.style.pointerEvents = adopting ? "none" : "";
      // v4.35.0 (item 4, jdp: the switches themselves — not just their colour pickers — must grey
      // out and refuse clicks while adopting). toggle()'s own disabled state (_setDisabled) already
      // does exactly that: opacity .4 + grayscale + cursor:not-allowed (see .cc-set-toggle-disabled
      // in docker.css) AND flip() refuses to fire onChange while it's set — so this is the SAME
      // mechanism the Intensität row's opacity/pointerEvents convention approximates by hand,
      // applied to the switch itself instead of a wrapping row.
      bgTg._setDisabled(adopting);
      tintTg._setDisabled(adopting);
      tintTg._setOn(io.getTint());
      tintHx.value = io.getColor() || ""; try { if (/^#[0-9a-f]{6}$/i.test(io.getColor())) tintPk._set(io.getColor()); } catch (e9) {}
      tintPickRow.style.opacity = adopting ? ".4" : ""; tintPickRow.style.pointerEvents = adopting ? "none" : "";
      // Intensität only ever means anything for the LUMINANCE tint, which only runs when tint is
      // on — the badge box no longer affects the icon's ink at all (v4.32.6 fix: iconInk() and
      // its mirrors now always tint in the picked colour, badge or not — see iconInk()/
      // vmIconInk()/plugIconInk()) — so it only dims when tint itself is off. While adopting, the
      // ink is a flat auto black/white contrast colour with no strength to tune either.
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

  // ── REAL sample icons per area, for the previews ─────────────────────────────────────
  // What 4.32.0 did — fetch("/VMs") / fetch("/Plugins") and parse the answer — CANNOT work, on any
  // box, ever. All three native list pages ship an EMPTY table body and fill it from their own
  // jQuery AFTER load:
  //     Plugins.page          initlist() -> $.get('/plugins/dynamix.plugin.manager/include/ShowPlugins.php')
  //     VMMachines.page       loadlist() -> $.get('/plugins/dynamix.vm.manager/include/VMMachines.php')
  //     DockerContainers.page loadlist() -> $.get('/plugins/dynamix.docker.manager/include/DockerContainers.php')
  // fetch() never executes a page's <script>, so parsing the page shell can only ever see that
  // pre-population skeleton — literally `<tbody id="plugin_list"><tr><td colspan="6"></td></tr></tbody>`,
  // zero <img>, always, no matter how long you wait. Not a selector bug and not a race: the bytes
  // fetch() gets simply never contain an icon. Verified live on a real box.
  // So we call the SAME row-fragment endpoints the native pages call. They are plain
  // server-rendered <tr> HTML with the real icons already in them — no JS execution required,
  // and by construction identical to what the live tab ends up showing.
  //
  // Three parsing details that are NOT optional:
  //  · VMMachines.php answers "rows \0 script" — only the FIRST NUL-separated part is markup.
  //  · A bare "<tr>…" string handed to DOMParser is DISCARDED (the HTML parser foster-parents a
  //    <tr> that has no table around it), so the fragment must be wrapped in <table><tbody> first.
  //  · Only the DIRECT <tr> children of that wrapper are rows; a plugin's rendered README can
  //    contain its own nested tables and images, which must never be mistaken for a logo.
  // ShowPlugins.php is called with init=1 (server-rendered icon markup) and check=1 (no remote
  // version check — the network path lives exclusively in the non-init branch).
  var ICON_SRC = {
    // Docker used to build its own "/state/.../<name>-icon.png" URL out of the engine's container
    // list. That is a GUESS, and it is wrong for every container Unraid has no cached icon for:
    // the file 404s, the preview's onerror hides the tile, and the row comes out as a hole. The
    // fragment carries the src the Docker tab itself renders, including Unraid's question.png
    // stand-in — so what the preview shows is what the tab shows, gap-free.
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
      cell: "td.vm-name",                                                     // detail/disk rows have no such cell and are skipped
      sels: ["span[id^='vm-'] > .img", "img.img", "img", "i.img"],            // same order vms.js vmImgs() uses
      // mirrors vms.js vmNameOf(): a row's VM name is the 1st argument of its addVMContext(…) handler
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
      // mirrors plugins.js paintRow(): the display name is the README heading in the description
      // cell, with the version cell's vid-<name> id as the fallback.
      name: function (cell, row) {
        var tds = row.children; if (!tds || tds.length < 4) return "";
        var h = tds[1].querySelector("h1, h2, h3") || tds[1].querySelector("strong, b");
        return (h ? (h.textContent || "").trim() : String(tds[3].id || "").replace(/^vid-/, "")) || "";
      }
    }
  };
  // Best-effort throughout: a disabled tab, no VMs or a slow box just yields an empty list and
  // the caller shows its "nothing to show" line instead of a broken row.
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
    // #1 FIX: re-read the live theming snapshot on EVERY render. accent/rainbow/iconcolor/iconstrength
    // are module-init vars (read once at load, lines 67-70); a setting change calls render(), so without
    // refreshing them here the UI repaints from the STALE load-time value. Root cause of "Rainbow-Toggle
    // funktioniert nicht": rbOnly used the stale `rainbow`, so the switch snapped back OFF after every
    // click (and the reactive/rotation/palette rows stayed greyed) even though cc.rainbow flipped to 1.
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
    var lg = el("img", "cc-set-logo"); lg.src = "/plugins/cannonadecommand/images/cannonadecommand-unraid.svg"; lg.alt = "";   // theme-safe double-ring variant (reads on every Unraid theme)
    hleft.appendChild(lg);
    var htx = el("div", null);
    var brand = el("div", "cc-set-brand"); brand.appendChild(el("b", null, "Cannonade")); brand.appendChild(el("span", null, "Command"));
    htx.appendChild(brand);
    htx.appendChild(el("div", "cc-set-claim", "Firepower and finish for Unraid's Docker, Plugins and VM tabs."));
    hleft.appendChild(htx);
    hero.appendChild(hleft);
    head.appendChild(hero);
    // The RUNNING engine version, always findable HERE (the Docker-tab gear was hard to
    // locate) — an old value after an update = the update didn't take / daemon not restarted.
    var CC_VER = "@@CCVER@@"; if (CC_VER.indexOf("@@") === 0) CC_VER = "dev";
    // GlimStone version this UI is built against — bump by hand whenever tokens.css /
    // appearance.ts are re-copied from a newer github.com/junkerderprovinz/glimstone release.
    var GLS_VER = "1.0.0";
    // #14 (user): the version line moves to the very BOTTOM of the page (appended to root after all wraps, below).
    var verLine = el("div", "cc-set-sub cc-set-version cc-set-version-foot", "UI v" + CC_VER + " · GlimStone v" + GLS_VER + " · " + T("Engine: verbinde…", "Engine: connecting…"));
    api("GET", "state").then(function (s) {
      verLine.textContent = "UI v" + CC_VER + " · GlimStone v" + GLS_VER + " · " + ((s && s.version) ? ("Engine " + String(s.version).replace(/^v/, "v")) + " · " + T("läuft", "running") : T("Engine läuft (Version unbekannt)", "Engine running (version unknown)"));
    }).catch(function (e) { verLine.textContent = "UI v" + CC_VER + " · GlimStone v" + GLS_VER + " · " + T("Engine NICHT erreichbar", "Engine NOT reachable") + " — " + (e && e.message ? e.message : ""); verLine.style.color = "#d9433f"; });
    // #26/#13 (user): quick settings search — filters cards/rows across ALL tabs. It sits far-RIGHT in the
    // hero (where the version used to be) as a BADGE with a magnifier that EXPANDS to the input on click.
    var setSearch = el("input", "cc-set-search"); setSearch.type = "search"; setSearch.placeholder = T("Einstellungen durchsuchen …", "Search settings …"); setSearch.spellcheck = false;
    var searchBadge = el("div", "cc-set-searchbadge");
    var searchIcon = el("span", "cc-set-searchicon"); searchIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M14 3.072a8 8 0 0 1 2.32 11.834l5.387 5.387a1 1 0 0 1 -1.414 1.414l-5.388 -5.387a8 8 0 1 1 -.905 -13.249" /></svg>';   // tabler filled/search (Rule 20)
    searchBadge.appendChild(searchIcon); searchBadge.appendChild(setSearch);
    searchIcon.addEventListener("click", function (e) { e.stopPropagation(); var open = searchBadge.classList.toggle("cc-open"); if (open) { setSearch.focus(); } else { setSearch.value = ""; if (typeof runFilter === "function") runFilter(""); } });
    hero.appendChild(searchBadge);
    // #7 (user): the search collapses again when you click BESIDE it. Bound once (render() is re-entrant);
    // clears the query + resets the filter via a synthetic input event so the existing filter listener runs.
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
    var wrapTools = el("div", "cc-set-wrap");   // #6: Werkzeuge is its own sub-tab now (shares the /Settings grid config — Unraid renders both landing pages identically)
    var wrapFavorites = el("div", "cc-set-wrap");
    var wrapStart = el("div", "cc-set-wrap");   // Start (/Main) area — its own CC-settings section
    var wrapMain = el("div", "cc-set-wrap");    // Allgemein — also hosts the export/import card (last)
    var adoptToggles = {}; // adopt-key → its toggle element (a colour pick flips it live); declared UP here (not further down) because the Docker area's styleToggle now runs early, with the moved global Badges card
    var styleCardSync = {}; // adopt-key → refresher: repaints an area card's picker/hex/swatches/preview with the EFFECTIVE colour (global while adopt is ON, own while OFF)
    function syncAllStyleCards() { for (var k9 in styleCardSync) { try { styleCardSync[k9](); } catch (e9) {} } }
    // MASTER THEMING switch (first, prominent). Off = keep ONLY the Docker orchestration
    // FUNCTIONS (start plan, dependencies, health-gate, watchdog, schedules, limits, bandwidth,
    // idle-stop) and disable ALL visual theming (badges, colours, rainbow, cards, and every
    // area's restyling). Defaults on, so existing installs are unchanged. render() on change
    // keeps the toggle in sync; the tabs pick it up via their storage listeners / on next load.
    var themingCard; // the first Allgemein card — Sichern & Übertragen moves in here (user call)
    (function () {
      var tc = card(T("Theming", "Theming"), T("Aus = nur die Docker-FUNKTIONEN von CannonadeCommand bleiben (Startplan, Abhängigkeiten, Health-Gate, Watchdog, Zeitpläne, Limits, Bandbreite, Auto-Stop bei Leerlauf). Das gesamte visuelle Theming — Badges, Farben, Rainbow, Karten und die Umgestaltung aller Tabs — wird abgeschaltet.", "Off = only CannonadeCommand's Docker FUNCTIONS remain (start plan, dependencies, health-gate, watchdog, schedules, limits, bandwidth, idle auto-stop). All visual theming — badges, colours, rainbow, cards and every tab's restyling — is turned off."));
      tc.appendChild(toggleRow(T("Theming aktiv", "Theming on"), localStorage.getItem("cc.theming") !== "0", function (v) { set("cc.theming", v ? "1" : "0"); render(); syncHeaderBar(); syncSharesBar(); }));
      themingCard = tc;
      wrapMain.appendChild(tc);
    })();
    // ── Anzeige (Unraid), LIVE-SYNC (Option A rework): mirroring all ~21 native display fields into CC
    // was "super unübersichtlich" (user). Now the FULL native Display Settings live on Unraid's own page
    // — Carbon-styled by CannonadeCommand (cc-tools-on covers /Settings/*), tile un-hidden — and CC keeps
    // only the handful that were genuinely useful here as LIVE-SYNC controls: they POST the SAME field via
    // update.php (URLSearchParams -> 200; multipart 504s) + reload, so switching here flips the native
    // setting too. csrf_token gates the POST. "favorites" also drives cc.hidefavtab.
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
      // field -> concise CC help text [de, en] (native page ships none)
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
      // #7 native header COLOUR field -> CC picker + hex; commit (post+reload) on hex change or 700ms
      // after the picker settles (dragging must not reload per-frame).
      function colorRow(lbl, hexv, onCommit, helpTxt) {
        hexv = (hexv || "").replace(/^#/, "");
        var row = el("div", "cc-set-row"); var rl = el("span", "cc-set-rl", lbl); if (helpTxt) rl.appendChild(infoIcon(helpTxt)); row.appendChild(rl);
        var pr = el("div", "cc-set-pickrow"), colT;
        var hx = el("input", "cc-set-hexin"); hx.type = "text"; hx.value = hexv ? "#" + hexv : ""; hx.placeholder = "#000000"; hx.maxLength = 7; hx.spellcheck = false;
        var pk = inlinePicker(/^[0-9a-f]{6}$/i.test(hexv) ? "#" + hexv : "#161616", function (v) { hx.value = v; clearTimeout(colT); colT = setTimeout(function () { onCommit(v.replace(/^#/, "")); }, 700); });
        hx.addEventListener("change", function () { clearTimeout(colT); var v = normHex(hx.value); if (v) { pk._set(v); onCommit(v.replace(/^#/, "")); } else if (!hx.value) onCommit(""); });
        pr.appendChild(pk); pr.appendChild(hx); row.appendChild(pr); return row;
      }
      // #6 the native banner IMAGE upload is a file-drop on Unraid's page — link out to it (re-implementing
      // a multipart file upload through the proxy is out of scope; the native page is reachable by URL).
      function bannerUploadRow() {
        var row = el("div", "cc-set-row"); row.appendChild(el("span", "cc-set-rl", T("Eigenes Banner-Bild", "Custom banner image")));
        var b = el("button", "cc-btn", T("Hochladen / ändern …", "Upload / change …")); b.type = "button";
        b.addEventListener("click", function () { location.href = "/Settings/DisplaySettings"; });
        row.appendChild(b); return row;
      }
      // #5 (cleanup): mirroring Unraid's display PREFS into CC felt redundant once the native page is
      // CC-styled + one click away ("es sind noch alte Einstellungen ... in den cc settings"). We now keep
      // ONLY the 3 header COLOURS here — they affect CannonadeCommand's OWN header and were explicitly
      // wanted back (#7) — as live-sync controls; theme/tabbed-view/banner/favourites live natively.
      // #19 (user): the native header COLOUR pickers moved BACK to Unraid's Display Settings page (now
      // CC-styled) — this card keeps only the quick link + the auto-theme coupling (#20).
      var postDisplayMulti = function (fields) {
        try {
          var fd = new URLSearchParams();
          fd.append("#file", "dynamix/dynamix.cfg"); fd.append("#section", "display"); fd.append("csrf_token", window.csrf_token);
          Object.keys(fields).forEach(function (k9) { fd.append(k9, fields[k9]); });
          fetch("/update.php", { method: "POST", body: fd, credentials: "same-origin" }).then(function () { location.reload(); });
        } catch (e9) {}
      };
      // #20: match the native header background + text colour to Unraid's active theme (dark theme ->
      // dark bg + light text; light theme -> light bg + dark text). Reads the theme's real body colour.
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
      // #2 (user): "Anzeige — Kopfbereich" is no longer its own card — its rows are merged INTO the Theming card.
      var cCard = themingCard;
      (function () {
        // #Native-Card (user): label + (i) bubble on the left, a SHORT button next to it on the right (not a full-width button below).
        var r = el("div", "cc-set-row cc-set-inline");
        var rl = el("span", "cc-set-lblwrap");
        rl.appendChild(el("span", null, T("Native Anzeige-Seite", "Native display page")));
        rl.appendChild(infoIcon(T("Öffnet Unraids Anzeige-Einstellungen (im CannonadeCommand-Stil) — dort liegen u. a. die Kopfzeilen-Farben, Banner und die Favoriten-Option.", "Opens Unraid's Display Settings (in CannonadeCommand style) — home of the header colours, banner and favourites option.")));
        r.appendChild(rl);
        var b = el("button", "cc-btn cc-btn-accent", T("Öffnen", "Open")); b.type = "button";
        b.style.marginLeft = "auto";   // #3 (user): push the native-settings button flush right
        b.addEventListener("click", function () { location.href = "/Settings/DisplaySettings"; });
        r.appendChild(b); cCard.appendChild(r);
        var ar = el("div", "cc-set-row cc-set-inline");
        var arl = el("span", "cc-set-lblwrap");
        arl.appendChild(el("span", null, T("Kopf-Farben ans Thema koppeln", "Match header colours to the theme")));
        arl.appendChild(infoIcon(T("AN = die Kopfzeilen-Hintergrund- und Textfarbe folgen automatisch Unraids Farbschema (dunkles Thema: dunkler Hintergrund + helle Schrift; helles Thema umgekehrt). Wirkt, wenn CannonadeCommands Kopfbereich AUS ist.", "ON = the header background + text colour follow Unraid's colour scheme automatically (dark theme: dark bg + light text; light theme reversed). Applies when CannonadeCommand's header area is OFF.")));
        ar.appendChild(arl);
        ar.appendChild(toggle(get("cc.hdrauto", "1") === "1", function (v) { set("cc.hdrauto", v ? "1" : "0"); if (v) applyHdrAuto(); }));   // #5 (user): default ON
        cCard.appendChild(ar);
        // #5: apply the theme-coupling ONCE for a fresh default-on state (only bites when the CC header area
        // is off — it just POSTs native header colours). Guarded by a one-shot flag so a reloading postDisplay
        // can't loop; the flag is set BEFORE the call.
        try { if (get("cc.hdrauto", "1") === "1" && get("cc.hdrauto.done", "0") !== "1") { set("cc.hdrauto.done", "1"); applyHdrAuto(); } } catch (e9) {}
      })();
      // #2: cCard IS themingCard now (already in the DOM) — do NOT re-append (would reorder the cards).
      // keep the favourites value in sync (drives cc.hidefavtab) — no colour pickers here anymore
      fetch("/Settings/DisplaySettings", { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
        try {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var form = null;
          Array.prototype.forEach.call(doc.querySelectorAll("form"), function (f) { var s = f.querySelector('input[name="#section"]'); if (s && s.value === "display") form = f; });
          if (!form) return;
          var fav = form.querySelector('select[name="favorites"]'); if (fav) set("cc.hidefavtab", fav.value === "no" ? "1" : "0");
          try { if (window.ccFavGateSync) window.ccFavGateSync(); } catch (eG) {}   // #3: re-gate the CC Favoriten toggle now that the real native state is known
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
          // #3-Infotext (user: "infotext in infobubble!"): the precondition rides an (i) bubble on the label, NOT inline.
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
    // Animation master, now THREE-WAY (user: "aus, normal, wild"). cc.anim = "0" off / "1" normal (subtle,
    // default) / "2" WILD (very present). cc-anim-on covers normal AND wild (the normal motion keeps running
    // in wild); cc-anim-wild layers the exuberant extras (bouncing main-tab pills on hover, springier moves).
    // Overrides the OS "reduce motion" preference (the user explicitly wants motion).
    function applyAnim() { var v = get("cc.anim", "1"); var r = document.documentElement.classList; r.toggle("cc-anim-off", v === "0"); r.toggle("cc-anim-on", v !== "0"); r.toggle("cc-anim-wild", v === "2"); }
    applyAnim();   // stamp immediately so the settings page itself animates per the current setting
    // Lives inside the Theming card (like Density), as a 3-way segmented control.
    if (themingCard) {
      themingCard.appendChild(segRow(T("Animationen", "Animations"),
        [["0", T("Aus", "Off")], ["1", T("Normal", "Normal")], ["2", T("Wild", "Wild")]],
        get("cc.anim", "1"),
        function (v) { set("cc.anim", v); applyAnim(); },
        T("Aus = keine Animationen. Normal = dezente Übergänge, Hover-Effekte und Einblendungen (überschreibt das OS-„Bewegung reduzieren“). Wild = sehr präsente Effekte, z. B. hüpfende Hauptleisten-Tabs beim Überfahren.", "Off = no animations. Normal = subtle transitions, hovers and fades (overrides the OS 'reduce motion'). Wild = very present effects, e.g. bouncing main-tab pills on hover."),
        true));
    }
    // (the compact live-sync "Anzeige (Unraid, live)" card is built above; everything else lives natively)
    // ── section order = the USER'S main-menu order. header.js persists the drag-reordered
    // menu as cc.navorder.all {left:[href keys],right:[...]}; read DEFENSIVELY (accept .left
    // or a plain array; absent/garbage -> native menu order fallback below).
    var NAVDEF = ["Start", "Favorites", "Freigaben", "Einstellungen", "Docker", "Plugins", "VMs", "Werkzeuge", "Stats", "Apps"];
    var navOrder = NAVDEF;
    try { var no9 = JSON.parse(get("cc.navorder.all", "null")); var arr9 = no9 && no9.left ? no9.left : no9; if (arr9 && arr9.length && typeof arr9.forEach === "function") navOrder = arr9; } catch (e9b) {}
    // #7 STRICT + LIVE: read the ACTUAL on-screen menu order first (the user's live drag result), so the CC
    // sub-tabs always mirror the main tabs exactly — persisted snapshot / hardcoded default are only fallbacks.
    try {
      var liveToks9 = [];
      Array.prototype.forEach.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]"), function (a9) {
        var h9 = (a9.getAttribute("href") || "").replace(/^\//, "").split(/[/?#]/)[0].toLowerCase();
        if (h9 && liveToks9.indexOf(h9) < 0) liveToks9.push(h9);
      });
      if (liveToks9.length >= 2) navOrder = liveToks9;   // trust the live menu whenever it yields a real ordering
    } catch (e9x) {}
    // one normalised token per entry: "/Docker" == "Docker" == "docker" (hrefs, labels alike)
    var navToks = [];
    navOrder.forEach(function (k9) { navToks.push(String(k9).replace(/^\//, "").split(/[/?#]/)[0].toLowerCase()); });
    function navRank(aliases) { var best = -1; aliases.forEach(function (a9) { var i9 = navToks.indexOf(a9); if (i9 >= 0 && (best < 0 || i9 < best)) best = i9; }); return best; }
    // fixed head: Allgemein first, Kopfbereich second (chrome, not a menu tab). The tab
    // sections follow the menu order; tabs missing from it keep native relative order at the
    // END. Each section carries a STABLE id — cc.settab persists that id, never the index.
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
      localStorage.setItem("cc.settab", SECS[i].id); // stable id, NOT the index — a menu reorder must never restore the wrong tab
      SECS.forEach(function (sc, j) { sc.w.style.display = j === i ? "" : "none"; tabBtns[j].classList.toggle("cc-set-tab-on", j === i); });
      paintSetTabs();
      ccSetAlignSearch();
    }
    // #28 (user: "in den cc settings ist der suchbutton bei breitem browserfenster zu weit rechts"): the
    // hero row (icon/title left, search badge right via margin-left:auto) spans the FULL settings width,
    // but .cc-set-wrap is a FIXED-340px-column grid that does NOT stretch on a wide window (T2, by design —
    // packed from the left) — so on a wide window the badge sits far past wherever the cards actually end,
    // and by how much depends on which tab is active (different tabs have different card counts) and the
    // viewport width. Self-correcting, same idea as header.js ccAppsAlignRight(), but on the BADGE's own
    // margin-right, not the hero's padding: .cc-set-hero is box-sizing:content-box with flex-shrink:1, so
    // padding-right there gets silently absorbed into the content width instead of moving the border-box
    // edge (proved live: adding it never changed hero's own getBoundingClientRect().right at all) — a
    // cur+delta correction against that non-moving reference compounds larger every call instead of
    // converging. Reset-then-remeasure avoids that entirely: clear any earlier correction, measure the
    // badge's now-natural position, then pull it in by exactly the one delta needed this time.
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
    // render() re-runs on every settings change (root.innerHTML = "" at the top rebuilds .cc-set-hero/
    // -searchbadge/-card from scratch each time), so a resize listener bound straight to THIS call's
    // ccSetAlignSearch goes stale the moment render() runs again — proved live: it kept calling the FIRST
    // render's closure, whose SECS entries pointed at already-removed wrap elements (0 cards found,
    // contentRight stayed 0, the early-return made it a silent no-op), while tab clicks stayed correct only
    // because their onclick is rebound fresh every render(). Route through a window-level pointer that
    // every render() call reassigns, so whichever listener fired always calls the CURRENT version.
    window.__ccSetAlignSearch = ccSetAlignSearch;
    if (!window.__ccSetAlignResize) {
      window.__ccSetAlignResize = true;
      var alignTimer = null;
      window.addEventListener("resize", function () { clearTimeout(alignTimer); alignTimer = setTimeout(function () { window.__ccSetAlignSearch(); }, 120); });
    }
    // rainbow: colour EVERY settings tab per palette index (was: only the accent-filled active tab, so
    // rainbow never reached the CC tab bar). palG() is the shared rainbow palette; idealText is hoisted.
    function paintSetTabs() {
      var rb = get("cc.rainbow", "0") === "1";
      // reactive sub-mode: idle tabs rest on the grey base CSS and only carry their palette
      // colour as vars (--cc-rb-c/--cc-rb-ct — the docker.css :hover rule paints from them);
      // the ACTIVE tab keeps its direct colour.
      var reactive = rb && get("cc.rbmode", "all") === "active";
      // palG() is scoped inside buildStyleCards, not reachable here -> read the palette directly.
      var DEF = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"], p = DEF;   /* #1: jewel palette (shared) so the tab strip matches the live UI when cc.rbpal is unset */
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
    alignSetTabs(); // indent the strip to the first main-menu tab (internally try/catch'd, can't break the build)
    root.appendChild(wrapMain); root.appendChild(wrapStart); root.appendChild(wrapHeader); root.appendChild(wrapShares); root.appendChild(wrap); root.appendChild(wrapPlugin); root.appendChild(wrapVms); root.appendChild(wrapSettings); root.appendChild(wrapTools); root.appendChild(wrapFavorites);
    root.appendChild(verLine); // #14 (user): the UI/Engine version sits at the very BOTTOM (a sibling AFTER every wrap; the cards fill the wraps above it)

    // ── Badges ──
    // (flag/rainbow palette split migration runs at module load — see migrateFlagPalette near the top.)
    var c1 = card(T("Badges", "Badges"), T("Akzentfarbe und Farbmodus der Badges.", "Accent colour and colour mode of the badges."));
    // The colour-picker field stays ALWAYS visible, PLUS a hex text field beside it;
    // both edit the same value and stay in sync.
    // picker sits DIRECTLY under the card sub in BOTH colour cards (same height), full
    // card width, hex field BELOW it — no "Akzentfarbe" label (the card title says it).
    var prow = el("div", "cc-set-pickrow");
    // PERMANENTLY EMBEDDED picker (an <input type=color> opens the OS colour dialog in
    // its own window — "ich will das Farbwählfeld fest integriert").
    var hexIn = el("input", "cc-set-hexin"); hexIn.type = "text"; hexIn.value = accent; hexIn.placeholder = "#2f6feb"; hexIn.maxLength = 7; hexIn.spellcheck = false;
    // the global accent handlers must ALSO push the new colour onto the live bars (header + shares
    // use their OWN isolated vars, so setting --cc-accent here alone doesn't reach them) — this is
    // why "the global colour didn't apply everywhere": the menu bar / Freigaben only updated on
    // reload. syncHeaderBar/syncSharesBar re-run their apply() so every enabled area follows live.
    var pick = inlinePicker(/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#2f6feb", function (v) { accent = v; hexIn.value = v; set("cc.accent", v); root.style.setProperty("--cc-accent", v); root.style.setProperty("--cc-accent-text", idealText(v)); paintPrev(); syncSwOn(); syncAllStyleCards(); syncHeaderBar(); syncSharesBar(); });
    function setAccent(v) { accent = v; pick._set(v); hexIn.value = v; set("cc.accent", accent); root.style.setProperty("--cc-accent", accent); root.style.setProperty("--cc-accent-text", idealText(accent)); paintPrev(); syncSwOn(); syncAllStyleCards(); syncHeaderBar(); syncSharesBar(); }
    hexIn.addEventListener("input", function () { var v = normHex(hexIn.value); if (v) setAccent(v); });
    prow.appendChild(pick); c1.appendChild(prow);   // #1/#2: colour field + hue slider (both live in the inline picker)
    // #18 (user): the preset swatches FILL the row (flex:1 each) with the HEX field as the rightmost
    // cell — exactly like the rainbow row's swatches + reset. Identical layout for EVERY colour picker
    // (the per-area cards use the same shape below).
    // cc-set-swrow-global marks THE global accent row. syncSwOn() used to sweep every .cc-set-sw on
    // the page and re-mark it against the GLOBAL accent, which silently un-marked every AREA card's
    // own picked swatch the moment the global colour changed (an area on its own colour was then
    // showing no selection at all). One class, one scope, and the area cards mark their own rows.
    var srow = el("div", "cc-set-swatches cc-fill cc-set-swrow-global");
    PRESETS.slice(0, 7).forEach(function (c) {   // #5: 7 presets + hex(2 cells) = 9 cells, matching the rainbow/flag rows (8 + reset)
      // a <span>, NOT a <button>: Unraid's global button CSS was bloating these into
      // big bordered rectangles. dataset.c lets syncSwOn highlight the active one.
      var sw = el("span", "cc-set-sw"); sw.setAttribute("data-tip", c); sw.style.background = c; sw.dataset.c = c;
      swMark(sw, c === accent, c);   // ONE selected-mark helper (tick + ink), never a size change
      sw.addEventListener("click", function () { accent = c; set("cc.accent", accent); render(); syncHeaderBar(); syncSharesBar(); });
      srow.appendChild(sw);
    });
    srow.appendChild(hexIn); c1.appendChild(srow);   // hex field = rightmost cell of the swatch row
    // (Badge-Form was here; MOVED to #11, just above the "Zustandsanzeigen" toggle — see below)
    // #17: Rainbow-Modus and Flaggen-Modus are TWO mutually-exclusive palette modes sharing ONE colour
    // engine. cc.rainbow="1" is the master "a palette is active" flag every reader checks; cc.flagmode="1"
    // means the ACTIVE palette is a country flag (else the rainbow palette). rbOnly = rainbow is the
    // active mode. Turning one on turns the other off; the UI greys the inactive one out (user call).
    var flagOn = get("cc.flagmode", "0") === "1";
    var rbOnly = rainbow && !flagOn;
    // rainbow toggle: label + switch adjacent (no parenthetical, no far-right spacer)
    var rr = el("div", "cc-set-row cc-set-inline");
    rr.appendChild(el("span", null, T("Regenbogen-Modus", "Rainbow mode")));
    rr.appendChild(toggle(rbOnly, function (v) { set("cc.rainbow", v ? "1" : "0"); set("cc.flagmode", "0"); if (!v) set("cc.rainbowrot", "0"); render(); syncHeaderBar(); syncSharesBar(); }));
    // user: the two MASTER toggles stay clickable and flip each other — turning Rainbow on turns Flaggen-Modus
    // off (handler above sets cc.flagmode=0) and vice versa; NO greying of the master row.
    c1.appendChild(rr);
    // (T1: the single "Reaktiver Modus" toggle now lives directly ABOVE the "Zustandsanzeigen nativ
    //  färben" toggle below — one toggle for ALL colour modes, not a per-mode duplicate.)
    // rotation toggle: on = every tab reload deals a fresh colour mapping; off = stable colours
    var rrot = el("div", "cc-set-row cc-set-inline");
    var rrotL = el("span", "cc-set-lblwrap");
    rrotL.appendChild(el("span", null, T("Automatische Farbenrotation", "Automatic colour rotation")));
    rrotL.appendChild(infoIcon(T("Mischt die Rainbow-Farben bei jedem Neuladen der Seite neu durch, statt die Reihenfolge fest zu lassen.", "Reshuffles the rainbow colours on every page reload instead of keeping the order fixed.")));
    rrot.appendChild(rrotL);
    rrot.appendChild(toggle(get("cc.rainbowrot", "1") !== "0", function (v) { set("cc.rainbowrot", v ? "1" : "0"); syncHeaderBar(); syncSharesBar(); }));
    if (!rbOnly) { rrot.style.opacity = ".4"; rrot.style.pointerEvents = "none"; } // only with rainbow mode
    c1.appendChild(rrot);
    // EVERY rainbow palette colour is editable: click a swatch, adjust it in the
    // embedded picker below; stored as cc.rbpal (JSON), read live by the Docker tab.
    var RBDEF = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"]; // #1: the editable swatches DEFAULT to the shared jewel palette (was crayon -> the swatches/preview disagreed with the live UI, and any edit persisted the crayon set to cc.rbpal, flipping the whole UI to crayon)
    var rbpal = null; try { rbpal = JSON.parse(get("cc.rbpal", "null")); } catch (e) { rbpal = null; }
    if (!rbpal || rbpal.length !== RBDEF.length) rbpal = RBDEF.slice();
    // #7: no "Rainbow-Farben" heading — the swatches sit directly under the rotation toggle.
    var rbrow = el("div", "cc-set-swatches cc-fill");
    var rbPick = null, rbIdx = -1, rbPickWrap = el("div", "cc-set-pickrow"); rbPickWrap.style.display = "none";
    rbpal.forEach(function (cx, ix) {
      var sw = el("span", "cc-set-sw"); sw.style.background = cx; sw.setAttribute("data-tip", cx);
      sw.addEventListener("click", function () {
        rbIdx = ix; rbPickWrap.style.display = "";
        if (!rbPick) {
          rbPick = inlinePicker(rbpal[ix], function (v) { if (rbIdx >= 0) { rbpal[rbIdx] = v; rbrow.children[rbIdx].style.background = v; rbrow.children[rbIdx].setAttribute("data-tip", v); set("cc.rbpal", JSON.stringify(rbpal)); syncHeaderBar(); syncSharesBar(); } });   // rainbow palette is its own key now — editing it never touches the flag
          rbPickWrap.appendChild(rbPick);
        } else rbPick._set(rbpal[ix]);
      });
      rbrow.appendChild(sw);
    });
    // icon-only undo arrow RIGHT of the swatches (user: "statt dem badge ... nur so ein rueckgaengig pfeil")
    var rbReset = el("span", "cc-set-ibtn");
    rbReset.setAttribute("data-tip", T("Farben zurücksetzen", "Reset colours"));
    var rbRi = document.createElement("i"); rbRi.className = "fa fa-undo"; rbReset.appendChild(rbRi);
    rbReset.addEventListener("click", function () { del("cc.rbpal"); render(); syncHeaderBar(); syncSharesBar(); });
    rbrow.appendChild(rbReset);
    c1.appendChild(rbrow); c1.appendChild(rbPickWrap);
    if (!rbOnly) { [rbrow, rbPickWrap].forEach(function (e9) { e9.style.opacity = ".4"; e9.style.pointerEvents = "none"; }); }   // rainbow palette editor belongs to rainbow mode
    // ── FLAGGEN-MODUS (#17): a SEPARATE mode with its OWN toggle, reactive toggle, picker and colour
    // display, mutually exclusive with Rainbow (each greys the other). A country's flag colours become
    // the active palette (cc.rbpal, cycled to 8 slots) that drives the SAME engine. The picker draws the
    // flag COLOURS as stripe-swatches + searches by name — the emoji flags render as "DE"/"AF" letter
    // codes on Windows, so colour swatches are shown instead. Data: window.CC_FLAGS (scripts/flags.js).
    if (window.CC_FLAGS && window.CC_FLAGS.length) {
      var FLAG_BASE = "/plugins/cannonadecommand/images/flags/";
      // #2: the REAL flag (flag-icons 4:3 SVG, bundled) — a country's actual pattern, not colour bars.
      // Falls back to the colour-stripe swatch if the SVG is missing (e.g. a code we don't ship).
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
      // Flag palette is its OWN key (cc.flagpal), NEVER the rainbow cc.rbpal — so the rainbow editor
      // keeps the rainbow colours and the engine only paints flag colours when cc.flagmode==="1".
      var applyFlag = function (f9) { var pal = []; for (var k9 = 0; k9 < RBDEF.length; k9++) pal.push(f9.colors[k9 % f9.colors.length]); set("cc.flag", f9.code); set("cc.flagpal", JSON.stringify(pal)); };
      // flag master toggle (mutually exclusive with Rainbow)
      var fr = el("div", "cc-set-row cc-set-inline");
      fr.appendChild(el("span", null, T("Flaggen-Modus", "Flag mode")));
      fr.appendChild(toggle(flagOn, function (v) {
        if (v) { set("cc.flagmode", "1"); set("cc.rainbow", "1"); var f0 = curFlag() || window.CC_FLAGS.filter(function (x9) { return x9.code === "de"; })[0] || window.CC_FLAGS[0]; applyFlag(f0); }
        else { set("cc.flagmode", "0"); set("cc.rainbow", "0"); }
        render(); syncHeaderBar(); syncSharesBar();
      }));
      // NOT greyed while Rainbow is active — the master toggle stays clickable; turning Flaggen-Modus on
      // sets cc.flagmode=1 (+cc.rainbow=1 for the engine) so Rainbow-only display flips off, and vice versa.
      c1.appendChild(fr);
      // (T1: no separate reactive-flag toggle any more — the ONE "Reaktiver Modus" toggle above the
      //  "Zustandsanzeigen nativ färben" toggle governs every colour mode, flag included.)
      // #4: the picker sits DIRECTLY under the Flaggen-Modus toggle — NO "Land wählen" heading — and the
      // reactive-flag toggle (fmode, built above) is appended AFTER the picker (see below).
      // custom flag picker: real flag image + name, searchable (native <select> can't show flag images).
      var picker = el("div", "cc-flag-picker");
      var trigger = el("div", "cc-flag-trigger"); trigger.setAttribute("tabindex", "0");
      // #8: the picker reads as a BUTTON (no little caret arrow) — a solid CC control you click to pick a country.
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
          // picking a flag ACTIVATES flag mode (and thus flips Rainbow off) — the picker now lives in the
          // master row, so selecting a country should just turn the mode on.
          row.addEventListener("click", function () { set("cc.flagmode", "1"); set("cc.rainbow", "1"); applyFlag(f0); render(); syncHeaderBar(); syncSharesBar(); });
          list.appendChild(row);
        });
      };
      buildList(""); panel.appendChild(list);
      search.addEventListener("input", function () { buildList(search.value); });
      var openPanel = function () {
        panel.style.display = ""; search.value = ""; buildList("");
        // #8: escape the settings-card overflow clip — pin the panel FIXED at the trigger and cap the
        // list to the room below the trigger, so the WHOLE country list stays reachable/scrollable on hover.
        try {
          var r = trigger.getBoundingClientRect();
          panel.style.position = "fixed"; panel.style.left = Math.round(r.left) + "px"; panel.style.top = Math.round(r.bottom + 4) + "px"; panel.style.right = "auto"; panel.style.width = Math.round(r.width) + "px";
          list.style.maxHeight = Math.max(140, Math.min(300, window.innerHeight - r.bottom - 68)) + "px";
        } catch (e8) {}
        try { search.focus(); } catch (e9) {}
        var closer = function (e9) { if (!picker.contains(e9.target)) { panel.style.display = "none"; document.removeEventListener("click", closer, true); } };
        setTimeout(function () { document.addEventListener("click", closer, true); }, 0);   // self-removing click-outside (no leak across render)
      };
      var closePanel = function () { panel.style.display = "none"; try { trigger.focus(); } catch (e9) {} };
      trigger.addEventListener("click", function () { if (panel.style.display !== "none") panel.style.display = "none"; else openPanel(); });
      // GlimStone Rule 21, this page's FOURTH selection-field variant. The country picker is a closed
      // field standing for exactly one value, so it wheel-steps like every other one — it just isn't
      // <select>-backed, so cc-theme.js's shared handler (which reads a real <select>) cannot serve it
      // and the step is spelled out here against the same CC_FLAGS list the panel is built from.
      // Clamped at both ends, like the shared handler and like the panel's own arrow keys.
      // The commit is the click path's commit — same keys, same applyFlag, same syncs — but the full
      // render() is DEBOUNCED: render() rebuilds this whole page, which would tear the element out from
      // under the cursor on every notch of a gesture that is meant to be a continuous browse.
      var flagRenderT = null;
      trigger.addEventListener("wheel", function (e9) {
        if (e9.ctrlKey || e9.metaKey || e9.altKey) return;
        if (panel.style.display !== "none") return;                 // an open panel scrolls its own list
        var d9 = e9.deltaY || e9.deltaX; if (!d9) return;
        var list9 = window.CC_FLAGS, cur9 = get("cc.flag", ""), ix9 = -1;
        for (var j9 = 0; j9 < list9.length; j9++) if (list9[j9].code === cur9) { ix9 = j9; break; }
        var nx9 = ix9 < 0 ? (d9 > 0 ? 0 : list9.length - 1) : ix9 + (d9 > 0 ? 1 : -1);
        if (nx9 < 0 || nx9 >= list9.length) return;                 // clamped: let the page scroll instead
        e9.preventDefault();
        set("cc.flagmode", "1"); set("cc.rainbow", "1"); applyFlag(list9[nx9]);
        renderTrigger();                                            // the field repaints exactly as a pick would
        syncHeaderBar(); syncSharesBar();
        clearTimeout(flagRenderT); flagRenderT = setTimeout(function () { render(); }, 450);
      }, { passive: false });
      // #25: keyboard-operable — Enter/Space/ArrowDown on the trigger opens; then arrows move the
      // highlight, Enter picks, Escape closes. The search already matches name_de / English name / code.
      trigger.addEventListener("keydown", function (e9) { if (e9.key === "Enter" || e9.key === " " || e9.key === "ArrowDown") { e9.preventDefault(); openPanel(); } });
      var moveSel = function (dir) { var items = list.querySelectorAll(".cc-flag-item"); if (!items.length) return; var cur = list.querySelector(".cc-flag-item.cc-sel"); var idx = cur ? Array.prototype.indexOf.call(items, cur) : -1; idx += dir; if (idx < 0) idx = 0; if (idx >= items.length) idx = items.length - 1; if (cur) cur.classList.remove("cc-sel"); items[idx].classList.add("cc-sel"); items[idx].scrollIntoView({ block: "nearest" }); };
      search.addEventListener("keydown", function (e9) { if (e9.key === "ArrowDown") { e9.preventDefault(); moveSel(1); } else if (e9.key === "ArrowUp") { e9.preventDefault(); moveSel(-1); } else if (e9.key === "Enter") { e9.preventDefault(); var sel = list.querySelector(".cc-flag-item.cc-sel") || list.querySelector(".cc-flag-item"); if (sel) sel.click(); } else if (e9.key === "Escape") { e9.preventDefault(); closePanel(); } });
      picker.appendChild(trigger); picker.appendChild(panel);
      fr.insertBefore(picker, fr.lastChild);   // user: the flag picker sits BETWEEN the "Flaggen-Modus" label and its toggle
      // (T1: reactive-flag toggle removed — see the single Reaktiver Modus toggle above statenative)
      // the selected flag's COLOURS, shown separately (not the rainbow editor)
      var f1 = curFlag();
      if (f1) {
        c1.appendChild(el("div", "cc-set-lbl", T("Flaggenfarben", "Flag colours")));
        // #3: the colour fields stretch to fill the card width (each cc-set-sw flex:1) + a reset icon
        // pushed to the far right, in line with the toggle switches. Reset clears the flag selection.
        var frow = el("div", "cc-set-swatches cc-fill");
        // #10: show the SAME count as the rainbow row (8), cycled from the flag's colours — matches
        // the cc.flagpal the engine paints and keeps both rows visually consistent.
        var fpal = []; for (var kf = 0; kf < RBDEF.length; kf++) fpal.push(f1.colors[kf % f1.colors.length]);
        fpal.forEach(function (c9) { var sw9 = el("span", "cc-set-sw"); sw9.style.background = c9; sw9.setAttribute("data-tip", c9); frow.appendChild(sw9); });
        var fReset = el("span", "cc-set-ibtn"); fReset.setAttribute("data-tip", T("Flagge zurücksetzen", "Reset flag"));
        var fRi = document.createElement("i"); fRi.className = "fa fa-undo"; fReset.appendChild(fRi);
        fReset.addEventListener("click", function () { del("cc.flag"); del("cc.flagpal"); set("cc.flagmode", "0"); set("cc.rainbow", "0"); render(); syncHeaderBar(); syncSharesBar(); });
        frow.appendChild(fReset);
        c1.appendChild(frow);
      }
      // (T1: the reactive-flag sub-toggle was removed — the single Reaktiver Modus toggle above statenative
      //  covers flag mode too, so there is nothing to grey out here any more.)
    }
    // #11 (user): Badge-Form sits here — below the flag colours, above the state-colour toggle. segRow
    // already puts the label + options on ONE row; options are ordered by ASCENDING roundness.
    c1.appendChild(segRow(T("Badge-Form", "Badge shape"), [["square", T("eckig", "square")], ["rounded", T("abgerundet", "rounded")], ["pill", "Pills"], ["circle", T("Kreise", "Circles")]], get("cc.badgeshape", "pill"), function (v) { set("cc.badgeshape", v); applyShape(); syncHeaderBar(); syncSharesBar(); }));
    // #9 (user: "eine Auswahl für flat und glass … damit man es ein und abschalten kann"): ONE global badge
    // STYLE. Glass adds a glossy sheen (top highlight + inner edge + backdrop blur) to EVERY badge at once
    // (html.cc-badge-glass); flat is the solid look. Sits right under Badge-Form (both are badge-look axes).
    c1.appendChild(segRow(T("Badge-Stil", "Badge style"), [["flat", "Flat"], ["glass", "Glass"]], get("cc.badgeglass", "0") === "1" ? "glass" : "flat", function (v) { set("cc.badgeglass", v === "glass" ? "1" : "0"); document.documentElement.classList.toggle("cc-badge-glass", v === "glass" && get("cc.theming", "1") !== "0"); syncHeaderBar(); syncSharesBar(); }));
    // (#12: the curated palette-presets block was removed per user request)
    // #16 (user): let STATE indicators keep their NATIVE state colour (green/amber/red) instead of
    // folding into the accent/rainbow/flag palette. Default OFF = integrated (current look). ON stamps
    // html.cc-state-native; the sheets then let the native semantic colours through.
    // SCOPE (narrowed by the state-dot law — see the long comment in styles/docker.css): this governs the
    // indicators where colour is a REDUNDANT second channel and can be spent on decoration — usage bars
    // (value = fill LENGTH), plugin status badges and container update badges (value = TEXT). The state
    // DOTS are no longer in it: a font-size:0 dot has no text and no length, so folding its colour into the
    // palette doesn't integrate it, it erases it (live-measured: 38 running and 20 stopped containers all
    // on the same rgb(94,137,201)). Dots are unconditionally native now, in every colour mode.
    // T1: the ONE reactive-mode toggle for ALL colour modes (rainbow / flag / normal). Rests everything
    // grey, colours on hover, the active one stays lit. Sits directly ABOVE the state-native toggle (user).
    var rmode = el("div", "cc-set-row cc-set-inline");
    var rmodeL = el("span", "cc-set-lblwrap");
    rmodeL.appendChild(el("span", null, T("Reaktiver Modus", "Reactive mode")));
    rmodeL.appendChild(infoIcon(T("AN = alles ruht grau und färbt sich beim Überfahren; Aktives bleibt farbig. Gilt global für ALLE Farbmodi (Regenbogen, Flagge und Normal) und alle Bereiche inklusive Logo-Hintergründen.", "ON = everything rests grey and colours on hover; active stays coloured. Global across EVERY colour mode (rainbow, flag and normal) and every area, logo backgrounds included.")));
    rmode.appendChild(rmodeL);
    rmode.appendChild(toggle(get("cc.rbmode", "all") === "active", function (v) { set("cc.rbmode", v ? "active" : "all"); paintSetTabs(); syncHeaderBar(); syncSharesBar(); }));
    c1.appendChild(rmode);
    var snR = el("div", "cc-set-row cc-set-inline");
    var snL = el("span", "cc-set-lblwrap");
    snL.appendChild(el("span", null, T("Zustandsanzeigen nativ färben", "Native state colours")));
    snL.appendChild(infoIcon(T("AN = Auslastungsbalken und Status-Badges behalten ihre native Zustandsfarbe (grün/gelb/rot). AUS = sie werden in den aktuellen Farbmodus (Akzent/Regenbogen/Flagge) integriert. Zustands-Punkte (Container, Laufwerke) sind immer nativ — bei ihnen ist die Farbe die einzige Information.", "ON = usage bars and status badges keep their native state colour (green/amber/red). OFF = they fold into the current colour mode (accent/rainbow/flag). State dots (containers, drives) are always native — for them the colour is the only information there is.")));
    snR.appendChild(snL);
    snR.appendChild(toggle(get("cc.statenative", "0") === "1", function (v) { set("cc.statenative", v ? "1" : "0"); syncHeaderBar(); syncSharesBar(); }));
    c1.appendChild(snR);
    c1.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
    var prev = el("div", "cc-set-prev");
    // #13: a RICHER preview — eight mixed badges (name headlines, key/value pairs, a tab pill) so the
    // full palette sweep is visible, not just three. paintPrev colours each child by index.
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
    wrapMain.appendChild(c1); // GLOBAL badge colour + rainbow -> the "Allgemein" tab (was the Docker tab)
    // ── Dichte (GLOBAL): cc.density is ONE key that every list (Docker, Start, Freigaben) reads,
    // so it belongs in Allgemein with the other global controls — not buried in the Docker tab.
    // #12 (user): the Density control lives INSIDE the Theming card now — no separate card.
    if (themingCard) themingCard.appendChild(segRow(T("Dichte", "Density"), [["compact", T("Kompakt", "Compact")], ["normal", "Normal"], ["airy", T("Luftig", "Airy")]], density, function (v) { density = v; set("cc.density", v); }, T("Gilt global für ALLE Listen (Docker, Start, Freigaben, VMs).", "Applies globally to ALL lists (Docker, Start, Shares, VMs)."), true));
    // ── Kachelgröße (GLOBAL): cc.sgsize is ONE key read by docker.js/plugins.js/vms.js/favorites.js/settingsgrid.js.
    // It belongs here in Allgemein next to Density — NOT duplicated per tab (user: "global einstellbar, nicht per tab").
    if (themingCard) themingCard.appendChild(tileSizeRow());   // hoisted (defined below); onChange still live-resizes the Docker preview
    // ── Logos & Icons (GLOBAL): edits the shared cc.iconbg / cc.iconcolor / cc.iconstrength
    // keys every adopting tab resolves through eff('icon…'). Same control set as the per-area
    // Logos cards — and, since 4.32.0, the same PREVIEW. It used to have none on the reasoning
    // that "this card is the source, not a consumer", which is true of the DATA and false of the
    // user: this is where Icon-Färbung lives, so the one card that decides how every logo in the
    // whole plugin is treated was the one card that showed no logo at all. Three sections, one per
    // area, each with that area's REAL icons.
    (function () {
      var cLI = card(T("Logos & Icons", "Logos & icons"), T("Globale Logo-/Icon-Farben. Tabs mit aktivem 'Globale Badge-Farbe übernehmen' folgen auch hier.", "Global logo/icon colours. Tabs adopting the global colour follow these too."));
      // the three live previews (built at the bottom of this card); repainted by every control here
      var gPrevs = [];
      function gpaint() {
        var acc9 = get("cc.accent", "#2f6feb");
        var strn = parseInt(get("cc.iconstrength", "100"), 10) || 100;
        // Adopting (v4.33.1): the preview has no Rainbow-rotation simulation (never did) —
        // approximate the resolved background with the accent, same fidelity as the real
        // "Rainbow off" case. The ink is then the AUTOMATIC black/white contrast for THAT
        // approximated background (idealText), never the accent hue itself — matching iconInk()'s
        // new master-adopt branch — and forced on (tint: true) since it no longer depends on
        // Einfärben's own on/off while adopting.
        var adopt9 = get("cc.iconbgrainbow", "0") === "1";
        gPrevs.forEach(function (p9) { try { p9.set({ bg: get("cc.iconbg", "0") === "1", bgColor: adopt9 ? acc9 : get("cc.iconbgcolor", ""), tint: adopt9 ? true : gTintOnEff(), color: adopt9 ? idealText(acc9) : get("cc.iconcolor", ""), strength: strn, accent: acc9, size: "48px" }); } catch (e9) {} });
      }
      function gsync() { gpaint(); syncAllStyleCards(); syncHeaderBar(); syncSharesBar(); } // adopt-ON area cards repaint with the new globals
      // Einfärben on/off, unset falling back to the pre-4.32.5 reading (a valid cc.iconcolor
      // implicitly meant "tint on") — see cc.icontint's doc comment in docker.js's iconInk().
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
        // #(user: "der infotext ist unverständlich"). The old text named the two treatments and their
        // internal labels without ever saying WHY there are two, so it read as jargon. This one starts
        // from the problem: a logo is either one solid shape or a little picture, and the two need
        // opposite handling. Short enough for a bubble (Rule 8) — no wall of text.
        T("Ein Logo ist entweder eine einzelne durchgehende Form oder ein kleines mehrfarbiges Bild. Eine Form kann man komplett in deiner Farbe nachzeichnen und sie bleibt erkennbar; ein Bild würde dabei zum Farbklecks, weil Hintergrund und Motiv dieselbe Farbe bekämen. Darum zwei Behandlungen:\n\nAutomatisch (empfohlen) — CannonadeCommand sieht sich jedes Logo an: Formen werden nachgezeichnet (für bekannte Programme wird dafür sogar ein echtes Marken-Logo geholt), Bilder nur eingefärbt.\nNatives Icon — nichts einfärben, jedes Logo bleibt wie geliefert.\nInk-Flatten — alles nachzeichnen, auch Bilder.\nLuminanz-Tint — alles nur einfärben, auch Formen.\n\nEinzelne Container, VMs und Plugins kannst du in ihrem eigenen Fenster abweichend einstellen; diese Einzelwahl gewinnt immer gegen die Einstellung hier.",
          "A logo is either one solid shape or a small multi-colour picture. A shape can be redrawn entirely in your colour and stays recognisable; a picture would turn into a blob, because its background and its mark would end up the same colour. Hence two treatments:\n\nAutomatic (recommended) — CannonadeCommand looks at each logo: shapes are redrawn (for well-known apps a real brand logo is even fetched to redraw), pictures are only tinted.\nNative icon — no colouring, every logo stays as shipped.\nInk flatten — redraw everything, pictures included.\nLuminance tint — only tint everything, shapes included.\n\nIndividual containers, VMs and plugins can be set differently in their own window; that per-item choice always wins over the setting here.")));
      // ── the three PREVIEW sections: Docker · VMs · Plugins, each with that area's REAL icons.
      // Every one of them runs the SAME pipeline the real tab runs, so switching Icon-Färbung above
      // is visible right here without leaving the Allgemein tab.
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
        // ONE mechanism for all three: ask the very same row-fragment endpoint that area's own
        // page asks (see rowIcons above — fetching /Docker, /VMs or /Plugins themselves can only
        // ever return the empty pre-JS skeleton). Best-effort: an empty answer just shows the line.
        rowIcons(sec9[0], 4).then(fill9);
      });
      gpaint();
      wrapMain.appendChild(cLI);
    })();
    // Docker is now a normal area like the others: a "Stil" adopt card + its OWN Badges (accent)
    // card at the TOP of the Docker tab. buildStyleCards writes ccd.accent; docker.js reads it via
    // effc() (adopt on = follow global cc.accent, the default -> no change for existing installs).
    var cD = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cD.appendChild(styleToggle("cc.styledocker", null));
    wrap.appendChild(cD);
    buildStyleCards("ccd.", wrap, [], true);

    // ── Logos (background + tint, two INDEPENDENT controls — see logoToggles()) ──
    var c2 = card(T("Logos", "Logos"), T("Die Schalter aktivieren Hintergrund und Icons unabhängig voneinander — jeder hat seine eigene Farbe.", "The switches turn Background and Icons on independently — each has its own colour."));
    // Einfärben on/off, unset falling back to the pre-4.32.5 reading (a valid cc.iconcolor
    // implicitly meant "tint on") — mirrors gTintOnEff() in the global Logos & Icons card
    // (this Docker card edits the SAME global cc.* keys, not a ccd.-scoped copy).
    function c2TintOnEff() { var v = get("cc.icontint", null); return v == null ? !!get("cc.iconcolor", "") : v === "1"; }
    function c2OnChange() {
      var on = get("cc.iconbg", "0") === "1";
      c2.classList.toggle("cc-bg-mode", on);
      tprevWrap.classList.toggle("cc-prev-bg", on);
      try { tintPrev(); } catch (e9) {}
      syncAllStyleCards(); // global cc.icon* changed -> adopt-ON area cards follow
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
      // v4.35.0 (item 5, jdp: the adopt toggle is redundant per-area — only need it globally):
      // already read/wrote the GLOBAL key unconditionally, so getAdopt/setAdopt need no change —
      // only hideAdoptRow, so the Docker card no longer shows its OWN copy of this switch.
      getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
      setAdopt: function (v) { set("cc.iconbgrainbow", v ? "1" : "0"); },
      getAccent: function () { return get("cc.accent", "#2f6feb"); },
      onChange: c2OnChange,
      hideAdoptRow: true
    });
    c2LT.strInput.value = String(iconstrength);
    c2LT.strInput.addEventListener("input", function () { iconstrength = parseInt(c2LT.strInput.value, 10); set("cc.iconstrength", c2LT.strInput.value); try { tintPrev(); } catch (e9) {} syncAllStyleCards(); });
    // (the VM-icons toggle is obsolete — the VM tab has its own style section)
    // cc.sgsize is GLOBAL (one key). The CONTROL now lives ONCE in Allgemein (Theming card, next to Density;
    // user: "global einstellbar, nicht per tab"). This Docker card keeps only the LIVE PREVIEW below, which
    // sizePrev() resizes whenever the global control changes.
    function tileSizeRow() {
      // #5: pass the tip through `help` so the ⓘ lands INSIDE the label, consistent with every other row.
      return segRow(T("Kachelgröße", "Tile size"), [["s", T("Klein", "Small")], ["m", T("Mittel", "Medium")], ["l", T("Groß", "Large")]], get("cc.sgsize", "m"), function (v) { set("cc.sgsize", v); try { sizePrev(); } catch (e) {} }, T("Gilt global – dieselbe Größe steuert das Einstellungen-/Werkzeuge-Raster und die Docker-/Plugin-Logos.", "Global – the same size drives the Settings/Tools grid and the Docker/Plugin logos."));   /* live-resize the Docker preview */
    }
    c2.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));   // preview stays the Docker card's last block
    // ONE shared preview (logoPreview) — the tabs' own icon pipeline, and the coloured badge on a real
    // CSS tile. The private recipe that used to sit here composited the badge with an feFlood INSIDE
    // the filter; an feFlood fills the whole filter region, so the badge came out a hard square that
    // ignored the Badge-Form, and the whole thing painted a raw tint with no regard for cc.iconmode —
    // i.e. a preview of something the Docker tab never renders.
    var dockPrev = logoPreview("docker", "cc-set-dockprev");
    var tprevWrap = dockPrev.el;
    // #5 (user: "die vorschau soll auch die kachelgröße live anzeigen"): the preview logos take the size the
    // tile-size control selects, so Klein/Mittel/Groß is reflected in the preview immediately.
    function sizePrev() { tintPrev(); }
    // REAL container logos (up to four), from the Docker tab's OWN row fragment (rowIcons) — our
    // own logo is only the fallback when the tab has nothing to show. This used to build the icon
    // URL itself out of the engine's container names ("/state/…/<name>-icon.png"), which is a guess
    // and 404s for every container Unraid has no cached icon for; the tile then hid itself and the
    // row came out with holes in it. The NAME rides along: the pipeline needs it to look a glyph up
    // and to honour a per-container pin.
    rowIcons("docker", 4).then(function (l9) {
      (l9 || []).forEach(function (it9) { dockPrev.add(it9.src, it9.name || ""); });
      if (!dockPrev.count()) dockPrev.add("/plugins/cannonadecommand/images/cannonadecommand.png", "");
      tintPrev();
    }).catch(function () { dockPrev.add("/plugins/cannonadecommand/images/cannonadecommand.png", ""); tintPrev(); });
    function tintPrev() {
      var acc9 = get("cc.accent", "#2f6feb");
      // Adopting (v4.33.1): approximate the resolved background with the accent — see gpaint()'s
      // comment above — and ink with its automatic black/white contrast, forced on regardless of
      // Einfärben's own on/off.
      var adopt9 = get("cc.iconbgrainbow", "0") === "1";
      dockPrev.set({ bg: get("cc.iconbg", "0") === "1", bgColor: adopt9 ? acc9 : get("cc.iconbgcolor", ""), tint: adopt9 ? true : c2TintOnEff(), color: adopt9 ? idealText(acc9) : get("cc.iconcolor", ""), strength: parseInt(get("cc.iconstrength", "100"), 10) || 100, accent: acc9 });
    }
    c2.appendChild(tprevWrap); tintPrev(); c2OnChange(); sizePrev();   // #5: preview is the card's LAST block now, sized to the tile-size control
    wrap.appendChild(c2);

    // (The CPU/RAM diagnostics card is built right before the Bandwidth card below,
    //  so it sits DIRECTLY above it — explicit user placement request.)

    // ── Columns matrix ──
    var c3 = card(T("Spalten / Badges je Ansicht", "Columns / badges per view"), T("Welche Badges in der einfachen und in der Advanced-Ansicht erscheinen.", "Which badges appear in the Simple and the Advanced view."));
    var tbl = el("table", "cc-set-tbl");
    var thr = el("tr"); thr.appendChild(el("th")); thr.appendChild(thc(T("Einfach", "Simple"))); thr.appendChild(thc(T("Advanced", "Advanced"))); tbl.appendChild(thr);
    COLS.forEach(function (c, i) {
      var tr = el("tr"); tr.appendChild(el("td", "cc-set-cname", c.label));
      tr.appendChild(chkCell(c.key, "s", RB[i])); tr.appendChild(chkCell(c.key, "a", RB[i])); tbl.appendChild(tr);
    });
    c3.appendChild(tbl);
    wrap.appendChild(c3);

    // ── View ──
    // (Dichte is ONE GLOBAL key and lives in the Allgemein tab now — see the global density
    //  card added to wrapMain below, so the user finds it with the other global controls.)
    var c4 = card(T("Ansicht", "View"), null);
    // "folder" always offered here (unlike the Docker-tab's own gear menu, which hides the
    // Folder toggle until real organizer folders exist — spec decision 4, a DIFFERENT, ambient
    // control surface): setMode() on the Docker tab itself already falls back to an ungrouped
    // flat Grid-look if the organizer has no folders yet, so picking "Folder" here as a deliberate
    // default preference never shows anything broken, just an unremarkable Grid until you add one.
    c4.appendChild(segRow(T("Standard-Ansicht", "Default view"), [["list", T("Liste", "List")], ["grid", T("Raster", "Grid")], ["folder", T("Ordner", "Folder")]], view, function (v) { view = v; set("cc.view", v); syncViewModeServer(v); }));
    function applyShape() { var m9 = { pill: "999px", rounded: "6px", square: "0px", circle: "999px" }; var sh9 = get("cc.badgeshape", "pill"); var r9 = m9[sh9] || "999px"; root.style.setProperty("--cc-b-radius", r9); document.documentElement.style.setProperty("--cc-b-radius", r9); document.documentElement.classList.toggle("cc-shape-circle", sh9 === "circle"); var d9 = { pill: "50%", rounded: "3px", square: "0px", circle: "50%" }[sh9] || "50%"; document.documentElement.style.setProperty("--cc-dot-r", d9); /* dot token: the preset swatches follow the badge form too (user call) */ }
    wrap.appendChild(c4);
    // Badge-Form (shape) is a single GLOBAL control in the Allgemein "Badges" card now — not per
    // area — so the Docker tab has no inline Badge-Form card either. Keep the initial applyShape()
    // so the settings page's --cc-b-radius is set on first render.
    applyShape();

    // ── Notifications (engine-side; saved to the flash) ──
    var c5 = card(T("Benachrichtigungen", "Notifications"), T("Warnungen bei Watchdog-Neustarts, fehlgeschlagenen Starts und Zeitplan-Fehlern.", "Alerts on watchdog restarts, failed starts and schedule errors."));
    c5.appendChild(toggleRow(T("Unraid-Benachrichtigungen", "Unraid notifications"), notify.unraid, function (v) { notify.unraid = v; notifyDirty = true; }));
    var wrow = el("div", "cc-set-row"); wrow.appendChild(el("span", "cc-set-rl", T("Webhook-URL", "Webhook URL")));
    var win = el("input", "cc-set-txt"); win.type = "url"; win.placeholder = "https://…"; win.value = notify.webhook || "";
    win.addEventListener("input", function () { notify.webhook = win.value.trim(); notifyDirty = true; });
    wrow.appendChild(win); c5.appendChild(wrow);
    // Save stays disabled until the current config has been read once, so we never
    // save notify over a config we haven't seen (and by then there is no in-flight
    // initial GET left to race a just-saved value back to stale).
    var save5 = el("span", "cc-btn cc-btn-primary cc-set-save" + (configLoaded ? "" : " cc-set-disabled"), configLoaded ? T("Speichern", "Save") : T("lädt…", "loading…"));
    save5.addEventListener("click", function () { if (configLoaded && !save5.classList.contains("cc-set-disabled")) saveNotify(save5); }); c5.appendChild(save5);
    wrap.appendChild(c5);

    // ── Bandwidth / network shaping (engine-side; saved to the flash) ──
    // ── Limit diagnostics: the engine's last CPU/RAM limit operations, VERIFIED ——
    // sits DIRECTLY before the Bandwidth card (explicit placement request).
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

    var c6 = card(T("Bandbreite", "Bandwidth"), T("Schnittstelle IM Container, auf der die Limits gesetzt werden. LEER = automatisch (Default-Route des Containers) — empfohlen. Pro-Container-Limits stellst du im Docker-Tab ein.", "Interface INSIDE the container the limits are applied to. BLANK = automatic (the container's default route) — recommended. Set per-container limits in the Docker tab."));
    var ifrow = el("div", "cc-set-row"); ifrow.appendChild(el("span", "cc-set-rl", T("Schnittstelle", "Interface")));
    var ifin = el("input", "cc-set-txt"); ifin.type = "text"; ifin.placeholder = T("automatisch", "automatic"); ifin.value = shapeIface; ifin.maxLength = 15; ifin.spellcheck = false; ifin.setAttribute("list", "cc-iface-list");
    var dl = el("datalist"); dl.id = "cc-iface-list"; ["eth0", "eth1", "eth2"].forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
    ifin.addEventListener("input", function () { shapeIface = ifin.value.trim(); shapeDirty = true; });
    ifrow.appendChild(ifin); ifrow.appendChild(dl); c6.appendChild(ifrow);
    var save6 = el("span", "cc-btn cc-btn-primary cc-set-save" + (configLoaded ? "" : " cc-set-disabled"), configLoaded ? T("Speichern", "Save") : T("lädt…", "loading…"));
    save6.addEventListener("click", function () { if (configLoaded && !save6.classList.contains("cc-set-disabled")) saveShape(save6); }); c6.appendChild(save6);
    wrap.appendChild(c6);

    // ── Plugin-Tab / VM-Tab sections: adopt the global badge colour there too? ──
    // Push the header area's live state onto the real top bar on THIS page (browsers don't
    // fire 'storage' in the originating document, so header.js won't hear a same-page change).
    function syncHeaderBar() { try { if (typeof window.ccHeaderApply === "function") window.ccHeaderApply(); } catch (e) {} }
    // same live push for the Freigaben tabs (no 'storage' event fires in this document)
    function syncSharesBar() { try { if (typeof window.ccSharesApply === "function") window.ccSharesApply(); } catch (e) {} }
    // adopt-key -> the area's own key prefix (for seeding its own accent on adopt-OFF)
    var ADOPT_PREF = { "cc.styleheader": "cch.", "cc.styleshares": "ccsh.", "cc.styledocker": "ccd.", "cc.styleplugin": "ccp.", "cc.stylevms": "ccv.", "cc.stylesettings": "ccs.", "cc.stylefavorites": "ccf.", "cc.stylemain": "ccm." };
    function styleToggle(key, onChange, lbl) {
      // the SAME knob switch as everywhere else (the text-in-pill variant looked wrong)
      var row = el("div", "cc-set-row cc-set-inline");
      row.appendChild(el("span", null, lbl || T("Globale Badge-Farbe übernehmen", "Adopt the global badge colour")));
      var tg = toggle(localStorage.getItem(key) !== "0", function (v) {
        localStorage.setItem(key, v ? "1" : "0");
        // Adopt OFF + this area never had its OWN colour: seed it from the CURRENT global accent, so
        // (a) the colour doesn't jump to the #2f6feb default and (b) the area's picker reflects the
        // live colour and any later edit visibly applies (the "toggle does nothing" the user hit —
        // an unset own-accent otherwise fell back to the same default as the global).
        var p = ADOPT_PREF[key];
        if (!v && p && localStorage.getItem(p + "accent") == null) set(p + "accent", get("cc.accent", "#2f6feb"));
        if (styleCardSync[key]) styleCardSync[key](); // picker/swatches/preview jump to the now-effective colour (user call)
        if (onChange) onChange(); syncHeaderBar(); syncSharesBar();
      });
      adoptToggles[key] = tg; row.appendChild(tg);
      return row;
    }
    // per-area "Tabansicht" row — lives IN the Stil card now (was its own Tab-Ansicht card).
    // INVERTED vs storage on purpose: toggle ON = cc.sections.<area> "0" (native Unraid
    // sub-tabs, the DEFAULT), toggle OFF = "1" (sub-tabs stacked as CC sections). Only areas
    // that actually HAVE sub-tabs get it: Freigaben, Start (/Main), Plugin, VM.
    function tabviewRow(area, applyFn) {
      var row = el("div", "cc-set-row cc-set-inline");
      var lw = el("span", "cc-set-lblwrap");
      lw.appendChild(el("span", null, T("Tabansicht", "Tabbed view")));
      lw.appendChild(infoIcon(T("AUS = Unterreiter dieses Tabs werden als CannonadeCommand-Abschnitte untereinander gestapelt. Unraids globale Tabansicht (Theming-Karte) ist der Master: steht sie auf 'Ohne Tabs', rendert Unraid überall Abschnitte und dieser Schalter wirkt nicht.", "OFF = this tab's sub-tabs stack as CannonadeCommand sections. Unraid's global tabbed view (Theming card) is the master: set to non-tabbed, Unraid renders sections everywhere and this switch has no effect.")));
      row.appendChild(lw);
      row.appendChild(toggle(get("cc.sections." + area, "0") === "0", function (v) { set("cc.sections." + area, v ? "0" : "1"); if (applyFn) applyFn(); }));
      return row;
    }
    var cP = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cP.appendChild(styleToggle("cc.styleplugin", null));
    cP.appendChild(tabviewRow("plugins", syncPluginsBar));
    // per-tab style controls — the SAME set as the Docker tab, active while the
    // adopt-toggle above is OFF (own key prefix per tab)
    // The Plugin/VM sections carry EXACTLY the Docker tab's style cards (same
    // picker, swatches, rainbow palette, tint toggle + strength) on their own
    // key prefix; they apply while "Adopt the Docker-tab style" is OFF.
    function buildStyleCards(P, into, samples, noLogos) {
      // Picking a colour in an area's card means "this area uses its OWN style" — so turn its
      // adopt toggle OFF (else eff() keeps reading the global cc.* accent and the pick is
      // ignored, the "colour not applied to the menu" bug). Reflected live on the toggle +
      // the real header bar. Turn adopt back ON to re-follow the global Docker accent.
      var ADOPT = { "ccd.": "cc.styledocker", "ccp.": "cc.styleplugin", "ccv.": "cc.stylevms", "cch.": "cc.styleheader", "ccs.": "cc.stylesettings", "ccsh.": "cc.styleshares", "ccf.": "cc.stylefavorites", "ccm.": "cc.stylemain" };
      var adoptKey = ADOPT[P];
      // the card always shows the EFFECTIVE colour: the global accent while adopt is ON,
      // the area's own accent while OFF (user call: the fields must "jump" on adopt)
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
      pr.appendChild(pk); cA.appendChild(pr);   // #18: hex moves onto the swatch row (rightmost cell), like the top Badges card
      var sr = el("div", "cc-set-swatches cc-fill");
      PRESETS.slice(0, 7).forEach(function (c) {   // #5: 7 presets + hex(2 cells) = 9 cells, matching the rainbow/flag rows (8 + reset)
        var sw = el("span", "cc-set-sw"); sw.setAttribute("data-tip", c); sw.style.background = c; sw.dataset.c = c;   // dataset.c = the ONE attribute swMarkRow reads
        // Clicking a preset here USED to recolour the preview and leave the tick sitting on whatever
        // swatch was picked at build time, so the card claimed one colour and previewed another
        // (measured: pick violet -> preview violet, mark still on blue). Every colour change in this
        // card now re-marks the row, exactly like the global card does.
        sw.addEventListener("click", function () { acc = c; pk._set(c); hx.value = c; set(P + "accent", c); useOwn(); paintPv(); });
        sr.appendChild(sw);
      });
      sr.appendChild(hx); cA.appendChild(sr);   // hex field = rightmost cell of the swatch row
      // Rainbow is a GLOBAL mode now (one switch + one palette in the top Badges card): when it's
      // on, EVERY enabled area rainbows, so there is NO per-area rainbow toggle/palette here — just
      // this area's single accent colour above. The preview below still reflects the global rainbow.
      var RB2 = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];   /* #1: jewel default so every area's preview matches the live UI */
      function palG() { try { if (get("cc.flagmode", "0") === "1") { var fj = JSON.parse(get("cc.flagpal", "null")); if (fj && fj.length) return fj; } var pj = JSON.parse(get("cc.rbpal", "null")); if (pj && pj.length) return pj; } catch (e2) {} return RB2; }
      // live preview — the Hauptmenueleiste (cch.) previews the MENU TABS (idle grey pill +
      // one accent-filled active pill, mirroring CannonadeCommand.Header.css); every other
      // area previews the Docker badges.
      // both the Hauptmenueleiste (cch.) and Freigaben (ccsh.) restyle Unraid TAB bars ->
      // preview tab pills (menu tabs vs the two Shares sub-tabs); every other area = badges.
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
        // THE SAME EIGHT SAMPLES THE GLOBAL BADGES CARD SHOWS (user: the area preview "doesn't work").
        // It showed THREE badges: one name headline, one key/value pair and a tab pill. With a rainbow
        // or flag palette of eight that is a third of the palette, so the preview could not show what
        // the tab does — the sweep it is there to demonstrate was cut off after three hues, and two of
        // the three badge TIERS the tab actually paints (the second name headline, the further
        // key/value pairs) never appeared at all. Same mix, same order, same paint-by-index rule as the
        // Allgemein card, so the two previews finally agree.
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
          if (rbOn9) {   // rainbow: colour EVERY badge/tab by index (matches the now-fully-rainbow live bar)
            var cr = p9[i9 % p9.length];
            b9.style.setProperty("background", cr, "important"); b9.style.setProperty("color", idealText(cr), "important");
            return;
          }
          if (isTabs && i9 !== activeIx) { b9.style.removeProperty("background"); b9.style.removeProperty("color"); return; } // accent: idle tab keeps its grey CSS pill
          b9.style.setProperty("background", acc, "important"); b9.style.setProperty("color", idealText(acc), "important");
        });
        swMarkRow(sr, acc);   // the preset row's tick follows the colour the preview is showing
      }
      paintPv();
      cA.appendChild(pv);
      // adopt flip / global edit → this card repaints with the effective colour. ALSO repaints
      // the Logos card below with the EFFECTIVE icon values (adopt ON -> global cc.icon*, OFF ->
      // this area's own P+icon*) via cBLT.sync(), reusing applyBgClasses()/tp() for the paint.
      // cBLT/applyBgClasses/tp are assigned below; the refresher only ever runs after
      // buildStyleCards finished, so they are live by then.
      if (adoptKey) styleCardSync[adoptKey] = function () {
        acc = effAcc();
        try { pk._set(/^#[0-9a-f]{6}$/i.test(acc) ? acc : "#2f6feb"); } catch (e9) {}
        hx.value = acc;
        paintPv();   // repaints the sample badges AND re-marks the preset row (swMarkRow) in one place
        cBLT.sync(); // Hintergrund/Einfärben toggles + pickers follow the now-effective values
        cBLT.strInput.value = String(effIconStrength());
        applyBgClasses(); tp();
      };
      into.appendChild(cA);
      // Badge-Form (shape) is now a single GLOBAL control in the Allgemein "Badges" card, so it is
      // no longer repeated per area here.
      var cB = card(T("Logos", "Logos"), T("Die Schalter aktivieren Hintergrund und Icons unabhängig voneinander — jeder hat seine eigene Farbe.", "The switches turn Background and Icons on independently — each has its own colour."));
      // ga(): adopt ON -> read/preview the GLOBAL cc.icon* values; adopt OFF -> this area's own
      // P+icon* values. Every value change here means "this area uses its OWN style" (useOwn(),
      // exactly like the Badges card handlers above), so the six io setters below always WRITE
      // the area's own P+ key regardless of the current adopt state.
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
        // v4.35.0 (item 5): adopt-rainbow is no longer area-gated at all — this card no longer
        // shows the switch (hideAdoptRow below), and the ONE global "Logos & Icons" card is the
        // only place it can be flipped, so getAdopt() always answers the global key regardless of
        // ga() (own vs. adopted STYLE is unrelated now — Hintergrund/Icons colours can still be
        // this area's own; whether they follow rainbow is a purely global decision). setAdopt is
        // unreachable dead code (logoToggles() never builds/wires a switch to call it while
        // hideAdoptRow is set) — kept as a harmless no-op rather than deleted outright, in case a
        // future caller re-enables the row for this card.
        getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
        setAdopt: function () {},
        getAccent: function () { return acc; },
        onChange: function () { applyBgClasses(); try { tp(); } catch (e9) {} },
        hideAdoptRow: true
      });
      cBLT.strInput.value = String(istr);
      cBLT.strInput.addEventListener("input", function () { set(P + "iconstrength", cBLT.strInput.value); useOwn(); try { tp(); } catch (e9) {} });
      // live logo preview with real icons of this tab — ONE shared preview (logoPreview), which runs
      // the SAME icon pipeline the real tab runs (CCTheme.icons.plan) and puts the coloured badge on a
      // real CSS tile instead of an feFlood. The private copy that used to live here recoloured the
      // pixels with a raw tint/mono matrix and never looked at cc.iconmode, so with Icon-Färbung on
      // anything but "auto"'s raw treatment it previewed a picture the tab does not paint.
      cB.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
      // the pipeline SCOPE this area's items live under, so a per-item pin set in a row's own window
      // shows up in the preview too (the same scope strings docker.js/vms.js/plugins.js pass)
      var PAREA = { "ccd.": "docker", "ccv.": "vm", "ccp.": "plugin" }[P];   // areas whose rows carry REAL per-item logos
      var PSCOPE = PAREA || "docker";
      var pvl = logoPreview(PSCOPE, "cc-set-tint-" + P.replace(/[^a-z]/g, ""));
      var tpw = pvl.el;
      // A sample beginning with "fa-"/"icon-" is a FONT GLYPH (the Settings/Tools tiles use FA/Unraid
      // font icons, not raster PNGs) — logoPreview renders it as an <i> coloured via CSS. Anything else
      // is a raster logo. This is why ccs. showed no preview: its samples were empty because there are
      // no PNGs; it passes glyph classes instead.
      var addSamples = function () { (samples || []).forEach(function (s9) { pvl.add(s9, ""); }); };
      // Docker/VMs/Plugins show REAL per-item logos, so the preview shows this box's own — same
      // row fragments the global Logos card uses (rowIcons). The canned sample list stays as the
      // fallback for a box with no containers/VMs/plugins. It could never be more than a stand-in
      // anyway: two of the three plugin samples are paths that exist on no Unraid box at all, so
      // they 404, the tile hides itself, and that preview rendered as a single lonely logo.
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
        // Adopting (v4.33.1): approximate the resolved background with the effective accent — see
        // gpaint()'s comment in the global Logos & Icons card for why (the preview never simulated
        // Rainbow rotation) — and ink with its automatic black/white contrast, forced on regardless
        // of Einfärben's own on/off while adopting.
        // v4.35.0 (item 5): purely global now, same as cBLT's getAdopt() above — no longer gated by
        // ga() (own vs. adopted STYLE), so the preview never disagrees with what getAdopt() answers.
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
    var cV = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cV.appendChild(styleToggle("cc.stylevms", null));
    cV.appendChild(tabviewRow("vms", syncVmsBar));
    var cH = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cH.appendChild(styleToggle("cc.styleheader", null));
    // footer visibility (cc.footer, "1" hidden = DEFAULT): header.js applies it; same-page live via syncHeaderBar.
    // MOVED into the Allgemein Theming card (user): the footer bar is not part of the Kopfbereich AREA — it is
    // one global on/off for a page element, exactly like Dichte and Kachelgröße, which were moved there for the
    // same reason ("global settings belong together"). Behaviour is untouched: same key, same handler, same live
    // sync; only the card it is built into changed.
    if (themingCard) {
      var cHf = el("div", "cc-set-row cc-set-inline");
      var cHfL = el("span", "cc-set-lblwrap");
      cHfL.appendChild(el("span", null, T("Fußleiste ausblenden", "Hide footer bar")));
      cHfL.appendChild(infoIcon(T("Blendet die untere Statusleiste komplett aus.", "Hides the bottom status bar completely.")));
      cHf.appendChild(cHfL);
      cHf.appendChild(toggle(get("cc.footer", "1") !== "0", function (v) { set("cc.footer", v ? "1" : "0"); syncHeaderBar(); }));
      themingCard.appendChild(cHf);
    }
    var cSh = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cSh.appendChild(styleToggle("cc.styleshares", null));
    cSh.appendChild(tabviewRow("shares", syncSharesBar));
    var cSet = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cSet.appendChild(styleToggle("cc.stylesettings", null));
    // tile size of the /Settings + /Tools grid is the GLOBAL cc.sgsize control in Allgemein (no per-tab copy).
    var cFav = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cFav.appendChild(styleToggle("cc.stylefavorites", null));
    var cStart = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt.", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies."));
    cStart.appendChild(styleToggle("cc.stylemain", null));
    cStart.appendChild(tabviewRow("main", syncSharesBar));
    wrapHeader.appendChild(cH); wrapShares.appendChild(cSh); wrapPlugin.appendChild(cP); wrapVms.appendChild(cV); wrapSettings.appendChild(cSet); wrapFavorites.appendChild(cFav); wrapStart.appendChild(cStart);
    // #6/#20 (user: "der werkzeugtab soll nicht nur verweisen, das soll den gleichen funktionsumfang wie
    // beim einstellungstab haben. die tabs sind ja baugleich"): Unraid renders /Settings and /Tools with
    // the IDENTICAL category-tile grid, so they always share ONE underlying flag (cc.stylesettings) - that
    // part of the architecture is real and correct, a per-tab COPY of the flag would silently do nothing
    // on one of the two pages. What was wrong is that this tab only ever showed a sentence about that
    // fact instead of the actual control: same "Stil" card + toggle as the Einstellungen-Tab, wired to the
    // SAME key, so either tab can flip it and both stay in sync (honest duplication - real control, shared
    // state - not a second, disconnected copy).
    var cTools = card(T("Stil", "Style"), T("AN = die globale Badge-Farbe (Allgemein) gilt auch hier. AUS = die eigene Farbe dieses Abschnitts gilt. Wirkt auf /Einstellungen UND /Werkzeuge zugleich (Unraid rendert beide Seiten identisch).", "ON = the global badge colour (General) applies here too. OFF = this section's own colour applies. Affects /Settings AND /Tools at once (Unraid renders both pages identically)."));
    cTools.appendChild(styleToggle("cc.stylesettings", null));
    wrapTools.appendChild(cTools);
    // (the per-area Tabansicht toggle lives IN each Stil card now — see tabviewRow above)
    function syncPluginsBar() { try { if (typeof window.ccPluginsApply === "function") window.ccPluginsApply(); } catch (e) {} }
    function syncVmsBar() { try { if (typeof window.ccVmsApply === "function") window.ccVmsApply(); } catch (e) {} }
    buildStyleCards("cch.", wrapHeader, [], true); // Kopfbereich (menu bar): pill/badge settings only
    // Kopfbereich covers the main menu bar AND the top strip: the Status-Insel (top strip)
    // belongs to THIS area. header.js renders it and reads cc.island / cc.tempwarn live.
    (function () {
      var cI = card(T("Status-Insel", "Status island"), T("Die Status-Insel im oberen Streifen gehört zum Kopfbereich.", "The status island in the top strip belongs to the header area."));
      cI.appendChild(toggleRow(T("Status-Insel anzeigen", "Show status island"), get("cc.island", "1") !== "0", function (v) { set("cc.island", v ? "1" : "0"); syncHeaderBar(); }));
      // per-element checklist (user: an/abhaken welche Chips die Insel zeigt); header.js renders
      // them in a FIXED order and reads cc.isl.<key> live. Default all on.
      cI.appendChild(el("div", "cc-set-lbl", T("Angezeigte Elemente", "Shown elements")));
      [["uptime", T("Betriebszeit", "Uptime")], ["os", T("Unraid-Edition", "Unraid edition")], ["version", T("Unraid-Version", "Unraid version")], ["array", T("Array-Zustand", "Array state")], ["fill", T("Array-Füllstand", "Array usage")], ["ram", T("RAM-Auslastung", "RAM usage")], ["cpu", T("CPU-Last", "CPU load")], ["containers", T("Laufende Container", "Running containers")], ["net", T("Netzwerk-Traffic", "Network traffic")], ["temps", T("Temperaturen", "Temperatures")]].forEach(function (it) {
        cI.appendChild(toggleRow(it[1], get("cc.isl." + it[0], "1") !== "0", function (v) { set("cc.isl." + it[0], v ? "1" : "0"); syncHeaderBar(); }));
      });
      cI.appendChild(segRow(T("Temperatur-Warnschwelle", "Temperature warning threshold"), [["50", "50 °C"], ["60", "60 °C"], ["70", "70 °C"]], get("cc.tempwarn", "60"), function (v) { set("cc.tempwarn", v); syncHeaderBar(); }));
      wrapHeader.appendChild(cI);
    })();
    // #18 (user: "ich wollte die icon funktion übernehmen. nicht nur die icons einbauen. wo sind die
    // einstellungen dafür?"): the main-tab icons (Tabler, one curated set — see header.js ccTabIcons())
    // are additive markup CC inserts, not a native toggle, so they need their own on/off like every other
    // CC-added element. header.js reads cc.tabicons live and both inserts AND removes the icons on flip
    // (unlike most toggles here, which only gate future paints — nothing else in ccTabIcons() clears
    // already-inserted svg.cc-tab-ico, so turning this off has to be as real as turning it on).
    (function () {
      var cT = card(T("Haupttabs", "Main tabs"), T("Icon (Tabler, MIT-lizenziert) und/oder Text vor jedem Haupttab-Namen (Übersicht, Docker, VMs, …). Beides aus ist möglich, zeigt dann eine leere Pille.", "Icon (Tabler, MIT licensed) and/or text for every main tab label (Dashboard, Docker, VMs, …). Turning both off is possible and shows an empty pill."));
      cT.appendChild(toggleRow(T("Icons anzeigen", "Show icons"), get("cc.tabicons", "1") !== "0", function (v) { set("cc.tabicons", v ? "1" : "0"); try { window.ccTabIcons && window.ccTabIcons(); } catch (e) {} }));
      // #18 (user, extension: "auch toggle um den text auszublenden") — icon-only mode alongside the
      // existing icon switch, same card since both control the same tab pill's contents.
      cT.appendChild(toggleRow(T("Text anzeigen", "Show text"), get("cc.tabtext", "1") !== "0", function (v) { set("cc.tabtext", v ? "1" : "0"); try { window.ccTabIcons && window.ccTabIcons(); } catch (e) {} }));
      wrapHeader.appendChild(cT);
    })();
    // ── SERVERNAME card (user: size/weight/italic/font/colour customisable). header.js reads the
    // cc.brand.* keys live and inlines them on span.cc-brand-name — the REAL header is the preview
    // (no card preview). Controls are all dropdowns (stringent, no lone slider/toggle); colour
    // stays a picker like every other CC colour control.
    (function () {
      var cB = card(T("Servername", "Server name"), T("Aussehen des Servernamens oben links. Änderungen erscheinen live im Kopfbereich.", "Look of the server name at the top left. Changes appear live in the header."));
      // size (preset dropdown — replaces the lone slider)
      var SZ = ["16", "18", "20", "22", "24", "26", "28", "30", "32", "36", "40", "44", "48", "56", "64"].map(function (s) { return [s, s + " px"]; });
      cB.appendChild(dropRow(T("Größe", "Size"), SZ, get("cc.brand.size", "30"), function (v) { set("cc.brand.size", v); syncHeaderBar(); }));
      // weight
      cB.appendChild(dropRow(T("Stärke", "Weight"), [["300", T("Dünn", "Thin")], ["400", "Normal"], ["500", "Medium"], ["650", T("Halbfett", "Semibold")], ["800", T("Fett", "Bold")]], get("cc.brand.weight", "650"), function (v) { set("cc.brand.weight", v); syncHeaderBar(); }));
      // italic (dropdown, not a lone toggle — keep the control set uniform)
      cB.appendChild(dropRow(T("Kursiv", "Italic"), [["0", T("Normal", "Normal")], ["1", T("Kursiv", "Italic")]], get("cc.brand.italic", "0"), function (v) { set("cc.brand.italic", v); syncHeaderBar(); }));
      // Font family for the wordmark. Genuinely-system faces (render if the client has them) — the old
      // cursive/fantasy junk (Comic Sans, Papyrus, Brush Script, Lucida Handwriting, Segoe Print/Script,
      // Copperplate, Rockwell, Sylfaen) is dropped (user: "teilweise echt alt und furchtbar"), and the
      // web-only families that never rendered without a download come back below as PROPER Google fonts.
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
    // #2b: per-icon SHOW/HIDE for the top-right utility icons (user: "jedes Icon ein-/ausblendbar").
    // Toggle ON = visible (default). cc.hideicon.<key>="1" hides it; header.js apply() stamps
    // html.cc-hideicon-<key> (Header.css hides the #menu .<Class>Button), and ccDockProfile hides the
    // docked bell/burger spans. Keys map to the native #menu button classes.
    (function () {
      var cIc = card(T("Kopf-Icons", "Header icons"), T("Blende einzelne Icons oben rechts aus. Aus = versteckt.", "Hide individual icons in the top-right. Off = hidden."));
      // NOTE: "help" is intentionally ABSENT — CC removed the native Help button entirely (its inline help
      // moved into the ⓘ bubbles), so a hide-toggle for it was dead UI (user: "man kann das hilfeicon noch
      // ein/ausschalten obwohl wir es gänzlich entfernt haben").
      // T3 (user): bell + burger are integral parts of the system (hiding them left the badge without its
      // icon), so they are NOT listed here any more — they can no longer be hidden.
      [["lang", T("Sprache", "Language")], ["search", T("Suche", "Search")], ["logout", T("Abmelden", "Logout")], ["terminal", T("Terminal", "Terminal")], ["browse", T("Datei-Verwaltung", "File manager")], ["feedback", T("Feedback", "Feedback")], ["info", T("Info", "Info")], ["log", T("Protokoll", "Log")]].forEach(function (ic) {
        cIc.appendChild(toggleRow(ic[1], get("cc.hideicon." + ic[0], "0") === "0", function (v) { set("cc.hideicon." + ic[0], v ? "0" : "1"); syncHeaderBar(); }));
      });
      wrapHeader.appendChild(cIc);
    })();
    buildStyleCards("ccsh.", wrapShares, [], true); // Freigaben: tab pills use FA glyphs -> badges only, no logo card
    buildStyleCards("ccs.", wrapSettings, ["fa-cog", "fa-globe", "fa-star"], false); // Einstellungs-Tab: badges + logo-tint + Logo-Hintergrund cards; the tiles use FA glyphs, so the preview shows sample glyphs (cog/globe/star = System/Network/User category icons), coloured via CSS not the raster filter
    buildStyleCards("ccp.", wrapPlugin, ["/plugins/dynamix.plugin.manager/images/dynamix.plugin.manager.png", "/plugins/dynamix.docker.manager/images/dynamix.docker.manager.png", "/plugins/cannonadecommand/images/cannonadecommand.png"]);
    buildStyleCards("ccv.", wrapVms, ["/plugins/dynamix.vm.manager/templates/images/linux.png", "/plugins/dynamix.vm.manager/templates/images/windows.png", "/plugins/cannonadecommand/images/cannonadecommand.png"]);
    buildStyleCards("ccf.", wrapFavorites, ["fa-star", "fa-heart", "fa-cog"], false); // Favoriten: tiles use FA glyphs -> preview shows sample glyphs coloured via CSS (like the Settings card)
    buildStyleCards("ccm.", wrapStart, [], true); // Start (/Main): disk_status value + name badges, no per-row logos -> badges only, no logo card
    // ── Sichern & Übertragen: export/import of every cc-family localStorage setting.
    // Lives INSIDE the Theming card now (user call) — a label row + the two buttons.
    (function () {
      var cX = themingCard;
      var lblw = el("div", "cc-set-lbl cc-set-lblwrap");
      lblw.appendChild(el("span", null, T("Sichern & Übertragen", "Backup & transfer")));
      lblw.appendChild(infoIcon(T("Exportiert alle CannonadeCommand-Einstellungen (cc.*-Schlüssel) als JSON-Datei. Der Import schreibt sie zurück und lädt die Seite neu.", "Exports every CannonadeCommand setting (cc.* keys) as a JSON file. Import writes them back and reloads the page.")));
      cX.appendChild(lblw);
      var note = el("div", "cc-set-xnote"); // inline notice — this page has no toast mechanism
      function say(msg, bad) { note.textContent = msg || ""; note.style.color = bad ? "#d9433f" : ""; }
      var ex = el("span", "cc-btn cc-set-xbtn", T("Exportieren", "Export")); // grey fill + hover accent, md tier, no rings
      ex.addEventListener("click", function () {
        try {
          // collectUISettings = every cc-family key except cc.stateCache (same set the engine mirrors)
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
          // must be a FLAT object of cc-family string keys (never cc.stateCache)
          var ks = o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o) : [];
          var bad = ks.filter(function (k) { return !/^cc[a-z]*\./.test(k) || k === "cc.stateCache" || typeof o[k] !== "string"; });
          if (!ks.length || bad.length) { say(T("Ungültiges Format: erwartet wird ein flaches Objekt mit cc.*-Textwerten.", "Invalid format: expected a flat object of cc.* string values."), true); return; }
          var w = window.__ccLS || localStorage.setItem.bind(localStorage); // raw write, no 800ms mirror debounce
          ks.forEach(function (k) { try { w(k, o[k]); } catch (e) {} });
          // push into the engine mirror BEFORE reloading — the reloaded page re-adopts
          // ui_settings from the engine, which would revert an unmirrored import.
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
      // #26: NUKE reset — two-step, clears every cc.* key AND the engine mirror, then reloads to defaults.
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
      cX.appendChild(brow); cX.appendChild(fin); cX.appendChild(note); // rows land at the end of the Theming card
    })();
    refreshTabs();
    // cc.settab holds a stable section id ("general"/"header"/…). A legacy numeric index
    // or any unknown value migrates silently to 0 (Allgemein).
    var st0 = localStorage.getItem("cc.settab"), ix0 = 0;
    SECS.forEach(function (sc9, j9) { if (sc9.id === st0) ix0 = j9; });
    showSec(ix0);
    // #26: settings search — filters cards + rows across ALL tabs; empty query restores the tabbed view.
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
    // Read-modify-write against the LIVE config: re-fetch it, change ONLY notify,
    // then write it back. This never touches schedules/watchdogs — including any set
    // in the Docker tab after this page loaded — and if the fresh read fails we
    // ABORT (no PUT), so a transient engine outage can never wipe the automation.
    withConfigLock(function () {
      return api("GET", "config").then(function (c) {
        if (!c || typeof c !== "object") throw new Error("config unreadable");
        c.notify = { unraid: !!notify.unraid, webhook: notify.webhook || "" };
        return api("PUT", "config", c).then(function () { fullConfig = c; reset(T("Gespeichert ✓", "Saved ✓")); });
      });
    }).catch(function () { reset(T("Fehler — Engine erreichbar?", "Error — engine reachable?")); });
  }
  // Persist ONLY the shaping interface, read-modify-write against the LIVE config so
  // notify + every container's schedules/watchdogs/bandwidths are preserved. Aborts
  // (no PUT) if the fresh read fails, and surfaces a validation error from the engine.
  function saveShape(btn) {
    btn.textContent = T("Speichere…", "Saving…"); btn.classList.add("cc-set-disabled");
    function reset(txt) { btn.textContent = txt; setTimeout(function () { btn.textContent = T("Speichern", "Save"); btn.classList.remove("cc-set-disabled"); }, 1800); }
    withConfigLock(function () {
      return api("GET", "config").then(function (c) {
        if (!c || typeof c !== "object") throw new Error("config unreadable");
        c.shape_iface = shapeIface || "";
        return api("PUT", "config", c).then(function () { fullConfig = c; reset(T("Gespeichert ✓", "Saved ✓")); });
      });
    }).catch(function (e) { reset(/bad shaping interface/.test(String(e && e.message)) ? T("Ungültige Schnittstelle", "Invalid interface") : T("Fehler — Engine erreichbar?", "Error — engine reachable?")); });
  }
  // dark text on light backgrounds, white on dark (perceived luminance)
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16); var L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  // preview uses the REAL rainbow palette (identical to docker.css) so it matches
  // what the Docker tab actually shows, with auto-contrast text.
  function paintPrev() { var p = document.getElementById("cc-set-prev"); if (!p) return; var DEF = (window.CCTheme && window.CCTheme.RB) || ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"]; var pal = DEF;   /* #1: jewel default so the preview matches the live UI */ try { var fj = get("cc.flagmode", "0") === "1" ? JSON.parse(get("cc.flagpal", "null")) : null; var j = (fj && fj.length) ? fj : JSON.parse(get("cc.rbpal", "null")); if (j && j.length) pal = j; } catch (e) {} Array.prototype.slice.call(p.children).forEach(function (b, i) { var c = rainbow ? pal[i % pal.length] : accent; b.style.background = c; b.style.color = idealText(c); }); }
  // #6 (user): every CC-settings toggle follows the colour engine. In rainbow each toggle takes a DIFFERENT
  // jewel from the shared seed (CCTheme.rbColor honours cc.rbseed + rotation), exactly like the Docker/VM/grid
  // badges stamp --cc-rb-c; in accent (or flag-off) the stamp is cleared so the track CSS falls back through
  // --cc-rbaccent to --cc-accent. Track reads var(--cc-rb-c, …) (docker.css); knob stays white.
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
  // The badge-visibility matrix is the ONE place this page builds checkboxes, and it was still handing the
  // operating system's box a tint via accent-color. It now uses CC's own .cc-cb widget (docker.css), which
  // the Startplan editor's audit turned into a shared class — the per-badge colour it already carried moves
  // onto --cc-rb-c, so each cell keeps wearing its OWN badge's colour instead of one flat accent, and the
  // tick gets the matching contrast ink (a white tick is invisible on a light badge colour).
  function ccTick(c) { return "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3 8.5l3.2 3.2L13 5' fill='none' stroke='" + encodeURIComponent(c) + "' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")"; }
  function chkCell(key, v, color) { var td = el("td", "cc-set-chk"); var cb = el("input", "cc-cb"); cb.type = "checkbox"; cb.checked = !!(colview[key] && colview[key][v]); if (rainbow && color) { cb.style.setProperty("--cc-rb-c", color); cb.style.setProperty("--cc-rb-ct", idealText(color)); cb.style.setProperty("--cc-cb-tick", ccTick(idealText(color))); } else { cb.style.setProperty("--cc-cb-tick", ccTick(idealText(accent))); } cb.addEventListener("change", function () { var cur = colview[key] || { s: true, a: true }; colview[key] = { s: cur.s, a: cur.a }; colview[key][v] = cb.checked; set("cc.colview2", JSON.stringify(colview)); }); td.appendChild(cb); return td; }
  // #4 (user): every segmented option row is now a UNIFIED CC dropdown. segRow() delegates to dropRow()
  // (defined below, hoisted) so ALL callers (Animationen, Dichte, Badge-Form, Badge-Stil, Kachelgröße,
  // Ansicht, Temperatur-Warnschwelle) convert at once with the SAME (value,label) opts + the SAME onChange —
  // the native <select> fires `change`, so the live effects (applyAnim/sizePrev/glass toggle/…) still run.
  // The old `segFirst` seg-left layout is obsolete (dropdowns are uniformly label-left); the arg is ignored.
  function segRow(labelText, opts, cur, onChange, help /*, segFirst (obsolete) */) {
    return dropRow(labelText, opts, cur, onChange, help);
  }
  // Native <select> styled as a CC control (no orange Unraid border). opts = [value, label, face?];
  // when a third element is given the option renders in that font-family (used by the font picker).
  function dropRow(labelText, opts, cur, onChange, help) {
    var row = el("div", "cc-set-row"); var rl = el("span", "cc-set-rl", labelText); if (help) rl.appendChild(infoIcon(help)); row.appendChild(rl);
    var sel = el("select", "cc-set-sel");
    opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === cur) op.selected = true; if (o[2]) op.style.fontFamily = o[2]; sel.appendChild(op); });
    sel.addEventListener("change", function () { onChange(sel.value); });
    row.appendChild(ccDsel(sel)); return row;   // #2: native <select> hidden, wrapped in the cc-dsel custom widget
  }
  // #2 (user, 2 screenshots): the settings dropdowns must use the SAME custom CC widget as the Docker
  // network dropdown (.cc-dsel), not a native <select> whose opened list is browser-black. Mirror
  // docker.js ctWrapSelect: keep the native <select> as the display:none source of truth (its `change`
  // still fires onChange -> the live effects run), render a trigger + floating chip panel. No
  // border/ring; selected chip = rainbow/accent SHADE only (house law).
  function ccDsel(sel) {
    var wrap = el("span", "cc-dsel"); sel.style.display = "none"; wrap.appendChild(sel);
    var trig = el("span", "cc-dsel-trigger"); wrap.appendChild(trig);
    var panel = el("div", "cc-dsel-panel"); wrap.appendChild(panel);
    for (var k = 0; k < sel.options.length; k++) {
      var o = sel.options[k];
      var chip = el("div", "cc-dsel-opt", o.text); chip.setAttribute("data-i", k);
      if (o.style.fontFamily) chip.style.fontFamily = o.style.fontFamily;   // font picker: chip previews in its own face
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
    if (t2 && t2.textContent !== label) t2.textContent = label;   // GUARDED writes: no childList churn
    for (var k = 0; k < c.length; k++) { var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue; c[k].classList.toggle("is-selected", o.selected); c[k].classList.toggle("is-disabled", !!o.disabled); }
  }
  // GlimStone Rule 21 (wheel over the CLOSED field): the shared handler is in cc-theme.js; this settings
  // page builds its OWN .cc-dsel widgets (ccDsel above), so it hands over its own repaint. docker.js
  // registers the same shape for its copy — the two never load on the same page, and both syncs are
  // guarded no-ops on a wrapper that is not theirs.
  try { if (window.CCTheme && window.CCTheme.registerSelectSync) window.CCTheme.registerSelectSync(function (sel, wrap) { if (!wrap || !wrap.classList || !wrap.classList.contains("cc-dsel")) return false; ccDselSync(sel); return true; }); } catch (e) {}
  // panel is position:fixed on open so the #canvas overflow can't clip a long list; flips up when there
  // is more room above (no transform-ancestor math needed — settings has no jQuery-UI dialog).
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
  if (!window.__ccSetDsel) {   // ONE document-level close handler for the page lifetime (no body observer)
    window.__ccSetDsel = true;
    document.addEventListener("click", function () { var o = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); });
    window.addEventListener("scroll", function (e) { var tgt = e && e.target; if (tgt && tgt.closest && tgt.closest(".cc-dsel-panel")) return; var o = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); }, true);
  }
  // indent the WHOLE panel (logo/hero, tab strip AND cards) so it starts at the first
  // main-menu tab: --cc-align-left is stamped by header.js (fallback 15px). Padding the
  // root is idempotent — the root's border edge doesn't move with its own padding.
  function alignSetTabs() {
    try {
      var al = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cc-align-left")) || 15;
      var rr = root.getBoundingClientRect();
      var need = al - rr.left;
      if (need > 0 && need < 60) root.style.paddingLeft = need + "px"; else root.style.paddingLeft = "";
      // T2 (user: "cc settings sind rechts nicht bündig und zu weit rechts. auch das suchicon"): Unraid's
      // #displaybox is a few px WIDER than the viewport, so the panel (and the right-pinned search icon)
      // spilled past the right edge. Mirror the left inset: pad the right so the content + search icon end
      // at a symmetric inset INSIDE the viewport.
      var padR = Math.round(rr.right - (document.documentElement.clientWidth - al));
      if (padR > 0 && padR < 80) root.style.paddingRight = padR + "px"; else root.style.paddingRight = "";
    } catch (e) {}
  }
  var alignT = null; // ONE debounced resize listener for the page's lifetime (module scope, added once)
  window.addEventListener("resize", function () { clearTimeout(alignT); alignT = setTimeout(alignSetTabs, 150); });

  // #7: re-sort the CC sub-tabs LIVE when the main menu order changes (drag-reorder / Connect auto-mount).
  // A menu childList mutation re-runs render(), which re-reads the live #menu order and rebuilds the strip,
  // preserving the active tab via cc.settab. Debounced + gated on the ACTUAL order string so unrelated menu
  // mutations (badge stamps, auto-mount attribute writes) never trigger a rebuild. Added once per page.
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
  // Pull the engine-side config so the Notifications card reflects what is saved,
  // then re-render. Failure (engine down / older build) leaves the defaults shown.
  // If the user already started editing the card during the round-trip, keep their
  // edits (don't overwrite notify or re-render on top of them).
  api("GET", "config").then(function (c) {
    if (!c || typeof c !== "object") return; // leave Save disabled if unreadable
    fullConfig = { schedules: c.schedules || [], watchdogs: c.watchdogs || [], bandwidths: c.bandwidths || [], notify: c.notify || { unraid: false, webhook: "" }, shape_iface: c.shape_iface || "", ui_settings: c.ui_settings || undefined };
    configLoaded = true;
    adoptUISettings(c.ui_settings); // render() below shows the adopted values
    // persist the flag/rainbow palette migration in the engine (c.ui_settings was cleaned in place) —
    // otherwise the next load's adopt would restore the contaminated cc.rbpal from the mirror
    if (adoptUISettings._migrated) { try { api("PUT", "config", c); } catch (e8) {} }
    if (!c.ui_settings || !Object.keys(c.ui_settings).length) { var seed9 = collectUISettings(); if (Object.keys(seed9).length) { Object.keys(seed9).forEach(function (k9) { uiPending[k9] = 1; }); pushUISettings(); } } // seed the mirror
    // keep the user's in-flight edits if they already started typing; otherwise
    // adopt the loaded values. Either way re-render to enable Save.
    if (!notifyDirty) notify = { unraid: !!fullConfig.notify.unraid, webhook: fullConfig.notify.webhook || "" };
    if (!shapeDirty) shapeIface = fullConfig.shape_iface || "";
    render();
  }).catch(function () {});
})();
