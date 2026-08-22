// Regression test for the missing removeItem interception in the cross-origin cc.* settings sync.
//
// The bug: docker.js/settings.js/cc-theme.js each monkeypatch localStorage.setItem so every
// cc.* write gets queued into a pending map and pushed (debounced) into the engine's
// ui_settings mirror — that's how a toggle set on one browser/origin survives a reload from
// another. But only setItem was ever intercepted. Anything that clears a cc.* key via
// localStorage.removeItem() (settings.js' del(), the shares.js column-width "reset" control,
// the cc.rbpal migration cleanup, ...) never touched the pending map, so the deletion never
// reached the server, and adoptUISettings()/adopt() resurrected the OLD value on the very next
// load — confirmed live: remove a key, reload, watch it come back.
//
// This pins the fix: removeItem must now be intercepted exactly like setItem, in all three
// copies of the pattern (docker.js runs on /Docker, settings.js on /Settings/CannonadeCommand,
// cc-theme.js on every OTHER page — never more than one of the three active on any given page).
//
// The REAL sync block is pulled out of each shipped source, never re-typed.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');
const SETTINGS = process.argv[3] || path.join(DIR, 'settings.js');
const THEME = process.argv[4] || path.join(DIR, 'cc-theme.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
// The exported map is the SAME object the sandboxed closure mutates — reassigning `obj[key] = {}`
// would only rebind the property on our wrapper, not the closure's own variable, so clear it
// in place instead (delete every key) to get a genuine fresh-debounce-window reset.
const clearMap = (o) => Object.keys(o).forEach((k) => delete o[k]);

// Extract the literal source between a start marker (inclusive) and an end marker (exclusive) —
// same source-slicing spirit as icon-pipeline.test.js's grabFn(), just anchored on markers
// instead of a named function declaration (this sync block is inline code, not its own function).
function grabBetween(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('start marker not found: ' + startMarker);
  const e = src.indexOf(endMarker, s);
  if (e < 0) throw new Error('end marker not found after start: ' + endMarker);
  return src.slice(s, e);
}

function makeStorage() {
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
  };
  return { store, localStorage };
}

/* ── docker.js: unconditional patch (this file only ever loads ON /Docker) ─────────────── */
{
  const src = fs.readFileSync(DOCKER, 'utf8');
  const code = grabBetween(src,
    'var uiSyncT = null, uiSeeded = false, uiPending = {};',
    'function collectUISettings()');
  const { store, localStorage } = makeStorage();
  const win = {};
  const run = new Function('window', 'localStorage', 'pushUISettings', 'setTimeout', 'clearTimeout',
    code + '\nreturn { uiPending: uiPending };');
  const state = run(win, localStorage, () => {}, setTimeout, clearTimeout);

  console.log('\ndocker.js: cc.* setItem/removeItem both reach uiPending');
  localStorage.setItem('cc.iconcolor', '#ff0000');
  ok('setItem queues the key (unchanged prior behaviour)', state.uiPending['cc.iconcolor'] === 1);
  ok('setItem still writes through to the real store', store['cc.iconcolor'] === '#ff0000');
  clearMap(state.uiPending); // reset between the two assertions, same as a fresh debounce window
  localStorage.removeItem('cc.iconcolor');
  ok('removeItem NOW queues the same key for deletion (the fix)', state.uiPending['cc.iconcolor'] === 1);
  ok('removeItem still deletes from the real store', !('cc.iconcolor' in store));
  clearMap(state.uiPending);
  localStorage.setItem('other.key', '1');
  ok('a non-cc key is never queued', state.uiPending['other.key'] === undefined);
  clearMap(state.uiPending);
  localStorage.removeItem('cc.stateCache');
  ok('cc.stateCache is excluded from sync on removeItem too (paint cache, not a synced setting)', state.uiPending['cc.stateCache'] === undefined);
  ok('window.__ccLS exposes the raw setItem (used elsewhere for the debounce-free raw write)', typeof win.__ccLS === 'function');
  ok('window.__ccLSRemove exposes the raw removeItem the same way', typeof win.__ccLSRemove === 'function');
}

/* ── settings.js: same unconditional pattern, only loads on /Settings/CannonadeCommand ── */
{
  const src = fs.readFileSync(SETTINGS, 'utf8');
  const code = grabBetween(src,
    'var uiSyncT = null, uiPending = {};',
    'function collectUISettings()');
  const { store, localStorage } = makeStorage();
  const win = {};
  const run = new Function('window', 'localStorage', 'pushUISettings', 'setTimeout', 'clearTimeout',
    code + '\nreturn { uiPending: uiPending };');
  const state = run(win, localStorage, () => {}, setTimeout, clearTimeout);

  console.log('\nsettings.js: cc.* setItem/removeItem both reach uiPending');
  localStorage.setItem('cc.accent', '#2f6feb');
  ok('setItem queues the key', state.uiPending['cc.accent'] === 1);
  clearMap(state.uiPending);
  localStorage.removeItem('cc.accent');
  ok('removeItem NOW queues the same key for deletion (the fix)', state.uiPending['cc.accent'] === 1);
  ok('removeItem still deletes from the real store', !('cc.accent' in store));
}

/* ── cc-theme.js: guarded pattern, only engages OFF /Docker and /Settings/CannonadeCommand ── */
{
  const src = fs.readFileSync(THEME, 'utf8');
  const code = grabBetween(src,
    'if (/^\\/Docker(\\/|$)/.test(location.pathname) || /^\\/Settings\\/CannonadeCommand(\\/|$)/.test(location.pathname)) return;',
    'function push() {');

  console.log('\ncc-theme.js: same fix, on every OTHER page (Plugins/VMs/Shares/Favorites/Header)');
  {
    const { store, localStorage } = makeStorage();
    const win = {};
    const run = new Function('window', 'localStorage', 'location', 'push', 'setTimeout', 'clearTimeout',
      code + '\nreturn { pending: pending };');
    const state = run(win, localStorage, { pathname: '/Plugins' }, () => {}, setTimeout, clearTimeout);
    localStorage.setItem('cc.rainbow', '1');
    ok('on /Plugins: setItem queues the key', state.pending['cc.rainbow'] === 1);
    clearMap(state.pending);
    localStorage.removeItem('cc.rainbow');
    ok('on /Plugins: removeItem NOW queues the same key for deletion (the fix)', state.pending['cc.rainbow'] === 1);
    ok('on /Plugins: removeItem still deletes from the real store', !('cc.rainbow' in store));
  }
  {
    // On /Docker itself, cc-theme.js's OWN copy must stand down entirely (the pathname guard
    // returns before even declaring `pending`) so docker.js's copy is the only one active.
    const { localStorage } = makeStorage();
    const win = {};
    const origSet = localStorage.setItem, origRemove = localStorage.removeItem;
    // The pathname guard is a bare `return;` at the top of this block — on /Docker it fires
    // before `pending`/the setItem/removeItem patches are ever reached, so localStorage must
    // come out of this untouched (docker.js's own copy is the one active on that page).
    const run = new Function('window', 'localStorage', 'location', 'push', 'setTimeout', 'clearTimeout', code);
    run(win, localStorage, { pathname: '/Docker' }, () => {}, setTimeout, clearTimeout);
    ok('on /Docker: cc-theme.js leaves localStorage.setItem alone (docker.js already owns it)', localStorage.setItem === origSet);
    ok('on /Docker: cc-theme.js leaves localStorage.removeItem alone (docker.js already owns it)', localStorage.removeItem === origRemove);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
