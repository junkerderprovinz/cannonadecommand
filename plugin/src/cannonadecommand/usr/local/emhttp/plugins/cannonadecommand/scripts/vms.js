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
  var dead = false, mo = null, liveTimer = null, moPending = false;
  var VMVIEW_KEY = "cc.vmview";
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  // Rainbow: ported verbatim from docker.js so the VM badges read the SAME global palette. --cc-rb-* vars
  // are stamped on <html>; the kind->colour map rotates by a per-load random offset (toggle cc.rainbowrot).
  // VM info badges carry kinds cpu/ram/ip, so only those recolour.
  var RB_KINDS = ["net", "ip", "lan", "port", "id", "von", "cpu", "ram", "bw", "version", "vol", "plan"];
  var RB_PAL = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];
  var RB_OFFSET = Math.floor(Math.random() * RB_PAL.length);

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  // EXACT-colour tint via an inline SVG feColorMatrix (identical recipe to
  // docker.js): map every opaque pixel to the chosen sRGB colour, keep alpha, and
  // blend the original back by (100 - strength)%. hue-rotate only APPROXIMATES a
  // hue and got the colour wrong; feColorMatrix hits the picked colour exactly.
  // VM tinting is ON by DEFAULT whenever a container-icon colour is chosen (cc.vmicons
  // is an opt-OUT: only the literal "0" disables it). Requiring a separate "1" opt-in was
  // an easy-to-miss toggle that made VMs look like they "never tinted".
  function vmTintOff() { return ls("cc.vmicons") === "0"; }
  function ensureTintFilter() {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((ls("cc.stylevms") !== "0" ? ls("cc.iconcolor") : ls("ccv.iconcolor")) || "");
    var host = document.getElementById("cc-vm-tint-svg");
    if (dead || vmTintOff() || !m) { if (host) host.remove(); return false; }
    var tr = parseInt(m[1], 16) / 255, tg = parseInt(m[2], 16) / 255, tb = parseInt(m[3], 16) / 255;
    var s = (Math.max(10, parseInt((ls("cc.stylevms") !== "0" ? ls("cc.iconstrength") : ls("ccv.iconstrength")) || "100", 10)) / 100).toFixed(3);
    // shading-preserving: channel = luminance × target colour (matches docker.js)
    var lum = function (c) { return (0.2126 * c).toFixed(4) + " " + (0.7152 * c).toFixed(4) + " " + (0.0722 * c).toFixed(4); };
    if (!host) { host = document.createElement("div"); host.id = "cc-vm-tint-svg"; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    // IDEMPOTENT: only rewrite the SVG when the colour/strength actually changed. The host
    // lives on document.body; a blind innerHTML write on every apply() would be a DOM
    // mutation that — if an observer ever watched body — re-triggers apply() into a
    // ~300ms CPU-pegging loop (the classic non-idempotent-inject + MutationObserver trap).
    var sig = tr + "|" + tg + "|" + tb + "|" + s + "|lum";
    if (host.dataset.sig !== sig) {
      var mid = '<feColorMatrix in="SourceGraphic" type="matrix" result="flat" values="' + lum(tr) + ' 0 0 ' + lum(tg) + ' 0 0 ' + lum(tb) + ' 0 0 0 0 0 1 0"/>';
      if (parseFloat(s) < 0.999) mid += '<feComponentTransfer in="flat" result="faded"><feFuncA type="linear" slope="' + s + '"/></feComponentTransfer><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="faded"/></feMerge>';
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="cc-vm-icon-tint" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' + mid + '</filter></svg>';
      host.dataset.sig = sig;
    }
    return true;
  }
  function filterVal() { return ensureTintFilter() ? "url(#cc-vm-icon-tint)" : ""; }
  // The chosen colour as a plain hex, gated the same way. Unraid renders MOST VM
  // icons as a FontAwesome/icon-font glyph (`<i class="fa fa-… img">`), whose colour
  // comes from CSS `color:`, NOT from an image filter — so a glyph never tinted
  // before. Real `.png` icons render as `<img class="img">` and DO take the filter.
  function tintColor() {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((ls("cc.stylevms") !== "0" ? ls("cc.iconcolor") : ls("ccv.iconcolor")) || "");
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
  function ensureMonoFilter(hostId, filtId, accentHex) {
    var host = document.getElementById(hostId);
    var m = /^#?([0-9a-f]{6})$/i.exec(accentHex || "");
    if (!m) { if (host) host.remove(); return ""; }
    var ink = ccIdeal("#" + m[1]);
    var hx = ink.length === 4 ? ink[1] + ink[1] + ink[2] + ink[2] + ink[3] + ink[3] : ink.slice(1);
    var c = ((parseInt(hx, 16) >> 16 & 255) / 255).toFixed(4);
    if (!host) { host = document.createElement("div"); host.id = hostId; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var sig = filtId + "|" + c;
    if (host.dataset.sig !== sig) {
      var vals = "0 0 0 0 " + c + " 0 0 0 0 " + c + " 0 0 0 0 " + c + " 0 0 0 1 0";
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '"/></filter></svg>';
      host.dataset.sig = sig;
    }
    return "url(#" + filtId + ")";
  }
  function ccShape() { return ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[ls("cc.badgeshape") || "pill"] || "999px"; }
  // ── Rainbow palette (verbatim port of docker.js applyRainbowPalette): read the GLOBAL cc.rainbow +
  //    cc.rbpal/cc.rainbowrot and stamp --cc-rb-* on <html>. Cleared when off.
  function applyRainbowPalette() {
    var rt = document.documentElement.style, on = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    if (!on) { RB_KINDS.forEach(function (k) { rt.removeProperty("--cc-rb-" + k); rt.removeProperty("--cc-rb-" + k + "-t"); }); return; }
    var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    var pal = RB_PAL; try { var jp = JSON.parse(ls("cc.rbpal") || "null"); if (jp && jp.length) pal = jp; } catch (e) {}
    RB_KINDS.forEach(function (k, i) {
      var c = pal[(i + off) % pal.length], n = parseInt(String(c).slice(1), 16);
      var L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
      rt.setProperty("--cc-rb-" + k, c); rt.setProperty("--cc-rb-" + k + "-t", L > 150 ? "#161616" : "#fff");
    });
  }
  // ── GRID / CARD view: a DOM-only mirror of Docker's list/grid toggle. vms.js has no engine data model
  //    (it enhances the native table in place), so instead of building card DOM we reflow the native
  //    #kvm_list into cards via CSS (html.cc-vmgrid) — every native cell + our badges stay live/clickable.
  //    Storage key cc.vmview; grid is a THEMING view (list when theming off). el() is hoisted (defined below).
  function currentView() { return (ls(VMVIEW_KEY) === "grid" && ls("cc.theming") !== "0") ? "grid" : "list"; }
  function applyView() {
    document.documentElement.classList.toggle("cc-vmgrid", currentView() === "grid");
    var tg = document.getElementById("cc-vm-viewtoggle"); if (!tg) return;
    var g = currentView() === "grid", b = tg.querySelectorAll(".cc-seg-btn");
    if (b[0]) b[0].classList.toggle("cc-seg-on", !g); if (b[1]) b[1].classList.toggle("cc-seg-on", g);
  }
  function ensureViewToggle() {
    if (document.getElementById("cc-vm-viewtoggle")) return;
    var list = document.getElementById("kvm_list"), tbl = list && list.closest("table");
    if (!tbl || !tbl.parentNode) return;
    var de = LANG === "de";
    var seg = el("div", "cc-seg"); seg.id = "cc-vm-viewtoggle";
    var bL = el("button", "cc-seg-btn", de ? "Liste" : "List"); bL.type = "button";
    var bG = el("button", "cc-seg-btn", de ? "Raster" : "Grid"); bG.type = "button";
    bL.addEventListener("click", function () { try { localStorage.setItem(VMVIEW_KEY, "list"); } catch (e) {} applyView(); });
    bG.addEventListener("click", function () { try { localStorage.setItem(VMVIEW_KEY, "grid"); } catch (e) {} applyView(); });
    seg.appendChild(bL); seg.appendChild(bG);
    var bar = el("div", "cc-vm-toolbar"); bar.appendChild(seg);
    tbl.parentNode.insertBefore(bar, tbl);
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
  function enhanceRows() {
    try {
      var a = ccAccent(), rad = ccShape(), root = document.documentElement.style;
      root.setProperty("--cc-accent", a); root.setProperty("--cc-accent-text", ccIdeal(a)); root.setProperty("--cc-b-radius", rad);
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
      var sv = document.getElementById("cc-vm-tint-svg"); if (sv) sv.remove();
      var hh = document.getElementById("cc-vm-mono-svg"); if (hh) hh.remove();
      // grid/rainbow live-revert: drop the classes, clear the palette vars, remove the injected view toggle
      document.documentElement.classList.remove("cc-vmgrid", "cc-vm-rainbow");
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
  // ACTIONS column (parity with the Docker tab, which has one via injectActionCell). The native VM menu
  // (Start/Stop/Console/Edit/Remove) is bound to the logo's onclick=addVMContext (VMMachines.php); CC
  // gives it a VISIBLE column button that re-fires that click, so it no longer hides behind the logo.
  // #kvm_table thead + #kvm_list tbody share one table, so an injected th+td stays column-aligned.
  function injectVmActionCell(tr) {
    try {
      var de = (document.documentElement.lang || "").slice(0, 2).toLowerCase() === "de";
      var head = document.querySelector("#kvm_table thead tr");
      if (head && !head.querySelector(".cc-act-th")) { var th = el("th", "cc-act-th", de ? "Aktionen" : "Actions"); head.insertBefore(th, head.children[1] || null); }
      if (tr.querySelector(":scope > td.cc-actcell")) return;
      var hand = tr.querySelector("td.vm-name span.outer > span.hand");
      var td = el("td", "cc-actcell"), bar = el("div", "cc-actbar"), row = el("div", "cc-actrow");
      var btn = el("span", "cc-actbtn"); btn.title = de ? "Aktionen" : "Actions"; btn.appendChild(el("i", "fa fa-bars"));
      btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (!hand) return; var r = btn.getBoundingClientRect(); hand.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: r.left, clientY: r.bottom })); });
      row.appendChild(btn); bar.appendChild(row); td.appendChild(bar);
      tr.insertBefore(td, tr.children[1] || null);
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
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ip); } catch (_) {} });
      wrap.appendChild(b);
    });
    for (var c = td.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) c.style.display = "none"; }  // hide native, don't destroy -> reversible teardown
    td.appendChild(wrap); td.classList.add("cc-vmb-cell", "cc-vmb-ipcell");
  }
  function enhanceCells() {
    try {
      var rows = document.querySelectorAll("#kvm_list tr.sortable");
      for (var i = 0; i < rows.length; i++) {
        var tds = rows[i].querySelectorAll(":scope > td");
        // native column order: 0 vm-name, 1 desc, 2 vCPU, 3 RAM, 4 disks, 5 graphics, 6 ip, 7 autostart
        if (tds[1]) vmCell(tds[1], "", "");   // description -> plain accent pill (vmCell no-ops on empty/"-")
        if (tds[2]) vmCell(tds[2], "CPU", "cpu");
        if (tds[3]) vmCell(tds[3], "RAM", "ram");
        if (tds[5]) vmCell(tds[5], "", "");   // graphics -> plain accent pill (value only)
        if (tds[6]) vmIpCell(tds[6]);         // IP addresses -> one copy-pill each
        injectVmActionCell(rows[i]);          // LAST: inserts the Actions <td> (shifts indices) AFTER tds[] captured above
      }
    } catch (e) {}
  }
  function enhanceCellsTeardown() {
    try {
      var cells = document.querySelectorAll("#kvm_list td.cc-vmb-cell");
      for (var i = 0; i < cells.length; i++) {
        var td = cells[i];
        if (td.classList.contains("cc-vmb-ipcell")) {         // IP cell: drop the pills, un-hide the native content
          var ipw = td.querySelector(":scope > span.cc-vmb-ips"); if (ipw) td.removeChild(ipw);
          for (var c = td.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) c.style.removeProperty("display"); }
          td.classList.remove("cc-vmb-cell", "cc-vmb-ipcell"); continue;
        }
        var b = td.querySelector(":scope > span.cc-b-info");
        if (b) { var k = b.querySelector(".cc-b-k"); if (k) b.removeChild(k); var v = b.querySelector(".cc-b-v"); var src = v || b; while (src.firstChild) td.insertBefore(src.firstChild, b); td.removeChild(b); }
        td.classList.remove("cc-vmb-cell");
      }
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
    // Tab-Ansicht (cc.sections.vms, default OFF): stacked CC sections vs native sub-tabs. MUST run BEFORE
    // the adopt/tint early-return below so it still applies with adopt-off + no tint colour. Idempotent.
    try {
      var vmSections = ls("cc.sections.vms") === "1";
      root.classList.toggle("cc-sections-vms", vmSections);
      var vbox = document.getElementById("displaybox");
      if (vbox) { if (vmSections) cardPanels(vbox); else flattenTeardown(); }
    } catch (e) {}
    try { ensureViewToggle(); applyView(); } catch (e) {}   // Grid/List view (cc.vmview)
    try { applyRainbowPalette(); root.classList.toggle("cc-vm-rainbow", ls("cc.theming") !== "0" && ls("cc.rainbow") === "1"); } catch (e) {}
    // adopt-toggle ON (default) -> Docker's cc.* settings; OFF -> own ccv.* keys.
    // Stay even with adopt-off + no tint colour when the Logo-Hintergrund badge is on.
    if (ls("cc.stylevms") === "0" && !ls("ccv.iconcolor") && effK("iconbg") !== "1") return;
    try {
      var f = filterVal(), c = tintColor(), imgs = vmImgs();
      var ibgOn = effK("iconbg") === "1"; var vIcon = effK("iconcolor"); var ibgAcc = (vIcon && /^#[0-9a-f]{6}$/i.test(vIcon)) ? vIcon : ccAccent();
      // Logo-Hintergrund badge box is now drawn by VmTab.css via html.cc-vm-iconbg (mirroring Docker's
      // cc-docker-iconbg) — the box shape/size/circle live in CSS. We only toggle the class + hand it the
      // tint colour; the monochrome ink flatten still has to be an INLINE filter on each logo image.
      var root2 = document.documentElement;
      root2.classList.toggle("cc-vm-iconbg", ibgOn);
      if (ibgOn) root2.style.setProperty("--cc-iconbg-color", ibgAcc); else root2.style.removeProperty("--cc-iconbg-color");
      var ibgMono = ibgOn ? ensureMonoFilter("cc-vm-mono-svg", "cc-vm-mono-tint", ibgAcc) : "";
      for (var i = 0; i < imgs.length; i++) {
        var n = imgs[i];
        if (n.tagName === "IMG") { n.style.filter = ibgMono || f; if (ibgOn) n.style.removeProperty("color"); }
        // font-glyph: `color` is the reliable exact tint. Set it with PRIORITY — Unraid's VM CSS colours
        // these glyphs via a class rule, which a plain inline colour can lose to; `!important` wins. With
        // the badge on, the ink is the accent's ideal text colour (b/w contrast).
        else { n.style.setProperty("color", ibgOn ? ccIdeal(ibgAcc) : (c || ""), "important"); n.style.filter = ibgMono || f; }
      }
    } catch (e) {}
  }
  function connectObserver() {
    // Observe ONLY the VM list container — NEVER document.body: our tint SVG host lives
    // on body, so observing body could see our own writes. If the list container isn't
    // present there is nothing to tint (the tbody is server-rendered on the real page).
    var host = document.getElementById("kvm_list") || document.getElementById("kvm_table");
    if (!host) return;
    // debounced: the VM list re-renders in bursts; re-apply at most every ~300ms.
    // (childList only — we never observe attributes, so our own style writes can't
    // re-trigger this into a loop.)
    mo = new MutationObserver(function () {
      if (dead || moPending) return;
      moPending = true;
      setTimeout(function () { moPending = false; if (!dead) apply(); }, 300);
    });
    mo.observe(host, { childList: true, subtree: true });
  }
  function teardown() {
    if (dead) return; dead = true;
    try { if (mo) mo.disconnect(); mo = null; } catch (e) {}
    try { if (liveTimer) clearInterval(liveTimer); liveTimer = null; } catch (e) {}
    try { document.documentElement.classList.remove("cc-vms-on", "cc-vm-iconbg", "cc-sections-vms", "cc-vmgrid", "cc-vm-rainbow"); document.documentElement.style.removeProperty("--cc-iconbg-color"); } catch (e) {}
    try { RB_KINDS.forEach(function (k) { document.documentElement.style.removeProperty("--cc-rb-" + k); document.documentElement.style.removeProperty("--cc-rb-" + k + "-t"); }); var vt = document.getElementById("cc-vm-viewtoggle"); if (vt) { var vbar = vt.closest(".cc-vm-toolbar") || vt; if (vbar.parentNode) vbar.parentNode.removeChild(vbar); } } catch (e) {}
    try { enhanceCellsTeardown(); flattenTeardown(); } catch (e) {}
    try { var imgs = vmImgs(); for (var i = 0; i < imgs.length; i++) { imgs[i].style.filter = ""; imgs[i].style.removeProperty("color"); var w = imgs[i].parentElement; if (w) { w.style.removeProperty("background"); w.style.removeProperty("border-radius"); w.style.removeProperty("width"); w.style.removeProperty("height"); w.style.removeProperty("padding"); w.style.removeProperty("display"); w.style.removeProperty("align-items"); w.style.removeProperty("justify-content"); w.style.removeProperty("box-sizing"); } } } catch (e) {}
    try { var sv = document.getElementById("cc-vm-tint-svg"); if (sv) sv.remove(); } catch (e) {}
    try { var hh = document.getElementById("cc-vm-mono-svg"); if (hh) hh.remove(); } catch (e) {}
  }
  function arm() {
    dead = false;
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
  }
  function boot() {
    // vms.js now loads GLOBALLY via the Buttons hook (CannonadeCommand.VmTab.page) so it reliably runs
    // on /VMs — the old Menu="VMs" injector went through the tabbed inline-eval branch, which never
    // executes a <script>, so the whole enhancer was dead. Being global, it must self-gate to /VMs:
    // otherwise its proxy poll/liveness timers would run on every page.
    try { if (location.pathname.replace(/\/+$/, "") !== "/VMs") return; } catch (e) { return; }
    try { window.ccVmsApply = apply; } catch (e) {} // same-tab live toggle hook for the CC Settings page (only set on /VMs, never on the Settings page -> no VmTab.css bleed)
    if (localStorage.getItem("cc.enable.vms") === "0") return; // area disabled in CC settings
    try {
      arm();
      window.addEventListener("storage", function (e) { try { if (!dead && e && e.key && e.key !== "cc.stateCache" && /^ccv?\./.test(e.key)) apply(); } catch (e2) {} }); // cc.* AND the VM tab's own ccv.* (accent/iconcolor) — else an adopt-OFF own-colour pick never live-updates. // cc.stateCache EXCLUDED: docker.js rewrites it every 9s, which would repaint this area on a 9s loop in every other open tab
      // persistent re-probe (NEVER cleared): re-arm when the proxy returns, so a
      // transient gap during a plugin UPDATE doesn't kill the tint until reload.
      setInterval(function () { try { if (!dead) return; fetch(PROXY + "?path=state", { headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) arm(); }).catch(function () {}); } catch (e) {} }, 8000);
    } catch (e) { /* never break Unraid's VM page */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
