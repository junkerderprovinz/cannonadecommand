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

  window.CCTheme = { RB: RB, idealText: idealText, rbSeed: rbSeed, palette: palette, rbColor: rbColor, gfonts: GFONTS, loadGFonts: loadGFonts, primaryFamily: primaryFamily };
})();
