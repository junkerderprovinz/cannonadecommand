// DOM-shim regression test for the VMs-tab icon pipeline (vms.js).
//
// Mirrors plugin/test/icon-pipeline.test.js's exact harness pattern (grabFn source-slicing,
// the same minimal DOM + localStorage shim) but pointed at vms.js. This file pins THREE things:
//
//  1. effK() adopt-gating for iconcolor/iconbg/iconstrength under cc.stylevms on/off. VMs was
//     independently confirmed to already get this right (unlike docker.js's bypass bug) — this
//     is a regression pin so the effK()-dedup cleanup (lines 74/86 used to re-type the adopt-gate
//     expression instead of calling the already-declared effK()) can never silently reintroduce
//     a divergence.
//  2. The cc.sgsize -> [--cc-logo-img, --cc-logo-box] map is the SAME one used by docker.js's
//     ccLogoSizes() / plugins.js's logoSize(), so the three copies can't silently drift again.
//  3. A glyph never ends up with both a direct `color` and a non-empty tint `filter` at once —
//     the double-tint fix (forced "tint" mode used to re-process an already-inked glyph).
//
// The REAL functions are pulled out of the shipped source, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const VMS = process.argv[2] || path.join(DIR, 'vms.js');

/* ── minimal DOM + storage shim (verbatim copy of icon-pipeline.test.js's) ─────────────────── */
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this._cls = ''; this._txt = ''; this.attrs = {}; this.dataset = {};
    this.style = {
      _s: {},
      setProperty: function (k, v) { this._s[k] = v; },
      removeProperty: function (k) { delete this._s[k]; },
      cssText: ''
    };
  }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); const id = this.id || this.attrs.id; if (id) delete byId[id]; }
}
const byId = {};
const document = {
  createElement: t => new N(t),
  getElementById: id => byId[id] || null,
  querySelectorAll: () => [],
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

/* ── pull the REAL functions out of vms.js ──────────────────────────────── */
const src = fs.readFileSync(VMS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in vms.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// RB_PAL/RB_OFFSET stand in for vms.js's module-level rainbow-palette vars (normally
// window.CCTheme.RB / a persisted random seed) — pinned to the shipped default palette and
// offset 0 so vmRbColor(i)/vmAdoptTint() are deterministic here.
const vmsApi = new Function('document', 'localStorage', 'window',
  'var dead = false;\n' +
  'var RB_PAL = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  grabFn('ls') + '\n' + grabFn('vmTintOff') + '\n' + grabFn('effK') + '\n' + grabFn('ccIdeal') + '\n' + grabFn('ccAccent') + '\n' +
  grabFn('ccHex6') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' +
  grabFn('vmPalActive') + '\n' + grabFn('vmRbColor') + '\n' + grabFn('vmAdoptTint') + '\n' +
  grabFn('vmTintOn') + '\n' + grabFn('vmBgColor') + '\n' + grabFn('vmIconInk') + '\n' +
  grabFn('ensureTintFilter') + '\n' + grabFn('vmLogoSizes') + '\n' + grabFn('glyphInkAndFilter') + '\n' +
  'return { effK: effK, vmTintOn: vmTintOn, vmBgColor: vmBgColor, vmIconInk: vmIconInk, ensureTintFilter: ensureTintFilter, vmLogoSizes: vmLogoSizes, glyphInkAndFilter: glyphInkAndFilter, ccIdeal: ccIdeal, ccAccent: ccAccent, vmRbColor: vmRbColor, vmAdoptTint: vmAdoptTint };'
)(document, global.localStorage, global.window);

/* ── tests ───────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

console.log('\neffK() adopt-gating for iconcolor/iconbg/iconstrength (regression pin — VMs was already correct here)');
{
  reset();
  localStorage.setItem('cc.iconcolor', '#e5a00d'); localStorage.setItem('cc.iconbg', '0'); localStorage.setItem('cc.iconstrength', '100');
  localStorage.setItem('ccv.iconcolor', '#00aa00'); localStorage.setItem('ccv.iconbg', '1'); localStorage.setItem('ccv.iconstrength', '40');

  ok('adopt ON (cc.stylevms unset): vmIconInk() follows the GLOBAL colour', vmsApi.vmIconInk(false) === '#e5a00d', vmsApi.vmIconInk(false));
  vmsApi.ensureTintFilter();
  const sigOn = document.getElementById('cc-vm-tint-svg') && document.getElementById('cc-vm-tint-svg').dataset.sig;

  localStorage.setItem('cc.stylevms', '0');
  ok('adopt OFF: vmIconInk() now follows VM-LOCAL ccv.iconbg (badge-mode ink), not the global colour', vmsApi.vmIconInk(false) !== '#e5a00d', vmsApi.vmIconInk(false));
  vmsApi.ensureTintFilter();
  const sigOff = document.getElementById('cc-vm-tint-svg') && document.getElementById('cc-vm-tint-svg').dataset.sig;
  ok('and the tint STRENGTH differs between the two toggle states too (ccv.iconstrength=40 vs cc.iconstrength=100)', sigOff !== sigOn, sigOn + ' vs ' + sigOff);
  reset();
}

console.log('\nHintergrund and Einfärben are INDEPENDENT (v4.32.5 fix): the badge alone must not force the tint on');
{
  reset();
  ok('nothing configured at all: no ink', vmsApi.vmIconInk(false) === '');

  // the CONFIRMED bug: Logo-Hintergrund on, Einfärben never touched (no cc.icontint, no
  // cc.iconcolor) used to still tint every VM icon via the accent fallback
  localStorage.setItem('cc.iconbg', '1');
  ok('background ON, Einfärben untouched, no colour picked ANYWHERE: still no ink', vmsApi.vmIconInk(false) === '');

  localStorage.setItem('cc.icontint', '0');
  ok('background ON, Einfärben EXPLICITLY off: still no ink even with the badge showing', vmsApi.vmIconInk(false) === '');

  localStorage.setItem('cc.icontint', '1');
  ok('background ON, Einfärben explicitly ON but still no colour ever picked: still no ink (no pick to lift)', vmsApi.vmIconInk(false) === '');
  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('background ON, Einfärben ON, colour NOW picked: inks in that picked colour', vmsApi.vmIconInk(false) === '#e5a00d', vmsApi.vmIconInk(false));
  reset();

  // pre-4.32.5 installs: only cc.iconbg + cc.iconcolor were ever set, and iconcolor's mere
  // presence WAS the tint's on-signal — vmTintOn()'s fallback keeps that reading intact.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('pre-existing install (no cc.icontint key at all): behaves exactly as it always did — inked', vmsApi.vmTintOn() === true && vmsApi.vmIconInk(false) !== '');
  reset();

  // CONFIRMED BUG (v4.32.6, fixed here): with both controls on and given DELIBERATELY different
  // colours, the icon's ink must be the TINT's own colour, never a contrast colour derived from
  // the (different) badge box colour — live-tested: tint #e5a00d rendered as plain white
  // (#ffffff) once the badge was also on, discarding the picked colour entirely.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#161616'); localStorage.setItem('cc.icontint', '0');
  ok('background colour applies even with Einfärben off (vmBgColor reads cc.iconbgcolor)', vmsApi.vmBgColor() === '#161616');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('once both are on, the ink is the TINT colour, never a contrast colour derived from the (different) badge colour', vmsApi.vmIconInk(false) === '#e5a00d', vmsApi.vmIconInk(false));
  ok('and the badge box itself is still exactly its own configured colour, unaffected by the tint pick', vmsApi.vmBgColor() === '#161616', vmsApi.vmBgColor());
  reset();
}

console.log('\ncc.iconbgrainbow / cc.icontintrainbow (v4.33.0): Badge-Einstellungen übernehmen — regression pin');
{
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('adopt OFF (default): vmBgColor() is the independently picked background colour', vmsApi.vmBgColor() === '#e5a00d', vmsApi.vmBgColor());
  ok('adopt OFF (default): vmIconInk() is the independently picked tint colour', vmsApi.vmIconInk(false) === '#00aa00', vmsApi.vmIconInk(false));

  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('Hintergrund adopting: vmBgColor() answers "" so the caller never stamps --cc-iconbg-color, letting VmTab.css\'s var() chain fall through to --cc-rb-c/--cc-rbaccent — the SAME source every generic VM badge already uses', vmsApi.vmBgColor() === '', JSON.stringify(vmsApi.vmBgColor()));
  ok('Einfärben untouched: still the independently picked tint colour (the two controls are independent)', vmsApi.vmIconInk(false) === '#00aa00', vmsApi.vmIconInk(false));

  localStorage.setItem('cc.icontintrainbow', '1');
  localStorage.setItem('cc.rainbow', '0');
  ok('Einfärben adopting, Rainbow OFF: vmIconInk() matches vmAdoptTint() (the plain accent) — not the own picked colour', vmsApi.vmIconInk(false) === '#2f6feb', vmsApi.vmIconInk(false));

  localStorage.setItem('cc.rainbow', '1');
  ok('Einfärben adopting, Rainbow ON: vmIconInk() matches the SAME vmRbColor(5) a generic VM badge (--cc-rbaccent) resolves to, not a frozen accent snapshot', vmsApi.vmIconInk(false) === vmsApi.vmRbColor(5), vmsApi.vmIconInk(false) + ' vs ' + vmsApi.vmRbColor(5));
  ok('and that is NOT the own picked colour either', vmsApi.vmIconInk(false) !== '#00aa00');

  localStorage.setItem('cc.icontintrainbow', '0');
  ok('turning Einfärben adopt back off restores the own picked colour immediately', vmsApi.vmIconInk(false) === '#00aa00', vmsApi.vmIconInk(false));
  reset();
}

console.log('\nvmLogoSizes(): the SAME cc.sgsize map as docker.js\'s ccLogoSizes() / plugins.js\'s logoSize()');
{
  reset();
  localStorage.setItem('cc.sgsize', 's'); ok('s -> [48px, 62px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['48px', '62px']));
  localStorage.setItem('cc.sgsize', 'm'); ok('m -> [62px, 78px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['62px', '78px']));
  localStorage.setItem('cc.sgsize', 'l'); ok('l -> [76px, 94px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['76px', '94px']));
  localStorage.removeItem('cc.sgsize'); ok('unset defaults to m -> [62px, 78px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['62px', '78px']));
  localStorage.setItem('cc.sgsize', 'nonsense'); ok('a garbage value falls back to [62px, 78px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['62px', '78px']));
  reset();
}

console.log('\nA glyph never ends up with BOTH a direct colour AND the luminance-tint filter (double-tint regression pin)');
{
  ok('native treat: no colour AND no filter', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'native' }, false, '#2f6feb', '#e5a00d'); return !r.color && !r.filter; })());
  ok('Logo-Hintergrund on, forced "tint": colour is the resolved ink verbatim (caller already resolved it), filter stays empty', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '#e5a00d'); return !!r.color && !r.filter; })());
  ok('an ink colour is available, forced "tint": colour is set, filter stays empty', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '#e5a00d'); return r.color === '#e5a00d' && !r.filter; })());
  // v4.32.5 regression pin: the badge alone must NEVER force a colour onto a glyph — `ink` (the
  // 4th arg) already answers "" whenever Einfärben is off, badge or not, so ibgOn must not be
  // consulted on its own any more (the old `if (ibgOn) return {color: idealText(ibgAcc), ...}`
  // branch ignored an empty `ink` and forced one anyway).
  ok('Logo-Hintergrund on but NO ink (Einfärben off): no colour is forced onto the glyph', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', ''); return !r.color; })());
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
