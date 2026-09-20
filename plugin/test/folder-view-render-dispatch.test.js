// Runs renderFolderView() out of docker.js against a synthetic organizer tree,
// with its collaborators (card, folderChip, folderListRow, ensureGridHolder,
// makeGear and the rest) stubbed, as in folder-view-bug-fixes.test.js.
//
// It pins two things: the three densities dispatch through one render path, so
// collapse, hide-stopped, bulk actions and search auto-expand work in each of
// them, and a rebuild puts the page back at the scroll position it was at.
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

// A DOM shim for el()-built nodes and a stand-in gridHolder.
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle() {}
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.dataset = {};
    this.listeners = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.draggable = false;
  }
  get className() { return this._cls; }
  set className(v) { this._cls = String(v); this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
function el(tag, cls, txt) { const n = new N(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

function run(entries, density, opts) {
  opts = opts || {};
  const scrollCalls = [];
  const fakeGridHolder = new N('div');
  let removed = false;
  const fakeWindow = {
    _scrollY: opts.scrollY != null ? opts.scrollY : 0,
    get scrollY() { return this._scrollY; },
    scrollTo(x, y) { scrollCalls.push([x, y]); },
  };
  const byParentEntries = entries; // {id, type, name, parentId, position} per entry
  const ccOrgView = opts.noOrgView ? null : { rootId: 'root', flatEntries: byParentEntries };
  const containers = {}; (opts.containers || []).forEach(c => { containers[c.name.replace(/^\//, '').toLowerCase()] = c; });

  const fn = new Function(
    'el', 'window', 'localStorage', 'gridHolder', 'ccOrgView', 'filterText', 'mode', 'menu', 'menuAnchor',
    'ensureGridHolder', 'removeGridHolder', 'relocateTopBar', 'effc', 'makeGear', 'applyIconTint',
    'folderDensity', 'card', 'folderChip', 'folderListRow', 'containerByName', 'ccFolderHidesContainer', 't',
    'iconBgOn',
    grabFn('renderFolderView') + '\nreturn renderFolderView;'
  )(
    el, fakeWindow, { getItem: () => null }, fakeGridHolder, ccOrgView, '', 'folder', null, null,
    () => {}, () => { removed = true; }, () => {}, () => '', () => el('button', 'cc-hgear'), () => {},
    () => density,
    () => el('div', 'cc-card cc-card-full-marker'),
    () => el('div', 'cc-card cc-chip cc-chip-marker'),
    () => el('div', 'cc-card cc-frow cc-frow-marker'),
    (name) => containers[String(name).toLowerCase()] || null,
    () => false,
    (k) => k,
    // iconBgOn(), which renderFolderView() gates .cc-docker-iconbg on.
    () => false
  );
  fn();
  return { gridHolder: fakeGridHolder, scrollCalls: scrollCalls, removed: removed };
}

console.log('\nrenderFolderView() dispatches to the right per-item builder for each density');
{
  const c = { name: '/plex', state: 'running' };
  const entry = { id: 'e1', type: 'container', name: '/plex', parentId: 'root', position: 0 };

  const full = run([entry], 'full', { containers: [c] });
  const gridD = run([entry], 'grid', { containers: [c] });
  const listD = run([entry], 'list', { containers: [c] });

  function findMarker(gh, cls) { const walk = n => n.children.reduce((f, ch) => f || (ch.classList.contains(cls) ? ch : walk(ch)), null); return walk(gh); }

  ok('"full" density uses card()', !!findMarker(full.gridHolder, 'cc-card-full-marker'));
  ok('"full" density uses neither folderChip() nor folderListRow()', !findMarker(full.gridHolder, 'cc-chip-marker') && !findMarker(full.gridHolder, 'cc-frow-marker'));

  ok('"grid" density uses folderChip()', !!findMarker(gridD.gridHolder, 'cc-chip-marker'));
  ok('"grid" density uses neither card() nor folderListRow()', !findMarker(gridD.gridHolder, 'cc-card-full-marker') && !findMarker(gridD.gridHolder, 'cc-frow-marker'));

  ok('"list" density uses folderListRow()', !!findMarker(listD.gridHolder, 'cc-frow-marker'));
  ok('"list" density uses neither card() nor folderChip()', !findMarker(listD.gridHolder, 'cc-card-full-marker') && !findMarker(listD.gridHolder, 'cc-chip-marker'));
}

console.log('\nrenderFolderView() preserves the scroll position across a full rebuild');
{
  console.log('\n  ...with an empty organizer tree, where gridHolder is still torn down and rebuilt');
  const empty = run([], 'full', { scrollY: 842 });
  ok('window.scrollTo() was called once', empty.scrollCalls.length === 1, JSON.stringify(empty.scrollCalls));
  ok('...restoring the pre-render scrollY at x=0', JSON.stringify(empty.scrollCalls[0]) === JSON.stringify([0, 842]), JSON.stringify(empty.scrollCalls));

  console.log('\n  ...with real content re-rendered');
  const c = { name: '/plex', state: 'running' };
  const entry = { id: 'e1', type: 'container', name: '/plex', parentId: 'root', position: 0 };
  const withContent = run([entry], 'grid', { containers: [c], scrollY: 1337 });
  ok('scroll is still restored to the pre-render value after a non-trivial rebuild', JSON.stringify(withContent.scrollCalls[0]) === JSON.stringify([0, 1337]), JSON.stringify(withContent.scrollCalls));

  console.log('\n  ...and on the early return taken while ccOrgView is not loaded yet');
  const guarded = run([], 'full', { noOrgView: true, scrollY: 55 });
  ok('the early return calls window.scrollTo() before it leaves', guarded.scrollCalls.length === 1 && JSON.stringify(guarded.scrollCalls[0]) === JSON.stringify([0, 55]), JSON.stringify(guarded.scrollCalls));
  ok('...and still tears the grid holder down through removeGridHolder()', guarded.removed === true);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
