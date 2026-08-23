// Regression test: Folder view's per-folder state — collapse/expand persistence, per-folder
// "Gestoppte ausblenden" filtering, live-search auto-expand, and the bulk-action target list
// (v4.34.0, adopted from the Docker Folders comparison the user requested and approved).
//
// All of these are pure functions of localStorage + an explicit byParent entry tree, deliberately
// extracted OUT of renderFolderView()'s closures for exactly this reason — this file source-slices
// the REAL isFolderCollapsed()/setFolderCollapsed()/folderHidesStopped()/setFolderHideStopped()/
// ccFolderHidesContainer()/ccEntryMatches()/ccEffectiveCollapsed()/ccCollectFolderContainerNames()
// out of docker.js (never re-typed) and proves each one in isolation, with no DOM required at all.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// FOLDER_COLLAPSED_KEY and FOLDER_HIDESTOPPED_KEY are declared together in ONE statement
// ("var A = ..., B = ...;") — grabbing either name pulls the whole statement, which defines both.
function grabVar(name) {
  const m = src.match(new RegExp('var ' + name + ' = [^;]+;'));
  if (!m) throw new Error('var not found in docker.js: ' + name);
  return m[0];
}

const dockerApi = new Function('localStorage',
  grabVar('FOLDER_COLLAPSED_KEY') + '\n' +
  grabFn('norm') + '\n' +
  grabFn('readIdMap') + '\n' + grabFn('writeIdMapFlag') + '\n' +
  grabFn('isFolderCollapsed') + '\n' + grabFn('setFolderCollapsed') + '\n' +
  grabFn('folderHidesStopped') + '\n' + grabFn('setFolderHideStopped') + '\n' +
  grabFn('ccFolderHidesContainer') + '\n' +
  grabFn('ccEntryMatches') + '\n' + grabFn('ccEffectiveCollapsed') + '\n' +
  grabFn('ccCollectFolderContainerNames') + '\n' +
  'return { isFolderCollapsed: isFolderCollapsed, setFolderCollapsed: setFolderCollapsed, ' +
  'folderHidesStopped: folderHidesStopped, setFolderHideStopped: setFolderHideStopped, ' +
  'ccFolderHidesContainer: ccFolderHidesContainer, ccEntryMatches: ccEntryMatches, ' +
  'ccEffectiveCollapsed: ccEffectiveCollapsed, ccCollectFolderContainerNames: ccCollectFolderContainerNames };'
)(localStorage);

console.log('\nCollapse/expand persistence (adopted recommendation) — keyed by folder id, cc.folderCollapsed');
{
  reset();
  ok('a folder never touched is NOT collapsed by default', dockerApi.isFolderCollapsed('fA') === false);
  dockerApi.setFolderCollapsed('fA', true);
  ok('setFolderCollapsed(id, true) persists', localStorage.getItem('cc.folderCollapsed') === JSON.stringify({ fA: true }));
  ok('isFolderCollapsed() now reads true for that id', dockerApi.isFolderCollapsed('fA') === true);
  ok('a DIFFERENT folder id is unaffected (per-folder, not global)', dockerApi.isFolderCollapsed('fB') === false);
  dockerApi.setFolderCollapsed('fA', false);
  ok('setFolderCollapsed(id, false) clears the entry entirely (not just flips it to false)', localStorage.getItem('cc.folderCollapsed') === JSON.stringify({}));
  ok('isFolderCollapsed() now reads false again', dockerApi.isFolderCollapsed('fA') === false);
  localStorage.setItem('cc.folderCollapsed', 'not valid json {{{');
  ok('corrupted stored state degrades to "nothing collapsed" instead of throwing', dockerApi.isFolderCollapsed('fA') === false);
  reset();
}

console.log('\nPer-folder "Gestoppte ausblenden" (adopted recommendation) — independent per folder, not global');
{
  reset();
  ok('off by default for an untouched folder', dockerApi.folderHidesStopped('media') === false);
  dockerApi.setFolderHideStopped('media', true);
  ok('setFolderHideStopped(id, true) persists', dockerApi.folderHidesStopped('media') === true);
  ok('a different folder is unaffected', dockerApi.folderHidesStopped('tools') === false);
  dockerApi.setFolderHideStopped('media', false);
  ok('setFolderHideStopped(id, false) clears it', dockerApi.folderHidesStopped('media') === false);
  reset();
}

console.log('\nccFolderHidesContainer(): the actual filtering predicate used while rendering');
{
  reset();
  const running = { name: 'plex', state: 'running' };
  const stopped = { name: 'radarr', state: 'exited' };
  ok('toggle OFF: nothing is hidden, running or not', !dockerApi.ccFolderHidesContainer('media', running) && !dockerApi.ccFolderHidesContainer('media', stopped));
  dockerApi.setFolderHideStopped('media', true);
  ok('toggle ON: a RUNNING container in that folder stays visible', !dockerApi.ccFolderHidesContainer('media', running));
  ok('toggle ON: a STOPPED container in that folder is hidden', dockerApi.ccFolderHidesContainer('media', stopped));
  ok('toggle ON but a DIFFERENT folder: unaffected (per-folder, not global)', !dockerApi.ccFolderHidesContainer('tools', stopped));
  ok('never throws on a missing container object (edge case)', dockerApi.ccFolderHidesContainer('media', null) === false);
  reset();
}

// A small nested tree: root -> [Media (folder), plex (container)]; Media -> [sonarr (container), Nested (folder)]; Nested -> [radarr (container)]
const ROOT = 'root';
const folderMedia = { id: 'fMedia', type: 'folder', name: 'Media', parentId: ROOT };
const folderNested = { id: 'fNested', type: 'folder', name: 'Nested', parentId: 'fMedia' };
const cPlex = { id: 'cPlex', type: 'container', name: '/plex', parentId: ROOT };
const cSonarr = { id: 'cSonarr', type: 'container', name: '/sonarr', parentId: 'fMedia' };
const cRadarr = { id: 'cRadarr', type: 'container', name: '/radarr', parentId: 'fNested' };
const byParent = { [ROOT]: [folderMedia, cPlex], fMedia: [cSonarr, folderNested], fNested: [cRadarr] };

console.log('\nccEntryMatches(): live-search matching (bug #1 fix), recursive through nested folders');
{
  ok('empty filter: everything "matches" (nothing gets hidden by search)', dockerApi.ccEntryMatches(byParent, '', folderMedia) && dockerApi.ccEntryMatches(byParent, '', cPlex));
  ok('a container matches on its OWN name (leading "/" stripped)', dockerApi.ccEntryMatches(byParent, 'plex', cPlex));
  ok('a container that does not match returns false', !dockerApi.ccEntryMatches(byParent, 'zzz-nomatch', cPlex));
  ok('a folder matches on its OWN name too', dockerApi.ccEntryMatches(byParent, 'media', folderMedia));
  ok('a folder matches via a DIRECT child container', dockerApi.ccEntryMatches(byParent, 'sonarr', folderMedia));
  ok('a folder matches via a match buried in a NESTED sub-folder (recursive)', dockerApi.ccEntryMatches(byParent, 'radarr', folderMedia));
  ok('the nested sub-folder itself also matches on that same buried container', dockerApi.ccEntryMatches(byParent, 'radarr', folderNested));
  ok('a folder with no matching name and no matching descendant anywhere returns false', !dockerApi.ccEntryMatches(byParent, 'zzz-nomatch', folderMedia));
}

console.log('\nccEffectiveCollapsed(): live-search AUTO-EXPAND (adopted recommendation) — never overrides a folder shut, only open, and only while searching');
{
  reset();
  ok('no persisted collapse, no filter: stays expanded', dockerApi.ccEffectiveCollapsed(byParent, '', folderMedia) === false);
  dockerApi.setFolderCollapsed('fMedia', true);
  ok('persisted collapsed, no active search: stays collapsed', dockerApi.ccEffectiveCollapsed(byParent, '', folderMedia) === true);
  ok('persisted collapsed, search matches something INSIDE it (nested): AUTO-EXPANDS', dockerApi.ccEffectiveCollapsed(byParent, 'radarr', folderMedia) === false);
  ok('persisted collapsed, search matches nothing in it: stays collapsed (auto-expand is NOT "expand everything")', dockerApi.ccEffectiveCollapsed(byParent, 'zzz-nomatch', folderMedia) === true);
  ok('clearing the filter restores the PERSISTED collapse state automatically (nothing was ever overwritten)', dockerApi.ccEffectiveCollapsed(byParent, '', folderMedia) === true);
  dockerApi.setFolderCollapsed('fMedia', false);
  ok('persisted EXPANDED + a search that matches: stays expanded (no double-open weirdness)', dockerApi.ccEffectiveCollapsed(byParent, 'sonarr', folderMedia) === false);
  reset();
}

console.log('\nccCollectFolderContainerNames(): bulk start/stop target list (adopted recommendation), recursive through nested folders');
{
  const exists = nm => ['plex', 'sonarr', 'radarr'].indexOf(nm) >= 0; // stands in for containerByName()
  const names = dockerApi.ccCollectFolderContainerNames(byParent, 'fMedia', exists).sort();
  ok('collects the DIRECT child container', names.indexOf('sonarr') >= 0, JSON.stringify(names));
  ok('collects a container buried in a NESTED sub-folder too', names.indexOf('radarr') >= 0, JSON.stringify(names));
  ok('does NOT include a sibling outside this folder (plex lives at root)', names.indexOf('plex') < 0, JSON.stringify(names));
  ok('exactly the two containers under Media, nothing more', names.length === 2, JSON.stringify(names));
  const rootNames = dockerApi.ccCollectFolderContainerNames(byParent, ROOT, exists).sort();
  ok('called from root: recurses through EVERY folder under it too, collecting all three containers', rootNames.length === 3 && rootNames.join(',') === 'plex,radarr,sonarr', JSON.stringify(rootNames));
  const unknown = dockerApi.ccCollectFolderContainerNames(byParent, 'fMedia', () => false);
  ok('a container unknown to CC (existsFn false) is skipped, never crashes', Array.isArray(unknown) && unknown.length === 0);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
