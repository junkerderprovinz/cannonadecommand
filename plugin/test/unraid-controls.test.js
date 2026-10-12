// Unraid's default-base.css styles every <button> and text field through rules such as
// button[type="button"]:where(:not(.unapi *)), whose tag plus attribute outweighs a single CC
// class. Each CC button and window field is resolved here against those rules and every CC
// sheet, so a property CC means to set cannot quietly fall to Unraid's orange gradient frame,
// uppercase label, 86px floor or dark white-theme ink.
const { candidates, withUnraid } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const WINDOWS = ['.cc-pop', '.cc-menu', '.cc-win', '.cc-rowmenu'];
const BUTTON_PROPS = ['color', 'background', 'border', 'border-radius', 'padding', 'font-size', 'font-family', 'font-weight', 'letter-spacing', 'text-transform', 'min-width', 'margin'];
// The VM grow button paints itself inline, so only what the inline style leaves open counts.
const RESET_PROPS = ['font-family', 'font-weight', 'letter-spacing', 'text-transform', 'min-width', 'margin'];
const btn = (classes, o) => Object.assign({ tag: 'button', classes, attrs: { type: 'button' }, states: {}, html: ['cc-docker-on'], outside: WINDOWS }, o);

const BUTTONS = [
  ['settings', '"Öffnen" and "Hochladen" on the settings page', btn(['cc-btn'], { inside: ['#cc-settings'], html: [] })],
  ['docker', 'the card view\'s gear', btn(['cc-hgear', 'cc-hgear-grid'], { inside: ['.cc-gear-tile', '.cc-grid-holder'] })],
  ['docker', 'the list view\'s gear in the action bar', btn(['cc-hgear', 'cc-hgear-home'], { inside: ['.js-actions', '.cc-bar-adv'] })],
  ['docker', 'a card\'s move-to-folder button', btn(['cc-card-movebtn'], { inside: ['.cc-grid-holder', '.cc-card'] })],
  ['docker', 'a folder header action', btn(['cc-folder-act'], { inside: ['.cc-folderview'] })],
  ['docker', 'the port list\'s sort button', btn(['cc-alloc-sortbtn'], { inside: ['#dockerAllocations'], html: ['cc-docker-on', 'cc-on-addct'] })],
  ['docker', 'a segment in the gear menu', btn(['cc-seg-btn'], { attrs: {}, inside: ['.cc-menu'], outside: [] })],
  ['docker', 'a button in the gear menu', btn(['cc-btn'], { attrs: {}, inside: ['.cc-menu'], outside: [] })],
  ['docker', 'a row action button', btn(['cc-abtn'], { attrs: {} })],
  ['settings', 'a settings tab', btn(['cc-set-tab'], { inside: ['#cc-settings'], html: [] })],
];

console.log('\nThe resolver sees Unraid win where a single class meets its button rule');
{
  const el = btn(['x-btn']);
  const own = [{ name: 'own.css', css: '.x-btn { color: red; }' }];
  const w = (sheets) => { const c = candidates(sheets, el, 'color'); return c[c.length - 1]; };
  ok('a lone .x-btn loses its colour', w(withUnraid('every').concat(own)).sheet.startsWith('unraid'));
  own[0].css = 'html .x-btn { color: red; }';
  ok('html .x-btn ties and wins by loading later', w(withUnraid('every').concat(own)).value === 'red');
  const inside = btn(['x-btn'], { inside: [], outside: [] });
  ok('a rule behind :not(.unapi *) still counts as reaching a CC button', candidates(withUnraid('every'), inside, 'min-width').length > 0);
}

console.log('\nNo CC button takes a property from Unraid, at rest or under the pointer');
for (const [page, what, el] of BUTTONS) {
  for (const states of [{}, { hover: true }]) {
    const e = Object.assign({}, el, { states });
    const lost = BUTTON_PROPS.filter((p) => { const c = candidates(withUnraid(page), e, p); return c.length && c[c.length - 1].sheet.startsWith('unraid'); });
    ok(what + (states.hover ? ', hovered' : ''), lost.length === 0, lost.join(', '));
  }
}
{
  const grow = btn(['cc-vm-grow'], { attrs: {}, html: ['cc-vms-on'] });
  const lost = RESET_PROPS.filter((p) => { const c = candidates(withUnraid('every'), grow, p); return c.length && c[c.length - 1].sheet.startsWith('unraid'); });
  ok('the VM disk grow button', lost.length === 0, lost.join(', '));
}

// Padding and radius are stamped inline by hardenPop(), out of the cascade's reach.
console.log('\nA field in a CC window keeps its own fill, ink and size');
for (const html of [['cc-docker-on'], ['cc-docker-on', 'Theme--white']]) {
  for (const [type, states] of [['text', {}], ['text', { focus: true }], ['number', {}]]) {
    const el = { tag: 'input', classes: ['cc-in'], attrs: { type }, states, html, inside: ['.cc-pop'] };
    const lost = ['color', 'background-color', 'font-size'].filter((p) => { const c = candidates(withUnraid('docker'), el, p); return c.length && c[c.length - 1].sheet.startsWith('unraid'); });
    ok(`input[type=${type}]${states.focus ? ':focus' : ''}${html.includes('Theme--white') ? ' on a white theme' : ''}`, lost.length === 0, lost.join(', '));
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
