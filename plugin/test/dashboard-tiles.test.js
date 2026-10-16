// The Dashboard tiles as GlimStone cards (CannonadeCommand.Dashboard.page, .css, dashboard.js).
// What can quietly break it:
//   · a rule that is not gated on html.cc-dash-on restyles the Dashboard with the header area off
//   · a block display with !important on a tile or row beats Unraid's inline display:none, so a
//     tile the person closed or a folded row comes back
//   · a stroked drawing slipping in among the filled tile glyphs
//   · the charts staying in the accent after the area is switched off
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
// Splits a selector list at its top-level commas, leaving the ones inside :is() and :not().
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = read('sheets/CannonadeCommand.Dashboard.css');
const js = read('scripts/dashboard.js');
const page = read('CannonadeCommand.Dashboard.page');

// Selectors of every rule, @media blocks unwrapped.
function selectors(sheet) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) { const s = m[1].trim(); if (!s.startsWith('@')) out.push([s.replace(/^@media[^{]*\{/, '').trim(), m[2]]); }
  return out;
}

console.log('\nThe hook');
ok('the page is a Buttons hook, so its sheet loads on every page', /^Menu="Buttons:\d+"/m.test(page));
ok('it renders no icon', /^Link="cc-dash-hook"/m.test(page));
ok('it loads dashboard.js', /scripts\/dashboard\.js/.test(page));

console.log('\nEvery rule waits for html.cc-dash-on');
{
  const rules = selectors(css);
  ok('the sheet has rules', rules.length > 20, rules.length);
  const loose = [];
  for (const [sel] of rules) for (const part of splitTop(sel)) if (!/html\.cc-dash-on/.test(part)) loose.push(part.trim());
  ok('no selector applies without the gate', loose.length === 0, loose.slice(0, 4).join(' | '));
}

console.log('\nUnraid keeps hiding tiles and rows');
{
  const rules = selectors(css);
  const tile = rules.find(([s]) => s === 'html.cc-dash-on table.dashboard > tbody');
  ok('a tile is a block without !important, so an inline display:none still wins', !!tile && /display:\s*block;/.test(tile[1]) && !/display:\s*block\s*!important/.test(tile[1]), tile && tile[1]);
  const row = rules.find(([s]) => /> tbody > tr:not\(\[style\*="none"\]\)/.test(s));
  ok('the forced row display skips every row whose inline style hides it', !!row && /display:\s*block !important/.test(row[1]), row && row[0]);
  ok('nothing else forces a display with !important on a row or tile', !rules.some(([s, b]) => s !== (row && row[0]) && /(tbody|> tr)\s*$/.test(s) && /display:[^;]*!important/.test(b)));
  const cell = rules.find(([s]) => s === 'html.cc-dash-on table.dashboard > tbody > tr > td');
  ok('a cell is a flow root, so the floated columns inside it stay inside the card', !!cell && /display:\s*flow-root/.test(cell[1]), cell && cell[1]);
}

console.log('\nThe tile glyphs are filled');
{
  const start = js.indexOf('var P = {'), end = js.indexOf('\n  };', start);
  const P = new Function('return ' + js.slice(start + 'var P = '.length, end + 4) + ';')();
  const names = Object.keys(P);
  ok('there is a drawing for every icon the map names', /var BY_ICON = \{[\s\S]*?\};/.test(js) && [...js.match(/var BY_ICON = \{([\s\S]*?)\};/)[1].matchAll(/: "(\w+)"/g)].every((m) => m[1] === 'log' || names.includes(m[1])));
  for (const n of names) ok(n + ': paths only, never stroked', !/stroke/.test(P[n]) && !/fill="none"/.test(P[n]) && /^(<path d="[^"]+"\/>)+$/.test(P[n]), P[n].slice(0, 60));
  ok('the glyph svg draws in currentColor on a square box', /viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"/.test(js));
}

// A minimal browser around dashboard.js: no tiles, two Smoothie charts, localStorage as a map.
function run(store) {
  const classes = new Set();
  const listeners = {};
  const chart = (strokes) => ({
    options: { grid: { strokeStyle: '#2b2b2b', verticalSections: 4, borderVisible: true, millisPerLine: 5000 }, labels: { fillStyle: '#f2f2f2' } },
    seriesSet: strokes.map((s) => ({ options: { strokeStyle: s, lineWidth: 1, fillToBottom: true } })),
  });
  const win = {
    cpuchart: chart(['#ff8c2f']), netchart: chart(['#e22828', '#ff8c2f']),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  const ctx = {
    window: win, location: { pathname: '/Dashboard' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null) },
    setTimeout: () => 0,
    getComputedStyle: () => ({ getPropertyValue: (p) => (p === '--cc-accent' ? ' #1f9d55' : p === '--cc-text-dim' ? '#8a8a8a' : '') }),
    document: {
      readyState: 'complete',
      documentElement: { lang: 'de', classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } },
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      addEventListener: () => {},
    },
  };
  vm.runInNewContext(js, ctx);
  return { classes, win, fire: () => (listeners.storage || []).forEach((f) => f({ key: 'cc.enable.header' })) };
}

console.log('\nThe area switch');
{
  const on = run({ 'cc.enable.header': '1' });
  ok('with the header area on the Dashboard is marked', on.classes.has('cc-dash-on'));
  const off = run({ 'cc.enable.header': '0' });
  ok('with it off it stays native', !off.classes.has('cc-dash-on'));
  const master = run({ 'cc.enable.header': '1', 'cc.theming': '0' });
  ok('master theming off wins', !master.classes.has('cc-dash-on'));
}

console.log('\nThe charts follow the area');
{
  const store = { 'cc.enable.header': '1' };
  const r = run(store);
  const cpu = r.win.cpuchart, net = r.win.netchart;
  ok('the CPU line is the accent', cpu.seriesSet[0].options.strokeStyle === '#1f9d55', cpu.seriesSet[0].options.strokeStyle);
  ok('the grid is gone', cpu.options.grid.strokeStyle === 'transparent' && cpu.options.grid.verticalSections === 0 && cpu.options.grid.borderVisible === false);
  ok('inbound and outbound share the accent, outbound fainter and unfilled', net.seriesSet[0].options.strokeStyle === '#1f9d55' && /^rgba\(31,157,85,0\.7\)$/.test(net.seriesSet[1].options.strokeStyle) && net.seriesSet[1].options.fillStyle === undefined);
  store['cc.enable.header'] = '0';
  r.fire();
  ok('switched off, the area class goes', !r.classes.has('cc-dash-on'));
  ok('and the charts get their own colours and grid back', cpu.seriesSet[0].options.strokeStyle === '#ff8c2f' && net.seriesSet[0].options.strokeStyle === '#e22828' && cpu.options.grid.strokeStyle === '#2b2b2b' && cpu.options.grid.verticalSections === 4);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
