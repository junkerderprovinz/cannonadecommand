// Builds settings.js's logoToggles() against a DOM shim, for the two things the
// string-slice checks in adopt-rainbow-ui.test.js cannot see: that io.hideAdoptRow
// keeps the adopt row out of the built tree rather than hiding it with CSS, and
// that while the master toggle adopts, the Hintergrund and Icons switches are
// greyed and inert, not only their colour pickers, and come back the moment
// adopting stops. The second one is driven through a synthetic click, checking
// whether the wired setter fired.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const SETTINGS = process.argv[2] || path.join(DIR, 'settings.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// The DOM shim from icon-pipeline.test.js.
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

// Pull the builders out of settings.js.
const src = fs.readFileSync(SETTINGS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in settings.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const build = new Function('document', 'window',
  'var de = false;\n' +   // the English labels, so the assertions can search for ASCII text
  grabFn('el') + '\n' + grabFn('T') + '\n' + grabFn('infoIcon') + '\n' + grabFn('normHex') + '\n' +
  grabFn('hexToHsv') + '\n' + grabFn('hsvToHex') + '\n' + grabFn('inlinePicker') + '\n' + grabFn('toggle') + '\n' +
  grabFn('logoToggles') + '\n' +
  'return { logoToggles: logoToggles };'
)(document, {});

// An in-memory io in the shape the real call sites pass.
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

console.log('\nio.hideAdoptRow keeps the adopt row out of the built DOM');
{
  const globalInto = document.createElement('div');
  build.logoToggles(globalInto, makeIo());
  ok('the global card, without hideAdoptRow, carries the adopt label', globalInto.textContent.indexOf('Adopt badge settings') >= 0, globalInto.textContent);

  const areaInto = document.createElement('div');
  build.logoToggles(areaInto, makeIo({ hideAdoptRow: true }));
  ok('an area card, with hideAdoptRow, has no adopt label in its tree', areaInto.textContent.indexOf('Adopt badge settings') < 0, areaInto.textContent);
  ok('and the area card still builds its own Hintergrund and Icons rows', areaInto.children.length > 0 && areaInto.textContent.indexOf('Background') >= 0);
}

console.log('\nThe Hintergrund and Icons switches grey out and refuse clicks while adopting');
{
  const into = document.createElement('div');
  const io = makeIo();
  const h = build.logoToggles(into, io);

  ok('not adopting: the Hintergrund switch is enabled', !h.bgToggle.classList.contains('cc-set-toggle-disabled'));
  ok('not adopting: the Icons switch is enabled', !h.tintToggle.classList.contains('cc-set-toggle-disabled'));
  h.bgToggle.listeners.click[0]();
  ok('not adopting: clicking the Hintergrund switch flips it', io._state.bgCalls === 1, io._state.bgCalls);

  io._state.adopt = true; // as if the master row, hidden on this card, had been used elsewhere
  h.sync();
  ok('adopting: the Hintergrund switch is disabled', h.bgToggle.classList.contains('cc-set-toggle-disabled'));
  ok('adopting: the Icons switch is disabled too', h.tintToggle.classList.contains('cc-set-toggle-disabled'));
  h.bgToggle.listeners.click[0]();
  h.tintToggle.listeners.click[0]();
  ok('adopting: clicking the Hintergrund switch does nothing', io._state.bgCalls === 1, io._state.bgCalls);
  ok('adopting: clicking the Icons switch does nothing', io._state.tintCalls === 0, io._state.tintCalls);

  io._state.adopt = false;
  h.sync();
  ok('adopting off again: the Hintergrund switch is enabled', !h.bgToggle.classList.contains('cc-set-toggle-disabled'));
  ok('adopting off again: the Icons switch is enabled', !h.tintToggle.classList.contains('cc-set-toggle-disabled'));
  h.tintToggle.listeners.click[0]();
  ok('adopting off again: clicking the Icons switch flips it', io._state.tintCalls === 1, io._state.tintCalls);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
