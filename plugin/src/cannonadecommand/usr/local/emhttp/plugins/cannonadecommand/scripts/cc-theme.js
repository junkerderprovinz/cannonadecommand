/* CannonadeCommand - SHARED THEME MODULE (the JS half of the theme engine, stage C).
 *
 * ONE canonical home for the theming helpers that were copy-pasted across every area
 * script (docker/header/settingsgrid/shares/favorites/vms/...). Loaded GLOBALLY and
 * SYNCHRONOUSLY from CannonadeCommand.Tokens.page (Menu="Buttons:94"), so window.CCTheme
 * exists before any area script runs.
 *
 * Why this exists — the bug it fixes:
 *   Each area script rolled its OWN rainbow offset with Math.floor(Math.random()*len) at
 *   load time. So with rainbow rotation on, every area started the palette on a DIFFERENT
 *   hue AND reshuffled on every page reload — the "badges/toggles don't carry the theme
 *   consistently" symptom. rbSeed() replaces that with ONE integer seed, computed once and
 *   persisted (cc.rbseed), read by every area: the rainbow now aligns across areas and stays
 *   stable across reloads. Rainbow is OFF by default (cc.rainbow != "1"), so for most users
 *   this changes nothing; for rainbow users it only aligns + stabilises.
 *
 * Every export is a PURE, standalone function with no dependency on the area scripts, and
 * each area keeps a byte-identical local fallback, so a missed load order degrades to the
 * old per-file behaviour instead of breaking. Idempotent: re-defining is a no-op.
 */
(function () {
  "use strict";
  if (window.CCTheme) return;

  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // The canonical 8-hue rainbow (red→pink). JEWEL-CLAMPED (design panel): every hue is generated at ONE
  // fixed saturation + lightness, so the eight read as a matched set of gemstones instead of eight
  // max-saturation crayons — the single biggest "toy → edel" move, and it stabilises idealText because the
  // luminance no longer swings hue to hue. Only the HUE spins; S/L are pinned.
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
  // hues kept close to the old red/orange/gold/green/teal/blue/violet/pink so the palette stays recognisable
  var RB = [0, 26, 45, 142, 176, 216, 262, 330].map(function (h) { return hsl2hex(h, 0.50, 0.58); });

  // Auto text-contrast: dark ink on light accents, white on dark. Byte-identical to the copy
  // every area script carried (threshold 150 on Rec-601 luma).
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
    return L > 150 ? "#161616" : "#fff";
  }

  // The ONE shared rainbow offset. A single integer seed, computed once at random and then
  // frozen in cc.rbseed, so `seed % paletteLength` is the SAME rotation in every area and on
  // every reload. Pass the caller's palette length (7 or 8) — indices 0..6 line up regardless.
  function rbSeed(len) {
    var v = parseInt(g("cc.rbseed", ""), 10);
    if (isNaN(v) || v < 0) { v = Math.floor(Math.random() * 9973); s("cc.rbseed", String(v)); } // prime modulus base
    return len > 0 ? (v % len) : 0;
  }

  // Active palette resolver (flag mode overrides the rainbow palette, but only its own key):
  // in cc.flagmode read cc.flagpal, else the user's cc.rbpal, else the supplied default.
  function palette(def) {
    try {
      if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; }
      var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p;
    } catch (e) {}
    return def || RB;
  }

  // Convenience: the colour a rainbow item i should take. Returns the plain accent when rainbow
  // is off. Honours rotation (cc.rainbowrot, default on) and the shared seed.
  function rbColor(i, accent, def) {
    if (g("cc.rainbow", "0") !== "1") return accent;
    var p = palette(def), off = g("cc.rainbowrot", "1") === "0" ? 0 : rbSeed(p.length);
    return p[((i % p.length) + off) % p.length];
  }

  // ── COLOUR MODES FOR EVERY CC DROPDOWN (user: "Alle drop down listen sind nicht in den farbmodi").
  // CC grew FOUR dropdown replacements, one per area, and only ONE of them was ever wired into the
  // colour modes: header.js's .cc-tsel, which ccPaintRotate() stamps. The other three were never
  // stamped at all, so in rainbow/flag mode every option in them fell through to the flat accent and
  // nothing rotated (live-measured: 7 .cc-dsel in the Startplan window, 11 on the CC settings page,
  // 16 on the share-detail page, all with no --cc-rb-c anywhere):
  //   · .cc-dsel  — the Docker add-container form, the CC settings page, and every .cc-pop window
  //                 (Startplan editor, CPU/RAM limits, bandwidth);
  //   · .cc-sel   — the share-detail page;
  //   · .cc-drop  — the Startplan editor's "Hängt ab von" multi-select (user: "das hängt ab von drop
  //                 down ist nicht im GlimStone") — the one that was not even chip-shaped.
  // One painter for all three, and it lives HERE because this is the only file that loads on every
  // page, so no area can be given the guard and no area be missed.
  // .cc-tsel is DELIBERATELY absent from these selectors: ccPaintRotate() rotates it inside the same
  // page-wide sequence as the toggles it sits among (so a dropdown never repeats its neighbour's
  // colour), and a second painter stamping the same element would fight it on every pass.
  var CC_SEL_WRAPS = ".cc-dsel, .cc-sel";
  var CC_SEL_PANELS = ".cc-dsel-panel, .cc-sel-panel, .cc-drop";
  var CC_SEL_OPTS = ".cc-dsel-opt, .cc-sel-opt, .cc-drop-it";
  function paintSelects(root) {
    try {
      var scope = (root && root.querySelectorAll) ? root : document;
      // Rainbow OFF (or theming off) un-stamps rather than painting: the sheets' own
      // var(--cc-rb-c, var(--cc-rbaccent, <area accent>)) chain then resolves to the accent, which is
      // exactly what accent mode is supposed to look like. Flag mode rides rbColor()'s palette().
      var on = g("cc.theming", "1") !== "0" && g("cc.rainbow", "0") === "1";
      var i, n, c;
      var wraps = scope.querySelectorAll(CC_SEL_WRAPS);
      for (i = 0; i < wraps.length; i++) {
        if (!on) { wraps[i].style.removeProperty("--cc-rb-c"); wraps[i].style.removeProperty("--cc-rb-ct"); continue; }
        c = rbColor(i, null);   // guarded by `on`, so this never returns the null accent
        wraps[i].style.setProperty("--cc-rb-c", c); wraps[i].style.setProperty("--cc-rb-ct", idealText(c));
      }
      // rotate WITHIN each panel, like ccPaintRotate does for .cc-tsel-panel: an open list reads as a
      // rainbow of items rather than one flat colour repeated down the column.
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

  // ── Web fonts for the server-name wordmark (user: "schönere schriften z.B. von google fonts"). A curated
  //    set of beautiful Google families [family, genericFallback], loaded on demand so they render for
  //    EVERYONE regardless of what the client has installed (the old list only rendered if the client
  //    happened to have the face). loadGFonts merges families into ONE <link> so the header (the one
  //    selected family) and the settings dropdown (all, for the previews) never clobber each other.
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

  // ── THE (i) INFO BUBBLE — one glyph, one builder, for every area script.
  // GlimStone Rule 8 names CC's `cc-info` as the reference implementation of the info bubble, so CC of all
  // apps may not carry FOUR of them. It did: header.js ccMakeInfo, settings.js infoIcon and shares.js
  // ccInfoIcon each hand-rolled the same ring-plus-stem SVG with slightly different radii/stroke widths
  // (r=7.1/sw=1.2 twice, r=7/sw=1.4 once), and docker.js infoBubble was a different component altogether
  // (a text "ⓘ" on a disc, with its own locally-anchored .cc-tip child). They now all call this.
  // THE GLYPH IS AN OUTLINE RING, and that is deliberate — it is the ONE exception to Rule 20 (icons are
  // filled) and to Rule 5 (no border lines), spelled out in GlimStone's Rule 20 and its "Die Infoblase"
  // section. 4.26.0 got this WRONG: unifying the four builders was right, but it also swapped the ring for
  // tabler icons/filled/info-circle.svg on the reasoning that Rule 20 applied. It does not. The ring IS the
  // letter "i" set in a circle — filling it turns the glyph into a meaningless disc rather than a cleaner
  // "i", and the circle is a meaning-bearing line, not decorative box chrome. Byte-for-byte the reference
  // markup from GlimStone (BombVault's InfoBubble.tsx): r=7, stroke-width=1.3, dot r=0.9, and the stem is a
  // <path> with stroke-linecap="round" — NOT a <rect>, whose rx rounds the ends visibly differently.
  // NEUTRAL, never accent (Rule 8): stroke and fill are both currentColor, and .cc-info in the sheets
  // resolves that to var(--txt) at ~.8 opacity (full on hover/focus).
  // The TEXT is carried as data-tip and rendered by header.js's ONE body-level #cc-tipfloat — never a
  // local child, which any overflow:hidden ancestor clips.
  var CC_INFO_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>';
  function infoIcon(tip) {
    var s = document.createElement("span");
    s.className = "cc-info";
    s.innerHTML = CC_INFO_SVG;
    if (tip) { s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); }
    s.setAttribute("tabindex", "0");   // Rule 8: reachable by keyboard, so focus opens it like hover does
    return s;
  }

  // ── THE TRASH GLYPH — one filled can for every icon-only destructive control, same reasoning as the
  // (i) above: a second hand-drawn version is how the four info bubbles drifted apart in the first place.
  // tabler-icons (MIT) icons/filled/trash.svg, copied verbatim from the set's own FILLED variant per Rule
  // 20 — NOT the outline path with fill/stroke swapped, which turns open stroke geometry into a scribble.
  var CC_TRASH_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007zm-10 4a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1m4 0a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1" /><path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005z" /></svg>';

  window.CCTheme = { RB: RB, idealText: idealText, rbSeed: rbSeed, palette: palette, rbColor: rbColor, paintSelects: paintSelects, gfonts: GFONTS, loadGFonts: loadGFonts, primaryFamily: primaryFamily, CC_INFO_SVG: CC_INFO_SVG, infoIcon: infoIcon, CC_TRASH_SVG: CC_TRASH_SVG };

  // ── cross-origin/cross-browser UI-settings sync (user: "wenn CC aktiviert ist sieht es in
  // unterschiedlichen Browsern unterschiedlich aus... können wir das persistent machen?").
  // localStorage is per-ORIGIN and per-BROWSER: every cc.* toggle only ever lived in the one
  // browser/origin it was set in. docker.js and settings.js already mirror every cc.* write
  // into the engine's config.ui_settings and adopt it back on load ("cross-origin settings
  // sync" in docker.js) — but that mechanism only ever ran on /Docker and
  // /Settings/CannonadeCommand, the only two pages those files load on. Every OTHER page
  // (Apps, Plugins, VMs, Shares, Unraid's own Settings pages, ...) never synced at all, which
  // is the actual root cause of "looks different per browser" for anything configured or
  // viewed outside those two pages. This file loads globally+synchronously on EVERY page, so
  // it is the one place that can close that gap. docker.js/settings.js's own copies are left
  // untouched (their extra migration/export logic stays there) — skipped here on the two pages
  // that already sync, so localStorage.setItem is never double-wrapped.
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
    apiGet("config").then(function (c) {
      if (!c || typeof c !== "object") return;
      // silently corrects localStorage now; already-painted classes catch up on the next
      // natural navigation/reload — no forced reload here, this file has no re-render hook.
      adopt(c.ui_settings);
      if (!c.ui_settings || !Object.keys(c.ui_settings).length) {
        var seed = {};
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^cc[a-z]*\./.test(k) && k !== "cc.stateCache") seed[k] = localStorage.getItem(k); } } catch (e) {}
        if (Object.keys(seed).length) { Object.keys(seed).forEach(function (k) { pending[k] = 1; }); push(); }
      }
    });
  })();
})();
