/* CannonadeCommander - a modern, card-style Docker manager for Unraid.
 *
 * Replaces Unraid's dated container table with a clean card grid rendered from
 * the host supervisor: per container a state badge, live CPU/RAM gauges, health,
 * lifecycle actions (start/stop/restart/pause), and the dependency-ordered,
 * health-gated start plan. The native table is hidden (kept in the DOM so its
 * container icons can be reused). The browser only ever talks to a same-origin
 * PHP proxy; it never touches the Docker socket.
 */
(function () {
  "use strict";

  var PROXY = "/plugins/cannonadecommander/server/api.php";
  var PROBES = ["health", "running", "tcp"];
  var POLICIES = ["abort", "continue", "degrade"];

  var containers = [];
  var containerNames = [];
  var stats = {};
  var workingPlan = {};
  var lastRun = {};
  var iconCache = {};
  var filterText = "";
  var statusEl = null;
  var gridEl = null;
  var openPop = null;

  // ───────────────────────────────── api + helpers
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
  function humanBytes(b) {
    if (!b) return "0";
    var u = ["B", "K", "M", "G", "T"], i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10) + u[i];
  }

  // Grab the container's icon from Unraid's (now hidden) native row.
  function iconFor(name) {
    if (iconCache[name] !== undefined) return iconCache[name];
    var src = "";
    var row = document.getElementById("ct-" + name);
    var img = row && row.querySelector("img");
    if (!img) {
      var all = document.querySelectorAll("#docker_containers img, #docker_list img");
      for (var i = 0; i < all.length; i++) {
        var tr = all[i].closest("tr");
        if (tr && norm(rowName(tr)) === norm(name)) { img = all[i]; break; }
      }
    }
    if (img) src = img.getAttribute("src") || "";
    iconCache[name] = src;
    return src;
  }
  function rowName(tr) {
    var appname = tr.querySelector("td.ct-name .appname");
    if (appname && appname.textContent.trim()) return appname.textContent.trim();
    var id = tr.id || "";
    if (/^ct-/.test(id)) return id.slice(3);
    return "";
  }

  // ───────────────────────────────── data
  function indexState(state) {
    containers = (state && state.containers) || [];
    containerNames = containers.map(function (c) { return c.name; }).sort();
    workingPlan = {};
    if (state && state.plan && state.plan.nodes) state.plan.nodes.forEach(function (n) { workingPlan[n.name] = n; });
    lastRun = {};
    if (state && state.last_run && state.last_run.nodes) state.last_run.nodes.forEach(function (r) { lastRun[r.name] = r; });
  }

  // Hide Unraid's native container table; keep it in the DOM for its icons.
  function hideNative() {
    ["#docker_containers", "table#docker_containers", "#docker_list"].forEach(function (sel) {
      var n = document.querySelector(sel);
      var t = n && (n.tagName === "TABLE" ? n : n.closest("table"));
      if (t) t.style.display = "none";
    });
  }

  // ───────────────────────────────── badges + gauges
  function stateBadge(c) {
    var s = (c && c.state) || "unknown";
    var b = el("span", "cc-badge cc-badge-" + s, s);
    if (c && c.health === "unhealthy") { b.classList.add("cc-badge-alert"); b.textContent = s + " ✕"; }
    else if (c && c.health === "starting") b.textContent = s + " …";
    return b;
  }
  function gauge(label, pct, right) {
    var wrap = el("div", "cc-stat");
    wrap.appendChild(el("span", "cc-stat-lbl", label));
    var bar = el("div", "cc-gauge");
    var fill = el("div", "cc-gauge-fill" + (pct >= 90 ? " cc-hot" : ""));
    fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    bar.appendChild(fill);
    wrap.appendChild(bar);
    wrap.appendChild(el("span", "cc-stat-val", right));
    return wrap;
  }

  // ───────────────────────────────── actions
  function doAction(name, action) {
    flash(action + " " + name + "…");
    api("POST", "action", { name: name, action: action })
      .then(function () { return load(); })
      .then(function () { flash("done"); })
      .catch(function (e) { flash("Error: " + e.message, true); });
  }
  function actionBtn(label, name, action, primary) {
    var b = el("button", "cc-abtn" + (primary ? " cc-abtn-primary" : ""), label);
    b.addEventListener("click", function (e) { e.stopPropagation(); doAction(name, action); });
    return b;
  }

  // ───────────────────────────────── card
  function card(c) {
    var wrap = el("div", "cc-card");
    wrap.dataset.name = c.name;

    var head = el("div", "cc-card-head");
    var ico = iconFor(c.name);
    if (ico) { var im = el("img", "cc-card-ico"); im.src = ico; im.onerror = function () { this.style.visibility = "hidden"; }; head.appendChild(im); }
    else head.appendChild(el("div", "cc-card-ico cc-card-ico-ph"));
    var nameBox = el("div", "cc-card-name");
    nameBox.appendChild(el("div", "cc-card-title", c.name));
    nameBox.appendChild(el("div", "cc-card-img", c.image || ""));
    head.appendChild(nameBox);
    head.appendChild(stateBadge(c));
    wrap.appendChild(head);

    var st = stats[c.name];
    var statsBox = el("div", "cc-card-stats");
    if (st && c.state === "running") {
      statsBox.appendChild(gauge("CPU", st.cpu_percent, (st.cpu_percent || 0) + "%"));
      statsBox.appendChild(gauge("RAM", st.mem_percent, humanBytes(st.mem_used) + " / " + humanBytes(st.mem_limit)));
    } else {
      statsBox.appendChild(el("div", "cc-stat cc-dim", c.state === "running" ? "…" : "not running"));
    }
    wrap.appendChild(statsBox);

    var actions = el("div", "cc-card-actions");
    if (c.state === "running") {
      actions.appendChild(actionBtn("Stop", c.name, "stop"));
      actions.appendChild(actionBtn("Restart", c.name, "restart"));
      actions.appendChild(actionBtn("Pause", c.name, "pause"));
    } else if (c.state === "paused") {
      actions.appendChild(actionBtn("Resume", c.name, "unpause", true));
      actions.appendChild(actionBtn("Stop", c.name, "stop"));
    } else {
      actions.appendChild(actionBtn("Start", c.name, "start", true));
    }
    var node = workingPlan[c.name];
    var chip = el("a", "cc-chip" + (node ? " cc-chip-on" : ""));
    chip.href = "#";
    chip.innerHTML = '<span class="cc-ico">⛓</span><span class="cc-chip-txt"></span>';
    chip.querySelector(".cc-chip-txt").textContent = node ? (node.after && node.after.length ? "after " + node.after.join(", ") : "in plan") : "plan";
    chip.title = "start order for " + c.name;
    chip.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openEditor(chip, c.name); });
    actions.appendChild(chip);

    var lr = lastRun[c.name];
    if (lr) { var pill = el("span", "cc-pill cc-pill-" + lr.state, lr.state); pill.title = lr.reason || ""; actions.appendChild(pill); }
    wrap.appendChild(actions);

    if (filterText && norm(c.name).indexOf(filterText) < 0 && norm(c.image).indexOf(filterText) < 0) wrap.style.display = "none";
    return wrap;
  }

  // ───────────────────────────────── render
  var mount;
  function render(state) {
    if (state && state.docker_error) flash("engine up · docker: " + state.docker_error, true);
    mount.className = "cc-root";
    mount.innerHTML = "";

    var bar = el("div", "cc-bar");
    bar.appendChild(el("span", "cc-title", "CannonadeCommander"));
    statusEl = el("span", "cc-status cc-ok-text", "engine up · " + containers.length + " containers");
    bar.appendChild(statusEl);
    bar.appendChild(el("span", "cc-spacer"));
    var filter = el("input", "cc-filter"); filter.type = "text"; filter.placeholder = "filter…"; filter.value = filterText;
    filter.addEventListener("input", function () { filterText = norm(filter.value); applyFilter(); });
    bar.appendChild(filter);
    var save = el("button", "cc-btn", "Save plan");
    var fire = el("button", "cc-btn cc-btn-primary", "Start in order");
    save.addEventListener("click", function () { savePlan(false); });
    fire.addEventListener("click", function () { savePlan(true); });
    bar.appendChild(save); bar.appendChild(fire);
    mount.appendChild(bar);

    gridEl = el("div", "cc-grid");
    containers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) { gridEl.appendChild(card(c)); });
    mount.appendChild(gridEl);

    var dl = document.getElementById("cc-names");
    if (!dl) { dl = el("datalist"); dl.id = "cc-names"; document.body.appendChild(dl); }
    dl.innerHTML = "";
    containerNames.forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
  }
  function applyFilter() {
    if (!gridEl) return;
    Array.prototype.slice.call(gridEl.children).forEach(function (cd) {
      var n = norm(cd.dataset.name);
      cd.style.display = (!filterText || n.indexOf(filterText) >= 0) ? "" : "none";
    });
  }
  function refreshStats() {
    api("GET", "stats").then(function (m) {
      stats = m || {};
      if (!gridEl) return;
      Array.prototype.slice.call(gridEl.children).forEach(function (cd) {
        var name = cd.dataset.name, st = stats[name];
        var box = cd.querySelector(".cc-card-stats");
        if (!box || !st) return;
        var fills = cd.querySelectorAll(".cc-gauge-fill");
        var vals = cd.querySelectorAll(".cc-stat-val");
        if (fills[0]) fills[0].style.width = Math.min(100, st.cpu_percent) + "%";
        if (vals[0]) vals[0].textContent = (st.cpu_percent || 0) + "%";
        if (fills[1]) fills[1].style.width = Math.min(100, st.mem_percent) + "%";
        if (vals[1]) vals[1].textContent = humanBytes(st.mem_used) + " / " + humanBytes(st.mem_limit);
      });
    }).catch(function () {});
  }

  // ───────────────────────────────── plan editor popover
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }
  function refreshChip(chip, name) {
    var node = workingPlan[name];
    chip.classList.toggle("cc-chip-on", !!node);
    chip.querySelector(".cc-chip-txt").textContent = node ? (node.after && node.after.length ? "after " + node.after.join(", ") : "in plan") : "plan";
  }
  function openEditor(anchor, name) {
    closePop();
    var existing = workingPlan[name];
    var node = existing || { name: name, after: [], probe: { kind: "health" }, policy: "abort" };
    var pop = el("div", "cc-pop");
    var head = el("div", "cc-pop-head"); head.appendChild(el("b", null, name));
    var x = el("span", "cc-pop-x", "✕"); x.addEventListener("click", closePop); head.appendChild(x); pop.appendChild(head);

    var manageRow = el("label", "cc-pop-row");
    var manage = el("input"); manage.type = "checkbox"; manage.checked = !!existing;
    manageRow.appendChild(manage); manageRow.appendChild(el("span", null, " Manage in the start plan")); pop.appendChild(manageRow);

    var body = el("div", "cc-pop-body" + (existing ? "" : " cc-dis"));
    var afterRow = el("div", "cc-pop-row"); afterRow.appendChild(el("label", "cc-pop-lbl", "Depends on"));
    var after = el("input", "cc-in"); after.type = "text"; after.setAttribute("list", "cc-names"); after.placeholder = "comma-separated";
    after.value = (node.after || []).join(", "); afterRow.appendChild(after); body.appendChild(afterRow);

    var probeRow = el("div", "cc-pop-row"); probeRow.appendChild(el("label", "cc-pop-lbl", "Ready when"));
    var probe = el("select", "cc-in");
    PROBES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.probe && node.probe.kind === p) o.selected = true; probe.appendChild(o); });
    var port = el("input", "cc-in cc-port"); port.type = "number"; port.placeholder = "port"; port.value = (node.probe && node.probe.port) ? node.probe.port : "";
    var syncPort = function () { port.style.display = probe.value === "tcp" ? "" : "none"; }; syncPort();
    probeRow.appendChild(probe); probeRow.appendChild(port); body.appendChild(probeRow);

    var polRow = el("div", "cc-pop-row"); polRow.appendChild(el("label", "cc-pop-lbl", "On fail"));
    var pol = el("select", "cc-in");
    POLICIES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.policy === p) o.selected = true; pol.appendChild(o); });
    polRow.appendChild(pol); body.appendChild(polRow);
    pop.appendChild(body);
    pop.appendChild(el("div", "cc-pop-foot", "abort skips dependents · continue/degrade start them anyway. Save plan to persist."));

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
    manage.addEventListener("change", commit);
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

  // ───────────────────────────────── save / apply
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
  function flash(msg, bad) { if (statusEl) { statusEl.textContent = msg; statusEl.className = "cc-status " + (bad ? "cc-bad-text" : "cc-ok-text"); } }

  // ───────────────────────────────── run
  function ensureMount() {
    mount = document.getElementById("cannonade-root");
    if (mount) return;
    mount = el("div"); mount.id = "cannonade-root";
    var host = document.getElementById("docker_containers") || document.querySelector(".tabs") || document.body;
    if (host && host.parentNode) host.parentNode.insertBefore(mount, host); else document.body.appendChild(mount);
  }
  function load() {
    hideNative();
    return api("GET", "state").then(function (state) {
      indexState(state);
      render(state);
      refreshStats();
    }).catch(function (e) {
      mount.className = "cc-root"; mount.innerHTML = "";
      mount.appendChild(el("div", "cc-bar", "CannonadeCommander engine unreachable: " + e.message));
    });
  }
  function boot() {
    ensureMount();
    load();
    setInterval(function () { if (!openPop) refreshStats(); }, 3000);
    setInterval(function () { if (!openPop) load(); }, 8000);
    document.addEventListener("click", function (e) {
      if (openPop && !openPop.contains(e.target) && !e.target.closest(".cc-chip")) closePop();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
