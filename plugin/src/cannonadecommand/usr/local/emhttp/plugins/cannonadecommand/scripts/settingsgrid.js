// CannonadeCommand - GLOBAL Settings-page category-icon restyler.
//
// Loaded on EVERY Unraid page via the Buttons .page hook
// (CannonadeCommand.SettingsGrid.page). Like header.js it does the MINIMUM in JS:
//   * ONLY on the /Settings AND /Tools LANDING pages (identical .Panel tile grid) AND
//     when the "Einstellungen & Werkzeuge" area is enabled (cc.enable.settings != "0")
//     -> toggle html.cc-settingsgrid-on so the auto-injected sheet turns each
//     category-tile icon wrapper (a bare <span> inside the tile <a>) into a big square
//     accent badge. Any other page (a /Settings/<Name> or /Tools/<Name> sub-page) or a
//     disabled area = ZERO effect anywhere.
//   * mirror the CC accent/text/badge-shape vars onto the document root; in rainbow mode
//     paint each badge a rotated palette colour (accent mode = pure CSS via --cc-accent).
// All sizing/shape lives in sheets/CannonadeCommand.SettingsGrid.css, every rule of it
// scoped html.cc-settingsgrid-on. Default ON (opt-out under
// Settings > CannonadeCommand > Bereiche > Einstellungen).
(function () {
  "use strict";
  var mo = null, moPending = false;
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
    return L > 150 ? "#161616" : "#fff";
  }
  // adopt toggle: cc.stylesettings on -> shared cc.* keys, else this area's own ccs.* keys
  function eff(k, d) { return g("cc.stylesettings", "1") !== "0" ? g("cc." + k, d) : g("ccs." + k, d); }
  function accent() { var a = eff("accent", "#2f6feb"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#2f6feb"; }
  // accent-mode badge background: the badge's OWN colour (eff("iconbgcolor"), v4.32.5 — mirrors
  // docker.js/vms.js/plugins.js's cc.iconbgcolor) if valid, else the legacy eff("iconcolor")
  // (the pre-4.32.5 badge/tint shared key) if THAT is valid, else the accent. (identical
  // fallback chain to what apply() writes into --cc-iconbg-color.)
  //
  // CONFIRMED LIVE BUG (v4.32.5, fixed here): every one of these reads used to go straight
  // through g("ccs.<key>", d) — the area-LOCAL key only, bypassing eff() entirely. Since a user
  // configures colour/tint/background on the GLOBAL "Logos & Icons" card (cc.*), not a
  // Settings-page-specific override (ccs.*), ccs.iconcolor/ccs.iconbgcolor/ccs.iconbg/
  // ccs.icontint/ccs.iconstrength were essentially ALWAYS unset even with a valid global colour
  // and cc.stylesettings (adopt) ON — so bgColorEff() always fell through to accent(), the
  // rainbow-priority check in paintGrid() always read "no icon colour configured", and the tile
  // grid rendered pure accent/rainbow with zero trace of the configured global icon colour. Every
  // key below now goes through eff(), the SAME adopt-gated per-area -> global fallback
  // docker.js/vms.js/plugins.js already use (see eff() above): with adopt on it reads cc.<key>,
  // with adopt off it reads ccs.<key> — exactly matching the other three areas' contract.
  // ADOPT RAINBOW/ACCENT — ONE master toggle (v4.33.1, mirrors docker.js; redesigned from the
  // two independent toggles v4.33.0 shipped, see docker.js's iconAdoptTint() doc comment for the
  // full writeup of why). bgAdopting() gates bgColorEff() to "" so paintGrid()'s own iconSet
  // check (bgColorIsCustom()) falls through to its EXISTING rotating-colour branch (`c =
  // rbColor(i)`) — no new colour math for the badge, genuine per-tile rotation for free (this
  // area already paints its badge AND its ink per tile in the loop, so unlike docker.js/vms.js/
  // plugins.js's single page-wide ink filter, nothing extra was needed here for genuine per-item
  // rotation — see paintGrid()'s `btc` below). Badge and tint are mutually exclusive in THIS area
  // (one square icon can only show one treatment — see apply()), so there is no "Hintergrund on,
  // Einfärben off" badge+ink combination to reconcile the way docker.js/vms.js/plugins.js do:
  // whenever the badge shows, paintGrid()/apply() already ink every tile with its own automatic
  // black/white contrast unconditionally (ensureMonoFilter(idealText(...))), which is exactly the
  // reference behaviour the master toggle generalises to the other three areas. tintColorEff()
  // below still uses the master toggle too, for the OTHER mode (badge off, Einfärben on): there
  // is no badge to contrast against there, so it keeps resolving a rotating/accent HUE rather
  // than a black/white contrast, same as v4.33.0 — only the storage key is now shared.
  // v4.35.0 (item 5): adopt-rainbow is now a PURELY GLOBAL decision (see docker.js's
  // iconBgAdopts() for the full writeup) — bypasses eff()'s own/adopted-STYLE fallback on purpose.
  function bgAdopting() { return g("cc.iconbgrainbow", "0") === "1"; }
  function bgColorEff() {
    if (bgAdopting()) return "";
    var bg = eff("iconbgcolor", ""); if (/^#[0-9a-f]{6}$/i.test(bg)) return bg;
    var ic = eff("iconcolor", ""); if (/^#[0-9a-f]{6}$/i.test(ic)) return ic;
    return accent();
  }
  function badgeBg() { return bgColorEff(); }
  // whether the badge is showing a genuinely CONFIGURED colour (either key), as opposed to the
  // plain accent fallback — used by the rainbow-priority block below to decide whether an
  // explicit pick should outrank the rotating rainbow colour. Adopting counts as "no configured
  // colour" so the rotating branch always wins while it's on.
  function bgColorIsCustom() { return !bgAdopting() && (/^#[0-9a-f]{6}$/i.test(eff("iconbgcolor", "")) || /^#[0-9a-f]{6}$/i.test(eff("iconcolor", ""))); }
  // Einfärben's adopt-rainbow colour (pure-tint mode only, badge off — see bgAdopting()'s comment
  // above): the tile grid tints EVERY icon with one flat filter (never per-tile) and there is no
  // badge behind it to contrast against, so this keeps resolving a rotating/accent HUE rather
  // than an auto black/white contrast — the same live rotating-or-accent value docker.js/vms.js/
  // plugins.js use for THEIR tint's adopt-representative colour — here reusing this area's OWN
  // rbColor()/rbOn(). Reads the SAME single master key as bgAdopting() now (v4.33.1).
  function tintColorEff() {
    if (bgAdopting()) return rbOn() ? rbColor(5) : accent();
    return eff("iconcolor", "");
  }
  // Einfärben (tint) on/off (v4.32.5, mirrors cc.icontint): unset falls back to the pre-4.32.5
  // reading (a valid iconcolor implicitly meant "tint on"), so an untouched install's tint
  // toggle keeps behaving exactly as it did before this key existed.
  function tintOnEff() {
    var v = eff("icontint", null);
    return v == null ? /^#[0-9a-f]{6}$/i.test(eff("iconcolor", "")) : v === "1";
  }
  // BADGE mode: flatten a raster logo (img.PanelImg) to the badge's ink tone so it reads on
  // the accent/rainbow box — the SAME trick docker.js/plugins.js use. idealText() yields only
  // #161616 or #fff, so at most two filters ever coexist (rainbow tiles can need both); each
  // is built once (id-guarded), on a body host the #displaybox observer never sees.
  function ensureMonoFilter(ink) {
    var host = document.getElementById("cc-sg-mono-svg");
    if (!host) { host = document.createElement("div"); host.id = "cc-sg-mono-svg"; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var light = ink === "#fff", filtId = "cc-sg-mono-" + (light ? "l" : "d");
    if (!host.querySelector("#" + filtId)) {
      var c = (light ? 1 : parseInt("16", 16) / 255).toFixed(4); // #fff -> 1.0000, #161616 -> 0.0863
      var vals = "0 0 0 0 " + c + " 0 0 0 0 " + c + " 0 0 0 0 " + c + " 0 0 0 1 0";
      host.insertAdjacentHTML("beforeend", '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '"/></filter></svg>');
    }
    return "url(#" + filtId + ")";
  }
  // cc.badgeshape is SHARED across all areas; eff() returns it while the adopt toggle is on
  // cc.badgeshape is a GLOBAL key -> read it DIRECTLY, not via eff() (see header.js): an
  // adopt-aware read would fall back to an unset ccs.badgeshape and flip the shape per page.
  function shape() { return ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[g("cc.badgeshape", "pill")] || "999px"; }
  // cc.sgsize (GLOBAL key like cc.badgeshape): tile-badge size step [box, glyph].
  // s = 64/32 (old look), m = 78/38 DEFAULT (= Docker's logo-tile box: 62px content + 8px pad),
  // l = 96/46. favorites.js mirrors the SAME key so /Favorites always matches.
  function sgSize() { return ({ s: ["64px", "32px"], m: ["78px", "38px"], l: ["96px", "46px"] })[g("cc.sgsize", "m")] || ["78px", "38px"]; }
  var RB = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];
  if (window.CCTheme) { idealText = window.CCTheme.idealText; RB = window.CCTheme.RB; }  /* single source: shared palette/contrast when CCTheme is loaded (global+sync); local copies stay as the fallback */
  var RB_OFF = window.CCTheme ? window.CCTheme.rbSeed(RB.length) : Math.floor(Math.random() * RB.length); // shared persisted seed: aligns + stabilises the rainbow across areas (was random per load)
  // Rainbow is a GLOBAL mode: read cc.rainbow / cc.rbpal / cc.rainbowrot DIRECTLY (not the
  // adopt-gated eff()), like docker.js — one global Rainbow switch colours every enabled area.
  // The per-area accent (eff("accent")) stays adopt-gated for the non-rainbow single colour.
  // Active palette: flag mode reads cc.flagpal (its own key), never cc.rbpal — flag and rainbow
  // palettes stay independent (no bleed either way).
  function pal() { try { if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; } var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p; } catch (e) {} return RB; }
  function rbOn() { return g("cc.rainbow", "0") === "1"; }
  function rbColor(i) { if (!rbOn()) return accent(); var off = g("cc.rainbowrot", "1") === "0" ? 0 : RB_OFF; var p = pal(); return p[(i + off) % p.length]; } /* rainbowrot default ON (matches cc-theme.js + docker/plugins/vms); was "0" -> this area sat one rotation off from the rest */
  // rainbow "active only" sub-mode (cc.rbmode=active): tiles have no active item -> neutral idle + hover.
  function rbNeutral() { return g("cc.rbmode", "all") === "active"; }
  // Category-grid LANDING pages: /Settings AND /Tools both render the identical
  // <div class="Panel"><a><span><i .PanelIcon></span>…</a></div> tile grid inside
  // #displaybox, so the SAME badge restyle fits both (both are Type="xmenu"). A
  // sub-page is /Settings/<Name> or /Tools/<Name>; the exact-match list keeps us off
  // those. (Was onSettings(), /Settings only — /Tools now shares the Settings area.)
  function onGrid() { try { var p = location.pathname.replace(/\/+$/, ""); return p === "/Settings" || p === "/Tools"; } catch (e) { return false; } }
  // rainbow: paint each badge <span> a rotated palette colour + contrast glyph; accent
  // mode: clear our inline overrides so the sheet's --cc-accent shows through. Inline
  // style writes are attribute changes, so they never re-trigger the childList observer.
  function paintGrid() {
    try {
      var rb = rbOn(), neutral = rb && rbNeutral();
      document.documentElement.classList.toggle("cc-settingsgrid-rbneutral", rbNeutral()); // #2: "active only" works in Normal mode too (rbmode default "all" -> off by default)
      var sz = sgSize(); // cc.sgsize s|m|l -> box + glyph tokens the sheet sizes the badges with
      document.documentElement.style.setProperty("--cc-sg-size", sz[0]);
      document.documentElement.style.setProperty("--cc-sg-glyph", sz[1]);
      var spans = document.querySelectorAll("#displaybox .Panel > a > span");
      var accBg = badgeBg();               // "" while Hintergrund adopts rainbow/accent (see bgAdopting())
      var accBgInk = accBg || accent();    // always a valid hex for CONTRAST purposes, adopting or not
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i], gl = s.querySelector("i.PanelIcon"), im = s.querySelector("img");
        if (!rb) {
          s.style.removeProperty("background"); s.style.removeProperty("--cc-rb-c"); s.style.removeProperty("--cc-rb-ct");
          if (gl) gl.style.removeProperty("color");      // glyph colour comes from CSS --cc-iconbg-text
          if (im) im.style.setProperty("filter", ensureMonoFilter(idealText(accBgInk)), "important");
          continue;
        }
        var c = rbColor(i), tc = idealText(c);
        s.style.setProperty("--cc-rb-c", c); s.style.setProperty("--cc-rb-ct", tc); // per-tile colour for the neutral-mode :hover
        if (!neutral) {
          // #T6: a configured Logo-Hintergrund colour (ccs.iconcolor) must win over the rotating
          // rainbow colour here — the same fix v4.32.4 applied to Docker/VMs/Plugins via the CSS
          // var() order, missed on this area because paintGrid() paints the background with a
          // hard inline write instead of a var() chain. accBg (== badgeBg(), computed once above
          // the loop) already resolves to the configured icon colour when one is valid, else the
          // accent — so painting with it here instead of the raw rainbow colour c gives the icon
          // colour priority, and the tile only takes the rainbow rotation when NO icon colour is
          // configured at all.
          var iconSet = bgColorIsCustom();
          var bg = iconSet ? accBg : c, btc = iconSet ? idealText(accBg) : tc;
          s.style.setProperty("background", bg, "important");
          if (gl) gl.style.setProperty("color", btc, "important");
          if (im) im.style.setProperty("filter", ensureMonoFilter(btc), "important"); // raster logo -> badge ink tone
        } else {
          s.style.removeProperty("background");          // CSS neutral-idle grey shows; hover recolours via --cc-rb-c
          if (gl) gl.style.removeProperty("color");
          if (im) im.style.setProperty("filter", ensureMonoFilter("#fff"), "important"); // neutral badge is dark grey -> white-ink logo (idle + hover)
        }
      }
    } catch (e) {}
  }
  // === category-group HEADINGS -> accent badges (/Settings + /Tools) ===
  // Native heading DOM, read from source (include/DefaultPageLayout/MainContentTabless.php:12-18 +
  // include/PageBuilder.php tab_title()) — IDENTICAL on both landing pages:
  //   <div class="title"><span class="left inline-flex flex-row items-center gap-1"><i class="fa fa-cog title"></i>Label</span>
  //                      <span class="right inline-flex flex-row items-center gap-1"></span></div>
  // Settings.page/Tools.page carry no Title= themselves, and the template only emits div.title for a
  // page that HAS one, so every div.title on the landing pages is exactly one category heading.
  // The label is a BARE TEXT NODE inside span.left, so span.left IS the badge box: pure CSS, no DOM
  // surgery, idempotent by construction. JS only stamps the rainbow colour per heading, exactly like
  // paintGrid() does for the tiles. data-cc-sgh is a TEARDOWN INDEX, deliberately NOT a set-and-bail
  // guard — the paint MUST re-run when the palette/rotation/rbmode changes.
  // Selector note: the inner <i> ALSO carries class "title" (PageBuilder.php:99), so always qualify
  // div.title. The heading set (div.title > span.left) is disjoint from paintGrid's (.Panel > a > span),
  // so no tile index can shift.
  function paintHeads() {
    try {
      // HOUSE LAW: section heads ALWAYS keep their colour. The rainbow "active only" (neutral)
      // sub-mode greys the TILES only — the div.title > span.left heads stay painted in BOTH
      // rainbow sub-modes (consistent with the /Main heads). Legacy -headsneutral class is
      // therefore always removed here (clearHeads keeps removing it on teardown too).
      var rb = rbOn();
      document.documentElement.classList.remove("cc-settingsgrid-headsneutral");
      var heads = document.querySelectorAll("#displaybox div.title > span.left");
      for (var i = 0; i < heads.length; i++) {
        var h = heads[i];
        h.setAttribute("data-cc-sgh", "1");               // teardown index (attribute write -> no childList re-fire)
        if (!rb) {
          h.style.removeProperty("background"); h.style.removeProperty("color");
          h.style.removeProperty("--cc-rb-c"); h.style.removeProperty("--cc-rb-ct"); // accent mode: let the sheet's --cc-accent show through
          continue;
        }
        var c = rbColor(i), tc = idealText(c);
        h.style.setProperty("--cc-rb-c", c); h.style.setProperty("--cc-rb-ct", tc);
        h.style.setProperty("background", c, "important"); h.style.setProperty("color", tc, "important"); // painted in BOTH rainbow sub-modes
      }
    } catch (e) {}
  }
  // FULL teardown: drop the neutral class + every inline stamp, then the markers, so a live disable
  // (area off / theming off / navigating away) reverts to the native headings without a reload.
  function clearHeads() {
    try {
      document.documentElement.classList.remove("cc-settingsgrid-headsneutral");
      var heads = document.querySelectorAll("#displaybox [data-cc-sgh]");
      for (var i = 0; i < heads.length; i++) {
        var h = heads[i];
        h.style.removeProperty("background"); h.style.removeProperty("color");
        h.style.removeProperty("--cc-rb-c"); h.style.removeProperty("--cc-rb-ct");
        h.removeAttribute("data-cc-sgh");
      }
    } catch (e) {}
  }
  // COLOUR-TINT mode (mutually exclusive with the accent badge): when the badge is OFF
  // (iconbg="0") and Einfärben is on with a colour chosen (iconcolor), recolour each tile
  // icon to that colour instead. Font glyphs get an !important text colour; raster img.PanelImg
  // get the SAME shading-preserving feColorMatrix the Docker tab uses (own host+filter id
  // here). iconstrength blends the RASTER tint back over the original; it does not affect font
  // glyphs (a flat colour has no shading to keep). Read via eff() (adopt-gated per-area ->
  // global fallback), not raw g("ccs.*") — see the bgColorEff() comment above for why.
  function ensureTintFilter() {
    var ic = tintColorEff(), m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ic || "");
    var host = document.getElementById("cc-sg-tint-svg");
    if (!m) { if (host) host.remove(); return false; }
    var tr = parseInt(m[1], 16) / 255, tg = parseInt(m[2], 16) / 255, tb = parseInt(m[3], 16) / 255;
    var s = (Math.max(10, parseInt(eff("iconstrength", "100"), 10)) / 100).toFixed(3);
    if (!host) { host = document.createElement("div"); host.id = "cc-sg-tint-svg"; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var lum = function (c) { return (0.2126 * c).toFixed(4) + " " + (0.7152 * c).toFixed(4) + " " + (0.0722 * c).toFixed(4); };
    var mid = '<feColorMatrix in="SourceGraphic" type="matrix" result="flat" values="' + lum(tr) + ' 0 0 ' + lum(tg) + ' 0 0 ' + lum(tb) + ' 0 0 0 0 0 1 0"/>';
    if (parseFloat(s) < 0.999) mid += '<feComponentTransfer in="flat" result="faded"><feFuncA type="linear" slope="' + s + '"/></feComponentTransfer><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="faded"/></feMerge>';
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="cc-sg-icon-tint" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' + mid + '</filter></svg>';
    return true;
  }
  // paint the tint onto every tile icon: glyph colour + raster filter; also drop any stray
  // rainbow badge background the span may carry from a previous badge-mode render.
  function paintTint() {
    try {
      var ic = tintColorEff(), f = ensureTintFilter() ? "url(#cc-sg-icon-tint)" : "";
      var spans = document.querySelectorAll("#displaybox .Panel > a > span");
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i], gl = s.querySelector("i.PanelIcon"), im = s.querySelector("img");
        s.style.removeProperty("background");
        if (gl) gl.style.setProperty("color", ic, "important");
        if (im) im.style.filter = f;
      }
    } catch (e) {}
  }
  // undo the tint everywhere (inline glyph colour + raster filter + stray span background)
  // and drop the filter host, so badge mode / a disabled area starts from a clean slate.
  function clearTint() {
    try {
      var spans = document.querySelectorAll("#displaybox .Panel > a > span");
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i], gl = s.querySelector("i.PanelIcon"), im = s.querySelector("img");
        s.style.removeProperty("background");
        if (gl) gl.style.removeProperty("color");
        if (im) im.style.filter = "";
      }
      var host = document.getElementById("cc-sg-tint-svg"); if (host) host.remove();
      var mono = document.getElementById("cc-sg-mono-svg"); if (mono) mono.remove();
    } catch (e) {}
  }
  function apply() {
    try {
      var root = document.documentElement;
      // MASTER THEMING off behaves like the area being disabled (purely presentational).
      var live = g("cc.enable.settings", "1") !== "0" && g("cc.theming", "1") !== "0" && onGrid();
      var badge = live && eff("iconbg", "1") !== "0";
      // tint only when the badge is OFF, Einfärben is on (v4.32.5: its own icontint key,
      // independent of the badge — see tintOnEff()) and a valid tint colour is set. Badge and
      // tint stay mutually exclusive in THIS area by design (one square icon can only show one
      // treatment) — Einfärben's on/off no longer being tied to the badge is the only change.
      // NOT the same bug as docker.js/vms.js/plugins.js/settings.js's iconInk()-equivalents
      // (v4.32.6/4.32.7): those four let badge and tint be ON TOGETHER and used to let the badge
      // silently override the picked tint colour — that override cannot happen here because tint
      // never even RUNS while the badge is showing, so there is nothing analogous to fix.
      // eff()-gated (adopt -> falls through to the global cc.* keys), not raw g("ccs.*").
      // tintColorEff() (v4.33.0) already answers a valid hex while Einfärben adopts rainbow/accent
      // even with no cc.iconcolor picked, so adopting alone is enough to light this tile up.
      var tint = live && !badge && tintOnEff() && /^#[0-9a-f]{6}$/i.test(tintColorEff());
      var a = accent();
      root.classList.toggle("cc-settingsgrid-on", badge);
      root.classList.toggle("cc-settingsgrid-tint", tint);
      // The category-group HEADINGS badge whenever the area + theming are live on a grid page —
      // INDEPENDENT of the tile badge/tint modes, so they survive an icon-badge opt-out. Hence their
      // own class rather than reusing cc-settingsgrid-on (which is additionally gated on ccs.iconbg).
      root.classList.toggle("cc-settingsgrid-heads-on", live);
      if (live) {
        // HOISTED out of the badge branch below: the heading badges read these and must keep their
        // accent in TINT mode too (where badge == false). Still gated on onGrid(), so the SHARED
        // --cc-accent is still never written on a docker/plugins/vms page.
        root.style.setProperty("--cc-accent", a);
        root.style.setProperty("--cc-accent-text", idealText(a));
        root.style.setProperty("--cc-b-radius", shape());
        paintHeads();
      } else {
        clearHeads(); // area/theming off or not a grid page -> native headings back
      }
      if (badge) {
        clearTint(); // badge takes precedence — drop any tint from a previous render
        var sgBg = bgColorEff();   // "" while Hintergrund adopts rainbow/accent (v4.33.0)
        if (sgBg) { root.style.setProperty("--cc-iconbg-color", sgBg); root.style.setProperty("--cc-iconbg-text", idealText(sgBg)); }
        else { root.style.removeProperty("--cc-iconbg-color"); root.style.removeProperty("--cc-iconbg-text"); }
        paintGrid();
      } else if (tint) {
        paintTint();
      } else {
        clearTint(); // neither mode active — leave the native icons untouched
      }
    } catch (e) {}
  }
  // Observe the content container ONLY (never body). apply() makes no childList changes
  // (toggles a class on <html> + writes inline styles = attribute changes), so it can't
  // re-trigger this childList observer; debounced for AJAX content swaps.
  function watch() {
    try {
      var host = document.getElementById("displaybox") || document.getElementById("content");
      if (!host) return;
      mo = new MutationObserver(function () {
        if (moPending) return; moPending = true;
        setTimeout(function () { moPending = false; apply(); }, 150);
      });
      mo.observe(host, { childList: true, subtree: true });
    } catch (e) {}
  }
  function boot() {
    // No disabled early-return: apply() is enabled-aware (live gates on cc.enable.settings and
    // removes the classes when off). Registering watch() + the storage listener UNCONDITIONALLY
    // makes a re-enable written from the CC settings page take effect LIVE, not only after a reload.
    apply();
    watch();
    // same well-known-global convention every other area script carries (ccHeaderApply/ccSharesApply/
    // ccVmsApply/ccPluginsApply): the Settings page's own live toggle AND cc-theme.js's cross-browser
    // config adoption both call this by name when it exists. This area never exposed it before, so a
    // Rainbow correction landing from a different browser/device silently fixed localStorage but left
    // the tile grid painted stale until the next reload — the same gap fixed for VMs/Plugins.
    try { window.ccSettingsGridApply = apply; } catch (e) {}
    // the CC settings page writes cc.*/ccs.* keys from another origin/tab
    try { window.addEventListener("storage", function (e) { if (e && e.key && e.key !== "cc.stateCache" && /^cc[a-z]*\./.test(e.key)) apply(); }); } catch (e) {} // cc.stateCache EXCLUDED: docker.js rewrites it every 9s, which would repaint this area on a 9s loop in every other open tab
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
