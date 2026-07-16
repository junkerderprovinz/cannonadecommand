/* CannonadeCommand - Favorites tab (/Favorites) enhancer.
 *
 * Self-gates to /Favorites (like vms.js / settingsgrid.js), toggles html.cc-favorites-on behind
 * master theming + the Favoriten area toggle, and mirrors the adopt-aware accent + --cc-b-radius +
 * cc-shape-circle onto :root so CannonadeCommand.Favorites.css can paint the tiles. CSS-only area:
 * teardown is just removing the class, so there is no DOM surgery / idempotency trap. /Favorites is
 * Tabs="false" (server-rendered at load), so there is no AJAX race; the observer only re-applies
 * var/class state (no injection), so it can't self-trigger a loop.
 */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function onFavorites() { try { return location.pathname.replace(/\/+$/, "") === "/Favorites"; } catch (e) { return false; } }
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  // adopt-toggle ON (default) -> global cc.accent; OFF -> this area's own ccf.accent
  function effAccent() { var a = g("cc.stylefavorites", "1") !== "0" ? g("cc.accent", "#2f6feb") : g("ccf.accent", "#2f6feb"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#2f6feb"; }
  function shape() { return ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[g("cc.badgeshape", "pill")] || "999px"; }
  function apply() {
    var root = document.documentElement;
    var live = g("cc.theming", "1") !== "0" && g("cc.enable.favorites", "1") !== "0" && onFavorites();
    root.classList.toggle("cc-favorites-on", live);
    root.classList.toggle("cc-shape-circle", g("cc.badgeshape", "pill") === "circle");
    if (!live) return;
    var a = effAccent();
    root.style.setProperty("--cc-accent", a);
    root.style.setProperty("--cc-accent-text", idealText(a));
    root.style.setProperty("--cc-b-radius", shape());
  }
  var mo = null;
  function boot() {
    if (!onFavorites()) return;                          // inert on every other page
    if (g("cc.enable.favorites", "1") === "0") return;   // area disabled in CC settings
    apply();
    try {
      var host = document.querySelector(".Panels") || document.getElementById("displaybox");
      if (host) { mo = new MutationObserver(function () { if (mo) apply(); }); mo.observe(host, { childList: true, subtree: true }); }
    } catch (e) {}
    // cc.* AND own ccf.* live-updates; cc.stateCache EXCLUDED (docker.js rewrites it every 9s)
    window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "cc.stateCache" && /^ccf?\./.test(e.key)) apply(); } catch (e2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
