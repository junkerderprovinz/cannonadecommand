// Folder view holds three densities of its own, a List and a Grid one level below
// the tab's. folderChip(), folderListRow(), folderDensity() and setFolderDensity()
// are sliced out of docker.js, and this pins:
//   1. folderChip(), the "Grid" density: icon, name, a coloured status dot, short
//      status text and one small action button, all inline and nothing else.
//   2. folderListRow(), the "Liste" density: icon, name, a state badge and one
//      action button in a full-width row, with no CPU, RAM, NET or port.
//   3. Neither carries any of card()'s detail chrome.
//   4. The single action in both matches the container's state.
//   5. Both honour the live-search filter, as card() does.
//   6. The density persists as "full", "grid" or "list" like the other cc.*
//      preferences, and a stored "minimal" from an older build reads as "grid",
//      folderChip() being what that density renders now.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// A DOM shim covering what these builders and their dependencies touch.
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

// Slice the functions under test out of docker.js.
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
ok('folderChip() exists in docker.js', src.indexOf('function folderChip(') >= 0);
ok('folderListRow() exists in docker.js', src.indexOf('function folderListRow(') >= 0);
ok('minimalRow() is gone, folderChip() having replaced it rather than joined it', src.indexOf('function minimalRow(') < 0);

const dockerApi = new Function('document', 'localStorage',
  'var RB_PAL = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  'var LANG = "en";\n' +
  'var T = { en: { resume: "Resume", stop: "Stop", start: "Start" } };\n' +
  'var iconCache = {};\n' +
  'var containerNames = [];\n' +
  'var filterText = "";\n' +
  'var mode = "list";\n' +               // the view mode, so setFolderDensity() never calls renderFolderView()
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

console.log('\nThe "Grid" density: folderChip() builds an icon, a name, a dot, a status and one action');
{
  reset();
  const chip = dockerApi.folderChip({ name: 'jdownloader', state: 'running' });
  ok('the wrapper carries .cc-card for card()\'s colour CSS and .cc-chip for its layout', chip.classList.contains('cc-card') && chip.classList.contains('cc-chip'));
  ok('the wrapper is tagged with the container name', chip.dataset.name === 'jdownloader', chip.dataset.name);
  ok('five direct children: icon, name, dot, status, action wrapper', chip.children.length === 5, chip.children.length);

  const classes = collectClasses(chip, []);
  ok('an icon slot is there, the placeholder for want of a resolved source', classes.includes('cc-card-ico') && classes.includes('cc-chip-ico'));

  const nameEl = chip.children.find(n => n.classList.contains('cc-chip-name'));
  ok('the container name is shown as text', !!nameEl && nameEl.textContent === 'jdownloader', nameEl && nameEl.textContent);

  const dot = chip.children.find(n => n.classList.contains('cc-chip-dot'));
  ok('the status dot uses stateBadge()\'s colour vocabulary', !!dot && dot.classList.contains('cc-badge') && dot.classList.contains('cc-badge-running'));
  ok('the dot is tagged with the container name too', dot && dot.dataset.name === 'jdownloader');

  const statusEl = chip.children.find(n => n.classList.contains('cc-chip-status'));
  ok('a short status text sits beside the dot', !!statusEl && statusEl.textContent === 'running', statusEl && statusEl.textContent);

  const actWrap = chip.children.find(n => n.classList.contains('cc-chip-act'));
  ok('one action control, not an action bar', !!actWrap && actWrap.children.length === 1);
  const btn = actWrap && actWrap.children[0];
  ok('the button is actBtn(), the same machinery the full card uses', !!btn && btn.classList.contains('cc-actbtn'));
  ok('for a running container the action is stop', btn.children[0].className.indexOf('fa-stop') >= 0, btn.children[0].className);

  console.log('\n  ...and none of the full card\'s detail chrome turns up in a Grid chip:');
  const forbidden = ['cc-card-stats', 'cc-gauge', 'cc-card-badges', 'cc-card-actions', 'cc-card-res', 'cc-plan', 'cc-b-cpu', 'cc-b-ram', 'cc-b-bw', 'cc-b-net', 'cc-b-port', 'cc-b-ip', 'cc-card-movebtn', 'cc-card-img', 'cc-frow', 'cc-frow-name', 'cc-frow-status'];
  forbidden.forEach(fc => ok('  no "' + fc + '"', !classes.includes(fc)));
}

console.log('\nThe "Liste" density: folderListRow() builds a full-width row with a status badge');
{
  reset();
  const row = dockerApi.folderListRow({ name: 'sonarr', state: 'running' });
  ok('the wrapper carries .cc-card and .cc-frow', row.classList.contains('cc-card') && row.classList.contains('cc-frow'));
  ok('the wrapper is tagged with the container name', row.dataset.name === 'sonarr', row.dataset.name);
  ok('four direct children: icon, name, status badge, action', row.children.length === 4, row.children.length);

  const classes = collectClasses(row, []);
  ok('an icon slot is there, the placeholder for want of a resolved source', classes.includes('cc-card-ico') || classes.includes('cc-card-ico-ph'));

  const nameEl = row.children.find(n => n.classList.contains('cc-frow-name'));
  ok('the container name is shown as text', !!nameEl && nameEl.textContent === 'sonarr', nameEl && nameEl.textContent);

  const statusWrap = row.children.find(n => n.classList.contains('cc-frow-status'));
  ok('the status is a badge wrapper, as in the native list, not a bare dot', !!statusWrap && statusWrap.children.length === 1);
  const badge = statusWrap && statusWrap.children[0];
  ok('the badge is stateBadge(), the one card() uses', !!badge && badge.classList.contains('cc-badge') && badge.classList.contains('cc-badge-running'));

  const actWrap = row.children.find(n => n.classList.contains('cc-frow-act'));
  ok('one action control', !!actWrap && actWrap.children.length === 1);
  const btn = actWrap && actWrap.children[0];
  ok('the button is actBtn()', !!btn && btn.classList.contains('cc-actbtn'));
  ok('for a running container the action is stop', btn.children[0].className.indexOf('fa-stop') >= 0, btn.children[0].className);

  console.log('\n  ...and neither the full card\'s chrome nor the Grid chip\'s turns up in a Liste row:');
  const forbidden = ['cc-card-stats', 'cc-gauge', 'cc-card-badges', 'cc-card-actions', 'cc-card-res', 'cc-plan', 'cc-b-cpu', 'cc-b-ram', 'cc-b-bw', 'cc-b-net', 'cc-b-port', 'cc-b-ip', 'cc-card-movebtn', 'cc-card-img', 'cc-chip', 'cc-chip-dot', 'cc-chip-status'];
  forbidden.forEach(fc => ok('  no "' + fc + '"', !classes.includes(fc)));
}

console.log('\nThe single action follows the container\'s state in both densities');
{
  reset();
  [['folderChip', dockerApi.folderChip, 'cc-chip-act'], ['folderListRow', dockerApi.folderListRow, 'cc-frow-act']].forEach(([label, build, actCls]) => {
    const stopped = build({ name: 'radarr', state: 'exited' });
    const stoppedBtn = stopped.children.find(n => n.classList.contains(actCls)).children[0];
    ok(label + '(): a stopped container gets fa-play, tipped "Start"', stoppedBtn.children[0].className.indexOf('fa-play') >= 0 && stoppedBtn.getAttribute('data-tip') === 'Start');

    const paused = build({ name: 'radarr', state: 'paused' });
    const pausedBtn = paused.children.find(n => n.classList.contains(actCls)).children[0];
    ok(label + '(): a paused container gets fa-play, tipped "Resume"', pausedBtn.children[0].className.indexOf('fa-play') >= 0 && pausedBtn.getAttribute('data-tip') === 'Resume');

    const running = build({ name: 'radarr', state: 'running' });
    const runningBtn = running.children.find(n => n.classList.contains(actCls)).children[0];
    ok(label + '(): a running container gets fa-stop, tipped "Stop"', runningBtn.children[0].className.indexOf('fa-stop') >= 0 && runningBtn.getAttribute('data-tip') === 'Stop');
  });
}

console.log('\nBoth densities honour the live-search filter, as the full card does');
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

console.log('\nfolderDensity() and setFolderDensity() persist "full", "grid" or "list"');
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
  ok('a stored "minimal" reads as "grid", which is what that builder renders now', dockerApi.folderDensity() === 'grid');

  localStorage.setItem('cc.folderDensity', 'garbage-from-an-older-build');
  ok('any other unrecognised value degrades to "full" rather than to a blank density', dockerApi.folderDensity() === 'full');
  reset();
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
