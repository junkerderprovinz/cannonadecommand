// Regression test: renderFolderView()'s per-item DENSITY DISPATCH (v4.35.0, item 1 — proves the
// three density builders actually hook into the SAME render path, so collapse/hide-stopped/bulk/
// live-search-auto-expand fall out "for free" in every density, exactly as the spec called for)
// and its SCROLL-POSITION PRESERVATION (v4.35.0, item 2 — jdp: "Sbald man im ordner was macht
// springt es ganz nach oben in der seite").
//
// This file source-slices the REAL renderFolderView() out of docker.js (never re-typed) and runs
// it end-to-end against a synthetic organizer tree, with every OTHER collaborator (card()/
// folderChip()/folderListRow()/ensureGridHolder()/makeGear()/etc.) replaced by a small stub —
// the same "grab the real function under test, stub its collaborators" shape every other
// docker.js-source-slice test in this suite already uses (see folder-view-bug-fixes.test.js).
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

/* ── minimal DOM shim, just enough for el()-built nodes + a fake gridHolder ─────────────────── */
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
  const byParentEntries = entries; // [{id,type,name,parentId,position}] or containers stand in as {type:'container', name, parentId, position, id}
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
    // v4.35.1: renderFolderView() now gates .cc-docker-iconbg via the shared iconBgOn() helper
    // (effc("iconbg")==="1" || iconBgAdopts()) instead of inlining the effc() check — stub it the
    // same way every other free-variable collaborator here is stubbed.
    () => false
  );
  fn();
  return { gridHolder: fakeGridHolder, scrollCalls: scrollCalls, removed: removed };
}

console.log('\nrenderFolderView() dispatches to the right per-item builder for each density (item 1 — same render path for every density)');
{
  const c = { name: '/plex', state: 'running' };
  const entry = { id: 'e1', type: 'container', name: '/plex', parentId: 'root', position: 0 };

  const full = run([entry], 'full', { containers: [c] });
  const gridD = run([entry], 'grid', { containers: [c] });
  const listD = run([entry], 'list', { containers: [c] });

  function findMarker(gh, cls) { const walk = n => n.children.reduce((f, ch) => f || (ch.classList.contains(cls) ? ch : walk(ch)), null); return walk(gh); }

  ok('"full" density: card() was used (cc-card-full-marker present)', !!findMarker(full.gridHolder, 'cc-card-full-marker'));
  ok('"full" density: folderChip()/folderListRow() were NOT used', !findMarker(full.gridHolder, 'cc-chip-marker') && !findMarker(full.gridHolder, 'cc-frow-marker'));

  ok('"grid" density: folderChip() was used (cc-chip-marker present)', !!findMarker(gridD.gridHolder, 'cc-chip-marker'));
  ok('"grid" density: card()/folderListRow() were NOT used', !findMarker(gridD.gridHolder, 'cc-card-full-marker') && !findMarker(gridD.gridHolder, 'cc-frow-marker'));

  ok('"list" density: folderListRow() was used (cc-frow-marker present)', !!findMarker(listD.gridHolder, 'cc-frow-marker'));
  ok('"list" density: card()/folderChip() were NOT used', !findMarker(listD.gridHolder, 'cc-card-full-marker') && !findMarker(listD.gridHolder, 'cc-chip-marker'));
}

console.log('\nrenderFolderView() preserves scroll position across a full rebuild (item 2)');
{
  console.log('\n  ...with an empty organizer tree (the whole function still tears down + rebuilds gridHolder)');
  const empty = run([], 'full', { scrollY: 842 });
  ok('window.scrollTo() was called exactly once', empty.scrollCalls.length === 1, JSON.stringify(empty.scrollCalls));
  ok('...restoring the EXACT pre-render scrollY, at x=0', JSON.stringify(empty.scrollCalls[0]) === JSON.stringify([0, 842]), JSON.stringify(empty.scrollCalls));

  console.log('\n  ...with real content re-rendered (a container present, any density)');
  const c = { name: '/plex', state: 'running' };
  const entry = { id: 'e1', type: 'container', name: '/plex', parentId: 'root', position: 0 };
  const withContent = run([entry], 'grid', { containers: [c], scrollY: 1337 });
  ok('scroll is still restored to the pre-render value after a non-trivial rebuild', JSON.stringify(withContent.scrollCalls[0]) === JSON.stringify([0, 1337]), JSON.stringify(withContent.scrollCalls));

  console.log('\n  ...and the defensive early-return path (ccOrgView not loaded yet) restores scroll too, not just the happy path');
  const guarded = run([], 'full', { noOrgView: true, scrollY: 55 });
  ok('the early-return branch (no ccOrgView) still calls window.scrollTo() before returning', guarded.scrollCalls.length === 1 && JSON.stringify(guarded.scrollCalls[0]) === JSON.stringify([0, 55]), JSON.stringify(guarded.scrollCalls));
  ok('...and it still tears the grid holder down via removeGridHolder(), unaffected by the scroll fix', guarded.removed === true);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
