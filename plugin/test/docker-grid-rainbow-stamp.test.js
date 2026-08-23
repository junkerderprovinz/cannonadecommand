// Regression test: genuine PER-CARD rainbow rotation in Docker's GRID/FOLDER view (v4.33.1).
//
// The bug (confirmed via source, not guessed, then live on Bottich): applyRainbowPalette()
// stamps a rotating --cc-rb-c/--cc-rb-ct on every #docker_list tr.sortable (LIST mode), which
// docker.css's var(--cc-iconbg-color, var(--cc-rb-c, var(--cc-accent))) fallback chain then
// resolves per row. GRID and FOLDER mode build their tiles through the SAME card() function, but
// nothing ever stamped --cc-rb-c on a .cc-card — so the chain always fell through to the flat
// --cc-accent, and every card showed the identical colour with no rotation at all, live-verified
// on a real box (every card the same accent, while the equivalent list rows correctly rotated).
//
// This mattered a lot more once the "Badge-Einstellungen übernehmen" master toggle became the
// ONLY way an icon badge follows Rainbow mode (v4.33.1): the whole point of "rainbow mode for the
// logos too" collapses if the badges it adopts into never actually rotate per item in the two
// icon-driven views (Grid, Folder).
//
// Fixed inside card() itself (stampCardRainbow()), so both renderGrid() and renderFolderView()
// get it for free — this file source-slices that REAL function (never re-typed) and proves:
//   1. distinct containers get DISTINCT rotating colours, matching the exact palette/offset
//      machinery applyRainbowPalette() already uses for list rows (ccRbColor()/ccPalActive()/
//      RB_OFFSET) — same palette, same offset, same rotation source, per the design brief;
//   2. the SAME container name always gets the SAME colour (deterministic — switching between
//      Grid and Folder view can't make a badge jump around);
//   3. --cc-rb-ct is always idealText() of the paired --cc-rb-c (auto contrast, never hardcoded);
//   4. Rainbow off (or theming off) clears both vars instead of leaving a stale stamp;
//   5. cc.rainbowrot=0 collapses rotation to a fixed offset, exactly like list mode.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// A minimal stand-in for the .cc-card element stampCardRainbow() writes onto — only the two
// methods it actually calls, so a signature drift on the real card() DOM builder can't hide here.
function fakeWrap() {
  const w = { _s: {} };
  w.style = {
    setProperty: (k, v) => { w._s[k] = v; },
    removeProperty: (k) => { delete w._s[k]; }
  };
  return w;
}

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

// containerNames is docker.js's own module-level var (indexState() keeps it alphabetically
// sorted); stampCardRainbow() reads it directly, so the harness declares it the same way rather
// than passing it as a parameter — exactly how it exists in the real module scope.
const dockerApi = new Function('localStorage',
  'var RB_PAL = ["#d9433f","#f97316","#eab308","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  'var containerNames = [];\n' +
  grabFn('themingOn') + '\n' + grabFn('idealText') + '\n' + grabFn('ccPalActive') + '\n' + grabFn('ccRbColor') + '\n' + grabFn('stampCardRainbow') + '\n' +
  'return { stampCardRainbow: stampCardRainbow, ccRbColor: ccRbColor, idealText: idealText, setNames: function (n) { containerNames = n; } };'
)(global.localStorage);

console.log('\nRainbow OFF (or theming off): no stamp at all — clears any stale --cc-rb-c/--cc-rb-ct instead of leaving one behind');
{
  reset();
  dockerApi.setNames(['alpha', 'beta', 'gamma']);
  const w = fakeWrap();
  w._s['--cc-rb-c'] = '#stale'; w._s['--cc-rb-ct'] = '#stale2';   // simulate a leftover stamp from a previous rainbow-on render
  dockerApi.stampCardRainbow(w, 'beta');
  ok('Rainbow unset: --cc-rb-c is cleared, not left stale', !('--cc-rb-c' in w._s));
  ok('Rainbow unset: --cc-rb-ct is cleared too', !('--cc-rb-ct' in w._s));

  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.theming', '0');
  const w2 = fakeWrap(); w2._s['--cc-rb-c'] = '#stale';
  dockerApi.stampCardRainbow(w2, 'beta');
  ok('theming off (even with cc.rainbow=1): still no stamp', !('--cc-rb-c' in w2._s));
  reset();
}

console.log('\nRainbow ON: distinct containers get DISTINCT rotating colours, matching ccRbColor() exactly (same palette/offset applyRainbowPalette() uses for list rows)');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  const names = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india'];
  dockerApi.setNames(names.slice().sort());   // containerNames is always alphabetically sorted (indexState())

  const colours = names.map(n => { const w = fakeWrap(); dockerApi.stampCardRainbow(w, n); return w._s['--cc-rb-c']; });
  ok('every card actually received a --cc-rb-c value', colours.every(c => !!c), JSON.stringify(colours));

  const distinct = new Set(colours);
  ok('MORE THAN ONE distinct colour across 9 containers over an 8-colour palette — genuine rotation, not one flat colour for every card (the confirmed live bug)', distinct.size > 1, JSON.stringify(colours));

  names.forEach((n, sortedIdxIgnored) => {
    const idx = names.slice().sort().indexOf(n);
    const want = dockerApi.ccRbColor(idx);
    const w = fakeWrap();
    dockerApi.stampCardRainbow(w, n);
    ok('container "' + n + '" (sorted index ' + idx + ') matches ccRbColor(' + idx + ') exactly — same pal/offset machinery as list mode\'s per-row stamping', w._s['--cc-rb-c'] === want, w._s['--cc-rb-c'] + ' vs ' + want);
  });
}

console.log('\nSAME container name always gets the SAME colour — deterministic, so a badge never jumps around switching Grid <-> Folder view');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  dockerApi.setNames(['jdownloader', 'nextcloud', 'plex', 'sonarr']);
  const w1 = fakeWrap(); dockerApi.stampCardRainbow(w1, 'plex');
  const w2 = fakeWrap(); dockerApi.stampCardRainbow(w2, 'plex');
  ok('two independent stamping passes for the SAME name produce the IDENTICAL colour', w1._s['--cc-rb-c'] === w2._s['--cc-rb-c'], w1._s['--cc-rb-c'] + ' vs ' + w2._s['--cc-rb-c']);
  ok('and the identical contrast ink too', w1._s['--cc-rb-ct'] === w2._s['--cc-rb-ct']);
}

console.log('\n--cc-rb-ct is always the automatic contrast colour for its paired --cc-rb-c (idealText, never hardcoded)');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  dockerApi.setNames(names);
  names.forEach(n => {
    const w = fakeWrap();
    dockerApi.stampCardRainbow(w, n);
    ok('"' + n + '": --cc-rb-ct === idealText(--cc-rb-c)', w._s['--cc-rb-ct'] === dockerApi.idealText(w._s['--cc-rb-c']), w._s['--cc-rb-ct'] + ' vs idealText(' + w._s['--cc-rb-c'] + ')');
  });
}

console.log('\nA container missing from containerNames (edge case) degrades to a valid, non-throwing colour instead of crashing the render');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  dockerApi.setNames(['known-one', 'known-two']);
  const w = fakeWrap();
  let threw = false;
  try { dockerApi.stampCardRainbow(w, 'totally-unknown-container'); } catch (e) { threw = true; }
  ok('does not throw for a name absent from containerNames', !threw);
  ok('still stamps SOME valid --cc-rb-c (falls back to index 0)', /^#[0-9a-f]{6}$/i.test(w._s['--cc-rb-c'] || ''), w._s['--cc-rb-c']);
}

console.log('\ncc.rainbowrot=0 collapses rotation to a fixed offset — matches list mode\'s applyRainbowPalette() exactly');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.rainbowrot', '0');
  dockerApi.setNames(['zulu', 'yankee', 'xray'].slice().sort());   // containerNames is always alphabetically sorted (indexState())
  const w1 = fakeWrap(); dockerApi.stampCardRainbow(w1, 'zulu');
  const w2 = fakeWrap(); dockerApi.stampCardRainbow(w2, 'yankee');
  // sorted order: xray(0), yankee(1), zulu(2) — with RB_OFFSET pinned to 0 in this harness,
  // "no rotation" and "offset 0" are indistinguishable, so assert against ccRbColor() directly,
  // which already reads the SAME cc.rainbowrot key.
  ok('zulu (sorted index 2) still matches ccRbColor(2) with rotation disabled', w1._s['--cc-rb-c'] === dockerApi.ccRbColor(2), w1._s['--cc-rb-c']);
  ok('yankee (sorted index 1) still matches ccRbColor(1) with rotation disabled', w2._s['--cc-rb-c'] === dockerApi.ccRbColor(1), w2._s['--cc-rb-c']);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
