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

/* ── 6. the (i) bubble is an OUTLINE RING, in every builder ─────────────────── */
// 4.26.0 unified four hand-rolled info icons into one builder (good) and, in the same commit, swapped the
// ring for tabler's FILLED info-circle on the reasoning that GlimStone Rule 20 applied (wrong — Rule 20
// names the (i) as its ONE exception, because the ring IS the "i" in a circle). The filled path is what a
// well-meaning "Rule 20 sweep" would put back, so its ABSENCE is pinned here, in the shared builder and in
// all three byte-compatible fallbacks at once.
console.log('\nPart 6 — the info bubble is a circle outline, never a filled disc');
const SCRIPTS = path.dirname(DOCKER);
const FILLED_INFO = 'M12 2c5.523 0 10 4.477 10 10';                    // tabler icons/filled/info-circle.svg
const RING = /viewBox="0 0 16 16"[^>]*fill="none"/;                    // the GlimStone reference glyph
[['cc-theme.js', 'the ONE shared builder'], ['header.js', 'the header.js fallback'],
 ['settings.js', 'the settings.js fallback'], ['shares.js', 'the shares.js fallback']].forEach(([f, what]) => {
  const s = fs.readFileSync(path.join(SCRIPTS, f), 'utf8');
  ok(s.indexOf(FILLED_INFO) < 0, f + ': the filled info-circle disc is gone — ' + what);
});
const theme = fs.readFileSync(path.join(SCRIPTS, 'cc-theme.js'), 'utf8');
ok(RING.test(theme), 'cc-theme.js draws the 16x16 fill="none" ring');
ok(/<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1\.3"/.test(theme), 'ring: r=7, stroke-width 1.3, currentColor (GlimStone reference values)');
ok(/<circle cx="8" cy="4\.6" r="0\.9" fill="currentColor"/.test(theme), 'the dot of the "i": r=0.9 at cy=4.6');
ok(/<path d="M8 7v4\.4" stroke="currentColor" stroke-width="1\.3" stroke-linecap="round"/.test(theme), 'the stem is a <path> with round caps, NOT a <rect> (a rect rounds its ends differently)');
// stroke/fill both resolve through currentColor -> .cc-info's var(--txt): neutral, never accent (Rule 8)
ok(/\.cc-info \{[^}]*color: var\(--txt/.test(css), '.cc-info still resolves currentColor to the neutral text colour');
ok(/\.cc-info \{[^}]*background: none/.test(css), '.cc-info keeps background:none — with an outline glyph that reset is what stops an inherited chip fill painting a disc behind the ring');

/* ── 7. the schedule row: one line, one delete BADGE the size of a day chip ─── */
console.log('\nPart 7 — the schedule row fits on one line and its delete control is a badge');
ok(/el\("span", "cc-sched-x"\); rm\.innerHTML = CC_TRASH_SVG/.test(src), 'the delete control carries the trash SVG, not a typed "✕" character');
ok(!/el\("span", "cc-sched-x", "✕"\)/.test(src), 'the bare ✕ character is gone from docker.js');
ok(/CC_TRASH_SVG = \(window\.CCTheme && window\.CCTheme\.CC_TRASH_SVG\)/.test(src), 'docker.js takes the glyph from cc-theme.js, with a local fallback — one source, like the (i)');
const TRASH = 'M20 6a1 1 0 0 1 .117 1.993';                            // tabler icons/filled/trash.svg
ok(theme.indexOf(TRASH) >= 0, 'cc-theme.js carries the FILLED tabler trash (Rule 20), verbatim from the set');
ok(css.indexOf(TRASH) >= 0, 'the Plugins-page delete button uses the SAME can — no second trash design in CC');
ok(!/polyline points='3 6 5 6 21 6'/.test(css), 'and the old stroke-drawn outline trash is gone from docker.css');
// "gleich gross wie die tage daneben" is only true if it cannot drift — so the box is ONE declaration
const shared = /\.cc-day, \.cc-sched-x \{[^}]*\}/.exec(css);
ok(!!shared, '.cc-day and .cc-sched-x share ONE geometry rule, so the two boxes cannot drift apart');
if (shared) {
  ['width: 26px', 'height: 26px', 'padding: 0', 'border: none', 'box-sizing: border-box', 'flex: none'].forEach(d =>
    ok(shared[0].indexOf(d) >= 0, 'the shared box declares ' + d));
}
ok(/html \.cc-limbtn, html \.cc-day, html \.cc-sched-x,/.test(css), 'both are swept by the shape engine together, so a Badge-Form change moves the badge and the chips as one');
ok(/\.cc-sched-x \{ margin-left: auto; background: var\(--cc-err/.test(css), 'the badge is semantic red (Rule 4) — destructive, so never accent/rainbow');
ok(!/cc-shares-rbneutral[^\n]*\.cc-sched-x/.test(css) && POP_PAINT_SEL.indexOf('.cc-sched-x') < 0, 'and it is in no colour-mode sweep at all, so nothing can repaint it');
// the window itself
ok(/el\("div", "cc-pop cc-pop-plan"\)/.test(src), 'the Startplan editor opens with .cc-pop-plan');
ok(/\.cc-pop\.cc-pop-plan \{ width: 548px; \}/.test(css), 'which is 548px wide — measured: 454 content + 18 row + 28 list + 28 section = 528 is the wrap threshold');
ok(/\.cc-pop \.cc-sched-row \.cc-dsel \{ flex: none; width: 104px; \}/.test(css), 'the action dropdown is pinned to its content width (a flex:1 basis:0 wrapper contributes ~0 to the line break and then swallows the leftover)');
ok(/\.cc-sched-row \{[^}]*flex-wrap: wrap/.test(css), 'flex-wrap stays as the sub-528px fallback — the 92vw cap can still take the window below that');

/* ── 8. the viewport clamp covers BOTH axes ─────────────────────────────────── */
console.log('\nPart 8 — a standing window is re-clamped on both axes');
const clamp = grabFn('clampPop');
ok(/data-cc-top/.test(clamp), 'clampPop still remembers the preferred top');
ok(/data-cc-left/.test(clamp), 'and the preferred left — a wider window hangs off the RIGHT edge when the viewport shrinks, the same bug 4.27.0 fixed vertically');
ok(/style\.left =/.test(clamp), 'clampPop is what writes left now');
const place = grabFn('placePop');
ok(!/style\.left =/.test(place), 'placePop no longer writes left itself — one formula for the first placement and every re-clamp, so they cannot disagree');
ok(/data-cc-left/.test(place), 'placePop records the anchor-relative left as the preference');

console.log('\n' + (fail ? 'FAILED ' + fail + ' of ' + (pass + fail) : 'OK  ' + pass + ' passed'));
process.exit(fail ? 1 : 0);
