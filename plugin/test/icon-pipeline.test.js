// DOM-shim regression test for the icon pipeline (cc-theme.js + docker.js).
//
// The bug this guards: CC used to ink-FLATTEN every icon whenever the Logo-Hintergrund box
// was on, which turns a full-colour icon (coloured background + differently-coloured mark)
// into one illegible blob — confirmed live on OpenCloud's shipped icon, while the user's own
// hand-made glyphs flattened perfectly. The pipeline decides between the two treatments, and
// every branch of that decision is pinned here, plus the darkness guard that keeps a very
// dark target from vanishing into CC's own dark surfaces.
//
// The REAL functions are pulled out of the shipped sources, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const THEME = process.argv[2] || path.join(DIR, 'cc-theme.js');
const DOCKER = process.argv[3] || path.join(DIR, 'docker.js');

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
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.listeners = {};
    this.dataset = {}; this.selected = false;
    this._style = {};
    this.style = {
      setProperty: (k, v) => { this._style[k] = v; },
      removeProperty: (k) => { delete this._style[k]; },
      cssText: ''
    };
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
  remove() { if (this.parentNode) this.parentNode.removeChild(this); const id = this.id || this.attrs.id; if (id) delete byId[id]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const byId = {};
const document = {
  createElement: t => new N(t),
  getElementById: id => byId[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: new N('html'),
  body: new N('body'),
  cookie: ''
};
document.body.appendChild = function (c) { N.prototype.appendChild.call(this, c); if (c.attrs.id || c.id) byId[c.id || c.attrs.id] = c; return c; };
global.document = document;
global.navigator = { language: 'en' };

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
};
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { localStorage: global.localStorage, document, setTimeout, clearTimeout };
// cc-theme.js's cross-origin settings sync skips the two pages that already sync; pretend to
// be /Docker so that block returns immediately and the test only exercises the icon pipeline.
global.location = { pathname: '/Docker' };
global.fetch = () => new Promise(() => {});   // the batch lookup never resolves in this test

/* ── load the REAL cc-theme.js, exactly as the browser would ─────────────── */
require(THEME);
const CCTheme = global.window.CCTheme;
if (!CCTheme || !CCTheme.icons) throw new Error('cc-theme.js did not export window.CCTheme.icons');

/* ── pull the REAL filter builders + iconInk out of docker.js ───────────── */
const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// RB_PAL/RB_OFFSET stand in for docker.js's module-level rainbow-palette vars (normally
// window.CCTheme.RB / a persisted random seed) — pinned to the shipped default palette and
// offset 0 so ccRbColor(i)/iconAdoptTint() are deterministic here.
const dockerApi = new Function('document', 'localStorage', 'window',
  'var RB_PAL = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  grabFn('effc') + '\n' + grabFn('themingOn') + '\n' +
  grabFn('idealText') + '\n' + grabFn('ccHex6') + '\n' + grabFn('tintOn') + '\n' + grabFn('ccPalActive') + '\n' + grabFn('ccRbColor') + '\n' + grabFn('iconAdoptTint') + '\n' + grabFn('bgColor') + '\n' + grabFn('iconInk') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' + grabFn('ensureTintFilter') + '\n' + grabFn('ccLogoSizes') + '\n' + grabFn('glyphInkAndFilter') + '\n' +
  'return { iconInk: iconInk, tintOn: tintOn, bgColor: bgColor, ensureFlatFilter: ensureFlatFilter, ensureMonoFilter: ensureMonoFilter, ensureTintFilter: ensureTintFilter, ccLogoSizes: ccLogoSizes, glyphInkAndFilter: glyphInkAndFilter, idealText: idealText, effc: effc, iconAdoptTint: iconAdoptTint, ccRbColor: ccRbColor };'
)(document, global.localStorage, global.window);

/* ── tests ───────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const CI = CCTheme.icons;
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

console.log('\nThe resolution chain: cheapest local check first, every step degrades into the next');
{
  const S = CI.SIMPLE_MAX;
  let p = CI.plan('auto', '', 4);
  ok('an already-simple icon flattens, on its OWN pixels (step 1, no network involved)', p.treat === 'flat' && p.src === 'native', JSON.stringify(p));

  p = CI.plan('auto', 'glyph', 90);
  ok('a complex icon with a glyph match flattens the GLYPH, not the shipped art (step 2)', p.treat === 'flat' && p.src === 'glyph', JSON.stringify(p));

  p = CI.plan('auto', 'color', 90);
  ok('a complex icon with only a colour match TINTS the curated colour icon (step 3)', p.treat === 'tint' && p.src === 'color', JSON.stringify(p));

  p = CI.plan('auto', '', 90);
  ok('nothing anywhere: tint the native icon — never flatten it (the black-blob guard)', p.treat === 'tint' && p.src === 'native', JSON.stringify(p));

  p = CI.plan('auto', '', null);
  ok('not measured yet: the SAFE treatment (tint), upgraded once the measurement lands', p.treat === 'tint' && p.src === 'native', JSON.stringify(p));

  ok('the simplicity threshold is a real number on the 0-255 luminance scale', typeof S === 'number' && S > 0 && S < 255, String(S));
  ok('exactly at the threshold counts as COMPLEX (the boundary is exclusive)', CI.plan('auto', '', S).treat === 'tint');
  ok('just under the threshold counts as simple', CI.plan('auto', '', S - 0.01).treat === 'flat');
}

console.log('\nThe threshold sits in the empty gap measured across a real 55-container box');
{
  // Real spreads, measured live. Everything in `flatten` is a genuine flat glyph; everything
  // in `keep` has internal structure that ink-flattening would destroy — question.png's "?"
  // vanishing into a solid disc is the case that moved this threshold down from 32.
  const flatten = { Plex: 0.53, FileBot: 0.47, Immich: 0.57, Nginx: 0.79, Nextcloud: 0.94, Ollama: 0.74, CCWB: 3.4 };
  const keep = { CrowdSec: 17.33, StirlingPDF: 18.07, 'question.png': 19.78, Palworld: 32.99, OpenCloud: 39.02, BombVault: 45.87, featherdrop: 60.82 };
  Object.keys(flatten).forEach(n => ok(n + ' (' + flatten[n] + ') flattens', CI.plan('auto', '', flatten[n]).treat === 'flat'));
  Object.keys(keep).forEach(n => ok(n + ' (' + keep[n] + ') is NOT flattened', CI.plan('auto', '', keep[n]).treat === 'tint'));
  ok('the threshold really is inside the measured gap 3.4 .. 17.33', CI.SIMPLE_MAX > 3.4 && CI.SIMPLE_MAX < 17.33, String(CI.SIMPLE_MAX));
}

console.log('\nStep 1 outranks step 2: a simple icon is never replaced by a downloaded glyph');
{
  const p = CI.plan('auto', 'glyph', 3);
  ok('own already-simple artwork wins over an external glyph', p.src === 'native' && p.treat === 'flat', JSON.stringify(p));
}

console.log('\nA glyph is only ever chosen when it will actually be INKED');
{
  ok('native mode never picks a glyph (an un-inked glyph would be a black square)', CI.plan('native', 'glyph', 90).src !== 'glyph');
  ok('tint mode never picks a glyph either', CI.plan('tint', 'glyph', 90).src !== 'glyph');
  ok('flat mode is the one that picks it', CI.plan('flat', 'glyph', 90).src === 'glyph');
}

console.log('\nThe manual overrides are overrides, not suggestions');
{
  let p = CI.plan('flat', '', 200);
  ok('flat flattens even artwork the heuristic calls complex', p.treat === 'flat' && p.src === 'native', JSON.stringify(p));
  p = CI.plan('tint', '', 1);
  ok('tint tints even artwork the heuristic calls simple', p.treat === 'tint', JSON.stringify(p));
  p = CI.plan('native', '', 1);
  ok('native leaves the pixels alone whatever the heuristic says', p.treat === 'native', JSON.stringify(p));
  p = CI.plan('native', 'color', 200);
  ok('native still prefers a curated colour icon over a poor shipped one', p.src === 'color', JSON.stringify(p));
}

console.log('\nGlobal default + per-item pin');
{
  reset();
  ok('the default with nothing configured is "auto"', CI.globalMode() === 'auto', CI.globalMode());
  ok('an item with no pin follows the global default', CI.mode('docker', 'Plex') === 'auto');

  localStorage.setItem('cc.iconmode', 'tint');
  ok('the global default is read from cc.iconmode', CI.globalMode() === 'tint');
  ok('every item follows it', CI.mode('docker', 'Plex') === 'tint' && CI.mode('vm', 'Win11') === 'tint');

  CI.setOverride('docker', 'Plex', 'flat');
  ok('a pinned item uses its OWN mode', CI.mode('docker', 'Plex') === 'flat');
  ok('every OTHER item stays on the global default', CI.mode('docker', 'Nextcloud') === 'tint' && CI.mode('vm', 'Win11') === 'tint');
  ok('the pin is namespaced per scope, so a VM of the same name is untouched', CI.mode('vm', 'Plex') === 'tint');
  ok('the pin is case-insensitive on the name', CI.mode('docker', 'PLEX') === 'flat');

  CI.setOverride('docker', 'Plex', '');
  ok('clearing the pin returns the item to the global default', CI.mode('docker', 'Plex') === 'tint');

  CI.setOverride('docker', 'Plex', 'nonsense');
  ok('an unknown mode is not stored as a pin', CI.mode('docker', 'Plex') === 'tint');

  localStorage.setItem('cc.iconmode', 'nonsense');
  ok('an unknown global mode falls back to auto', CI.globalMode() === 'auto');

  localStorage.setItem('cc.iconov', '{ this is not json');
  ok('a corrupt pin map degrades to "no pins", it never throws', CI.mode('docker', 'Plex') === 'auto');
  reset();
}

console.log('\nAll pins live in ONE cc.* key, so they ride the existing settings sync');
{
  reset();
  CI.setOverride('plugin', 'CannonadeCommand', 'native');
  const keys = Object.keys(store);
  ok('exactly one storage key is written', keys.length === 1, JSON.stringify(keys));
  ok('and it carries the cc. prefix the sync mirrors', /^cc[a-z]*\./.test(keys[0]), keys[0]);
  reset();
}

console.log('\nThe darkness guard (CCTheme.liftDark) — the shared popBadge logic');
{
  ok('the floor is the tuned 28, not the old 64', CCTheme.LUM_FLOOR === 28, String(CCTheme.LUM_FLOOR));
  ok('pure black is lifted off the dark surface', CCTheme.liftDark('#000000', '#2f6feb') !== '#000000');
  ok('a bright colour is left exactly as chosen', CCTheme.liftDark('#e5a00d', '#2f6feb') === '#e5a00d');
  ok('a legitimately dark FLAG green survives the badge floor', CCTheme.liftDark('#006233', '#2f6feb') === '#006233');
  ok('navy survives the badge floor too', CCTheme.liftDark('#002868', '#2f6feb') === '#002868');
  // The tint case: output = pixel luminance x target, so it lands near HALF the target's
  // luma and needs the doubled floor. #2a2a2a (luma 42) was live-measured as "schwer
  // erkennbar" against the card while clearing the badge floor comfortably.
  ok('#2a2a2a clears the BADGE floor', CCTheme.liftDark('#2a2a2a', '#2f6feb') === '#2a2a2a');
  ok('#2a2a2a is lifted at the TINT floor — the live-measured invisible case', CCTheme.liftDark('#2a2a2a', '#2f6feb', CCTheme.LUM_FLOOR * 2) !== '#2a2a2a');
  ok('with an all-dark palette the guard falls back to the accent', (() => {
    localStorage.setItem('cc.rbpal', JSON.stringify(['#000000', '#050505']));
    const got = CCTheme.liftDark('#000000', '#2f6feb');
    localStorage.removeItem('cc.rbpal');
    return got === '#2f6feb';
  })());
  ok('a swapped slot comes from the ACTIVE palette, so it stays on theme', (() => {
    localStorage.setItem('cc.rbpal', JSON.stringify(['#000000', '#ffcc00']));
    const got = CCTheme.liftDark('#000000', '#2f6feb');
    localStorage.removeItem('cc.rbpal');
    return got === '#ffcc00';
  })());
}

console.log('\ndocker.js iconInk(): the ONE target colour both treatments paint with');
{
  reset();
  ok('no icon colour and no Logo-Hintergrund: no ink at all, so icons stay native', dockerApi.iconInk(false) === '');

  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('a bright picked colour is used verbatim', dockerApi.iconInk(false) === '#e5a00d');

  localStorage.setItem('cc.iconcolor', '#2a2a2a');
  ok('a near-black pick survives the FLAT floor (a flat fill IS its target luminance)', dockerApi.iconInk(false) === '#2a2a2a');
  ok('but is lifted for the TINT, which would render darker still', dockerApi.iconInk(true) !== '#2a2a2a');

  // Badge and tint are independent controls (v4.32.6 fix): the badge box's OWN colour must
  // never leak into the icon's ink — deliberately different colours so a future regression
  // that swaps them back can't hide.
  localStorage.setItem('cc.iconbg', '1');
  localStorage.setItem('cc.iconbgcolor', '#1030a0'); // badge box: dark blue
  localStorage.setItem('cc.iconcolor', '#e5a00d');   // tint pick: bright orange
  ok('Logo-Hintergrund on: ink is the picked TINT colour, never the badge box colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  ok('and it is a SIX-digit hex, which every filter regex requires', /^#[0-9a-f]{6}$/i.test(dockerApi.iconInk(false)), dockerApi.iconInk(false));
  ok('the badge box itself keeps its OWN colour, completely unaffected by the tint pick', dockerApi.bgColor() === '#1030a0', dockerApi.bgColor());
  localStorage.setItem('cc.iconbg', '0');
  ok('turning the badge off leaves the ink identical — it was never the source of it', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  reset();
}

console.log('\nHintergrund and Einfärben are INDEPENDENT (v4.32.5 fix): the badge alone must not force the tint on');
{
  reset();
  ok('nothing configured at all: no ink', dockerApi.iconInk(false) === '');

  // the CONFIRMED bug: Logo-Hintergrund on, Einfärben never touched (no cc.icontint, no
  // cc.iconcolor) used to still tint every Docker icon via the accent fallback
  localStorage.setItem('cc.iconbg', '1');
  ok('background ON, Einfärben untouched, no colour picked ANYWHERE: still no ink', dockerApi.iconInk(false) === '');

  localStorage.setItem('cc.icontint', '0');
  ok('background ON, Einfärben EXPLICITLY off: still no ink even with the badge showing', dockerApi.iconInk(false) === '');

  localStorage.setItem('cc.icontint', '1');
  ok('background ON, Einfärben explicitly ON but still no colour ever picked: still no ink (no pick to lift)', dockerApi.iconInk(false) === '');
  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('background ON, Einfärben ON, colour NOW picked: inks in that picked colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  reset();

  // pre-4.32.5 installs: only cc.iconbg + cc.iconcolor were ever set, and iconcolor's mere
  // presence WAS the tint's on-signal — tintOn()'s fallback keeps that reading intact.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('pre-existing install (no cc.icontint key at all): behaves exactly as it always did — inked', dockerApi.tintOn() === true && dockerApi.iconInk(false) !== '');
  reset();

  // CONFIRMED BUG (v4.32.6, fixed here): with both controls on and given DELIBERATELY
  // different colours, the icon's ink must be the TINT's own colour, never a contrast colour
  // derived from the (different) badge box colour — live-tested: tint #e5a00d rendered as
  // plain white (#ffffff) once the badge was also on, discarding the picked colour entirely.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#161616'); localStorage.setItem('cc.icontint', '0');
  ok('background colour applies even with Einfärben off (bgColor reads cc.iconbgcolor)', dockerApi.bgColor() === '#161616');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('once both are on, the ink is the TINT colour, never a contrast colour derived from the (different) badge colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  ok('and the badge box itself is still exactly its own configured colour, unaffected by the tint pick', dockerApi.bgColor() === '#161616', dockerApi.bgColor());
  reset();
}

console.log('\ndocker.js honours its OWN adopt toggle (cc.styledocker) for iconcolor/iconbg/iconstrength');
{
  // The confirmed bypass bug: docker.js used to read cc.iconcolor/cc.iconbg/cc.iconstrength
  // directly, completely ignoring effc()/cc.styledocker — so turning Docker's OWN "Adopt the
  // global icon style" toggle off had ZERO visible effect on the real page, even though
  // settings.js's Docker "Stil" card wrote perfectly good ccd.* values that nothing ever read.
  reset();
  localStorage.setItem('cc.iconcolor', '#e5a00d'); localStorage.setItem('cc.iconbg', '0'); localStorage.setItem('cc.iconstrength', '100');
  localStorage.setItem('ccd.iconcolor', '#00aa00'); localStorage.setItem('ccd.iconbg', '1'); localStorage.setItem('ccd.iconstrength', '40');

  ok('adopt ON (cc.styledocker unset): iconInk() follows the GLOBAL colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  dockerApi.ensureTintFilter();
  var sigAdoptOn = document.getElementById('cc-tint-svg').dataset.sig;

  localStorage.setItem('cc.styledocker', '0');
  ok('adopt OFF: iconInk() now follows DOCKER-LOCAL ccd.iconbg (badge-mode ink), not the global colour', dockerApi.iconInk(false) !== '#e5a00d', dockerApi.iconInk(false));
  dockerApi.ensureTintFilter();
  var sigAdoptOff = document.getElementById('cc-tint-svg').dataset.sig;
  ok('and the tint STRENGTH differs between the two toggle states too (ccd.iconstrength=40 vs cc.iconstrength=100)', sigAdoptOff !== sigAdoptOn, sigAdoptOn + ' vs ' + sigAdoptOff);
  reset();
}

console.log('\ncc.iconbgrainbow (v4.33.1): Badge-Einstellungen übernehmen — ONE master toggle, regression pin');
{
  // Regression pin for the exact user-reported capability gap: v4.32.4-v4.32.7 made Hintergrund/
  // Einfärben's OWN colour win unconditionally, with no way back to "follow Rainbow/accent like
  // every other badge". v4.33.0's first attempt gave each control its OWN independent adopt key;
  // redesigned within minutes into ONE shared key (this file) because the tint is a single
  // page-wide filter, so two independently-adopting controls could never look like a genuine
  // per-item rainbow. Now: ONE toggle adopts BOTH — the background follows Rainbow/accent exactly
  // as before, and the ink stops being a separately-adopted colour and becomes an automatic
  // black/white CONTRAST colour instead, regardless of Einfärben's own on/off.
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('adopt OFF (default): bgColor() is the independently picked background colour', dockerApi.bgColor() === '#e5a00d', dockerApi.bgColor());
  ok('adopt OFF (default): iconInk() is the independently picked tint colour', dockerApi.iconInk(false) === '#00aa00', dockerApi.iconInk(false));

  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('adopting: bgColor() answers "" so the caller never stamps --cc-iconbg-color, letting the CSS var() chain fall through to --cc-rb-c/--cc-accent — the SAME source every generic badge already uses', dockerApi.bgColor() === '', JSON.stringify(dockerApi.bgColor()));

  localStorage.setItem('cc.rainbow', '0');
  ok('adopting, Rainbow OFF: iconInk() is the automatic contrast colour for the plain accent (idealText of iconAdoptTint()) — not the own picked colour', dockerApi.iconInk(false) === dockerApi.idealText(dockerApi.iconAdoptTint()), dockerApi.iconInk(false));
  ok('and that accent is dark-ish (#2f6feb), so the contrast ink is white', dockerApi.iconInk(false) === '#fff', dockerApi.iconInk(false));

  localStorage.setItem('cc.rainbow', '1');
  ok('adopting, Rainbow ON: iconInk() is the automatic contrast colour for the SAME ccRbColor(5) a generic badge (--cc-btn-accent) resolves to, not a frozen accent snapshot', dockerApi.iconInk(false) === dockerApi.idealText(dockerApi.ccRbColor(5)), dockerApi.iconInk(false) + ' vs idealText(' + dockerApi.ccRbColor(5) + ')');
  ok('and that is NOT the own picked colour either', dockerApi.iconInk(false) !== '#00aa00');

  localStorage.setItem('cc.icontint', '0');
  ok('adopting: the ink is STILL the automatic contrast colour even with Einfärben explicitly OFF — the master toggle no longer depends on Einfärben\'s own on/off at all', dockerApi.iconInk(false) === dockerApi.idealText(dockerApi.ccRbColor(5)), dockerApi.iconInk(false));
  localStorage.setItem('cc.icontint', '1');

  localStorage.setItem('cc.iconbgrainbow', '0');
  ok('turning the master toggle back off restores the own picked colour immediately', dockerApi.iconInk(false) === '#00aa00', dockerApi.iconInk(false));
  reset();
}

console.log('\nccLogoSizes(): the ONE cc.sgsize -> [--cc-logo-img, --cc-logo-box] map');
{
  reset();
  localStorage.setItem('cc.sgsize', 's'); ok('s -> [48px, 62px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['48px', '62px']), JSON.stringify(dockerApi.ccLogoSizes()));
  localStorage.setItem('cc.sgsize', 'm'); ok('m -> [62px, 78px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['62px', '78px']), JSON.stringify(dockerApi.ccLogoSizes()));
  localStorage.setItem('cc.sgsize', 'l'); ok('l -> [76px, 94px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['76px', '94px']), JSON.stringify(dockerApi.ccLogoSizes()));
  localStorage.removeItem('cc.sgsize'); ok('unset defaults to m -> [62px, 78px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['62px', '78px']));
  localStorage.setItem('cc.sgsize', 'nonsense'); ok('a garbage value falls back to [62px, 78px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['62px', '78px']));
  reset();
}

console.log('\nA glyph never ends up with BOTH a direct colour AND the luminance-tint filter (double-tint regression pin)');
{
  var w = 'url(#cc-icon-tint)';
  ok('native treat: hands off entirely, no colour AND no filter', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'native' }, false, '#2f6feb', '#e5a00d', w); return !r.color && !r.filter; })());
  ok('Logo-Hintergrund on: colour is set, filter is cleared even when forced "tint"', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '#e5a00d', w); return !!r.color && !r.filter; })());
  ok('an ink colour is available: colour is set, filter is cleared even when forced "tint"', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '#e5a00d', w); return !!r.color && !r.filter; })());
  ok('no ink at all: filter is the only thing that can carry the treatment, colour stays empty', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '', w); return !r.color && r.filter === w; })());
  // v4.32.5 regression pin: the badge alone must NEVER force a colour onto a glyph — `ink` (the
  // 4th arg) already answers "" whenever Einfärben is off, badge or not, so ibgOn must not be
  // consulted on its own any more (the old `if (ibgOn) return {color: idealText(ibgAcc), ...}`
  // branch ignored an empty `ink` and forced one anyway).
  ok('Logo-Hintergrund on but NO ink (Einfärben off): no colour is forced onto the glyph', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '', w); return !r.color; })());
}

console.log('\nThe flat filter flattens to ONE colour and keeps alpha');
{
  const url = dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '#ff8800');
  ok('returns a url(#id) reference', url === 'url(#cc-test-flat-f)', url);
  const host = document.getElementById('cc-test-flat');
  ok('the filter host exists', !!host);
  const svg = host.innerHTML || '';
  ok('the matrix zeroes every input channel (a FLAT fill, not a tint)', /values="0 0 0 0 [\d.]+ 0 0 0 0 [\d.]+ 0 0 0 0 [\d.]+ 0 0 0 1 0"/.test(svg), svg);
  ok('alpha passes through untouched (the "0 0 0 1 0" row)', svg.indexOf('0 0 0 1 0') > 0);
  ok('the offsets are the requested colour', svg.indexOf('1.0000') >= 0 && svg.indexOf('0.5333') >= 0 && svg.indexOf('0.0000') >= 0, svg);

  const sig = host.dataset.sig;
  dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '#ff8800');
  ok('rebuilding with the same colour is a no-op (no MutationObserver loop)', host.dataset.sig === sig);
  dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '#00ff00');
  ok('a real colour change DOES rebuild', host.dataset.sig !== sig);

  ok('no colour removes the filter host entirely', dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '') === '');
}

console.log('\nensureMonoFilter stays the Logo-Hintergrund spelling of the same filter');
{
  const dark = dockerApi.ensureMonoFilter('cc-test-mono', 'cc-test-mono-f', '#161616');
  ok('a dark box yields a filter', dark === 'url(#cc-test-mono-f)');
  let svg = document.getElementById('cc-test-mono').innerHTML;
  ok('and inks WHITE on it', svg.indexOf('1.0000 0 0 0 0 1.0000 0 0 0 0 1.0000') > 0 || /0 0 0 0 1\.0000 0 0 0 0 1\.0000 0 0 0 0 1\.0000/.test(svg), svg);
  dockerApi.ensureMonoFilter('cc-test-mono', 'cc-test-mono-f', '#ffcc00');
  svg = document.getElementById('cc-test-mono').innerHTML;
  ok('a light box inks DARK instead', /0 0 0 0 0\.0863 0 0 0 0 0\.0863 0 0 0 0 0\.0863/.test(svg), svg);
}

console.log('\nThe engine URL the frontend points an <img> at');
{
  const u = CI.svgUrl('Stirling-PDF');
  ok('goes through the same-origin PHP proxy (so the canvas read is not tainted)', u.indexOf('/plugins/cannonadecommand/server/ccapi.php') === 0, u);
  ok('asks the iconsvg path', u.indexOf('path=iconsvg') > 0, u);
  ok('carries the name, url-encoded and lowercased', u.indexOf('name=stirling-pdf') > 0, u);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
