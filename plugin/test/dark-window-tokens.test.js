// CannonadeCommand's own windows, .cc-pop and .cc-menu, stay #161616 on a white or azure
// page, so the tokens inside them must read as on a dark theme. A custom property mixed
// on <html> is inherited as the finished colour, so re-pinning --cc-text in the window
// does not reach --cc-hover-wash: every token that derives from a flipped one has to be
// mixed again in the window.
//
// The values are resolved the way a browser does: <html> computes its tokens with the
// light override on top, the window declares its own, and the rest is inherited.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, tokens, resolve, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// Header.css declares a few dark surfaces on :root that the light override also flips.
const rootDark = {};
for (const r of parseRules(fs.readFileSync(path.join(DIR, 'sheets/CannonadeCommand.Header.css'), 'utf8'))) {
  if (r.selector.trim() === ':root') for (const d of r.decls) if (d.prop.startsWith('--')) rootDark[d.prop] = d.value;
}
const dark = Object.assign({}, rootDark, tokens(false));
const light = Object.assign({}, rootDark, tokens(true));
const computed = (map) => { const out = {}; for (const k of Object.keys(map)) out[k] = resolve(map[k], map); return out; };
const darkHtml = computed(dark), lightHtml = computed(light);

const windowDecls = {};
for (const r of parseRules(fs.readFileSync(path.join(DIR, 'sheets/CannonadeCommand.Tokens.css'), 'utf8'))) {
  if (r.selector.replace(/\s+/g, ' ').trim() === '.cc-pop, .cc-menu') for (const d of r.decls) if (d.prop.startsWith('--')) windowDecls[d.prop] = d.value;
}
function inWindow(htmlComputed) {
  const scope = Object.assign({}, htmlComputed, windowDecls);
  const out = Object.assign({}, htmlComputed);
  for (const k of Object.keys(windowDecls)) out[k] = resolve(windowDecls[k], scope);
  return out;
}
const lightWin = inWindow(lightHtml), darkWin = inWindow(darkHtml);

console.log('\nThe resolver');
{
  const html = computed({ '--t': '#fff', '--w': 'mix(var(--t))' });
  const scope = Object.assign({}, html, { '--t': '#000' });
  ok('a derived token keeps the value <html> computed when only its source is re-pinned', resolve('var(--w)', scope) === 'mix(#fff)');
}

console.log('\nInside a window on a light theme every token reads as on a dark one');
const flipped = Object.keys(light).filter((k) => light[k] !== dark[k]);
const derived = Object.keys(dark).filter((k) => !flipped.includes(k) && darkHtml[k] !== lightHtml[k]);
ok('the light override flips the text tokens at all', flipped.includes('--cc-text-chip') && flipped.includes('--cc-text'));
for (const k of flipped.concat(derived)) {
  ok(`${k}`, lightWin[k] === darkHtml[k], `${lightWin[k]} in the window, ${darkHtml[k]} on a dark theme`);
}
ok('on a dark theme the window changes nothing', Object.keys(windowDecls).every((k) => darkWin[k] === darkHtml[k]),
  Object.keys(windowDecls).filter((k) => darkWin[k] !== darkHtml[k]).join(', '));

// The Startplan window on a white theme in the reactive mode: resting chips and buttons
// sit on the translucent chip grey over the window's #161616 and take --cc-text-chip.
console.log('\nThe Startplan window, white theme, reactive rest');
{
  const lum = (rgb) => { const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(rgb[0]) + 0.7152 * l(rgb[1]) + 0.0722 * l(rgb[2]); };
  const rgb = (v) => { let m = /^#([0-9a-f]{6})$/i.exec(v); if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; } m = /^rgba?\(([^)]*)\)$/.exec(v); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } return null; };
  const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
  const WIN = [0x16, 0x16, 0x16];
  const html = ['cc-docker-on', 'cc-shares-rbneutral', 'Theme--white'];
  const CTLS = { 'a resting day chip': ['cc-day'], '"+ Zeitplan"': ['cc-btn'], '"Speichern"': ['cc-btn', 'cc-btn-primary'] };
  for (const [what, classes] of Object.entries(CTLS)) {
    const el = { tag: 'span', classes, attrs: { class: classes.join(' ') }, states: {}, html };
    const top = (prop) => { const c = candidates('docker', el, prop).filter((x) => /\.cc-pop/.test(x.selector)); return c[c.length - 1]; };
    const bg = top('background'), fg = top('color');
    const b = bg && rgb(resolve(bg.value, lightWin)), f = fg && rgb(resolve(fg.value, lightWin));
    const r = b && f ? (() => { const x = lum(over(b, WIN)), y = lum(f); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); })() : 0;
    ok(`${what} reads at 4.5:1`, r >= 4.5, `${fg && resolve(fg.value, lightWin)} on ${bg && bg.value} = ${r.toFixed(2)}:1`);
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
