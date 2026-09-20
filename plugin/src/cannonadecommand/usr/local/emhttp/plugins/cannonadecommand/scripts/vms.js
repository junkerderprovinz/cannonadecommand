/* CannonadeCommand for Unraid's VMs tab: state and info badges, the VM icon tint and the
 * per-VM limits. It reacts live to settings changes through the storage event and clears
 * itself after an uninstall, when the same-origin proxy answers 404. The selectors follow
 * Unraid's VM manager DOM; a build that renders icons differently gets no tint.
 */
(function () {
  "use strict";
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  // The filled gear from docker.js (tabler-icons MIT, icons/filled/settings.svg), copied because
  // vms.js cannot rely on docker.js being loaded. Change both together.
  var CC_GEAR_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" aria-hidden="true"><path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" /></svg>';
  var dead = false, mo = null, liveTimer = null, moPending = false, moTimer = null, moTrail = false, smo = null, smoPending = false, vmBwTimer = null;
  var ccFirstPaintDone = false, ccEnhBusyStart = 0;   // minimum visible spinner, as in docker.js
  // Wraps the memory, disk-IO and network-IO readouts of the VM usage table into chips like the
  // CPU pills. The vm_usage websocket replaces the tbody about every 3s, hence the wrapped check.
  function wrapVmStats() {
    try {
      if (!document.documentElement.classList.contains("cc-vms-on")) return;
      var body = document.getElementById("vmstatsbody") || (function () { var t = document.getElementById("vmstats"); return t ? t.querySelector("tbody") : null; })();
      if (!body) return;
      Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr) {
        var tds = tr.children;
        // the VM name becomes a badge like in the main list
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
  // Rainbow, as in docker.js, so the VM badges share the global palette. The --cc-rb-* vars are
  // stamped on <html>; the kind-to-colour map rotates by the shared seed (cc.rainbowrot). VM info
  // badges carry the kinds cpu/ram/ip.
  var RB_KINDS = ["net", "ip", "lan", "port", "id", "von", "cpu", "ram", "bw", "version", "vol", "plan"];
  var RB_PAL = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];
  if (window.CCTheme) { RB_PAL = window.CCTheme.RB; } // the local copy is the fallback
  var RB_OFFSET = window.CCTheme ? window.CCTheme.rbSeed(RB_PAL.length) : Math.floor(Math.random() * RB_PAL.length); // persisted seed, aligned with the other areas

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  // VM tinting follows the container icon colour unless cc.vmicons is "0".
  function vmTintOff() { return ls("cc.vmicons") === "0"; }
  // Hintergrund and Einfärben are independent, as in docker.js: cc.iconbg/cc.iconbgcolor drive
  // the badge, cc.icontint/cc.iconcolor the tint. An unset icontint means "on whenever a valid
  // icon colour is set", which keeps the look of installs that predate the toggle.
  function vmTintOn() {
    var v = effK("icontint");
    return v == null ? !!effK("iconcolor") : v === "1";
  }
  // While the icons adopt the rainbow/accent, vmBgColor() answers "" and VmTab.css's var() chain
  // falls through to the per-row --cc-rb-c. The ink is then the black/white contrast for the
  // colour this returns: the rainbow "action" slot 5 (--cc-rbaccent), or the accent.
  function vmAdoptTint() {
    if (ls("cc.theming") === "0" || ls("cc.rainbow") !== "1") return ccAccent();
    return vmRbColor(5);
  }
  function vmBgColor() {
    if (iconBgAdoptsV()) return "";   // the CSS rainbow/accent chain decides
    var c = effK("iconbgcolor");
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) return ccHex6(c);
    var ic = effK("iconcolor");
    if (ic && /^#?[0-9a-f]{6}$/i.test(ic)) return ccHex6(ic);
    return ccAccent();
  }
  // The icon ink, as in docker.js iconInk(): with adopt on, the black/white contrast for the
  // resolved background; otherwise the picked tint colour lifted out of the dark end, or "" while
  // Einfärben is off. The badge colour is never the ink. `forTint` doubles the floor because a
  // luminance tint outputs roughly half the target's luma.
  function vmIconInk(forTint) {
    if (iconBgAdoptsV()) return ccIdeal(vmAdoptTint());
    if (!vmTintOn()) return "";
    var pick = effK("iconcolor");
    var valid = pick && /^#?[0-9a-f]{6}$/i.test(pick);
    if (!valid) return "";
    if (!window.CCTheme || !window.CCTheme.liftDark) return ccHex6(pick);
    return ccHex6(window.CCTheme.liftDark(pick, ccAccent(), window.CCTheme.LUM_FLOOR * (forTint ? 2 : 1)));
  }
  // Takes the host and filter ids so the black and white adopt filters can coexist with the
  // page-wide one.
  function ensureTintFilterAs(hostId, filtId, ic) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ic || "");
    var host = document.getElementById(hostId);
    if (dead || vmTintOff() || !m) { if (host) host.remove(); return false; }
    var tr = parseInt(m[1], 16) / 255, tg = parseInt(m[2], 16) / 255, tb = parseInt(m[3], 16) / 255;
    var s = (Math.max(10, parseInt(effK("iconstrength") || "100", 10)) / 100).toFixed(3);
    // shading-preserving: channel = luminance × target colour (matches docker.js)
    var lum = function (c) { return (0.2126 * c).toFixed(4) + " " + (0.7152 * c).toFixed(4) + " " + (0.0722 * c).toFixed(4); };
    if (!host) { host = document.createElement("div"); host.id = hostId; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    // Rewrites the SVG only when colour or strength changed; a blind innerHTML write on every
    // apply() would feed any observer on body into a repaint loop.
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
  // Per-row adopt ink, as in docker.js itemAdoptInk(): the --cc-rb-ct enhanceCells() stamped for
  // this row's rotated colour, else the page-wide answer (Rainbow off, or no stamp yet).
  function vmItemAdoptInk(rowEl) {
    if (rowEl && rowEl.style && ls("cc.theming") !== "0" && ls("cc.rainbow") === "1") {
      var v = rowEl.style.getPropertyValue ? rowEl.style.getPropertyValue("--cc-rb-ct") : "";
      if (v) return v.trim();
    }
    return ccIdeal(vmAdoptTint());
  }
  // The chosen colour as a plain hex, gated the same way. Most VM icons are icon-font glyphs
  // (`<i class="fa fa-… img">`) coloured through CSS `color:`; only real .png icons
  // (`<img class="img">`) take the filter.
  function tintColor() {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(vmIconInk(false) || "");
    if (dead || vmTintOff() || !m) return "";
    return "#" + m[1] + m[2] + m[3];
  }
  // From dynamix.vm.manager VMMachines.php: the VM list is tbody#kvm_list and each row's
  // td.vm-name holds the icon at span[id^="vm-"] > .img (an <img> or an <i> glyph).
  function vmImgs() {
    var sels = ["#kvm_list td.vm-name span[id^='vm-'] > .img", "#kvm_list td.vm-name img.img", "#kvm_list td.vm-name img"];
    for (var i = 0; i < sels.length; i++) { var n = document.querySelectorAll(sels[i]); if (n.length) return n; }
    return [];
  }
  // The VM behind one icon element, for the icon pipeline's lookup + per-VM pin.
  function vmIconName(n) { var tr = n && n.closest ? n.closest("tr") : null; return (tr && vmNameOf(tr)) || ""; }
  // A glyph gets either a css colour or the luminance filter, never both, or the tint would
  // double and dim the hue. Kept separate so the tests can reach it; ibgOn and ibgAcc are unused
  // because `ink` already says whether Einfärben is on.
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
  // A font glyph (<i class="fa … img">) is already monochrome, so it only inks and has no src to
  // swap. Real .png icons run the full chain.
  function vmIconPlan(n, name) {
    var CI = window.CCTheme && window.CCTheme.icons;
    if (!CI) return { treat: "tint", url: "" };
    var isGlyphEl = n.tagName !== "IMG";
    var res = CI.result(name), kind = res && res.kind !== "pending" ? res.kind : "";
    var spread = isGlyphEl ? 0 : CI.spread(n.getAttribute("data-cc-osrc") || n.getAttribute("src") || "");
    var plan = CI.plan(CI.mode("vm", name), kind, spread);
    return { treat: plan.treat, url: (!isGlyphEl && (plan.src === "glyph" || plan.src === "color")) ? CI.svgUrl(name) : "" };
  }
  // cc.stylevms on reads the shared cc.* keys, off the VM area's own ccv.* keys.
  function effK(k) { return ls("cc.stylevms") !== "0" ? ls("cc." + k) : ls("ccv." + k); }
  // Adopting the rainbow is a global decision, so it bypasses effK().
  function iconBgAdoptsV() { return ls("cc.iconbgrainbow") === "1"; }
  function ccIdeal(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  function ccAccent() { var a = effK("accent") || "#2f6feb"; return /^#[0-9a-f]{6}$/i.test(a) ? a : "#2f6feb"; }
  // Expands #rgb to #rrggbb: idealText answers "#fff", while the filter builders and colour
  // regexes here want six digits.
  function ccHex6(c) {
    c = String(c == null ? "" : c).trim();
    return /^#[0-9a-f]{3}$/i.test(c) ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  }
  // Flattens every opaque pixel to one colour with alpha untouched, as docker.js does. Only
  // aimed at a real glyph or an icon the complexity heuristic found to be one tone already.
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
  // Flattens an icon to black on a light accent or white on a dark one.
  function ensureMonoFilter(hostId, filtId, accentHex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(accentHex || "");
    return ensureFlatFilter(hostId, filtId, m ? ccIdeal("#" + m[1]) : "");
  }
  function ccShape() { return ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[ls("cc.badgeshape") || "pill"] || "999px"; }
  // The active palette, as docker.js ccPalActive(): flag mode keeps its own cc.flagpal.
  function vmPalActive() {
    var pal = RB_PAL;
    try { var fjp = ls("cc.flagmode") === "1" ? JSON.parse(ls("cc.flagpal") || "null") : null; var jp = (fjp && fjp.length) ? fjp : JSON.parse(ls("cc.rbpal") || "null"); if (jp && jp.length) pal = jp; } catch (e) {}
    return pal;
  }
  // One palette slot, rotated the same way applyRainbowPalette() rotates the kinds.
  function vmRbColor(i) { var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET; return vmPalActive()[(i + off) % vmPalActive().length]; }
  // Stamps --cc-rb-* on <html> from the global rainbow keys, as docker.js does; cleared when off.
  function applyRainbowPalette() {
    var rt = document.documentElement.style, on = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    if (!on) { rt.removeProperty("--cc-rbaccent"); rt.removeProperty("--cc-rbaccent-text"); RB_KINDS.forEach(function (k) { rt.removeProperty("--cc-rb-" + k); rt.removeProperty("--cc-rb-" + k + "-t"); }); return; }
    var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    var pal = vmPalActive();
    // The rainbow "action" colour (slot 5, like docker.js). VmTab.css's generic badge, the
    // reactive hover, the autostart toggle and the vmstat name badge all read --cc-rbaccent.
    var acc = pal[(5 + off) % pal.length], an = parseInt(String(acc).slice(1), 16);
    var aL = 0.299 * (an >> 16 & 255) + 0.587 * (an >> 8 & 255) + 0.114 * (an & 255);
    rt.setProperty("--cc-rbaccent", acc); rt.setProperty("--cc-rbaccent-text", aL > 150 ? "#161616" : "#fff");
    RB_KINDS.forEach(function (k, i) {
      var c = pal[(i + off) % pal.length], n = parseInt(String(c).slice(1), 16);
      var L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
      rt.setProperty("--cc-rb-" + k, c); rt.setProperty("--cc-rb-" + k + "-t", L > 150 ? "#161616" : "#fff");
    });
  }
  // The VM tab has no grid view: a CSS reflow of Unraid's live tablesorter/sortable table
  // fights its drag and sort machinery, and vms.js has no data model to render real cards.
  function currentView() { return "list"; }
  function applyView() {
    document.documentElement.classList.toggle("cc-vmgrid", currentView() === "grid");
    var tg = document.getElementById("cc-vm-viewtoggle"); if (!tg) return;
    var g = currentView() === "grid", b = tg.querySelectorAll(".cc-seg-btn");
    if (b[0]) b[0].classList.toggle("cc-seg-on", !g); if (b[1]) b[1].classList.toggle("cc-seg-on", g);
  }
  function ensureViewToggle() {
    // removes a List/Grid toggle an older version may have left in the page
    var ex = document.getElementById("cc-vm-viewtoggle");
    if (ex) { var eb = ex.closest(".cc-vm-toolbar") || ex; if (eb.parentNode) eb.parentNode.removeChild(eb); }
  }
  // Tab-Ansicht: flattens the /VMs sub-tabs (#kvm_list and #vmstats) into stacked sections, each
  // headed by a .cc-card-head cloned from its hidden tab button. Same MainContentTabbed DOM as
  // /Shares/Share and /Main.
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
  // Keep this map identical to docker.js ccLogoSizes() and plugins.js logoSize().
  function vmLogoSizes() { return ({ s: ["48px", "62px"], m: ["62px", "78px"], l: ["76px", "94px"] })[ls("cc.sgsize") || "m"] || ["62px", "78px"]; }
  function enhanceRows() {
    try {
      var a = ccAccent(), rad = ccShape(), root = document.documentElement.style;
      root.setProperty("--cc-accent", a); root.setProperty("--cc-accent-text", ccIdeal(a)); root.setProperty("--cc-b-radius", rad);
      // the logo tile follows the global cc.sgsize like the Docker and Plugins tabs
      var lg = vmLogoSizes();
      root.setProperty("--cc-logo-img", lg[0]); root.setProperty("--cc-logo-box", lg[1]);
      // The VM state becomes a Docker state badge. The state comes from the sibling <i.fa> class
      // rather than the translated label, mapped to Docker's running/paused/exited.
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list tr.sortable td.vm-name span.state")).forEach(function (st) {
        var txt = (st.textContent || "").trim(); if (!txt) return;
        var icon = st.previousElementSibling, cls = (icon && icon.className) || "", low = txt.toLowerCase();
        var running = /\bstarted\b|green-text/.test(cls) || /run|l\u00e4uft|gestartet/.test(low);
        var paused = /\bpaused\b|orange-text/.test(cls) || /paus/.test(low);
        var dstate = running ? "running" : paused ? "paused" : "exited";
        st.className = "state cc-badge cc-badge-" + dstate;   // keep native .state (sort/hooks) + Docker classes
        st.style.cssText = "";                                // the look comes from CSS
      });
    } catch (e) {}
  }
  // Reverts every inline visual, so the master theming toggle restores the native VM page
  // without a reload. Unlike teardown it keeps the observer and timers for a re-enable.
  function stripVmTheming() {
    try {
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list tr.sortable td.vm-name span.state")).forEach(function (st) {
        st.className = "state"; st.style.cssText = "";
      });
      document.documentElement.classList.remove("cc-vm-iconbg");
      document.documentElement.style.removeProperty("--cc-iconbg-color");
      var imgs = vmImgs();
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].style.filter = ""; imgs[i].style.removeProperty("color");
        var w = imgs[i].parentElement; if (w) ["background", "border-radius", "width", "height", "padding", "display", "align-items", "justify-content", "box-sizing"].forEach(function (p) { w.style.removeProperty(p); });
      }
      ["cc-vm-tint-svg", "cc-vm-mono-svg", "cc-vm-tint-svg-blk", "cc-vm-tint-svg-wht", "cc-vm-mono-svg-blk", "cc-vm-mono-svg-wht"].forEach(function (id) { var h = document.getElementById(id); if (h) h.remove(); });
      document.documentElement.classList.remove("cc-vmgrid", "cc-vm-rainbow", "cc-vm-rbneutral");
      RB_KINDS.forEach(function (k) { document.documentElement.style.removeProperty("--cc-rb-" + k); document.documentElement.style.removeProperty("--cc-rb-" + k + "-t"); });
      var vt = document.getElementById("cc-vm-viewtoggle"); if (vt) { var vbar = vt.closest(".cc-vm-toolbar") || vt; if (vbar.parentNode) vbar.parentNode.removeChild(vbar); }
    } catch (e) {}
  }
  // from docker.js, so the VM badges share Docker's classes and structure
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  // VM limits: a gear per resource opens an editor for CPU pin/cap, RAM (balloon) and up/down
  // bandwidth. The engine applies CPU and RAM through virsh and bandwidth host-side with an
  // iptables physdev hashlimit that the monitor re-asserts. docker.css is not loaded on /VMs,
  // so the editor styles itself from the global tokens.
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
      // emhttp accepts a POST only with csrf_token in the form body; ccapi.php unwraps `data`
      // into the JSON body for the engine. An empty 200 means the token was dropped.
      var tk = vmCsrf();
      o.headers["Content-Type"] = "application/x-www-form-urlencoded";
      o.body = (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body || {}));
    }
    // An extra query such as name=… rides next to ?path=…; ccapi.php forwards only the params
    // on its per-path $qallow list.
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
  // Host CPU topology for the core picker, from the same /api/state keys docker.js reads.
  var vmHost = { cpus: 0, coreOf: null, pcores: [], ecores: [] };
  function loadVmHost() {
    return vmApi("GET", "state", null).then(function (st) {
      if (st) vmHost = { cpus: st.host_cpus || 0, coreOf: st.host_core_of || null, pcores: st.host_pcores || [], ecores: st.host_ecores || [] };
    }).catch(function () {});
  }
  // cpuset string <-> list of CPUs, as in docker.js
  function cpusetToSet(str) { var out = []; String(str || "").split(",").forEach(function (p) { p = p.trim(); var m = /^(\d+)-(\d+)$/.exec(p); if (m) { for (var i = +m[1]; i <= +m[2]; i++) out.push(i); } else if (/^\d+$/.test(p)) out.push(+p); }); return out; }
  function setToCpuset(arr) { arr = arr.slice().sort(function (a, b) { return a - b; }); var parts = [], i = 0; while (i < arr.length) { var j = i; while (j + 1 < arr.length && arr[j + 1] === arr[j] + 1) j++; parts.push(i === j ? String(arr[i]) : arr[i] + "-" + arr[j]); i = j + 1; } return parts.join(","); }
  // The Docker-style core grid: one box per physical core with its hyperthreads stacked, and a P/E
  // tag on hybrid Intel CPUs. Returns { node, read }, or null for an unknown topology, in which case
  // the caller falls back to a text cpuset field.
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
  // The BW badge, like Docker's: a running VM shows its live throughput from pollVmBw, any other VM
  // its configured cap.
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
    if (!d && !u) return "-";
    function fmt(k) { return k >= 1000 ? (Math.round(k / 100) / 10) + "M" : k + "k"; }
    return "↓" + (d ? fmt(lim.inKbit) : "∞") + " ↑" + (u ? fmt(lim.outKbit) : "∞");
  }
  // Diffs each running VM's tap byte counters into a bytes/s rate. arm() runs it only while a VM is
  // running, because the engine's virsh list is expensive.
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
  // Gear colour, as docker.js gearFill: rainbow stamps the kind var and leaves the rest to CSS;
  // accent mode fills inline with priority, since Unraid's theme CSS would beat the stylesheet.
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
  // One gear per resource, coloured by kind, opening that resource's editor. The disk gear takes
  // the "vol" colour of the vDisks badge.
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
  // After the limits load or an editor applies, the gears and BW text update in place, since the
  // #kvm_list rows are not rebuilt.
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
  // One live-resize row per disk, grow only (the engine rejects a shrink).
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
      if (isNaN(g) || g <= curG) { statusEl.style.color = "var(--cc-err,#d9433f)"; statusEl.textContent = (VMDE ? "nur vergrößern, mehr als " : "grow only, more than ") + curG + " GiB"; return; }
      function doResize() {
        btn.disabled = true; statusEl.style.color = "var(--cc-text-dim,#8a8a8a)"; statusEl.textContent = VMDE ? "Vergrößern läuft…" : "resizing…";
        vmApi("POST", "vmdiskresize", { name: name, target: d.target, size_gib: g }).then(function () {
          btn.disabled = false; statusEl.style.color = "var(--cc-ok,#1f9d55)"; statusEl.textContent = (VMDE ? "vergrößert auf " : "grown to ") + g + " GiB" + (VMDE ? " · Gast muss Partition/FS erweitern" : " · guest must extend partition/FS");
          curG = g; cur.textContent = "  " + g + " GiB"; d.capacityBytes = g * 1073741824; inp.min = String(g);
        }).catch(function (e) { btn.disabled = false; statusEl.style.color = "var(--cc-err,#d9433f)"; statusEl.textContent = String(e.message || e).slice(0, 70); });
      }
      // A vDisk cannot shrink back without data loss, so a grow is confirmed first with the swal
      // dialog VM removal uses, or confirm() without it.
      var q = "vDisk " + d.target + ": " + curG + " GiB → " + g + " GiB. " + (VMDE ? "Das lässt sich nicht rückgängig machen." : "This cannot be undone.");
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
  // The limits editor. `which` is "cpu", "ram", "bw", "disk" or "all": a gear opens only its own
  // section, as Docker does. CPU, RAM and BW commit through vmlimits, disks through vmdiskresize.
  function openVmEd(name, which, anchor) {
    which = which || "all";
    var v = vmLims[name] || {};
    var showCpu = which === "all" || which === "cpu", showRam = which === "all" || which === "ram";
    var showBw = which === "all" || which === "bw", showDisk = which === "all" || which === "disk";
    var hasLimFields = showCpu || showRam || showBw;
    // A popover anchored at the gear, like Docker's: a transparent full-screen layer closes it on an
    // outside click.
    var ov = el("div"); ov.id = "cc-vmlim-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999";
    // the chrome of Docker's .cc-pop popover
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
      // the Docker tab's core picker when the topology is known, else a cpuset text field
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
      var dlbl = el("div", null, VMDE ? "vDisks: Live-Resize (nur vergrößern)" : "vDisks: live resize (grow only)"); dlbl.style.cssText = "font-size:12px;font-weight:600;margin:0 0 8px 0;color:var(--cc-text,#e6e6e6)";
      var dlist = el("div"); dlist.style.cssText = "font-size:12px;color:var(--cc-text-dim,#8a8a8a)";
      var dstat = el("div"); dstat.style.cssText = "font-size:11px;color:var(--cc-text-dim,#8a8a8a);margin-top:2px";
      dsec.appendChild(dlbl); dsec.appendChild(dlist); dsec.appendChild(dstat); card.appendChild(dsec);
      loadDisks(name, dlist, dstat);
    }
    // Icon colouring for this VM sits in every variant of the editor, since the VM tab has no
    // other per-item settings. It is a display choice and applies at once, not on Apply.
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
      sel.addEventListener("change", function () { CI.setOverride("vm", name, sel.value); paintVmIcons(); });   // `apply` here is the editor's Apply button
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
  // The Actions column, built like docker.js's action bar. Each icon calls the native global the
  // VM context menu uses (vmmanager.js addVMContext), with the VM context read from the logo's
  // span#vm-<uuid> and its onclick=addVMContext('name','uuid','template','state','vmrcurl',
  // 'PROTO','log','fstype','console;rdp','','webui',...). Native calls are typeof-guarded, so a
  // missing Unraid global leaves a button that does nothing.
  function actBtn(icon, tip, fn) {
    var b = el("span", "cc-actbtn"); b.title = tip; b.appendChild(el("i", "fa " + icon));
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); try { fn(); } catch (_) {} });
    return b;
  }
  function actBtnOff(icon, tip) { var b = el("span", "cc-actbtn cc-actoff"); b.title = tip; b.appendChild(el("i", "fa " + icon)); return b; }
  function vmDisp(action, uuid) { if (typeof window.ajaxVMDispatch === "function") window.ajaxVMDispatch({ action: action, uuid: uuid }, "loadlist"); }
  // As docker.js tintAct: an accent or rainbow colour per button, grey for cc-actoff.
  function tintAct(bar) {
    var colorsOn = ls("cc.actcolors") !== "0";
    var rb = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    // In the reactive sub-mode buttons rest grey and take their colour on row hover, so only
    // --cc-rb-c/--cc-rb-ct are stamped; an inline !important background would beat the sheet.
    var neutral = rb && ls("cc.rbmode") === "active";
    // flag mode keeps its own palette in cc.flagpal
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
  // As docker.js actionBars(): console/log/edit, then restart, pause or resume, stop or start and
  // "…", which opens console, hibernate, force stop, snapshot, clone and remove.
  function vmActionBars(tr) {
    var de = LANG === "de";
    var cx = vmCtxFor(tr), uuid = cx.uuid, name = cx.name, st = cx.state;
    var running = st === "running", paused = st === "paused" || st === "pmsuspended", shutoff = !running && !paused;
    var path = location.pathname; var xi = path.indexOf("?"); if (xi !== -1) path = path.substring(0, xi);
    var bar = el("div", "cc-actbar");
    var r1 = el("div", "cc-actrow");
    // the VNC console takes the place of Docker's WebUI globe
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
      // The Actions th goes in once, after the Name th. thead survives the #kvm_list re-renders, so
      // every row needs its Actions td or it renders one column short.
      if (head && !head.querySelector(".cc-act-th")) {
        var nameTh = head.querySelector("th.th1") || head.children[0];
        var th = el("th", "cc-act-th", de ? "Aktionen" : "Actions");
        head.insertBefore(th, nameTh ? nameTh.nextSibling : head.firstChild);
      }
      var old = tr.querySelector(":scope > td.cc-actcell");
      var ab = null;
      try { ab = vmActionBars(tr); } catch (e) { ab = null; }              // a failed row still gets its td
      if (old) { if (ab && old.getAttribute("data-cc-sig") === ab.sig) return; old.remove(); } // rebuild only on change
      var td = el("td", "cc-actcell");
      if (ab) { td.setAttribute("data-cc-sig", ab.sig); td.appendChild(ab.bar); td.appendChild(ab.more); }
      // inserted even when empty, so the column counts of thead and tbody always match
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
  // CPU, RAM and BW stacked in one column like Docker's .cc-resgroup. The VM table has separate
  // CPU and RAM cells, so the RAM content moves (live children, not clones) into the CPU cell and
  // the native RAM cell and header are hidden.
  function vmResCell(cpuTd, ramTd) {
    if (!cpuTd || cpuTd.classList.contains("cc-vmb-cell")) return;
    var vmn = vmNameOf(cpuTd.closest("tr"));
    var lim = (vmn && vmLims[vmn]) || {}, s = limSet(lim);
    var group = el("div", "cc-resgroup"); if (vmn) group.setAttribute("data-cc-vm", vmn);
    var cb = el("span", "cc-b cc-b-info cc-b-cpu"); cb.appendChild(el("span", "cc-b-k", "CPU"));
    var cv = el("span", "cc-b-v"); var cpuTxt = (cpuTd.textContent || "").trim();
    if (cpuTxt && cpuTxt !== "-") { while (cpuTd.firstChild) cv.appendChild(cpuTd.firstChild); } else cv.textContent = "-";
    cb.appendChild(cv);
    group.appendChild(vmResLine(cb, vmn ? vmGear(vmn, "cpu", s.cpu) : null));
    if (ramTd) {
      var rb = el("span", "cc-b cc-b-info cc-b-ram"); rb.appendChild(el("span", "cc-b-k", "RAM"));
      var rv = el("span", "cc-b-v"); var ramTxt = (ramTd.textContent || "").trim();
      if (ramTxt && ramTxt !== "-") { while (ramTd.firstChild) rv.appendChild(ramTd.firstChild); } else rv.textContent = "-";
      rb.appendChild(rv);
      group.appendChild(vmResLine(rb, vmn ? vmGear(vmn, "ram", s.ram) : null));
      ramTd.style.display = "none"; ramTd.classList.add("cc-vmb-ramcell");   // hidden, reverted in teardown
    }
    // VMs have no native BW cell
    var bwB = el("span", "cc-b cc-b-info cc-b-bw"); bwB.appendChild(el("span", "cc-b-k", "BW"));
    bwB.appendChild(el("span", "cc-b-v", vmBwText(lim)));
    group.appendChild(vmResLine(bwB, vmn ? vmGear(vmn, "bw", s.bw) : null));
    cpuTd.appendChild(group); cpuTd.classList.add("cc-vmb-cell", "cc-vmb-rescell");
    hideResHeader();
  }
  // Hides the native memory header once, found by its text because the Actions column shifts the
  // indices. teardown reverts it.
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
  // The native IP cell joins one "addr/prefix" per line with <br>, and textContent would glue the
  // lines together, so the split follows the <br> elements. Each valid address becomes a Docker-style
  // click-to-copy pill; without any (a "guest agent" note) the native content stays.
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
  // The disks cell holds span.state = "DISKS&nbsp;&nbsp;&nbsp;&nbsp;CDS<a.hand ISO-picker><br>(Snapshots: X)",
  // which vmCell skips for its <br>. It splits into vDisks, CD and Snapshots badges; the ISO picker
  // is cloned into the CD badge (its inline onclick survives cloneNode) and the native span hidden.
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
      // the gear opens the live-resize editor
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
        // A rotating colour per row lets the logo tile join the rainbow, since the badges are
        // coloured per kind. The tile rule prefers it over the iconbg colour, as on Docker and Plugins.
        try {
          if (ls("cc.theming") !== "0" && ls("cc.rainbow") === "1") {
            var _off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET, _pal = RB_PAL;
            try { if (ls("cc.flagmode") === "1") { var _f = JSON.parse(ls("cc.flagpal") || "null"); if (_f && _f.length) _pal = _f; } else { var _r = JSON.parse(ls("cc.rbpal") || "null"); if (_r && _r.length) _pal = _r; } } catch (_e) {}
            var _c = _pal[(i + _off) % _pal.length], _n = parseInt(String(_c).replace("#", ""), 16), _L = 0.299 * (_n >> 16 & 255) + 0.587 * (_n >> 8 & 255) + 0.114 * (_n & 255);
            row.style.setProperty("--cc-rb-c", _c); row.style.setProperty("--cc-rb-ct", _L > 150 ? "#161616" : "#fff");
          } else { row.style.removeProperty("--cc-rb-c"); row.style.removeProperty("--cc-rb-ct"); }
        } catch (_eR) {}
        // Cells are found by class and content (VMMachines.php L217-229) rather than by index, which
        // the injected Actions td or a missing description would shift.
        var nameTd = row.querySelector(":scope > td.vm-name");
        var vcpuA = row.querySelector(":scope > td a[class*='vcpu-']");   // <a class='vcpu-$uuid'> (L224)
        var cpuTd = vcpuA ? vcpuA.closest("td") : null;
        var ramTd = cpuTd ? cpuTd.nextElementSibling : null;             // $mem cell (L225)
        var descTd = null;                                               // the cell before vCPU, unless it's name/Actions
        if (cpuTd) { var p = cpuTd.previousElementSibling; if (p && !p.classList.contains("vm-name") && !p.classList.contains("cc-actcell")) descTd = p; }
        var diskSpan = row.querySelector(":scope > td > span.state");    // vm-name's span.state is nested deeper (L226)
        var diskTd = diskSpan ? diskSpan.parentNode : null;
        var vg = row.querySelectorAll(":scope > td > span.vmgraphics");  // graphics (L227) then ip (L228), document order
        var graphicsTd = vg[0] ? vg[0].parentNode : null, ipTd = vg[1] ? vg[1].parentNode : null;
        if (descTd) vmCell(descTd, "", "");
        if (cpuTd) vmResCell(cpuTd, ramTd);
        if (graphicsTd) vmCell(graphicsTd, "", "");
        if (ipTd) vmIpCell(ipTd);
        if (diskTd) vmDiskCell(diskTd);
        injectVmActionCell(row, nameTd);
      }
    } catch (e) {}
  }
  function enhanceCellsTeardown() {
    try {
      var cells = document.querySelectorAll("#kvm_list td.cc-vmb-cell");
      for (var i = 0; i < cells.length; i++) {
        var td = cells[i];
        if (td.classList.contains("cc-vmb-rescell")) continue;   // handled by the pass below
        if (td.classList.contains("cc-vmb-diskcell")) {
          var dw = td.querySelector(":scope > span.cc-vmb-disks"); if (dw) td.removeChild(dw);
          var ds = td.querySelector(":scope > span.state"); if (ds) ds.style.removeProperty("display");
          td.classList.remove("cc-vmb-cell", "cc-vmb-diskcell"); continue;
        }
        if (td.classList.contains("cc-vmb-ipcell")) {
          var ipw = td.querySelector(":scope > span.cc-vmb-ips"); if (ipw) td.removeChild(ipw);
          for (var c = td.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) c.style.removeProperty("display"); }
          td.classList.remove("cc-vmb-cell", "cc-vmb-ipcell"); continue;
        }
        var b = td.querySelector(":scope > span.cc-b-info");
        if (b) { var k = b.querySelector(".cc-b-k"); if (k) b.removeChild(k); var v = b.querySelector(".cc-b-v"); var src = v || b; while (src.firstChild) td.insertBefore(src.firstChild, b); td.removeChild(b); }
        td.classList.remove("cc-vmb-cell");
      }
      // move CPU and RAM back into their native cells and unhide the RAM cell and header
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
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list td.cc-actcell")).forEach(function (td) { td.remove(); });
      var actTh = document.querySelector("#kvm_table thead tr .cc-act-th"); if (actTh) actTh.remove();
    } catch (e) {}
  }
  function apply() {
    var root = document.documentElement;
    var live = ls("cc.theming") !== "0" && ls("cc.enable.vms") !== "0";
    root.classList.toggle("cc-vms-on", live);
    if (!live) { root.classList.remove("cc-sections-vms"); stripVmTheming(); enhanceCellsTeardown(); flattenTeardown(); return; }
    try { enhanceRows(); } catch (e) {}
    try { enhanceCells(); } catch (e) {}
    try { wrapVmStats(); } catch (e) {}
    // Tab-Ansicht (cc.sections.vms, default off). It runs before the tint early return below so it
    // applies without a tint colour too.
    try {
      var vmSections = ls("cc.sections.vms") === "1";
      root.classList.toggle("cc-sections-vms", vmSections);
      var vbox = document.getElementById("displaybox");
      if (vbox) { if (vmSections) cardPanels(vbox); else flattenTeardown(); }
    } catch (e) {}
    try { ensureViewToggle(); applyView(); } catch (e) {}
    try { applyRainbowPalette(); var vmRb = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1"; root.classList.toggle("cc-vm-rainbow", vmRb); root.classList.toggle("cc-vm-rbneutral", ls("cc.theming") !== "0" && ls("cc.rbmode") === "active"); } catch (e) {} // reactive: badges rest grey and colour on hover, in accent mode too
    // The action bars' rebuild signature ignores the colour mode, so they are re-tinted in place;
    // passing td.cc-actcell also reaches the .cc-actmore extras.
    try { Array.prototype.forEach.call(document.querySelectorAll("#kvm_list td.cc-actcell"), function (cell) { tintAct(cell); }); } catch (e) {}
    // enhanceCells does not rebuild a finished cell, so the gear colours are refreshed here too
    try { refreshAllRes(); } catch (e) {}
    // Adopt off with no own tint colour needs the icon pass only for the badge.
    if (ls("cc.stylevms") === "0" && !ls("ccv.iconcolor") && effK("iconbg") !== "1") return;
    paintVmIcons();
  }
  // The icon pass, separate from apply() so the per-VM dropdown can repaint at once: inside
  // openVmEd, `var apply` is the Apply button and shadows the page-level apply().
  function paintVmIcons() {
    try {
      var imgs = vmImgs();
      var ibgOn = effK("iconbg") === "1"; var ibgAcc = vmBgColor();
      // VmTab.css draws the badge box through html.cc-vm-iconbg; the ink flatten has to be an
      // inline filter on each logo.
      var root2 = document.documentElement;
      root2.classList.toggle("cc-vm-iconbg", ibgOn);
      if (ibgOn && ibgAcc) root2.style.setProperty("--cc-iconbg-color", ibgAcc); else root2.style.removeProperty("--cc-iconbg-color");
      // Adopting builds a black-ink and a white-ink filter once for the page, and each row picks
      // the one that matches its own background.
      var f, flat, c, fBlk, fWht, flatBlk, flatWht, vmInk;
      var adopt = iconBgAdoptsV();
      if (adopt) {
        flatBlk = ensureFlatFilter("cc-vm-mono-svg-blk", "cc-vm-mono-tint-blk", "#161616");
        flatWht = ensureFlatFilter("cc-vm-mono-svg-wht", "cc-vm-mono-tint-wht", "#fff");
        fBlk = ensureTintFilterAs("cc-vm-tint-svg-blk", "cc-vm-icon-tint-blk", "#161616") ? "url(#cc-vm-icon-tint-blk)" : "";
        fWht = ensureTintFilterAs("cc-vm-tint-svg-wht", "cc-vm-icon-tint-wht", "#fff") ? "url(#cc-vm-icon-tint-wht)" : "";
      } else {
        f = filterVal(); c = tintColor();
        // One flat filter for the page from the tint's ink, which is "" while Einfärben is off, so
        // the badge alone never flattens the icons.
        vmInk = vmIconInk(false);
        flat = vmInk ? ensureFlatFilter("cc-vm-mono-svg", "cc-vm-mono-tint", vmInk) : ensureFlatFilter("cc-vm-mono-svg", "cc-vm-mono-tint", "");
      }
      var CI = window.CCTheme && window.CCTheme.icons, vmNames = [];
      for (var i = 0; i < imgs.length; i++) {
        var n = imgs[i], vname = vmIconName(n);
        if (vname) vmNames.push(vname);
        var plan = vmIconPlan(n, vname);
        var thisFlat = flat, thisTint = f, thisInk = vmInk;
        if (adopt) {
          var rowInk = vmItemAdoptInk(n.closest("tr")), rowBlk = rowInk !== "#fff";
          thisFlat = rowBlk ? flatBlk : flatWht;
          thisTint = rowBlk ? fBlk : fWht;
          thisInk = rowInk;
        }
        var want = plan.treat === "native" ? "" : (plan.treat === "flat" ? thisFlat : thisTint);
        if (n.tagName === "IMG") { vmSetIconSrc(n, plan.url); n.style.filter = want; if (ibgOn) n.style.removeProperty("color"); }
        // A glyph takes `color` with !important, since Unraid's VM CSS colours it through a class rule.
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
    // Observes the VM list, not body, where the filter hosts live and would feed back.
    var host = document.getElementById("kvm_list") || document.getElementById("kvm_table");
    if (!host) return;
    // Repaints when an engine lookup or a complexity measurement lands; cc-theme.js fires only on
    // a real change, so this settles.
    try { if (window.CCTheme && window.CCTheme.icons) window.CCTheme.icons.onResolved(function () { if (!dead) paintVmIcons(); }); } catch (e) {}
    // Leading edge: a MutationObserver callback runs before the browser paints, so the rows are
    // restyled in the frame they appear. A burst coalesces into one trailing pass within 300ms.
    function vmSweep() {
      moPending = true; moTrail = false;
      try { mo.disconnect(); } catch (e) {}   // our own writes must not re-fire the observer
      if (!dead) { try { apply(); } catch (e) {} }
      // The first pass ends the tab-load spinner, after a minimum visible time so it paints at
      // least one frame; later native rebuilds do not re-arm it.
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
    // the observer only fires on a later mutation, so paint a list that is already there
    try { if (!moPending && host.querySelector("tr")) vmSweep(); } catch (e) {}
    // #vmstats renders only when its subtab first opens, so the observer sits on #displaybox.
    try {
      var dbox = document.getElementById("displaybox");
      if (dbox && !smo) {
        wrapVmStats();
        // Wraps synchronously in the callback, before the browser paints, so the native cells
        // never flash; the wrapped check turns our own writes into a no-op.
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
    // header.js ccLoadState() keeps the native tab-load overlay open while html.cc-enh-busy is set,
    // as on the Docker tab, so the page does not show half-enhanced.
    document.documentElement.classList.add("cc-enh-busy");
    ccEnhBusyStart = Date.now();
    setTimeout(function () { document.documentElement.classList.remove("cc-enh-busy"); }, 5000);
    apply();
    connectObserver();
    // #kvm_list is usually filled by an AJAX loadlist() after this script runs, so the observer
    // and apply() retry for a short window until the list is there.
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
    // The /api/vms round trip is expensive, so the live rate is polled only while a VM runs.
    if (!vmBwTimer) vmBwTimer = setInterval(function () {
      try { if (dead) return; if (!document.querySelector("#kvm_list .cc-badge-running")) { vmRate = {}; return; } pollVmBw(); } catch (e) {}
    }, 4000);
  }
  function boot() {
    // Loaded on every page through CannonadeCommand.VmTab.page, so it gates itself to /VMs;
    // otherwise its polling timers would run everywhere.
    try { if (location.pathname.replace(/\/+$/, "") !== "/VMs") return; } catch (e) { return; }
    try { window.ccVmsApply = apply; } catch (e) {} // the settings page's live toggle hook
    if (localStorage.getItem("cc.enable.vms") === "0") return;
    // The first enhanceCells builds the rows before the limits arrive, so the gears and BW
    // badges are refreshed once they do.
    loadVmLims().then(function () { try { refreshAllRes(); } catch (e) {} });
    loadVmHost();
    try {
      arm();
      // A click on a VM icon flashes the action bar instead of opening the native menu, as on the
      // Docker tab. Without a CC action bar the native menu opens.
      if (!window.__ccVmLogoFlash) {
        window.__ccVmLogoFlash = true;
        document.addEventListener("click", function (e) {
          try {
            if (dead) return;
            if (location.pathname.replace(/\/+$/, "") !== "/VMs") return;
            var hand = e.target && e.target.closest ? e.target.closest("#kvm_list td.vm-name span.hand") : null;
            if (!hand) return;
            var row2 = hand.closest("tr"), bar2 = row2 && row2.querySelector(".cc-actbar");
            if (!bar2) return;
            e.preventDefault(); e.stopPropagation();
            bar2.classList.add("cc-act-flash");
            setTimeout(function () { bar2.classList.remove("cc-act-flash"); }, 1600);
          } catch (e2) {}
        }, true);
      }
      // cc.* and the VM tab's own ccv.* keys; cc.stateCache is skipped because docker.js rewrites
      // it every 9s.
      window.addEventListener("storage", function (e) { try { if (!dead && e && e.key && e.key !== "cc.stateCache" && /^ccv?\./.test(e.key)) apply(); } catch (e2) {} });
      // Re-arms when the proxy comes back, so the gap during a plugin update does not end the
      // enhancer until a reload.
      setInterval(function () { try { if (!dead) return; fetch(PROXY + "?path=state", { headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) arm(); }).catch(function () {}); } catch (e) {} }, 8000);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
