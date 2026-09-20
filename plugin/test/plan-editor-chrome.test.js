// Pins the control chrome of the Startplan editor in docker.js. Its checkboxes,
// Save button, activation toggle, day chips and time picker are painted by one
// function, paintPopChrome, and the time field is replaced by one widget,
// ccTimePicker, both of which a refactor can quietly drop.
//
// So: which controls the painter sweeps, that the checkbox tick stays a legal data
// URI, that the time picker offers 24 hours and 60 minutes and writes a padded
// HH:MM back into the input, and that the outside-click guard counts a body-level
// .cc-drop panel as part of the window, without which picking a dependency tears
// the editor down and takes every unsaved edit with it.

const fs = require('fs');
const path = require('path');
const DOCKER = process.argv[2] || path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local',
  'emhttp', 'plugins', 'cannonadecommand', 'scripts', 'docker.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } }
function eq(a, b, msg) { ok(a === b, msg + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

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
  // Covers the selectors this code uses: ".a, .b" and a bare tag.
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

// Pull the code under test out of docker.js.
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

console.log('\nPart 1: the paint sweep covers every interactive control class in the window');
ok(!!POP_PAINT_SEL, 'POP_PAINT_SEL is still declared in docker.js');
[
  ['.cc-set-toggle', 'the activation toggle ("Im Startplan verwalten")'],
  ['input[type=checkbox]', 'the watchdog / idle-stop checkboxes'],
  ['.cc-day', 'the Mo..So day chips'],
  ['.cc-btn', 'Speichern and "+ Zeitplan"'],
  ['.cc-sched-time', 'the schedule time field'],
  ['.cc-pop-x', 'the window close X'],
].forEach(([sel, what]) => ok(POP_PAINT_SEL.indexOf(sel) >= 0, 'the sweep includes ' + sel + ', ' + what));

console.log('\nPart 2: the per-checkbox tick colour');
const tick = fns.ccTickURL('#161616');
ok(tick.indexOf('%23161616') >= 0, 'the # of the colour is percent-escaped (a raw # truncates the data URI)');
ok(tick.indexOf("stroke='#") < 0, 'no raw # survives anywhere in the URI');
ok(/^url\("data:image\/svg\+xml/.test(tick), 'it is a url() wrapped data URI, usable as background-image');
ok(fns.ccTickURL('#fff').indexOf('%23fff') >= 0, 'short hex is escaped the same way');

console.log('\nPart 3: the .cc-timepick replacement widget');
const input = new N('input');
input.type = 'time'; input.className = 'cc-in cc-sched-time'; input.value = '07:30';
fns.ccTimePicker(input);
input.fire('focus');
const panel = body.children.find(c => c.classList.contains('cc-timepick'));
ok(!!panel, 'focusing the field opens a panel');
ok(panel.classList.contains('cc-drop'), 'it is a .cc-drop, so closePop() sweeps it and paintSelects() colours it');
const cols = panel.querySelectorAll('.cc-tp-col');
eq(cols.length, 2, 'two columns, hours and minutes');
eq(cols[0].querySelectorAll('.cc-drop-it').length, 24, 'every hour from 00 to 23');
eq(cols[1].querySelectorAll('.cc-drop-it').length, 60, 'every minute from 00 to 59, as in the native field');
eq(cols[0].children[0].textContent, '00', 'hours are zero padded');
eq(cols[1].children[7].textContent, '07', 'minutes are zero padded');
const onChips = panel.querySelectorAll('.cc-drop-on').map(c => c.textContent);
eq(onChips.join(','), '07,30', 'the current value opens marked in both columns');

// Picking an hour writes back and keeps the panel open for the minute.
const h22 = cols[0].children[22];
h22.fire('mousedown', { preventDefault() {}, stopPropagation() {} });
eq(input.value, '22:30', 'picking an hour rewrites only the hour, padded');
ok(body.children.indexOf(panel) >= 0, 'the panel stays open, so hour and minute take one visit');
eq(cols[0].querySelectorAll('.cc-drop-on').length, 1, 'exactly one hour stays marked');
eq(cols[0].querySelectorAll('.cc-drop-on')[0].textContent, '22', 'and it is the one just picked');
cols[1].children[5].fire('mousedown', { preventDefault() {}, stopPropagation() {} });
eq(input.value, '22:05', 'picking a minute rewrites only the minute, padded');

// An empty field must not produce "NaN:NaN".
panel.remove();
const blank = new N('input'); blank.type = 'time'; blank.className = 'cc-in cc-sched-time'; blank.value = '';
fns.ccTimePicker(blank); blank.fire('focus');
const p2 = body.children.find(c => c.classList.contains('cc-timepick'));
p2.querySelectorAll('.cc-tp-col')[0].children[9].fire('mousedown', { preventDefault() {}, stopPropagation() {} });
eq(blank.value, '09:00', 'an empty field fills the untouched half with 00, never NaN');
ok(/^\d{2}:\d{2}$/.test(blank.value), 'the result matches the HH:MM shape row._read insists on');

console.log('\nPart 4: the outside-click guard, for which a body-level panel is inside');
const guard = grabLine('if (openPop && !openPop.contains(e.target)');
ok(guard.indexOf('.cc-drop') >= 0,
  'the guard names .cc-drop, without which picking a dependency or a time closes the editor');
ok(guard.indexOf('.cc-plan') >= 0, 'and .cc-plan, so re-clicking the badge stays a toggle rather than a double close');

console.log('\nPart 5: no hard-coded colour lists left in the editor');
ok(!/accentColor = rbc\[/.test(src), 'the six-colour accentColor list for the checkboxes is gone from docker.js');
const css = fs.readFileSync(path.join(path.dirname(DOCKER), '..', 'styles', 'docker.css'), 'utf8');
ok(!/\.cc-pop\.cc-rainbow \.cc-day-on \{ background: #8b5cf6/.test(css), 'the hard-coded violet for a selected day chip is gone from docker.css');
ok(/\.cc-day-on \{ background: var\(--cc-rb-c/.test(css), 'a selected day chip reads the --cc-rb-c chain instead');
ok(/\.cc-pop\.cc-rainbow \.cc-set-toggle-on \{ background: var\(--cc-rb-c/.test(css), 'the activation toggle reads --cc-rb-c before the shared --cc-rbaccent');
ok(/\.cc-btn-primary \{ font-weight: 600; background: var\(--cc-rb-c/.test(css), 'the Save button reads --cc-rb-c before the shared accent');

// GlimStone Rule 20 asks for filled glyphs and names the (i) as its exception,
// the ring being the circle around the "i", so a sweep applying that rule would
// put tabler's filled info-circle back. Its absence is pinned in the shared
// builder and in all three fallbacks.
console.log('\nPart 6: the info bubble is a circle outline, never a filled disc');
const SCRIPTS = path.dirname(DOCKER);
const FILLED_INFO = 'M12 2c5.523 0 10 4.477 10 10';                    // tabler icons/filled/info-circle.svg
const RING = /viewBox="0 0 16 16"[^>]*fill="none"/;                    // the GlimStone reference glyph
[['cc-theme.js', 'the shared builder'], ['header.js', 'the header.js fallback'],
 ['settings.js', 'the settings.js fallback'], ['shares.js', 'the shares.js fallback']].forEach(([f, what]) => {
  const s = fs.readFileSync(path.join(SCRIPTS, f), 'utf8');
  ok(s.indexOf(FILLED_INFO) < 0, f + ': no filled info-circle disc in ' + what);
});
const theme = fs.readFileSync(path.join(SCRIPTS, 'cc-theme.js'), 'utf8');
ok(RING.test(theme), 'cc-theme.js draws the 16x16 fill="none" ring');
ok(/<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1\.3"/.test(theme), 'ring: r=7, stroke-width 1.3, currentColor (GlimStone reference values)');
ok(/<circle cx="8" cy="4\.6" r="0\.9" fill="currentColor"/.test(theme), 'the dot of the "i": r=0.9 at cy=4.6');
ok(/<path d="M8 7v4\.4" stroke="currentColor" stroke-width="1\.3" stroke-linecap="round"/.test(theme), 'the stem is a <path> with round caps, where a <rect> would round its ends differently');
// Stroke and fill both resolve through currentColor to .cc-info's var(--txt), so
// the glyph stays neutral rather than taking the accent (Rule 8).
ok(/\.cc-info \{[^}]*color: var\(--txt/.test(css), '.cc-info resolves currentColor to the neutral text colour');
ok(/\.cc-info \{[^}]*background: none/.test(css), '.cc-info keeps background:none, which is what stops an inherited chip fill painting a disc behind the ring');

console.log('\nPart 7: the schedule row fits on one line and its delete control is a badge');
ok(/el\("span", "cc-sched-x"\); rm\.innerHTML = CC_TRASH_SVG/.test(src), 'the delete control carries the trash SVG, not a typed "✕"');
ok(!/el\("span", "cc-sched-x", "✕"\)/.test(src), 'the bare ✕ character is gone from docker.js');
ok(/CC_TRASH_SVG = \(window\.CCTheme && window\.CCTheme\.CC_TRASH_SVG\)/.test(src), 'docker.js takes the glyph from cc-theme.js with a local fallback, as it does the (i)');
const TRASH = 'M20 6a1 1 0 0 1 .117 1.993';                            // tabler icons/filled/trash.svg
ok(theme.indexOf(TRASH) >= 0, 'cc-theme.js carries the filled tabler trash from the set, as Rule 20 asks');
ok(css.indexOf(TRASH) >= 0, 'the Plugins-page delete button uses the same can, so there is one trash design');
ok(!/polyline points='3 6 5 6 21 6'/.test(css), 'and the stroke-drawn outline trash is gone from docker.css');
// The badge and the day chips can only stay the same size if one rule holds both.
const shared = /\.cc-day, \.cc-sched-x \{[^}]*\}/.exec(css);
ok(!!shared, '.cc-day and .cc-sched-x share one geometry rule');
if (shared) {
  ['width: 26px', 'height: 26px', 'padding: 0', 'border: none', 'box-sizing: border-box', 'flex: none'].forEach(d =>
    ok(shared[0].indexOf(d) >= 0, 'the shared box declares ' + d));
}
ok(/html \.cc-limbtn, html \.cc-day, html \.cc-sched-x,/.test(css), 'both are swept by the shape engine together, so a Badge-Form change moves the badge and the chips as one');
ok(/\.cc-sched-x \{ margin-left: auto; background: var\(--cc-err/.test(css), 'the badge is the semantic red of a destructive action (Rule 4), never accent or rainbow');
ok(!/cc-shares-rbneutral[^\n]*\.cc-sched-x/.test(css) && POP_PAINT_SEL.indexOf('.cc-sched-x') < 0, 'and no colour-mode sweep touches it');
ok(/el\("div", "cc-pop cc-pop-plan"\)/.test(src), 'the Startplan editor opens with .cc-pop-plan');
ok(/\.cc-pop\.cc-pop-plan \{ width: 548px; \}/.test(css), 'and is 548px wide, above the 528px at which the schedule row wraps');
ok(/\.cc-pop \.cc-sched-row \.cc-dsel \{ flex: none; width: 104px; \}/.test(css), 'the action dropdown is pinned to its content width: a flex:1 basis:0 wrapper contributes almost nothing to the line break and then takes the leftover');
ok(/\.cc-sched-row \{[^}]*flex-wrap: wrap/.test(css), 'flex-wrap stays for the narrower case, the 92vw cap still reaching below 528px');

console.log('\nPart 8: a standing window is re-clamped on both axes');
const clamp = grabFn('clampPop');
ok(/data-cc-top/.test(clamp), 'clampPop remembers the preferred top');
ok(/data-cc-left/.test(clamp), 'and the preferred left, a wide window hanging off the right edge as the viewport shrinks');
ok(/style\.left =/.test(clamp), 'clampPop is what writes left');
const place = grabFn('placePop');
ok(!/style\.left =/.test(place), 'placePop leaves left to it, so one formula serves the first placement and every re-clamp');
ok(/data-cc-left/.test(place), 'placePop records the anchor-relative left as the preference');

// A hard `width` on .cc-pop-lbl cannot grow with a longer label: it wraps inside
// the box and doubles the row. .cc-pop-auto narrowing the same column to 90px hit
// the sections with the longest labels, Restart-Policy and Leerlauf-Minuten at
// around 92px. The shape of the floor is pinned, a hard width being what a tidy-up
// would write back.
console.log('\nPart 9: the label column cannot wrap, and every field is one width');
const lblRule = /\.cc-pop-lbl \{([^}]*)\}/.exec(css);
ok(!!lblRule, '.cc-pop-lbl is declared');
if (lblRule) {
  ok(/min-width:/.test(lblRule[1]), 'the column is a min-width floor, a box that can grow');
  ok(!/[^-]width: \d/.test(lblRule[1]), 'and carries no hard width, which is what wrapped the long labels');
  ok(/white-space: nowrap/.test(lblRule[1]), 'nowrap makes a two-line label impossible rather than unlikely');
  ok(/flex: 0 0 auto/.test(lblRule[1]), 'flex:0 0 auto, so a long value cannot squeeze the column under the floor');
  ok(/padding-right/.test(lblRule[1]), 'the gap to the text is padding: hardenPop stamps margin:0 !important on every row child');
}
// The rule that was removed is quoted in the comment that replaced it, so only a
// live declaration counts here.
const cssLive = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/\.cc-pop-auto \.cc-pop-lbl \{ width: 90px/.test(cssLive), 'there is no second, narrower label column for half the window');
ok(/\.cc-pop\.cc-pop-plan \.cc-pop-lbl \{ min-width: 120px; \}/.test(css), 'the plan window raises its floor to 120px, its longest label measuring about 96px with the (i)');
const harden = grabFn('hardenPop');
ok(/cc-pop-lbl/.test(harden), 'hardenPop knows about the label column');
ok(/classList\.contains\("cc-pop-lbl"\)[\s\S]*?white-space[\s\S]*?nowrap/.test(harden), 'and stamps nowrap and the same floor inline, where Unraid theme rules cannot reach');
ok(/cc-pop-lbl[\s\S]{0,400}?return;/.test(harden), 'the label returns before the blanket min-width:0, which would collapse the floor to ragged per-row widths');
ok(/\.cc-pop\.cc-pop-plan \.cc-pop-row \.cc-port \{ flex: 1 1 0 !important/.test(css), 'in the plan window every .cc-port joins the shared value column instead of staying an 80px stub');
ok(/\.cc-pop\.cc-pop-plan \.cc-pop-row \.cc-dsel \{ flex: 1 1 16px; \}/.test(css), 'the dropdown wrapper takes a 16px basis to match a border-box .cc-in, whose flex-basis:0 is floored at its own padding');
ok(/\.cc-port \{ flex: none; width: 80px/.test(css), 'and the CPU and RAM window keeps its 80px, where .cc-port is half of a value and unit pair');
ok(/i\.closest\("\.cc-pop-plan"\)[\s\S]{0,120}?"flex", "1 1 0"/.test(harden), 'hardenPop agrees with the sheet instead of stamping the 80px stub back');

// Unraid's default-base.css paints every placeholder in the theme's link colour,
// so a hint reads as a link or as a filled-in value. A guard repeated per field is
// missing wherever it was not typed.
console.log('\nPart 10: placeholders are hints, not links');
ok(/\.cc-in::placeholder[^{]*\{[^}]*color: #8a8a8a/.test(css), 'every .cc-in placeholder is overridden to the neutral hint grey');
ok(/\.cc-pop input::placeholder/.test(css), 'the guard covers every input in a window, not one class at a time');
ok(/\.cc-in::placeholder[^{]*\{[^}]*opacity: 1/.test(css), 'opacity:1 as well, Firefox dimming placeholders on top of the colour');
const setjs = fs.readFileSync(path.join(SCRIPTS, 'settings.js'), 'utf8');
ok(/#cc-settings input::placeholder\{color:#8d8d8d/.test(setjs), 'and the settings panel guards every input, not just its search box');

console.log('\nPart 11: the dependency picker has an arrow and an explainer');
ok(/el\("input", "cc-in cc-dropin"\)/.test(src), 'the dependency field carries .cc-dropin');
ok(/lblInfo\(t\("dependsOn"\), t\("dependsOnInfo"\)\)/.test(src), 'and an (i), it being the one row in the window without an explainer');
ok(/dependsOnInfo: "/.test(src), 'dependsOnInfo exists');
const caret = /select\.cc-in, \.cc-in\.cc-dropin \{([\s\S]*?)\}/.exec(css);
ok(!!caret, 'the native select and the .cc-dropin field share one caret declaration');
if (caret) {
  ok(/%23cfcfcf/.test(caret[1]), 'drawn in the same #cfcfcf as .cc-pop .cc-dsel-trigger::after, so there is one arrow');
  ok(/width='8' height='5'/.test(caret[1]), 'and the same 8x5 geometry the trigger builds from borders');
  ok(/padding-right: 24px/.test(caret[1]), 'with room reserved so the value never runs under the glyph');
}
ok(/cc-dropin"\)\) \? "5px 24px 5px 8px"/.test(harden), 'hardenPop exempts it from the flat padding stamp, which would otherwise undo that room');

// Every element in the window sits 24px from its edge. The arithmetic differs by
// nesting: a row inside .cc-pop-body, .cc-pop-auto or .cc-pop-sub already has that
// wrapper's 14px margin and adds 10, while a block placed straight into the window
// carries all 24. Pinned as the shape of the fix, since making them all 14 like the
// card is what a later tidy-up would write back.
console.log('\nPart 12: one 24px side inset for the whole window');
ok(/\.cc-pop-row \{[^}]*padding: 8px 24px/.test(css), 'an unwrapped .cc-pop-row (the manage-toggle line) takes the full 24px itself');
ok(/\.cc-pop-body \.cc-pop-row, \.cc-pop-auto \.cc-pop-row \{ padding: 3px 10px !important/.test(css), 'a wrapped row keeps 10 and lets its wrapper margin supply the other 14');
ok(/\.cc-pop-body \{[^}]*margin: 10px 14px 6px/.test(css) && /\.cc-pop-auto \{[^}]*margin: 6px 14px/.test(css), 'both wrappers carry that 14px margin, the two halves of 24 having to agree');
ok(/\.cc-pop-head \{[^}]*padding: 10px 24px/.test(css), 'the head shares the column, so the ✕ sits on the same right edge as the toggle below it');
ok(/\.cc-pop-act \{[^}]*padding: 10px 24px 12px/.test(css), 'and so does the button row, where Speichern would otherwise stand 10px wider than the fields');
ok(/\.cc-pop-sech-lone \{[^}]*padding: 10px 10px 5px/.test(css), '"ZEITPLÄNE" takes 10 inside its .cc-pop-auto, 14 there landing at 28');
ok(/\.cc-sched-list \{[^}]*padding: 4px 10px 2px/.test(css), 'the schedule cards line up with the fields rather than sitting 4px right of them');
ok(/\.cc-btn-sm \{ margin: 4px 10px 6px/.test(css), 'and "+ Zeitplan" with them');
// hardenPop stamps the row padding inline with !important, which the sheet cannot beat.
ok(/closest\("\.cc-pop-body, \.cc-pop-auto, \.cc-pop-sub"\)/.test(harden), 'hardenPop asks whether the row is wrapped instead of stamping one number everywhere');
ok(/wrapped \? "3px 10px" : "3px 24px"/.test(harden), 'and stamps the matching half, a blanket 10 flattening the unwrapped row');
ok(/"padding", "10px 24px 18px"/.test(harden), 'the action row keeps its roomier bottom gap and joins the 24px column');
ok(/"6px 24px 0 24px"/.test(src), 'the plan window\'s own head stamp agrees, a hard 10px there pulling the ✕ out of line');

// "CC" is everywhere in this codebase as a source-code prefix, in cc- classes,
// CC_* constants, cc.* keys and --cc-* properties, and stays. Only string literals
// reach a user, so only those are scanned: a line-based grep would flag the class
// names and a blind replace would break the plugin.
console.log('\nPart 13: user-facing prose says "CannonadeCommand", not "CC"');
function proseStrings(source) {
  const BS = String.fromCharCode(92);
  const out = [];
  let i = 0, line = 1;
  while (i < source.length) {
    const c = source[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; continue; }
    if (c === '/' && source[i + 1] === '*') { i += 2; while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) { if (source[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c, at = line; i++; let buf = '';
      while (i < source.length) {
        if (source[i] === BS) { buf += source[i] + source[i + 1]; i += 2; continue; }
        if (source[i] === q) break;
        if (source[i] === '\n') { line++; if (q !== '`') break; }
        buf += source[i]; i++;
      }
      i++; out.push({ line: at, s: buf });
      continue;
    }
    i++;
  }
  return out;
}
// "CC" standing alone, or leading a hyphenated compound a user would read, such as
// "CC-Kopfbereich". The cc- class prefix is lower case, and CC_TRASH_SVG and its
// kind carry an underscore, so neither matches.
const BARE_CC = /(^|[^A-Za-z0-9_])CC(-[A-Za-zÄÖÜäöü]|[^A-Za-z0-9_-]|$)/;
[['docker.js', src], ['settings.js', setjs], ['header.js', fs.readFileSync(path.join(SCRIPTS, 'header.js'), 'utf8')],
 ['shares.js', fs.readFileSync(path.join(SCRIPTS, 'shares.js'), 'utf8')], ['vms.js', fs.readFileSync(path.join(SCRIPTS, 'vms.js'), 'utf8')],
 ['plugins.js', fs.readFileSync(path.join(SCRIPTS, 'plugins.js'), 'utf8')], ['cc-theme.js', theme]].forEach(([name, source]) => {
  const hits = proseStrings(source).filter(o => BARE_CC.test(o.s));
  ok(hits.length === 0, name + ' has no bare "CC" in any string a user can read'
    + (hits.length ? ': ' + hits.map(h => 'L' + h.line + ': …' + h.s.slice(Math.max(0, h.s.search(BARE_CC) - 24), h.s.search(BARE_CC) + 40) + '…').join(' | ') : ''));
});
ok(/CannonadeCommand startet sie zuerst/.test(src) && /CannonadeCommand starts them first/.test(src), '"Hängt ab von" names the product in full, in German and English');
ok(/bevor CannonadeCommand stoppt/.test(src) && /before CannonadeCommand stops it/.test(src), 'so does the idle-stop bubble, in both');
// The other half: the source-code prefix a blind find-and-replace would destroy.
ok(/cc-pop-lbl/.test(css) && /CC_VER/.test(src) && /"cc\.rainbow"/.test(src), 'the cc- class namespace, the CC_* constants and the cc.* keys stay as they are');

console.log('\n' + (fail ? 'FAILED ' + fail + ' of ' + (pass + fail) : 'OK  ' + pass + ' passed'));
process.exit(fail ? 1 : 0);
