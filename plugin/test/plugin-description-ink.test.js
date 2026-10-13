// A plugin's description is muted text that still reads at 4.5:1 on every theme, on both row
// shades: the dark themes keep their grey, the light ones take their own muted ink. The colour
// lives in the sheet rather than inline, where no theme rule could reach it.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid, tokens, resolve } = require('./cascade');
const plugins = fs.readFileSync(path.join(DIR, 'scripts/plugins.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const lum = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const page = withUnraid('docker');
const ink = (html, light) => { const w = candidates(page, { tag: 'div', classes: ['cc-desc'], html }, 'color').pop(); return w && resolve(w.value, tokens(light)); };
const ROWS = { black: ['#1c1b1b', '#212121'], white: ['#f2f2f2', '#e8e8e8'] };

console.log('\nThe description reads on every row');
for (const [theme, rows] of Object.entries(ROWS)) {
  const light = theme === 'white';
  const c = ink(['Theme--' + theme], light);
  for (const bg of rows) ok(theme + ': ' + c + ' on ' + bg + ' reads at 4.5:1 or more', c && ratio(c, bg) >= 4.5, c && ratio(c, bg).toFixed(2));
}
ok('azure takes the light ink too', ink(['Theme--azure'], true) === ink(['Theme--white'], true));

console.log('\nThe script leaves the colour to the sheet');
ok('no inline colour on the description', !/desc\.style\.setProperty\("color"/.test(plugins));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
