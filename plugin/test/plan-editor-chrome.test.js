// DOM-shim regression test for the Startplan editor's control chrome in docker.js.
//
// Why this file exists: the plan editor was reported three rounds running for controls that had
// never been wired into GlimStone or the colour modes — checkboxes, the Save button, the activation
// toggle, the day chips, the time picker. The fix introduced ONE painter (paintPopChrome) and ONE
// replacement widget (ccTimePicker), and both are the kind of thing a later refactor silently drops.
// So the shapes are pinned here: which controls the painter sweeps, that the checkbox tick stays a
// legal data URI, that the time picker really produces 24 hours + 60 minutes and writes a padded
// HH:MM back into the input, and that the "click outside closes the window" guard still treats a
// body-level .cc-drop panel as part of the window (picking a dependency used to tear the editor down
// and discard every unsaved edit in it — measured live on the box).

const fs = require('fs');
const path = require('path');
const DOCKER = process.argv[2] || path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local',
  'emhttp', 'plugins', 'cannonadecommand', 'scripts', 'docker.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } }
function eq(a, b, msg) { ok(a === b, msg + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

/* ── minimal DOM shim ───────────────────────────────────────────────────────── */
class CL {
  constructor(n) { this.s = new Set(); this.n = n; }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class Style {
  constructor() { this.props = {}; }
  setProperty(k, v) { this.props[k] = String(v); }
  removeProperty(k) { delete this.props[k]; }
  getPropertyValue(k) { return this.props[k] || ''; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(this); this._txt = ''; this.attrs = {}; this.listeners = {};
    this.style = new Style(); this.value = ''; this.type = ''; this.scrollTop = 0; this.offsetTop = 0;
    this.offsetHeight = 200; this.offsetWidth = 160;
  }
  get className() { return [...this.classList.s].join(' '); }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  dispatchEvent(e) { (this.listeners[e.type] || []).forEach(fn => fn(e)); return true; }
  fire(t, ev) { (this.listeners[t] || []).forEach(fn => fn(ev || { preventDefault() {}, stopPropagation() {} })); }
  getBoundingClientRect() { return { left: 100, right: 200, top: 300, bottom: 328, width: 100, height: 28 }; }
  // good enough for the selectors this code actually uses: ".a, .b" and "tag"
  querySelectorAll(sel) {
    const parts = String(sel).split(',').map(s => s.trim()).filter(Boolean);
    const out = [];
    const walk = n => n.children.forEach(c => { if (parts.some(p => matches(c, p))) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function matches(n, p) {
  if (p.startsWith('input[type=checkbox]')) return n.tagName === 'INPUT' && n.type === 'checkbox';
  if (p.startsWith('.')) return n.classList.contains(p.slice(1).split('[')[0]);
  return n.tagName === p.toUpperCase();
}
const body = new N('body');
global.document = {
  body,
  documentElement: Object.assign(new N('html'), { clientHeight: 900, clientWidth: 1500 }),
  createElement: t => new N(t),
  addEventListener() {}, removeEventListener() {}
};
global.window = { scrollX: 0, scrollY: 0, innerHeight: 900, innerWidth: 1500 };
global.Event = class { constructor(type) { this.type = type; } };
global.localStorage = { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); } };
global.navigator = { language: 'de' };

/* ── pull the REAL code out of docker.js ────────────────────────────────────── */
const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabLine(marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('marker not found in docker.js: ' + marker);
  return src.slice(src.lastIndexOf('\n', i) + 1, src.indexOf('\n', i));
}
const POP_PAINT_SEL = (/var POP_PAINT_SEL = "([^"]+)"/.exec(src) || [])[1];
const code = ['el', 'ccTickURL', 'ccTimePicker'].map(grabFn).join('\n');
const fns = new Function('paintSelects', code + '\n; return { el, ccTickURL, ccTimePicker };')(function () {});

/* ── 1. the painter's sweep must still name every control class ─────────────── */
console.log('\nPart 1 — the paint sweep covers every interactive control class in the window');
ok(!!POP_PAINT_SEL, 'POP_PAINT_SEL is still declared in docker.js');
[
  ['.cc-set-toggle', 'the activation toggle ("Im Startplan verwalten")'],
  ['input[type=checkbox]', 'the watchdog / idle-stop checkboxes'],
  ['.cc-day', 'the Mo..So day chips'],
  ['.cc-btn', 'Speichern and "+ Zeitplan"'],
  ['.cc-sched-time', 'the schedule time field'],
  ['.cc-pop-x', 'the window close X'],
].forEach(([sel, what]) => ok(POP_PAINT_SEL.indexOf(sel) >= 0, 'sweep still includes ' + sel + ' — ' + what));

/* ── 2. the checkbox tick is a LEGAL data URI in every palette ──────────────── */
console.log('\nPart 2 — the per-checkbox tick colour');
const tick = fns.ccTickURL('#161616');
ok(tick.indexOf('%23161616') >= 0, 'the # of the colour is percent-escaped (a raw # truncates the data URI)');
ok(tick.indexOf("stroke='#") < 0, 'no raw # survives anywhere in the URI');
ok(/^url\("data:image\/svg\+xml/.test(tick), 'it is a url() wrapped data URI, usable as background-image');
ok(fns.ccTickURL('#fff').indexOf('%23fff') >= 0, 'short hex is escaped the same way');

/* ── 3. the CC time picker replaces the browser drop-down faithfully ────────── */
console.log('\nPart 3 — the .cc-timepick replacement widget');
const input = new N('input');
input.type = 'time'; input.className = 'cc-in cc-sched-time'; input.value = '07:30';
fns.ccTimePicker(input);
input.fire('focus');
const panel = body.children.find(c => c.classList.contains('cc-timepick'));
ok(!!panel, 'focusing the field opens a panel');
ok(panel.classList.contains('cc-drop'), 'it IS a .cc-drop — so closePop() sweeps it and paintSelects() colours it');
const cols = panel.querySelectorAll('.cc-tp-col');
eq(cols.length, 2, 'two columns (hours, minutes)');
eq(cols[0].querySelectorAll('.cc-drop-it').length, 24, 'hours 00..23 — every hour, no coarse grid');
eq(cols[1].querySelectorAll('.cc-drop-it').length, 60, 'minutes 00..59 — no precision lost vs the native field');
eq(cols[0].children[0].textContent, '00', 'hours are zero padded');
eq(cols[1].children[7].textContent, '07', 'minutes are zero padded');
const onChips = panel.querySelectorAll('.cc-drop-on').map(c => c.textContent);
eq(onChips.join(','), '07,30', 'the current value opens marked in both columns');

// picking an hour writes back and keeps the panel open for the minute
const h22 = cols[0].children[22];
h22.fire('mousedown', { preventDefault() {}, stopPropagation() {} });
eq(input.value, '22:30', 'picking an hour rewrites only the hour, padded');
ok(body.children.indexOf(panel) >= 0, 'the panel stays open after a pick (hour AND minute in one visit)');
eq(cols[0].querySelectorAll('.cc-drop-on').length, 1, 'exactly one hour stays marked');
eq(cols[0].querySelectorAll('.cc-drop-on')[0].textContent, '22', 'and it is the one just picked');
cols[1].children[5].fire('mousedown', { preventDefault() {}, stopPropagation() {} });
eq(input.value, '22:05', 'picking a minute rewrites only the minute, padded');

// an empty field must not produce "NaN:NaN"
panel.remove();
const blank = new N('input'); blank.type = 'time'; blank.className = 'cc-in cc-sched-time'; blank.value = '';
fns.ccTimePicker(blank); blank.fire('focus');
const p2 = body.children.find(c => c.classList.contains('cc-timepick'));
p2.querySelectorAll('.cc-tp-col')[0].children[9].fire('mousedown', { preventDefault() {}, stopPropagation() {} });
eq(blank.value, '09:00', 'an empty field fills the untouched half with 00, never NaN');
ok(/^\d{2}:\d{2}$/.test(blank.value), 'the result matches the HH:MM shape row._read insists on');

/* ── 4. a body-level panel is NOT "outside" the window ──────────────────────── */
console.log('\nPart 4 — the outside-click guard');
const guard = grabLine('if (openPop && !openPop.contains(e.target)');
ok(guard.indexOf('.cc-drop') >= 0,
  'the guard names .cc-drop — without it, picking a dependency or a time closes the whole editor and drops every unsaved edit');
ok(guard.indexOf('.cc-plan') >= 0, 'and it still names .cc-plan (re-clicking the badge stays a toggle, not a double close)');

/* ── 5. the hard-coded palettes really are gone ─────────────────────────────── */
console.log('\nPart 5 — no hard-coded colour lists left in the editor');
ok(!/accentColor = rbc\[/.test(src), 'the six-colour accentColor list for the checkboxes is gone from docker.js');
const css = fs.readFileSync(path.join(path.dirname(DOCKER), '..', 'styles', 'docker.css'), 'utf8');
ok(!/\.cc-pop\.cc-rainbow \.cc-day-on \{ background: #8b5cf6/.test(css), 'the hard-coded violet for a selected day chip is gone from docker.css');
ok(/\.cc-day-on \{ background: var\(--cc-rb-c/.test(css), 'a selected day chip reads the --cc-rb-c chain instead');
ok(/\.cc-pop\.cc-rainbow \.cc-set-toggle-on \{ background: var\(--cc-rb-c/.test(css), 'the activation toggle reads --cc-rb-c before the shared --cc-rbaccent');
ok(/\.cc-btn-primary \{ font-weight: 600; background: var\(--cc-rb-c/.test(css), 'the Save button reads --cc-rb-c before the shared accent');

console.log('\n' + (fail ? 'FAILED ' + fail + ' of ' + (pass + fail) : 'OK  ' + pass + ' passed'));
process.exit(fail ? 1 : 0);
