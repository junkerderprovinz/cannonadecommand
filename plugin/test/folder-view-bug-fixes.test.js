// Regression pins for the three confirmed pre-existing Folder view bugs fixed in v4.34.0:
//
//   #1  Filter didn't work in folder mode — applyFilter() only ever handled mode === "grid"
//       explicitly; every other mode (folder included) fell through to findRows() over the
//       hidden native table, which folder mode's rendering never drove.
//   #2  Stats didn't poll in folder mode — both refresh() and the 3.5s stats timer in
//       startTimers() gated on mode === "grid" (or list-with-resource-column) only, so folder
//       mode's CPU/RAM/NET readouts went stale and never updated.
//   #3  Multiple call sites re-rendered the flat grid over the folder grouping — several
//       "if (mode === list) ... else renderGrid()" call sites silently replaced Folder view's
//       grouping with the flat grid on things like an icon-mode change, a settings adopt-toggle
//       flip, or a saved limit.
//
// This file source-slices the REAL applyFilter()/refresh()/renderCurrentView() out of docker.js
// (never re-typed), runs them behaviourally with stubbed collaborators, AND source-audits the
// file so a future edit that reintroduces any of the three old patterns fails loudly here.
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

/* ══════════════════════ Bug #1 — filter didn't work in folder mode ══════════════════════ */
console.log('\nBug #1 fix: applyFilter() now has an explicit "folder" branch (source shape)');
{
  const applyFilterSrc = grabFn('applyFilter');
  ok('applyFilter() explicitly branches on mode === "folder"', /mode === "folder"/.test(applyFilterSrc));
  ok('the folder branch calls renderFolderView() (a real re-render), not the old native-table fallback', /mode === "folder"[\s\S]*?renderFolderView\(\)/.test(applyFilterSrc));

  console.log('\nBug #1 fix: applyFilter() behavioural proof (which path actually fires per mode)');
  function run(mode, ccOrgView, gh, findRowsCb, renderFolderViewCb) {
    const fn = new Function('mode', 'filterText', 'gridHolder', 'ccOrgView', 'norm', 'renderFolderView', 'findRows',
      applyFilterSrc + '\nreturn applyFilter;'
    )(mode, 'sonarr', gh, ccOrgView, s => s, renderFolderViewCb, findRowsCb);
    fn();
  }
  {
    const card = { dataset: { name: 'plex' }, style: {} };
    const gh = { querySelectorAll: () => [card] };
    let findRowsCalled = false;
    run('grid', null, gh, () => { findRowsCalled = true; return []; }, () => {});
    ok('grid mode: unaffected by the fix, still toggles cards directly (no regression)', !findRowsCalled);
  }
  {
    let findRowsCalled = false, folderViewCalled = false;
    run('folder', { flatEntries: [] }, null, () => { findRowsCalled = true; return []; }, () => { folderViewCalled = true; });
    ok('folder mode: calls renderFolderView() — THE bug #1 fix', folderViewCalled);
    ok('folder mode: never falls through to findRows() over the hidden native table — THE bug #1 itself', !findRowsCalled);
  }
  {
    let folderViewCalled = false, threw = false;
    try { run('folder', null, null, () => [], () => { folderViewCalled = true; }); } catch (e) { threw = true; }
    ok('folder mode before the organizer has loaded (ccOrgView still null): guarded, does not throw', !threw);
    ok('...and does not call renderFolderView() blind against missing data', !folderViewCalled);
  }
  {
    let findRowsCalled = false;
    run('list', null, null, () => { findRowsCalled = true; return []; }, () => {});
    ok('list mode: unaffected by the fix, still drives findRows() over the native table (no regression)', findRowsCalled);
  }
}

/* ══════════════════════ Bug #2 — stats didn't poll in folder mode ══════════════════════ */
console.log('\nBug #2 fix: refresh()\'s stats-polling gate now includes mode === "folder" (source shape)');
{
  const refreshSrc = grabFn('refresh');
  ok('refresh() explicitly includes mode === "folder" in its refreshStats() gate', /mode === "folder"/.test(refreshSrc));

  console.log('\nBug #2 fix: refresh() behavioural proof (which modes actually trigger refreshStats())');
  function runRefresh(mode, colOnRes) {
    let statsCalled = false;
    const fn = new Function('mode', 'colOn', 'applyMode', 'refreshStats', refreshSrc + '\nreturn refresh;')(
      mode, () => colOnRes, () => {}, () => { statsCalled = true; }
    );
    fn();
    return statsCalled;
  }
  ok('grid mode: refreshStats() fires (unaffected baseline)', runRefresh('grid', false));
  ok('folder mode: refreshStats() fires — THE bug #2 fix (it never did before)', runRefresh('folder', false));
  ok('list mode WITHOUT the resource column shown: refreshStats() correctly skipped (unrelated, unaffected)', !runRefresh('list', false));
  ok('list mode WITH the resource column shown: refreshStats() still fires (pre-existing behaviour preserved)', runRefresh('list', true));
}
console.log('\nBug #2 fix, second half: the 3.5s stats-polling timer in startTimers() also includes folder mode');
{
  // refresh() alone only covers a manual re-render trigger; this SEPARATE interval is what
  // actually keeps CPU/RAM/NET ticking on a clock while the tab just sits open — both had the
  // exact same "grid" only gate and both had to be fixed for the bug to be genuinely gone.
  const m = src.match(/setInterval\(function \(\) \{[\s\S]*?\}, 3500\)\);/);
  ok('the 3.5s polling interval was found in the source', !!m);
  ok('...and it now includes mode === "folder" in its condition', !!m && /mode === "folder"/.test(m[0]), m && m[0]);
}

/* ══════════════ Bug #3 — call sites silently dropped back to the flat grid ══════════════ */
console.log('\nBug #3 fix: renderCurrentView() is the single dispatch chokepoint (source shape)');
{
  const dispatcherSrc = grabFn('renderCurrentView');
  ok('renderCurrentView() checks mode === "folder" before falling back to the flat grid', /mode === "folder"[\s\S]*?renderFolderView\(\)/.test(dispatcherSrc));
  ok('...and calls renderGrid() as the fallback for every other theming mode', /renderGrid\(\)/.test(dispatcherSrc));

  console.log('\nBug #3 fix: renderCurrentView() behavioural proof');
  function runDispatch(mode) {
    const calls = [];
    const fn = new Function('mode', 'renderFolderView', 'renderGrid', dispatcherSrc + '\nreturn renderCurrentView;')(
      mode, () => calls.push('folder'), () => calls.push('grid')
    );
    fn();
    return calls;
  }
  ok('mode === "folder": routes to renderFolderView(), never renderGrid()', JSON.stringify(runDispatch('folder')) === JSON.stringify(['folder']));
  ok('mode === "grid": routes to renderGrid()', JSON.stringify(runDispatch('grid')) === JSON.stringify(['grid']));
}
console.log('\nBug #3 fix: source audit — every former "list vs. bare renderGrid()" call site now routes through renderCurrentView()');
{
  // A bare "else renderGrid();" silently drops Folder view back to the flat grid the moment its
  // trigger fires. Exactly ONE is allowed to remain in the whole file: renderCurrentView()'s own
  // necessary internal fallback. Any OTHER occurrence is exactly the bug #3 pattern regressing.
  const bareElseRenderGrid = (src.match(/else renderGrid\(\);/g) || []).length;
  ok('exactly ONE "else renderGrid();" left in the whole file', bareElseRenderGrid === 1, bareElseRenderGrid);
  const dispatcherSrc = grabFn('renderCurrentView');
  ok('...and it lives INSIDE renderCurrentView() itself, not scattered across call sites', dispatcherSrc.indexOf('else renderGrid();') >= 0);

  // The exact old buggy shape ("if (mode === \"list\") <x>; else renderGrid();") must be entirely gone.
  const stillBuggy = (src.match(/mode === "list"[^\n]*else renderGrid\(\);/g) || []).length;
  ok('none of the old "if list ... else renderGrid()" call sites remain anywhere', stillBuggy === 0, stillBuggy);

  // Every one of the seven confirmed former bug sites (loadConfig, setRb, setAc, restart-policy
  // save, bandwidth save, limits save, saveEditor) now falls back through renderCurrentView().
  const routed = (src.match(/else renderCurrentView\(\);/g) || []).length;
  ok('exactly the 7 known former bug sites now read "else renderCurrentView();"', routed === 7, routed);

  // The two remaining call sites (an icon-mode-select change, and the cross-origin storage-sync
  // listener) use a slightly different shape ("if (mode !== list) …" / "else if (mode === grid
  // || mode === folder) …") — confirm those were fixed too, by name, not just by pattern count.
  ok('the icon-mode-select change site now reads "renderCurrentView()", not a bare renderGrid()', /if \(mode !== "list"\) renderCurrentView\(\);/.test(src));
  ok('the storage-sync listener (theming-toggle, adopt-toggle from another tab) now covers folder mode explicitly', /mode === "grid" \|\| mode === "folder"\) renderCurrentView\(\);/.test(src));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
