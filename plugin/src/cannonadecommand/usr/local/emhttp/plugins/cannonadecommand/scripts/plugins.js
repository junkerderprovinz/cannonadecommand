/* CannonadeCommand: restyles Unraid's Plugins tab in place, like the Docker tab. The plugin cell
 * gets a container-sized logo, the name and a support badge; the description keeps its own
 * column, version and changelog badges are stacked, and status and remove become pills, all in
 * the accent or rainbow colours. Idempotent on top of the native #plugin_table
 * (dynamix.plugin.manager/Plugins.page, include/ShowPlugins.php; the name is the <strong> in the
 * README markdown). */
(function () {
  "use strict";
  if (window.__ccPlug) return; window.__ccPlug = 1;
  // The update button pin loop is registered before any other top-level statement, so a throw
  // further down this file cannot take it down.
  function plugPinTick() {
    try {
      var db = document.getElementById("displaybox");
      if (!db || !document.querySelector("#plugin_table, table.cc-plug")) {
        // Not the Plugins page. Once the DOM is complete without a plugin table there never will
        // be one, so stop the 600 ms wakeup; the Plugins page keeps it because its layout shifts.
        if (_pinIv && document.readyState === "complete") { clearInterval(_pinIv); _pinIv = null; }
        return;
      }
      if (localStorage.getItem("cc.theming") === "0" || localStorage.getItem("cc.enable.plugins") === "0") return;
      // The anchor. The Plugins page uses Unraid's older radio+label tab markup without
      // button[role=tab] or .tabs-container, so labels come first and the modern variants are
      // fallbacks. In section view docker.css hides every tab button, so .cc-card-head, which
      // only exists there, goes first.
      var tab = null, cands = db.querySelectorAll(".cc-card-head, div.tab input[type=radio] + label, .tabbed input[type=radio] + label, div.tab label, .tabbed label, div.tabs label, .tabs label, button[role='tab'], .tabs-container > *");   // div.tab and .tabbed are the wrapper classes docker.css styles
      for (var i = 0; i < cands.length; i++) { var cr0 = cands[i].getBoundingClientRect(); if (cands[i].offsetHeight && cr0.width) { tab = cands[i]; break; } }
      var _ccNoTab = false;
      if (!tab) {
        // The non-tabbed plugin view has no tab strip, so the table's top edge is the anchor and
        // the buttons still pin above the list.
        tab = document.querySelector("#plugin_table, table.cc-plug, #plugin_list");
        if (!tab) return;
        _ccNoTab = true;
      }
      var host = document.getElementById("cc-plugbtns");
      if (!host) { host = document.createElement("div"); host.id = "cc-plugbtns"; }
      if (host.parentNode !== db) db.appendChild(host);
      var spans = document.querySelectorAll("#displaybox span.status.vhshift, #displaybox span.vhshift, #checkall, #updateall, #removeall");
      for (var sp = 0; sp < spans.length; sp++) { var s = spans[sp]; if (s !== host && !host.contains(s) && s.parentNode !== host) host.appendChild(s); }
      if (!host.firstChild) {
        // Some Unraid builds wrap the three controls differently, so adopt any button whose
        // handler or label looks like an update check (German or English).
        var ins = db.querySelectorAll("input[type='button'], input[type='submit'], button");
        for (var q = 0; q < ins.length; q++) {
          var oc = ((ins[q].getAttribute("onclick") || "") + " " + (ins[q].value || ins[q].textContent || ""));
          if (/checkall|updateall|removeall|check\s*for\s*updates|aktualisierungen/i.test(oc)) {
            var we = ins[q].closest("span") || ins[q];
            if (we !== host && !host.contains(we) && we.parentNode !== host) host.appendChild(we);
          }
        }
      }
      if (!host.firstChild) return;
      db.style.setProperty("position", "relative", "important");
      host.style.setProperty("position", "absolute", "important");
      host.style.setProperty("display", "inline-flex", "important");
      host.style.setProperty("align-items", "center", "important");
      host.style.setProperty("gap", "12px", "important");
      host.style.setProperty("margin", "0", "important");
      host.style.setProperty("z-index", "3", "important");
      // Align the visible button rather than the host box, since an inner offset (Update.css's
      // 13px vhshift on the span) pushes the content down inside it. The inner margins go, the
      // host's gap is the only spacing, and the host is nudged until the button's centre sits
      // on the tab row's centre.
      var inn = host.querySelectorAll("span, input, button");
      for (var n2 = 0; n2 < inn.length; n2++) {
        inn[n2].style.setProperty("margin-top", "0", "important"); inn[n2].style.setProperty("margin-bottom", "0", "important");
        inn[n2].style.setProperty("margin-left", "0", "important"); inn[n2].style.setProperty("margin-right", "0", "important");
      }
      var tr0 = tab.getBoundingClientRect(), dr = db.getBoundingClientRect();
      // non-tabbed: just above the list; tabbed: on the tab row's centre
      var anchorY = _ccNoTab ? (tr0.top - (host.offsetHeight || 30) / 2 - 6) : (tr0.top + tr0.height / 2);   // 30 = --cc-md-h
      // The right edge is flush with the visually rightmost menu bar icon, since the icons and the
      // usage meter can be reordered by drag. Fallbacks: the table edge, then the page padding.
      var ref = null, mi = document.querySelectorAll("#menu .nav-tile.right .nav-item.util > a, #menu .usage-bar");
      for (var m2 = 0; m2 < mi.length; m2++) {
        if (!mi[m2].offsetHeight) continue;
        var mr2 = mi[m2].getBoundingClientRect().right;
        if (ref == null || mr2 > ref) ref = mr2;
      }
      // header.js adopts the bell and burger into the menu row as <span> siblings of the
      // .nav-item.util > a links, so the query above misses them. [data-cc-trig] covers the
      // adopted state, #UserProfile the moment before adoption and theming off.
      if (document.documentElement.classList.contains("cc-header-on")) {
        var dk = document.querySelectorAll("#menu .nav-tile.right [data-cc-trig], #UserProfile > div:nth-child(2) > span");
        for (var d2 = 0; d2 < dk.length; d2++) {
          var dr2 = dk[d2].getBoundingClientRect();
          if (dr2.width > 0 && dr2.height > 0 && (ref == null || dr2.right > ref)) ref = dr2.right;
        }
      }
      if (ref == null) { var tbl = document.querySelector("#plugin_table, table.cc-plug"); if (tbl) ref = tbl.getBoundingClientRect().right; }
      var pr = ref != null ? Math.max(0, Math.round(dr.right - ref)) : Math.round(parseFloat(getComputedStyle(db).paddingRight) || 16);
      if ((parseInt(host.style.right, 10) || -1) !== pr) host.style.setProperty("right", pr + "px", "important");
      var btn = null, cand2 = host.querySelectorAll("input, button");
      for (var c2 = 0; c2 < cand2.length; c2++) { if (cand2[c2].offsetHeight) { btn = cand2[c2]; break; } }
      var refEl = btn || host, rr = refEl.getBoundingClientRect();
      var cur = parseInt(host.style.top, 10); if (isNaN(cur)) { cur = Math.round(anchorY - dr.top - (host.offsetHeight || 30) / 2); host.style.setProperty("top", cur + "px", "important"); rr = refEl.getBoundingClientRect(); }
      var need = Math.round(cur + (anchorY - (rr.top + rr.height / 2)));
      if (Math.abs(need - cur) > 1) host.style.setProperty("top", need + "px", "important");
    } catch (e) {}
  }
  var _pinIv = null; try { _pinIv = setInterval(plugPinTick, 600); } catch (e) {}
  try { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", plugPinTick); else plugPinTick(); } catch (e) {}
  // Everything below may fail without taking the pin loop down.
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var LANG = ((document.documentElement.lang || navigator.language || "en").toLowerCase().indexOf("de") === 0) ? "de" : "en";
  var MARK = "data-ccp";

  function ls(k) { return localStorage.getItem(k); }
  // effective setting: adopt the Docker tab's cc.* while the takeover toggle is
  // on (default), otherwise this tab's own ccp.* keys
  function eff(name) { return ls("cc.styleplugin") !== "0" ? ls("cc." + name) : ls("ccp." + name); }
  // Adopting the rainbow for the icon background is a global setting, so it bypasses eff()
  // (see docker.js iconBgAdopts()).
  function iconBgAdoptsP() { return ls("cc.iconbgrainbow") === "1"; }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  var RB_PAL = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];
  if (window.CCTheme) { RB_PAL = window.CCTheme.RB; }  /* the shared palette, so this tab matches every other area */
  var RB_OFFSET = window.CCTheme ? window.CCTheme.rbSeed(RB_PAL.length) : Math.floor(Math.random() * RB_PAL.length); // the shared seed, so the rotation matches the other areas
  // Rainbow is a global mode, so cc.rainbow, cc.rbpal and cc.rainbowrot are read directly, as in
  // docker.js, while accent() stays adopt-gated. Flag mode reads its own cc.flagpal, never cc.rbpal.
  function pal() { try { if (ls("cc.flagmode") === "1") { var f = JSON.parse(ls("cc.flagpal") || "null"); if (f && f.length) return f; } var jp = JSON.parse(ls("cc.rbpal") || "null"); if (jp && jp.length) return jp; } catch (e) {} return RB_PAL; }
  function idealText(bg) { var n = parseInt(String(bg).replace("#", ""), 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  function accent() { return eff("accent") || "#2f6feb"; }
  function colorFor(i) {
    if (ls("cc.rainbow") !== "1") return accent();
    var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    return pal()[(i + off) % pal().length];
  }
  // Reactive rainbow (cc.rbmode "active"): the row chrome rests grey and takes the row's palette
  // colour on hover, so the whole row reacts.
  function reactive() { return ls("cc.rbmode") === "active"; }
  function restBg(i) { return reactive() ? "#2e2e2e" : colorFor(i); }
  // Confirms a per-row plugin uninstall with a themed swal, like the container remove, in place of
  // Unraid's separate confirm checkbox. Falls back to confirm() without SweetAlert.
  function ccPluginConfirm(name, run) {
    var txt = LANG === "de" ? '"' + name + '.plg" wird entfernt. Fortfahren?' : '"' + name + '.plg" will be removed. Continue?';
    if (typeof window.swal === "function") {
      window.swal({
        title: LANG === "de" ? "Plugin entfernen?" : "Remove plugin?", text: txt, type: "warning",
        showCancelButton: true, confirmButtonText: LANG === "de" ? "Löschen" : "Delete",
        cancelButtonText: LANG === "de" ? "Abbrechen" : "Cancel", confirmButtonColor: "#c0392b"
      }, function (ok) { if (ok) run(); });
    } else if (window.confirm(txt)) { run(); }
  }
  // One global tile size key (cc.sgsize, not eff-gated): s 48/62, m 62/78, l 76/94 [img, box].
  // docker.js does not run on this page, so the vars are stamped here for the docker.css
  // #plugin_list and .cc-plugico rules; returns the img size for the inline stamps.
  function logoSize() {
    var lg = ({ s: ["48px", "62px"], m: ["62px", "78px"], l: ["76px", "94px"] })[ls("cc.sgsize") || "m"] || ["62px", "78px"];
    try { var rs = document.documentElement.style; rs.setProperty("--cc-logo-img", lg[0]); rs.setProperty("--cc-logo-box", lg[1]); } catch (e) {}
    return lg[0];
  }

  // The Docker tab's icon tint on its own: luminance x target colour through an SVG
  // feColorMatrix, blended by cc.iconstrength. The background (Hintergrund) and the tint
  // (Einfärben) are independent: eff("iconbg") and eff("iconbgcolor") drive the badge,
  // eff("icontint") and eff("iconcolor") the tint. Without icontint, a set iconcolor still means
  // the tint is on, so older settings keep their look.
  function plugTintOn() {
    var v = eff("icontint");
    return v == null ? !!eff("iconcolor") : v === "1";
  }
  // With the adopt toggle on this answers "", so paintRow() never stamps --cc-iconbg-color and
  // docker.css's var(--cc-iconbg-color, var(--cc-rb-c, var(--cc-accent))) chain falls through to
  // the per-row --cc-rb-c. See docker.js iconAdoptTint().
  function plugBgColor() {
    if (iconBgAdoptsP()) return "";   // adopting: defer to the CSS rainbow/accent chain
    var c = eff("iconbgcolor");
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) return ccHex6(c);
    var ic = eff("iconcolor");
    if (ic && /^#?[0-9a-f]{6}$/i.test(ic)) return ccHex6(ic);
    return accent();
  }
  // The icon pipeline's target colour, the same contract as docker.js iconInk(). With the adopt
  // toggle on it is the black or white contrast colour for the resolved background, whatever the
  // tint toggle says. Otherwise it is "" while the tint is off and the picked tint colour, lifted
  // out of the dark end, while it is on, whether or not the background badge is on too.
  // forTint doubles the floor because a luminance tint lands at about half the target's luma (see
  // CCTheme.liftDark); idealText() only answers #fff or #161616, so the contrast branch needs no
  // guard.
  function plugIconInk(forTint) {
    if (iconBgAdoptsP()) return idealText(colorFor(5));
    if (!plugTintOn()) return "";
    var pick = eff("iconcolor");
    var valid = pick && /^#?[0-9a-f]{6}$/i.test(pick);
    if (!valid) return "";
    if (!window.CCTheme || !window.CCTheme.liftDark) return ccHex6(pick);
    return ccHex6(window.CCTheme.liftDark(pick, accent(), window.CCTheme.LUM_FLOOR * (forTint ? 2 : 1)));
  }
  // A glyph's css colour and the luminance tint filter never apply together, as in docker.js
  // glyphInkAndFilter(); a separate function so a test can pin it. pInk already resolves to the
  // tint colour or "", so ibgOn and ibgBg are not consulted.
  function plugGlyphInkAndFilter(plan, ibgOn, ibgBg, pInk, want) {
    if (plan.treat === "native") return { color: "", filter: "none" };
    if (pInk) return { color: pInk, filter: "none" };
    return { color: "", filter: want };
  }
  // Takes the ids so the black and white ink filters of the adopt branch in paintRow() can
  // coexist; ensureTint() keeps the cc-plug-tint spelling.
  function ensureTintAs(hostId, filtId, ic) {
    var hex = /^#?([0-9a-f]{6})$/i.exec(ic || "");
    var host = document.getElementById(hostId);
    if (!hex) { if (host) host.remove(); return ""; }
    var n = parseInt(hex[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var st = Math.max(10, parseInt(eff("iconstrength") || "100", 10)) / 100;
    var lr = 0.2126, lg = 0.7152, lb = 0.0722, i2 = 1 - st;
    function row(c, idx) { var v = [lr * c * st, lg * c * st, lb * c * st, 0, 0]; v[idx] += i2; return v.join(" "); }
    var vals = row(r, 0) + " " + row(g, 1) + " " + row(b, 2) + " 0 0 0 1 0";
    if (!host) { host = document.createElement("div"); host.id = hostId; host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var sig = filtId + "|" + vals;
    if (host.dataset.sig !== sig) {
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '"/></filter></svg>';
      host.dataset.sig = sig;
    }
    return "url(#" + filtId + ")";
  }
  function ensureTint() { return ensureTintAs("cc-plug-tint-svg", "cc-plug-tint", plugIconInk(true)); }
  // Expands #rgb to #rrggbb: idealText answers "#fff", while every filter builder and colour
  // regex here wants six digits.
  function ccHex6(c) {
    c = String(c == null ? "" : c).trim();
    return /^#[0-9a-f]{3}$/i.test(c) ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  }
  // Flattens a logo to one ink colour with an SVG feColorMatrix that keeps alpha, the same
  // contract as docker.js ensureFlatFilter. Signature-guarded so the MutationObserver never
  // rewrites identical SVG in a repaint loop.
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
    return ensureFlatFilter(hostId, filtId, m ? idealText("#" + m[1]) : "");
  }
  function shapeRadius() { return ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[ls("cc.badgeshape") || "pill"] || "999px"; }
  function pill(node, bg, tx) {
    // the sm size from CannonadeCommand.Tokens.css, like every other small badge
    node.style.setProperty("font-size", "var(--cc-sm-fs, 11px)", "important");
    node.style.setProperty("vertical-align", "middle", "important");
    node.style.setProperty("background", bg, "important");
    node.style.setProperty("color", tx || idealText(bg), "important");
    node.style.setProperty("border-radius", "var(--cc-b-radius, 999px)", "important"); // shape follows the badge var
    node.style.setProperty("padding", "var(--cc-sm-pad, 3px 11px)", "important");
    node.style.setProperty("border", "none", "important");
    node.style.setProperty("box-shadow", "none", "important");
    node.style.setProperty("display", "inline-block", "important");
    node.style.setProperty("line-height", "1.5", "important");
    node.style.setProperty("text-decoration", "none", "important");
    // This runs on a <span> and on a native <input type=button>, which brings browser button
    // chrome and a Tokens.css height rule meant for the page-level update button, so the whole
    // box model is set here to give both the same size.
    node.style.setProperty("box-sizing", "border-box", "important");
    node.style.setProperty("height", "auto", "important");
    node.style.setProperty("min-height", "0", "important");
    node.style.setProperty("max-height", "none", "important");
    node.style.setProperty("margin", "0", "important");
    node.style.setProperty("appearance", "none", "important");
    node.style.setProperty("-webkit-appearance", "none", "important");
  }
  function badge(label, value, i) {
    var b = el("span", "cc-b cc-b-info"); b.setAttribute(MARK, "1");
    var bg = restBg(i);
    b.style.setProperty("background", bg, "important");
    b.style.setProperty("color", idealText(bg), "important");
    if (label) b.appendChild(el("span", "cc-b-k", label));
    b.appendChild(el("span", "cc-b-v", value));
    return b;
  }

  // Many plugin icons carry baked-in padding, so each logo is cropped to its alpha bounding box,
  // re-rendered centred at the same fill in a square canvas, and the src swapped. Every logo then
  // shows its content at the same size whatever its padding or resolution.
  var normCache = {};
  var plugWantNames = [];   // every plugin name of the current paint pass, asked for in one batch
  // Source swap for the icon pipeline, like docker.js setIconSrc, but it also clears
  // data-cc-normed, so going back to the native icon lets normalizeIcon crop it again.
  function plugSetIconSrc(img, url) {
    if (!img.getAttribute("data-cc-osrc")) img.setAttribute("data-cc-osrc", img.getAttribute("src") || "");
    var want = url || img.getAttribute("data-cc-osrc") || "";
    if (!want || img.getAttribute("data-cc-isrc") === want) return;
    img.setAttribute("data-cc-isrc", want);
    img.removeAttribute("data-cc-normed");
    if (img.getAttribute("src") !== want) img.setAttribute("src", want);
  }
  function applyNorm(img, url) {
    if (img.getAttribute("data-cc-normed") === url) return; // already swapped
    if (!img.getAttribute("data-cc-osrc")) img.setAttribute("data-cc-osrc", img.src);
    img.setAttribute("data-cc-normed", url);
    img.src = url;
  }
  function normalizeIcon(img) {
    // key on the original src so a re-render (Unraid rewrites the row) still hits the cache
    var src = img.getAttribute("data-cc-osrc") || img.src || ""; if (!src) return;
    if (src.indexOf("data:") === 0) return;
    if (normCache[src] != null) { if (normCache[src] !== "1") applyNorm(img, normCache[src]); return; }
    normCache[src] = "1"; // provisional
    var probe = new Image();
    probe.onerror = function () { normCache[src] = "1"; };
    probe.onload = function () {
      try {
        var nw = probe.naturalWidth, nh = probe.naturalHeight; if (!nw || !nh) return;
        // draw the source contain-style into WxW so the measured bbox matches what is seen
        var W = 96, cv = document.createElement("canvas"); cv.width = cv.height = W;
        var cx = cv.getContext("2d");
        var sc = Math.min(W / nw, W / nh), dw = nw * sc, dh = nh * sc, ox = (W - dw) / 2, oy = (W - dh) / 2;
        cx.drawImage(probe, ox, oy, dw, dh);
        var dpx = cx.getImageData(0, 0, W, W).data;
        var minX = W, minY = W, maxX = -1, maxY = -1;
        for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) { if (dpx[(y * W + x) * 4 + 3] > 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
        if (maxX < 0) { normCache[src] = "1"; return; }
        var bw = maxX - minX + 1, bh = maxY - minY + 1;
        // re-render the cropped content, centred, filling 82% of the output square
        var OUT = 128, avail = OUT * 0.82, k = Math.min(avail / bw, avail / bh);
        var out = document.createElement("canvas"); out.width = out.height = OUT;
        var ocx = out.getContext("2d"); ocx.imageSmoothingEnabled = true; ocx.imageSmoothingQuality = "high";
        var tw = bw * k, th = bh * k;
        ocx.drawImage(cv, minX, minY, bw, bh, (OUT - tw) / 2, (OUT - th) / 2, tw, th);
        var url = out.toDataURL("image/png"); // tainted (cross-origin) -> throws -> fallback below
        normCache[src] = url; applyNorm(img, url);
      } catch (e9) { normCache[src] = "1"; }
    };
    probe.src = src;
  }
  function paintRow(tr, idx) {
    var tds = tr.children;
    if (!tds || tds.length < 6) return;
    // The row's palette colour for the reactive hover rules in docker.css, and its contrast ink,
    // which the adopt branch of the icon pipeline below reuses.
    var rowInk = "";
    try { var rc = colorFor(idx); rowInk = idealText(rc); tr.style.setProperty("--cc-rb-c", rc); tr.style.setProperty("--cc-rb-ct", rowInk); } catch (e0) {}
    for (var i = 0; i < tds.length; i++) tds[i].style.setProperty("vertical-align", "middle", "important");
    // Column 1 becomes the plugin cell, like Docker's ct-name: the logo at container size, the
    // name, and the support thread badge underneath. The name is the <strong> in column 2's
    // README markdown.
    if (!tds[0].getAttribute(MARK)) {
      tds[0].setAttribute(MARK, "1");
      var nameEl = tds[1].querySelector("h1, h2, h3") || tds[1].querySelector("strong, b");
      var nm = nameEl ? nameEl.textContent.trim() : ((tds[3].id || "").replace(/^vid-/, ""));
      if (nameEl) nameEl.remove(); // no doubled name in the description column
      var sup = null;
      Array.prototype.slice.call(tds[1].querySelectorAll("a")).forEach(function (a2) { if (/support|hilfe|foren|forum/i.test(a2.textContent)) sup = a2; });
      var box = el("div", "cc-plugname");
      var icoWrap = el("div", "cc-plugico");
      while (tds[0].firstChild) icoWrap.appendChild(tds[0].firstChild);
      var txt = el("div", "cc-plugtxt");
      txt.appendChild(el("div", "cc-plugtitle", nm));
      if (sup) {
        var sb = el("a", "cc-b cc-plugsup", LANG === "de" ? "Support-Thread" : "Support thread");
        sb.href = sup.href; sb.target = "_blank"; sb.setAttribute(MARK, "1");
        var sbg = restBg(idx + 9);
        sb.style.setProperty("background", sbg, "important");
        sb.style.setProperty("color", idealText(sbg), "important");
        sb.style.setProperty("text-decoration", "none", "important");
        sup.remove();
        txt.appendChild(sb);
      }
      // This block runs once, so the name is kept for the icon lookup and the per-plugin pin.
      tds[0].setAttribute("data-cc-pname", nm || "");
      // The Plugins tab has no per-item settings window, so the icon pin gets a small control
      // next to the name that opens the shared popover from cc-theme.js.
      if (window.CCTheme && window.CCTheme.icons && nm) {
        var icb = el("span", "cc-b cc-plugicm", LANG === "de" ? "Icon" : "Icon");
        icb.setAttribute(MARK, "1");
        icb.title = LANG === "de" ? "Icon-Färbung für dieses Plugin" : "Icon colouring for this plugin";
        icb.style.setProperty("cursor", "pointer", "important");
        icb.style.setProperty("text-decoration", "none", "important");
        var ibg2 = restBg(idx + 4);
        icb.style.setProperty("background", ibg2, "important");
        icb.style.setProperty("color", idealText(ibg2), "important");
        icb.addEventListener("click", function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          window.CCTheme.icons.popover(icb, "plugin", nm, function () { try { paint(); } catch (e3) {} });
        });
        txt.appendChild(icb);
      }
      box.appendChild(icoWrap); box.appendChild(txt);
      tds[0].appendChild(box);
    }
    var ico = tds[0].querySelector(".cc-plugico");
    // content-sized like the Docker and VM span.hand (62px logo plus 8px padding)
    if (ico) { ico.style.removeProperty("width"); ico.style.removeProperty("height"); }
    // Unraid puts one of three icon types in this cell: <img> (PNG), <i class="fa ..."> and
    // <i class="icon-... list"> (its own glyph font). All three are sized alike below.
    var ibgOn = eff("iconbg") === "1";
    var ibgBg = plugBgColor();
    // With the adopt toggle on there are two shared filters, black ink and white ink, and each
    // row picks the one matching its own rowInk, the value stamped as its --cc-rb-ct above.
    var f2, pFlat, pInk;
    if (iconBgAdoptsP()) {
      var rowBlk = rowInk !== "#fff";
      pFlat = rowBlk ? ensureFlatFilter("cc-plug-mono-svg-blk", "cc-plug-mono-tint-blk", "#161616") : ensureFlatFilter("cc-plug-mono-svg-wht", "cc-plug-mono-tint-wht", "#fff");
      f2 = rowBlk ? ensureTintAs("cc-plug-tint-svg-blk", "cc-plug-tint-blk", "#161616") : ensureTintAs("cc-plug-tint-svg-wht", "cc-plug-tint-wht", "#fff");
      pInk = rowInk;
    } else {
      f2 = ensureTint();
      pInk = plugIconInk(false);
      // Branch on pInk, which is "" whenever the tint is off; branching on ibgOn would flatten
      // every icon to the box's ink with the tint off.
      pFlat = pInk ? ensureFlatFilter("cc-plug-mono-svg", "cc-plug-mono-tint", pInk) : ensureFlatFilter("cc-plug-mono-svg", "cc-plug-mono-tint", "");
    }
    var LOGO = logoSize(); // cc.sgsize step = Docker/VM logo size (m default 62px)
    var pName = tds[0].getAttribute("data-cc-pname") || "";
    var PCI = window.CCTheme && window.CCTheme.icons;
    if (PCI && pName) plugWantNames.push(pName);   // asked for in one batch per paint()
    Array.prototype.slice.call(tds[0].querySelectorAll("img, i")).forEach(function (el2) {
      el2.style.setProperty("width", LOGO, "important");
      el2.style.setProperty("height", LOGO, "important");
      el2.style.setProperty("vertical-align", "middle", "important");
      var isGlyphEl = el2.tagName !== "IMG";
      // A font glyph is monochrome by construction: nothing to measure, nothing to fetch.
      var plan = { treat: "tint", url: "" };
      if (PCI && pName) {
        var pres = PCI.result(pName), pkind = (pres && pres.kind !== "pending") ? pres.kind : "";
        var pspread = isGlyphEl ? 0 : PCI.spread(el2.getAttribute("data-cc-osrc") || el2.getAttribute("src") || "");
        var pp = PCI.plan(PCI.mode("plugin", pName), pkind, pspread);
        plan = { treat: pp.treat, url: (!isGlyphEl && (pp.src === "glyph" || pp.src === "color")) ? PCI.svgUrl(pName) : "" };
      }
      var want = plan.treat === "native" ? "none" : (plan.treat === "flat" ? (pFlat || f2 || "none") : (f2 || "none"));
      if (!isGlyphEl) {
        el2.style.setProperty("object-fit", "contain", "important");
        el2.style.removeProperty("transform"); // superseded by content normalization
        if (plan.url) plugSetIconSrc(el2, plan.url);   // a curated icon is already uniformly framed
        else { plugSetIconSrc(el2, ""); normalizeIcon(el2); }   // crop to content bbox -> uniform visual size
        el2.style.setProperty("filter", want, "important");
      } else {
        // font glyph (fa- or icon-): size + center to visually match the images
        el2.style.setProperty("font-size", LOGO, "important");
        el2.style.setProperty("line-height", LOGO, "important");
        el2.style.setProperty("text-align", "center", "important");
        el2.style.setProperty("display", "inline-block", "important");
        var pgif = plugGlyphInkAndFilter(plan, ibgOn, ibgBg, pInk, want);
        if (pgif.color) el2.style.setProperty("color", pgif.color, "important"); else el2.style.removeProperty("color");
        el2.style.setProperty("filter", pgif.filter, "important");
      }
    });
    // col 3: author as a badge
    var au = tds[2];
    if (!au.querySelector(".cc-b")) {
      var name = au.textContent.trim();
      if (name) { au.textContent = ""; var ab = badge("Von", name, idx); ab.classList.add("cc-b-von", "cc-b-pauthor", "cc-plugauth"); au.appendChild(ab); }
    }
    // Column 4 (vid) is rebuilt after every ajax rewrite: [Neu <new>] (amber, only with a pending
    // update), [Version <old>], [Changelog]. The native info circle keeps its delegated handler;
    // it is hidden and the changelog badge clicks it.
    var vid = tds[3];
    var col = vid.querySelector(".cc-plugver");
    if (!col) { col = el("div", "cc-plugver"); vid.appendChild(col); }
    var redV = vid.querySelector("span.red-text:not([data-ccp]), span.orange-text:not([data-ccp])");
    if (redV && redV.textContent.trim()) {
      redV.setAttribute(MARK, "1");
      redV.style.setProperty("display", "none", "important");
      var nb0 = el("span", "cc-b"); nb0.setAttribute(MARK, "1");
      nb0.appendChild(el("span", "cc-b-k", "Neu"));
      nb0.appendChild(el("span", "cc-b-v", redV.textContent.trim()));
      nb0.style.setProperty("background", "#e0912a", "important");
      nb0.style.setProperty("color", "#161616", "important");
      col.insertBefore(nb0, col.firstChild);
    }
    if (!col.querySelector(".cc-verb")) {
      var icon = vid.querySelector("span.fa, i.fa");
      var vtxt = "";
      Array.prototype.slice.call(vid.childNodes).forEach(function (n2) { if (n2.nodeType === 3) { vtxt += n2.textContent; n2.textContent = ""; } });
      vtxt = vtxt.replace(/ /g, " ").trim();
      if (vtxt) { var vb = badge("Version", vtxt, idx + 3); vb.classList.add("cc-verb"); col.appendChild(vb); }
      if (icon) {
        icon.style.setProperty("display", "none", "important");
        var ib = el("span", "cc-b"); ib.setAttribute(MARK, "1");
        ib.appendChild(el("span", "cc-b-v", "Changelog"));
        var bg2 = restBg(idx + 6);
        ib.style.setProperty("background", bg2, "important");
        ib.style.setProperty("color", idealText(bg2), "important");
        ib.style.setProperty("cursor", "pointer", "important");
        ib.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); icon.click(); });
        col.appendChild(ib);
      }
    }
    // Column 5 (sid): the status badge. The update check rewrites the cell, so this runs on every
    // mutation. With native state colours on it is green (up to date) or amber (update);
    // otherwise it follows the colour mode.
    var sid = tds[4];
    var stNative = ls("cc.statenative") === "1";
    var pRs = getComputedStyle(document.documentElement);
    var palC = (pRs.getPropertyValue("--cc-rbaccent") || "").trim() || (pRs.getPropertyValue("--cc-accent") || "").trim() || "#2f6feb";
    var palT = (pRs.getPropertyValue("--cc-rbaccent-text") || "").trim() || (pRs.getPropertyValue("--cc-accent-text") || "").trim() || "#fff";
    var upA = sid.querySelector("a:not([data-ccp]), input[type=button]:not([data-ccp])");
    if (upA && /update|aktualis/i.test(upA.textContent || upA.value || "")) {
      upA.setAttribute(MARK, "1"); pill(upA, stNative ? "#e0912a" : palC, stNative ? "#161616" : palT);
      upA.style.setProperty("cursor", "pointer", "important");
      upA.style.setProperty("font-weight", "600", "important");
    }
    var stEl = sid.querySelector("span, a");
    if (!stEl && sid.textContent.trim() && !/checking|prüf/i.test(sid.textContent)) {
      stEl = el("span", null); while (sid.firstChild) stEl.appendChild(sid.firstChild); sid.appendChild(stEl);
    }
    if (stEl && !stEl.getAttribute(MARK)) {
      var t2 = sid.textContent.toLowerCase();
      if (/up.to.date|aktuell|neue?sten stand|current/.test(t2)) { pill(stEl, stNative ? "#1f9d55" : palC, stNative ? "#fff" : palT); stEl.setAttribute(MARK, "1"); }
      else if (/update|aktualis|install/.test(t2) && !/checking|prüf/.test(t2)) { pill(stEl, stNative ? "#e0912a" : palC, stNative ? "#161616" : palT); stEl.setAttribute(MARK, "1"); }
    }
    var lnk = sid.querySelector("a"); if (lnk) lnk.style.setProperty("color", "inherit", "important");
    // Column 6: the remove control, the same delete control as on the Shares detail page. The
    // confirm checkbox stays a separate sibling (.cc-cb-del) and the button is the red badge
    // (.cc-b-del); both classes live in styles/docker.css.
    var cb = tds[5].querySelector("input[type=checkbox]");
    if (cb && !cb.getAttribute(MARK)) { cb.setAttribute(MARK, "1"); cb.classList.add("cc-cb-del"); }
    var rm = tds[5].querySelector("a, input[type=button], input[type=submit], button");
    if (rm && !rm.getAttribute(MARK)) {
      rm.setAttribute(MARK, "1");
      rm.classList.add("cc-b-del");
      // Relabel the per-row uninstall control to "Löschen"/"Delete" so it matches the
      // Shares delete badge. Locale-independent gate: the native button carries class="remove"
      // (PHP class='$method'); its onclick holds the untranslated shell command "plugin remove <file>".
      // The sibling class="remove" checkbox is handled above as `cb`, so `rm` is the button.
      var isRemove = rm.tagName === "INPUT" &&
        (rm.classList.contains("remove") || /plugin\s+remove\b/.test(rm.getAttribute("onclick") || ""));
      if (isRemove) {
        rm.value = LANG === "de" ? "Löschen" : "Delete";
      } else if (rm.tagName === "INPUT" && !rm.value.trim()) {
        rm.value = LANG === "de" ? "Entfernen" : "Remove";
      }
      // The uninstall becomes a trash icon with a CC confirmation, like the container remove,
      // without Unraid's confirm checkbox. The native onclick runs "plugin remove <file>" through
      // openInstall(); it is detached and gated behind ccPluginConfirm, and the button is enabled,
      // since Unraid keeps it disabled until the hidden checkbox is ticked. The .cc-b-delicon
      // look and the hidden checkbox live in docker.css.
      var native = isRemove ? (rm.getAttribute("onclick") || "") : "";
      if (native) {
        rm.removeAttribute("onclick");
        rm.disabled = false;
        rm.classList.add("cc-b-delicon");
        rm.title = LANG === "de" ? "Plugin löschen" : "Delete plugin";
        var slug = (tr.id || "").trim() || "Plugin";
        var runNative; try { runNative = new Function(native); } catch (e) { runNative = function () {}; }
        rm.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); ccPluginConfirm(slug, runNative); });
        if (cb) cb.classList.add("cc-cb-hidden");
      }
    }
    // Column 2: the description in a fixed, scrollable window instead of dynamix's click-to-expand.
    var desc = tds[1].querySelector(".desc_readmore, .cc-desc");
    if (desc && !desc.getAttribute(MARK)) {
      desc.setAttribute(MARK, "1");
      desc.classList.remove("desc_readmore"); // detach dynamix' click-to-expand
      desc.classList.add("cc-desc");
      var inn = el("div", "cc-descin");
      while (desc.firstChild) inn.appendChild(desc.firstChild);
      desc.appendChild(inn);
      var sib = desc.nextElementSibling; // the chevron the readmore lib left behind
      if (sib && /readmore|toggle/i.test(sib.className || "")) sib.style.setProperty("display", "none", "important");
    }
    if (desc) {
      desc.style.setProperty("color", "#9a9a9a", "important"); desc.style.setProperty("font-size", "12px", "important");
      // inline on every pass, because the readmore lib leaves inline heights on some rows
      desc.style.setProperty("display", "block", "important");
      desc.style.setProperty("height", "auto", "important");
      desc.style.setProperty("max-height", "5em", "important");
      desc.style.setProperty("overflow-y", "auto", "important");
      // the same geometry in every row, so the scrollbars line up
      desc.style.setProperty("width", "100%", "important");
      desc.style.setProperty("box-sizing", "border-box", "important");
      desc.style.setProperty("margin", "0", "important");
    }
  }

  // Colours the page tab buttons: colorFor() gives the accent, or a rotated palette colour in
  // rainbow mode, so the active tab follows the theme.
  function colorTabs() {
    try {
      Array.prototype.slice.call(document.querySelectorAll("nav.tabs .tabs-container > button[role=tab]")).forEach(function (t, i) {
        if (t.getAttribute("aria-selected") === "true") { var c = colorFor(i); t.style.setProperty("background", c, "important"); t.style.setProperty("color", idealText(c), "important"); }
        else { t.style.removeProperty("background"); t.style.removeProperty("color"); }
      });
      Array.prototype.slice.call(document.querySelectorAll("div.tab input[type=radio] + label, .tabbed input[type=radio] + label")).forEach(function (l, i) {
        var r = l.previousElementSibling, chk = r && r.checked;
        if (chk) { var c2 = colorFor(i); l.style.setProperty("background", c2, "important"); l.style.setProperty("color", idealText(c2), "important"); }
        else { l.style.removeProperty("background"); l.style.removeProperty("color"); }
      });
    } catch (e) {}
  }
  // Section view. In Unraid's tabbed display mode the Plugins page renders the same
  // MainContentTabbed markup as /Shares/Share and /Main (nav.tabs > button[role=tab] paired by
  // index with sibling section[role=tabpanel]), so like shares.js cardPanels() this prepends a
  // .cc-card-head cloned from each hidden tab button to its panel. docker.css, gated on
  // html.cc-on-plugins.cc-sections-plugins, shows every panel and hides only the tab buttons.
  function cardPanels(box) {
    var tablist = box.querySelector('nav.tabs, [role="tablist"]');
    var tabBtns = tablist ? tablist.querySelectorAll('button[role="tab"]') : [];
    var panels = box.querySelectorAll('section[role="tabpanel"]');
    for (var i = 0; i < panels.length; i++) {
      var section = panels[i];
      if (section.getAttribute("data-cc-card")) continue; // idempotent; keeps i == real DOM index
      section.setAttribute("data-cc-card", "1");
      var head = document.createElement("div");
      head.className = "cc-card-head";
      var btn = tabBtns[i];
      if (btn && btn.childNodes.length) { // clone the localized <span.left><icon>Title</span>
        var kids = btn.childNodes;
        for (var k = 0; k < kids.length; k++) head.appendChild(kids[k].cloneNode(true));
      } else {
        head.textContent = (btn && btn.textContent.trim()) || (section.id || "").replace(/-panel$/, "");
      }
      section.insertBefore(head, section.firstChild);
    }
  }
  function flattenTeardown() {
    try {
      var stray = document.querySelectorAll("#displaybox .cc-card-head");
      for (var s = 0; s < stray.length; s++) stray[s].parentNode.removeChild(stray[s]);
      var marked = document.querySelectorAll("#displaybox [data-cc-card]");
      for (var m = 0; m < marked.length; m++) marked[m].removeAttribute("data-cc-card");
    } catch (e) {}
  }
  function paint() {
    try {
      if (localStorage.getItem("cc.theming") === "0" || localStorage.getItem("cc.enable.plugins") === "0") return; // theming or the area is off; a reload reverts
      var tbs = document.querySelectorAll("#plugin_table, table.tablesorter");
      if (!tbs.length) return;
      Array.prototype.slice.call(tbs).forEach(function (t5) { t5.classList.add(t5.querySelector("#plugin_list") ? "cc-plug" : "cc-plug-lite"); });
      var tb = document.querySelector("table.cc-plug") || tbs[0];
      document.documentElement.style.setProperty("--cc-b-radius", shapeRadius());
      var ths = tb.querySelectorAll("thead th");
      if (ths.length >= 2 && !ths[0].getAttribute(MARK)) {
        ths[0].setAttribute(MARK, "1");
        ths[0].textContent = "Plugin";
        ths[1].textContent = LANG === "de" ? "Beschreibung" : "Description";
      }
      var rows = document.querySelectorAll("#plugin_list > tr");
      plugWantNames = [];
      Array.prototype.slice.call(rows).forEach(function (tr, i) { try { paintRow(tr, i); } catch (e) {} });
      // one batched lookup for the whole table
      try { if (window.CCTheme && window.CCTheme.icons && plugWantNames.length) window.CCTheme.icons.want(plugWantNames); } catch (e) {}
      // the page tabs are styled by CSS (input:checked + label in docker.css), which reads the
      // accent from these :root vars
      document.documentElement.style.setProperty("--cc-accent", accent());
      document.documentElement.style.setProperty("--cc-accent-text", idealText(accent()));
      // logo-background badge: scope the docker.css .cc-plugico box on/off from the
      // adopt-aware key (honours "Adopt Docker style" via eff()), same as the Docker tab
      document.documentElement.classList.toggle("cc-plugins-iconbg", eff("iconbg") === "1");
      // in rainbow and flag mode the logo tile takes the row palette (docker.css gates the tile rule on this)
      document.documentElement.classList.toggle("cc-plugins-rainbow", ls("cc.rainbow") === "1");
      // reactive rainbow: rows rest grey and colour on hover (docker.css hover rules gated here)
      document.documentElement.classList.toggle("cc-shares-rbneutral", reactive());
      // the box's own colour (cc.iconbgcolor, then cc.iconcolor, then the accent), whether or not
      // the tint is on
      var pIbgAcc = plugBgColor();
      if (eff("iconbg") === "1" && pIbgAcc) document.documentElement.style.setProperty("--cc-iconbg-color", pIbgAcc);
      else document.documentElement.style.removeProperty("--cc-iconbg-color");
      // Section view (cc.sections.plugins, off by default): cc-on-plugins marks the page and
      // docker.css gates the flatten block on html.cc-on-plugins.cc-sections-plugins. Pages
      // without nav.tabs sections are left as they are.
      document.documentElement.classList.add("cc-on-plugins");
      var secOn = localStorage.getItem("cc.sections.plugins") === "1";
      document.documentElement.classList.toggle("cc-sections-plugins", secOn);
      var pbox = document.getElementById("displaybox");
      if (pbox) { if (secOn) cardPanels(pbox); else flattenTeardown(); }
      colorTabs();
      if (!window.__ccTabClick) { window.__ccTabClick = 1; document.addEventListener("click", function (e) { try { if (e.target.closest && e.target.closest("nav.tabs, div.tab, .tabbed")) setTimeout(colorTabs, 30); } catch (x) {} }, true); }
      // Install-Plugin tab: clean dark input + accent pill button + accent checkbox
      Array.prototype.slice.call(document.querySelectorAll("form[name=plugin_install]")).forEach(function (fm) {
        var ti = fm.querySelector("input[type=text]");
        if (ti && !ti.getAttribute(MARK)) {
          ti.setAttribute(MARK, "1");
          ti.style.setProperty("background", "#1c1c1c", "important");
          ti.style.setProperty("border", "1px solid #333", "important");
          ti.style.setProperty("border-radius", "8px", "important");
          ti.style.setProperty("padding", "7px 12px", "important");
          ti.style.setProperty("color", "#e6e6e6", "important");
        }
        var sub = fm.querySelector("input[type=submit]");
        if (sub && !sub.getAttribute(MARK)) { sub.setAttribute(MARK, "1"); pill(sub, accent()); sub.style.setProperty("cursor", "pointer", "important"); }
        var fc = fm.querySelector("input[type=checkbox]");
        if (fc && !fc.getAttribute(MARK)) { fc.setAttribute(MARK, "1"); fc.style.setProperty("accent-color", accent(), "important"); }
      });
      // every other table on the composite page (install errors / stale tab)
      Array.prototype.slice.call(document.querySelectorAll("table.tablesorter")).forEach(function (t4) { if (t4.id !== "plugin_table") t4.classList.add("cc-plug-lite"); });
      // lite tables (install errors / stale): ERROR pill + red action link
      Array.prototype.slice.call(document.querySelectorAll("table.cc-plug-lite tbody tr")).forEach(function (tr5) {
        var st5 = tr5.querySelector("span.orange-text, span.red-text");
        if (st5 && !st5.getAttribute(MARK)) { st5.setAttribute(MARK, "1"); pill(st5, "#e0912a", "#161616"); }
        var ac5 = tr5.querySelector("a, input[type=button]");
        if (ac5 && !ac5.getAttribute(MARK)) { ac5.setAttribute(MARK, "1"); pill(ac5, "#d9433f", "#fff"); ac5.style.setProperty("cursor", "pointer", "important"); }
      });
      plugPinTick();
      // the Check/Update/Remove buttons in the tab bar become accent pills
      Array.prototype.slice.call(document.querySelectorAll("#checkall input, #updateall input, #removeall input")).forEach(function (b2, i2) {
        if (!b2.getAttribute(MARK)) {
          pill(b2, colorFor(i2 + 6));
          // The md size of the tab pills, with the height fixed and the text centred. An inline
          // !important outranks every sheet, so the values come from the tokens.
          b2.style.setProperty("height", "var(--cc-md-h, 30px)", "important");
          b2.style.setProperty("padding", "var(--cc-md-pad, 0 20px)", "important");
          b2.style.setProperty("line-height", "1", "important");
          b2.style.setProperty("box-sizing", "border-box", "important");
          b2.style.setProperty("font-size", "var(--cc-md-fs, 13px)", "important");
          b2.style.setProperty("font-weight", "600", "important");
          b2.style.setProperty("text-transform", "uppercase", "important");
          b2.style.setProperty("letter-spacing", "1.5px", "important");
          b2.style.setProperty("cursor", "pointer", "important");
          b2.setAttribute(MARK, "1");
        }
      });
    } catch (e) {}
  }

  // Adopts the cc.* settings mirrored in the engine, so the accent and rainbow match the other
  // tabs on every origin.
  function adopt(done) {
    fetch(PROXY + "?path=config", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        try { var u = c && c.ui_settings; if (u) Object.keys(u).forEach(function (k) { if (/^cc[a-z]*\./.test(k) && k !== "cc.stateCache" && ls(k) !== u[k]) localStorage.setItem(k, u[k]); }); } catch (e) {}
        done();
      })
      .catch(function () { done(); });
  }

  function boot() {
    try { window.ccPluginsApply = paint; } catch (e) {} // lets the CC Settings page repaint this tab live, like ccSharesApply
    if (localStorage.getItem("cc.enable.plugins") === "0" || localStorage.getItem("cc.theming") === "0") return; // area disabled, or master theming off
    // Paint from the mirrored cc.* localStorage first rather than waiting for /api/config;
    // adopt() below paints again once the settings are in.
    paint();
    // Icon pipeline: repaint once an engine lookup or a complexity measurement lands. Fires
    // only on a real change (cc-theme.js), so it settles instead of looping.
    try { if (window.CCTheme && window.CCTheme.icons) window.CCTheme.icons.onResolved(function () { try { paint(); } catch (e) {} }); } catch (e) {}
    var host = document.getElementById("displaybox") || document.body; // whole page: tab switches + ajax rewrites
    // Paint in the same frame the DOM changes and coalesce bursts. childList and subtree only, so
    // a per-second status text tick cannot force a full re-skin, and the observer is disconnected
    // during our own paint so it cannot trigger itself.
    var pObs = null, pBusy = false, pTrail = false, pT = null;
    function pSweep() {
      pBusy = true; pTrail = false;
      try { if (pObs) pObs.disconnect(); } catch (e) {}
      try { paint(); } catch (e) {}
      try { if (pObs) pObs.observe(host, { childList: true, subtree: true }); } catch (e) {}
      pT = setTimeout(function () { pT = null; pBusy = false; if (pTrail) pSweep(); }, 250);
    }
    pObs = new MutationObserver(function () { if (pBusy) { pTrail = true; return; } pSweep(); });
    pObs.observe(host, { childList: true, subtree: true });
    document.addEventListener("change", function () { setTimeout(paint, 50); }); // tab switches repaint the pills
    [600, 1500, 3500].forEach(function (ms) { setTimeout(paint, ms); });          // late-render safety net (idempotent)
    adopt(function () { paint(); });   // paint again with the mirrored settings
    // The CC Settings page writes cc.* and ccp.* keys from another tab, so repaint live.
    // cc.stateCache is skipped because the Docker tab rewrites it every 9s.
    try { window.addEventListener("storage", function (e) { if (e && e.key && e.key !== "cc.stateCache" && /^cc[a-z]*\./.test(e.key)) paint(); }); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();