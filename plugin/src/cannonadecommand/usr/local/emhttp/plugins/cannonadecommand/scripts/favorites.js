/* CannonadeCommand: styles the /Favorites page.
 *
 * /Favorites is rendered on the server (Tabs="false"), so this only toggles html.cc-favorites-on
 * and mirrors the accent, badge radius and tile size onto :root for CannonadeCommand.Favorites.css.
 * Turning it off is removing the class, and the observer never injects anything, so it cannot
 * trigger itself.
 */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function onFavorites() { try { return location.pathname.replace(/\/+$/, "") === "/Favorites"; } catch (e) { return false; } }
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  // With the adopt toggle on (the default) the global cc.accent wins over this area's ccf.accent.
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
    // cc.sgsize is shared with settingsgrid.js so /Favorites, /Settings and /Tools use one tile
    // size; m matches Docker's 78px logo tile (62px plus 8px padding).
    var sz = ({ s: ["64px", "32px"], m: ["78px", "38px"], l: ["96px", "46px"] })[g("cc.sgsize", "m")] || ["78px", "38px"];
    root.style.setProperty("--cc-fav-size", sz[0]);
    root.style.setProperty("--cc-fav-glyph", sz[1]);
  }
  var mo = null;
  function boot() {
    if (!onFavorites()) return;
    // The observer and storage listener are set up even while the area is off, so enabling it
    // from the settings page takes effect without a reload.
    apply();
    try {
      var host = document.querySelector(".Panels") || document.getElementById("displaybox");
      if (host) { mo = new MutationObserver(function () { if (mo) apply(); }); mo.observe(host, { childList: true, subtree: true }); }
    } catch (e) {}
    // cc.stateCache is skipped because docker.js rewrites it every 9s.
    window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "cc.stateCache" && /^ccf?\./.test(e.key)) apply(); } catch (e2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
