/* CannonadeCommand: the theme helpers shared by every area script.
 *
 * Loaded on every page, synchronously, from CannonadeCommand.Tokens.page (Menu="Buttons:94"), so
 * window.CCTheme exists before any area script runs. The rainbow offset is one seed kept in
 * cc.rbseed, so every area starts the palette on the same hue and keeps it across reloads. Each
 * area keeps an identical local fallback, so a missed load order degrades instead of breaking.
 */
(function () {
  "use strict";
  if (window.CCTheme) return;

  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // The eight rainbow hues share one saturation and lightness, so they read as a matched set and
  // idealText does not flip from hue to hue.
  function hsl2hex(h, s, l) {
    h /= 360; var r, g2, b2;
    if (s === 0) { r = g2 = b2 = l; } else {
      var hue2rgb = function (p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3); g2 = hue2rgb(p, q, h); b2 = hue2rgb(p, q, h - 1 / 3);
    }
    var hx = function (x) { var v = Math.round(x * 255).toString(16); return v.length === 1 ? "0" + v : v; };
    return "#" + hx(r) + hx(g2) + hx(b2);
  }
  // Red, orange, gold, green, teal, blue, violet and pink.
  var RB = [0, 26, 45, 142, 176, 216, 262, 330].map(function (h) { return hsl2hex(h, 0.50, 0.58); });

  // Dark ink on light accents, white on dark (Rec-601 luma, threshold 150). The fallbacks in the
  // area scripts use the same formula.
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
    return L > 150 ? "#161616" : "#fff";
  }

  // One seed, picked at random once and kept in cc.rbseed, so seed % len gives the same rotation
  // in every area and on every reload.
  function rbSeed(len) {
    var v = parseInt(g("cc.rbseed", ""), 10);
    if (isNaN(v) || v < 0) { v = Math.floor(Math.random() * 9973); s("cc.rbseed", String(v)); } // prime modulus base
    return len > 0 ? (v % len) : 0;
  }

  // Flag mode reads cc.flagpal, otherwise the user's cc.rbpal, otherwise the given default.
  function palette(def) {
    try {
      if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; }
      var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p;
    } catch (e) {}
    return def || RB;
  }

  // The colour of rainbow item i, or the plain accent when rainbow is off. Honours rotation
  // (cc.rainbowrot, default on) and the shared seed.
  function rbColor(i, accent, def) {
    if (g("cc.rainbow", "0") !== "1") return accent;
    var p = palette(def), off = g("cc.rainbowrot", "1") === "0" ? 0 : rbSeed(p.length);
    return p[((i % p.length) + off) % p.length];
  }

  // Rec-601 luma of a hex colour, 0-255, the same measure idealText uses.
  function lumOf(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 255;
    var n = parseInt(m[1], 16);
    return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
  }

  // A near-black palette slot (the German flag's black stripe, a hand-picked #2a2a2a) paints an
  // invisible badge on CC's #161616 surfaces, so a slot below the floor is swapped for the
  // palette's brightest slot, or for the accent when the whole palette is dark. header.js's
  // popBadge delegates here.
  //
  // The floor of 28 was measured: 64 swapped the Algerian flag's #006233 (luma 63.3) and broke its
  // cycle, while 28 still catches #000000 and keeps dark flag colours such as navy #002868 (35.4)
  // that read fine with white text. floor is a parameter because a luminance tint lands at about
  // half the target's luma on a mid-bright icon, so the tint path passes LUM_FLOOR * 2.
  var LUM_FLOOR = 28;
  function liftDark(hex, accent, floor) {
    if (floor == null) floor = LUM_FLOOR;
    if (!hex) return hex;
    if (lumOf(hex) >= floor) return hex;
    var p = palette(), best = null, bl = -1;
    for (var k = 0; k < p.length; k++) { var L = lumOf(p[k]); if (L > bl) { bl = L; best = p[k]; } }
    return (best && bl >= floor) ? best : (accent || hex);
  }

  // Colour modes for the select replacements header.js does not paint: .cc-dsel (Docker form, CC
  // settings, .cc-pop windows), .cc-sel (share detail) and .cc-drop (the Startplan "Hängt ab von"
  // multi-select). It lives here because this is the only file loaded on every page. .cc-tsel is
  // left out because ccPaintRotate() rotates it together with the toggles around it, and a second
  // painter would fight it on every pass.
  var CC_SEL_WRAPS = ".cc-dsel, .cc-sel";
  var CC_SEL_PANELS = ".cc-dsel-panel, .cc-sel-panel, .cc-drop";
  var CC_SEL_OPTS = ".cc-dsel-opt, .cc-sel-opt, .cc-drop-it";
  function paintSelects(root) {
    try {
      var scope = (root && root.querySelectorAll) ? root : document;
      // With rainbow or theming off the stamps are removed, so the sheets' var(--cc-rb-c,
      // var(--cc-rbaccent, <area accent>)) chain falls back to the accent. Flag mode comes in
      // through rbColor()'s palette().
      var on = g("cc.theming", "1") !== "0" && g("cc.rainbow", "0") === "1";
      var i, n, c;
      var wraps = scope.querySelectorAll(CC_SEL_WRAPS);
      for (i = 0; i < wraps.length; i++) {
        if (!on) { wraps[i].style.removeProperty("--cc-rb-c"); wraps[i].style.removeProperty("--cc-rb-ct"); continue; }
        c = rbColor(i, null);   // guarded by `on`, so this never returns the null accent
        wraps[i].style.setProperty("--cc-rb-c", c); wraps[i].style.setProperty("--cc-rb-ct", idealText(c));
      }
      // Rotate within each panel, as ccPaintRotate does for .cc-tsel-panel, so an open list reads
      // as a rainbow rather than one colour repeated down the column.
      var panels = scope.querySelectorAll(CC_SEL_PANELS);
      for (var p = 0; p < panels.length; p++) {
        var opts = panels[p].querySelectorAll(CC_SEL_OPTS);
        for (n = 0; n < opts.length; n++) {
          if (!on) { opts[n].style.removeProperty("--cc-rb-c"); opts[n].style.removeProperty("--cc-rb-ct"); continue; }
          c = rbColor(n, null);
          opts[n].style.setProperty("--cc-rb-c", c); opts[n].style.setProperty("--cc-rb-ct", idealText(c));
        }
      }
    } catch (e) {}
  }

  // GlimStone rule 21: a closed select field steps through its values with the scroll wheel, as a
  // native <select> does. It lives here because this file loads on every page. .cc-tsel (header.js),
  // .cc-dsel (docker.js form, CC settings, .cc-pop) and .cc-sel (share detail) keep a hidden
  // <select> as their value, so a wheel step changes its selectedIndex. .cc-drop is left out: it has
  // no closed field, only a text input holding a comma list with no next value to step to.
  //
  // The handler acts only over a closed widget, so open panels and the page scroll as before, and
  // it calls preventDefault only when the value changed, so a disabled or single-option field still
  // lets the page scroll. It clamps at the ends like the arrow keys in settings.js moveSel and
  // header.js ccTselMove, and it commits through the same path as an option click (selectedIndex,
  // a bubbling change event, then a resync), so the host page's inline onchange handlers fire.
  var CC_SEL_WHEEL = ".cc-tsel, .cc-dsel, .cc-sel";
  var selSyncFns = [];
  // Each family registers the sync its click handler calls, because they differ: .cc-tsel
  // re-inserts a locale flag and rebuilds when the option count changes. A family that registers
  // nothing falls back to ccSelMirror.
  function registerSelectSync(fn) { if (typeof fn === "function" && selSyncFns.indexOf(fn) < 0) selSyncFns.push(fn); }
  // Repaints the trigger label and each chip's selected and disabled state. All three families
  // share the .cc-X-trigger and .cc-X-opt[data-i] markup.
  function ccSelMirror(wrap, sel) {
    try {
      var t = wrap.querySelector(".cc-tsel-trigger, .cc-dsel-trigger, .cc-sel-trigger");
      var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
      if (t && t.textContent !== label) t.textContent = label;
      var opts = wrap.querySelectorAll(".cc-tsel-opt, .cc-dsel-opt, .cc-sel-opt");
      for (var i = 0; i < opts.length; i++) {
        var o = sel.options[+opts[i].getAttribute("data-i")]; if (!o) continue;
        opts[i].classList.toggle("is-selected", o.selected);
        opts[i].classList.toggle("is-disabled", !!o.disabled);
        opts[i].setAttribute("aria-selected", o.selected ? "true" : "false");
      }
    } catch (e) {}
  }
  // Next selectable index in dir, skipping disabled options and clamped at both ends. Returns the
  // current index when there is nowhere to go.
  function nextSelIndex(sel, dir) {
    var n = sel.options.length, i = sel.selectedIndex;
    if (n < 2) return i;
    if (i < 0) return dir > 0 ? 0 : n - 1;
    for (var k = i + dir; k >= 0 && k < n; k += dir) { if (!sel.options[k].disabled) return k; }
    return i;
  }
  function wheelStepSelect(wrap, dir) {
    var sel = wrap.querySelector("select");
    if (!sel || sel.disabled || sel.multiple) return false;
    var i = nextSelIndex(sel, dir);
    if (i === sel.selectedIndex) return false;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("change", { bubbles: true }));   // the host's inline onchange chain
    var painted = false;
    for (var k = 0; k < selSyncFns.length; k++) { try { if (selSyncFns[k](sel, wrap) === true) painted = true; } catch (e) {} }
    if (!painted) ccSelMirror(wrap, sel);
    // the freshly-selected chip has to wear the mode colour like every other one (Rule 9)
    try { paintSelects(wrap); } catch (e2) {}
    return true;
  }
  function bindSelectWheel() {
    if (window.__ccSelWheel || !document || typeof document.addEventListener !== "function") return;
    window.__ccSelWheel = true;
    // Not passive, so a handled step can stop the page from scrolling underneath it.
    document.addEventListener("wheel", function (e) {
      try {
        if (e.ctrlKey || e.metaKey || e.altKey) return;               // browser zoom and OS gestures
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest(".cc-tsel-panel, .cc-dsel-panel, .cc-sel-panel, .cc-drop")) return;
        var wrap = t.closest(CC_SEL_WHEEL);
        if (!wrap || wrap.classList.contains("cc-open")) return;
        if (wrap.classList.contains("cc-tsel-disabled") || wrap.classList.contains("cc-dsel-disabled") || wrap.classList.contains("cc-sel-disabled")) return;
        var dy = e.deltaY || 0, dx = e.deltaX || 0;
        var d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
        if (!d) return;
        if (wheelStepSelect(wrap, d > 0 ? 1 : -1)) e.preventDefault();
      } catch (e3) {}
    }, { passive: false, capture: true });
  }
  bindSelectWheel();

  // Google Fonts for the server-name wordmark as [family, generic fallback], loaded on demand so
  // they render on any client. loadGFonts merges all families into one <link>, so the header (one
  // family) and the settings dropdown (all of them, for the previews) do not overwrite each other.
  var GFONTS = [
    ["Anton", "sans-serif"], ["Archivo Black", "sans-serif"], ["Audiowide", "sans-serif"], ["Bebas Neue", "sans-serif"],
    ["Bitter", "serif"], ["Comfortaa", "sans-serif"], ["Cormorant Garamond", "serif"], ["Fredoka", "sans-serif"],
    ["Inter", "sans-serif"], ["Lato", "sans-serif"], ["Lobster", "cursive"], ["Merriweather", "serif"],
    ["Montserrat", "sans-serif"], ["Nunito", "sans-serif"], ["Orbitron", "sans-serif"], ["Oswald", "sans-serif"],
    ["Outfit", "sans-serif"], ["Pacifico", "cursive"], ["Playfair Display", "serif"], ["Poppins", "sans-serif"],
    ["Quicksand", "sans-serif"], ["Righteous", "sans-serif"], ["Roboto", "sans-serif"], ["Rubik", "sans-serif"],
    ["Russo One", "sans-serif"], ["Sora", "sans-serif"], ["Teko", "sans-serif"], ["Work Sans", "sans-serif"]
  ];
  function loadGFonts(fams) {
    try {
      if (!fams || !fams.length) return;
      var link = document.getElementById("cc-gfonts");
      var have = (link && link.dataset.fams) ? link.dataset.fams.split("|") : [];
      fams.forEach(function (f) { if (f && have.indexOf(f) < 0) have.push(f); });
      if (!have.length) return;
      have.sort();
      var href = "https://fonts.googleapis.com/css2?" + have.map(function (f) { return "family=" + f.replace(/ /g, "+") + ":wght@400;700"; }).join("&") + "&display=swap";
      if (!link) { link = document.createElement("link"); link.id = "cc-gfonts"; link.rel = "stylesheet"; (document.head || document.documentElement).appendChild(link); }
      if (link.getAttribute("href") !== href) link.setAttribute("href", href);
      link.dataset.fams = have.join("|");
    } catch (e) {}
  }
  // primaryFamily("\"Montserrat\",sans-serif") -> "Montserrat"; used to tell if a chosen brand font is a GFONT.
  function primaryFamily(css) { var m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(String(css || "")); return (m ? (m[1] || m[2] || m[3] || "") : "").trim(); }

  // The (i) info bubble for every area script; GlimStone rule 8 names cc-info as its reference. The
  // glyph is an outline ring, the one exception to rules 5 and 20, because the ring is the letter i
  // set in a circle and filling it leaves a meaningless disc. The markup matches BombVault's
  // InfoBubble.tsx: r=7, stroke-width 1.3, dot r=0.9, and a round-capped <path> for the stem, since
  // a <rect>'s rx rounds the ends differently. It is neutral, not accent: the sheets resolve
  // currentColor to var(--txt). The text goes into data-tip and is rendered by header.js's
  // body-level #cc-tipfloat, because any overflow:hidden ancestor would clip a local child.
  var CC_INFO_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>';
  function infoIcon(tip) {
    var s = document.createElement("span");
    s.className = "cc-info";
    s.innerHTML = CC_INFO_SVG;
    if (tip) { s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); }
    s.setAttribute("tabindex", "0");   // Rule 8: reachable by keyboard, so focus opens it like hover does
    return s;
  }

  // One filled trash can for every icon-only destructive control: tabler-icons (MIT)
  // icons/filled/trash.svg, taken from the filled set per rule 20, since filling the outline path
  // turns its open stroke geometry into a scribble.
  var CC_TRASH_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007zm-10 4a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1m4 0a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1" /><path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005z" /></svg>';

  // The icon pipeline. Ink-flattening (feColorMatrix to one flat colour) looks sharp on a real
  // glyph but turns a full-colour icon with a coloured background and a mark on top into one blob.
  // Luminance tinting (pixel luminance x target) is safe on anything but never looks as crisp. So
  // the pipeline works out what kind of picture an icon is, and finds a better one when needed:
  //   1. Measure the luminance spread over the opaque pixels on a canvas. A low spread means the
  //      artwork is one tone and flattening loses nothing. It is local, so it runs first.
  //   2. Look for a simple-icons (CC0-1.0) glyph, which is monochrome by construction.
  //   3. Otherwise tint the best colour source: dashboard-icons (Apache-2.0) before the
  //      container's own icon.
  // The engine answers steps 2 and 3 from its cache and fetches only on its own workers (see
  // internal/iconsrc), so the browser never waits on a CDN.
  //
  // cc.iconmode is the global default and cc.iconov holds per-item pins:
  //   auto    the chain above (default)
  //   native  no recolouring, but a curated colour icon still beats a poor shipped one
  //   flat    always flatten, whatever the heuristic says
  //   tint    always tint
  var ICON_PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var ICON_MODES = ["auto", "native", "flat", "tint"];
  // Luminance spread on a 0-255 scale, measured over the 55 containers of a real box. The values
  // are bimodal: flat glyphs land at 0.0-3.4 (Plex 0.53, Nginx 0.79, CCWB 3.4), anything with
  // internal structure at 17.3 and up (CrowdSec 17.3, Unraid's question.png 19.8, OpenCloud 39.0),
  // and 12 sits in the empty gap. Borderline icons get tinted, because flattening one that needed
  // a tint destroys it: at 32 question.png lost its "?" and became a white disc.
  var ICON_SIMPLE_MAX = 12;
  var ICON_ALPHA_MIN = 20;    // a pixel counts as "content" above this alpha
  var icoRes = {};            // normalised name -> {kind, source, slug}
  var icoWant = {};           // names asked for but not yet answered
  var icoInflight = false, icoTimer = null, icoLast = 0;
  var icoListeners = [];
  var icoSimple = {};         // icon URL -> luminance stddev, or -1 when unmeasurable
  var icoMeasuring = {};

  function icoNorm(n) { return String(n == null ? "" : n).trim().toLowerCase(); }
  function icoValidMode(m) { return ICON_MODES.indexOf(m) >= 0 ? m : null; }
  // The global default. Anything unrecognised (or unset) is "auto".
  function iconGlobalMode() { return icoValidMode(g("cc.iconmode", "auto")) || "auto"; }
  // Per-item pins share one cc.* key, keyed "<scope>:<lowercased name>", so the settings sync
  // carries them.
  function iconOverrides() { try { var j = JSON.parse(g("cc.iconov", "null")); return (j && typeof j === "object") ? j : {}; } catch (e) { return {}; } }
  function iconOverride(scope, name) { return icoValidMode(iconOverrides()[scope + ":" + icoNorm(name)]) || ""; }
  function setIconOverride(scope, name, mode) {
    var all = iconOverrides(), k = scope + ":" + icoNorm(name);
    if (icoValidMode(mode)) all[k] = mode; else delete all[k];
    s("cc.iconov", JSON.stringify(all));
  }
  // The mode actually in force for one item: its own pin, else the global default.
  function iconMode(scope, name) { return iconOverride(scope, name) || iconGlobalMode(); }

  // Steps 2 and 3: one batched POST per page, answered from the engine's cache. Names still being
  // looked up come back "pending" and are asked for again later.
  function iconWant(names) {
    var fresh = false;
    for (var i = 0; i < (names || []).length; i++) {
      var k = icoNorm(names[i]);
      if (!k || icoRes[k] || icoWant[k]) continue;
      icoWant[k] = 1; fresh = true;
    }
    // Pending names are asked for at most every 6s, so a page full of them does not hammer the
    // engine while its workers warm the cache.
    var pending = false, kk;
    for (kk in icoRes) { if (icoRes[kk] && icoRes[kk].kind === "pending") { pending = true; break; } }
    if (fresh || (pending && Date.now() - icoLast > 6000)) icoFlush();
  }
  function icoFlush() {
    if (icoInflight) return;
    var names = [], k;
    for (k in icoWant) names.push(k);
    for (k in icoRes) { if (icoRes[k] && icoRes[k].kind === "pending") names.push(k); }
    if (!names.length) return;
    icoInflight = true; icoLast = Date.now();
    var tok = "";
    try {
      if (typeof window.csrf_token === "string" && window.csrf_token) tok = window.csrf_token;
      else { var f = document.querySelector('input[name="csrf_token"]'); if (f && f.value) tok = f.value; else { var m = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m) tok = m[1]; } }
    } catch (e) {}
    fetch(ICON_PROXY + "?path=icons", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: (tok ? "csrf_token=" + encodeURIComponent(tok) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify({ names: names }))
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      icoInflight = false;
      // A 502 from the proxy (engine stopped) or an engine without the icons endpoint: settle
      // every name on "none" so the page keeps its native icons and stops asking until a reload.
      if (!j || typeof j !== "object") { icoSettleNone(); return; }
      var changed = false;
      Object.keys(j).forEach(function (n) {
        var key = icoNorm(n), v = j[n] || {};
        var was = icoRes[key];
        if (!was || was.kind !== v.kind) changed = true;
        icoRes[key] = { kind: v.kind || "none", source: v.source || "", slug: v.slug || "" };
        delete icoWant[key];
      });
      if (changed) { icoPolls = 0; icoNotify(); }
      icoDrain();
    }).catch(function () { icoInflight = false; icoSettleNone(); icoDrain(); });
  }
  // icoFlush skips names asked for while a batch is in flight, and the Plugins tab asks row by
  // row, so drain the queue after each batch and keep asking while anything is pending.
  function icoDrain() {
    if (Object.keys(icoWant).length) { setTimeout(icoFlush, 0); return; }
    icoPoll();
  }
  // The Plugins and VM tabs do not repaint on their own, so the pipeline polls for pending names
  // itself. It stops once nothing is pending or after icoPollMax tries, so a name the engine can
  // never resolve does not poll forever.
  var icoPollT = null, icoPolls = 0, icoPollMax = 10;
  function icoPoll() {
    if (icoPollT || icoPolls >= icoPollMax) return;
    var pending = false;
    for (var k in icoRes) { if (icoRes[k] && icoRes[k].kind === "pending") { pending = true; break; } }
    if (!pending) return;
    icoPollT = setTimeout(function () { icoPollT = null; icoPolls++; icoFlush(); }, 4000);
  }
  // On failure every name still waited on becomes "none", which means the native icon.
  function icoSettleNone() {
    var changed = false;
    Object.keys(icoWant).forEach(function (key) { if (!icoRes[key]) { icoRes[key] = { kind: "none", source: "", slug: "" }; changed = true; } delete icoWant[key]; });
    if (changed) icoNotify();
  }
  function icoNotify() {
    clearTimeout(icoTimer);
    icoTimer = setTimeout(function () { icoListeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }, 30);
  }
  // An area script registers one repaint callback. It fires only when an answer changed, so it
  // cannot become a render loop.
  function onIconsResolved(fn) { if (typeof fn === "function" && icoListeners.indexOf(fn) < 0) icoListeners.push(fn); }
  function iconResult(name) { return icoRes[icoNorm(name)] || null; }
  // The engine serves its cached artwork as image/svg+xml through the same-origin proxy, so an
  // <img> can point at it and the canvas heuristic can read it back without tainting.
  function iconSvgUrl(name) { return ICON_PROXY + "?path=iconsvg&name=" + encodeURIComponent(icoNorm(name)); }

  // Step 1: draw the icon small and take the standard deviation of luminance over its opaque
  // pixels, cached per URL. Until a measurement lands the caller uses the safe tint, and the
  // repaint callback upgrades it afterwards.
  function iconSpread(url) {
    if (!url) return null;
    if (icoSimple[url] != null) return icoSimple[url] < 0 ? null : icoSimple[url];
    try { var c = sessionStorage.getItem("ccico:" + url); if (c != null) { icoSimple[url] = parseFloat(c); return icoSimple[url] < 0 ? null : icoSimple[url]; } } catch (e) {}
    if (icoMeasuring[url]) return null;
    icoMeasuring[url] = 1;
    var probe = new Image();
    var done = function (v) {
      icoSimple[url] = v; delete icoMeasuring[url];
      try { sessionStorage.setItem("ccico:" + url, String(v)); } catch (e2) {}
      icoNotify();
    };
    probe.onerror = function () { done(-1); };
    probe.onload = function () {
      try {
        var W = 48, cv = document.createElement("canvas"); cv.width = cv.height = W;
        var cx = cv.getContext("2d", { willReadFrequently: true });
        var nw = probe.naturalWidth || W, nh = probe.naturalHeight || W;
        var sc = Math.min(W / nw, W / nh), dw = nw * sc, dh = nh * sc;
        cx.drawImage(probe, (W - dw) / 2, (W - dh) / 2, dw, dh);
        var d = cx.getImageData(0, 0, W, W).data, n = 0, sum = 0, sq = 0;
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 3] <= ICON_ALPHA_MIN) continue;
          var L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          n++; sum += L; sq += L * L;
        }
        if (n < 16) { done(-1); return; }   // too little content to judge: leave it alone
        var mean = sum / n, varc = Math.max(0, sq / n - mean * mean);
        done(Math.round(Math.sqrt(varc) * 100) / 100);
      } catch (e3) { done(-1); }            // a tainted canvas (cross-origin icon) lands here
    };
    probe.src = url;
    return null;
  }

  // Pure, so a DOM test can pin every branch without a browser.
  //   treat: "flat" | "tint" | "native"      what to do to the pixels
  //   src:   "native" | "glyph" | "color"    which picture to do it to
  // A glyph is only chosen when it will be inked, since an un-inked monochrome glyph on a dark
  // card is a black square.
  function iconPlan(mode, kind, spread) {
    if (mode === "native") return { treat: "native", src: kind === "color" ? "color" : "native", why: "mode:native" };
    if (mode === "flat") return { treat: "flat", src: kind === "glyph" ? "glyph" : "native", why: "mode:flat" };
    if (mode === "tint") return { treat: "tint", src: kind === "color" ? "color" : "native", why: "mode:tint" };
    if (spread != null && spread < ICON_SIMPLE_MAX) return { treat: "flat", src: "native", why: "simple:" + spread };
    if (kind === "glyph") return { treat: "flat", src: "glyph", why: "glyph" };
    if (kind === "color") return { treat: "tint", src: "color", why: "color" };
    return { treat: "tint", src: "native", why: spread == null ? "unmeasured" : "complex:" + spread };
  }

  // The per-item mode picker as an anchored popover, for tabs such as Plugins that have no
  // per-item settings window. Docker offers the same options in its Startplan window and the VM
  // tab in its limits editor.
  function iconPopover(anchor, scope, name, onChange) {
    var de = false;
    try { de = /de/i.test(document.documentElement.lang || "") || (localStorage.getItem("locale") || "").indexOf("de") === 0; } catch (e) {}
    var old = document.getElementById("cc-icm-pop"); if (old) old.remove();
    var ov = document.createElement("div"); ov.id = "cc-icm-pop";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999";
    var card = document.createElement("div");
    card.style.cssText = "position:absolute;background:var(--cc-bg,#161616);color:var(--cc-txt,#e6e6e6);border-radius:10px;padding:12px 14px;width:250px;max-width:92vw;box-shadow:0 2px 5px rgba(0,0,0,.38),0 14px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.05);font:13px/1.5 \"Segoe UI\",system-ui,sans-serif";
    var h = document.createElement("div");
    h.textContent = (de ? "Icon-Färbung" : "Icon colouring") + ": " + name;
    h.style.cssText = "font-size:13px;font-weight:700;margin:0 0 8px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    card.appendChild(h);
    var opts = de
      ? [["", "folgt globaler Einstellung"], ["auto", "Automatisch"], ["native", "Natives Icon"], ["flat", "Ink-Flatten"], ["tint", "Luminanz-Tint"]]
      : [["", "follows the global setting"], ["auto", "Automatic"], ["native", "Native icon"], ["flat", "Ink flatten"], ["tint", "Luminance tint"]];
    var sel = document.createElement("select");
    sel.style.cssText = "width:100%;background:var(--cc-surface-3,#2e2e2e);color:var(--cc-txt,#e6e6e6);border:none;border-radius:6px;padding:6px 10px;font-size:13px;outline:none";
    var cur = iconOverride(scope, name);
    opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === cur) op.selected = true; sel.appendChild(op); });
    sel.addEventListener("change", function () { setIconOverride(scope, name, sel.value); if (typeof onChange === "function") { try { onChange(); } catch (e2) {} } });
    card.appendChild(sel);
    ov.appendChild(card); document.body.appendChild(ov);
    try {
      var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
      var cw = card.offsetWidth || 250, ch = card.offsetHeight || 90;
      if (r && (r.width || r.height)) {
        var left = Math.max(8, Math.min(r.left, window.innerWidth - cw - 12));
        var top = r.bottom + 6; if (top + ch > window.innerHeight - 8) top = Math.max(8, r.top - ch - 6);
        card.style.left = left + "px"; card.style.top = top + "px";
      } else { card.style.left = "50%"; card.style.top = "20vh"; card.style.transform = "translateX(-50%)"; }
    } catch (e3) { card.style.left = "50%"; card.style.top = "20vh"; }
    ov.addEventListener("click", function (ev) { if (ev.target === ov) ov.remove(); });
    return ov;
  }

  window.CCTheme = {
    RB: RB, idealText: idealText, rbSeed: rbSeed, palette: palette, rbColor: rbColor, paintSelects: paintSelects,
    registerSelectSync: registerSelectSync, nextSelIndex: nextSelIndex, wheelStepSelect: wheelStepSelect,
    gfonts: GFONTS, loadGFonts: loadGFonts, primaryFamily: primaryFamily,
    CC_INFO_SVG: CC_INFO_SVG, infoIcon: infoIcon, CC_TRASH_SVG: CC_TRASH_SVG,
    lumOf: lumOf, LUM_FLOOR: LUM_FLOOR, liftDark: liftDark,
    icons: {
      MODES: ICON_MODES, SIMPLE_MAX: ICON_SIMPLE_MAX,
      globalMode: iconGlobalMode, mode: iconMode, override: iconOverride, setOverride: setIconOverride,
      want: iconWant, result: iconResult, svgUrl: iconSvgUrl, spread: iconSpread,
      plan: iconPlan, onResolved: onIconsResolved, popover: iconPopover
    }
  };

  // Syncs cc.* settings across browsers and origins, since localStorage is per origin and per
  // browser. docker.js and settings.js mirror every cc.* write into the engine's
  // config.ui_settings on their own pages and adopt it back on load; this covers every other page
  // and skips those two, so localStorage.setItem is not wrapped twice.
  (function () {
    if (/^\/Docker(\/|$)/.test(location.pathname) || /^\/Settings\/CannonadeCommand(\/|$)/.test(location.pathname)) return;
    var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
    function apiGet(path) {
      return fetch(PROXY + "?path=" + encodeURIComponent(path), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    function csrfToken() {
      try {
        if (typeof window.csrf_token === "string" && window.csrf_token) return window.csrf_token;
        var f = document.querySelector('input[name="csrf_token"]'); if (f && f.value) return f.value;
        var m = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m) return m[1];
      } catch (e) {}
      return "";
    }
    function apiPut(path, body) {
      var tok = csrfToken();
      return fetch(PROXY + "?path=" + encodeURIComponent(path), {
        method: "PUT", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: (tok ? "csrf_token=" + encodeURIComponent(tok) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body || {}))
      }).catch(function () {});
    }
    var pending = {}, syncT = null;
    try {
      if (!window.__ccLS) {
        var orig = localStorage.setItem.bind(localStorage);
        window.__ccLS = orig;
        localStorage.setItem = function (k, v) {
          orig(k, v);
          try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { pending[k] = 1; clearTimeout(syncT); syncT = setTimeout(push, 800); } } catch (e) {}
        };
      }
    } catch (e) {}
    // A removed key is queued too, and push() deletes it on the server; otherwise the next
    // adopt() would bring the old value back.
    try {
      if (!window.__ccLSRemove) {
        var origRm = localStorage.removeItem.bind(localStorage);
        window.__ccLSRemove = origRm;
        localStorage.removeItem = function (k) {
          origRm(k);
          try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { pending[k] = 1; clearTimeout(syncT); syncT = setTimeout(push, 800); } } catch (e) {}
        };
      }
    } catch (e) {}
    function push() {
      var keys = Object.keys(pending); if (!keys.length) return;
      apiGet("config").then(function (c) {
        if (!c || typeof c !== "object") return;
        var u = c.ui_settings || {};
        keys.forEach(function (k) { var v = localStorage.getItem(k); if (v === null) delete u[k]; else u[k] = v; });
        pending = {};
        return apiPut("config", { schedules: c.schedules || [], watchdogs: c.watchdogs || [], bandwidths: c.bandwidths || [], idle_stops: c.idle_stops || [], notify: c.notify || { unraid: false, webhook: "" }, shape_iface: c.shape_iface || "", ui_settings: u });
      });
    }
    function adopt(u) {
      var changed = false;
      try { Object.keys(u || {}).forEach(function (k) { if (/^cc[a-z]*\./.test(k) && k !== "cc.stateCache" && localStorage.getItem(k) !== u[k]) { (window.__ccLS || localStorage.setItem.bind(localStorage))(k, u[k]); changed = true; } }); } catch (e) {}
      return changed;
    }
    // adopt() corrects localStorage from the server copy after the page has already drawn itself
    // with the old values, so call the repaint hooks the area scripts expose for live toggles and
    // the correction shows without another reload.
    var CC_AREA_APPLY_HOOKS = ["ccHeaderApply", "ccSharesApply", "ccVmsApply", "ccPluginsApply", "ccFavoritesApply", "ccSettingsGridApply"];
    function rerenderAdoptedAreas() {
      CC_AREA_APPLY_HOOKS.forEach(function (fnName) {
        try { if (typeof window[fnName] === "function") window[fnName](); } catch (e) {}
      });
    }
    apiGet("config").then(function (c) {
      if (!c || typeof c !== "object") return;
      if (adopt(c.ui_settings)) rerenderAdoptedAreas();
      if (!c.ui_settings || !Object.keys(c.ui_settings).length) {
        var seed = {};
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^cc[a-z]*\./.test(k) && k !== "cc.stateCache") seed[k] = localStorage.getItem(k); } } catch (e) {}
        if (Object.keys(seed).length) { Object.keys(seed).forEach(function (k) { pending[k] = 1; }); push(); }
      }
    });
  })();
})();
