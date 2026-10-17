// Unassigned Devices' controls (gear, refresh and three switches) stand at the right end of the
// first badge line on /Main, over the edge of the card that ends that line. That card keeps their
// width free beside its badge, however narrow its table, and the other cards stay as they are.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const shares = read('scripts/shares.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// Every rule with the @media conditions it sits in.
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined && !head.startsWith('@')) out.push({ sel: head, body: buf.trim(), media: stack.join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const disks = rules(read('sheets/CannonadeCommand.Disks.css'));
const px = (s) => { const m = /(-?\d+(?:\.\d+)?)px/.exec(s || ''); return m ? +m[1] : NaN; };

console.log('\nThe card that ends the badge line keeps room for the controls');
{
  const room = disks.filter((r) => /--cc-ud-ctrls-w/.test(r.body));
  ok('one rule keeps the room', room.length === 1, room.length);
  const r = room[0] || { sel: '', body: '', media: '' };
  ok('on the badge line of the last card in the row and no other', /\.cc-dk-udrow > :last-child div\.title$/.test(r.sel) && !/,/.test(r.sel), r.sel);
  const pad = /padding-right:\s*calc\(var\(--cc-ud-ctrls-w, 0px\) \+ (\d+)px\) !important/.exec(r.body);
  ok('as the measured width of the controls plus a gap, over the popup look\'s padding on every title', !!pad, r.body);
  const phone = disks.filter((x) => /\.cc-card-head > \.cc-ud-ctrls/.test(x.sel) && /max-width: 600px/.test(x.media));
  ok('everywhere except on a phone, where the controls take a row of their own', /^@media not all and \(max-width: 600px\)$/.test(r.media) && phone.length === 1, r.media);

  // The controls end where the row ends, and the row is as wide as its cards, so they end where the
  // last card ends. Its badge ends the card's padding and the reserved room before that.
  const ctrls = disks.find((x) => /section\.cc-dk-box \.cc-card-head > \.cc-ud-ctrls$/.test(x.sel) && !x.media);
  const column = disks.find((x) => /section\.cc-dk-box:has\(> \.cc-dk-udrow\)$/.test(x.sel) && !x.media);
  const card = disks.find((x) => /\.cc-dk-box \.cc-dk-udrow > \*$/.test(x.sel) && /padding:/.test(x.body) && !x.media);
  ok('the controls are anchored to the right end of the row', !!ctrls && /right:\s*0/.test(ctrls.body) && !!column && /grid-template-columns:\s*minmax\(0, max-content\)/.test(column.body));
  const cardPad = card ? px(/padding:\s*\S+\s+(\S+)/.exec(card.body)[1]) : NaN;
  const clear = cardPad + (pad ? +pad[1] : NaN);
  for (const w of [216, 150, 300]) {
    const cardRight = 1739, ctrlsLeft = cardRight - w, badgeRight = cardRight - cardPad - (w + (pad ? +pad[1] : NaN));
    ok('with controls ' + w + 'px wide the badge stops ' + clear + 'px short of them', ctrlsLeft - badgeRight === clear && clear >= 16, [badgeRight, ctrlsLeft].join(' '));
  }
}

console.log('\nshares.js measures the controls');
{
  const body = 'var ccUdCtrlsRo = null;\n' + grabFn(shares, 'ccUdCtrlsMeasure') + '\nreturn ccUdCtrlsMeasure;';
  const observers = [];
  class RO { constructor(cb) { this.cb = cb; this.on = []; observers.push(this); } observe(t) { this.on.push(t); } disconnect() { this.on = []; } }
  const measure = new Function('ResizeObserver', body)(RO);
  const props = {};
  const sec = { style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } } };
  const wrap = {};
  measure(sec, wrap);
  ok('it watches the cluster', observers.length === 1 && observers[0].on[0] === wrap);
  observers[0].cb([{ contentRect: { width: 215.4 } }]);
  ok('and hands its width to the section, rounded up', props['--cc-ud-ctrls-w'] === '216px', props['--cc-ud-ctrls-w']);
  observers[0].cb([{ contentRect: { width: 164 } }]);
  ok('a UD build with fewer controls gets less room', props['--cc-ud-ctrls-w'] === '164px', props['--cc-ud-ctrls-w']);
  measure(sec, wrap);
  ok('a second move watches with one observer only', observers[0].on.length === 0 && observers[1].on.length === 1);
  measure(sec, null);
  ok('sending the controls home drops the room', !('--cc-ud-ctrls-w' in props) && observers[1].on.length === 0);
  ok('the move measures once the cluster sits in the head', /head\.appendChild\(wrap\);[^\n]*\n\s*ccUdCtrlsMeasure\(sec, wrap\);/.test(grabFn(shares, 'ccUdCtrlsMove')));
  ok('and the way home lets go of it', /ccUdCtrlsMeasure\([^,]+, null\);/.test(grabFn(shares, 'ccUdCtrlsHome')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
