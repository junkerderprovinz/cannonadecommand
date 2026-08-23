// Regression test for the "badges stuck in rainbow mode even though it's deactivated" report on
// the VMs (and Plugins/SettingsGrid/Header/Shares) tabs.
//
// The bug: cc-theme.js's cross-browser cc.* settings sync (the only sync mechanism those areas
// have — they carry no loadConfig()-style copy of their own like docker.js/settings.js do) used
// to silently correct localStorage from the server's ui_settings mirror on every page load, but
// NEVER repainted the page that had already drawn itself with the stale (pre-correction) value.
// The shipped comment even said so in plain words: "no forced reload here, this file has no
// re-render hook." A user who toggled Rainbow off on one browser/device would see the OLD colours
// stuck on VMs/Plugins on the FIRST load from a different browser — and it would look fixed on a
// retest, because by then the first load had already silently corrected localStorage, masking the
// bug on the very next reload (exactly the trap described in the bug report).
//
// The fix: after adopt() actually WRITES a changed key, call every well-known "repaint this
// area" global hook that happens to exist on the current page — the SAME window.cc<Area>Apply
// convention the Settings page's own live toggle already uses (ccHeaderApply/ccSharesApply/
// ccVmsApply/ccPluginsApply/ccSettingsGridApply). This pins: the hooks fire when adopt() actually
// changed something, they do NOT fire when nothing changed, and a hook that throws never breaks
// the sync loop or blocks a sibling hook from still running.
//
// The REAL sync block is pulled out of the shipped source, never re-typed (same spirit as
// ui-settings-remove-sync.test.js's grabBetween()).
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const THEME = process.argv[2] || path.join(DIR, 'cc-theme.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// Grab from the start marker to end-of-file, then drop the outer file-wrapping IIFE's own
// closing `})();` — the file is `(function(){ ... (function(){ ...sync... })(); })();`, and we
// want only the inner sync IIFE, self-closing, as real standalone runnable code.
function grabSyncBlock(src) {
  const startMarker = '(function () {\n    if (/^\\/Docker(\\/|$)/.test(location.pathname)';
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('start marker not found: ' + startMarker);
  var rest = src.slice(s);
  var tail = '\n})();\n';
  if (!rest.endsWith(tail)) throw new Error('unexpected file tail — outer IIFE closer not found');
  return rest.slice(0, rest.length - tail.length); // keeps the inner "  })();", drops the outer one
}

function makeStorage(initial) {
  const store = Object.assign({}, initial);
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
  };
  return { store, localStorage };
}

// Runs the real sync IIFE (guarded to skip /Docker and /Settings/CannonadeCommand — this test
// always runs it as if on /Plugins, matching the report) with a fetch stub that answers the
// config GET with the given ui_settings, and returns after the sync's own promise chain settles.
function runSync(src, ui_settings, localStorage, win) {
  const code = grabSyncBlock(src);
  const fetchStub = (url) => Promise.resolve({ ok: true, json: () => Promise.resolve({ ui_settings: ui_settings }) });
  const run = new Function('window', 'localStorage', 'location', 'fetch', 'document', 'setTimeout', 'clearTimeout', code);
  run(win, localStorage, { pathname: '/Plugins' }, fetchStub, { querySelector: () => null, cookie: '' }, setTimeout, clearTimeout);
}

const src = fs.readFileSync(THEME, 'utf8');

console.log('cc-theme.js: adopt() calls the known area repaint hooks when (and only when) it actually changed something');

// 1) A real correction (local stale, server says "0") must fire every present hook.
{
  const { store, localStorage } = makeStorage({ 'cc.rainbow': '1' });
  const calls = { vms: 0, plugins: 0, header: 0 };
  const win = { ccVmsApply: () => { calls.vms++; }, ccPluginsApply: () => { calls.plugins++; }, ccHeaderApply: () => { calls.header++; } };
  runSync(src, { 'cc.rainbow': '0' }, localStorage, win);
  return new Promise(r => setTimeout(r, 20)).then(() => {
    ok('a real adopt corrects localStorage', store['cc.rainbow'] === '0', store['cc.rainbow']);
    ok('ccVmsApply fires', calls.vms === 1, calls.vms);
    ok('ccPluginsApply fires', calls.plugins === 1, calls.plugins);
    ok('ccHeaderApply fires (a page can host more than one area, e.g. header+settingsgrid on /Main)', calls.header === 1, calls.header);
  }).then(run2);
}

function run2() {
  console.log('\ncc-theme.js: no correction needed -> no hook fires (never a render loop)');
  const { store, localStorage } = makeStorage({ 'cc.rainbow': '0' });
  const calls = { vms: 0 };
  const win = { ccVmsApply: () => { calls.vms++; } };
  runSync(src, { 'cc.rainbow': '0' }, localStorage, win);
  return new Promise(r => setTimeout(r, 20)).then(() => {
    ok('localStorage already matched the server -> nothing to adopt', store['cc.rainbow'] === '0');
    ok('ccVmsApply never fires when adopt() changed nothing', calls.vms === 0, calls.vms);
  }).then(run3);
}

function run3() {
  console.log('\ncc-theme.js: a missing or throwing hook never breaks the sync or its siblings');
  const { localStorage } = makeStorage({});
  const calls = { plugins: 0 };
  // ccVmsApply intentionally absent (that area isn't loaded on this page); ccPluginsApply throws.
  const win = { ccHeaderApply: () => { throw new Error('boom'); }, ccPluginsApply: () => { calls.plugins++; } };
  let threw = false;
  try { runSync(src, { 'cc.rainbow': '1' }, localStorage, win); } catch (e) { threw = true; }
  return new Promise(r => setTimeout(r, 20)).then(() => {
    ok('a throwing hook does not escape the sync', !threw);
    ok('a sibling hook after the throwing one still runs', calls.plugins === 1, calls.plugins);
  }).then(finish);
}

function finish() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
