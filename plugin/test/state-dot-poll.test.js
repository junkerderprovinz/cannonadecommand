// A running container shows no state dot. The hide rule is keyed on the dot's own class, and
// the state poll rewrites each badge's className every few seconds, so the poll has to carry
// that class over: a first render that looks right says nothing about the tenth.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

// Just enough of an element for the poll: className and classList stay in step.
function badge(cls, name) {
  const attrs = {};
  const b = {
    className: cls, textContent: '', dataset: { name },
    setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return attrs[k]; },
  };
  const list = () => b.className.split(/\s+/).filter(Boolean);
  b.classList = new Proxy({}, {
    get: (t, k) => (k === 'contains' ? (c) => list().includes(c) : k === 'length' ? list().length : list()[k]),
    has: (t, k) => k in list(),
  });
  return b;
}

function poll(badges, containers) {
  const fn = new Function('document', 'pendingAction', 'containerByName', 'stateLabel', 'showUnhealthy', 'unhealthyTip', 't', 'syncActionBars',
    grabFn('syncStateBadges') + '\nreturn syncStateBadges;');
  const doc = { querySelectorAll: () => badges };
  fn(doc, {}, (n) => containers[n], (s) => s, (c) => !!c.unhealthy, () => 'unhealthy', (k) => k, () => {})();
}

const DOT = badge('cc-badge cc-badge-running cc-ct-statedot', 'web');
const CHIP = badge('cc-badge cc-chip-dot cc-badge-running', 'web');
const TOGGLE = badge('cc-badge cc-badge-running cc-badge-toggle', 'web');
const box = { web: { name: 'web', state: 'running' } };

console.log('\nThe poll keeps the class the hide rule needs');
poll([DOT, CHIP, TOGGLE], box);
ok('the list dot is still a statedot after a poll', DOT.classList.contains('cc-ct-statedot'), DOT.className);
ok('the chip dot is still a chip dot', CHIP.classList.contains('cc-chip-dot'), CHIP.className);
ok('the toggle stays a toggle', TOGGLE.classList.contains('cc-badge-toggle'), TOGGLE.className);
ok('the dot\'s tooltip is its state', DOT.getAttribute('data-tip') === 'running');

box.web.state = 'exited';
poll([DOT, CHIP], box);
ok('a container that stops swaps the state class', DOT.classList.contains('cc-badge-exited') && !DOT.classList.contains('cc-badge-running'), DOT.className);
ok('without picking up a second state class', DOT.className.split(' ').filter((k) => /^cc-badge-(running|exited)$/.test(k)).length === 1, DOT.className);
box.web.state = 'running'; box.web.unhealthy = true;
poll([DOT], box);
ok('an unhealthy one gains the alert', DOT.classList.contains('cc-badge-alert'));
box.web.unhealthy = false;
poll([DOT], box);
ok('and loses it again once healthy', !DOT.classList.contains('cc-badge-alert') && DOT.classList.contains('cc-ct-statedot'), DOT.className);

console.log('\nAfter the poll the hide rule still catches a running dot');
{
  const dotrow = { tag: 'div', classes: ['cc-ct-dotrow'], attrs: {}, states: {}, html: ['cc-docker-on'], has: ['> .cc-ct-statedot[data-name].cc-badge-running:not(.cc-badge-alert)'] };
  const d = candidates('docker', dotrow, 'display');
  ok('the list dot row is hidden', d.length > 0 && d[d.length - 1].value === 'none');
  const chip = { tag: 'span', classes: CHIP.className.split(' '), attrs: { 'data-name': 'web' }, states: {}, html: ['cc-docker-on'] };
  box.web.state = 'running'; poll([CHIP], box); chip.classes = CHIP.className.split(' ');
  const c = candidates('docker', chip, 'display');
  ok('the chip dot is hidden', c.length > 0 && c[c.length - 1].value === 'none', c.map((x) => x.selector).join(' | '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
