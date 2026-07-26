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
  var RB_OFF = Math.floor(Math.random() * RB.length);
  // Rainbow is a GLOBAL mode: read cc.rainbow / cc.rbpal / cc.rainbowrot DIRECTLY (not the
  // adopt-gated eff()), exactly like docker.js — so ONE global Rainbow switch colours EVERY
  // enabled area (the menu bar too), regardless of this bar's adopt state. The per-area accent
  // (eff("accent")) stays adopt-gated for the non-rainbow single-colour look.
  // Active palette: flag mode reads its OWN key (cc.flagpal), never cc.rbpal — so the flag never
  // repaints the rainbow swatches and rainbow colours never leak out when the flag is off.
  function pal() { try { if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; } var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p; } catch (e) {} return RB; }
  function rbOn() { return g("cc.rainbow", "0") === "1"; }
  function rbColor(i) { if (!rbOn()) return accent(); var off = g("cc.rainbowrot", "0") === "0" ? 0 : RB_OFF; var p = pal(); return p[(i + off) % p.length]; }
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
      document.documentElement.classList.toggle("cc-header-rbneutral", neutral);
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
        // while a streaming install/update dialog is IN PROGRESS, grey the title badge out (user) —
        // the clean spinner (ccNchanStyle) sits bright beside it; the badge recolours when it finishes.
        var sa0 = ts[i].closest ? ts[i].closest(".sweet-alert") : null;
        if (sa0 && sa0.classList.contains("cc-nchan-loading")) { ts[i].style.setProperty("background", "#2e2e2e", "important"); ts[i].style.setProperty("color", "#9a9a9a", "important"); continue; }
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
  function ccNchanStyle() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var sas = document.querySelectorAll(".sweet-alert.nchan");
      for (var i = 0; i < sas.length; i++) {
        var sa = sas[i], h2 = sa.querySelector("h2"); if (!h2) continue;
        var loading = /in\s*progress/i.test(h2.textContent || "");
        sa.classList.toggle("cc-nchan-loading", loading);
        var spin = h2.querySelector(".cc-nchan-spin");
        if (loading && !spin) { spin = document.createElement("span"); spin.className = "cc-nchan-spin"; h2.insertBefore(spin, h2.firstChild); }
        else if (!loading && spin) { spin.remove(); }
        var fs = sa.querySelectorAll("fieldset");   // hide the contentless grey bars, keep the ones with real steps
        for (var j = 0; j < fs.length; j++) { fs[j].style.display = (fs[j].textContent || "").trim() ? "" : "none"; }
        if (!sa.__ccNchanObs) { sa.__ccNchanObs = new MutationObserver(function () { ccNchanStyle(); paintPopups(); }); sa.__ccNchanObs.observe(sa, { childList: true, subtree: true, characterData: true }); }
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
              st.textContent = "html,body{background:#0f0f0f !important;color:#d6d6d6 !important} fieldset,table,tbody,thead,tr,td,th,.tabs,dl,dt,dd,form,center,p,section,article,div{background:transparent !important;border:none !important} legend{color:#9a9a9a !important} label,td,th{color:#d6d6d6 !important} input[type=text],input[type=password],input[type=email],input[type=search],input[type=number],input[type=url],textarea,select{background:#232323 !important;color:#eaeaea !important;border:1px solid #333 !important;border-radius:6px !important;outline:none !important;box-shadow:none !important} textarea{width:100% !important;box-sizing:border-box !important} a{color:" + acc + " !important} " +
                "input[type=button],input[type=submit],button{height:36px !important;padding:0 24px !important;font-size:14px !important;border:0 !important;border-radius:6px !important;box-shadow:none !important;background:" + acc + " !important;color:" + idealText(acc) + " !important;font-weight:600 !important;text-transform:uppercase !important;letter-spacing:.6px !important;cursor:pointer} center,.buttons{text-align:left !important} a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:none !important;box-shadow:none !important;filter:brightness(1.18)}";
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
      if (ccPopObs) return; ccPopObs = new MutationObserver(function () { ccNchanStyle(); paintPopups(); ccPopIframes(); ccPopoverDim(); ccNotifActions(); });
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
    del.textContent = T("Wirklich löschen?", "Really delete?");
    clearTimeout(del._ccT);
    del._ccT = setTimeout(function () { del.setAttribute("data-armed", "0"); del.classList.remove("cc-notif-armed"); del.textContent = T("Alle löschen", "Delete all"); }, 4000);
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
      function badge(text, cls, onAct) {
        var b = arch.cloneNode(true);                                              // clone the native chrome MINUS its Vue handler
        b.removeAttribute("id"); b.className = arch.className + " cc-notif-badge " + cls;
        b.textContent = text; b.setAttribute("role", "button"); b.tabIndex = 0; b.style.cursor = "pointer";
        b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onAct(b); });
        b.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onAct(b); } });
        return b;
      }
      var arB = badge(T("Alle archivieren", "Archive all"), "cc-notif-arch", function () { ccArchiveNotifs(); });
      var del = badge(T("Alle löschen", "Delete all"), "cc-notif-del", function (b) { ccArmDelete(b); });
      arch.style.display = "none";                                                  // hide the native archive link (its click opens the off-screen confirm)
      arch.parentNode.insertBefore(arB, arch.nextSibling);
      arB.parentNode.insertBefore(del, arB.nextSibling);
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
  function cancelHold() { if (ccHoldTimer) { clearTimeout(ccHoldTimer); ccHoldTimer = null; } ccPressXY = null; ccPressItem = null; }
  function enterReorder() {   // long-press satisfied => EVERYTHING jiggles (one zone)
    if (ccReorder) return; ccReorder = true;
    navAllParts().forEach(function (it) { it.classList.add("cc-nav-wiggle"); });
  }
  function exitReorder() {    // back to plain, clickable items
    ccReorder = false; ccDragged = null; ccMoved = false;
    navAllParts().forEach(function (it) { it.classList.remove("cc-nav-wiggle", "cc-dragging"); });
  }
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
      cancelHold(); ccPressXY = { x: e.clientX, y: e.clientY }; ccPressItem = it; ccPressPtr = e.pointerId; ccMoved = false;
      // shorter hold (300ms) + capture on the pressed item so the SAME gesture drags
      ccHoldTimer = setTimeout(function () {
        ccHoldTimer = null; enterReorder(); ccDragged = ccPressItem;
        if (ccDragged) { ccDragged.classList.add("cc-dragging"); try { ccDragged.setPointerCapture(ccPressPtr); } catch (e2) {} }
      }, 300);
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
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ccReorder) { cancelHold(); exitReorder(); } });
        // a long-press that never became a drag must not ALSO navigate (capture phase so it beats the link)
        document.addEventListener("click", function (e) { if (ccSuppressClick) { e.preventDefault(); e.stopPropagation(); ccSuppressClick = false; } }, true);
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
    try {
      var cl = new window.NchanSubscriber("/sub/cpuload", { subscriber: "websocket" });
      cl.on("message", function (m) {
        try { var mm = String(m).match(/(\d+(?:[.,]\d+)?)\s*%/); if (mm) { var c = Math.round(parseFloat(mm[1].replace(",", "."))) + "%"; if (c !== ccLiveCpu) { ccLiveCpu = c; ccIsland(); } } } catch (e) {}
      });
      cl.start(); ccLiveSubs.push(cl);
    } catch (e) {}
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
        for (i = 0; i < temps.length; i++) {
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
      var order = ccIslandOrderRead(); if (!order) return;   // no saved arrangement -> everything stays in row 0
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
          c.addEventListener("pointerdown", function (e) {   // long-press (300ms) arms the drag so a plain click still works
            if (e.button !== 0) return;
            ccIslPressXY = { x: e.clientX, y: e.clientY }; ccIslPressPtr = e.pointerId; ccIslMoved = false;
            clearTimeout(ccIslHold);
            ccIslHold = setTimeout(function () {
              ccIslHold = null; ccIslDragged = c; c.classList.add("cc-isl-dragging");
              var isle = document.getElementById("cc-island"); if (isle) isle.classList.add("cc-isl-arranging");
              try { c.setPointerCapture(ccIslPressPtr); } catch (e2) {}
            }, 220);   // K12: shorter hold -> easier to pick a chip up
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
      var tgls = document.querySelectorAll("html.cc-tools-on #displaybox .cc-tgl, html.cc-tools-on #displaybox .switch-button-background, html.cc-tools-on #displaybox .cc-tsel");
      for (var t = 0; t < tgls.length; t++) { if (!on) clear(tgls[t]); else stamp(tgls[t], t); }
      // #1 (user): each dropdown OPTION gets its OWN palette slot — rotate WITHIN each panel so the open list
      // reads as a rainbow of items (the trigger itself stays neutral until hover; see Tools.css).
      var panels = document.querySelectorAll("html.cc-tools-on #displaybox .cc-tsel-panel");
      for (var pn = 0; pn < panels.length; pn++) { var opts = panels[pn].querySelectorAll(".cc-tsel-opt"); for (var oi = 0; oi < opts.length; oi++) { if (!on) clear(opts[oi]); else stamp(opts[oi], oi); } }
    } catch (e) {}
  }
  // The /Main disk tables, settings forms and button rows are AJAX-rendered AFTER apply() runs, so the
  // one-shot paint missed them (usage bars stayed uncoloured, buttons/toggles un-rotated). Watch #displaybox
  // (childList only -> our own inline style/attr writes never re-trigger it) and re-run the paints debounced.
  var ccMainObs = null, ccMainT = null;
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
    for (var k = 0; k < c.length; k++) { var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue; if (c[k].textContent !== o.text) c[k].textContent = o.text; c[k].classList.toggle("is-selected", o.selected); c[k].classList.toggle("is-disabled", !!o.disabled); }
  }
  function ccToolsWrapSelect(sel) {
    if (sel.getAttribute("data-cc-tsel") || sel.getAttribute("data-cc-tgl")) return;   // already ours / a yes-no toggle (#24)
    if (sel.multiple || (sel.size && sel.size > 1) || sel.options.length < 1) return;   // multi / list-box stay native
    sel.setAttribute("data-cc-tsel", "1");
    var wrap = ccMkEl("span", "cc-tsel"); sel.parentNode.insertBefore(wrap, sel);
    sel.style.display = "none"; wrap.appendChild(sel);
    var trig = ccMkEl("span", "cc-tsel-trigger"); wrap.appendChild(trig);
    var panel = ccMkEl("div", "cc-tsel-panel"); wrap.appendChild(panel);
    var lastGroup = null;
    for (var k = 0; k < sel.options.length; k++) {
      var o = sel.options[k], gl = o.parentNode && o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : null;
      if (gl && gl !== lastGroup) { panel.appendChild(ccMkEl("div", "cc-tsel-group", gl)); lastGroup = gl; }
      var chip = ccMkEl("div", "cc-tsel-opt", o.text); chip.setAttribute("data-i", k);
      chip.addEventListener("click", (function (idx) { return function (ev) { ev.stopPropagation(); if (sel.options[idx].disabled) return; sel.selectedIndex = idx; sel.dispatchEvent(new Event("change", { bubbles: true })); ccToolsSyncSel(sel); wrap.classList.remove("cc-open"); }; })(k));
      panel.appendChild(chip);
    }
    trig.addEventListener("click", function (ev) { ev.stopPropagation(); if (sel.disabled) return; ccToolsSyncSel(sel); var open = wrap.classList.toggle("cc-open"); if (open) { var o2 = document.querySelectorAll(".cc-tsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) o2[j].classList.remove("cc-open"); ccPositionTsel(trig, panel); } });
    ccToolsSyncSel(sel);
    ccBindTselDoc();
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
        w.textContent = ""; w.classList.add("cc-status-dot"); w.style.setProperty("background", col, "important");
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
        if (host) {
          if (!host.querySelector(".cc-toolsinfo")) { var ic = document.createElement("span"); ic.className = "cc-toolsinfo"; ic.setAttribute("data-cc-tip", txt); ic.textContent = "ⓘ"; host.appendChild(ic); }
          bq.style.display = "none";
        }
      }
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
      if (bFont) nm.style.fontFamily = bFont;
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
  function ccDockProfile() {
    try {
      if (!document.documentElement.classList.contains("cc-header-on")) { ccUndockProfile(); return; }
      var up = document.getElementById("UserProfile"); if (!up) return;
      // anchor = the VISUALLY rightmost row participant (icons + usage meter): the merged drag
      // zone lets DOM order differ from visual order, so take the max right edge, not the last node
      var parts = document.querySelectorAll("#menu .nav-item.util > a, #menu .usage-bar"), r = null, i, rr;
      for (i = 0; i < parts.length; i++) { rr = parts[i].getBoundingClientRect(); if (rr.width > 0 && rr.height > 0 && (!r || rr.right > r.right)) r = rr; }
      if (!r) return;                                              // no icon row (sidebar theme / bare pages) -> leave the native layout alone
      var menuEl = document.getElementById("menu");
      var mz = menuEl ? parseInt(getComputedStyle(menuEl).zIndex, 10) : NaN;
      function set(p, v) { if (up.style.getPropertyValue(p) !== v) up.style.setProperty(p, v, "important"); }   // "important" beats the Tailwind utilities; diff-write = zero mutations once settled
      // the triggers carry Tailwind MIN-width/height (36px) that beat even sheet !important
      // height rules (live-proven) — enforce the 30px icon box INLINE per span
      var sp = up.querySelectorAll(":scope > div:nth-child(2) > span");
      var hideBell = g("cc.hideicon.bell", "0") === "1", hideBurger = g("cc.hideicon.burger", "0") === "1";   // #2b
      for (i = 0; i < sp.length; i++) {
        var ss = sp[i].style;
        // #2b: bell = first span, burger = last span (auto-mount keeps this order). Hide per cc.hideicon.
        if (i === 0 && hideBell) ss.setProperty("display", "none", "important");
        else if (i === sp.length - 1 && hideBurger) ss.setProperty("display", "none", "important");
        else ss.removeProperty("display");
        if (ss.getPropertyValue("min-height") !== "36px") { ss.setProperty("width", "36px", "important"); ss.setProperty("height", "36px", "important"); ss.setProperty("min-width", "36px", "important"); ss.setProperty("min-height", "36px", "important"); }   // #14: match the enlarged (lgb 36px) menu icons
        // CC bubbles instead of native balloons (the #menu sweep can't reach these — they
        // live outside #menu); i===0 = bell, the last = burger (auto-mount keeps this order)
        if (!sp[i].getAttribute("data-cc-tip")) sp[i].setAttribute("data-cc-tip", i === 0 ? T("Benachrichtigungen", "Notifications") : T("Menü", "Menu"));
        if (sp[i].getAttribute("title")) sp[i].removeAttribute("title");
      }
      // the FIRST VISIBLE span drives the dock geometry below (so hiding the bell doesn't strand the
      // burger 30px off — #2b). Falls back to sp[0] if all are hidden (geometry is moot then).
      var bsp = null; for (i = 0; i < sp.length; i++) { if (getComputedStyle(sp[i]).display !== "none" && sp[i].getBoundingClientRect().width > 0) { bsp = sp[i]; break; } } if (!bsp) bsp = sp[0];
      var vw = document.documentElement.clientWidth;
      // 6px right of the row tail so the bell sits EXACTLY one icon-gap from the last util icon —
      // the native util icons carry 3px+3px a-margins (=6px visual gap). The axis correction below
      // pins the span to a fixed spot regardless of this offset (proven live: +6 AND +9 both land a
      // 3px gap), so the FINAL gap-enforce block at the very end is what actually nets 6px; this
      // offset just seeds a close-enough start. Bell<->burger gap is 6px too (Header.css).
      var target = Math.min(Math.round(r.right + 6), vw - 94);   // #10/#14: reserve matches the .nav-tile.right 94px padding for the two 36px icons
      set("position", "fixed");
      set("right", "auto");
      // KILL the Tailwind pl-[160px]/pl-[30%]: with border-box that padding forced the box ≥160px
      // wide, so its transparent left region OVERLAPPED the last two menu icons (syslog + help) and
      // ate their clicks/hovers (user #10, live-proven: box left 1944 covered LogButton at 1967).
      set("padding", "0");
      set("min-width", "0");
      set("width", "88px");                                        // #10/#14: fits the two 36px icon boxes + 6px gap (was 76px for the old 30px icons); container = content, else its native 236px width parks the row off-screen
      set("top", Math.round(r.top + (r.height - 36) / 2) + "px");  // centre the 36px boxes on the icon line (#14)
      set("height", "36px");
      set("z-index", String(isFinite(mz) ? mz + 1 : 1000));        // above the sticky menu it overlaps
      set("left", target + "px");
      // MEASURED correction against the VISIBLE BELL BOX (not the container/row — inner margins
      // offset both from it, live-proven ±4px): align the first trigger's box exactly to the
      // icon line on both axes. v2.31.9 idiom — measure where it landed, shift by the delta.
      if (bsp) {
        var sr = bsp.getBoundingClientRect();
        if (sr.width > 0) {
          var dx = target - Math.round(sr.left);
          if (dx) set("left", (parseInt(up.style.getPropertyValue("left"), 10) + dx) + "px");
          var dy = Math.round(r.top) - Math.round(sr.top);   // r = the icon rect; align box top to icon top
          if (dy) set("top", (parseInt(up.style.getPropertyValue("top"), 10) + dy) + "px");
        }
      }
      // FINAL GAP ENFORCE (#2a): the axis correction above pins the span to a fixed spot that leaves a
      // 3px util->bell gap regardless of `target` (proven live). Measure the ACTUAL gap to the last util
      // icon and nudge the container so it is EXACTLY 6px — matching the 6px util-icon gaps. Idempotent
      // (delta 0 once at 6px), synchronous (no flicker).
      if (bsp) { var br = bsp.getBoundingClientRect(); if (br.width > 0) { var gdx = Math.round(6 - (br.left - r.right)); if (gdx) set("left", (parseInt(up.style.getPropertyValue("left"), 10) + gdx) + "px"); } }
      // #10 FINAL RIGHT-EDGE CAP: the gap-enforce above pins the bell 6px right of the last util icon
      // regardless of any right boundary, so on wide rows the burger's right edge protruded a few px
      // PAST the island strip (the other CC top-right elements — live: burger 1579 vs island 1576).
      // Cap the LAST visible trigger's right edge to the island's right edge (fallback: 24px inset,
      // matching the island's own inset) so bell+burger sit FLUSH with the island, never beyond it.
      var isl = document.getElementById("cc-island");
      var rBound = null;
      if (isl && getComputedStyle(isl).display !== "none") { var ir = isl.getBoundingClientRect(); if (ir.width > 0) rBound = Math.round(ir.right); }
      if (rBound == null) rBound = vw - 24;
      var lastSp = null; for (i = sp.length - 1; i >= 0; i--) { if (getComputedStyle(sp[i]).display !== "none" && sp[i].getBoundingClientRect().width > 0) { lastSp = sp[i]; break; } }
      if (lastSp) { var lrr = lastSp.getBoundingClientRect(); if (lrr.width > 0) { var over = Math.round(lrr.right) - rBound; if (over > 0) set("left", (parseInt(up.style.getPropertyValue("left"), 10) - over) + "px"); } }
    } catch (e) {}
  }
  function ccUndockProfile() {                                     // OFF branch: remove exactly the props we set -> fully native again
    try {
      var up = document.getElementById("UserProfile"); if (!up) return;
      for (var i = 0; i < ccDockProps.length; i++) up.style.removeProperty(ccDockProps[i]);
      var sp = up.querySelectorAll(":scope > div:nth-child(2) > span");
      for (i = 0; i < sp.length; i++) { ["width", "height", "min-width", "min-height"].forEach(function (p) { sp[i].style.removeProperty(p); }); }
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
      ["lang", "search", "logout", "terminal", "browse", "feedback", "info", "log", "help", "bell", "burger"].forEach(function (k9) { root.classList.toggle("cc-hideicon-" + k9, g("cc.hideicon." + k9, "0") === "1" && g("cc.theming", "1") !== "0"); });
      root.classList.toggle("cc-state-native", g("cc.statenative", "0") === "1" && g("cc.theming", "1") !== "0");
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
        var toolsPg = !ownPg && (/^\/Tools\//.test(p0) || /^\/Settings\/./.test(p0) || !!document.querySelector("#displaybox fieldset legend"));
        root.classList.toggle("cc-tools-on", toolsPg && g("cc.theming", "1") !== "0");
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
    document.addEventListener("click", function (e) {
      try {
        if (!document.documentElement.classList.contains("cc-header-on")) return;
        if (!document.getElementById("guiSearchBoxSpan")) return; // not open -> let native open it
        var tgt = e.target && e.target.closest ? e.target.closest(".nav-item.gui_search, [onclick*='gui_search']") : null;
        if (!tgt) return; // click wasn't on the search toggle
        e.preventDefault(); e.stopImmediatePropagation(); // block the inline gui_search() re-open
        if (typeof window.closeSearchBox === "function") { window.closeSearchBox(); return; }
        var s = document.getElementById("guiSearchBoxSpan"); if (s) s.parentNode.removeChild(s);
        var hid = document.querySelectorAll(".nav-item.util, .nav-user.show");
        for (var i = 0; i < hid.length; i++) hid[i].style.removeProperty("display"); // restore what gui_search hid
      } catch (err) {}
    }, true);
  }
  function boot() {
    try { window.ccHeaderApply = apply; } catch (e) {} // let the Settings page live-update this bar same-page
    apply();
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
    // #15/#11 (user: "Hilfe-Icon funktioniert immer noch nicht"): guarantee the click reaches the native
    // HelpButton even if the nav-drag pointer wiring (or another handler) swallows the anchor's inline
    // onclick. Capture phase + call it once ourselves; stopImmediatePropagation prevents a double-toggle.
    // LIVE-PROVEN the toggle itself works (inline_help none->block); what looked "broken" is that on pages
    // like the Dashboard EVERY .inline_help lives inside a collapsed tile (height 0) so nothing appears —
    // native behaviour, but it reads as a dead button. So: after toggling ON, if no help block is actually
    // visible, surface a CC toast instead of leaving the user staring at nothing.
    try {
      document.addEventListener("click", function (e) {
        try {
          if (!document.documentElement.classList.contains("cc-header-on")) return;
          var h = e.target && e.target.closest ? e.target.closest("#menu .nav-item.HelpButton") : null;
          if (!h) return;
          e.preventDefault(); e.stopImmediatePropagation();
          if (typeof window.HelpButton !== "function") { ccToast(T("Hilfe ist auf dieser Seite nicht verfügbar.", "Help is not available on this page.")); return; }
          window.HelpButton();
          var nav = document.querySelector(".nav-item.HelpButton");   // turned ON? then verify something actually became visible
          if (nav && nav.classList.contains("active")) {
            setTimeout(function () {
              try {
                var ih = document.querySelectorAll(".inline_help"), seen = false;
                for (var q = 0; q < ih.length; q++) { if (ih[q].getBoundingClientRect().height > 2) { seen = true; break; } }
                if (!seen) ccToast(T("Diese Seite bietet keine Inline-Hilfe.", "This page has no inline help."));
              } catch (e2) {}
            }, 360);
          }
        } catch (err) {}
      }, true);
    } catch (e) {}
    // the dock is position:fixed against the STICKY menu row: while #header scrolls away the icon
    // row's y shifts, so re-measure on scroll (rAF-throttled, passive) + resize (debounced)
    try {
      var dockRz = null;
      window.addEventListener("scroll", function () {
        if (ccDockRaf) return;
        ccDockRaf = window.requestAnimationFrame ? window.requestAnimationFrame(ccDockPass) : setTimeout(ccDockPass, 16);
      }, { passive: true });
      window.addEventListener("resize", function () { if (dockRz) clearTimeout(dockRz); dockRz = setTimeout(function () { dockRz = null; ccDockProfile(); }, 120); });
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
        try { if (e.target && e.target.closest && e.target.closest("#UserProfile")) { var n = 0, t = setInterval(function () { ccNotifActions(); if (++n >= 8) clearInterval(t); }, 180); } } catch (err) {}
      }, true);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
