// A row action at rest, greyed or with the action colours off, and an unused limit gear
// sit on the theme's surface grey and its text colour, so on a white or azure page they are
// light chips rather than dark slabs. That holds for the inline paint tintAct() and gearFill()
// write and for every sheet rule that can reach the button.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');

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
const LITERAL = /^#[0-9a-f]{3,8}$/i;

const tokens = read('sheets/CannonadeCommand.Tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const light = /html\.Theme--white,\s*html\.Theme--azure\s*\{([^}]*)\}/.exec(tokens)[1];
const lightSurface = /--cc-surface-3:\s*(#[0-9a-f]{6})/i.exec(light)[1];
const luma = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); };
ok('the light theme turns --cc-surface-3 light', luma(lightSurface) > 200, lightSurface);

function button(classes) {
  const b = { cls: new Set(classes), css: {} };
  b.classList = { contains: (c) => b.cls.has(c) };
  b.style = { setProperty: (k, v) => { b.css[k] = v; }, removeProperty: (k) => { delete b.css[k]; } };
  b.querySelector = () => null;
  return b;
}
const store = (s) => ({ getItem: (k) => (k in s ? s[k] : null) });
const docker = read('scripts/docker.js'), vms = read('scripts/vms.js');
const TINT = {
  Docker: (ls) => new Function('localStorage', 'window', 'RB_PAL', 'RB_OFFSET',
    'function themingOn() { return true; } function ccPalActive(p) { return p; } function effc() { return "#FCC419"; } function idealText() { return "#161616"; }' +
    grabFn(docker, 'tintAct') + 'return tintAct;')(ls, {}, ['#FF8389'], 0),
  VMs: (ls) => new Function('window', 'RB_OFFSET', 'store',
    'function ls(k) { return store.getItem(k); } function vmPalActive() { return ["#FF8389"]; } function ccAccent() { return "#FCC419"; } function ccIdeal() { return "#161616"; }' +
    grabFn(vms, 'tintAct') + 'return tintAct;')({}, 0, ls),
};

console.log('\nThe inline paint');
for (const [area, tint] of Object.entries(TINT)) {
  const btns = [button(['cc-actbtn']), button(['cc-actbtn', 'cc-actoff'])];
  tint(store({ 'cc.actcolors': '0' }))({ querySelectorAll: () => btns });
  for (const [what, b] of [['an action with the colours off', btns[0]], ['a greyed placeholder', btns[1]]]) {
    ok(`${area}: ${what} rests on the surface token`, /^var\(--cc-surface-3,/.test(b.css.background || ''), b.css.background);
    ok(`${area}: with ink from a text token`, /^var\(--cc-text(-dim)?,/.test(b.css.color || ''), b.css.color);
  }
}

// An unused limit gear rests like an action with its colours off; a fixed grey there is the
// same dark slab on a light page.
console.log('\nAn unused limit gear');
{
  const GEAR = {
    Docker: new Function('localStorage', 'function themingOn() { return true; } function effc() { return "#FCC419"; } function idealText() { return "#161616"; }' + grabFn(docker, 'gearFill') + 'return gearFill;')(store({})),
    VMs: new Function('store', 'function ls(k) { return store.getItem(k); } function ccAccent() { return "#FCC419"; } function ccIdeal() { return "#161616"; }' + grabFn(vms, 'vmGearFill') + 'return vmGearFill;')(store({})),
  };
  for (const [area, fill] of Object.entries(GEAR)) {
    const off = button(['cc-limbtn']), on = button(['cc-limbtn']);
    fill(off, false, 'cpu'); fill(on, true, 'cpu');
    ok(`${area}: it rests on the surface token`, /^var\(--cc-surface-3,/.test(off.css.background || ''), off.css.background);
    ok(`${area}: with ink from the text token`, /^var\(--cc-text,/.test(off.css.color || ''), off.css.color);
    ok(`${area}: a set gear still carries the accent`, on.css.background === '#FCC419', on.css.background);
  }
}

// tintAct paints every action inline, and the reactive mode's own rules come with
// !important, so a plain :hover background in a sheet never shows; the wash in Tokens.css is
// the hover.
console.log('\nNo dead hover rules');
for (const f of ['styles/docker.css', 'sheets/CannonadeCommand.VmTab.css']) {
  const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
  const dead = (css.match(/[^{}]*\.cc-actbtn:hover\s*\{[^}]*\}/g) || []).filter((r) => /background/.test(r) && !/rbneutral/.test(r));
  ok(`${f}: no background on .cc-actbtn:hover that the inline paint always beats`, dead.length === 0, dead.join(' | ').trim());
}

console.log('\nThe sheets');
for (const page of ['docker', 'every']) {
  const el = { tag: 'span', classes: ['cc-actbtn'], attrs: { class: 'cc-actbtn' }, states: {} };
  for (const prop of ['background', 'color']) {
    const lit = candidates(page, el, prop).filter((c) => LITERAL.test(c.value.trim()));
    ok(`${page} page: no rule gives a resting action a fixed ${prop}`, lit.length === 0, lit.map((c) => c.selector + ' => ' + c.value).join(' | '));
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
