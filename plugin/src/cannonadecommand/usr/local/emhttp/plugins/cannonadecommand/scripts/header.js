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
    } catch (e) {}
  }
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
        var isStream = (/in\s*progress|wird\s+(aktualisiert|installiert|erstellt|neu\s*erstellt|gezogen|gestartet)|updating|installing|pulling|creating/i.test(raw) || !!sa.querySelector("fieldset.CMD, fieldset.docker")) && !sa.querySelector("table.info");
        if (isStream) {
          // Recompute STATELESSLY each pass so a fresh window ALWAYS starts as RUN (loader) and never inherits a
          // stale "done". Flip to DONE only when the log reports completion AND the stream has SETTLED (no new
          // output for ~700ms) — so the check never appears mid-run (e.g. right after "erfolgreich ausgeführt"
          // while an orphaned image is still being removed). No mutations fire once the stream stops, so arm a
          // one-shot re-check to let the check appear after the tail settles.
          var finishTxt = /(erfolgreich (ausgeführt|beendet)|successfully|command (finished|completed|executed)|finished)/i.test(sa.textContent || "");
          var len = (sa.textContent || "").length;
          if (sa.__ccLen !== len) { sa.__ccLen = len; sa.__ccGrow = Date.now(); }
          if (finishTxt && (Date.now() - (sa.__ccGrow || 0)) > 700) { sa.dataset.ccState = "done"; }
          else { sa.dataset.ccState = "run"; if (finishTxt) { clearTimeout(sa.__ccSettleT); sa.__ccSettleT = setTimeout(function () { try { ccNchanStyle(); paintPopups(); } catch (e) {} }, 750); } }
        } else { sa.dataset.ccState = ""; }
        var state = sa.dataset.ccState || "";
        sa.classList.toggle("cc-nchan-loading", state === "run");
        sa.classList.toggle("cc-nchan-done", state === "done");
        // strip the status suffix from the title so the badge shows only the clean name
        var clean = raw.replace(/\s*[-–—]\s*(IN\s*PROGRESS|FINISHED)\b[\s\S]*$/i, "").replace(/\s+$/, "");
        if (clean && clean !== raw && h2.textContent !== clean) h2.textContent = clean;
        var oldspin = h2.querySelector(".cc-nchan-spin"); if (oldspin) oldspin.remove();   // kill any legacy in-badge spinner
        // bottom-left STATUS BADGE (no text): a spinning ring while RUNNING, a green circle-check when DONE
        var loader = sa.querySelector(".cc-nchan-loader");
        if (state === "run" || state === "done") {
          if (!loader) {
            loader = document.createElement("span"); loader.className = "cc-nchan-loader"; loader.setAttribute("role", "status");
            // anchor the loader to the BUTTON ROW, not the sweet-alert itself: the alert is often far taller than
            // its content, so a bottom-anchored loader landed way BELOW the buttons instead of beside them (user).
            var _cb = sa.querySelector("button.confirm, button.cancel");
            (sa.querySelector(".sa-button-container") || (_cb && _cb.parentElement) || sa).appendChild(loader);
          }
          if (state === "done") {
            if (loader.getAttribute("data-cc-mode") !== "done") { loader.setAttribute("data-cc-mode", "done"); loader.classList.add("cc-nchan-check"); loader.setAttribute("aria-label", T("Fertig", "Done")); loader.innerHTML = "<svg viewBox='0 0 24 24' aria-hidden='true'><circle class='cc-ck-c' cx='12' cy='12' r='10.5'/><path class='cc-ck-p' d='M6.5 12.5l3.6 3.6L17.5 8.8'/></svg>"; }
          } else if (loader.getAttribute("data-cc-mode") !== "run") {
            loader.setAttribute("data-cc-mode", "run"); loader.classList.remove("cc-nchan-check"); loader.setAttribute("aria-label", T("Läuft…", "Working…")); loader.innerHTML = "<i class='fa fa-refresh fa-spin cc-nchan-fa' aria-hidden='true'></i>";  // RUN = white spinning fa-refresh, IDENTICAL to the fa-refresh fa-spin Unraid puts on a busy/updating container logo (user: align the two)
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
      var pop = document.querySelector(".bg-popover");
      var dim = document.getElementById("cc-pop-dim");
      if (!pop) { if (dim) dim.style.display = "none"; return; }
      if (!dim) {
        dim = document.createElement("div"); dim.id = "cc-pop-dim";
        dim.addEventListener("pointerdown", function () { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        document.body.appendChild(dim);
      }
      // sit just under the popover's stacking context so the menu stays crisp above the blur
      var wrap = pop.closest("[data-reka-popper-content-wrapper]") || pop;
      var pz = parseInt(getComputedStyle(wrap).zIndex, 10); if (!isFinite(pz)) pz = 50;
      dim.style.zIndex = String(Math.max(1, pz - 1));
      dim.style.display = "block";
    } catch (e) {}
  }
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
    return ((a.getAttribute("href") || a.getAttribute("onclick") || a.getAttribute("title") || "") + "").slice(0, 160) || null;
  }
  // storage: cc.navorder.all = {left:[keys], right:[keys]} — each tile's own sequence INCLUDING
  // items dragged over from the other side. One-time fallback-migration from the old zone keys.
  function navReadAll() {
    try { var o = JSON.parse(g("cc.navorder.all", "null")); if (o && o.left && o.right) return o; } catch (e) {}
    try {
      var l = JSON.parse(g("cc.navorder", "null")) || [], r = JSON.parse(g("cc.navorder.right", "null")) || [];
      if (l.length || r.length) return { left: l, right: r };
    } catch (e2) {}
    return null;
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
      try { ccDockProfile(); } catch (eD) {}                      // re-pin bell/burger over their proxies (arrange enter hides them, exit re-overlays at the new order)
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
  function ccStopLive() { if (ccLiveSubs) { ccLiveSubs.forEach(function (s) { try { s.stop(); } catch (e) {} }); ccLiveSubs = null; } ccLiveRam = ccLiveRamUsed = ccLiveCpu = ccLiveDocker = ""; }
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
      var verNum = "";
      var verElN = document.querySelector('unraid-header-os-version span[id^="reka-menu-trigger"]');
      if (verElN) verNum = ((verElN.textContent) || "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "");
      // #18 (user): also show the count of NON-running containers. /sub/dockerload only carries RUNNING ones,
      // so the total comes from the cross-page cc.stateCache (docker.js caches the full /api/state list).
      var dockRun = parseInt(ccLiveDocker, 10) || 0, dockTot = 0;
      try { var csD = JSON.parse(g("cc.stateCache", "null")); if (csD && csD.containers && csD.containers.length) dockTot = csD.containers.length; } catch (eD) {}
      var dockStop = dockTot > dockRun ? dockTot - dockRun : 0;
      var items = "u" + (iOn("uptime") ? 1 : 0) + "o" + (iOn("os") ? 1 : 0) + "v" + (iOn("version") ? 1 : 0) + "a" + (iOn("array") ? 1 : 0) + "f" + (iOn("fill") ? 1 : 0) + "r" + (iOn("ram") ? 1 : 0) + "c" + (iOn("cpu") ? 1 : 0) + "d" + (iOn("containers") ? 1 : 0) + "t" + (iOn("temps") ? 1 : 0) + "|dt" + dockTot;
      // idempotence guard: nchan rewrites the footer every few seconds with UNCHANGED text most
      // of the time — compare the source signature and skip the DOM rebuild when nothing moved
      // (bar width/colour + the item toggles included so a change always redraws)
      var sig = upTxt + "|" + upTitle + "|" + osLabel + "|" + verNum + "|" + raw + "|" + temps.join(",") + "|" + warn + "|" + usage + "|" + uw + uc + "|" + (par ? par[0] : "") + "|" + ccLiveRam + "/" + ccLiveRamUsed + "/" + ccLiveCpu + "/" + ccLiveDocker + "|" + items;
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
          var key = ccIslKey(chip), url = key ? (CC_ISL_NAV[key] || (/^temp/.test(key) ? "/Dashboard" : null)) : null;
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
      // disk DEVICE pages: Unraid's form has an EMPTY structural <dt> before each real label; the resolver above
      // appended some (i) icons to THAT empty dt, leaving a stray icon-only dt that broke the CC grid (3 items on
      // some rows). Fold each standalone icon into the following label dt so every row reads label|value.
      if (document.documentElement.classList.contains("cc-diskpage")) {
        var carriers = document.querySelectorAll("#displaybox dl > dt > .cc-toolsinfo");
        for (var ck = 0; ck < carriers.length; ck++) {
          var cic = carriers[ck], cdt = cic.parentElement;
          if ((cdt.textContent || "").replace(/[\sⓘ]/g, "")) continue;              // dt already carries a label -> icon is fine
          var nlab = cdt.nextElementSibling;
          while (nlab && nlab.tagName === "DT" && (getComputedStyle(nlab).display === "none" || !(nlab.textContent || "").trim())) nlab = nlab.nextElementSibling;
          if (nlab && nlab.tagName === "DT") { nlab.appendChild(cic); cdt.style.display = "none"; }
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
          ccDockProfile();         // auto-mount replaced div#UserProfile -> the fresh node needs its dock styles again (diff-written, attribute-only: this observer ignores them)
        }, 120);
      });
      ccProfObs.observe(p, { childList: true, subtree: true, characterData: true });
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
  // ── BELL + BURGER DOCK (user call: the two profile triggers join the MENU icon row at its FAR
  // RIGHT END, freeing the whole top strip for the island). div#UserProfile lives INSIDE the
  // Connect component, so it is never MOVED in the DOM (law — auto-mount rebuilds would wipe it);
  // it is PINNED with inline styles instead: position:fixed, left = 8px RIGHT of the row's last
  // visible item — the .nav-tile.right 84px padding-right (Header.css) reserves the room, and the
  // Plugins-button pin (plugins.js) includes the docked pair in its right-edge measurement.
  // Diff-written styles are attribute-only mutations, which the childList-only profile observer
  // ignores -> no loop. Re-measured on apply()/scroll/resize/menu+profile passes.
  var ccDockProps = ["position", "left", "right", "top", "height", "width", "z-index", "padding", "min-width"];
  var ccDockRaf = 0;
  function ccDockPass() { ccDockRaf = 0; ccDockProfile(); }
  // ── #(user: "die beiden icons (benachrichtigungen und menü) kleben aneinander, hüpfen beim Resize und
  // lassen sich im Drag&Drop nicht anderswo anordnen"). ROOT CAUSE: the old dock pinned the WHOLE
  // Connect-owned #UserProfile (both triggers) as ONE position:fixed box whose `left` was JS-computed from
  // the reflowing icon row + a vw-94 cap — hence glued, jumpy on resize, and not a drag participant.
  // NEW MODEL (user chose "voll in Drag&Drop integrieren"): inject TWO real, draggable nav-items —
  // #cc-bell-proxy and #cc-burger-proxy — that live in the normal .nav-tile.right flow (so they reflow
  // natively = no jump, reorder like every other icon, and can be separated). The Connect law stands: the
  // live reka triggers are NEVER moved in the DOM; each is just OVERLAID (position:fixed) exactly on top of
  // its proxy every pass, so clicks and popovers still hit the real trigger. In arrange mode the live
  // triggers go pointer-events:none + hidden (CSS) and the proxy's ghost glyph shows, so you drag a visible
  // icon and the pointer reaches the proxy underneath. ── */
  function ccEnsureProxies(sp) {
    var tileR = navTileR(); if (!tileR) return [null, null];
    var defs = [["cc-bell-proxy", true, sp[0]], ["cc-burger-proxy", false, sp.length ? sp[sp.length - 1] : null]];
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
        a.addEventListener("click", function (e) { e.preventDefault(); });   // the overlaid live trigger takes real clicks; this only guards a stray hit
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
      var sp = up.querySelectorAll(":scope > div:nth-child(2) > span");
      if (!sp.length) return;
      var hideBell = g("cc.hideicon.bell", "0") === "1", hideBurger = g("cc.hideicon.burger", "0") === "1";   // #2b
      var proxies = ccEnsureProxies(sp);                           // [bellProxy, burgerProxy]
      // Neutralise the Connect-owned container: keep it in place (auto-mount safe) but give it ZERO
      // footprint — its span children are each pinned over their proxy below, so the box itself must not
      // reserve space or intercept anything (CSS already sets pointer-events:none on it).
      function setUp(p, v) { if (up.style.getPropertyValue(p) !== v) up.style.setProperty(p, v, "important"); }   // diff-write = zero mutations once settled
      setUp("position", "fixed"); setUp("left", "0"); setUp("top", "0"); setUp("width", "0"); setUp("height", "0"); setUp("min-width", "0"); setUp("padding", "0");
      var menuEl = document.getElementById("menu");
      var mz = menuEl ? parseInt(getComputedStyle(menuEl).zIndex, 10) : NaN;
      var zi = String(isFinite(mz) ? mz + 1 : 1000);               // above the sticky menu it overlaps
      for (var i = 0; i < sp.length; i++) {
        var span = sp[i], ss = span.style;
        var isBell = (i === 0), hidden = isBell ? hideBell : (i === sp.length - 1 ? hideBurger : false);   // #2b
        var proxy = isBell ? proxies[0] : proxies[proxies.length - 1];
        if (proxy) proxy.style.display = hidden ? "none" : "";     // per-icon hide toggles the proxy slot too
        if (hidden) { ss.setProperty("display", "none", "important"); continue; }
        ss.removeProperty("display");
        // CC bubbles instead of native balloons (the #menu sweep can't reach these — they live outside #menu)
        if (!span.getAttribute("data-cc-tip")) span.setAttribute("data-cc-tip", isBell ? T("Benachrichtigungen", "Notifications") : T("Menü", "Menu"));
        if (span.getAttribute("title")) span.removeAttribute("title");
        // the triggers carry Tailwind MIN-width/height (36px) that beat even sheet !important — enforce the 36px box inline
        if (ss.getPropertyValue("min-height") !== "36px") { ss.setProperty("width", "36px", "important"); ss.setProperty("height", "36px", "important"); ss.setProperty("min-width", "36px", "important"); ss.setProperty("min-height", "36px", "important"); }
        if (!proxy) continue;
        var box = proxy.querySelector(".cc-proxy-ghost") || proxy;   // the 36px icon box (not the div, whose margins offset it)
        // #15 colour modes: mirror this proxy slot's rainbow colour onto the visible trigger so the bell +
        // burger follow rainbow/flag exactly like the util icons. paintNav() stamps --cc-rb-c on the proxy's
        // <a> (it matches the util selector); we copy it here. Normal mode -> cleared -> CSS --cc-hdr-accent wins.
        var pxa = proxy.querySelector("a"), rbc = (rbOn() && pxa) ? pxa.style.getPropertyValue("--cc-rb-c") : "";
        if (rbc) { ss.setProperty("--cc-rb-c", rbc); ss.setProperty("--cc-rb-ct", pxa.style.getPropertyValue("--cc-rb-ct") || idealText(rbc)); }
        else { ss.removeProperty("--cc-rb-c"); ss.removeProperty("--cc-rb-ct"); }
        var pr = box.getBoundingClientRect(); if (!pr.width) continue;
        // OVERLAY the live trigger exactly on its proxy slot — the proxy carries the flow/reorder, the
        // trigger carries the clicks + popover anchor. Anchoring to the in-flow proxy (not a computed
        // vw-cap) is what kills the resize jump: the proxy reflows natively, the span just tracks it.
        ss.setProperty("position", "fixed", "important");
        ss.setProperty("left", Math.round(pr.left) + "px", "important");
        ss.setProperty("top", Math.round(pr.top + (pr.height - 36) / 2) + "px", "important");
        ss.setProperty("margin", "0", "important");
        ss.setProperty("z-index", zi, "important");
        // arrange mode: drop the trigger out of the hit-test so the pointer reaches the proxy below (CSS also
        // hides it and reveals the proxy ghost, so the user drags a visible icon).
        ss.setProperty("pointer-events", document.documentElement.classList.contains("cc-arrange") ? "none" : "auto", "important");
      }
    } catch (e) {}
  }
  function ccUndockProfile() {                                     // OFF branch: remove exactly what we set -> fully native again
    try {
      ["cc-bell-proxy", "cc-burger-proxy"].forEach(function (id) { var p = document.getElementById(id); if (p) p.remove(); });
      var up = document.getElementById("UserProfile"); if (!up) return;
      for (var i = 0; i < ccDockProps.length; i++) up.style.removeProperty(ccDockProps[i]);
      var sp = up.querySelectorAll(":scope > div:nth-child(2) > span");
      for (i = 0; i < sp.length; i++) { ["width", "height", "min-width", "min-height", "position", "left", "top", "z-index", "margin", "pointer-events", "display"].forEach(function (p) { sp[i].style.removeProperty(p); }); }
    } catch (e) {}
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
        var toolsPg = !ownPg && (/^\/Tools\//.test(p0) || /^\/Settings\/./.test(p0) || diskPg || !!document.querySelector("#displaybox fieldset legend"));
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
      measureAlign();   // after the pill geometry is live -> measure the real left edge
      ccIsland();       // status island in the top strip (self-gated on cc.island, default on)
      ccBrand();        // server-name brand, first child of the top strip (header+theming gated, NOT cc.island)
      watchIsland();    // live footer observer so nchan status/temp updates flow into the chips
      watchProfile();   // debounced profile observer so uptime/edition/name rebuilds flow into chips + brand
      ccDockProfile();  // glue bell+burger onto the far right end of the menu icon row (re-measured every pass)
      ccArrangeLock();  // #Drag-Umbau: the always-visible lock toggle (self-gates on cc-header-on)
      // late passes against STALE geometry (live-proven: the first pass measured the icon row
      // 160px right of its settled position and nothing re-triggered) — the row settles as
      // late-loading icons/styles arrive, so re-pin twice after the dust
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
    // each live trigger is position:fixed OVER its in-flow proxy, so re-measure on scroll AND resize —
    // both rAF-throttled (NOT debounced): a debounce would leave the trigger frozen at its old spot for
    // the whole drag-resize while the proxy reflows underneath (that WAS the "hüpfen"). rAF re-pins every
    // frame so the trigger tracks its proxy smoothly, one frame behind at most.
    try {
      function dockRaf() { if (ccDockRaf) return; ccDockRaf = window.requestAnimationFrame ? window.requestAnimationFrame(ccDockPass) : setTimeout(ccDockPass, 16); }
      window.addEventListener("scroll", dockRaf, { passive: true });
      window.addEventListener("resize", dockRaf);
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
        try { if (e.target && e.target.closest && e.target.closest("#UserProfile")) { var n = 0, t = setInterval(function () { ccNotifActions(); try { ccPaintRotate(); } catch (ep) {} try { ccAcctMenu(); } catch (ea) {} if (++n >= 8) clearInterval(t); }, 180); } } catch (err) {}
      }, true);
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
  function ccMakeLoader() {
    var w = document.createElement("span"); w.className = "cc-loader";
    w.innerHTML = '<span class="o"><i></i></span><span class="in"><i></i></span>';
    return w;
  }
  try { window.ccMakeLoader = ccMakeLoader; } catch (e) {}
  function ccInjectSpinner() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var sp = document.querySelector("div.spinner.fixed");
      if (sp && !sp.querySelector(".cc-loader")) sp.appendChild(ccMakeLoader());
    } catch (e) {}
  }

  /* #2: the CA "Updating Content" dialog (Apps.page → myAlert, content carries a unique `.updateContent-swal`
     marker span) is a SweetAlert1 `.sweet-alert` appended as a DIRECT child of <body>. Drop the CC loader in
     and hide the stock swal info-icon. Detection keys on the marker span, so it never fires on any OTHER swal. */
  function ccUpdatingSwal() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var mark = document.querySelector(".updateContent-swal");
      if (!mark) return;
      var box = (mark.closest && mark.closest(".sweet-alert")) || mark.parentElement;
      if (!box || box.querySelector(".cc-loader")) return;
      var icon = box.querySelector(".sa-icon"); if (icon) icon.style.display = "none";
      var l = ccMakeLoader(); l.style.setProperty("--cc-load-sz", "48px");
      l.style.display = "block"; l.style.margin = "6px auto 14px";
      mark.parentNode.insertBefore(l, mark);   // loader sits directly above the "Please Wait" line
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
      var l = ccMakeLoader(); l.style.setProperty("--cc-load-sz", "18px");
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

  function ccLoaderBoot() {
    ccInjectSpinner();
    ccAttachSwalObs();
    ccSwalScan();          // in case a dialog is already open on load
    ccWatchBodyForSwal();
    // The swal shell + div.spinner.fixed are created by Unraid's template; if not there yet, retry briefly
    // (cheap, bounded) so the scoped observer gets attached even when the shell predates this script.
    var n = 0, t = setInterval(function () { ccInjectSpinner(); ccAttachSwalObs(); if (++n >= 12) clearInterval(t); }, 350);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ccLoaderBoot); else ccLoaderBoot();
})();
