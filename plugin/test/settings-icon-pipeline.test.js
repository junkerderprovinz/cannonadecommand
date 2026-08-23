// DOM-shim regression test for the Settings-page preview's icon pipeline (settings.js's
// logoPreview() -> ink()/badgeBg()).
//
// CONFIRMED LIVE BUG (v4.32.6, fixed here): ink() used to return hex6(idealText(badgeBg()))
// whenever the badge (st.bg) was on, completely discarding the user's OWN picked tint colour
// (st.color) — live-tested: Hintergrund off + Einfärben on #e0c000 rendered the picked yellow
// correctly, but Hintergrund ON (any colour) + Einfärben on #e0c000 rendered plain white
// (#ffffff), silently dropping the pick. This mirrors the identical bug fixed the same way in
// docker.js's iconInk() / vms.js's vmIconInk() / plugins.js's plugIconInk() — see
// icon-pipeline.test.js/vms-icon-pipeline.test.js/plugins-icon-pipeline.test.js for those.
//
// ink() is a closure over logoPreview()'s local `st` state object, not a standalone top-level
// function, so this harness grabs it together with its sibling `hex6()` and drives it through
// an `st` object passed in as a parameter (mutated between assertions exactly like logoPreview's
// own `set()` mutates its closed-over `st`) — the REAL function body, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const THEME = process.argv[2] || path.join(DIR, 'cc-theme.js');
const SETTINGS = process.argv[3] || path.join(DIR, 'settings.js');

/* ── minimal DOM + storage shim (verbatim pattern from icon-pipeline.test.js, only what
   cc-theme.js needs at require time) ────────────────────────────────────────────────────── */
const byId = {};
const document = {
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  getElementById: id => byId[id] || null,
  documentElement: { style: { setProperty() {}, removeProperty() {} }, classList: { toggle() {} } },
  body: { appendChild() {} },
  cookie: ''
};
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
global.location = { pathname: '/Docker' }; // skip the cross-origin sync block, as icon-pipeline.test.js does
global.fetch = () => new Promise(() => {});

/* ── load the REAL cc-theme.js, exactly as the browser would ─────────────── */
require(THEME);
const CCTheme = global.window.CCTheme;
if (!CCTheme || !CCTheme.liftDark) throw new Error('cc-theme.js did not export window.CCTheme.liftDark');

/* ── pull the REAL hex6()/badgeBg()/ink() bodies out of settings.js, driven via an injected
   `st` object standing in for logoPreview()'s closed-over state ────────────────────────── */
const src = fs.readFileSync(SETTINGS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in settings.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const st = { bg: false, bgColor: '', tint: false, color: '', strength: 100, accent: '#2f6feb', size: null };
const settingsApi = new Function('st', 'window',
  grabFn('hex6') + '\n' + grabFn('badgeBg') + '\n' + grabFn('ink') + '\n' +
  'return { hex6: hex6, badgeBg: badgeBg, ink: ink };'
)(st, global.window);

/* ── tests ───────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const resetSt = () => { st.bg = false; st.bgColor = ''; st.tint = false; st.color = ''; st.strength = 100; st.accent = '#2f6feb'; };

console.log('\nsettings.js logoPreview() ink(): the ONE colour the live preview paints with');
{
  resetSt();
  ok('nothing configured: no ink', settingsApi.ink(false) === '');

  st.tint = true; st.color = '#e5a00d';
  ok('a bright picked colour is used verbatim', settingsApi.ink(false) === '#e5a00d');

  st.tint = false;
  ok('tint off: no ink at all, even with a colour picked', settingsApi.ink(false) === '');
  resetSt();
}

console.log('\nHintergrund and Einfärben are INDEPENDENT in the live preview too (mirrors docker.js/vms.js/plugins.js)');
{
  resetSt();
  ok('nothing configured at all: no ink', settingsApi.ink(false) === '');

  st.bg = true;
  ok('background ON, Einfärben untouched: still no ink', settingsApi.ink(false) === '');

  st.bg = true; st.tint = true;
  ok('background ON, Einfärben ON but still no colour ever picked: still no ink (no pick to lift)', settingsApi.ink(false) === '');
  resetSt();
}

console.log('\nCONFIRMED LIVE BUG (v4.32.6): the badge box colour must never leak into the tint ink, badge on OR off');
{
  resetSt();
  // The exact live-tested reproduction: Hintergrund and Einfärben BOTH on, with DELIBERATELY
  // different colours — background blue, tint yellow — so a regression that swaps them back
  // (or resurrects the old idealText(badgeBg()) branch) can't hide behind a lucky match.
  st.bg = true; st.bgColor = '#1030a0'; st.tint = true; st.color = '#e0c000'; st.accent = '#2f6feb';
  ok('Hintergrund OFF, Einfärben ON: the picked tint colour renders verbatim (baseline, badge irrelevant)', (function () { st.bg = false; return settingsApi.ink(false) === '#e0c000'; })(), settingsApi.ink(false));

  st.bg = true;
  ok('Hintergrund ON too: the ink is STILL the picked tint colour, never a contrast colour derived from the badge', settingsApi.ink(false) === '#e0c000', settingsApi.ink(false));
  ok('and it is NOT the old buggy flat white/black contrast colour', settingsApi.ink(false) !== '#ffffff' && settingsApi.ink(false) !== '#161616', settingsApi.ink(false));
  ok('the badge box itself keeps its OWN colour, completely unaffected by the tint pick', settingsApi.badgeBg() === '#1030a0', settingsApi.badgeBg());
  resetSt();
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
