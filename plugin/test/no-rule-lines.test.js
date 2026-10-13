// Parts of a surface are set off by space or a surface step, never by a rule line: the limit
// group at the foot of a Docker card and the head of the settings page above its tabs.
const { candidates, withUnraid } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const SIDES = ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-block', 'border-block-start', 'border-block-end'];
const lines = (page, e) => SIDES.flatMap((p) => candidates(page, e, p).filter((c) => !/^(none|0|0px)$/.test(c.value.trim())).map((c) => p + ': ' + c.value + ' (' + c.selector + ')'));

const parts = [
  ['the limit group on a Docker card', 'docker', { tag: 'div', classes: ['cc-rowbadges', 'cc-resgroup', 'cc-card-res'], inside: ['.cc-card'], outside: ['#docker_list', '.cc-enh'], html: ['cc-docker-on'] }],
  ['the head of the settings page', 'settings', { tag: 'div', classes: ['cc-set-head'], inside: ['#cc-settings'] }],
];
for (const [name, page, e] of parts) {
  const found = lines(withUnraid(page), e);
  ok(name + ' draws no line', !found.length, found.join(' | '));
}
const res = candidates(withUnraid('docker'), parts[0][2], 'margin-top').pop();
ok('the limit group keeps its distance from the badges above', res && parseFloat(res.value) >= 8, res && res.value);
const head = candidates(withUnraid('settings'), parts[1][2], 'margin-bottom').pop();
ok('the settings head keeps its distance from the tabs', head && parseFloat(head.value) >= 24, head && head.value);

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
