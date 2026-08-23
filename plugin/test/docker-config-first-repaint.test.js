// Regression test for the Docker-tab half of the "badges stuck in rainbow" investigation.
//
// docker.js already had its own cross-origin config sync (loadConfig(), separate from
// cc-theme.js's — see cc-theme-rerender-hook.test.js for that half of the fix) whose repaint was
// previously GATED on adoptUISettings() finding a difference: `if (adoptUISettings(...)) { ...full
// repaint...}`. On the very FIRST loadConfig() of a page load, that gate depends purely on timing:
// docker.js's own boot() may already have painted once, synchronously, off whatever localStorage
// held BEFORE this async GET /config resolved. If the browser's local copy already happened to
// equal the server's (nothing to adopt), that first paint's possibly-stale values would never get
// a corrective repaint at all — no live bug was ever proven for this window (extensive live
// Playwright testing against the real box found Docker's chain self-heals every ~9s poll and
// leaves no residue), but the race is real and the fix is cheap and safe: force the SAME full
// repaint unconditionally on the first loadConfig() ever, not only when adoptUISettings() detected
// a difference. This pins that:
//   1) the first loadConfig() call repaints even when nothing needed adopting;
//   2) the SECOND call does NOT repaint when nothing changed (no render-loop regression);
//   3) a real adoption on ANY call still repaints, exactly as before.
//
// The real source is sliced out, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabBetween(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('start marker not found: ' + startMarker);
  const e = src.indexOf(endMarker, s);
  if (e < 0) throw new Error('end marker not found after start: ' + endMarker);
  return src.slice(s, e);
}

const src = fs.readFileSync(DOCKER, 'utf8');
const code = grabBetween(src,
  'function adoptUISettings(u) {',
  'function loadLimits()');

// Minimal harness: stub every dependency loadConfig()/adoptUISettings() touch, and instrument the
// four repaint calls (applySettings/applyEnhanceClasses/removeEnhanceClasses/reinjectRowBadges/
// renderGrid) so a test can count exactly how many full-repaint passes each loadConfig() call did.
// `serverUiSettings` is a plain mutable object the test can rewrite between calls, so a harness
// can simulate a Rainbow toggle landing on a LATER poll without needing a second closure.
function harness(initialLocal) {
  const store = Object.assign({}, initialLocal || {});
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const calls = { applySettings: 0, applyEnhanceClasses: 0, removeEnhanceClasses: 0, reinjectRowBadges: 0, renderGrid: 0 };
  const win = {};
  const serverRef = { ui_settings: {} };
  const fnBody = code + '\nreturn { loadConfig: loadConfig, adoptUISettings: adoptUISettings, get config() { return config; } };';
  const factory = new Function(
    'window', 'localStorage', 'api', 'applySettings', 'applyEnhanceClasses', 'removeEnhanceClasses',
    'reinjectRowBadges', 'renderGrid', 'themingOn', 'mode', 'uiSeeded', 'collectUISettings', 'uiPending', 'pushUISettings',
    fnBody
  );
  const api = (method, path) => { if (method === 'GET' && path === 'config') return Promise.resolve({ ui_settings: serverRef.ui_settings }); return Promise.resolve(null); };
  const state = factory(
    win, localStorage, api,
    () => { calls.applySettings++; }, () => { calls.applyEnhanceClasses++; }, () => { calls.removeEnhanceClasses++; },
    () => { calls.reinjectRowBadges++; }, () => { calls.renderGrid++; },
    () => true, // themingOn() -> true, so the list-mode branch takes applyEnhanceClasses (not removeEnhanceClasses)
    'list', true, () => ({}), {}, () => {}
  );
  return { state, store, calls, serverRef };
}

console.log('docker.js loadConfig(): the first call always repaints, even with nothing to adopt');
{
  // local already equals server -> adoptUISettings() alone would find nothing and skip the repaint
  const h = harness({ 'cc.rainbow': '0' });
  h.serverRef.ui_settings = { 'cc.rainbow': '0' };
  h.state.loadConfig().then(() => {
    ok('applySettings ran on the very first loadConfig() despite no diff', h.calls.applySettings === 1, h.calls.applySettings);
    ok('applyEnhanceClasses ran too (mode stayed "list")', h.calls.applyEnhanceClasses === 1, h.calls.applyEnhanceClasses);
    ok('reinjectRowBadges ran too', h.calls.reinjectRowBadges === 1, h.calls.reinjectRowBadges);
    ok('renderGrid did NOT run (mode is "list", not "grid")', h.calls.renderGrid === 0, h.calls.renderGrid);
    run2();
  });
}

function run2() {
  console.log('\ndocker.js loadConfig(): a SECOND call with nothing to adopt does NOT repaint again (no render-loop)');
  const h = harness({ 'cc.rainbow': '0' });
  h.serverRef.ui_settings = { 'cc.rainbow': '0' };
  h.state.loadConfig().then(() => h.state.loadConfig()).then(() => {
    ok('exactly one repaint pass across two identical calls (the first forced, the second correctly skipped)',
      h.calls.applySettings === 1, h.calls.applySettings);
    run3();
  });
}

function run3() {
  console.log('\ndocker.js loadConfig(): a real adoption on the SECOND call still repaints (existing behaviour preserved)');
  const h = harness({ 'cc.rainbow': '0' });
  h.serverRef.ui_settings = { 'cc.rainbow': '0' };
  h.state.loadConfig().then(() => {
    ok('first call repainted once (forced)', h.calls.applySettings === 1, h.calls.applySettings);
    // simulate a Rainbow toggle landing server-side between polls — the NEXT poll must adopt it
    h.serverRef.ui_settings = { 'cc.rainbow': '1' };
    return h.state.loadConfig();
  }).then(() => {
    ok('a real cross-origin change on a later call still triggers a second repaint', h.calls.applySettings === 2, h.calls.applySettings);
    ok('localStorage actually adopted the new value', h.store['cc.rainbow'] === '1', h.store['cc.rainbow']);
    // and a third, unchanged call must NOT repaint a third time
    return h.state.loadConfig();
  }).then(() => {
    ok('a third call with nothing new to adopt does not repaint again', h.calls.applySettings === 2, h.calls.applySettings);
    finish();
  });
}

function finish() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
