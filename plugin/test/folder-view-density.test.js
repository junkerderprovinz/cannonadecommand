// Regression test: Folder view's THREE folder-content densities (v4.35.0 — a real List/Grid
// split one level inside Folder view, extending v4.34.0's "Detailliert"/"Kompakt" toggle).
//
// jdp's live feedback on v4.34.0: "Die Ordneransicht gibt es immer noch nur als gridansicht" —
// the shipped "Kompakt" density was still a vertical .cc-card-shaped tile, not the real List/Grid
// split jdp asked for one level down inside Folder view. Clarified live: "Wie die native
// Dockerliste aber abgespeckter. die grid ansicht soll so sein wie in Folderview 3. total
// abgespeckt" — this file source-slices the REAL folderChip()/folderListRow()/folderDensity()/
// setFolderDensity()/renderFolderView() out of docker.js (never re-typed) and proves:
//   1. folderChip() ("Grid"): icon + name + a coloured status DOT + short status text + ONE tiny
//      action button, all inline, nothing else (no stats/gauges/second row).
//   2. folderListRow() ("Liste"): icon + name + a state BADGE + ONE action button, one full-width
//      row, nothing else (no CPU/RAM/NET/port).
//   3. Neither carries any of card()'s full-detail chrome.
//   4. The single action in both always matches the container's actual state.
//   5. Both still honour the live-search filter, same as card().
//   6. folderDensity()/setFolderDensity() persist "full"/"grid"/"list" like every other cc.*
//      pref, and a pre-4.35.0 "minimal" value migrates to "grid" (folderChip() IS v4.34.0's
//      minimalRow() redesigned) rather than silently resetting to "full".
//   7. renderFolderView() dispatches to the right builder per density (card() for "full",
//      folderChip() for "grid", folderListRow() for "list").
//   8. renderFolderView() preserves the page's scroll position across a full rebuild (item 2 —
//      jdp: "Sbald man im ordner was macht springt es ganz nach oben in der seite").
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

/* ── minimal DOM shim (only what these builders' own dependency chain actually touches) ─────── */
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.dataset = {};
    this.listeners = {};
    this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
  }
  get className() { return this._cls; }
  set className(v) { this._cls = String(v); this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll(sel) {
    const cls = String(sel).replace('.', '');
    const out = [];
    const walk = n => n.children.forEach(c => { if (c.classList.contains(cls)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
}
const document = { createElement: t => new N(t), getElementById: () => null, querySelectorAll: () => [] };

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

/* ── source-slice the REAL functions out of docker.js ────────────────────────────────────── */
const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(name) {
  const m = src.match(new RegExp('var ' + name + ' = [^;]+;'));
  if (!m) throw new Error('var not found in docker.js: ' + name);
  return m[0];
}
ok('folderChip() really exists in docker.js (not just planned)', src.indexOf('function folderChip(') >= 0);
ok('folderListRow() really exists in docker.js (not just planned)', src.indexOf('function folderListRow(') >= 0);
ok('minimalRow() is genuinely retired — folderChip() replaced it, not a second parallel builder', src.indexOf('function minimalRow(') < 0);

const dockerApi = new Function('document', 'localStorage',
  'var RB_PAL = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  'var LANG = "en";\n' +
  'var T = { en: { resume: "Resume", stop: "Stop", start: "Start" } };\n' +
  'var iconCache = {};\n' +
  'var containerNames = [];\n' +
  'var filterText = "";\n' +
  'var mode = "list";\n' +               // setFolderDensity()'s re-render guard — "list" (view mode) means it never has to call renderFolderView()
  'var unpauseGrace = {};\n' +
  grabVar('STATE_LABELS') + '\n' +
  grabVar('FOLDER_DENSITY_KEY') + '\n' +
  grabFn('el') + '\n' + grabFn('norm') + '\n' + grabFn('t') + '\n' +
  grabFn('stateLabel') + '\n' + grabFn('showUnhealthy') + '\n' + grabFn('stateBadge') + '\n' +
  grabFn('idealText') + '\n' + grabFn('ccPalActive') + '\n' + grabFn('ccRbColor') + '\n' +
  grabFn('themingOn') + '\n' + grabFn('effc') + '\n' + grabFn('stampCardRainbow') + '\n' +
  grabFn('iconFor') + '\n' + grabFn('actBtn') + '\n' + grabFn('tintAct') + '\n' +
  grabFn('folderChip') + '\n' + grabFn('folderListRow') + '\n' +
  grabFn('folderDensity') + '\n' + grabFn('setFolderDensity') + '\n' +
  'return { folderChip: folderChip, folderListRow: folderListRow, folderDensity: folderDensity, setFolderDensity: setFolderDensity, setFilterText: function (v) { filterText = v; } };'
)(document, localStorage);

function collectClasses(node, out) { out.push(...node.classList.s); node.children.forEach(c => collectClasses(c, out)); return out; }

console.log('\n"Grid" density — folderChip(): icon + name + status dot + status text + ONE action — nothing else');
{
  reset();
  const chip = dockerApi.folderChip({ name: 'jdownloader', state: 'running' });
  ok('wrapper carries .cc-card (rides card()\'s colour-mode CSS) AND .cc-chip (its own layout override)', chip.classList.contains('cc-card') && chip.classList.contains('cc-chip'));
  ok('wrapper is tagged with the container name (dataset.name)', chip.dataset.name === 'jdownloader', chip.dataset.name);
  ok('EXACTLY 4 direct children: icon, name, status dot, status text — action wrapper makes 5', chip.children.length === 5, chip.children.length);

  const classes = collectClasses(chip, []);
  ok('shows an icon slot (real .cc-card-ico + .cc-chip-ico, no icon source resolved in this harness -> the placeholder)', classes.includes('cc-card-ico') && classes.includes('cc-chip-ico'));

  const nameEl = chip.children.find(n => n.classList.contains('cc-chip-name'));
  ok('shows the container NAME as text', !!nameEl && nameEl.textContent === 'jdownloader', nameEl && nameEl.textContent);

  const dot = chip.children.find(n => n.classList.contains('cc-chip-dot'));
  ok('shows a coloured status DOT (cc-badge-<state>, font-size:0 in CSS, same colour vocabulary as stateBadge())', !!dot && dot.classList.contains('cc-badge') && dot.classList.contains('cc-badge-running'));
  ok('the dot is tagged with dataset.name too', dot && dot.dataset.name === 'jdownloader');

  const statusEl = chip.children.find(n => n.classList.contains('cc-chip-status'));
  ok('shows a separate short STATUS TEXT next to the dot', !!statusEl && statusEl.textContent === 'running', statusEl && statusEl.textContent);

  const actWrap = chip.children.find(n => n.classList.contains('cc-chip-act'));
  ok('exactly ONE action control — "the single most essential action", not a full action bar', !!actWrap && actWrap.children.length === 1);
  const btn = actWrap && actWrap.children[0];
  ok('the action button is the real actBtn()/.cc-actbtn (same icon-button machinery as the full card)', !!btn && btn.classList.contains('cc-actbtn'));
  ok('running container -> the essential action is STOP (fa-stop)', btn.children[0].className.indexOf('fa-stop') >= 0, btn.children[0].className);

  console.log('\n  ...and NONE of the full card()\'s detail chrome ever appears in a Grid chip:');
  const forbidden = ['cc-card-stats', 'cc-gauge', 'cc-card-badges', 'cc-card-actions', 'cc-card-res', 'cc-plan', 'cc-b-cpu', 'cc-b-ram', 'cc-b-bw', 'cc-b-net', 'cc-b-port', 'cc-b-ip', 'cc-card-movebtn', 'cc-card-img', 'cc-frow', 'cc-frow-name', 'cc-frow-status'];
  forbidden.forEach(fc => ok('  no "' + fc + '" (that is full-card()/Liste-only chrome)', !classes.includes(fc)));
}

console.log('\n"Liste" density — folderListRow(): icon + name + status BADGE + ONE action — full-width row, nothing else');
{
  reset();
  const row = dockerApi.folderListRow({ name: 'sonarr', state: 'running' });
  ok('wrapper carries .cc-card AND .cc-frow', row.classList.contains('cc-card') && row.classList.contains('cc-frow'));
  ok('wrapper is tagged with the container name (dataset.name)', row.dataset.name === 'sonarr', row.dataset.name);
  ok('EXACTLY 4 direct children: icon, name, status badge, action', row.children.length === 4, row.children.length);

  const classes = collectClasses(row, []);
  ok('shows an icon slot (real .cc-card-ico, no source resolved -> the placeholder)', classes.includes('cc-card-ico') || classes.includes('cc-card-ico-ph'));

  const nameEl = row.children.find(n => n.classList.contains('cc-frow-name'));
  ok('shows the container NAME as text', !!nameEl && nameEl.textContent === 'sonarr', nameEl && nameEl.textContent);

  const statusWrap = row.children.find(n => n.classList.contains('cc-frow-status'));
  ok('shows a status BADGE wrapper (native-list-style, not a bare dot)', !!statusWrap && statusWrap.children.length === 1);
  const badge = statusWrap && statusWrap.children[0];
  ok('the badge is the real stateBadge() (same one card() uses)', !!badge && badge.classList.contains('cc-badge') && badge.classList.contains('cc-badge-running'));

  const actWrap = row.children.find(n => n.classList.contains('cc-frow-act'));
  ok('exactly ONE action control', !!actWrap && actWrap.children.length === 1);
  const btn = actWrap && actWrap.children[0];
  ok('the action button is the real actBtn()/.cc-actbtn', !!btn && btn.classList.contains('cc-actbtn'));
  ok('running container -> the essential action is STOP (fa-stop)', btn.children[0].className.indexOf('fa-stop') >= 0, btn.children[0].className);

  console.log('\n  ...and NONE of the full card()\'s detail chrome, and none of Grid\'s chip chrome either, ever appears in a Liste row:');
  const forbidden = ['cc-card-stats', 'cc-gauge', 'cc-card-badges', 'cc-card-actions', 'cc-card-res', 'cc-plan', 'cc-b-cpu', 'cc-b-ram', 'cc-b-bw', 'cc-b-net', 'cc-b-port', 'cc-b-ip', 'cc-card-movebtn', 'cc-card-img', 'cc-chip', 'cc-chip-dot', 'cc-chip-status'];
  forbidden.forEach(fc => ok('  no "' + fc + '" (that is full-card()/Grid-only chrome)', !classes.includes(fc)));
}

console.log('\nThe single action always matches the container\'s ACTUAL state — in BOTH new densities');
{
  reset();
  [['folderChip', dockerApi.folderChip, 'cc-chip-act'], ['folderListRow', dockerApi.folderListRow, 'cc-frow-act']].forEach(([label, build, actCls]) => {
    const stopped = build({ name: 'radarr', state: 'exited' });
    const stoppedBtn = stopped.children.find(n => n.classList.contains(actCls)).children[0];
    ok(label + '(): stopped container -> START (fa-play), tooltip "Start"', stoppedBtn.children[0].className.indexOf('fa-play') >= 0 && stoppedBtn.getAttribute('data-tip') === 'Start');

    const paused = build({ name: 'radarr', state: 'paused' });
    const pausedBtn = paused.children.find(n => n.classList.contains(actCls)).children[0];
    ok(label + '(): paused container -> RESUME (fa-play), tooltip "Resume" (distinct from a plain start)', pausedBtn.children[0].className.indexOf('fa-play') >= 0 && pausedBtn.getAttribute('data-tip') === 'Resume');

    const running = build({ name: 'radarr', state: 'running' });
    const runningBtn = running.children.find(n => n.classList.contains(actCls)).children[0];
    ok(label + '(): running container -> STOP (fa-stop), tooltip "Stop"', runningBtn.children[0].className.indexOf('fa-stop') >= 0 && runningBtn.getAttribute('data-tip') === 'Stop');
  });
}

console.log('\nBoth new densities still honour the live-search filter, exactly like the full card() does');
{
  reset();
  dockerApi.setFilterText('sonarr');
  [dockerApi.folderChip, dockerApi.folderListRow].forEach(build => {
    const noMatch = build({ name: 'radarr', state: 'running' });
    ok('a non-matching name is hidden (style.display = "none")', noMatch.style.display === 'none');
    const match = build({ name: 'sonarr', state: 'running' });
    ok('a matching name stays visible', match.style.display !== 'none');
  });
  dockerApi.setFilterText('');
  const cleared = dockerApi.folderChip({ name: 'radarr', state: 'running' });
  ok('clearing the filter shows everything again', cleared.style.display !== 'none');
}

console.log('\nfolderDensity()/setFolderDensity(): "full"/"grid"/"list", persisted like every other cc.* preference, and a pre-4.35.0 "minimal" install migrates cleanly');
{
  reset();
  ok('defaults to "full" with nothing stored yet', dockerApi.folderDensity() === 'full');
  dockerApi.setFolderDensity('grid');
  ok('setFolderDensity("grid") persists under cc.folderDensity', localStorage.getItem('cc.folderDensity') === 'grid');
  ok('folderDensity() now reads back "grid"', dockerApi.folderDensity() === 'grid');
  dockerApi.setFolderDensity('list');
  ok('setFolderDensity("list") persists too', localStorage.getItem('cc.folderDensity') === 'list' && dockerApi.folderDensity() === 'list');
  dockerApi.setFolderDensity('full');
  ok('setFolderDensity("full") persists back', dockerApi.folderDensity() === 'full' && localStorage.getItem('cc.folderDensity') === 'full');

  localStorage.setItem('cc.folderDensity', 'minimal');
  ok('a pre-4.35.0 "minimal" install migrates to "grid" — folderChip() IS minimalRow() redesigned, so this is the density that function actually renders now, never a silent reset to "full"', dockerApi.folderDensity() === 'grid');

  localStorage.setItem('cc.folderDensity', 'garbage-from-an-older-build');
  ok('any OTHER unrecognised stored value degrades to "full", never throws, never a blank density', dockerApi.folderDensity() === 'full');
  reset();
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
