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
const vmsApi = new Function('document', 'localStorage', 'window',
  'var dead = false;\n' +
  grabFn('ls') + '\n' + grabFn('vmTintOff') + '\n' + grabFn('effK') + '\n' + grabFn('ccIdeal') + '\n' + grabFn('ccAccent') + '\n' +
  grabFn('ccHex6') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' + grabFn('vmIconInk') + '\n' +
  grabFn('ensureTintFilter') + '\n' + grabFn('vmLogoSizes') + '\n' + grabFn('glyphInkAndFilter') + '\n' +
  'return { effK: effK, vmIconInk: vmIconInk, ensureTintFilter: ensureTintFilter, vmLogoSizes: vmLogoSizes, glyphInkAndFilter: glyphInkAndFilter, ccIdeal: ccIdeal, ccAccent: ccAccent };'
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
  ok('Logo-Hintergrund on, forced "tint": colour is the ideal-text ink, filter stays empty', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '#e5a00d'); return !!r.color && !r.filter; })());
  ok('an ink colour is available, forced "tint": colour is set, filter stays empty', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '#e5a00d'); return r.color === '#e5a00d' && !r.filter; })());
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
