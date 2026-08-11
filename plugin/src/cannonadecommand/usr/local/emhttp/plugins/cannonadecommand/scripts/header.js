// CannonadeCommand - GLOBAL main-menu-bar enhancer.
//
// Loaded on EVERY Unraid page via the Buttons .page hook
// (CannonadeCommand.Header.page). It deliberately does the MINIMUM in JS:
//   * toggle html.cc-header-on  -> the auto-injected sheet only takes effect when
//     the "Hauptmenueleiste" (main menu bar) area is enabled in CC settings, so a
//     disabled area = ZERO effect on any page.
//   * mirror the CC accent/text/badge-shape vars onto the document root so the
//     sheet can follow the user's configured theme.
// All actual styling lives in sheets/CannonadeCommand.Header.css, every rule of it
// scoped to html.cc-header-on. Default is OFF: the user opts in under
// Settings > CannonadeCommand > Bereiche > Hauptmenueleiste.
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
    return L > 150 ? "#161616" : "#fff";
  }
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  function T(d, e) { return LANG === "de" ? d : e; }   // same bilingual helper as settings.js
  function eff(k, d) { return g("cc.styleheader", "1") !== "0" ? g("cc." + k, d) : g("cch." + k, d); }
  function accent() { var a = eff("accent", "#2f6feb"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#2f6feb"; }
  // cc.badgeshape is a GLOBAL key (one Badge-Form control for every area), so read it
  // DIRECTLY, not via eff(): eff() would fall back to an UNSET cch.badgeshape when the
  // header's adopt toggle is off, so --cc-b-radius (and thus the menu-bar badge shape)
  // would flip between pages depending on which script set it last.
  function shape() { return ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[g("cc.badgeshape", "pill")] || "999px"; }
  var RB = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];
  if (window.CCTheme) { idealText = window.CCTheme.idealText; RB = window.CCTheme.RB; }  /* single source: shared palette/contrast when CCTheme is loaded (global+sync); local copies stay as the fallback */
  var RB_OFF = window.CCTheme ? window.CCTheme.rbSeed(RB.length) : Math.floor(Math.random() * RB.length); // shared persisted seed: aligns + stabilises the rainbow across areas (was random per load)
  // Rainbow is a GLOBAL mode: read cc.rainbow / cc.rbpal / cc.rainbowrot DIRECTLY (not the
  // adopt-gated eff()), exactly like docker.js — so ONE global Rainbow switch colours EVERY
  // enabled area (the menu bar too), regardless of this bar's adopt state. The per-area accent
  // (eff("accent")) stays adopt-gated for the non-rainbow single-colour look.
  // Active palette: flag mode reads its OWN key (cc.flagpal), never cc.rbpal — so the flag never
  // repaints the rainbow swatches and rainbow colours never leak out when the flag is off.
  function pal() { try { if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; } var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p; } catch (e) {} return RB; }
  function rbOn() { return g("cc.rainbow", "0") === "1"; }
  function rbColor(i) { if (!rbOn()) return accent(); var off = g("cc.rainbowrot", "1") === "0" ? 0 : RB_OFF; var p = pal(); return p[(i + off) % p.length]; } /* rainbowrot default ON (matches cc-theme.js + docker/plugins/vms); was "0" -> the menu bar sat one rotation off from the row badges */
  function lumOf(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 255; var n = parseInt(m[1], 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); }
  // #15: a popup TITLE badge sits on the dark (#161616) modal. A near-black palette slot — e.g. the
  // German flag's black stripe — paints an INVISIBLE badge ("oberster Badge zu klein / nicht ordentlich").
  // For the title we swap any too-dark slot for the BRIGHTEST palette slot (stays on-theme, e.g. the
  // flag's gold), falling back to the accent if the whole palette is dark — so every window's title
  // badge is readable and uniform across the UI.
  function popBadge(i) {
    var c = rbColor(i); if (lumOf(c) >= 64) return c;
    var p = pal(), best = null, bl = -1;
    for (var k = 0; k < p.length; k++) { var L = lumOf(p[k]); if (L > bl) { bl = L; best = p[k]; } }
    return (best && bl >= 64) ? best : accent();
  }
  // rainbow: colour the active tab, each utility icon box and the usage fill with a
  // rotated palette colour (in accent mode the CSS handles it via --cc-accent, so we
  // just clear our overrides). childList observer only, so these style writes can't loop.
  // rainbow sub-mode "active only" (cc.rbmode=active, global like cc.rainbow): idle badges go
  // neutral, only the active one keeps its colour, and CSS colours any badge on hover using the
  // per-item --cc-rb-c/--cc-rb-ct vars this function still stamps on every item.
  function rbNeutral() { return g("cc.rbmode", "all") === "active"; }
  function paintNav() {
    try {
      // gate on the enabled class: if the menu-bar area is OFF, rb=false -> every branch below
      // removeProperty's, so a disabled area (even with Rainbow ON) never paints and any lingering
      // inline colours are cleared. paintNav runs from apply() + the always-on search observer.
      var rb = rbOn() && document.documentElement.classList.contains("cc-header-on"), neutral = rb && rbNeutral(), n = 0;
      document.documentElement.classList.toggle("cc-header-rbneutral", rbNeutral() && document.documentElement.classList.contains("cc-header-on"));   // #2: reactive class also in Normal mode (rbmode default "all" -> off by default, so this can't change the default look); the paint `neutral` above stays rainbow-keyed
      // each item ALWAYS carries its rotated colour as --cc-rb-c/--cc-rb-ct (for the CSS :hover);
      // the DIRECT background is painted only when NOT neutral, or on the ACTIVE left tab.
      function stamp(elm, c, t) { elm.style.setProperty("--cc-rb-c", c); elm.style.setProperty("--cc-rb-ct", t); }
      function clear(elm) { elm.style.removeProperty("background"); elm.style.removeProperty("color"); elm.style.removeProperty("--cc-rb-c"); elm.style.removeProperty("--cc-rb-ct"); }
      Array.prototype.slice.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a")).forEach(function (aEl) {   // tabs match in EITHER tile — the merged drag zone can park one on the right
        if (!rb) { clear(aEl); n++; return; }
        var c = rbColor(n), t = idealText(c), item = aEl.closest(".nav-item"), active = !!(item && item.classList.contains("active"));
        stamp(aEl, c, t);
        if (!neutral || active) { aEl.style.setProperty("background", c, "important"); aEl.style.setProperty("color", t, "important"); }
        else { aEl.style.removeProperty("background"); aEl.style.removeProperty("color"); }
        n++;
      });
      Array.prototype.slice.call(document.querySelectorAll("#menu .nav-tile .nav-item.util > a")).forEach(function (aEl) {   // icons match in EITHER tile
        var gl = aEl.querySelector("b.system, img.system");
        if (!rb) { clear(aEl); if (gl) gl.style.removeProperty("color"); n++; return; }
        var c = rbColor(n), t = idealText(c);
        stamp(aEl, c, t);
        if (!neutral) { aEl.style.setProperty("background", c, "important"); if (gl) gl.style.setProperty("color", t, "important"); }
        else { aEl.style.removeProperty("background"); if (gl) gl.style.removeProperty("color"); }
        n++;
      });
      var u = document.querySelector("#menu .usage-bar > span");
      if (u) {
        if (!rb) { clear(u); }
        else { var cu = rbColor(n), tu = idealText(cu); stamp(u, cu, tu); if (!neutral) { u.style.setProperty("background", cu, "important"); u.style.setProperty("color", tu, "important"); } else { u.style.removeProperty("background"); u.style.removeProperty("color"); } }
      }
      // #12 (user: "nicht im regenbogenmodus, bitte in alle Farbmodi aufnehmen"): the footer scroll arrows
      // never got their own --cc-rb-c/--cc-rb-ct, so in Rainbow they fell through the var() chain straight
      // to --cc-rbaccent (one SHARED jewel), never their own rotating position like the menu icons above.
      // CSS already owns background/rest-vs-hover for these (Tokens.css "#12 FOOTER ARROWS"); this call only
      // supplies the colour the CSS reads. Deliberately NOT gated on cc-header-on like the loops above —
      // the arrows are shown whenever html.cc-popups-on is on (CSS gate), independent of whether the user
      // has the Hauptmenüleiste area itself enabled, so their rainbow stamp must not depend on it either.
      // A fresh index (100) rather than continuing `n`, so disabling the header area doesn't shift them.
      Array.prototype.slice.call(document.querySelectorAll("a.back_to_top, a.move_to_end")).forEach(function (aEl, ai) {
        if (!rbOn()) { aEl.style.removeProperty("--cc-rb-c"); aEl.style.removeProperty("--cc-rb-ct"); return; }
        var ca = rbColor(100 + ai), ta = idealText(ca); stamp(aEl, ca, ta);
      });
    } catch (e) {}
  }
  // ── MAIN-TAB ICONS (user: "das icon feature für die Haupttabs gefällt mir", pointing at
  // github.com/benjaminmue/unraid-themer's icon-set swapper) — that plugin repaints EXISTING native
  // icon-font glyphs; CC's own page tabs never carried an icon at all (native <a href="/Docker"> is a
  // bare text node, confirmed live), so this is additive, not a swap. One curated set (Tabler, MIT
  // licensed, github.com/tabler/tabler-icons) rather than the 9-set picker unraid-themer offers — the
  // reasoning (user, live): "reicht nicht ein Set wie Tabler? Das enthält doch tausenden icons" — for
  // ~11 fixed tab slots a single well-stocked set has zero coverage gaps, so the 9-set machinery (per-
  // set licensing review, 22-51% cross-set fallback rate) buys nothing here. Inline SVG + currentColor,
  // matching the bell/burger proxy ghost's own icon-cloning approach elsewhere in this file — the tab's
  // EXISTING --cc-rb-c-driven text colour (paintNav() above) already becomes the icon colour for free,
  // no separate colour wiring. Path data verbatim from tabler-icons (MIT) icons/outline/<name>.svg.
  var CC_TAB_ICONS = {
    "/Dashboard": '<path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" /><path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" /><path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" /><path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" />',   // layout-dashboard
    "/Main": '<path d="M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2" /><path d="M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2" /><path d="M7 8l0 .01" /><path d="M7 16l0 .01" /><path d="M11 8h6" /><path d="M11 16h6" />',   // server-2
    "/Favorites": '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" />',   // star
    "/Shares": '<path d="M13 19h-8a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v4" /><path d="M16 22l5 -5" /><path d="M21 21.5v-4.5h-4.5" />',   // folder-share
    "/Settings": '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />',   // settings
    "/Docker": '<path d="M22 12.54c-1.804 -.345 -2.701 -1.08 -3.523 -2.94c-.487 .696 -1.102 1.568 -.92 2.4c.028 .238 -.32 1 -.557 1h-14c0 5.208 3.164 7 6.196 7c4.124 .022 7.828 -1.376 9.854 -5c1.146 -.101 2.296 -1.505 2.95 -2.46" /><path d="M5 10h3v3h-3l0 -3" /><path d="M8 10h3v3h-3l0 -3" /><path d="M11 10h3v3h-3l0 -3" /><path d="M8 7h3v3h-3l0 -3" /><path d="M11 7h3v3h-3l0 -3" /><path d="M11 4h3v3h-3l0 -3" /><path d="M4.571 18c1.5 0 2.047 -.074 2.958 -.78" /><path d="M10 16l0 .01" />',   // brand-docker
    "/Plugins": '<path d="M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1a2 2 0 0 0 0 -4h-1a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1" />',   // puzzle
    "/VMs": '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10" /><path d="M7 20h10" /><path d="M9 16v4" /><path d="M15 16v4" />',   // device-desktop
    "/Tools": '<path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" />',   // tool
    "/Stats": '<path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" /><path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" /><path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" /><path d="M4 20h14" />',   // chart-bar
    "/Apps": '<path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 7l6 0" /><path d="M17 4l0 6" />'   // apps
  };
  function ccTabIcons() {
    try {
      // #18 (user: "wo sind die einstellungen dafür?"): additive markup needs a real off-switch, not just
      // a gate on future paints — CC_TAB_ICONS is the only place that puts these <svg>s in the DOM, so
      // this is also the only place that can take them back out again when the setting flips off.
      var on = g("cc.tabicons", "1") !== "0";
      // #18 (user, extension: "auch toggle um den text auszublenden" — icon-only mode). The label has no
      // element of its own (CA/Unraid renders it as a bare text node next to the icon), so wrap it in a
      // span ONCE per tab; hiding is then a plain CSS class toggle, independent of the icon switch above —
      // wrapping always runs regardless of `on` so text-only mode still works with icons off.
      var textOff = g("cc.tabtext", "1") === "0";
      var items = document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]");
      for (var i = 0; i < items.length; i++) {
        var a = items[i];
        var existing = a.querySelector(":scope > svg.cc-tab-ico");
        if (!on) { if (existing) existing.remove(); } else if (!existing) {
          var href = "/" + (a.getAttribute("href") || "").replace(/^\/+|\/+$/g, "").split("/")[0];
          var d = CC_TAB_ICONS[href];
          if (d) {
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "cc-tab-ico");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
            svg.setAttribute("stroke-width", "2"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
            svg.innerHTML = d;
            a.insertBefore(svg, a.firstChild);
          }
        }
        if (!a.querySelector(":scope > span.cc-tab-label")) {
          for (var n = a.childNodes.length - 1; n >= 0; n--) {
            var node = a.childNodes[n];
            if (node.nodeType === 3 && node.textContent.trim()) {
              var lbl = document.createElement("span");
              lbl.className = "cc-tab-label";
              a.replaceChild(lbl, node);
              lbl.appendChild(node);
              break;
            }
          }
        }
      }
      document.documentElement.classList.toggle("cc-tabtext-off", textOff);
    } catch (e) {}
  }
  try { window.ccTabIcons = ccTabIcons; } catch (eTI) {}   // same-page live toggle hook for the CC Settings page (the nav bar is on every page, Settings included)
  // popup title badges follow the COLOUR MODES (user): accent by default (CSS vars), palette in
  // rainbow — painted here because dialogs appear as direct BODY children at any time.
  function paintPopups() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var ts = document.querySelectorAll(".ui-dialog .ui-dialog-title, .sweet-alert h2");
      for (var i = 0; i < ts.length; i++) {
        // #7-II (user NEW SPEC): the title badge must carry NO status indication — it stays its normal accent/
        // colour-mode colour the whole time. (The running/done state now lives in the bottom-left indicator.)
        if (!rbOn()) { ts[i].style.removeProperty("background"); ts[i].style.removeProperty("color"); continue; }   // CSS accent vars rule
        var c = popBadge(i), t = idealText(c);
        ts[i].style.setProperty("background", c, "important"); ts[i].style.setProperty("color", t, "important");
      }
    } catch (e) {}
  }
  // #11 rework: the streaming plugin-install / container-update dialog (.sweet-alert.nchan) gets a
  // clean modern loader. Detect the IN-PROGRESS state from the title, drop a rotating ring beside the
  // title badge, grey the badge while it runs, and hide the empty grey <fieldset> bars Unraid leaves.
  // A per-dialog subtree observer re-styles on every streamed line + the IN PROGRESS -> FINISHED flip.
  // FREEZE FIX: those per-dialog subtree+characterData observers (and the body ccPopObs) used to run
  // ccNchanStyle()+paintPopups() SYNCHRONOUSLY on every mutation. During a container update/install the
  // nchan <pre> log streams hundreds of lines/sec -> hundreds of full re-styles/sec saturated the main
  // thread and froze the whole UI until a page reload (user: "wenn man das zweite schließt reagiert die
  // ganze ui nicht mehr"). Coalesce every observer wake into ONE restyle per animation frame: at most one
  // run per debounce window can never outrun a streaming flood, so the page can no longer lock. A short
  // setTimeout debounce (NOT requestAnimationFrame — rAF is paused/throttled on a non-painting or
  // background tab, which would starve the restyle and leave the dialog unstyled) coalesces a burst of
  // streamed lines into ONE restyle per ~60ms (≤~16/s), matching the debounce docker.js already uses.
  var _ccPopT = 0, _ccPopFull = false;
  function ccPopRestyleSoon(full) {
    if (full) _ccPopFull = true;
    if (_ccPopT) return;
    _ccPopT = setTimeout(function () {
      _ccPopT = 0;
      var doFull = _ccPopFull; _ccPopFull = false;
      try { ccNchanStyle(); } catch (e) {}
      try { paintPopups(); } catch (e) {}
      if (doFull) { try { ccPopIframes(); } catch (e) {} try { ccPopoverDim(); } catch (e) {} try { ccNotifActions(); } catch (e) {} try { ccPaintRotate(); } catch (e) {} }
    }, 60);
  }
  function ccNchanStyle() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      // #12 (user, furious "schon so oft gesagt!!!"): the container-UPDATE window is a .sweet-alert that in this
      // Unraid build does NOT carry the `nchan` class, so EVERY nchan-scoped fix (title strip, bottom-left loader,
      // dark step cards, empty-grey-bar hide) missed it and only the broad paintPopups colour reached it. Also
      // match any .sweet-alert that has a <pre> log and STAMP the nchan class on it, so all the existing
      // .sweet-alert.nchan CSS + JS below apply to it at once.
      // #12 ROOT FIX (user "mach es endlich!!!"): the global ccPopObs watches only document.body CHILDLIST (no
      // subtree), so it fires when a sweet-alert first appears (the "Are you sure?" confirm — which has NO <pre>)
      // but NEVER again while that SAME alert streams IN PLACE (pre appears, title becomes "-IN PROGRESS" then
      // "-FINISHED"). That is why the real update window kept the status text + spinner in the badge (my earlier
      // synthetic test inserted an already-finished alert as a fresh body child, so it "passed"). Attach a subtree
      // observer to EVERY sweet-alert (matched or not) so any later in-place streaming re-runs this and strips it.
      var allSa = document.querySelectorAll(".sweet-alert");
      for (var z = 0; z < allSa.length; z++) {
        if (!allSa[z].__ccNchanObs) {
          allSa[z].__ccNchanObs = new MutationObserver(function () { ccPopRestyleSoon(false); });
          try { allSa[z].__ccNchanObs.observe(allSa[z], { childList: true, subtree: true, characterData: true }); } catch (e) {}
        }
      }
      var sas = document.querySelectorAll(".sweet-alert.nchan, .sweet-alert:has(pre)");
      for (var i = 0; i < sas.length; i++) {
        var sa = sas[i], h2 = sa.querySelector("h2"); if (!h2) continue;
        sa.classList.add("nchan");
        // #15 (user, LIVE-verified: this window is .sweet-alert.nchan): the update stream carries a Fonts/log
        // <style> block whose content ALSO lands in a bare <p>/text node and renders as raw CSS text under the
        // title. The CSS hides the <style> element; here we blank the text-rendered variant (leaf elements + text
        // nodes carrying a CSS signature). Idempotent (once blanked it no longer matches).
        try {
          var CSS_SIG = /font-family\s*:|@font-face|\.logLine\s*\{/i;
          var leafs = sa.querySelectorAll("p, div, font, pre, span");
          for (var cq = 0; cq < leafs.length; cq++) { var le = leafs[cq]; if (!le.children.length && !(le.id && le.id.indexOf("cc-") === 0) && !le.className && CSS_SIG.test(le.textContent || "") && (le.textContent || "").indexOf("{") !== -1) le.style.display = "none"; }
          var tw = document.createTreeWalker(sa, NodeFilter.SHOW_TEXT, null);
          var tn; while ((tn = tw.nextNode())) { if (CSS_SIG.test(tn.nodeValue || "") && (tn.nodeValue || "").indexOf("{") !== -1) tn.nodeValue = ""; }
        } catch (eCss) {}
        // #7-II (user NEW SPEC): the TITLE badge must carry NO status text and NO loader — just the clean name.
        // The status lives BOTTOM-LEFT beside the buttons: a 3-dot loader (no text) while running, which turns
        // into a circle-with-check (no text) when finished. Because the title cycles (step names AND
        // "-IN PROGRESS"/"-FINISHED"), the state is LATCHED on the element (dataset) so stripping the suffix
        // doesn't lose it: once seen "in progress" -> run; once "finished" -> done; step names don't reset it.
        var raw = (h2.textContent || "");
        // ── bottom-left run/done STATUS BADGE ──
        // Only ACTUAL install/update STREAMS get the indicator — NOT the System Information or ShipLog changelog
        // windows (they ALSO carry a <pre>, but are static). A stream is marked by a progress-verb title OR by
        // the step <fieldset>s Unraid emits. (user, "unzählige Male drauf hingewiesen": the green check showed
        // CONSTANTLY because the old code LATCHED dataset.ccState="done" and NEVER reset it on the REUSED
        // SweetAlert node — so every later window inherited "done"; and the static System-Info <pre> falsely
        // qualified as a running stream.)
        // A real STREAM = a progress-verb title OR Unraid's exec step cards (fieldset.CMD/.docker from
        // Helpers.php addLog). The old `fieldset` match was too broad: the System Information window ALSO wraps
        // its `table.info` in a plain <fieldset>, so it falsely qualified and showed the loader (user: "im
        // Systeminfofenster ist die Ladeanimation immer noch"). Scope to the exec fieldsets AND hard-exclude any
        // window carrying a `table.info` (System Info) — that never runs a process.
        var isStream = (/in\s*progress|wird\s+(aktualisiert|installiert|erstellt|neu\s*erstellt|gezogen|gestartet)|updating|installing|pulling|creating/i.test(raw) || !!sa.querySelector("fieldset.CMD, fieldset.docker") || !!sa.querySelector("#swaltext")) && !sa.querySelector("table.info");
        if (isStream) {
          // Recompute STATELESSLY each pass so a fresh window ALWAYS starts as RUN (loader) and never inherits a
          // stale "done". Flip to DONE only when the log reports completion AND the stream has SETTLED (no new
          // output for ~700ms) — so the check never appears mid-run (e.g. right after "erfolgreich ausgeführt"
          // while an orphaned image is still being removed). No mutations fire once the stream stops, so arm a
          // one-shot re-check to let the check appear after the tail settles.
          // #14 (user, de_DE box): completion is Unraid's OWN signal, not a log-phrase guess. openPlugin/
          // openDocker/openVMAction render `<span id="pluginProgressTitle">In Progress <i class="fa fa-refresh
          // fa-spin"></i></span>` while running; on the nchan _DONE_/_ERROR_ message openDone()/openError()
          // REPLACE that span with plain "Finished"/"Fertig" | "Error"/"Fehler" (spinner GONE) and enable the
          // confirm button. That flip is instant + locale-independent — a plugin install log never contains
          // "finished/erfolgreich", which is why the old finishTxt regex left the ring spinning forever.
          var progT = h2.querySelector("#pluginProgressTitle");
          var spinning = progT ? !!progT.querySelector(".fa-spin, .fa-refresh, i.fa") : false;
          var cb0 = sa.querySelector("button.confirm");
          var btnDone = !!(cb0 && !cb0.disabled && cb0.offsetParent !== null && !/close|schlie|abbrech|cancel/i.test(cb0.textContent || ""));
          var done;
          if (progT) { done = !spinning; }               // native span present: spinner removed == finished/error
          else if (btnDone) { done = true; }             // no span, but the Done/Fertig button went live
          else {                                         // last resort: the old settled log-phrase heuristic
            var finishTxt = /(erfolgreich (ausgeführt|beendet)|successfully|command (finished|completed|executed)|finished)/i.test(sa.textContent || "");
            var len = (sa.textContent || "").length;
            if (sa.__ccLen !== len) { sa.__ccLen = len; sa.__ccGrow = Date.now(); }
            done = finishTxt && (Date.now() - (sa.__ccGrow || 0)) > 700;
            if (!done && finishTxt) { clearTimeout(sa.__ccSettleT); sa.__ccSettleT = setTimeout(function () { try { ccNchanStyle(); paintPopups(); } catch (e) {} }, 750); }
          }
          if (done) sa.__ccDone = true;                  // latch: never revert to run once finished
          sa.dataset.ccState = (done || sa.__ccDone) ? "done" : "run";
          sa.classList.toggle("cc-nchan-err", (done || sa.__ccDone) && /error|fehler/i.test((progT ? progT.textContent : (cb0 && cb0.textContent)) || ""));
        } else { sa.dataset.ccState = ""; sa.__ccDone = false; }
        var state = sa.dataset.ccState || "";
        sa.classList.toggle("cc-nchan-loading", state === "run");
        sa.classList.toggle("cc-nchan-done", state === "done");
        // #23 (user: "update oder installationsfenster scrollen nicht automatisch nach unten"): the
        // streamed log keeps growing but nothing follows it to the new bottom line — whichever element
        // in this dialog actually scrolls (varies: #swaltext, a fieldset, the dialog box itself, or the
        // page behind it, depending on Unraid build/dialog type) gets pinned to its own bottom on every
        // restyle pass, i.e. at most once per ~60ms debounce window, not per streamed line.
        // #31 (user: "immer wenn ich den changelog eines containers öffne springt die Seite ans Ende"):
        // this used to run for EVERY .sweet-alert:has(pre) match unconditionally, `isStream` above already
        // exists specifically to tell a real update/install stream apart from a static <pre> dialog (System
        // Information, a plugin/ShipLog changelog viewer) — but this block ran BEFORE that check and ignored
        // it. ShipLog's own changelog bubble isn't even a sweet-alert (watchPopups' body-childList observer
        // just restyles on ANY body mutation, sweet-alert or not), so opening it re-ran this loop over the
        // WHOLE document and blind-scrolled the page for any matching static dialog left over from earlier
        // in the session (System Info, a changelog view) — nothing to do with what was actually opened.
        // state === "run" only: follow while genuinely streaming, stop once finished, never for static text.
        if (state === "run") {
          var scrollers = sa.querySelectorAll("*");
          for (var sc = 0; sc < scrollers.length; sc++) { var sn = scrollers[sc]; if (sn.scrollHeight - sn.clientHeight > 2) sn.scrollTop = sn.scrollHeight; }
          if (sa.scrollHeight - sa.clientHeight > 2) sa.scrollTop = sa.scrollHeight;
          if (document.documentElement.scrollHeight - document.documentElement.clientHeight > 2) window.scrollTo(0, document.documentElement.scrollHeight);
        }
        // #14: strip the status suffix from the title — but do NOT rewrite h2.textContent: that DESTROYS
        // #pluginProgressTitle, the only reliable completion signal (later passes could then never see "done").
        // Hide the native progress span in place + trim the trailing separator; keep text-clean only as the
        // fallback for alerts that have no progress span.
        var progH = h2.querySelector("#pluginProgressTitle");
        if (progH) {
          progH.style.display = "none";
          var pv = progH.previousSibling;
          if (pv && pv.nodeType === 3 && /[-–—]\s*$/.test(pv.nodeValue || "")) pv.nodeValue = pv.nodeValue.replace(/\s*[-–—]\s*$/, "");
        } else {
          var clean = raw.replace(/\s*[-–—]\s*(IN\s*PROGRESS|FINISHED)\b[\s\S]*$/i, "").replace(/\s+$/, "");
          if (clean && clean !== raw && h2.textContent !== clean) h2.textContent = clean;
        }
        var oldspin = h2.querySelector(".cc-nchan-spin"); if (oldspin) oldspin.remove();   // kill any legacy in-badge spinner
        // bottom-left STATUS BADGE (no text): a spinning ring while RUNNING, a green circle-check when DONE
        var loader = sa.querySelector(".cc-nchan-loader");
        if (state === "run" || state === "done") {
          if (!loader) {
            loader = document.createElement("span"); loader.className = "cc-nchan-loader"; loader.setAttribute("role", "status");
          }
          // D11: anchor to the BUTTON ROW and RE-HOME every pass. The docker-CREATE window streams with NO
          // buttons (the loader would fall back to `sa` and land top-centre), then renders VIEW LOG / FERTIG
          // only when done -> re-parent as soon as the real row appears. Match ANY button (the docker buttons
          // carry no .confirm/.cancel class); with no row yet land on `sa` (CSS then pins that case bottom-left).
          var _btns = sa.querySelectorAll("button");
          var _row = sa.querySelector(".sa-button-container") || (_btns.length ? _btns[_btns.length - 1].parentElement : sa);
          if (loader.parentElement !== _row) _row.appendChild(loader);
          if (state === "done") {
            if (loader.getAttribute("data-cc-mode") !== "done") { loader.setAttribute("data-cc-mode", "done"); loader.classList.add("cc-nchan-check"); loader.setAttribute("aria-label", T("Fertig", "Done")); loader.innerHTML = "<svg viewBox='0 0 24 24' aria-hidden='true'><circle class='cc-ck-c' cx='12' cy='12' r='10.5'/><path class='cc-ck-p' d='M6.5 12.5l3.6 3.6L17.5 8.8'/></svg>"; }
          } else if (loader.getAttribute("data-cc-mode") !== "run") {
            loader.setAttribute("data-cc-mode", "run"); loader.classList.remove("cc-nchan-check"); loader.setAttribute("aria-label", T("Läuft…", "Working…")); loader.innerHTML = "<span class='cc-loader cc-load-sm'><span class='o'><i></i></span><span class='in'><i></i></span></span>";  // RUN = CC double counter-rotating ring, sm tier (status-badge ring)
          }
        } else if (loader) { loader.remove(); }
        // #7-III (user: "nutzloser hellgrauer Balken ueber den Buttons"): the step cards are #191919 now, so an
        // EMPTY fieldset (or one with only a <legend> and no body text) renders as a stray grey bar. Hide any
        // fieldset whose BODY (text minus the legend) is blank, not just the fully-empty ones.
        var fs = sa.querySelectorAll("fieldset");
        for (var j = 0; j < fs.length; j++) {
          var body = (fs[j].textContent || ""), leg = fs[j].querySelector("legend");
          if (leg) body = body.replace(leg.textContent || "", "");
          fs[j].style.display = body.replace(/\s+/g, "") ? "" : "none";
        }
        if (!sa.__ccNchanObs) { sa.__ccNchanObs = new MutationObserver(function () { ccPopRestyleSoon(false); }); sa.__ccNchanObs.observe(sa, { childList: true, subtree: true, characterData: true }); }
      }
    } catch (e) {}
  }
  // dialog CONTENT often lives in a SAME-ORIGIN iframe the parent CSS cannot style — inject a
  // small CC style into the inner document (user: "der button in den popupfenstern soll
  // groesser sein und linksbuendig"): big accent buttons, left-aligned button rows.
  function ccPopIframes() {
    try {
      var acc = (getComputedStyle(document.documentElement).getPropertyValue("--cc-hdr-accent") || "").trim() || "#2f6feb";
      var ifr = document.querySelectorAll(".ui-dialog iframe");
      for (var i = 0; i < ifr.length; i++) {
        (function (f) {
          function inject() {
            try {
              var d = f.contentDocument;
              if (!d || !d.head || d.getElementById("cc-pop-inner")) return;
              var st = d.createElement("style"); st.id = "cc-pop-inner";
              // 36px/14px literals: keep in sync with --cc-lgb-* in Header.css (iframes cannot read the parent's CSS vars)
              // focus law duplicated here too: the inner document cannot read the parent's focus-kill rules
              // #16/#17 (user: Systeminfo/Feedback-Fenster haben helle Kopf-/Fussleiste + Feedback ist nicht im
              // CC-Style): darken the iframe's OWN surface (html/body + structural elements) onto #161616 so no
              // lighter native band shows, and theme the form controls (radios keep native, text/textarea/select
              // get the CC dark fill). Literals only — the iframe cannot read the parent's CSS vars.
              st.textContent = "html,body{background:#0f0f0f !important;color:#d6d6d6 !important} fieldset,table,tbody,thead,tr,td,th,.tabs,dl,dt,dd,form,center,p,section,article,div{background:transparent !important;border:none !important} legend{color:#9a9a9a !important} label,td,th{color:#d6d6d6 !important} input[type=text],input[type=password],input[type=email],input[type=search],input[type=number],input[type=url],textarea,select{background:#232323 !important;color:#eaeaea !important;border:none !important;border-radius:6px !important;outline:none !important;box-shadow:none !important} textarea{width:100% !important;box-sizing:border-box !important} a{color:" + acc + " !important} " +
                "input[type=button],input[type=submit],button{height:36px !important;padding:0 24px !important;font-size:14px !important;border:0 !important;border-radius:6px !important;box-shadow:none !important;background:" + acc + " !important;color:" + idealText(acc) + " !important;font-weight:600 !important;text-transform:uppercase !important;letter-spacing:.6px !important;cursor:pointer} center,.buttons{text-align:center !important} a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:none !important;box-shadow:none !important;filter:brightness(1.18)} " +
                // #7-IV (user: the "CONTAINER AKTUALISIEREN" template-update window must look like #7): its body is
                // CreateDocker.php/log.htm INSIDE this iframe, with its OWN inline styles (orange gradient buttons,
                // blue span.system box, bordered fieldset.docker cards). These selectors only exist in that window,
                // so mirroring #7's look here is safe: fieldset.docker -> borderless CC card, legend -> accent pill,
                // span.system -> neutral. (The buttons already pick up the accent rule above.)
                "fieldset.docker{background:#191919 !important;border:none !important;border-radius:10px !important;margin:0 0 12px !important;padding:10px 12px !important;box-shadow:0 1px 4px rgba(0,0,0,.35) !important} fieldset.docker>legend{display:inline-block !important;background:" + acc + " !important;color:" + idealText(acc) + " !important;border:none !important;border-radius:999px !important;padding:3px 12px !important;font-size:12px !important;font-weight:600 !important;text-transform:uppercase !important;letter-spacing:.6px !important} span.system{background:transparent !important;color:#d6d6d6 !important;box-shadow:none !important} span.label{background:rgba(255,255,255,.08) !important;color:#e6e6e6 !important;border-radius:999px !important;padding:3px 10px !important}";
              d.head.appendChild(st);
            } catch (e2) {}
          }
          inject();
          try { f.addEventListener("load", inject); } catch (e3) {}
        })(ifr[i]);
      }
    } catch (e) {}
  }
  // Connect popover (bell/burger menu) has no backdrop -> it floats over the page unclearly
  // (user #13). Inject a dim+blur overlay BEHIND it while it's open; clicking it closes the menu
  // (Escape, which reka honours). Runs from the same body-childList observer as the dialogs.
  function ccPopoverDim() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) { var d0 = document.getElementById("cc-pop-dim"); if (d0) d0.style.display = "none"; return; }
      // the burger MENU teleports to body as .bg-popover; the bell NOTIFICATION centre is a Sheet
      // rendered INSIDE the Connect root (.unapi div.fixed.z-50.bg-background) which the body observer
      // misses. Cover BOTH open states so both get the one #cc-pop-dim backdrop (#21).
      var pop = document.querySelector(".bg-popover") || document.querySelector(".unapi div.fixed.z-50.bg-background");
      var dim = document.getElementById("cc-pop-dim");
      if (!pop) { if (dim) dim.style.display = "none"; return; }
      if (!dim) {
        dim = document.createElement("div"); dim.id = "cc-pop-dim";
        dim.addEventListener("pointerdown", function () { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        document.body.appendChild(dim);
      }
      // #9 Sit ABOVE #header (z102)/#menu (z101) so the blur covers the header band too, but BELOW the
      // popup's OWN root-level stacking context so the menu/sheet stays crisp. The bell sheet paints inside
      // .unapi (z999999) and the burger inside its reka popper wrapper; the inner node is only z50 RELATIVE to
      // that context. Walk up, take the HIGHEST z-index ancestor (= the real root layer the popup lives in),
      // base the dim one step under it. Floor at 103 so it always clears the header/menu.
      var topZ = 0;
      for (var an = pop; an && an !== document.body && an !== document.documentElement; an = an.parentElement) {
        var az = parseInt(getComputedStyle(an).zIndex, 10);
        if (isFinite(az) && az > topZ) topZ = az;
      }
      if (!topZ) topZ = 50;
      dim.style.zIndex = String(topZ - 1 > 102 ? topZ - 1 : 103);
      dim.style.display = "block";
      // #21 the Connect Sheet/menu closes ASYNC (animation) — none of the open-time triggers fire again on
      // close, so the dim stayed stuck. While shown, poll (bounded, self-clearing) and hide the instant the
      // popover is gone. No observer, terminates itself -> freeze-safe.
      if (!ccDimWatch) {
        ccDimWatch = setInterval(function () {
          if (!document.querySelector(".bg-popover") && !document.querySelector(".unapi div.fixed.z-50.bg-background")) {
            var d = document.getElementById("cc-pop-dim"); if (d) d.style.display = "none";
            clearInterval(ccDimWatch); ccDimWatch = 0;
          }
        }, 200);
      }
    } catch (e) {}
  }
  var ccDimWatch = 0;
  var ccPopObs = null;
  function watchPopups() {
    try {
      if (ccPopObs) return; ccPopObs = new MutationObserver(function () { ccPopRestyleSoon(true); });
      ccPopObs.observe(document.body, { childList: true });   // dialogs/sweetalerts append as direct body children — cheap, no subtree
    } catch (e) {}
  }
  // ── NOTIFICATION CENTRE (P14, reworked): the Connect bell shows a Vue notification list that CACHES
  // its rows and never refetches on its own — a raw GraphQL mutation clears the BACKEND but the open
  // list stays stale (proven live: counts drop to 0, the rows remain -> user "Alle löschen funktioniert
  // nicht"). And the native "Alle archivieren" opens a confirm dialog that floats far off-screen (user:
  // "das bestätigungsfenster ist weit abseits"). Fix: CC hides the native archive text-link and drops
  // two CLONED badges into its column — a clone carries NO Vue click handler, so no off-screen confirm —
  // that act via the same-origin GraphQL API (x-csrf-token) then location.reload(): the ONLY reliable
  // way to refresh the cached list (mutation / tab-switch / close+reopen all failed live; reload is also
  // CC's existing pattern for the display settings). Archive sweeps unread into the archive; delete
  // archives-then-deletes-archived, guarded by a two-step armed click. Idempotent per sheet open.
  function ccGql(q) {
    return fetch("/graphql", { method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "x-csrf-token": (window.csrf_token || "") },
      body: JSON.stringify({ query: q }) });
  }
  function ccArchiveNotifs() {
    try { ccGql("mutation { archiveAll { archive { total } } }").then(function () { location.reload(); }).catch(function () {}); } catch (e) {}
  }
  function ccClearNotifs() {
    try {
      ccGql("mutation { archiveAll { archive { total } } }")
        .then(function () { return ccGql("mutation { deleteArchivedNotifications { archive { total } unread { total } } }"); })
        .then(function () { location.reload(); })
        .catch(function () {});
    } catch (e) {}
  }
  function ccArmDelete(del) {                                                        // first click arms + relabels, second (within 4s) clears
    if (del.getAttribute("data-armed") === "1") { ccClearNotifs(); return; }
    del.setAttribute("data-armed", "1"); del.classList.add("cc-notif-armed");
    // icon-only bulk button (docked by the gear): keep the trash icon, signal "armed" via the red .cc-notif-armed
    // fill + the tooltip (there's no text to relabel).
    var iconOnly = del.classList.contains("cc-notif-iconbtn");
    if (iconOnly) del.setAttribute("title", T("Wirklich löschen? Nochmal klicken.", "Really delete? Click again."));
    else del.textContent = T("Wirklich löschen?", "Really delete?");
    clearTimeout(del._ccT);
    del._ccT = setTimeout(function () {
      del.setAttribute("data-armed", "0"); del.classList.remove("cc-notif-armed");
      if (iconOnly) del.setAttribute("title", T("Alle löschen", "Delete all"));
      else del.textContent = T("Alle löschen", "Delete all");
    }, 4000);
  }
  function ccNotifActions() {
    try {
      if (g("cc.theming", "1") === "0") return;                                    // master-gated (chrome)
      var host = document.querySelector(".unapi div.fixed.z-50.bg-background");     // the Connect notification Sheet (light DOM)
      if (!host || host.querySelector(".cc-notif-badge")) return;                   // no sheet, or already injected
      var arch = null, sp = host.querySelectorAll("span, button, a");
      for (var i = 0; i < sp.length; i++) { if (/^\s*(Alle archivieren|Archive all)\s*$/i.test(sp[i].textContent || "")) { arch = sp[i]; break; } }
      if (!arch || !arch.parentElement) return;                                     // native archive-all not present (empty state / archive tab) -> nothing to attach to
      arch.parentElement.classList.add("cc-notif-actions");                         // CSS turns the column into a horizontal badge row
      // #5 (user): the two bulk actions become ICON-ONLY badges docked just LEFT of the type-filter gear.
      var gear = null, glinks = host.querySelectorAll('a[href*="Notification"]');
      for (var gi = 0; gi < glinks.length; gi++) { if (glinks[gi].querySelector("svg") && !(glinks[gi].textContent || "").trim()) { gear = glinks[gi]; break; } }
      if (gear && !gear.getAttribute("data-cc-tip")) { gear.setAttribute("data-cc-tip", T("Benachrichtigungs-Einstellungen", "Notification settings")); gear.removeAttribute("title"); }  // same frameless CC bubble as the two bulk icons
      var ICON_ARCH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"></path><path d="M10 12h4"></path></svg>';
      var ICON_DEL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6"></path><path d="M10 11v6M14 11v6"></path></svg>';
      function badge(icon, label, cls, onAct) {
        var b = arch.cloneNode(true);                                              // clone the native chrome MINUS its Vue handler
        b.removeAttribute("id"); b.className = arch.className + " cc-notif-badge cc-notif-iconbtn " + cls;
        b.innerHTML = icon; b.setAttribute("role", "button"); b.setAttribute("aria-label", label); b.setAttribute("data-cc-tip", label); b.removeAttribute("title"); b.tabIndex = 0; b.style.cursor = "pointer";  // frameless CC bubble (like the gear), never a native title balloon
        b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onAct(b); });
        b.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onAct(b); } });
        return b;
      }
      var arB = badge(ICON_ARCH, T("Alle archivieren", "Archive all"), "cc-notif-arch", function () { ccArchiveNotifs(); });
      var del = badge(ICON_DEL, T("Alle löschen", "Delete all"), "cc-notif-del", function () { ccClearNotifs(); });  // #(user): single click deletes (the two-step arming was confusing)
      arch.style.display = "none";                                                  // hide the native archive link (its click opens the off-screen confirm)
      if (gear && gear.parentNode) {                                                // dock LEFT of the gear (user); fall back to the native spot if it's absent
        var anchor = gear.closest(".shrink-0") || gear;
        anchor.parentNode.insertBefore(arB, anchor);
        anchor.parentNode.insertBefore(del, anchor);
      } else {
        arch.parentNode.insertBefore(arB, arch.nextSibling);
        arB.parentNode.insertBefore(del, arB.nextSibling);
      }
      for (var k = 0; k < sp.length; k++) { if (sp[k] !== del && /^\s*(Alle löschen|Delete all)\s*$/i.test(sp[k].textContent || "")) sp[k].style.display = "none"; }  // hide any native delete-all (archive tab)
    } catch (e) {}
  }
  // ── SELF-MEASURING alignment anchor (v2.17.0). Every CC area lines its left edge up with the main
  // menu bar (rule cc-align-everything-to-menu-bar). We used to GUESS the offset with a header-gated
  // px constant (10px native text edge / 15px CC-pill edge) — which was fragile and drifted (Settings
  // sat 5-10px off). Instead MEASURE it: the first menu item's real left edge minus #displaybox's own
  // left, written once to the shared --cc-align-left custom property on <html>. Every area's sheet
  // already reads `padding-left: var(--cc-align-left)`, so ONE measured value aligns them all — correct
  // for any theme, font size, and header-on/off, with no per-area guessing. Runs on every apply() +
  // resize; the static per-sheet 10/15px stays as a no-JS fallback.
  function measureAlign() {
    try {
      var root = document.documentElement;
      if (root.classList.contains("Theme--sidebar")) return;   // vertical left menu — the horizontal-edge model doesn't apply (sheets exclude it too)
      var box = document.getElementById("displaybox");
      var tile = document.querySelector("#menu .nav-tile:not(.right)");
      var a = tile && tile.querySelector(".nav-item > a");
      if (!box || !a) return;                                  // no menu/content here -> leave the CSS fallback in place
      var aRect = a.getBoundingClientRect(), boxRect = box.getBoundingClientRect();
      // compensate for horizontal scroll INSIDE the menu tile (many tabs) so the value is stable
      var scroll = tile.scrollLeft || 0;
      var edge;
      if (root.classList.contains("cc-header-on")) {
        edge = aRect.left + scroll;                            // CC pill: its background box IS the visible left edge
      } else {
        var cs = getComputedStyle(a);                         // native text menu: the visible edge is the TEXT, i.e. past the anchor's own padding/border
        edge = aRect.left + scroll + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
      }
      // #4 (user: on WIDE screens the boxed content is centred while the menu is full-width, so the section
      // badges land far right of the menu). Measure against the box's NATURAL left (subtract any shift we
      // already applied, so it doesn't oscillate). A POSITIVE offset indents via --cc-align-left (padding,
      // normal case); a NEGATIVE offset (boxed content sits RIGHT of the menu) pulls the whole content left
      // via --cc-box-shift (a negative margin), so the badges line up flush with the menu bar.
      if (root.classList.contains("Theme--width-boxed")) {
        // BOXED display width: the content is centred (margin auto) while the menu bar is full-width, so the
        // section badges land far right of the menu. LEFT-align the whole content to the menu by overriding
        // the centring margin with the menu item's ABSOLUTE left (edge is independent of the box position, so
        // it never oscillates). --cc-align-left stays 0 (the margin does the whole job here).
        root.style.setProperty("--cc-box-shift", Math.round(edge) + "px");
        root.style.setProperty("--cc-align-left", "0px");
      } else {
        var align = Math.round(edge - boxRect.left);
        if (align >= 0 && align < 200) { root.style.setProperty("--cc-align-left", align + "px"); root.style.setProperty("--cc-box-shift", "0px"); }  // sanity-bounded; overrides the sheets' static fallback inline
      }
      // #4-B (user, recurring frustration): the server-name BRAND sat at x=0 while the menu tabs start at
      // `edge` (their padded left). Nothing aligned it -> it always looked off by the pad. Self-correct it
      // here to the SAME menu edge: measure where it landed, nudge its margin by the delta (converges, since
      // the next pass measures ~0 delta). Runs on every apply()/resize like the content alignment.
      var brand = document.getElementById("cc-brand");
      if (brand) {
        var bRect = brand.getBoundingClientRect();
        if (bRect.width > 0) {
          var cm = parseFloat(getComputedStyle(brand).marginLeft) || 0;
          var bd = Math.round(edge - bRect.left);
          if (bd && Math.abs(bd) < 200) brand.style.marginLeft = (cm + bd) + "px";
        }
      }
    } catch (e) {}
  }
  // ── DRAG-AND-DROP main-menu tab ordering (v2.20.0). The left menu tabs (#menu .nav-tile:not(.right)
  // > .nav-item, each an <a href="/PageName">) can be reordered, but ONLY after a press-and-HOLD arms it
  // (v2.24.1): the cursor stays the normal link pointer (no grab hand), and a plain click just navigates.
  // Hold an item for ~450ms and its ZONE starts to jiggle (cc-nav-wiggle) to signal "you can move me
  // now"; from that same held press a drag reorders it. TWO zones (v2.25.0, user request): the LEFT tab
  // tile (keys = hrefs, cc.navorder) and the RIGHT tile's utility icons + array-usage meter (keys =
  // link signature / "usage-bar", cc.navorder.right); items reorder only within their own zone, and
  // non-participants on the right (user menu, transient search box) never move. Native order comes from
  // the server, so this is a pure front-end reorder + persistence. Only active while the header area is
  // on (opt-in via cc.navdrag, default on). New/unknown items keep native position AFTER the saved ones.
  function navTile() { return document.querySelector("#menu .nav-tile:not(.right)"); }
  function navTileR() { return document.querySelector("#menu .nav-tile.right"); }
  // ONE MERGED ZONE across BOTH tiles (v2.30.0, user chose per popup: "alles überall anordnen").
  // Participants = every page tab, every utility icon AND the array-usage meter, in EITHER tile.
  // Non-participants (user menu .nav-user, the transient #guiSearchBoxSpan) never move.
  function navParts(tile) { if (!tile) return []; return Array.prototype.slice.call(tile.querySelectorAll(":scope > .nav-item, :scope > .usage-bar")); }
  function navAllParts() { return navParts(navTile()).concat(navParts(navTileR())); }
  // stable key: tabs by href; utils by link signature (href, else onclick, else the localised
  // title — a language switch then just resets that one icon); the meter fixed.
  function navKeyAll(it) {
    if (it.id === "cc-bell-proxy") return "cc-bell";              // bell/burger proxies key by id (no href to key on)
    if (it.id === "cc-burger-proxy") return "cc-burger";
    if (it.classList.contains("usage-bar")) return "usage-bar";
    var a = it.querySelector("a"); if (!a) return null;
    // #2 (user: "die beiden Icons ganz rechts flackern"): every native util <a> is href="#" (the real
    // discriminator is in onclick, e.g. "InfoButton();return false;"). href-first collapsed ALL util icons
    // to the single key "#", which broke applyNavOrder's idempotence gate → place()/the #menu observer
    // looped into an endless right-tile re-shuffle = Info/Log flickering. Drop the shared "#" and key by onclick.
    var href = (a.getAttribute("href") || "").trim();
    if (href === "#") href = "";                                  // href="#" is shared by every util button -> not a key
    return ((href || a.getAttribute("onclick") || a.getAttribute("title") || "") + "").slice(0, 160) || null;
  }
  // storage: cc.navorder.all = {left:[keys], right:[keys]} — each tile's own sequence INCLUDING
  // items dragged over from the other side. One-time fallback-migration from the old zone keys.
  function navReadAll() {
    var o = null;
    try { o = JSON.parse(g("cc.navorder.all", "null")); if (!(o && o.left && o.right)) o = null; } catch (e) {}
    if (!o) {
      try {
        var l = JSON.parse(g("cc.navorder", "null")) || [], r = JSON.parse(g("cc.navorder.right", "null")) || [];
        if (l.length || r.length) o = { left: l, right: r };
      } catch (e2) {}
    }
    if (!o) return null;
    // #34: bell/burger proxies host a LIVE adopted Vue trigger, not a plain link — they only
    // render correctly among the other utility icons. A stray drag (or a leftover save from
    // testing the merged reorder zone) must never leave them parked among the page tabs.
    if (o.left && o.left.length) o.left = o.left.filter(function (k) { return k !== "cc-bell" && k !== "cc-burger"; });
    return o;
  }
  function applyNavOrder() {
    try {
      if (ccReorder || ccDragged) return;                      // never fight a live drag
      // TRUCE (freeze root cause, live-proven via localStorage stack dumps): Unraid's Connect
      // auto-mount script observes the menu and REBUILDS its component nodes on our reorder —
      // its rebuild refires our observer, place() reorders again, and the two observers ping-pong
      // the main thread into a hard freeze (>4000 insertBefore from place() captured). If the
      // arrangement does not SETTLE after a few attempts, stand down for a while.
      if (Date.now() < ccNavTruce) return;
      var o = navReadAll(); if (!o) return;
      var lt = navTile(), rt = navTileR(); if (!lt || !rt) return;
      var byKey = {}, all = navAllParts(), i, k;
      for (i = 0; i < all.length; i++) { k = navKeyAll(all[i]); if (k && !byKey[k]) byKey[k] = all[i]; }
      // IDEMPOTENCE GATE — this also runs from the #menu observer now. THE OLD BUG ("die
      // Reihenfolge wird nicht gespeichert"): the order was applied ONLY at boot, but most
      // utility icons are appended by native scripts AFTER boot, so their saved positions
      // never took effect. insertBefore always mutates, so re-running from the observer
      // demands a strict no-op when the arrangement already matches — else it loops.
      function inPlace(tile2, want) {
        var wantHere = [], wset = {}, have = [], cur = navParts(tile2), j, kk;
        for (j = 0; j < want.length; j++) if (byKey[want[j]]) { wantHere.push(want[j]); wset[want[j]] = 1; }
        for (j = 0; j < cur.length; j++) { kk = navKeyAll(cur[j]); if (kk && wset[kk]) have.push(kk); }
        if (have.length !== wantHere.length) return false;     // a saved item currently sits in the OTHER tile
        for (j = 0; j < have.length; j++) if (have[j] !== wantHere[j]) return false;
        return true;
      }
      if (inPlace(lt, o.left) && inPlace(rt, o.right)) { ccNavTries = 0; return; }
      // Auto-mount undoes our reorder ASYNCHRONOUSLY, so a post-place re-check would always pass —
      // instead count how often we have to RE-place within a short window: a lone apply (page load,
      // late-added icon) is 1-2 rounds, a fight is an endless chain. Stand down BEFORE placing, so
      // the opponent gets nothing to react to and the chain dies.
      var now = Date.now();
      if (now - ccNavLast > 3000) ccNavTries = 0;              // old rounds don't count as a fight
      ccNavLast = now;
      if (++ccNavTries >= 4) { ccNavTruce = now + 5000; ccNavTries = 0; return; }
      function place(tile2, want) {
        var anchor = tile2.querySelector(":scope > .nav-user");   // the user menu stays the tail; null => append
        for (var j = 0; j < want.length; j++) { var it = byKey[want[j]]; if (it) tile2.insertBefore(it, anchor); }
      }
      place(lt, o.left); place(rt, o.right);                   // unknown/new items keep their native tile + slot
    } catch (e) {}
  }
  function saveNavOrder() {
    try {
      var lt = navTile(), rt = navTileR(); if (!lt || !rt) return;
      function seq(tile2) { var out = [], ps = navParts(tile2), i, k; for (i = 0; i < ps.length; i++) { k = navKeyAll(ps[i]); if (k) out.push(k); } return out; }
      localStorage.setItem("cc.navorder.all", JSON.stringify({ left: seq(lt), right: seq(rt) }));
    } catch (e) {}
  }
  var ccDragged = null, ccReorder = false, ccHoldTimer = null, ccPressXY = null, ccSuppressClick = false, ccDocBound = false;
  var ccPressItem = null, ccPressPtr = 0, ccMoved = false;   // POINTER-drag state (replaces the HTML5 drag)
  var ccNavTruce = 0, ccNavTries = 0, ccNavLast = 0;   // anti-ping-pong truce vs Unraid's Connect auto-mount observer (see applyNavOrder)
  var ccLockCapBound = false;   // the arrange-lock document-capture toggle is bound once
  function cancelHold() { if (ccHoldTimer) { clearTimeout(ccHoldTimer); ccHoldTimer = null; } ccPressXY = null; ccPressItem = null; }
  function enterReorder() {   // long-press satisfied => EVERYTHING jiggles (one zone)
    if (ccReorder) return; ccReorder = true;
    navAllParts().forEach(function (it) { it.classList.add("cc-nav-wiggle"); });
  }
  function exitReorder() {    // back to plain, clickable items
    ccReorder = false; ccDragged = null; ccMoved = false;
    navAllParts().forEach(function (it) { it.classList.remove("cc-nav-wiggle", "cc-dragging"); });
  }
  // ── #Drag-Umbau (user): a LOCK toggle replaces long-press. Locked (default, every page load) = tabs/chips
  // navigate normally. Click the lock -> ARRANGE mode: everything wiggles and can be dragged immediately;
  // click again (or Esc) -> locked + the new order saved. The lock is ALWAYS visible while the header is on.
  // #Drag-Umbau (user CORRECTION): NO separate lock button — reuse Unraid's OWN "unlock sortable" icon
  // (.nav-item.LockButton, icon-u-lock) that natively appears only on the Dashboard. Make a lock icon PERSISTENT
  // in the util row on EVERY page and wire it to the CC arrange mode: on Dashboard the native LockButton is
  // wired to ALSO toggle CC arranging; on other pages CC injects a look-alike util icon.
  function ccArrangeLock() {
    try {
      // #(user: "zum Beenden muss ich zweimal aufs Schloss klicken"): a downstream CAPTURE-phase
      // stopPropagation on the header eats lock clicks before they reach any per-element handler (proven
      // live: a document-level capture listener fires; a .nav-item-level one does NOT, nor does the <a>'s
      // own handler). So the lock's own click handlers were unreliable. Bind ONE toggle on the DOCUMENT
      // in the capture phase — it fires FIRST, so one click = one reliable toggle, for BOTH the native
      // LockButton (Dashboard) and CC's injected #cc-lock-item (other pages).
      if (!ccLockCapBound) {
        ccLockCapBound = true;
        document.addEventListener("click", function (e) {
          var lk = e.target && e.target.closest ? e.target.closest("#cc-lock-item, #menu .nav-item.LockButton") : null;
          if (!lk) return;
          if (lk.id === "cc-lock-item") e.preventDefault();   // CC's own #href lock: suppress navigation
          ccToggleArrange();
        }, true);
      }
      var old = document.getElementById("cc-arrange-lock"); if (old) old.remove();   // drop the previous floating button
      var on = document.documentElement.classList.contains("cc-header-on");
      var tileR = document.querySelector("#menu .nav-tile.right");
      var injected = document.getElementById("cc-lock-item");
      if (!on || !tileR) { if (injected) injected.remove(); return; }
      var native = tileR.querySelector(".nav-item.LockButton");
      if (native) {
        if (injected) injected.remove();   // native present -> no clone needed (the document-capture toggle drives it)
      } else if (!injected) {
        injected = document.createElement("div"); injected.className = "nav-item util cc-navdrag"; injected.id = "cc-lock-item"; injected.setAttribute("data-cc-drag", "1");   // exclude from nav reorder
        var a = document.createElement("a"); a.href = "#"; a.className = "hand"; a.setAttribute("data-cc-tip", T("Anordnen entsperren/sperren", "Unlock/lock arranging"));
        a.innerHTML = "<b class='icon-u-lock system'></b>";
        injected.appendChild(a); tileR.insertBefore(injected, tileR.firstChild);   // click handled by the document-capture toggle above
      }
      var arr = document.documentElement.classList.contains("cc-arrange");
      if (native) native.classList.toggle("cc-lock-arranging", arr);
      var inj2 = document.getElementById("cc-lock-item"); if (inj2) inj2.classList.toggle("cc-lock-arranging", arr);
    } catch (e) {}
  }
  function ccToggleArrange() {
    try {
      var arr = !document.documentElement.classList.contains("cc-arrange");
      document.documentElement.classList.toggle("cc-arrange", arr);
      var isle = document.getElementById("cc-island");
      if (arr) { enterReorder(); if (isle) isle.classList.add("cc-isl-arranging"); }
      else {
        exitReorder(); if (isle) isle.classList.remove("cc-isl-arranging");
        try { saveNavOrder(); } catch (e1) {}
        try { ccIslandSaveOrder(); } catch (e2) {}
      }
      ccArrangeLock();
      try { ccDockProfile(); } catch (eD) {}                      // re-adopt bell/burger into their proxies at the new order (arrange enter/exit swaps ghost<->trigger)
      // #19 (user: move arrows stay after closing arrange on the Docker tab): the docker "move" arrows are
      // Unraid's own i.mover, driven ONLY by the native LockButton onclick — which the header's capture-phase
      // stopPropagation eats on a real (trusted) click (see line ~606), so arrange exits but the arrows persist.
      // Reconcile AFTER the native handler had its turn (setTimeout 0): on the Docker page, if the lockbutton
      // cookie doesn't match our arrange state, flip Unraid's LockButton once so cookie+arrows+sortable follow.
      if (document.getElementById("docker_list")) {
        var wantArr = arr;
        setTimeout(function () {
          try {
            if (typeof LockButton !== "function") return;
            var cookieOn = /(^|;\s*)lockbutton=/.test(document.cookie);
            if (cookieOn !== wantArr) LockButton();
          } catch (e3) {}
        }, 0);
      }
    } catch (e) {}
  }
  // ── #S6 COMMAND PALETTE (Ctrl/⌘+K) ── a quick launcher over every page tab + a few CC actions. Fuzzy-
  // filtered, keyboard-driven (↑/↓/Enter/Esc). Built lazily on first open; one overlay reused thereafter.
  var ccCmdEl = null, ccCmdInput = null, ccCmdList = null, ccCmdItems = [], ccCmdSel = 0;
  function ccCmdSources() {
    var items = [];
    // every page tab (works on every page: #menu is always present)
    var seen = {};
    Array.prototype.forEach.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]"), function (a) {
      var href = a.getAttribute("href") || "", label = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!href || href === "#" || !label || seen[href]) return; seen[href] = 1;
      items.push({ label: label, sub: href, kind: "page", go: function () { location.href = href; } });
    });
    // a few CC actions
    items.push({ label: T("Anordnen ein/aus", "Toggle arranging"), sub: T("Menü & Insel umsortieren", "Rearrange menu & island"), kind: "action", go: function () { ccToggleArrange(); } });
    items.push({ label: T("CannonadeCommand-Einstellungen", "CannonadeCommand settings"), sub: "/Settings/CannonadeCommand", kind: "action", go: function () { location.href = "/Settings/CannonadeCommand"; } });
    return items;
  }
  function ccCmdRender() {
    var q = (ccCmdInput.value || "").toLowerCase().replace(/\s+/g, "");
    var scored = [];
    ccCmdItems.forEach(function (it) {
      var hay = (it.label + " " + (it.sub || "")).toLowerCase();
      if (!q) { scored.push({ it: it, s: 0 }); return; }
      // simple subsequence fuzzy match
      var i = 0; for (var c = 0; c < hay.length && i < q.length; c++) { if (hay[c] === q[i]) i++; }
      if (i === q.length) scored.push({ it: it, s: hay.indexOf(q[0]) });
    });
    scored.sort(function (a, b) { return a.s - b.s; });
    ccCmdSel = 0;
    ccCmdList.innerHTML = "";
    scored.slice(0, 40).forEach(function (r, ix) {
      var row = document.createElement("div"); row.className = "cc-cmd-item" + (ix === 0 ? " cc-cmd-on" : "");
      row.innerHTML = "<span class='cc-cmd-lbl'></span><span class='cc-cmd-sub'></span>";
      row.querySelector(".cc-cmd-lbl").textContent = r.it.label; row.querySelector(".cc-cmd-sub").textContent = r.it.sub || "";
      row.addEventListener("mousemove", function () { ccCmdMark(ix); });
      row.addEventListener("click", function () { ccCmdClose(); r.it.go(); });
      ccCmdList.appendChild(row);
    });
  }
  function ccCmdMark(ix) { var rows = ccCmdList.children; for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("cc-cmd-on", i === ix); ccCmdSel = ix; }
  function ccCmdOpen() {
    if (!ccCmdEl) {
      ccCmdEl = document.createElement("div"); ccCmdEl.id = "cc-cmd"; ccCmdEl.setAttribute("role", "dialog");
      ccCmdEl.innerHTML = "<div class='cc-cmd-bd'></div><div class='cc-cmd-box'><input class='cc-cmd-in' type='text' spellcheck='false' placeholder='" + T("Seite oder Aktion suchen…", "Search a page or action…") + "'><div class='cc-cmd-list'></div></div>";
      document.body.appendChild(ccCmdEl);
      ccCmdInput = ccCmdEl.querySelector(".cc-cmd-in"); ccCmdList = ccCmdEl.querySelector(".cc-cmd-list");
      ccCmdEl.querySelector(".cc-cmd-bd").addEventListener("click", ccCmdClose);
      ccCmdInput.addEventListener("input", ccCmdRender);
      ccCmdInput.addEventListener("keydown", function (e) {
        var n = ccCmdList.children.length;
        if (e.key === "ArrowDown") { e.preventDefault(); ccCmdMark(Math.min(ccCmdSel + 1, n - 1)); ccCmdList.children[ccCmdSel] && ccCmdList.children[ccCmdSel].scrollIntoView({ block: "nearest" }); }
        else if (e.key === "ArrowUp") { e.preventDefault(); ccCmdMark(Math.max(ccCmdSel - 1, 0)); ccCmdList.children[ccCmdSel] && ccCmdList.children[ccCmdSel].scrollIntoView({ block: "nearest" }); }
        else if (e.key === "Enter") { e.preventDefault(); ccCmdList.children[ccCmdSel] && ccCmdList.children[ccCmdSel].click(); }
        else if (e.key === "Escape") { e.preventDefault(); ccCmdClose(); }
      });
    }
    ccCmdItems = ccCmdSources();
    ccCmdEl.classList.add("cc-cmd-open"); ccCmdInput.value = ""; ccCmdRender();
    setTimeout(function () { try { ccCmdInput.focus(); } catch (e) {} }, 20);
  }
  function ccCmdClose() { if (ccCmdEl) ccCmdEl.classList.remove("cc-cmd-open"); }
  // wire ONE participant. Guard PER ITEM. POINTER-based drag (NOT HTML5): the native drag needs
  // draggable=true set BEFORE pointerdown, so arming it on a long-press made the first press do
  // nothing (user had to press 2-3x). Pointer capture + manual insertBefore has no such rule —
  // the very gesture that armed the hold continues straight into the drag.
  function wireNavItem(it) {
    if (it.getAttribute("data-cc-drag") === "1") return; it.setAttribute("data-cc-drag", "1");
    it.setAttribute("draggable", "false"); it.classList.add("cc-navdrag");
    var la = it.querySelectorAll("a"); for (var ai = 0; ai < la.length; ai++) la[ai].setAttribute("draggable", "false");
    it.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;                            // left only
      // #Drag-Umbau (user): drag is now UNLOCKED by the lock toggle, not by a long press. LOCKED (default) =
      // pointerdown does nothing, the tab just navigates. ARRANGE mode (cc-arrange) = the SAME press drags
      // IMMEDIATELY (no hold), and everything already wiggles. Escape/clicking the lock again re-locks.
      if (!document.documentElement.classList.contains("cc-arrange")) return;
      cancelHold(); ccPressXY = { x: e.clientX, y: e.clientY }; ccPressItem = it; ccPressPtr = e.pointerId; ccMoved = false;
      enterReorder(); ccDragged = ccPressItem;
      if (ccDragged) { ccDragged.classList.add("cc-dragging"); try { ccDragged.setPointerCapture(ccPressPtr); } catch (e2) {} }
      e.preventDefault();
    });
  }
  // document-level pointer handlers (bound once) run the whole gesture — capture routes moves here
  function ccNavPointerMove(e) {
    if (ccPressXY && !ccReorder) {   // still deciding: a real move before arming = a click/scroll, cancel the hold
      if (Math.abs(e.clientX - ccPressXY.x) > 8 || Math.abs(e.clientY - ccPressXY.y) > 8) { cancelHold(); }
      return;
    }
    if (!ccDragged) return;
    ccMoved = true;
    // find the nav item under the pointer and insert the dragged one before/after it
    var parts = navAllParts(), i, best = null;
    for (i = 0; i < parts.length; i++) { if (parts[i] === ccDragged) continue; var r = parts[i].getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 20 && e.clientY <= r.bottom + 20) { best = parts[i]; break; } }
    if (best) { var br = best.getBoundingClientRect(), before = e.clientX < br.left + br.width / 2; best.parentNode.insertBefore(ccDragged, before ? best : best.nextSibling); }
  }
  function ccNavPointerUp() {
    var wasReorder = ccReorder, dragged = ccDragged, moved = ccMoved;
    cancelHold();
    if (dragged) { try { dragged.releasePointerCapture(ccPressPtr); } catch (e) {} saveNavOrder(); }
    if (wasReorder) { if (!moved) ccSuppressClick = true; exitReorder(); }   // armed but never moved -> suppress the click, don't navigate
  }
  function setupNavDrag() {
    try {
      if (g("cc.navdrag", "1") === "0") return;                 // opt-out
      navAllParts().forEach(wireNavItem);
      if (!ccDocBound) {
        ccDocBound = true;
        document.addEventListener("pointermove", ccNavPointerMove);
        document.addEventListener("pointerup", ccNavPointerUp);
        document.addEventListener("pointercancel", ccNavPointerUp);
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.documentElement.classList.contains("cc-arrange")) { cancelHold(); ccToggleArrange(); } });
        // a long-press that never became a drag must not ALSO navigate (capture phase so it beats the link)
        document.addEventListener("click", function (e) { if (ccSuppressClick) { e.preventDefault(); e.stopPropagation(); ccSuppressClick = false; } }, true);
        // #8 (user: "um den VM-Tab zu öffnen muss ich immer zweimal klicken"): /VMs is a Tabs="true" inline-eval
        // page, and a Connect auto-mount / nav-reorder that re-inserts the <a> between mousedown and mouseup can
        // swallow the FIRST click. This delegated handler lives on document (survives node reinsertion) and forces
        // a reliable full navigation on the first click. Skipped while dragging (arrange) or already on /VMs.
        if (!window.__ccVmsClickFix) {
          window.__ccVmsClickFix = true;
          document.addEventListener("click", function (e) {
            try {
              if (ccSuppressClick || document.documentElement.classList.contains("cc-arrange")) return;
              var a = e.target && e.target.closest ? e.target.closest('#menu .nav-item:not(.util) a[href="/VMs"]') : null;
              if (!a) return;
              if (location.pathname.replace(/\/+$/, "") === "/VMs") return;
              location.href = "/VMs";
            } catch (e2) {}
          }, false);
        }
      }
    } catch (e) {}
  }
  // ── STATUS ISLAND (user-approved concept). The 91px top strip (div#header) is EMPTY between
  // Unraid's two Connect web components (unraid-header-os-version left, unraid-user-profile
  // right). Both are Shadow-DOM and UNTOUCHABLE (law: never restyle/move them) — so we build
  // our OWN light-DOM span#cc-island NEXT to them (inserted before the profile; the sheet's
  // margin-left:auto pushes it right). Data source = the CSS-hidden native footer: span#statusbar
  // textContent is bullet-separated ("Array gestartet•shiplog: started (pid …, port …)" — first
  // segment = array state, each following segment = "name: status (details)" per service), and
  // the footer text also carries the CPU/board temps ("38 °C27.8 °C" — unmarked spans, so we
  // parse TEXT, not structure). Chips are S-tier (~21px, 11px font) with 10px state dots
  // (radius var(--cc-dot-r)); tooltips ride the frameless CC data-cc-tip bubble, never title=.
  var ccIslandObs = null, ccIslandSig = "";
  // #19: the 3 island row containers (rebuilt each paint) + pointer-drag state for arranging chips
  var ccIslRows = null, ccIslDragBound = false, ccIslDragged = null, ccIslHold = null, ccIslPressXY = null, ccIslPressPtr = 0, ccIslMoved = false, ccIslSuppressClick = false;
  // V-C: a chip click jumps to its page (array->/Main, containers->/Docker, ram/cpu/temps->/Dashboard)
  var CC_ISL_NAV = { array: "/Main", "array-fill": "/Main", docker: "/Docker", ram: "/Dashboard", cpu: "/Dashboard" };
  function ccIslandOn() { return g("cc.enable.header", "0") !== "0" && g("cc.theming", "1") !== "0" && g("cc.island", "1") !== "0"; }
  // #13 (user: "was können wir noch sinnvolles anzeigen?"): CPU/RAM live only as Dashboard page-globals,
  // but Unraid PUBLISHES them cross-page on nchan (the same feed the footer rides). We subscribe to
  // /sub/update1 — JSON {"ram":["95%","29.7 GiB",…],"sys":[…]} — for the RAM %/used, and DEFENSIVELY to
  // /sub/cpuload for CPU load (empty on boxes that don't measure it; the chip then simply hides). One
  // lightweight websocket each, started when the island is on, torn down when it goes off; every message
  // repaints the island (sig-guarded, so unchanged values are no-ops). Never loops: we write #header only.
  var ccLiveRam = "", ccLiveRamUsed = "", ccLiveCpu = "", ccLiveDocker = "", ccLiveSubs = null;
  var ccLiveNetRx = 0, ccLiveNetTx = 0, ccLiveNetOk = false;   // #12: live Down(rx)/Up(tx) rate in bytes/s
  function ccStartLive() {
    if (ccLiveSubs || typeof window.NchanSubscriber !== "function") return;
    ccLiveSubs = [];
    try {
      var u1 = new window.NchanSubscriber("/sub/update1", { subscriber: "websocket" });
      u1.on("message", function (m) {
        try {
          var d = JSON.parse(String(m));
          if (d && d.ram && d.ram.length && /%/.test(String(d.ram[0]))) {
            var r = String(d.ram[0]).replace(/\s+/g, ""), used = d.ram[1] ? String(d.ram[1]) : "";
            if (r !== ccLiveRam || used !== ccLiveRamUsed) { ccLiveRam = r; ccLiveRamUsed = used; ccIsland(); }
          }
        } catch (e) {}
      });
      u1.start(); ccLiveSubs.push(u1);
    } catch (e) {}
    ccStartCpu();   // #13: CPU load (7.3.2 dropped /sub/cpuload -> GraphQL systemMetricsCpu; nchan fallback for older)
    ccStartNet();   // #12: network Up/Down rate (engine /api/hostnet -> /proc/net/dev; frontend deltas the cumulative counters)
    try {
      // #23: /sub/dockerload publishes ONE line per RUNNING container ("<id>;<cpu%>;<mem> / <lim>") on
      // every page — the running-container count is just the number of non-empty lines.
      var dk = new window.NchanSubscriber("/sub/dockerload", { subscriber: "websocket" });
      dk.on("message", function (m) {
        try { var n = String(m).split("\n").filter(function (l) { return l.indexOf(";") > 0; }).length; var s = n > 0 ? String(n) : ""; if (s !== ccLiveDocker) { ccLiveDocker = s; ccIsland(); } } catch (e) {}
      });
      dk.start(); ccLiveSubs.push(dk);
    } catch (e) {}
  }
  function ccStopLive() { if (ccLiveSubs) { ccLiveSubs.forEach(function (s) { try { s.stop(); } catch (e) {} }); ccLiveSubs = null; } ccLiveRam = ccLiveRamUsed = ccLiveCpu = ccLiveDocker = ""; ccLiveNetRx = ccLiveNetTx = 0; ccLiveNetOk = false; }
  // #13 (user: CPU chip stuck on "--"): Unraid 7.3 dropped /sub/cpuload and moved CPU load to a GraphQL
  // WEBSOCKET (wss://.../graphql) — which reverse proxies (the user's *.lol tunnel) fail to upgrade
  // (handshake returns 200, not 101), so the subscription never emits and the chip stays blank. Proxy-safe
  // fix: poll CannonadeCommand's OWN engine over plain HTTP (ccapi.php -> /api/hostcpu), which computes host
  // CPU % from /proc/stat deltas. Works on every page, through any proxy, no websocket. First reading is 0%
  // (baseline seed), then live.
  function ccStartCpu() {
    var PROXY = "/plugins/cannonadecommand/server/ccapi.php", stopped = false;
    function poll() {
      if (stopped || !ccLiveSubs) return;
      fetch(PROXY + "?path=" + encodeURIComponent("hostcpu"), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && typeof j.pct === "number") { var c = Math.round(j.pct) + "%"; if (c !== ccLiveCpu) { ccLiveCpu = c; ccIsland(); } } })
        .catch(function () {});
    }
    poll();
    var iv = setInterval(poll, 3000);
    if (ccLiveSubs) ccLiveSubs.push({ stop: function () { stopped = true; clearInterval(iv); } });
  }
  // #12: network Up/Down — poll the engine's /api/hostnet (cumulative rx/tx bytes from /proc/net/dev,
  // primary-uplink summed) over plain HTTP (proxy-safe, same idiom as ccStartCpu), delta successive
  // readings into a per-second rate. Counter reset / first sample -> no rate yet (chip shows "--").
  function ccStartNet() {
    var PROXY = "/plugins/cannonadecommand/server/ccapi.php", stopped = false, prev = null;
    function poll() {
      if (stopped || !ccLiveSubs) return;
      fetch(PROXY + "?path=" + encodeURIComponent("hostnet"), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || typeof j.rx !== "number" || typeof j.tx !== "number") return;
          var now = Date.now();
          if (prev && now > prev.t && j.rx >= prev.rx && j.tx >= prev.tx) {
            var dt = (now - prev.t) / 1000, rx = (j.rx - prev.rx) / dt, tx = (j.tx - prev.tx) / dt;
            if (rx !== ccLiveNetRx || tx !== ccLiveNetTx || !ccLiveNetOk) { ccLiveNetRx = rx; ccLiveNetTx = tx; ccLiveNetOk = true; ccIsland(); }
          }
          prev = { rx: j.rx, tx: j.tx, t: now };
        })
        .catch(function () {});
    }
    poll();
    var iv = setInterval(poll, 3000);
    if (ccLiveSubs) ccLiveSubs.push({ stop: function () { stopped = true; clearInterval(iv); } });
  }
  // #18: on /Main, compute the size-weighted array-disk fill % and cache it (cc.arrfill) so the island's
  // fill chip has a value on EVERY page (7.3.x dropped the cross-page menu usage-bar). Refreshes each /Main.
  function ccArrFill() {
    try {
      if (!/^\/Main/.test(location.pathname)) return;
      var tbl = document.querySelector("table.disk_status");
      if (!tbl) { if (!ccArrFill._t) { ccArrFill._t = setTimeout(function () { ccArrFill._t = 0; ccArrFill(); }, 900); } return; }   // apply() can run before /Main's array table is parsed -> retry until it exists
      var usedSum = 0, sizeSum = 0, n = 0;
      Array.prototype.forEach.call(tbl.querySelectorAll("tr"), function (row) {
        var sp = row.querySelector(".usage-disk span"); if (!sp) return;
        var w = parseFloat(sp.style.width || ""); if (isNaN(w)) return;
        var mm = (row.textContent || "").match(/(\d+(?:[.,]\d+)?)\s*(PB|TB|GB|MB)\b/i); if (!mm) return;   // first size in the row = the GRÖSSE column
        var val = parseFloat(mm[1].replace(",", ".")), unit = mm[2].toUpperCase();
        var mult = unit === "PB" ? 1e15 : unit === "TB" ? 1e12 : unit === "GB" ? 1e9 : 1e6, bytes = val * mult;
        usedSum += bytes * w / 100; sizeSum += bytes; n++;
      });
      if (n > 0 && sizeSum > 0) { var pct = Math.round(usedSum / sizeSum * 100); if (pct >= 0 && pct <= 100) { var v = pct + "%"; if (g("cc.arrfill", "") !== v) { localStorage.setItem("cc.arrfill", v); ccIsland(); } } }
    } catch (e) {}
  }
  function ccIsland() {
    try {
      var isle = document.getElementById("cc-island");
      if (!ccIslandOn()) { if (isle && isle.parentNode) isle.parentNode.removeChild(isle); ccIslandSig = ""; ccStopLive(); return; }   // teardown: gate off = island gone (+ drop the live nchan subs)
      ccStartLive();   // #13: ensure the RAM/CPU nchan subscriptions are running while the island is on (idempotent)
      if (ccIslDragged) return;   // #19: never rebuild the island mid-drag (it would detach the dragged chip)
      var hdr = document.getElementById("header"); if (!hdr) return;
      var foot = document.getElementById("footer"), sb = document.getElementById("statusbar");
      var raw = ((sb && sb.textContent) || "").replace(/^\s+|\s+$/g, "");
      var footTxt = (foot && foot.textContent) || "";
      // every "NN.N °C" in the footer text (defensive: temp span markup varies per board/plugins)
      var temps = [], tm, tre = /(\d+(?:[.,]\d+)?)\s*°\s*C/g;
      while ((tm = tre.exec(footTxt))) temps.push(parseFloat(tm[1].replace(",", ".")));
      var warn = parseFloat(g("cc.tempwarn", "60")); if (!isFinite(warn) || warn <= 0) warn = 60;
      // parity/…% progress text (e.g. "Parity … 12.3 %") — goes into the ARRAY chip tooltip only
      var par = /parit[^•%]{0,120}?\d+(?:[.,]\d+)?\s*%/i.exec(footTxt);
      // native uptime + edition (top-strip restyle): the Connect profile's FIRST row carries
      // "Betriebszeit …" (span.text-xs, title "Server hoch seit …") and "Unraid OS" + <em>edition.
      // Both spans STAY in the DOM (Header.css hides them visually) — we only READ them here
      // (law: never move/edit inside the components). Missing uptime span = chip skipped.
      var up = document.querySelector("#UserProfile > div:first-child span.text-xs");
      var upTxt = ((up && up.textContent) || "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "");
      var upTitle = (up && up.getAttribute("title")) || "";
      var osSp = null, osRow = document.querySelector("#UserProfile > div:first-child");
      if (osRow) { var sps = osRow.querySelectorAll("span"); for (var oj = 0; oj < sps.length; oj++) { if (/Unraid\s*OS/i.test(sps[oj].textContent || "")) { osSp = sps[oj]; break; } } }
      // the span's textContent already includes the nested <em> edition ("Unraid OS Plus"); no em -> plain "Unraid OS"
      var osLabel = osSp ? (osSp.textContent || "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "") : "Unraid OS";
      // array fill level: prefer the menu usage-bar's text (older Unraid); 7.3.x dropped it, so fall back
      // to cc.arrfill — the size-weighted array-disk fill that ccArrFill() computes+caches while on /Main
      // (#18: the enabled fill chip was blank because the native bar is gone).
      var ub = document.querySelector("#menu .usage-bar > span");
      var usage = ub ? (ub.textContent || "").replace(/\s+/g, "").trim() : (g("cc.arrfill", "") || "");
      // usage MINI BAR geometry (user: "die Füllstandanzeige soll so ein schöner balken sein wie
      // zuvor"): fill width = the percentage, fill COLOUR carries the state (green <80, amber <95,
      // red above — the same thresholds the dot used); non-numeric text -> empty grey track
      var un = parseInt(usage, 10);
      var uw = isNaN(un) ? 0 : Math.max(0, Math.min(100, un));
      var uc = isNaN(un) ? "#8d8d8d" : un >= 95 ? "#d9433f" : un >= 80 ? "#d6a243" : "#3fae6a";
      // per-element visibility (user: an/abhaken welche Chips die Insel zeigt) — cc.isl.<key>,
      // default ON; a fixed render order gives the island a deterministic, tidy layout
      function iOn(k) { return g("cc.isl." + k, "1") !== "0"; }
      var netUnit = g("cc.isl.net.unit", "bit") === "byte" ? "byte" : "bit";   // #12: Bit/Byte toggle, persisted
      var verNum = "";
      var verElN = document.querySelector('unraid-header-os-version span[id^="reka-menu-trigger"]');
      if (verElN) verNum = ((verElN.textContent) || "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "");
      // #18 (user): also show the count of NON-running containers. /sub/dockerload only carries RUNNING ones,
      // so the total comes from the cross-page cc.stateCache (docker.js caches the full /api/state list).
      var dockRun = parseInt(ccLiveDocker, 10) || 0, dockTot = 0;
      try { var csD = JSON.parse(g("cc.stateCache", "null")); if (csD && csD.containers && csD.containers.length) dockTot = csD.containers.length; } catch (eD) {}
      var dockStop = dockTot > dockRun ? dockTot - dockRun : 0;
      var items = "u" + (iOn("uptime") ? 1 : 0) + "o" + (iOn("os") ? 1 : 0) + "v" + (iOn("version") ? 1 : 0) + "a" + (iOn("array") ? 1 : 0) + "f" + (iOn("fill") ? 1 : 0) + "r" + (iOn("ram") ? 1 : 0) + "c" + (iOn("cpu") ? 1 : 0) + "d" + (iOn("containers") ? 1 : 0) + "t" + (iOn("temps") ? 1 : 0) + "n" + (iOn("net") ? 1 : 0) + "|dt" + dockTot + "|nu" + netUnit;
      // idempotence guard: nchan rewrites the footer every few seconds with UNCHANGED text most
      // of the time — compare the source signature and skip the DOM rebuild when nothing moved
      // (bar width/colour + the item toggles included so a change always redraws)
      var sig = upTxt + "|" + upTitle + "|" + osLabel + "|" + verNum + "|" + raw + "|" + temps.join(",") + "|" + warn + "|" + usage + "|" + uw + uc + "|" + (par ? par[0] : "") + "|" + ccLiveRam + "/" + ccLiveRamUsed + "/" + ccLiveCpu + "/" + ccLiveDocker + "|net" + (ccLiveNetOk ? Math.round(ccLiveNetRx) + "/" + Math.round(ccLiveNetTx) : "") + "|" + items;
      if (isle && sig === ccIslandSig) return;
      ccIslandSig = sig;
      if (!isle) {
        isle = document.createElement("span"); isle.id = "cc-island";
        var prof = hdr.querySelector("unraid-user-profile");   // insert BESIDE the web component, never inside it
        if (prof) hdr.insertBefore(isle, prof); else hdr.appendChild(isle);
      }
      while (isle.firstChild) isle.removeChild(isle.firstChild);   // clear + refill = idempotent rebuild
      // #19 (user): the chips live in 3 arrangeable ROWS. Build them into row 0 (staging); ccIslandArrange()
      // then moves each into its saved row/position, new/unknown chips stay in row 0. Each chip carries a
      // stable data-cc-chip key (its cc-isl-<key> suffix) so the saved order survives every rebuild.
      ccIslRows = [];
      for (var ir = 0; ir < 3; ir++) { var rw = document.createElement("span"); rw.className = "cc-isl-row"; rw.setAttribute("data-cc-row", ir); isle.appendChild(rw); ccIslRows.push(rw); }
      function chip(label, dot, tip, cls) {
        var c = document.createElement("span"); c.className = "cc-isl-chip" + (cls ? " " + cls : "");
        if (cls) c.setAttribute("data-cc-chip", cls.replace(/^cc-isl-/, ""));
        var d = document.createElement("span"); d.className = "cc-isl-dot";
        d.style.background = dot;   // state COLOUR inline; size/shape (var(--cc-dot-r)) in the sheet
        c.appendChild(d); c.appendChild(document.createTextNode(label));
        if (tip) c.setAttribute("data-cc-tip", tip);   // frameless CC bubble (law) — no native balloon
        ccIslRows[0].appendChild(c);
      }
      // mini-BAR chip (fill / RAM / CPU): a short lead label + fill width = %, fill COLOUR carries the
      // state (green <80, amber <95, red above — same thresholds as the dots); non-numeric % -> grey track.
      // The lead label disambiguates the three bars visually (else identical); tooltip carries the detail.
      function barChip(lead, pctText, tip, cls) {
        var n = parseInt(pctText, 10), w = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
        var col = isNaN(n) ? "#8d8d8d" : n >= 95 ? "#d9433f" : n >= 80 ? "#d6a243" : "#3fae6a";
        var uch = document.createElement("span"); uch.className = "cc-isl-chip cc-isl-usage" + (cls ? " " + cls : "");
        if (lead) { var lb = document.createElement("span"); lb.className = "cc-isl-lead"; lb.textContent = lead; uch.appendChild(lb); }
        var ubar = document.createElement("span"); ubar.className = "cc-isl-bar";
        var ufill = document.createElement("span"); ufill.className = "cc-isl-fill";
        ufill.style.width = w + "%"; ufill.style.background = col;
        ubar.appendChild(ufill); uch.appendChild(ubar); uch.appendChild(document.createTextNode(pctText));
        if (tip) uch.setAttribute("data-cc-tip", tip);
        if (cls) uch.setAttribute("data-cc-chip", cls.replace(/^cc-isl-/, ""));
        ccIslRows[0].appendChild(uch);
      }
      // FIXED render order (user: "total unsortiert" -> deterministic layout): uptime, OS,
      // array state, fill bar, temps. Each element is gated by its cc.isl.<key> toggle. Every
      // tooltip carries REAL extra info, never just the label back (user call).
      var arrSeg = (raw ? raw.split("•")[0] : "").replace(/^\s+|\s+$/g, "");   // first bullet segment = array state
      // 1) UPTIME — label without the leading word; bubble = the boot timestamp (the useful bit)
      if (iOn("uptime") && upTxt) {
        var upClean = upTxt.replace(/^(Betriebszeit|Uptime)\s*/i, "");
        chip(upClean, "#3fae6a", upTitle || (T("Läuft seit ", "Up since ") + upClean), "cc-isl-up");
      }
      // 2) OS EDITION — bubble names the running version (the native 7.3.2 dropdown stays in place)
      if (iOn("os")) {
        chip(osLabel, "#8d8d8d", T("Version ", "Version ") + (verNum || "?"), "cc-isl-os");
      }
      // 2b) VERSION NUMBER — the native floating version chip is hidden by the sheet and its number
      // (e.g. "7.3.2") joins the island so ALL chips align right in 2-3 rows (N10). Display chip; the
      // OS-update dropdown stays reachable via Tools -> Update OS.
      if (iOn("version") && verNum) {
        chip(verNum, "#8d8d8d", T("Unraid-Version ", "Unraid version ") + verNum, "cc-isl-ver");
      }
      // 3) ARRAY STATE — bubble adds the parity/progress line when one is running
      if (iOn("array") && arrSeg) {
        var low = arrSeg.toLowerCase(), dc = "#d6a243";
        if (low.indexOf("gestartet") !== -1 || low.indexOf("started") !== -1) dc = "#3fae6a";
        else if (low.indexOf("gestoppt") !== -1 || low.indexOf("stopped") !== -1) dc = "#d9433f";
        chip(arrSeg, dc, par ? arrSeg + " — " + par[0].replace(/\s+/g, " ") : arrSeg, "cc-isl-array");
      }
      // 4) ARRAY FILL LEVEL — mini bar + % text (fill colour = state); bubble = plain sentence. Source is
      // the native menu usage-bar, which 7.3.x dropped -> usually empty here (chip hides); kept for boxes
      // that still expose it. RAM (5) is the always-available live usage bar in its place.
      // #20 (user: toggled-on chips that don't appear): show the chip with a "--" placeholder even when the
      // source is momentarily empty, so an enabled toggle always produces a visible chip (fill needs a /Main
      // visit to prime cc.arrfill on 7.3.x; the tooltip says so).
      if (iOn("fill")) barChip(T("Array", "Array"), usage || "--", usage ? T("Array zu " + usage + " belegt", "Array " + usage + " used") : T("Array-Füllstand — auf der Startseite messbar", "Array fill — measured on the Main page"), "cc-isl-array-fill");
      // 5) RAM USAGE — live from nchan /sub/update1 (ccLiveRam="95%", ccLiveRamUsed="29.7 GiB"); mini bar,
      // works on EVERY page (the missing "fill/temps show nothing" fix + the "was noch anzeigen" expansion).
      if (iOn("ram") && ccLiveRam) barChip("RAM", ccLiveRam, T("RAM zu " + ccLiveRam + " belegt" + (ccLiveRamUsed ? " (" + ccLiveRamUsed + ")" : ""), "RAM " + ccLiveRam + " used" + (ccLiveRamUsed ? " (" + ccLiveRamUsed + ")" : "")), "cc-isl-ram");
      // 5b) CPU LOAD — live from nchan /sub/cpuload; empty on boxes that don't measure it (chip hides).
      if (iOn("cpu")) barChip("CPU", ccLiveCpu || "--", ccLiveCpu ? T("CPU-Last " + ccLiveCpu, "CPU load " + ccLiveCpu) : T("CPU-Last derzeit nicht verfügbar", "CPU load currently unavailable"), "cc-isl-cpu");   // #20: placeholder so the toggle is visible
      // 5c) CONTAINERS — #23: running-container count, live from nchan /sub/dockerload (one line per running
      // container); a dotted chip, not a bar. Cross-page. Hides if none / no data.
      if (iOn("containers") && (ccLiveDocker || dockTot)) chip((ccLiveDocker || "0") + (dockTot ? " / " + dockStop : ""), "#3fae6a", T(dockRun + " laufend" + (dockTot ? ", " + dockStop + " gestoppt (von " + dockTot + ")" : ""), dockRun + " running" + (dockTot ? ", " + dockStop + " stopped (of " + dockTot + ")" : "")), "cc-isl-docker");   // #18: running / stopped
      // 5d) NET — #12 (user): live Down(rx)/Up(tx) throughput as ONE chip with two segments (↓ / ↑),
      // fed by ccStartNet() -> engine /api/hostnet. Click toggles the unit Bit <-> Byte (persisted,
      // handled in the island click delegate). Shows "--" until the /api/hostnet backend ships.
      if (iOn("net")) {
        var fmtRate = function (bps) {
          if (!ccLiveNetOk || !isFinite(bps) || bps < 0) return "--";
          var v = netUnit === "bit" ? bps * 8 : bps, base = netUnit === "bit" ? 1000 : 1024;
          var u = netUnit === "bit" ? ["bit/s", "Kbit/s", "Mbit/s", "Gbit/s"] : ["B/s", "KB/s", "MB/s", "GB/s"], i = 0;
          while (v >= base && i < u.length - 1) { v /= base; i++; }
          return (i === 0 || v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + " " + u[i];
        };
        var nc = document.createElement("span"); nc.className = "cc-isl-chip cc-isl-net"; nc.setAttribute("data-cc-chip", "net");
        nc.setAttribute("data-cc-tip", T("Netzwerk-Traffic — Klick: Bit/Byte", "Network traffic — click: bit/byte"));
        var segD = document.createElement("span"); segD.className = "cc-isl-net-seg"; segD.textContent = "↓ " + fmtRate(ccLiveNetRx);
        var segU = document.createElement("span"); segU.className = "cc-isl-net-seg"; segU.textContent = "↑ " + fmtRate(ccLiveNetTx);
        nc.appendChild(segD); nc.appendChild(segU); ccIslRows[0].appendChild(nc);
      }
      // 6) TEMPS — first sensor = CPU, second = Mainboard (Unraid footer order), rest generic; the
      // dot carries the state (green below cc.tempwarn, amber at/above, red at threshold+15)
      if (iOn("temps")) {
        for (var i = 0; i < temps.length; i++) {
          var tlab = i === 0 ? T("CPU-Temperatur", "CPU temperature") : i === 1 ? T("Mainboard-Temperatur", "Motherboard temperature") : T("Temperatur", "Temperature");
          chip(Math.round(temps[i]) + " °C", temps[i] >= warn + 15 ? "#d9433f" : temps[i] >= warn ? "#d6a243" : "#3fae6a", tlab + ": " + temps[i] + " °C", "cc-isl-temp" + i);
        }
      }
      // service segments (e.g. "shiplog: started …") are deliberately NOT mirrored — that daemon
      // status stays in the (hidden) native footer (user questioned it twice)
      ccIslandArrange(); ccWireIslandDrag();   // #19: apply the saved 3-row arrangement + make the chips draggable
    } catch (e) {}
  }
  // ── #19 STATUS-ISLAND CHIP ARRANGEMENT (user: "chips per drag and drop anordenbar, drei zeilen") ──
  // The chips are built into 3 row containers; the user long-presses a chip and drags it to any row/position.
  // The layout is persisted as cc.isl.order = [[row0 keys],[row1 keys],[row2 keys]] and re-applied on every
  // island rebuild (idempotent), mirroring the main-menu nav-drag persistence idiom.
  function ccIslKey(el) { return el && el.getAttribute ? el.getAttribute("data-cc-chip") : null; }
  function ccIslandOrderRead() { try { var o = JSON.parse(g("cc.isl.order", "null")); if (o && o.length === 3) return o; } catch (e) {} return null; }
  function ccIslandSaveOrder() {
    try {
      if (!ccIslRows) return;
      var o = [[], [], []];
      for (var r = 0; r < 3; r++) { var ch = ccIslRows[r].querySelectorAll(":scope > .cc-isl-chip"); for (var i = 0; i < ch.length; i++) { var k = ccIslKey(ch[i]); if (k) o[r].push(k); } }
      localStorage.setItem("cc.isl.order", JSON.stringify(o));
    } catch (e) {}
  }
  function ccIslandArrange() {
    try {
      if (!ccIslRows) return;
      var order = ccIslandOrderRead();
      if (!order) {
        // no saved arrangement -> a sensible DEFAULT: spread the chips evenly across the 3 rows. Now that the
        // rows can be full-header wide (user: free arrangement), leaving everything in row 0 would collapse the
        // island to ONE long line; an even split keeps the familiar compact 3-row block until the user arranges.
        var chips0 = ccIslRows[0].querySelectorAll(":scope > .cc-isl-chip"), n = chips0.length;
        if (n) { var per = Math.ceil(n / 3); for (var d = 0; d < n; d++) { var rr = Math.min(2, Math.floor(d / per)); if (rr > 0) ccIslRows[rr].appendChild(chips0[d]); } }
        return;
      }
      var byKey = {}, all = ccIslRows[0].querySelectorAll(":scope > .cc-isl-chip");
      for (var i = 0; i < all.length; i++) { var k = ccIslKey(all[i]); if (k && !byKey[k]) byKey[k] = all[i]; }
      for (var r = 0; r < 3; r++) { var list = order[r] || []; for (var j = 0; j < list.length; j++) { var el = byKey[list[j]]; if (el) { ccIslRows[r].appendChild(el); delete byKey[list[j]]; } } }
    } catch (e) {}   // keys not present are skipped; chips in no saved list stay in row 0
  }
  function ccIslandDropTarget(x, y) {
    if (!ccIslRows) return null;
    var row = null, best = 1e9;
    for (var r = 0; r < 3; r++) { var rr = ccIslRows[r].getBoundingClientRect(); if (rr.height && y >= rr.top - 8 && y <= rr.bottom + 8) { row = ccIslRows[r]; break; } var mid = rr.height ? (rr.top + rr.bottom) / 2 : ccIslRows[0].getBoundingClientRect().top; var d = Math.abs(y - mid); if (d < best) { best = d; row = ccIslRows[r]; } }
    if (!row) row = ccIslRows[0];
    var chips = row.querySelectorAll(":scope > .cc-isl-chip"), before = null;
    for (var i = 0; i < chips.length; i++) { if (chips[i] === ccIslDragged) continue; var cr = chips[i].getBoundingClientRect(); if (x < cr.left + cr.width / 2) { before = chips[i]; break; } }
    return { row: row, before: before };
  }
  function ccWireIslandDrag() {
    try {
      if (!ccIslRows) return;
      var chips = document.querySelectorAll("#cc-island .cc-isl-chip");
      for (var i = 0; i < chips.length; i++) {
        (function (c) {
          if (c.getAttribute("data-cc-idrag") === "1") return; c.setAttribute("data-cc-idrag", "1");
          c.addEventListener("pointerdown", function (e) {   // #Drag-Umbau: LOCKED = click jumps to the page; ARRANGE (cc-arrange) = drag immediately
            if (e.button !== 0) return;
            if (!document.documentElement.classList.contains("cc-arrange")) return;   // locked -> the chip click navigates
            ccIslPressXY = { x: e.clientX, y: e.clientY }; ccIslPressPtr = e.pointerId; ccIslMoved = false;
            ccIslDragged = c; c.classList.add("cc-isl-dragging");
            var isle = document.getElementById("cc-island"); if (isle) isle.classList.add("cc-isl-arranging");
            try { c.setPointerCapture(ccIslPressPtr); } catch (e2) {}
            e.preventDefault();
          });
        })(chips[i]);
      }
      if (!ccIslDragBound) {
        ccIslDragBound = true;
        document.addEventListener("pointermove", function (e) {
          if (ccIslPressXY && !ccIslDragged) { if (Math.abs(e.clientX - ccIslPressXY.x) > 8 || Math.abs(e.clientY - ccIslPressXY.y) > 8) { clearTimeout(ccIslHold); ccIslHold = null; ccIslPressXY = null; } return; }
          if (!ccIslDragged) return;
          ccIslMoved = true;
          var t = ccIslandDropTarget(e.clientX, e.clientY);
          if (t && t.row) { if (t.before) t.row.insertBefore(ccIslDragged, t.before); else t.row.appendChild(ccIslDragged); }
        });
        var up = function () {
          clearTimeout(ccIslHold); ccIslHold = null; ccIslPressXY = null;
          if (ccIslDragged) { try { ccIslDragged.releasePointerCapture(ccIslPressPtr); } catch (e) {} ccIslDragged.classList.remove("cc-isl-dragging"); var isle = document.getElementById("cc-island"); if (isle) isle.classList.remove("cc-isl-arranging"); if (ccIslMoved) { ccIslandSaveOrder(); ccIslSuppressClick = true; } ccIslDragged = null; }
        };
        document.addEventListener("pointerup", up);
        document.addEventListener("pointercancel", up);
        // V-C: click a chip -> jump to its page (suppressed on the click that follows a drag)
        document.addEventListener("click", function (e) {
          var chip = e.target && e.target.closest ? e.target.closest("#cc-island .cc-isl-chip") : null;
          if (!chip) return;
          if (ccIslSuppressClick) { ccIslSuppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
          var key = ccIslKey(chip);
          // #12: the net chip is a unit toggle, not a nav target — flip Bit<->Byte, persist, repaint in place
          if (key === "net") { localStorage.setItem("cc.isl.net.unit", g("cc.isl.net.unit", "bit") === "bit" ? "byte" : "bit"); ccIslandSig = ""; ccIsland(); e.preventDefault(); e.stopPropagation(); return; }
          var url = key ? (CC_ISL_NAV[key] || (/^temp/.test(key) ? "/Dashboard" : null)) : null;
          if (url) location.href = url;
        }, true);
      }
    } catch (e) {}
  }
  // #16 (user: "Zustandsanzeigen native Zustandsfarbe ODER in den Farbmodus integriert"): the /Main
  // array/pool usage bars (.usage-disk > span:first-child, coloured with the accent by the sheets) get
  // their fill-LEVEL semantic colour (green <80% / amber <95% / red ≥95%, same thresholds as the island
  // fill chip) when cc.statenative is ON. OFF -> remove the inline colour so the palette (accent/rainbow/
  // flag) shows through. The fill % lives in the span's inline width. Runs from apply() (load + storage).
  function ccStateBars() {
    try {
      // #2 (user): "native state colours" ON -> the /Main usage bars keep the semantic green/amber/red by
      // fill level; OFF (default) -> they follow the colour mode via CSS. Unraid 7.3.x no longer stamps the
      // native greenbar/orangebar/redbar class, so we assign our OWN cc-fill-{green,amber,red} class (CSS
      // colours it) instead of writing inline — CLASS-based + idempotent = the native table re-render can't
      // make it flicker. CRUCIAL: BOTH the BENUTZT and the FREI bar of a row are coloured by the USED %, so a
      // nearly-EMPTY disk (its free bar ~98% wide) stays GREEN, not red ("leere Platte = roter Balken" bug).
      var on = g("cc.statenative", "0") === "1" && g("cc.theming", "1") !== "0";
      var allBars = document.querySelectorAll(".usage-disk:not(.sys):not(.mm) > span:first-child");
      if (!on) {   // integrated: strip any lingering semantic class/inline -> the CSS colour mode shows through
        for (var i = 0; i < allBars.length; i++) { var b = allBars[i]; if (b.style.background) b.style.removeProperty("background"); if (b.className && b.className.indexOf("cc-fill-") >= 0) b.className = b.className.replace(/\s*cc-fill-(green|amber|red)\b/g, ""); }
        return;
      }
      var trs = document.querySelectorAll("table.unraid.disk_status tr");
      for (var t = 0; t < trs.length; t++) {
        var bars = trs[t].querySelectorAll(".usage-disk:not(.sys):not(.mm) > span:first-child");
        if (!bars.length) continue;
        var usedW = parseFloat(bars[0].style.width) || 0;   // FIRST bar in the row = BENUTZT -> its % is the disk's fill state
        var cls = usedW >= 95 ? "cc-fill-red" : usedW >= 80 ? "cc-fill-amber" : "cc-fill-green";
        for (var k = 0; k < bars.length; k++) { if (!bars[k].classList.contains(cls)) { bars[k].classList.remove("cc-fill-green", "cc-fill-amber", "cc-fill-red"); bars[k].classList.add(cls); } }
      }
    } catch (e) {}
  }
  // #(user: "das Menue in den CC-Style uebernehmen. Infotext in Infobubble"): the account popover (Lizenz
  // verwalten / Auf Updates pruefen / Konto / Einstellungen) mounts fresh on every open. Tag it so the CC sheet
  // styles it (elevated card + colour-mode item hover), and fold any plain description <li> (no icon/link) onto a
  // CC (i) bubble on the item above it, hiding the inline paragraph — the bubble rides the document-wide cc-tipfloat.
  function ccAcctMenu() {
    try {
      // #(user: "bei Klick auf den Hilfebutton passiert nichts"): the (i) is a CLICK button, NOT a hover tooltip.
      // Bind ONCE a document-capture click handler: clicking a .cc-acctinfo toggles a pinned info bubble
      // (#cc-acctinfo-pop) with its help text; clicking the same (i) again, or anywhere outside, dismisses it.
      // stopPropagation on the (i) keeps the reka menu open and stops the row from navigating.
      if (!document.__ccAcctInfoBound) {
        document.__ccAcctInfoBound = true;
        document.addEventListener("click", function (e) {
          var icon = e.target && e.target.closest ? e.target.closest(".cc-acctinfo") : null;
          var pop = document.getElementById("cc-acctinfo-pop");
          if (icon) {
            e.preventDefault(); e.stopPropagation();
            var same = pop && pop.getAttribute("data-src") === (icon.getAttribute("data-cc-info") || "");
            if (pop) pop.remove();
            if (same) return;                                             // second click on the same (i) closes it
            pop = document.createElement("div"); pop.id = "cc-acctinfo-pop";
            pop.textContent = icon.getAttribute("data-cc-info") || "";
            pop.setAttribute("data-src", icon.getAttribute("data-cc-info") || "");
            document.body.appendChild(pop);
            var r = icon.getBoundingClientRect(), w = pop.offsetWidth, vw = window.innerWidth || document.documentElement.clientWidth;
            pop.style.left = Math.max(8, Math.min(vw - 8 - w, r.left + r.width / 2 - w / 2)) + "px";
            pop.style.top = (r.bottom + 8) + "px";
            return;
          }
          if (pop && !(e.target.closest && e.target.closest("#cc-acctinfo-pop"))) pop.remove();   // click elsewhere dismisses
        }, true);
      }
      var menus = document.querySelectorAll('div[role="menu"].bg-popover');
      for (var m = 0; m < menus.length; m++) {
        var menu = menus[m];
        menu.classList.add("cc-acctmenu");
        if (menu.getAttribute("data-cc-acct") === "1") continue;
        menu.setAttribute("data-cc-acct", "1");
        var lis = menu.querySelectorAll("li");
        for (var i = 0; i < lis.length; i++) {
          var li = lis[i];
          if (li.querySelector("svg, a, button, input")) continue;         // an action row, not a description
          var txt = (li.textContent || "").trim();
          if (txt.length < 12) continue;                                    // too short to be a description
          var prev = li.previousElementSibling;
          var host = prev ? (prev.querySelector("span, a") || prev) : null;
          if (host && !host.querySelector(".cc-acctinfo")) {
            var ic = document.createElement("span");
            ic.className = "cc-acctinfo"; ic.textContent = "ⓘ";            // circled i — a CLICK help button
            ic.setAttribute("role", "button"); ic.tabIndex = 0; ic.setAttribute("aria-label", txt);
            ic.setAttribute("data-cc-info", txt);                          // the help text the click bubble shows
            host.appendChild(ic);
            li.style.display = "none";
          }
        }
      }
    } catch (e) {}
  }
  // #3/#8 (user: in rainbow mode ADJACENT buttons/toggles get DIFFERENT palette colours, not one blue).
  // Stamp a per-element rotating palette colour (--cc-rb-c) on each CC-themed native button (rotated within
  // its own row) and each tools/settings toggle (rotated across the page). The CSS reads
  // var(--cc-rb-c, var(--cc-rbaccent, <accent>)) so a single element still falls back to the one accent.
  function ccPaintRotate() {
    try {
      var on = g("cc.theming", "1") !== "0" && rbOn();
      // #1 CORRECTION (user): in the REACTIVE sub-mode the dropdown OPTIONS must rest neutral and reveal their
      // own colour ONLY on hover (they used to stay permanently coloured). Gate a class the Tools sheet keys off.
      document.documentElement.classList.toggle("cc-tools-rbneutral", on && rbNeutral());
      var stamp = function (el, ix) { var c = rbColor(ix); el.style.setProperty("--cc-rb-c", c, "important"); el.style.setProperty("--cc-rb-ct", idealText(c), "important"); };
      var clear = function (el) { el.style.removeProperty("--cc-rb-c"); el.style.removeProperty("--cc-rb-ct"); };
      var BSEL = "html.cc-tools-on #displaybox input[type=button], html.cc-tools-on #displaybox input[type=submit], html.cc-tools-on #displaybox button:not([role=tab]):not(.cc-tgl), html.cc-tools-on #displaybox a.button, html.cc-shares-on #displaybox #compute-shares, html.cc-shares-on #displaybox #compute-disks, html.cc-shares-on #displaybox #cleanup-button, html.cc-shares-on #displaybox form[name=\"share_form\"] input[type=submit], html.cc-vms-on #displaybox input[type=button]:not(.cc-actbtn), html.cc-vms-on #displaybox input[type=submit]:not(.cc-actbtn)";
      var btns = document.querySelectorAll(BSEL);
      if (!on) { for (var i0 = 0; i0 < btns.length; i0++) clear(btns[i0]); }
      else {
        // group by VISUAL ROW (rounded top) so buttons sitting next to each other rotate through the
        // palette even when they live in different DOM parents (e.g. Standard vs Anwenden/Fertig).
        var rows = {};
        for (var i = 0; i < btns.length; i++) { var rct = btns[i].getBoundingClientRect(); if (!rct.width) { clear(btns[i]); continue; } var key = Math.round(rct.top / 6); if (rows[key] == null) rows[key] = 0; stamp(btns[i], rows[key]++); }
      }
      // toggles AND dropdowns (#1) on tools/settings pages -> rotate across the page so no two read the same
      // colour (the CC-tsel dropdown box + selected chip follow --cc-rb-c, inherited from the .cc-tsel wrapper).
      var tgls = document.querySelectorAll("html.cc-tools-on #displaybox .cc-tgl, html.cc-tools-on #displaybox .switch-button-background, html.cc-tools-on #displaybox .cc-tsel, html.cc-tools-on #displaybox .ui-dropdownchecklist-selector-wrapper, html.cc-diskpage #displaybox h3.section-header");   // #(user: "alle Badges in die Farbmodi"): the Boot-Parameters section badges rotate too
      for (var t = 0; t < tgls.length; t++) { if (!on) clear(tgls[t]); else stamp(tgls[t], t); }
      // #1 (user): each dropdown OPTION gets its OWN palette slot — rotate WITHIN each panel so the open list
      // reads as a rainbow of items (the trigger itself stays neutral until hover; see Tools.css). Covers the CC
      // overlay dropdown (.cc-tsel-panel/.cc-tsel-opt) AND the jQuery dropdownchecklist (Notification-agent lists).
      var panels = document.querySelectorAll("html.cc-tools-on #displaybox .cc-tsel-panel, html.cc-tools-on #displaybox .ui-dropdownchecklist-dropcontainer");
      for (var pn = 0; pn < panels.length; pn++) { var opts = panels[pn].querySelectorAll(".cc-tsel-opt, .ui-dropdownchecklist-item"); for (var oi = 0; oi < opts.length; oi++) { if (!on) clear(opts[oi]); else stamp(opts[oi], oi); } }
      // #5 (user: "alle Badges in die Farbmodi aufnehmen"): the notification-drawer badges rotate through the palette
      // too (tabs, type filters, gear, the bulk-action icons, and the per-card Anzeigen/Archiv buttons). The delete
      // icon stays semantic red (handled in CSS). In the REACTIVE sub-mode the sheet keys off cc-header-rbneutral to
      // rest neutral + reveal --cc-rb-c on hover.
      var nd = document.querySelector(".unapi div.fixed.z-50.bg-background");
      if (nd) {
        var ndb = nd.querySelectorAll('[role="tab"], [role="button"][aria-pressed]:not(.cc-notif-badge), .shrink-0 > a[href*="Notification"], .cc-notif-arch, .cc-notif-del, [class~="group/item"] a[class*="text-primary"], [class~="group/item"] span[class*="rounded-md"][class*="inline-flex"]');   // #(user: "Löschen-Button viel schwächer eingefärbt"): stamp delete too so it rotates like archive
        for (var di = 0; di < ndb.length; di++) { if (!on) clear(ndb[di]); else stamp(ndb[di], di); }
      }
      // #(user: "die Listen in den Disk-Subtabs mit abwechselnder Hoverfarbe im Rainbow-Modus"): a rotated palette
      // colour per table ROW so each reveals its own colour on hover (Tools.css keys tbody tr:hover off --cc-rb-c).
      var dtr = document.querySelectorAll("html.cc-diskpage #displaybox table.unraid tbody tr");
      for (var dr2 = 0; dr2 < dtr.length; dr2++) { if (!on) clear(dtr[dr2]); else stamp(dtr[dr2], dr2); }
      // #(user: "die Buttons in der Boot-Parameters-Menueansicht sind nicht in den Farbmodi"): the clickable
      // .parameter-code chips (the kernel arg each option inserts) never got a palette slot, so they stayed flat
      // grey while every other button rotated. Stamp them across the page like the action buttons.
      var pcodes = document.querySelectorAll("html.cc-diskpage #displaybox .parameter-code");
      for (var pc = 0; pc < pcodes.length; pc++) { if (!on) clear(pcodes[pc]); else stamp(pcodes[pc], pc); }
      // #(user: "das Menue in den CC-Style"): the account popover items rotate too so each reveals its own colour on hover.
      var amItems = document.querySelectorAll('div[role="menu"].bg-popover li > span, div[role="menu"].bg-popover li > a');
      for (var am = 0; am < amItems.length; am++) { if (!on) clear(amItems[am]); else stamp(amItems[am], am); }
    } catch (e) {}
  }
  // #(user chose "JS-Reinit"): the SMB "copy settings" dropdownchecklist widgets are built by Unraid while their
  // reka tab is still HIDDEN (selector width 0), so the jQuery plugin sizes their drop panel to ~0 and the list
  // never opens. Once the tab is visible, destroy + re-create each widget ONCE so it measures the real selector —
  // then the list opens normally. Guarded per widget (data-cc-dclfixed) so it runs a single time after the tab shows.
  function ccFixSmbDcl() {
    try {
      var jq = window.jQuery; if (!jq || !jq.fn || typeof jq.fn.dropdownchecklist !== "function") return;
      var ws = document.querySelectorAll('#displaybox span.ui-dropdownchecklist[id^="ddcl-"]');
      for (var i = 0; i < ws.length; i++) {
        var w = ws[i];
        if (w.getAttribute("data-cc-dclfixed") === "1") continue;
        var selr = w.querySelector(".ui-dropdownchecklist-selector");
        if (!selr || selr.getBoundingClientRect().width < 5) continue;   // only once the tab is really on screen
        var selId = w.id.replace(/^ddcl-/, ""), selEl = document.getElementById(selId); if (!selEl) continue;
        var empty = (selr.textContent || "").trim() || "...", wdt = Math.max(110, Math.round(selr.getBoundingClientRect().width));
        var $sel = jq(selEl);
        try { $sel.dropdownchecklist("destroy"); } catch (e1) {}
        try { $sel.dropdownchecklist({ emptyText: empty, firstItemChecksAll: true, explicitClose: T("...schließen", "...close"), width: wdt }); } catch (e2) {}
        var nw = document.getElementById("ddcl-" + selId); if (nw) nw.setAttribute("data-cc-dclfixed", "1");
      }
    } catch (e) {}
  }
  // The /Main disk tables, settings forms and button rows are AJAX-rendered AFTER apply() runs, so the
  // one-shot paint missed them (usage bars stayed uncoloured, buttons/toggles un-rotated). Watch #displaybox
  // (childList only -> our own inline style/attr writes never re-trigger it) and re-run the paints debounced.
  var ccMainObs = null, ccMainT = null, ccTabPaintBound = false;
  function ccWatchMain() {
    try {
      if (ccMainObs) return;
      var box = document.getElementById("displaybox"); if (!box) return;
      ccMainObs = new MutationObserver(function (recs) {
        // #33 (user: "Docker/VM/Plugin-Tab lädt drastisch langsam"): this observer's own work
        // (ccStateBars/ccPaintRotate/ccToolsEnhance) is only ever relevant on /Main's disk table or a
        // cc-tools-on settings form — but it was armed unconditionally on EVERY page via apply(), so
        // Docker's/VMs'/Plugins' own heavy per-row DOM churn (badge stamping, action-cell rebuilds, up to
        // 100+ mutations per native table refresh) woke this callback too, adding a synchronous
        // closest()-per-record scan plus a batch of document-wide querySelectorAll calls on top of work
        // that was already the bottleneck. None of that page's mutations could ever match, so bail before
        // touching a single record — cheap on every page, and a true no-op exactly where it matters most.
        if (!document.querySelector("table.unraid.disk_status") && !document.documentElement.classList.contains("cc-tools-on")) return;
        // #13 (user: fill bars BLINK when "native state colours" is on): Unraid WHOLESALE-replaces the /Main
        // disk table every nchan tick, so the fresh bars briefly show the base colour until the debounced
        // pass re-classes them = the blink. Re-class them SYNCHRONOUSLY here (a MutationObserver callback is a
        // microtask that runs AFTER Unraid's .html() but BEFORE the next paint), so the semantic cc-fill class
        // is on the new bars before they ever paint. ccStateBars only writes classList (no childList) -> no loop.
        for (var i = 0; i < recs.length; i++) { var t2 = recs[i].target; if (t2 && t2.closest && t2.closest("table.unraid.disk_status")) { try { ccStateBars(); } catch (e3) {} break; } }
        if (ccMainT) return; ccMainT = setTimeout(function () { ccMainT = null; try { ccStateBars(); ccPaintRotate(); ccToolsEnhance(); } catch (e2) {} }, 120);
      });
      ccMainObs.observe(box, { childList: true, subtree: true });
      // #(user: "alle Buttons und Badges in die Farbmodi"): a reka SUB-TAB switch only toggles display (an
      // attribute change the childList observer above deliberately ignores to avoid a paint loop), so the
      // freshly-shown panel's buttons/badges never got their rotating --cc-rb-c. Re-run the paints shortly
      // after any sub-tab click so the now-visible controls pick up their palette slot.
      if (!ccTabPaintBound) {
        ccTabPaintBound = true;
        document.addEventListener("click", function (e) {
          var t = e.target && e.target.closest ? e.target.closest('#displaybox nav.tabs button[role="tab"], #displaybox .tabs-container button[role="tab"]') : null;
          if (t) {
            setTimeout(function () { try { ccPaintRotate(); ccToolsEnhance(); ccFixSmbDcl(); } catch (er) {} }, 70);
            setTimeout(function () { try { ccFixSmbDcl(); } catch (er2) {} }, 400);   // backup once the reka tab is fully on screen
          }
        }, true);
      }
    } catch (e) {}
  }
  // #6 (user: "die Texte in der Infobubble sind nicht in der richtigen Sprache"): Unraid's DisplaySettings
  // help strings are server-rendered and its German language pack leaves several of them ENGLISH. CC carries
  // a DE map for those native strings, matched on the whitespace-normalised English text and applied only
  // when the UI language is German. Any string not in the map falls back to the native (server) text.
  var CC_HELP_DE = {
    "Boxed is the legacy setting which constrains the content width to maximum 1920 pixels Unlimited allows content to use all available width, which maybe useful on wide screens":
      "Boxed ist die alte Einstellung, die die Inhaltsbreite auf maximal 1920 Pixel begrenzt. Unlimited erlaubt dem Inhalt, die gesamte verfügbare Breite zu nutzen, was auf breiten Bildschirmen nützlich sein kann.",
    "Changes the font size of terminal windows.":
      "Ändert die Schriftgröße von Terminalfenstern.",
    "Changes how certain pages are displayed. In Tabbed mode different sections will be displayed in different tabs, while in Non-tabbed mode sections are displayed under each other.":
      "Ändert, wie bestimmte Seiten dargestellt werden. Im Reiter-Modus werden verschiedene Abschnitte in verschiedenen Reitern angezeigt, im Nicht-Reiter-Modus untereinander.",
    "The Users Menu can be part of the header or part of the Settings menu. You can move the Users Menu if insufficient space in the header is available to display all menus.":
      "Das Benutzermenü kann Teil der Kopfzeile oder des Einstellungsmenüs sein. Du kannst das Benutzermenü verschieben, wenn in der Kopfzeile nicht genug Platz für alle Menüs ist.",
    "Automatic : long listings are displayed as is, and the user needs to scroll the whole page to see the bottom Fixed : long listings are displayed in a window with a fixed size, user can scroll this window to see the bottom":
      "Automatisch: Lange Listen werden vollständig angezeigt, man muss die ganze Seite scrollen, um das Ende zu sehen. Fest: Lange Listen erscheinen in einem Fenster fester Größe, das man separat scrollen kann.",
    "Enables favorite support. If set to no, will stop heart icon showing for additions. If existing favorites are saved, favorites tab and pre-saved options will still continue to show and function until all are deleted.":
      "Aktiviert Favoriten. Bei „Nein\" wird das Herz-Symbol nicht mehr angezeigt. Bereits gespeicherte Favoriten und der Favoriten-Reiter bleiben sichtbar und funktionsfähig, bis alle gelöscht sind."
  };
  function ccTransHelp(txt) {
    try { if (LANG !== "de") return txt; var k = (txt || "").replace(/\s+/g, " ").trim(); return CC_HELP_DE[k] || txt; } catch (e) { return txt; }
  }
  // #7 (user: "die Dropdownlisten sind nicht im CC-Style"): on cc-tools-on pages, replace the native <select>
  // with the SAME CC overlay dropdown the docker Add-Container form uses (docker.js/ctWrapSelect), ported here
  // as cc-tsel with distinct names so nothing else unwraps it. The real <select> stays hidden as the form
  // value; a click writes selectedIndex back + dispatches change so native onchange chains still fire. The
  // panel is position:fixed (escapes overflow clipping) and flips upward when there's more room above.
  function ccMkEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var ccTselDocBound = false;
  function ccBindTselDoc() {
    if (ccTselDocBound) return; ccTselDocBound = true;
    document.addEventListener("click", function (e) {
      var open = document.querySelectorAll(".cc-tsel.cc-open"); if (!open.length) return;
      for (var i = 0; i < open.length; i++) { if (!open[i].contains(e.target)) open[i].classList.remove("cc-open"); }
    });
    window.addEventListener("scroll", function () { var o = document.querySelectorAll(".cc-tsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); }, true);
  }
  function ccPositionTsel(trig, panel) {
    try {
      var r = trig.getBoundingClientRect(), gap = 4, edge = 14, ox = 0, oy = 0, cbBottom = window.innerHeight;
      for (var pe = panel.parentElement; pe && pe.nodeType === 1 && pe !== document.documentElement; pe = pe.parentElement) {
        var pcs = getComputedStyle(pe);
        if (pcs.transform !== "none" || pcs.perspective !== "none" || (pcs.filter && pcs.filter !== "none")) { var pr = pe.getBoundingClientRect(); ox = pr.left; oy = pr.top; cbBottom = pr.bottom; break; }
      }
      var below = window.innerHeight - r.bottom - edge, above = r.top - edge;
      panel.style.position = "fixed"; panel.style.boxSizing = "border-box";
      panel.style.left = Math.round(r.left - ox) + "px"; panel.style.minWidth = Math.round(r.width) + "px"; panel.style.maxWidth = "min(92vw, 480px)";
      if (below >= 200 || below >= above) { panel.style.top = Math.round(r.bottom + gap - oy) + "px"; panel.style.bottom = "auto"; panel.style.maxHeight = Math.max(140, below - gap) + "px"; }
      else { panel.style.bottom = Math.round(cbBottom - r.top + gap) + "px"; panel.style.top = "auto"; panel.style.maxHeight = Math.max(140, above - gap) + "px"; }
    } catch (e) {}
  }
  // /Apps/ca_settings button rows (user: "Anwenden und Fertig in eine Zeile, Download Log und
  // Hilfeforen-Badge in eine zweite Zeile"). CA emits ANWENDEN/FERTIG/DOWNLOAD LOG inside one <span> and the
  // help link in a separate <center>; two elements in different parents can never share a flex line, so the
  // one that has to change rows is MOVED. Idempotent: it only acts while the button is still in the span,
  // and this page is a plain form render — nothing rebuilds it underneath us.
  function ccCaSettingsRows() {
    try {
      if (!/^\/Apps\/ca_settings/i.test(location.pathname)) return;
      var box = document.getElementById("displaybox"); if (!box) return;
      var host = box.querySelector("center"); if (!host) return;
      var btns = box.querySelectorAll('span > input[type="button"]');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i], v = (b.value || "").toUpperCase();
        if (v.indexOf("LOG") < 0) continue;              // only DOWNLOAD LOG joins the help link
        if (b.parentElement === host) continue;           // already moved -> no-op
        host.insertBefore(b, host.firstChild);
      }
      // #3: both button rows line up with the TOGGLES (user: "die Buttons unten an den Toggles ausrichten").
      // The two rows sit in different parents (a <span> inside the form, a <center> outside the dl grid), so
      // one shared indent can't work: measured live they started at 767 and 626 while the toggle column
      // starts at 847. Measure the control edge once and push each row to it individually — self-correcting,
      // so it survives a language change, another font size or a longer label.
      // A yes/no <select> that ccToolsWrapSelect turned into a .cc-tgl pill stays in the DOM (display:none)
      // right where it was, i.e. BEFORE its own pill in document order — so a plain querySelector() over
      // ".cc-tgl, .cc-tsel, input, select" can land on that hidden select first (zero rect, cx=0), which
      // silently breaks the whole measurement (verified live: 0 vs the real column at 1107px). Skip anything
      // with no rendered box and take the first control that's actually visible.
      var ctrlCands = box.querySelectorAll("dd .cc-tgl, dd .cc-tsel, dd input, dd select"), ctrl = null;
      for (var cc = 0; cc < ctrlCands.length; cc++) {
        var ccRect = ctrlCands[cc].getBoundingClientRect();
        if (ccRect.width > 0 || ccRect.height > 0) { ctrl = ctrlCands[cc]; break; }
      }
      if (ctrl) {
        var cx = ctrl.getBoundingClientRect().left;
        var rows = [];
        var sub = box.querySelector('form span:has(> input[type="submit"])'); if (sub) rows.push(sub);
        if (host) rows.push(host);
        // Probe, don't assume 1:1: the "Anwenden/Fertig" span sits inside a shrink-wrapped ancestor
        // that keeps ITSELF centred, so growing the span via padding-left also widens that ancestor,
        // which re-centres and eats HALF of every pixel of padding (measured live: 100px of padding
        // only ever moved the button 50px — the CA "DOWNLOAD LOG" row has no such ancestor and takes
        // padding 1:1). Rather than hard-code which row is which, measure the real px-of-content-shift
        // per px-of-padding with a small probe write and solve for the padding that closes the exact
        // remaining gap — correct for either layout, and for any future CC/CA markup change too.
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          row.style.setProperty("padding-left", "0px", "important");
          var c0 = row.getBoundingClientRect().left;
          var PROBE = 100;
          row.style.setProperty("padding-left", PROBE + "px", "important");
          var cP = row.getBoundingClientRect().left + PROBE;
          var slope = (cP - c0) / PROBE;                    // px of actual shift per px of padding
          var pad = slope > 0.05 ? Math.round((cx - c0) / slope) : 0;
          if (pad > 0 && pad < 2400) row.style.setProperty("padding-left", pad + "px", "important");
          else row.style.removeProperty("padding-left");
        }
      }
    } catch (e) {}
  }
  function ccToolsSyncSel(sel) {
    var w = sel.parentNode; if (!w || !w.classList || !w.classList.contains("cc-tsel")) return;
    w.classList.toggle("cc-tsel-disabled", !!sel.disabled);
    var t2 = w.querySelector(".cc-tsel-trigger"), c = w.querySelectorAll(".cc-tsel-opt");
    var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
    if (t2 && t2.textContent !== label) t2.textContent = label;
    for (var k = 0; k < c.length; k++) { var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue; if (c[k].textContent !== o.text) c[k].textContent = o.text; c[k].classList.toggle("is-selected", o.selected); c[k].classList.toggle("is-disabled", !!o.disabled); c[k].setAttribute("aria-selected", o.selected ? "true" : "false"); }
  }
  function ccToolsWrapSelect(sel) {
    if (sel.getAttribute("data-cc-tsel") || sel.getAttribute("data-cc-tgl")) return;   // already ours / a yes-no toggle (#24)
    if (sel.multiple || (sel.size && sel.size > 1) || sel.options.length < 1) return;   // multi / list-box stay native
    sel.setAttribute("data-cc-tsel", "1");
    var wrap = ccMkEl("span", "cc-tsel"); sel.parentNode.insertBefore(wrap, sel);
    sel.style.display = "none"; wrap.appendChild(sel);
    var trig = ccMkEl("span", "cc-tsel-trigger"); wrap.appendChild(trig);
    // V-E A11y: the trigger is a listbox button; the panel is a listbox; each chip is an option
    trig.setAttribute("role", "button"); trig.setAttribute("tabindex", "0"); trig.setAttribute("aria-haspopup", "listbox"); trig.setAttribute("aria-expanded", "false");
    var lid = "cc-tsel-lb-" + (ccTselSeq++); trig.setAttribute("aria-controls", lid);
    if (sel.id || sel.name) trig.setAttribute("aria-label", (function () { var lab = sel.closest && sel.closest("dd") ? (sel.closest("dd").previousElementSibling || {}).textContent : ""; return (lab || sel.name || sel.id || "").replace(/\s*:\s*$/, "").trim() || "Auswahl"; })());
    var panel = ccMkEl("div", "cc-tsel-panel"); wrap.appendChild(panel);
    panel.setAttribute("role", "listbox"); panel.id = lid;
    var lastGroup = null;
    for (var k = 0; k < sel.options.length; k++) {
      var o = sel.options[k], gl = o.parentNode && o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : null;
      if (gl && gl !== lastGroup) { var grp = ccMkEl("div", "cc-tsel-group", gl); grp.setAttribute("role", "presentation"); panel.appendChild(grp); lastGroup = gl; }
      var chip = ccMkEl("div", "cc-tsel-opt", o.text); chip.setAttribute("data-i", k);
      chip.setAttribute("role", "option"); chip.setAttribute("aria-selected", o.selected ? "true" : "false"); chip.setAttribute("tabindex", "-1");
      var pick = (function (idx) { return function (ev) { ev.stopPropagation(); if (sel.options[idx].disabled) return; sel.selectedIndex = idx; sel.dispatchEvent(new Event("change", { bubbles: true })); ccToolsSyncSel(sel); wrap.classList.remove("cc-open"); trig.setAttribute("aria-expanded", "false"); trig.focus(); }; })(k);
      chip.addEventListener("click", pick);
      chip.addEventListener("keydown", (function (fn) { return function (e2) { if (e2.key === "Enter" || e2.key === " ") { e2.preventDefault(); fn(e2); } else if (e2.key === "ArrowDown" || e2.key === "ArrowUp") { e2.preventDefault(); ccTselMove(panel, e2.target, e2.key === "ArrowDown" ? 1 : -1); } else if (e2.key === "Escape") { wrap.classList.remove("cc-open"); trig.setAttribute("aria-expanded", "false"); trig.focus(); } }; })(pick));
      panel.appendChild(chip);
    }
    function openPanel() { var o2 = document.querySelectorAll(".cc-tsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) { o2[j].classList.remove("cc-open"); var t3 = o2[j].querySelector(".cc-tsel-trigger"); if (t3) t3.setAttribute("aria-expanded", "false"); } wrap.classList.add("cc-open"); trig.setAttribute("aria-expanded", "true"); ccPositionTsel(trig, panel); }
    trig.addEventListener("click", function (ev) { ev.stopPropagation(); if (sel.disabled) return; ccToolsSyncSel(sel); if (wrap.classList.toggle("cc-open")) { trig.setAttribute("aria-expanded", "true"); var o2 = document.querySelectorAll(".cc-tsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) { o2[j].classList.remove("cc-open"); var t3 = o2[j].querySelector(".cc-tsel-trigger"); if (t3) t3.setAttribute("aria-expanded", "false"); } ccPositionTsel(trig, panel); } else trig.setAttribute("aria-expanded", "false"); });
    trig.addEventListener("keydown", function (e2) {
      if (sel.disabled) return;
      if (e2.key === "Enter" || e2.key === " " || e2.key === "ArrowDown") { e2.preventDefault(); ccToolsSyncSel(sel); openPanel(); var first = panel.querySelector(".cc-tsel-opt.is-selected") || panel.querySelector(".cc-tsel-opt:not(.is-disabled)"); if (first) first.focus(); }
      else if (e2.key === "Escape") { wrap.classList.remove("cc-open"); trig.setAttribute("aria-expanded", "false"); }
    });
    ccToolsSyncSel(sel);
    ccBindTselDoc();
  }
  var ccTselSeq = 0;
  // V-E: roving focus between option chips (skips group headers + disabled)
  function ccTselMove(panel, cur, dir) {
    var opts = Array.prototype.filter.call(panel.querySelectorAll(".cc-tsel-opt"), function (o) { return !o.classList.contains("is-disabled"); });
    var i = opts.indexOf(cur); if (i < 0) i = 0; else i = (i + dir + opts.length) % opts.length;
    if (opts[i]) opts[i].focus();
  }
  // #2 (user: "Banner und Favoriten Toggle sind unwirksam"): native /Settings/* apply on FORM SUBMIT, not on
  // `change` — so a CC toggle/dropdown flip has NO live effect until "Anwenden". Persist the single changed
  // field the way native Apply does (POST it to /update.php with the form's #file/#section + csrf_token), then
  // reload so the effect shows — the same mechanism CC's own settings.js already proves works for these fields.
  function ccApplyToolsSel(sel) {
    try {
      if (!sel || !sel.name || typeof window.csrf_token === "undefined") return;
      var form = sel.closest ? sel.closest("form") : null;
      var fEl = form && form.querySelector('[name="#file"]'), sEl = form && form.querySelector('[name="#section"]');
      var fd = new URLSearchParams();
      fd.append("#file", (fEl && fEl.value) || "dynamix/dynamix.cfg");
      fd.append("#section", (sEl && sEl.value) || "display");
      fd.append("csrf_token", window.csrf_token);
      fd.append(sel.name, sel.value);
      // #3 (user): couple native settings that ALSO have a CC counterpart, so the CC side is kept in step and
      // doesn't override the effect. favorites <-> cc.hidefavtab (native "no" = CC "hide the favourites tab").
      try { if (sel.name === "favorites") localStorage.setItem("cc.hidefavtab", (sel.value === "no" || sel.value === "0") ? "1" : "0"); } catch (eC) {}
      fetch("/update.php", { method: "POST", body: fd, credentials: "same-origin" }).then(function () { location.reload(); }).catch(function () {});
    } catch (e) {}
  }
  // #22 (user: "bei allen Einstellungen die Doppelpunkte weg"): on native /Tools/* and /Settings/* sub-pages
  // (cc-tools-on) strip the trailing colon from every setting label. Visual only + idempotent (marks done).
  function ccToolsEnhance() {
    try {
      if (!document.documentElement.classList.contains("cc-tools-on")) return;
      // #22: strip the trailing colon from every setting label
      var dts = document.querySelectorAll("#displaybox dl > dt:not([data-cc-nocolon])");
      for (var i = 0; i < dts.length; i++) {
        var dt = dts[i]; dt.setAttribute("data-cc-nocolon", "1");
        var walk = dt.querySelector("span") || dt;   // the label text usually sits in the first span
        var tn = null;
        for (var j = walk.childNodes.length - 1; j >= 0; j--) { if (walk.childNodes[j].nodeType === 3 && (walk.childNodes[j].nodeValue || "").trim()) { tn = walk.childNodes[j]; break; } }
        if (tn) tn.nodeValue = tn.nodeValue.replace(/\s*:\s*$/, "");
      }
      // #N5 (user: the docker "Läuft" status should be a small STATE DOT right of the badge, like the disk
      // state dots): turn the coloured status word in the page-title status span into a dot (word kept as tip).
      var stcolor = { green: "#1f9d55", orange: "#e0912a", red: "#d9433f", grey: "#8d8d8d", gray: "#8d8d8d", blue: "#2f6feb" };
      var stwords = document.querySelectorAll("#displaybox div.title .status span[class]:not([data-cc-dot]), #displaybox div.title span.status span[class]:not([data-cc-dot])");
      for (var sw = 0; sw < stwords.length; sw++) {
        var w = stwords[sw]; var cl = (w.className || "").trim().toLowerCase(); var col = stcolor[cl];
        if (!col) continue;
        w.setAttribute("data-cc-dot", "1"); w.setAttribute("data-cc-tip", (w.textContent || "").trim());
        // #7 (user): the dot follows the colour modes (accent) unless state-native is on; its shape follows the
        // badge-shape setting (--cc-dot-r). Store the raw state colour as a var; the Tools.css rules pick which wins.
        w.textContent = ""; w.classList.add("cc-status-dot"); w.style.setProperty("--cc-dotstate", col);
      }
      // #23 (user: native infotexts -> a CC info bubble): Unraid's per-setting help is a
      // blockquote.inline_help; move its text onto a small (i) icon on the label (rides the CC tip bubble)
      // and hide the native block.
      var helps = document.querySelectorAll("#displaybox blockquote.inline_help:not([data-cc-help]), #displaybox .inline-help:not([data-cc-help])");
      for (var h = 0; h < helps.length; h++) {
        var bq = helps[h]; bq.setAttribute("data-cc-help", "1");
        var txt = ccTransHelp((bq.textContent || "").trim()); if (!txt) { continue; }   // #6: German where Unraid left the help English
        // #N7 (user: bubbles deplatziert): the help block sits either INSIDE the field's dd, or (other
        // pages) as a flat sibling AFTER the dl it describes. Resolve the real label (dt) both ways; if
        // none is found, leave the native help visible rather than dropping a stray icon at the edge.
        var lab = null, dd = bq.closest("dd");
        if (dd) lab = dd.previousElementSibling;
        else { var pv = bq.previousElementSibling; while (pv && pv.tagName !== "DL" && pv.tagName !== "DT") pv = pv.previousElementSibling; if (pv) lab = pv.tagName === "DL" ? pv.querySelector("dt") : pv; }
        var host = (lab && lab.tagName === "DT") ? (lab.querySelector("span") || lab) : null;
        // #3-Infotext (user: "nicht ALLE Beschreibungstexte in Infobubbles verlagert"): never leave a help
        // block inline. If no label span resolves, fall back to the value cell (dd) or the label itself so
        // EVERY description becomes an (i) bubble and the native inline text is always hidden.
        if (!host && dd) host = dd;
        if (!host && lab) host = lab;
        if (host) {
          if (!host.querySelector(":scope > .cc-toolsinfo")) { var ic = document.createElement("span"); ic.className = "cc-toolsinfo"; ic.setAttribute("data-cc-tip", txt); ic.textContent = "ⓘ"; host.appendChild(ic); }
          bq.style.display = "none";
        }
      }
      // Unraid's form dl's carry EMPTY structural <dt>s before some real labels (a leftover placeholder from
      // the native markup). Two sub-cases, both handled the same way — hide the stray dt so it drops out of
      // the dl's grid layout entirely and native auto-flow places every real dt/dd row correctly on its own
      // (#11/#12 Mover/TRIM, #32 Boot-Datenträger flyout on /Main — see Tools.css for why this moved out of a
      // blanket CSS rule: :has()/adjacent-sibling matching can't tell "one stray row" from "several", so a
      // single CSS rule flattened multi-row dl's onto each other). Was cc-diskpage-only; broadened to every
      // cc-tools-on page since Mover/TRIM's stray dt lives on plain /Settings/*, not a disk page.
      // (a) the resolver above sometimes appended a (i) icon to the WRONG (empty) dt instead of the real
      //     label — fold that icon into the following label dt, then hide the now-empty carrier.
      var carriers = document.querySelectorAll("#displaybox dl > dt > .cc-toolsinfo");
      for (var ck = 0; ck < carriers.length; ck++) {
        var cic = carriers[ck], cdt = cic.parentElement;
        if ((cdt.textContent || "").replace(/[\sⓘ]/g, "")) continue;              // dt already carries a label -> icon is fine
        var nlab = cdt.nextElementSibling;
        while (nlab && nlab.tagName === "DT" && (getComputedStyle(nlab).display === "none" || !(nlab.textContent || "").trim())) nlab = nlab.nextElementSibling;
        if (nlab && nlab.tagName === "DT") { nlab.appendChild(cic); cdt.style.display = "none"; }
      }
      // (b) a stray dt with NOTHING in it at all (no icon, no text — #32's Boot-Datenträger case) has no
      //     content to relocate; just hide it.
      // #32 REGRESSION (user: "die Anwenden/Fertig-Buttons sind in allen Subtabs nach links verschoben"):
      // hiding the dt with display:none also removes it as a GRID ITEM, so it no longer occupies column 1 —
      // when a bare dt sits directly before a <dd> with no real <dt> between them (e.g. the ANWENDEN/FERTIG
      // button row, term(empty) -> definition(buttons), no label needed), that dd lost its column-1 anchor
      // and auto-flowed into column 1 itself instead of column 2. Force it back onto column 2 explicitly the
      // moment its anchor disappears, rather than leaning on auto-flow to land the same place by accident.
      var bareDts = document.querySelectorAll("#displaybox dl > dt:not([data-cc-barehid])");
      for (var bd = 0; bd < bareDts.length; bd++) {
        var bdt = bareDts[bd];
        bdt.setAttribute("data-cc-barehid", "1");
        if (getComputedStyle(bdt).display === "none") continue;
        if (!(bdt.textContent || "").trim() && !bdt.querySelector("*")) {
          bdt.style.display = "none";
          var afterBare = bdt.nextElementSibling;
          if (afterBare && afterBare.tagName === "DD") afterBare.style.gridColumn = "2";
        }
      }
      // #2-B (user: "Wo sind die Farbwählfelder bei Eigene Kopfzeilen-...farbe?"): Unraid's header colour
      // fields (header / headermetacolor / background) are plain hex TEXT inputs with no picker. Give each a
      // real colour-picker swatch (native <input type=color>) synced both ways, so a colour can be picked
      // visually. Detected by a hex value AND a colour-ish label/name; the swatch writes the field + fires
      // change so Unraid's Apply still works.
      var COLNAMES = { header: 1, headermetacolor: 1, background: 1, headertext: 1 };
      function hex6(x) { x = String(x || "").replace(/^#/, ""); if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2]; return "#" + (x || "000000").toLowerCase(); }
      var cinp = document.querySelectorAll("#displaybox input[type=text]:not([data-cc-colpick])");
      for (var ci = 0; ci < cinp.length; ci++) {
        var inp = cinp[ci], v = (inp.value || "").trim();
        if (!/^#?[0-9a-f]{3}$|^#?[0-9a-f]{6}$/i.test(v)) continue;
        var dd0 = inp.closest("dd"), dt0 = dd0 && dd0.previousElementSibling;
        var lbl = dt0 ? (dt0.textContent || "") : "";
        if (!COLNAMES[inp.name] && !/farbe|colou?r/i.test(lbl + " " + inp.name)) continue;   // only genuine colour fields
        inp.setAttribute("data-cc-colpick", "1");
        var pk = document.createElement("input"); pk.type = "color"; pk.className = "cc-colpick"; pk.value = hex6(v);
        pk.setAttribute("aria-label", (lbl || inp.name || "Farbe").replace(/\s*:\s*$/, "").trim());
        inp.parentNode.insertBefore(pk, inp);
        (function (inp2, pk2) {
          pk2.addEventListener("input", function () { inp2.value = pk2.value.replace(/^#/, ""); inp2.dispatchEvent(new Event("input", { bubbles: true })); inp2.dispatchEvent(new Event("change", { bubbles: true })); });
          inp2.addEventListener("input", function () { var vv = (inp2.value || "").trim(); if (/^#?[0-9a-f]{3}$|^#?[0-9a-f]{6}$/i.test(vv)) pk2.value = hex6(vv); });
        })(inp, pk);
      }
      // #9 (user): on the VM-Manager settings page the "Entfernen" link beside the VirtIO-ISO dropdown becomes the
      // same trash ICON the Plugins tab uses (cc-b-del cc-b-delicon). Gated to /Settings/VM* so it can't false-match
      // a "Remove" elsewhere; only converts a short Remove/Entfernen control that rides in the same row as a <select>.
      // The native onclick is kept (it just clears the ISO path).
      try {
        if (/\/Settings\/VM/i.test(location.pathname)) {
          var rms = document.querySelectorAll("#displaybox a, #displaybox span, #displaybox input[type=button], #displaybox button");
          for (var rr = 0; rr < rms.length; rr++) {
            var rme = rms[rr]; if (rme.getAttribute && rme.getAttribute("data-cc-delicon")) continue;
            var rmt = (rme.textContent || rme.value || "").replace(/^[^0-9a-zäöüß]+/i, "").trim();   // strip a leading 🗑 glyph
            if (!/^(entfernen|remove|löschen|delete)$/i.test(rmt)) continue;
            var rmrow = rme.closest("dd") || rme.closest("dl") || rme.parentElement;
            if (!rmrow || !rmrow.querySelector("select")) continue;   // only a Remove that rides beside a dropdown
            rme.setAttribute("data-cc-delicon", "1"); rme.classList.add("cc-b-del", "cc-b-delicon"); rme.setAttribute("title", rmt);
          }
        }
      } catch (eRm) {}
      // #24 (user: yes/no settings -> a toggle): a two-option <select> reading Ja/Nein (or Yes/No,
      // Enabled/Disabled, An/Aus, On/Off) becomes a CC toggle. The real <select> stays in the DOM (hidden)
      // as the form value; the toggle writes it back and fires change so Unraid's handlers still run.
      var YES = { ja: 1, yes: 1, enabled: 1, an: 1, on: 1, aktiviert: 1 }, NO = { nein: 1, no: 1, disabled: 1, aus: 1, off: 1, deaktiviert: 1 };
      var sels = document.querySelectorAll("#displaybox select:not([data-cc-tgl]):not([multiple])");
      for (var s = 0; s < sels.length; s++) {
        var sel = sels[s];
        if (sel.options.length !== 2) continue;
        var t0 = (sel.options[0].text || "").trim().toLowerCase(), t1 = (sel.options[1].text || "").trim().toLowerCase();
        var yesOpt = YES[t0] ? sel.options[0] : YES[t1] ? sel.options[1] : null;
        var noOpt = NO[t0] ? sel.options[0] : NO[t1] ? sel.options[1] : null;
        if (!yesOpt || !noOpt) continue;
        sel.setAttribute("data-cc-tgl", "1");
        var tg = document.createElement("span"); tg.className = "cc-tgl" + (sel.value === yesOpt.value ? " cc-tgl-on" : ""); tg.setAttribute("role", "switch"); tg.setAttribute("tabindex", "0");
        tg.appendChild(document.createElement("span")).className = "cc-tgl-knob";
        (function (sel2, tg2, yv, nv) {
          var flip = function () { var nowOn = !tg2.classList.contains("cc-tgl-on"); tg2.classList.toggle("cc-tgl-on", nowOn); sel2.value = nowOn ? yv : nv; try { sel2.dispatchEvent(new Event("change", { bubbles: true })); } catch (e2) {} ccApplyToolsSel(sel2); };   // #2: persist + reload so the toggle takes effect live
          tg2.addEventListener("click", flip);
          tg2.addEventListener("keydown", function (e3) { if (e3.key === "Enter" || e3.key === " ") { e3.preventDefault(); flip(); } });
        })(sel, tg, yesOpt.value, noOpt.value);
        sel.style.display = "none";
        sel.parentNode.insertBefore(tg, sel.nextSibling);
      }
      // #7: every REMAINING native <select> (not turned into a yes/no toggle above) becomes a CC overlay dropdown.
      var dsels = document.querySelectorAll("#displaybox select:not([data-cc-tgl]):not([data-cc-tsel]):not([multiple])");
      for (var ds = 0; ds < dsels.length; ds++) ccToolsWrapSelect(dsels[ds]);
    } catch (e) {}
  }
  function watchIsland() {   // nchan rewrites the (hidden) footer live — mirror every update into the island
    try {
      if (ccIslandObs) return;
      var f = document.getElementById("footer"); if (!f) return;   // no footer yet -> the next apply() retries
      ccIslandObs = new MutationObserver(function () { ccIsland(); });
      ccIslandObs.observe(f, { childList: true, subtree: true, characterData: true });   // we write into #header, never #footer -> no loop
    } catch (e) {}
  }
  // ── SERVER-NAME BRAND (top-strip restyle). span#cc-brand = FIRST child of div#header, a
  // light-DOM SIBLING of the Connect components (law: never inside them — auto-mount rebuilds
  // their nodes; our sibling survives, and Header.css does all the styling). Name source is the
  // document title ("Bottich/Dashboard" -> "Bottich"), fallback the native server-name span in
  // the profile's controls row, else "Unraid". Gates on header+theming ONLY — NOT cc.island:
  // hiding the status island must not remove the server name.
  var ccBrandSig = "";
  function ccBrandOn() { return g("cc.enable.header", "0") !== "0" && g("cc.theming", "1") !== "0"; }
  function ccBrand() {
    try {
      var br = document.getElementById("cc-brand");
      if (!ccBrandOn()) { if (br && br.parentNode) br.parentNode.removeChild(br); ccBrandSig = ""; return; }   // teardown: gate off = brand gone (island idiom)
      var hdr = document.getElementById("header"); if (!hdr) return;
      var name = (document.title.split("/")[0] || "").replace(/^\s+|\s+$/g, "");
      if (!name) {   // titleless page -> read the native server-name span (first span of the profile's controls row)
        var ns = document.querySelector("#UserProfile > div:nth-child(2) span");
        name = ((ns && ns.textContent) || "").replace(/^\s+|\s+$/g, "");
      }
      if (!name) name = "Unraid";
      // customisation (user: size/weight/italic/font/colour in CC settings) — read the cc.brand.*
      // keys and inline them; part of the sig so a live settings change re-renders.
      var bSize = g("cc.brand.size", "30"), bWeight = g("cc.brand.weight", "650"), bItalic = g("cc.brand.italic", "0"),
          bFont = g("cc.brand.font", ""), bColor = g("cc.brand.color", "");
      var sig = name + "|" + bSize + "|" + bWeight + "|" + bItalic + "|" + bFont + "|" + bColor;
      if (br && sig === ccBrandSig) return;   // idempotence: profile rebuilds re-run us, only a real change re-renders
      ccBrandSig = sig;
      if (!br) { br = document.createElement("span"); br.id = "cc-brand"; hdr.insertBefore(br, hdr.firstChild); }
      while (br.firstChild) br.removeChild(br.firstChild);   // clear + refill = idempotent rebuild
      var nm = document.createElement("span"); nm.className = "cc-brand-name";
      // inline overrides (the sheet's defaults apply when a key is unset/empty)
      if (/^\d{1,3}$/.test(bSize)) nm.style.fontSize = bSize + "px";
      if (bWeight) nm.style.fontWeight = bWeight;
      nm.style.fontStyle = bItalic === "1" ? "italic" : "normal";
      if (bFont) {
        nm.style.fontFamily = bFont;
        // if the chosen face is one of the curated Google families, load the web font so the wordmark
        // renders for EVERYONE, not just clients that happen to have it installed.
        try {
          if (window.CCTheme && window.CCTheme.loadGFonts && window.CCTheme.gfonts) {
            var fam = window.CCTheme.primaryFamily(bFont);
            if (window.CCTheme.gfonts.some(function (gf) { return gf[0] === fam; })) window.CCTheme.loadGFonts([fam]);
          }
        } catch (e) {}
      }
      if (/^#[0-9a-f]{6}$/i.test(bColor)) nm.style.color = bColor;
      nm.appendChild(document.createTextNode(name));
      br.appendChild(nm);
    } catch (e) {}
  }
  var ccProfObs = null, ccProfT = null;
  function watchProfile() {   // uptime/edition/name live inside the Connect profile — auto-mount rebuilds it at will
    try {
      if (ccProfObs) return;
      // observe the CUSTOM ELEMENT when present (it survives auto-mount replacing div#UserProfile
      // wholesale), never div#header — we write #cc-island/#cc-brand into #header ourselves and
      // must not observe our own writes
      var p = document.querySelector("unraid-user-profile") || document.getElementById("UserProfile");
      if (!p) return;   // not mounted yet -> the next apply() retries (watchIsland idiom)
      ccProfObs = new MutationObserver(function () {
        if (ccProfT) return;   // DEBOUNCE 120ms (freeze law): coalesce auto-mount's rebuild burst into ONE pass
        ccProfT = setTimeout(function () {
          ccProfT = null;
          ccIsland(); ccBrand();   // both are sig-guarded no-ops when nothing changed; we never write inside the component, so no loop is possible — the debounce stays anyway
          ccDockProfile();         // slow net: catches anything the fast net (ccWatchAdopt) missed
        }, 120);
      });
      ccProfObs.observe(p, { childList: true, subtree: true, characterData: true });
      // #16 ROUND 5: the bell/burger dock is REPARENTED, not overlaid — ccWatchAdopt() (declared with
      // the rest of the dock code) is the FAST/synchronous net that re-adopts the instant Connect's
      // auto-mount inserts a fresh (un-adopted) trigger span, straight off the childList mutation, no
      // debounce, so the CSS visibility-hidden safety net never has to cover more than one frame. This
      // 120ms-debounced observer above is the slow net for the rest of the profile chips + a fallback
      // re-adopt in case ccWatchAdopt's own observe() target wasn't mounted yet on first call.
      ccWatchAdopt();
    } catch (e) {}
  }
  // ── GLOBAL FLOATING hover bubble (user: "im Start-Tab passen viele Mouseover-Bubbles nicht …
  // systemweit checken"). Pure-CSS ::after bubbles get CLIPPED by overflow ancestors (nav tiles,
  // tables) and by the viewport edge — so ONE shared body-mounted div#cc-tipfloat serves EVERY
  // [data-cc-tip]/[data-tip] anchor DOCUMENT-WIDE (island chips, docker lists, shares tables,
  // the settings panel …) via delegation on document (survives any rebuild). Positioning: fixed,
  // centred under the anchor, clamped into the viewport (8px margins, the arrow stays over the
  // anchor), FLIPPED above the anchor when the bottom edge would clip it (cc-tip-above turns the
  // arrow downward). Hidden on scroll + pointerdown. Master-theming gated (cc-popups-on mirrors it).
  var ccTipBound = false, ccTipCur = null;
  function ccTipEl() {
    var d = document.getElementById("cc-tipfloat");
    if (!d) { d = document.createElement("div"); d.id = "cc-tipfloat"; document.body.appendChild(d); }
    return d;
  }
  function ccTipHide() { var d = document.getElementById("cc-tipfloat"); if (d) d.style.display = "none"; ccTipCur = null; }
  function ccTipShow(t) {
    var tip = t.getAttribute("data-cc-tip") || t.getAttribute("data-tip"); if (!tip) return;
    var d = ccTipEl(), r = t.getBoundingClientRect();
    d.textContent = tip;
    d.style.display = "block";                                     // show first — size only measures while visible
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = document.documentElement.clientHeight || window.innerHeight;
    var w = d.offsetWidth, h = d.offsetHeight, cx = r.left + r.width / 2;
    var x = Math.max(8 + w / 2, Math.min(vw - 8 - w / 2, cx));     // clamp INTO the viewport (tables/rows run to both edges)
    d.style.left = x + "px";                                       // left = bubble CENTRE (CSS translateX(-50%))
    // vertical FLIP: a bubble that would clip at the bottom edge opens ABOVE the anchor instead
    // (only when it actually fits up there); cc-tip-above points the arrow downward
    var above = r.bottom + 8 + h > vh && r.top - 8 - h >= 0;
    d.classList.toggle("cc-tip-above", above);
    d.style.top = (above ? r.top - 8 - h : r.bottom + 8) + "px";
    d.style.setProperty("--cc-tip-ax", Math.max(10, Math.min(w - 10, cx - (x - w / 2))) + "px");   // arrow stays over the anchor even when the bubble clamps
  }
  function ccWireTips() {
    try {
      if (ccTipBound) return;
      ccTipBound = true;
      function over(e) {
        if (!document.documentElement.classList.contains("cc-popups-on")) return;   // master theming off -> fully native
        var t = e.target && e.target.closest ? e.target.closest("[data-cc-tip], [data-tip], [title]") : null;
        if (!t) return;
        // a raw title anywhere (a menu icon a script never converted, a native control) becomes a
        // CC bubble on the fly + the OS balloon is suppressed — so EVERY hover text is a CC bubble
        // (user: "die Symbole haben nicht alle ein Mouseover-Text"). Skip empty/whitespace titles.
        if (!t.getAttribute("data-cc-tip") && !t.getAttribute("data-tip")) {
          var nt = t.getAttribute("title");
          if (nt && nt.trim()) { t.setAttribute("data-cc-tip", nt); t.removeAttribute("title"); }
          else return;
        }
        if (t === ccTipCur) return;                                // same anchor -> the bubble already stands
        ccTipCur = t; ccTipShow(t);
      }
      function out(e) {
        if (!ccTipCur) return;
        var to = e.relatedTarget;
        if (to && ccTipCur.contains(to)) return;                   // moved within the same anchor
        ccTipHide();
      }
      document.addEventListener("mouseover", over);
      document.addEventListener("mouseout", out);
      document.addEventListener("focusin", over);
      document.addEventListener("focusout", out);
      document.addEventListener("pointerdown", ccTipHide, true);   // a press means action, not reading -> hide
      window.addEventListener("scroll", ccTipHide, true);          // any scroll de-anchors the fixed bubble -> hide (capture catches inner-container scrolls too)
    } catch (e) {}
  }
  // ── BELL + BURGER DOCK — REPARENT MODEL (#16 ROUND 5). Rounds 1-4 (a 1s safety-net interval, a
  // hover listener scoped to #UserProfile, one widened to the whole document, then a continuous
  // per-frame rAF re-pin loop) all tried to make a position:fixed OVERLAY track a position:sticky
  // proxy from JS. That is structurally unfixable: sticky recompute is resolved natively by the
  // compositor with no synchronous JS hook, so a rAF poll is always at least one frame behind
  // during the sticky transition (measured live: 30px trailing during the scroll handoff) — and,
  // separately and more importantly, `html.cc-anim-wild #menu:has(.nav-tile > .nav-item:hover) {
  // z-index: 103 }` lifts #menu above #header (102) on hover of ANY nav item; since the fixed
  // trigger spans are still visually children of #header's OWN stacking context, .nav-tile.right's
  // opaque background then paints straight over BOTH of them (they are siblings inside the SAME
  // re-rendered Connect container, hence "still a group") for as long as the hover lasts. Four
  // rounds of re-pin timing fixes could never have touched that: it is a stacking-context bug, not
  // a timing bug.
  // FIX: physically ADOPT the two live Connect trigger <span>s as children of their existing proxy
  // <div>s (#cc-bell-proxy / #cc-burger-proxy — already first-class, draggable nav-items living in
  // the native .nav-tile.right flow, added for drag & drop reordering). Adopted, the spans reflow
  // NATIVELY with the row (zero scroll lag, no JS tracking needed) and paint INSIDE .nav-tile.right's
  // own stacking context (structurally impossible for that tile's own background to cover them).
  // The old "the live triggers are NEVER moved in the DOM" law (asserted v3.1.0, commit 1ae6664,
  // on the theory that Connect's Vue framework requires it) was never actually tested and is
  // EMPIRICALLY FALSIFIED this round: a moved span still takes real clicks, still flips its own
  // data-state, and the real .bg-popover / notification Sheet still render correctly anchored
  // under it. The real constraint was only ever that Connect periodically REBUILDS the profile row
  // (auto-mount) — ccWatchAdopt() below re-adopts synchronously, before paint, the instant that
  // happens, and a CSS safety net (Header.css) hides any leftover un-adopted span regardless of
  // JS timing, so a rebuild can never flash the icons at the parked zero-footprint anchor.
  var ccDockProps = ["position", "left", "right", "top", "height", "width", "z-index", "padding", "min-width"];
  // classify the two trigger spans by IDENTITY, not DOM position (position was fine while both
  // stayed put; once adopted, order in the DOM changes) — the burger's live id starts with
  // "reka-menu-trigger" (verified live, e.g. "reka-menu-trigger-v-0-0"); first/last-of-the-rest is
  // the fallback so this still degrades safely if Connect's naming ever changes.
  function ccClassifyTrig(sp) {
    var burger = null, i;
    for (i = 0; i < sp.length; i++) { if (/^reka-menu-trigger/.test(sp[i].id || "")) { burger = sp[i]; break; } }
    if (!burger) burger = sp.length ? sp[sp.length - 1] : null;
    var bell = null;
    for (i = 0; i < sp.length; i++) { if (sp[i] !== burger) { bell = sp[i]; break; } }
    if (!bell) bell = sp.length ? sp[0] : null;
    return { bell: bell, burger: burger };
  }
  // ── proxies: TWO real, draggable nav-items (#cc-bell-proxy / #cc-burger-proxy) that live in the
  // normal .nav-tile.right flow, so they reflow/reorder like every other icon. Each now HOSTS its
  // live trigger as a real DOM child (ccDockProfile below); the proxy's own <a>/ghost glyph is only
  // needed as the drag handle while arrange mode is active (JS toggles its display — see below). ──
  function ccEnsureProxies(bellSpan, burgerSpan) {
    var tileR = navTileR(); if (!tileR) return [null, null];
    var defs = [["cc-bell-proxy", true, bellSpan], ["cc-burger-proxy", false, burgerSpan]];
    var out = [];
    for (var d = 0; d < defs.length; d++) {
      var id = defs[d][0], isBell = defs[d][1], span = defs[d][2];
      var it = document.getElementById(id);
      if (!it) {
        it = document.createElement("div");
        it.className = "nav-item util cc-navdrag cc-iconproxy";
        it.id = id;
        var a = document.createElement("a"); a.href = "#"; a.className = "hand cc-proxy-a";
        a.setAttribute("data-cc-tip", isBell ? T("Benachrichtigungen", "Notifications") : T("Menü", "Menu"));
        a.addEventListener("click", function (e) { e.preventDefault(); });   // arrange-mode ghost handle only; normal-mode clicks land on the adopted span beside it
        var gh = document.createElement("span"); gh.className = "cc-proxy-ghost"; a.appendChild(gh);
        it.appendChild(a);
        tileR.appendChild(it);                                     // default = far right (burger last), matching native order
        wireNavItem(it);                                           // make it a first-class drag participant
      }
      // keep the ghost glyph a faithful clone of the live trigger's icon (for the arrange-mode preview)
      var gh2 = it.querySelector(".cc-proxy-ghost");
      if (gh2 && span && gh2.getAttribute("data-cc-svg") !== "1") { var svg = span.querySelector("svg"); if (svg) { gh2.innerHTML = svg.outerHTML; gh2.setAttribute("data-cc-svg", "1"); } }
      out.push(it);
    }
    return out;
  }
  function ccDockProfile() {
    try {
      if (!document.documentElement.classList.contains("cc-header-on")) { ccUndockProfile(); return; }
      var up = document.getElementById("UserProfile"); if (!up) return;
      var container = up.querySelector(":scope > div:nth-child(2)");
      // classify + stamp any FRESH (un-adopted) span Connect just rebuilt; already-adopted spans
      // (living inside a proxy now) keep their data-cc-trig and are found via the document query.
      if (container) {
        var freshSp = container.querySelectorAll(":scope > span:not([data-cc-trig])");
        if (freshSp.length === 1) {
          // exactly one un-adopted span: id-based classification needs a SECOND span to disambiguate
          // against, so if exactly one role is currently missing document-wide, it must be this one —
          // safer than falling through ccClassifyTrig's position fallback, which would otherwise (with
          // only one candidate) tag the SAME node as both bell and burger.
          var needBell1 = !document.querySelector('[data-cc-trig="bell"]'), needBurger1 = !document.querySelector('[data-cc-trig="burger"]');
          if (needBell1 !== needBurger1) freshSp[0].setAttribute("data-cc-trig", needBurger1 ? "burger" : "bell");
        } else if (freshSp.length >= 2) {
          var cls = ccClassifyTrig(freshSp);
          if (cls.bell && !document.querySelector('[data-cc-trig="bell"]')) cls.bell.setAttribute("data-cc-trig", "bell");
          if (cls.burger && !document.querySelector('[data-cc-trig="burger"]')) cls.burger.setAttribute("data-cc-trig", "burger");
        }
      }
      var bellSpan = document.querySelector('[data-cc-trig="bell"]');
      var burgerSpan = document.querySelector('[data-cc-trig="burger"]');
      if (!bellSpan && !burgerSpan) return;                        // profile not mounted yet -> next pass retries
      var hideBell = g("cc.hideicon.bell", "0") === "1", hideBurger = g("cc.hideicon.burger", "0") === "1";   // #2b
      var proxies = ccEnsureProxies(bellSpan, burgerSpan);          // [bellProxy, burgerProxy]
      var arranging = document.documentElement.classList.contains("cc-arrange");
      // Neutralise the leftover Connect container (auto-mount-safe: never removed from the DOM,
      // just zero footprint — CSS already sets pointer-events:none on it).
      function setUp(p, v) { if (up.style.getPropertyValue(p) !== v) up.style.setProperty(p, v, "important"); }   // diff-write = zero mutations once settled
      setUp("position", "fixed"); setUp("left", "0"); setUp("top", "0"); setUp("width", "0"); setUp("height", "0"); setUp("min-width", "0"); setUp("padding", "0");
      [[bellSpan, proxies[0], hideBell, true], [burgerSpan, proxies[1], hideBurger, false]].forEach(function (row) {
        var span = row[0], proxy = row[1], hidden = row[2], isBell = row[3];
        if (!span || !proxy) return;
        var wantDisp = hidden ? "none" : "";
        if (proxy.style.display !== wantDisp) proxy.style.display = wantDisp;   // per-icon hide collapses the whole slot
        var ss = span.style;
        if (hidden) { if (ss.getPropertyValue("display") !== "none") ss.setProperty("display", "none", "important"); return; }
        if (ss.getPropertyValue("display")) ss.removeProperty("display");
        // CC bubbles instead of native balloons (the #menu sweep can't reach these once adopted either, they live outside #menu proper -> tip binding is document-wide, see ccWireTips)
        if (!span.getAttribute("data-cc-tip")) span.setAttribute("data-cc-tip", isBell ? T("Benachrichtigungen", "Notifications") : T("Menü", "Menu"));
        if (span.getAttribute("title")) span.removeAttribute("title");
        // the triggers carry Tailwind MIN-width/height (36px) that beat even sheet !important — enforce the 36px box inline
        if (ss.getPropertyValue("min-height") !== "36px") { ss.setProperty("width", "36px", "important"); ss.setProperty("height", "36px", "important"); ss.setProperty("min-width", "36px", "important"); ss.setProperty("min-height", "36px", "important"); }
        // #15 colour modes: mirror the proxy slot's rainbow colour onto the adopted trigger so bell +
        // burger follow rainbow/flag exactly like the util icons. paintNav() stamps --cc-rb-c on the
        // proxy's <a> (it matches the util selector); copy it here. Normal mode -> cleared -> CSS wins.
        var pxa = proxy.querySelector(".cc-proxy-a"), rbc = (rbOn() && pxa) ? pxa.style.getPropertyValue("--cc-rb-c") : "";
        if (rbc) { ss.setProperty("--cc-rb-c", rbc); ss.setProperty("--cc-rb-ct", pxa.style.getPropertyValue("--cc-rb-ct") || idealText(rbc)); }
        else { ss.removeProperty("--cc-rb-c"); ss.removeProperty("--cc-rb-ct"); }
        // idempotent ADOPTION: the actual fix. appendChild is a no-op once the span already sits
        // last inside the proxy — this branch then never fires again until Vue rebuilds a fresh span.
        if (span.parentElement !== proxy) proxy.appendChild(span);
        // the proxy's OWN <a>/ghost is only the arrange-mode drag handle now; hide it whenever the
        // real adopted trigger is doing the showing, so the two 36px boxes don't sit side by side.
        // #34-followup: the general ".nav-item.util > a" rule forces display:inline-flex !important
        // (it doesn't know about the iconproxy's own ghost handle) - a plain inline style can never
        // beat that, so the hide silently no-op'd and the ghost sat there, transparent but full-width,
        // widening the gap before bell/burger. Match its !important instead of losing to it.
        var ghostA = proxy.querySelector(".cc-proxy-a");
        if (ghostA) {
          if (arranging) { if (ghostA.style.display) ghostA.style.removeProperty("display"); }
          else if (ghostA.style.display !== "none" || ghostA.style.getPropertyPriority("display") !== "important") {
            ghostA.style.setProperty("display", "none", "important");
          }
        }
      });
      ccArmAdoptObs();   // (re)arm the narrow style-attribute watch on the two now-adopted spans
    } catch (e) {}
  }
  function ccUndockProfile() {                                     // OFF branch: move the spans back, drop the proxies, fully native again
    try {
      ccDisarmAdoptObs();
      var bell = document.querySelector('[data-cc-trig="bell"]'), burger = document.querySelector('[data-cc-trig="burger"]');
      var up = document.getElementById("UserProfile");
      var container = up ? up.querySelector(":scope > div:nth-child(2)") : null;
      if (container) { if (bell) container.appendChild(bell); if (burger) container.appendChild(burger); }   // native order: bell then burger
      [bell, burger].forEach(function (s) {
        if (!s) return;
        s.removeAttribute("data-cc-trig");
        ["width", "height", "min-width", "min-height", "position", "left", "top", "z-index", "margin", "pointer-events", "display", "--cc-rb-c", "--cc-rb-ct"].forEach(function (p) { s.style.removeProperty(p); });
      });
      ["cc-bell-proxy", "cc-burger-proxy"].forEach(function (id) { var p = document.getElementById(id); if (p) p.remove(); });
      if (up) for (var i = 0; i < ccDockProps.length; i++) up.style.removeProperty(ccDockProps[i]);
    } catch (e) {}
  }
  // ── auto-mount re-adoption. Two nets, same non-reentrancy argument for both: their only DOM
  // writes land on the two trigger spans (attributes) or inside a PROXY div under #menu, and
  // neither of those is inside the subtree either observer watches — so a write can wake the OTHER
  // net at most once, see a clean/empty diff, and stop. Circuit breaker on the childList net is the
  // hard backstop against the v3.6.5 self-observing-MutationObserver freeze class if Connect ever
  // fights back harder than expected (a real tug-of-war, not just a rebuild). ──
  var ccAdoptObs = null, ccTrigStyleObs = null, ccAdoptHits = 0, ccAdoptWinT = 0, ccAdoptOffT = 0;
  function ccArmAdoptObs() {   // narrow net: re-writes the 36px sizing on the two ADOPTED spans only, on a real wipe
    try {
      if (ccTrigStyleObs) { ccTrigStyleObs.disconnect(); ccTrigStyleObs = null; }
      var trig = document.querySelectorAll("[data-cc-trig]"); if (!trig.length) return;
      ccTrigStyleObs = new MutationObserver(function () {
        for (var i = 0; i < trig.length; i++) {
          var ss = trig[i].style;
          if (ss.getPropertyValue("min-height") !== "36px") { ss.setProperty("width", "36px", "important"); ss.setProperty("height", "36px", "important"); ss.setProperty("min-width", "36px", "important"); ss.setProperty("min-height", "36px", "important"); }
        }
      });
      for (var i = 0; i < trig.length; i++) ccTrigStyleObs.observe(trig[i], { attributes: true, attributeFilter: ["style"] });
    } catch (e) {}
  }
  function ccWatchAdopt() {   // wide net: catches Connect inserting a FRESH (un-adopted) trigger span on rebuild
    try {
      if (ccAdoptObs) return;
      var p = document.querySelector("unraid-user-profile"); if (!p) return;
      ccAdoptObs = new MutationObserver(function () {
        if (Date.now() < ccAdoptOffT) return;                                                                 // breaker tripped -> stand down
        if (!document.querySelector("#UserProfile > div:nth-child(2) > span:not([data-cc-trig])")) return;    // gate: nothing un-adopted -> no-op, chain terminates here
        var now = Date.now();
        if (now - ccAdoptWinT > 1000) { ccAdoptWinT = now; ccAdoptHits = 0; }
        if (++ccAdoptHits > 30) { ccAdoptOffT = now + 5000; return; }                                          // >30 re-adoptions/second -> Connect tug-of-war, disarm 5s (v3.6.5 freeze law)
        try { ccDockProfile(); } catch (e2) {}
      });
      ccAdoptObs.observe(p, { childList: true, subtree: true });
    } catch (e) {}
  }
  function ccDisarmAdoptObs() {
    try { if (ccAdoptObs) { ccAdoptObs.disconnect(); ccAdoptObs = null; } if (ccTrigStyleObs) { ccTrigStyleObs.disconnect(); ccTrigStyleObs = null; } } catch (e) {}
  }
  // ── CC TOAST ── one reusable bottom-centre notice (help feedback #11, "what's new" toast, …). A single
  // reused node; the styling (surface, radius, colour-mode accent) lives in Header.css (.cc-toast). Auto-
  // dismisses; reduced-motion respected via CSS. Safe no-op if the document body is not ready.
  var ccToastEl = null, ccToastT = 0;
  function ccToast(msg, ms) {
    try {
      if (!document.body) return;
      if (!ccToastEl) { ccToastEl = document.createElement("div"); ccToastEl.id = "cc-toast"; ccToastEl.setAttribute("role", "status"); ccToastEl.setAttribute("aria-live", "polite"); document.body.appendChild(ccToastEl); }
      ccToastEl.textContent = msg;
      ccToastEl.classList.add("cc-toast-show");
      if (ccToastT) clearTimeout(ccToastT);
      ccToastT = setTimeout(function () { ccToastT = 0; if (ccToastEl) ccToastEl.classList.remove("cc-toast-show"); }, ms || 2600);
    } catch (e) {}
  }
  try { window.ccToast = ccToast; } catch (e) {}   // let docker.js / settings.js reuse the same toast
  function apply() {
    try {
      var root = document.documentElement;
      // MASTER THEMING off (cc.theming="0") behaves like the area being disabled — header is
      // purely presentational. The storage listener re-runs apply(), so a live toggle reverts.
      var on = g("cc.enable.header", "0") !== "0" && g("cc.theming", "1") !== "0";
      root.classList.toggle("cc-header-on", on);
      // GLOBAL Badge-Form "circle": header.js runs on every page, so it owns the one global class the
      // per-object 50%-radius overrides in every sheet key off. Set it UNCONDITIONALLY (badge shape is
      // global, independent of whether the header area itself is on) — it only rounds SQUARE badges, and
      // if no area is enabled there are no badges to round, so it's harmless when everything is off.
      root.classList.toggle("cc-shape-circle", g("cc.badgeshape", "pill") === "circle");
      // #14 (user: "systemweit mehr Animationen" + ein Toggle): GLOBAL animation master, default ON. cc-anim-on
      // makes CC animations run even when the OS asks to reduce motion (the user explicitly wants more); cc-anim-
      // off stills them everywhere. Set unconditionally (motion is global chrome, like the badge shape above).
      root.classList.toggle("cc-anim-on", g("cc.anim", "1") !== "0");   // on = normal OR wild
      root.classList.toggle("cc-anim-off", g("cc.anim", "1") === "0");
      root.classList.toggle("cc-anim-wild", g("cc.anim", "1") === "2"); // wild = the exuberant extras on top
      // #8/#4: the badge-form radii must be present on EVERY page (the Tools/Settings sub-page toggle
      // track/knob and the docker state dot read them) — set them UNCONDITIONALLY here, not only inside the
      // header-area-on branch below. All areas compute the SAME shape(), so this can't disagree with them.
      try {
        root.style.setProperty("--cc-b-radius", shape());
        root.style.setProperty("--cc-dot-r", ({ pill: "50%", circle: "50%", rounded: "3px", square: "0px" })[g("cc.badgeshape", "pill")] || "50%");
      } catch (eR) {}
      // GLOBAL popup theming (user: "alle Subfenster/Popupfenster in den CC Style"): the native
      // jQuery-UI dialogs (openBox/openPlugin) + SweetAlert confirmations follow the CC look on
      // every page. Master-gated only — it is chrome, not an area of its own.
      root.classList.toggle("cc-popups-on", g("cc.theming", "1") !== "0");
      // CA's settings sub-page (/Apps/ca_settings) is a REAL Unraid form page, not one of CA's overlays, and
      // nothing in its markup identifies it: its <form> posts to /update.php like every other Unraid setting
      // page, so a :has(form[action*="ca_settings"]) hook matched nothing (verified live). Stamp the page
      // identity from the URL instead — the same trick the sheet already relies on for the other CA states.
      root.classList.toggle("cc-ca-settings", /^\/Apps\/ca_settings/i.test(location.pathname));
      // Two passes: writing the padding moves the row, so one measurement only gets part of the way there
      // (live: 767 -> 797 against a target of 843). The function is self-correcting, so a second pass after
      // layout has settled lands it exactly; both are strict no-ops once aligned.
      ccCaSettingsRows();
      setTimeout(ccCaSettingsRows, 60);
      setTimeout(ccCaSettingsRows, 400);
      // GLOBAL footer hide (user: "die native Leiste wo Array gestartet steht ... komplett
      // ausblenden"): footer#footer = the fixed 28px strip (#statusraid/#statusbar + temps +
      // copyright). DEFAULT HIDDEN — cc.footer="0" (settings toggle) brings it back. Same
      // master-gating idiom as cc-popups-on; the storage listener re-runs apply() live.
      root.classList.toggle("cc-footer-off", g("cc.footer", "1") === "1" && g("cc.theming", "1") !== "0");
      // hide the native Favorites menu tab (user: "Favoriten ausblenden" — Unraid's own favorites=no
      // does NOT hide the tab, and CC's own `#menu .nav-item{display:inline-flex!important}` even
      // forces it visible; the sheet rule beats that on cc-hide-favtab). Master-gated only (chrome).
      root.classList.toggle("cc-hide-favtab", g("cc.hidefavtab", "0") === "1" && g("cc.theming", "1") !== "0");
      // array-usage chip lives in the island now — hide the native menu usage-bar while the
      // island is on (its data source; the chip mirrors the text). Island off = native bar back.
      root.classList.toggle("cc-usage-isl", on && ccIslandOn());
      // #2b per-icon hide (top-right utility icons) + #16 native state colours — global chrome toggles,
      // master-theming-gated. cc.hideicon.<key>=1 hides that icon (Header.css); the docked bell/burger
      // are handled in ccDockProfile. cc.statenative=1 lets state indicators keep their native colour.
      // T3: bell + burger are integral (never hidden) — dropped from this list so a stale cc.hideicon.bell/
      // burger can no longer blank the icon while leaving its badge; the settings toggles were removed too.
      ["lang", "search", "logout", "terminal", "browse", "feedback", "info", "log", "help"].forEach(function (k9) { root.classList.toggle("cc-hideicon-" + k9, g("cc.hideicon." + k9, "0") === "1" && g("cc.theming", "1") !== "0"); });
      root.classList.toggle("cc-state-native", g("cc.statenative", "0") === "1" && g("cc.theming", "1") !== "0");
      // #10: global rainbow flag on <html> so the unified loader (.cc-nchan-loader) can cycle its colour
      // once per spin revolution while rainbow is on. Independent of the header AREA being enabled.
      root.classList.toggle("cc-rb-on", rbOn() && g("cc.theming", "1") !== "0");
      // #4/#11 (user: buttons in den Farbmodi): stamp ONE rainbow/flag "action" colour on <html> so
      // native buttons in EVERY sheet (Freigaben, Tools/Settings sub-pages) can follow the colour mode
      // via var(--cc-rbaccent, <accent>). Flag mode also sets cc.rainbow=1, so rbColor() already yields
      // the flag colour here. Cleared when rainbow is off -> buttons fall back to their accent.
      try {
        if (on && rbOn()) { var rbA = rbColor(5); root.style.setProperty("--cc-rbaccent", rbA); root.style.setProperty("--cc-rbaccent-text", idealText(rbA)); }
        else { root.style.removeProperty("--cc-rbaccent"); root.style.removeProperty("--cc-rbaccent-text"); }
      } catch (e7) {}
      // #14 + #1 + Anzeige-Rework: Carbon-ify the Tools SUB-pages, the docker/plugin execution-output
      // (install-log) pages AND every native /Settings/* SUB-page (so the un-hidden Display Settings page
      // is CC-styled). cc-tools-on = a /Tools/... path OR a /Settings/<x> sub-page (NOT our own CC page,
      // which owns #cc-settings) OR the content carries a native <fieldset><legend>. Master-theming-gated.
      try {
        var p0 = location.pathname, ownPg = /^\/Settings\/CannonadeCommand/.test(p0);
        // #(user: "alle Disk-Subseiten in den CC-Style" + "alle Subseiten des Boot-Devices in CC-Style"): the disk/pool
        // DETAIL pages (click a disk on /Main) are /Main/Device? / /Main/Disk?, and the boot/flash device is /Main/Boot? —
        // all reka settings forms with the SAME layout as a /Settings sub-page (section headings, toggles, selects,
        // inputs, sub-tab bar). Match by URL (not by a fieldset probe, which races the async reka render) so the full
        // Tools treatment applies reliably. The /Main ROOT (disk_status table) is NOT matched -> it stays native.
        var diskPg = /^\/Main\/(Device|Disk|Boot)\b/.test(p0);
        // CA's settings sub-page (/Apps/ca_settings) is a NATIVE Unraid settings form — same dl/dt/dd layout,
        // same selects, same bare input buttons — so it gets the SAME treatment instead of a second, thinner
        // one of its own. That is what finally puts its dropdowns in the CC style: ccToolsEnhance() replaces
        // every native <select> with the .cc-tsel overlay (a real CC panel that CAN be styled when open,
        // unlike an OS-rendered option list), turns yes/no pairs into CC toggles, and the Tools sheet already
        // carries the colour-mode variants for all of it. Maintaining a parallel half-solution here is what
        // kept the page looking un-CC through several rounds.
        var caSettingsPg = /^\/Apps\/ca_settings/i.test(p0);
        var toolsPg = !ownPg && (/^\/Tools\//.test(p0) || /^\/Settings\/./.test(p0) || diskPg || caSettingsPg || !!document.querySelector("#displaybox fieldset legend"));
        root.classList.toggle("cc-tools-on", toolsPg && g("cc.theming", "1") !== "0");
        // the disk DETAIL form is a full-width native grid, so the reverted-to-native /Settings dl handling lets its
        // labels/values spread to the screen edges. Mark disk pages so the COMPACT CC grid (kept only here) reins the
        // form back in — /Settings pages stay native.
        root.classList.toggle("cc-diskpage", diskPg && toolsPg && g("cc.theming", "1") !== "0");
      } catch (e0) {}
      ccArrFill();      // #18: on /Main, refresh the cached array-fill % the island's fill chip reads
      ccStateBars();   // #16: usage-bar fills follow the fill-level state colour when cc.statenative, else the palette
      ccToolsEnhance();   // #22: strip label colons on native Tools/Settings sub-pages
      ccPaintRotate();    // #3/#8: per-element rotating palette colour on button rows + toggles (rainbow)
      ccWatchMain();      // re-paint late AJAX-rendered content (usage bars, buttons, toggles)
      ccNchanStyle(); paintPopups(); watchPopups();
      ccWireTips();     // document-wide floating-bubble delegation (bound once) — on EVERY page: docker/shares/settings anchors ride it even with the header area off
      try { ccApps(); } catch (e) {}   // #8: repaint /Apps colour-mode badges on every apply (live rainbow/accent toggle)
      // paintNav() with cc-header-on now removed => rb=false => it removeProperty's every
      // lingering rainbow inline colour, so a live theming-OFF (even with Rainbow on) fully
      // reverts the menu bar instead of leaving the coloured tabs behind.
      if (!on) {
        paintNav(); measureAlign();
        ccIsland();   // gate off inside -> removes span#cc-island from div#header
        ccBrand();    // same teardown for span#cc-brand (server name)
        // styled hover bubbles -> native title balloons back (area off = fully native)
        var tps0 = document.querySelectorAll("#menu [data-cc-tip]");
        for (var tq = 0; tq < tps0.length; tq++) { tps0[tq].setAttribute("title", tps0[tq].getAttribute("data-cc-tip")); tps0[tq].removeAttribute("data-cc-tip"); }
        ccTipHide();        // the floating bubble must not linger once the titles are native again
        ccUndockProfile();  // bell/burger back to their native top-right spot
        return;   // measure even when the header area is off: OTHER areas (shares/settings) still align to the native menu-text edge
      }
      // utility-icon titles -> the styled CC bubble (user: hover bubbles frameless + badge-form;
      // the native OS balloon can't be styled). Idempotent; the off-branch above restores.
      var tps1 = document.querySelectorAll("#menu .nav-item.util a[title], #menu .usage-bar [title]");
      for (var tr1 = 0; tr1 < tps1.length; tr1++) { var th = tps1[tr1]; th.setAttribute("data-cc-tip", th.getAttribute("title")); th.removeAttribute("title"); }
      var a = accent();
      // ISOLATED accent var — NOT the shared --cc-accent. Other global enhancers (shares.js,
      // the page-specific docker/plugins/vms) also write --cc-accent on documentElement and
      // would clobber the menu-bar colour (and vice-versa); each area now owns its var and the
      // sheet reads --cc-hdr-accent. (--cc-b-radius stays shared: one global Badge-Form.)
      root.style.setProperty("--cc-hdr-accent", a);
      root.style.setProperty("--cc-hdr-accent-text", idealText(a));
      root.style.setProperty("--cc-b-radius", shape());
      root.classList.toggle("cc-header-rb", rbOn());
      applyNavOrder();  // restore the user's saved tab order BEFORE painting/measuring (it reorders the DOM)
      setupNavDrag();   // make the tabs draggable (idempotent per tile)
      paintNav();
      ccTabIcons();     // main-tab icons (idempotent; insertBefore changes tab width, so it must run before measureAlign)
      measureAlign();   // after the pill geometry is live -> measure the real left edge
      ccIsland();       // status island in the top strip (self-gated on cc.island, default on)
      ccBrand();        // server-name brand, first child of the top strip (header+theming gated, NOT cc.island)
      watchIsland();    // live footer observer so nchan status/temp updates flow into the chips
      watchProfile();   // debounced profile observer so uptime/edition/name rebuilds flow into chips + brand
      ccDockProfile();  // adopt bell+burger into their proxy slots at the far right end of the menu icon row (idempotent, self-gated)
      ccArrangeLock();  // #Drag-Umbau: the always-visible lock toggle (self-gates on cc-header-on)
      // #16 ROUND 5: late passes against a settling layout (live-proven: the first pass can run before
      // late-loading icons/styles have finished shifting the row) — re-adopt twice after the dust settles.
      // No continuous rAF loop needed any more (rounds 1-4's history): adoption makes the trigger part of
      // the native flow, so once adopted it needs no further per-frame tracking at all.
      setTimeout(ccDockProfile, 300); setTimeout(ccDockProfile, 1200);
    } catch (e) {}
  }
  // gui_search() prepends #guiSearchBoxSpan at the FAR-LEFT of .nav-tile.right, focuses
  // the input, and closes the search on the input's focusout. We want the field to sit
  // directly LEFT of the search toggle (magnifier) — but MOVING the span in the DOM
  // blurs the focused input, which fires gui_search's onfocusout and instantly closes
  // the search (the field never appears). So we position the span purely with flex
  // `order` (no DOM move => no blur => the field stays open). Setting `order` is an
  // attribute change, not a childList mutation, so it never re-triggers our observer.
  // On close (no span) we reset the orders. Only when CC header is on + top-nav layout.
  function reorderSearch() {
    try {
      var root = document.documentElement;
      if (!root.classList.contains("cc-header-on") || root.classList.contains("Theme--sidebar")) return;
      var right = document.querySelector("#menu .nav-tile.right");
      if (!right) return;
      var kids = right.children, j;
      var span = document.getElementById("guiSearchBoxSpan");
      if (!span) { for (j = 0; j < kids.length; j++) kids[j].style.removeProperty("order"); return; }
      var toggle = right.querySelector('[onclick*="gui_search"]');
      toggle = toggle ? toggle.closest(".nav-item") : right.querySelector(".nav-item.gui_search");
      if (!toggle) { for (j = 0; j < kids.length; j++) kids[j].style.removeProperty("order"); return; }
      var order = 0;
      for (j = 0; j < kids.length; j++) {
        if (kids[j] === span) continue;                 // placed just before the toggle below
        if (kids[j] === toggle) { span.style.setProperty("order", order); order++; }
        kids[j].style.setProperty("order", order); order++;
      }
    } catch (e) {}
  }
  function watchSearch() {
    try {
      var target = document.getElementById("menu") || document.body;
      // DEBOUNCED (freeze fix): a synchronous callback here ping-ponged with Unraid's Connect
      // auto-mount observer (its component rebuilds refire us, our reorder refires it) and the
      // microtask storm froze the tab. The timer hop lets the event loop breathe and coalesces
      // auto-mount's burst into ONE pass; the applyNavOrder truce covers the rest.
      var moT = null;
      var mo = new MutationObserver(function () {
        if (moT) return;
        moT = setTimeout(function () {
          moT = null;
          reorderSearch();
          document.documentElement.classList.toggle("cc-search-open", !!document.getElementById("guiSearchBoxSpan"));
          // late-added utility icons (native scripts append them AFTER boot) get their saved slot
          // + drag wiring here — applyNavOrder is a strict no-op once the arrangement matches.
          if (document.documentElement.classList.contains("cc-header-on")) { applyNavOrder(); setupNavDrag(); }
          paintNav();
          ccDockProfile();   // the icon row shifts when the search box opens/closes or icons arrive late — re-pin the dock (self-gated)
        }, 120);
      });
      mo.observe(target, { childList: true, subtree: true });
    } catch (e) {}
  }
  // Native gui_search only OPENS on a click; make a 2nd click on the magnifier CLOSE it.
  // Delegated capture-phase listener runs BEFORE the toggle's inline onclick="gui_search()",
  // so when the box is already open we close it and stop the event from re-opening it.
  function wireSearchToggle() {
    // ROOT CAUSE of "2nd click doesn't close" (user): a REAL click on the magnifier first BLURS the search
    // input, whose onfocusout closes the box — so by click-time the box is already gone, a click-time "is it
    // open?" check reads false, and the inline gui_search() then RE-opens it. Fix: remember whether the box was
    // open at MOUSEDOWN (before the blur), and on the following click block the re-open + force it closed.
    var searchWasOpen = false;
    function onToggle(e) { return e.target && e.target.closest ? e.target.closest(".nav-item.gui_search, [onclick*='gui_search']") : null; }
    function closeSearch(ev) {
      try { if (typeof window.closeSearchBox === "function") window.closeSearchBox(ev); } catch (e3) {}
      var s = document.getElementById("guiSearchBoxSpan"); if (s && s.parentNode) s.parentNode.removeChild(s);
      var hid = document.querySelectorAll(".nav-item.util, .nav-user.show");
      for (var i = 0; i < hid.length; i++) hid[i].style.removeProperty("display"); // restore what gui_search hid
      document.documentElement.classList.remove("cc-search-open");
    }
    document.addEventListener("mousedown", function (e) {
      try {
        if (!document.documentElement.classList.contains("cc-header-on")) { searchWasOpen = false; return; }
        if (onToggle(e)) { searchWasOpen = !!document.getElementById("guiSearchBoxSpan"); return; }
        searchWasOpen = false;
        // click OUTSIDE the search span while it is open -> close it too
        var span = document.getElementById("guiSearchBoxSpan");
        if (span && !(e.target && e.target.closest && e.target.closest("#guiSearchBoxSpan"))) closeSearch(e);
      } catch (err) {}
    }, true);
    document.addEventListener("click", function (e) {
      try {
        if (!document.documentElement.classList.contains("cc-header-on")) return;
        if (!onToggle(e)) return;
        if (!searchWasOpen && !document.getElementById("guiSearchBoxSpan")) return; // was closed -> let native OPEN it
        searchWasOpen = false;
        e.preventDefault(); e.stopImmediatePropagation(); // block the inline gui_search() re-open
        closeSearch(e);
      } catch (err) {}
    }, true);
    document.addEventListener("keydown", function (e) { try { if (e.key === "Escape" && document.getElementById("guiSearchBoxSpan")) closeSearch(e); } catch (err) {} });
  }
  var CC_VER = "@@CCVER@@"; if (CC_VER.indexOf("@@") === 0) CC_VER = "dev";
  // V-D "Was ist neu?": after an update, greet with a one-shot toast naming the new version (never on the
  // very first install — no baseline to compare — and never in dev builds). cc.lastver tracks the last seen.
  function ccWhatsNew() {
    try {
      if (CC_VER === "dev") return;
      if (g("cc.theming", "1") === "0") return;                 // CC disabled -> stay silent
      var last = g("cc.lastver", "");
      if (last && last !== CC_VER) { setTimeout(function () { ccToast(T("CannonadeCommand auf v" + CC_VER + " aktualisiert.", "CannonadeCommand updated to v" + CC_VER + ".")); }, 1400); }
      if (last !== CC_VER) { try { localStorage.setItem("cc.lastver", CC_VER); } catch (e2) {} }
    } catch (e) {}
  }
  // ═══ #7/#8/#9/#11 Apps (Community Applications) tab — colour-mode stamping + subtitle→(i) bubble ═══════
  // header.js is the ONLY CC script on /Apps (docker/plugins/vms are page-scoped), and --cc-accent /
  // --cc-rbaccent are NOT stamped on root here — so CA badges fell back to the default blue in BOTH modes.
  // This self-contained pass stamps --cc-rb-c/--cc-rb-ct per element (like docker.js injectRowBadges):
  // rbColor(i) returns the user's accent when rainbow is off, or a rotating jewel when on. It also moves
  // each home-section subtitle into the shared (i) bubble (#9). FREEZE-SAFE: NO subtree observer on the card
  // tree (that froze the tab); a childList(subtree:false) observer on #templates_content catches CA's view
  // swaps, plus a re-stamp on the CA nav clicks.
  function ccMakeInfo(tip) {
    var s = document.createElement("span"); s.className = "cc-info";
    s.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.1" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="4.7" r="1.05" fill="currentColor"/><rect x="7.05" y="6.8" width="1.9" height="5" rx=".95" fill="currentColor"/></svg>';
    s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); s.setAttribute("tabindex", "0");
    return s;   // rides the document-wide #cc-tipfloat engine (ccWireTips)
  }
  function ccAppsStamp(sel) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var c = rbColor(i);                                  // accent when rainbow off, jewel[i] when on
      els[i].style.setProperty("--cc-rb-c", c);
      els[i].style.setProperty("--cc-rb-ct", idealText(c));
    }
  }
  // #7: turn CA's full-width search into a collapsible far-right badge — the magnifier is a colour-mode
  // BUTTON that expands into an input on click (mirrors CC-settings wireSearchToggle / .cc-set-searchbadge).
  // Idempotent via data-cc-search so it re-wires after CA view swaps; re-open block runs in capture phase.
  function wireCaSearch() {
    try {
      var filter = document.getElementById("searchFilter");
      if (!filter) return;
      // #4 (user: "die suche als badge links unter dem Home badge platzieren, oben rechts passt nicht"): move
      // the collapsible search badge out of the top-right search bar into the LEFT category sidebar, directly
      // under the Home item. Guarded so it only mutates when NOT already placed -> idempotent, no observer loop
      // (CA rebuilds the sidebar on view swaps, so this re-homes it on the next ccApps pass).
      var caMenu = document.querySelector("ul.caMenu");
      if (caMenu) {
        var li = document.getElementById("cc-ca-search-li");
        if (!li) { li = document.createElement("li"); li.id = "cc-ca-search-li"; li.className = "caMenuItem cc-ca-search-li"; }
        // EXCLUDE our own node when resolving the anchor: our li also carries .caMenuItem, so on a menu with no
        // li.startupButton the querySelector below could return the li ITSELF once it has been inserted first.
        // `home.nextElementSibling !== li` is then trivially true and every pass re-runs insertBefore — which
        // removes + re-inserts the node, blurring whatever is focused inside it. With the search now interactive
        // that would tear the input out mid-typing on any ccApps pass (they fire on every category click).
        var home = caMenu.querySelector("li.startupButton") || caMenu.querySelector("li.caMenuItem:not(#cc-ca-search-li)");
        if (filter.parentElement !== li) li.appendChild(filter);
        if (home && home !== li) { if (home.nextElementSibling !== li) caMenu.insertBefore(li, home.nextElementSibling); }
        else if (li.parentElement !== caMenu) caMenu.insertBefore(li, caMenu.firstChild);
      }
      // user (v3.6.6): "das Suchfeld im CA-Tab soll ein Badge sein mit Icon und Text; wenn man drauf klickt
      // soll das Suchfeld kommen" — so cc-open is now RUNTIME STATE owned by the handlers below, not a
      // permanent stamp. (v3.6.2 forced it on here on every pass, which no collapse handler could survive:
      // ccApps re-runs on every category/magnifier click, so the badge would silently re-open ~60ms later.)
      // CA's markup has no label text, so inject one. ABOVE the idempotency guard: the guard is right for
      // event listeners (bind once per node) but wrong for DOM content, which must be repairable if CA
      // rewrites the container's children while keeping the node.
      if (!filter.querySelector(".cc-ca-search-label")) {
        var lb = document.createElement("span");
        lb.className = "cc-ca-search-label";
        lb.textContent = T("Suche", "Search");
        filter.appendChild(lb);
      }
      if (filter.getAttribute("data-cc-search") === "1") return;
      filter.setAttribute("data-cc-search", "1");
      var box = document.getElementById("searchBox");
      // #4: while typing, flag <html> so the suggestion popup grows past the narrow sidebar and the page dims +
      // blurs behind it. The awesomplete <ul> is re-anchored fixed (right of the field) so the sidebar can't clip it.
      if (box) {
        var caFlag = function () {
          var on = !!(box.value && box.value.trim());
          document.documentElement.classList.toggle("cc-ca-searching", on);
          if (on) { ccPositionCaResults(filter); requestAnimationFrame(function () { ccPositionCaResults(filter); }); }
        };
        box.addEventListener("input", caFlag);
        box.addEventListener("keyup", caFlag);
        box.addEventListener("focus", caFlag);
        box.addEventListener("blur", function () { setTimeout(function () { document.documentElement.classList.remove("cc-ca-searching"); }, 200); });
      }
      // EXPAND: delegated on #searchFilter (not on the magnifier node) so a click anywhere in the chip —
      // icon OR the "Suche" label — opens it, and so a CA re-render of the inner icon can't orphan the
      // handler. The open-state is latched at MOUSEDOWN because a real click on the magnifier blurs the
      // input first, so a click-time read would already say "closed" (the same trap the top-bar search
      // documents in wireSearchToggle above).
      var caWasOpen = false;
      filter.addEventListener("mousedown", function () { caWasOpen = filter.classList.contains("cc-open"); }, true);
      filter.addEventListener("click", function (e) {
        try {
          if (caWasOpen || filter.classList.contains("cc-open")) return;   // already open -> leave CA's own submit alone
          // #26 (user: "wenn man aufs X klickt um die Suche zurückzusetzen öffnet sich das Suchfenster —
          // es soll aber die Suche gleich zurücksetzen"): CA swaps the magnifier icon to fa-remove ("X")
          // once a query is active — clicking it then means "clear", not "open" (confirmed live: the badge
          // stays collapsed, #searchButton carries fa-remove, box.value is the old query). This capture-
          // phase handler ran unconditionally and stopPropagation()'d every click, which ate CA's own
          // clear-button handling right along with the open-badge one it was meant to intercept.
          var btn = filter.querySelector("#searchButton");
          if (btn && btn.classList.contains("fa-remove")) return;   // let CA's own clear/reset run untouched
          e.preventDefault(); e.stopPropagation();
          filter.classList.add("cc-open");
          // the expanded field leaves the sidebar column and overlays the app grid, so lift the sidebar's
          // stacking context immediately — waiting for cc-ca-searching (set on the first keystroke) would
          // paint the panel UNDER the cards for the moment between opening and typing.
          document.documentElement.classList.add("cc-ca-searchopen");
          if (box) box.focus();
        } catch (e2) {}
      }, true);
    } catch (e) {}
  }
  // COLLAPSE, bound ONCE per document (mirrors the CC-settings search badge). Never on blur/focusout: the
  // suggestion list is position:fixed and visually outside the field but still a DOM descendant, so a
  // focusout collapse would fire on pointer-down over a suggestion and destroy the list before its own click
  // lands. BUBBLE phase and no stopPropagation — a capture-phase document listener that stops the event
  // swallows the real click for every CA control underneath.
  function ccWireCaSearchCollapse() {
    try {
      if (window.__ccCaSearchDoc) return;
      window.__ccCaSearchDoc = 1;
      function collapse() {
        var f = document.getElementById("searchFilter");
        if (!f || !f.classList.contains("cc-open")) return;
        if (!f.closest("li.cc-ca-search-li")) return;      // top-bar variant keeps its own behaviour
        f.classList.remove("cc-open");
        var b = document.getElementById("searchBox");
        if (b && b.value) {                                 // reset CA's own filter through its own listeners
          b.value = "";
          b.dispatchEvent(new Event("input", { bubbles: true }));
          b.dispatchEvent(new Event("keyup", { bubbles: true }));
        }
        try { b && b.blur(); } catch (e) {}
        document.documentElement.classList.remove("cc-ca-searching");   // else the dim would outlive the field
        document.documentElement.classList.remove("cc-ca-searchopen");
      }
      document.addEventListener("click", function (e) {
        var f = document.getElementById("searchFilter");
        if (!f || !f.contains(e.target)) collapse();        // contains() counts the fixed suggestion list as inside
      });
      // CAPTURE for Escape: awesomplete binds its own Escape handler to close the suggestion list and the
      // event never reached a bubble-phase document listener (live-proven: the value cleared but the field
      // stayed expanded). Capture only LISTENS here — it must never stopPropagation, or it would swallow
      // Escape for every control underneath.
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") collapse(); }, true);
      // #9 (user: "wenn man was sucht und enter drückt oder auf ein suchvorschlag klickt bleibt das
      // suchfenster offen und der blur da bis man escape drückt"): collapse() above is CANCEL — it clears
      // the term, which is correct for "dismiss" but WRONG for "I just searched", since it would wipe out
      // the very query CA is about to filter by. Awesomplete's own library fires "awesomplete-selectcomplete"
      // on #searchBox for BOTH a click on an <li> AND Enter-with-a-highlighted-item (verified in
      // libraries.js: select() always ends with `i.fire(this.input,"awesomplete-selectcomplete",…)`; CA
      // itself listens to the identical event at Apps.page:1349 to run its own search). Plain Enter with
      // NOTHING highlighted reaches neither path — awesomplete only intercepts keyCode 13 when
      // `s.selected`, so an un-highlighted Enter falls through as an ordinary keydown on the input. A
      // direct Enter listener on the box covers that case without depending on awesomplete's internal state.
      function submitCollapse() {
        var f = document.getElementById("searchFilter");
        if (!f || !f.classList.contains("cc-open")) return;
        if (!f.closest("li.cc-ca-search-li")) return;
        f.classList.remove("cc-open");
        document.documentElement.classList.remove("cc-ca-searching");
        document.documentElement.classList.remove("cc-ca-searchopen");
        try { box && box.blur(); } catch (e2) {}
      }
      var box = document.getElementById("searchBox");
      if (box) {
        box.addEventListener("awesomplete-selectcomplete", submitCollapse);
        box.addEventListener("keydown", function (e) { if (e.key === "Enter") submitCollapse(); });
      }
    } catch (e) {}
  }
  // #4: anchor the CA app-suggestion popup as position:fixed to the RIGHT of the sidebar search field, so the
  // 140px sidebar (overflow) can't clip it and it can grow wide + tall. Re-applied on every keystroke because
  // awesomplete rewrites the <ul> and its inline top/left each render.
  function ccPositionCaResults(filter) {
    try {
      var ul = filter.querySelector(".awesomplete > ul"); if (!ul || ul.hasAttribute("hidden")) return;
      var r = filter.getBoundingClientRect();
      ul.style.setProperty("position", "fixed", "important");
      // user (v3.6.6): "das Dropdown soll dann direkt unter der Suchleiste sein". It used to sit to the RIGHT
      // of the field (left = r.right + 12) because the field was a 140px sidebar box the list had to escape;
      // now the field itself opens to the right at the header panel's own width, so the list belongs directly
      // beneath it, left-aligned and exactly as wide — i.e. one panel, not two adjacent boxes.
      ul.style.setProperty("left", Math.round(r.left) + "px", "important");
      ul.style.setProperty("top", Math.round(r.bottom + 6) + "px", "important");
      ul.style.setProperty("width", Math.round(r.width) + "px", "important");
      ul.style.setProperty("min-width", "0", "important");
      ul.style.setProperty("max-width", "none", "important");
      ul.style.setProperty("bottom", "auto", "important");
      ul.style.setProperty("right", "auto", "important");
    } catch (e) {}
  }
  // user (v3.6.6): "das menue und der badge sind rechts nicht buendig" / "die show more buttons sind zu weit
  // rechts". The gutter the user compares SHOW MORE against is the HEADER's icon row (icons + status island
  // agree on it: .nav-tile.right's right edge minus its padding). The section-header row lives in a DIFFERENT
  // container (.menuAdjust), whose right edge sits some viewport-, scrollbar- and font-dependent distance
  // further out (21px at a 1400px viewport) — no static padding can track that, and measuring against
  // #displaybox instead of the row's real parent overshot by 10px. So measure each row against ITS OWN
  // offsetParent and pad by exactly the delta; a later pass re-measures ~0 delta, so it converges.
  // ── SIDEBAR CARDS (user, v3.6.6: "in der Seitenleiste machen wir Cards fuer die Abschnitte … Card fuer
  // Installed Apps, fuer Previous Apps, Pinned Apps … Card fuer die Kategorien … dann All Apps und
  // Repositories bleiben einzeln, alles darunter kommt wieder in eine Card"). CA renders the sidebar as
  // FLAT <li> siblings across THREE separate ul.caMenu lists, so a card is not reachable in CSS alone
  // (there is no "group of siblings" selector) — the group needs a real wrapper. We MOVE CA's own <li>
  // nodes into it rather than cloning, so their click handlers survive untouched (same technique the
  // search field already uses).
  // Idempotency is the whole game here: ccApps re-runs on every category click and CA rebuilds this menu on
  // view swaps. Each pass therefore checks whether the group's first node is ALREADY inside its card and
  // bails out before touching the DOM — a re-parent would otherwise blur focus and fire needless mutations.
  // MARK-ONLY, never re-parent. The first attempt wrapped each group in a real <li><ul> and MOVED CA's <li>
  // into it; that broke CA outright — the "Installed/Previous Apps" sub-lists came back display:none, because
  // CA's own show/hide logic addresses them through their original sibling relationship. So the card is drawn
  // PURELY in CSS: every member of a group gets cc-card-in plus an edge marker (cc-card-top / cc-card-bot),
  // and the sheet paints one continuous surface with the radius only on the outer edges. Nothing moves, CA's
  // logic keeps working, and a class write is a cheap no-op on repeat passes.
  function ccMark(items, title) {
    try {
      if (!items.length) return;
      for (var i = 0; i < items.length; i++) {
        var el = items[i], first = i === 0, last = i === items.length - 1;
        el.classList.add("cc-card-in");
        el.classList.toggle("cc-card-top", first);
        el.classList.toggle("cc-card-bot", last);
      }
      // CA ships no heading for the categories, so CC supplies one ("Ueberschrift 'Kategorien'").
      if (title) {
        var host = items[0].parentElement; if (!host) return;
        var h = host.querySelector(":scope > .cc-ca-cardtitle");
        if (!h) { h = document.createElement("li"); h.className = "cc-ca-cardtitle cc-card-in cc-card-top"; h.textContent = title; }
        if (h.nextElementSibling !== items[0]) host.insertBefore(h, items[0]);
        items[0].classList.remove("cc-card-top");   // the title is the card's top edge now
      }
    } catch (e) {}
  }
  // #15 (user: "results per page und dockerhub badge bitte unter dem such-badge platzieren"): the two
  // controls live in .searchArea, a MAIN-CONTENT-area container, while the search chip is in the SIDEBAR
  // (li.cc-ca-search-li under ul.caMenu) — different DOM regions entirely, so no CSS selector can place one
  // under the other. Moves the REAL nodes (never clones — same reason ccAppsCards below does: a clone would
  // carry no click handler). Idempotent: bails the moment the host already holds them, so a re-run on every
  // ccApps() pass (CA rebuilds .searchArea on every category/search change) is a cheap no-op.
  function ccMoveSearchAreaBadges() {
    try {
      var searchLi = document.querySelector("li.cc-ca-search-li");
      var filter = document.getElementById("searchFilter");
      if (!searchLi || !filter) return;
      var host = searchLi.querySelector(":scope > .cc-ca-search-extras");
      if (!host) {
        host = document.createElement("div");
        host.className = "cc-ca-search-extras";
        filter.parentNode === searchLi ? searchLi.insertBefore(host, filter.nextSibling) : searchLi.appendChild(host);
      }
      var mpp = document.querySelector(".searchArea .caButton.maxPerPage");
      var dh = document.querySelector(".searchArea .dockerSearch");
      if (mpp && mpp.parentNode !== host) host.appendChild(mpp);
      if (dh && dh.parentNode !== host) host.appendChild(dh);
      // #15 follow-up (live-measured): #dropdown-maxPerPage is appended directly to <body> and CA positions
      // it with inline top/left computed for the control's OLD home — after the move it opened pinned near
      // the page's top-left corner instead of under the relocated button. Forcing the fix ONCE (or even
      // twice, at 0ms/60ms) was proven live to lose: opacity was still mid-fade at that point (CA runs a
      // jQuery-style fade/slide that keeps re-touching the node's style across several frames), so CA's own
      // next frame overwrote the single corrective write. Same idea as ccPositionCaResults below, but
      // fighting an ANIMATION means covering the animation's whole duration, not one or two beats —
      // matches the codebase's own 8x180ms convention for a similarly animated popover (ccNotifActions).
      if (mpp && !mpp.getAttribute("data-cc-dd-wired")) {
        mpp.setAttribute("data-cc-dd-wired", "1");
        mpp.addEventListener("click", function () {
          function place() {
            var dd = document.getElementById("dropdown-maxPerPage");
            if (!dd || getComputedStyle(dd).display === "none") return;
            var r = mpp.getBoundingClientRect();
            dd.style.setProperty("position", "fixed", "important");
            dd.style.setProperty("left", Math.round(r.left) + "px", "important");
            dd.style.setProperty("top", Math.round(r.bottom + 6) + "px", "important");
            dd.style.setProperty("right", "auto", "important"); dd.style.setProperty("bottom", "auto", "important");
          }
          [0, 20, 40, 60, 90, 120, 160, 210, 270, 340, 420, 500].forEach(function (ms) { setTimeout(place, ms); });
        });
      }
    } catch (e) {}
  }
  // #30 (user: "results per page (ohne die Zahl)"): CA appends the live count to its own label ("Results
  // Per Page: 12"), which is also why the badge needed multi-line wrapping to fit — strips the ": N" tail
  // on every pass so it stays gone even after the user picks a different per-page value from CA's dropdown.
  function ccAppsStripCount() {
    try {
      var mpp = document.querySelector(".cc-ca-search-extras .caButton.maxPerPage");
      if (!mpp) return;
      var m = /^(.*?):\s*[\d,]+\s*$/.exec((mpp.textContent || "").trim());
      if (m) mpp.textContent = m[1];
    } catch (e) {}
  }
  function ccAppsCards() {
    try {
      var menus = [].slice.call(document.querySelectorAll("ul.caMenu"));
      if (!menus.length) return;
      // Identify the three lists by CONTENT, never by index: CA fills them asynchronously, so on an early
      // pass the category list may not exist yet and index 1 silently pointed at the meta list — which is
      // how the first build ended up filing "All Apps/Einstellungen/…" under a card titled "Kategorien".
      var mMain = null, mCats = null, mMeta = null;
      for (var mi = 0; mi < menus.length; mi++) {
        var m = menus[mi];
        if (m.querySelector(".allApps, .caRepositoryMenu")) mMeta = m;
        else if (m.querySelector("li.startupButton") || m.querySelector("#cc-ca-search-li")) mMain = m;
        else if (m.querySelector("li.categoryMenu")) mCats = m;
      }
      // ---- MAIN: Home + search stay loose; each sectionMenu heading opens a group that runs to the next
      //      heading. Action Centre is deliberately excluded — it becomes a standalone badge.
      if (mMain) {
        var kids = [].slice.call(mMain.children), group = null, groups = [];
        for (var i = 0; i < kids.length; i++) {
          var li = kids[i];
          var isHead = li.classList && li.classList.contains("sectionMenu");
          if (isHead && li.classList.contains("actionCentre")) { group = null; continue; }
          if (isHead) { group = [li]; groups.push(group); continue; }
          if (!group) continue;                                                       // Home / search / rules before any heading
          if (li.querySelector && li.querySelector("hr")) { group = null; continue; }  // a rule ends the group
          group.push(li);
        }
        for (var g = 0; g < groups.length; g++) ccMark(groups[g], null);
      }
      // ---- CATEGORIES: their own list, no heading at all -> one card, titled by CC.
      if (mCats) {
        var cats = [].slice.call(mCats.children).filter(function (n) { return !n.classList || !n.classList.contains("cc-ca-cardtitle"); });
        if (cats.length) ccMark(cats, T("Kategorien", "Categories"));
      }
      // ---- META: All Apps + Repositories stay loose (they are categoryMenu entries). #30 (user: "einzelne
      // Punkte sollen ein einzelner badge sein" — Einstellungen/Statistics/Credits/Support/Version/Change
      // Log/Debugging are each their own top-level list entry in the user's spec, not a shared card): used
      // to be grouped into one untitled card here; now left loose like Home/Action Centre/All Apps, so they
      // fall through to the same standalone-badge rule those already use. Strip the OLD card marks so a box
      // that still carries them from before this change (no full DOM rebuild happened yet) drops them too.
      if (mMeta) {
        var k2 = [].slice.call(mMeta.children), tail = [], seenCat = false;
        for (var j = 0; j < k2.length; j++) {
          var n = k2[j];
          if (n.classList && n.classList.contains("categoryMenu")) { seenCat = true; tail = []; continue; }
          if (!seenCat) continue;
          if (n.querySelector && n.querySelector("hr")) continue;      // rules are hidden inside a card anyway
          if (!(n.textContent || "").trim()) continue;
          tail.push(n);
        }
        for (var jt = 0; jt < tail.length; jt++) {
          tail[jt].classList.remove("cc-card-in", "cc-card-top", "cc-card-bot");
        }
        // #30d (user: explicit sidebar order has VERSION after Change Log and Debugging; CA natively
        // renders it between Support and Change Log instead). VERSION + its number are a plain text pair
        // (classless <li>, no click handler), so moving them is safe. Found INDEPENDENTLY — VERSION by its
        // exact text, the number via CA's own #caInstalledVersion id — never by tail-array adjacency: CA
        // re-injects a fresh <hr> between the two on some renders (e.g. update-check state changes), which
        // once left them non-adjacent and a position-based pairing paired VERSION with the wrong neighbour,
        // scrambling the tail further on every subsequent pass instead of converging. Guarded on "already
        // last, in order" so a pass where the order already matches is a strict no-op — this whole block
        // reruns on every ccApps() pass (category clicks, view swaps).
        var verLabel = null, verNumEl = mMeta.querySelector("#caInstalledVersion");
        var verNum = verNumEl ? verNumEl.closest("li") : null;
        for (var vi = 0; vi < tail.length; vi++) {
          if ((tail[vi].textContent || "").trim().toUpperCase() === "VERSION") { verLabel = tail[vi]; break; }
        }
        if (verLabel && verNum) {
          var kids = mMeta.children, lastIdx = kids.length - 1;
          var alreadyLast = lastIdx >= 1 && kids[lastIdx - 1] === verLabel && kids[lastIdx] === verNum;
          if (!alreadyLast) {
            mMeta.appendChild(verLabel);
            mMeta.appendChild(verNum);
          }
        }
      }
    } catch (e) {}
  }
  function ccAppsAlignRight() {
    try {
      var rTile = document.querySelector("#menu .nav-tile.right");
      if (!rTile) return;
      var gutter = rTile.getBoundingClientRect().right - (parseFloat(getComputedStyle(rTile).paddingRight) || 0);
      var heads = document.querySelectorAll(".ca_homeTemplatesHeader");
      for (var i = 0; i < heads.length; i++) {
        var more = heads[i].querySelector(".homeMore"); if (!more) continue;
        // SELF-CORRECTING, not computed-from-container: derive the new padding from where SHOW MORE ACTUALLY
        // landed vs the gutter, and nudge by that delta. Deriving it from the parent's rect instead was wrong
        // twice over (the parent's border-box right includes its own padding, and #displaybox is a different
        // box again) — this form needs no assumption about the container at all and converges to 0 delta.
        var cur = parseFloat(heads[i].style.paddingRight) || 0;
        var delta = more.getBoundingClientRect().right - gutter;
        if (Math.abs(delta) < 0.5) continue;                       // already flush -> no write (keeps it a no-op)
        var pad = Math.round(cur + delta);
        if (pad >= 0 && pad < 200) heads[i].style.setProperty("padding-right", pad + "px", "important");
      }
    } catch (e) {}
  }
  // user (v3.6.6): "kannst du es so machen, dass der Abschnittsbadge horizontal buendig ist mit dem Home
  // badge? also alles weiter hochruecken" — the first section row sat 11px below the sidebar's Home chip.
  // The two badges are different heights (34 vs 30), so align their vertical CENTRES, not their tops, and
  // measure it: a static margin would drift with the font size, the badge tier and the theme. Only the FIRST
  // row is nudged (its margin-top collapses out of .menuAdjust, which is what pulls the whole column up);
  // the rows below keep their own rhythm.
  function ccAppsAlignTop() {
    try {
      var caMenu = document.querySelector("ul.caMenu"); if (!caMenu) return;
      var home = caMenu.querySelector("li.startupButton") || caMenu.querySelector("li.caMenuItem:not(#cc-ca-search-li)");
      var head = document.querySelector(".ca_homeTemplatesHeader"); if (!home || !head) return;
      var badge = head.querySelector(".cc-sechead-badge") || head;
      var hr = home.getBoundingClientRect(), br = badge.getBoundingClientRect();
      if (!hr.height || !br.height) return;
      var delta = (hr.top + hr.height / 2) - (br.top + br.height / 2);
      if (Math.abs(delta) < 0.5) return;                       // already level -> no write (stays a no-op)
      var cur = parseFloat(head.style.marginTop);
      if (isNaN(cur)) cur = parseFloat(getComputedStyle(head).marginTop) || 0;
      var mt = Math.round(cur + delta);
      if (mt > -80 && mt < 80) head.style.setProperty("margin-top", mt + "px", "important");   // sanity-bounded
    } catch (e) {}
  }
  // The corner marks become badges stacked at the card's top right (user: "können wir die Ribbons auch in
  // CC-Badges umwandeln? und auch das Monthly Spotlight … wenn beide vorhanden sind sollen sie rechts in der
  // Card untereinander angeordnet sein"). CA emits the ribbon as a SIBLING of the card (its
  // closest('.ca_holder') is null) and positions it with its own left/right, which kept winning against a
  // pure CSS re-anchor. Moving it INTO the card puts both marks in the same containing block — the card —
  // so one rule stacks them. Idempotent: it only moves a ribbon that is not already inside its card.
  function ccAppsCornerMarks() {
    try {
      var marks = document.querySelectorAll(".officialCardBackground, .LTOfficialCardBackground, .installedCardBackground, .betaCardBackground");
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        if (m.closest(".ca_holder")) continue;                 // already inside -> no-op
        var slot = m.parentElement; if (!slot) continue;
        var card = slot.querySelector(".ca_holder"); if (!card) continue;
        card.appendChild(m);
      }
    } catch (e) {}
  }
  function ccApps() {
    try {
      if (!/^\/Apps(\/|$)/.test(location.pathname)) return;
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      // user (v3.6.6, aktiver Sammelmodus: "die badges auf den app cards sind nicht im reaktive modus der
      // derzeit eingeschaltet ist"): "Reaktiver Modus" (cc.rbmode=active) is a GLOBAL settings-page toggle
      // ("gilt global fuer ALLE Farbmodi ... und alle Bereiche") but was only ever wired to two areas
      // (cc-header-rbneutral, cc-tools-rbneutral) — Apps never got its own class, so its badges could only
      // ever render fully coloured, same as header.js's own "reactive class also in Normal mode" comment
      // above documents for the header case. Mirror that here for the Apps tab.
      document.documentElement.classList.toggle("cc-apps-rbneutral", rbNeutral());
      ccAppsStamp(".ca_homeTemplatesHeader");
      ccAppsStamp(".caMenuItem.selectedMenu");
      ccAppsStamp("#searchFilter");                          // #7: stamp the collapsible badge (bg + icon colour follow the mode)
      // #10 (user: "nicht im regenbogenmodus, bitte in alle Farbmodi aufnehmen"): the search-results header
      // (Results Per Page, DockerHub, the pager numbers, the Sort By links) was styled as badges but never
      // STAMPED, so --cc-rb-c never reached them and Rainbow could only ever show the shared --cc-rbaccent
      // fallback, never each control's own jewel — same gap the bottom-line card buttons had (#8).
      // #15: BOTH locations in one selector — before ccMoveSearchAreaBadges() runs (or on a page where the
      // move host doesn't exist yet) they're still under .searchArea; afterwards they're under
      // .cc-ca-search-extras. Covering both means restamping keeps working across every re-run either way.
      ccAppsStamp(".searchArea .caButton.maxPerPage, .searchArea .dockerSearch, .cc-ca-search-extras .caButton.maxPerPage, .cc-ca-search-extras .dockerSearch");
      ccAppsStamp(".pageNavigation .pageNumber");
      ccAppsStamp("a.sortIcons");
      // #13 (user: "bitte in alle Farbmodi integrieren"): the card corner ribbons (OFFICIAL/LIMITED TIME/
      // INSTALLED/BETA) and the Spotlight badges are already wired to --cc-rb-c on the CSS side (reactive-
      // neutral, colour on .ca_holder:hover — Tokens.css ~1220) but were never stamped, so they only ever
      // fell back to the flat shared accent instead of each card's own rotating jewel — the same gap #10
      // above already documents for the search-results header. Re-runs every tick like the others, so cards
      // that arrive later (SHOW MORE / infinite scroll) get stamped too.
      ccAppsStamp(".officialCardBackground, .LTOfficialCardBackground, .installedCardBackground, .betaCardBackground, .homespotlightIconArea");
      // #24 (user: "im action centre wird ueber den header badges auch action centre text angezeigt, bitte
      // weg machen"): CA's .category.categoryLine label reuses the same slot for "Search for X" (useful —
      // tells you what you searched) and the plain section name (redundant here — the sidebar's own
      // ACTION CENTRE button is already highlighted). Hide only the latter for Action Centre specifically;
      // every other use of the label (search, a real category name) stays untouched.
      // REGRESSION (user: "text ist weg aber dafuer sind jetzt die header badges zu weit oben, bitte auf
      // allen seiten auf gleicher hoehe wie der homebutton"): display:none collapses the slot's own ~15px,
      // which every OTHER page still reserves (the Home page renders this same element with EMPTY text,
      // still taking up its height) — so only the Action Centre page lost that space and everything below
      // it (Suche, Results Per Page, ...) crept up. visibility:hidden removes the text without collapsing
      // the box, so Home/Suche land on the same line on every page again.
      Array.prototype.slice.call(document.querySelectorAll(".category.categoryLine")).forEach(function (cl) {
        cl.style.setProperty("visibility", (cl.textContent || "").trim() === "Action Centre" ? "hidden" : "", "important");
      });
      ccMoveSearchAreaBadges();                              // #15: relocate under the search badge
      ccAppsStripCount();                                    // #30: "Results Per Page: 12" -> "Results Per Page"
      wireCaSearch();
      ccWireCaSearchCollapse();
      ccAppsCards();                                         // group the flat sidebar <li>s into cards
      // #30 (user: "die cards sollen einen titelbadge haben"): the card heading used to sit on the same flat
      // surface as the card body (plain uppercase text, no fill) — stamp it like every other badge so it
      // reads as its own coloured pill instead of blending into the shade behind it (CSS side: Tokens.css).
      ccAppsStamp(".cc-ca-cardtitle, li.cc-card-in.sectionMenu");
      ccAppsStamp(".ca_bottomLine .actionsButton, .ca_bottomLine .caButton");
      // #8 (user: "die buttons ganz unten sind nicht in die farbmodi integriert"): the bottom action bar
      // (.multi_installDiv) was styled as a badge row but never STAMPED, so --cc-rb-c never reached it and
      // it could only ever paint the neutral chip. Stamped like every other Apps badge, it takes the accent
      // in Normal mode and its own jewel position in Rainbow; the reactive rule then handles the rest state.
      ccAppsStamp(".multi_installDiv input[type='button'], .multi_installDiv input[type='submit']");
      ccAppsCornerMarks();
      // (#9) subtitle -> (i) bubble on the header, keep SHOW MORE inline, retire the body-text line.
      var heads = document.querySelectorAll(".ca_homeTemplatesHeader:not([data-cc-info])");
      for (var h = 0; h < heads.length; h++) {
        var head = heads[h]; head.setAttribute("data-cc-info", "1");
        // #9 wrap the bare title text in its own element so it can carry a fill BADGE (an anonymous flex
        // text-run is unstylable); the (i) bubble + SHOW MORE stay siblings in the transparent flex row.
        if (!head.querySelector(".cc-sechead-badge")) {
          var tb = document.createElement("span"); tb.className = "cc-sechead-badge";
          while (head.firstChild) tb.appendChild(head.firstChild);
          head.appendChild(tb);
        }
        var line2 = head.nextElementSibling;
        if (!line2 || !/\bca_homeTemplatesLine2\b/.test(line2.className || "")) continue;
        var more = line2.querySelector(".homeMore"), sub = "";
        for (var n = 0; n < line2.childNodes.length; n++) { var nd = line2.childNodes[n]; if (nd.nodeType === 3) sub += nd.textContent; }
        sub = sub.trim();
        // #5: the horizontal-scroll hint. Corrected — it works ONLY with the right mouse button held down,
        // not with the wheel, and it gets its own paragraph so it doesn't drown in the section text.
        if (sub) sub += "\n\n" + T("Tipp: seitlich scrollen mit gedrückter rechter Maustaste.",
                                   "Tip: scroll sideways with the right mouse button held down.");
        if (sub) head.appendChild(ccMakeInfo(sub));
        if (more) head.appendChild(more);     // SHOW MORE now rides inside the section badge
        line2.style.display = "none";
      }
      // AFTER the loop: the alignment passes read each row's SHOW MORE / title badge, which only exist inside
      // the header once the loop above has built them. Calling them earlier made them silent no-ops on first paint.
      ccAppsAlignRight();
      ccAppsAlignTop();
    } catch (e) {}
  }
  var ccAppsObs = null, ccAppsT = 0;
  function ccAppsSoon() { if (ccAppsT) return; ccAppsT = setTimeout(function () { ccAppsT = 0; ccApps(); }, 60); }
  function ccAppsBoot() {
    try {
      if (!/^\/Apps(\/|$)/.test(location.pathname)) return;
      ccApps();
      document.addEventListener("click", function (e) {
        if (e.target && e.target.closest && e.target.closest(".caMenuItem, .homeMore, .sortIcons, .searchSubmit, #searchButton")) ccAppsSoon();
      }, true);
      // the measured right gutter moves with the viewport, so re-measure on resize — without this the padding
      // stays frozen at whatever the last pass computed and SHOW MORE drifts off the icon gutter again (seen
      // live: exact at the measured width, 15px off after a resize). rAF-throttled, writes one style prop.
      var arRaf = 0;
      window.addEventListener("resize", function () {
        if (arRaf) return;
        function pass() { arRaf = 0; ccAppsAlignRight(); ccAppsAlignTop(); setTimeout(function () { ccAppsAlignRight(); ccAppsAlignTop(); }, 120); }
        arRaf = window.requestAnimationFrame ? window.requestAnimationFrame(pass) : setTimeout(pass, 16);
      }, { passive: true });
      // #15 (found chasing the "Results Per Page/DockerHub never relocate on cold load" bug): this used to
      // call ccApps() only on the FIRST tick where #templates_content exists (`!ccAppsObs` guards it to
      // once) — every later tick just counted down. That is fine for anything the #templates_content
      // observer already covers, but .searchArea (Results Per Page, DockerHub, the pager, Sort By) lives
      // OUTSIDE #templates_content entirely (verified live: templatesContent.contains(searchArea) === false)
      // and often finishes rendering LATER than the first tick, since CA's feed load is async — so its own
      // late appearance was invisible to both the one-shot call and the observer. ccApps() is already
      // idempotent (its own comment says it "re-runs on every category/click"), so calling it every tick
      // for the same bounded 4.5s window is cheap and closes the gap without a second observer.
      var k = 0, t = setInterval(function () {
        var tc = document.getElementById("templates_content");
        if (tc && !ccAppsObs) { ccAppsObs = new MutationObserver(ccAppsSoon); ccAppsObs.observe(tc, { childList: true, subtree: false }); }
        ccApps();
        if (++k >= 15) clearInterval(t);
      }, 300);
    } catch (e) {}
  }

  function boot() {
    try { window.ccHeaderApply = apply; } catch (e) {} // let the Settings page live-update this bar same-page
    apply();
    ccWhatsNew();
    // re-settle the header geometry after fonts/layout finish + on resize (the pill edge shifts with the
    // viewport/font). #10 + #15: the brand and the docked bell can land off during the FIRST paint (a
    // load-transient) before the anchor is measured — re-run the FULL settle (anchor + brand + dock),
    // not just measureAlign, on rAF AND on load, so any early misalignment self-corrects once layout is
    // stable. Idempotent (diff-writes), so the extra passes are cheap.
    function reSettle() { try { measureAlign(); ccBrand(); ccDockProfile(); } catch (e2) {} }
    try {
      if (window.requestAnimationFrame) window.requestAnimationFrame(reSettle);
      window.addEventListener("resize", measureAlign);
      window.addEventListener("load", reSettle);
    } catch (e) {}
    watchSearch();
    wireSearchToggle();
    ccAppsBoot();     // #7/#8/#9/#11: /Apps colour-mode stamping + subtitle bubble (self-gated to /Apps)
    // #11 ROOT CAUSE (agent-diagnosed): the docked #UserProfile (position:fixed, z above #menu) overlapped the
    // help icon and ATE the real mouse click — a synthetic click bypasses hit-testing, which is why it "worked"
    // in tests but never for a real click. Fix A (Header.css) makes the dock click-through. Fix B here is belt-
    // and-suspenders: if e.target isn't the help icon (some future overlay), hit-test the pointer's element
    // STACK for it; and bind pointerup too so the >300ms nav-drag path (where `click` may not fire after
    // setPointerCapture) still toggles. After toggling ON with no visible .inline_help, surface a toast.
    var ccHelpBusy = 0;
    function ccHelpTrigger(e) {
      try {
        if (!document.documentElement.classList.contains("cc-header-on")) return;
        var h = e.target && e.target.closest ? e.target.closest("#menu .nav-item.HelpButton") : null;
        if (!h && e.clientX != null && document.elementsFromPoint) {   // overlay-proof: scan the hit stack
          var stk = document.elementsFromPoint(e.clientX, e.clientY);
          for (var s = 0; s < stk.length; s++) { if (stk[s].closest && stk[s].closest("#menu .nav-item.HelpButton")) { h = stk[s]; break; } }
        }
        if (!h) return;
        if (ccHelpBusy && Date.now() - ccHelpBusy < 400) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // debounce click+pointerup double-fire
        ccHelpBusy = Date.now();
        e.preventDefault(); e.stopImmediatePropagation();
        if (typeof window.HelpButton !== "function") { ccToast(T("Hilfe ist auf dieser Seite nicht verfügbar.", "Help is not available on this page.")); return; }
        window.HelpButton();
        // NO "no inline help" toast (user: "der Hilfe-Button funktioniert nicht, kommt keine Inline-Hilfe"). On pages
        // like the Docker list the native .inline_help blocks live in a display:none template container (there is
        // genuinely nothing to show), and on Tools/Settings pages CC already moved the help into the (i) bubbles.
        // The toast fired on exactly those pages and only annoyed. Help now behaves like native: it shows help where
        // the page actually has it, and does nothing (silently) where it does not.
      } catch (err) {}
    }
    try { document.addEventListener("click", ccHelpTrigger, true); document.addEventListener("pointerup", ccHelpTrigger, true); } catch (e) {}
    // #S6: Ctrl/⌘+K opens the command palette (skip when typing in a field, and when CC theming is off)
    try {
      document.addEventListener("keydown", function (e) {
        if (!((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K"))) return;
        if (g("cc.theming", "1") === "0") return;
        var t = e.target, tag = t && t.tagName;
        if ((tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) && !(t.classList && t.classList.contains("cc-cmd-in"))) return;
        e.preventDefault(); e.stopPropagation(); ccCmdOpen();
      }, true);
    } catch (e) {}
    // #16 ROUND 5: each trigger is now a REAL CHILD of its in-flow proxy (reparent model, see the dock
    // code) — it reflows with the row natively, no JS position tracking needed, so no scroll listener at
    // all any more (that was the source of the scroll-lag complaint: JS mirroring a compositor-positioned
    // sticky element is always at least one frame behind). Keep only a cheap, idempotent resize pass —
    // covers a genuine DOM change (icons appearing/disappearing/reordering across a breakpoint), not a
    // per-frame position fix.
    try { window.addEventListener("resize", function () { try { ccDockProfile(); } catch (e2) {} }); } catch (e) {}
    // #14 (user: "wenn man das fenster breiter zieht, ziehen Insel/Icons/Pfeile nach rechts weg"): with
    // Theme--width-boxed the CONTENT is capped (~1920px) and LEFT-aligned, but the full-width header island,
    // the #menu util icons and the fixed footer arrows ride to the VIEWPORT edge → a gap that GROWS with the
    // window. Publish the content-right gap (viewport - #displaybox.right) as --cc-content-rgap; the sheet pulls
    // those three back to the content edge via calc(). rAF-throttled, sets ONLY a CSS var (no DOM mutation →
    // freeze-safe, no observer loop). Fluid width -> gap 0 -> no-op.
    try {
      var ccGapRaf = 0;
      function ccContentGap() {
        ccGapRaf = 0;
        try {
          var db = document.getElementById("displaybox");
          var vw = document.documentElement.clientWidth;   // layout width EXCLUDING the vertical scrollbar (innerWidth would over-count by ~scrollbar)
          var r = db ? db.getBoundingClientRect().right : vw;
          var gap = Math.max(0, Math.round(vw - r));
          document.documentElement.style.setProperty("--cc-content-rgap", gap + "px");
        } catch (e) {}
      }
      function ccGapSchedule() { if (ccGapRaf) return; ccGapRaf = window.requestAnimationFrame ? window.requestAnimationFrame(ccContentGap) : setTimeout(ccContentGap, 16); }
      window.addEventListener("resize", ccGapSchedule, { passive: true });
      window.addEventListener("load", ccContentGap);
      ccContentGap();
      setTimeout(ccContentGap, 300);   // once more after the boxed layout settles
    } catch (e) {}
    // the Settings page (or the Docker tab) writes cc.* AND section-specific keys (cch./ccs./
    // ccp./ccv.) from another origin/tab — re-apply on any of them. NB: "cch.accent" does NOT
    // contain the substring "cc." so the old indexOf("cc.")===0 check silently missed it.
    try { window.addEventListener("storage", function (e) { if (e && e.key && e.key !== "cc.stateCache" && /^cc[a-z]*\./.test(e.key)) apply(); }); } catch (e) {} // cc.stateCache EXCLUDED: docker.js rewrites it every 9s, which would repaint this area on a 9s loop in every other open tab
    // the notification Sheet mounts INSIDE .unapi (not a body child), so the body popup-observer
    // can miss it — poll ccNotifActions a few times after a click on the docked bell/profile so our
    // "Alle löschen" button lands as soon as the sheet appears. Idempotent, cheap (only after clicks).
    try {
      document.addEventListener("click", function (e) {
        try { if (e.target && e.target.closest && e.target.closest("#UserProfile, [data-cc-trig]")) { var n = 0, t = setInterval(function () { ccNotifActions(); try { ccPopoverDim(); } catch (ed) {} try { ccPaintRotate(); } catch (ep) {} try { ccAcctMenu(); } catch (ea) {} if (++n >= 8) clearInterval(t); }, 180); } } catch (err) {}
      }, true);
    } catch (e) {}
    // #21 backdrop sync: the bell Sheet mounts inside .unapi (not a body child), so the body popup
    // observer misses its OPEN and CLOSE. Re-evaluate #cc-pop-dim after any click or Escape: ccPopoverDim()
    // shows it while a popover is open and self-hides when none is. A few deferred passes cover the Sheet's
    // mount delay. Cheap + freeze-safe: no persistent polling, no new observers.
    try {
      var ccDimSync = function () { [0, 100, 300, 600].forEach(function (ms) { setTimeout(function () { try { ccPopoverDim(); } catch (e) {} }, ms); }); };
      document.addEventListener("click", ccDimSync, true);
      document.addEventListener("keydown", function (e) { if (e && e.key === "Escape") ccDimSync(); }, true);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

/* ═══ #4: SYSTEM-WIDE LOADER injection ═══════════════════════════════════════════════════════════════════
   Inject the CC loader markup (.cc-loader, styled in Tokens.css) into Unraid's full-screen tab-load spinner
   (div.spinner.fixed), replacing the stock red Unraid mark. Exposes window.ccMakeLoader so the app-tab
   "UPDATING CONTENT" dialog (#2) and the plugin-install view (#3) can drop in the SAME loader. Appended as a
   separate IIFE so it is fully isolated from the main header logic above. */
(function () {
  // ONE factory. tier is "full" | "dlg" | "sm" | "xs" (Tokens.css .cc-load-* classes); every size lives in
  // the CSS tokens, nothing here ever writes --cc-load-sz inline, so no sheet has to out-!important a call
  // site and no call site can invent a number the tier system does not know.
  function ccLoader(tier) {
    var w = document.createElement("span"); w.className = "cc-loader cc-load-" + (tier || "dlg");
    w.setAttribute("role", "status"); w.setAttribute("aria-live", "polite");
    w.innerHTML = '<span class="o"><i></i></span><span class="in"><i></i></span>';
    return w;
  }
  // idempotent: at most one ring per host, ever — re-tiers an existing ring instead of appending a second.
  function ccMountLoader(host, tier) {
    try {
      if (!host) return null;
      var l = host.querySelector(".cc-loader");
      if (l) { l.className = "cc-loader cc-load-" + (tier || "dlg"); return l; }
      l = ccLoader(tier); host.appendChild(l); return l;
    } catch (e) { return null; }
  }
  function ccUnmountLoader(host) {
    try { var l = host && host.querySelector(".cc-loader"); if (l && l.parentNode) l.parentNode.removeChild(l); } catch (e) {}
  }
  try {
    window.ccLoader = ccLoader; window.ccMountLoader = ccMountLoader; window.ccUnmountLoader = ccUnmountLoader;
    window.ccMakeLoader = function () { return ccLoader("dlg"); };   // back-compat shim for any external caller
  } catch (e) {}

  // #4/#15h THE ARBITER — decides from REAL computed state which fullscreen loader (if any) is genuinely on
  // screen, mounts exactly one ring there, dedupes every other div.spinner, and stamps html.cc-loading
  // (+ data-cc-load) so ONE scroll-lock rule (Tokens.css) covers every phase: the Unraid tab-load overlay,
  // the CA "Updating Content" dialog, and the Docker container-update window (#cc-ctout-bd) alike — closing
  // the gap where only the CA dialog was locked and a plain tab load still left the page scrollable behind
  // the ring (user, still open after the dialog-only fix: "der scrollbalken rechts ist immer noch da").
  // #freeze (live-reported, v3.6.5): an earlier version attached a MutationObserver to the .fixed overlay
  // itself (attributeFilter style/class) to re-run this the instant its display flips. If Unraid's OWN native
  // code touches that same element's style/class repeatedly, each touch retriggers this function, which is
  // not provably loop-free and pegs the CPU under load -> a frozen tab. This function is READ-ONLY
  // (getComputedStyle) plus idempotent diff-writes, called from a plain bounded-nowhere setInterval below —
  // a timer callback cannot recursively re-trigger itself the way a self-observing attribute observer can.
  function ccLoadState() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var root = document.documentElement;
      var swal = document.querySelector(".sweet-alert.cc-only-loader");
      var swalOn = !!(swal && getComputedStyle(swal).display !== "none");
      var ctout = document.getElementById("cc-ctout-bd");
      var ctoutOn = !!(ctout && getComputedStyle(ctout).display !== "none");

      var sps = document.querySelectorAll("div.spinner");
      var fixedUp = null, inPageUp = null;
      for (var i = 0; i < sps.length; i++) {
        var s = sps[i];
        if (getComputedStyle(s).display === "none") continue;
        if (s.classList.contains("fixed")) { if (!fixedUp) fixedUp = s; }
        else if (!inPageUp) inPageUp = s;
      }
      // cc-spin-active is the ONLY thing that lets an in-page spinner become a fullscreen overlay
      // (Tokens.css) — never forced blind on every div.spinner:not(.fixed) that merely EXISTS, which is
      // what stranded Settings > System Temperature under a permanent dimmed overlay before this pass: that
      // rule fired on ANY such element regardless of whether Unraid meant it visible, because
      // :not([style*="display: none"]) reads "shown" for a node that has never had an inline style written
      // yet — exactly the state at page load.

      // ONE ring, ONE elected host, in PRIORITY order: swal > ctout > fixed > in-page div.spinner. LIVE
      // PROOF this priority is not optional: on /Apps the tab-load overlay (div.spinner.fixed) and CA's own
      // "Updating Content" dialog (.sweet-alert.cc-only-loader) are BOTH genuinely showing on almost every
      // real load — CA opens that dialog itself while its feed refreshes. ccUpdatingSwal() used to mount its
      // OWN ring into the dialog's <p> independently of whatever this div.spinner loop decided, so the two
      // systems never knew about each other and painted two rings at once — reproducing the exact "doppelter
      // Spinner" bug this engine exists to prevent, just from a second, uncoordinated mounting path instead
      // of the original's. ccUpdatingSwal() now only does its non-ring housekeeping (hiding the swal's own
      // icon, tagging cc-only-loader); this is the ONE place that ever calls ccMountLoader/ccUnmountLoader.
      var swalMark = swal ? swal.querySelector(".updateContent-swal") : null;
      var swalHost = swalMark ? swalMark.parentNode : null;   // the <p> the ring sits above (insertBefore, not append)
      var elected = swalOn ? swalHost : ctoutOn ? null : (fixedUp || inPageUp);

      if (swalHost) {
        if (elected === swalHost) { if (!swalHost.querySelector(".cc-loader")) { var sl = ccLoader("full"); sl.style.display = "block"; sl.style.margin = "6px auto 14px"; swalHost.insertBefore(sl, swalMark); } }
        else ccUnmountLoader(swalHost);
      }
      for (var j = 0; j < sps.length; j++) {
        var sp = sps[j];
        var spElected = (elected === sp);
        sp.classList.toggle("cc-spin-dupe", !spElected && !!(fixedUp || inPageUp) && !swalOn);
        sp.classList.toggle("cc-spin-active", !!(spElected && !sp.classList.contains("fixed")));
        if (spElected) ccMountLoader(sp, "full"); else ccUnmountLoader(sp);
      }

      var mode = swalOn ? "swal" : ctoutOn ? "ctout" : (fixedUp || inPageUp) ? "fixed" : null;
      root.classList.toggle("cc-loading", !!mode);
      if (mode) root.setAttribute("data-cc-load", mode); else root.removeAttribute("data-cc-load");
    } catch (e) {}
  }
  try { window.ccLoadState = ccLoadState; } catch (e) {}

  /* #2: the CA "Updating Content" dialog (Apps.page → myAlert, content carries a unique `.updateContent-swal`
     marker span) is a SweetAlert1 `.sweet-alert` appended as a DIRECT child of <body>. Hide the stock swal
     info-icon and tag the shell so CSS/ccLoadState know a loader-only dialog is up. Detection keys on the
     marker span, so it never fires on any OTHER swal.
     RING PLACEMENT LIVES IN ccLoadState() NOW, NOT HERE (found live: on /Apps the tab-load overlay and this
     very dialog are BOTH genuinely showing on almost every real load, and this function used to mount its
     OWN ring independently of whatever the div.spinner arbiter decided — two uncoordinated mounting paths,
     two rings at once, the exact "doppelter Spinner" bug this engine exists to prevent). This function only
     does the housekeeping ccLoadState needs already done before IT decides where the one ring goes. */
  function ccUpdatingSwal() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var mark = document.querySelector(".updateContent-swal");
      var box  = mark ? ((mark.closest && mark.closest(".sweet-alert")) || mark.parentElement)
                      : document.querySelector(".sweet-alert.cc-only-loader");
      // SweetAlert1 REUSES one .sweet-alert node for every dialog: stamp cc-only-loader ONLY while the
      // update-content marker is present, and strip it the moment the node is reused for anything else.
      if (box) box.classList.toggle("cc-only-loader", !!mark);
      if (!mark || !box) return;
      var icon = box.querySelector(".sa-icon"); if (icon) icon.style.display = "none";
    } catch (e) {}
  }

  /* #3: the plugin install / update / downgrade dialog (openPlugin/openBox in Unraid's shared layout) is a
     SweetAlert1 whose title carries a unique `#pluginProgressTitle` span with a stock `fa-refresh fa-spin`.
     Swap that spin for a small inline CC loader. On completion Unraid calls $('#pluginProgressTitle').text(...)
     ("Finished"/"Error"), which REPLACES the span content — so the injected loader is auto-removed, no cleanup
     observer needed. Keyed on the unique id, so it only ever touches the install/update dialog. */
  function ccPluginSwal() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var t = document.getElementById("pluginProgressTitle");
      if (!t || t.querySelector(".cc-loader")) return;
      var fa = t.querySelector("i.fa"); if (fa) fa.style.display = "none";
      var l = ccLoader("xs");   // inline ring replacing a glyph in a title line
      l.style.display = "inline-block"; l.style.verticalAlign = "middle"; l.style.marginLeft = "8px";
      t.appendChild(l);
    } catch (e) {}
  }

  function ccSwalScan() { ccUpdatingSwal(); ccPluginSwal(); }

  /* Attach a SCOPED observer to the SweetAlert1 shell. SweetAlert1 creates `.sweet-alert` ONCE and REUSES it
     (toggling a `visible`/`show-sweet-alert` CLASS to open) instead of re-adding it — so a body-childList
     observer only catches the FIRST dialog, not repeat shows. Watching the small `.sweet-alert` element's
     `class` attribute catches EVERY open, and content (marker span / #pluginProgressTitle) is already in place
     when the class flips. This element is tiny (title/text/buttons) — nothing like the app-card tree that froze
     the tab under a body subtree observer, and we deliberately watch attributes ONLY (no childList/subtree), so a
     streaming install log never generates mutation noise here. */
  function ccAttachSwalObs() {
    try {
      var shells = document.querySelectorAll(".sweet-alert, .swal-modal, .swal2-popup");
      for (var i = 0; i < shells.length; i++) {
        var sa = shells[i];
        if (sa.__ccSwalObs) continue;
        sa.__ccSwalObs = new MutationObserver(ccSwalScan);
        sa.__ccSwalObs.observe(sa, { attributes: true, attributeFilter: ["class"] });
      }
    } catch (e) {}
  }

  var ccBodyObs = null;
  function ccWatchBodyForSwal() {
    // FREEZE-PROOF: observe ONLY <body>'s DIRECT children (subtree:false), purely to notice the FIRST time a swal
    // shell is added so we can attach the scoped observer above. NEVER add subtree here — that fires on the
    // thousands of deep app-card mutations that froze the CA tab in an earlier attempt.
    try {
      if (ccBodyObs || !document.body) return;
      ccBodyObs = new MutationObserver(function () { ccAttachSwalObs(); ccSwalScan(); });
      ccBodyObs.observe(document.body, { childList: true, subtree: false });
    } catch (e) {}
  }

  // #29 (user: "die footer pfeile werden wenn man ganz unten ist nicht entsprechend ausgeblendet"):
  // dynamix.js natively fades a.back_to_top OUT at the TOP of the page via jQuery fadeIn/fadeOut, but ships
  // no equivalent for a.move_to_end at the BOTTOM. Tried mirroring that exact jQuery mechanism first —
  // dropped it after live-tracing: something (unclear what, possibly this animation engine's own rAF-tick
  // cleanup fighting a scroll/resize-driven re-trigger, reproduced even with a same-state guard in place and
  // .stop(true) before every call) kept resetting a completed fadeOut's display:none back to an opacity
  // value within ~50ms, so the arrow never actually stayed hidden. A CSS class + opacity/pointer-events
  // transition sidesteps the whole animation-queue class of problem: no display toggling, no JS per-frame
  // ticks to fight, just one idempotent class flip Tokens.css reacts to.
  var ccFooterBottomState = null;
  function ccFooterArrowsBottom() {
    try {
      var atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 2);
      if (atBottom === ccFooterBottomState) return;
      ccFooterBottomState = atBottom;
      document.documentElement.classList.toggle("cc-footer-at-bottom", atBottom);
    } catch (e) {}
  }
  function ccLoaderBoot() {
    ccLoadState();
    ccAttachSwalObs();
    ccSwalScan();          // in case a dialog is already open on load
    ccWatchBodyForSwal();
    ccFooterArrowsBottom();                                                 // correct initial state (e.g. a page shorter than the viewport)
    window.addEventListener("scroll", ccFooterArrowsBottom, { passive: true });
    window.addEventListener("resize", ccFooterArrowsBottom);
    // #4 (found chasing "der scrollbalken rechts ist immer noch da"): this used to be a BOUNDED 12x350ms
    // retry (4.2s), which could only ever repair the first few seconds of a page's life — any loader that
    // opened later (a plugin install triggered minutes into a session, a Docker update window) never got
    // ccLoadState's scroll-lock applied at all. A PERMANENT heartbeat closes that, and is safe where the old
    // documented freeze (#freeze above) was not: that freeze came from a MutationObserver whose callback
    // could be RE-ENTERED by the very DOM writes it was watching (self-observing attributeFilter on a node
    // Unraid's own code churns). A plain setInterval callback cannot re-enter itself — each tick is a fresh,
    // browser-scheduled call — and ccLoadState() only ever calls getComputedStyle (read) plus idempotent
    // class/attribute diffs (writes only when the value actually changes), so there is no path back into
    // itself. Paused via document.hidden so a backgrounded tab does no work at all.
    // 60ms (was 200ms) — matches the nchan restyle debounce elsewhere in this file. #22 (user screenshot: a
    // vertical scrollbar next to the spinner "hüpft die ganze Zeit"): CA's catalog fetch toggles its loading
    // indicators through several phases, and every poll gap around a toggle was a moment html.cc-loading's
    // scroll-lock sat off while content height was still changing. The Tokens.css scrollbar-gutter fix is the
    // real fix (timing-independent), this just shrinks the worst-case lock-latency for every cc-loading
    // consumer, at the same getComputedStyle-read-only cost that made the 200ms interval provably freeze-safe.
    setInterval(function () { if (!document.hidden) { ccLoadState(); ccAttachSwalObs(); } }, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ccLoaderBoot); else ccLoaderBoot();
})();

/* #5: RMB-hold + wheel = horizontal scroll (system-wide). Hold the right mouse button and spin the wheel to
   scroll ANY horizontal overflow container sideways (deltaY -> scrollLeft), e.g. the .ca_homeTemplates app rows.
   The context menu is swallowed only for that gesture (once the wheel actually moved a row), so a plain
   right-click still opens the browser menu elsewhere. Shift+wheel is wired as a bonus. Capture-phase listeners
   only, ZERO observers -> freeze-safe. */
(function () {
  "use strict";
  var rmbDown = false, rmbUsed = false, clearT = 0;
  function hScroller(node) {
    for (var el = node; el && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollWidth - el.clientWidth > 2) {
        var ov = "";
        try { ov = getComputedStyle(el).overflowX; } catch (e) {}
        if (ov === "auto" || ov === "scroll") return el;
      }
    }
    return null;
  }
  document.addEventListener("mousedown", function (e) {
    if (e.button === 2) { rmbDown = true; rmbUsed = false; if (clearT) { clearTimeout(clearT); clearT = 0; } }
  }, true);
  document.addEventListener("mouseup", function (e) {
    if (e.button === 2) {
      rmbDown = false;
      if (rmbUsed) { if (clearT) clearTimeout(clearT); clearT = setTimeout(function () { rmbUsed = false; clearT = 0; }, 350); }
    }
  }, true);
  document.addEventListener("wheel", function (e) {
    if (e.ctrlKey) return;                       // leave pinch/zoom alone
    if (!rmbDown && !e.shiftKey) return;         // only our two gestures
    var d = e.deltaY || e.deltaX; if (!d) return;
    var sc = hScroller(e.target); if (!sc) return;
    sc.scrollLeft += d;
    e.preventDefault();
    if (rmbDown) rmbUsed = true;
  }, { capture: true, passive: false });
  document.addEventListener("contextmenu", function (e) {
    if (rmbDown || rmbUsed) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
