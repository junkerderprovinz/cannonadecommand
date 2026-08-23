// Real (if minimal) DOM-harness regression test for v4.35.0 items 4 + 5 in settings.js's
// logoToggles() — the two things adopt-rainbow-ui.test.js's pure string-slice checks cannot see:
//
//  · Item 5: with io.hideAdoptRow set, the adopt row/switch must be GENUINELY ABSENT from the
//    built DOM (not merely hidden via CSS) — proven here by building the exact same card twice,
//    once for the global call site's shape (no hideAdoptRow) and once for an area card's shape
//    (hideAdoptRow: true), and checking the rendered tree for the adopt label text.
//  · Item 4: with the master toggle adopting, the Hintergrund/Icons SWITCHES themselves (not just
//    their colour pickers) must be genuinely disabled — greyed AND inert — and un-disabled the
//    instant adopting turns back off. Proven by driving the real toggle()/logoToggles() functions
//    through a synthetic click and checking whether the wired setter actually fired.
//
// The REAL functions are pulled out of the shipped source, never re-typed (grabFn, same technique
// icon-pipeline.test.js uses) — this only supplies the minimal DOM shim they need to run headless.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const SETTINGS = process.argv[2] || path.join(DIR, 'settings.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

/* ── minimal DOM shim (same shape as icon-pipeline.test.js's) ─────────────────────────────── */
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.listeners = {};
    this.dataset = {};
    this.style = { setProperty: () => {}, removeProperty: () => {}, cssText: '' };
  }
  get className() { return [this._cls, ...this.classList.s].filter(Boolean).join(' '); }
  set className(v) { this._cls = ''; this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const document = { createElement: t => new N(t), addEventListener: () => {}, removeEventListener: () => {} };

/* ── pull the REAL builders out of settings.js ─────────────────────────────────────────────── */
const src = fs.readFileSync(SETTINGS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in settings.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const build = new Function('document', 'window',
  'var de = false;\n' +   // English label pair, so the assertions below can search for stable ASCII text
  grabFn('el') + '\n' + grabFn('T') + '\n' + grabFn('infoIcon') + '\n' + grabFn('normHex') + '\n' +
  grabFn('hexToHsv') + '\n' + grabFn('hsvToHex') + '\n' + grabFn('inlinePicker') + '\n' + grabFn('toggle') + '\n' +
  grabFn('logoToggles') + '\n' +
  'return { logoToggles: logoToggles };'
)(document, {});

/* ── a tiny in-memory io, faithful to the real call sites' shape ──────────────────────────── */
function makeIo(extra) {
  const state = { bg: false, bgColor: '#e5a00d', tint: false, color: '#00aa00', adopt: false, bgCalls: 0, tintCalls: 0 };
  return Object.assign({
    getBg: () => state.bg, setBg: v => { state.bg = v; state.bgCalls++; },
    getBgColor: () => state.bgColor, setBgColor: v => { state.bgColor = v; },
    getTint: () => state.tint, setTint: v => { state.tint = v; state.tintCalls++; },
    getColor: () => state.color, setColor: v => { state.color = v; },
    getAdopt: () => state.adopt, setAdopt: v => { state.adopt = v; },
    getAccent: () => '#2f6feb', onChange: () => {},
  }, extra, { _state: state });
}

console.log('\nItem 5: the adopt row is GENUINELY absent from the DOM when io.hideAdoptRow is set — present when it is not');
{
  const globalInto = document.createElement('div');
  build.logoToggles(globalInto, makeIo());
  ok('global-card shape (no hideAdoptRow): the adopt label text IS present in the built tree', globalInto.textContent.indexOf('Adopt badge settings') >= 0, globalInto.textContent);

  const areaInto = document.createElement('div');
  build.logoToggles(areaInto, makeIo({ hideAdoptRow: true }));
  ok('area-card shape (hideAdoptRow: true): the adopt label text is ABSENT from the built tree', areaInto.textContent.indexOf('Adopt badge settings') < 0, areaInto.textContent);
  ok('…and the area card still built its OWN Hintergrund/Icons rows (nothing else was skipped)', areaInto.children.length > 0 && areaInto.textContent.indexOf('Background') >= 0);
}

console.log('\nItem 4: the Hintergrund/Icons SWITCHES themselves grey out and refuse clicks while adopting, and recover the instant adopting turns back off');
{
  const into = document.createElement('div');
  const io = makeIo();
  const h = build.logoToggles(into, io);

  ok('adopt OFF (default): the Hintergrund switch is NOT disabled', !h.bgToggle.classList.contains('cc-set-toggle-disabled'));
  ok('adopt OFF (default): the Icons switch is NOT disabled', !h.tintToggle.classList.contains('cc-set-toggle-disabled'));
  h.bgToggle.listeners.click[0]();
  ok('adopt OFF: clicking the Hintergrund switch DOES flip it (setBg fires)', io._state.bgCalls === 1, io._state.bgCalls);

  io._state.adopt = true; // flip the master toggle's underlying storage, as if the (now-hidden-here, but real elsewhere) row had been used
  h.sync();
  ok('adopt ON: the Hintergrund switch IS disabled (item 4 — this was the exact gap: only the colour picker used to grey out)', h.bgToggle.classList.contains('cc-set-toggle-disabled'));
  ok('adopt ON: the Icons switch IS disabled too', h.tintToggle.classList.contains('cc-set-toggle-disabled'));
  h.bgToggle.listeners.click[0]();
  h.tintToggle.listeners.click[0]();
  ok('adopt ON: clicking the disabled Hintergrund switch does NOTHING (setBg does not fire again)', io._state.bgCalls === 1, io._state.bgCalls);
  ok('adopt ON: clicking the disabled Icons switch does NOTHING (setTint never fires)', io._state.tintCalls === 0, io._state.tintCalls);

  io._state.adopt = false;
  h.sync();
  ok('adopt OFF again: the Hintergrund switch is un-disabled', !h.bgToggle.classList.contains('cc-set-toggle-disabled'));
  ok('adopt OFF again: the Icons switch is un-disabled', !h.tintToggle.classList.contains('cc-set-toggle-disabled'));
  h.tintToggle.listeners.click[0]();
  ok('adopt OFF again: clicking the Icons switch now DOES flip it (setTint fires)', io._state.tintCalls === 1, io._state.tintCalls);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
