// The header bell tells of unread notifications by swinging instead of wearing Connect's corner
// badge: once when they first show, again for each new one, and every 30 seconds while any stay
// unread. The box takes the colour of the highest level, and where nothing may move a calm sign
// stays, so unread notifications never go unseen.
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

// A clock the test moves by hand, so half a minute takes no time.
let now = 1e6, timers = [], seq = 0;
const setT = (fn, ms) => { const id = ++seq; timers.push({ id, at: now + (ms || 0), fn }); return id; };
const clearT = (id) => { timers = timers.filter((t) => t.id !== id); };
function advance(ms) {
  const end = now + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at);
    const t = timers[0];
    if (!t || t.at > end) break;
    timers.shift(); now = t.at; t.fn();
  }
  now = end;
}

const BADGE = { alert: 'absolute -top-1 -right-1 size-4 rounded-full text-unraid-red', warning: 'absolute -top-1 -right-1 size-4 rounded-full text-yellow-500 translate-y-0.5', notice: 'absolute top-0 right-0 size-2.5 rounded-full border border-neutral-800 bg-unraid-green' };
// The trigger span, with the badge Connect draws for a level, or none.
function bell(level) {
  const attrs = { 'aria-expanded': 'false' }, cls = new Set(), on = {};
  const s = {
    swings: 0, level,
    querySelector: () => (s.level ? { getAttribute: () => BADGE[s.level] } : null),
    getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: (k) => { delete attrs[k]; },
    classList: { add: (c) => { if (c === 'cc-bell-ring') s.swings++; cls.add(c); }, remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    offsetWidth: 36,
    addEventListener: (e, f) => { on[e] = f; }, fire: (e, name) => on[e] && on[e]({ animationName: name }),
  };
  return s;
}

function load() {
  const observers = [], channel = [];
  const env = { still: false };
  class MO { constructor(cb) { this.cb = cb; observers.push(this); } observe(t) { this.target = t; } disconnect() { this.target = null; } }
  const window = { CCPictures: { still: () => env.still }, defaultPage: { on: (e, f) => channel.push(f) } };
  const document = { hidden: false };
  const vars = /var CC_BELL_RANK[^\n]*\n\s*var ccBellSpan[^\n]*\n/.exec(header)[0];
  const body = vars + ['ccBellLevel', 'ccBellRing', 'ccBellSync', 'ccBellNews', 'ccBellWatch'].map((n) => grabFn(header, n)).join('\n') + '\nreturn ccBellWatch;';
  const watch = new Function('window', 'document', 'setTimeout', 'clearTimeout', 'MutationObserver', 'Date', 'T', body)(window, document, setT, clearT, MO, { now: () => now }, (de) => de);
  // A mutation inside the watched span, as Connect patches its badge.
  const patch = (s, level) => { s.level = level; observers.filter((o) => o.target === s).forEach((o) => o.cb()); };
  const notify = (list, ch) => channel.forEach((f) => f(JSON.stringify(list), { id: { channel: () => (ch == null ? 2 : ch) } }));
  return { watch, patch, notify, env, document };
}

console.log('\nA new notification swings the bell');
{
  timers = [];
  const m = load();
  const s = bell('alert');
  m.watch(s);
  ok('unread notifications on load swing the bell once', s.swings === 1, s.swings);
  ok('and the box is told the highest level', s.getAttribute('data-cc-bell') === 'alert');
  ok('its bubble says they are unread', s.getAttribute('data-cc-tip') === 'Ungelesene Benachrichtigungen');
  s.fire('animationend', 'cc-wild-bounce');
  ok('another animation ending inside the bell does not cut the swing short', s.classList.contains('cc-bell-ring'));
  s.fire('animationend', 'cc-bell-swing');
  ok('the swing class goes once the swing ends, ready for the next', !s.classList.contains('cc-bell-ring'));
}
{
  timers = [];
  const m = load();
  const s = bell('');
  m.watch(s);
  ok('a bell with nothing unread stays still', s.swings === 0 && s.getAttribute('data-cc-bell') === null);
  ok('and is simply called notifications', s.getAttribute('data-cc-tip') === 'Benachrichtigungen');
  advance(5000);
  m.patch(s, 'notice');
  ok('a new notification swings the bell', s.swings === 1, s.swings);
  advance(5000);
  m.patch(s, 'warning');
  ok('a new warning on top swings it again', s.swings === 2 && s.getAttribute('data-cc-bell') === 'warning', s.swings);
  advance(5000);
  m.patch(s, 'notice');
  ok('reading the warning is no news', s.swings === 2, s.swings);
  advance(24000);
  ok('while any stay unread it waits', s.swings === 2, s.swings);
  advance(1000);
  ok('and swings again 30 seconds after the last swing', s.swings === 3, s.swings);
  advance(29000);
  ok('not sooner', s.swings === 3, s.swings);
  advance(1000);
  ok('and again after the next 30', s.swings === 4, s.swings);
  m.patch(s, '');
  advance(120000);
  ok('once all are read it stops swinging', s.swings === 4, s.swings);
  ok('and the colour goes with them', s.getAttribute('data-cc-bell') === null);
}
{
  timers = [];
  const m = load();
  const s = bell('warning');
  m.watch(s);
  const fresh = bell('warning');
  advance(4000);
  m.watch(fresh);
  ok('a span Connect rebuilds with the same badge does not swing', fresh.swings === 0, fresh.swings);
  ok('but wears the level at once', fresh.getAttribute('data-cc-bell') === 'warning');
  advance(25000);
  ok('nor does it put the reminder off', fresh.swings === 0, fresh.swings);
  advance(1000);
  ok('the reminder keeps its beat on the fresh span', fresh.swings === 1, fresh.swings);
}
{
  timers = [];
  const m = load();
  const s = bell('notice');
  m.watch(s);
  advance(5000);
  m.notify([{ importance: 'normal' }]);
  ok('the first list on the notify channel is only the count to compare with', s.swings === 1, s.swings);
  m.notify([{ importance: 'normal' }, { importance: 'normal' }]);
  ok('a new notification at a level already shown swings the bell', s.swings === 2, s.swings);
  advance(5000);
  m.notify([{ importance: 'normal' }]);
  ok('a shorter list is no news', s.swings === 2, s.swings);
  m.notify([{ a: 1 }, { a: 2 }, { a: 3 }], 1);
  ok('the other channels on the same socket are not read', s.swings === 2, s.swings);
  advance(5000);
  s.setAttribute('aria-expanded', 'true');
  advance(30000);
  ok('an open notification drawer keeps the bell still', s.swings === 2, s.swings);
}

console.log('\nWithout motion a calm sign stays');
{
  timers = [];
  const m = load();
  m.env.still = true;
  const s = bell('alert');
  m.watch(s);
  advance(60000);
  ok('motion off or reduced motion never swings the bell', s.swings === 0, s.swings);
  ok('the box still takes the level\'s colour', s.getAttribute('data-cc-bell') === 'alert');
  const fill = (level, html) => candidates('every', { tag: 'span', classes: [], attrs: { 'data-cc-trig': 'bell', 'data-cc-bell': level }, html }, 'background');
  const last = (c) => (c.length ? c[c.length - 1].value : null);
  for (const html of [['cc-header-on'], ['cc-header-on', 'cc-header-rbneutral']]) {
    const mode = html.length > 1 ? 'grey' : 'colour';
    ok('in the ' + mode + ' mode the bell fills with its level', last(fill('alert', html)) === 'var(--cc-bell-c)', last(fill('alert', html)));
  }
  const hover = candidates('every', { tag: 'span', classes: [], attrs: { 'data-cc-trig': 'bell', 'data-cc-bell': 'alert' }, states: { hover: true }, html: ['cc-header-on', 'cc-header-rbneutral'] }, 'background');
  ok('the pointer does not wash the level out', last(hover) === 'var(--cc-bell-c)', last(hover));
  const level = (l) => last(candidates('every', { tag: 'span', classes: [], attrs: { 'data-cc-trig': 'bell', 'data-cc-bell': l }, html: ['cc-header-on'] }, '--cc-bell-c'));
  ok('an alert is red, a warning orange, a notice the accent', /--cc-err\b/.test(level('alert')) && /--cc-warn\b/.test(level('warning')) && /--cc-hdr-accent\b/.test(level('notice')), [level('alert'), level('warning'), level('notice')].join(' | '));
  const css = read('sheets/CannonadeCommand.Header.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const dot = /html\.cc-header-on:not\(\.cc-header-rbneutral\) \[data-cc-trig="bell"\]\[data-cc-bell="notice"\]::after\s*\{([^}]*)\}/.exec(css);
  ok('a notice in the accent, which the box alone cannot show, gets a dot when the bell cannot swing', !!dot && /display:\s*var\(--cc-motion-bell-mark, none\)/.test(dot[1]));
}

// Every rule in the tokens sheet with the @media conditions it sits in.
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined && !head.startsWith('@')) out.push({ sel: head, body: buf.trim(), media: stack.join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const dial = (sel, gated, name) => {
  const r = rules(read('sheets/CannonadeCommand.Tokens.css')).find((x) => x.sel === sel && /no-preference/.test(x.media) === gated && x.body.includes(name));
  const m = r && new RegExp(name + ':\\s*([^;]+);').exec(r.body);
  return m ? m[1].trim() : null;
};

console.log('\nNo dot while the bell can swing');
{
  const hidden = (tag, cls) => { const c = candidates('every', { tag, classes: cls.split(' '), attrs: { class: cls }, html: ['cc-header-on'] }, 'display'); return c.length && c[c.length - 1].value === 'none'; };
  ok('Connect\'s shield and triangle never show', hidden('svg', BADGE.alert) && hidden('svg', BADGE.warning));
  ok('nor its green dot', hidden('div', BADGE.notice));
  ok('at the wild and subtle levels the stand-in dot stays away', dial('html', true, '--cc-motion-bell-mark') === 'none' && dial('html[data-cc-motion="subtle"]', true, '--cc-motion-bell-mark') === 'none');
  ok('reduced motion and "off" keep it', dial('html', false, '--cc-motion-bell-mark') === 'block' && dial('html[data-cc-motion="off"]', true, '--cc-motion-bell-mark') === 'block');
  const swing = rules(read('sheets/CannonadeCommand.Header.css')).find((x) => /\.cc-bell-ring/.test(x.sel) && /animation:/.test(x.body));
  ok('the swing only runs inside the no-preference gate and never at "off"', !!swing && /no-preference/.test(swing.media) && /:not\(\[data-cc-motion="off"\]\)/.test(swing.sel));
  ok('and lasts the level\'s swing, under a second', /^\d+ms$/.test(dial('html', true, '--cc-motion-bell-dur') || '') && parseInt(dial('html', true, '--cc-motion-bell-dur'), 10) <= 1000 && dial('html', false, '--cc-motion-bell-dur') === '0s');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
