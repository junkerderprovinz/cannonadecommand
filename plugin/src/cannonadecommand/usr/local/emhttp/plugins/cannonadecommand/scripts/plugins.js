/* CannonadeCommand — enhances Unraid's PLUGINS tab in place, Docker-tab style:
 * badges for author/version/status, tinted icons and pill buttons, accent or
 * rainbow colours, all idempotent on top of the native #plugin_table. The
 * native markup keeps working — we only decorate it (ground truth:
 * dynamix.plugin.manager/Plugins.page + include/ShowPlugins.php). */
(function () {
  "use strict";
  if (window.__ccPlug) return; window.__ccPlug = 1;
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var MARK = "data-ccp";

  function ls(k) { return localStorage.getItem(k); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  var RB_PAL = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"];
  function pal() { try { var jp = JSON.parse(ls("cc.rbpal") || "null"); if (jp && jp.length) return jp; } catch (e) {} return RB_PAL; }
  function idealText(bg) { var n = parseInt(String(bg).replace("#", ""), 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  function accent() { return ls("cc.accent") || "#2f6feb"; }
  function colorFor(i) { return ls("cc.rainbow") === "1" ? pal()[i % pal().length] : accent(); }

  function pill(node, bg, tx) {
    node.style.setProperty("background", bg, "important");
    node.style.setProperty("color", tx || idealText(bg), "important");
    node.style.setProperty("border-radius", "999px", "important");
    node.style.setProperty("padding", "3px 12px", "important");
    node.style.setProperty("border", "none", "important");
    node.style.setProperty("box-shadow", "none", "important");
    node.style.setProperty("display", "inline-block", "important");
    node.style.setProperty("line-height", "1.5", "important");
    node.style.setProperty("text-decoration", "none", "important");
  }
  function badge(label, value, i) {
    var b = el("span", "cc-b cc-b-info"); b.setAttribute(MARK, "1");
    var bg = colorFor(i);
    b.style.setProperty("background", bg, "important");
    b.style.setProperty("color", idealText(bg), "important");
    if (label) b.appendChild(el("span", "cc-b-k", label));
    b.appendChild(el("span", "cc-b-v", value));
    return b;
  }

  function paintRow(tr, idx) {
    var tds = tr.children;
    if (!tds || tds.length < 6) return;
    for (var i = 0; i < tds.length; i++) tds[i].style.setProperty("vertical-align", "middle", "important");
    // col 1: the plugin icon — sized + centred like the Docker-tab logos
    var img = tds[0].querySelector("img, i.fa");
    if (img && img.tagName === "IMG") { img.style.setProperty("width", "44px", "important"); img.style.setProperty("height", "44px", "important"); img.style.setProperty("vertical-align", "middle", "important"); }
    // col 3: author as a badge
    var au = tds[2];
    if (!au.querySelector(".cc-b")) {
      var name = au.textContent.trim();
      if (name) { au.textContent = ""; au.appendChild(badge("Von", name, idx)); }
    }
    // col 4 (vid): version as a badge; the native info-circle stays clickable behind it
    var vid = tds[3];
    if (!vid.querySelector(".cc-b")) {
      var icon = vid.querySelector("span.fa");
      var vtxt = "";
      Array.prototype.slice.call(vid.childNodes).forEach(function (n2) { if (n2.nodeType === 3) vtxt += n2.textContent; });
      vtxt = vtxt.replace(/ /g, " ").trim();
      if (vtxt) {
        Array.prototype.slice.call(vid.childNodes).forEach(function (n2) { if (n2.nodeType === 3) n2.textContent = ""; });
        vid.insertBefore(badge("Version", vtxt, idx + 3), icon || null);
        if (icon) icon.style.setProperty("margin-left", "6px", "important");
      }
    }
    // col 5 (sid): status pill — green when current, amber when an update waits.
    // The cell is REWRITTEN by the update-check ajax, so this re-runs per mutation.
    var sid = tds[4], stEl = sid.querySelector("span, a");
    if (stEl && !stEl.getAttribute(MARK)) {
      var t2 = sid.textContent.toLowerCase();
      if (/up.to.date|aktuell|current/.test(t2)) { pill(stEl, "#1f9d55", "#fff"); stEl.setAttribute(MARK, "1"); }
      else if (/update|aktualis|install/.test(t2) && !/checking|prüf/.test(t2)) { pill(stEl, "#e0912a", "#161616"); stEl.setAttribute(MARK, "1"); }
    }
    var lnk = sid.querySelector("a"); if (lnk) lnk.style.setProperty("color", "inherit", "important");
    // col 2: dim the long description, keep the title line readable
    var desc = tds[1].querySelector(".desc_readmore");
    if (desc) { desc.style.setProperty("color", "#9a9a9a", "important"); desc.style.setProperty("font-size", "12px", "important"); }
  }

  function paint() {
    try {
      if (ls("cc.styleplugin") === "0") return; // takeover disabled in the settings
      var tb = document.getElementById("plugin_table"); if (!tb) return;
      tb.classList.add("cc-plug");
      var rows = document.querySelectorAll("#plugin_list > tr");
      Array.prototype.slice.call(rows).forEach(function (tr, i) { try { paintRow(tr, i); } catch (e) {} });
      // the Check/Update/Remove buttons in the tab bar become accent pills
      Array.prototype.slice.call(document.querySelectorAll("#checkall input, #updateall input, #removeall input")).forEach(function (b2, i2) {
        if (!b2.getAttribute(MARK)) { pill(b2, colorFor(i2 + 6)); b2.style.setProperty("cursor", "pointer", "important"); b2.setAttribute(MARK, "1"); }
      });
    } catch (e) {}
  }

  // adopt the engine-mirrored cc.* settings first, so accent/rainbow match the
  // other tabs on EVERY origin, then paint and follow the ajax rewrites
  function adopt(done) {
    fetch(PROXY + "?path=config", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        try { var u = c && c.ui_settings; if (u) Object.keys(u).forEach(function (k) { if (k.indexOf("cc.") === 0 && ls(k) !== u[k]) localStorage.setItem(k, u[k]); }); } catch (e) {}
        done();
      })
      .catch(function () { done(); });
  }

  function boot() {
    adopt(function () {
      paint();
      var host = document.getElementById("plugin_list") || document.body;
      var t3 = null;
      new MutationObserver(function () { clearTimeout(t3); t3 = setTimeout(paint, 250); }).observe(host, { childList: true, subtree: true, characterData: true });
      [600, 1500, 3500].forEach(function (ms) { setTimeout(paint, ms); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
