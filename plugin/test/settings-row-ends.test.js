// On the settings page every switch and every field stands at the far right of its row and every
// name at the far left. Only a list or a preview keeps its name above it. Each kind of control
// gets there through its own rule, and Unraid's input and button rules compete with them, so the
// cascade decides each one.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const win = (page, e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');
const page = withUnraid('settings');
const inCard = ['#cc-settings', '.cc-set-card', '.cc-set-row'];

console.log('\nEach kind of control is pushed to its row\'s end');
{
  const inline = { tag: 'div', classes: ['cc-set-row', 'cc-set-inline'], inside: ['#cc-settings', '.cc-set-card'] };
  ok('a switch row puts its name and its switch at the two ends', val(win(page, inline, 'justify-content')) === 'space-between' && val(win(page, inline, 'flex-wrap')) === 'nowrap');
  ok('a toggleRow pushes its switch with a spacer', /function toggleRow[\s\S]*?cc-set-spacer[\s\S]*?row\.appendChild\(toggle\(on, onChange\)\)/.test(settings) && val(win(page, { tag: 'span', classes: ['cc-set-spacer'], inside: inCard }, 'flex')) === '1');
  ok('a dropdown', val(win(page, { tag: 'span', classes: ['cc-dsel'], inside: inCard, outside: ['.cc-pop'] }, 'margin-left')) === 'auto');
  ok('a one-line field', /auto$/.test(val(win(page, { tag: 'input', classes: ['cc-set-txt'], attrs: { type: 'text' }, inside: inCard, html: ['cc-popups-on'] }, 'margin'))));
  ok('a slider', val(win(page, { tag: 'input', classes: [], attrs: { type: 'range' }, inside: inCard }, 'margin-left')) === 'auto');
  ok('a colour field', /auto$/.test(val(win(page, { tag: 'div', classes: ['cc-set-pickrow'], inside: inCard, outside: ['.cc-set-pickrow'] }, 'margin'))));
}

console.log('\nNo control waits under a name of its own');
{
  // A name set above as .cc-set-lbl is left only for a list of switches and for a preview.
  const above = [...settings.matchAll(/el\("div", "cc-set-lbl", T\("([^"]+)"/g)].map((m) => m[1]);
  const allowed = ['Vorschau', 'Angezeigte Elemente'];
  ok('the names above a block are previews and lists only', above.every((t) => allowed.includes(t)), above.join(', '));
  ok('the colour fields stand beside their names', !/cc-set-lbl", T\("(Farbe|Flaggenfarben)"/.test(settings));
  ok('the backup buttons stand together at the end of their row', /bend\.appendChild\(ex\); bend\.appendChild\(im\); bend\.appendChild\(rs\);\s*brow\.appendChild\(lblw\); brow\.appendChild\(bend\);/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
