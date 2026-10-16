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

console.log('\nA preview closes its card, across the card\'s width');
{
  ok('no card puts its preview in a column of its own', !/splitCard|cc-set-split/.test(settings));
  ok('the badge preview is the last block of its card', /c1\.appendChild\(el\("div", "cc-set-lbl", T\("Vorschau", "Preview"\)\)\);[\s\S]{0,1200}?prev\.id = "cc-set-prev"; c1\.appendChild\(prev\);\s*wrapMain\.appendChild\(c1\);/.test(settings));
  ok('the global logo previews follow the last row', /cLI\.appendChild\(modeRow\);\s*cLI\.appendChild\(el\("div", "cc-set-lbl", T\("Vorschau", "Preview"\)\)\);/.test(settings) && /repaintLogoPrevs = gpaint;\s*wrapMain\.appendChild\(cLI\);/.test(settings));
  ok('so does the Docker logo preview', /c2\.appendChild\(tprevWrap\);[^\n]*\n\s*wrap\.appendChild\(c2\);/.test(settings));
  ok('and an area\'s badge and logo previews', /cA\.appendChild\(el\("div", "cc-set-lbl", T\("Vorschau", "Preview"\)\)\); cA\.appendChild\(pv\);/.test(settings) && /cB\.appendChild\(tpw\); tp\(\);/.test(settings));
  ok('a view sketch sits right under its selector', /c\.appendChild\(slot\); c\.appendChild\(side\);/.test(settings) && /c\.appendChild\(slot\); c\.appendChild\(prev\.el\);/.test(settings));
  ok('the sketches are larger', /"#cc-settings \.cc-set-vp svg\{display:block;width:108px;height:65px\}"/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
