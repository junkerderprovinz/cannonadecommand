// The start plan's window shows the plan as a scene: the stages are the engine's own, a station
// lights up when its stage and delay come round and draws its check when it is ready, the arrows
// run from each dependency to the container waiting for it, and the containers that neither wait
// nor are waited for stand small apart. Under reduced motion the scene shows its end frame, and a
// change to the plan draws it again.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const go = fs.readFileSync(path.join(__dirname, '..', '..', 'internal', 'orchestrator', 'orchestrator.go'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

// Elements rich enough for the scene: class lists, single-class lookups, children and offsets,
// all of which read 0 here.
function Node(tag, cls, text) {
  const n = { tag, kids: [], parentNode: null, attrs: {}, dataset: {}, style: { setProperty() {}, removeProperty() {} }, textContent: text || '', isConnected: true, offsetLeft: 0, offsetTop: 0, offsetWidth: 40, offsetHeight: 40, offsetParent: null, clientWidth: 500, clientHeight: 200 };
  const classes = new Set((cls || '').split(' ').filter(Boolean));
  n.classList = {
    contains: (c) => classes.has(c), add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
    toggle: (c, on) => { if (on === undefined) on = !classes.has(c); if (on) classes.add(c); else classes.delete(c); return on; },
  };
  n.appendChild = (k) => { n.kids.push(k); k.parentNode = n; return k; };
  n.removeChild = (k) => { n.kids.splice(n.kids.indexOf(k), 1); k.parentNode = null; return k; };
  Object.defineProperty(n, 'firstChild', { get: () => n.kids[0] || null });
  Object.defineProperty(n, 'children', { get: () => n.kids });
  Object.defineProperty(n, 'innerHTML', { set: () => { n.kids = []; } });
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); if (k === 'class') v.split(' ').forEach((c) => classes.add(c)); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.querySelectorAll = (sel) => { const c = sel.replace(/^\./, ''), out = []; const walk = (x) => x.kids.forEach((k) => { if (k.classList.contains(c)) out.push(k); walk(k); }); walk(n); return out; };
  n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
  return n;
}

const stubs = `
  var LANG = "de", workingPlan = {}, sceneRoot = null, tintCalls = 0, timers = [];
  var document = { createElementNS: function (ns, tag) { return Node(tag); } };
  var localStorage = { getItem: function () { return null; } };
  var performance = { now: function () { return 0; } };
  function setTimeout(f, ms) { timers.push({ f: f, ms: ms }); return timers.length; }
  function clearTimeout() {}
  function ResizeObserver() { this.observe = function () {}; this.disconnect = function () {}; }
  function el(tag, cls, text) { return Node(tag, cls, text); }
  function t(k) { return { sceneTitle: "Startablauf" }[k] || k; }
  function infoBubble() { return el("span", "cc-info"); }
  function stampCardRainbow() {}
  function cardIcon() { return el("span", "cc-card-icobox"); }
  function iconBgOn() { return false; }
  function applyIconTint() { tintCalls++; }
  function collectPlan() { return { nodes: Object.keys(workingPlan).map(function (k) { return workingPlan[k]; }) }; }
`;
function make(still) {
  const P = { still: () => still, checks: [], flows: [] };
  P.drawCheck = (host) => { P.checks.push(host); host.appendChild(Node('svg', 'cc-check')); };
  P.flow = (svg, from, to) => { const g = Node('g', 'cc-flow'); svg.appendChild(g); P.flows.push([from, to]); return { el: g }; };
  const api = new Function('Node', 'window', stubs + ['planStages', 'sceneTimes', 'planScene'].map(grabFn).join('\n') +
    '\nvar SCENE_READY = 700, SCENE_GAP = 600, SCENE_DELAY = 1500;' +
    '\nreturn { planStages: planStages, sceneTimes: sceneTimes, planScene: planScene, plan: workingPlan, timers: timers, tint: function () { return tintCalls; } };')(Node, { CCPictures: P });
  return { api, P };
}
const node = (name, after, extra) => Object.assign({ name, after: after || [] }, extra || {});
const names = (st) => st.map((s) => s.map((n) => n.name).join(',')).join(' | ');

console.log('\nThe stages are the engine\'s');
{
  const { api } = make(true);
  ok('the engine forms stages the same way', /func TopoStages/.test(go) && /StartOrder only reorders peers within a stage/.test(go));
  const ps = api.planStages([node('CCWB', ['CrowdSec']), node('Nextcloud', ['MariaDB']), node('Plex', [], { start_order: 1 }), node('Nginx', ['Nextcloud'])]);
  ok('a dependency outside the plan joins it, and the start order sorts within a stage', names(ps.stages) === 'Plex,CrowdSec,MariaDB | CCWB,Nextcloud | Nginx', names(ps.stages));
  ok('nothing is stuck', ps.stuck.length === 0);
  const cyc = api.planStages([node('A', ['B']), node('B', ['A']), node('C')]);
  ok('a cycle leaves its nodes stuck and the rest staged', names(cyc.stages) === 'C' && cyc.stuck.map((n) => n.name).join(',') === 'A,B');
}

console.log('\nA station lights when its stage and its delay come round');
{
  const { api } = make(true);
  const ps = api.planStages([node('CCWB', ['CrowdSec'], { delay_seconds: 50 }), node('Obsidian', ['CouchDB'], { delay_seconds: 20 })]);
  const at = api.sceneTimes(ps.stages);
  ok('a stage waits until every station before it is ready', at.CCWB.start >= Math.max(at.CrowdSec.ready, at.CouchDB.ready) && at.Obsidian.start >= at.CouchDB.ready);
  ok('the longer delay holds its station back longer, in proportion', Math.abs((at.CCWB.start - at.Obsidian.start) - (50 - 20) / 50 * 1500) < 141, String(at.CCWB.start - at.Obsidian.start));
  ok('a station is ready a moment after it lights', at.CCWB.ready - at.CCWB.start === 700);
}

console.log('\nThe scene draws the plan, and its end frame under reduced motion');
{
  const { api, P } = make(true);
  Object.assign(api.plan, { CCWB: node('CCWB', ['CrowdSec']), Nextcloud: node('Nextcloud', ['MariaDB']), Plex: node('Plex'), Tautulli: node('Tautulli') });
  const sc = api.planScene('CCWB');
  sc.update();
  const fig = sc.el, sn = fig.querySelectorAll('.cc-sn');
  const chain = fig.querySelector('.cc-plan-scene-chain'), free = fig.querySelector('.cc-plan-scene-free');
  ok('every container of the plan is a station, the outside dependencies too', sn.length === 6, String(sn.length));
  ok('the chains stand in stage columns', chain.querySelectorAll('.cc-plan-scene-stage').map((c) => c.querySelectorAll('.cc-sn').map((s) => s.dataset.name).join(',')).join(' | ') === 'CrowdSec,MariaDB | CCWB,Nextcloud');
  ok('the containers without dependencies stand apart', free.querySelectorAll('.cc-sn').map((s) => s.dataset.name).join(',') === 'Plex,Tautulli');
  ok('the window\'s own container is marked', fig.querySelectorAll('.cc-sn-focus').map((s) => s.dataset.name).join() === 'CCWB');
  ok('one arrow per dependency', P.flows.length === 2 && fig.querySelectorAll('.cc-plan-scene-edge').length === 2);
  ok('each arrow has its head', fig.querySelectorAll('.cc-plan-scene-head').length === 2);
  ok('the end frame shows every station lit and ready', sn.every((s) => s.classList.contains('cc-sn-on') && s.classList.contains('cc-sn-ready')));
  ok('with a drawn check on each', P.checks.length === 6 && fig.querySelectorAll('.cc-check').length === 6);
  ok('the arrows are drawn through and carry no packets', fig.querySelectorAll('.cc-plan-scene-on').length === 2 && fig.querySelectorAll('.cc-plan-scene-live').length === 0);
  ok('nothing waits on a timer', api.timers.length === 0);
  ok('the logos go through the icon pipeline', api.tint() === 1);
  ok('the label reads the order, the outside dependencies after the plan\'s own', fig.getAttribute('aria-label') === 'Startablauf: Plex, Tautulli, CrowdSec, MariaDB, dann CCWB, Nextcloud', fig.getAttribute('aria-label'));
  sc.update();
  ok('an unchanged plan is not drawn again', P.checks.length === 6 && api.tint() === 1);
  api.plan.Tautulli = node('Tautulli', ['Plex']);
  sc.update();
  ok('a changed plan is drawn again', api.tint() === 2 && fig.querySelectorAll('.cc-plan-scene-stage').length === 2 && P.flows.length === 5);
  for (const k of Object.keys(api.plan)) delete api.plan[k];
  sc.update();
  ok('an empty plan hides the scene', fig.classList.contains('cc-hidden'));
}

console.log('\nWith motion the stations wait grey for their turn');
{
  const { api, P } = make(false);
  Object.assign(api.plan, { CCWB: node('CCWB', ['CrowdSec']) });
  const sc = api.planScene('CCWB');
  sc.update();
  const st = (n) => sc.el.querySelectorAll('.cc-sn').filter((s) => s.dataset.name === n)[0];
  ok('before the first mark every station is grey', !st('CrowdSec').classList.contains('cc-sn-on') && !st('CCWB').classList.contains('cc-sn-on'));
  ok('timers carry the scene, a finite number of them', api.timers.length > 0 && api.timers.every((x) => isFinite(x.ms)));
  ok('no check is drawn yet', P.checks.length === 0);
}

console.log('\nA cycle stays grey and says why');
{
  const { api, P } = make(true);
  Object.assign(api.plan, { A: node('A', ['B']), B: node('B', ['A']) });
  const sc = api.planScene('A');
  sc.update();
  ok('the stuck stations never light', sc.el.querySelectorAll('.cc-sn-on').length === 0 && P.checks.length === 0);
  ok('the note shows', !sc.el.querySelector('.cc-plan-scene-stuck').classList.contains('cc-hidden'));
}

console.log('\nThe window carries the scene and redraws it on a change');
{
  const ed = grabFn('openEditor');
  ok('the scene sits under the manage switch', /pop\.appendChild\(mrow\);\s*\n\s*var scene = planScene\(name\); pop\.appendChild\(scene\.el\);/.test(ed));
  ok('every commit tells the scene', /function commit\(\) \{\s*\n\s*scene\.changed\(\);/.test(ed));
  ok('it plays once the window stands', /placePop\(pop, anchor, 320\);[^\n]*\n\s*scene\.update\(\);/.test(ed));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
