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

  // Rec-601 luma of a hex colour, 0-255. The ONE copy: header.js's popBadge, the icon
  // pipeline's darkness guard and idealText all measure brightness the same way.
  function lumOf(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 255;
    var n = parseInt(m[1], 16);
    return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
  }

  // ── THE DARKNESS GUARD (canonical home; header.js's popBadge delegates here).
  // A near-black palette slot — the German flag's black stripe, a hand-picked #2a2a2a —
  // paints an INVISIBLE badge on CC's #161616/#1e1e1e surfaces. Swap any slot below the
  // floor for the palette's BRIGHTEST slot (stays on-theme: the flag's gold rather than
  // some invented colour), and fall back to the plain accent when the whole palette is dark.
  //
  // FLOOR = 28, and that number was measured, not guessed: 64 was the original value from
  // when this only ever coloured the ONE popup title badge; once every section badge and
  // button rotated through it, 64 swapped the Algerian flag's #006233 (luma 63.3) for the
  // brightest slot and the window rendered white/white/red instead of the flag's cycle. 28
  // still catches #000000 (genuinely invisible) while keeping legitimately dark FLAG colours
  // that read perfectly with white text — #006233 and e.g. navy #002868 (35.4).
  //
  // `floor` is an argument because a luminance TINT is not a solid fill: its output is
  // pixelLuminance x target, so a mid-bright icon lands at roughly HALF the target's luma
  // and a target that clears the badge floor can still tint darker than the card behind it.
  // The tint path therefore passes LUM_FLOOR * 2 — same algorithm, same constant, one
  // implementation, just measured against what the eye actually receives.
  var LUM_FLOOR = 28;
  function liftDark(hex, accent, floor) {
    if (floor == null) floor = LUM_FLOOR;
    if (!hex) return hex;
    if (lumOf(hex) >= floor) return hex;
    var p = palette(), best = null, bl = -1;
    for (var k = 0; k < p.length; k++) { var L = lumOf(p[k]); if (L > bl) { bl = L; best = p[k]; } }
    return (best && bl >= floor) ? best : (accent || hex);
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

  // ── GLIMSTONE RULE 21: A CLOSED SELECT FIELD IS OPERABLE WITH THE SCROLL WHEEL ─────────
  // A native <select> lets you hover the collapsed field and wheel straight through its values in
  // most browsers. CC replaces native selects wherever the host UI puts one (Rule 18), and every
  // one of those replacements silently dropped that convenience — a replacement that is worse than
  // the control it replaced. Rule 21 makes it a house law, and "every variant, not just the one
  // reported" is part of the rule, so this lives HERE: cc-theme.js is the only file that loads on
  // every page, and it already owns the shared selectors for all the select-replacement families.
  //
  // The FOUR dropdown families, and what each gets:
  //   · .cc-tsel  (header.js — Tools/Settings/Dashboard)   ] all three are <select>-BACKED: the real
  //   · .cc-dsel  (docker.js form, CC settings, .cc-pop)   ] control is still there, display:none, as
  //   · .cc-sel   (shares.js share detail)                 ] the value. Wheel = change selectedIndex.
  //   · .cc-drop  (the Startplan editor's "Hängt ab von" multi-select and the time picker) — NOT
  //     wheel-cycled, and that is not an omission: .cc-drop has no closed field at all. It is created
  //     on focus, lives as a body child while open and is removed on close, and it holds a MANY
  //     selection (a comma list) with no "next value" to step to. Rule 21 governs a closed field
  //     standing for ONE value; the thing you hover there is a text input, and stepping a text input
  //     would delete the user's other picks. Its open panel keeps its own normal scrolling.
  //
  // Deliberately conservative, because a wheel handler on a document is easy to get wrong:
  //   · ONLY when the pointer is over a CLOSED widget. An OPEN panel keeps its own list scrolling
  //     (that is what .cc-open and the panel test below are for), and anywhere else the page scrolls
  //     exactly as before.
  //   · preventDefault ONLY when a value actually changed, so a wheel over a disabled or
  //     single-option field still scrolls the page instead of silently swallowing the gesture.
  //   · CLAMPING, not wrapping, at the ends — the same as this app's own segmented pickers, whose
  //     panels move the highlight with ArrowUp/ArrowDown and stop at the first/last item
  //     (settings.js moveSel, header.js ccTselMove). Wrapping would also make a fast wheel over a
  //     two-option field flip-flop unpredictably.
  //   · It goes through the SAME commit path a real option click uses — write selectedIndex, dispatch
  //     a bubbling `change`, then re-sync the widget — so every inline onchange the host page hangs
  //     on that <select> fires exactly as it would have.
  var CC_SEL_WHEEL = ".cc-tsel, .cc-dsel, .cc-sel";
  var selSyncFns = [];
  // Each family registers its OWN sync (the one its click handler calls), because they are not
  // interchangeable: .cc-tsel re-inserts a locale flag image and rebuilds on an option-count change,
  // which a generic mirror would quietly drop. A family that registers nothing falls back to
  // ccSelMirror below, so a new widget is never left unpainted.
  function registerSelectSync(fn) { if (typeof fn === "function" && selSyncFns.indexOf(fn) < 0) selSyncFns.push(fn); }
  // The lowest-common-denominator repaint: trigger label + per-chip selected/disabled state. All
  // three families share this shape (.cc-X-trigger, .cc-X-opt[data-i]).
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
  // Next selectable index in `dir`, skipping disabled options, clamped at both ends.
  // Returns the SAME index when there is nowhere to go — the caller reads that as "no change".
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
    // passive:false — a handled step must be able to stop the page from scrolling underneath it
    document.addEventListener("wheel", function (e) {
      try {
        if (e.ctrlKey || e.metaKey || e.altKey) return;               // browser zoom / OS gestures stay theirs
        var t = e.target;
        if (!t || !t.closest) return;
        // an OPEN panel scrolls its own list, unchanged — this is only for the collapsed field
        if (t.closest(".cc-tsel-panel, .cc-dsel-panel, .cc-sel-panel, .cc-drop")) return;
        var wrap = t.closest(CC_SEL_WHEEL);
        if (!wrap || wrap.classList.contains("cc-open")) return;
        if (wrap.classList.contains("cc-tsel-disabled") || wrap.classList.contains("cc-dsel-disabled") || wrap.classList.contains("cc-sel-disabled")) return;
        var dy = e.deltaY || 0, dx = e.deltaX || 0;
        var d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
        if (!d) return;
        if (wheelStepSelect(wrap, d > 0 ? 1 : -1)) e.preventDefault();  // ONLY when something changed
      } catch (e3) {}
    }, { passive: false, capture: true });
  }
  bindSelectWheel();

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

  // ── THE ICON PIPELINE ───────────────────────────────────────────────────────────────
  // THE PROBLEM IT SOLVES. CC used to have exactly two icon treatments and no way to tell
  // which one an icon wanted:
  //   · ink-FLATTEN (feColorMatrix -> one flat colour): gorgeous on a real glyph — a mostly
  //     transparent image whose opaque pixels are all one tone — and catastrophic on anything
  //     else. Most icons a Docker image or a CA template ships are full-opacity, full-colour
  //     art with a coloured BACKGROUND and a differently-coloured MARK on top. Flatten one of
  //     those and background and mark become the same colour: an illegible black blob
  //     (confirmed live on OpenCloud's shipped icon).
  //   · luminance-TINT (channel = pixel luminance x target): safe on anything, but it never
  //     has the crisp badge-ink look a true glyph gets.
  // So the answer is not a better filter, it is knowing WHICH KIND OF PICTURE this is — and,
  // when it is the wrong kind, going and finding a better one.
  //
  // THE CHAIN, cheapest check first, and every step degrades into the next:
  //   1. IS IT ALREADY SIMPLE? Sample the icon on a canvas and take the standard deviation of
  //      per-pixel luminance across the opaque pixels. Low spread = the artwork is already one
  //      tone = flattening loses nothing. Free, local, no network, so it runs first, always.
  //   2. IS THERE A GLYPH FOR THIS APP? simple-icons (CC0-1.0) is monochrome single-path art
  //      by construction, so a hit there IS a glyph and flattens beautifully.
  //   3. OTHERWISE TINT THE BEST COLOUR SOURCE. dashboard-icons (Apache-2.0, 1800+ icons)
  //      before the container's own shipped icon, then luminance-tint whichever we got.
  // Steps 2 and 3 are answered by the engine, which caches both the verdict and the artwork on
  // the flash and only ever fetches on its own background workers — see internal/iconsrc. The
  // browser therefore never waits on a CDN, and an unreachable one costs nothing but a
  // "pending" that quietly stays native.
  //
  // MODES. cc.iconmode is the global default and cc.iconov holds per-item pins:
  //   auto   — the chain above (default)
  //   native — no recolouring; still prefers a curated colour icon over a poor shipped one
  //   flat   — always ink-flatten, heuristic overruled (a manual override is not a suggestion)
  //   tint   — always luminance-tint
  var ICON_PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var ICON_MODES = ["auto", "native", "flat", "tint"];
  // THE THRESHOLD, on a 0-255 luminance scale. Measured across all 55 containers of a real
  // box rather than picked: the spread is sharply BIMODAL. Genuine flat glyphs — the ones
  // that flatten beautifully — all land at 0.0-3.4 (Plex 0.53, Immich 0.57, Nginx 0.79,
  // FileBot 0.47, CCWB 3.4). The moment an icon has ANY internal structure the number jumps
  // to 17.3 and up (CrowdSec 17.3, Stirling-PDF 18.1, Unraid's own question.png placeholder
  // 19.8, Palworld 33.0, OpenCloud 39.0, BombVault 45.9, featherdrop 60.8). Nothing at all
  // lands between 3.4 and 17.3, so 12 sits in the middle of an empty gap.
  //
  // Why the CONSERVATIVE end of that gap and not the permissive one: the two mistakes are
  // not equally bad. Tinting an icon that would have flattened nicely costs a little
  // crispness. Flattening an icon that should have been tinted DESTROYS it — a plate with a
  // mark on it becomes one solid blob, which is the whole bug this feature exists to fix.
  // A first pass at 32 was live-tested and did exactly that to question.png: the "?" vanished
  // and the row showed a solid white disc. And no cheap pixel statistic tells that case apart
  // from CrowdSec, which flattens fine at 17.3 — measured, including an Otsu-style bimodality
  // split, which scores the two within 0.2 of each other. So the borderline band goes to the
  // treatment that can never destroy anything.
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
  // Per-item pins live in ONE cc.* key, so they ride the existing cross-origin settings sync
  // and need no storage mechanism of their own. Key = "<scope>:<lowercased name>".
  function iconOverrides() { try { var j = JSON.parse(g("cc.iconov", "null")); return (j && typeof j === "object") ? j : {}; } catch (e) { return {}; } }
  function iconOverride(scope, name) { return icoValidMode(iconOverrides()[scope + ":" + icoNorm(name)]) || ""; }
  function setIconOverride(scope, name, mode) {
    var all = iconOverrides(), k = scope + ":" + icoNorm(name);
    if (icoValidMode(mode)) all[k] = mode; else delete all[k];
    s("cc.iconov", JSON.stringify(all));
  }
  // The mode actually in force for one item: its own pin, else the global default.
  function iconMode(scope, name) { return iconOverride(scope, name) || iconGlobalMode(); }

  // ── step 2/3: ask the engine what it has. ONE batched POST for the whole page, answered
  // from its cache, so this is a local round trip and never a CDN one. Names still being
  // looked up come back "pending"; we simply ask again on the next pass.
  function iconWant(names) {
    var fresh = false;
    for (var i = 0; i < (names || []).length; i++) {
      var k = icoNorm(names[i]);
      if (!k || icoRes[k] || icoWant[k]) continue;
      icoWant[k] = 1; fresh = true;
    }
    // Re-ask for anything still pending, but at most every 6s — a page full of unresolved
    // names must not turn into a poll storm while the workers warm the cache.
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
      // A 502 from the proxy (engine stopped) or an older engine with no icons endpoint:
      // settle every asked-for name on a definite "none" so the page uses native icons and
      // stops asking. Live-verified with the daemon stopped: the batch is attempted ONCE and
      // never again, while the tab renders at its normal speed. A reload retries.
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
  // Names asked for WHILE a batch was in flight were dropped on the floor: icoFlush bails on
  // icoInflight, and nothing re-armed it afterwards. That is not theoretical — the Plugins tab
  // asks row by row, so exactly one plugin out of 23 ever got looked up (caught live). Drain
  // whatever queued up behind the request that just finished, then keep asking while anything
  // is still "pending".
  function icoDrain() {
    if (Object.keys(icoWant).length) { setTimeout(icoFlush, 0); return; }
    icoPoll();
  }
  // A "pending" name means the engine's workers are still out looking. The first design only
  // re-asked when the page happened to repaint — fine on the Docker tab with its 9s cycle,
  // but the Plugins and VM tabs can sit perfectly still, and their icons stayed unresolved
  // until something else moved (caught live: 22 of 23 plugins stuck on "pending" forever).
  // So the pipeline drives its own follow-up, BOUNDED: it stops the moment nothing is pending
  // and after icoPollMax tries either way, so a name the engine can never resolve cannot turn
  // into a permanent poll.
  var icoPollT = null, icoPolls = 0, icoPollMax = 10;
  function icoPoll() {
    if (icoPollT || icoPolls >= icoPollMax) return;
    var pending = false;
    for (var k in icoRes) { if (icoRes[k] && icoRes[k].kind === "pending") { pending = true; break; } }
    if (!pending) return;
    icoPollT = setTimeout(function () { icoPollT = null; icoPolls++; icoFlush(); }, 4000);
  }
  // The ONE failure landing: every name we were waiting on becomes a definite "none", which
  // the decision function reads as "no external source" — i.e. the native icon, exactly what
  // the page showed before this feature existed.
  function icoSettleNone() {
    var changed = false;
    Object.keys(icoWant).forEach(function (key) { if (!icoRes[key]) { icoRes[key] = { kind: "none", source: "", slug: "" }; changed = true; } delete icoWant[key]; });
    if (changed) icoNotify();
  }
  function icoNotify() {
    clearTimeout(icoTimer);
    icoTimer = setTimeout(function () { icoListeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }, 30);
  }
  // An area script registers ONE repaint callback; it fires only when an answer actually
  // changed, so this can never become a render loop.
  function onIconsResolved(fn) { if (typeof fn === "function" && icoListeners.indexOf(fn) < 0) icoListeners.push(fn); }
  function iconResult(name) { return icoRes[icoNorm(name)] || null; }
  // The engine serves its cached artwork as real image/svg+xml through the same-origin
  // proxy — so an <img> can point straight at it AND the canvas heuristic above can still
  // read it back without tainting.
  function iconSvgUrl(name) { return ICON_PROXY + "?path=iconsvg&name=" + encodeURIComponent(icoNorm(name)); }

  // ── step 1: the complexity heuristic. Draw the icon small, take the standard deviation of
  // luminance over the pixels that are actually opaque, and cache it per URL. Async by
  // design: until a measurement lands the caller uses the safe treatment (tint), and the
  // repaint callback upgrades it afterwards — nothing on the render path ever waits.
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

  // ── the decision. Pure, so a DOM test can pin every branch without a browser.
  //   treat: "flat" | "tint" | "native"      what to do to the pixels
  //   src:   "native" | "glyph" | "color"    which picture to do it to
  // A glyph is only ever chosen when we are going to INK it — an un-inked monochrome glyph
  // on a dark card would be a black square, which is the very bug this feature exists to kill.
  function iconPlan(mode, kind, spread) {
    if (mode === "native") return { treat: "native", src: kind === "color" ? "color" : "native", why: "mode:native" };
    if (mode === "flat") return { treat: "flat", src: kind === "glyph" ? "glyph" : "native", why: "mode:flat" };
    if (mode === "tint") return { treat: "tint", src: kind === "color" ? "color" : "native", why: "mode:tint" };
    if (spread != null && spread < ICON_SIMPLE_MAX) return { treat: "flat", src: "native", why: "simple:" + spread };
    if (kind === "glyph") return { treat: "flat", src: "glyph", why: "glyph" };
    if (kind === "color") return { treat: "tint", src: "color", why: "color" };
    return { treat: "tint", src: "native", why: spread == null ? "unmeasured" : "complex:" + spread };
  }

  // ── The per-item mode picker, as an anchored popover. It lives HERE because the Plugins
  // tab has no per-item settings window of its own to hang the choice in, and a second
  // hand-rolled copy of a five-option list is exactly how CC ended up with four different
  // info bubbles. Docker puts the same five options in its Startplan window and the VM tab
  // in its limits editor; this is the surface for anything that has neither.
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
    // Same gap as docker.js/settings.js: only setItem was ever intercepted, so a key cleared
    // via removeItem() on any page OTHER than /Docker or /Settings/CannonadeCommand (this file
    // is the one that covers every one of those) never got queued for the server-side delete,
    // and the stale value came right back on the next adopt(). push() above already deletes
    // the server key when the local read comes back null — only the missing queue-on-removal
    // needed adding.
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
