/* CannonadeCommander - Docker-tab integration.
 *
 * Injects into Unraid's NATIVE Docker container list: each row gets a state
 * badge and a "chain" chip that opens a compact editor for that container's
 * start dependencies, readiness probe and failure policy. A slim toolbar above
 * the list saves the plan and fires it in order. If the native rows can't be
 * found (unknown skin), it falls back to a self-contained panel.
 *
 * The browser only ever talks to a same-origin PHP proxy; it never touches the
 * Docker socket.
 */
(function () {
  "use strict";

  var PROXY = "/plugins/cannonadecommander/server/api.php";
  var MARK = "data-cc";
  var PROBES = ["health", "running", "tcp"];
  var POLICIES = ["abort", "continue", "degrade"];
  var UPDATE_PHRASES = [
    "aktualisierung", "auf dem neu", "nicht verf", "wird gepr", "up-to-date",
    "up to date", "update ready", "apply update", "rebuild ready",
  ];

  var containers = [];       // from /api/state
  var containerNames = [];   // sorted names, for the datalist
  var workingPlan = {};      // name -> node (the editable plan)
  var lastRun = {};          // name -> run result
  var statusEl = null;
  var openPop = null;

  // ─────────────────────────────────────────── api + helpers
  function api(method, path, body) {
    var opts = { method: method, headers: { Accept: "application/json" } };
    if (body != null) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(PROXY + "?path=" + encodeURIComponent(path), opts).then(function (r) {
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
        if (!r.ok) throw new Error((data && data.error) ? data.error : "HTTP " + r.status);
        return data;
      });
    });
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function norm(s) { return String(s || "").trim().toLowerCase(); }

  function stateBadge(c) {
    var s = (c && c.state) || "unknown";
    var b = el("span", "cc-badge cc-badge-" + s, s);
    if (c && c.health === "unhealthy") { b.classList.add("cc-badge-alert"); b.textContent = s + " ✕"; }
    else if (c && c.health === "starting") { b.textContent = s + " …"; }
    return b;
  }

  // ─────────────────────────────────────────── native row finder (ShipLog, proven)
  function isFolderHeader(tr) {
    return !!(tr.classList.contains("folder") ||
      tr.querySelector(":scope > td.folder-name, :scope > td.folder-update"));
  }
  function findRows() {
    var candidates = [
      "#docker_list tr.sortable, #docker_list tr.folder-element",
      "#docker_list > tr",
      "table#docker_containers tbody tr",
      "table.tablesorter tbody tr",
      "div.tabs table tbody tr",
      "table tbody tr",
    ];
    for (var i = 0; i < candidates.length; i++) {
      var rows = Array.prototype.slice.call(document.querySelectorAll(candidates[i])).filter(function (tr) {
        return !isFolderHeader(tr) &&
          (tr.querySelector("td.ct-name, td.updatecolumn") ||
            (tr.querySelector("img") && tr.textContent.trim().length > 1));
      });
      if (rows.length) return rows;
    }
    return [];
  }
  function rowName(tr) {
    var appname = tr.querySelector("td.ct-name .appname");
    if (appname && appname.textContent.trim()) return appname.textContent.trim().slice(0, 60);
    var id = tr.id || "";
    if (/^ct-/.test(id)) return id.slice(3).slice(0, 60);
    var img = tr.querySelector("img");
    var cell = img ? (img.closest("td") || tr) : tr;
    var a = cell.querySelector("a");
    var name = a && a.textContent.trim()
      ? a.textContent.trim()
      : (cell.textContent || tr.textContent).trim().split("\n")[0].trim();
    return name.slice(0, 60);
  }
  function findUpdateCell(tr) {
    var direct = tr.querySelector("td.updatecolumn:not(.folder-update)");
    if (direct) return direct;
    var cells = Array.prototype.slice.call(tr.querySelectorAll("td"));
    for (var i = 0; i < cells.length; i++) {
      var td = cells[i], txt = td.textContent.toLowerCase();
      for (var j = 0; j < UPDATE_PHRASES.length; j++) if (txt.indexOf(UPDATE_PHRASES[j]) >= 0) return td;
    }
    return cells[cells.length - 1] || tr;
  }

  // ─────────────────────────────────────────── data
  function indexState(state) {
    containers = (state && state.containers) || [];
    containerNames = containers.map(function (c) { return c.name; }).sort();
    workingPlan = {};
    if (state && state.plan && state.plan.nodes) state.plan.nodes.forEach(function (n) { workingPlan[n.name] = n; });
    lastRun = {};
    if (state && state.last_run && state.last_run.nodes) state.last_run.nodes.forEach(function (r) { lastRun[r.name] = r; });
  }
  function containerByName(name) {
    var k = norm(name);
    for (var i = 0; i < containers.length; i++) if (norm(containers[i].name) === k) return containers[i];
    return null;
  }
  function depsSummary(node) {
    if (node && node.after && node.after.length) return "after " + node.after.join(", ");
    return "in plan";
  }

  // ─────────────────────────────────────────── toolbar
  function renderToolbar(mount) {
    mount.className = "cc-bar";
    mount.innerHTML = "";
    mount.appendChild(el("span", "cc-title", "CannonadeCommander"));
    statusEl = el("span", "cc-status cc-ok-text", "engine up · " + containers.length + " containers");
    mount.appendChild(statusEl);
    mount.appendChild(el("span", "cc-spacer"));
    var save = el("button", "cc-btn", "Save plan");
    var fire = el("button", "cc-btn cc-btn-primary", "Start in order");
    save.addEventListener("click", function () { savePlan(false); });
    fire.addEventListener("click", function () { savePlan(true); });
    mount.appendChild(save);
    mount.appendChild(fire);

    var dl = document.getElementById("cc-names");
    if (!dl) {
      dl = el("datalist"); dl.id = "cc-names";
      document.body.appendChild(dl);
    }
    dl.innerHTML = "";
    containerNames.forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
  }

  // ─────────────────────────────────────────── per-row injection
  function tagRows() {
    var rows = findRows(), n = 0;
    rows.forEach(function (tr) {
      var cell = findUpdateCell(tr);
      if (!cell || cell.getAttribute(MARK)) return;
      var name = rowName(tr);
      var c = containerByName(name);
      if (!c) return; // engine doesn't know this row (rare) → leave native row untouched
      cell.setAttribute(MARK, "1");
      cell.appendChild(buildRowControl(name, c));
      n++;
    });
    return n;
  }
  function buildRowControl(name, c) {
    var box = el("div", "cc-cell");
    box.appendChild(stateBadge(c));
    var node = workingPlan[name];
    var chip = el("a", "cc-chip" + (node ? " cc-chip-on" : ""));
    chip.href = "#";
    chip.innerHTML = '<span class="cc-ico">⛓</span><span class="cc-chip-txt"></span>';
    chip.querySelector(".cc-chip-txt").textContent = node ? depsSummary(node) : "plan";
    chip.title = "CannonadeCommander: start order for " + name;
    chip.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openEditor(chip, name); });
    box.appendChild(chip);
    var lr = lastRun[name];
    if (lr) {
      var pill = el("span", "cc-pill cc-pill-" + lr.state, lr.state);
      pill.title = lr.reason || "";
      box.appendChild(pill);
    }
    return box;
  }
  // Clear our injected controls so a refresh re-renders badges + last-run.
  function untag() {
    Array.prototype.slice.call(document.querySelectorAll("[" + MARK + "]")).forEach(function (cell) {
      cell.removeAttribute(MARK);
      var c = cell.querySelector(".cc-cell");
      if (c) c.remove();
    });
  }
  function refreshChip(chip, name) {
    var node = workingPlan[name];
    chip.classList.toggle("cc-chip-on", !!node);
    chip.querySelector(".cc-chip-txt").textContent = node ? depsSummary(node) : "plan";
  }

  // ─────────────────────────────────────────── per-container editor popover
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }

  function openEditor(anchor, name) {
    closePop();
    var existing = workingPlan[name];
    var node = existing || { name: name, after: [], probe: { kind: "health" }, policy: "abort" };

    var pop = el("div", "cc-pop");
    var head = el("div", "cc-pop-head");
    head.appendChild(el("b", null, name));
    var x = el("span", "cc-pop-x", "✕");
    x.addEventListener("click", closePop);
    head.appendChild(x);
    pop.appendChild(head);

    var manageRow = el("label", "cc-pop-row");
    var manage = el("input"); manage.type = "checkbox"; manage.checked = !!existing;
    manageRow.appendChild(manage);
    manageRow.appendChild(el("span", null, " Manage this container in the start plan"));
    pop.appendChild(manageRow);

    var body = el("div", "cc-pop-body" + (existing ? "" : " cc-dis"));

    var afterRow = el("div", "cc-pop-row");
    afterRow.appendChild(el("label", "cc-pop-lbl", "Depends on (after)"));
    var after = el("input", "cc-in"); after.type = "text"; after.setAttribute("list", "cc-names");
    after.placeholder = "comma-separated container names";
    after.value = (node.after || []).join(", ");
    afterRow.appendChild(after);
    body.appendChild(afterRow);

    var probeRow = el("div", "cc-pop-row");
    probeRow.appendChild(el("label", "cc-pop-lbl", "Ready when"));
    var probe = el("select", "cc-in");
    PROBES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.probe && node.probe.kind === p) o.selected = true; probe.appendChild(o); });
    var port = el("input", "cc-in cc-port"); port.type = "number"; port.placeholder = "port";
    port.value = (node.probe && node.probe.port) ? node.probe.port : "";
    var syncPort = function () { port.style.display = probe.value === "tcp" ? "" : "none"; };
    syncPort();
    probeRow.appendChild(probe); probeRow.appendChild(port);
    body.appendChild(probeRow);

    var polRow = el("div", "cc-pop-row");
    polRow.appendChild(el("label", "cc-pop-lbl", "On fail"));
    var pol = el("select", "cc-in");
    POLICIES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.policy === p) o.selected = true; pol.appendChild(o); });
    polRow.appendChild(pol);
    body.appendChild(polRow);

    pop.appendChild(body);
    pop.appendChild(el("div", "cc-pop-foot", "abort skips dependents · continue/degrade start them anyway. Changes apply on Save plan."));

    function commit() {
      if (!manage.checked) { delete workingPlan[name]; body.classList.add("cc-dis"); refreshChip(anchor, name); return; }
      body.classList.remove("cc-dis");
      var afterList = after.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var pr = { kind: probe.value };
      var pv = parseInt(port.value, 10);
      if (probe.value === "tcp" && pv > 0) pr.port = pv;
      if (probe.value === "running") pr.grace_seconds = 3;
      workingPlan[name] = { name: name, after: afterList, probe: pr, policy: pol.value };
      refreshChip(anchor, name);
    }
    manage.addEventListener("change", function () { if (manage.checked && !workingPlan[name]) commit(); else commit(); });
    [after, probe, port, pol].forEach(function (n) { n.addEventListener("change", commit); n.addEventListener("input", commit); });
    probe.addEventListener("change", syncPort);

    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    var w = pop.offsetWidth || 320;
    var left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - w - 12);
    pop.style.left = Math.max(window.scrollX + 8, left) + "px";
    pop.style.top = (window.scrollY + r.bottom + 6) + "px";
    openPop = pop;
  }

  // ─────────────────────────────────────────── save / apply
  function collectPlan() {
    var nodes = [];
    Object.keys(workingPlan).forEach(function (k) { nodes.push(workingPlan[k]); });
    return { nodes: nodes };
  }
  function savePlan(thenApply) {
    flash("Saving…");
    api("PUT", "plan", collectPlan()).then(function () {
      if (thenApply) return apply();
      flash("Plan saved");
    }).catch(function (e) { flash("Error: " + e.message, true); });
  }
  function apply() {
    flash("Starting in order…");
    return api("POST", "apply").then(function () { return load(); }).then(function () { flash("Started in order"); })
      .catch(function (e) { flash("Error: " + e.message, true); });
  }
  function flash(msg, bad) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "cc-status " + (bad ? "cc-bad-text" : "cc-ok-text");
  }

  // ─────────────────────────────────────────── fallback panel (no native rows)
  function renderFallback(mount) {
    var panel = el("div", "cc-panel");
    var tbl = el("table", "cc-table");
    var thead = el("thead"), hr = el("tr");
    ["Container", "State", "Depends on", "Plan"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = el("tbody");
    containers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", "cc-name", c.name));
      var st = el("td"); st.appendChild(stateBadge(c)); tr.appendChild(st);
      var node = workingPlan[c.name];
      tr.appendChild(el("td", "cc-dim", node ? depsSummary(node) : "—"));
      var chipTd = el("td");
      var chip = el("a", "cc-chip" + (node ? " cc-chip-on" : ""));
      chip.href = "#"; chip.innerHTML = '<span class="cc-ico">⛓</span><span class="cc-chip-txt">' + (node ? "edit" : "plan") + "</span>";
      chip.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openEditor(chip, c.name); });
      chipTd.appendChild(chip); tr.appendChild(chipTd);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); panel.appendChild(tbl);
    mount.appendChild(panel);
  }

  // ─────────────────────────────────────────── run
  var mount;
  function ensureMount() {
    mount = document.getElementById("cannonade-root");
    if (mount) return;
    mount = el("div"); mount.id = "cannonade-root";
    var host = document.getElementById("docker_containers") || document.querySelector(".tabs") || document.body;
    if (host.parentNode) host.parentNode.insertBefore(mount, host); else host.appendChild(mount);
  }
  function load() {
    return api("GET", "state").then(function (state) {
      indexState(state);
      renderToolbar(mount);
      untag();
      var n = tagRows();
      if (n === 0) renderFallback(mount);
      if (statusEl && state.docker_error) flash("engine up (docker: " + state.docker_error + ")", true);
    }).catch(function (e) {
      mount.className = "cc-bar";
      mount.innerHTML = "";
      mount.appendChild(el("span", "cc-bad-text", "CannonadeCommander engine unreachable: " + e.message));
    });
  }

  function boot() {
    ensureMount();
    load();
    var mo = new MutationObserver(function () { tagRows(); });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    document.addEventListener("click", function (e) {
      if (openPop && !openPop.contains(e.target) && !e.target.closest(".cc-chip")) closePop();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
