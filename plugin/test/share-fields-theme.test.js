// The share settings page fills its fields and dropdowns with a wash of the theme's ink and writes
// in that ink, so they read on the white and azure pages as on the dark ones. A fixed light grey
// text on a white wash disappears on a light page.
const { candidates, withUnraid, tokens, resolve } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const page = withUnraid('every');
const html = ['cc-shares-on', 'cc-on-share-detail', 'Theme--white'];
const win = (e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');
const inked = (v) => /^var\(--cc-text, #eaeaea\)$/.test(v);
const washed = (v, pct) => new RegExp('^color-mix\\(in srgb, var\\(--cc-text, #e6e6e6\\) ' + pct + '%, transparent\\)$').test(v);

console.log('\nThe fields follow the theme');
{
  const field = { tag: 'input', classes: [], attrs: { type: 'text' }, inside: ['#displaybox'], html };
  ok('a text field writes in the theme\'s ink', inked(val(win(field, 'color'))), val(win(field, 'color')));
  ok('on a wash of that ink', washed(val(win(field, 'background')), 7), val(win(field, 'background')));
  ok('and a deeper wash on focus', washed(val(win(Object.assign({}, field, { states: { focus: true } }), 'background')), 12));
  const dd = { tag: 'span', classes: ['ui-dropdownchecklist'], inside: ['#displaybox'], html };
  ok('the disk picker takes the same wash', washed(val(win(dd, 'background-color')), 7), val(win(dd, 'background-color')));
  const ddText = { tag: 'span', classes: ['ui-dropdownchecklist-text'], inside: ['#displaybox'], outside: ['.ui-dropdownchecklist-item'], html };
  ok('and the same ink', inked(val(win(ddText, 'color'))));
  const trig = { tag: 'span', classes: ['cc-sel-trigger'], inside: ['#displaybox', '.cc-sel'], outside: ['.cc-open'], html };
  ok('a single-select at rest too', washed(val(win(trig, 'background')), 7) && inked(val(win(trig, 'color'))), val(win(trig, 'background')));
}

console.log('\nThe ink reads on both pages');
{
  const lum = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const light = tokens(true), dark = tokens(false);
  const lt = resolve('var(--cc-text)', light), dt = resolve('var(--cc-text)', dark);
  ok('dark ink on the white page, 4.5:1 at the least', ratio(lt, '#f2f2f2') >= 4.5, lt);
  ok('light ink on the black page, 4.5:1 at the least', ratio(dt, '#1c1b1b') >= 4.5, dt);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
