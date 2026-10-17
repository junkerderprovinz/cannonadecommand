// The header bell tells of unread notifications by swinging instead of wearing Connect's corner
// badge: a calm beat every 1.6 seconds while anything is unread, until all are read. The box looks
// like every other header button, and where nothing may move a dot in the highest level's colour
// stays, so unread notifications never go unseen. The beat is a CSS animation, so the main thread
// does no work for it.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const header = read('scripts/header.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const FNS = ['ccBellLevel', 'ccBellSwinging', 'ccBellSync', 'ccBellWatch'];

const BADGE = { alert: 'absolute -top-1 -right-1 size-4 rounded-full text-unraid-red', warning: 'absolute -top-1 -right-1 size-4 rounded-full text-yellow-500 translate-y-0.5', notice: 'absolute top-0 right-0 size-2.5 rounded-full border border-neutral-800 bg-unraid-green' };
// The trigger span with the badge Connect draws for a level, or none. swinging says whether the
// stylesheet has the beat running on the glyph right now.
function bell(level) {
  const attrs = { 'aria-expanded': 'false' }, cls = new Set(), on = {};
  const s = {
    level, swinging: false, writes: 0,
    querySelector: (sel) => (/^svg:not/.test(sel)
      ? { getAnimations: () => (s.swinging ? [{ animationName: 'cc-bell-swing', playState: 'running' }] : []) }
      : (s.level ? { getAttribute: () => BADGE[s.level] } : null)),
    getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: (k) => { delete attrs[k]; },
    hasAttribute: (k) => k in attrs,
    classList: { add: (c) => { s.writes++; cls.add(c); }, remove: (c) => { s.writes++; cls.delete(c); }, contains: (c) => cls.has(c) },
    addEventListener: (e, f) => { on[e] = f; }, fire: (e, name) => on[e] && on[e]({ animationName: name }),
  };
  s.ringing = () => cls.has('cc-bell-ring');
  return s;
}

function load() {
  const observers = [];
  class MO { constructor(cb) { this.cb = cb; observers.push(this); } observe(t) { this.target = t; } disconnect() { this.target = null; } }
  const vars = /\n\s*var ccBellSpan[^\n]*\n/.exec(header)[0];
  const body = vars + FNS.map((n) => grabFn(header, n)).join('\n') + '\nreturn ccBellWatch;';
  const watch = new Function('MutationObserver', 'T', body)(MO, (de) => de);
  // A mutation inside the watched span, as Connect patches its badge.
  const patch = (s, level) => { s.level = level; observers.filter((o) => o.target === s).forEach((o) => o.cb()); };
  return { watch, patch };
}

console.log('\nThe bell swings while anything is unread');
{
  const m = load();
  const s = bell('alert');
  m.watch(s);
  ok('unread notifications on load start the beat', s.ringing());
  ok('and the box is told the highest level for the dot', s.getAttribute('data-cc-bell') === 'alert');
  ok('its bubble says they are unread', s.getAttribute('data-cc-tip') === 'Ungelesene Benachrichtigungen');
  s.swinging = true;
  s.fire('animationiteration', 'cc-bell-swing');
  ok('the beat goes on from one swing to the next', s.ringing());
  const w = s.writes;
  m.patch(s, 'alert'); m.patch(s, 'alert');
  ok('a mutation that changes nothing writes no class, which would wake the observer again', s.writes === w, s.writes - w);
}
{
  const m = load();
  const s = bell('');
  m.watch(s);
  ok('a bell with nothing unread stays still', !s.ringing() && s.getAttribute('data-cc-bell') === null);
  ok('and is simply called notifications', s.getAttribute('data-cc-tip') === 'Benachrichtigungen');
  m.patch(s, 'notice');
  ok('a new notification starts the beat at once', s.ringing() && s.getAttribute('data-cc-bell') === 'notice');
  m.patch(s, 'warning');
  ok('a warning on top keeps it going in the warning colour', s.ringing() && s.getAttribute('data-cc-bell') === 'warning');
}

console.log('\nOnce all are read it finishes its swing and hangs upright');
{
  const m = load();
  const s = bell('warning');
  m.watch(s);
  s.swinging = true;
  m.patch(s, '');
  ok('reading the last one lets the swing under way run on', s.ringing() && s.getAttribute('data-cc-bell') === null);
  ok('the bubble is plain again', s.getAttribute('data-cc-tip') === 'Benachrichtigungen');
  s.fire('animationiteration', 'cc-wild-bounce');
  ok('another animation inside the bell does not end the beat', s.ringing());
  s.fire('animationiteration', 'cc-bell-swing');
  ok('the beat stops where it ends, with the bell upright', !s.ringing());
}
{
  const m = load();
  const s = bell('alert');
  m.watch(s);
  s.swinging = true;
  m.patch(s, '');
  m.patch(s, 'notice');
  s.fire('animationiteration', 'cc-bell-swing');
  ok('a new one in the last swing keeps the beat going', s.ringing());
}
{
  const m = load();
  const s = bell('alert');
  m.watch(s);
  s.swinging = false;
  m.patch(s, '');
  ok('a bell that is not swinging (no motion, list open) stops at once', !s.ringing());
}
{
  const m = load();
  m.watch(bell('warning'));
  const fresh = bell('warning');
  m.watch(fresh);
  ok('a span Connect rebuilds carries the beat on', fresh.ringing() && fresh.getAttribute('data-cc-bell') === 'warning');
}
{
  const block = FNS.map((n) => grabFn(header, n)).join('\n');
  ok('no timer, frame loop or socket handler drives the beat', !/setTimeout|setInterval|requestAnimationFrame|defaultPage/.test(block));
}

// Every rule with the @media conditions it sits in.
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined) out.push({ sel: head, body: buf.trim(), media: stack.join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const hcss = rules(read('sheets/CannonadeCommand.Header.css'));
const tcss = rules(read('sheets/CannonadeCommand.Tokens.css'));
const dial = (sel, gated, name) => {
  const r = tcss.find((x) => x.sel === sel && /no-preference/.test(x.media) === gated && x.body.includes(name));
  const m = r && new RegExp(name + ':\\s*([^;]+);').exec(r.body);
  return m ? m[1].trim() : null;
};
const last = (c) => (c.length ? c[c.length - 1].value : null);

console.log('\nThe box stays like every other header button');
{
  for (const html of [['cc-header-on'], ['cc-header-on', 'cc-header-rbneutral']]) {
    const mode = html.length > 1 ? 'grey' : 'colour';
    for (const states of [{}, { hover: true }]) {
      const box = (attrs) => last(candidates('every', { tag: 'span', classes: [], attrs, states, html }, 'background'));
      const plain = box({ 'data-cc-trig': 'burger' }), unread = box({ 'data-cc-trig': 'bell', 'data-cc-bell': 'alert' });
      ok('in the ' + mode + ' mode' + (states.hover ? ' under the pointer' : '') + ' an unread bell fills like the burger', unread === plain, unread + ' | ' + plain);
    }
    const ink = last(candidates('every', { tag: 'span', classes: [], attrs: { 'data-cc-trig': 'bell', 'data-cc-bell': 'alert' }, html }, 'color'));
    const plainInk = last(candidates('every', { tag: 'span', classes: [], attrs: { 'data-cc-trig': 'burger' }, html }, 'color'));
    ok('and keeps its ink in the ' + mode + ' mode', ink === plainInk, ink + ' | ' + plainInk);
  }
  const hidden = (tag, cls) => last(candidates('every', { tag, classes: cls.split(' '), attrs: { class: cls }, html: ['cc-header-on'] }, 'display')) === 'none';
  ok('Connect\'s shield and triangle never show', hidden('svg', BADGE.alert) && hidden('svg', BADGE.warning));
  ok('nor its green dot', hidden('div', BADGE.notice));
}

console.log('\nThe beat runs in CSS');
{
  const swing = hcss.find((x) => /\.cc-bell-ring/.test(x.sel) && /animation:/.test(x.body));
  ok('it runs only inside the no-preference gate and never at "off"', !!swing && /no-preference/.test(swing.media) && /:not\(\[data-cc-motion="off"\]\)/.test(swing.sel));
  ok('over and over, one beat after the other', !!swing && /animation:\s*cc-bell-swing var\(--cc-motion-bell-dur, 0s\)[^;]*\binfinite\b/.test(swing.body), swing && swing.body);
  ok('and rests while the notification list is open', !!swing && /\.cc-bell-ring:not\(\[aria-expanded="true"\]\)/.test(swing.sel));
  const frames = hcss.filter((x) => /^@keyframes cc-bell-swing$/.test(x.media));
  const at = (pct) => frames.find((f) => f.sel.split(',').map((p) => p.trim()).includes(pct + '%'));
  const swung = frames.filter((f) => /var\(--cc-motion-bell-swing/.test(f.body)).map((f) => parseFloat(f.sel));
  ok('it swings in the first half of the beat', swung.length >= 3 && Math.max(...swung) <= 50, swung.join(' '));
  ok('and hangs upright for the rest', !!at(50) && !!at(100) && /rotate:\s*0deg/.test(at(50).body) && at(50) === at(100));
  ok('it moves rotate alone, which the compositor runs', frames.length > 0 && frames.every((f) => /^rotate:[^;]+;?$/.test(f.body)), frames.map((f) => f.body).join(' | '));
  const beat = (sel) => parseInt(dial(sel, true, '--cc-motion-bell-dur'), 10);
  ok('a beat at the wild and subtle levels comes every one to two seconds', [beat('html'), beat('html[data-cc-motion="subtle"]')].every((v) => v >= 1000 && v <= 2000), [beat('html'), beat('html[data-cc-motion="subtle"]')].join(' '));
  const deg = (sel, gated) => parseFloat(dial(sel, gated, '--cc-motion-bell-swing'));
  ok('wild swings further than subtle', deg('html', true) > deg('html[data-cc-motion="subtle"]', true) && deg('html[data-cc-motion="subtle"]', true) > 0);
  ok('reduced motion and "off" do not swing at all', dial('html', false, '--cc-motion-bell-dur') === '0s' && dial('html[data-cc-motion="off"]', true, '--cc-motion-bell-dur') === '0s' && deg('html', false) === 0);
}

console.log('\nWithout motion a dot stays');
{
  const dot = hcss.find((x) => /\[data-cc-trig="bell"\]\[data-cc-bell\]::after$/.test(x.sel));
  ok('an unread bell has a dot at the corner of its glyph', !!dot && /content:\s*""/.test(dot.body) && /position:\s*absolute/.test(dot.body));
  ok('only where the motion level lets it show', !!dot && /display:\s*var\(--cc-motion-bell-mark, none\)/.test(dot.body));
  ok('in the shape setting\'s radius', !!dot && /border-radius:\s*var\(--cc-radius-pill\)/.test(dot.body));
  const lvl = (l) => { const r = hcss.find((x) => x.sel === `html.cc-header-on [data-cc-trig="bell"][data-cc-bell="${l}"]`); return r ? r.body : ''; };
  ok('in the highest level\'s colour: alert red, warning orange, notice green', !!dot && /background:\s*var\(--cc-bell-c\)/.test(dot.body) && /--cc-err\b/.test(lvl('alert')) && /--cc-warn\b/.test(lvl('warning')) && /--cc-ok\b/.test(lvl('notice')), [lvl('alert'), lvl('warning'), lvl('notice')].join(' | '));
  ok('at the wild and subtle levels the dot stays away', dial('html', true, '--cc-motion-bell-mark') === 'none' && dial('html[data-cc-motion="subtle"]', true, '--cc-motion-bell-mark') === 'none');
  ok('reduced motion and "off" show it', dial('html', false, '--cc-motion-bell-mark') === 'block' && dial('html[data-cc-motion="off"]', true, '--cc-motion-bell-mark') === 'block');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
