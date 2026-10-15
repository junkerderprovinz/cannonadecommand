// Every colour on the settings page is set with one control: the embedded picker, and under it the
// GlimStone presets in one row with the hex field as its last cell, that row exactly as wide as the
// picker. The field stands at the end of its row with its name at the start, like every other
// control on the page.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const win = (page, e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');
const code = settings.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');

console.log('\nNo colour on the page is set without the presets');
{
  const pickers = [...code.matchAll(/inlinePicker\(/g)].length;
  ok('the bare picker is built in one place, inside colourField', pickers === 2 && /function colourField[\s\S]*?inlinePicker\(/.test(code), pickers);
  const uses = [...code.matchAll(/colourField\(/g)].length - 1;
  ok('the accent, an area\'s accent, the tile, the icon, the server name and the palette all use it', uses >= 6, uses);
  ok('no hex field is built outside it', [...code.matchAll(/el\("input", "cc-set-hexin"\)/g)].length === 1);
}

console.log('\nThe field: picker on top, presets and hex field in one row under it');
{
  // A shim with just enough DOM for colourField and the helpers it calls.
  class N {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {}; this.style = { setProperty() {}, removeProperty() {} }; this.cls = new Set(); this.value = ''; const self = this; this.classList = { toggle(c, f) { const w = f === undefined ? !self.cls.has(c) : !!f; w ? self.cls.add(c) : self.cls.delete(c); return w; }, contains: (c) => self.cls.has(c), add: (c) => self.cls.add(c), remove: (c) => self.cls.delete(c) }; }
    set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.cls].join(' '); }
    set textContent(v) { this.text = v; }
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k]; }
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
    querySelectorAll(sel) { const out = []; const want = sel.replace('.', ''); (function walk(n) { n.children.forEach((k) => { if (k.cls.has(want)) out.push(k); walk(k); }); })(this); return out; }
  }
  const document = { createElement: (t) => new N(t) };
  const picks = [];
  const fake = function inlinePicker(hex, onChange) { const b = new N('div'); b.cls.add('cc-ip'); b.set = []; b._set = (h) => b.set.push(h); b._get = () => '#123456'; b.drag = onChange; return b; };
  const build = new Function('document', 'inlinePicker', 'PRESETS',
    'var de = false;\n' + ['el', 'T', 'normHex', 'actionBtn', 'swMark', 'swMarkRow', 'ccTick', 'idealText', 'colourField'].map((n) => grabFn(settings, n)).join('\n') +
    '\nreturn colourField;')(document, fake, ['#FCC419', '#1D99F3', '#6FDC8C']);
  const f = build('#1d99f3', (v) => picks.push(v), { clearable: true });
  const [picker, row] = f.children;
  ok('the picker comes first, the row under it', picker.cls.has('cc-ip') && row.cls.has('cc-set-swatches') && row.cls.has('cc-fill'));
  const sws = row.children.filter((c) => c.cls.has('cc-set-sw')), hex = row.children[row.children.length - 1];
  ok('the row holds every preset and then the hex field', sws.length === 3 && hex.tagName === 'INPUT' && hex.cls.has('cc-set-hexin'));
  ok('the preset in use carries the tick', sws[1].cls.has('cc-set-sw-on') && !sws[0].cls.has('cc-set-sw-on'));
  ok('a preset is a button the keyboard reaches', sws.every((s) => s.attrs.role === 'button' && s.attrs.tabindex === '0'));
  sws[2].listeners.click[0]();
  ok('a preset click sets the picker, the hex field and the value', picks[0] === '#6FDC8C' && hex.value === '#6FDC8C' && picker.set.includes('#6FDC8C') && sws[2].cls.has('cc-set-sw-on'));
  hex.value = 'ff8389'; hex.listeners.input[0]();
  ok('a typed hex value is normalised and taken', picks[1] === '#ff8389' && !sws.some((s) => s.cls.has('cc-set-sw-on')));
  hex.value = ''; hex.listeners.input[0]();
  ok('a clearable field reports an emptied hex field', picks[2] === '');
  const g = build('', (v) => picks.push(v));
  const gh = g.children[1].children[g.children[1].children.length - 1];
  gh.value = ''; gh.listeners.input[0]();
  ok('any other field ignores an empty hex field', picks.length === 3);
  picker.drag('#abcdef');
  ok('a drag in the picker writes the hex field', hex.value === '#abcdef' && picks[3] === '#abcdef');
  f._set('', '#00ff00');
  ok('_set shows the stand-in on the picker while the value is empty', picker.set[picker.set.length - 1] === '#00ff00' && hex.value === '');
}

console.log('\nThe field stands at the end of its row, as wide as its picker');
{
  const page = withUnraid('settings');
  const pick = { tag: 'div', classes: ['cc-set-pickrow'], inside: ['#cc-settings', '.cc-set-row'] };
  ok('it is pushed to the row\'s end', /auto$/.test(val(win(page, pick, 'margin'))), val(win(page, pick, 'margin')));
  ok('it keeps a width of its own', val(win(page, pick, 'flex')) === '0 1 420px' && val(win(page, pick, 'max-width')) === '420px');
  ok('picker and row stretch to that one width', val(win(page, pick, 'flex-direction')) === 'column' && val(win(page, pick, 'align-items')) === 'stretch');
  const row = { tag: 'div', classes: ['cc-set-swatches', 'cc-fill'], inside: ['#cc-settings', '.cc-set-pickrow'] };
  ok('the preset row adds no margin of its own inside it', val(win(page, row, 'margin')) === '0');
  const hex = { tag: 'input', classes: ['cc-set-hexin'], attrs: { type: 'text' }, inside: ['#cc-settings', '.cc-set-swatches', '.cc-fill'] };
  ok('the hex field takes two cells of the row', val(win(page, hex, 'flex')) === '2 2 0');
  const fr = { tag: 'div', classes: ['cc-set-row', 'cc-set-fieldrow'], inside: ['#cc-settings', '.cc-set-card'] };
  ok('its name sits at the start of the first line', val(win(page, fr, 'align-items')) === 'flex-start' && val(win(page, fr, 'flex-wrap')) === 'nowrap');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
