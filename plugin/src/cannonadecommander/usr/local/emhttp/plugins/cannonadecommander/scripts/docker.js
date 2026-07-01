/* CannonadeCommander - Docker tab enhancer.
 *
 * DEFAULT = Unraid's native container LIST, kept as-is and beautified in place:
 * each row gets a state badge, a dependency chip and a last-run pill. A toolbar
 * adds a List/Grid toggle (List is default), a filter, and save / start-in-order
 * for the dependency-ordered, health-gated start plan. Grid mode hides the
 * native table and shows a modern card grid instead.
 *
 * The native table is never removed, only hidden while in Grid mode. The browser
 * talks only to a same-origin PHP proxy; it never touches the Docker socket.
 */
(function () {
  "use strict";

  var PROXY = "/plugins/cannonadecommander/server/api.php";
  var VIEW_KEY = "cc.view";
  var MARK = "data-cc";
  var PROBES = ["health", "running", "tcp"];
  var POLICIES = ["abort", "continue", "degrade"];
  var UPDATE_PHRASES = ["aktualisierung", "auf dem neu", "nicht verf", "wird gepr", "up-to-date", "up to date", "update ready", "apply update", "rebuild ready"];

  var mode = localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  var containers = [], containerNames = [], stats = {}, workingPlan = {}, lastRun = {}, iconCache = {};
  var filterText = "", statusEl = null, gridHolder = null, mount = null, openPop = null;

  // ───────────────────────── api + helpers
  function api(method, path, body) {
    var opts = { method: method, headers: { Accept: "application/json" } };
    if (body != null) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch(PROXY + "?path=" + encodeURIComponent(path), opts).then(function (r) {
      return r.text().then(function (t) {
        var data = null; try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
        if (!r.ok) throw new Error((data && data.error) ? data.error : "HTTP " + r.status);
        return data;
      });
    });
  }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function norm(s) { return String(s || "").trim().toLowerCase(); }
  function humanBytes(b) {
    if (!b) return "0"; var u = ["B", "K", "M", "G", "T"], i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10) + u[i];
  }

  // ───────────────────────── native table (ShipLog-proven finder)
  function nativeTable() {
    var list = document.getElementById("docker_list");
    if (list) return list.closest("table") || list.parentNode;
    return document.getElementById("docker_containers") || document.querySelector("table#docker_containers");
  }
  function isFolderHeader(tr) {
    return !!(tr.classList.contains("folder") || tr.querySelector(":scope > td.folder-name, :scope > td.folder-update"));
  }
  function findRows() {
    var cands = ["#docker_list tr.sortable, #docker_list tr.folder-element", "#docker_list > tr", "table#docker_containers tbody tr", "table.tablesorter tbody tr", "div.tabs table tbody tr", "table tbody tr"];
    for (var i = 0; i < cands.length; i++) {
      var rows = Array.prototype.slice.call(document.querySelectorAll(cands[i])).filter(function (tr) {
        return !isFolderHeader(tr) && (tr.querySelector("td.ct-name, td.updatecolumn") || (tr.querySelector("img") && tr.textContent.trim().length > 1));
      });
      if (rows.length) return rows;
    }
    return [];
  }
  function rowName(tr) {
    var a = tr.querySelector("td.ct-name .appname");
    if (a && a.textContent.trim()) return a.textContent.trim();
    var id = tr.id || ""; if (/^ct-/.test(id)) return id.slice(3);
    var img = tr.querySelector("img"); var cell = img ? (img.closest("td") || tr) : tr;
    var link = cell.querySelector("a");
    return (link && link.textContent.trim() ? link.textContent.trim() : (cell.textContent || tr.textContent).trim().split("\n")[0].trim());
  }
  function findUpdateCell(tr) {
    var d = tr.querySelector("td.updatecolumn:not(.folder-update)"); if (d) return d;
    var cells = Array.prototype.slice.call(tr.querySelectorAll("td"));
    for (var i = 0; i < cells.length; i++) { var t = cells[i].textContent.toLowerCase(); for (var j = 0; j < UPDATE_PHRASES.length; j++) if (t.indexOf(UPDATE_PHRASES[j]) >= 0) return cells[i]; }
    return cells[cells.length - 1] || tr;
  }
  function hideNative(hide) { var t = nativeTable(); if (t) t.style.display = hide ? "none" : ""; }

  // ───────────────────────── data
  function indexState(state) {
    containers = (state && state.containers) || [];
    containerNames = containers.map(function (c) { return c.name; }).sort();
    workingPlan = {};
    if (state && state.plan && state.plan.nodes) state.plan.nodes.forEach(function (n) { workingPlan[n.name] = n; });
    lastRun = {};
    if (state && state.last_run && state.last_run.nodes) state.last_run.nodes.forEach(function (r) { lastRun[r.name] = r; });
  }
  function containerByName(name) { var k = norm(name); for (var i = 0; i < containers.length; i++) if (norm(containers[i].name) === k) return containers[i]; return null; }
  function depsTxt(node) { return node ? (node.after && node.after.length ? "after " + node.after.join(", ") : "in plan") : "plan"; }
  function iconFor(name) {
    if (iconCache[name] !== undefined) return iconCache[name];
    var src = "", row = document.getElementById("ct-" + name), img = row && row.querySelector("img");
    if (!img) { var all = document.querySelectorAll("#docker_containers img, #docker_list img"); for (var i = 0; i < all.length; i++) { var tr = all[i].closest("tr"); if (tr && norm(rowName(tr)) === norm(name)) { img = all[i]; break; } } }
    if (img) src = img.getAttribute("src") || "";
    iconCache[name] = src; return src;
  }

  // ───────────────────────── badges / gauges / chip / actions
  function stateBadge(c) {
    var s = (c && c.state) || "unknown", b = el("span", "cc-badge cc-badge-" + s, s);
    if (c && c.health === "unhealthy") { b.classList.add("cc-badge-alert"); b.textContent = s + " ✕"; }
    else if (c && c.health === "starting") b.textContent = s + " …";
    return b;
  }
  function gauge(label, pct, right) {
    var w = el("div", "cc-stat"); w.appendChild(el("span", "cc-stat-lbl", label));
    var bar = el("div", "cc-gauge"), fill = el("div", "cc-gauge-fill" + (pct >= 90 ? " cc-hot" : ""));
    fill.style.width = Math.max(0, Math.min(100, pct)) + "%"; bar.appendChild(fill);
    w.appendChild(bar); w.appendChild(el("span", "cc-stat-val", right)); return w;
  }
  function depsChip(name) {
    var node = workingPlan[name], chip = el("a", "cc-chip" + (node ? " cc-chip-on" : ""));
    chip.href = "#"; chip.innerHTML = '<span class="cc-ico">⛓</span><span class="cc-chip-txt"></span>';
    chip.querySelector(".cc-chip-txt").textContent = depsTxt(node);
    chip.title = "start order for " + name;
    chip.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openEditor(chip, name); });
    return chip;
  }
  function lastRunPill(name) { var lr = lastRun[name]; if (!lr) return null; var p = el("span", "cc-pill cc-pill-" + lr.state, lr.state); p.title = lr.reason || ""; return p; }
  function doAction(name, action) {
    flash(action + " " + name + "…");
    api("POST", "action", { name: name, action: action }).then(function () { return load(); }).then(function () { flash("done"); }).catch(function (e) { flash("Error: " + e.message, true); });
  }
  function actionBtn(label, name, action, primary) { var b = el("button", "cc-abtn" + (primary ? " cc-abtn-primary" : ""), label); b.addEventListener("click", function (e) { e.stopPropagation(); doAction(name, action); }); return b; }

  // ───────────────────────── LIST mode: beautify native rows
  function tagRows() {
    if (mode !== "list") return;
    findRows().forEach(function (tr) {
      var name = rowName(tr), c = containerByName(name);
      if (filterText) tr.style.display = (norm(name).indexOf(filterText) >= 0) ? "" : "none";
      var cell = findUpdateCell(tr);
      if (!cell || cell.getAttribute(MARK) || !c) return;
      cell.setAttribute(MARK, "1");
      var box = el("div", "cc-cell");
      box.appendChild(stateBadge(c));
      box.appendChild(depsChip(name));
      var p = lastRunPill(name); if (p) box.appendChild(p);
      cell.appendChild(box);
    });
  }
  function untagRows() {
    Array.prototype.slice.call(document.querySelectorAll("[" + MARK + "]")).forEach(function (cell) {
      cell.removeAttribute(MARK); var c = cell.querySelector(".cc-cell"); if (c) c.remove();
    });
  }

  // ───────────────────────── GRID mode: card grid
  function card(c) {
    var wrap = el("div", "cc-card"); wrap.dataset.name = c.name;
    var head = el("div", "cc-card-head");
    var ico = iconFor(c.name);
    if (ico) { var im = el("img", "cc-card-ico"); im.src = ico; im.onerror = function () { this.style.visibility = "hidden"; }; head.appendChild(im); }
    else head.appendChild(el("div", "cc-card-ico cc-card-ico-ph"));
    var nb = el("div", "cc-card-name"); nb.appendChild(el("div", "cc-card-title", c.name)); nb.appendChild(el("div", "cc-card-img", c.image || "")); head.appendChild(nb);
    head.appendChild(stateBadge(c)); wrap.appendChild(head);
    var st = stats[c.name], sb = el("div", "cc-card-stats");
    if (st && c.state === "running") { sb.appendChild(gauge("CPU", st.cpu_percent, (st.cpu_percent || 0) + "%")); sb.appendChild(gauge("RAM", st.mem_percent, humanBytes(st.mem_used) + " / " + humanBytes(st.mem_limit))); }
    else sb.appendChild(el("div", "cc-stat cc-dim", c.state === "running" ? "…" : "not running"));
    wrap.appendChild(sb);
    var act = el("div", "cc-card-actions");
    if (c.state === "running") { act.appendChild(actionBtn("Stop", c.name, "stop")); act.appendChild(actionBtn("Restart", c.name, "restart")); act.appendChild(actionBtn("Pause", c.name, "pause")); }
    else if (c.state === "paused") { act.appendChild(actionBtn("Resume", c.name, "unpause", true)); act.appendChild(actionBtn("Stop", c.name, "stop")); }
    else act.appendChild(actionBtn("Start", c.name, "start", true));
    act.appendChild(depsChip(c.name));
    var p = lastRunPill(c.name); if (p) act.appendChild(p);
    wrap.appendChild(act);
    if (filterText && norm(c.name).indexOf(filterText) < 0) wrap.style.display = "none";
    return wrap;
  }
  function renderGrid() {
    gridHolder.innerHTML = "";
    var grid = el("div", "cc-grid");
    containers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) { grid.appendChild(card(c)); });
    gridHolder.appendChild(grid);
  }

  // ───────────────────────── toolbar + mode
  function renderToolbar() {
    mount.className = "cc-root"; mount.innerHTML = "";
    var bar = el("div", "cc-bar");
    bar.appendChild(el("span", "cc-title", "CannonadeCommander"));
    statusEl = el("span", "cc-status cc-ok-text", "engine up · " + containers.length); bar.appendChild(statusEl);
    bar.appendChild(el("span", "cc-spacer"));

    var seg = el("div", "cc-seg");
    var bList = el("button", "cc-seg-btn" + (mode === "list" ? " cc-seg-on" : ""), "List");
    var bGrid = el("button", "cc-seg-btn" + (mode === "grid" ? " cc-seg-on" : ""), "Grid");
    bList.addEventListener("click", function () { setMode("list"); });
    bGrid.addEventListener("click", function () { setMode("grid"); });
    seg.appendChild(bList); seg.appendChild(bGrid); bar.appendChild(seg);

    var filter = el("input", "cc-filter"); filter.type = "text"; filter.placeholder = "filter…"; filter.value = filterText;
    filter.addEventListener("input", function () { filterText = norm(filter.value); applyFilter(); });
    bar.appendChild(filter);
    var save = el("button", "cc-btn", "Save plan"), fire = el("button", "cc-btn cc-btn-primary", "Start in order");
    save.addEventListener("click", function () { savePlan(false); }); fire.addEventListener("click", function () { savePlan(true); });
    bar.appendChild(save); bar.appendChild(fire);
    mount.appendChild(bar);

    gridHolder = el("div", "cc-grid-holder"); mount.appendChild(gridHolder);

    var dl = document.getElementById("cc-names");
    if (!dl) { dl = el("datalist"); dl.id = "cc-names"; document.body.appendChild(dl); }
    dl.innerHTML = ""; containerNames.forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
  }
  function setMode(m) { mode = m; localStorage.setItem(VIEW_KEY, m); renderToolbar(); applyMode(); }
  function applyMode() {
    if (mode === "grid") { hideNative(true); untagRows(); renderGrid(); }
    else { hideNative(false); if (gridHolder) gridHolder.innerHTML = ""; tagRows(); }
  }
  function applyFilter() {
    if (mode === "grid") {
      if (!gridHolder) return;
      Array.prototype.slice.call(gridHolder.querySelectorAll(".cc-card")).forEach(function (cd) { cd.style.display = (!filterText || norm(cd.dataset.name).indexOf(filterText) >= 0) ? "" : "none"; });
    } else {
      findRows().forEach(function (tr) { tr.style.display = (!filterText || norm(rowName(tr)).indexOf(filterText) >= 0) ? "" : "none"; });
    }
  }
  function refreshStats() {
    if (mode !== "grid") return;
    api("GET", "stats").then(function (m) {
      stats = m || {}; if (!gridHolder) return;
      Array.prototype.slice.call(gridHolder.querySelectorAll(".cc-card")).forEach(function (cd) {
        var st = stats[cd.dataset.name]; if (!st) return;
        var fills = cd.querySelectorAll(".cc-gauge-fill"), vals = cd.querySelectorAll(".cc-stat-val");
        if (fills[0]) fills[0].style.width = Math.min(100, st.cpu_percent) + "%"; if (vals[0]) vals[0].textContent = (st.cpu_percent || 0) + "%";
        if (fills[1]) fills[1].style.width = Math.min(100, st.mem_percent) + "%"; if (vals[1]) vals[1].textContent = humanBytes(st.mem_used) + " / " + humanBytes(st.mem_limit);
      });
    }).catch(function () {});
  }

  // ───────────────────────── plan editor popover
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }
  function refreshChip(chip, name) { var node = workingPlan[name]; chip.classList.toggle("cc-chip-on", !!node); chip.querySelector(".cc-chip-txt").textContent = depsTxt(node); }
  function openEditor(anchor, name) {
    closePop();
    var existing = workingPlan[name], node = existing || { name: name, after: [], probe: { kind: "health" }, policy: "abort" };
    var pop = el("div", "cc-pop"), head = el("div", "cc-pop-head"); head.appendChild(el("b", null, name));
    var x = el("span", "cc-pop-x", "✕"); x.addEventListener("click", closePop); head.appendChild(x); pop.appendChild(head);
    var mrow = el("label", "cc-pop-row"), manage = el("input"); manage.type = "checkbox"; manage.checked = !!existing;
    mrow.appendChild(manage); mrow.appendChild(el("span", null, " Manage in the start plan")); pop.appendChild(mrow);
    var body = el("div", "cc-pop-body" + (existing ? "" : " cc-dis"));
    var arow = el("div", "cc-pop-row"); arow.appendChild(el("label", "cc-pop-lbl", "Depends on"));
    var after = el("input", "cc-in"); after.type = "text"; after.setAttribute("list", "cc-names"); after.placeholder = "comma-separated"; after.value = (node.after || []).join(", "); arow.appendChild(after); body.appendChild(arow);
    var prow = el("div", "cc-pop-row"); prow.appendChild(el("label", "cc-pop-lbl", "Ready when"));
    var probe = el("select", "cc-in"); PROBES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.probe && node.probe.kind === p) o.selected = true; probe.appendChild(o); });
    var port = el("input", "cc-in cc-port"); port.type = "number"; port.placeholder = "port"; port.value = (node.probe && node.probe.port) ? node.probe.port : "";
    var syncPort = function () { port.style.display = probe.value === "tcp" ? "" : "none"; }; syncPort();
    prow.appendChild(probe); prow.appendChild(port); body.appendChild(prow);
    var polrow = el("div", "cc-pop-row"); polrow.appendChild(el("label", "cc-pop-lbl", "On fail"));
    var pol = el("select", "cc-in"); POLICIES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.policy === p) o.selected = true; pol.appendChild(o); });
    polrow.appendChild(pol); body.appendChild(polrow); pop.appendChild(body);
    pop.appendChild(el("div", "cc-pop-foot", "abort skips dependents · continue/degrade start them anyway. Save plan to persist."));
    function commit() {
      if (!manage.checked) { delete workingPlan[name]; body.classList.add("cc-dis"); refreshChip(anchor, name); return; }
      body.classList.remove("cc-dis");
      var afterList = after.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var pr = { kind: probe.value }, pv = parseInt(port.value, 10);
      if (probe.value === "tcp" && pv > 0) pr.port = pv; if (probe.value === "running") pr.grace_seconds = 3;
      workingPlan[name] = { name: name, after: afterList, probe: pr, policy: pol.value }; refreshChip(anchor, name);
    }
    manage.addEventListener("change", commit);
    [after, probe, port, pol].forEach(function (n) { n.addEventListener("change", commit); n.addEventListener("input", commit); });
    probe.addEventListener("change", syncPort);
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect(), w = pop.offsetWidth || 320;
    var left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - w - 12);
    pop.style.left = Math.max(window.scrollX + 8, left) + "px"; pop.style.top = (window.scrollY + r.bottom + 6) + "px"; openPop = pop;
  }

  // ───────────────────────── save / apply
  function collectPlan() { var nodes = []; Object.keys(workingPlan).forEach(function (k) { nodes.push(workingPlan[k]); }); return { nodes: nodes }; }
  function savePlan(thenApply) { flash("Saving…"); api("PUT", "plan", collectPlan()).then(function () { if (thenApply) return apply(); flash("Plan saved"); }).catch(function (e) { flash("Error: " + e.message, true); }); }
  function apply() { flash("Starting in order…"); return api("POST", "apply").then(function () { return load(); }).then(function () { flash("Started in order"); }).catch(function (e) { flash("Error: " + e.message, true); }); }
  function flash(msg, bad) { if (statusEl) { statusEl.textContent = msg; statusEl.className = "cc-status " + (bad ? "cc-bad-text" : "cc-ok-text"); } }

  // ───────────────────────── run
  function ensureMount() {
    mount = document.getElementById("cannonade-root");
    if (!mount) { mount = el("div"); mount.id = "cannonade-root"; document.body.appendChild(mount); }
    var t = nativeTable();
    if (t && t.parentNode && mount.nextSibling !== t) { try { t.parentNode.insertBefore(mount, t); } catch (e) {} }
  }
  function load() {
    return api("GET", "state").then(function (state) {
      indexState(state); renderToolbar(); applyMode();
      if (mode === "grid") refreshStats();
      if (state && state.docker_error) flash("engine up · docker: " + state.docker_error, true);
    }).catch(function (e) {
      if (!mount) return; mount.className = "cc-root"; mount.innerHTML = "";
      mount.appendChild(el("div", "cc-bar", "CannonadeCommander engine unreachable: " + e.message));
    });
  }
  function boot() {
    ensureMount(); load();
    var mo = new MutationObserver(function () { if (mode === "list") tagRows(); });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    setInterval(function () { if (!openPop && mode === "grid") refreshStats(); }, 3000);
    setInterval(function () { if (!openPop) load(); }, 8000);
    document.addEventListener("click", function (e) { if (openPop && !openPop.contains(e.target) && !e.target.closest(".cc-chip")) closePop(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
