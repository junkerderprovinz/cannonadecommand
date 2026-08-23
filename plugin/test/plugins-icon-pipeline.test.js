// DOM-shim regression test for the Plugins-tab icon pipeline (plugins.js).
//
// Mirrors icon-pipeline.test.js's / vms-icon-pipeline.test.js's harness pattern but pointed at
// plugins.js. This file pins the CONFIRMED staleness bug that is the strongest single explanation
// for the reported "I changed the global setting and the real tab doesn't show it" complaint,
// because it reproduces even under DEFAULT (adopt-on) settings, on a live value change — not only
// when an adopt toggle is off:
//
// plugIconInk() and paintRow() used to read `document.documentElement.classList.contains(
// "cc-plugins-iconbg")` — a DOM class that the SAME paint() invocation only (re)writes AFTER the
// row-paint loop that already consumed the stale value. On first page load the class does not
// exist yet (always reads as off); after a live settings change (cross-tab storage event, or the
// Settings page open in another tab) exactly one stale paint happens. The fix reads eff("iconbg")
// directly instead — this test asserts the DOM class is no longer consulted at all.
//
// Also pins: logoSize()'s cc.sgsize map matches docker.js's ccLogoSizes() / vms.js's
// vmLogoSizes(), and the double-tint fix (a glyph never gets both a direct colour and a filter).
//
// The REAL functions are pulled out of the shipped source, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const PLUGINS = process.argv[2] || path.join(DIR, 'plugins.js');

/* ── minimal DOM + storage shim ─────────────────────────────────────────────── */
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this.attrs = {}; this.dataset = {};
    this.style = {
      setProperty: (k, v) => { this._s = this._s || {}; this._s[k] = v; },
      removeProperty: (k) => { if (this._s) delete this._s[k]; },
      cssText: ''
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); const id = this.id || this.attrs.id; if (id) delete byId[id]; }
}
const byId = {};
const document = {
  createElement: t => new N(t),
  getElementById: id => byId[id] || null,
  documentElement: new N('html'),
  body: new N('body'),
};
document.body.appendChild = function (c) { N.prototype.appendChild.call(this, c); if (c.attrs.id || c.id) byId[c.id || c.attrs.id] = c; return c; };
global.document = document;

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
global.window = { localStorage: global.localStorage, CCTheme: null };

/* ── pull the REAL functions out of plugins.js ──────────────────────────── */
const src = fs.readFileSync(PLUGINS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in plugins.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const pluginsApi = new Function('document', 'localStorage', 'window',
  grabFn('ls') + '\n' + grabFn('eff') + '\n' + grabFn('idealText') + '\n' + grabFn('accent') + '\n' +
  grabFn('ccHex6') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' +
  grabFn('plugTintOn') + '\n' + grabFn('plugBgColor') + '\n' +
  grabFn('plugIconInk') + '\n' + grabFn('logoSize') + '\n' + grabFn('plugGlyphInkAndFilter') + '\n' +
  'return { eff: eff, plugTintOn: plugTintOn, plugBgColor: plugBgColor, plugIconInk: plugIconInk, logoSize: logoSize, plugGlyphInkAndFilter: plugGlyphInkAndFilter, idealText: idealText, accent: accent };'
)(document, global.localStorage, global.window);

/* ── tests ───────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const reset = () => { Object.keys(store).forEach(k => delete store[k]); document.documentElement.classList = new CL(); };

console.log('\nTHE KEY REGRESSION PIN: plugIconInk() must resolve from eff("iconbg"), never from the DOM class');
{
  reset();
  // Simulates BOTH real-world failure modes: first paint (class never set yet) and a live
  // cross-tab settings change (this tab's paint() has not run again yet to refresh the class).
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('cc.iconbg=1 with the DOM class left UNSET still resolves the ink', /^#[0-9a-f]{6}$/i.test(pluginsApi.plugIconInk(false)), pluginsApi.plugIconInk(false));
  ok('and it is the raw picked colour verbatim (v4.32.6 fix: the badge no longer overrides it with idealText())', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  reset();

  // Symmetric case: the class forcibly "on" (stale from a previous paint) but the setting is
  // actually OFF now — must NOT take the badge-mode branch just because the class says so.
  localStorage.setItem('cc.iconbg', '0'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  document.documentElement.classList.add('cc-plugins-iconbg');
  ok('cc.iconbg=0 with the DOM class forced ON still resolves the PLAIN picked colour, not the badge ink', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  reset();
}

console.log('\nHintergrund and Einfärben are INDEPENDENT (v4.32.5 fix): the badge alone must not force the tint on');
{
  reset();
  ok('nothing configured at all: no ink', pluginsApi.plugIconInk(false) === '');

  // the CONFIRMED bug: Logo-Hintergrund on, Einfärben never touched (no cc.icontint, no
  // cc.iconcolor) used to still tint every plugin icon via the accent fallback
  localStorage.setItem('cc.iconbg', '1');
  ok('background ON, Einfärben untouched, no colour picked ANYWHERE: still no ink', pluginsApi.plugIconInk(false) === '');

  localStorage.setItem('cc.icontint', '0');
  ok('background ON, Einfärben EXPLICITLY off: still no ink even with the badge showing', pluginsApi.plugIconInk(false) === '');

  localStorage.setItem('cc.icontint', '1');
  ok('background ON, Einfärben explicitly ON but still no colour ever picked: still no ink (no pick to lift)', pluginsApi.plugIconInk(false) === '');
  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('background ON, Einfärben ON, colour NOW picked: inks in that picked colour', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  reset();

  // pre-4.32.5 installs: only cc.iconbg + cc.iconcolor were ever set, and iconcolor's mere
  // presence WAS the tint's on-signal — plugTintOn()'s fallback keeps that reading intact.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('pre-existing install (no cc.icontint key at all): behaves exactly as it always did — inked', pluginsApi.plugTintOn() === true && pluginsApi.plugIconInk(false) !== '');
  reset();

  // CONFIRMED BUG (v4.32.6, fixed here): with both controls on and given DELIBERATELY different
  // colours, the icon's ink must be the TINT's own colour, never a contrast colour derived from
  // the (different) badge box colour — live-tested: tint #e5a00d rendered as plain white
  // (#ffffff) once the badge was also on, discarding the picked colour entirely.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#161616'); localStorage.setItem('cc.icontint', '0');
  ok('background colour applies even with Einfärben off (plugBgColor reads cc.iconbgcolor)', pluginsApi.plugBgColor() === '#161616');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('once both are on, the ink is the TINT colour, never a contrast colour derived from the (different) badge colour', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  ok('and the badge box itself is still exactly its own configured colour, unaffected by the tint pick', pluginsApi.plugBgColor() === '#161616', pluginsApi.plugBgColor());
  reset();
}

console.log('\nlogoSize(): the SAME cc.sgsize map as docker.js\'s ccLogoSizes() / vms.js\'s vmLogoSizes()');
{
  reset();
  localStorage.setItem('cc.sgsize', 's'); ok('s -> 48px', pluginsApi.logoSize() === '48px');
  localStorage.setItem('cc.sgsize', 'm'); ok('m -> 62px', pluginsApi.logoSize() === '62px');
  localStorage.setItem('cc.sgsize', 'l'); ok('l -> 76px', pluginsApi.logoSize() === '76px');
  localStorage.removeItem('cc.sgsize'); ok('unset defaults to m -> 62px', pluginsApi.logoSize() === '62px');
  localStorage.setItem('cc.sgsize', 'nonsense'); ok('a garbage value falls back to 62px', pluginsApi.logoSize() === '62px');
  reset();
}

console.log('\nA glyph never ends up with BOTH a direct colour AND the luminance-tint filter (double-tint regression pin)');
{
  const w = 'url(#cc-plug-tint)';
  ok('native treat: no colour, filter forced to "none"', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'native' }, false, '#2f6feb', '#e5a00d', w); return !r.color && r.filter === 'none'; })());
  // v4.32.5: ibgOn/ibgBg are no longer consulted directly — the caller already resolves the
  // badge-contrast ink into pInk before calling, so ibgOn=true changes nothing here by itself;
  // this is now identical in shape to the next assertion (pInk truthy always wins verbatim).
  ok('Logo-Hintergrund on, forced "tint": colour is the resolved ink verbatim (caller already resolved it), filter is "none"', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '#e5a00d', w); return r.color === '#e5a00d' && r.filter === 'none'; })());
  ok('an ink colour is available, forced "tint": colour is set, filter is "none"', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '#e5a00d', w); return r.color === '#e5a00d' && r.filter === 'none'; })());
  ok('no ink at all: filter is the only thing that can carry the treatment, colour stays empty', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '', w); return !r.color && r.filter === w; })());
  // v4.32.5 regression pin: the badge alone must NEVER force a colour onto a glyph — `pInk` (the
  // 4th arg) already answers "" whenever Einfärben is off, badge or not, so ibgOn must not be
  // consulted on its own any more.
  ok('Logo-Hintergrund on but NO ink (Einfärben off): no colour is forced onto the glyph', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '', w); return !r.color; })());
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
