// DOM-shim regression test for GlimStone Rule 21 — a CLOSED select field is operable with
// the scroll wheel (cc-theme.js).
//
// Why this file exists: a native <select> lets you hover the collapsed field and wheel through
// its values. CC replaces native selects wherever the host UI puts one (Rule 18) and every one
// of those replacements dropped that convenience, i.e. the replacement was worse than the thing
// it replaced. Rule 21 makes it a house law, and it says "every variant, not just the one
// reported" — so the handler is ONE document-level listener in the only file that loads on every
// page, driven by the shared family selectors. The things that can quietly break it are all
// pinned here:
//   · it must not fire when the panel is OPEN (that panel's own list scroll is the user's)
//   · it must not fire when the pointer is not over a widget (the page must still scroll)
//   · it must only preventDefault when a value actually CHANGED, or a wheel over a dead field
//     swallows the gesture and the page freezes under the cursor
//   · it must clamp at both ends rather than wrap, like the panels' own arrow keys
//   · it must skip disabled options
//   · it must go through the SAME commit path a click uses: selectedIndex, a bubbling change,
//     then the family's own repaint
//
// The REAL handler is pulled out of the shipped source, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const THEME = process.argv[2] || path.join(DIR, 'cc-theme.js');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('  PASS  ' + m)) : (fail++, console.log('  FAIL  ' + m + (extra ? '  -> ' + extra : ''))); };
const eq = (a, b, m) => ok(a === b, m + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

/* ── minimal DOM shim ───────────────────────────────────────────────────────── */
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const w = f === undefined ? !this.s.has(c) : !!f; w ? this.s.add(c) : this.s.delete(c); return w; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._txt = ''; this.attrs = {}; this.listeners = {};
    this.options = []; this.selectedIndex = -1; this.disabled = false; this.multiple = false;
    this._style = {};
    this.style = { setProperty: (k, v) => { this._style[k] = v; }, removeProperty: k => { delete this._style[k]; }, cssText: '' };
  }
  get className() { return [...this.classList.s].join(' '); }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  dispatchEvent(e) { let n = this; while (n) { (n.listeners[e.type] || []).forEach(fn => fn(e)); n = n.parentNode; } return true; }  // bubbles
  // "a, b, c" selector lists of plain class selectors — all this code uses
  matchesSel(sel) { return String(sel).split(',').map(s => s.trim()).filter(Boolean).some(p => p.startsWith('.') ? this.classList.contains(p.slice(1)) : this.tagName === p.toUpperCase()); }
  closest(sel) { let n = this; while (n) { if (n.matchesSel && n.matchesSel(sel)) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) { const out = []; const walk = n => n.children.forEach(c => { if (c.matchesSel(sel)) out.push(c); walk(c); }); walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
const store = {};
const docListeners = {};
global.document = {
  createElement: t => new N(t),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: new N('html'),
  body: new N('body'),
  cookie: '',
  addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); }
};
global.window = {
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
  },
  addEventListener: () => {},
  location: { pathname: '/Docker' }
};
global.window.window = global.window;
global.location = global.window.location;   // the cross-origin sync block reads it at load time
global.localStorage = global.window.localStorage;
global.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve(null), text: () => Promise.resolve('') });
global.Event = class { constructor(t, o) { this.type = t; this.bubbles = !!(o && o.bubbles); } };
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.Image = class { set src(_) {} };

require(THEME);
const CCTheme = global.window.CCTheme;
ok(!!CCTheme, 'cc-theme.js loaded and published window.CCTheme');
ok(typeof CCTheme.nextSelIndex === 'function', 'the step function is exported for this test to reach');
ok(typeof CCTheme.registerSelectSync === 'function', 'each family can register its own repaint');
ok(docListeners.wheel && docListeners.wheel.length === 1, 'exactly ONE document-level wheel listener, not one per family');
const onWheel = (docListeners.wheel || [])[0];

/* ── build one widget of a family, in the shape all three of them share ─────── */
function widget(cls, labels, selIdx, opts) {
  opts = opts || {};
  const wrap = new N('span'); wrap.className = cls;
  const sel = new N('select');
  sel.options = labels.map((t, i) => { const o = new N('option'); o.text = t; o.value = t; o.disabled = (opts.disabledIdx || []).indexOf(i) >= 0; return o; });
  // A real <select> keeps option.selected in lock-step with selectedIndex, and the widgets'
  // repaint reads option.selected — so the shim has to do it too, or the test would pass on a
  // sync that never marks a chip.
  let _si = -1;
  Object.defineProperty(sel, 'selectedIndex', {
    get() { return _si; },
    set(v) { _si = v; sel.options.forEach((o, i) => { o.selected = i === v; }); }
  });
  sel.selectedIndex = selIdx;
  wrap.appendChild(sel);
  const trig = new N('span'); trig.className = cls + '-trigger'; trig.textContent = labels[selIdx] || '';
  wrap.appendChild(trig);
  const panel = new N('div'); panel.className = cls + '-panel';
  labels.forEach((t, i) => { const chip = new N('div'); chip.className = cls + '-opt'; chip.textContent = t; chip.setAttribute('data-i', String(i)); panel.appendChild(chip); });
  wrap.appendChild(panel);
  document.body.appendChild(wrap);
  return { wrap, sel, trig, panel };
}
function wheel(target, dy) {
  let prevented = false;
  onWheel({ target, deltaY: dy, deltaX: 0, ctrlKey: false, metaKey: false, altKey: false, preventDefault() { prevented = true; } });
  return prevented;
}

console.log('\nStepping a closed field, in every family CC has');
['cc-tsel', 'cc-dsel', 'cc-sel'].forEach(fam => {
  const w = widget(fam, ['Automatisch', 'Natives Icon', 'Ink-Flatten', 'Luminanz-Tint'], 0);
  let changes = 0;
  w.sel.addEventListener('change', () => { changes++; });
  ok(wheel(w.trig, 120), fam + ': a wheel down over the closed field is handled (preventDefault)');
  eq(w.sel.selectedIndex, 1, fam + ': it stepped to the next option');
  eq(changes, 1, fam + ': it dispatched exactly one bubbling change (the host onchange chain fires)');
  eq(w.trig.textContent, 'Natives Icon', fam + ': the trigger repainted, exactly as a click would leave it');
  eq(w.panel.querySelectorAll('.' + fam + '-opt')[1].classList.contains('is-selected'), true, fam + ': the chip carries is-selected');
  wheel(w.trig, -120);
  eq(w.sel.selectedIndex, 0, fam + ': a wheel up steps back');
  eq(w.wrap.classList.contains('cc-open'), false, fam + ': the panel never opened');
});

console.log('\nIt clamps, it does not wrap');
{
  const w = widget('cc-dsel', ['a', 'b', 'c'], 0);
  ok(!wheel(w.trig, -120), 'at the FIRST option a wheel up is NOT handled — the page scrolls instead');
  eq(w.sel.selectedIndex, 0, 'and the value did not wrap round to the last option');
  wheel(w.trig, 120); wheel(w.trig, 120);
  eq(w.sel.selectedIndex, 2, 'stepping down reaches the last option');
  ok(!wheel(w.trig, 120), 'at the LAST option a wheel down is NOT handled either');
  eq(w.sel.selectedIndex, 2, 'and the value did not wrap round to the first');
}

console.log('\nWhat it must keep its hands off');
{
  const open = widget('cc-dsel', ['a', 'b', 'c'], 0);
  open.wrap.classList.add('cc-open');
  ok(!wheel(open.trig, 120), 'an OPEN widget is not stepped (the user is scrolling its list)');
  eq(open.sel.selectedIndex, 0, 'and its value is untouched');
  ok(!wheel(open.panel.children[0], 120), 'a wheel inside a panel scrolls the panel, never steps the field');

  const closed = widget('cc-dsel', ['a', 'b', 'c'], 0);
  ok(!wheel(closed.panel.children[1], 120), 'even on a CLOSED widget, a wheel over the panel subtree is left alone');

  const plain = new N('div'); document.body.appendChild(plain);
  ok(!wheel(plain, 120), 'a wheel anywhere else on the page is not touched at all');

  const drop = new N('div'); drop.className = 'cc-drop'; document.body.appendChild(drop);
  const it = new N('div'); it.className = 'cc-drop-it'; drop.appendChild(it);
  ok(!wheel(it, 120), 'the Startplan multi-select (.cc-drop) is deliberately out of scope — a comma list has no "next value"');

  const dis = widget('cc-dsel', ['a', 'b'], 0);
  dis.wrap.classList.add('cc-dsel-disabled');
  ok(!wheel(dis.trig, 120), 'a disabled widget is inert');
  eq(dis.sel.selectedIndex, 0, 'and keeps its value');

  const one = widget('cc-dsel', ['only'], 0);
  ok(!wheel(one.trig, 120), 'a one-option field is a placeholder, not a choice — the page scrolls');

  const zoom = widget('cc-dsel', ['a', 'b'], 0);
  let prevented = false;
  onWheel({ target: zoom.trig, deltaY: 120, deltaX: 0, ctrlKey: true, metaKey: false, altKey: false, preventDefault() { prevented = true; } });
  ok(!prevented && zoom.sel.selectedIndex === 0, 'ctrl+wheel stays the browser zoom gesture');
}

console.log('\nDisabled options are skipped, never landed on');
{
  const w = widget('cc-dsel', ['a', 'b', 'c', 'd'], 0, { disabledIdx: [1, 2] });
  ok(wheel(w.trig, 120), 'a step over two disabled options is still a real step');
  eq(w.sel.selectedIndex, 3, 'it landed on the next SELECTABLE option');
}

console.log('\nThe pure step function itself');
{
  const mk = (n, sel, dis) => ({ options: Array.from({ length: n }, (_, i) => ({ disabled: (dis || []).indexOf(i) >= 0 })), selectedIndex: sel });
  eq(CCTheme.nextSelIndex(mk(4, 0), 1), 1, 'forward from the first');
  eq(CCTheme.nextSelIndex(mk(4, 3), 1), 3, 'forward from the last clamps (same index = no change)');
  eq(CCTheme.nextSelIndex(mk(4, 0), -1), 0, 'backward from the first clamps');
  eq(CCTheme.nextSelIndex(mk(1, 0), 1), 0, 'a single option cannot step');
  eq(CCTheme.nextSelIndex(mk(4, -1), 1), 0, 'nothing selected + forward = the first');
  eq(CCTheme.nextSelIndex(mk(4, -1), -1), 3, 'nothing selected + backward = the last');
  eq(CCTheme.nextSelIndex(mk(4, 0, [1, 2]), 1), 3, 'disabled options are skipped');
  eq(CCTheme.nextSelIndex(mk(3, 0, [1, 2]), 1), 0, 'only disabled options ahead = no change');
}

console.log('\nEach family repaints with ITS OWN sync, not a generic mirror');
{
  let called = null;
  CCTheme.registerSelectSync((sel, wrap) => { if (!wrap.classList.contains('cc-tsel')) return false; called = sel; return true; });
  const t = widget('cc-tsel', ['x', 'y'], 0);
  t.trig.textContent = 'x';
  wheel(t.trig, 120);
  ok(called === t.sel, 'the registered sync ran for its own family');
  const d = widget('cc-dsel', ['x', 'y'], 0);
  called = null;
  wheel(d.trig, 120);
  ok(called === null, 'and was correctly declined for a family that is not its own');
  eq(d.trig.textContent, 'y', 'the built-in mirror painted that one instead — no widget is left unpainted');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
