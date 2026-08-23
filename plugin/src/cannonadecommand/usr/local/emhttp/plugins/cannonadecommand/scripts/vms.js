/* CannonadeCommand - VM-icon tint for Unraid's VMs tab.
 *
 * A tiny, self-contained companion to the Docker-tab enhancer: when "Also tint VM
 * icons" is on in the Settings page (cc.vmicons) and an icon colour is chosen
 * (cc.iconcolor), it tints the VM row icons with the SAME filter recipe used for
 * container icons, applied DIRECTLY as an inline style (robust against re-renders).
 *
 * It touches nothing else on the page and adds no bar/panel. It self-clears on an
 * uninstall (the same-origin proxy 404s), and reacts live to Settings changes via
 * the storage event. The VM-row selectors are best-effort against Unraid's VM
 * manager DOM; if a build renders icons differently, it simply tints nothing.
 */
(function () {
  "use strict";
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  // Same FILLED gear as docker.js (tabler-icons MIT, icons/filled/settings.svg) — GlimStone Rule 20. Kept a
  // verbatim copy rather than a shared import: vms.js is page-scoped and must not depend on docker.js loading.
  // If one changes, change BOTH.
  var CC_GEAR_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" aria-hidden="true"><path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" /></svg>';
  var dead = false, mo = null, liveTimer = null, moPending = false, moTimer = null, moTrail = false, smo = null, smoPending = false, vmBwTimer = null;
  var ccFirstPaintDone = false, ccEnhBusyStart = 0;   // #54: same minimum-visible-spinner pattern as docker.js's #33
  // #22: wrap the memory / disk-IO / network-IO readouts (cols 4-6) of the VM-usage-stats table into
  // CC chips so every cell reads as a badge like the CPU pills. Re-render-safe: guarded by an
  // already-wrapped check (the tbody is replaced ~every 3s via the vm_usage websocket).
  function wrapVmStats() {
    try {
      if (!document.documentElement.classList.contains("cc-vms-on")) return;
      var body = document.getElementById("vmstatsbody") || (function () { var t = document.getElementById("vmstats"); return t ? t.querySelector("tbody") : null; })();
      if (!body) return;
      Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr) {
        var tds = tr.children;
        // #8 (user): the VM NAME (col 0) becomes a badge like the main list, not plain bold text.
        var n0 = tds[0];
        if (n0 && n0.tagName === "TD" && !n0.querySelector(":scope > .cc-vmstat-name") && (n0.textContent || "").trim()) {
          var nb = document.createElement("span"); nb.className = "cc-b cc-vmstat-name";
          while (n0.firstChild) nb.appendChild(n0.firstChild);
          n0.appendChild(nb);
        }
        [3, 4, 5].forEach(function (ci) {
          var td = tds[ci]; if (!td || td.tagName !== "TD") return;
          if (td.querySelector(":scope > .cc-vmstat-chip")) return;     // already wrapped this render
          if (!(td.textContent || "").trim()) return;
          var chip = document.createElement("span"); chip.className = "cc-vmstat-chip";
          while (td.firstChild) chip.appendChild(td.firstChild);
          td.appendChild(chip);
        });
      });
    } catch (e) {}
  }
  var VMVIEW_KEY = "cc.vmview";
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  // Rainbow: ported verbatim from docker.js so the VM badges read the SAME global palette. --cc-rb-* vars
  // are stamped on <html>; the kind->colour map rotates by a per-load random offset (toggle cc.rainbowrot).
  // VM info badges carry kinds cpu/ram/ip, so only those recolour.
  var RB_KINDS = ["net", "ip", "lan", "port", "id", "von", "cpu", "ram", "bw", "version", "vol", "plan"];
  var RB_PAL = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];
  if (window.CCTheme) { RB_PAL = window.CCTheme.RB; }  /* single source: shared palette when CCTheme is loaded (global+sync); local copy stays as the fallback */
  var RB_OFFSET = window.CCTheme ? window.CCTheme.rbSeed(RB_PAL.length) : Math.floor(Math.random() * RB_PAL.length); // shared PERSISTED seed, aligned with header/docker/shares (was Math.random per reload -> the VM palette reshuffled every load and never matched)

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  // EXACT-colour tint via an inline SVG feColorMatrix (identical recipe to
  // docker.js): map every opaque pixel to the chosen sRGB colour, keep alpha, and
  // blend the original back by (100 - strength)%. hue-rotate only APPROXIMATES a
  // hue and got the colour wrong; feColorMatrix hits the picked colour exactly.
  // VM tinting is ON by DEFAULT whenever a container-icon colour is chosen (cc.vmicons
  // is an opt-OUT: only the literal "0" disables it). Requiring a separate "1" opt-in was
  // an easy-to-miss toggle that made VMs look like they "never tinted".
  function vmTintOff() { return ls("cc.vmicons") === "0"; }
  // ── Hintergrund (background) and Einfärben (tint) are two INDEPENDENT controls (v4.32.5
  // fix, mirrored from docker.js): cc.iconbg stays the background badge's on/off key, and
  // cc.iconbgcolor (new) is its OWN colour; cc.icontint (new) is the tint's OWN on/off, and
  // cc.iconcolor stays its existing colour key. Before this, iconcolor's mere presence WAS the
  // tint's on-signal and doubled as the badge's colour too, so switching Hintergrund on forced
  // icon tinting on as a side effect. vmTintOn()/vmBgColor() fall back to that exact pre-4.32.5
  // reading whenever the new keys were never touched, so an untouched install looks unchanged.
  function vmTintOn() {
    var v = effK("icontint");
    return v == null ? !!effK("iconcolor") : v === "1";
  }
  // ADOPT RAINBOW/ACCENT — ONE master toggle (v4.33.1, mirrors docker.js; redesigned from the
  // two independent toggles v4.33.0 shipped, see docker.js's iconAdoptTint() doc comment for the
  // full writeup of why). Hintergrund adopting: vmBgColor() answers "" so paintVmIcons() never
  // stamps --cc-iconbg-color; VmTab.css's own var() chain
  // (var(--cc-iconbg-color, var(--cc-rb-c, var(--cc-rbaccent, var(--cc-accent))))) then falls
  // through to --cc-rb-c, the per-row rotating colour the tile already takes (VMs has no grid
  // view — only the list, which already stamps --cc-rb-c per row, so nothing else was needed
  // here for genuine per-item rotation). Einfärben no longer adopts a separate HUE at all: the
  // ink is instead the automatic black/white CONTRAST colour for the resolved background
  // (idealText()), regardless of Einfärben's own on/off — vmAdoptTint() still resolves the
  // REPRESENTATIVE colour that contrast is computed FROM (the SAME single "action" rainbow slot
  // VmTab.css already stamps for buttons/badges, --cc-rbaccent = pal[(5+off) % pal.length], via
  // vmRbColor(5) when Rainbow is on, the plain accent when it's off) — live, recomputed every
  // repaint, never a snapshot frozen at toggle time.
  function vmAdoptTint() {
    if (ls("cc.theming") === "0" || ls("cc.rainbow") !== "1") return ccAccent();
    return vmRbColor(5);
  }
  function vmBgColor() {
    if (effK("iconbgrainbow") === "1") return "";   // adopting: defer to the CSS rainbow/accent chain
    var c = effK("iconbgcolor");
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) return ccHex6(c);
    var ic = effK("iconcolor");
    if (ic && /^#?[0-9a-f]{6}$/i.test(ic)) return ccHex6(ic);
    return ccAccent();
  }
  // The icon pipeline's target colour for this tab — same contract as docker.js iconInk():
  //   · Master adopt ON: ALWAYS the automatic black/white contrast colour for the resolved
  //     background, regardless of Einfärben's own on/off.
  //   · Master adopt OFF: "" whenever Einfärben (tint) is off, regardless of the badge; ALWAYS
  //     the picked TINT colour, lifted out of the dark end by the shared darkness guard —
  //     regardless of whether the Logo-Hintergrund badge is also on (v4.32.6 fix: this used to
  //     return ccIdeal(vmBgColor()) whenever the badge was on, discarding the user's own picked
  //     tint colour — see docker.js iconInk() for the full writeup). vmBgColor()/effK("iconbg")
  //     stay the badge box's OWN colour, never the icon's ink.
  // `forTint` doubles the floor because a luminance tint outputs roughly half the target's luma;
  // the auto contrast branch skips the guard — idealText() only ever answers #fff/#161616.
  function vmIconInk(forTint) {
    if (effK("iconbgrainbow") === "1") return ccIdeal(vmAdoptTint());
    if (!vmTintOn()) return "";
    var pick = effK("iconcolor");
    var valid = pick && /^#?[0-9a-f]{6}$/i.test(pick);
    if (!valid) return "";
    if (!window.CCTheme || !window.CCTheme.liftDark) return ccHex6(pick);
    return ccHex6(window.CCTheme.liftDark(pick, ccAccent(), window.CCTheme.LUM_FLOOR * (forTint ? 2 : 1)));
  }
  // Generalised so TWO independent luminance-tint filters can coexist (v4.33.2 fix — see
  // vmItemAdoptInk() below): every pre-existing caller hardcoded hostId "cc-vm-tint-svg"/
  // filtId "cc-vm-icon-tint" — ensureTintFilter() below stays that single-filter spelling.
  function ensureTintFilterAs(hostId, filtId, ic) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ic || "");
    var host = document.getElementById(hostId);
    if (dead || vmTintOff() || !m) { if (host) host.remove(); return false; }
    var tr = parseInt(m[1], 16) / 255, tg = parseInt(m[2], 16) / 255, tb = parseInt(m[3], 16) / 255;
    var s = (Math.max(10, parseInt(effK("iconstrength") || "100", 10)) / 100).toFixed(3);
    // shading-preserving: channel = luminance × target colour (matches docker.js)
    var lum = function (c) { return (0.2126 * c).toFixed(4) + " " + (0.7152 * c).toFixed(4) + " " + (0.0722 * c).toFixed(4); };
    if (!host) { host = document.createElement("div"); host.id = hostId; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    // IDEMPOTENT: only rewrite the SVG when the colour/strength actually changed. The host
    // lives on document.body; a blind innerHTML write on every apply() would be a DOM
    // mutation that — if an observer ever watched body — re-triggers apply() into a
    // ~300ms CPU-pegging loop (the classic non-idempotent-inject + MutationObserver trap).
    var sig = filtId + "|" + tr + "|" + tg + "|" + tb + "|" + s + "|lum";
    if (host.dataset.sig !== sig) {
      var mid = '<feColorMatrix in="SourceGraphic" type="matrix" result="flat" values="' + lum(tr) + ' 0 0 ' + lum(tg) + ' 0 0 ' + lum(tb) + ' 0 0 0 0 0 1 0"/>';
      if (parseFloat(s) < 0.999) mid += '<feComponentTransfer in="flat" result="faded"><feFuncA type="linear" slope="' + s + '"/></feComponentTransfer><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="faded"/></feMerge>';
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' + mid + '</filter></svg>';
      host.dataset.sig = sig;
    }
    return true;
  }
  function ensureTintFilter() { return ensureTintFilterAs("cc-vm-tint-svg", "cc-vm-icon-tint", vmIconInk(true)); }
  function filterVal() { return ensureTintFilter() ? "url(#cc-vm-icon-tint)" : ""; }
  // ── PER-ROW adopt ink (v4.33.2 fix) — mirrors docker.js itemAdoptInk() exactly: reuses
  // the EXACT --cc-rb-ct enhanceCells() already stamped on THIS row's own rotated badge
  // colour, instead of vmIconInk()'s single page-wide representative-slot answer. Falls
  // back to that representative answer whenever Rainbow itself is off (genuinely uniform
  // then) or the row/its stamp is unavailable.
  function vmItemAdoptInk(rowEl) {
    if (rowEl && rowEl.style && ls("cc.theming") !== "0" && ls("cc.rainbow") === "1") {
      var v = rowEl.style.getPropertyValue ? rowEl.style.getPropertyValue("--cc-rb-ct") : "";
      if (v) return v.trim();
    }
    return ccIdeal(vmAdoptTint());
  }
  // The chosen colour as a plain hex, gated the same way. Unraid renders MOST VM
  // icons as a FontAwesome/icon-font glyph (`<i class="fa fa-… img">`), whose colour
  // comes from CSS `color:`, NOT from an image filter — so a glyph never tinted
  // before. Real `.png` icons render as `<img class="img">` and DO take the filter.
  function tintColor() {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(vmIconInk(false) || "");
    if (dead || vmTintOff() || !m) return "";
    return "#" + m[1] + m[2] + m[3];
  }
  // VM-row icon selector — GROUND TRUTH from unraid/webgui dynamix.vm.manager
  // VMMachines.php: the VM list is tbody#kvm_list, each row td.vm-name has the icon at
  // span[id^="vm-"] > .img (an <img class="img"> or an <i class="… img"> glyph). The
  // old selectors used #vms, which does not exist — that's why VM icons never tinted.
  function vmImgs() {
    var sels = ["#kvm_list td.vm-name span[id^='vm-'] > .img", "#kvm_list td.vm-name img.img", "#kvm_list td.vm-name img"];
    for (var i = 0; i < sels.length; i++) { var n = document.querySelectorAll(sels[i]); if (n.length) return n; }
    return [];
  }
  // The VM behind one icon element, for the icon pipeline's lookup + per-VM pin.
  function vmIconName(n) { var tr = n && n.closest ? n.closest("tr") : null; return (tr && vmNameOf(tr)) || ""; }
  // A font glyph's colour and the luminance-tint filter are mutually exclusive (mirrors the
  // docker.js fix — see glyphInkAndFilter() there): once a glyph gets a direct css colour, the
  // filter must never ALSO run on top of it, or a forced "tint" mode double-tints/dims the same
  // hue. Extracted so the invariant is unit-testable without a full render pass.
  //
  // `ibgOn`/`ibgAcc` are kept as parameters for call-site stability but are no longer consulted
  // directly: `ink` (vmIconInk()'s result) already resolves to the picked tint colour whenever
  // Einfärben is on — badge or not (v4.32.6 fix) — and to "" whenever Einfärben is off — the old
  // `ibgOn ? ccIdeal(ibgAcc) : ink` forced a colour onto every VM glyph the moment the badge was
  // on, even with Einfärben off (the same background-forces-tint bug as vmIconInk(), for font
  // glyphs specifically — v4.32.5 fix).
  function glyphInkAndFilter(plan, ibgOn, ibgAcc, ink) {
    if (plan.treat === "native") return { color: "", filter: "" };
    return { color: ink, filter: "" };
  }
  // Source swap + native-source memory, identical contract to docker.js setIconSrc.
  function vmSetIconSrc(img, url) {
    if (!img.getAttribute("data-cc-osrc")) img.setAttribute("data-cc-osrc", img.getAttribute("src") || "");
    var want = url || img.getAttribute("data-cc-osrc") || "";
    if (!want || img.getAttribute("data-cc-isrc") === want) return;
    img.setAttribute("data-cc-isrc", want);
    if (img.getAttribute("src") !== want) img.setAttribute("src", want);
  }
  // Unraid renders MOST VM icons as a font glyph (<i class="fa … img">), which is already
  // monochrome — it inks, and there is no src to swap. Real .png icons run the full chain.
  function vmIconPlan(n, name) {
    var CI = window.CCTheme && window.CCTheme.icons;
    if (!CI) return { treat: "tint", url: "" };
    var isGlyphEl = n.tagName !== "IMG";
    var res = CI.result(name), kind = res && res.kind !== "pending" ? res.kind : "";
    var spread = isGlyphEl ? 0 : CI.spread(n.getAttribute("data-cc-osrc") || n.getAttribute("src") || "");
    var plan = CI.plan(CI.mode("vm", name), kind, spread);
    return { treat: plan.treat, url: (!isGlyphEl && (plan.src === "glyph" || plan.src === "color")) ? CI.svgUrl(name) : "" };
  }
  // ── CC treatment for the VM rows: a state badge (green/amber/grey, shape-aware)
  //    on td.vm-name, mirroring the Docker-tab state badge, plus the accent vars on
  //    the document root. Self-contained + idempotent; the tint stays separate below.
  function effK(k) { return ls("cc.stylevms") !== "0" ? ls("cc." + k) : ls("ccv." + k); }
  function ccIdeal(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  function ccAccent() { var a = effK("accent") || "#2f6feb"; return /^#[0-9a-f]{6}$/i.test(a) ? a : "#2f6feb"; }
  // Logo-Hintergrund read-side: a monochrome b/w feColorMatrix that flattens any icon
  // to a single ink (black on a light accent, white on a dark accent), so a coloured
  // glyph/png reads cleanly on the accent-filled badge box. Signature-guarded like
  // ensureTintFilter so a blind innerHTML write can't feed a MutationObserver loop.
  // Ink-FLATTEN to ANY colour (docker.js ensureFlatFilter, verbatim contract): every opaque
  // pixel becomes one flat colour, alpha untouched. Only ever aimed at a real glyph or an
  // icon the complexity heuristic proved is already one tone.
  // Expand a #rgb shorthand to #rrggbb. idealText answers "#fff", every filter builder and
  // every colour regex here wants six digits — this is the one place that bridges the two.
  function ccHex6(c) {
    c = String(c == null ? "" : c).trim();
    return /^#[0-9a-f]{3}$/i.test(c) ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  }
  function ensureFlatFilter(hostId, filtId, hex) {
    var host = document.getElementById(hostId);
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ccHex6(hex) || "");
    if (!m) { if (host) host.remove(); return ""; }
    var r = (parseInt(m[1], 16) / 255).toFixed(4), g2 = (parseInt(m[2], 16) / 255).toFixed(4), b = (parseInt(m[3], 16) / 255).toFixed(4);
    if (!host) { host = document.createElement("div"); host.id = hostId; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var sig = filtId + "|" + r + "|" + g2 + "|" + b;
    if (host.dataset.sig !== sig) {
      var vals = "0 0 0 0 " + r + " 0 0 0 0 " + g2 + " 0 0 0 0 " + b + " 0 0 0 1 0";
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '"/></filter></svg>';
      host.dataset.sig = sig;
    }
    return "url(#" + filtId + ")";
  }
  function ensureMonoFilter(hostId, filtId, accentHex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(accentHex || "");
    return ensureFlatFilter(hostId, filtId, m ? ccIdeal("#" + m[1]) : "");
  }
  function ccShape() { return ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[ls("cc.badgeshape") || "pill"] || "999px"; }
  // ── Rainbow palette (verbatim port of docker.js applyRainbowPalette): read the GLOBAL cc.rainbow +
  //    cc.rbpal/cc.rainbowrot and stamp --cc-rb-* on <html>. Cleared when off.
  // Active palette resolver (docker.js's ccPalActive() mirror): flag mode reads its own cc.flagpal
  // key, never cc.rbpal — no bleed between flag and rainbow palettes. Factored out so
  // applyRainbowPalette() and vmRbColor() (v4.33.0's adopt-rainbow tint) share ONE resolver
  // instead of two copies of the same try/catch.
  function vmPalActive() {
    var pal = RB_PAL;
    try { var fjp = ls("cc.flagmode") === "1" ? JSON.parse(ls("cc.flagpal") || "null") : null; var jp = (fjp && fjp.length) ? fjp : JSON.parse(ls("cc.rbpal") || "null"); if (jp && jp.length) pal = jp; } catch (e) {}
    return pal;
  }
  // A single palette slot by index — same rotation math applyRainbowPalette() uses per KIND,
  // exposed standalone for v4.33.0's Einfärben adopt-rainbow (see vmAdoptTint()).
  function vmRbColor(i) { var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET; return vmPalActive()[(i + off) % vmPalActive().length]; }
  function applyRainbowPalette() {
    var rt = document.documentElement.style, on = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    if (!on) { rt.removeProperty("--cc-rbaccent"); rt.removeProperty("--cc-rbaccent-text"); RB_KINDS.forEach(function (k) { rt.removeProperty("--cc-rb-" + k); rt.removeProperty("--cc-rb-" + k + "-t"); }); return; }
    var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    var pal = vmPalActive();
    // SINGLE rainbow "action" colour: VmTab.css's generic .cc-b badge rule, the reactive-hover fallback,
    // the autostart toggle and the vmstat name badge ALL read --cc-rbaccent, but nothing on /VMs stamped it
    // (Shares-domain var) so they fell back to --cc-accent = flat blue. Stamp it (pal slot 5, like docker).
    var acc = pal[(5 + off) % pal.length], an = parseInt(String(acc).slice(1), 16);
    var aL = 0.299 * (an >> 16 & 255) + 0.587 * (an >> 8 & 255) + 0.114 * (an & 255);
    rt.setProperty("--cc-rbaccent", acc); rt.setProperty("--cc-rbaccent-text", aL > 150 ? "#161616" : "#fff");
    RB_KINDS.forEach(function (k, i) {
      var c = pal[(i + off) % pal.length], n = parseInt(String(c).slice(1), 16);
      var L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
      rt.setProperty("--cc-rb-" + k, c); rt.setProperty("--cc-rb-" + k + "-t", L > 150 ? "#161616" : "#fff");
    });
  }
  // ── GRID / CARD view — DISABLED (v2.23.1). The CSS-only reflow (html.cc-vmgrid) of Unraid's LIVE
  //    jQuery-tablesorter + jQuery-UI-sortable table overlapped badly (drag/sort machinery + stray
  //    non-.sortable rows fight the reflow). vms.js has no engine data model to emit real card DOM, so a
  //    robust grid needs a purpose-built card view (a follow-up), not a CSS patch. Until then force LIST:
  //    currentView() always returns "list" and ensureViewToggle() is a no-op, so cc-vmgrid is never set.
  function currentView() { return "list"; }
  function applyView() {
    document.documentElement.classList.toggle("cc-vmgrid", currentView() === "grid");
    var tg = document.getElementById("cc-vm-viewtoggle"); if (!tg) return;
    var g = currentView() === "grid", b = tg.querySelectorAll(".cc-seg-btn");
    if (b[0]) b[0].classList.toggle("cc-seg-on", !g); if (b[1]) b[1].classList.toggle("cc-seg-on", g);
  }
  function ensureViewToggle() {
    // Grid view DISABLED (see currentView): do NOT inject the List/Grid toggle, and remove any stale one
    // (e.g. left over from a v2.23.0 session) so no broken grid or dangling control remains.
    var ex = document.getElementById("cc-vm-viewtoggle");
    if (ex) { var eb = ex.closest(".cc-vm-toolbar") || ex; if (eb.parentNode) eb.parentNode.removeChild(eb); }
  }
  // ── Tab-Ansicht: flatten the /VMs sub-tabs ("Virtual Machines" #kvm_list + "VM Usage Statistics"
  //    #vmstats) into stacked CC sections. Same MainContentTabbed DOM as /Shares/Share + /Main. Prepend a
  //    .cc-card-head cloned from each hidden tab button to every panel. Idempotent via data-cc-card.
  function cardPanels(box) {
    var tablist = box.querySelector('nav.tabs, [role="tablist"]');
    var tabBtns = tablist ? tablist.querySelectorAll('button[role="tab"]') : [];
    var panels = box.querySelectorAll('section[role="tabpanel"]');
    for (var i = 0; i < panels.length; i++) {
      var section = panels[i];
      if (section.getAttribute("data-cc-card")) continue;   // idempotent; keeps i == real DOM index
      section.setAttribute("data-cc-card", "1");
      var head = document.createElement("div"); head.className = "cc-card-head";
      var btn = tabBtns[i];
      if (btn && btn.childNodes.length) { var kids = btn.childNodes; for (var k = 0; k < kids.length; k++) head.appendChild(kids[k].cloneNode(true)); }
      else { head.textContent = (btn && btn.textContent.trim()) || (section.id || "").replace(/-panel$/, ""); }
      section.insertBefore(head, section.firstChild);       // VM panels have no split, so the section IS the card
    }
  }
  function flattenTeardown() {
    try {
      var stray = document.querySelectorAll("#displaybox .cc-card-head, #displaybox .cc-card-note");
      for (var s = 0; s < stray.length; s++) stray[s].parentNode.removeChild(stray[s]);
      var marked = document.querySelectorAll("#displaybox [data-cc-card]");
      for (var m = 0; m < marked.length; m++) marked[m].removeAttribute("data-cc-card");
    } catch (e) {}
  }
  // ONE size map, byte-identical to docker.js's ccLogoSizes()/plugins.js's logoSize() map — see
  // the fix-plan note on cc.sgsize drift: three independent copies of this literal map is exactly
  // how the docker.js list-mode 62px hardcode regression happened in the first place.
  function vmLogoSizes() { return ({ s: ["48px", "62px"], m: ["62px", "78px"], l: ["76px", "94px"] })[ls("cc.sgsize") || "m"] || ["62px", "78px"]; }
  function enhanceRows() {
    try {
      var a = ccAccent(), rad = ccShape(), root = document.documentElement.style;
      root.setProperty("--cc-accent", a); root.setProperty("--cc-accent-text", ccIdeal(a)); root.setProperty("--cc-b-radius", rad);
      // T5: stamp the logo tile size from the ONE global cc.sgsize key (verbatim from docker.js) so the VM
      // logo + tile track the SAME size as Docker/Plugin (they stamp it too) — was fixed at the CSS default,
      // so at any non-default sgsize the VM tiles were a different size than the other tabs.
      var lg = vmLogoSizes();
      root.setProperty("--cc-logo-img", lg[0]); root.setProperty("--cc-logo-box", lg[1]);
      // VM state -> a Docker-IDENTICAL cc-badge (class-driven, colours from VmTab.css). Read the native
      // status from the sibling <i.fa> class (started/paused/stopped + green-/orange-/red-text), NOT the
      // translated label \u2014 the old text match never matched German "GESTARTET". Map to Docker's state
      // names (running/paused/exited) so the exact .cc-badge-<state> colours apply.
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list tr.sortable td.vm-name span.state")).forEach(function (st) {
        var txt = (st.textContent || "").trim(); if (!txt) return;
        var icon = st.previousElementSibling, cls = (icon && icon.className) || "", low = txt.toLowerCase();
        var running = /\bstarted\b|green-text/.test(cls) || /run|l\u00e4uft|gestartet/.test(low);
        var paused = /\bpaused\b|orange-text/.test(cls) || /paus/.test(low);
        var dstate = running ? "running" : paused ? "paused" : "exited";
        st.className = "state cc-badge cc-badge-" + dstate;   // keep native .state (sort/hooks) + Docker classes
        st.style.cssText = "";                                // CSS owns the look now
      });
    } catch (e) {}
  }
  // Revert every inline visual this enhancer applies (state-badge styling + icon tint),
  // so the MASTER THEMING toggle live-reverts the VM page without a reload. Leaves the
  // observer/timers alone (unlike teardown), so re-enabling theming re-tints via apply().
  function stripVmTheming() {
    try {
      // state badge -> back to the bare native span (drop the cc-badge classes + any old inline styles)
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list tr.sortable td.vm-name span.state")).forEach(function (st) {
        st.className = "state"; st.style.cssText = "";
      });
      document.documentElement.classList.remove("cc-vm-iconbg");                 // Logo-Hintergrund box is CSS-driven now
      document.documentElement.style.removeProperty("--cc-iconbg-color");
      var imgs = vmImgs();
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].style.filter = ""; imgs[i].style.removeProperty("color");
        var w = imgs[i].parentElement; if (w) ["background", "border-radius", "width", "height", "padding", "display", "align-items", "justify-content", "box-sizing"].forEach(function (p) { w.style.removeProperty(p); });
      }
      ["cc-vm-tint-svg", "cc-vm-mono-svg", "cc-vm-tint-svg-blk", "cc-vm-tint-svg-wht", "cc-vm-mono-svg-blk", "cc-vm-mono-svg-wht"].forEach(function (id) { var h = document.getElementById(id); if (h) h.remove(); });
      // grid/rainbow live-revert: drop the classes, clear the palette vars, remove the injected view toggle
      document.documentElement.classList.remove("cc-vmgrid", "cc-vm-rainbow", "cc-vm-rbneutral");
      RB_KINDS.forEach(function (k) { document.documentElement.style.removeProperty("--cc-rb-" + k); document.documentElement.style.removeProperty("--cc-rb-" + k + "-t"); });
      var vt = document.getElementById("cc-vm-viewtoggle"); if (vt) { var vbar = vt.closest(".cc-vm-toolbar") || vt; if (vbar.parentNode) vbar.parentNode.removeChild(vbar); }
    } catch (e) {}
  }
  // wrap the vCPU (a.vcpu-*) and RAM (mem) cell values in CC value badges (span.cc-vmb), styled by
  // CannonadeCommand.VMs.css. Idempotent via .cc-vmb-cell; the tbody re-renders, so this re-runs from
  // the observer. Never touch td.vm-name (logo/state handled inline above), the disks/graphics/ip
  // cells (they carry live markup) or the autostart cell (styled purely by CSS).
  // el() + badgeInfo() ported from docker.js so the VM badges use Docker's EXACT classes/structure.
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  // ── CC VM LIMITS ─ a gear per VM row opens an editor for CPU pin/cap, RAM (balloon) and
  //    up/down bandwidth; the engine applies CPU/RAM via virsh (domain XML) and bandwidth
  //    host-side (iptables physdev hashlimit, re-asserted by the monitor). Proxy = the same
  //    ccapi.php the Docker tab uses. Self-contained + theme-aware via the global CC tokens
  //    (docker.css's cc-pop styling isn't loaded on /VMs).
  var VMDE = (function () { try { return /de/i.test(document.documentElement.lang || "") || (localStorage.getItem("locale") || "").indexOf("de") === 0; } catch (e) { return false; } })();
  var CCPROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var vmLims = {}; // name -> the VM's current limits from /api/vms
  function vmCsrf() {
    try {
      if (typeof window.csrf_token !== "undefined" && window.csrf_token) return window.csrf_token;
      var fe = document.querySelector('input[name="csrf_token"]'); if (fe && fe.value) return fe.value;
      var m = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m) return m[1];
    } catch (e) {}
    return "";
  }
  function vmApi(method, path, body, query) {
    var o = { method: method, headers: { Accept: "application/json" } };
    if (method !== "GET") {
      // emhttp only accepts a POST whose csrf_token is a FORM-BODY field; ccapi.php unwraps
      // `data` back into the JSON body for the engine (an empty 200 = the token was dropped).
      var tk = vmCsrf();
      o.headers["Content-Type"] = "application/x-www-form-urlencoded";
      o.body = (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body || {}));
    }
    // extra query (e.g. name=… for vmdisks) rides ALONGSIDE ?path=… — ccapi.php sanitises
    // path to [a-z] and forwards only the params on its own per-path $qallow list.
    return fetch(CCPROXY + "?path=" + encodeURIComponent(path) + (query ? "&" + query : ""), o).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && j.error) || ("HTTP " + r.status));
        if (method !== "GET" && j == null) throw new Error(VMDE ? "leere Antwort (csrf verworfen?)" : "empty response (csrf dropped?)");
        return j;
      });
    });
  }
  function loadVmLims() {
    return vmApi("GET", "vms").then(function (list) { vmLims = {}; if (Array.isArray(list)) list.forEach(function (v) { vmLims[v.name] = v; }); }).catch(function () {});
  }
  // HOST CPU topology for the graphical core-picker (Docker-identical): /api/state already exposes the
  // host's logical-CPU count + HT grouping + Intel P/E lists (docker.js reads the SAME keys). Loaded once.
  var vmHost = { cpus: 0, coreOf: null, pcores: [], ecores: [] };
  function loadVmHost() {
    return vmApi("GET", "state", null).then(function (st) {
      if (st) vmHost = { cpus: st.host_cpus || 0, coreOf: st.host_core_of || null, pcores: st.host_pcores || [], ecores: st.host_ecores || [] };
    }).catch(function () {});
  }
  // cpuset <-> set helpers (verbatim from docker.js) for the core-picker prefill/read.
  function cpusetToSet(str) { var out = []; String(str || "").split(",").forEach(function (p) { p = p.trim(); var m = /^(\d+)-(\d+)$/.exec(p); if (m) { for (var i = +m[1]; i <= +m[2]; i++) out.push(i); } else if (/^\d+$/.test(p)) out.push(+p); }); return out; }
  function setToCpuset(arr) { arr = arr.slice().sort(function (a, b) { return a - b; }); var parts = [], i = 0; while (i < arr.length) { var j = i; while (j + 1 < arr.length && arr[j + 1] === arr[j] + 1) j++; parts.push(i === j ? String(arr[i]) : arr[i] + "-" + arr[j]); i = j + 1; } return parts.join(","); }
  // Build the Docker-style core grid: one BOX per physical core, its hyperthreads stacked vertically,
  // wrapping into rows. Intel hybrid CPUs get a P/E tag. Returns { node, read } or null (unknown topology
  // -> caller falls back to a text cpuset field). Prefills the current pin.
  function buildCoreGrid(cur) {
    var ncpu = vmHost.cpus || 0;
    if (!(ncpu > 0 && ncpu <= 512)) return null;
    var coreOf = (vmHost.coreOf && vmHost.coreOf.length === ncpu) ? vmHost.coreOf : null;
    var isE = {}; (vmHost.ecores || []).forEach(function (n) { isE[n] = true; });
    var hybrid = (vmHost.pcores || []).length > 0 && (vmHost.ecores || []).length > 0;
    var grid = el("div", "cc-cores");
    var groups = {}, order = [];
    for (var ci = 0; ci < ncpu; ci++) { var g = coreOf ? coreOf[ci] : ci; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(ci); }
    order.forEach(function (g) {
      var box = el("span", "cc-corebox");
      if (hybrid) { var isEcore = groups[g].every(function (n) { return isE[n]; }); box.classList.add(isEcore ? "cc-corebox-e" : "cc-corebox-p"); box.appendChild(el("span", "cc-corebox-tag", isEcore ? "E" : "P")); }
      groups[g].forEach(function (cpu2) {
        var core = el("span", "cc-core cc-rb-" + (g % 8), String(cpu2)); core.dataset.core = cpu2;
        core.title = "CPU " + cpu2 + (coreOf ? " · core " + g : "") + (hybrid ? (isE[cpu2] ? " · E-core" : " · P-core") : "");
        core.addEventListener("click", function () { this.classList.toggle("cc-core-on"); });
        box.appendChild(core);
      });
      grid.appendChild(box);
    });
    var s = cpusetToSet(cur);
    Array.prototype.forEach.call(grid.querySelectorAll(".cc-core"), function (c) { if (s.indexOf(parseInt(c.dataset.core, 10)) >= 0) c.classList.add("cc-core-on"); });
    return { node: grid, read: function () { var sel = []; Array.prototype.forEach.call(grid.querySelectorAll(".cc-core-on"), function (c) { sel.push(parseInt(c.dataset.core, 10)); }); return setToCpuset(sel); } };
  }
  function vmNameOf(tr) {
    var h = tr && tr.querySelector("td.vm-name [onclick*='addVMContext']");
    var m = /addVMContext\('([^']+)'/.exec(h ? (h.getAttribute("onclick") || "") : "");
    return m ? m[1] : null;
  }
  function vmFld(label, hint, value, ph) {
    var wrap = el("div"); wrap.style.cssText = "display:flex;flex-direction:column;gap:3px;margin:0 0 10px 0";
    var l = el("label", null, label); l.style.cssText = "font-size:12px;font-weight:600;color:var(--cc-text,#e6e6e6)";
    var inp = el("input"); inp.type = "text"; inp.value = (value == null ? "" : String(value)); if (ph != null) inp.placeholder = String(ph);
    inp.style.cssText = "background:var(--cc-surface-3,#2e2e2e);color:var(--cc-text,#e6e6e6);border:none;border-radius:6px;padding:6px 10px;font-size:13px;outline:none";
    wrap.appendChild(l); wrap.appendChild(inp);
    if (hint) { var hh = el("div", null, hint); hh.style.cssText = "font-size:11px;color:var(--cc-text-dim,#8a8a8a)"; wrap.appendChild(hh); }
    return { wrap: wrap, input: inp };
  }
  // BW badge VALUE, mirroring the Docker BW badge: a RUNNING VM shows its LIVE throughput (↓ down / ↑ up,
  // diffed from the tap byte counters by pollVmBw); a stopped/idle VM shows the CONFIGURED cap, or "–".
  var vmBwPrev = {}, vmRate = {}; // name -> {down,up,t} sample ; name -> {down,up} bytes/s
  function rateFmt(bps) {
    var bits = (bps || 0) * 8;
    if (bits >= 1e9) return (bits / 1e9).toFixed(1) + "G";
    if (bits >= 1e6) return (bits / 1e6).toFixed(1) + "M";
    if (bits >= 1e3) return Math.round(bits / 1e3) + "k";
    return "0";
  }
  function vmBwText(lim) {
    if (lim && lim.running && lim.name && vmRate[lim.name]) {
      var r = vmRate[lim.name];
      return "↓" + rateFmt(r.down) + " ↑" + rateFmt(r.up);
    }
    var d = lim && lim.inKbit > 0, u = lim && lim.outKbit > 0;
    if (!d && !u) return "–";
    function fmt(k) { return k >= 1000 ? (Math.round(k / 100) / 10) + "M" : k + "k"; }
    return "↓" + (d ? fmt(lim.inKbit) : "∞") + " ↑" + (u ? fmt(lim.outKbit) : "∞");
  }
  // Live-BW poll: re-fetch /api/vms and diff each running VM's tap byte counters into a bytes/s rate, then
  // recolour/refill the BW badges. Gated in arm() so the heavy virsh List() only runs while a VM RUNS.
  function pollVmBw() {
    return loadVmLims().then(function () {
      var now = Date.now();
      Object.keys(vmLims).forEach(function (n) {
        var v = vmLims[n];
        if (!v || !v.running) { delete vmBwPrev[n]; delete vmRate[n]; return; }
        var prev = vmBwPrev[n];
        if (prev && now > prev.t) {
          var dt = (now - prev.t) / 1000;
          vmRate[n] = { down: Math.max(0, Math.round(((v.downBytes || 0) - prev.down) / dt)), up: Math.max(0, Math.round(((v.upBytes || 0) - prev.up) / dt)) };
        }
        vmBwPrev[n] = { down: v.downBytes || 0, up: v.upBytes || 0, t: now };
      });
      try { refreshAllRes(); } catch (e) {}
    });
  }
  // Gear colour — VERBATIM method from docker.js gearFill so the VM gears read the SAME palette:
  // rainbow stamps the kind var (--cc-rb-<kind>) and lets CSS decide the rest; accent/native mode
  // fills inline with priority (Unraid's theme CSS would otherwise beat the stylesheet).
  function vmGearFill(lb, set, kind) {
    var rbOn = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    if (rbOn && kind) {
      lb.style.removeProperty("background"); lb.style.removeProperty("color");
      lb.style.setProperty("--cc-rb-c", "var(--cc-rb-" + kind + ", var(--cc-accent, #2f6feb))");
      lb.style.setProperty("--cc-rb-ct", "var(--cc-rb-" + kind + "-t, #fff)");
      return;
    }
    lb.style.removeProperty("--cc-rb-c"); lb.style.removeProperty("--cc-rb-ct");
    var bg = set ? ccAccent() : "#4a4a4a", tx = "#f2f2f2";
    if (set) tx = ccIdeal(bg);
    lb.style.setProperty("background", bg, "important");
    lb.style.setProperty("color", tx, "important");
  }
  var GEAR_TIP = {
    cpu: VMDE ? "CPU (Pin + Limit)" : "CPU (pin + limit)", ram: VMDE ? "RAM (Balloon)" : "RAM (balloon)",
    bw: VMDE ? "Bandbreite" : "Bandwidth", disk: VMDE ? "vDisk live vergrößern" : "grow vDisk live"
  };
  // One cc-limbtn gear (Docker-identical class + look), coloured per kind, opening the focused
  // editor for that resource. The disk gear colours as "vol" (matching the vDisks badge) but keeps
  // its own cc-lim-disk class + editor target.
  function vmGear(name, which, set) {
    var colorKind = which === "disk" ? "vol" : which;
    var lb = el("span", "cc-limbtn" + (set ? " cc-limbtn-set" : "") + " cc-lim-" + which); lb.innerHTML = CC_GEAR_SVG;
    vmGearFill(lb, set, colorKind);
    lb.title = GEAR_TIP[which] + " · " + (set ? (VMDE ? "gesetzt" : "set") : (VMDE ? "Standard" : "default"));
    lb.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (vmLims[name]) openVmEd(name, which, lb); else loadVmLims().then(function () { openVmEd(name, which, lb); });
    });
    return lb;
  }
  // After the async limits load (or an editor Apply) update each built resource group's gears
  // (set-state + colour) and BW badge text IN PLACE — #kvm_list rows are stable and won't rebuild.
  function syncGear(g, set, kind) { if (!g) return; g.classList.toggle("cc-limbtn-set", set); vmGearFill(g, set, kind); }
  function limSet(lim) {
    return {
      cpu: !!(lim.cpuCap > 0 || (lim.cpuCores && lim.cpuCores !== "" && lim.cpuCores !== "0-127")),
      ram: !!(lim.memMiB > 0 && lim.maxMemMiB > 0 && lim.memMiB < lim.maxMemMiB),
      bw: !!(lim.inKbit > 0 || lim.outKbit > 0)
    };
  }
  function refreshResGroup(group) {
    var name = group.getAttribute("data-cc-vm"); if (!name) return;
    var lim = vmLims[name] || {}, s = limSet(lim);
    syncGear(group.querySelector(".cc-lim-cpu"), s.cpu, "cpu");
    syncGear(group.querySelector(".cc-lim-ram"), s.ram, "ram");
    syncGear(group.querySelector(".cc-lim-bw"), s.bw, "bw");
    var bwv = group.querySelector(".cc-b-bw .cc-b-v"); if (bwv) bwv.textContent = vmBwText(lim);
  }
  function refreshAllRes() { try { Array.prototype.forEach.call(document.querySelectorAll("#kvm_list .cc-resgroup[data-cc-vm]"), refreshResGroup); } catch (e) {} }
  // one resource line: badge + its gear, side by side (docker.js resLine). Gear optional.
  function vmResLine(badge, gear) { var l = el("div", "cc-resline"); l.appendChild(badge); if (gear) l.appendChild(gear); return l; }
  // vDISK live-resize rows: one per resizable disk, grow-only (the engine rejects a shrink).
  function diskRow(name, d, statusEl) {
    var known = d.capacityBytes > 0;
    var curG = known ? (Math.round(d.capacityBytes / 1073741824 * 100) / 100) : 0;
    var row = el("div"); row.style.cssText = "display:flex;align-items:center;gap:8px;margin:0 0 7px 0";
    var lab = el("div"); lab.style.cssText = "flex:1;min-width:0;font-size:12px;color:var(--cc-text,#e6e6e6)";
    var tgt = el("span", null, d.target); tgt.style.cssText = "font-weight:600";
    var cur = el("span", null, "  " + (known ? curG + " GiB" : (VMDE ? "Größe unbekannt" : "size unknown"))); cur.style.cssText = "color:var(--cc-text-dim,#8a8a8a);font-family:Consolas,monospace";
    lab.appendChild(tgt); lab.appendChild(cur);
    if (!known) { row.appendChild(lab); return row; }   // source missing -> no size to grow from; label only
    var inp = el("input"); inp.type = "number"; inp.min = String(curG); inp.step = "1"; inp.value = String(Math.max(1, Math.ceil(curG)));
    inp.style.cssText = "width:74px;background:var(--cc-surface-3,#2e2e2e);color:var(--cc-text,#e6e6e6);border:none;border-radius:6px;padding:6px 8px;font-size:13px;outline:none";
    var unit = el("span", null, "GiB"); unit.style.cssText = "font-size:11px;color:var(--cc-text-dim,#8a8a8a)";
    var btn = el("button", null, VMDE ? "Vergrößern" : "Grow"); btn.style.cssText = "background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff);border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer";
    btn.onclick = function () {
      var g = parseFloat(String(inp.value).replace(",", "."));
      if (isNaN(g) || g <= curG) { statusEl.style.color = "var(--cc-err,#d9433f)"; statusEl.textContent = (VMDE ? "nur vergrößern — > " : "grow only — > ") + curG + " GiB"; return; }
      function doResize() {
        btn.disabled = true; statusEl.style.color = "var(--cc-text-dim,#8a8a8a)"; statusEl.textContent = VMDE ? "Vergrößern läuft…" : "resizing…";
        vmApi("POST", "vmdiskresize", { name: name, target: d.target, size_gib: g }).then(function () {
          btn.disabled = false; statusEl.style.color = "var(--cc-ok,#1f9d55)"; statusEl.textContent = (VMDE ? "vergrößert auf " : "grown to ") + g + " GiB" + (VMDE ? " · Gast muss Partition/FS erweitern" : " · guest must extend partition/FS");
          curG = g; cur.textContent = "  " + g + " GiB"; d.capacityBytes = g * 1073741824; inp.min = String(g);
        }).catch(function (e) { btn.disabled = false; statusEl.style.color = "var(--cc-err,#d9433f)"; statusEl.textContent = String(e.message || e).slice(0, 70); });
      }
      // a grow is IRREVERSIBLE (a vDisk can't be shrunk back without data loss) — confirm first, using the
      // same swal dialog the VM-remove uses, with a native confirm() fallback.
      var q = "vDisk " + d.target + ": " + curG + " GiB → " + g + " GiB. " + (VMDE ? "Das lässt sich NICHT rückgängig machen." : "This can NOT be undone.");
      if (typeof window.swal === "function") {
        window.swal({ title: VMDE ? "Sicher?" : "Are you sure?", text: q, type: "warning", showCancelButton: true, confirmButtonText: VMDE ? "Vergrößern" : "Grow", cancelButtonText: VMDE ? "Abbrechen" : "Cancel" }, function (ok) { if (ok) doResize(); });
      } else if (window.confirm(q)) { doResize(); }
    };
    row.appendChild(lab); row.appendChild(inp); row.appendChild(unit); row.appendChild(btn);
    return row;
  }
  function loadDisks(name, host, statusEl) {
    host.textContent = VMDE ? "lädt…" : "loading…";
    vmApi("GET", "vmdisks", null, "name=" + encodeURIComponent(name)).then(function (disks) {
      host.textContent = "";
      if (!disks || !disks.length) { host.textContent = VMDE ? "keine resizbaren Disks" : "no resizable disks"; return; }
      disks.forEach(function (d) { host.appendChild(diskRow(name, d, statusEl)); });
    }).catch(function (e) { host.textContent = String(e.message || e).slice(0, 70); });
  }
  // Focused limits editor. `which` = "cpu" | "ram" | "bw" | "disk" | "all" — a gear opens only its
  // own section (Docker opens one popup per kind); "all"/absent shows everything. CPU/RAM/BW commit
  // via POST vmlimits; the disk section resizes per-disk via POST vmdiskresize.
  function openVmEd(name, which, anchor) {
    which = which || "all";
    var v = vmLims[name] || {};
    var showCpu = which === "all" || which === "cpu", showRam = which === "all" || which === "ram";
    var showBw = which === "all" || which === "bw", showDisk = which === "all" || which === "disk";
    var hasLimFields = showCpu || showRam || showBw;
    // ANCHORED popover (user: "erscheinen mitten im Fenster statt am Zahnrädchen"): a transparent full-screen
    // click-catcher (click outside = close) with the card positioned right at the gear, exactly like Docker.
    var ov = el("div"); ov.id = "cc-vmlim-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999";
    // Match the Docker CPU/RAM/BW popover's chrome exactly (user: "gleich machen"): same #161616 surface,
    // 10px radius, elevation ramp (key + ambient shadow + inner top-highlight) and Segoe stack as .cc-pop.
    var card = el("div", "cc-rainbow"); card.style.cssText = "position:absolute;background:var(--cc-bg,#161616);color:var(--cc-txt,#e6e6e6);border-radius:10px;padding:14px 16px;width:420px;max-width:92vw;max-height:88vh;overflow:auto;box-shadow:0 2px 5px rgba(0,0,0,.38),0 14px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.05);font:13px/1.5 \"Segoe UI\",system-ui,sans-serif";
    var titleMap = { cpu: VMDE ? "CPU-Limit" : "CPU limit", ram: VMDE ? "RAM-Limit" : "RAM limit", bw: VMDE ? "Bandbreite" : "Bandwidth", disk: VMDE ? "vDisk-Größe" : "vDisk size", all: VMDE ? "VM-Limits" : "VM limits" };
    var head = el("div"); head.style.cssText = "display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:700;margin:0 0 4px 0";
    head.appendChild(el("span", null, titleMap[which] + ": " + name));
    var hx = el("span", null, "✕"); hx.style.cssText = "cursor:pointer;color:#8a8a8a;font-weight:400;font-size:14px;line-height:1;transition:color .12s";
    hx.addEventListener("mouseenter", function () { hx.style.color = "var(--cc-txt,#e6e6e6)"; });
    hx.addEventListener("mouseleave", function () { hx.style.color = "#8a8a8a"; });
    hx.addEventListener("click", function () { close(); });
    head.appendChild(hx); card.appendChild(head);
    var sub = el("div", null, (v.vcpus || 0) + " vCPUs · " + (v.maxMemMiB || 0) + " MiB max" + (v.running ? (VMDE ? " · läuft" : " · running") : (VMDE ? " · gestoppt" : " · stopped")));
    sub.style.cssText = "font-size:11px;color:var(--cc-text-dim,#8a8a8a);margin:0 0 14px 0"; card.appendChild(sub);
    var cores = (v.cpuCores && v.cpuCores !== "0-127") ? v.cpuCores : "";
    var f = {}, readCpuset = null;   // readCpuset() yields the pin cpuset (grid selection or text field)
    if (showCpu) {
      // CPU pin: the SAME graphical core-picker the Docker tab uses when the host topology is known,
      // else a plain cpuset text field.
      var grid = buildCoreGrid(cores);
      if (grid) {
        var pinWrap = el("div"); pinWrap.style.cssText = "display:flex;flex-direction:column;gap:5px;margin:0 0 10px 0";
        var pinLbl = el("label", null, VMDE ? "CPU-Kerne (Pin)" : "CPU cores (pin)"); pinLbl.style.cssText = "font-size:12px;font-weight:600;color:var(--cc-text,#e6e6e6)";
        var pinHint = el("div", null, VMDE ? "Kerne anklicken · nichts gewählt = alle" : "click cores · none = all"); pinHint.style.cssText = "font-size:11px;color:var(--cc-text-dim,#8a8a8a)";
        pinWrap.appendChild(pinLbl); pinWrap.appendChild(grid.node); pinWrap.appendChild(pinHint); card.appendChild(pinWrap);
        readCpuset = grid.read;
      } else {
        f.cores = vmFld(VMDE ? "CPU-Kerne (Pin)" : "CPU cores (pin)", VMDE ? "z. B. 6-15 · leer = alle" : "e.g. 6-15 · empty = all", cores, "6-15");
        card.appendChild(f.cores.wrap); readCpuset = function () { return f.cores.input.value.trim(); };
      }
      f.cap = vmFld(VMDE ? "CPU-Limit (Kerne)" : "CPU limit (cores)", VMDE ? "0 = unbegrenzt · z. B. 1.5" : "0 = unlimited · e.g. 1.5", v.cpuCap > 0 ? (v.cpuCap / 100) : "", "0");
      card.appendChild(f.cap.wrap);
    }
    if (showRam) { f.ram = vmFld("RAM (MiB)", (VMDE ? "aktuelles Max " : "current max ") + (v.maxMemMiB || 0) + (VMDE ? " MiB · höher = auch das Max wird angehoben (greift beim nächsten VM-Start)" : " MiB · higher also raises the max (takes effect on the next VM start)"), v.memMiB || "", String(v.maxMemMiB || 0)); card.appendChild(f.ram.wrap); }
    if (showBw) {
      f.dn = vmFld("Download (kbit/s)", VMDE ? "0 = unbegrenzt" : "0 = unlimited", v.inKbit || "", "0");
      f.up = vmFld("Upload (kbit/s)", VMDE ? "0 = unbegrenzt" : "0 = unlimited", v.outKbit || "", "0");
      card.appendChild(f.dn.wrap); card.appendChild(f.up.wrap);
    }
    if (showDisk) {
      var dsec = el("div"); dsec.style.cssText = "margin:2px 0 6px 0";
      var dlbl = el("div", null, VMDE ? "vDisks — Live-Resize (nur vergrößern)" : "vDisks — live resize (grow only)"); dlbl.style.cssText = "font-size:12px;font-weight:600;margin:0 0 8px 0;color:var(--cc-text,#e6e6e6)";
      var dlist = el("div"); dlist.style.cssText = "font-size:12px;color:var(--cc-text-dim,#8a8a8a)";
      var dstat = el("div"); dstat.style.cssText = "font-size:11px;color:var(--cc-text-dim,#8a8a8a);margin-top:2px";
      dsec.appendChild(dlbl); dsec.appendChild(dlist); dsec.appendChild(dstat); card.appendChild(dsec);
      loadDisks(name, dlist, dstat);
    }
    // ── Icon colouring for THIS VM. Present in every variant of the editor (whichever gear
    // you opened), because the VM tab has no other per-item settings surface and a control
    // reachable from only one of four gears is a control nobody finds. Applies instantly —
    // it is a display choice, so it does not belong behind the Apply button.
    (function () {
      var CI = window.CCTheme && window.CCTheme.icons; if (!CI) return;
      var wrap = el("div"); wrap.style.cssText = "display:flex;flex-direction:column;gap:3px;margin:8px 0 10px 0";
      var l = el("label", null, VMDE ? "Icon-Färbung" : "Icon colouring"); l.style.cssText = "font-size:12px;font-weight:600;color:var(--cc-text,#e6e6e6)";
      var sel = el("select"); sel.style.cssText = "background:var(--cc-surface-3,#2e2e2e);color:var(--cc-text,#e6e6e6);border:none;border-radius:6px;padding:6px 10px;font-size:13px;outline:none";
      var opts = VMDE
        ? [["", "folgt globaler Einstellung"], ["auto", "Automatisch"], ["native", "Natives Icon"], ["flat", "Ink-Flatten"], ["tint", "Luminanz-Tint"]]
        : [["", "follows the global setting"], ["auto", "Automatic"], ["native", "Native icon"], ["flat", "Ink flatten"], ["tint", "Luminance tint"]];
      var cur = CI.override("vm", name);
      opts.forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; if (o[0] === cur) op.selected = true; sel.appendChild(op); });
      sel.addEventListener("change", function () { CI.setOverride("vm", name, sel.value); paintVmIcons(); });   // NOT apply() — `apply` is this function's own Apply button (see paintVmIcons)
      wrap.appendChild(l); wrap.appendChild(sel); card.appendChild(wrap);
    })();
    var foot = el("div"); foot.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:6px";
    var msg = el("div"); msg.style.cssText = "flex:1;font-size:11px;color:var(--cc-text-dim,#8a8a8a)";
    var cancel = el("button", null, VMDE ? "Schließen" : "Close"); cancel.style.cssText = "background:var(--cc-chip,rgba(128,128,128,.18));color:var(--cc-text,#e6e6e6);border:none;border-radius:6px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer";
    foot.appendChild(msg); foot.appendChild(cancel);
    var apply = null;
    if (hasLimFields) { apply = el("button", null, VMDE ? "Anwenden" : "Apply"); apply.style.cssText = "background:var(--cc-accent,#2f6feb);color:var(--cc-accent-text,#fff);border:none;border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer"; foot.appendChild(apply); }
    card.appendChild(foot);
    ov.appendChild(card); document.body.appendChild(ov);
    // place the card at the gear (clamped into the viewport; flips above if it would overflow the bottom)
    try {
      var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null, cw = card.offsetWidth || 420, ch = card.offsetHeight || 300;
      if (r && (r.width || r.height)) {
        var left = Math.max(8, Math.min(r.left, window.innerWidth - cw - 12));
        var top = r.bottom + 6; if (top + ch > window.innerHeight - 8) top = Math.max(8, r.top - ch - 6);
        card.style.left = (window.scrollX + left) + "px"; card.style.top = (window.scrollY + top) + "px";
      } else { card.style.left = "50%"; card.style.top = "12vh"; card.style.transform = "translateX(-50%)"; }
    } catch (e) { card.style.left = "50%"; card.style.top = "12vh"; card.style.transform = "translateX(-50%)"; }
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    cancel.onclick = close; ov.onclick = function (e) { if (e.target === ov) close(); };
    function intOr(s) { s = (s || "").trim(); if (s === "") return null; var n = parseInt(s, 10); return isNaN(n) ? null : n; }
    if (apply) apply.onclick = function () {
      var body = { name: name };
      if (readCpuset) body.cpu_cores = readCpuset(); // "" (no cores selected) clears the pin
      if (f.cap) { var capRaw = f.cap.input.value.trim(); if (capRaw === "") body.cpu_cap = 0; else { var cf = parseFloat(capRaw.replace(",", ".")); if (!isNaN(cf)) body.cpu_cap = Math.max(0, Math.round(cf * 100)); } }
      if (f.ram) { var ramN = intOr(f.ram.input.value); if (ramN != null && ramN > 0) body.mem_mib = ramN; }
      if (f.dn) { var dnN = intOr(f.dn.input.value); if (dnN != null) body.in_kbit = Math.max(0, dnN); }
      if (f.up) { var upN = intOr(f.up.input.value); if (upN != null) body.out_kbit = Math.max(0, upN); }
      apply.disabled = true; msg.style.color = "var(--cc-text-dim,#8a8a8a)"; msg.textContent = VMDE ? "wird angewendet…" : "applying…";
      vmApi("POST", "vmlimits", body).then(function (res) { if (res && res.vm) vmLims[name] = res.vm; try { refreshAllRes(); } catch (e) {} close(); })
        .catch(function (e) { apply.disabled = false; msg.style.color = "var(--cc-err,#d9433f)"; msg.textContent = String(e.message || e).slice(0, 44); });
    };
    if (f.cores) f.cores.input.focus(); else if (f.ram) f.ram.input.focus(); else if (f.dn) f.dn.input.focus();
  }
  // ACTIONS column — Docker-VERBATIM action bar (docker.js actBtn/actBtnOff/tintAct/actionBars/
  // injectActionCell). Each icon is wired to the SAME native global the VM context menu calls
  // (vmmanager.js addVMContext). Per-VM context is read from the logo span#vm-<uuid> id + its
  // onclick=addVMContext('name','uuid','template','state','vmrcurl','PROTO','log','fstype',
  // 'console;rdp','','webui',...). Every native call is typeof-guarded so a renamed/missing Unraid
  // global degrades the button to a no-op instead of throwing.
  function actBtn(icon, tip, fn) {
    var b = el("span", "cc-actbtn"); b.title = tip; b.appendChild(el("i", "fa " + icon));
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); try { fn(); } catch (_) {} });
    return b;
  }
  function actBtnOff(icon, tip) { var b = el("span", "cc-actbtn cc-actoff"); b.title = tip; b.appendChild(el("i", "fa " + icon)); return b; }
  function vmDisp(action, uuid) { if (typeof window.ajaxVMDispatch === "function") window.ajaxVMDispatch({ action: action, uuid: uuid }, "loadlist"); }
  // tintAct: verbatim port of docker.js tintAct — accent (or rainbow) inline colour per button, grey
  // for cc-actoff. Reuses vms.js RB_PAL/RB_OFFSET/ccAccent + the cc.actcolors gate.
  function tintAct(bar) {
    var colorsOn = ls("cc.actcolors") !== "0";
    var rb = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    // reactive sub-mode (cc.rbmode="active"): enabled coloured buttons REST grey and take their palette
    // colour only on ROW hover — so skip the inline paint and stamp --cc-rb-c/--cc-rb-ct for the CSS hover
    // rule (an inline !important background would make the sheet powerless). Matches docker.js tintAct.
    var neutral = rb && ls("cc.rbmode") === "active";
    // flag mode reads cc.flagpal (own key), never cc.rbpal — no bleed between flag and rainbow palettes
    var pal = RB_PAL; try { var fjp = ls("cc.flagmode") === "1" ? JSON.parse(ls("cc.flagpal") || "null") : null; var jp = (fjp && fjp.length) ? fjp : JSON.parse(ls("cc.rbpal") || "null"); if (jp && jp.length) pal = jp; } catch (e2) {}
    var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    Array.prototype.slice.call(bar.querySelectorAll(".cc-actbtn")).forEach(function (b2, i2) {
      var bg = "#2e2e2e", tx = "#7a7a7a";
      if (!b2.classList.contains("cc-actoff")) {
        tx = "#e9e9e9";
        if (colorsOn) { bg = rb ? pal[(i2 + off) % pal.length] : ccAccent(); tx = ccIdeal(bg); }
      }
      if (neutral && colorsOn && !b2.classList.contains("cc-actoff")) {
        b2.style.setProperty("--cc-rb-c", bg); b2.style.setProperty("--cc-rb-ct", tx);
        b2.style.removeProperty("background"); b2.style.removeProperty("color");
      } else {
        b2.style.removeProperty("--cc-rb-c"); b2.style.removeProperty("--cc-rb-ct");
        b2.style.setProperty("background", bg, "important");
        b2.style.setProperty("color", tx, "important");
      }
      var ic2 = b2.querySelector("i"); if (ic2) ic2.style.setProperty("color", "inherit", "important");
    });
  }
  function vmCtxFor(tr) {
    var out = { uuid: "", name: "", state: "", vmrcurl: "", proto: "", log: "", fstype: "QEMU", webui: "", console: "web" };
    try {
      var hand = tr.querySelector("td.vm-name span.outer > span.hand[id^='vm-']") || tr.querySelector("td.vm-name span.hand[onclick*='addVMContext']");
      if (!hand) return out;
      var id = hand.id || ""; if (id.indexOf("vm-") === 0) out.uuid = id.slice(3);
      var oc = hand.getAttribute("onclick") || "";
      var m = oc.match(/addVMContext\s*\(([\s\S]*)\)/); if (!m) return out;
      var toks = m[1].match(/'(?:[^'\\]|\\.)*'/g) || [];
      var q = toks.map(function (s) { return s.slice(1, -1).replace(/\\(.)/g, "$1"); });
      out.name = q[0] || ""; if (!out.uuid) out.uuid = q[1] || "";
      out.state = q[3] || ""; out.vmrcurl = q[4] || ""; out.proto = q[5] || "";
      out.log = q[6] || ""; out.fstype = q[7] || "QEMU"; out.console = (q[8] || "web").split(";")[0];
      out.webui = q[10] || "";
    } catch (e) {}
    return out;
  }
  function vmRemove(uuid, name, withDisks) {
    var de = LANG === "de";
    var run = function () { vmDisp(withDisks ? "domain-delete" : "domain-undefine", uuid); };
    if (typeof window.swal === "function") {
      window.swal({ title: de ? "Sicher?" : "Are you sure?", text: (withDisks ? (de ? "Vollstaendig ENTFERNEN " : "Completely REMOVE ") : (de ? "Definition entfernen: " : "Remove definition: ")) + name, type: "warning", showCancelButton: true, confirmButtonText: de ? "Fortfahren" : "Proceed", cancelButtonText: de ? "Abbrechen" : "Cancel" }, run);
    } else if (window.confirm((de ? "Entfernen: " : "Remove: ") + name)) run();
  }
  // actionBars for a VM row — mirrors docker.js actionBars(): row1 WebUI/Log/Edit, row2 Restart/
  // Pause|Resume/Stop|Start + "…", more = Console/Hibernate/ForceStop/Snapshot/Clone/Remove(+Disks).
  function vmActionBars(tr) {
    var de = LANG === "de";
    var cx = vmCtxFor(tr), uuid = cx.uuid, name = cx.name, st = cx.state;
    var running = st === "running", paused = st === "paused" || st === "pmsuspended", shutoff = !running && !paused;
    var path = location.pathname; var xi = path.indexOf("?"); if (xi !== -1) path = path.substring(0, xi);
    var bar = el("div", "cc-actbar");
    var r1 = el("div", "cc-actrow");
    // Primary icon = VNC/VM console (user: replace the Docker "WebUI" globe with the VNC console). Opens vmrcurl.
    r1.appendChild((cx.vmrcurl && running) ? actBtn("fa-desktop", (de ? "VNC-Konsole" : "VNC Console") + (cx.proto ? " (" + cx.proto + ")" : ""), function () { window.open(cx.vmrcurl, "_blank", "scrollbars=yes,resizable=yes"); }) : actBtnOff("fa-desktop", de ? "keine Konsole" : "no console"));
    r1.appendChild((cx.log && typeof window.openTerminal === "function") ? actBtn("fa-navicon", "Log", function () { window.openTerminal("log", name, cx.log); }) : actBtnOff("fa-navicon", "Log"));
    r1.appendChild(actBtn("fa-pencil", de ? "Bearbeiten" : "Edit", function () { location.href = path + "/UpdateVM?uuid=" + uuid; }));
    var r2 = el("div", "cc-actrow");
    r2.appendChild(running ? actBtn("fa-refresh", de ? "Neustart" : "Restart", function () { vmDisp("domain-restart", uuid); }) : actBtnOff("fa-refresh", de ? "Neustart" : "Restart"));
    r2.appendChild(paused ? actBtn("fa-play", de ? "Fortsetzen" : "Resume", function () { vmDisp(st === "pmsuspended" ? "domain-pmwakeup" : "domain-resume", uuid); })
      : (running ? actBtn("fa-pause", "Pause", function () { vmDisp("domain-pause", uuid); }) : actBtnOff("fa-pause", "Pause")));
    r2.appendChild((running || paused) ? actBtn("fa-stop", de ? "Stoppen" : "Stop", function () { vmDisp("domain-stop", uuid); })
      : actBtn("fa-play", de ? "Starten" : "Start", function () { vmDisp("domain-start", uuid); }));
    var more = el("div", "cc-actrow cc-actmore");
    if (cx.vmrcurl && running) more.appendChild(actBtn("fa-desktop", (de ? "VM-Konsole" : "VM Console") + (cx.proto ? " (" + cx.proto + ")" : ""), function () { window.open(cx.vmrcurl, "_blank", "scrollbars=yes,resizable=yes"); }));
    if (running) more.appendChild(actBtn("fa-bed", de ? "Ruhezustand" : "Hibernate", function () { vmDisp("domain-pmsuspend", uuid); }));
    if (running || paused) more.appendChild(actBtn("fa-bomb", de ? "Stopp erzwingen" : "Force Stop", function () { vmDisp("domain-destroy", uuid); }));
    if ((running || shutoff) && typeof window.selectsnapshot === "function") more.appendChild(actBtn("fa-camera", de ? "Snapshot erstellen" : "Create Snapshot", function () { window.selectsnapshot(uuid, name, "--generate", "create", false, st, cx.fstype); }));
    if (shutoff && typeof window.VMClone === "function") more.appendChild(actBtn("fa-clone", de ? "Klonen" : "Clone", function () { window.VMClone(uuid, name); }));
    if (shutoff) {
      more.appendChild(actBtn("fa-minus", de ? "VM entfernen" : "Remove VM", function () { vmRemove(uuid, name, false); }));
      more.appendChild(actBtn("fa-trash", de ? "VM + Disks entfernen" : "Remove VM & Disks", function () { vmRemove(uuid, name, true); }));
    }
    r2.appendChild(more.children.length ? actBtn("fa-ellipsis-h", de ? "Mehr" : "More", function () { more.classList.toggle("cc-open"); tintAct(more); })
      : actBtnOff("fa-ellipsis-h", de ? "keine weiteren Aktionen" : "no more actions"));
    bar.appendChild(r1); bar.appendChild(r2);
    tintAct(bar);
    return { bar: bar, more: more, sig: st + "|" + cx.webui + "|" + cx.vmrcurl + "|" + cx.log + "|" + uuid };
  }
  function injectVmActionCell(tr, nameTd) {
    try {
      var de = LANG === "de";
      nameTd = nameTd || tr.querySelector(":scope > td.vm-name");
      var head = document.querySelector("#kvm_table thead tr");
      // Header Actions TH inserted ONCE, right after the Name th. It MUST stay in lockstep with the row TD
      // below: thead is a SEPARATE block that survives #kvm_list AJAX re-renders, so if any row lacks its
      // Actions TD while this TH exists, that row renders one column short (CPU+RAM badge lands under
      // "Beschreibung" — the reported shift).
      if (head && !head.querySelector(".cc-act-th")) {
        var nameTh = head.querySelector("th.th1") || head.children[0];
        var th = el("th", "cc-act-th", de ? "Aktionen" : "Actions");
        head.insertBefore(th, nameTh ? nameTh.nextSibling : head.firstChild);
      }
      var old = tr.querySelector(":scope > td.cc-actcell");
      var ab = null;
      try { ab = vmActionBars(tr); } catch (e) { ab = null; }              // per-row failure must NOT skip the TD
      if (old) { if (ab && old.getAttribute("data-cc-sig") === ab.sig) return; old.remove(); } // rebuild only on change
      var td = el("td", "cc-actcell");
      if (ab) { td.setAttribute("data-cc-sig", ab.sig); td.appendChild(ab.bar); td.appendChild(ab.more); }
      // ALWAYS insert the TD (even empty) so header-TH / body-TD column counts can never diverge -> no shift.
      tr.insertBefore(td, nameTd ? nameTd.nextSibling : (tr.children[1] || null));
    } catch (e) {}
  }
  function vmCell(td, label, kind) {
    if (!td || td.classList.contains("cc-vmb-cell")) return;
    if (td.querySelector("br, table, .diskresize")) return;      // skip multi-line / interactive cells
    var txt = (td.textContent || "").trim(); if (!txt || txt === "-") return;
    var b = el("span", "cc-b cc-b-info" + (kind ? " cc-b-" + kind : ""));
    if (label) b.appendChild(el("span", "cc-b-k", label));
    var v = el("span", "cc-b-v"); while (td.firstChild) v.appendChild(td.firstChild); b.appendChild(v);  // keep live children (a.vcpu-*) inside .cc-b-v
    td.appendChild(b); td.classList.add("cc-vmb-cell");
  }
  // CPU + RAM merged into ONE stacked column, mirroring Docker's .cc-resgroup (docker.css:229-231).
  // Docker keeps cpu-/mem- in one native cell; VMs split them, so we move the RAM badge under the CPU
  // badge in the CPU cell and HIDE the native RAM cell + header. Live children are MOVED (not cloned).
  function vmResCell(cpuTd, ramTd) {
    if (!cpuTd || cpuTd.classList.contains("cc-vmb-cell")) return;
    var vmn = vmNameOf(cpuTd.closest("tr"));
    var lim = (vmn && vmLims[vmn]) || {}, s = limSet(lim);
    var group = el("div", "cc-resgroup"); if (vmn) group.setAttribute("data-cc-vm", vmn);
    // CPU line — badge + its own rainbow-kind gear (Docker-identical: docker.js resLine + limGear)
    var cb = el("span", "cc-b cc-b-info cc-b-cpu"); cb.appendChild(el("span", "cc-b-k", "CPU"));
    var cv = el("span", "cc-b-v"); var cpuTxt = (cpuTd.textContent || "").trim();
    if (cpuTxt && cpuTxt !== "-") { while (cpuTd.firstChild) cv.appendChild(cpuTd.firstChild); } else cv.textContent = "–";
    cb.appendChild(cv);
    group.appendChild(vmResLine(cb, vmn ? vmGear(vmn, "cpu", s.cpu) : null));
    // RAM line
    if (ramTd) {
      var rb = el("span", "cc-b cc-b-info cc-b-ram"); rb.appendChild(el("span", "cc-b-k", "RAM"));
      var rv = el("span", "cc-b-v"); var ramTxt = (ramTd.textContent || "").trim();
      if (ramTxt && ramTxt !== "-") { while (ramTd.firstChild) rv.appendChild(ramTd.firstChild); } else rv.textContent = "–";
      rb.appendChild(rv);
      group.appendChild(vmResLine(rb, vmn ? vmGear(vmn, "ram", s.ram) : null));
      ramTd.style.display = "none"; ramTd.classList.add("cc-vmb-ramcell");   // hidden, reverted in teardown
    }
    // BW line — VMs have no native BW cell; the badge shows the CONFIGURED cap (↓/↑), Docker-shaped.
    var bwB = el("span", "cc-b cc-b-info cc-b-bw"); bwB.appendChild(el("span", "cc-b-k", "BW"));
    bwB.appendChild(el("span", "cc-b-v", vmBwText(lim)));
    group.appendChild(vmResLine(bwB, vmn ? vmGear(vmn, "bw", s.bw) : null));
    cpuTd.appendChild(group); cpuTd.classList.add("cc-vmb-cell", "cc-vmb-rescell");
    hideResHeader();
  }
  // Hide the native RAM/Memory column header ONCE (thead persists across tbody re-renders). Located by
  // header TEXT (the injected Actions column shifts indices, so nth-child is fragile). Reverted in teardown.
  function hideResHeader() {
    try {
      var head = document.querySelector("#kvm_table thead tr");
      if (!head || head.getAttribute("data-cc-reshdr")) return;
      var ths = head.querySelectorAll("th");
      for (var i = 0; i < ths.length; i++) {
        var t = (ths[i].textContent || "").trim().toLowerCase();
        if (/memory|speicher|^ram\b|^mem\b/.test(t)) { ths[i].style.display = "none"; ths[i].classList.add("cc-vmb-ramhdr"); break; }
      }
      head.setAttribute("data-cc-reshdr", "1");
    } catch (e) {}
  }
  // IP cell: the native $iptablestr joins one "addr/prefix" per line with <br> (VMMachines.php), and
  // textContent DROPS those <br> separators, gluing "…/24" + "10.…" into garbage ("24172…"). Split
  // STRUCTURALLY on the <br> element boundaries instead, validate each line, and emit Docker-style
  // click-to-copy pills. If there are no addresses (e.g. "guest agent" note) keep the native content.
  function vmIpCell(td) {
    if (!td || td.classList.contains("cc-vmb-cell")) return;
    var span = td.querySelector("span.vmgraphics") || td, lines = [], cur = "";
    Array.prototype.forEach.call(span.childNodes, function (n) {
      if (n.nodeType === 1 && n.tagName === "BR") { lines.push(cur); cur = ""; }
      else cur += (n.textContent || "");
    });
    lines.push(cur);
    var ips = lines.map(function (s) { return s.trim(); }).filter(function (s) {
      return /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d+)?$/.test(s) || /^[0-9a-f:]+(?:\/\d+)?$/i.test(s);
    });
    if (!ips.length) return;
    var wrap = el("span", "cc-vmb-ips");
    ips.forEach(function (ip) {
      var b = el("span", "cc-b cc-b-info cc-b-ip cc-b-copy"); b.appendChild(el("span", "cc-b-k", "IP")); b.appendChild(el("span", "cc-b-v", ip));
      b.title = "Klicken zum Kopieren";
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ip); } catch (_) {} b.classList.add("cc-copied"); setTimeout(function () { try { b.classList.remove("cc-copied"); } catch (x) {} }, 600); });
      wrap.appendChild(b);
    });
    for (var c = td.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) c.style.display = "none"; }  // hide native, don't destroy -> reversible teardown
    td.appendChild(wrap); td.classList.add("cc-vmb-cell", "cc-vmb-ipcell");
  }
  // DISKS cell (native td index 4): span.state = "DISKS&nbsp;&nbsp;&nbsp;&nbsp;CDS<a.hand ISO-picker><br>(Snapshots: X)".
  // vmCell skips it (has a <br>). Split into three Docker-style badges (vDisks / CD / Snapshots), CLONE the
  // live ISO-picker a.hand (inline onclick survives cloneNode) into the CD badge, hide the native span
  // (reversible). The .diskresize control lives in the separate child detail table, not this cell.
  function vmDiskCell(td) {
    if (!td || td.classList.contains("cc-vmb-cell")) return;
    var span = td.querySelector(":scope > span.state"); if (!span) return;
    var preTxt = "", postTxt = "", seenBr = false, link = null;
    Array.prototype.forEach.call(span.childNodes, function (n) {
      if (n.nodeType === 1 && n.tagName === "BR") { seenBr = true; return; }
      if (!seenBr) { if (n.nodeType === 1 && n.classList && n.classList.contains("hand")) link = n; else preTxt += (n.textContent || ""); }
      else postTxt += (n.textContent || "");
    });
    var parts = preTxt.split(/\s+/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
    var disksVal = parts.length ? parts[0] : "", cdsVal = parts.length > 1 ? parts.slice(1).join(" ") : "";
    var sm = /\(([^:]+):\s*([^)]*)\)/.exec(postTxt.replace(/ /g, " ").trim());
    var snapLabel = sm ? sm[1].trim() : "Snapshots", snapVal = sm ? sm[2].trim() : "";
    var mk = function (label, value, kind) {
      var b = el("span", "cc-b cc-b-info" + (kind ? " cc-b-" + kind : "")); b.appendChild(el("span", "cc-b-k", label));
      var v = el("span", "cc-b-v"); v.textContent = value; b.appendChild(v); return b;
    };
    var wrap = el("span", "cc-vmb-disks");
    if (disksVal && disksVal !== "-") {
      // vDisks badge gets a gear behind it (Docker-style) that opens the live-resize editor.
      var vmn = vmNameOf(td.closest("tr"));
      var vdB = mk("vDisks", disksVal, "vol");
      wrap.appendChild(vmn ? vmResLine(vdB, vmGear(vmn, "disk", false)) : vdB);
    }
    if (cdsVal) {
      var cdB = mk("CD", cdsVal, "vol");
      if (link) { var cl = link.cloneNode(true); cl.style.marginLeft = "6px"; cdB.querySelector(".cc-b-v").appendChild(cl); }
      wrap.appendChild(cdB);
    }
    if (snapVal) wrap.appendChild(mk(snapLabel, snapVal, ""));
    if (!wrap.childNodes.length) return;               // nothing parseable -> leave native untouched
    span.style.display = "none";                        // hide native, reversible
    td.appendChild(wrap); td.classList.add("cc-vmb-cell", "cc-vmb-diskcell");
  }
  function enhanceCells() {
    try {
      var rows = document.querySelectorAll("#kvm_list tr.sortable");
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        // T5: per-row rotating palette colour so the VM logo TILE joins the rainbow (VM badges are coloured
        // per KIND, so a row has no single colour). Cleared when rainbow off; the tile rule prefers this over
        // the custom iconbg colour, exactly like the Docker + Plugin tabs.
        try {
          if (ls("cc.theming") !== "0" && ls("cc.rainbow") === "1") {
            var _off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET, _pal = RB_PAL;
            try { if (ls("cc.flagmode") === "1") { var _f = JSON.parse(ls("cc.flagpal") || "null"); if (_f && _f.length) _pal = _f; } else { var _r = JSON.parse(ls("cc.rbpal") || "null"); if (_r && _r.length) _pal = _r; } } catch (_e) {}
            var _c = _pal[(i + _off) % _pal.length], _n = parseInt(String(_c).replace("#", ""), 16), _L = 0.299 * (_n >> 16 & 255) + 0.587 * (_n >> 8 & 255) + 0.114 * (_n & 255);
            row.style.setProperty("--cc-rb-c", _c); row.style.setProperty("--cc-rb-ct", _L > 150 ? "#161616" : "#fff");
          } else { row.style.removeProperty("--cc-rb-c"); row.style.removeProperty("--cc-rb-ct"); }
        } catch (_eR) {}
        // CONTENT-ANCHORED cell lookup (ground truth: dynamix.vm.manager VMMachines.php L217-229). Fixed
        // tds[] indices are fragile (a row transiently missing its injected Actions TD shifts everything);
        // anchor every cell by class/content so it always maps to the right column, description or not.
        var nameTd = row.querySelector(":scope > td.vm-name");
        var vcpuA = row.querySelector(":scope > td a[class*='vcpu-']");   // <a class='vcpu-$uuid'> (L224)
        var cpuTd = vcpuA ? vcpuA.closest("td") : null;
        var ramTd = cpuTd ? cpuTd.nextElementSibling : null;             // $mem cell (L225)
        var descTd = null;                                               // the cell before vCPU, unless it's name/Actions
        if (cpuTd) { var p = cpuTd.previousElementSibling; if (p && !p.classList.contains("vm-name") && !p.classList.contains("cc-actcell")) descTd = p; }
        var diskSpan = row.querySelector(":scope > td > span.state");    // vm-name's span.state is nested -> never matches (L226)
        var diskTd = diskSpan ? diskSpan.parentNode : null;
        var vg = row.querySelectorAll(":scope > td > span.vmgraphics");  // graphics (L227) then ip (L228), document order
        var graphicsTd = vg[0] ? vg[0].parentNode : null, ipTd = vg[1] ? vg[1].parentNode : null;
        if (descTd) vmCell(descTd, "", "");            // description -> plain accent pill (self-skips when empty)
        if (cpuTd) vmResCell(cpuTd, ramTd);            // CPU + RAM merged into ONE stacked column
        if (graphicsTd) vmCell(graphicsTd, "", "");    // graphics -> plain accent pill
        if (ipTd) vmIpCell(ipTd);                      // IP addresses -> one copy-pill each
        if (diskTd) vmDiskCell(diskTd);                // disks -> vDisks/CD/Snapshots badges
        injectVmActionCell(row, nameTd);               // LAST: always inserts the Actions <td> right after td.vm-name
      }
    } catch (e) {}
  }
  function enhanceCellsTeardown() {
    try {
      var cells = document.querySelectorAll("#kvm_list td.cc-vmb-cell");
      for (var i = 0; i < cells.length; i++) {
        var td = cells[i];
        if (td.classList.contains("cc-vmb-rescell")) continue;   // merged CPU+RAM cell handled by the dedicated pass below
        if (td.classList.contains("cc-vmb-diskcell")) {          // disks cell: drop badges, un-hide the native span
          var dw = td.querySelector(":scope > span.cc-vmb-disks"); if (dw) td.removeChild(dw);
          var ds = td.querySelector(":scope > span.state"); if (ds) ds.style.removeProperty("display");
          td.classList.remove("cc-vmb-cell", "cc-vmb-diskcell"); continue;
        }
        if (td.classList.contains("cc-vmb-ipcell")) {         // IP cell: drop the pills, un-hide the native content
          var ipw = td.querySelector(":scope > span.cc-vmb-ips"); if (ipw) td.removeChild(ipw);
          for (var c = td.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) c.style.removeProperty("display"); }
          td.classList.remove("cc-vmb-cell", "cc-vmb-ipcell"); continue;
        }
        var b = td.querySelector(":scope > span.cc-b-info");
        if (b) { var k = b.querySelector(".cc-b-k"); if (k) b.removeChild(k); var v = b.querySelector(".cc-b-v"); var src = v || b; while (src.firstChild) td.insertBefore(src.firstChild, b); td.removeChild(b); }
        td.classList.remove("cc-vmb-cell");
      }
      // merged CPU+RAM rescell: move both values back to their native cells, un-hide the RAM cell + header
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list td.cc-vmb-rescell")).forEach(function (cpuTd) {
        var g = cpuTd.querySelector(":scope > .cc-resgroup"), ramTd = cpuTd.nextElementSibling;
        if (g) {
          var cpuV = g.querySelector(".cc-b-cpu .cc-b-v"), ramV = g.querySelector(".cc-b-ram .cc-b-v");
          if (cpuV) while (cpuV.firstChild) cpuTd.insertBefore(cpuV.firstChild, g);
          if (ramV && ramTd) while (ramV.firstChild) ramTd.appendChild(ramV.firstChild);
          g.remove();
        }
        if (ramTd && ramTd.classList.contains("cc-vmb-ramcell")) { ramTd.style.removeProperty("display"); ramTd.classList.remove("cc-vmb-ramcell"); }
        cpuTd.classList.remove("cc-vmb-cell", "cc-vmb-rescell");
      });
      var rh = document.querySelector("#kvm_table thead tr .cc-vmb-ramhdr"); if (rh) { rh.style.removeProperty("display"); rh.classList.remove("cc-vmb-ramhdr"); }
      var hdrRow = document.querySelector("#kvm_table thead tr[data-cc-reshdr]"); if (hdrRow) hdrRow.removeAttribute("data-cc-reshdr");
      // drop the injected Actions column + its header so master-theming/area-off fully reverts
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list td.cc-actcell")).forEach(function (td) { td.remove(); });
      var actTh = document.querySelector("#kvm_table thead tr .cc-act-th"); if (actTh) actTh.remove();
    } catch (e) {}
  }
  function apply() {
    var root = document.documentElement;
    var live = ls("cc.theming") !== "0" && ls("cc.enable.vms") !== "0";
    root.classList.toggle("cc-vms-on", live);
    if (!live) { root.classList.remove("cc-sections-vms"); stripVmTheming(); enhanceCellsTeardown(); flattenTeardown(); return; } // MASTER THEMING / area off: VMs page fully native
    try { enhanceRows(); } catch (e) {}
    try { enhanceCells(); } catch (e) {}
    try { wrapVmStats(); } catch (e) {}   // #22: chip-wrap the VM-usage-stats readouts
    // Tab-Ansicht (cc.sections.vms, default OFF): stacked CC sections vs native sub-tabs. MUST run BEFORE
    // the adopt/tint early-return below so it still applies with adopt-off + no tint colour. Idempotent.
    try {
      var vmSections = ls("cc.sections.vms") === "1";
      root.classList.toggle("cc-sections-vms", vmSections);
      var vbox = document.getElementById("displaybox");
      if (vbox) { if (vmSections) cardPanels(vbox); else flattenTeardown(); }
    } catch (e) {}
    try { ensureViewToggle(); applyView(); } catch (e) {}   // Grid/List view (cc.vmview)
    try { applyRainbowPalette(); var vmRb = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1"; root.classList.toggle("cc-vm-rainbow", vmRb); root.classList.toggle("cc-vm-rbneutral", ls("cc.theming") !== "0" && ls("cc.rbmode") === "active"); } catch (e) {}   /* #N4/#2: reactive -> badges rest grey, colour on hover; also in Normal mode (rbmode default "all" -> off by default) */
    // RE-TINT every visible action bar on ANY colour-mode change. injectVmActionCell's rebuild guard
    // (data-cc-sig = state|webui|vmrcurl|log|uuid) is colour-mode-INDEPENDENT, so a rainbow/reactive/accent
    // toggle keeps the old cell and never re-runs tintAct — the bar kept its stale inline colours. Re-tint
    // the existing bars in place (cheaper than a rebuild); passing td.cc-actcell also catches the .cc-actmore
    // extras (a TD sibling of .cc-actbar). tintAct() re-reads cc.rainbow / cc.rbmode / cc.actcolors / cc.accent.
    try { Array.prototype.forEach.call(document.querySelectorAll("#kvm_list td.cc-actcell"), function (cell) { tintAct(cell); }); } catch (e) {}
    // RE-COLOUR the limit gears on any colour-mode change too: enhanceCells is idempotent (won't
    // rebuild a built res cell), so a rainbow/accent toggle would otherwise leave the gears' inline
    // fill stale. refreshAllRes re-runs vmGearFill per gear (cheap; reads the current mode).
    try { refreshAllRes(); } catch (e) {}
    // adopt-toggle ON (default) -> Docker's cc.* settings; OFF -> own ccv.* keys.
    // Stay even with adopt-off + no tint colour when the Logo-Hintergrund badge is on.
    if (ls("cc.stylevms") === "0" && !ls("ccv.iconcolor") && effK("iconbg") !== "1") return;
    paintVmIcons();
  }
  // The icon pass, factored OUT of apply() so the per-VM Icon-Färbung dropdown can repaint
  // straight away. It has to be its own function: openVmEd declares `var apply = null` for
  // its Apply BUTTON, which shadows the page-level apply() for that whole function — calling
  // apply() from inside the editor threw "not a function" into a swallowing catch and the
  // pinned VM only repainted on the next native list rebuild. Caught live on the box.
  function paintVmIcons() {
    try {
      var imgs = vmImgs();
      var ibgOn = effK("iconbg") === "1"; var ibgAcc = vmBgColor();
      // Logo-Hintergrund badge box is now drawn by VmTab.css via html.cc-vm-iconbg (mirroring Docker's
      // cc-docker-iconbg) — the box shape/size/circle live in CSS. We only toggle the class + hand it the
      // tint colour; the monochrome ink flatten still has to be an INLINE filter on each logo image.
      var root2 = document.documentElement;
      root2.classList.toggle("cc-vm-iconbg", ibgOn);
      if (ibgOn && ibgAcc) root2.style.setProperty("--cc-iconbg-color", ibgAcc); else root2.style.removeProperty("--cc-iconbg-color");
      // Master ADOPT toggle ON: TWO shared filters (black ink, white ink — idealText() only
      // ever answers one of the two) built ONCE, page-wide; each row below picks whichever
      // matches ITS OWN resolved background instead of every row sharing ONE filter built
      // from a single representative colour (the v4.33.1 bug — see vmItemAdoptInk()).
      var f, flat, c, fBlk, fWht, flatBlk, flatWht, vmInk;
      var adopt = effK("iconbgrainbow") === "1";
      if (adopt) {
        flatBlk = ensureFlatFilter("cc-vm-mono-svg-blk", "cc-vm-mono-tint-blk", "#161616");
        flatWht = ensureFlatFilter("cc-vm-mono-svg-wht", "cc-vm-mono-tint-wht", "#fff");
        fBlk = ensureTintFilterAs("cc-vm-tint-svg-blk", "cc-vm-icon-tint-blk", "#161616") ? "url(#cc-vm-icon-tint-blk)" : "";
        fWht = ensureTintFilterAs("cc-vm-tint-svg-wht", "cc-vm-icon-tint-wht", "#fff") ? "url(#cc-vm-icon-tint-wht)" : "";
      } else {
        f = filterVal(); c = tintColor();
        // ONE flat filter for the page, from the SAME ink the tint uses (vmIconInk(), which already
        // answers "" whenever Einfärben is off, badge or not) — branching on ibgOn directly here
        // instead (as this used to) reintroduces the background-forces-tint bug: it would flatten
        // every icon to the box's ink even with Einfärben off, since it never checked vmInk at all.
        vmInk = vmIconInk(false);
        flat = vmInk ? ensureFlatFilter("cc-vm-mono-svg", "cc-vm-mono-tint", vmInk) : ensureFlatFilter("cc-vm-mono-svg", "cc-vm-mono-tint", "");
      }
      var CI = window.CCTheme && window.CCTheme.icons, vmNames = [];
      for (var i = 0; i < imgs.length; i++) {
        var n = imgs[i], vname = vmIconName(n);
        if (vname) vmNames.push(vname);
        var plan = vmIconPlan(n, vname);
        // Adopting: this ROW's own ink/filters (see block above); everything else: the
        // single page-wide values, unchanged.
        var thisFlat = flat, thisTint = f, thisInk = vmInk;
        if (adopt) {
          var rowInk = vmItemAdoptInk(n.closest("tr")), rowBlk = rowInk !== "#fff";
          thisFlat = rowBlk ? flatBlk : flatWht;
          thisTint = rowBlk ? fBlk : fWht;
          thisInk = rowInk;
        }
        var want = plan.treat === "native" ? "" : (plan.treat === "flat" ? thisFlat : thisTint);
        if (n.tagName === "IMG") { vmSetIconSrc(n, plan.url); n.style.filter = want; if (ibgOn) n.style.removeProperty("color"); }
        // font-glyph: `color` is the reliable exact tint. Set it with PRIORITY — Unraid's VM CSS colours
        // these glyphs via a class rule, which a plain inline colour can lose to; `!important` wins. With
        // the badge on, the ink is the accent's ideal text colour (b/w contrast).
        else {
          var gif = glyphInkAndFilter(plan, ibgOn, ibgAcc, thisInk || c || "");
          if (gif.color) n.style.setProperty("color", gif.color, "important"); else n.style.removeProperty("color");
          n.style.filter = gif.filter;
        }
      }
      if (CI && vmNames.length) CI.want(vmNames);
    } catch (e) {}
  }
  function connectObserver() {
    // Observe ONLY the VM list container — NEVER document.body: our tint SVG host lives
    // on body, so observing body could see our own writes. If the list container isn't
    // present there is nothing to tint (the tbody is server-rendered on the real page).
    var host = document.getElementById("kvm_list") || document.getElementById("kvm_table");
    if (!host) return;
    // Icon pipeline: repaint once an engine lookup or a complexity measurement lands. Fires
    // only on a real change (cc-theme.js), so it settles instead of looping.
    try { if (window.CCTheme && window.CCTheme.icons) window.CCTheme.icons.onResolved(function () { if (!dead) paintVmIcons(); }); } catch (e) {}
    // debounced: the VM list re-renders in bursts; re-apply at most every ~300ms.
    // (childList only — we never observe attributes, so our own style writes can't
    // re-trigger this into a loop.)
    // LEADING-EDGE: paint the reskin in the SAME frame the VM rows appear (a MutationObserver callback
    // runs before the browser paints) instead of 300ms later — the trailing debounce was the visible
    // "theme renders slowly after a tab switch" delay. A burst still coalesces into one trailing pass.
    function vmSweep() {
      moPending = true; moTrail = false;
      try { mo.disconnect(); } catch (e) {}   // our own badge writes (subtree) must not re-fire us during the pass
      if (!dead) { try { apply(); } catch (e) {} }
      // #54: the FIRST real pass is what the tab-load spinner was covering for; later native rebuilds
      // (polling, a VM action) are fast/invisible already and must not re-arm the overlay. Same minimum-
      // visible-time guard as docker.js's #33 (moSweep) - clearing the instant a fast pass finishes never
      // gave the spinner a chance to actually paint a frame.
      if (!ccFirstPaintDone) {
        ccFirstPaintDone = true;
        var ccEnhMinMs = 400, ccEnhElapsed = Date.now() - ccEnhBusyStart;
        if (ccEnhElapsed >= ccEnhMinMs) document.documentElement.classList.remove("cc-enh-busy");
        else setTimeout(function () { document.documentElement.classList.remove("cc-enh-busy"); }, ccEnhMinMs - ccEnhElapsed);
      }
      try { mo.observe(host, { childList: true, subtree: true }); } catch (e) {}
      moTimer = setTimeout(function () {
        moTimer = null; moPending = false;
        if (moTrail && !dead) vmSweep();
      }, 300);
    }
    mo = new MutationObserver(function () {
      if (dead) return;
      if (moPending) { moTrail = true; return; }
      vmSweep();
    });
    mo.observe(host, { childList: true, subtree: true });
    // paint immediately if the list is already populated (observer won't fire without a future mutation)
    try { if (!moPending && host.querySelector("tr")) vmSweep(); } catch (e) {}
    // #22: the VM-usage-stats table (#vmstats) is LAZILY rendered when its subtab is first opened, so an
    // observer bound to #vmstats here would miss it. Bind to the STABLE #displaybox instead (always present
    // on /VMs) and re-wrap the readout cells whenever anything under it changes. Debounced; the
    // already-wrapped guard means our own wrap can't loop it. Cheap no-op while #vmstats isn't there.
    try {
      var dbox = document.getElementById("displaybox");
      if (dbox && !smo) {
        wrapVmStats();
        // #8 (user: "flippt bei jeder Aktualisierung kurz ins native Design"): re-wrap SYNCHRONOUSLY in
        // the observer callback (MutationObserver runs as a microtask BEFORE the browser paints), so the
        // re-badging lands before the native cells are ever shown — no flash. The already-wrapped guard in
        // wrapVmStats makes our own DOM writes a cheap no-op on the follow-up callback (no loop).
        smo = new MutationObserver(function () { if (dead) return; wrapVmStats(); });
        smo.observe(dbox, { childList: true, subtree: true });
      }
    } catch (e) {}
  }
  function teardown() {
    if (dead) return; dead = true;
    try { if (mo) mo.disconnect(); mo = null; } catch (e) {}
    try { if (moTimer) { clearTimeout(moTimer); moTimer = null; } } catch (e) {}
    try { if (smo) smo.disconnect(); smo = null; } catch (e) {}
    try { if (liveTimer) clearInterval(liveTimer); liveTimer = null; } catch (e) {}
    try { if (vmBwTimer) { clearInterval(vmBwTimer); vmBwTimer = null; } } catch (e) {}
    try { document.documentElement.classList.remove("cc-vms-on", "cc-vm-iconbg", "cc-sections-vms", "cc-vmgrid", "cc-vm-rainbow", "cc-vm-rbneutral"); document.documentElement.style.removeProperty("--cc-iconbg-color"); } catch (e) {}
    try { RB_KINDS.forEach(function (k) { document.documentElement.style.removeProperty("--cc-rb-" + k); document.documentElement.style.removeProperty("--cc-rb-" + k + "-t"); }); var vt = document.getElementById("cc-vm-viewtoggle"); if (vt) { var vbar = vt.closest(".cc-vm-toolbar") || vt; if (vbar.parentNode) vbar.parentNode.removeChild(vbar); } } catch (e) {}
    try { enhanceCellsTeardown(); flattenTeardown(); } catch (e) {}
    try { var imgs = vmImgs(); for (var i = 0; i < imgs.length; i++) { imgs[i].style.filter = ""; imgs[i].style.removeProperty("color"); var w = imgs[i].parentElement; if (w) { w.style.removeProperty("background"); w.style.removeProperty("border-radius"); w.style.removeProperty("width"); w.style.removeProperty("height"); w.style.removeProperty("padding"); w.style.removeProperty("display"); w.style.removeProperty("align-items"); w.style.removeProperty("justify-content"); w.style.removeProperty("box-sizing"); } } } catch (e) {}
    try { ["cc-vm-tint-svg", "cc-vm-mono-svg", "cc-vm-tint-svg-blk", "cc-vm-tint-svg-wht", "cc-vm-mono-svg-blk", "cc-vm-mono-svg-wht"].forEach(function (id) { var h = document.getElementById(id); if (h) h.remove(); }); } catch (e) {}
  }
  function arm() {
    dead = false;
    // #54 (user: "der vm tab dauert ewig bis er geöffnet wird ... spinner anzeigen solange es lädt"): same
    // mechanism as docker.js's #33 - header.js's ccLoadState() holds the native tab-load overlay open while
    // html.cc-enh-busy is set, with a minimum visible time so a fast enhancement pass still gets a chance to
    // paint at least one frame. The VM tab never had this at all (unlike Docker, pre-#33). This does NOT
    // touch the real bottleneck (VMMachines.php itself takes ~700ms server-side for the libvirt query,
    // before the browser even starts rendering - not CC's code, not fixable client-side) - it only closes
    // the gap AFTER the page starts arriving, same as #33 did for Docker.
    document.documentElement.classList.add("cc-enh-busy");
    ccEnhBusyStart = Date.now();
    setTimeout(function () { document.documentElement.classList.remove("cc-enh-busy"); }, 5000);
    apply();
    connectObserver();
    // The VM list tbody (#kvm_list) is usually populated by an AJAX loadlist() AFTER this
    // defer-loaded script runs — so connectObserver() no-ops (no tbody yet) and the first
    // apply() finds nothing. That is why the tint "sometimes" didn't take: a timing race,
    // not the colour code. Retry attaching the observer AND re-applying for a short window
    // until the list appears and is tinted, so a late-rendered VM list still colours.
    var tries = 0;
    var poll = setInterval(function () {
      if (dead) { clearInterval(poll); return; }
      tries++;
      if (!mo) connectObserver();
      apply();
      if ((mo && vmImgs().length) || tries >= 20) clearInterval(poll); // done, or give up after ~10s
    }, 500);
    // liveness: a 404/410 from the proxy means the plugin is gone → clear + stop
    liveTimer = setInterval(function () {
      try { fetch(PROXY + "?path=state", { headers: { Accept: "application/json" } }).then(function (r) { if (r.status === 404 || r.status === 410) teardown(); }).catch(function () {}); } catch (e) {}
    }, 8000);
    // live BW rate: only spend the (heavy) /api/vms round-trip while a VM is actually RUNNING — when all
    // are stopped the badges show the configured cap and this is a cheap DOM check, no virsh load.
    if (!vmBwTimer) vmBwTimer = setInterval(function () {
      try { if (dead) return; if (!document.querySelector("#kvm_list .cc-badge-running")) { vmRate = {}; return; } pollVmBw(); } catch (e) {}
    }, 4000);
  }
  function boot() {
    // vms.js now loads GLOBALLY via the Buttons hook (CannonadeCommand.VmTab.page) so it reliably runs
    // on /VMs — the old Menu="VMs" injector went through the tabbed inline-eval branch, which never
    // executes a <script>, so the whole enhancer was dead. Being global, it must self-gate to /VMs:
    // otherwise its proxy poll/liveness timers would run on every page.
    try { if (location.pathname.replace(/\/+$/, "") !== "/VMs") return; } catch (e) { return; }
    try { window.ccVmsApply = apply; } catch (e) {} // same-tab live toggle hook for the CC Settings page (only set on /VMs, never on the Settings page -> no VmTab.css bleed)
    if (localStorage.getItem("cc.enable.vms") === "0") return; // area disabled in CC settings
    // prime the limits, then colour the gears + fill the BW badges once they land (the first
    // enhanceCells runs before this async load resolves, so the rows build "unset" and this fixes them).
    loadVmLims().then(function () { try { refreshAllRes(); } catch (e) {} });
    loadVmHost(); // prime the host CPU topology for the editor's graphical core-picker (static, once)
    try {
      arm();
      // Clicking a VM ICON no longer opens the native dropdown — the action icons FLASH instead, pointing
      // the user at the actions column (verbatim mirror of docker.js boot() logo flash). If there is no CC
      // action bar (theming off) the native menu opens as before.
      if (!window.__ccVmLogoFlash) {
        window.__ccVmLogoFlash = true;
        document.addEventListener("click", function (e) {
          try {
            if (dead) return;
            if (location.pathname.replace(/\/+$/, "") !== "/VMs") return;
            var hand = e.target && e.target.closest ? e.target.closest("#kvm_list td.vm-name span.hand") : null;
            if (!hand) return;
            var row2 = hand.closest("tr"), bar2 = row2 && row2.querySelector(".cc-actbar");
            if (!bar2) return; // no CC bar -> let the native menu open
            e.preventDefault(); e.stopPropagation();
            bar2.classList.add("cc-act-flash");
            setTimeout(function () { bar2.classList.remove("cc-act-flash"); }, 1600);
          } catch (e2) {}
        }, true);
      }
      window.addEventListener("storage", function (e) { try { if (!dead && e && e.key && e.key !== "cc.stateCache" && /^ccv?\./.test(e.key)) apply(); } catch (e2) {} }); // cc.* AND the VM tab's own ccv.* (accent/iconcolor) — else an adopt-OFF own-colour pick never live-updates. // cc.stateCache EXCLUDED: docker.js rewrites it every 9s, which would repaint this area on a 9s loop in every other open tab
      // persistent re-probe (NEVER cleared): re-arm when the proxy returns, so a
      // transient gap during a plugin UPDATE doesn't kill the tint until reload.
      setInterval(function () { try { if (!dead) return; fetch(PROXY + "?path=state", { headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) arm(); }).catch(function () {}); } catch (e) {} }, 8000);
    } catch (e) { /* never break Unraid's VM page */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
