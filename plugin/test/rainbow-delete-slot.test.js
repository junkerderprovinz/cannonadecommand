// Under the rainbow every row action takes the palette slot of its position, and the
// Remove action sits far enough along to come round to red. A delete is never red, so
// it passes to the next slot that is not, on Docker and on VMs, at rest and as the
// colour the reactive mode stamps for the hover.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const theme = read('cc-theme.js');
const CCTheme = new Function(grabFn(theme, 'idealText') + grabFn(theme, 'isRed') + grabFn(theme, 'deleteSlot') +
  'return { idealText: idealText, isRed: isRed, deleteSlot: deleteSlot };')();
const RB = JSON.parse(/var RB = (\[[^\]]+\]);/.exec(theme)[1]);
const AUSTRIA = ['#ED2939', '#FFFFFF', '#ED2939'];

console.log('\nWhat counts as red');
ok('the palette\'s red slot is red', CCTheme.isRed('#FF8389'));
ok('a flag red is red', CCTheme.isRed('#D21034') && CCTheme.isRed('#ED2939'));
ok('the orange beside it is not', !CCTheme.isRed('#FF832B'));
ok('nor the magenta on its other side', !CCTheme.isRed('#FF7EB6'));
ok('nor a grey with a warm cast', !CCTheme.isRed('#8a7a7a'));
ok('the palette has exactly one red slot', RB.filter(CCTheme.isRed).length === 1);

console.log('\nThe slot a delete takes');
ok('a delete landing on red takes the next slot', CCTheme.deleteSlot(RB, 8) === RB[1], CCTheme.deleteSlot(RB, 8));
ok('a delete elsewhere keeps its own slot', CCTheme.deleteSlot(RB, 11) === RB[3]);
ok('in a red and white flag it takes the white', CCTheme.deleteSlot(AUSTRIA, 0) === '#FFFFFF');

function button(classes) {
  const b = { cls: new Set(classes), css: {} };
  b.classList = { contains: (c) => b.cls.has(c) };
  b.style = { setProperty: (k, v) => { b.css[k] = v; }, removeProperty: (k) => { delete b.css[k]; } };
  b.querySelector = () => null;
  return b;
}
function settings(extra) {
  const s = Object.assign({ 'cc.rainbow': '1', 'cc.rainbowrot': '0' }, extra);
  return { getItem: (k) => (k in s ? s[k] : null) };
}

// Docker: WebUI, Log, Edit, Restart, Pause, Stop, More, Console, Remove.
const docker = read('docker.js');
const dockerTint = (ls, off) => new Function('localStorage', 'window', 'RB_PAL', 'RB_OFFSET',
  'function themingOn() { return true; } function ccPalActive(p) { return p; } function effc() { return "#FCC419"; } var idealText = window.CCTheme.idealText;' +
  grabFn(docker, 'tintAct') + 'return tintAct;')(ls, { CCTheme }, RB, off);
// VMs: Console, Log, Edit, Restart, Pause, Stop, More, then the extras ending in both removes.
const vms = read('vms.js');
const vmTint = (ls, off) => new Function('window', 'RB_OFFSET', 'store',
  'function ls(k) { return store.getItem(k); } function vmPalActive() { return ' + JSON.stringify(RB) + '; } function ccAccent() { return "#FCC419"; } var ccIdeal = window.CCTheme.idealText;' +
  grabFn(vms, 'tintAct') + 'return tintAct;')({ CCTheme }, off, ls);

for (const [area, tint, count] of [['Docker', dockerTint, 9], ['VMs', vmTint, 9]]) {
  for (const [mode, ls, prop] of [['at rest', settings(), 'background'], ['for the reactive hover', settings({ 'cc.rbmode': 'active' }), '--cc-rb-c']]) {
    const btns = Array.from({ length: count }, (_, i) => button(i === count - 1 ? ['cc-actbtn', 'cc-actdel'] : ['cc-actbtn']));
    tint(ls, 0)({ querySelectorAll: () => btns });
    const del = btns[count - 1].css[prop];
    ok(`${area}, ${mode}: the Remove action in the red position is not red`, !!del && !CCTheme.isRed(del), del);
    ok(`${area}, ${mode}: the action before it keeps its own slot`, btns[count - 2].css[prop] === RB[(count - 2) % RB.length], btns[count - 2].css[prop]);
  }
  const btns = Array.from({ length: count }, () => button(['cc-actbtn']));
  tint(settings(), 0)({ querySelectorAll: () => btns });
  ok(`${area}: an ordinary action in that position still takes the red slot`, btns[count - 1].css.background === RB[0]);
}
ok('docker.js marks Remove as a delete', /actBtn\("fa-trash", [^\n]*rmContainer[^\n]*, true\)\);/.test(docker));
ok('vms.js marks both removes as deletes', (vms.match(/vmRemove\(uuid, name, (true|false)\); \}, true\)\);/g) || []).length === 2);

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
