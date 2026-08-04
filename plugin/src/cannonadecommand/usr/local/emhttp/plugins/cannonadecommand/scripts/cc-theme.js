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

  // The canonical 8-hue rainbow (red→pink), byte-identical to the array every area script
  // (docker/header/settingsgrid/shares) carries verbatim today. One source of truth now; each
  // area passes its own palette length to rbSeed, so the shared seed rotates them all in step.
  var RB = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];

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

  window.CCTheme = { RB: RB, idealText: idealText, rbSeed: rbSeed, palette: palette, rbColor: rbColor };
})();
