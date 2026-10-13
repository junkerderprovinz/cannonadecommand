// A bar that shows a fill level sloshes at its end (GlimStone, "Illustrations"): the end surges
// out leaning forward and draws back and white dots drift toward it. Nothing runs past the end or
// pops. The motion setting sets how lively it is, and at "off" or under reduced motion the liquid
// rests level. What can quietly break it:
//   · a level that leaves a slosh dial out inherits the lively number
//   · an animation outside the no-preference gate keeps moving under reduced motion
//   · a bar drawn again every few seconds starts its swing over each time
//   · a MutationObserver that calls the stamp wakes itself if the stamp writes twice
//   · a fill level CannonadeCommand draws without the class
//   · bubbles that run past the end and pop coming back into a bar
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const tokens = read('sheets/CannonadeCommand.Tokens.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined && !head.startsWith('@')) out.push({ sel: head, body: buf.trim(), media: stack.filter((h) => h.startsWith('@media')).join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const all = rules(tokens);

console.log('\nEvery level answers the slosh dials');
{
  const DIALS = ['dur', 'surge', 'lean', 'bubble-pace', 'bubble-opacity'].map((d) => '--cc-motion-slosh-' + d);
  const block = (sel, gated) => all.find((r) => r.sel === sel && /--cc-motion-slosh-/.test(r.body) && (gated ? /no-preference/.test(r.media) : !r.media));
  const v = (r, d) => ((new RegExp(d + ':\\s*([^;]+);').exec(r ? r.body : '') || [])[1] || '').trim();
  const levels = { still: block('html', false), wild: block('html', true), subtle: block('html[data-cc-motion="subtle"]', true), off: block('html[data-cc-motion="off"]', true) };
  for (const [name, r] of Object.entries(levels)) ok(name + ' declares every slosh dial', !!r && DIALS.every((d) => v(r, d) !== ''), r ? DIALS.filter((d) => !v(r, d)).join(' ') : 'block missing');
  ok('wild swings in 3.6s with a 5px surge, as GlimStone\'s default', v(levels.wild, '--cc-motion-slosh-dur') === '3.6s' && v(levels.wild, '--cc-motion-slosh-surge') === '5px');
  ok('subtle swings in 5s with a 3.5px surge', v(levels.subtle, '--cc-motion-slosh-dur') === '5s' && v(levels.subtle, '--cc-motion-slosh-surge') === '3.5px');
  for (const n of ['still', 'off']) ok(n + ' rests level: no surge, no lean, no dots', v(levels[n], '--cc-motion-slosh-surge') === '0px' && v(levels[n], '--cc-motion-slosh-lean') === '0deg' && v(levels[n], '--cc-motion-slosh-bubble-opacity') === '0');
}

console.log('\nThe motion lives inside the gate');
{
  const anim = all.filter((r) => /cc-slosh/.test(r.sel) && /animation\s*:/.test(r.body) && !/animation:\s*none/.test(r.body));
  ok('the end and the dots animate', ['.cc-slosh-edge::after', '.cc-slosh-edge::before'].every((s) => anim.some((r) => r.sel === s)));
  const loose = anim.filter((r) => !/prefers-reduced-motion:\s*no-preference/.test(r.media));
  ok('no slosh animation sits outside the no-preference gate', loose.length === 0, loose.map((r) => r.sel).join(' | '));
  ok('every one starts at the bar\'s phase', anim.every((r) => /var\(--cc-slosh-phase, 0s\)/.test(r.body)));
  const off = all.find((r) => /html\[data-cc-motion="off"\][^,]*cc-slosh/.test(r.sel) && /animation:\s*none/.test(r.body));
  ok('at "off" they stop outright', !!off && /::before/.test(off.sel) && /::after/.test(off.sel));
  const restDots = all.find((r) => r.sel === '.cc-slosh-edge::before' && !r.media);
  ok('at rest the dots are hidden', restDots && /opacity: 0;/.test(restDots.body));
  const restEnd = all.find((r) => r.sel === '.cc-slosh-edge::after' && !r.media);
  ok('at rest the end lies under the fill', restEnd && /translate: calc\(-100% \* var\(--cc-dir-sign, 1\)\) 0/.test(restEnd.body));
  ok('its corners follow the shape engine', restEnd && /border-start-end-radius: var\(--cc-radius-pill\)/.test(restEnd.body));
  for (const k of ['cc-slosh-surge', 'cc-slosh-fizz']) ok('@keyframes ' + k, new RegExp('@keyframes ' + k + ' \\{').test(tokens));
}

console.log('\nCCTheme.slosh stamps a fill once');
{
  let clock = 12345.6789;
  global.performance = { now: () => clock };
  class F {
    constructor(width) { this.kids = []; this.cls = new Set(); this.props = {}; this.appends = 0; const self = this; this.style = { width: width === undefined ? '40%' : width, setProperty: (k, v) => { self.props[k] = v; self.writes = (self.writes || 0) + 1; }, removeProperty: (k) => { delete self.props[k]; } }; }
    get classList() { const c = this.cls; return { add: (x) => c.add(x), remove: (x) => c.delete(x), contains: (x) => c.has(x) }; }
    appendChild(c) { this.kids.push(c); this.appends++; return c; }
  }
  const document = { createElement: () => ({ className: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }) };
  const slosh = new Function('document', grabFn(read('scripts/cc-theme.js'), 'slosh') + '\nreturn slosh;')(document);
  const f = new F();
  slosh(f);
  ok('the fill takes the class', f.cls.has('cc-slosh-edge'));
  ok('and nothing inside it, so no bubble rides along', f.kids.length === 0);
  ok('its phase is the time since the page loaded, as a negative delay', f.props['--cc-slosh-phase'] === '-12.346s', f.props['--cc-slosh-phase']);
  clock = 99999;
  slosh(f);
  ok('a second call writes nothing, so an observer that calls it settles', f.appends === 0 && f.writes === 1 && f.props['--cc-slosh-phase'] === '-12.346s');
  slosh(f, false);
  ok('on === false takes the class and the phase off', !f.cls.has('cc-slosh-edge') && !('--cc-slosh-phase' in f.props));
  const g = new F(); slosh(g, false);
  ok('taking it off a bar that never sloshed writes nothing', !g.writes && !g.appends);
  const empty = new F('0%'); slosh(empty);
  ok('an empty bar does not slosh, since it holds no liquid', !empty.cls.has('cc-slosh-edge') && !empty.kids.length);
  const drained = new F(); slosh(drained); drained.style.width = '0%'; slosh(drained);
  ok('a bar that empties stops sloshing', !drained.cls.has('cc-slosh-edge') && !drained.kids.length);
  ok('no sheet or script draws a popping bubble', !/cc-slosh-pop|--cc-motion-slosh-pop-/.test(tokens + read('scripts/cc-theme.js')));
  ok('cc-theme.js publishes it', /slosh: slosh,/.test(read('scripts/cc-theme.js')));
}

console.log('\nEvery fill level CannonadeCommand draws sloshes');
{
  const docker = read('scripts/docker.js'), header = read('scripts/header.js');
  ok('the CPU and RAM gauges on a Docker card', /fill\.style\.width = [^;]+; if \(window\.CCTheme && window\.CCTheme\.slosh\) window\.CCTheme\.slosh\(fill\);/.test(grabFn(docker, 'gauge')));
  ok('the array, RAM and CPU bars in the status island', /window\.CCTheme\.slosh\(ufill\)/.test(header));
  const bars = grabFn(header, 'ccStateBars');
  ok('the /Main usage bars while the Shares area restyles them', /CT\.slosh\(allBars\[s\], mainOn && !!allBars\[s\]\.closest\("#displaybox"\)\)/.test(bars) && /rt\.contains\("cc-shares-on"\) && rt\.contains\("cc-on-main"\)/.test(bars));
  ok('the array meter in the menu while the header area is on', /CT\.slosh\(meter, rt\.contains\("cc-header-on"\)\)/.test(bars));
  ok('the menu meter clips what runs past its end', /html\.cc-header-on #menu \.usage-bar \{[^}]*overflow: hidden;/.test(read('sheets/CannonadeCommand.Header.css')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
