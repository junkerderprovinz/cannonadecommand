/* CannonadeCommand: restyles Unraid's Docker tab.
 *
 * Every datum in a native container row becomes a uniform badge, and the native clutter goes,
 * without a bar or section of CC's own. The CSS does the work: this file adds classes to the
 * persistent <table id=docker_containers> and docker.css restyles the native cells for the update
 * status, force update, image tag, network, IP, port, LAN and CPU/RAM into pills in place. The
 * native elements stay live, so Unraid's nchan websocket keeps the figures ticking, clickable and
 * sortable, with the .appname sort key untouched. The JS only adds a clickable start/stop badge,
 * the plan chip and the id and author badges per row, plus the gear in the table header that holds
 * the global controls.
 *
 * The selectors follow Unraid's own source, dynamix.docker.manager/include/DockerContainers.php
 * and DockerContainers.page.
 *
 * Everything is idempotent and wrapped in try/catch, and it removes itself: when the same-origin
 * proxy answers 404, the plugin is gone and the whole layer is torn down, so nothing lingers even
 * on a cached page. #docker_list, the tbody, is re-rendered wholesale every few seconds, so the
 * per-row injection is re-applied from a debounced MutationObserver, while the table and its
 * <thead> persist, which lets the classes and the header gear survive a re-render.
 */
(function () {
  "use strict";

  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var SHIPLOG = "/plugins/shiplog/server/status.php";
  var VIEW_KEY = "cc.view", COLS_KEY = "cc.colview2";
  var MARK = "data-cc", ROWMARK = "data-cc-row";
  // A filled gear, tabler-icons (MIT) icons/filled/settings.svg, inheriting currentColor so it
  // follows the colour mode like every other control. Tabler because the main nav bar uses its
  // filled set too, and lucide ships none. The centre hole is a reverse-wound subpath, which plain
  // fill-rule:nonzero knocks out, and it stays legible at the 12px this button renders.
  var CC_GEAR_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" aria-hidden="true"><path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" /></svg>';
  // The filled trash can belongs to cc-theme.js, like the (i) bubble there; the identical local
  // fallback covers a late or absent cc-theme.js, as elsewhere in this file.
  var CC_TRASH_SVG = (window.CCTheme && window.CCTheme.CC_TRASH_SVG) || '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007zm-10 4a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1m4 0a1 1 0 0 0 -1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0 -1 -1" /><path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005z" /></svg>';
  var PROBES = ["health", "running", "tcp", "http", "exec", "log"], POLICIES = ["abort", "continue", "degrade"];
  var SCHED_ACTIONS = ["start", "stop", "restart"];
  // Docker's four restart-policy names, in the order they appear in the editor dropdown.
  var RESTART_POLICIES = ["no", "unless-stopped", "always", "on-failure"];
  // With the adopt toggle on, the default, the Docker badges follow the global cc.accent;
  // otherwise they use the tab's own ccd.accent. The rainbow stays global and the icon tint and
  // density stay Docker-owned.
  function effc(k) { return localStorage.getItem("cc.styledocker") !== "0" ? localStorage.getItem("cc." + k) : localStorage.getItem("ccd." + k); }
  // Whether the icons follow the colour mode is a global decision, so it bypasses effc(): an area
  // using its own background and tint colours can still follow the rainbow, like one adopting the
  // global colours.
  function iconBgAdopts() { return localStorage.getItem("cc.iconbgrainbow") === "1"; }
  // The adopt toggle implies the background is on, as bgColor() and iconInk() already treat it, so
  // the three .cc-docker-iconbg gates below share this helper rather than testing the per-area key
  // alone and drifting apart.
  function iconBgOn() { return effc("iconbg") === "1" || iconBgAdopts(); }
  // cc.sgsize to [--cc-logo-img, --cc-logo-box]; vms.js and plugins.js keep their own copy. Both
  // applySettings() and applyIconTint()'s inline writes read it, so the two cannot disagree.
  function ccLogoSizes() { return ({ s: ["48px", "62px"], m: ["62px", "78px"], l: ["76px", "94px"] })[localStorage.getItem("cc.sgsize") || "m"] || ["62px", "78px"]; }
  // cc.theming defaults to on. Off strips the visual layer alone, the native-cell restyle, the
  // decorative row badges, the icon tint, the rainbow, the grid view and the theming menu rows,
  // while every orchestration control stays: the actions column, the state toggle, the limit
  // gears, the plan chip with its editor, the save and start-in-order actions and the heartbeat.
  // It is read at the presentational chokepoints only, never near boot(), the timers or the API.
  function themingOn() { return localStorage.getItem("cc.theming") !== "0"; }
  // Skip jQuery's switchButton() widget for the per-row autostart toggle. Unraid's loadlist()
  // replaces the whole #docker_list after every action and then calls
  // $('.autostart').switchButton(), a jQuery UI widget that builds four DOM nodes and an event
  // layer per row, which on a host with dozens of containers blocks the main thread for seconds.
  // docker.css restyles the widget's own output past recognition anyway, so with theming on none
  // of that work is visible: the bare <input class=autostart> is styled directly instead as a
  // CSS-only toggle (.cc-noswitch). Saving is unaffected, because loadlist()'s own
  // $('.autostart').change() binding listens to the checkbox's native change event, which a bare
  // checkbox fires on click. The patch runs once, before boot() and before the page's first
  // loadlist(), and is scoped to .autostart, so the Basic/Advanced view toggle keeps the real
  // widget.
  (function () {
    if (!window.jQuery || !jQuery.fn.switchButton || jQuery.fn.switchButton.__ccPatched) return;
    var realSwitchButton = jQuery.fn.switchButton;
    jQuery.fn.switchButton = function (opts) {
      if (themingOn() && this.length && this.hasClass("autostart")) { this.addClass("cc-noswitch"); return this; }
      return realSwitchButton.apply(this, arguments);
    };
    jQuery.fn.switchButton.__ccPatched = true;
  })();
  // ── perf: skip readmore.js for the per-cell Docker "read more" spans ──
  // (user: "der erweiterte/einfache Ansicht Toggle im Dockertab: das Umschalten dauert lange und
  // der Tab friert ein"). Root cause, live-profiled with a CDP CPU sampling profile across a real
  // click on the toggle (55 containers / 223 .docker_readmore spans on the reporting host): ONE
  // blocking main-thread task of 7.2-7.6s, and 7.3s of it sat inside readmore.js's init() called
  // from Unraid's own listview(). readmore's init runs, per element,
  //   css("max-height") -> css("max-height","none") -> css({height:"auto",overflow:"visible"})
  //   -> outerHeight(true)
  // a write, a read, a write and a read, where each read forces a synchronous style and layout
  // recalculation of the whole table. Across a couple of hundred spans that is seconds of layout
  // thrash, and it is wasted work here: CC reads those cells only as a text source, through
  // readmoreText, and then hides them or replaces the cell with its own badges, so readmore's
  // collapse UI never appears and it renders no nodes at all. listview() runs at the end of every
  // loadlist(), so this cost the same seconds on the first page load and after every container
  // action, not only on a view switch. Same contract as the switchButton patch above: only while
  // theming is on, and scoped to .docker_readmore, so the Apps page's .popup_readmore and the
  // Plugins page's .desc_readmore keep the real plugin.
  (function () {
    if (!window.jQuery || !jQuery.fn.readmore || jQuery.fn.readmore.__ccPatched) return;
    var realReadmore = jQuery.fn.readmore;
    jQuery.fn.readmore = function () {
      if (themingOn() && this.length && this.hasClass("docker_readmore")) return this;
      return realReadmore.apply(this, arguments);
    };
    jQuery.fn.readmore.__ccPatched = true;
  })();
  // The frontend version, which pkg_build.sh stamps at package time. It is shown next to the
  // engine version, so a stale frontend can be told apart from a stale daemon.
  var CC_VER = "@@CCVER@@"; if (CC_VER.indexOf("@@") === 0) CC_VER = "dev";
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  // Mon-first day toggles; value is Go's time.Weekday (0=Sun..6=Sat).
  var DAYS = LANG === "de"
    ? [["Mo", 1], ["Di", 2], ["Mi", 3], ["Do", 4], ["Fr", 5], ["Sa", 6], ["So", 0]]
    : [["Mo", 1], ["Tu", 2], ["We", 3], ["Th", 4], ["Fr", 5], ["Sa", 6], ["Su", 0]];

  // Every string in this table is read by a user, so it spells the product out as
  // "CannonadeCommand" in both halves. "CC" is a source-code prefix, the cc- class namespace, the
  // CC_* constants and the cc.* keys, and it never leaves the source.
  var T = {
    de: { uptodate: "Aktuell", update: "Update", start: "Starten", stop: "Stoppen", restart: "Neustart", pause: "Pause", resume: "Fortsetzen", force: "Update erzwingen", save: "Plan speichern", startorder: "In Reihenfolge starten", filter: "filtern…", cols: "Badges", view: "Ansicht", list: "Liste", grid: "Raster", plan: "Startplan", done: "erledigt", saving: "speichere…", saved: "gespeichert", after: "nach", active: "aktiv", watchdog: "Auto-Start", wUnhealthy: "bei „unhealthy“", wExit: "bei Absturz (nicht bei normalem Stopp)", wMax: "max./Std.", schedules: "Zeitpläne", addsched: "+ Zeitplan", remove: "entfernen", manage: "Im Startplan verwalten", dependsOn: "Hängt ab von", commaSep: "kommagetrennt", dependsOnInfo: "Container, die laufen müssen, bevor dieser startet. CannonadeCommand startet sie zuerst, wartet, bis jeder von ihnen bereit meldet (womit „bereit“ gemeint ist, legst du unten unter „Bereit wenn“ fest), und startet erst danach diesen hier. Das Feld ist eine Auswahlliste: hineinklicken öffnet sie, jeder Klick nimmt einen Container auf oder wieder heraus, Tippen geht auch. Leer heißt: dieser Container wartet auf nichts und startet sofort.", startDelay: "Startverzögerung", startOrder: "Startnummer", startOrderPh: "Nr.", startOrderInfo: "Kleinere Zahl startet früher; leer/0 = ohne Nummer und startet zuletzt in Listenreihenfolge. Priorität, keine feste Reihenfolge; Doppelte sind erlaubt. Abhängigkeiten und Health-Gates gehen weiterhin vor.", secWait: "Sek. vor dem Start warten", readyWhen: "Bereit wenn", onFail: "Bei Fehlschlag", failhint: "abort überspringt Abhängige · continue/degrade starten sie trotzdem.", ramLimit: "RAM-Limit", cpuLimit: "CPU-Limit", cpuram: "CPU/RAM-Limits", ramPh: "z. B. 2G · 512M · leer = unverändert", cpuPh: "z. B. 1.5 · leer = unverändert", limitsFoot: "Sofort per Docker-Update angewendet, kein Neustart. Leeres Feld lässt den Wert unverändert. „Limit entfernen“ setzt auf unbegrenzt (Docker kann ein Limit live nicht ganz löschen, restlos weg erst durch Neu-Erstellen des Containers).", invalid: "Ungültige Eingabe", saveShort: "Speichern", ramNum: "z. B. 2 · leer = unverändert", cpuNum: "z. B. 1.5 · leer", cpuPin: "CPU-Pinning", cpuPinPh: "z. B. 0-3,6  (leer = alle)", cfgSet: "eingestellt", cfgUnset: "nicht eingestellt (Standard)", removeLim: "Limit entfernen", execPh: "Befehl im Container, z. B. pg_isready", logPh: "Text im Log, z. B. ready", bandwidth: "Bandbreite", egress: "Egress (Upload)", upload: "↑ Upload", download: "↓ Download", bwFoot: "Upload = tbf-Shaper, Download = Netfilter-Policing (hashlimit) im Container, kein Kernel-Qdisc. Wird laufend angewendet; nach einem Container-Neustart erst im nächsten Zyklus wieder. Braucht nsenter + tc/iptables auf dem Host; die Schnittstelle stellst du in den Einstellungen ein.", idleStop: "Auto-Stop bei Leerlauf", idleMin: "Leerlauf-Minuten", idleCpu: "CPU-Schwelle %", idleFoot: "Stoppt den Container, wenn er längere Zeit nichts zu tun hat: CPU unter der Schwelle und kaum Netzwerkverkehr, beides gleichzeitig und ohne Unterbrechung. „Leerlauf-Minuten“ ist, wie lange das so bleiben muss, bevor CannonadeCommand stoppt; „CPU-Schwelle %“ ist, ab welcher Auslastung der Container als beschäftigt gilt. Ein beschäftigter Container wird nie gestoppt, und CannonadeCommand startet ihn danach auch nicht von selbst wieder.", restartPolicy: "Restart-Policy", rpNo: "Nein (kein Auto-Start)", rpUnlessStopped: "Außer wenn gestoppt", rpAlways: "Immer", rpOnFailure: "Bei Fehler", rpWarn: "kein Auto-Start", rpWarnTip: "Restart-Policy „no“: dieser Container startet nach einem Host-Neustart nicht automatisch.", depsOk: "Alle Abhängigkeiten bereit", depsBad: "Abhängigkeit nicht bereit:", depNotRun: "noch nicht geprüft", newFolder: "Neuer Ordner…", newFolderPrompt: "Name des neuen Ordners:", renameFolder: "Ordner umbenennen", renameFolderPrompt: "Neuer Name:", deleteFolder: "Ordner löschen", deleteFolderConfirm: "Diesen Ordner löschen? Enthaltene Container werden eine Ebene höher verschoben, nicht gelöscht.", moveToFolder: "In Ordner verschieben…", rootLevel: "(Wurzelebene)", iconMode: "Icon-Färbung", iconInherit: "folgt globaler Einstellung", iconAuto: "Automatisch", iconNative: "Natives Icon", iconFlat: "Ink-Flatten", iconTint: "Luminanz-Tint", folderContent: "Ordnerinhalt", detailed: "Detailliert", hideStopped: "Gestoppte ausblenden", bulkStartAll: "Alle starten", bulkStopAll: "Alle stoppen" },
    en: { uptodate: "up to date", update: "Update", start: "Start", stop: "Stop", restart: "Restart", pause: "Pause", resume: "Resume", force: "Force update", save: "Save plan", startorder: "Start in order", filter: "filter…", cols: "Badges", view: "View", list: "List", grid: "Grid", plan: "Plan", done: "done", saving: "saving…", saved: "saved", after: "after", active: "active", watchdog: "Auto-start", wUnhealthy: "when unhealthy", wExit: "on crash (not on a normal stop)", wMax: "max/hour", schedules: "Schedules", addsched: "+ schedule", remove: "remove", manage: "Manage in the start plan", dependsOn: "Depends on", commaSep: "comma-separated", dependsOnInfo: "Containers that have to be running before this one starts. CannonadeCommand starts them first, waits until each of them reports ready (what “ready” means is set below under “Ready when”), and only then starts this one. The field is a picker: click it to open the list, each click adds or removes a container, and typing works too. Empty means this container waits for nothing and starts right away.", startDelay: "Start delay", startOrder: "Start order", startOrderPh: "no.", startOrderInfo: "Lower number starts earlier; empty/0 = unnumbered and starts last in list order. A priority, not a strict order; duplicates are fine. Dependencies and health-gates still take precedence.", secWait: "sec to wait before starting", readyWhen: "Ready when", onFail: "On fail", failhint: "abort skips dependents · continue/degrade start them anyway.", ramLimit: "RAM limit", cpuLimit: "CPU limit", cpuram: "CPU/RAM limits", ramPh: "e.g. 2G · 512M · empty = unchanged", cpuPh: "e.g. 1.5 · empty = unchanged", limitsFoot: "Applied instantly via Docker update, no restart. An empty field leaves the value unchanged. “Remove limit” sets it to unlimited (Docker can't fully unset a limit live, gone for good only by recreating the container).", invalid: "invalid value", saveShort: "Save", ramNum: "e.g. 2 · empty = unchanged", cpuNum: "e.g. 1.5 · empty", cpuPin: "CPU pinning", cpuPinPh: "e.g. 0-3,6  (empty = all)", cfgSet: "configured", cfgUnset: "not set (default)", removeLim: "Remove limit", execPh: "command in the container, e.g. pg_isready", logPh: "text in the log, e.g. ready", bandwidth: "Bandwidth", egress: "Egress (upload)", upload: "↑ Upload", download: "↓ Download", bwFoot: "Upload = tbf shaper, download = netfilter policing (hashlimit) inside the container, no kernel qdisc. Re-applied while running; after a container restart it returns on the next cycle. Needs nsenter + tc/iptables on the host; set the interface on the Settings page.", idleStop: "Auto-stop when idle", idleMin: "Idle minutes", idleCpu: "CPU threshold %", idleFoot: "Stops the container once it has had nothing to do for a while: CPU below the threshold and barely any network traffic, both at once and without a break. “Idle minutes” is how long that has to hold before CannonadeCommand stops it; “CPU threshold %” is the load above which the container counts as busy. A busy container is never stopped, and CannonadeCommand does not start it again by itself afterwards.", restartPolicy: "Restart policy", rpNo: "No (never)", rpUnlessStopped: "Unless stopped", rpAlways: "Always", rpOnFailure: "On failure", rpWarn: "no auto-start", rpWarnTip: "Restart policy “no”: this container will not auto-start after a host reboot.", depsOk: "All dependencies ready", depsBad: "Dependency not ready:", depNotRun: "not checked yet", newFolder: "New folder…", newFolderPrompt: "Name of the new folder:", renameFolder: "Rename folder", renameFolderPrompt: "New name:", deleteFolder: "Delete folder", deleteFolderConfirm: "Delete this folder? Containers inside it move up one level, they are not deleted.", moveToFolder: "Move to folder…", rootLevel: "(Root level)", iconMode: "Icon colouring", iconInherit: "follows the global setting", iconAuto: "Automatic", iconNative: "Native icon", iconFlat: "Ink flatten", iconTint: "Luminance tint", folderContent: "Folder contents", detailed: "Detailed", hideStopped: "Hide stopped", bulkStartAll: "Start all", bulkStopAll: "Stop all" },
  };
  function t(k) { return (T[LANG] || T.en)[k] || T.en[k]; }
  var STATE_LABELS = {
    // "created", built but never started, as right after an edit or a recreate, reads as stopped,
    // which is what it is to whoever is looking at the row.
    de: { running: "läuft", exited: "gestoppt", created: "gestoppt", paused: "pausiert", restarting: "startet neu", removing: "wird entfernt", dead: "tot" },
    en: { running: "running", exited: "stopped", created: "stopped", paused: "paused", restarting: "restarting", removing: "removing", dead: "dead" },
  };
  function stateLabel(s) { var m = STATE_LABELS[LANG] || STATE_LABELS.en; return m[s] || s || "?"; }

  var mode = (localStorage.getItem(VIEW_KEY) === "grid" && themingOn()) ? "grid" : "list"; // the grid is part of the theming, so it never starts with theming off
  var ccOrgView = null, ccOrgAvailable = false; // the cached docker.organizer GraphQL result; null while it is unloaded or unreachable
  var containers = [], containerNames = [], containersByName = {}, stats = {}, shiplog = {}, workingPlan = {}, lastRun = {}, iconCache = {};
  var netPrev = {}; // name to {rx,tx,t}, the previous cumulative counters, for the live rate
  var daemonVersion = ""; // the running daemon's version from /api/state, shown in the gear menu
  // Whether the last /api/state reached the host daemon. The limits and bandwidth all need it
  // while the icon tint is pure client CSS, so a working tint with failing limits means the daemon
  // is unreachable rather than a broken feature, and the gear turns red and says so. null until
  // the first probe.
  var daemonUp = null;
  // The automation config (schedules, watchdogs and notifications) lives on the flash beside the
  // plan; it is loaded whole, changed per container in the editor and written back whole.
  var config = { schedules: [], watchdogs: [], bandwidths: [], idle_stops: [], notify: { unraid: false, webhook: "" } };
  var limits = {}; // name to the configured caps {mem_bytes,nano_cpus,cpuset_cpus}, for the "limit set" dots
  var hostCpus = 0, hostCoreOf = [], hostMem = 0; // the host's logical CPU count, its hyperthread grouping and its total RAM
  var hostPCores = [], hostECores = []; // the P and E core lists of an Intel hybrid CPU, empty elsewhere
  var filterText = "", gridHolder = null, openPop = null, openPopAnchor = null, menu = null, menuAnchor = null, menuStatusEl = null, toastEl = null, toastTimer = null;
  var mo = null, dead = false, lastAdv = false, timers = [], moPending = false, moTimer = null, lastObsLoad = 0, moTrail = false;
  var ccFirstPaintDone = false;   // cleared once, in moSweep()
  var ccUpBg = "", ccUpFg = "";   // the update-pill colours, computed once per pass rather than per row
  var ccAdvCache = null;          // the advanced/basic view, cached for one pass rather than per call
  var ccBulkSel = {};             // bulk select: name to {id, image}, cleared after every bulk action
  var ccEnhBusyStart = 0;   // when cc-enh-busy was set, so the clear can hold it for a minimum time
  var ccEnhanceAt = 0;      // when the last full row-enhancement pass ran, so a scheduled fallback repaint
                            // can tell whether the observer got there first

  // csrf_token: the JS global, else any form field, else the cookie
  function csrfToken() {
    try {
      if (typeof window.csrf_token !== "undefined" && window.csrf_token) return window.csrf_token;
      var f2 = document.querySelector('input[name="csrf_token"]'); if (f2 && f2.value) return f2.value;
      var m2 = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m2) return m2[1];
    } catch (e) {}
    return "";
  }
  function api(method, path, body, query) {
    var opts = { method: method, headers: { Accept: "application/json" } };
    var url = PROXY + "?path=" + encodeURIComponent(path); if (query) url += "&" + query;
    // Unraid's emhttp takes a POST's csrf_token as a form-body field only and drops the
    // query-string variant with an empty 200, so every write goes form-encoded as
    // csrf_token=…&data=<json> and the proxy unwraps `data` back into the JSON body.
    var tk2 = method !== "GET" ? csrfToken() : "";
    if (method !== "GET") {
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opts.body = (tk2 ? "csrf_token=" + encodeURIComponent(tk2) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body != null ? body : {}));
    }
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (t2) {
        var data = null; try { data = t2 ? JSON.parse(t2) : null; } catch (e) { data = null; }
        if (!r.ok) { var err = new Error((data && data.error) ? data.error : "HTTP " + r.status); err.status = r.status; throw err; }
        // an empty 200 must not pass as success
        if (method !== "GET" && r.ok && data == null) { var e4 = new Error("leere Antwort der Web-Schicht: " + (tk2 ? "csrf_token gesendet, trotzdem verworfen" : "kein csrf_token im Fenster gefunden")); e4.status = r.status; throw e4; }
        if (data && typeof data === "object") { try { data.__via = (r.headers.get("server") || "") + "|" + (r.headers.get("via") || "") + "|" + (r.headers.get("cf-cache-status") || "") + "|" + (r.headers.get("x-cache") || ""); } catch (e3) {} }
        return data;
      });
    });
  }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function norm(s) { return String(s || "").trim().toLowerCase(); }
  function humanBytes(b) { if (!b) return "0"; var u = ["B", "K", "M", "G", "T"], i = 0, n = b; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10) + u[i]; }
  // live network rate label from a stats snapshot with derived _rxr/_txr (bytes/sec):
  // "↓1.2M ↑340K" (down = received, up = transmitted). "…" until the second sample.
  function netRate(s) { if (!s || s._rxr == null || s._txr == null) return "…"; return "↓" + humanBytes(s._rxr) + " ↑" + humanBytes(s._txr); }

  // ───────────────────────── native table (source-verified selectors)
  function nativeTable() { var l = document.getElementById("docker_list"); if (l) return l.closest("table") || l.parentNode; return document.getElementById("docker_containers") || document.querySelector("table#docker_containers"); }
  function headerRow() { var tb = nativeTable(); if (!tb || tb.tagName !== "TABLE") return null; return tb.querySelector("thead tr:last-child") || tb.querySelector("thead tr") || null; }
  function isFolderHeader(tr) { return !!(tr.classList.contains("folder") || tr.querySelector(":scope > td.folder-name, :scope > td.folder-update")); }
  function findRows() {
    var cands = ["#docker_list tr.sortable, #docker_list tr.folder-element", "#docker_list > tr", "table#docker_containers tbody tr", "table.tablesorter tbody tr", "div.tabs table tbody tr", "table tbody tr"];
    for (var i = 0; i < cands.length; i++) {
      var rows = Array.prototype.slice.call(document.querySelectorAll(cands[i])).filter(function (tr) { return !isFolderHeader(tr) && !tr.classList.contains("advanced") && (tr.querySelector("td.ct-name, td.updatecolumn") || (tr.querySelector("img") && tr.textContent.trim().length > 1)); });
      if (rows.length) return rows;
    }
    return [];
  }
  function rowName(tr) { var a = tr.querySelector("td.ct-name .appname"); if (a && a.textContent.trim()) return a.textContent.trim(); var id = tr.id || ""; if (/^ct-/.test(id)) return id.slice(3); var img = tr.querySelector("img"); var cell = img ? (img.closest("td") || tr) : tr; var link = cell.querySelector("a"); return (link && link.textContent.trim() ? link.textContent.trim() : (cell.textContent || tr.textContent).trim().split("\n")[0].trim()); }
  function hideNative(hide) { var tb = nativeTable(); if (tb) tb.style.display = hide ? "none" : ""; }
  // container state from the native glyph <i id='load-..' class='fa fa-play|pause|square ..'>
  function glyphState(g) { if (!g) return ""; var c = " " + (g.className || "") + " "; if (/\bfa-play\b/.test(c)) return "running"; if (/\bfa-pause\b/.test(c)) return "paused"; if (/\bfa-square\b/.test(c)) return "exited"; return ""; }
  // Unraid's Advanced/Basic view is a cookie plus a global .advanced/.basic toggle, with no body
  // class. Without the cookie every call takes the slow path, a table-wide querySelector() and a
  // getComputedStyle() that forces a synchronous style recalculation, and colOn() calls this once
  // per column on top of injectRowBadges' own call, so a full tbody replace costs a dozen scans
  // per row. The answer cannot change mid-pass, since nothing here touches the view toggle while
  // the rows are being enhanced, so injectAllRowBadges() caches it in ccAdvCache for one pass.
  function isAdvancedView() { return ccAdvCache !== null ? ccAdvCache : isAdvancedViewReal(); }
  function isAdvancedViewReal() {
    try { var m = document.cookie.match(/(?:^|;\s*)docker_listview_mode=([^;]+)/); if (m) return decodeURIComponent(m[1]) === "advanced"; var a = document.querySelector("#docker_list .advanced"); return a ? getComputedStyle(a).display !== "none" : false; } catch (e) { return false; }
  }
  function readContainerId(advDiv) { try { var m = /container id[:\s]+([0-9a-f]{6,})/i.exec(advDiv.textContent || ""); return m ? m[1] : ""; } catch (e) { return ""; } }

  // ───────────────────────── data
  function indexState(state) {
    containers = (state && state.containers) || [];
    if (state && state.host_cpus) hostCpus = state.host_cpus;
    if (state && state.host_core_of) hostCoreOf = state.host_core_of;
    if (state && state.host_pcores) hostPCores = state.host_pcores;
    if (state && state.host_ecores) hostECores = state.host_ecores;
    if (state && state.host_mem) hostMem = state.host_mem;
    if (state && state.version) daemonVersion = state.version;
    containerNames = containers.map(function (c) { return c.name; }).sort();
    // containerByName() is called per row from syncStateBadges, syncActionBars and refreshStats,
    // the last of which runs every few seconds forever, so the names are indexed once here
    // instead of scanning `containers` on every call.
    containersByName = {};
    containers.forEach(function (c) { containersByName[norm(c.name)] = c; });
    workingPlan = {};
    if (state && state.plan && state.plan.nodes) state.plan.nodes.forEach(function (n) { workingPlan[n.name] = n; });
    lastRun = {};
    if (state && state.last_run && state.last_run.nodes) state.last_run.nodes.forEach(function (r) { lastRun[r.name] = r; });
  }
  function loadShiplog() {
    return fetch(SHIPLOG, { headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      shiplog = {};
      if (Array.isArray(data)) data.forEach(function (st) { var n = st.container && st.container.name; if (n) shiplog[norm(n)] = st; });
    }).catch(function () { shiplog = {}; });
  }
  // localStorage is per origin, so a toggle set while browsing by IP never reaches the domain
  // origin. Every cc.* write is mirrored into the engine config's ui_settings and adopted back on
  // every origin.
  var uiSyncT = null, uiSeeded = false, uiPending = {};
  (function () {
    try {
      var orig = localStorage.setItem.bind(localStorage);
      window.__ccLS = orig;
      localStorage.setItem = function (k, v) {
        orig(k, v);
        try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { uiPending[k] = 1; clearTimeout(uiSyncT); uiSyncT = setTimeout(pushUISettings, 800); } } catch (e) {}
      };
    } catch (e) {}
    // removeItem is intercepted as well as setItem: a toggle turned off by removing its key would
    // otherwise never reach uiPending, and the stale value would stay in the engine's mirror and
    // come back through adoptUISettings() on the next reload. pushUISettings() already deletes a
    // server key whose local value is null.
    try {
      var origRm = localStorage.removeItem.bind(localStorage);
      window.__ccLSRemove = origRm;
      localStorage.removeItem = function (k) {
        origRm(k);
        try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { uiPending[k] = 1; clearTimeout(uiSyncT); uiSyncT = setTimeout(pushUISettings, 800); } } catch (e) {}
      };
    } catch (e) {}
  })();
  function collectUISettings() { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^cc[a-z]*\./.test(k) && k !== "cc.stateCache") o[k] = localStorage.getItem(k); } return o; }
  // merge the changed keys into the server map rather than replacing it wholesale
  function pushUISettings() {
    var keys = Object.keys(uiPending); if (!keys.length) return;
    api("GET", "config").then(function (c) {
      if (!c || typeof c !== "object") return;
      var u = c.ui_settings || {};
      keys.forEach(function (k) { var v = localStorage.getItem(k); if (v === null) delete u[k]; else u[k] = v; });
      uiPending = {};
      return api("PUT", "config", { schedules: c.schedules || [], watchdogs: c.watchdogs || [], bandwidths: c.bandwidths || [], idle_stops: c.idle_stops || [], notify: c.notify || { unraid: false, webhook: "" }, shape_iface: c.shape_iface || "", ui_settings: u });
    }).catch(function () {});
  }
  function adoptUISettings(u) {
    var changed = false;
    try { Object.keys(u || {}).forEach(function (k) { if (/^cc[a-z]*\./.test(k) && k !== "cc.stateCache" && localStorage.getItem(k) !== u[k]) { (window.__ccLS || localStorage.setItem.bind(localStorage))(k, u[k]); changed = true; } }); } catch (e) {}
    return changed;
  }
  var ccConfigFirstLoad = true; // see loadConfig()'s forced first repaint below
  function loadConfig() {
    return api("GET", "config").then(function (c) {
      if (c && typeof c === "object") {
        config = { schedules: c.schedules || [], watchdogs: c.watchdogs || [], bandwidths: c.bandwidths || [], idle_stops: c.idle_stops || [], notify: c.notify || { unraid: false, webhook: "" }, shape_iface: c.shape_iface || "", ui_settings: c.ui_settings || undefined };
        // Adopt the server-side cc.* mirror, then repaint. adoptUISettings() returns true only
        // when it wrote a differing key, while boot does not wait on this promise, so the paints
        // that already ran used whatever localStorage held before it resolved. The first
        // loadConfig() therefore repaints unconditionally.
        var forceFirst = ccConfigFirstLoad; ccConfigFirstLoad = false;
        if (adoptUISettings(c.ui_settings) || forceFirst) { applySettings(); if (mode === "list") { if (themingOn()) applyEnhanceClasses(); else removeEnhanceClasses(); reinjectRowBadges(); } else renderCurrentView(); }
        // on the first run against this engine, seed the server mirror from this browser, so the
        // settings survive an origin switch and cleared browser data
        if (!uiSeeded && (!c.ui_settings || !Object.keys(c.ui_settings).length)) { uiSeeded = true; var seed9 = collectUISettings(); if (Object.keys(seed9).length) { Object.keys(seed9).forEach(function (k9) { uiPending[k9] = 1; }); pushUISettings(); } }
      }
    }).catch(function () { /* older engine or transient: keep the current config */ });
  }
  // Every container's configured caps in one call, which the engine inspects concurrently, so the
  // CPU and RAM badges can show which have a limit set.
  function loadLimits() {
    return api("GET", "limits").then(function (m) { if (m && typeof m === "object") limits = m; }).catch(function () { /* keep previous */ });
  }
  // The limits change only on an explicit edit, and reading them costs one inspect per container,
  // far more than /api/state, so this runs off the render path: fetch once, then repaint the
  // dots. It stays out of the load() cycle, which would gate every paint on a full inspect sweep.
  function refreshLimits() { return loadLimits().then(function () { if (!dead && mode === "list") reinjectRowBadges(); }); }
  function watchdogFor(name) { var k = norm(name); for (var i = 0; i < config.watchdogs.length; i++) if (norm(config.watchdogs[i].name) === k) return config.watchdogs[i]; return null; }
  function schedulesFor(name) { var k = norm(name); return config.schedules.filter(function (s) { return norm(s.name) === k; }); }
  // Replace this container's entries in the whole config and leave every other container and the
  // notify block alone, so a per-row save never overwrites the rest.
  function setWatchdog(name, wd) { var k = norm(name); config.watchdogs = config.watchdogs.filter(function (w) { return norm(w.name) !== k; }); if (wd) config.watchdogs.push(wd); }
  function setSchedules(name, list) { var k = norm(name); config.schedules = config.schedules.filter(function (s) { return norm(s.name) !== k; }); list.forEach(function (s) { config.schedules.push(s); }); }
  function bandwidthFor(name) { var k = norm(name), list = config.bandwidths || []; for (var i = 0; i < list.length; i++) if (norm(list[i].name) === k) return list[i]; return null; }
  // egressKbit caps the upload and ingressKbit the download; 0 clears that direction, and the
  // entry is dropped once both are 0.
  function setBandwidth(name, egressKbit, ingressKbit) { var k = norm(name); config.bandwidths = (config.bandwidths || []).filter(function (b) { return norm(b.name) !== k; }); if (egressKbit > 0 || ingressKbit > 0) config.bandwidths.push({ name: name, egress_kbit: egressKbit || 0, ingress_kbit: ingressKbit || 0 }); }
  // Auto-stop: stop a container once its CPU and network have been low for a set number of
  // minutes. idleStopFor reads the entry, setIdleStop writes it.
  function idleStopFor(name) { var k = norm(name), list = config.idle_stops || []; for (var i = 0; i < list.length; i++) if (norm(list[i].name) === k) return list[i]; return null; }
  function setIdleStop(name, is) { var k = norm(name); config.idle_stops = (config.idle_stops || []).filter(function (x) { return norm(x.name) !== k; }); if (is) config.idle_stops.push(is); }
  // a kbit rate as "5 Mbit", "500 kbit" or a dash for none
  function bwKbitLabel(kbit) { if (!(kbit > 0)) return "-"; return kbit >= 1000 ? (Math.round(kbit / 100) / 10) + " Mbit" : kbit + " kbit"; }
  // the configured caps for the badge's tooltip
  function bwTitle(bw) { return "↑ " + bwKbitLabel(bw && bw.egress_kbit) + " · ↓ " + bwKbitLabel(bw && bw.ingress_kbit); }
  function bwHasLimit(bw) { return !!(bw && (bw.egress_kbit > 0 || bw.ingress_kbit > 0)); }
  function containerByName(name) { var v = containersByName[norm(name)]; return v === undefined ? null : v; }
  // The plan badge's label already names the plan, so a managed container shows the word "active"
  // and nothing more; the dependency list and the automation details live in the tooltip and the
  // editor.
  function depsTxt(node) { return node ? t("active") : ""; }
  function iconFor(name) {
    if (iconCache[name] !== undefined) return iconCache[name];
    var src = "", row = document.getElementById("ct-" + name), img = row && row.querySelector("img");
    if (!img) { var all = document.querySelectorAll("#docker_containers img, #docker_list img"); for (var i = 0; i < all.length; i++) { var tr = all[i].closest("tr"); if (tr && norm(rowName(tr)) === norm(name)) { img = all[i]; break; } } }
    if (img) src = img.getAttribute("src") || "";
    // A miss is not cached: the grid can render before the native table's ajax rows exist, and a
    // cached "" would leave every card logo empty.
    if (src) iconCache[name] = src;
    return src;
  }

  // A paused container cannot run its healthchecks, so right after an unpause Docker often still
  // reports unhealthy until the next check passes. After an unpause CC itself performed, the
  // health gets a grace period before the badge alarms; a genuinely sick container turns red
  // after it anyway.
  var unpauseGrace = {};
  function showUnhealthy(c) { return !!(c && c.health === "unhealthy" && !(unpauseGrace[c.name] > Date.now())); }
  var UNHEALTHY_TIP_D = "Healthcheck meldet unhealthy. Nach einer Pause ist das normal; es erholt sich mit dem nächsten erfolgreichen Check.";
  var UNHEALTHY_TIP_E = "Healthcheck reports unhealthy. That is normal right after a pause; it recovers with the next passing check.";
  function unhealthyTip() { return LANG === "de" ? UNHEALTHY_TIP_D : UNHEALTHY_TIP_E; }
  function stateBadge(c) { var s = (c && c.state) || "unknown", b = el("span", "cc-badge cc-badge-" + s, stateLabel(s)); b.dataset.name = (c && c.name) || ""; if (showUnhealthy(c)) { b.classList.add("cc-badge-alert"); b.textContent = stateLabel(s) + " ✕"; b.setAttribute("data-tip", unhealthyTip()); } else if (c && c.health === "starting") b.textContent = stateLabel(s) + " …"; return b; }
  function stateToggle(name, state) {
    var s = state || "unknown", b = el("span", "cc-badge cc-badge-" + s + " cc-badge-toggle", stateLabel(s)); b.dataset.name = name;
    var action = s === "running" ? "stop" : (s === "paused" ? "unpause" : "start");
    b.setAttribute("data-tip", t(action === "stop" ? "stop" : action === "unpause" ? "resume" : "start"));
    // The action comes from the current state at click time, not from the state the badge was
    // built with: syncStateBadges updates a badge in place, so one that has flipped from running
    // to stopped has to start on the next click.
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var c = containerByName(name), st = (c && c.state) || s;
      doAction(name, st === "running" ? "stop" : (st === "paused" ? "unpause" : "start"));
    });
    return b;
  }
  // Updates every state badge in place from the freshly loaded container state. A list row is
  // injected once and then skipped through ROWMARK, so without this a badge would keep its
  // label for good; it also replaces a transient badge with the confirmed state on the next load.
  function syncStateBadges() {
    try {
      Array.prototype.slice.call(document.querySelectorAll(".cc-badge[data-name]")).forEach(function (b) {
        if (pendingAction[b.dataset.name]) return; // an action is in flight, so the transient badge stays
        var c = containerByName(b.dataset.name);
        if (!c) return;
        var s = c.state || "unknown", label = stateLabel(s);
        var unh = showUnhealthy(c);
        if (unh) label += " ✕"; else if (c.health === "starting") label += " …";
        var isToggle = b.classList.contains("cc-badge-toggle");
        var cls = "cc-badge cc-badge-" + s + (isToggle ? " cc-badge-toggle" : "") + (unh ? " cc-badge-alert" : "");
        if (unh) b.setAttribute("data-tip", unhealthyTip());
        if (b.textContent !== label) b.textContent = label;
        if (b.className !== cls) b.className = cls;
        // the toggle's tooltip follows the new state; its click handler re-derives the action
        if (isToggle) b.setAttribute("data-tip", t(s === "running" ? "stop" : s === "paused" ? "resume" : "start"));
        else if (b.classList.contains("cc-ct-statedot")) b.setAttribute("data-tip", unh ? unhealthyTip() : stateLabel(s));   // the dot's tooltip is the state, not an action
      });
      syncActionBars(); // the action bar's icons need the same live sync
    } catch (e) {}
  }
  // The action bar's counterpart to syncStateBadges, for the start, stop and pause icons. The bar
  // is built once per row in injectActionCell, and its rebuild guard does not look at the state,
  // so the icons are re-derived here on every load and observer cycle. The source is CC's own
  // c.state, a fresh docker ps on each /api/state, rather than Unraid's status glyph: nchan
  // updates only CPU and RAM, and the glyph is refreshed by loadlist() every few seconds, so it
  // is stale in the moment right after a start or stop. The glyph is the fallback for a row CC
  // has not indexed.
  function syncActionBars() {
    try {
      findRows().forEach(function (tr) {
        var bar = tr.querySelector(".cc-actbar"); if (!bar) return;
        var r2 = bar.querySelectorAll(".cc-actrow")[1]; if (!r2 || r2.children.length < 3) return;
        var name = rowName(tr);
        if (pendingAction[name]) return; // an action is in flight, so the transient look stays
        var glyph = tr.querySelector("td.ct-name .inner i[id^='load-']");
        var c = containerByName(name);
        var st = (c && c.state) || glyphState(glyph) || "unknown";
        if (bar.dataset.ccState === st) return; // unchanged, so no DOM churn
        bar.dataset.ccState = st;
        var running = st === "running", paused = st === "paused";
        // The pause and resume slot: a live button while running or paused, a placeholder while
        // stopped. It is replaced rather than relabelled, so a row that starts gains a working
        // pause.
        var pauseNew = paused ? actBtn("fa-play", t("resume"), function () { doAction(name, "unpause"); })
          : (running ? actBtn("fa-pause", t("pause"), function () { doAction(name, "pause"); }) : actBtnOff("fa-pause", t("pause")));
        // The stop and start slot. Its action is re-derived at click time; this swaps the icon and
        // label, so a running container shows a stop glyph.
        var toggleNew = actBtn(running || paused ? "fa-stop" : "fa-play", running || paused ? t("stop") : t("start"), function () { var cc2 = containerByName(name); doAction(name, cc2 && (cc2.state === "running" || cc2.state === "paused") ? "stop" : "start"); });
        r2.replaceChild(pauseNew, r2.children[1]);
        r2.replaceChild(toggleNew, r2.children[2]);
        tintAct(bar);
      });
    } catch (e) {}
  }
  function badgeInfo(label, value, kind) {
    var b = el("span", "cc-b cc-b-info" + (kind ? " cc-b-" + kind : ""));
    b.appendChild(el("span", "cc-b-k", label)); b.appendChild(el("span", "cc-b-v", value));
    if (kind === "ip" || kind === "lan") { // IPs copy themselves on click
      b.classList.add("cc-b-copy"); b.setAttribute("data-tip", LANG === "de" ? "Klicken zum Kopieren" : "Click to copy");
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        var txt = String(value).trim();
        var done = function () { b.classList.add("cc-copied"); setTimeout(function () { try { b.classList.remove("cc-copied"); } catch (x) {} }, 600); flash((LANG === "de" ? "kopiert: " : "copied: ") + txt); }; // in-place pulse on the copied pill + toast
        try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); }); return; } } catch (e2) {}
        fallbackCopy(txt); done();
      });
    }
    return b;
  }
  function fallbackCopy(txt) { try { var ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } catch (e) {} }
  // one resource line: a badge + its gear, side by side; the res-group stacks these.
  function resLine(badge, gear) { var line = el("div", "cc-resline"); line.appendChild(badge); line.appendChild(gear); return line; }
  function planBadge(name) {
    var node = workingPlan[name], wdOn = !!watchdogFor(name), schedN = schedulesFor(name).length, idleOn = !!idleStopFor(name), auto = wdOn || schedN > 0 || idleOn;
    var chip = el("a", "cc-b cc-plan" + (node ? " cc-plan-on" : "") + (auto ? " cc-plan-auto" : ""));
    chip.href = "#"; chip.innerHTML = '<span class="cc-b-k"></span><span class="cc-b-v"></span>';
    chip.querySelector(".cc-b-k").textContent = t("plan");
    chip.querySelector(".cc-b-v").textContent = depsTxt(node);
    // no hover text: the chip's own label says it all
    chip.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openEditor(chip, name); });
    return chip;
  }
  function lastRunPill(name) { var lr = lastRun[name]; if (!lr) return null; var p = el("span", "cc-pill cc-pill-" + lr.state, lr.state); if (lr.reason) p.setAttribute("data-tip", lr.reason); return p; }
  // A readiness dot beside the plan badge, built from the same recipe as the name cell's state
  // dot, so it reads as the same thing rather than a new one. It is rendered only for a node with
  // dependencies of its own; a container nothing depends on has nothing to summarise. Which
  // dependency is not ready, and why, is in the tooltip, and openEditor lists them by name.
  function depStateDot(name) {
    var node = workingPlan[name], deps = (node && node.after) || [];
    if (!deps.length) return null;
    // The orchestrator runs the plan on its own triggers, such as an array start, not on every
    // daemon restart, so last_run is empty for a while after a plain restart and treating that as
    // an alert would paint every dependency red while its containers are running. The engine's own
    // readiness probe accepts a running container with no healthcheck as ready, so this falls
    // through to the live run state when there is no verdict yet and flags it only when that state
    // is not running either. A real verdict in last_run always wins over the live state.
    var bad = [];
    deps.forEach(function (d) {
      var lr = lastRun[d];
      if (lr) { if (lr.state !== "ready") bad.push(d + " (" + lr.state + (lr.reason ? ": " + lr.reason : "") + ")"); return; }
      var c = containerByName(d);
      if (!c || c.state !== "running") bad.push(d + " (" + (c ? stateLabel(c.state) : t("depNotRun")) + ")");
    });
    // The dot carries no data-name: syncStateBadges() sweeps every .cc-badge[data-name] on a poll
    // and overwrites its class, text and tooltip with that container's own run state, and this dot
    // summarises other containers' readiness rather than its own row's state.
    var dot = el("span", "cc-badge " + (bad.length ? "cc-badge-alert" : "cc-badge-running") + " cc-ct-statedot");
    dot.setAttribute("data-tip", bad.length ? t("depsBad") + " " + bad.join(", ") : t("depsOk"));
    return dot;
  }
  // A dot on a badge: filled when a value is configured here, hollow otherwise, so a row with a
  // CPU or RAM limit or a custom network reads apart from one on the defaults.
  function cfgDot(on) { var d = el("span", "cc-cfg " + (on ? "cc-cfg-on" : "cc-cfg-off")); d.setAttribute("data-tip", on ? t("cfgSet") : t("cfgUnset")); return d; }
  // whether a container is on a chosen network, a custom docker network or a static IP, rather
  // than on the stock bridge or host defaults
  function netConfigured(c) { if (!c) return false; var n = String(c.network || "").toLowerCase(); return !!n && n !== "bridge" && n !== "host" && n !== "none"; }
  // Whether the network is a macvlan or ipvlan bound to a host interface (br0, br0.20, eth0,
  // bond0). Only those give the container an IP on the LAN, so only for those is the container IP
  // also the LAN IP; a custom docker bridge has a NAT-internal IP that the LAN cannot reach.
  function isMacvlan(c) { return !!c && /^(br|bond|eth)\d/i.test(String(c.network || "")); }
  // A cap at or near the host's full RAM or all its cores is no cap at all: Docker cannot unset
  // one through a live update, so the remove action sets it to that value and these read it as
  // unconfigured, which gives a hollow dot and an empty editor field.
  function ramLimited(lm) { return !!(lm && lm.mem_bytes > 0 && (!hostMem || lm.mem_bytes < hostMem * 0.95)); }
  function cpuLimited(lm) { if (!lm || !(lm.nano_cpus > 0)) return false; var all = hostCpus > 0 ? hostCpus * 1e9 : 0; return !all || lm.nano_cpus < all * 0.99; }
  function cpuPinned(lm) { if (!lm || !lm.cpuset_cpus) return false; var s = cpusetToSet(lm.cpuset_cpus); return s.length > 0 && (!hostCpus || s.length < hostCpus); }

  // The column model, which becomes CSS classes on the table and gates the injected badges.
  // Everything defaults on, since every datum is meant to be a badge. The advanced-only data,
  // the image tag, CPU and RAM, the container id and the author, shows in Unraid's advanced view
  // alone, because its native elements carry .advanced and Unraid hides those in the basic view.
  var COLS = [
    { key: "update", label: { de: "Update-Status", en: "Update status" } },
    { key: "force", label: { de: "Update erzwingen", en: "Force update" } },
    { key: "version", label: { de: "Image-Tag", en: "Image tag" } },
    { key: "net", label: { de: "Netzwerk", en: "Network" } },
    { key: "ip", label: { de: "Container-IP", en: "Container IP" } },
    { key: "lan", label: { de: "LAN-IP", en: "LAN IP" } },
    { key: "port", label: { de: "Ports", en: "Ports" } },
    { key: "res", label: { de: "CPU / RAM", en: "CPU / RAM" } },
    { key: "id", label: { de: "Container-ID", en: "Container ID" } },
    { key: "von", label: { de: "Von / Quelle", en: "From / source" } },
    { key: "vol", label: { de: "Volumes", en: "Volumes" } },
    { key: "plan", label: { de: "Startplan", en: "Plan" } },
    { key: "restart", label: { de: "Restart-Policy", en: "Restart policy" } },
  ];
  // Per-view visibility: each column can show in the simple view, the advanced one or both, set
  // on the settings page as {s, a}.
  function defaultColview() {
    // Each column needs its own object, so the two shapes are factory calls: settings.js chkCell
    // mutates colview[key][v] in place, and a shared reference would let one checkbox flip every
    // column that aliased it.
    var adv = function () { return { s: false, a: true }; }, both = function () { return { s: true, a: true }; };
    return { update: both(), force: adv(), version: adv(), net: both(), ip: both(), lan: both(), port: both(), res: both(), id: adv(), von: adv(), vol: adv(), plan: both(), restart: adv() };
  }
  function loadColview() {
    try { var j = JSON.parse(localStorage.getItem(COLS_KEY) || "null"); if (j && typeof j === "object") { var d = defaultColview(); Object.keys(d).forEach(function (k) { if (j[k]) d[k] = { s: !!j[k].s, a: !!j[k].a }; }); return d; } } catch (e) {}
    return defaultColview();
  }
  var colview = loadColview();
  function colOn(key) { var v = colview[key]; if (!v) return true; return isAdvancedView() ? !!v.a : !!v.s; }

  // The accent colour and the row density come from localStorage as CSS variables, written live
  // by the settings page along with a poke event.
  // the badge text colour for a background: dark ink on a light one, white on a dark one
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16); var L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return L > 150 ? "#161616" : "#fff"; }
  // The container icons are tinted with an inline SVG feColorMatrix filter applied to each icon
  // element, so it cannot be mis-positioned the way an overlay can and it maps to the exact sRGB
  // colour, which a grayscale, sepia and hue-rotate chain only approximates. The icon becomes a
  // flat silhouette in the chosen colour, and the strength slider blends it back toward the
  // original. The icon itself is `td.ct-name span.hand > .img`.
  //
  // The background badge and the tint are two independent controls, with a key each for their
  // own on/off state and colour: cc.iconbg with cc.iconbgcolor for the box, cc.icontint with
  // cc.iconcolor for the tint. Older installs only ever set cc.iconbg and cc.iconcolor, where the
  // presence of a colour doubled as "tint on" and as the badge's colour, so tintOn() and
  // bgColor() below fall back to that reading whenever the newer key was never touched and an
  // existing install looks the same after an update.
  function tintOn() {
    var v = effc("icontint");
    return v == null ? !!effc("iconcolor") : v === "1";
  }
  // cc.iconbgrainbow lets the background badge and the tint step aside from their own colours and
  // follow what a generic badge shows: the rotating palette while the rainbow is on, the plain
  // accent otherwise.
  //
  // With it on, bgColor() answers "", so applyIconTint() never stamps --cc-iconbg-color and
  // docker.css's own var(--cc-iconbg-color, var(--cc-rb-c, var(--cc-accent))) chain falls through
  // to --cc-rb-c, which card() stamps per grid card and applyRainbowPalette() per list row, so
  // the badge rotates per container.
  //
  // The tint then adopts no hue of its own: iconInk() answers the black or white contrast colour
  // for the resolved background, as settingsgrid.js computes for its tiles. The tint is one flat
  // SVG filter for the whole page rather than one per row, so a hue here would show every logo in
  // the same colour and look nothing like a rainbow, while a contrast colour has no rotation to
  // lose. iconAdoptTint() below resolves the colour that contrast is computed from: the plain
  // accent while the rainbow is off, where every badge really is that one colour, or the single
  // action slot already stamped for the buttons and toggles while it is on. ccRbColor()
  // recomputes it on every repaint.
  function iconAdoptTint() {
    if (!themingOn() || localStorage.getItem("cc.rainbow") !== "1") return effc("accent") || "#2f6feb";
    return ccRbColor(5);
  }
  function bgColor() {
    if (iconBgAdopts()) return "";   // adopting: defer to the CSS rainbow/accent chain
    var c = effc("iconbgcolor");
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) return ccHex6(c);
    var ic = effc("iconcolor");
    if (ic && /^#?[0-9a-f]{6}$/i.test(ic)) return ccHex6(ic);
    return effc("accent") || "#2f6feb";
  }
  // The one colour both icon treatments paint with. With the adopt toggle on it is the black or
  // white contrast colour for the resolved background, whatever the tint toggle says, as
  // settingsgrid.js computes for its tiles; that is the only case where it answers a colour with
  // the tint off. With the adopt toggle off it is "" while the tint is off, whatever the
  // background badge does, which lets the pipeline fall back to the plain native icons, and the
  // picked tint colour while it is on, lifted out of the dark end by the shared guard. bgColor()
  // governs the badge box's own background and never feeds the icon's ink.
  //
  // forTint doubles the floor: a luminance tint lands at about half the target's luma on
  // mid-bright artwork, so the badge floor alone leaves a dark target hard to make out against
  // the card. The contrast branch needs no guard, since idealText() answers #fff or #161616.
  function iconInk(forTint) {
    if (iconBgAdopts()) return idealText(iconAdoptTint());
    if (!tintOn()) return "";
    var pick = effc("iconcolor");
    var valid = pick && /^#?[0-9a-f]{6}$/i.test(pick);
    if (!valid) return "";
    if (!window.CCTheme || !window.CCTheme.liftDark) return ccHex6(pick);
    var floor = window.CCTheme.LUM_FLOOR * (forTint ? 2 : 1);
    return ccHex6(window.CCTheme.liftDark(pick, effc("accent") || "#2f6feb", floor));
  }
  // The per-item contrast ink. Under the adopt toggle iconInk() answers one representative
  // colour for the whole page, but with the rainbow on the badge each icon sits on rotates per
  // item, so an item whose own colour needs the opposite ink gets an illegible one. This reuses
  // the --cc-rb-ct that stampCardRainbow() or applyRainbowPalette() already stamped on the owning
  // card or row, rather than recomputing it, so the two cannot drift apart. It falls back to the
  // uniform ink while the rainbow is off, where the badge really is one flat colour, or when the
  // owner or its stamp is missing, which a repaint that outran the last rainbow pass heals on the
  // next one.
  function itemAdoptInk(ownerEl) {
    if (ownerEl && ownerEl.style && themingOn() && localStorage.getItem("cc.rainbow") === "1") {
      var v = ownerEl.style.getPropertyValue ? ownerEl.style.getPropertyValue("--cc-rb-ct") : "";
      if (v) return v.trim();
    }
    return idealText(iconAdoptTint());
  }
  // The ids are parameters, so two luminance-tint filters can coexist on one page;
  // ensureTintFilter() below keeps the single-filter spelling every other caller uses.
  function ensureTintFilterAs(hostId, filtId, ic) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ic || "");
    var host = document.getElementById(hostId);
    if (!m) { if (host) host.remove(); return false; }
    var tr = parseInt(m[1], 16) / 255, tg = parseInt(m[2], 16) / 255, tb = parseInt(m[3], 16) / 255;
    var s = (Math.max(10, parseInt(effc("iconstrength") || "100", 10)) / 100).toFixed(3);
    if (!host) { host = document.createElement("div"); host.id = hostId; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    // Each output channel is the pixel's luminance times the target colour, so shadows stay dark
    // and highlights bright in the chosen hue, and the strength slider blends the result back
    // over the original.
    var lum = function (c) { return (0.2126 * c).toFixed(4) + " " + (0.7152 * c).toFixed(4) + " " + (0.0722 * c).toFixed(4); };
    // At full strength the merge with the original leaves a light halo on antialiased edges,
    // where a semi-transparent tint sits over a bright source edge, so the pure matrix is used.
    var mid = '<feColorMatrix in="SourceGraphic" type="matrix" result="flat" values="' + lum(tr) + ' 0 0 ' + lum(tg) + ' 0 0 ' + lum(tb) + ' 0 0 0 0 0 1 0"/>';
    if (parseFloat(s) < 0.999) mid += '<feComponentTransfer in="flat" result="faded"><feFuncA type="linear" slope="' + s + '"/></feComponentTransfer><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="faded"/></feMerge>';
    // Signature-guarded like the flat filter below: applyIconTint runs on every icon resolution
    // and measurement too, and an innerHTML write per pass is a DOM mutation the observer would
    // feed on.
    var sig = "tint|" + filtId + "|" + tr + "|" + tg + "|" + tb + "|" + s;
    if (host.dataset.sig !== sig) {
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' + mid + '</filter></svg>';
      host.dataset.sig = sig;
    }
    return true;
  }
  function ensureTintFilter() { return ensureTintFilterAs("cc-tint-svg", "cc-icon-tint", iconInk(true)); }
  // Ink-flattening: every opaque pixel becomes one colour with its alpha untouched, the crisp
  // badge silhouette. It is used on a real glyph, or on an icon the heuristic showed is already
  // one tone, never on full-colour artwork, where it would merge the background and the mark into
  // a blob. The signature guard on host.dataset.sig keeps the MutationObserver from rebuilding an
  // identical <filter> in a loop.
  // Expands #rgb to #rrggbb: idealText answers "#fff", while every filter builder and colour
  // regex here wants six digits.
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
  // the background badge's spelling of the same filter: flatten to the ink that reads on the
  // accent box, black on a light one and white on a dark one
  function ensureMonoFilter(hostId, filtId, accentHex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(accentHex || "");
    if (!m) return ensureFlatFilter(hostId, filtId, "");
    return ensureFlatFilter(hostId, filtId, idealText("#" + m[1]));
  }
  function iconFilter() { return ensureTintFilter() ? "url(#cc-icon-tint)" : ""; }
  // every row's icon element with the container name behind it, which the pipeline needs to look
  // the app up and to find its per-item pin
  function tintTargetsNamed() {
    var out = [], rows = findRows();
    for (var i = 0; i < rows.length; i++) {
      var img = rows[i].querySelector("td.ct-name span.hand > .img") || rows[i].querySelector("td.ct-name img") || rows[i].querySelector("td.ct-name i.img");
      if (img) out.push({ el: img, name: rowName(rows[i]) });
    }
    return out;
  }
  function tintTargets() { return tintTargetsNamed().map(function (t) { return t.el; }); }
  // Swaps an <img>'s source to a resolved icon, or back to the one it shipped with. The native
  // src is remembered once and the write is guarded on data-cc-isrc, so a repaint that changes
  // nothing writes no attribute.
  function setIconSrc(img, url) {
    if (!img.getAttribute("data-cc-osrc")) img.setAttribute("data-cc-osrc", img.getAttribute("src") || "");
    var want = url || img.getAttribute("data-cc-osrc") || "";
    if (!want || img.getAttribute("data-cc-isrc") === want) return;
    img.setAttribute("data-cc-isrc", want);
    if (img.getAttribute("src") !== want) img.setAttribute("src", want);
  }
  function nativeIconSrc(img) { return img.getAttribute("data-cc-osrc") || img.getAttribute("src") || ""; }
  // A glyph's css colour and the luminance tint filter never apply together: once a glyph has a
  // direct colour, running the filter over it would process the same hue twice, since a glyph
  // always plans as a glyph element and iconPlan() returns a tint in that mode. A separate
  // function, so a test can pin the invariant without a full render pass. ink already resolves to
  // the tint colour while the tint is on and to "" while it is off, so ibgOn and ibgAcc are not
  // consulted; they stay for the call sites' sake.
  function glyphInkAndFilter(plan, ibgOn, ibgAcc, ink, want) {
    if (plan.treat === "native") return { color: "", filter: "" };
    if (ink) return { color: ink, filter: "" };
    return { color: "", filter: want };
  }
  // Resolve ONE item to {filter, srcUrl}. `scope` namespaces the per-item pins so a
  // container and a VM of the same name keep separate settings.
  //  · a font glyph (<i>) is a glyph already: it inks, and it has no src to swap.
  //  · treat "flat"/"tint" fall back to native when there is no ink colour at all, which
  //    is how a user who never enabled the tint keeps untouched icons.
  function iconTreatment(scope, name, isGlyphEl, nativeSrc) {
    var CI = window.CCTheme && window.CCTheme.icons;
    if (!CI) return { treat: "tint", url: "" };
    var res = CI.result(name), kind = res ? res.kind : "";
    var mode = CI.mode(scope, name);
    // A font glyph is monochrome by construction: measure nothing, fetch nothing, ink it.
    var spread = isGlyphEl ? 0 : CI.spread(nativeSrc);
    var plan = CI.plan(mode, kind === "pending" ? "" : kind, spread);
    var url = "";
    if (!isGlyphEl && (plan.src === "glyph" || plan.src === "color")) url = CI.svgUrl(name);
    return { treat: plan.treat, url: url, why: plan.why };
  }
  function applyIconTint() {
    try {
      // With theming off the inline tint and sizing are reverted, so the icons render native and
      // a live toggle leaves no tinted, resized icons behind.
      if (!themingOn()) {
        var tt0 = tintTargets();
        for (var q = 0; q < tt0.length; q++) {
          var z = tt0[q];
          ["filter", "width", "height", "vertical-align", "margin", "object-fit", "font-size", "color"].forEach(function (p) { z.style.removeProperty(p); });
          if (z.parentNode && z.parentNode.style) ["display", "align-items", "align-self", "margin"].forEach(function (p) { z.parentNode.style.removeProperty(p); });
          if (z.tagName === "IMG") setIconSrc(z, "");   // back to the icon the container shipped with
        }
        document.documentElement.style.removeProperty("--cc-iconbg-color");
        ["cc-tint-svg", "cc-mono-svg", "cc-tint-svg-blk", "cc-tint-svg-wht", "cc-mono-svg-blk", "cc-mono-svg-wht"].forEach(function (id) { var h = document.getElementById(id); if (h) h.remove(); });
        return;
      }
      var named = tintTargetsNamed(), imgs = named.map(function (x) { return x.el; });
      // With cc.iconbg on, the icon sits on an accent-coloured box and is flattened to mono ink,
      // dark or white by the accent. An <img> takes the filter, a font glyph an !important text
      // colour, so the glyph itself inks.
      var ibgAcc = bgColor();
      var ibgOn = effc("iconbg") === "1";
      if (ibgOn && ibgAcc) document.documentElement.style.setProperty("--cc-iconbg-color", ibgAcc); else document.documentElement.style.removeProperty("--cc-iconbg-color");
      // With the adopt toggle on, idealText() answers only #161616 or #fff, so both ink filters
      // are built once, page-wide rather than per item, and each icon below picks whichever
      // matches its own resolved background through itemAdoptInk(), which reads the --cc-rb-ct
      // its card or row already carries. With the toggle off there is one filter, built from
      // iconInk()'s own picked colour, which may be any hue.
      var f, flat, fBlk, fWht, flatBlk, flatWht, adopt = iconBgAdopts();
      if (adopt) {
        flatBlk = ensureFlatFilter("cc-mono-svg-blk", "cc-mono-tint-blk", "#161616");
        flatWht = ensureFlatFilter("cc-mono-svg-wht", "cc-mono-tint-wht", "#fff");
        fBlk = ensureTintFilterAs("cc-tint-svg-blk", "cc-icon-tint-blk", "#161616") ? "url(#cc-icon-tint-blk)" : "";
        fWht = ensureTintFilterAs("cc-tint-svg-wht", "cc-icon-tint-wht", "#fff") ? "url(#cc-icon-tint-wht)" : "";
      } else {
        f = iconFilter();
        var ink = iconInk(false);
        flat = ink ? ensureFlatFilter("cc-mono-svg", "cc-mono-tint", ink) : ensureFlatFilter("cc-mono-svg", "cc-mono-tint", "");
      }
      // Every name on the page goes to the engine in one batch, which it answers from its cache
      // without blocking. A name it has not looked up yet stays native for this pass and repaints
      // through the callback init() wires.
      var CI = window.CCTheme && window.CCTheme.icons;
      if (CI) CI.want(named.map(function (x) { return x.name; }));
      // The same size contract as applySettings()'s --cc-logo-img: cc.sgsize through the shared
      // map, not a literal, because the inline !important write below outranks docker.css's own
      // --cc-logo-img rules.
      var lgImg = ccLogoSizes()[0];
      for (var i = 0; i < imgs.length; i++) {
        var n = imgs[i];
        var isGlyphEl = n.tagName !== "IMG";
        var plan = CI ? iconTreatment("docker", named[i].name, isGlyphEl, isGlyphEl ? "" : nativeIconSrc(n)) : { treat: "tint", url: "" };
        if (!isGlyphEl) setIconSrc(n, plan.url);
        // While adopting, this row's own ink and filters; otherwise the page-wide values.
        var thisFlat = flat, thisTint = f, thisInk = ink;
        if (adopt) {
          var rowInk = itemAdoptInk(n.closest("tr"));
          var rowBlk = rowInk !== "#fff";
          thisFlat = rowBlk ? flatBlk : flatWht;
          thisTint = rowBlk ? fBlk : fWht;
          thisInk = rowInk;
        }
        // "native", or no ink colour at all, leaves the pixels alone
        var want = plan.treat === "native" ? "" : (plan.treat === "flat" ? thisFlat : thisTint);
        if (n.tagName === "IMG") { n.style.filter = want; }
        else {
          var gif = glyphInkAndFilter(plan, ibgOn, ibgAcc, thisInk, want);
          if (gif.color) n.style.setProperty("color", gif.color, "important"); else n.style.removeProperty("color");
          n.style.filter = gif.filter;
        }
        // The size is written inline, because Unraid's theme beats this sheet on the real page
        // and the icons shrink back. It comes from cc.sgsize through ccLogoSizes(), so the list
        // follows the tile size like the grid, vms.js and plugins.js do.
        n.style.setProperty("width", lgImg, "important");
        n.style.setProperty("height", lgImg, "important");
        n.style.setProperty("vertical-align", "middle", "important");
        n.style.setProperty("margin", "0", "important");
        if (n.parentNode && n.parentNode.style) { n.parentNode.style.setProperty("display", "flex", "important"); n.parentNode.style.setProperty("align-items", "center", "important"); n.parentNode.style.setProperty("align-self", "center", "important"); n.parentNode.style.setProperty("margin", "0", "important"); }
        if (n.tagName === "IMG") n.style.setProperty("object-fit", "contain", "important");
        else n.style.setProperty("font-size", lgImg, "important");
      }
      // the grid runs the same pipeline as the rows, so one decision covers both layouts
      if (gridHolder) {
        var g = gridHolder.querySelectorAll("img.cc-card-ico");
        var gnames = [];
        for (var j = 0; j < g.length; j++) {
          var gn = g[j].getAttribute("data-cc-name") || "";
          gnames.push(gn);
          var gp = CI ? iconTreatment("docker", gn, false, nativeIconSrc(g[j])) : { treat: "tint", url: "" };
          setIconSrc(g[j], gp.url);
          var gFlat = flat, gTint = f;
          if (adopt) {
            var cardBlk = itemAdoptInk(g[j].closest(".cc-card")) !== "#fff";
            gFlat = cardBlk ? flatBlk : flatWht;
            gTint = cardBlk ? fBlk : fWht;
          }
          g[j].style.filter = gp.treat === "native" ? "" : (gp.treat === "flat" ? gFlat : gTint);
        }
        if (CI && gnames.length) CI.want(gnames);
      }
    } catch (e) {}
  }
  // The rotating rainbow: the mapping from badge kind to colour shifts by a shared offset, so
  // every area starts the palette on the same hue.
  var RB_KINDS = ["net", "ip", "lan", "port", "id", "von", "cpu", "ram", "bw", "version", "vol", "plan"];
  var RB_PAL = ["#d9433f", "#f97316", "#eab308", "#1f9d55", "#0ea5a4", "#2f6feb", "#8b5cf6", "#e05299"]; // red through to pink
  if (window.CCTheme) { idealText = window.CCTheme.idealText; RB_PAL = window.CCTheme.RB; }  /* the shared palette and contrast when CCTheme is loaded; the local copies are the fallback */
  var RB_OFFSET = window.CCTheme ? window.CCTheme.rbSeed(RB_PAL.length) : Math.floor(Math.random() * RB_PAL.length);
  // Flag mode reads the flag's own cc.flagpal and never cc.rbpal, so a flag does not repaint the
  // rainbow swatches and its colours do not leak onto the page once it is off. Every rainbow
  // reader below goes through this.
  function ccPalActive(def) { try { if (localStorage.getItem("cc.flagmode") === "1") { var f = JSON.parse(localStorage.getItem("cc.flagpal") || "null"); if (f && f.length) return f; } var p = JSON.parse(localStorage.getItem("cc.rbpal") || "null"); if (p && p.length) return p; } catch (e) {} return def; }
  function applyRainbowPalette() {
    var rt = document.documentElement;
    if (!themingOn() || localStorage.getItem("cc.rainbow") !== "1") { rt.style.removeProperty("--cc-btn-accent"); RB_KINDS.forEach(function (k) { rt.style.removeProperty("--cc-rb-" + k); rt.style.removeProperty("--cc-rb-" + k + "-t"); }); try { document.querySelectorAll("#docker_list tr.sortable").forEach(function (tr) { tr.style.removeProperty("--cc-rb-c"); tr.style.removeProperty("--cc-rb-ct"); }); } catch (e0) {} return; }
    // cc.rainbowrot, on by default; off pins the offset to 0 and the colours stay put
    var off = localStorage.getItem("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    // a palette edited on the settings page overrides the default
    var pal = ccPalActive(RB_PAL);
    // the toggles and the primary buttons share one palette slot
    rt.style.setProperty("--cc-btn-accent", pal[(5 + off) % pal.length]);
    RB_KINDS.forEach(function (k, i) {
      var c = pal[(i + off) % pal.length];
      var n = parseInt(c.slice(1), 16), L = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
      rt.style.setProperty("--cc-rb-" + k, c);
      rt.style.setProperty("--cc-rb-" + k + "-t", L > 150 ? "#161616" : "#fff"); // auto text contrast
    });
    // #13: docker rows are coloured per KIND (above), so a row carries no single colour for its logo TILE.
    // Stamp a per-row rotating --cc-rb-c so the tile can join the rainbow (docker.css gates the tile on
    // .cc-docker-iconbg.cc-rainbow). Mirrors the Plugins tab (plugins.js stamps --cc-rb-c per row).
    try {
      var rows2 = document.querySelectorAll("#docker_list tr.sortable");
      for (var ri = 0; ri < rows2.length; ri++) {
        var rc = pal[(ri + off) % pal.length], rn = parseInt(rc.slice(1), 16);
        var rL = 0.299 * (rn >> 16 & 255) + 0.587 * (rn >> 8 & 255) + 0.114 * (rn & 255);
        rows2[ri].style.setProperty("--cc-rb-c", rc); rows2[ri].style.setProperty("--cc-rb-ct", rL > 150 ? "#161616" : "#fff");
      }
    } catch (e1) {}
  }
  // The shared dropdown painter (cc-theme.js paintSelects): stamps the rotating --cc-rb-c/--cc-rb-ct on
  // every .cc-dsel/.cc-sel/.cc-drop option so the sheets' colour-mode chains have something to read.
  // A missed load order degrades to a flat-accent dropdown rather than throwing inside
  // applySettings().
  function paintSelects(root) { try { if (window.CCTheme && window.CCTheme.paintSelects) window.CCTheme.paintSelects(root); } catch (e) {} }
  function applySettings() {
    applyRainbowPalette();
    paintSelects();   // the dropdowns are painted from the same chokepoint as every other control
    try {
      // The page gate for docker.css's list rules. ctApply stamps it on the add and update forms,
      // so the list page has to stamp it too, or html.cc-docker-on never matches and the reactive
      // rest-grey never applies.
      document.documentElement.classList.toggle("cc-docker-on", themingOn() && localStorage.getItem("cc.enable.docker") !== "0");
      var root = document.documentElement.style;
      var accent = effc("accent"); if (accent) { root.setProperty("--cc-accent", accent); root.setProperty("--cc-accent-text", idealText(accent)); }
      root.setProperty("--cc-b-radius", ({ pill: "999px", rounded: "6px", square: "0px", circle: "999px" })[localStorage.getItem("cc.badgeshape") || "pill"] || "999px");
      var dens = localStorage.getItem("cc.density"); root.setProperty("--cc-density", { compact: "5px", normal: "9px", airy: "14px" }[dens] || "9px");
      // cc.sgsize, shared with the settings grid, drives the logo tile as [img, box] per step,
      // where box minus img is twice the tile's padding
      var lg = ccLogoSizes();
      root.setProperty("--cc-logo-img", lg[0]); root.setProperty("--cc-logo-box", lg[1]);
      // The colour for ShipLog's update-all button, restyled to match the badges. It goes on
      // documentElement so it reaches .ToggleViewMode, which sits outside the enhanced table.
      var ub = localStorage.getItem("cc.rainbow") === "1" ? "#1f9d55" : (accent || "#2f6feb");
      root.setProperty("--cc-updall-bg", ub); root.setProperty("--cc-updall-text", idealText(ub));
      colview = loadColview();
    } catch (e) {}
  }

  // The classes that drive the cell-to-pill styling. Toggling one turns that badge kind on or off
  // for the current view, per the visibility matrix, and they also carry the rainbow and icon
  // tint modes chosen on the settings page.
  function applyEnhanceClasses() {
    try {
      var tb = nativeTable(); if (!tb || tb.tagName !== "TABLE") return;
      tb.classList.add("cc-enh"); tb.classList.toggle("cc-adv", isAdvancedView());
      tb.classList.toggle("cc-rainbow", localStorage.getItem("cc.rainbow") === "1");
      tb.classList.toggle("cc-tint-icons", !!effc("iconcolor"));
      tb.classList.toggle("cc-docker-iconbg", iconBgOn());
      // The density is a class as well as the --cc-density padding: the row height is mostly
      // badge content, so compact and airy also change the badge spacing.
      var dens = localStorage.getItem("cc.density") || "normal";
      ["compact", "normal", "airy"].forEach(function (d) { tb.classList.toggle("cc-dens-" + d, dens === d); });
      COLS.forEach(function (c) { tb.classList.toggle("cc-c-" + c.key, colOn(c.key)); });
      applyIconTint();
    } catch (e) {}
  }
  function removeEnhanceClasses() { try { var tb = nativeTable(); if (!tb) return; tb.classList.remove("cc-enh", "cc-adv", "cc-rainbow", "cc-tint-icons", "cc-docker-iconbg", "cc-dens-compact", "cc-dens-normal", "cc-dens-airy"); COLS.forEach(function (c) { tb.classList.remove("cc-c-" + c.key); }); var t2 = tintTargets(); for (var i = 0; i < t2.length; i++) { t2[i].style.filter = ""; if (t2[i].tagName === "IMG") setIconSrc(t2[i], ""); } if (gridHolder) Array.prototype.slice.call(gridHolder.querySelectorAll("img.cc-card-ico")).forEach(function (n) { n.style.filter = ""; setIconSrc(n, ""); }); Array.prototype.slice.call(document.querySelectorAll(".cc-ico-tint")).forEach(function (n) { n.remove(); }); ["cc-tint-svg", "cc-mono-svg", "cc-tint-svg-blk", "cc-tint-svg-wht", "cc-mono-svg-blk", "cc-mono-svg-wht"].forEach(function (id) { var h2 = document.getElementById(id); if (h2) h2.remove(); }); } catch (e) {} }

  // reads a positional cell's docker_readmore value, dropping the nested advanced block and the
  // Tailscale tooltip and collapsing it to one short line
  function readmoreText(tr, n) {
    try {
      var cell = tr.querySelector(":scope > td:nth-child(" + n + ")"); if (!cell) return "";
      var rm = cell.querySelector("span.docker_readmore") || cell;
      var clone = rm.cloneNode(true);
      Array.prototype.slice.call(clone.querySelectorAll(".advanced, .TS_tooltip, script, style")).forEach(function (x) { x.remove(); });
      return (clone.textContent || "").trim().replace(/\s+/g, " ").slice(0, 42);
    } catch (e) { return ""; }
  }

  // The rainbow colours for the bottom action bar's native buttons. The CSS gives them the
  // accent; the per-button palette colours have to be stamped here.
  function colorBarButtons() {
    try {
      var bar = document.querySelector("div.js-actions"); if (!bar) return;
      // The Mehrfachauswahl badge joins the rotation: querySelectorAll returns DOM order and
      // ensureBulkModeBadge parks it beside the container-size button, so it takes the next slot
      // in the sequence.
      var btns = bar.querySelectorAll("input[type=button], .cc-bulkmode-badge");
      if (!themingOn() || localStorage.getItem("cc.rainbow") !== "1") { Array.prototype.slice.call(btns).forEach(function (b) { b.style.removeProperty("background"); b.style.removeProperty("color"); b.style.removeProperty("--cc-rb-c"); b.style.removeProperty("--cc-rb-ct"); }); return; }
      var pal = ccPalActive(RB_PAL);
      var off = localStorage.getItem("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
      // In the reactive sub-mode the CSS rests the buttons grey and colours them on hover, so
      // this only stamps the vars: an inline !important background would beat any sheet rule.
      var neutral = localStorage.getItem("cc.rbmode") === "active";
      Array.prototype.slice.call(btns).forEach(function (b, i) {
        var c = pal[(i + off) % pal.length];
        b.style.setProperty("--cc-rb-c", c); b.style.setProperty("--cc-rb-ct", idealText(c));
        // A pressed Mehrfachauswahl badge takes no inline paint: that would bury
        // .cc-bulkmode-badge-on and the toggle would look the same on and off. The vars above are
        // still stamped, so the on-state resolves --cc-rb-c to this button's own slot.
        if (neutral || b.classList.contains("cc-bulkmode-badge-on")) { b.style.removeProperty("background"); b.style.removeProperty("color"); }
        else { b.style.setProperty("background", c, "important"); b.style.setProperty("color", idealText(c), "important"); }
      });
    } catch (e) {}
  }
  // The per-line hover marquee for the volumes column. The native cell is one
  // span.docker_readmore whose lines are separated by <br>, so each line is wrapped and moved
  // far enough to read the whole path and back, on its own hover.
  function setupVolMarquee(tr, c) {
    try {
      if (!c || !c.mounts || !c.mounts.length) return;
      // The volumes column is found by its header text rather than a fixed nth-child, which
      // survives hidden columns and the inserted actions column.
      var tbl = tr.closest("table");
      var ths = tbl ? tbl.querySelectorAll("thead tr:last-child > th") : [];
      var idx = -1;
      for (var i = 0; i < ths.length; i++) { if (/volum/i.test(ths[i].textContent || "")) { idx = i; break; } }
      var cell = idx >= 0 ? tr.children[idx] : tr.querySelector(":scope > td:nth-child(8)");
      if (!cell || cell.getAttribute("data-cc-vm") === "1") return;
      cell.setAttribute("data-cc-vm", "1");
      // The cell is rebuilt from CC's own mount data, which readmore cannot undo, and each line
      // gets its own hover, so only the hovered one scrolls.
      var host = el("div", "cc-volmarq");
      c.mounts.forEach(function (m) {
        var w = el("span", "cc-vline"), t = el("span", "cc-vtext");
        t.textContent = (m.source || "") + " \u2194 " + (m.dest || "") + (m.rw ? "" : " (ro)");
        w.appendChild(t); host.appendChild(w);
        var iv = null;
        w.addEventListener("mouseenter", function () {
          var over = t.scrollWidth - w.clientWidth; if (over <= 2) return;
          var dur = Math.max(1000, Math.round(over / 55 * 1000)), toEnd = true;
          t.style.transition = "transform " + (dur / 1000) + "s linear"; t.style.transform = "translateX(-" + over + "px)";
          iv = setInterval(function () { if (!t.isConnected) { clearInterval(iv); return; } toEnd = !toEnd; t.style.transform = "translateX(" + (toEnd ? -over : 0) + "px)"; }, dur + 700);
        });
        w.addEventListener("mouseleave", function () {
          if (iv) { clearInterval(iv); iv = null; }
          t.style.transition = "transform .3s ease"; t.style.transform = "translateX(0)";
        });
      });
      cell.innerHTML = ""; cell.appendChild(host);
    } catch (e) {}
  }
  function injectRowBadges(tr) {
    try {
      if (tr.getAttribute(ROWMARK)) return;
      tr.setAttribute(ROWMARK, "1");
      // A rotating colour per row, so the logo tile can join the rainbow: the Docker badges are
      // coloured per kind, so a row carries no single colour of its own. It runs here, once the
      // row exists and on every reinject, since a rainbow toggle clears ROWMARK, and it is
      // removed while the rainbow is off. The index is the row's position.
      try {
        if (themingOn() && localStorage.getItem("cc.rainbow") === "1") {
          var _pp = tr.parentNode, _ix = _pp ? Array.prototype.indexOf.call(_pp.querySelectorAll("tr.sortable"), tr) : 0; if (_ix < 0) _ix = 0;
          var _of = localStorage.getItem("cc.rainbowrot") === "0" ? 0 : RB_OFFSET, _pl = ccPalActive(RB_PAL);
          var _c = _pl[(_ix + _of) % _pl.length], _n = parseInt(_c.slice(1), 16), _L = 0.299 * (_n >> 16 & 255) + 0.587 * (_n >> 8 & 255) + 0.114 * (_n & 255);
          tr.style.setProperty("--cc-rb-c", _c); tr.style.setProperty("--cc-rb-ct", _L > 150 ? "#161616" : "#fff");
        } else { tr.style.removeProperty("--cc-rb-c"); tr.style.removeProperty("--cc-rb-ct"); }
      } catch (_eR) {}
      var name = rowName(tr);
      if (filterText) tr.style.display = (norm(name).indexOf(filterText) >= 0) ? "" : "none";
      var nameCell = tr.querySelector("td.ct-name"), upCell = tr.querySelector("td.updatecolumn");
      // The bulk-select checkbox, for starting, stopping or removing several containers at once.
      // It sits before the theming gate, being functional rather than cosmetic, and goes in as
      // the first flex child of .outer, so it pushes the icon right without absolute positioning
      // and without a new cell that would shift every nth-child offset used below.
      var outerEl = nameCell && nameCell.querySelector(".outer");
      if (outerEl && !outerEl.querySelector(".cc-bulk-cb")) {
        var bcb = el("input", "cc-bulk-cb"); bcb.type = "checkbox"; bcb.setAttribute(MARK, "1");
        bcb.checked = !!ccBulkSel[name];
        bcb.addEventListener("click", function (e) { e.stopPropagation(); });
        bcb.addEventListener("change", function () {
          if (bcb.checked) { var cx0 = ctxFor(name, tr); ccBulkSel[name] = { id: cx0.id, image: cx0.image }; }
          else delete ccBulkSel[name];
          ccBulkBarSync();
        });
        outerEl.insertBefore(bcb, outerEl.firstChild);
      }
      // The row centring is cosmetic, so it happens only with theming on; the orchestration
      // controls below inject either way.
      if (themingOn()) {
        // Every cell's content is centred inline, because Unraid's own td vertical-align beats
        // the stylesheet.
        Array.prototype.slice.call(tr.children).forEach(function (td2) { td2.style.setProperty("vertical-align", "middle", "important"); });
        // Unraid can give .outer a full height with top alignment, which pins the logo to the top
        // of the row even with the cell centred. Stray direct children of td.ct-name below it, a
        // <br>, a spinner or state text on some builds, add invisible height and do the same.
        if (nameCell) Array.prototype.slice.call(nameCell.children).forEach(function (chn) { if (!chn.classList || !chn.classList.contains("outer")) chn.style.setProperty("display", "none", "important"); });
        var outerBox = nameCell && nameCell.querySelector(".outer");
        if (outerBox) { outerBox.style.setProperty("display", "flex", "important"); outerBox.style.setProperty("align-items", "center", "important"); outerBox.style.setProperty("height", "auto", "important"); }
      }
      var adv = isAdvancedView(), c = containerByName(name);
      // The actions cell has to exist before any nth-child lookup below, because it sits at
      // position 2 and shifts every later column by one.
      injectActionCell(tr, name, c);
      if (themingOn()) setupVolMarquee(tr, c); // cosmetic, and after the actions cell, so the header and row indexes line up

      // The name cell: the start/stop badge, with the container id and author under it.
      if (nameCell) {
        var glyph = nameCell.querySelector(".inner i[id^='load-']");
        var st = (c && c.state) || glyphState(glyph) || "unknown";
        var meta = el("div", "cc-namemeta"); meta.setAttribute(MARK, "1");
        // Under the name sits a colour dot on its own row, not a clickable toggle: its hover
        // shows the current state, which syncStateBadges keeps live, and a click flashes the
        // action icons, since the name-click handler matches .cc-ct-dotrow too. The CSS is keyed
        // on .cc-ct-dotrow > .cc-badge, so the state poll's className rewrite cannot strip the
        // dot's look, and font-size:0 hides the status text. With theming off the meta row gets
        // the clickable state pill instead.
        var innerEl0 = nameCell.querySelector(".inner") || nameCell, appnameEl = innerEl0.querySelector("span.appname");
        if (themingOn() && appnameEl) {
          var dot = el("span", "cc-badge cc-badge-" + st + " cc-ct-statedot" + (showUnhealthy(c) ? " cc-badge-alert" : ""));
          dot.dataset.name = name;
          dot.setAttribute("data-tip", showUnhealthy(c) ? unhealthyTip() : stateLabel(st));
          var drow = innerEl0.querySelector(".cc-ct-dotrow");
          if (!drow) { drow = el("div", "cc-ct-dotrow"); drow.setAttribute(MARK, "1"); if (appnameEl.nextSibling) appnameEl.parentNode.insertBefore(drow, appnameEl.nextSibling); else appnameEl.parentNode.appendChild(drow); }
          drow.appendChild(dot);
        } else {
          var sb = stateToggle(name, st); if (showUnhealthy(c)) { sb.classList.add("cc-badge-alert"); sb.textContent = stateLabel(st) + " ✕"; sb.setAttribute("data-tip", unhealthyTip()); }
          meta.appendChild(sb);
        }
        // the id, author and volume badges are decorative, so theming has to be on
        if (themingOn()) {
          var advDiv = nameCell.querySelector(":scope > div.advanced");
          var idrow = el("div", "cc-namemeta-ids"), added = false, hideAdv = false;
          if (advDiv) {
            if (colOn("id")) { var cid = readContainerId(advDiv); if (cid) { idrow.appendChild(badgeInfo("ID", cid.slice(0, 12), "id")); added = true; hideAdv = true; } }
            if (colOn("von")) { var a = advDiv.querySelector("a[target='_blank']"); if (a && a.textContent.trim()) { var vb = badgeInfo("Von", a.textContent.trim(), "von"); var hf = a.getAttribute("href") || ""; if (hf) vb.setAttribute("data-tip", hf); idrow.appendChild(vb); added = true; hideAdv = true; } }
          }
          // The volumes come from the engine's mount data, so they show for a stopped container
          // too, which has no native advanced block. One badge carries the count, with every
          // source and destination in its tooltip.
          if (colOn("vol") && c && c.mounts && c.mounts.length) {
            var volB = badgeInfo("Volumes", String(c.mounts.length), "vol");
            volB.setAttribute("data-tip", c.mounts.map(function (m) { return m.source + " → " + m.dest + (m.rw ? "" : " (ro)"); }).join("\n"));
            idrow.appendChild(volB); added = true;
          }
          if (added) { if (hideAdv && advDiv) advDiv.classList.add("cc-hidden"); meta.appendChild(idrow); }
        }
        var inner = nameCell.querySelector(".inner") || nameCell; inner.appendChild(meta);
      }

      // The live CPU and RAM values come from the engine as badges, so they show in the simple
      // view too, where Unraid leaves the native resource cell empty, each with a gear for its
      // own limit editor. The CSS hides the native cell.
      if (colOn("res")) {
        var resCell = tr.querySelector(":scope > td:nth-child(9)") || tr.querySelector(":scope > td.advanced"); // the actions column at position 2 shifts this by one
        if (resCell && !resCell.querySelector(".cc-resgroup")) {
          var rg = el("div", "cc-rowbadges cc-resgroup"); rg.setAttribute(MARK, "1"); rg.dataset.name = name;
          var lm = limits[name] || {};
          var cpuSet = cpuLimited(lm) || cpuPinned(lm), ramSet = ramLimited(lm);
          // CPU, RAM and bandwidth each get a .cc-resline of their own, so the three sit one
          // under the other. They carry no status dot: the gear turning green already says a
          // limit is set.
          var cpuB = badgeInfo("CPU", "…", "cpu");
          rg.appendChild(resLine(cpuB, limGear(name, "cpu", cpuSet)));
          var ramB = badgeInfo("RAM", "…", "ram");
          rg.appendChild(resLine(ramB, limGear(name, "ram", ramSet)));
          var bw = bandwidthFor(name), bwSet = bwHasLimit(bw);
          // the value is the live rate, which updateResGroup fills in, and the configured caps
          // sit in the tooltip
          var bwB = badgeInfo("BW", "…", "bw"); bwB.setAttribute("data-tip", t("bandwidth") + " " + bwTitle(bw));
          rg.appendChild(resLine(bwB, bwGear(name, bwSet)));
          updateResGroup(rg, stats[name], c && c.state);
          resCell.appendChild(rg);
        }
      }

      // The version cell: the image tag as a badge, advanced view only, plus the last run. The
      // tag text is read out of Unraid's native div.advanced, which is then hidden, so the tag
      // never leaks into the simple view and always renders as a badge.
      if (upCell) {
        var vh = el("div", "cc-rowbadges"); vh.setAttribute(MARK, "1");
        // The tag badge, hiding the native tag text and restyling the update button are all
        // decorative, so with theming off Unraid's own version and update column shows unchanged.
        if (themingOn()) {
          var advs = upCell.querySelectorAll(":scope > div.advanced");
          var tagDiv = null; // the last advanced div without an action link holds the image tag
          for (var ai = advs.length - 1; ai >= 0; ai--) { if (!advs[ai].querySelector("a.exec, span.orange-text, span.green-text")) { tagDiv = advs[ai]; break; } }
          var tagTxt = tagDiv ? tagDiv.textContent.replace(/\s+/g, " ").trim() : "";
          // Only the text advanced divs are hidden, the image tag that is re-rendered as a badge,
          // never the one carrying the force-update link, or that badge could never show.
          Array.prototype.forEach.call(advs, function (d) { if (!d.querySelector("a.exec")) d.classList.add("cc-hidden"); });
          // The apply-update link, a top-level a.exec rather than one inside an advanced div,
          // gets its pill inline: some builds have no nested orange-text span, so the :has()
          // rule never fires and only bare text shows. With the native state colours on it keeps
          // its amber; with them off it joins the colour mode. injectAllRowBadges computes
          // ccUpBg and ccUpFg once per pass.
          Array.prototype.slice.call(upCell.querySelectorAll("a.exec")).forEach(function (ax) {
            if (ax.closest("div.advanced")) return;
            ax.style.setProperty("background", ccUpBg, "important");
            ax.style.setProperty("color", ccUpFg, "important");
            ax.style.setProperty("display", "inline-flex", "important");
            ax.style.setProperty("align-items", "center", "important");
          });
          if (colOn("version") && tagTxt) vh.appendChild(badgeInfo("Tag", tagTxt, "version"));
          // The third-party version status: Unraid's class-less span, an icon with text, becomes
          // a neutral badge matching the changelog chip under it. Only classes are added, no DOM
          // is moved, and clearRowBadges strips them again.
          Array.prototype.slice.call(upCell.querySelectorAll("span > i.fa-docker")).forEach(function (fi) { fi.parentElement.classList.add("cc-b", "cc-3p"); });
        }
        var p = lastRunPill(name); if (p) vh.appendChild(p); // the last plan run is orchestration status, so it shows with theming off too
        if (vh.children.length) upCell.appendChild(vh);
      }

      // The network group, which gathers the network, container IP, LAN IP and port into one
      // cell. These are decorative badges, so with theming off the native network cell stays.
      // The four are independent columns, each with its own simple and advanced visibility, so
      // each badge is gated on its own colOn().
      if (themingOn() && (colOn("net") || colOn("ip") || colOn("lan") || colOn("port"))) {
        var c3 = tr.querySelector(":scope > td:nth-child(4)"); // the actions column shifts this by one
        if (c3) {
          var netTxt = readmoreText(tr, 4), ipTxt = readmoreText(tr, 5), portTxt = readmoreText(tr, 6), lanTxt = readmoreText(tr, 7);
          // A stopped container has no runtime IP in the native cell, so the engine's value, the
          // configured static IP, which survives a stop, fills in.
          if (!ipTxt && c && c.ip) ipTxt = c.ip;
          if (!netTxt && c && c.network) netTxt = c.network;
          // it reports no ports natively either, so the engine's configured HostConfig.PortBindings do
          if (!portTxt && c && c.ports && c.ports.length) portTxt = c.ports.join(" ");
          // On a macvlan or ipvlan the container's static IP is its LAN IP, so it shows for a
          // stopped container too, where the native LAN cell is empty. Only for a real host
          // interface: a custom docker bridge IP is not LAN-reachable.
          if (!lanTxt && c && c.ip && isMacvlan(c)) lanTxt = c.ip;
          var g = el("div", "cc-rowbadges cc-netgroup"); g.setAttribute(MARK, "1");
          if (netTxt && colOn("net")) { g.appendChild(badgeInfo("Netzwerk", netTxt, "net")); }
          if (ipTxt && colOn("ip")) g.appendChild(badgeInfo("Container IP", ipTxt, "ip"));
          if (lanTxt && colOn("lan")) g.appendChild(badgeInfo("LAN IP", lanTxt, "lan"));
          if (portTxt && colOn("port")) g.appendChild(badgeInfo("Port", portTxt, "port"));
          var nrm = c3.querySelector("span.docker_readmore"); if (nrm && colOn("net")) nrm.classList.add("cc-hidden"); // the native network name stays when only its badge is off
          if (g.children.length) c3.appendChild(g);
        }
      }

      // The plan chip goes into the autostart cell, beside the native autostart toggle.
      if (colOn("plan")) {
        var c9 = tr.querySelector(":scope > td:nth-child(10)"); // the actions column shifts this by one
        if (c9) {
          var ph = el("div", "cc-rowbadges cc-planholder"); ph.setAttribute(MARK, "1"); ph.appendChild(planBadge(name));
          // The readiness dot uses the same .cc-ct-dotrow recipe as the one under the name, but
          // beside the chip rather than below a line of text, so its row drops the top margin
          // that context needs; ph is already inline-flex and centred.
          var depDot = depStateDot(name);
          if (depDot) { var ddr = el("span", "cc-ct-dotrow"); ddr.style.setProperty("margin-top", "0", "important"); ddr.appendChild(depDot); ph.appendChild(ddr); }
          // The gap between the toggle and the chip matches the one between the CPU and RAM
          // badges, written inline, and the stray <br>s in the native autostart cell that would
          // inflate it are switched off.
          ph.style.setProperty("margin", "5px 0 0 0", "important");
          Array.prototype.slice.call(c9.querySelectorAll("br")).forEach(function (b2) { b2.style.setProperty("display", "none", "important"); });
          c9.appendChild(ph);
        }
      }

      // A container whose Docker restart policy is "no" does not auto-start after a host reboot,
      // which shows as a warning badge beside the plan chip in the autostart cell.
      if (colOn("restart")) {
        var lmR = limits[name];
        if (lmR && lmR.restart_policy === "no") {
          var c9r = tr.querySelector(":scope > td:nth-child(10)"); // the actions column shifts this by one
          if (c9r && !c9r.querySelector(".cc-restwarn")) {
            var rwh = el("div", "cc-rowbadges cc-restwarn"); rwh.setAttribute(MARK, "1");
            rwh.appendChild(restartWarnBadge());
            rwh.style.setProperty("margin", "5px 0 0 0", "important");
            c9r.appendChild(rwh);
          }
        }
      }

      // The group label in the autostart cell of a group's first row arrives as a bare text node
      // and an icon directly in the cell, inline before the plan holder, which pushes that row's
      // plan chip to the right. Wrapping the two into a block-level badge puts it on its own
      // line. The wrapper carries no MARK, since that sweep would destroy the native nodes
      // inside it; clearRowBadges unwraps it instead.
      if (themingOn()) {
        var c9b = tr.querySelector(":scope > td:nth-child(10)");
        if (c9b && !c9b.querySelector(":scope > span.cc-grp")) {
          var gi = c9b.querySelector(":scope > i.fa");
          var gt = null;
          for (var gn = 0; gn < c9b.childNodes.length; gn++) { var nd0 = c9b.childNodes[gn]; if (nd0.nodeType === 3 && nd0.textContent.replace(/\s+/g, "")) { gt = nd0; break; } }
          if (gi && gt) { var gb = el("span", "cc-b cc-grp"); c9b.insertBefore(gb, gi); gb.appendChild(gi); gb.appendChild(gt); }
        }
      }
    } catch (e) { /* one bad row must not break Unraid's page */ }
  }
  // The per-container context data, read from the row's own onclick attribute:
  // DockerContainers.php puts addDockerContainerContext('name','image','template',started,paused,
  // update,autostart,'webui','tswebui','shell','id','support','project','registry','donate',
  // 'readme') on the icon's span.hand. It is a plain DOM attribute and nothing runs at render
  // time, which is why wrapping the function harvests nothing until the icon is clicked, and that
  // click is blocked here, so the quoted tokens are parsed positionally instead.
  //
  // `tr` is optional but worth passing: every list-view caller already holds the row, and
  // re-finding it means a table-wide query and a linear scan per call, which makes building the
  // actions column quadratic in the number of rows and runs again on each tbody replace. The
  // by-name fallback stays for card(), where the grid has no row to hand in.
  function ctxFor(name, tr) {
    var out = { webui: "", tswebui: "", xml: "", shell: "", image: "", id: "", links: [] };
    try {
      var row = tr || null;
      if (!row) { var rows = findRows(); for (var i2 = 0; i2 < rows.length; i2++) { if (rowName(rows[i2]) === name) { row = rows[i2]; break; } } }
      var hand = row ? row.querySelector("td.ct-name span.hand[onclick]") : null;
      var oc = hand ? (hand.getAttribute("onclick") || "") : "";
      var m3 = oc.match(/addDockerContainerContext\s*\(([\s\S]*)\)/);
      if (!m3) return out;
      var toks = m3[1].match(/'(?:[^'\\]|\\.)*'/g) || [];
      var q = toks.map(function (s2) { return s2.slice(1, -1).replace(/\\(.)/g, "$1"); });
      // quoted-token order (the numeric args carry no quotes and drop out):
      // name image template webui tswebui shell id support project registry donate readme
      var off = q.length >= 12 ? 0 : -1; // an older Unraid build has no tswebui slot
      var xml = q[2] || "", webui = q[3] || "", ts = off === 0 ? (q[4] || "") : "";
      out.image = q[1] || ""; out.id = q[6 + off] || ""; // the native remove dialog needs both
      out.shell = q[5 + off] || "";
      if (webui && webui !== "#") out.webui = webui;
      if (ts && ts !== "#") out.tswebui = ts;
      if (/\.xml$/i.test(xml)) out.xml = xml;
      var L = LANG === "de";
      [[q[7 + off], "Support", "fa-question"],
       [q[8 + off], L ? "Projektseite" : "Project page", "fa-life-ring"],
       [q[9 + off], L ? "Mehr Infos" : "More info", "fa-info-circle"],
       [q[10 + off], L ? "Spenden" : "Donate", "fa-external-link"],
       [q[11 + off], L ? "Zuerst lesen" : "Read me first", "fa-book"]].forEach(function (l2) {
        if (l2[0] && l2[0].indexOf("://") > 0) out.links.push({ url: l2[0], tip: l2[1], glyph: l2[2] });
      });
    } catch (e) {}
    return out;
  }
  // One action icon, with its name as the tooltip. The glyphs are FontAwesome rather than emoji,
  // which ignore a CSS colour, so the icon inherits black or white against its background like
  // the badge text does.
  function actBtn(icon, tip, fn) {
    var b = el("span", "cc-actbtn"); b.setAttribute("data-tip", tip); b.appendChild(el("i", "fa " + icon));
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    return b;
  }
  // greyed placeholder: an action without a target still occupies its slot,
  // so every row shows the same stable icon block
  function actBtnOff(icon, tip) { var b = el("span", "cc-actbtn cc-actoff", ""); b.setAttribute("data-tip", tip); b.appendChild(el("i", "fa " + icon)); return b; }
  // rainbow: every action icon takes a rotating palette colour (falls back to grey);
  // disabled placeholders stay grey
  // Icons follow THE CONFIGURED ACCENT COLOUR, exactly like the badges (user call):
  // normal mode = cc.accent, rainbow mode = the rainbow palette. cc.actcolors = "0"
  // turns the colours off (grey buttons) via the gear menu. Colours are computed
  // directly (no CSS-var indirection) with auto black/white glyphs.
  function tintAct(bar) {
    var colorsOn = localStorage.getItem("cc.actcolors") !== "0";
    var rb = themingOn() && localStorage.getItem("cc.rainbow") === "1"; // rainbow is theming; accent/legibility tint stays
    var pal = ccPalActive(RB_PAL);
    var off = localStorage.getItem("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    Array.prototype.slice.call(bar.querySelectorAll(".cc-actbtn")).forEach(function (b2, i2) {
      var bg = "#2e2e2e", tx = "#7a7a7a";
      if (!b2.classList.contains("cc-actoff")) {
        tx = "#e9e9e9";
        if (colorsOn) {
          bg = rb ? pal[(i2 + off) % pal.length] : (effc("accent") || "#2f6feb");
          var n2 = parseInt(String(bg).replace("#", ""), 16), L2 = 0.299 * (n2 >> 16 & 255) + 0.587 * (n2 >> 8 & 255) + 0.114 * (n2 & 255);
          tx = L2 > 150 ? "#161616" : "#fff";
        }
      }
      // In the reactive sub-mode the CSS rests the coloured buttons grey and colours them on
      // hover from the stamped vars, which an inline !important would make impossible.
      var neutral = rb && localStorage.getItem("cc.rbmode") === "active";
      if (neutral && colorsOn && !b2.classList.contains("cc-actoff")) {
        b2.style.setProperty("--cc-rb-c", bg); b2.style.setProperty("--cc-rb-ct", tx);
        b2.style.removeProperty("background"); b2.style.removeProperty("color");
      } else {
        b2.style.removeProperty("--cc-rb-c"); b2.style.removeProperty("--cc-rb-ct");
        b2.style.setProperty("background", bg, "important");
        b2.style.setProperty("color", tx, "important");
      }
      // Unraid's theme styles .fa glyphs directly, which beats inheritance
      var ic2 = b2.querySelector("i"); if (ic2) ic2.style.setProperty("color", "inherit", "important");
    });
  }
  // Both views share the action block: the first row holds the web UI, the log and the edit
  // action, the second the restart, pause and stop, with an expander for the harvested links.
  function actionBars(name, c, tr) {
    var cx = ctxFor(name, tr);
    var bar = el("div", "cc-actbar");
    var running = c && c.state === "running", paused = c && c.state === "paused";
    var r1 = el("div", "cc-actrow");
    r1.appendChild(cx.webui ? actBtn("fa-globe", "WebUI", function () { window.open(cx.webui, "_blank"); }) : actBtnOff("fa-globe", LANG === "de" ? "kein WebUI" : "no WebUI"));
    r1.appendChild(typeof window.openTerminal === "function" ? actBtn("fa-navicon", "Log", function () { window.openTerminal("docker", name, ".log"); }) : actBtnOff("fa-navicon", "Log"));
    r1.appendChild(cx.xml ? actBtn("fa-wrench", LANG === "de" ? "Bearbeiten" : "Edit", function () {
      // what Unraid's own editContainer() does; the template path stays unencoded
      var p2 = location.pathname, x2 = p2.indexOf("?"); if (x2 !== -1) p2 = p2.substring(0, x2);
      location.href = p2 + "/UpdateContainer?xmlTemplate=edit:" + cx.xml;
    }) : actBtnOff("fa-wrench", LANG === "de" ? "kein Template" : "no template"));
    var r2 = el("div", "cc-actrow");
    r2.appendChild(actBtn("fa-refresh", t("restart"), function () { doAction(name, "restart"); }));
    r2.appendChild(paused ? actBtn("fa-play", t("resume"), function () { doAction(name, "unpause"); })
      : (running ? actBtn("fa-pause", t("pause"), function () { doAction(name, "pause"); }) : actBtnOff("fa-pause", t("pause"))));
    r2.appendChild(actBtn(running || paused ? "fa-stop" : "fa-play", running || paused ? t("stop") : t("start"), function () { var cc2 = containerByName(name); doAction(name, cc2 && (cc2.state === "running" || cc2.state === "paused") ? "stop" : "start"); }));
    var more = el("div", "cc-actrow cc-actmore");
    if (typeof window.openTerminal === "function") more.appendChild(actBtn("fa-terminal", LANG === "de" ? "Konsole" : "Console", function () { if (cx.shell) window.openTerminal("docker", name, cx.shell); else window.openTerminal("docker", name); }));
    // Remove sits behind the second click, and goes through Unraid's own confirm dialog.
    if (typeof window.rmContainer === "function" && cx.id) more.appendChild(actBtn("fa-trash", LANG === "de" ? "Entfernen" : "Remove", function () { window.rmContainer(name, cx.image, cx.id); }));
    if (cx.tswebui) more.appendChild(actBtn("fa-globe", "Tailscale WebUI", function () { window.open(cx.tswebui, "_blank"); }));
    cx.links.forEach(function (l2) { more.appendChild(actBtn(l2.glyph, l2.tip, function () { window.open(l2.url, "_blank"); })); });
    if (more.children.length) {
      var moreBtn = actBtn("fa-ellipsis-h", LANG === "de" ? "Mehr" : "More", function () { bar.classList.add("cc-open"); tintAct(bar); });
      moreBtn.classList.add("cc-acttoggle");   // the expander is the fourth icon of row 2 and hides once the bar is open
      r2.appendChild(moreBtn);
    } else {
      r2.appendChild(actBtnOff("fa-ellipsis-h", LANG === "de" ? "keine weiteren Links" : "no more links"));
    }
    // Three icons per row, with the expander as the fourth of the second. Clicking it fades the
    // harvested extras in, three per row, and the cluster collapses again on mouseleave.
    bar.appendChild(r1); bar.appendChild(r2); bar.appendChild(more);
    bar.addEventListener("mouseleave", function () { if (bar.classList.contains("cc-open")) { bar.classList.remove("cc-open"); tintAct(bar); } });
    tintAct(bar);
    return { bar: bar, more: more, sig: cx.webui + "|" + cx.xml + "|" + cx.tswebui + "|" + cx.links.length };
  }
  function injectActionCell(tr, name, c) {
    try {
      var hr2 = headerRow();
      if (hr2 && !hr2.querySelector(".cc-act-th")) { var th2 = el("th", "cc-act-th", LANG === "de" ? "Aktionen" : "Actions"); hr2.insertBefore(th2, hr2.children[1] || null); }
      var ab = actionBars(name, c, tr);
      var old2 = tr.querySelector(".cc-actcell");
      if (old2) { if (old2.dataset.ccSig === ab.sig) return; old2.remove(); } // rebuild once the data changed
      var tda = el("td", "cc-actcell"); tda.setAttribute(MARK, "1"); tda.dataset.ccSig = ab.sig;
      tda.style.setProperty("vertical-align", "middle", "important");
      tda.appendChild(ab.bar); // ab.more sits inside ab.bar and flows into the grid on expand
      tr.insertBefore(tda, tr.children[1] || null); // between the name and the version column
    } catch (e) {}
  }
  // Measures Unraid's always-visible footer, so the docked action bar, which CSS puts at
  // bottom: var(--cc-footer-h), sits on top of it. It docks only where #footer is genuinely
  // fixed; on a narrow portrait viewport the footer flows in the document and the bar has to
  // flow too, which clearing the var lets the media query do.
  function syncFooterDock() {
    try {
      // All the reads come first and the writes after, because a read following a write forces a
      // fresh synchronous layout of the whole container table, and relocateTopBar() calls this on
      // every badge pass. One read phase and one write phase cost a single layout.
      var f = document.getElementById("footer");
      var bar = document.querySelector("div.js-actions");
      var lst = document.querySelector("#docker_list") || document.querySelector("table.cc-enh");
      // read phase
      var fixed = f && getComputedStyle(f).position === "fixed";
      // The var is always stamped: a hidden footer measures 0, a missing one counts as 0, and a
      // non-fixed one is 0 because the bar flows anyway. Leaving it unset lets the CSS fallback
      // float the bar.
      var h = fixed && f ? f.offsetHeight : 0;
      if (!(h > 0 && h < 160)) h = 0;
      var bh = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
      var lr = bar && lst ? lst.getBoundingClientRect() : null;
      var vw = document.documentElement.clientWidth;
      // write phase
      document.documentElement.style.setProperty("--cc-footer-h", h + "px");
      // the docked bar's own height feeds the scroll clearance through a CSS padding-bottom
      if (bh > 0 && bh < 200) document.documentElement.style.setProperty("--cc-actbar-h", bh + "px");
      // The native bar is fixed at the full viewport width, so its edges are inset to the
      // container list's, measured here on every apply, resize and scroll, with width:auto so
      // left and right decide.
      if (lr && lr.width > 0) {
        bar.style.setProperty("left", Math.round(lr.left) + "px", "important");
        // The bar keeps its full width rather than being narrowed for the scroll arrows, which
        // Tokens.css raises above it instead, so they no longer overlap the right-pinned view
        // toggle. The inset is clamped at 0, so a list overflowing past the viewport cannot push
        // the bar off screen.
        var rightInset = Math.max(0, Math.round(vw - lr.right));
        bar.style.setProperty("right", rightInset + "px", "important");
        bar.style.setProperty("width", "auto", "important");
        bar.style.setProperty("padding-right", "16px", "important");
      }
      colorBarButtons(); // the rainbow tint for the native bar buttons; the CSS handles the accent
    } catch (e) {}
    if (!window.__ccDockResize) {
      window.__ccDockResize = true;
      window.addEventListener("resize", function () { try { syncFooterDock(); } catch (e) {} });
    }
  }
  // The Basic/Advanced view toggle in the floating action bar. It writes Unraid's own cookie and
  // calls loadlist() directly, since triggering the hidden checkbox does nothing.
  function ensureBarToggle(bar) {
    function advWord() { return isAdvancedView() ? (LANG === "de" ? "ERWEITERTE ANSICHT" : "ADVANCED VIEW") : (LANG === "de" ? "EINFACHE ANSICHT" : "BASIC VIEW"); }
    var existing = bar.querySelector(".cc-bar-adv");
    if (existing) { var on0 = isAdvancedView(); var t0 = existing.querySelector(".cc-set-toggle"), l0 = existing.querySelector(".cc-bar-adv-lbl"); if (t0) { t0.classList.toggle("cc-set-toggle-on", on0); t0.setAttribute("aria-checked", on0 ? "true" : "false"); } if (l0) l0.textContent = advWord(); return; }
    var wrap = el("span", "cc-bar-adv"); wrap.setAttribute(MARK, "1");
    var lbl = el("span", "cc-bar-adv-lbl", advWord()); wrap.appendChild(lbl);
    var tg = el("span", "cc-set-toggle" + (isAdvancedView() ? " cc-set-toggle-on" : ""));
    tg.setAttribute("role", "switch"); tg.setAttribute("tabindex", "0"); tg.setAttribute("aria-checked", isAdvancedView() ? "true" : "false");
    tg.setAttribute("data-tip", LANG === "de" ? "Einfache / Erweiterte Ansicht" : "Basic / Advanced view");
    tg.appendChild(el("span", "cc-set-knob"));
    function flip() {
      var next = !isAdvancedView();
      tg.classList.toggle("cc-set-toggle-on", next); tg.setAttribute("aria-checked", next ? "true" : "false");
      lbl.textContent = next ? (LANG === "de" ? "ERWEITERTE ANSICHT" : "ADVANCED VIEW") : (LANG === "de" ? "EINFACHE ANSICHT" : "BASIC VIEW");
      try { document.cookie = "docker_listview_mode=" + (next ? "advanced" : "basic") + "; path=/"; } catch (e9) {}
      try { var inp9 = document.querySelector("input.advancedview"); if (inp9) inp9.checked = next; } catch (e9) {}
      // One full re-enhancement per flip. loadlist() replaces #docker_list wholesale, which wakes
      // the MutationObserver, and its sweep already runs applyEnhanceClasses() and
      // injectAllRowBadges() against the fresh rows: its callbacks arrive as microtasks after
      // loadlist's whole $.get callback, so the sweep sees the finished state. Claiming the flip
      // for the poll below leaves the repaint here as a fallback for when the observer never
      // sweeps, with theming off, a blocked loadlist or a detached observer, checked late enough
      // that a slow round trip cannot let the fallback beat the fresh DOM it should paint.
      lastAdv = next;
      var flipAt = Date.now();
      if (typeof window.loadlist === "function") { try { window.loadlist(); } catch (e9) {} }
      // With theming off the observer's sweep re-adds the enhancement classes on every native
      // rebuild, so that state has to be stripped back promptly.
      setTimeout(function () { try { if (!themingOn()) { removeEnhanceClasses(); reinjectRowBadges(); } } catch (e9) {} }, 300);
      setTimeout(function () {
        try {
          if (!themingOn() || ccEnhanceAt > flipAt) return;   // the observer's sweep already repainted the fresh list
          applyEnhanceClasses(); reinjectRowBadges();
        } catch (e9) {}
      }, 1200);
    }
    tg.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); flip(); });
    tg.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    wrap.appendChild(tg); bar.appendChild(wrap);
  }
  // The per-row checkboxes are hidden until this badge in the floating action bar switches bulk
  // mode on; docker.css gates their display on html.cc-bulkmode-on. Switching it off clears the
  // selection too, since a hidden checkbox with a lingering count bar is a confusing state.
  var ccBulkModeOn = false;
  function ccBulkModeToggle() {
    ccBulkModeOn = !ccBulkModeOn;
    document.documentElement.classList.toggle("cc-bulkmode-on", ccBulkModeOn);
    var btn = document.querySelector(".cc-bulkmode-badge"); if (btn) btn.classList.toggle("cc-bulkmode-badge-on", ccBulkModeOn);
    try { colorBarButtons(); } catch (e) {}   // the pressed badge drops its inline paint, and regains it on release, in the same tick as the class
    if (!ccBulkModeOn) { ccBulkSel = {}; ccBulkSyncCheckboxes(); ccBulkBarSync(); }
  }
  function ensureBulkModeBadge(bar) {
    var btn = bar.querySelector(".cc-bulkmode-badge");
    if (!btn) {
      // The badge carries no .cc-b: that is the sm-tier chip recipe, which reads as a different
      // species beside the bar's uppercase buttons. Its look comes from
      // `div.js-actions .cc-bulkmode-badge` in docker.css, which shares the native buttons' rules.
      btn = el("span", "cc-bulkmode-badge" + (ccBulkModeOn ? " cc-bulkmode-badge-on" : ""), LANG === "de" ? "Mehrfachauswahl" : "Multi-select");
      btn.setAttribute(MARK, "1"); btn.setAttribute("role", "button"); btn.setAttribute("tabindex", "0");
      btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); ccBulkModeToggle(); });
      btn.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); ccBulkModeToggle(); } });
    }
    // The badge is anchored to the container-size button through its onclick, since that button
    // carries no id or class and its label is translated. A plain appendChild would put it after
    // .cc-bar-adv, whose margin-left:auto flings everything behind it to the far end of the bar.
    // The fallbacks are just before the right-pinned toggle, then an append. relocateTopBar runs
    // this on every badge pass, so it touches the DOM only when the position is wrong.
    var anchor = bar.querySelector('input[type=button][onclick*="contSizes"]'), adv = bar.querySelector(".cc-bar-adv");
    var placed = btn.parentElement === bar && (anchor ? btn.previousElementSibling === anchor : (!adv || btn.nextElementSibling === adv));
    if (!placed) bar.insertBefore(btn, anchor ? anchor.nextSibling : (adv || null));
  }
  function relocateTopBar() {
    try {
      syncFooterDock();
      // The native toggle row stays collapsed in both views: its switch lives in the action bar
      // and the native Update-All button below the table covers ShipLog's pill.
      var tv = document.querySelector("div.ToggleViewMode");
      if (tv) tv.style.setProperty("display", "none", "important");
      if (mode !== "list") return;
      if (!findRows().length) return; // no gear before the rows exist, or it flashes on load
      // The gear sits inside the header row's last th; an absolute overlay on the TableContainer
      // is clipped by its overflow.
      var hr3 = headerRow(); if (!hr3) return;
      // The last th is the uptime column, which the CSS hides in the basic view, so the gear goes
      // in the last visible one and moves when the view changes.
      var th3 = hr3.lastElementChild;
      while (th3 && !th3.offsetParent) th3 = th3.previousElementSibling;
      if (!th3) return;
      try { if (getComputedStyle(th3).position === "static") th3.style.position = "relative"; } catch (e2) {}
      var oldAm = document.querySelector(".cc-advmini"); if (oldAm) oldAm.remove();
      var jsa = document.querySelector("div.js-actions");
      if (jsa) {
        // On the Docker page there is no gear menu: every option lives under Settings >
        // Utilities, and the one quick control, the view toggle, sits in the floating action bar.
        // Any gear left on the page from an earlier version is swept away.
        Array.prototype.slice.call(document.querySelectorAll(".cc-hgear:not(.cc-hgear-grid)")).forEach(function (x9) { x9.remove(); });
        var hc = document.querySelector(".cc-headctl"); if (hc) hc.remove();
        ensureBarToggle(jsa);
        ensureBulkModeBadge(jsa);
      } else {
        // the Plugins and VM pages have a tab strip rather than a js-actions bar
        var tc9 = document.querySelector("nav.tabs .tabs-container");
        if (tc9) {
          Array.prototype.slice.call(document.querySelectorAll(".cc-hgear:not(.cc-hgear-grid):not(.cc-hgear-home)")).forEach(function (x9) { x9.remove(); });
          if (!tc9.querySelector(".cc-hgear-home")) tc9.appendChild(makeGear("cc-hgear-home"));
        }
      }
    } catch (e) {}
  }
  function injectAllRowBadges() {
    relocateTopBar();
    // The update pill's colours are page-global, from --cc-rbaccent or --cc-accent and the
    // cc.statenative flag, never per row, so they are computed once here. Reading them inside
    // injectRowBadges puts a getComputedStyle between that row's own writes, and each one forces
    // a synchronous style recalculation of the whole document; after a tbody replace on a host
    // with a hundred containers that is a hundred recalculations in one blocking task.
    var upNative = localStorage.getItem("cc.statenative") === "1";
    var upRs = getComputedStyle(document.documentElement);
    ccUpBg = upNative ? "#e0912a" : ((upRs.getPropertyValue("--cc-rbaccent") || "").trim() || (upRs.getPropertyValue("--cc-accent") || "").trim() || "#e0912a");
    ccUpFg = upNative ? "#1a1a1a" : ((upRs.getPropertyValue("--cc-rbaccent-text") || "").trim() || (upRs.getPropertyValue("--cc-accent-text") || "").trim() || "#1a1a1a");
    // The advanced/basic read is cached for this pass (see isAdvancedView) and reset in a finally,
    // so a mid-pass exception cannot leave a later call reading a stale value.
    ccAdvCache = isAdvancedViewReal();
    ccEnhanceAt = Date.now();   // stamped on every full pass, whoever started it
    try {
      findRows().forEach(injectRowBadges);
      if (themingOn()) { // the centring is cosmetic, so native rows keep their alignment with theming off
        requestAnimationFrame(centerNameCells);
        setTimeout(centerNameCells, 800); // a late-loading icon changes the row height
        // Anything in the list still carrying a native title, ShipLog's chip, Unraid's
        // wait-seconds input or a future stray, becomes a CC bubble. nchan rebuilds the rows with
        // the title back, so this runs per pass, and the teardown is free, since the native rows
        // return on their own.
        try {
          var tl = document.querySelectorAll("#docker_list [title]");
          for (var ti = 0; ti < tl.length; ti++) { var tt = tl[ti].getAttribute("title"); if (tt) { tl[ti].removeAttribute("title"); tl[ti].setAttribute("data-tip", tt); } }
        } catch (e9) {}
      }
    } finally { ccAdvCache = null; }
  }
  // Measures where .outer actually sits inside td.ct-name and compensates with a translateY,
  // because Unraid's own rules differ per build and theme and no fixed CSS covers them all. Each
  // pass re-measures the corrected state, so the correction converges.
  function centerNameCells() {
    try {
      if (mode !== "list") return;
      // Every row's rect is read first and every transform written after: interleaving a read with
      // a write per row forces a synchronous layout on each iteration, and this runs twice per
      // native table rebuild. Batched, the browser lays out once per phase.
      var rows = findRows(), pending = [];
      for (var i = 0; i < rows.length; i++) {
        var td = rows[i].querySelector("td.ct-name"), outer = td && td.querySelector(".outer");
        if (!td || !outer) continue;
        var tdR = td.getBoundingClientRect(), oR = outer.getBoundingClientRect();
        if (!tdR.height || !oR.height) continue;
        pending.push({ outer: outer, tdR: tdR, oR: oR });
      }
      for (var j = 0; j < pending.length; j++) {
        var p = pending[j];
        var prev = parseFloat(p.outer.dataset.ccDy || "0");
        var dy = Math.round(prev + ((p.tdR.bottom - p.oR.bottom) - (p.oR.top - p.tdR.top)) / 2);
        if (Math.abs(dy - prev) < 2) continue;
        p.outer.dataset.ccDy = String(dy);
        p.outer.style.setProperty("transform", "translateY(" + dy + "px)", "important");
      }
    } catch (e) {}
  }
  function clearRowBadges() {
    var root = document.getElementById("docker_list") || nativeTable() || document; // scoped to the list rather than the whole page
    Array.prototype.slice.call(root.querySelectorAll("[" + MARK + "]")).forEach(function (n) { n.remove(); });
    Array.prototype.slice.call(root.querySelectorAll("[" + ROWMARK + "]")).forEach(function (n) { n.removeAttribute(ROWMARK); });
    Array.prototype.slice.call(root.querySelectorAll(".cc-hidden")).forEach(function (n) { n.classList.remove("cc-hidden"); });
    // the third-party badges lose their stamped classes, and the group badge is unwrapped, which
    // puts the native icon and text back
    Array.prototype.slice.call(root.querySelectorAll(".cc-3p")).forEach(function (n) { n.classList.remove("cc-b", "cc-3p"); });
    Array.prototype.slice.call(root.querySelectorAll("span.cc-grp")).forEach(function (n) { while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n); n.remove(); });
  }
  // Reverts the cosmetic inline styles injectRowBadges and centerNameCells wrote onto the native
  // cells: the vertical centring, the hidden name-cell state text and spinner, and .outer's flex
  // and translateY. removeEnhanceClasses and clearRowBadges leave those alone, so turning theming
  // off live would otherwise leave a row half-restyled until a reload.
  function stripRowCosmetic() {
    try {
      findRows().forEach(function (tr) {
        Array.prototype.slice.call(tr.children).forEach(function (td2) { td2.style.removeProperty("vertical-align"); });
        var nc = tr.querySelector("td.ct-name");
        if (nc) {
          Array.prototype.slice.call(nc.children).forEach(function (chn) { chn.style.removeProperty("display"); });
          var ob = nc.querySelector(".outer");
          if (ob) ["display", "align-items", "height", "transform"].forEach(function (p) { ob.style.removeProperty(p); });
        }
      });
    } catch (e) {}
  }
  function reinjectRowBadges() { clearRowBadges(); injectAllRowBadges(); applyIconTint(); }

  // The label shown the moment an action is clicked, until the next load() confirms the real
  // Docker state. Docker has no stopping state to poll, so this is optimistic.
  function transientLabel(action) {
    var de = LANG === "de";
    var m = { stop: de ? "wird gestoppt" : "stopping", restart: de ? "startet neu" : "restarting", start: de ? "startet" : "starting", unpause: de ? "startet" : "resuming", pause: de ? "pausiert…" : "pausing" };
    return m[action] || "";
  }
  // The names with an action in flight. syncStateBadges skips them, so a load() that started
  // before the click and lands during the action cannot revert the transient badge to the state
  // from before it.
  var pendingAction = {};
  function markTransient(name, action) {
    var lbl = transientLabel(action); if (!lbl) return;
    try {
      Array.prototype.slice.call(document.querySelectorAll(".cc-badge")).forEach(function (b) {
        if (b.dataset && b.dataset.name === name) {
          b.textContent = lbl;
          b.className = b.className.replace(/cc-badge-(running|exited|paused|created|restarting|removing|dead|unknown)\b/g, "").replace(/\s+/g, " ").trim() + " cc-badge-transient";
        }
      });
    } catch (e) {}
  }
  function doAction(name, action) {
    if (action === "unpause") unpauseGrace[name] = Date.now() + 90000; // the stale unhealthy of a pause gets time to recover
    pendingAction[name] = true; markTransient(name, action); flash(action + " " + name + "…");
    api("POST", "action", { name: name, action: action })
      .then(function () { delete pendingAction[name]; return load(); }) // cleared before the confirming load, so its sync updates this badge
      .then(function () { flash(t("done")); })
      .catch(function (e) { delete pendingAction[name]; flash("Error: " + e.message, true); syncStateBadges(); });
  }
  function actionBtn(label, name, action, primary) { var b = el("button", "cc-abtn" + (primary ? " cc-abtn-primary" : ""), label); b.addEventListener("click", function (e) { e.stopPropagation(); doAction(name, action); }); return b; }

  // The bulk-select action bar. Start, stop and restart go through CC's own engine API, the same
  // path every single-container button uses, one request per container in parallel with a single
  // load() at the end. Remove is different, because the engine never performs a destructive
  // removal: it drives Unraid's own docker-manager endpoint, the Events.php remove_container
  // action rmContainer() uses, behind one combined confirm rather than a dialog per container.
  var ccBulkBarEl = null;
  function ccBulkBarSync() {
    var names = Object.keys(ccBulkSel);
    if (!names.length) { if (ccBulkBarEl) ccBulkBarEl.style.setProperty("display", "none", "important"); return; }
    var de = LANG === "de";
    if (!ccBulkBarEl) {
      var bar = el("div", "cc-bulkbar");
      var count = el("span", "cc-bulkbar-count"); bar.appendChild(count);
      var startB = el("span", "cc-b cc-bulkbtn", de ? "Starten" : "Start"); startB.addEventListener("click", function () { ccBulkRun("start"); }); bar.appendChild(startB);
      var stopB = el("span", "cc-b cc-bulkbtn", de ? "Stoppen" : "Stop"); stopB.addEventListener("click", function () { ccBulkRun("stop"); }); bar.appendChild(stopB);
      var rmB = el("span", "cc-b cc-bulkbtn cc-bulkbtn-danger", de ? "Entfernen" : "Remove"); rmB.addEventListener("click", ccBulkRemove); bar.appendChild(rmB);
      var clearB = el("span", "cc-b cc-bulkbtn cc-bulkbtn-clear", de ? "Aufheben" : "Clear"); clearB.addEventListener("click", function () { ccBulkSel = {}; ccBulkSyncCheckboxes(); ccBulkBarSync(); }); bar.appendChild(clearB);
      document.body.appendChild(bar);
      ccBulkBarEl = bar;
    }
    ccBulkBarEl.style.removeProperty("display");
    ccBulkBarEl.querySelector(".cc-bulkbar-count").textContent = names.length + " " + (de ? "ausgewählt" : "selected");
  }
  // Every checkbox is un-ticked after a bulk action or a clear. The fresh rows a native tbody
  // replace creates start unchecked, so there is nothing to do for those.
  function ccBulkSyncCheckboxes() {
    Array.prototype.slice.call(document.querySelectorAll(".cc-bulk-cb")).forEach(function (cb) { cb.checked = false; });
  }
  // Shared by the bulk-select bar and the per-folder start and stop buttons, so there is one
  // start-in-parallel-then-reload mechanism rather than two.
  function runBulkAction(names, action, onDone) {
    if (!names.length) return Promise.resolve();
    flash((action === "start" ? (LANG === "de" ? "Starte " : "Starting ") : (LANG === "de" ? "Stoppe " : "Stopping ")) + names.length + "…");
    return Promise.all(names.map(function (n) { return api("POST", "action", { name: n, action: action }).catch(function () {}); }))
      .then(function () { return load(); })
      .then(function () { flash(t("done")); if (onDone) onDone(); });
  }
  function ccBulkRun(action) {
    runBulkAction(Object.keys(ccBulkSel), action, function () { ccBulkSel = {}; ccBulkSyncCheckboxes(); ccBulkBarSync(); });
  }
  function ccBulkRemove() {
    var names = Object.keys(ccBulkSel);
    if (!names.length || typeof window.swal !== "function") return;
    var de = LANG === "de";
    window.swal({
      title: de ? "Sicher?" : "Are you sure?",
      text: (de ? names.length + " Container entfernen: " : "Remove " + names.length + " containers: ") + names.join(", "),
      type: "warning", showCancelButton: true,
      confirmButtonText: de ? "Ja, entfernen" : "Yes, remove", cancelButtonText: de ? "Abbrechen" : "Cancel"
    }, function (ok) {
      if (!ok) return;
      var tok = csrfToken();
      var reqs = names.map(function (n) {
        var info = ccBulkSel[n] || {};
        var body = "action=remove_container&container=" + encodeURIComponent(info.id || "") + "&name=" + encodeURIComponent(n) + "&image=" + encodeURIComponent(info.image || "") + (tok ? "&csrf_token=" + encodeURIComponent(tok) : "");
        return fetch("/plugins/dynamix.docker.manager/include/Events.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body }).catch(function () {});
      });
      Promise.all(reqs).then(function () {
        ccBulkSel = {}; ccBulkSyncCheckboxes(); ccBulkBarSync();
        if (typeof window.loadlist === "function") window.loadlist();
      });
    });
  }
  function lifecycle(c) {
    var box = el("span", "cc-life");
    if (c.state === "running") { box.appendChild(actionBtn(t("stop"), c.name, "stop")); box.appendChild(actionBtn(t("restart"), c.name, "restart")); box.appendChild(actionBtn(t("pause"), c.name, "pause")); }
    else if (c.state === "paused") { box.appendChild(actionBtn(t("resume"), c.name, "unpause", true)); box.appendChild(actionBtn(t("stop"), c.name, "stop")); }
    else box.appendChild(actionBtn(t("start"), c.name, "start", true));
    return box;
  }

  // The grid's cards, built from the engine's data.
  // The per-card rainbow stamp. In the list applyRainbowPalette() puts a rotating --cc-rb-c and
  // --cc-rb-ct on every row by its DOM position, so the logo tile and everything else that falls
  // back to --cc-rb-c rotates per row; the grid and folder views need the same on their cards, or
  // docker.css's var(--cc-iconbg-color, var(--cc-rb-c, var(--cc-accent))) chain falls straight to
  // the flat accent. It lives inside card() rather than in renderGrid() and renderFolderView(),
  // so both callers get it and cannot drift apart.
  //
  // The index comes from containerNames, the alphabetical list indexState() maintains, which is
  // stable whichever view renders: renderGrid() sorts its cards alphabetically too, so it matches
  // the screen exactly, while renderFolderView() groups by folder and drag position, so its order
  // can differ, but a container still keeps the same colour by name and its badge does not jump
  // when the view changes. The list indexes by DOM row position instead, which follows whatever
  // the native table sorts by.
  function stampCardRainbow(wrap, name) {
    if (themingOn() && localStorage.getItem("cc.rainbow") === "1") {
      var idx = containerNames.indexOf(name); if (idx < 0) idx = 0;
      var rc = ccRbColor(idx);
      wrap.style.setProperty("--cc-rb-c", rc); wrap.style.setProperty("--cc-rb-ct", idealText(rc));
    } else {
      wrap.style.removeProperty("--cc-rb-c"); wrap.style.removeProperty("--cc-rb-ct");
    }
  }
  function card(c) {
    var wrap = el("div", "cc-card"); wrap.dataset.name = c.name;
    stampCardRainbow(wrap, c.name);
    var head = el("div", "cc-card-head");
    var ico = iconFor(c.name);
    if (ico) { var im = el("img", "cc-card-ico"); im.src = ico; im.setAttribute("data-cc-name", c.name); im.onerror = function () { this.style.visibility = "hidden"; }; head.appendChild(im); } else head.appendChild(el("div", "cc-card-ico cc-card-ico-ph"));
    var nb = el("div", "cc-card-name"); nb.appendChild(el("div", "cc-card-title", c.name)); nb.appendChild(el("div", "cc-card-img", c.image || "")); head.appendChild(nb);
    head.appendChild(stateBadge(c)); wrap.appendChild(head);
    var ab2 = actionBars(c.name, c);
    var abrow = el("div", "cc-card-actbar"); abrow.appendChild(ab2.bar); abrow.appendChild(ab2.more);
    wrap.appendChild(abrow);
    var s = stats[c.name], sb = el("div", "cc-card-stats");
    if (s && c.state === "running") {
      sb.appendChild(gauge("CPU", s.cpu_percent, (s.cpu_percent || 0) + "%"));
      sb.appendChild(gauge("RAM", s.mem_percent, humanBytes(s.mem_used) + " / " + humanBytes(s.mem_limit)));
      var nl = el("div", "cc-stat cc-stat-net"); nl.appendChild(el("span", "cc-stat-lbl", "NET")); nl.appendChild(el("span", "cc-stat-val cc-card-net", netRate(s))); sb.appendChild(nl);
    } else sb.appendChild(el("div", "cc-stat cc-dim", c.state === "running" ? "…" : "not running"));
    wrap.appendChild(sb);
    var badges = el("div", "cc-card-badges");
    if (c.network) badges.appendChild(badgeInfo("NET", c.network, "net"));
    if (c.ip) badges.appendChild(badgeInfo("IP", c.ip, "ip"));
    if (c.ports && c.ports.length) badges.appendChild(badgeInfo("PORT", c.ports.join(" "), "port"));
    if (badges.children.length) wrap.appendChild(badges);
    var act = el("div", "cc-card-actions");
    act.appendChild(planBadge(c.name)); // start, stop and pause live in the icon block above
    var p = lastRunPill(c.name); if (p) act.appendChild(p);
    wrap.appendChild(act);
    // the same three limit gears injectRowBadges puts in a list row, so the card view can open
    // the same editors
    var rg = el("div", "cc-rowbadges cc-resgroup cc-card-res"); rg.setAttribute(MARK, "1"); rg.dataset.name = c.name;
    var lm = limits[c.name] || {};
    var cpuB = badgeInfo("CPU", "…", "cpu");
    rg.appendChild(resLine(cpuB, limGear(c.name, "cpu", cpuLimited(lm) || cpuPinned(lm))));
    var ramB = badgeInfo("RAM", "…", "ram");
    rg.appendChild(resLine(ramB, limGear(c.name, "ram", ramLimited(lm))));
    var bw = bandwidthFor(c.name);
    var bwB = badgeInfo("BW", "…", "bw"); bwB.setAttribute("data-tip", t("bandwidth") + " " + bwTitle(bw));
    rg.appendChild(resLine(bwB, bwGear(c.name, bwHasLimit(bw))));
    updateResGroup(rg, stats[c.name], c.state);
    wrap.appendChild(rg);
    if (filterText && norm(c.name).indexOf(filterText) < 0) wrap.style.display = "none";
    return wrap;
  }
  function gauge(label, pct, right) { var w = el("div", "cc-stat"); w.appendChild(el("span", "cc-stat-lbl", label)); var bar = el("div", "cc-gauge"), fill = el("div", "cc-gauge-fill" + (pct >= 90 ? " cc-hot" : "")); fill.style.width = Math.max(0, Math.min(100, pct)) + "%"; bar.appendChild(fill); w.appendChild(bar); w.appendChild(el("span", "cc-stat-val", right)); return w; }
  function ensureGridHolder() {
    if (gridHolder && gridHolder.parentNode) return gridHolder;
    gridHolder = el("div", "cc-grid-holder cc-root");
    try { var tb = nativeTable(); if (tb && tb.parentNode) tb.parentNode.insertBefore(gridHolder, tb); else document.body.appendChild(gridHolder); } catch (e) { document.body.appendChild(gridHolder); }
    return gridHolder;
  }
  function removeGridHolder() { try { if (gridHolder && gridHolder.parentNode) gridHolder.parentNode.removeChild(gridHolder); } catch (e) {} gridHolder = null; }
  function renderGrid() {
    ensureGridHolder(); gridHolder.innerHTML = "";
    relocateTopBar(); // the native toggle row collapses in the card view too
    gridHolder.classList.toggle("cc-rainbow", localStorage.getItem("cc.rainbow") === "1");
    gridHolder.classList.toggle("cc-tint-icons", !!effc("iconcolor"));
    // the grid's twin of the table's iconbg gate in applyEnhanceClasses, which the reactive
    // logo-tile rules key on, so the card view matches the list
    gridHolder.classList.toggle("cc-docker-iconbg", iconBgOn());
    // The grid gets a gear of its own, since the list's lives near the native table, which is no
    // anchor in the card view. A rebuild detaches the old one, so an open menu anchored to it is
    // re-anchored here, or positionMenu() would compute from a disconnected node.
    var hg = makeGear("cc-hgear-grid");
    var grid = el("div", "cc-grid");
    containers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) { grid.appendChild(card(c)); });
    // the gear is part of the grid, a small tile after the last card, rather than a floating
    // button in the space above them
    var gtile = el("div", "cc-card cc-gear-tile"); gtile.appendChild(hg); grid.appendChild(gtile);
    gridHolder.appendChild(grid);
    if (menu && menuAnchor && !menuAnchor.isConnected) { menuAnchor = hg; positionMenu(); }
    applyIconTint();
  }
  // The folder view has three content densities, a second axis inside it: the folders are always
  // grouped, and only their contents and the root section switch between detailed, grid and list.
  // The list is the native Docker list's language, an icon, a name and a state and nothing else;
  // the grid is a chip, a small icon with an inline name, a status dot with a short label and one
  // action, wrapped tightly rather than one per row.
  //
  // All three reuse card()'s colour plumbing rather than reimplementing it: every wrapper keeps
  // the cc-card class, so stampCardRainbow(), the reactive hover rules and every iconbg and shape
  // selector that targets .cc-card apply, and every icon reuses .cc-card-ico, resized by its
  // density's own rule. Every action button goes through actBtn() and tintAct(), the machinery
  // actionBars() uses, so it takes the same tinting as every other action icon.
  var FOLDER_DENSITY_KEY = "cc.folderDensity"; // "full" (the default), "grid" or "list"
  function folderDensity() {
    var v = localStorage.getItem(FOLDER_DENSITY_KEY);
    if (v === "grid" || v === "list") return v;
    if (v === "minimal") return "grid"; // an older stored value
    return "full";
  }
  function setFolderDensity(v) {
    localStorage.setItem(FOLDER_DENSITY_KEY, (v === "grid" || v === "list") ? v : "full");
    if (mode === "folder") renderFolderView();
  }
  // The grid density: a small pill per container with the icon, name, a status dot with a short
  // label and one action button on a line, wrapping tightly against its siblings, which
  // .cc-folder-group-body-grid in docker.css lays out.
  function folderChip(c) {
    var wrap = el("div", "cc-card cc-chip"); wrap.dataset.name = c.name;
    stampCardRainbow(wrap, c.name);
    var ico = iconFor(c.name);
    if (ico) { var im = el("img", "cc-card-ico cc-chip-ico"); im.src = ico; im.setAttribute("data-cc-name", c.name); im.onerror = function () { this.style.visibility = "hidden"; }; wrap.appendChild(im); }
    else wrap.appendChild(el("div", "cc-card-ico cc-chip-ico cc-card-ico-ph"));
    wrap.appendChild(el("span", "cc-chip-name", c.name));
    var st = (c && c.state) || "unknown";
    var dot = el("span", "cc-badge cc-chip-dot cc-badge-" + st); dot.dataset.name = c.name;
    wrap.appendChild(dot);
    wrap.appendChild(el("span", "cc-chip-status", stateLabel(st)));
    var running = c && c.state === "running", paused = c && c.state === "paused";
    var actWrap = el("span", "cc-mrow-act cc-chip-act");
    actWrap.appendChild(paused ? actBtn("fa-play", t("resume"), function () { doAction(c.name, "unpause"); })
      : (running ? actBtn("fa-stop", t("stop"), function () { doAction(c.name, "stop"); })
        : actBtn("fa-play", t("start"), function () { doAction(c.name, "start"); })));
    tintAct(actWrap); // the tinting the full action bars use, rather than colour logic of its own
    wrap.appendChild(actWrap);
    if (filterText && norm(c.name).indexOf(filterText) < 0) wrap.style.display = "none";
    return wrap;
  }
  // The list density: full-width rows in the native Docker list's language, a larger icon tile
  // with the name beside it and the state as a badge, but with no CPU, RAM, network or port
  // column, one row per container.
  function folderListRow(c) {
    var wrap = el("div", "cc-card cc-frow"); wrap.dataset.name = c.name;
    stampCardRainbow(wrap, c.name);
    var ico = iconFor(c.name);
    if (ico) { var im = el("img", "cc-card-ico", null); im.src = ico; im.setAttribute("data-cc-name", c.name); im.onerror = function () { this.style.visibility = "hidden"; }; wrap.appendChild(im); }
    else wrap.appendChild(el("div", "cc-card-ico cc-card-ico-ph"));
    wrap.appendChild(el("div", "cc-frow-name", c.name));
    var statusWrap = el("span", "cc-frow-status"); statusWrap.appendChild(stateBadge(c)); wrap.appendChild(statusWrap);
    var running = c && c.state === "running", paused = c && c.state === "paused";
    var actWrap = el("span", "cc-mrow-act cc-frow-act");
    actWrap.appendChild(paused ? actBtn("fa-play", t("resume"), function () { doAction(c.name, "unpause"); })
      : (running ? actBtn("fa-stop", t("stop"), function () { doAction(c.name, "stop"); })
        : actBtn("fa-play", t("start"), function () { doAction(c.name, "start"); })));
    tintAct(actWrap);
    wrap.appendChild(actWrap);
    if (filterText && norm(c.name).indexOf(filterText) < 0) wrap.style.display = "none";
    return wrap;
  }
  // The per-folder collapse and hide-stopped state, kept like every other cc.* preference: the
  // setItem and removeItem interceptor near the top of this file sweeps any key matching
  // /^cc[a-z]*\./ into ui_settings. They are keyed by the organizer's folder id rather than its
  // name, so they survive a rename.
  var FOLDER_COLLAPSED_KEY = "cc.folderCollapsed", FOLDER_HIDESTOPPED_KEY = "cc.folderHideStopped";
  function readIdMap(key) { try { var o = JSON.parse(localStorage.getItem(key) || "{}"); return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; } }
  function writeIdMapFlag(key, id, on) { var m = readIdMap(key); if (on) m[id] = true; else delete m[id]; localStorage.setItem(key, JSON.stringify(m)); }
  function isFolderCollapsed(id) { return !!readIdMap(FOLDER_COLLAPSED_KEY)[id]; }
  function setFolderCollapsed(id, on) { writeIdMapFlag(FOLDER_COLLAPSED_KEY, id, on); }
  function folderHidesStopped(id) { return !!readIdMap(FOLDER_HIDESTOPPED_KEY)[id]; }
  function setFolderHideStopped(id, on) { writeIdMapFlag(FOLDER_HIDESTOPPED_KEY, id, on); }
  // A container is hidden when its own parent folder has hide-stopped on and it is not running.
  // A plain predicate rather than a closure inside renderFolderView, so a test can reach it and
  // it cannot diverge from what is filtered.
  function ccFolderHidesContainer(parentId, c) { return folderHidesStopped(parentId) && !!c && c.state !== "running"; }
  // The live-search match, taking the byParent tree as an argument rather than closing over
  // module state, so a test can reach it. renderFolderView uses the same rule for both
  // auto-expand and hide. A folder matches when its own name does, or any descendant does
  // through the nested folders; a container matches on its own name.
  function ccEntryMatches(byParent, filterText, entry) {
    if (!filterText) return true;
    if (entry.type === "container") return norm(entry.name.replace(/^\//, "")).indexOf(filterText) >= 0;
    if (norm(entry.name).indexOf(filterText) >= 0) return true;
    var kids = byParent[entry.id] || [];
    for (var i = 0; i < kids.length; i++) if (ccEntryMatches(byParent, filterText, kids[i])) return true;
    return false;
  }
  // The stored collapse state, overridden open, never shut, while a live search matches inside a
  // folder. That is the auto-expand, and it stops applying the moment the filter is cleared,
  // with no saved state of its own.
  function ccEffectiveCollapsed(byParent, filterText, entry) { return (filterText && ccEntryMatches(byParent, filterText, entry)) ? false : isFolderCollapsed(entry.id); }
  // The bulk start and stop target list: every container descendant through the nested folders,
  // not only the direct children. It takes the byParent tree and an existence lookup as
  // arguments, so a test can reach it.
  function ccCollectFolderContainerNames(byParent, fid, existsFn) {
    var out = [];
    (byParent[fid] || []).forEach(function (k) {
      if (k.type === "container") { var nm = k.name.replace(/^\//, ""); if (existsFn(nm)) out.push(nm); }
      else out = out.concat(ccCollectFolderContainerNames(byParent, k.id, existsFn));
    });
    return out;
  }
  // The folder header's action buttons carry a FontAwesome <i> rather than emoji text, for the
  // reason actBtn() gives: emoji draw their own fixed shape and ignore a CSS colour, while the
  // glyph inherits .cc-folder-act's own grey at rest and accent on hover.
  function folderActBtn(cls, icon, title) {
    var b = el("button", cls); b.type = "button"; b.title = title;
    b.appendChild(el("i", "fa " + icon));
    return b;
  }
  // The folder view groups structurally and shows no aggregated figures per folder. flatEntries
  // already carries the depth, parent id and position, so grouping is one bucket-by-parent pass
  // rather than a recursive tree parser, and it reuses card(), so a folder's contents look like
  // the grid's, only grouped under headers.
  function renderFolderView() {
    // Every folder action re-renders through this function, which clears and rebuilds the whole
    // holder, and the browser resets the scroll position the moment the scrolled-into content is
    // torn out. Capturing and restoring it here covers every trigger path, since they all funnel
    // through here. The whole page scrolls, not an inner container, as every popover positioner
    // in this file also assumes.
    var savedScroll = window.scrollY;
    ensureGridHolder(); gridHolder.innerHTML = "";
    relocateTopBar();
    gridHolder.classList.toggle("cc-rainbow", localStorage.getItem("cc.rainbow") === "1");
    gridHolder.classList.toggle("cc-tint-icons", !!effc("iconcolor"));
    gridHolder.classList.toggle("cc-docker-iconbg", iconBgOn());
    if (!ccOrgView) { removeGridHolder(); window.scrollTo(0, savedScroll); return; }
    var byParent = {};
    ccOrgView.flatEntries.forEach(function (e) { (byParent[e.parentId] = byParent[e.parentId] || []).push(e); });
    Object.keys(byParent).forEach(function (pid) { byParent[pid].sort(function (a, b) { return a.position - b.position; }); });

    // thin closures over ccEntryMatches() and ccEffectiveCollapsed(), so this pass's byParent and
    // filterText need not be threaded through every call site
    function entryMatches(entry) { return ccEntryMatches(byParent, filterText, entry); }
    function effectiveCollapsed(entry) { return ccEffectiveCollapsed(byParent, filterText, entry); }
    // A folder's bulk action covers every container descendant through the nested folders, and
    // goes through runBulkAction(), the machinery the bulk-select bar uses.
    function ccFolderBulk(fid, action) { runBulkAction(ccCollectFolderContainerNames(byParent, fid, containerByName), action); }

    var dense = folderDensity(); // applies to a folder's contents and to the root section alike
    var hg = makeGear("cc-hgear-grid");
    var root = el("div", "cc-folderview" + (dense === "grid" ? " cc-folderview-grid" : dense === "list" ? " cc-folderview-list" : ""));

    // Drag and drop reordering. `dragEntry` is the entry being dragged, scoped to this render
    // pass, since a successful move triggers a fresh render anyway. buildMoveMenu below is the
    // same action by click, for touch and keyboard.
    var dragEntry = null;
    function clearDropHighlights() { Array.prototype.slice.call(gridHolder.querySelectorAll(".cc-drop-target")).forEach(function (n) { n.classList.remove("cc-drop-target"); }); }
    function wireDragSource(el2, entry) {
      el2.draggable = true;
      el2.addEventListener("dragstart", function (ev) { dragEntry = entry; el2.classList.add("cc-dragging"); try { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", entry.id); } catch (e2) {} });
      el2.addEventListener("dragend", function () { el2.classList.remove("cc-dragging"); dragEntry = null; clearDropHighlights(); });
    }
    // dragover and drop both bubble, so they are stopped here and only the deepest target under
    // the cursor reacts; otherwise a drop over a card also fires its folder's and the root's
    // handlers and highlights three nested targets at once.
    function wireDropTarget(el2, onDrop) {
      el2.addEventListener("dragover", function (ev) { if (!dragEntry) return; ev.preventDefault(); ev.stopPropagation(); ev.dataTransfer.dropEffect = "move"; clearDropHighlights(); el2.classList.add("cc-drop-target"); });
      el2.addEventListener("dragleave", function () { el2.classList.remove("cc-drop-target"); });
      el2.addEventListener("drop", function (ev) {
        ev.preventDefault(); ev.stopPropagation(); clearDropHighlights();
        if (!dragEntry) return;
        var src = dragEntry; dragEntry = null;
        onDrop(src);
      });
    }
    function attachMoveButton(cardEl, entry) {
      var btn = el("button", "cc-card-movebtn", "📁"); btn.type = "button"; btn.title = t("moveToFolder");
      btn.addEventListener("click", function (ev) { ev.stopPropagation(); ev.preventDefault(); toggleMenu(btn, function () { return buildMoveMenu(entry); }); });
      var head2 = cardEl.querySelector(".cc-card-head"); (head2 || cardEl).appendChild(btn);
    }

    function renderEntries(parentId, container) {
      (byParent[parentId] || []).forEach(function (e) {
        if (e.type === "folder" || e.type === "group") {
          if (filterText && !entryMatches(e)) return; // live search: a folder with no match anywhere inside it (and no name match itself) is hidden outright
          var collapsed = effectiveCollapsed(e);
          var grp = el("div", "cc-folder-group" + (collapsed ? " cc-folder-collapsed" : ""));
          var head = el("div", "cc-folder-group-head");
          var titleWrap = el("span", "cc-folder-group-title");
          var chev = el("span", "cc-folder-chev", collapsed ? "▸" : "▾"); chev.setAttribute("aria-hidden", "true");
          titleWrap.appendChild(chev);
          titleWrap.appendChild(el("span", "cc-folder-group-label", e.name + " (" + (byParent[e.id] || []).length + ")"));
          head.appendChild(titleWrap);
          head.style.cursor = "pointer";
          // Collapse and expand, kept by setFolderCollapsed. A click on one of the action buttons
          // below never reaches here, since they all stop propagation.
          head.addEventListener("click", function () { setFolderCollapsed(e.id, !effectiveCollapsed(e)); renderFolderView(); });
          var acts = el("span", "cc-folder-group-actions");
          // hide-stopped is per folder rather than global
          var hsOn = folderHidesStopped(e.id);
          var hsBtn = folderActBtn("cc-folder-act" + (hsOn ? " cc-folder-act-on" : ""), "fa-eye", t("hideStopped"));
          hsBtn.addEventListener("click", function (ev) { ev.stopPropagation(); setFolderHideStopped(e.id, !folderHidesStopped(e.id)); renderFolderView(); });
          acts.appendChild(hsBtn);
          // bulk start and stop for this folder's contents
          var startAllBtn = folderActBtn("cc-folder-act", "fa-play", t("bulkStartAll"));
          startAllBtn.addEventListener("click", function (ev) { ev.stopPropagation(); ccFolderBulk(e.id, "start"); });
          var stopAllBtn = folderActBtn("cc-folder-act", "fa-stop", t("bulkStopAll"));
          stopAllBtn.addEventListener("click", function (ev) { ev.stopPropagation(); ccFolderBulk(e.id, "stop"); });
          acts.appendChild(startAllBtn); acts.appendChild(stopAllBtn);
          // Rename and delete are offered only for folders CC created itself; one made by
          // another tool or by a future native UI stays read-only here.
          if (ccOrgIsOwned(e.id)) {
            var renBtn = folderActBtn("cc-folder-act", "fa-pencil", t("renameFolder"));
            renBtn.addEventListener("click", function (ev) { ev.stopPropagation(); ccOrgRenameFolder(e.id, e.name); });
            var delBtn = folderActBtn("cc-folder-act", "fa-trash", t("deleteFolder"));
            delBtn.addEventListener("click", function (ev) { ev.stopPropagation(); ccOrgDeleteFolder(e.id); });
            acts.appendChild(renBtn); acts.appendChild(delBtn);
            // A folder reorders only where CC owns it, so one another tool manages is never
            // restructured. The head is the drag handle and the whole group moves.
            wireDragSource(head, e);
          }
          head.appendChild(acts);
          grp.appendChild(head);
          var kids = el("div", "cc-folder-group-body" + (dense === "grid" ? " cc-folder-group-body-grid" : dense === "list" ? " cc-folder-group-body-list" : " cc-grid"));
          grp.appendChild(kids);
          container.appendChild(grp);
          // Dropping a container on this folder's head or its empty body files it in here at the
          // end; dropping a folder on the head puts it next to this one, which is a same-level
          // reorder, since folders only live at the root.
          wireDropTarget(head, function (src) {
            if (src.type === "container") ccOrgMoveToFolder(src.id, e.id);
            else if (src.id !== e.id) ccOrgMoveToPosition(src.id, e.parentId, e.position);
          });
          wireDropTarget(kids, function (src) { if (src.type === "container" && src.id !== e.id) ccOrgMoveToFolder(src.id, e.id); });
          renderEntries(e.id, kids); // a nested folder renders inside its own group's body, even collapsed, so the auto-expand still finds matches
        } else {
          var name = e.name.replace(/^\//, ""); // the organizer names containers docker-style, with a leading slash
          // containerByName() normalises the name; containersByName is keyed lowercase, so a bare
          // lookup would drop every mixed-case container name
          var c = containerByName(name);
          if (c) {
            if (filterText && !entryMatches(e)) return;
            if (ccFolderHidesContainer(parentId, c)) return;
            var cd = dense === "grid" ? folderChip(c) : dense === "list" ? folderListRow(c) : card(c);
            wireDragSource(cd, e);
            // A drop on another container moves the dragged item to that one's own folder and
            // position, which covers a reorder within a folder and a move between two.
            wireDropTarget(cd, function (src) { if (src.id !== e.id) ccOrgMoveToPosition(src.id, e.parentId, e.position); });
            attachMoveButton(cd, e);
            container.appendChild(cd);
          }
        }
      });
    }
    renderEntries(ccOrgView.rootId, root);
    // dropping on the open background (not on any card/folder) files/reorders to the END of root
    wireDropTarget(root, function (src) {
      var rootKids = byParent[ccOrgView.rootId] || [];
      var lastPos = rootKids.length ? rootKids[rootKids.length - 1].position + 1 : 0;
      if (src.type === "container" || src.parentId !== ccOrgView.rootId) ccOrgMoveToPosition(src.id, ccOrgView.rootId, lastPos);
    });

    // the gear tile takes the current density's shape, so it does not sit as an oversized square
    // among tiny chips or slim rows
    var gtile = el("div", "cc-card cc-gear-tile" + (dense === "grid" ? " cc-chip" : dense === "list" ? " cc-frow" : "")); gtile.appendChild(hg); root.appendChild(gtile);
    gridHolder.appendChild(root);
    if (menu && menuAnchor && !menuAnchor.isConnected) { menuAnchor = hg; positionMenu(); }
    applyIconTint();
    window.scrollTo(0, savedScroll); // restored once the new DOM is in place
  }
  // The one place that re-renders whichever non-list view is active. A call site that reaches for
  // renderGrid() as its not-list fallback replaces the folder view's grouping with the flat grid
  // the moment its trigger fires.
  function renderCurrentView() { if (mode === "folder") renderFolderView(); else renderGrid(); }

  // the gear and its menu
  function makeGear(extra) { var g = el("button", "cc-hgear" + (extra ? " " + extra : "") + (daemonUp === false ? " cc-hgear-down" : ""), "⚙"); g.type = "button"; g.setAttribute("data-tip", daemonUp === false ? "CannonadeCommand: daemon not reachable" : "CannonadeCommand"); g.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); toggleMenu(g); }); return g; }
  function injectHeaderGear() {
    try {
      // never a second list-mode gear once one exists
      if (document.querySelector(".cc-hgear:not(.cc-hgear-grid)")) return true;
      // Its home is the floating action bar on the Docker page or the tab strip on the others,
      // as in relocateTopBar, and never a column-header th, which the CSS hides in the basic view.
      var homeH = document.querySelector("div.js-actions") || document.querySelector("nav.tabs .tabs-container");
      if (homeH) { if (!homeH.querySelector(".cc-hgear-home")) homeH.appendChild(makeGear("cc-hgear-home")); return true; }
      // Failing that, inside Unraid's view-toggle row as its first child, so the gear sits in the
      // right-aligned control group beside the toggle rather than orphaned on the line above.
      var tv = document.querySelector("div.ToggleViewMode");
      if (tv) { if (tv.querySelector(".cc-hgear-bar")) return true; tv.insertBefore(makeGear("cc-hgear-bar"), tv.firstChild); return true; }
      var tb = nativeTable(); if (!tb) return false;
      var hr = headerRow();
      if (hr) { if (hr.querySelector(".cc-hgear")) return true; var th = hr.querySelector("th"); if (th) { th.appendChild(makeGear("cc-hgear-th")); return true; } }
      var wrap = tb.parentNode;
      if (wrap && !wrap.querySelector(".cc-hgear-float")) { try { if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative"; } catch (e) {} wrap.appendChild(makeGear("cc-hgear-float")); }
      return true;
    } catch (e) { return false; }
  }
  function menuHead(txt) { return el("div", "cc-menu-h", txt); }
  function buildMenu() {
    var m = el("div", "cc-menu cc-menu-wide");
    m.addEventListener("click", function (e) { e.stopPropagation(); });
    // Without the daemon the limits and bandwidth cannot work at all, so the status says so in
    // red. With it, the running version is shown, so an update that did not restart the daemon,
    // or a stale install, is visible here.
    if (daemonUp === false) {
      menuStatusEl = el("div", "cc-menu-status cc-bad-text", "engine down, daemon not reachable · UI v" + CC_VER);
    } else {
      menuStatusEl = el("div", "cc-menu-status cc-ok-text", "engine up · " + containers.length + (daemonVersion ? " · v" + String(daemonVersion).replace(/^v/, "") : "") + " · UI v" + CC_VER);
    }
    m.appendChild(menuStatusEl);
    // The list and grid choice belongs to the theming, so it is hidden with theming off.
    if (themingOn()) {
      m.appendChild(menuHead(t("view")));
      var seg = el("div", "cc-seg");
      var bL = el("button", "cc-seg-btn" + (mode === "list" ? " cc-seg-on" : ""), t("list"));
      var bG = el("button", "cc-seg-btn" + (mode === "grid" ? " cc-seg-on" : ""), t("grid"));
      bL.addEventListener("click", function () { closeMenu(); setMode("list"); }); bG.addEventListener("click", function () { closeMenu(); setMode("grid"); });
      seg.appendChild(bL); seg.appendChild(bG);
      // The folder view is offered once the organizer has folders; an always-empty third tab
      // would only confuse.
      if (ccOrgAvailable && ccOrgHasFolders()) {
        var bF = el("button", "cc-seg-btn" + (mode === "folder" ? " cc-seg-on" : ""), LANG === "de" ? "Ordner" : "Folder");
        bF.addEventListener("click", function () { closeMenu(); setMode("folder"); });
        seg.appendChild(bF);
      }
      var vrow = el("div", "cc-menu-row cc-menu-plain"); vrow.appendChild(seg); m.appendChild(vrow);
      // The folder-content density, a second axis inside the folder view: the folders stay
      // grouped and only their contents and the root section switch between the detail cards,
      // the grid chips and the list rows. It reuses the same labels as the view switch above, so
      // the two share a vocabulary, and it is offered only while the folder view is active,
      // since it does nothing in the others.
      if (mode === "folder") {
        m.appendChild(menuHead(t("folderContent")));
        var segD = el("div", "cc-seg");
        var dense = folderDensity();
        var bFull = el("button", "cc-seg-btn" + (dense === "full" ? " cc-seg-on" : ""), t("detailed"));
        var bGrid = el("button", "cc-seg-btn" + (dense === "grid" ? " cc-seg-on" : ""), t("grid"));
        var bList = el("button", "cc-seg-btn" + (dense === "list" ? " cc-seg-on" : ""), t("list"));
        bFull.addEventListener("click", function () { closeMenu(); setFolderDensity("full"); });
        bGrid.addEventListener("click", function () { closeMenu(); setFolderDensity("grid"); });
        bList.addEventListener("click", function () { closeMenu(); setFolderDensity("list"); });
        segD.appendChild(bFull); segD.appendChild(bGrid); segD.appendChild(bList);
        var drow = el("div", "cc-menu-row cc-menu-plain"); drow.appendChild(segD); m.appendChild(drow);
      }
      // New folder creates the first one, which is how the folder view above becomes available.
      if (ccOrgAvailable) {
        var nf = el("div", "cc-menu-link", "+ " + t("newFolder"));
        nf.style.cursor = "pointer";
        nf.addEventListener("click", function () { closeMenu(); ccOrgCreateFolder(); });
        m.appendChild(nf);
      }
    }
    // The native switch row above the table is hidden, so this flips Unraid's own hidden
    // checkbox and leaves the cookie and the re-render to it.
    var segA = el("div", "cc-seg");
    var advNow = isAdvancedView();
    var bB = el("button", "cc-seg-btn" + (!advNow ? " cc-seg-on" : ""), LANG === "de" ? "Einfach" : "Basic");
    var bA = el("button", "cc-seg-btn" + (advNow ? " cc-seg-on" : ""), LANG === "de" ? "Erweitert" : "Advanced");
    function setAdvView(v) {
      try { var inp = document.querySelector("input.advancedview"); if (inp && window.jQuery) window.jQuery(inp).prop("checked", v).trigger("change"); } catch (e2) {}
      closeMenu();
    }
    bB.addEventListener("click", function () { setAdvView(false); });
    bA.addEventListener("click", function () { setAdvView(true); });
    segA.appendChild(bB); segA.appendChild(bA);
    var arow = el("div", "cc-menu-row cc-menu-plain"); arow.appendChild(segA); m.appendChild(arow);
    // the rainbow and icon-colour toggles belong to the theming, so they hide with it
    if (themingOn()) {
      var segR = el("div", "cc-seg");
      var rbOn = localStorage.getItem("cc.rainbow") === "1";
      var bRoff = el("button", "cc-seg-btn" + (!rbOn ? " cc-seg-on" : ""), LANG === "de" ? "Rainbow aus" : "Rainbow off");
      var bRon = el("button", "cc-seg-btn" + (rbOn ? " cc-seg-on" : ""), LANG === "de" ? "Rainbow an" : "Rainbow on");
      var setRb = function (v) { localStorage.setItem("cc.rainbow", v ? "1" : "0"); localStorage.setItem("cc.flagmode", "0"); closeMenu(); applySettings(); if (mode === "list") { if (themingOn()) applyEnhanceClasses(); else removeEnhanceClasses(); reinjectRowBadges(); } else renderCurrentView(); };
      bRoff.addEventListener("click", function () { setRb(false); });
      bRon.addEventListener("click", function () { setRb(true); });
      segR.appendChild(bRoff); segR.appendChild(bRon);
      var rrow = el("div", "cc-menu-row cc-menu-plain"); rrow.appendChild(segR); m.appendChild(rrow);
      // the icon colours, on by default: the base palette, or the rainbow's in rainbow mode
      var segC = el("div", "cc-seg");
      var acOn = localStorage.getItem("cc.actcolors") !== "0";
      var bCoff = el("button", "cc-seg-btn" + (!acOn ? " cc-seg-on" : ""), LANG === "de" ? "Icons grau" : "Icons grey");
      var bCon = el("button", "cc-seg-btn" + (acOn ? " cc-seg-on" : ""), LANG === "de" ? "Icons farbig" : "Icons coloured");
      var setAc = function (v) { localStorage.setItem("cc.actcolors", v ? "1" : "0"); closeMenu(); applySettings(); if (mode === "list") { if (themingOn()) applyEnhanceClasses(); else removeEnhanceClasses(); reinjectRowBadges(); } else renderCurrentView(); };
      bCoff.addEventListener("click", function () { setAc(false); });
      bCon.addEventListener("click", function () { setAc(true); });
      segC.appendChild(bCoff); segC.appendChild(bCon);
      var crow = el("div", "cc-menu-row cc-menu-plain"); crow.appendChild(segC); m.appendChild(crow);
    }
    var frow = el("div", "cc-menu-row cc-menu-plain");
    var filter = el("input", "cc-filter"); filter.type = "text"; filter.placeholder = t("filter"); filter.value = filterText;
    filter.addEventListener("input", function () { filterText = norm(filter.value); applyFilter(); });
    frow.appendChild(filter); m.appendChild(frow);
    m.appendChild(el("div", "cc-menu-sep"));
    var prow = el("div", "cc-menu-row cc-menu-plain");
    var save = el("button", "cc-btn", t("save")), fire = el("button", "cc-btn cc-btn-primary", t("startorder"));
    save.addEventListener("click", function () { savePlan(false); }); fire.addEventListener("click", function () { savePlan(true); });
    prow.appendChild(save); prow.appendChild(fire); m.appendChild(prow);
    var link = el("a", "cc-menu-link", "⚙ " + (LANG === "de" ? "Einstellungen (Farbe, Spalten)…" : "Settings (color, columns)…"));
    link.href = "/Settings/CannonadeCommand"; m.appendChild(link);
    return m;
  }
  function positionMenu() {
    if (!menu || !menuAnchor) return;
    var r = menuAnchor.getBoundingClientRect(), w = menu.offsetWidth || 240;
    var left = Math.min(window.scrollX + r.right - w, window.scrollX + document.documentElement.clientWidth - w - 12);
    menu.style.left = Math.max(window.scrollX + 8, left) + "px";
    menu.style.top = (window.scrollY + r.bottom + 6) + "px";
  }
  // `builder` lets another caller, the per-card move-to-folder button, reuse this menu,
  // positioning and outside-click machinery for its own panel, so there is one open-menu system.
  function openMenu(anchor, builder) { closeMenu(); menuAnchor = anchor; menu = (builder || buildMenu)(); document.body.appendChild(menu); positionMenu(); }
  function closeMenu() { if (menu) { menu.remove(); menu = null; menuStatusEl = null; } }
  function toggleMenu(anchor, builder) { if (menu) closeMenu(); else openMenu(anchor, builder); }

  // The organizer behind the folder view, over the GraphQL helper header.js provides. Every
  // organizer write mutation returns the same wrapper as the read query, so they share a shape.
  var ORG_VIEW_SHAPE = 'id name rootId prefs flatEntries { id type name parentId depth position path hasChildren childrenIds }';
  var ORG_QUERY = '{ docker { organizer { views { ' + ORG_VIEW_SHAPE + ' } } } }';
  // version is the cheapest field that proves a write-only call succeeded, without re-fetching
  // the views this one does not change.
  var ORG_SETPREFS_MUT = 'mutation($viewId: String, $prefs: JSON!) { updateDockerViewPreferences(viewId: $viewId, prefs: $prefs) { version } }';
  // The four write mutations do re-fetch the views, since the folder structure has changed, so
  // the caller adopts the fresh state in one round trip.
  var ORG_CREATE_MUT = 'mutation($name: String!, $parentId: String) { createDockerFolder(name: $name, parentId: $parentId) { views { ' + ORG_VIEW_SHAPE + ' } } }';
  var ORG_RENAME_MUT = 'mutation($folderId: String!, $newName: String!) { renameDockerFolder(folderId: $folderId, newName: $newName) { views { ' + ORG_VIEW_SHAPE + ' } } }';
  var ORG_DELETE_MUT = 'mutation($entryIds: [String!]!) { deleteDockerEntries(entryIds: $entryIds) { views { ' + ORG_VIEW_SHAPE + ' } } }';
  var ORG_MOVE_MUT = 'mutation($sourceEntryIds: [String!]!, $destinationFolderId: String!) { moveDockerEntriesToFolder(sourceEntryIds: $sourceEntryIds, destinationFolderId: $destinationFolderId) { views { ' + ORG_VIEW_SHAPE + ' } } }';
  // A move with a position, for the drag reordering, which combines the folder move and the
  // placement in one call; ORG_MOVE_MUT appends instead.
  var ORG_MOVEPOS_MUT = 'mutation($sourceEntryIds: [String!]!, $destinationFolderId: String!, $position: Float!) { moveDockerItemsToPosition(sourceEntryIds: $sourceEntryIds, destinationFolderId: $destinationFolderId, position: $position) { views { ' + ORG_VIEW_SHAPE + ' } } }';
  function ccOrgQuery() {
    return ccGql(ORG_QUERY)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.errors) throw new Error(j.errors[0].message);
        var views = j.data && j.data.docker && j.data.docker.organizer && j.data.docker.organizer.views;
        return (views && views[0]) || null;
      });
  }
  function ccOrgMutate(mutation, variables) {
    return ccGql(mutation, variables)
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.errors) throw new Error(j.errors[0].message); return j.data; });
  }
  // Whether any folder beyond the root exists. Both "folder" and "group" count, as the other
  // organizer tools treat them alike.
  function ccOrgHasFolders() {
    if (!ccOrgView) return false;
    return ccOrgView.flatEntries.filter(function (e) { return e.type === "folder" || e.type === "group"; }).length > 1;
  }
  function ccOrgInit() {
    return ccOrgQuery().then(function (v) { ccOrgView = v; ccOrgAvailable = !!v; })
      .catch(function () { ccOrgView = null; ccOrgAvailable = false; }); // the feature flag is off or the API is unreachable
  }
  // CC's view mode is kept on the server through updateDockerViewPreferences as well as in
  // localStorage. `prefs` is a free-form blob shared with Unraid's own frontend, so CC's value
  // lives under a namespaced key and this merges into whatever is already there; the mutation
  // replaces the whole blob.
  function ccOrgSavePrefs(patch) {
    if (!ccOrgAvailable || !ccOrgView) return;
    var merged = {}; var cur = ccOrgView.prefs;
    if (cur && typeof cur === "object") for (var k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) merged[k] = cur[k];
    for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) merged[k2] = patch[k2];
    ccOrgMutate(ORG_SETPREFS_MUT, { viewId: ccOrgView.id, prefs: merged })
      .then(function () { ccOrgView.prefs = merged; })
      .catch(function () {}); // a failed prefs save stays quiet: localStorage already holds the value
  }

  // The write actions. CC remembers which folders it created and renames or deletes only those,
  // so a folder made by another organizer plugin, or by a future native UI, is read-only here.
  // The other plugins work the same way.
  var ORG_OWNED_KEY = "cc.orgOwned";
  function ccOrgOwnedIds() { try { var a = JSON.parse(localStorage.getItem(ORG_OWNED_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function ccOrgIsOwned(id) { return ccOrgOwnedIds().indexOf(id) >= 0; }
  function ccOrgMarkOwned(id) { var a = ccOrgOwnedIds(); if (a.indexOf(id) < 0) { a.push(id); localStorage.setItem(ORG_OWNED_KEY, JSON.stringify(a)); } }
  function ccOrgUnmarkOwned(id) { localStorage.setItem(ORG_OWNED_KEY, JSON.stringify(ccOrgOwnedIds().filter(function (x) { return x !== id; }))); }
  // Every write mutation returns the full fresh organizer state, so it is adopted in place rather
  // than fetched again, and the folder view repaints when it is on screen.
  function ccOrgAdopt(data, mutName) {
    var views = data && data[mutName] && data[mutName].views, v = views && views[0];
    if (!v) return; ccOrgView = v; ccOrgAvailable = true;
    if (mode === "folder") renderFolderView();
  }
  function ccOrgCreateFolder() {
    if (!ccOrgAvailable || !ccOrgView) return;
    var name = window.prompt(t("newFolderPrompt"), ""); if (!name) return; name = name.trim(); if (!name) return;
    var beforeIds = ccOrgView.flatEntries.filter(function (e2) { return e2.parentId === ccOrgView.rootId; }).map(function (e2) { return e2.id; });
    ccOrgMutate(ORG_CREATE_MUT, { name: name, parentId: ccOrgView.rootId })
      .then(function (data) {
        ccOrgAdopt(data, "createDockerFolder");
        // The new folder is found by name and type rather than by diffing against beforeIds: the
        // root can gain an unrelated entry between the two snapshots, such as a container someone
        // starts, and a plain diff would mark that as owned. beforeIds is only the tiebreaker for
        // a folder of the same name that already existed.
        var candidates = ccOrgView.flatEntries.filter(function (e2) { return e2.parentId === ccOrgView.rootId && e2.type === "folder" && e2.name === name; });
        var created = candidates.filter(function (e2) { return beforeIds.indexOf(e2.id) < 0; })[0] || candidates[0];
        if (created) ccOrgMarkOwned(created.id);
        setMode("folder"); // straight to the result, so the new folder is visible
      })
      .catch(function () { flash(t("invalid"), true); });
  }
  function ccOrgRenameFolder(id, oldName) {
    if (!ccOrgIsOwned(id)) return; // a folder CC did not create is read-only
    var name = window.prompt(t("renameFolderPrompt"), oldName || ""); if (!name) return; name = name.trim();
    if (!name || name === oldName) return;
    ccOrgMutate(ORG_RENAME_MUT, { folderId: id, newName: name })
      .then(function (data) { ccOrgAdopt(data, "renameDockerFolder"); })
      .catch(function () { flash(t("invalid"), true); });
  }
  function ccOrgDeleteFolder(id) {
    if (!ccOrgIsOwned(id) || !ccOrgView) return; // a folder CC did not create is read-only
    if (!window.confirm(t("deleteFolderConfirm"))) return;
    var kids = ccOrgView.flatEntries.filter(function (e2) { return e2.parentId === id; }).map(function (e2) { return e2.id; });
    var self2 = ccOrgView.flatEntries.filter(function (e2) { return e2.id === id; })[0];
    var parentId = (self2 && self2.parentId) || ccOrgView.rootId;
    // The contents move up to the folder's own parent before it is deleted: deleteDockerEntries
    // has no cascade, so an unrescued delete orphans every container inside.
    var rescue = kids.length ? ccOrgMutate(ORG_MOVE_MUT, { sourceEntryIds: kids, destinationFolderId: parentId }) : Promise.resolve(null);
    rescue.then(function () { return ccOrgMutate(ORG_DELETE_MUT, { entryIds: [id] }); })
      .then(function (data) { ccOrgUnmarkOwned(id); ccOrgAdopt(data, "deleteDockerEntries"); })
      .catch(function () { flash(t("invalid"), true); });
  }
  // Moves an entry into another folder, appended at the end. Both the click menu and a drop on a
  // folder head come through here. There is no ownership check: filing a container into a folder
  // does not restructure the folder, so it works with any of them, and only rename and delete
  // are gated.
  function ccOrgMoveToFolder(entryId, destFolderId) {
    if (!ccOrgAvailable || !ccOrgView) return;
    ccOrgMutate(ORG_MOVE_MUT, { sourceEntryIds: [entryId], destinationFolderId: destFolderId })
      .then(function (data) { ccOrgAdopt(data, "moveDockerEntriesToFolder"); })
      .catch(function () { flash(t("invalid"), true); });
  }
  // Moves an entry to a folder and a position, the drag reorder path. Dropping one item on
  // another moves it to that item's own folder and position, which is a reorder when the folder
  // does not change.
  function ccOrgMoveToPosition(entryId, destFolderId, position) {
    if (!ccOrgAvailable || !ccOrgView) return;
    ccOrgMutate(ORG_MOVEPOS_MUT, { sourceEntryIds: [entryId], destinationFolderId: destFolderId, position: position })
      .then(function (data) { ccOrgAdopt(data, "moveDockerItemsToPosition"); })
      .catch(function () { flash(t("invalid"), true); });
  }
  // The click-menu equivalent of dragging a card onto a folder, for touch and keyboard.
  function buildMoveMenu(entry) {
    var m = el("div", "cc-menu");
    m.addEventListener("click", function (e) { e.stopPropagation(); });
    m.appendChild(menuHead(t("moveToFolder")));
    var rootLink = el("div", "cc-menu-link" + (entry.parentId === ccOrgView.rootId ? " cc-menu-link-current" : ""), t("rootLevel"));
    rootLink.style.cursor = "pointer";
    rootLink.addEventListener("click", function () { closeMenu(); ccOrgMoveToFolder(entry.id, ccOrgView.rootId); });
    m.appendChild(rootLink);
    ccOrgView.flatEntries
      // The root entry is excluded: it is a folder too, and rootLink above already covers it, so
      // without this it appears a second time as its own destination.
      .filter(function (f) { return (f.type === "folder" || f.type === "group") && f.id !== entry.id && f.id !== ccOrgView.rootId; })
      .forEach(function (f) {
        var indent = new Array(Math.max(0, f.depth - 1) + 1).join("　"); // one full-width space per nesting level under the root
        var link = el("div", "cc-menu-link" + (entry.parentId === f.id ? " cc-menu-link-current" : ""), indent + f.name);
        link.style.cursor = "pointer";
        link.addEventListener("click", function () { closeMenu(); ccOrgMoveToFolder(entry.id, f.id); });
        m.appendChild(link);
      });
    return m;
  }

  function setMode(m) {
    if (!themingOn() && m !== "list") m = "list"; // the grid and folder views belong to the theming
    if (m === "folder" && !ccOrgAvailable) m = "list"; // never enter the folder view without organizer data
    mode = m; localStorage.setItem(VIEW_KEY, m); refresh();
    ccOrgSavePrefs({ ccViewMode: m });
  }
  // The folder view takes part in the same stats tick as the grid, so the readouts on a folder
  // rendered at the detail density stay live. refreshStats() updates every .cc-resgroup in the
  // document whichever view built it, and the grid and list densities build none, so the tick
  // does nothing for those two.
  function refresh() { applyMode(); if (mode === "grid" || mode === "folder" || (mode === "list" && colOn("res"))) refreshStats(); }
  // updates one resource badge group in place, its values only
  function updateResGroup(rg, s, state) {
    // The values are found by kind rather than by index. The bandwidth badge shows the live
    // rate, as CPU and RAM show live usage, while the configured cap stays in its dot, its gear
    // colour and its tooltip.
    var cpuV = rg.querySelector(".cc-b-cpu .cc-b-v"), ramV = rg.querySelector(".cc-b-ram .cc-b-v"), bwV = rg.querySelector(".cc-b-bw .cc-b-v");
    if (state !== "running") { if (cpuV) cpuV.textContent = "-"; if (ramV) ramV.textContent = "-"; if (bwV) bwV.textContent = "-"; return; }
    if (cpuV) cpuV.textContent = s ? (s.cpu_percent || 0) + "%" : "…";
    if (ramV) ramV.textContent = s ? humanBytes(s.mem_used) + " / " + humanBytes(s.mem_limit) : "…";
    if (bwV) bwV.textContent = netRate(s);
  }
  function applyMode() {
    try {
      if (dead) return;
      // With theming off there is no grid view and no .cc-enh class, so the native cells stay
      // native. The orchestration controls still go in through injectAllRowBadges(), whose
      // decorative blocks gate themselves on themingOn().
      if (!themingOn()) { hideNative(false); removeGridHolder(); removeEnhanceClasses(); injectAllRowBadges(); return; }
      if (mode === "grid") { removeEnhanceClasses(); clearRowBadges(); hideNative(true); renderGrid(); }
      else if (mode === "folder") { removeEnhanceClasses(); clearRowBadges(); hideNative(true); renderFolderView(); }
      else { hideNative(false); removeGridHolder(); applyEnhanceClasses(); injectAllRowBadges(); }
    } catch (e) { try { hideNative(false); } catch (e2) {} } // the native list must never be left hidden
  }
  // The folder view filters through a full re-render, which recomputes the per-card visibility
  // and the per-folder auto-expand together; see entryMatches() and effectiveCollapsed() inside
  // renderFolderView. It is cheap, being structural grouping with no stats to recompute, and the
  // filter input lives in the open gear menu rather than inside gridHolder, so rebuilding that
  // never touches the field being typed into.
  function applyFilter() {
    if (mode === "grid") { if (gridHolder) Array.prototype.slice.call(gridHolder.querySelectorAll(".cc-card")).forEach(function (cd) { cd.style.display = (!filterText || norm(cd.dataset.name).indexOf(filterText) >= 0) ? "" : "none"; }); }
    else if (mode === "folder") { if (ccOrgView) renderFolderView(); }
    else findRows().forEach(function (tr) { tr.style.display = (!filterText || norm(rowName(tr)).indexOf(filterText) >= 0) ? "" : "none"; });
  }
  function refreshStats() {
    api("GET", "stats").then(function (m) {
      stats = m || {};
      // The live rate in bytes per second, from the difference between the cumulative counters
      // and the previous sample. A container restart resets those counters, so the guard keeps a
      // rate from going negative.
      var now = Date.now();
      Object.keys(stats).forEach(function (nm) {
        var s = stats[nm], p = netPrev[nm];
        if (p && now > p.t && s.net_rx >= p.rx && s.net_tx >= p.tx) {
          var dt = (now - p.t) / 1000;
          s._rxr = (s.net_rx - p.rx) / dt; s._txr = (s.net_tx - p.tx) / dt;
        }
        netPrev[nm] = { rx: s.net_rx || 0, tx: s.net_tx || 0, t: now };
      });
      if (mode === "grid" && gridHolder) Array.prototype.slice.call(gridHolder.querySelectorAll(".cc-card")).forEach(function (cd) { var s = stats[cd.dataset.name]; if (!s) return; var f = cd.querySelectorAll(".cc-gauge-fill"), v = cd.querySelectorAll(".cc-stat-val"); if (f[0]) f[0].style.width = Math.min(100, s.cpu_percent) + "%"; if (v[0]) v[0].textContent = (s.cpu_percent || 0) + "%"; if (f[1]) f[1].style.width = Math.min(100, s.mem_percent) + "%"; if (v[1]) v[1].textContent = humanBytes(s.mem_used) + " / " + humanBytes(s.mem_limit); var nv = cd.querySelector(".cc-card-net"); if (nv) nv.textContent = netRate(s); });
      // the resource badges update in both modes, since a grid card carries a resgroup too
      Array.prototype.slice.call(document.querySelectorAll(".cc-resgroup")).forEach(function (rg) { var cn = containerByName(rg.dataset.name); updateResGroup(rg, stats[rg.dataset.name], cn && cn.state); });
    }).catch(function () {});
  }

  // The plan editor popover. Unraid's theme styles inputs and rows with selectors that beat this
  // plugin's stylesheet on the real page, and an inline style marked important cannot be beaten
  // by any stylesheet, so the geometry is stamped here.
  function hardenPop(root) {
    try {
      Array.prototype.slice.call(root.querySelectorAll(".cc-pop-row")).forEach(function (r) {
        if (r.classList.contains("cc-pop-act")) {
          r.style.setProperty("border-top", "none", "important"); // no separator lines in any popup
          // The action row keeps the window's 24px side inset, so the save button starts and ends
          // on the same x as every field above it, with a roomier gap to the bottom edge.
          r.style.setProperty("padding", "10px 24px 18px", "important");
          r.style.setProperty("margin", "0", "important");
          return;
        }
        // One side inset per window. A row inside a section wrapper already sits on that
        // wrapper's 14px margin and needs 10 of its own, while a row placed straight into the
        // window has no margin under it and needs the whole 24, or it stands proud of every
        // field. These are the numbers .cc-pop-head and .cc-pop-row use in docker.css, and this
        // stamp is !important, so the sheet alone cannot correct it.
        var wrapped = !!(r.closest && r.closest(".cc-pop-body, .cc-pop-auto, .cc-pop-sub"));
        r.style.setProperty("padding", wrapped ? "3px 10px" : "3px 24px", "important");
        r.style.setProperty("margin", "0", "important");
        // the row itself: one tight flex line, nothing may wrap or stretch it
        r.style.setProperty("display", "flex", "important");
        r.style.setProperty("align-items", "center", "important");
        r.style.setProperty("flex-wrap", "nowrap", "important");
        r.style.setProperty("min-height", "0", "important");
        r.style.setProperty("row-gap", "0", "important");
        // every child, the labels and spans as well as the inputs, since any of them can carry a
        // theme margin
        Array.prototype.slice.call(r.children).forEach(function (ch) {
          ch.style.setProperty("margin", "0", "important");
          ch.style.setProperty("line-height", "1.4", "important");
          ch.style.setProperty("min-height", "0", "important");
          // The label column is the exception. docker.css sizes .cc-pop-lbl with a min-width
          // floor and nowrap rather than a fixed width, since a fixed width cannot grow and a
          // longer label wraps inside it, and the blanket min-width:0 below would erase that
          // floor and leave the column ragged. The numbers match the sheet's, as .cc-port's do,
          // so Unraid's own label rules cannot beat them either; the plan window carries the long
          // labels and takes the wider floor.
          if (ch.classList.contains("cc-pop-lbl")) {
            ch.style.setProperty("flex", "0 0 auto", "important");
            ch.style.setProperty("width", "auto", "important");
            ch.style.setProperty("min-width", (ch.closest && ch.closest(".cc-pop-plan")) ? "120px" : "100px", "important");
            ch.style.setProperty("white-space", "nowrap", "important");
            return;
          }
          // A flex child defaults to min-width:auto, so an input's intrinsic width refuses to
          // shrink and pokes out of the popup; min-width:0 lets it fit the nowrap row.
          ch.style.setProperty("min-width", "0", "important");
        });
      });
      // The fill and the hover of a popup button are not written here. An inline
      // `background: … !important` beats Unraid's theme, but it beats CC's own rules too, so a
      // button could never take its own --cc-rb-c and the reactive rest-grey never reached one.
      // `html .cc-pop .cc-btn` in docker.css carries the same weight while leaving the colour
      // chain and :hover working. Only the border stays inline, since Unraid does put one on
      // these and removing it depends on no mode.
      Array.prototype.slice.call(root.querySelectorAll(".cc-btn")).forEach(function (b) {
        b.style.removeProperty("background");   // clears what an older release stamped; a hot-swapped script keeps the DOM
        b.style.removeProperty("color");
        b.style.removeProperty("filter");
        b.style.setProperty("border", "none", "important");
      });
      // uniform popup style everywhere, applied automatically: no head/foot separator lines
      var hh = root.querySelector(".cc-pop-head"); if (hh) hh.style.setProperty("border-bottom", "none", "important");
      var ff = root.querySelector(".cc-pop-foot"); if (ff) { ff.style.setProperty("border-top", "none", "important"); ff.style.setProperty("border-bottom", "none", "important"); }
      Array.prototype.slice.call(root.querySelectorAll(".cc-in")).forEach(function (i) {
        // The narrow fields keep their short width inline, since a stylesheet width loses to
        // Unraid's input rules. The plan window is the exception, where every field shares one
        // width; both halves have to move together, and .cc-pop-plan .cc-port in docker.css says
        // why the CPU and RAM window keeps its 80px, where the field is half of a value and unit
        // pair.
        if (i.classList.contains("cc-port")) {
          if (i.closest && i.closest(".cc-pop-plan")) { i.style.setProperty("width", "auto", "important"); i.style.setProperty("flex", "1 1 0", "important"); }
          else { i.style.setProperty("width", "80px", "important"); i.style.setProperty("flex", "0 0 auto", "important"); }
        }
        else if (i.classList.contains("cc-unit")) { i.style.setProperty("width", "68px", "important"); i.style.setProperty("flex", "0 0 auto", "important"); }
        else if (i.classList.contains("cc-sched-act")) { i.style.setProperty("width", "92px", "important"); i.style.setProperty("flex", "0 0 auto", "important"); }
        else if (i.classList.contains("cc-sched-time")) { i.style.setProperty("width", "100px", "important"); i.style.setProperty("flex", "0 0 auto", "important"); }
        i.style.setProperty("min-width", "0", "important");
        i.style.setProperty("max-width", "100%", "important");
        i.style.setProperty("box-sizing", "border-box", "important");
        // The fill is not stamped here either. The `background` shorthand also resets
        // background-image, where the field affordances live, the select caret and the clock
        // glyph on .cc-sched-time, and an inline !important rest colour cannot be beaten by
        // :focus, so the focus step never appears. `html .cc-pop .cc-in` in docker.css carries
        // the same weight against Unraid and leaves :focus working.
        i.style.removeProperty("background");
        i.style.removeProperty("background-color");
        i.style.setProperty("border", "none", "important");
        i.style.setProperty("box-shadow", "none", "important");
        i.style.setProperty("margin", "0", "important");
        i.style.setProperty("min-height", "0", "important");
        i.style.setProperty("height", "auto", "important");
        // The time field and the multi-select keep room on the right for their clock glyph and
        // caret; docker.css asks for it, and this inline padding would otherwise win and run the
        // text under the icon.
        i.style.setProperty("padding", (i.classList.contains("cc-sched-time") || i.classList.contains("cc-dropin")) ? "5px 24px 5px 8px" : "5px 8px", "important");
        i.style.setProperty("border-radius", "6px", "important");
        i.style.setProperty("line-height", "1.35", "important");
      });
    } catch (e) {}
  }
  // One painter for every control in a CC window: a single sequence in DOM order per window, so
  // two adjacent controls never land on the same palette slot and every control reads the same
  // var chain in the sheets. The dropdowns keep their own painter in cc-theme.js and the popup
  // titles theirs in header.js, both of which already rotate per element. The reactive sub-mode
  // is honoured by always stamping the custom properties and never forcing a rest colour, so the
  // sheets decide whether a control rests neutral until hover.
  var POP_PAINT_SEL = ".cc-set-toggle, input[type=checkbox], .cc-day, .cc-btn, .cc-sched-time, .cc-pop-x";
  // The checkbox tick carries its own contrast colour, since a white one vanishes on a light
  // palette slot. The `#` has to be percent-escaped or it truncates the data URI.
  function ccTickURL(c) {
    return "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3 8.5l3.2 3.2L13 5' fill='none' stroke='" + encodeURIComponent(c) + "' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")";
  }
  function paintPopChrome(root) {
    try {
      if (!root) return;
      var rb = themingOn() && localStorage.getItem("cc.rainbow") === "1";
      Array.prototype.slice.call(root.querySelectorAll(POP_PAINT_SEL)).forEach(function (e, i) {
        // Outside the rainbow the stamps are removed, so the sheets resolve to the plain accent,
        // but the tick colour is still computed: a chosen accent can be light too.
        var c = rb ? ccRbColor(i) : (effc("accent") || "#2f6feb"), tx = idealText(c);
        if (rb) { e.style.setProperty("--cc-rb-c", c); e.style.setProperty("--cc-rb-ct", tx); }
        else { e.style.removeProperty("--cc-rb-c"); e.style.removeProperty("--cc-rb-ct"); }
        if (e.type === "checkbox") e.style.setProperty("--cc-cb-tick", ccTickURL(tx));
      });
    } catch (e) {}
  }
  // While a window stands, the page behind it does not move, and a window too tall for the
  // viewport scrolls between its own title and button row rather than moving the page.
  //
  // It is overflow:hidden on html and body rather than the position:fixed with a negative top
  // trick, because the popups are absolute at document coordinates and re-basing the body would
  // tear them off their anchor; overflow:hidden leaves the scroll offset where it is and only
  // stops it changing. The scrollbar's width is measured and given back as body padding, or
  // taking the bar away widens the viewport and the whole page jumps sideways as the window
  // opens.
  function ccScrollLock(on) {
    try {
      var de = document.documentElement;
      if (on) {
        if (de.classList.contains("cc-scrolllock")) return;
        var sbw = window.innerWidth - de.clientWidth;
        if (sbw > 0) de.style.setProperty("--cc-sbw", sbw + "px");
        de.classList.add("cc-scrolllock");
      } else {
        de.classList.remove("cc-scrolllock");
        de.style.removeProperty("--cc-sbw");
      }
    } catch (e) {}
  }
  // The title and the button row stay put and only the region between them scrolls. The .cc-pop
  // windows build their content as a flat list of children, so rather than restructuring each
  // builder, everything between the head and the action row is moved into one .cc-pop-mid
  // wrapper here, which covers any future window too. It runs before the positioning, so the
  // offsetHeight there measures the capped window.
  function popAnchorParts(pop) {
    var head = pop.querySelector(":scope > .cc-pop-head"), act = pop.querySelector(":scope > .cc-pop-act");
    if (!head || pop.querySelector(":scope > .cc-pop-mid")) return;
    var mid = el("div", "cc-pop-mid"), n = head.nextSibling, kids = [];
    while (n && n !== act) { kids.push(n); n = n.nextSibling; }
    if (!kids.length) return;
    pop.insertBefore(mid, act || null);
    kids.forEach(function (k) { mid.appendChild(k); });
  }
  // The placement clamp, shared by every .cc-pop window. With the page pinned, a window opened
  // off a row near an edge cannot be scrolled into view, so it is clamped into the viewport: the
  // preferred spot is under its anchor, and it slides up or left as far as needed to sit on
  // screen. With .cc-pop's max-height and the scrolling .cc-pop-mid, every window is reachable at
  // any viewport size without the page moving.
  //
  // It runs on every size change, not once at open: the plan editor grows afterwards, when a
  // schedule row is added or a probe switch reveals a field, and the box would otherwise grow
  // downward from a top that suited its old height, leaving the button row below the fold with
  // the page pinned. Both axes are clamped, since a viewport can narrow under a standing window
  // as easily as it can shorten. data-cc-top and data-cc-left remember the anchor-relative spot,
  // so removing a row or widening the viewport lets the window slide back. Neither write can
  // feed the ResizeObserver, because a position never changes the box's size.
  function clampPop(pop) {
    try {
      if (!pop || !pop.parentNode) return;
      var de = document.documentElement;
      var vh = de.clientHeight || window.innerHeight, vw = de.clientWidth || window.innerWidth;
      var h = pop.offsetHeight || 0, top = parseFloat(pop.getAttribute("data-cc-top") || "0");
      if (top + h + 8 > vh) top = Math.max(8, vh - h - 8);
      pop.style.top = (window.scrollY + top) + "px";
      var lAttr = pop.getAttribute("data-cc-left");
      if (lAttr !== null) {
        var w = pop.offsetWidth || parseFloat(pop.getAttribute("data-cc-minw") || "0") || 320, left = parseFloat(lAttr);
        if (left + w + 12 > vw) left = vw - w - 12;
        pop.style.left = (window.scrollX + Math.max(8, left)) + "px";
      }
    } catch (e) {}
  }
  function placePop(pop, anchor, minW) {
    popAnchorParts(pop);
    paintSelects();   // the window's .cc-dsel lists join the colour modes, document-wide so the rotation keeps one sequence
    paintPopChrome(pop);   // and so does every other control in it, through the one chokepoint every window shares
    var r = anchor.getBoundingClientRect();
    // the preferred spot only; clampPop owns the first placement and every later one, so the two
    // cannot disagree
    pop.setAttribute("data-cc-top", String(r.bottom + 6));
    pop.setAttribute("data-cc-left", String(r.left));
    if (minW) pop.setAttribute("data-cc-minw", String(minW));   // the caller's fallback width, for when offsetWidth reads 0
    clampPop(pop);
    openPop = pop; openPopAnchor = anchor;
    ccScrollLock(true);
    // A ResizeObserver rather than patching every growth site: the editor has several (add/remove a
    // schedule row, the probe switch, an error strip appearing), and a guard wired at one of them is a
    // guard missing at the others. clampPop only writes `top`/`left`, never a size, so it cannot feed itself.
    try { if (popRo) { popRo.disconnect(); popRo = null; } if (window.ResizeObserver) { popRo = new ResizeObserver(function () { clampPop(pop); }); popRo.observe(pop); } } catch (e) {}
  }
  var popRo = null, popRz = 0;
  // The viewport can change under a standing window too, through a browser resize or a rotated
  // tablet. Same clamp, one listener for the life of the page.
  try { window.addEventListener("resize", function () { if (!openPop || popRz) return; popRz = requestAnimationFrame(function () { popRz = 0; clampPop(openPop); }); }); } catch (e) {}
  // Every dismiss path comes through here, the close control, a click outside, Escape, a second
  // click on the same badge, a successful save and the page teardown, which is why the scroll
  // unlock lives here and nowhere else.
  function closePop() { try { if (popRo) { popRo.disconnect(); popRo = null; } } catch (e) {} if (openPop) { openPop.remove(); openPop = null; openPopAnchor = null; } Array.prototype.slice.call(document.querySelectorAll(".cc-drop")).forEach(function (n) { n.remove(); }); ccScrollLock(false); }
  // clicking the SAME badge again closes its popover (toggle). Returns true if it closed.
  function togglePop(anchor) { if (openPop && openPopAnchor === anchor) { closePop(); return true; } return false; }
  function refreshChip(chip, name) { var node = workingPlan[name]; chip.classList.toggle("cc-plan-on", !!node); var v = chip.querySelector(".cc-b-v"); if (v) v.textContent = depsTxt(node); }
  // The (i) beside a label, whose hover explains the dropdown's options. It is the same .cc-info
  // every other area builds in cc-theme.js, riding the same body-level #cc-tipfloat, so it stays
  // neutral, cannot be clipped by an overflow ancestor, closes on Escape and on focus-out, and
  // its bubble takes no pointer events. The [key, text] pairs flatten to one line each; the
  // bubble renders them pre-line.
  function infoBubble(items) {
    if (typeof items === "string") items = [["", items]];   // a plain prose bubble
    var txt = items.map(function (it) { return it[0] ? it[0] + " · " + it[1] : it[1]; }).join("\n");
    var b = (window.CCTheme && window.CCTheme.infoIcon) ? window.CCTheme.infoIcon(txt) : (function () {
      var s = el("span", "cc-info"); s.setAttribute("data-tip", txt); s.setAttribute("aria-label", txt); s.setAttribute("tabindex", "0"); return s;
    })();
    // inside a <label> the (i) must not toggle the label's checkbox (section-header bubbles)
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); });
    return b;
  }
  function lblInfo(text, items) { var l = el("label", "cc-pop-lbl cc-lbl-info"); l.appendChild(document.createTextNode(text)); l.appendChild(infoBubble(items)); return l; }
  function probeItems() {
    return LANG === "de"
      ? [["health", "Docker-Healthcheck meldet healthy"], ["running", "Container läuft (kurze Karenz)"], ["tcp", "ein TCP-Port nimmt Verbindungen an"], ["http", "ein HTTP-GET liefert 2xx/3xx"], ["exec", "ein Befehl im Container endet mit Code 0"], ["log", "ein Text taucht im Log auf"]]
      : [["health", "Docker healthcheck reports healthy"], ["running", "container is up (short grace)"], ["tcp", "a TCP port accepts connections"], ["http", "an HTTP GET returns 2xx/3xx"], ["exec", "a command inside exits 0"], ["log", "a string appears in the log"]];
  }
  function policyItems() {
    return LANG === "de"
      ? [["abort", "Kette anhalten, Abhängige nicht starten"], ["continue", "trotzdem weiter, Abhängige starten"], ["degrade", "weiter, aber als degraded markieren"]]
      : [["abort", "stop the chain, don't start dependents"], ["continue", "carry on, start dependents anyway"], ["degrade", "carry on but mark as degraded"]];
  }
  // A container's restart policy is applied live, with no recreate. It is read with the CPU and
  // RAM limits and set through POST /api/restartpolicy, which also mirrors --restart into the
  // Unraid template, so a later recreate keeps it.
  function restartPolicyLabel(p) { return t(p === "unless-stopped" ? "rpUnlessStopped" : p === "always" ? "rpAlways" : p === "on-failure" ? "rpOnFailure" : "rpNo"); }
  // The lead line says what the control does and that it takes effect at once, and each option
  // says what happens in the two cases anyone is choosing between: you stopped it, or it fell
  // over. An empty key renders as a plain line, with no prefix; see infoBubble.
  function restartPolicyItems() {
    return LANG === "de"
      ? [["", "Dockers eigener Auto-Start: er entscheidet, ob Docker den Container von selbst wieder hochfährt, nachdem er abgestürzt ist oder nachdem der Server neu gestartet wurde. Gilt sofort, der Container wird dafür nicht neu erstellt, und es läuft auch dann, wenn CannonadeCommand gerade nicht läuft."],
          ["Nein", "Nie von selbst. Nach einem Server-Neustart bleibt der Container aus, bis du ihn startest."],
          ["Außer wenn gestoppt", "Kommt nach einem Absturz und nach einem Server-Neustart wieder hoch, aber nicht, wenn du ihn selbst gestoppt hast. Für die meisten Container die richtige Wahl."],
          ["Immer", "Kommt in jedem Fall wieder hoch, auch wenn du ihn gerade selbst gestoppt hast."],
          ["Bei Fehler", "Nur nach einem Absturz, also wenn der Container sich mit einem Fehler beendet hat. Nach einem sauberen Stopp bleibt er aus."]]
      : [["", "Docker's own auto-start: it decides whether Docker brings the container back up by itself after it has crashed, and after the server has rebooted. Takes effect straight away, the container is not recreated for it, and it works even while CannonadeCommand is not running."],
          ["No", "Never by itself. After a server reboot the container stays down until you start it."],
          ["Unless stopped", "Comes back after a crash and after a server reboot, but not if you stopped it yourself. The right choice for most containers."],
          ["Always", "Comes back in every case, even if you stopped it yourself a moment ago."],
          ["On failure", "Only after a crash, meaning the container exited with an error. After a clean stop it stays down."]];
  }
  // The restart-policy dropdown, prefilled to `cur`. Factored out so a DOM test can pin its shape.
  function restartPolicySelect(cur) {
    var sel = el("select", "cc-in cc-rp-sel");
    RESTART_POLICIES.forEach(function (p) { var o = el("option", null, restartPolicyLabel(p)); o.value = p; if (p === cur) o.selected = true; sel.appendChild(o); });
    return sel;
  }
  // The per-item icon mode: the four choices the settings page offers globally, plus an explicit
  // "follows the global setting", which is the default, so nothing is pinned until it is chosen.
  // It is kept in the shared cc.iconov map in cc-theme.js, which rides the settings sync.
  function iconModeItems() {
    return LANG === "de"
      ? [["", "Wie CannonadeCommand das Logo dieses Eintrags einfärbt. Ohne eigene Wahl gilt, was in den Einstellungen unter „Icon-Färbung“ steht."],
          ["Automatisch", "CannonadeCommand entscheidet selbst: einfarbige Logos werden zu sauberer Tinte geglättet, für bekannte Programme wird ein echtes Glyph-Logo geholt, alles andere bekommt eine Tönung, die die Zeichnung im Bild erhält."],
          ["Natives Icon", "Keine Einfärbung. Das Logo bleibt in seinen echten Farben; nur ein deutlich besseres Logo aus der gepflegten Sammlung wird noch bevorzugt."],
          ["Ink-Flatten", "Immer zu einer flachen Tinte glätten. Bei bunten Logos mit Hintergrund kann dabei die Zeichnung verloren gehen; das ist Teil der Wahl."],
          ["Luminanz-Tint", "Immer tönen. Helle Stellen bleiben hell, dunkle dunkel, das Logo behält seine Zeichnung."]]
      : [["", "How CannonadeCommand colours this entry's logo. With no choice of its own, the Settings page's “Icon colouring” applies."],
          ["Automatic", "CannonadeCommand decides: single-tone logos are flattened to clean ink, known apps get a real glyph logo fetched for them, everything else is tinted in a way that keeps the drawing inside the image."],
          ["Native icon", "No colouring. The logo keeps its real colours; only a markedly better logo from the curated set is still preferred."],
          ["Ink flatten", "Always flatten to one flat ink. On colourful logos with a background this can lose the drawing; that is part of the choice."],
          ["Luminance tint", "Always tint. Bright stays bright, dark stays dark, the logo keeps its drawing."]];
  }
  function iconModeSelect(scope, name) {
    var CI = window.CCTheme && window.CCTheme.icons;
    var sel = el("select", "cc-in cc-icm-sel");
    var cur = CI ? CI.override(scope, name) : "";
    [["", t("iconInherit")], ["auto", t("iconAuto")], ["native", t("iconNative")], ["flat", t("iconFlat")], ["tint", t("iconTint")]].forEach(function (o) {
      var op = el("option", null, o[1]); op.value = o[0]; if (o[0] === cur) op.selected = true; sel.appendChild(op);
    });
    sel.addEventListener("change", function () {
      if (!CI) return;
      CI.setOverride(scope, name, sel.value);
      applyIconTint();               // this row repaints at once; every other row keeps the global default
      if (mode !== "list") renderCurrentView();
    });
    return sel;
  }
  // The per-row warning badge for a container whose restart policy is "no", so it does not
  // come back after a host reboot. Semantic amber like cc-b-del, outside rainbow and accent.
  function restartWarnBadge() {
    var b = badgeInfo("⚠", t("rpWarn"), "restart"); b.classList.add("cc-b-warn"); b.setAttribute("data-tip", t("rpWarnTip")); return b;
  }
  // The time picker. A native <input type=time> expands into the browser's own drop-down, which
  // CSS cannot reach past a couple of vendor pseudo-elements, so it opens as a light panel over
  // CC's dark window. GlimStone Rule 18 replaces such a control with the widget the app already
  // has: this window builds a .cc-drop panel for "Hängt ab von", so the picker is that panel with
  // two columns, hours 00-23 and minutes 00-59. Same class and same lifecycle, closePop() already
  // sweeps .cc-drop, and paintSelects() in cc-theme.js therefore carries it through the colour
  // modes without a painter of its own.
  // The <input> stays the source of truth: typing HH:MM still works and row._read is untouched.
  // docker.css hides the native indicator and sets color-scheme: dark, so the browser's own
  // picker is dark too for anyone who reaches it by keyboard.
  function ccTimePicker(input) {
    var panel = null, chips = [[], []];
    function closePanel() { if (panel) { panel.remove(); panel = null; document.removeEventListener("mousedown", onDoc, true); } }
    function onDoc(e) { if (panel && !panel.contains(e.target) && e.target !== input) closePanel(); }
    function two(n) { return (n < 10 ? "0" : "") + n; }
    function parts() { var m = /^(\d{1,2}):(\d{1,2})$/.exec(input.value || ""); return m ? [Math.min(23, +m[1]), Math.min(59, +m[2])] : [null, null]; }
    function write(h, mi) {
      var p = parts();
      input.value = two(h == null ? (p[0] == null ? 0 : p[0]) : h) + ":" + two(mi == null ? (p[1] == null ? 0 : p[1]) : mi);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function open() {
      if (panel) return;
      panel = el("div", "cc-drop cc-timepick");
      chips = [[], []];
      var cur = parts();
      [{ n: 24, on: cur[0], set: function (v) { write(v, null); } }, { n: 60, on: cur[1], set: function (v) { write(null, v); } }].forEach(function (col, ci) {
        var c = el("div", "cc-tp-col");
        for (var v = 0; v < col.n; v++) {
          var it = el("div", "cc-drop-it" + (v === col.on ? " cc-drop-on" : ""), two(v));
          // mousedown + preventDefault, exactly like the dependency list: the field keeps focus and the
          // panel stays open, so hour and minute are picked in one visit instead of two.
          it.addEventListener("mousedown", (function (set, ci2, it2, v2) {
            return function (ev) {
              ev.preventDefault(); ev.stopPropagation();
              set(v2);
              chips[ci2].forEach(function (o) { o.classList.remove("cc-drop-on"); });
              it2.classList.add("cc-drop-on");
            };
          })(col.set, ci, it, v));
          chips[ci].push(it); c.appendChild(it);
        }
        panel.appendChild(c);
      });
      document.body.appendChild(panel);
      // Under the field, or above it when a schedule row sits near the bottom edge. The page
      // behind is scroll-locked while a window stands (Rule 15), so a panel off the fold would
      // be unreachable.
      var r = input.getBoundingClientRect(), ph = panel.offsetHeight, pw = panel.offsetWidth;
      var vh = document.documentElement.clientHeight || window.innerHeight, vw = document.documentElement.clientWidth || window.innerWidth;
      var top = (r.bottom + 3 + ph > vh && r.top - 3 - ph > 0) ? r.top - 3 - ph : r.bottom + 3;
      // Both edges are clamped: a schedule row sits at the right-hand end of a window that is
      // itself clamped to the viewport, and clamping only the left let the panel run off the
      // right edge (measured right 1514 in a 1500px viewport). Same reasoning as clampPop.
      panel.style.left = Math.max(window.scrollX + 8, Math.min(window.scrollX + r.left, window.scrollX + vw - pw - 8)) + "px";
      panel.style.top = (window.scrollY + Math.max(8, Math.min(top, vh - ph - 8))) + "px";
      // open ON the current value: 22:45 must not show 00 at the top of both columns
      chips.forEach(function (cs) { for (var i = 0; i < cs.length; i++) if (cs[i].classList.contains("cc-drop-on")) { cs[i].parentNode.scrollTop = Math.max(0, cs[i].offsetTop - 64); break; } });
      paintSelects();   // the picker joins the colour modes like every other CC dropdown
      document.addEventListener("mousedown", onDoc, true);
    }
    input.addEventListener("focus", open);
    input.addEventListener("click", function (ev) { ev.stopPropagation(); open(); });
  }
  function openEditor(anchor, name) {
    if (togglePop(anchor)) return;
    closePop();
    var existing = workingPlan[name], node = existing || { name: name, after: [], probe: { kind: "health" }, policy: "abort" };
    // cc-pop-plan is wider than the other two .cc-pop editors: a schedule row is action, time,
    // seven day chips and the delete badge, and at the shared 340px it always wrapped onto two
    // lines. The measured budget lives with the rule in docker.css.
    var pop = el("div", "cc-pop cc-pop-plan"); if (localStorage.getItem("cc.rainbow") === "1") pop.classList.add("cc-rainbow");
    // No container name and no separator line in the head, just the close control, slim and
    // borderless.
    var head = el("div", "cc-pop-head");
    head.style.setProperty("border-bottom", "none", "important");
    head.style.setProperty("padding", "6px 24px 0 24px", "important");   // 24 is the window's side inset (docker.css .cc-pop-head), so the close control shares its right edge with the toggle and every field below
    head.style.setProperty("justify-content", "flex-end", "important");
    var x = el("span", "cc-pop-x", "✕"); x.addEventListener("click", closePop); head.appendChild(x); pop.appendChild(head);
    // "Manage in the start plan" is a toggle, not a checkbox. manageOn drives commit().
    var manageOn = !!existing;
    var manageTog = el("span", "cc-set-toggle" + (manageOn ? " cc-set-toggle-on" : "")); manageTog.setAttribute("role", "switch"); manageTog.setAttribute("tabindex", "0"); manageTog.setAttribute("aria-checked", manageOn ? "true" : "false"); manageTog.appendChild(el("span", "cc-set-knob"));
    function flipManage() { manageOn = !manageOn; manageTog.classList.toggle("cc-set-toggle-on", manageOn); manageTog.setAttribute("aria-checked", manageOn ? "true" : "false"); commit(); }
    manageTog.addEventListener("click", flipManage);
    manageTog.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flipManage(); } });
    var mrow = el("div", "cc-pop-row cc-pop-toggle"); mrow.appendChild(el("span", "cc-pop-sech", t("manage"))); mrow.appendChild(el("span", "cc-set-spacer")); mrow.appendChild(manageTog); pop.appendChild(mrow);
    var body = el("div", "cc-pop-body" + (existing ? "" : " cc-dis"));
    // This is the one field in the window whose behaviour the control does not show: a text box
    // holding a comma list that is really a click-to-toggle multi-select, feeding an ordering
    // engine that also waits on the "Bereit wenn" probe of everything named in it. cc-dropin
    // gives it the arrow that says so.
    var arow = el("div", "cc-pop-row"); arow.appendChild(lblInfo(t("dependsOn"), t("dependsOnInfo")));
    var after = el("input", "cc-in cc-dropin"); after.type = "text"; after.placeholder = t("commaSep"); after.value = (node.after || []).join(", "); arow.appendChild(after); body.appendChild(arow);
    // A multi-select dropdown. A native datalist replaces the whole value, so only one container
    // would be pickable; this list opens on focus, every click toggles a container in the comma
    // list, and it stays open for picking several.
    (function () {
      var panel = null;
      function closePanel() { if (panel) { panel.remove(); panel = null; document.removeEventListener("mousedown", onDoc, true); } }
      function onDoc(e) { if (panel && !panel.contains(e.target) && e.target !== after) closePanel(); }
      function vals() { return after.value.split(",").map(function (s2) { return s2.trim(); }).filter(Boolean); }
      after.addEventListener("focus", function () {
        if (panel) return;
        panel = el("div", "cc-drop");
        containerNames.forEach(function (n2) {
          if (n2 === name) return;
          var it = el("div", "cc-drop-it", n2);
          var sync = function () { it.classList.toggle("cc-drop-on", vals().indexOf(n2) >= 0); };
          sync();
          it.addEventListener("mousedown", function (ev) {
            ev.preventDefault(); ev.stopPropagation(); // keep focus, keep the panel open
            var l2 = vals(), ix = l2.indexOf(n2);
            if (ix >= 0) l2.splice(ix, 1); else l2.push(n2);
            after.value = l2.join(", "); sync(); commit();
          });
          panel.appendChild(it);
        });
        var r2 = after.getBoundingClientRect();
        panel.style.left = (window.scrollX + r2.left) + "px"; panel.style.top = (window.scrollY + r2.bottom + 3) + "px"; panel.style.minWidth = r2.width + "px";
        document.body.appendChild(panel);
        paintSelects();   // the "Hängt ab von" list joins the colour modes like every other CC dropdown
        document.addEventListener("mousedown", onDoc, true);
      });
    })();
    var drow = el("div", "cc-pop-row"); drow.appendChild(el("label", "cc-pop-lbl", t("startDelay")));
    var delay = el("input", "cc-in cc-port"); delay.type = "number"; delay.min = "0"; delay.placeholder = "sec"; delay.value = node.delay_seconds ? node.delay_seconds : "";
    // no trailing "sec to wait" span: the placeholder already says "sec", and the extra
    // flex child could wrap and double the row height (one source of the stubborn gap).
    drow.appendChild(delay); body.appendChild(drow);
    // Per-container start order. A lower positive number starts earlier, empty or 0 means
    // unnumbered and therefore last, in list order. It is a priority, so duplicates are allowed
    // and ties break by list order; dependencies and health gates still bound it in the engine,
    // so a number never races a dependency.
    var sorow = el("div", "cc-pop-row"); sorow.appendChild(lblInfo(t("startOrder"), t("startOrderInfo")));   // the prose string goes in as a string; infoBubble wraps it, while an array of one string would take its first two characters as key and text
    var sorder = el("input", "cc-in cc-port"); sorder.type = "number"; sorder.min = "0"; sorder.step = "1"; sorder.placeholder = t("startOrderPh"); sorder.value = node.start_order ? node.start_order : "";
    sorow.appendChild(sorder); body.appendChild(sorow);
    var prow = el("div", "cc-pop-row"); prow.appendChild(lblInfo(t("readyWhen"), probeItems()));
    var probe = el("select", "cc-in"); PROBES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.probe && node.probe.kind === p) o.selected = true; probe.appendChild(o); });
    var port = el("input", "cc-in cc-port"); port.type = "number"; port.placeholder = "port"; port.value = (node.probe && node.probe.port) ? node.probe.port : "";
    var pathIn = el("input", "cc-in cc-port"); pathIn.type = "text"; pathIn.placeholder = "/health"; pathIn.value = (node.probe && node.probe.path) ? node.probe.path : "";
    var cmdIn = el("input", "cc-in"); cmdIn.type = "text"; cmdIn.placeholder = t("execPh"); cmdIn.value = (node.probe && node.probe.command) ? node.probe.command : "";
    var matchIn = el("input", "cc-in"); matchIn.type = "text"; matchIn.placeholder = t("logPh"); matchIn.value = (node.probe && node.probe.match) ? node.probe.match : "";
    var syncPort = function () { var k = probe.value; port.style.display = (k === "tcp" || k === "http") ? "" : "none"; pathIn.style.display = k === "http" ? "" : "none"; cmdIn.style.display = k === "exec" ? "" : "none"; matchIn.style.display = k === "log" ? "" : "none"; }; syncPort();
    prow.appendChild(probe); prow.appendChild(port); prow.appendChild(pathIn); prow.appendChild(cmdIn); prow.appendChild(matchIn); body.appendChild(prow);
    var polrow = el("div", "cc-pop-row"); polrow.appendChild(lblInfo(t("onFail"), policyItems().concat([["", t("failhint")]])));   // failhint rides in the bubble, no loose info text in the window
    var pol = el("select", "cc-in"); POLICIES.forEach(function (p) { var o = el("option", null, p); o.value = p; if (node.policy === p) o.selected = true; pol.appendChild(o); });
    polrow.appendChild(pol); body.appendChild(polrow); pop.appendChild(body);

    // The Docker restart policy, independent of plan membership. It applies on change through
    // POST /api/restartpolicy without a recreate and is mirrored into the template so a later
    // Apply keeps it. Prefilled from the limits cache, then refined by a fresh per-name read.
    var rpSec = el("div", "cc-pop-auto");
    var rpRow = el("div", "cc-pop-row"); rpRow.appendChild(lblInfo(t("restartPolicy"), restartPolicyItems()));
    var rpSel = restartPolicySelect((limits[name] && limits[name].restart_policy) || "no");
    rpRow.appendChild(rpSel); rpSec.appendChild(rpRow); pop.appendChild(rpSec);
    function setRpCache(p) { if (limits[name]) limits[name].restart_policy = p; else limits[name] = { restart_policy: p }; }
    rpSel.addEventListener("change", function () {
      popClearError(); flash(t("saving"));
      api("POST", "restartpolicy", { name: name, policy: rpSel.value })
        .then(function (resp) {
          var applied = (resp && resp.after_policy) ? resp.after_policy : rpSel.value;
          rpSel.value = applied; setRpCache(applied);
          flash(t("done"));
          if (mode === "list") reinjectRowBadges(); else renderCurrentView();
        })
        .catch(function (e) { flash("Error: " + e.message, true); });
    });
    // The authoritative prefill; the bulk limits map can be stale after another edit.
    api("GET", "limits", null, "name=" + encodeURIComponent(name)).then(function (l) {
      if (l && l.restart_policy) { rpSel.value = l.restart_policy; setRpCache(l.restart_policy); }
    }).catch(function () {});

    // Icon colouring, this container's own pin.
    var icSec = el("div", "cc-pop-auto");
    var icRow = el("div", "cc-pop-row"); icRow.appendChild(lblInfo(t("iconMode"), iconModeItems()));
    icRow.appendChild(iconModeSelect("docker", name)); icSec.appendChild(icRow); pop.appendChild(icSec);

    // The auto-restart watchdog, independent of plan membership.
    var wd = watchdogFor(name);
    var wSec = el("div", "cc-pop-auto");
    // cc-cb is CC's own checkbox from docker.css, not the operating system's box tinted with
    // accent-color; GlimStone Rule 18.
    var wHead = el("label", "cc-pop-row cc-pop-toggle"), wEn = el("input", "cc-cb"); wEn.type = "checkbox"; wEn.checked = !!(wd && wd.enabled);
    wHead.appendChild(wEn); wHead.appendChild(el("span", "cc-pop-sech", t("watchdog"))); wSec.appendChild(wHead);
    var wBody = el("div", "cc-pop-sub" + (wEn.checked ? "" : " cc-dis"));
    var wUrow = el("label", "cc-pop-row"), wU = el("input", "cc-cb"); wU.type = "checkbox"; wU.checked = wd ? !!wd.on_unhealthy : true;
    wUrow.appendChild(wU); wUrow.appendChild(el("span", null, " " + t("wUnhealthy"))); wBody.appendChild(wUrow);
    var wXrow = el("label", "cc-pop-row"), wX = el("input", "cc-cb"); wX.type = "checkbox"; wX.checked = wd ? !!wd.on_exit : false;
    wXrow.appendChild(wX); wXrow.appendChild(el("span", null, " " + t("wExit"))); wBody.appendChild(wXrow);
    var wMrow = el("div", "cc-pop-row"); wMrow.appendChild(el("label", "cc-pop-lbl", t("wMax")));
    // A new watchdog starts with a per-hour cap rather than unlimited, so a flapping container
    // is bounded and gives up once instead of restarting forever. An existing watchdog keeps
    // its saved value; blank is 0, which is unlimited.
    var wM = el("input", "cc-in cc-port"); wM.type = "number"; wM.min = "0"; wM.placeholder = "0 = ∞"; wM.value = wd ? (wd.max_restarts ? wd.max_restarts : "") : "6";
    wMrow.appendChild(wM); wBody.appendChild(wMrow); wSec.appendChild(wBody);
    wEn.addEventListener("change", function () { wBody.classList.toggle("cc-dis", !wEn.checked); });
    pop.appendChild(wSec);
    function readWatchdog() { if (!wEn.checked) return null; return { name: name, enabled: true, on_unhealthy: !!wU.checked, on_exit: !!wX.checked, max_restarts: parseInt(wM.value, 10) || 0 }; }

    // Idle auto-stop, in the style of ContainerNursery. It stays one collapsed group, a toggle
    // and two inputs, so the editor does not grow another section.
    var ni = idleStopFor(name);
    var nSec = el("div", "cc-pop-auto");
    var nHead = el("label", "cc-pop-row cc-pop-toggle"), nEn = el("input", "cc-cb"); nEn.type = "checkbox"; nEn.checked = !!(ni && ni.enabled);
    nHead.appendChild(nEn); nHead.appendChild(el("span", "cc-pop-sech", t("idleStop"))); nHead.appendChild(infoBubble(t("idleFoot"))); nSec.appendChild(nHead);   // idleFoot rides as a bubble on the header, no loose foot text
    var nBody = el("div", "cc-pop-sub" + (nEn.checked ? "" : " cc-dis"));
    var nMrow = el("div", "cc-pop-row"); nMrow.appendChild(el("label", "cc-pop-lbl", t("idleMin")));
    var nMin = el("input", "cc-in cc-port"); nMin.type = "number"; nMin.min = "1"; nMin.placeholder = "30"; nMin.value = (ni && ni.idle_minutes) ? ni.idle_minutes : "";
    nMrow.appendChild(nMin); nBody.appendChild(nMrow);
    var nCrow = el("div", "cc-pop-row"); nCrow.appendChild(el("label", "cc-pop-lbl", t("idleCpu")));
    var nCpu = el("input", "cc-in cc-port"); nCpu.type = "number"; nCpu.min = "0"; nCpu.max = "100"; nCpu.placeholder = "5"; nCpu.value = (ni && ni.cpu_threshold_pct) ? ni.cpu_threshold_pct : "";
    nCrow.appendChild(nCpu); nBody.appendChild(nCrow); nSec.appendChild(nBody);
    nEn.addEventListener("change", function () { nBody.classList.toggle("cc-dis", !nEn.checked); });
    pop.appendChild(nSec);
    // Enabled with blank or invalid minutes falls back to the placeholder of 30 rather than 0,
    // because a 0 persists an enabled entry that the monitor ignores while the plan chip still
    // marks it active. A blank or 0 CPU is fine, the monitor reads anything <= 0 as its 5%
    // default.
    function readNursery() { if (!nEn.checked) return null; return { name: name, enabled: true, idle_minutes: parseInt(nMin.value, 10) || 30, cpu_threshold_pct: parseFloat(nCpu.value) || 0 }; }

    // Timed lifecycle actions, independent of plan membership.
    function schedRow(s) {
      var row = el("div", "cc-sched-row");
      var act2 = el("select", "cc-in cc-sched-act"); SCHED_ACTIONS.forEach(function (a) { var o = el("option", null, t(a)); o.value = a; if (s && s.action === a) o.selected = true; act2.appendChild(o); });
      var time = el("input", "cc-in cc-sched-time"); time.type = "time"; time.value = (s && s.time) || "";
      ccTimePicker(time);   // Rule 18: CC's own two-column panel instead of the browser's light drop-down
      var days = el("div", "cc-days"), sel = {}; ((s && s.days) || []).forEach(function (d) { sel[d] = true; });
      DAYS.forEach(function (d) { var b = el("span", "cc-day" + (sel[d[1]] ? " cc-day-on" : ""), d[0]); b.dataset.day = d[1]; b.addEventListener("click", function (e) { e.preventDefault(); b.classList.toggle("cc-day-on"); }); days.appendChild(b); });
      // stopPropagation is load-bearing: the document-level "click outside closes the window"
      // guard tests openPop.contains(e.target), and this handler detaches e.target from the
      // window before that test runs, so removing one schedule row reads as a click outside and
      // shuts the whole editor along with every unsaved edit in it.
      // The delete control is a badge box-for-box like the .cc-day chip beside it, 26×26 on the
      // same shape-engine radius, filled semantic red because deleting is destructive (Rule 4,
      // like .cc-b-del), which is also why it stays out of POP_PAINT_SEL and takes no palette
      // jewel.
      var rm = el("span", "cc-sched-x"); rm.innerHTML = CC_TRASH_SVG; rm.setAttribute("data-tip", t("remove")); rm.setAttribute("aria-label", t("remove")); rm.addEventListener("click", function (ev) { ev.stopPropagation(); row.remove(); });
      row.appendChild(act2); row.appendChild(time); row.appendChild(days); row.appendChild(rm);
      ctWrapSelect(act2);   // the schedule action <select> gets the CC dsel panel too; it dispatches a native change, so row._read still reads act2.value
      // No days means every day; only rows with a valid HH:MM time are saved.
      row._read = function () { if (!/^\d{2}:\d{2}$/.test(time.value)) return null; var ds = []; Array.prototype.slice.call(days.children).forEach(function (x) { if (x.classList.contains("cc-day-on")) ds.push(parseInt(x.dataset.day, 10)); }); var o = { name: name, action: act2.value, time: time.value, enabled: true }; if (ds.length) o.days = ds; return o; };
      return row;
    }
    var sSec = el("div", "cc-pop-auto"); sSec.appendChild(el("div", "cc-pop-sech cc-pop-sech-lone", t("schedules")));
    var sList = el("div", "cc-sched-list"); schedulesFor(name).forEach(function (s) { sList.appendChild(schedRow(s)); }); sSec.appendChild(sList);
    // A row added after the window opened goes through the same two passes the window itself
    // got. With paintSelects() alone, a fresh row's time field carried no hardenPop stamp
    // (measured 116px instead of the 100px every other row has, Unraid's theme margins back on
    // it) and none of its controls had a --cc-rb-c jewel. hardenPop is scoped to the new row;
    // paintPopChrome re-runs over the whole window so the rotation stays one continuous sequence
    // rather than restarting at slot 0 inside the new row.
    var addB = el("span", "cc-btn cc-btn-sm", t("addsched"));
    addB.addEventListener("click", function () { var nr = schedRow(null); sList.appendChild(nr); hardenPop(nr); paintSelects(); paintPopChrome(pop); });
    sSec.appendChild(addB);
    pop.appendChild(sSec);
    function readSchedules() { var out = []; Array.prototype.slice.call(sList.children).forEach(function (r) { if (r._read) { var v = r._read(); if (v) out.push(v); } }); return out; }

    // Bandwidth has its own gear in the CPU and RAM resource group, a third stacked badge, so
    // all three limits sit together.

    // One save button stores the whole plan plus this container's automation; running the start
    // order stays a daemon and apply concern.
    var act = el("div", "cc-pop-row cc-pop-act");
    act.style.setProperty("border-top", "none", "important"); // no bottom separator line either
    var bSave = el("span", "cc-btn cc-btn-primary", t("saveShort"));
    bSave.addEventListener("click", function () { saveEditor(name, readWatchdog(), readSchedules(), readNursery(), false); });
    act.appendChild(bSave); pop.appendChild(act);
    function commit() {
      if (!manageOn) { delete workingPlan[name]; body.classList.add("cc-dis"); refreshChip(anchor, name); return; }
      body.classList.remove("cc-dis");
      var afterList = after.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var pr = { kind: probe.value }, pv = parseInt(port.value, 10);
      if (probe.value === "tcp" && pv > 0) pr.port = pv;
      if (probe.value === "http") { if (pv > 0) pr.port = pv; var pt = pathIn.value.trim(); if (pt) pr.path = pt; }
      if (probe.value === "exec") { var cm = cmdIn.value.trim(); if (cm) pr.command = cm; }
      if (probe.value === "log") { var mt = matchIn.value.trim(); if (mt) pr.match = mt; }
      if (probe.value === "running") pr.grace_seconds = 3;
      var dv = parseInt(delay.value, 10);
      var sov = parseInt(sorder.value, 10);
      var n = { name: name, after: afterList, probe: pr, policy: pol.value };
      if (dv > 0) n.delay_seconds = dv;
      if (sov > 0) n.start_order = sov;   // 0 or empty means unnumbered
      workingPlan[name] = n; refreshChip(anchor, name);
    }
    [after, delay, sorder, probe, port, pathIn, cmdIn, matchIn, pol].forEach(function (n) {
      // Editing a plan field with the manage toggle off would discard the input, because
      // commit() deletes unmanaged plans, so the first edit turns managing on.
      var arm2 = function () { if (!manageOn) flipManage(); };
      n.addEventListener("change", function () { arm2(); commit(); });
      n.addEventListener("input", function () { arm2(); commit(); });
    });
    probe.addEventListener("change", syncPort);
    document.body.appendChild(pop); hardenPop(pop);
    // The editor's native <select>s for probe, policy and restart policy get the CC dsel panel;
    // the schedule action selects are already wrapped inside schedRow. ctWrapSelect keeps the
    // <select> as the source of truth and dispatches a native change, so every commit() and API
    // listener above still fires.
    Array.prototype.slice.call(pop.querySelectorAll("select:not([data-cc-dsel])")).forEach(function (s) { try { ctWrapSelect(s); } catch (e) {} });
    placePop(pop, anchor, 320);   // Rule 15: anchors head/foot, clamps into the viewport, locks the page behind it
  }

  // The CPU and RAM limits editor, on top of Docker's container update.
  // parseCPU returns 0 for empty, meaning leave unchanged, NanoCPUs for a valid count, or -1 for
  // unparseable input; comma decimals are normalised first. RAM is a number plus an MB/GB unit.
  function parseCPU(s) { s = String(s || "").trim().replace(",", "."); if (!s) return 0; if (!/^[\d.]+$/.test(s)) return -1; var n = parseFloat(s); return n > 0 ? Math.round(n * 1e9) : 0; }
  // cpuset string ("0-3,6") <-> a sorted array of core indices, for the pin grid.
  function cpusetToSet(str) { var out = []; String(str || "").split(",").forEach(function (p) { p = p.trim(); var m = /^(\d+)-(\d+)$/.exec(p); if (m) { for (var i = +m[1]; i <= +m[2]; i++) out.push(i); } else if (/^\d+$/.test(p)) out.push(+p); }); return out; }
  function setToCpuset(arr) { arr = arr.slice().sort(function (a, b) { return a - b; }); var parts = [], i = 0; while (i < arr.length) { var j = i; while (j + 1 < arr.length && arr[j + 1] === arr[j] + 1) j++; parts.push(i === j ? String(arr[i]) : arr[i] + "-" + arr[j]); i = j + 1; } return parts.join(","); }
  // The fill is stamped inline with priority, because Unraid's theme CSS beats the stylesheet
  // and leaves the gears hollow.
  function gearFill(lb, set, kind) {
    // In the reactive sub-mode neither a set nor an idle gear paints inline. CSS rests them all
    // neutral and colours them on row or card hover, like every other control, and an inline
    // paint would keep one gear stuck coloured.
    var rbOn = themingOn() && localStorage.getItem("cc.rainbow") === "1";
    // In either rainbow sub-mode the gear's kind colour (cpu, ram or bw, each --cc-rb-<kind> on
    // :root) goes on --cc-rb-c and CSS decides the rest: neutral grey under the rbneutral class,
    // always coloured in full rainbow, with the reactive :hover rule revealing --cc-rb-c.
    // Clearing --cc-rb-c instead would drop hover back to the flat accent for every gear.
    if (rbOn && kind) {
      lb.style.removeProperty("background"); lb.style.removeProperty("color");
      lb.style.setProperty("--cc-rb-c", "var(--cc-rb-" + kind + ", var(--cc-accent, #2f6feb))");
      lb.style.setProperty("--cc-rb-ct", "var(--cc-rb-" + kind + "-t, #fff)");
      return;
    }
    lb.style.removeProperty("--cc-rb-c"); lb.style.removeProperty("--cc-rb-ct");   // accent and native mode take the inline fill
    var bg = set ? (effc("accent") || "#2f6feb") : "#4a4a4a"; // a set limit carries the badge accent
    var tx = "#f2f2f2";
    if (set) { var n2 = parseInt(String(bg).replace("#", ""), 16), L2 = 0.299 * (n2 >> 16 & 255) + 0.587 * (n2 >> 8 & 255) + 0.114 * (n2 & 255); tx = L2 > 150 ? "#161616" : "#fff"; }
    lb.style.setProperty("background", bg, "important");
    lb.style.setProperty("color", tx, "important");
  }
  function limGear(name, which, set) {
    var lb = el("span", "cc-limbtn" + (set ? " cc-limbtn-set" : "") + " cc-lim-" + which); lb.setAttribute(MARK, "1"); lb.innerHTML = CC_GEAR_SVG;
    gearFill(lb, set, which);   // "cpu" or "ram", each its own rainbow kind
    lb.setAttribute("data-tip", (which === "cpu" ? t("cpuLimit") : t("ramLimit")) + " · " + (set ? t("cfgSet") : t("cfgUnset")));
    lb.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openLimits(lb, name, which); });
    return lb;
  }
  // The bandwidth gear on the third resource line opens the egress-limit editor.
  function bwGear(name, set) {
    var lb = el("span", "cc-limbtn" + (set ? " cc-limbtn-set" : "") + " cc-lim-bw"); lb.setAttribute(MARK, "1"); lb.innerHTML = CC_GEAR_SVG;
    gearFill(lb, set, "bw");
    lb.setAttribute("data-tip", t("bandwidth") + " · " + (set ? t("cfgSet") : t("cfgUnset")));
    lb.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openBandwidth(lb, name); });
    return lb;
  }
  // Egress rate-limit editor, mirroring the CPU/RAM limit popover. Save writes the whole
  // config (read-modify-write) so nothing else is dropped; the monitor (re-)applies the tc
  // rule on the Settings-chosen interface while the container runs. "Remove" clears it.
  function openBandwidth(anchor, name) {
    if (togglePop(anchor)) return;
    closePop();
    var pop = el("div", "cc-pop"); if (localStorage.getItem("cc.rainbow") === "1") pop.classList.add("cc-rainbow");
    var head = el("div", "cc-pop-head");
    // The info text lives in one bubble beside the window title.
    var ttl = el("span", "cc-pop-ttl"); ttl.appendChild(el("b", null, t("bandwidth")));
    ttl.appendChild(infoBubble(LANG === "de"
      ? "Bandbreitenlimit pro Container: Upload wird per tbf-Shaper begrenzt, Download per Netfilter-Policing. 0 oder leer = unbegrenzt. Die Statuszeile unten prüft live, ob die Regel wirklich greift."
      : "Per-container bandwidth cap: upload is shaped via tbf, download via netfilter policing. 0 or blank = unlimited. The status line below verifies live that the rule is really in place."));
    head.appendChild(ttl);
    var x = el("span", "cc-pop-x", "✕"); x.addEventListener("click", closePop); head.appendChild(x); pop.appendChild(head);
    var body = el("div", "cc-pop-body");
    var cur = bandwidthFor(name);
    // One Mbit/s field per direction, prefilled from curKbit; blank means no cap.
    function rateRow(labelText, curKbit) {
      var row = el("div", "cc-pop-row"); row.appendChild(el("label", "cc-pop-lbl", labelText));
      var inp = el("input", "cc-in"); inp.type = "number"; inp.min = "0"; inp.step = "0.1"; inp.placeholder = "0 = ∞";
      inp.value = (curKbit > 0) ? (Math.round(curKbit / 1000 * 100) / 100) : "";
      row.appendChild(inp); row.appendChild(el("span", "cc-unit", "Mbit/s")); body.appendChild(row);
      return inp;
    }
    // Upload is a tbf egress shaper. Download is netfilter policing, an iptables hashlimit on
    // the container's INPUT chain, and stays clear of the tc ingress qdisc, whose sch_ingress
    // module crashes some Unraid kernels.
    var upIn = rateRow(t("upload"), cur && cur.egress_kbit);
    var dnIn = rateRow(t("download"), cur && cur.ingress_kbit);
    Array.prototype.slice.call(body.children).forEach(statSlot);   // reserve the dot slots so the fields never shrink
    pop.classList.add("cc-pop-stat");                              // window sized for field, unit and dot
    pop.appendChild(body); // no explainer text; the diagnosis line says what matters
    function readKbit(inp) { var v = parseFloat(String(inp.value).trim().replace(",", ".")); return v > 0 ? Math.round(v * 1000) : 0; }
    var srow = el("div", "cc-pop-row cc-pop-act");
    var rem = el("span", "cc-btn", t("removeLim")); rem.addEventListener("click", function () { saveBandwidth(name, 0, 0); });
    var save = el("span", "cc-btn cc-btn-primary", t("saveShort")); save.addEventListener("click", function () { saveBandwidth(name, readKbit(upIn), readKbit(dnIn)); });
    srow.appendChild(rem); srow.appendChild(save); pop.appendChild(srow);
    document.body.appendChild(pop); hardenPop(pop);
    placePop(pop, anchor, 300);   // Rule 15: anchors head/foot, clamps into the viewport, locks the page behind it
    checkBwStatus(pop, name); // live diagnosis: is the limit in place right now?
  }
  function checkBwStatus(pop, name) {
    api("GET", "bwstatus", null, "name=" + encodeURIComponent(name)).then(function (st) {
      if (openPop !== pop) return;
      if (!st || st.error) { popError(new Error((st && st.error) || "bwstatus unreadable")); return; }
      var hasUp = (st.qdisc || "").indexOf("tbf") >= 0, hasDn = (st.filter || "").indexOf("hashlimit") >= 0;
      var cur2 = bandwidthFor(name);
      var wantUp = !!(cur2 && cur2.egress_kbit > 0), wantDn = !!(cur2 && cur2.ingress_kbit > 0);
      var base = "iface " + (st.iface || "eth0") + (st.last_apply ? " · Apply " + st.last_apply : "");
      // Status per field: a round green check or red cross behind Upload and Download, with the
      // full diagnosis in its hover bubble instead of a loose status box in the window.
      var rows = pop.querySelectorAll(".cc-pop-body > .cc-pop-row"), rUp = rows[0], rDn = rows[1];
      var A = LANG === "de" ? "AKTIV" : "ACTIVE", M = LANG === "de" ? "FEHLT" : "MISSING";
      var hl = st.filter && st.filter.indexOf("hashlimit") >= 0 ? st.filter.split("\n").filter(function (l2) { return l2.indexOf("hashlimit") >= 0; }).join(" ") : "";
      popClearError();
      if (wantUp) statDot(rUp, hasUp, "↑ tbf " + (hasUp ? A : M) + " · " + base + (st.qdisc ? " · " + st.qdisc : ""));
      else if (hasUp) statDot(rUp, false, (LANG === "de" ? "entfernt, Regel noch aktiv, wird gleich geräumt · " : "removed, rule still active, clearing shortly · ") + base);
      else statClear(rUp);
      if (wantDn) statDot(rDn, hasDn, "↓ policing " + (hasDn ? A : M) + " · " + base + (hl ? " · " + hl : ""));
      else if (hasDn) statDot(rDn, false, (LANG === "de" ? "entfernt, Regel noch aktiv, wird gleich geräumt · " : "removed, rule still active, clearing shortly · ") + base);
      else statClear(rDn);
    }).catch(function () {});
  }
  // The round apply-status dot behind a field: a green check for verified applied, a red cross
  // for failed, with the detail on hover. One dot per row, replaced in place on every re-check.
  // It rides the same body-level bubble as the (i) explainers, so every hover explainer inside
  // a CC window is one mechanism.
  function statDot(row, ok, text) {
    if (!row) return;
    var d = row.querySelector(":scope > .cc-statdot");
    if (!d) { d = el("span", "cc-statdot"); row.appendChild(d); }
    d.className = "cc-statdot " + (ok ? "cc-stat-ok" : "cc-stat-bad");
    d.textContent = ok ? "✓" : "✕";
    if (text) { d.setAttribute("data-tip", text); d.setAttribute("aria-label", text); } else { d.removeAttribute("data-tip"); d.removeAttribute("aria-label"); }
    return d;
  }
  // The dot's slot is reserved from the start, so the field does not shrink when the dot
  // appears; statDot only makes the placeholder visible.
  function statSlot(row) { if (row && !row.querySelector(":scope > .cc-statdot")) row.appendChild(el("span", "cc-statdot cc-stat-slot")); }
  function statClear(row) { var d = row && row.querySelector(":scope > .cc-statdot"); if (d) { d.className = "cc-statdot cc-stat-slot"; d.textContent = ""; d.removeAttribute("data-tip"); d.removeAttribute("aria-label"); } }   // data-tip goes too: an invisible slot with a live tip would pop a bubble over nothing
  // The backend or Docker rejection stays in the open window, where a 2.6s toast would be
  // unreadable, so the reason `docker update` refused can still be read back. It is the only
  // way to diagnose a set or remove failure once a stale install is ruled out. Also logged.
  function popError(e) {
    var m = (e && e.message) ? e.message : String(e);
    try { console.error("CannonadeCommand:", e); } catch (_) {}
    var p = openPop; if (!p) { flash("Error: " + m, true); return; }
    var box = p.querySelector(".cc-pop-err");
    if (!box) { box = el("div", "cc-pop-err"); var foot = p.querySelector(".cc-pop-foot"); if (foot && foot.nextSibling) p.insertBefore(box, foot.nextSibling); else p.appendChild(box); }
    box.classList.remove("cc-pop-ok"); box.textContent = "✕ " + m; box.style.display = "block";
  }
  function popClearError() { var p = openPop; if (!p) return; var box = p.querySelector(".cc-pop-err"); if (box) { box.textContent = ""; box.style.display = "none"; box.classList.remove("cc-pop-ok"); } }
  // Green confirmation in the same slot as the error line, carrying the verified values.
  function popOk(msg) {
    var p = openPop; if (!p) { flash(msg); return; }
    var box = p.querySelector(".cc-pop-err");
    if (!box) { box = el("div", "cc-pop-err"); var foot = p.querySelector(".cc-pop-foot"); if (foot && foot.nextSibling) p.insertBefore(box, foot.nextSibling); else p.appendChild(box); }
    box.classList.add("cc-pop-ok"); box.textContent = msg; box.style.display = "block";
  }
  // Persist one container's up and down caps, where 0/0 removes them. It is a read, modify and
  // write against the live config, so schedules, watchdogs, notify, shape_iface and every other
  // container survive the save.
  function saveBandwidth(name, egressKbit, ingressKbit) {
    popClearError(); flash(t("saving"));
    api("GET", "config")
      .then(function (fresh) {
        if (!fresh || typeof fresh !== "object") throw new Error("config unreadable");
        config = { schedules: fresh.schedules || [], watchdogs: fresh.watchdogs || [], bandwidths: fresh.bandwidths || [], idle_stops: fresh.idle_stops || [], notify: fresh.notify || { unraid: false, webhook: "" }, shape_iface: fresh.shape_iface || "", ui_settings: fresh.ui_settings || undefined };
        setBandwidth(name, egressKbit, ingressKbit);
        return api("PUT", "config", config);
      })
      .then(function () {
        flash(t("done"));
        if (mode === "list") reinjectRowBadges(); else renderCurrentView();
        // The window stays open and verifies: the save kicks the monitor server-side, so the
        // rule exists within moments and the proof or the failure shows right here.
        var pop0 = openPop;
        if (pop0) {
          flash(LANG === "de" ? "gespeichert, wende an…" : "saved, applying…");   // a transient note as toast; the per-field dots carry the verified result
          setTimeout(function () { if (openPop === pop0) checkBwStatus(pop0, name); }, 1600);
          setTimeout(function () { if (openPop === pop0) checkBwStatus(pop0, name); }, 5000);
        }
      })
      .catch(function (e) { popError(e); });
  }
  // Each badge has its own gear, so "cpu" or "ram" shows only that field. RAM is a number with
  // an MB/GB unit, CPU a core count with an optional cpuset pin.
  function openLimits(anchor, name, which) {
    if (togglePop(anchor)) return;
    closePop();
    var showRam = which !== "cpu", showCpu = which !== "ram";
    var title = which === "cpu" ? t("cpuLimit") : which === "ram" ? t("ramLimit") : "CPU / RAM";
    var pop = el("div", "cc-pop cc-pop-stat"); if (localStorage.getItem("cc.rainbow") === "1") pop.classList.add("cc-rainbow");
    var head = el("div", "cc-pop-head");
    // The info text lives in one bubble beside the window title, not in a foot line.
    var ttl = el("span", "cc-pop-ttl"); ttl.appendChild(el("b", null, title)); ttl.appendChild(infoBubble(t("limitsFoot"))); head.appendChild(ttl);
    var x = el("span", "cc-pop-x", "✕"); x.addEventListener("click", closePop); head.appendChild(x); pop.appendChild(head);
    var body = el("div", "cc-pop-body"), memNum = null, memUnit = null, cpu = null;
    var readCpuset = function () { return ""; }, fillCpuset = function () {};
    if (showRam) {
      var mrow = el("div", "cc-pop-row"); mrow.appendChild(el("label", "cc-pop-lbl", t("ramLimit")));
      memNum = el("input", "cc-in"); memNum.type = "number"; memNum.min = "0"; memNum.step = "0.5"; memNum.placeholder = t("ramNum");
      memUnit = el("select", "cc-in cc-unit"); ["MB", "GB"].forEach(function (u) { var o = el("option", null, u); o.value = u; if (u === "GB") o.selected = true; memUnit.appendChild(o); });
      mrow.appendChild(memNum); mrow.appendChild(memUnit); statSlot(mrow); body.appendChild(mrow);
    }
    if (showCpu) {
      var crow = el("div", "cc-pop-row"); crow.appendChild(el("label", "cc-pop-lbl", t("cpuLimit")));
      cpu = el("input", "cc-in"); cpu.type = "text"; cpu.placeholder = t("cpuNum"); crow.appendChild(cpu); statSlot(crow); body.appendChild(crow);
      // CPU pinning is a graphical core picker like the VM manager's: one box per physical core
      // with its hyperthreads stacked inside, wrapping into rows, so a 32-thread CPU is a block
      // rather than a long column. On an Intel hybrid CPU the boxes carry a P or E tag from the
      // engine's /sys cpu_core and cpu_atom lists. The counts come from the engine, meaning the
      // host's CPUs, not navigator.hardwareConcurrency. Empty means all.
      pop.classList.add("cc-pop-wide"); // pinning needs the extra width
      var prow = el("div", "cc-pop-row cc-pin-row"); prow.appendChild(el("label", "cc-pop-lbl", t("cpuPin")));
      var ncpu = hostCpus || navigator.hardwareConcurrency || 0;
      var coreOf = (hostCoreOf && hostCoreOf.length === ncpu) ? hostCoreOf : null;
      var isE = {}; hostECores.forEach(function (n) { isE[n] = true; });
      var hybrid = hostPCores.length > 0 && hostECores.length > 0;
      if (ncpu > 0 && ncpu <= 512) {
        var grid = el("div", "cc-cores");
        // Group the logical CPUs by physical core; without a core map every CPU is its own group.
        var groups = {}, order = [];
        for (var ci = 0; ci < ncpu; ci++) {
          var g = coreOf ? coreOf[ci] : ci;
          if (!groups[g]) { groups[g] = []; order.push(g); }
          groups[g].push(ci);
        }
        order.forEach(function (g) {
          var box = el("span", "cc-corebox");
          if (hybrid) {
            var e = groups[g].every(function (n) { return isE[n]; });
            box.classList.add(e ? "cc-corebox-e" : "cc-corebox-p");
            box.appendChild(el("span", "cc-corebox-tag", e ? "E" : "P"));
          }
          groups[g].forEach(function (cpu2) {
            var core = el("span", "cc-core cc-rb-" + (g % 8), String(cpu2)); core.dataset.core = cpu2; // cc-rb-N: rainbow mode colours selected cores per physical-core group
            core.setAttribute("data-tip", "CPU " + cpu2 + (coreOf ? " · core " + g : "") + (hybrid ? (isE[cpu2] ? " · E-core" : " · P-core") : ""));
            core.addEventListener("click", function () { this.classList.toggle("cc-core-on"); });
            box.appendChild(core);
          });
          grid.appendChild(box);
        });
        prow.appendChild(grid);
        readCpuset = function () { var sel = []; Array.prototype.slice.call(grid.querySelectorAll(".cc-core")).forEach(function (c) { if (c.classList.contains("cc-core-on")) sel.push(parseInt(c.dataset.core, 10)); }); return setToCpuset(sel); };
        fillCpuset = function (str) { var s = cpusetToSet(str); Array.prototype.slice.call(grid.querySelectorAll(".cc-core")).forEach(function (c) { c.classList.toggle("cc-core-on", s.indexOf(parseInt(c.dataset.core, 10)) >= 0); }); };
      } else {
        var pinIn = el("input", "cc-in"); pinIn.type = "text"; pinIn.placeholder = t("cpuPinPh"); prow.appendChild(pinIn);
        readCpuset = function () { return String(pinIn.value).trim().replace(/\s+/g, ""); };
        fillCpuset = function (str) { pinIn.value = str || ""; };
      }
      body.appendChild(prow);
    }
    pop.appendChild(body);
    function submitLimits(payload) {
      popClearError(); flash(t("saving")); api("POST", "limits", payload)
        .then(function (resp) {
          // The engine verifies the change by re-reading the live caps and returns them, so
          // "did it apply?" is answered in the editor: a round green dot behind the field with
          // the verified values in its hover bubble. The window stays open so the dot can be
          // hovered.
          var tmpl = resp && resp.template ? " · " + resp.template : "";
          if (resp && resp.after_mem != null) {
            if (showRam && mrow) statDot(mrow, true, "RAM " + humanBytes(resp.after_mem) + tmpl);
            if (showCpu && crow) statDot(crow, true, "CPU " + (resp.after_nano > 0 ? (Math.round(resp.after_nano / 1e7) / 100) : "∞") + (resp.after_cpuset ? " · " + resp.after_cpuset : "") + tmpl);
            // Seed the cache with the verified values so an immediate reopen prefills at once;
            // the bulk re-inspect below can take seconds.
            limits[name] = { mem_bytes: resp.after_mem, nano_cpus: resp.after_nano || 0, cpuset_cpus: resp.after_cpuset || "" };
            cur = limits[name]; curLoaded = true;
          } else {
            // Missing verified values mean either the verify read failed or the daemon on the
            // box predates it, so the red dot carries the raw reply.
            var fmsg = (LANG === "de" ? "Rücklese fehlt" : "verify read missing") + " · raw=" + JSON.stringify(resp) + tmpl;
            if (showRam && mrow) statDot(mrow, false, fmsg);
            if (showCpu && crow) statDot(crow, false, fmsg);
          }
          flash(t("done")); return loadLimits();
        })
        .then(function () {
          if (mode === "list") reinjectRowBadges(); else renderCurrentView();
          // No auto-close: the result dot lives in the window, which is closed by hand.
        })
        .catch(function (e) {
          var em = (e && e.message) ? e.message : String(e);
          if (showRam && mrow) statDot(mrow, false, em);
          if (showCpu && crow) statDot(crow, false, em);
          try { console.error("CannonadeCommand:", e); } catch (_) {}
        });
    }
    var srow = el("div", "cc-pop-row cc-pop-act");
    // "remove" is an explicit flag rather than a client-computed value: the engine sets the
    // field to practical-unlimited, host RAM or all cores, and strips it from the template.
    // Sending remove_* instead of mem_bytes=hostMem also covers a browser whose cached hostMem
    // is 0, where the Remove button would otherwise do nothing.
    var rem = el("span", "cc-btn", t("removeLim"));
    rem.addEventListener("click", function () {
      var payload = { name: name };
      if (showRam) payload.remove_mem = true;
      if (showCpu) payload.remove_cpu = true;
      submitLimits(payload);
    });
    // cur holds this container's current limits from the fresh per-name prefill GET, not from
    // the bulk map, which can be stale, and curLoaded flips true once that GET lands. The
    // "clear a field to remove" decision reads cur and fires only when curLoaded, so a Save
    // made before the prefill returns cannot remove a limit nobody touched, and cannot miss a
    // real removal because the bulk map was stale.
    var cur = limits[name] || {}, curLoaded = false;
    var save = el("span", "cc-btn cc-btn-primary", t("saveShort"));
    save.addEventListener("click", function () {
      // The fields are prefilled with the current limits, so clearing one means "remove that
      // limit", which is how a cap is lifted, not "leave unchanged". A value sets the limit;
      // an empty field on a currently limited container sends remove_mem or remove_cpu.
      var payload = { name: name }, act = false;
      if (memNum) {
        var v = String(memNum.value).trim().replace(",", ".");
        if (v) {
          var num = parseFloat(v);
          if (!(num >= 0)) { flash(t("invalid"), true); return; }
          payload.mem_bytes = Math.round(num * (memUnit.value === "GB" ? 1073741824 : 1048576)); act = true;
        } else if (curLoaded && ramLimited(cur)) { payload.remove_mem = true; act = true; } // cleared → remove
      }
      if (showCpu) {
        var cv = cpu ? String(cpu.value).trim() : "";
        var cpuset = readCpuset();
        if (cpuset && !/^[0-9,\-]+$/.test(cpuset)) { flash(t("invalid"), true); return; }
        var nc = cv ? parseCPU(cpu.value) : 0;
        if (nc < 0) { flash(t("invalid"), true); return; }
        if (nc > 0 || cpuset) {
          if (nc > 0) payload.nano_cpus = nc;
          if (cpuset) payload.cpuset_cpus = cpuset;
          act = true;
        } else if (curLoaded && (cpuLimited(cur) || cpuPinned(cur))) { payload.remove_cpu = true; act = true; } // both CPU controls cleared → remove
      }
      if (!act) { closePop(); return; } // nothing set and nothing to remove
      submitLimits(payload);
    });
    srow.appendChild(rem); srow.appendChild(save); pop.appendChild(srow);
    document.body.appendChild(pop); hardenPop(pop);
    placePop(pop, anchor, 340);   // Rule 15: anchors head/foot, clamps into the viewport, locks the page behind it
    // Prefill at once from the cached bulk map: the fresh per-name GET can queue seconds behind
    // the save-triggered bulk inspect sweep, and an editor that renders empty in that window
    // reads as "it is not saving" although the limit is saved (reproduced headless: the window
    // was empty 500ms after reopen while docker held the value). The authoritative per-name read
    // then refreshes the fields when it lands. Only real limits are prefilled; a
    // practical-unlimited value from an earlier removal stays blank.
    function prefill(l) {
      if (!l) return;
      if (memNum && ramLimited(l)) { if (l.mem_bytes >= 1073741824) { memNum.value = Math.round(l.mem_bytes / 1073741824 * 100) / 100; memUnit.value = "GB"; } else { memNum.value = Math.round(l.mem_bytes / 1048576); memUnit.value = "MB"; } }
      if (cpu && cpuLimited(l)) cpu.value = String(Math.round(l.nano_cpus / 1e9 * 100) / 100);
      if (cpuPinned(l)) fillCpuset(l.cpuset_cpus);
    }
    if (limits[name]) prefill(limits[name]); // instant; cur and curLoaded stay with the fresh read, so clear-to-remove cannot act on a stale map
    api("GET", "limits", null, "name=" + encodeURIComponent(name)).then(function (l) {
      if (!l) return;
      cur = l; curLoaded = true; // the fresh current limits that the clear-to-remove decision reads
      prefill(l);
    }).catch(function () {});
  }

  function collectPlan() {
    var nodes = []; Object.keys(workingPlan).forEach(function (k) { nodes.push(workingPlan[k]); });
    // A dependency may name a container that was never opened in the editor. The daemon
    // resolves those implicitly, so nothing extra is persisted here and disabling a container
    // in the plan sticks.
    return { nodes: nodes };
  }
  function savePlan(thenApply) { flash(t("saving")); api("PUT", "plan", collectPlan()).then(function () { if (thenApply) return apply(); flash(t("saved")); }).catch(function (e) { flash("Error: " + e.message, true); }); }
  // Persist this container's automation, the watchdog and schedules, together with the start
  // plan, then optionally run the plan. The config is PUT whole, so other containers' entries
  // and the notify block from the settings page are preserved. It is saved first and on its
  // own, because the automation is unrelated to the plan and a stale plan with a bad dependency
  // would otherwise take the watchdog and schedules down with it.
  function saveEditor(name, wd, scheds, nursery, thenApply) {
    flash(t("saving"));
    // Read, modify and write: re-fetch the live config, replace only this container's watchdog
    // and schedules, then write it back, so notify and the shaping interface from the settings
    // page, every container's bandwidth from its own gear and every other container's entries
    // survive even if they changed since this page loaded. A failed read aborts without a PUT.
    api("GET", "config")
      .then(function (fresh) {
        // Abort rather than fall back to an empty config: writing this container's edits onto
        // an empty base would wipe every other container and the notify block. The engine
        // always returns a config object on success, so this guards a null or garbage body,
        // not a legitimate first save.
        if (!fresh || typeof fresh !== "object") throw new Error("config unreadable");
        config = { schedules: fresh.schedules || [], watchdogs: fresh.watchdogs || [], bandwidths: fresh.bandwidths || [], idle_stops: fresh.idle_stops || [], notify: fresh.notify || { unraid: false, webhook: "" }, shape_iface: fresh.shape_iface || "", ui_settings: fresh.ui_settings || undefined };
        setWatchdog(name, wd); setSchedules(name, scheds); setIdleStop(name, nursery);
        return api("PUT", "config", config);
      })
      .then(function () { return api("PUT", "plan", collectPlan()); })
      .then(function () { closePop(); if (mode === "list") reinjectRowBadges(); else renderCurrentView(); if (thenApply) return apply(); flash(t("saved")); })
      .catch(function (e) { flash("Error: " + e.message, true); });
  }
  function apply() { flash(t("startorder") + "…"); return api("POST", "apply").then(function () { return load(); }).then(function () { flash(t("done")); }).catch(function (e) { flash("Error: " + e.message, true); }); }
  function flash(msg, bad) {
    try {
      if (menuStatusEl) { menuStatusEl.textContent = msg; menuStatusEl.className = "cc-menu-status " + (bad ? "cc-bad-text" : "cc-ok-text"); }
      if (!toastEl) { toastEl = el("div", "cc-toast"); document.body.appendChild(toastEl); }
      toastEl.textContent = msg; toastEl.className = "cc-toast cc-toast-show " + (bad ? "cc-bad-text" : "cc-ok-text");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { if (toastEl) toastEl.className = "cc-toast"; }, 2600);
    } catch (e) {}
  }

  // The names datalist behind the editor's "depends on" field.
  function ensureNames() {
    var dl = document.getElementById("cc-names"); if (!dl) { dl = el("datalist"); dl.id = "cc-names"; document.body.appendChild(dl); }
    dl.innerHTML = ""; containerNames.forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
  }

  // The observer and its timers, factored so a re-arm can restart them.
  function connectObserver() {
    try {
      // A leading-edge sweep paints the reskin in the same frame the rows appear, because a
      // MutationObserver callback runs before the browser paints. A trailing debounce put 250ms
      // between the rows and the theme after every tab switch. Bursts still coalesce: a mutation
      // that lands while a sweep's 250ms cooldown is active folds into one trailing sweep.
      function moSweep() {
        moPending = true; moTrail = false;
        try { mo.disconnect(); } catch (e) {}   // stop observing CC's own writes for this pass, the badges and the #cc-names datalist, so they cannot re-fire the observer
        try { applyEnhanceClasses(); injectAllRowBadges(); } catch (e) {}
        // The first real pass is what the tab-load spinner covers for. Every later native
        // rebuild, a container start or stop and the 3-5s poll, is fast and invisible, so this
        // fires once per page load.
        // The minimum visible time is measured from when the flag was set, not from when the
        // enhancement work finishes. With rows already in the table at boot, which is the common
        // case since Unraid server-renders it, the "paint once now" fast path below calls
        // moSweep() synchronously inside connectObserver(), itself called right after
        // cc-enh-busy is set, so the flag would live for a single JS turn and never survive one
        // tick of ccLoadState()'s 60ms poll.
        if (!ccFirstPaintDone) {
          ccFirstPaintDone = true;
          var ccEnhMinMs = 400, ccEnhElapsed = Date.now() - ccEnhBusyStart;
          if (ccEnhElapsed >= ccEnhMinMs) document.documentElement.classList.remove("cc-enh-busy");
          else setTimeout(function () { document.documentElement.classList.remove("cc-enh-busy"); }, ccEnhMinMs - ccEnhElapsed);
        }
        // A native-list rebuild usually means Unraid has just finished a container action from
        // its own buttons or menu, and the state map is stale until the next 9s poll. Pull
        // fresh state now, throttled so CC's idempotent re-injects cannot turn it into a
        // request loop.
        try { refresh(); } catch (e) {} // instant: inject with the data already in memory
        try { if (Date.now() - lastObsLoad > 2000) { lastObsLoad = Date.now(); load(); } } catch (e) {}
        // Re-arm on the current #docker_list after the synchronous writes have flushed, so they
        // do not re-fire the observer.
        try { var b2 = document.getElementById("docker_list"); if (b2) mo.observe(b2, { childList: true }); } catch (e) {}
        moTimer = setTimeout(function () {
          moTimer = null; moPending = false;
          if (moTrail && !dead && mode === "list") moSweep();   // a mutation landed mid-cooldown, so one coalesced trailing pass
        }, 250);
      }
      if (!mo) mo = new MutationObserver(function () {
        if (dead || mode !== "list") return;
        if (moPending) { moTrail = true; return; }   // a sweep is in its cooldown, fold into the trailing pass
        moSweep();                                    // otherwise paint on the leading edge
      });
      // Observe #docker_list's direct <tr> children only. Unraid replaces the tbody wholesale
      // every 3-5s and those rows need re-tagging, while subtree:false keeps CC's own deep badge
      // and datalist writes and nchan's per-second CPU/RAM text ticks from waking the observer.
      // Until the list has been rendered, retry rather than falling back to <table> or <body>
      // with subtree: that watches CC's own .cc-b-v appends and drives a rebuild loop, which is
      // the /Docker freeze after a container update.
      (function armList() {
        var body = document.getElementById("docker_list");
        if (body) {
          try { mo.observe(body, { childList: true }); } catch (e) {}
          // With rows already present, after a re-arm or a fast server render, the observer
          // will not fire without a future mutation, so paint once here rather than waiting on
          // the next tbody replace.
          try { if (!moPending && mode === "list" && body.querySelector("tr")) moSweep(); } catch (e) {}
          return;
        }
        if (dead) return;
        setTimeout(armList, 250);
      })();
    } catch (e) {}
  }
  // ShipLog integration, live only when both CC and ShipLog are installed. ShipLog's changelog
  // bubble, .sl-bubble appended to <body>, takes CC's button and severity-pill theme. Accent and
  // badge shape come from the --cc-* vars in docker.css; this adds the per-element rainbow
  // rotation CSS cannot express. ShipLog's own code stays untouched, and the selectors match
  // only once ShipLog has rendered a bubble.
  function ccRbColor(i) {
    var pal = ccPalActive(RB_PAL);
    var off = localStorage.getItem("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    return pal[(i + off) % pal.length];
  }
  function enhanceShipLogBubble(bub) {
    try {
      if (!themingOn() || localStorage.getItem("cc.rainbow") !== "1") return; // accent and shape are pure CSS, rainbow is theming
      // All three controls, the two action buttons and the close button, share one index
      // sequence, so the bubble reads as one themed set.
      // The custom properties are always stamped, but the direct colours are forced only outside
      // the reactive sub-mode. An unconditional inline paint beats every CSS rest-state rule,
      // while every other Docker-tab control rests neutral under html.cc-shares-rbneutral and
      // takes its colour on :hover, where docker.css reads --cc-rb-c.
      var neutral = document.documentElement.classList.contains("cc-shares-rbneutral");
      Array.prototype.slice.call(bub.querySelectorAll(".sl-upd:not(.sl-upd-off), .sl-gh, .sl-x")).forEach(function (bn, i) {
        var c = ccRbColor(i);
        bn.style.setProperty("--cc-rb-c", c);
        bn.style.setProperty("--cc-rb-ct", idealText(c));
        if (neutral) { bn.style.removeProperty("background"); bn.style.removeProperty("color"); bn.style.removeProperty("border-color"); return; }
        bn.style.setProperty("background", c, "important");
        bn.style.setProperty("color", idealText(c), "important");
        bn.style.setProperty("border-color", c, "important");
      });
    } catch (e) {}
  }
  var slMo = null;
  function connectShipLogObserver() {
    try {
      if (slMo) return;
      Array.prototype.slice.call(document.querySelectorAll(".sl-bubble")).forEach(enhanceShipLogBubble);
      slMo = new MutationObserver(function (muts) {
        muts.forEach(function (m2) {
          Array.prototype.slice.call(m2.addedNodes).forEach(function (n) {
            if (n.nodeType === 1 && n.classList && n.classList.contains("sl-bubble")) enhanceShipLogBubble(n);
          });
        });
      });
      slMo.observe(document.body, { childList: true });
    } catch (e) {}
  }
  // The fixed bottom action bar, div.js-actions, does not hit-test across its right region;
  // at z-index 3000 the row underneath is still topmost there. A pointer in that zone hovers
  // the row and fires the reactive colouring, which flickers as the mouse moves along the bar.
  // html.cc-actbar-hot is stamped whenever the pointer is inside the bar's Y band, where
  // docker.css suppresses the row-hover colour. The Y band rather than a hit test, so the
  // unhittable right region is covered too. Bound once on document and throttled to a frame.
  var ccBarRaf = 0, ccBarHot = false;
  function ccBarCheck(e) {
    if (ccBarRaf) return;
    ccBarRaf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () {
      ccBarRaf = 0;
      var bar = document.querySelector("div.js-actions"), hot = false;
      if (bar) { var r = bar.getBoundingClientRect(); if (r.height && e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right) hot = true; }
      if (hot !== ccBarHot) { ccBarHot = hot; document.documentElement.classList.toggle("cc-actbar-hot", hot); }
    });
  }
  function bindBarGuard() { if (ccBarBound) return; ccBarBound = true; document.addEventListener("pointermove", ccBarCheck, { passive: true }); }
  var ccBarBound = false;
  function startTimers() {
    bindBarGuard();
    lastAdv = isAdvancedView();
    // Re-inject the badges and the advanced class on an Advanced/Basic flip. Unraid's toggle
    // has no reliable event, so the effective state is polled.
    timers.push(setInterval(function () { try { if (dead || mode !== "list") return; var a = isAdvancedView(); if (a !== lastAdv) { lastAdv = a; if (themingOn()) applyEnhanceClasses(); else removeEnhanceClasses(); reinjectRowBadges(); } } catch (e) {} }, 1500));
    // An ungated liveness probe: once the proxy answers 404 or 410, the plugin is gone and the
    // UI tears down within about 4s. Unlike the 9s poll it is not held back by an open menu or
    // window, so an uninstall cleans up the open tab quickly.
    timers.push(setInterval(function () { try { if (dead) return; fetch(PROXY + "?path=" + encodeURIComponent("state"), { headers: { Accept: "application/json" } }).then(function (r) { if (r.status === 404 || r.status === 410) teardown(); }).catch(function () {}); } catch (e) {} }, 4000));
    // Folder view belongs in this gate for the same reason as in refresh(): the call is a no-op
    // at compact density and keeps the live values fresh at full density.
    timers.push(setInterval(function () { try { if (!dead && !openPop && (mode === "grid" || mode === "folder" || (mode === "list" && colOn("res")))) refreshStats(); } catch (e) {} }, 3500));
    timers.push(setInterval(function () { try { if (!dead && !openPop && !menu) load(); } catch (e) {} }, 9000));
  }

  // Self-removal and re-arm. A 404 or 410 from the state proxy means the plugin's files are
  // gone, so everything is torn down and nothing lingers in a cached tab. A slow re-probe keeps
  // checking, and when the proxy returns after a reinstall or a blip during an update, the tab
  // re-arms and rebuilds without a page reload.
  function teardown() {
    try {
      if (dead) return;
      dead = true;
      if (mo) { try { mo.disconnect(); } catch (e) {} }
      if (moTimer) { clearTimeout(moTimer); moTimer = null; } // cancel an in-flight debounced sweep
      timers.forEach(function (id) { try { clearInterval(id); } catch (e) {} }); timers = [];
      try { closePop(); } catch (e) {} try { closeMenu(); } catch (e) {}
      removeEnhanceClasses();
      clearRowBadges();
      try { var rs = document.documentElement.style; ["--cc-icon-color", "--cc-icon-strength", "--cc-accent", "--cc-density"].forEach(function (p) { rs.removeProperty(p); }); } catch (e) {}
      Array.prototype.slice.call(document.querySelectorAll(".cc-hgear, .cc-grid-holder, .cc-menu, .cc-toast, .cc-pop, #cc-names")).forEach(function (n) { n.remove(); });
      if (ccBulkBarEl) { ccBulkBarEl.remove(); ccBulkBarEl = null; } ccBulkSel = {};
      hideNative(false);
    } catch (e) {}
  }
  function rearm() { try { if (!dead) return; dead = false; connectObserver(); startTimers(); load().then(refreshLimits); } catch (e) {} }

  function load() {
    if (dead) return Promise.resolve();
    return Promise.all([api("GET", "state"), loadShiplog(), loadConfig()]).then(function (res) {
      daemonUp = true; indexState(res[0]); ensureNames(); refresh(); syncStateBadges(); updateGearHealth();
      try { localStorage.setItem("cc.stateCache", JSON.stringify(res[0])); } catch (e9) {} // seeds the instant paint on the next reload
      if (res[0] && res[0].docker_error) flash("docker: " + res[0].docker_error, true);
    }).catch(function (e) {
      // 404 and 410 mean the proxy file is gone, so self-remove and let the re-probe rebuild if
      // it returns. 502 is the engine down while still installed, 403 a transient auth or
      // session blip, and 400 a disallowed path, so none of those tears the tab down.
      if (e && (e.status === 404 || e.status === 410)) { teardown(); return; }
      daemonUp = false; updateGearHealth();
      flash("engine unreachable: " + e.message, true);
    });
  }
  // Every gear turns red while the daemon is unreachable, a standing health signal next to the
  // "engine unreachable" toast, which lasts 2.6s and is easy to miss. Blue means up.
  function updateGearHealth() {
    try { var bad = daemonUp === false; Array.prototype.slice.call(document.querySelectorAll(".cc-hgear")).forEach(function (g) { g.classList.toggle("cc-hgear-down", bad); }); } catch (e) {}
  }
  // Form mode for /Docker/AddContainer and /Docker/UpdateContainer. It is loaded by the
  // URL-gated Buttons hook CannonadeCommand.DockerForm.page, since these pages carry no Menu=;
  // that file's header has the detail. boot() takes the early branch here, gate classes and
  // select overlays only, none of the container-list machinery.
  // The native ground truth is dynamix.docker.manager/include/CreateDocker.php: #canvas >
  // form[onsubmit="return prepareConfig(this)"] rendered as markdown dl/dt/dd; single <select>s
  // (#TemplateSelect, contNetwork, netCONT, contShell, TS*), while #catSelect is [multiple] and
  // stays a CSS-only dropdownchecklist; .switch-on-off checkboxes are switchButton'd; CPU
  // pinning is label.checkbox > input#boxN + span.checkmark; config rows append to
  // #configLocation[Advanced] in makeConfig. The Add/Edit-Config popup is a jQuery-UI dialog
  // whose #dialogAddConfig content is re-set on every open, which is why the observer sits on
  // body; its selects stay native-filled, because the dialog would clip an overlay panel.
  var ctMo = null, ctPending = false, ctRz = 0;
  function ctPn() { try { return location.pathname.replace(/\/+$/, ""); } catch (e) { return ""; } }
  function onCtForm() {
    try { return /^\/(Docker|Apps)\/(AddContainer|UpdateContainer)$/.test(ctPn()) && !!document.querySelector('#canvas form[onsubmit^="return prepareConfig"]'); } catch (e) { return false; }
  }
  // cc-dsel = the shares.js ccWrapSelect mechanism under DISTINCT class/marker names, so shares.js's
  // global "#displaybox .cc-sel" teardown (that script loads on every page) can never unwrap ours.
  // The real <select> stays (display:none) as the source of truth; we write selectedIndex back and
  // dispatch change so the inline onchange chain (loadTemplate/showSubnet/showTailscale/…) fires.
  function ctWrapSelect(sel) {
    sel.setAttribute("data-cc-dsel", "1");                 // set FIRST -> observer re-fire is a no-op
    var wrap = el("span", "cc-dsel"); sel.parentNode.insertBefore(wrap, sel);
    sel.style.display = "none"; wrap.appendChild(sel);
    var trig = el("span", "cc-dsel-trigger"); wrap.appendChild(trig);
    var panel = el("div", "cc-dsel-panel"); wrap.appendChild(panel);
    var lastGroup = null;
    for (var k = 0; k < sel.options.length; k++) {
      var o = sel.options[k], gl = o.parentNode && o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : null;
      if (gl && gl !== lastGroup) { panel.appendChild(el("div", "cc-dsel-group", gl)); lastGroup = gl; }   // TemplateSelect's "[ Default templates ]" headers survive
      var chip = el("div", "cc-dsel-opt", o.text); chip.setAttribute("data-i", k);
      chip.addEventListener("click", (function (idx) {
        return function (ev) {
          ev.stopPropagation();
          if (sel.options[idx].disabled) return;
          sel.selectedIndex = idx;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          ctSyncOne(sel);
          wrap.classList.remove("cc-open");
        };
      })(k));
      panel.appendChild(chip);
    }
    trig.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (sel.disabled) return;
      ctSyncOne(sel);                                       // reflect live disabled/selected BEFORE opening
      var open = wrap.classList.toggle("cc-open");
      if (open) { var o2 = document.querySelectorAll(".cc-dsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) o2[j].classList.remove("cc-open"); ccPositionDsel(trig, panel); }
    });
    ctSyncOne(sel);
  }
  // As position:absolute the cc-dsel panel is clipped by the #canvas div.content it lives in,
  // which is overflow:auto, so a long template list ends at the content edge with no reachable
  // scrollbar. On open the panel is re-anchored as position:fixed at its trigger and capped to
  // the free viewport space, which escapes the clip and gives it its own scrollbar. It flips
  // upward when there is more room above.
  function ccPositionDsel(trig, panel) {
    try {
      var r = trig.getBoundingClientRect(), gap = 4, edge = 14;
      // position:fixed is offset by the nearest ancestor with a transform, filter or perspective,
      // its containing block, which is not always the viewport. The jQuery-UI config dialog is
      // centred with a transform, so plain viewport coordinates threw the panel far to the side
      // and the lower dropdowns opened off-screen. Find that block and subtract its origin, so
      // the panel lands under its trigger in every context.
      var ox = 0, oy = 0, cbBottom = window.innerHeight;
      for (var pe = panel.parentElement; pe && pe.nodeType === 1 && pe !== document.documentElement; pe = pe.parentElement) {
        var pcs = getComputedStyle(pe);
        if (pcs.transform !== "none" || pcs.perspective !== "none" || (pcs.filter && pcs.filter !== "none") || (pcs.willChange || "").indexOf("transform") >= 0) {
          var pr = pe.getBoundingClientRect(); ox = pr.left; oy = pr.top; cbBottom = pr.bottom; break;
        }
      }
      var below = window.innerHeight - r.bottom - edge, above = r.top - edge;
      panel.style.position = "fixed";
      panel.style.boxSizing = "border-box";   // max-height must INCLUDE the panel's own padding, else the
                                              // list spills ~16px past the viewport and its scrollbar end is cut off
      panel.style.left = Math.round(r.left - ox) + "px";
      panel.style.minWidth = Math.round(r.width) + "px";
      panel.style.maxWidth = "min(92vw, 480px)";
      if (below >= 200 || below >= above) {
        panel.style.top = Math.round(r.bottom + gap - oy) + "px"; panel.style.bottom = "auto";
        panel.style.maxHeight = Math.max(140, below - gap) + "px";
      } else {
        panel.style.bottom = Math.round(cbBottom - r.top + gap) + "px"; panel.style.top = "auto";
        panel.style.maxHeight = Math.max(140, above - gap) + "px";
      }
    } catch (e) {}
  }
  function ctSyncOne(sel) {
    var w = sel.parentNode; if (!w || !w.classList || !w.classList.contains("cc-dsel")) return;
    w.classList.toggle("cc-dsel-disabled", !!sel.disabled);
    var t2 = w.querySelector(".cc-dsel-trigger"), c = w.querySelectorAll(".cc-dsel-opt");
    var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
    if (t2 && t2.textContent !== label) t2.textContent = label;   // guarded writes: no childList churn, so the body observer cannot loop
    for (var k = 0; k < c.length; k++) {
      var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue;
      if (c[k].textContent !== o.text) c[k].textContent = o.text;
      c[k].classList.toggle("is-selected", o.selected);
      c[k].classList.toggle("is-disabled", !!o.disabled);
    }
  }
  // GlimStone Rule 21 (wheel over the CLOSED field): the shared handler is in cc-theme.js; this hands it
  // the repaint the chip-click path already uses, so a wheel step and a click leave the widget identical.
  try { if (window.CCTheme && window.CCTheme.registerSelectSync) window.CCTheme.registerSelectSync(function (sel, wrap) { if (!wrap || !wrap.classList || !wrap.classList.contains("cc-dsel")) return false; ctSyncOne(sel); return true; }); } catch (e) {}
  function ctSelectsTeardown() {
    try {
      var wraps = document.querySelectorAll(".cc-dsel");
      for (var i = 0; i < wraps.length; i++) {
        var w = wraps[i], sel = w.querySelector("select");
        if (sel) { sel.style.display = ""; sel.removeAttribute("data-cc-dsel"); w.parentNode.insertBefore(sel, w); }
        if (w.parentNode) w.parentNode.removeChild(w);
      }
    } catch (e) {}
  }
  // The page-title head badge. The form page's heading div.title is i.fa.fa-th.title plus a bare
  // text node before span.right, and both are wrapped into span.cc-b.cc-pagehead so docker.css
  // can badge them. It is idempotent, because a wrapped icon no longer matches div.title > i.
  // The wrapper carries no MARK, since it holds native nodes that a MARK sweep would destroy;
  // ctTitleUnwrap restores them explicitly, like the cc-grp wrapper.
  function ctTitleWrap() {
    try {
      var icons = document.querySelectorAll("div.title > i.fa.title, div.title > i.fa.fa-th");
      for (var i = 0; i < icons.length; i++) {
        var ic = icons[i], ti = ic.parentNode;
        if (ti.querySelector(":scope > span.cc-pagehead")) continue;
        var tx = null;
        for (var n = 0; n < ti.childNodes.length; n++) { var nd = ti.childNodes[n]; if (nd.nodeType === 3 && nd.textContent.replace(/\s+/g, "")) { tx = nd; break; } }
        if (!tx) continue;
        var w = el("span", "cc-b cc-pagehead"); ti.insertBefore(w, ic); w.appendChild(ic); w.appendChild(tx);
      }
    } catch (e) {}
  }
  function ctTitleUnwrap() {
    try {
      var ws = document.querySelectorAll("div.title > span.cc-pagehead");
      for (var i = 0; i < ws.length; i++) { var w = ws[i]; while (w.firstChild) w.parentNode.insertBefore(w.firstChild, w); w.parentNode.removeChild(w); }
    } catch (e) {}
  }
  // VARIABLE LABELS AS BADGES (user: alle Variablen wie "Max Expiry" in ein Badge, ohne den
  // Doppelpunkt). Each config row is <dl><dt><span>Label:</span></dt><dd>field</dd>. We class the
  // label span (docker.css badges it) and strip the trailing ":" from its last text node, stashing
  // the original in data-cc-lab for a clean teardown. Idempotent via the class guard.
  // strip the trailing colon on the LAST non-empty text node (keeps a leading fa icon), stashing
  // the original text in data-cc-lab so the teardown restores it verbatim.
  function ctStripColon(host) {
    for (var n = host.childNodes.length - 1; n >= 0; n--) {
      var nd = host.childNodes[n];
      if (nd.nodeType === 3 && nd.textContent.replace(/\s+/g, "")) {
        if (!host.getAttribute("data-cc-lab")) host.setAttribute("data-cc-lab", nd.textContent);
        nd.textContent = nd.textContent.replace(/\s*:\s*$/, "");
        return;
      }
    }
  }
  // A field is required when the matching <dd> carries [required], which is how Unraid marks
  // mandatory inputs. The badge takes a red dot through .cc-req::after, which reads in accent
  // and in rainbow, unlike a red fill.
  function ctMarkReq(badge, dt) {
    try {
      var dd = dt && dt.nextElementSibling;
      while (dd && dd.tagName !== "DD") dd = dd.nextElementSibling;
      // Two sources: Unraid stamps the label span class="required" from the template's Required
      // flag, which is authoritative and also covers the select fields it leaves without the
      // [required] attribute, and the field itself may carry [required]. The CC dot sits on
      // ::after with higher specificity than the native " *" from CreateDocker.css on the same
      // element, so a required field shows the dot rather than the asterisk.
      var req = (badge && badge.classList.contains("required")) || !!(dd && dd.querySelector("input[required],select[required],textarea[required]"));
      badge.classList.toggle("cc-req", req);
    } catch (e) {}
  }
  function ctVarLabels() {
    try {
      // Environment variable labels, <dt><span>Label:</span></dt>, badge the inner span.
      var sps = document.querySelectorAll("#canvas dl > dt > span, .ui-dialog dl > dt > span");
      for (var i = 0; i < sps.length; i++) {
        var sp = sps[i];
        if (!sp.classList.contains("cc-varlab")) { ctStripColon(sp); sp.classList.add("cc-varlab"); }
        ctMarkReq(sp, sp.parentNode);
        // Some dialog labels keep the colon as a text node in the <dt> after the badge span,
        // out of reach of the strip above, so it goes here and is stashed on the dt for the
        // teardown to restore.
        var pdt = sp.parentNode;
        if (pdt && pdt.tagName === "DT" && !pdt.hasAttribute("data-cc-dtcolon") && pdt.lastChild && pdt.lastChild.nodeType === 3 && /:\s*$/.test(pdt.lastChild.textContent)) {
          pdt.setAttribute("data-cc-dtcolon", pdt.lastChild.textContent);
          pdt.lastChild.textContent = pdt.lastChild.textContent.replace(/\s*:\s*$/, "");
        }
      }
      // Top-level field labels are a bare <dt>Name:</dt> with no child span, so the dt itself is
      // badged. #canvas dl is a single-column grid with dt on its own row above dd, so an
      // inline-flex badge with justify-self:start becomes a left-aligned pill and the layout
      // holds.
      var dts = document.querySelectorAll("#canvas dl > dt, .ui-dialog dl > dt");
      for (var j = 0; j < dts.length; j++) {
        var dt = dts[j];
        if (dt.querySelector(":scope > span")) continue; // a span label, handled above
        var hasText = false;
        for (var k = 0; k < dt.childNodes.length; k++) { var c = dt.childNodes[k]; if (c.nodeType === 3 && c.textContent.replace(/\s+/g, "")) { hasText = true; break; } }
        if (!hasText) continue; // an empty, layout-only dt
        if (!dt.classList.contains("cc-dtlab")) { ctStripColon(dt); dt.classList.add("cc-dtlab"); }
        ctMarkReq(dt, dt);
      }
    } catch (e) {}
  }
  function ctVarLabelsTeardown() {
    try {
      var hosts = document.querySelectorAll("#canvas dl > dt > span.cc-varlab, .ui-dialog dl > dt > span.cc-varlab, #canvas dl > dt.cc-dtlab, .ui-dialog dl > dt.cc-dtlab");
      for (var i = 0; i < hosts.length; i++) {
        var h = hosts[i], orig = h.getAttribute("data-cc-lab");
        if (orig) { for (var n = h.childNodes.length - 1; n >= 0; n--) { var nd = h.childNodes[n]; if (nd.nodeType === 3 && nd.textContent.replace(/\s+/g, "")) { nd.textContent = orig; break; } } }
        h.classList.remove("cc-varlab"); h.classList.remove("cc-dtlab"); h.classList.remove("cc-req"); h.removeAttribute("data-cc-lab");
      }
      // restore the trailing ":" text node we stripped off dialog <dt>s (data-cc-dtcolon)
      var cdts = document.querySelectorAll("#canvas dl > dt[data-cc-dtcolon], .ui-dialog dl > dt[data-cc-dtcolon]");
      for (var q = 0; q < cdts.length; q++) {
        var cdt = cdts[q];
        if (cdt.lastChild && cdt.lastChild.nodeType === 3) cdt.lastChild.textContent = cdt.getAttribute("data-cc-dtcolon");
        cdt.removeAttribute("data-cc-dtcolon");
      }
    } catch (e) {}
  }
  // COLOUR-PICKER for colour variables (user: bei Farb-Variablen ein Farbwählfeld wie in den CC
  // Einstellungen). A config row whose LABEL/description mentions a colour (colour/color/hex/farbe)
  // and holds a text input gets a swatch (a native <input type=color> styled as a CC dot) placed
  // before the field, two-way synced. Empty text keeps the swatch at a neutral default (no write).
  function ctColorFields() {
    try {
      var dls = document.querySelectorAll("#canvas dl, .ui-dialog dl");
      for (var i = 0; i < dls.length; i++) {
        var dl = dls[i], txt = (dl.textContent || "");
        if (!/colou?r|\bhex\b|farbe/i.test(txt)) continue;
        var inp = dl.querySelector('dd input[type="text"]');
        if (!inp || inp.parentNode.querySelector(":scope > .cc-colorvar")) continue;
        var sw = document.createElement("input"); sw.type = "color"; sw.className = "cc-colorvar";
        sw.setAttribute(MARK, "1");
        var hexOf = function (v) { v = String(v || "").trim(); return /^#?[0-9a-f]{6}$/i.test(v) ? (v[0] === "#" ? v : "#" + v) : ""; };
        var seed = hexOf(inp.value); if (seed) sw.value = seed;
        sw.addEventListener("input", function (e) { inp.value = e.target.value; try { inp.dispatchEvent(new Event("change", { bubbles: true })); } catch (e2) {} });
        inp.addEventListener("input", function () { var h = hexOf(inp.value); if (h) sw.value = h; });
        inp.parentNode.insertBefore(sw, inp);
      }
    } catch (e) {}
  }
  // #10: the native #dockerAllocations table ("Docker-Zuweisungen") shows "invalid IP" for a STOPPED
  // container's IP and "???" for its ports. The CC engine knows the CONFIGURED static IP (survives a
  // stop) + the published ports (HostConfig.PortBindings), so fetch the engine state once and fill
  // those cells. The AddContainer page runs only bootCtForm (no list machinery), so fetch the state
  // directly from the proxy here. norm()/MARK/PROXY are the same helpers the list enhancer uses.
  var ccAllocState = null, ccAllocPending = false;
  function ccAllocFill() {
    var tbl = document.getElementById("dockerAllocations");
    if (!tbl || !tbl.querySelector(".docker-allocation-row")) return;
    if (!ccAllocState) {
      if (ccAllocPending) return;
      ccAllocPending = true;
      fetch(PROXY + "?path=" + encodeURIComponent("state"), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (st) {
          ccAllocState = {};
          ((st && st.containers) || []).forEach(function (c) { if (c && c.name) ccAllocState[norm(c.name)] = c; });
          ccAllocPending = false; ccAllocPaint();
        }).catch(function () { ccAllocPending = false; });
      return;
    }
    ccAllocPaint();
  }
  function ccAllocPaint() {
    var tbl = document.getElementById("dockerAllocations");
    if (!tbl || !ccAllocState) return;
    var rows = tbl.querySelectorAll(".docker-allocation-row");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.getAttribute(MARK)) continue;
      var spans = row.querySelectorAll(":scope > span");
      if (spans.length < 4) continue;
      var c = ccAllocState[norm((spans[0].textContent || "").trim())];
      if (!c) continue;
      row.setAttribute(MARK, "1");
      // IP col: "invalid IP" (stopped) -> the configured static IP the engine kept
      if (/invalid ip/i.test(spans[2].textContent || "") && c.ip) { spans[2].textContent = c.ip; spans[2].classList.add("cc-alloc-filled"); }
      // Port col: "???" -> the published ports (bridge containers) from the engine's HostConfig read
      if (/\?\?\?/.test(spans[3].textContent || "") && c.ports && c.ports.length) { spans[3].textContent = c.ports.join(" "); spans[3].classList.add("cc-alloc-filled"); }
    }
    ccAllocSortUI(); ccAllocSortApply();   // #2 (user): keep the sort control + applied order after every (re)paint
  }
  // #2 (user): sort the Docker allocations by container NAME (A-Z) or by IP. The rows are native DOM
  // (.docker-allocation-row; span[0]=name, span[2]=IP), so we reorder the nodes. Idempotent (only re-appends
  // when the order actually changed) so the bootCtForm subtree observer can't ping-pong into a re-sort loop.
  function ccAllocSortMode() { try { return localStorage.getItem("cc.allocsort") || ""; } catch (e) { return ""; } }
  function ccAllocIpKey(s) { var m = String(s || "").match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/); return m ? ((+m[1]) * 16777216 + (+m[2]) * 65536 + (+m[3]) * 256 + (+m[4])) : -1; }
  function ccAllocSortUI() {
    var tbl = document.getElementById("dockerAllocations");
    if (!tbl || !tbl.querySelector(".docker-allocation-row") || tbl.querySelector(":scope > .cc-alloc-sortbar")) return;
    var bar = el("div", "cc-alloc-sortbar"); bar.setAttribute(MARK, "1");
    bar.appendChild(el("span", "cc-alloc-sortlbl", LANG === "de" ? "Sortieren:" : "Sort:"));
    [["name", "Name A-Z"], ["ip", "IP"]].forEach(function (m) {
      var b = el("button", "cc-alloc-sortbtn" + (ccAllocSortMode() === m[0] ? " cc-alloc-sorton" : ""), m[1]); b.type = "button";
      b.addEventListener("click", function () {
        var nm = ccAllocSortMode() === m[0] ? "" : m[0];   // click the active one again -> back to native order
        try { localStorage.setItem("cc.allocsort", nm); } catch (e) {}
        Array.prototype.forEach.call(bar.querySelectorAll(".cc-alloc-sortbtn"), function (x) { x.classList.remove("cc-alloc-sorton"); });
        if (nm) b.classList.add("cc-alloc-sorton");
        ccAllocSortApply();
      });
      bar.appendChild(b);
    });
    tbl.insertBefore(bar, tbl.firstChild);
  }
  function ccAllocSortApply() {
    var tbl = document.getElementById("dockerAllocations"); if (!tbl) return;
    var mode = ccAllocSortMode(); if (!mode) return;   // "" = keep native order
    // each container is a direct-child <dl> wrapping a .docker-allocation-row (span[0]=name, span[2]=IP)
    var dls = Array.prototype.slice.call(tbl.querySelectorAll(":scope > dl"));
    if (dls.length < 2) return;
    function cells(dl) { var r = dl.querySelector(".docker-allocation-row"); return r ? r.querySelectorAll(":scope > span") : []; }
    var sorted = dls.slice().sort(function (a, b) {
      var sa = cells(a), sb = cells(b);
      if (mode === "ip") return ccAllocIpKey(sa[2] && sa[2].textContent) - ccAllocIpKey(sb[2] && sb[2].textContent);
      var na = ((sa[0] && sa[0].textContent) || "").trim().toLowerCase(), nb = ((sb[0] && sb[0].textContent) || "").trim().toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
    for (var i = 0; i < dls.length; i++) { if (dls[i] !== sorted[i]) { sorted.forEach(function (d) { tbl.appendChild(d); }); return; } }   // only reorder if order actually changed (loop guard)
  }
  // #12/D2: right-align the Add/Update-Container form's Basic/Advanced view toggle (div.title >
  // span.right) to the ACTUAL value-field right edge, replacing the fragile calc(64% - 400px) that
  // only lined up at one viewport/field width. Measure the widest fixed-width field (skip hidden +
  // full-width stretch fields) and pad div.title's right by (title-right - field-right) so
  // flex/space-between lands the toggle flush with the inputs at any width. Writing a CSS var on
  // <html> mutates no childList -> the body observer cannot loop (freeze-safe).
  // #5 (user "der toggle ist immer noch in der mitte der seite"): the fragile FIELD-measurement is REMOVED.
  // docker.css now right-pads div.title by the fixed content gutter (--cc-edge-gutter) so span.right sits
  // FLUSH at the #displaybox content right edge (like the menu bar / Plugins-Update button), not the form-
  // field right edge (~page middle). Kept as a no-op that clears any stale --cc-ct-toggle-pad from an older
  // build (mutates no childList -> freeze-safe).
  function ctAlignToggle() {
    try { document.documentElement.style.removeProperty("--cc-ct-toggle-pad"); } catch (e) {}
  }
  function ctApply() {
    try {
      var root = document.documentElement;
      var on2 = localStorage.getItem("cc.enable.docker") !== "0" && themingOn();
      root.classList.toggle("cc-docker-on", on2);
      root.classList.toggle("cc-on-addct", on2 && onCtForm());   // page gate: every docker.css form rule requires BOTH classes
      if (!on2) { ctSelectsTeardown(); ctTitleUnwrap(); ctVarLabelsTeardown(); return; }
      applySettings();                                           // --cc-accent, --cc-accent-text, --cc-b-radius and the rainbow vars, the same chokepoint as list mode
      ctTitleWrap();
      ctVarLabels();                                             // every variable label -> a colon-free badge
      ctColorFields();                                           // colour variables get a picker swatch
      // The jQuery-UI config dialog appends to body, outside #canvas, so its selects need the
      // second selector or they stay native. The body-childList observer re-enters here when
      // the dialog fills, so wrapping them in the same pass is enough.
      var sels = document.querySelectorAll('#canvas select:not([multiple]):not([data-cc-dsel]), .ui-dialog select:not([multiple]):not([data-cc-dsel])');
      for (var i = 0; i < sels.length; i++) ctWrapSelect(sels[i]);
      var done = document.querySelectorAll('#canvas select[data-cc-dsel], .ui-dialog select[data-cc-dsel]');
      for (var j = 0; j < done.length; j++) ctSyncOne(done[j]);  // Unraid re-selects/re-labels at runtime (loadTemplate/showSubnet)
      // Rainbow on the form page rotates the palette over the visible chrome. Consumers read
      // var(--cc-rb-c, var(--cc-accent)), so un-stamping falls back to the accent. The neutral
      // sub-mode greys the buttons through CSS, while the heading badge and checked toggles keep
      // their stamped colour.
      var rbOn2 = localStorage.getItem("cc.rainbow") === "1";
      var pal2 = ccPalActive(RB_PAL);
      var off3 = localStorage.getItem("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
      var chrome = document.querySelectorAll('#displaybox div.title > span.left, .cc-pagehead, .switch-button-background, #canvas #readmore_toggle a, #canvas #allocations_toggle a, #canvas dl > dd > a, #canvas input[type="submit"], #canvas button:not([role="tab"]), .ui-dialog .ui-dialog-buttonpane button');
      for (var r3 = 0, ci3 = 0; r3 < chrome.length; r3++) {
        var ce = chrome[r3];
        if (!rbOn2) { ce.style.removeProperty("--cc-rb-c"); ce.style.removeProperty("--cc-rb-ct"); continue; }
        var cc0 = pal2[(ci3 + off3) % pal2.length]; ci3++;
        var n0 = parseInt(cc0.slice(1), 16), L0 = 0.299 * (n0 >> 16 & 255) + 0.587 * (n0 >> 8 & 255) + 0.114 * (n0 & 255);
        ce.style.setProperty("--cc-rb-c", cc0); ce.style.setProperty("--cc-rb-ct", L0 > 150 ? "#161616" : "#fff");
      }
      ccAllocFill();   // fill a stopped container's IP and ports in the allocations table when it is open
      ctAlignToggle();
    } catch (e) {}
  }
  function bootCtForm() {
    try {
      ctApply();
      ctMo = new MutationObserver(function () { if (ctPending) return; ctPending = true; setTimeout(function () { ctPending = false; ctApply(); }, 150); });
      ctMo.observe(document.body, { childList: true, subtree: true });   // the config rows under #configLocation[Advanced] and the re-filled jQuery-UI dialog both land under body
      window.addEventListener("resize", function () { if (ctRz) return; ctRz = requestAnimationFrame(function () { ctRz = 0; ctAlignToggle(); }); });
      document.addEventListener("click", function () { var o = document.querySelectorAll(".cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); });
      // A position:fixed panel drifts from its trigger on scroll, so an open dropdown closes
      // when the page or the content scrolls; the capture phase catches the #canvas div.content
      // scroller. The panel has its own scrollable list, whose scroll also arrives here, so
      // scrolls originating inside the open panel are ignored and the list stays scrollable.
      window.addEventListener("scroll", function (e) { var tgt = e && e.target; if (tgt && tgt.closest && tgt.closest(".cc-dsel-panel")) return; var o = document.querySelectorAll(".cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); }, true);
      window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "cc.stateCache" && /^ccd?\./.test(e.key)) ctApply(); } catch (e2) {} });
    } catch (e) {}
  }
  // The create and update output page, the result of docker run or create, shares the
  // /Docker/AddContainer and /Docker/UpdateContainer URL with the form but carries no form,
  // since the output has replaced it, so onCtForm() is false there. Detected here, it turns
  // #displaybox .content into a floating window with an accent title badge, like the
  // container-update dialog. The look lives in docker.css under html.cc-ctout-on.
  function onCtOutput() {
    try {
      if (!/^\/(Docker|Apps)\/(AddContainer|UpdateContainer)$/.test(ctPn())) return false;
      if (document.querySelector('#canvas form[onsubmit^="return prepareConfig"]')) return false; // that is the form page
      var content = document.querySelector("#displaybox .content");
      return !!content && (/docker\s+(create|run)/i.test(content.textContent || "") || !!content.querySelector("pre, h2"));
    } catch (e) { return false; }
  }
  function bootCtOutput() {
    try {
      if (!themingOn()) return;
      document.documentElement.classList.add("cc-docker-on", "cc-ctout-on");
      applySettings();   // stamp --cc-hdr-accent etc. so the badge/buttons follow the theme
      var box = document.getElementById("displaybox");
      var content = box && box.querySelector(".content");
      if (!content) return;
      if (!document.getElementById("cc-ctout-bd")) { var bd = el("div"); bd.id = "cc-ctout-bd"; document.body.appendChild(bd); }
      // The accent title badge takes the page heading and stands in for the native grey one.
      if (!document.getElementById("cc-ctout-title")) {
        var t = box.querySelector(".title");
        var tb = el("div"); tb.id = "cc-ctout-title";
        tb.textContent = ((t ? t.textContent : "") || "Container").replace(/\s+/g, " ").trim().toUpperCase();
        content.insertBefore(tb, content.firstChild);
      }
      // Hide the native grey headings the badge stands in for, never CC's own badge.
      var heads = box.querySelectorAll(".title, span.left");
      for (var i = 0; i < heads.length; i++) { if (heads[i].id !== "cc-ctout-title" && /container/i.test(heads[i].textContent || "")) heads[i].style.display = "none"; }
      // The status indicator sits in the button row, mirroring the real .sweet-alert update
      // window in header.js: its loader lives inside that row and is re-homed there the moment
      // the row exists, falling back to a direct child of the dialog, pinned bottom left by CSS,
      // until then. A spinning ring while the create streams, a green check once it reports
      // done, with the completion phrase from Helpers.php driving the flip. A MutationObserver
      // on the streaming .content re-checks and re-homes on every appended log line and on the
      // button row once it renders.
      var ctOutStatus = function () {
        try {
          // Unraid streams a <style> block that can arrive as plain text and then renders as raw
          // CSS under the title. A real <style> is hidden by CSS; the text-node variant is
          // blanked here.
          try {
            // In the live DOM the CSS lands in a bare <p> that starts with a comment, so an
            // anchored .logLine{ regex misses it. Match any leaf element or text node whose text
            // carries a CSS signature and a rule brace, and leave CC's own #cc-ctout-* nodes
            // alone.
            var CSS_SIG = /font-family\s*:|@font-face|\.logLine\s*\{/i;
            var st = content.querySelectorAll("style"); for (var si = 0; si < st.length; si++) st[si].style.display = "none";
            var leafs = content.querySelectorAll("p, div, font, pre, span");
            for (var li = 0; li < leafs.length; li++) {
              var le = leafs[li];
              if (!le.children.length && !(le.id && le.id.indexOf("cc-ctout") === 0) && CSS_SIG.test(le.textContent || "") && (le.textContent || "").indexOf("{") !== -1) le.style.display = "none";
            }
            var kids = content.childNodes;
            for (var ki = 0; ki < kids.length; ki++) { var kn = kids[ki]; if (kn.nodeType === 3 && CSS_SIG.test(kn.nodeValue || "") && (kn.nodeValue || "").indexOf("{") !== -1) kn.nodeValue = ""; }
          } catch (e15) {}
          var log = content.textContent || "";
          var done = /(erfolgreich\s+(ausgeführt|beendet)|finished successfully|command (finished|completed|executed)|befehl.*fehlgeschlagen|the command failed)/i.test(log)
                     || (/docker\s+(create|run)/i.test(log) && !content.querySelector(".fa-spin, .spinner"));   /* a vanished spinner without the phrase counts as done too */
          var sb = document.getElementById("cc-ctout-status");
          if (!sb) { sb = el("div"); sb.id = "cc-ctout-status"; sb.setAttribute("role", "status"); }
          // The same re-home logic as header.js's own window loader: the last button's parent is
          // the button row. While the output still streams and no row has rendered, it stays a
          // direct child of .content, where CSS pins it bottom left until the row appears.
          var btns = content.querySelectorAll("button, input[type=button], input[type=submit]");
          var row = btns.length ? btns[btns.length - 1].parentElement : content;
          if (sb.parentElement !== row) row.appendChild(sb);
          if (done) { sb.classList.add("cc-ctout-done"); if (sb.getAttribute("data-m") !== "done") { sb.setAttribute("data-m", "done"); sb.setAttribute("aria-label", "Fertig"); sb.innerHTML = "<i class='fa fa-check cc-ctout-fa' aria-hidden='true'></i>"; } }
          else { sb.classList.remove("cc-ctout-done"); if (sb.getAttribute("data-m") !== "run") { sb.setAttribute("data-m", "run"); sb.setAttribute("aria-label", "Läuft"); sb.innerHTML = "<span class='cc-loader cc-load-sm'><span class='o'><i></i></span><span class='in'><i></i></span></span>"; } }   // the sm tier, one size source with the loader engine in header.js
          // paintPopups() in header.js covers #cc-ctout-title, but nothing on this page calls
          // it, because the window is a plain navigation rather than a .sweet-alert that
          // header.js watches. Calling it here paints the title the moment it exists and again
          // on every streamed line, so it takes its own rainbow colour instead of the flat
          // var(--cc-rbaccent) fallback that matched the legend badges below it.
          try { if (window.paintPopups) window.paintPopups(); } catch (ePP) {}
        } catch (e) {}
      };
      ctOutStatus();
      if (!content.__ccStatusObs) { content.__ccStatusObs = new MutationObserver(ctOutStatus); try { content.__ccStatusObs.observe(content, { childList: true, subtree: true, characterData: true }); } catch (e) {} }
    } catch (e) {}
  }
  function boot() {
    if (localStorage.getItem("cc.enable.docker") === "0") return; // area disabled in CC settings
    if (onCtForm()) { bootCtForm(); return; } // form styling only, none of the list machinery, API polling or timers below
    if (onCtOutput()) { bootCtOutput(); return; } // the create and update output page becomes a floating window
    // On the AddContainer and UpdateContainer URL the form, or the run output, can be injected
    // into #canvas a beat after boot() has run its one-shot check above, leaving the page native
    // with no re-detection. Watch briefly for either to appear and dispatch then, scoped to that
    // URL so the container list page pays nothing.
    if (/^\/(Docker|Apps)\/(AddContainer|UpdateContainer)$/.test(ctPn())) {
      var ctWatch = new MutationObserver(function () {
        if (onCtForm()) { try { ctWatch.disconnect(); } catch (e) {} bootCtForm(); }
        else if (onCtOutput()) { try { ctWatch.disconnect(); } catch (e) {} bootCtOutput(); }
      });
      try { ctWatch.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (e) {}
      setTimeout(function () { try { ctWatch.disconnect(); } catch (e) {} }, 15000); // never linger
      return; // never start the container-LIST machinery on a form/output URL
    }
    try {
      applySettings();
      // Icon pipeline: repaint when an engine lookup or a complexity measurement lands. The
      // callback fires only on an actual change, see icoNotify in cc-theme.js, so this settles
      // after a handful of passes and cannot become a repaint loop.
      try { if (window.CCTheme && window.CCTheme.icons) window.CCTheme.icons.onResolved(function () { if (!dead) applyIconTint(); }); } catch (e8) {}
      // The organizer probe runs in parallel with everything below and never blocks first paint.
      // Once it resolves, the view mode is reconciled against the server's saved choice, which
      // is the restore path: the synchronous initial mode reads localStorage, which is
      // per-browser and cannot know the server-persisted choice on a fresh device. The server
      // wins where it differs, and setMode() re-applies every normal guard, theming off and no
      // folders yet, so this cannot land in a broken state.
      ccOrgInit().then(function () {
        if (dead) return;
        var serverMode = ccOrgView && ccOrgView.prefs && ccOrgView.prefs.ccViewMode;
        if (ccOrgAvailable && serverMode && serverMode !== mode) { setMode(serverMode); return; }
        // With no server prefs saved yet, fall back to the local-only signal, so a "folder"
        // choice made in this browser still restores.
        if (ccOrgAvailable && mode !== "folder" && localStorage.getItem(VIEW_KEY) === "folder" && ccOrgHasFolders()) setMode("folder");
      });
      // The last known engine state seeds the badges for an instant first paint; the live fetch
      // corrects them moments later.
      try { var cs9 = JSON.parse(localStorage.getItem("cc.stateCache") || "null"); if (cs9) { indexState(cs9); ensureNames(); refresh(); } } catch (e9) {}
      // Fill the "limit set" dots after the first paint, once the containers are indexed, and
      // off the 9s render path: a bulk inspect must not gate or race the paint.
      load().then(refreshLimits);
      // The native tab-load spinner vanishes the moment Unraid's own AJAX populates the table,
      // well before CC's badges, actions and gauges paint over it, which shows about a second of
      // unstyled native rows. ccLoadState() in header.js polls every 60ms and holds the
      // fullscreen overlay open while this flag is set; moSweep() clears it once the first real
      // enhancement pass has painted, not on every later native rebuild.
      document.documentElement.classList.add("cc-enh-busy");
      ccEnhBusyStart = Date.now();
      // moSweep() only fires from list mode's MutationObserver, so a grid-mode boot, or any path
      // that never reaches it, would hold the overlay open indefinitely. An unbounded busy flag
      // is worse than the flash it covers, so it is bounded here like ccInjectSpinner's own
      // window.
      setTimeout(function () { document.documentElement.classList.remove("cc-enh-busy"); }, 5000);
      connectObserver();
      connectShipLogObserver(); // re-skin ShipLog's bubble when it is installed too
      startTimers();
      // The settings page writes cc.* keys from its own tab, so they are re-applied live here.
      window.addEventListener("storage", function (e) {
        try {
          if (dead || !e.key || !/^ccd?\./.test(e.key)) return; // global cc.* keys and the Docker-own ccd.* keys
          if (e.key === "cc.view") { setMode(localStorage.getItem("cc.view") === "grid" ? "grid" : "list"); return; }
          // The master theming toggle flipped live: coerce grid to list when it is now off,
          // reset the old visual state, then let applyMode() re-render for the new state.
          if (e.key === "cc.theming") {
            if (!themingOn() && mode === "grid") { mode = "list"; localStorage.setItem(VIEW_KEY, "list"); }
            applySettings(); clearRowBadges(); removeEnhanceClasses(); applyMode();
            // applyMode's off branch re-injects orchestration but leaves the icon tint and the
            // per-row cosmetic inline styles from the previous theming-on state, so they are
            // reverted here and switching theming off takes effect without a reload.
            if (!themingOn()) { applyIconTint(); stripRowCosmetic(); }
            return;
          }
          applySettings();
          if (mode === "list") { if (themingOn()) applyEnhanceClasses(); else removeEnhanceClasses(); reinjectRowBadges(); }
          else if (mode === "grid" || mode === "folder") renderCurrentView();
        } catch (e2) {}
      });
      // The persistent re-probe, which teardown leaves running, rebuilds when the proxy returns.
      setInterval(function () { try { if (!dead) return; fetch(PROXY + "?path=" + encodeURIComponent("state"), { headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) rearm(); }).catch(function () {}); } catch (e) {} }, 8000);
      // Clicking a container's icon or name does not open the native edit page. The action
      // icons flash instead, which points at the actions column, and a click on the status dot
      // row flashes them the same way.
      document.addEventListener("click", function (e) {
        try {
          if (dead || mode !== "list") return;
          var hand = e.target && e.target.closest ? e.target.closest("td.ct-name span.hand, td.ct-name span.appname, td.ct-name .cc-ct-dotrow") : null;
          if (!hand) return;
          var row2 = hand.closest("tr"); var bar2 = row2 && row2.querySelector(".cc-actbar");
          if (!bar2) return;
          e.preventDefault(); e.stopPropagation();
          bar2.classList.add("cc-act-flash");
          setTimeout(function () { bar2.classList.remove("cc-act-flash"); }, 1600);
        } catch (e2) {}
      }, true);
      window.addEventListener("scroll", function () { try { if (menu) positionMenu(); } catch (e) {} }, true);
      // A click outside closes the window, but a panel that belongs to the window is not
      // outside it. .cc-drop has to render as a direct body child, because any overflow ancestor
      // would clip it, so openPop.contains() is false for it and picking an entry reads as a
      // click outside, tearing down the editor along with every unsaved edit in it. The time
      // picker rides the same class, so naming the panel here covers both widgets.
      document.addEventListener("click", function (e) { try { if (openPop && !openPop.contains(e.target) && !e.target.closest(".cc-plan, .cc-drop")) closePop(); if (menu && !menu.contains(e.target) && !e.target.closest(".cc-hgear")) closeMenu(); } catch (e2) {} });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") { try { closePop(); closeMenu(); } catch (e2) {} } });
    } catch (e) { /* a failure here must never break Unraid's page */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
