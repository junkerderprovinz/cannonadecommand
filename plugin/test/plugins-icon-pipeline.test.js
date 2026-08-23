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
// RB_PAL/RB_OFFSET stand in for plugins.js's module-level rainbow-palette vars (normally
// window.CCTheme.RB / a persisted random seed) — pinned to the shipped default palette and
// offset 0 so colorFor(i) is deterministic here.
const pluginsApi = new Function('document', 'localStorage', 'window',
  'var RB_PAL = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  grabFn('ls') + '\n' + grabFn('eff') + '\n' + grabFn('iconBgAdoptsP') + '\n' + grabFn('idealText') + '\n' + grabFn('accent') + '\n' +
  grabFn('pal') + '\n' + grabFn('colorFor') + '\n' +
  grabFn('ccHex6') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' +
  grabFn('plugTintOn') + '\n' + grabFn('plugBgColor') + '\n' +
  grabFn('plugIconInk') + '\n' + grabFn('logoSize') + '\n' + grabFn('plugGlyphInkAndFilter') + '\n' +
  'return { eff: eff, plugTintOn: plugTintOn, plugBgColor: plugBgColor, plugIconInk: plugIconInk, logoSize: logoSize, plugGlyphInkAndFilter: plugGlyphInkAndFilter, idealText: idealText, accent: accent, colorFor: colorFor };'
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

console.log('\ncc.iconbgrainbow (v4.33.1): Badge-Einstellungen übernehmen — ONE master toggle, regression pin');
{
  // v4.33.0 shipped TWO independent adopt keys; redesigned within minutes into ONE shared key
  // (mirrors docker.js — see icon-pipeline.test.js for the full writeup of why).
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('adopt OFF (default): plugBgColor() is the independently picked background colour', pluginsApi.plugBgColor() === '#e5a00d', pluginsApi.plugBgColor());
  ok('adopt OFF (default): plugIconInk() is the independently picked tint colour', pluginsApi.plugIconInk(false) === '#00aa00', pluginsApi.plugIconInk(false));

  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('adopting: plugBgColor() answers "" so the caller never stamps --cc-iconbg-color, letting docker.css\'s var() chain fall through to --cc-rb-c/--cc-accent — the SAME source every generic plugin badge already uses', pluginsApi.plugBgColor() === '', JSON.stringify(pluginsApi.plugBgColor()));

  localStorage.setItem('cc.rainbow', '0');
  ok('adopting, Rainbow OFF: plugIconInk() is the automatic contrast colour for the plain accent (idealText of colorFor(5)) — not the own picked colour', pluginsApi.plugIconInk(false) === pluginsApi.idealText(pluginsApi.colorFor(5)), pluginsApi.plugIconInk(false));

  localStorage.setItem('cc.rainbow', '1');
  ok('adopting, Rainbow ON: plugIconInk() is the automatic contrast colour for the SAME colorFor(5) a generic plugin badge resolves to, not a frozen accent snapshot', pluginsApi.plugIconInk(false) === pluginsApi.idealText(pluginsApi.colorFor(5)), pluginsApi.plugIconInk(false) + ' vs idealText(' + pluginsApi.colorFor(5) + ')');
  ok('and that is NOT the own picked colour either', pluginsApi.plugIconInk(false) !== '#00aa00');

  localStorage.setItem('cc.icontint', '0');
  ok('adopting: the ink is STILL the automatic contrast colour even with Einfärben explicitly OFF — no longer dependent on Einfärben\'s own on/off at all', pluginsApi.plugIconInk(false) === pluginsApi.idealText(pluginsApi.colorFor(5)), pluginsApi.plugIconInk(false));
  localStorage.setItem('cc.icontint', '1');

  localStorage.setItem('cc.iconbgrainbow', '0');
  ok('turning the master toggle back off restores the own picked colour immediately', pluginsApi.plugIconInk(false) === '#00aa00', pluginsApi.plugIconInk(false));
  reset();
}

console.log('\nPER-ROW contrast ink (v4.33.2 fix): the exact regression an independent reviewer found in v4.33.1');
{
  // THE CONFIRMED BUG: plugIconInk() under the master adopt toggle answers ONE representative
  // colour for the WHOLE page (idealText(colorFor(5)) — always palette slot 5), even though
  // paintRow() already stamps a genuinely per-row rotating colour via colorFor(idx) (the SAME
  // value it uses for --cc-rb-c/--cc-rb-ct on every row, one row-index-idx pair below).
  // Slot 2 (#eab308, yellow) is the ONE slot in the default 8-colour palette needing BLACK ink
  // instead of slot 5's white — whichever row's OWN index landed there got illegible
  // white-on-yellow. The fix (paintRow(), plugins.js): the per-row ink is idealText(colorFor(idx))
  // — this row's OWN index — reused verbatim as `rowInk`, never plugIconInk()'s fixed slot 5.
  reset();
  localStorage.setItem('cc.iconbgrainbow', '1');
  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('slot 5 (colorFor(5), the representative slot plugIconInk() is fixed to) really is #2f6feb, needing WHITE ink', pluginsApi.colorFor(5) === '#2f6feb' && pluginsApi.idealText(pluginsApi.colorFor(5)) === '#fff');
  ok('slot 2 (colorFor(2)) really is the yellow #eab308, needing BLACK ink', pluginsApi.colorFor(2) === '#eab308' && pluginsApi.idealText(pluginsApi.colorFor(2)) === '#161616');

  // THE REGRESSION PIN: a plugin row at index 2 (whose OWN rotated colour — the SAME colorFor(idx)
  // paintRow() stamps as --cc-rb-c on that exact row — is the yellow slot) must resolve to BLACK
  // ink, not the fixed page-wide plugIconInk() answer (white, slot 5).
  var rowInkAtIdx2 = pluginsApi.idealText(pluginsApi.colorFor(2));
  ok('THE REGRESSION PIN: row index 2 (its own colorFor(2) is yellow) resolves to BLACK ink', rowInkAtIdx2 === '#161616', rowInkAtIdx2);
  ok('…which genuinely DIFFERS from the old page-wide plugIconInk() answer for the SAME settings (the confirmed bug)', rowInkAtIdx2 !== pluginsApi.plugIconInk(false), rowInkAtIdx2 + ' vs ' + pluginsApi.plugIconInk(false));

  // A row that DOES land on the representative slot still gets white — the fix does not break
  // the (already-correct-by-coincidence) majority case.
  var rowInkAtIdx5 = pluginsApi.idealText(pluginsApi.colorFor(5));
  ok('row index 5 (its own colorFor(5) IS the representative slot) still gets white ink', rowInkAtIdx5 === '#fff', rowInkAtIdx5);

  // Rainbow OFF: colorFor(i) is the SAME flat accent for every index, so every row genuinely IS
  // one flat colour — the uniform plugIconInk() answer is correct in that mode, not a bug.
  localStorage.setItem('cc.rainbow', '0');
  ok('Rainbow OFF: colorFor(2) collapses to the SAME flat accent as colorFor(5) — no per-row divergence to lose', pluginsApi.colorFor(2) === pluginsApi.colorFor(5));
  ok('…so the per-row ink and plugIconInk()\'s uniform answer agree', pluginsApi.idealText(pluginsApi.colorFor(2)) === pluginsApi.plugIconInk(false));
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
