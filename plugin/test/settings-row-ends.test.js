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
  ok('a toggleRow is that same switch row', /function toggleRow\(labelText, help, on, onChange\) \{ return inlineRow\(labelText, help, toggle\(on, onChange\)\); \}/.test(settings) && /function inlineRow[\s\S]*?el\("div", "cc-set-row cc-set-inline"\)/.test(settings));
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

console.log('\nThe column matrix ends its switches at the card\'s right edge');
{
  const tbl = { tag: 'table', classes: ['cc-set-tbl'], inside: ['#cc-settings', '.cc-set-card'] };
  const cell = { tag: 'td', classes: ['cc-set-chk'], inside: ['#cc-settings', '.cc-set-card', '.cc-set-tbl'] };
  const sw = { tag: 'input', classes: ['cc-cb'], attrs: { type: 'checkbox' }, inside: ['#cc-settings', '.cc-set-card', '.cc-set-tbl', '.cc-set-chk'] };
  ok('the table spans the card', val(win(page, tbl, 'width')) === '100%' && val(win(page, tbl, 'max-width')) === '(none)');
  ok('a switch cell has no padding on its right and sets its switch at its end', /^5px 0 5px 28px/.test(val(win(page, cell, 'padding'))) && val(win(page, cell, 'text-align')) === 'right');
  ok('the switch drops the margin Unraid gives a checkbox', val(win(page, sw, 'margin')) === '0');
}

console.log('\nA preview stands in a column beside the rows');
{
  const calls = [...settings.matchAll(/splitCard\((\w+), (?:\[[^\]]*\]|\w+)(?:, "[^"]+")?\)/g)].map((m) => m[1]);
  ok('every card with a preview splits it off', ['c1', 'cLI', 'c2', 'cA', 'cB', 'c'].every((c) => calls.includes(c)), calls.join(' '));
  ok('the Docker view sketches go beside the selector', /splitCard\(c, \[side\], "cc-set-split-auto"\);/.test(settings) && /side\.appendChild\(prev\.el\);/.test(settings));
  ok('the sketches are larger', /"#cc-settings \.cc-set-vp svg\{display:block;width:108px;height:65px\}"/.test(settings));
  ok('rows left, preview right, both from the top', /"#cc-settings \.cc-set-split\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;column-gap:24px;align-items:start\}"/.test(settings));
  ok('a narrow page puts the preview under the rows', /@media \(max-width:1199px\)\{#cc-settings \.cc-set-split\{grid-template-columns:minmax\(0,1fr\)\}/.test(settings));
  const split = new Function('el', /function splitCard\([\s\S]*?\n  \}/.exec(settings)[0] + '\nreturn splitCard;');
  const mk = (cls) => ({ cls, children: [], classList: { contains: (c) => cls.split(' ').includes(c) }, appendChild(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = this; this.children.push(n); return n; } });
  const fn = split((tag, cls) => mk(cls || ''));
  const card = mk('cc-set-card'), head = card.appendChild(mk('cc-set-h')), row = card.appendChild(mk('cc-set-row')), lbl = card.appendChild(mk('cc-set-lbl')), pv = card.appendChild(mk('cc-set-prev'));
  fn(card, [lbl, pv]);
  const box = card.children[1];
  ok('the card keeps its title badge first and gains one split box', card.children.length === 2 && card.children[0] === head && box.cls === 'cc-set-split');
  ok('the rows go left and the preview right, in order', box.children[0].children[0] === row && box.children[1].children[0] === lbl && box.children[1].children[1] === pv);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
