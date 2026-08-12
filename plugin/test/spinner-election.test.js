// DOM-shim regression test for header.js's ccLoadState() spinner-election state machine.
// Covers the #36-followup regression (display:flex was an unconditional CSS !important on
// div.spinner.fixed, which can never lose to Unraid's own non-important inline display:none,
// so the dimmed/blurred overlay got stuck on forever) and the #33 hold-open feature (the
// overlay is kept elected via data-cc-held while docker.js's enhancer is still painting, even
// after Unraid's own AJAX has already hidden it) that replaced it. The fix moved display from
// an unconditional stylesheet rule to a JS-set inline override, applied and released in the
// SAME election pass ccLoadState already runs for cc-spin-active — this test proves that inline
// override is (a) actually granted only while genuinely or held-elected, and (b) actually
// released, not left stuck, the moment it stops being elected.
const fs = require('fs');
const path = require('path');
const HEADER = process.argv[2] || path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local',
  'emhttp', 'plugins', 'cannonadecommand', 'scripts', 'header.js');

/* ── minimal DOM shim (trimmed copy of clone-select.test.js's, + a real inline-style model:
   setProperty/removeProperty/the plain .display alias all read and write ONE shared value,
   exactly like a real CSSOM style declaration — whichever API last wrote wins) ────────────── */
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class Style {
  constructor() { this._v = {}; }
  setProperty(k, v) { this._v[k] = v; }
  getPropertyValue(k) { return this._v[k] || ''; }
  removeProperty(k) { delete this._v[k]; }
  get display() { return this._v.display || ''; }
  set display(v) { if (v === '') delete this._v.display; else this._v.display = v; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this.attrs = {}; this.style = new Style();
    this.nativeDisplay = 'block'; // what getComputedStyle falls back to once style.display is unset — models Unraid's own last write, independent of ours
  }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  walk(out = []) { for (const c of this.children) { out.push(c); c.walk(out); } return out; }
  _match(sel) {
    const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/); if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const c of (m[2].match(/\.[\w-]+/g) || [])) if (!this.classList.contains(c.slice(1))) return false;
    for (const a of (m[3].match(/\[[^\]]+\]/g) || [])) { const k = a.slice(1, -1); if (!(k in this.attrs)) return false; }
    return true;
  }
  querySelectorAll(sel) { return this.walk().filter(n => sel.split(',').some(s => n._match(s.trim()))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function computedDisplay(el) { return el.style.display || el.nativeDisplay; }

/* ── pull the REAL ccLoadState (+ its direct helpers) out of header.js ───────────────────── */
const src = fs.readFileSync(HEADER, 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in header.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const code = ['ccLoader', 'ccMountLoader', 'ccUnmountLoader', 'ccLoadState'].map(grab).join('\n');
const html = new N('html');
html.classList.add('cc-popups-on');
const document = {
  documentElement: html,
  querySelector: s => html._match(s.trim()) ? html : html.querySelector(s),
  querySelectorAll: s => html.querySelectorAll(s),
  getElementById: () => null,
};
const { ccLoadState } = new Function('document', 'getComputedStyle', code + '\nreturn {ccLoadState};')(
  document, el => ({ display: computedDisplay(el) }));

/* ── scenarios ─────────────────────────────────────────────────────────────────────────── */
let failed = false;
function check(label, cond) { console.log((cond ? '  PASS  ' : '  FAIL  ') + label); if (!cond) failed = true; }

console.log('div.spinner.fixed is genuinely shown by Unraid (nativeDisplay=block, no CC involvement yet)');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); html.appendChild(sp);
  html.classList.remove('cc-enh-busy');
  ccLoadState();
  check('gets elected and forced to flex !important', sp.style.display === 'flex' && sp.style.getPropertyValue('display') === 'flex');
  check('root is marked cc-loading / data-cc-load=fixed', html.classList.contains('cc-loading') && html.getAttribute('data-cc-load') === 'fixed');
  html.children.length = 0; // reset
}

console.log('\ndiv.spinner.fixed already hidden by Unraid (the #36-followup regression case), enhancer NOT busy');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'none'; html.appendChild(sp);
  html.classList.remove('cc-enh-busy');
  ccLoadState();
  check('is left alone: no inline display override at all', sp.style.getPropertyValue('display') === '');
  check('computed display stays none, not stuck visible', computedDisplay(sp) === 'none');
  check('root is NOT marked loading', !html.classList.contains('cc-loading'));
  html.children.length = 0;
}

console.log('\n#33 hold: Unraid already hid it, but docker.js is still busy painting (cc-enh-busy)');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'none'; html.appendChild(sp);
  html.classList.add('cc-enh-busy');
  ccLoadState();
  check('held element is marked data-cc-held', sp.getAttribute('data-cc-held') === '1');
  check('is force-elected to flex !important despite Unraid hiding it', sp.style.display === 'flex' && sp.style.getPropertyValue('display') === 'flex');
  check('root still reads as loading while held', html.classList.contains('cc-loading'));

  console.log('  -> enhancer finishes (cc-enh-busy cleared): must release, not stay stuck forever');
  html.classList.remove('cc-enh-busy');
  ccLoadState();
  check('data-cc-held is cleared', !sp.hasAttribute('data-cc-held'));
  check('the forced inline display is removed (this IS the regression this test guards)', sp.style.getPropertyValue('display') === '');
  check('root no longer reads as loading', !html.classList.contains('cc-loading'));
  html.children.length = 0;
}

console.log('\nsustained hold across several 60ms poll ticks must not flicker or self-release early');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'none'; html.appendChild(sp);
  html.classList.add('cc-enh-busy');
  for (let tick = 1; tick <= 3; tick++) {
    ccLoadState();
    check('tick ' + tick + ': still held + flex', sp.getAttribute('data-cc-held') === '1' && sp.style.display === 'flex');
  }
  html.classList.remove('cc-enh-busy');
  ccLoadState();
  check('released after the busy tick ends', !sp.hasAttribute('data-cc-held') && sp.style.getPropertyValue('display') === '');
  html.children.length = 0;
}

console.log('\nsustained genuine (non-held) visibility across several ticks must not flicker off');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'block'; html.appendChild(sp);
  html.classList.remove('cc-enh-busy');
  for (let tick = 1; tick <= 3; tick++) {
    ccLoadState();
    check('tick ' + tick + ': stays genuinely elected + flex', sp.style.display === 'flex' && html.classList.contains('cc-loading'));
  }
  sp.nativeDisplay = 'none'; // Unraid genuinely hides it now
  ccLoadState();
  check('releases once Unraid genuinely hides it', sp.style.getPropertyValue('display') === '' && !html.classList.contains('cc-loading'));
  html.children.length = 0;
}

console.log('\nan unrelated in-page spinner must never be force-elected as the fixed overlay');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.nativeDisplay = 'none'; html.appendChild(sp); // no .fixed
  html.classList.add('cc-enh-busy');
  ccLoadState();
  check('no held attribute (only div.spinner.fixed is eligible for the #33 hold)', !sp.hasAttribute('data-cc-held'));
  check('root is not loading (nothing genuinely up, nothing fixed to hold)', !html.classList.contains('cc-loading'));
  html.classList.remove('cc-enh-busy');
  html.children.length = 0;
}

console.log(failed ? '\nFAILED' : '\nOK  all spinner-election scenarios passed');
process.exit(failed ? 1 : 0);
