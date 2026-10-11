// Every card title on the settings page is a filled section badge sitting on the card's top
// edge, and stacked cards keep a 40px rhythm, the same below the tab strip. The badge follows the
// colour engine: the accent, or in rainbow mode its position within its own tab. A heading is not
// a control, so reactive mode never greys it.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of clean(css)) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const sel = stack.pop(); if (sel !== undefined && !sel.startsWith('@')) out.push({ sel, body: buf.trim() }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const body = (all, sel) => (all.find((r) => r.sel === sel) || {}).body || '';
const decl = (b, prop) => { const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(b); return m ? m[1].trim() : null; };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const css = rules(read('styles/docker.css'));
const settings = read('scripts/settings.js');

console.log('\nThe title badge sits on the top edge');
{
  const h = body(css, '.cc-set-h');
  ok('it is placed absolutely at the top', decl(h, 'position') === 'absolute' && decl(h, 'top') === '0', h);
  ok('it centres on the edge by its own height', decl(h, 'transform') === 'translateY(-50%)');
  ok('it sets no horizontal offset, so it lands on the content edge', !/(?:^|;)\s*(left|right|inset[\w-]*)\s*:/.test(h));
  ok('it is filled from the colour chain', /^var\(--cc-rb-c, var\(--cc-accent/.test(decl(h, 'background') || ''));
  ok('its ink comes from the same chain', /^var\(--cc-rb-ct, var\(--cc-accent-text/.test(decl(h, 'color') || ''));
  ok('it is a pill from the shape engine', decl(h, 'border-radius') === 'var(--cc-radius-pill)');
  ok('the card is its positioning context', decl(body(css, '.cc-set-card'), 'position') === 'relative');
  ok('the info bubble takes the badge ink', decl(body(css, '.cc-set-h .cc-info'), 'color') === 'inherit');
  const greying = css.filter((r) => /cc-set-h\b/.test(r.sel) && /rbneutral|reactive/.test(r.sel));
  ok('no reactive rule greys a heading', greying.length === 0, greying.map((r) => r.sel).join(' | '));
}

console.log('\nOne 40px rhythm');
{
  ok('stacked cards are 40px apart', /^40px\b/.test(decl(body(css, '.cc-set-wrap'), 'gap') || ''), decl(body(css, '.cc-set-wrap'), 'gap'));
  ok('the tab strip keeps the same 40px above the first card', /^0 0 40px$/.test(decl(body(css, '.cc-set-tabs'), 'margin') || ''), decl(body(css, '.cc-set-tabs'), 'margin'));
}

console.log('\nRainbow positions count per tab');
{
  const make = () => {
    const st = {}; return { st, style: { setProperty: (k, v) => { st[k] = v; }, removeProperty: (k) => { delete st[k]; } } };
  };
  const wraps = [[make(), make(), make()], [make(), make()]];
  const root = { querySelectorAll: () => wraps.map((hs) => ({ querySelectorAll: () => hs })) };
  const run = (rainbow) => new Function('window', 'root', 'rainbow', 'accent', 'idealText',
    grabFn(settings, 'paintCardHeads') + '\npaintCardHeads();')(
    { CCTheme: { rbColor: (i) => ['#ff8389', '#ff832b', '#fcc419'][i] } }, root, rainbow, '#1d99f3', () => '#161616');
  run(true);
  ok('the first card of each tab takes the first position', wraps[0][0].st['--cc-rb-c'] === '#ff8389' && wraps[1][0].st['--cc-rb-c'] === '#ff8389');
  ok('the next cards follow in order', wraps[0][1].st['--cc-rb-c'] === '#ff832b' && wraps[0][2].st['--cc-rb-c'] === '#fcc419');
  ok('each badge gets its ink with its fill', wraps[0][2].st['--cc-rb-ct'] === '#161616');
  run(false);
  ok('without rainbow every stamp is cleared', wraps.flat().every((h) => !('--cc-rb-c' in h.st) && !('--cc-rb-ct' in h.st)));
  ok('render paints the headings with the other colour passes', /paintSelects\(\); paintCardHeads\(\);/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
