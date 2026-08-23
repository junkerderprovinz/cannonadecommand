// Regression test: Folder view's new "Kompakt" minimal row density (v4.34.0).
//
// User, verbatim: "Die Folder view soll auch viel abgespeckter sein. das sollen quasi nur die
// icons und das nötigste pro container zu sehen sein" — a genuinely NEW, minimal per-container
// tile (icon + name + running/stopped state + one essential action), NOT card() reused in a
// list layout. This file source-slices the REAL minimalRow()/folderDensity()/setFolderDensity()
// out of docker.js (never re-typed) and proves:
//   1. a minimal row shows exactly icon + name + state badge + one action button, nothing else;
//   2. it does NOT carry any of card()'s full-detail chrome — CPU/RAM gauges, network/port/IP
//      badges, the plan chip, the CPU/RAM/BW limit gears, the "move to folder" button — the
//      whole point of "genuinely minimal";
//   3. the single action matches the container's actual state (start/stop/resume);
//   4. it still participates in the live-search filter, same as a full card();
//   5. folderDensity()/setFolderDensity() persist "full" vs "minimal" like every other cc.* pref.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

/* ── minimal DOM shim (only what minimalRow()'s own dependency chain actually touches) ──────── */
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.dataset = {};
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
  addEventListener() {}
  querySelector() { return null; }
  querySelectorAll(sel) {
    // good enough for tintAct()'s ".cc-actbtn" lookup — a class-name walk
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
ok('minimalRow() really exists in docker.js (not just planned)', src.indexOf('function minimalRow(') >= 0);

const dockerApi = new Function('document', 'localStorage',
  'var RB_PAL = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  'var LANG = "en";\n' +
  'var T = { en: { resume: "Resume", stop: "Stop", start: "Start" } };\n' +
  'var iconCache = {};\n' +
  'var containerNames = [];\n' +
  'var filterText = "";\n' +
  'var mode = "list";\n' +               // setFolderDensity()'s re-render guard — "list" means it never has to call renderFolderView()
  'var unpauseGrace = {};\n' +
  grabVar('STATE_LABELS') + '\n' +
  grabVar('FOLDER_DENSITY_KEY') + '\n' +
  grabFn('el') + '\n' + grabFn('norm') + '\n' + grabFn('t') + '\n' +
  grabFn('stateLabel') + '\n' + grabFn('showUnhealthy') + '\n' + grabFn('stateBadge') + '\n' +
  grabFn('idealText') + '\n' + grabFn('ccPalActive') + '\n' + grabFn('ccRbColor') + '\n' +
  grabFn('themingOn') + '\n' + grabFn('effc') + '\n' + grabFn('stampCardRainbow') + '\n' +
  grabFn('iconFor') + '\n' + grabFn('actBtn') + '\n' + grabFn('tintAct') + '\n' +
  grabFn('minimalRow') + '\n' + grabFn('folderDensity') + '\n' + grabFn('setFolderDensity') + '\n' +
  'return { minimalRow: minimalRow, folderDensity: folderDensity, setFolderDensity: setFolderDensity, setFilterText: function (v) { filterText = v; } };'
)(document, localStorage);

function collectClasses(node, out) { out.push(...node.classList.s); node.children.forEach(c => collectClasses(c, out)); return out; }

console.log('\nA running container: exactly icon + name + state + ONE action — nothing else');
{
  reset();
  const row = dockerApi.minimalRow({ name: 'jdownloader', state: 'running' });
  ok('wrapper carries .cc-card (rides card()\'s colour-mode CSS) AND .cc-mrow (its own layout override)', row.classList.contains('cc-card') && row.classList.contains('cc-mrow'));
  ok('wrapper is tagged with the container name (dataset.name)', row.dataset.name === 'jdownloader', row.dataset.name);
  ok('EXACTLY 4 direct children: icon, name, state badge, action — no 5th element bolted on', row.children.length === 4, row.children.length);

  const classes = collectClasses(row, []);
  ok('shows an icon slot (real .cc-card-ico, no icon source resolved in this harness -> the placeholder)', classes.includes('cc-card-ico') || classes.includes('cc-card-ico-ph'));

  const nameEl = row.children.find(n => n.classList.contains('cc-mrow-name'));
  ok('shows the container NAME as text', !!nameEl && nameEl.textContent === 'jdownloader', nameEl && nameEl.textContent);

  const badge = row.children.find(n => n.classList.contains('cc-badge'));
  ok('shows a RUNNING/STOPPED state badge (stateBadge(), same one card() uses)', !!badge && badge.classList.contains('cc-badge-running'), badge && [...badge.classList.s]);

  const actWrap = row.children.find(n => n.classList.contains('cc-mrow-act'));
  ok('exactly ONE action control — "the single most essential action", not a full action bar', !!actWrap && actWrap.children.length === 1);
  const btn = actWrap && actWrap.children[0];
  ok('the action button is the real actBtn()/.cc-actbtn (same icon-button machinery as the full card)', !!btn && btn.classList.contains('cc-actbtn'));
  ok('running container -> the essential action is STOP (fa-stop)', btn.children[0].className.indexOf('fa-stop') >= 0, btn.children[0].className);

  console.log('\n  ...and NONE of the full card()\'s detail chrome ever appears in a minimal row:');
  const forbidden = ['cc-card-stats', 'cc-gauge', 'cc-card-badges', 'cc-card-actions', 'cc-card-res', 'cc-plan', 'cc-b-cpu', 'cc-b-ram', 'cc-b-bw', 'cc-b-net', 'cc-b-port', 'cc-b-ip', 'cc-card-movebtn', 'cc-card-img'];
  forbidden.forEach(fc => ok('  no "' + fc + '" (that is full-card()-only chrome)', !classes.includes(fc)));
}

console.log('\nThe single action always matches the container\'s ACTUAL state');
{
  reset();
  const stopped = dockerApi.minimalRow({ name: 'sonarr', state: 'exited' });
  const stoppedBtn = stopped.children.find(n => n.classList.contains('cc-mrow-act')).children[0];
  ok('stopped container -> START (fa-play), tooltip "Start"', stoppedBtn.children[0].className.indexOf('fa-play') >= 0 && stoppedBtn.getAttribute('data-tip') === 'Start');

  const paused = dockerApi.minimalRow({ name: 'radarr', state: 'paused' });
  const pausedBtn = paused.children.find(n => n.classList.contains('cc-mrow-act')).children[0];
  ok('paused container -> RESUME (fa-play), tooltip "Resume" (distinct from a plain start)', pausedBtn.children[0].className.indexOf('fa-play') >= 0 && pausedBtn.getAttribute('data-tip') === 'Resume');

  const running = dockerApi.minimalRow({ name: 'plex', state: 'running' });
  const runningBtn = running.children.find(n => n.classList.contains('cc-mrow-act')).children[0];
  ok('running container -> STOP (fa-stop), tooltip "Stop"', runningBtn.children[0].className.indexOf('fa-stop') >= 0 && runningBtn.getAttribute('data-tip') === 'Stop');
}

console.log('\nMinimal rows still honour the live-search filter, exactly like the full card() does');
{
  reset();
  dockerApi.setFilterText('sonarr');
  const noMatch = dockerApi.minimalRow({ name: 'radarr', state: 'running' });
  ok('a non-matching name is hidden (style.display = "none")', noMatch.style.display === 'none');
  const match = dockerApi.minimalRow({ name: 'sonarr', state: 'running' });
  ok('a matching name stays visible', match.style.display !== 'none');
  dockerApi.setFilterText('');
  const cleared = dockerApi.minimalRow({ name: 'radarr', state: 'running' });
  ok('clearing the filter shows everything again', cleared.style.display !== 'none');
}

console.log('\nfolderDensity()/setFolderDensity(): the "Vollständig" vs "Kompakt" toggle, persisted like every other cc.* preference');
{
  reset();
  ok('defaults to "full" with nothing stored yet', dockerApi.folderDensity() === 'full');
  dockerApi.setFolderDensity('minimal');
  ok('setFolderDensity("minimal") persists under cc.folderDensity', localStorage.getItem('cc.folderDensity') === 'minimal');
  ok('folderDensity() now reads back "minimal"', dockerApi.folderDensity() === 'minimal');
  dockerApi.setFolderDensity('full');
  ok('setFolderDensity("full") persists back', dockerApi.folderDensity() === 'full' && localStorage.getItem('cc.folderDensity') === 'full');
  localStorage.setItem('cc.folderDensity', 'garbage-from-an-older-build');
  ok('an unrecognised stored value degrades to "full", never throws, never a blank density', dockerApi.folderDensity() === 'full');
  reset();
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
