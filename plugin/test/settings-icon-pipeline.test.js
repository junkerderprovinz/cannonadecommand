// Pins the icon pipeline of the Settings-page preview, settings.js's logoPreview()
// with its ink() and badgeBg(). The badge colour and the tint colour are separate
// picks, so the badge being on must not turn the tint into a contrast colour
// derived from it. docker.js, vms.js and plugins.js have the same pair, pinned in
// icon-pipeline.test.js and its two siblings.
//
// ink() closes over logoPreview()'s local `st`, so the harness grabs it with its
// sibling hex6() and passes an `st` object in, mutating it between assertions the
// way logoPreview's own set() does.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const THEME = process.argv[2] || path.join(DIR, 'cc-theme.js');
const SETTINGS = process.argv[3] || path.join(DIR, 'settings.js');

// The DOM and storage shim from icon-pipeline.test.js, cut down to what cc-theme.js
// touches at require time.
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

// Load cc-theme.js the way the browser does.
require(THEME);
const CCTheme = global.window.CCTheme;
if (!CCTheme || !CCTheme.liftDark) throw new Error('cc-theme.js did not export window.CCTheme.liftDark');

// Pull the hex6(), badgeBg() and ink() bodies out of settings.js and drive them
// through an injected `st` standing in for logoPreview()'s closed-over state.
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

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const resetSt = () => { st.bg = false; st.bgColor = ''; st.tint = false; st.color = ''; st.strength = 100; st.accent = '#2f6feb'; };

console.log('\nsettings.js logoPreview() ink(): the colour the live preview paints with');
{
  resetSt();
  ok('nothing configured: no ink', settingsApi.ink(false) === '');

  st.tint = true; st.color = '#e5a00d';
  ok('a bright picked colour is used verbatim', settingsApi.ink(false) === '#e5a00d');

  st.tint = false;
  ok('tint off: no ink at all, even with a colour picked', settingsApi.ink(false) === '');
  resetSt();
}

console.log('\nHintergrund and Einfärben stay independent in the live preview as well');
{
  resetSt();
  ok('nothing configured at all: no ink', settingsApi.ink(false) === '');

  st.bg = true;
  ok('background on, Einfärben untouched: still no ink', settingsApi.ink(false) === '');

  st.bg = true; st.tint = true;
  ok('background on, Einfärben on, no colour ever picked: no ink to lift', settingsApi.ink(false) === '');
  resetSt();
}

console.log('\nThe badge box colour never leaks into the tint ink, with the badge on or off');
{
  resetSt();
  // Blue background against a yellow tint, so a regression that swaps the two or
  // goes back to deriving the ink from the badge cannot hide behind a lucky match.
  st.bg = true; st.bgColor = '#1030a0'; st.tint = true; st.color = '#e0c000'; st.accent = '#2f6feb';
  ok('Hintergrund off, Einfärben on: the picked tint colour renders as picked', (function () { st.bg = false; return settingsApi.ink(false) === '#e0c000'; })(), settingsApi.ink(false));

  st.bg = true;
  ok('Hintergrund on too: the ink stays the picked tint colour', settingsApi.ink(false) === '#e0c000', settingsApi.ink(false));
  ok('and it is neither of the flat contrast colours', settingsApi.ink(false) !== '#ffffff' && settingsApi.ink(false) !== '#161616', settingsApi.ink(false));
  ok('the badge box keeps its own colour, untouched by the tint pick', settingsApi.badgeBg() === '#1030a0', settingsApi.badgeBg());
  resetSt();
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
