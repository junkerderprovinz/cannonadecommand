// DOM-shim regression test for the Settings/Tools category-grid icon pipeline (settingsgrid.js).
//
// CONFIRMED LIVE BUG (v4.32.5, fixed here): bgColorEff()/badgeBg()/bgColorIsCustom()/tintOnEff()
// and every direct key read in apply()/ensureTintFilter()/paintTint() used to go through
// g("ccs.<key>", d) — the area-LOCAL key only, completely bypassing eff() (the SAME adopt-gated
// per-area -> global fallback docker.js/vms.js/plugins.js already use). Since a user configures
// colour/tint/background on the GLOBAL "Logos & Icons" card (cc.*), not a Settings-page-specific
// override (ccs.*), those ccs.* keys were essentially ALWAYS unset even with a valid global colour
// and cc.stylesettings (adopt) ON — so the tile grid always fell back to the plain accent/rainbow
// colour, silently ignoring the configured global icon colour. Live-tested and confirmed on a real
// box: Settings/Tools tiles showed pure rainbow rotation with zero trace of the global colour.
//
// This file mirrors icon-pipeline.test.js/vms-icon-pipeline.test.js/plugins-icon-pipeline.test.js's
// exact harness pattern (grabFn source-slicing, the same minimal DOM + localStorage shim) but
// pointed at settingsgrid.js, and pins TWO things:
//  1. The adopt-gated global fallback itself: with cc.stylesettings ON (the default), every
//     colour/tint/background read must resolve from the GLOBAL cc.* keys when the area-local
//     ccs.* keys are unset — not silently fall back to the accent as if nothing were configured.
//  2. Hintergrund and Einfärben stay two INDEPENDENT controls on this area too (the same split
//     docker.js/vms.js/plugins.js already got): a background badge colour must resolve even with
//     Einfärben off, and the tint on/off must not be inferred from the badge state.
//
// The REAL functions are pulled out of the shipped source, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const SG = process.argv[2] || path.join(DIR, 'settingsgrid.js');

/* ── minimal storage shim (verbatim pattern from icon-pipeline.test.js) ────────────────────── */
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

/* ── pull the REAL functions out of settingsgrid.js ─────────────────────── */
const src = fs.readFileSync(SG, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in settingsgrid.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// RB/RB_OFF stand in for settingsgrid.js's module-level palette vars (normally window.CCTheme.RB
// / a persisted random seed) — pinned to the shipped default palette and offset 0 so rbColor(i)
// is deterministic here, exactly like docker.js/vms.js/plugins.js's own isolated-function tests.
const sgApi = new Function('localStorage',
  'var RB = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFF = 0;\n' +
  grabFn('g') + '\n' + grabFn('eff') + '\n' + grabFn('accent') + '\n' +
  grabFn('bgAdopting') + '\n' + grabFn('bgColorEff') + '\n' + grabFn('badgeBg') + '\n' + grabFn('bgColorIsCustom') + '\n' + grabFn('tintOnEff') + '\n' +
  grabFn('rbOn') + '\n' + grabFn('rbNeutral') + '\n' + grabFn('pal') + '\n' + grabFn('rbColor') + '\n' + grabFn('tintColorEff') + '\n' +
  'return { g: g, eff: eff, accent: accent, bgAdopting: bgAdopting, bgColorEff: bgColorEff, badgeBg: badgeBg, bgColorIsCustom: bgColorIsCustom, tintOnEff: tintOnEff, rbColor: rbColor, tintColorEff: tintColorEff };'
)(global.localStorage);

/* ── tests ───────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

console.log('\nCONFIRMED LIVE BUG: bgColorEff() must fall through to the GLOBAL cc.* keys while adopt (cc.stylesettings) is on');
{
  reset();
  // The exact live-tested failure state: a valid GLOBAL icon colour, adopt ON (default), and the
  // area-local ccs.* keys never touched (the normal state for any user who only ever opens the
  // global "Logos & Icons" card).
  localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  ok('adopt ON, global cc.iconbgcolor set, ccs.iconbgcolor untouched: bgColorEff() follows the GLOBAL colour, not the accent fallback', sgApi.bgColorEff() === '#e5a00d', sgApi.bgColorEff());
  ok('badgeBg() (the alias apply()/paintGrid() actually call) agrees', sgApi.badgeBg() === '#e5a00d', sgApi.badgeBg());
  ok('bgColorIsCustom() reports a genuinely configured colour, so the rainbow-priority check in paintGrid() lets it win', sgApi.bgColorIsCustom() === true);

  // Adopt OFF: the SAME global colour must now be ignored, and the (still unset) area-local
  // ccs.iconbgcolor should fall all the way to the accent instead.
  localStorage.setItem('cc.stylesettings', '0');
  ok('adopt OFF: bgColorEff() no longer follows the global colour (area-local key is unset)', sgApi.bgColorEff() !== '#e5a00d', sgApi.bgColorEff());
  reset();
}

console.log('\nThe legacy iconcolor fallback and the new iconbgcolor key both resolve through the SAME adopt gate');
{
  reset();
  // pre-4.32.5 style: only the shared iconcolor key was ever set (no iconbgcolor yet).
  localStorage.setItem('cc.iconcolor', '#161616');
  ok('adopt ON, only the GLOBAL legacy cc.iconcolor set: bgColorEff() still resolves it', sgApi.bgColorEff() === '#161616', sgApi.bgColorEff());
  localStorage.setItem('cc.stylesettings', '0');
  ok('adopt OFF: the same global legacy key is now correctly ignored too', sgApi.bgColorEff() !== '#161616', sgApi.bgColorEff());
  reset();
}

console.log('\nHintergrund and Einfärben are INDEPENDENT on this area too (v4.32.5 fix, mirrors docker.js/vms.js/plugins.js)');
{
  reset();
  ok('nothing configured at all: tint is off', sgApi.tintOnEff() === false);

  // pre-existing install: only iconcolor ever set -> its mere presence WAS the tint on-signal;
  // tintOnEff()'s fallback keeps that exact reading (adopt ON, reading the global key).
  localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('pre-existing install (no cc.icontint key at all): tint reads ON from the legacy colour presence', sgApi.tintOnEff() === true);
  reset();

  localStorage.setItem('cc.icontint', '0'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('Einfärben explicitly OFF even with a valid tint colour set: tint stays off', sgApi.tintOnEff() === false);
  // ...but the background colour must still resolve independently of Einfärben being off.
  localStorage.setItem('cc.iconbgcolor', '#161616');
  ok('background colour resolves even with Einfärben off (independent controls)', sgApi.bgColorEff() === '#161616', sgApi.bgColorEff());
  reset();
}

console.log('\ncc.iconbgrainbow / cc.icontintrainbow (v4.33.0): Badge-Einstellungen übernehmen — regression pin');
{
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('adopt OFF (default): bgColorEff() is the independently picked background colour', sgApi.bgColorEff() === '#e5a00d', sgApi.bgColorEff());
  ok('adopt OFF (default): bgColorIsCustom() is true', sgApi.bgColorIsCustom() === true);
  ok('adopt OFF (default): tintColorEff() is the independently picked tint colour', sgApi.tintColorEff() === '#00aa00', sgApi.tintColorEff());

  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('Hintergrund adopting: bgColorEff() answers "" so apply() never stamps --cc-iconbg-color', sgApi.bgColorEff() === '', JSON.stringify(sgApi.bgColorEff()));
  ok('Hintergrund adopting: bgColorIsCustom() is now false, so paintGrid()\'s existing iconSet branch falls through to its OWN rotating-colour paint (c = rbColor(i)) — genuine per-tile rotation, no new colour math', sgApi.bgColorIsCustom() === false);
  ok('Einfärben untouched: still the independently picked tint colour (the two controls are independent)', sgApi.tintColorEff() === '#00aa00', sgApi.tintColorEff());

  localStorage.setItem('cc.icontintrainbow', '1');
  localStorage.setItem('cc.rainbow', '0');
  ok('Einfärben adopting, Rainbow OFF: tintColorEff() is the plain accent — not the own picked colour', sgApi.tintColorEff() === '#2f6feb', sgApi.tintColorEff());

  localStorage.setItem('cc.rainbow', '1');
  ok('Einfärben adopting, Rainbow ON: tintColorEff() matches the SAME rbColor(5) a generic rotating tile resolves to, not a frozen accent snapshot', sgApi.tintColorEff() === sgApi.rbColor(5), sgApi.tintColorEff() + ' vs ' + sgApi.rbColor(5));
  ok('and that is NOT the own picked colour either', sgApi.tintColorEff() !== '#00aa00');

  localStorage.setItem('cc.icontintrainbow', '0');
  ok('turning Einfärben adopt back off restores the own picked colour immediately', sgApi.tintColorEff() === '#00aa00', sgApi.tintColorEff());
  reset();
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exitCode = fail ? 1 : 0;
