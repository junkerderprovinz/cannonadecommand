// The single pages the area sheets do not reach (CannonadeCommand.Pages.page, .css, pages.js).
// What can quietly break it:
//   · a rule that does not key on html[data-cc-page] restyles every page
//   · a page named while its area or master theming is off
//   · a caption written onto a button that submits, which changes what the form sends
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
// Splits a selector list at its top-level commas, leaving the ones inside :is() and :not().
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = read('sheets/CannonadeCommand.Pages.css');
const js = read('scripts/pages.js');
const page = read('CannonadeCommand.Pages.page');

console.log('\nThe hook');
ok('the page is a Buttons hook, so its sheet loads on every page', /^Menu="Buttons:\d+"/m.test(page));
ok('it renders no icon', /^Link="cc-pages-hook"/m.test(page));
ok('it loads pages.js', /scripts\/pages\.js/.test(page));

console.log('\nEvery rule keys on the page name');
{
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const sels = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) { const s = m[1].replace(/^\s*@media[^{]*\{/, '').trim(); if (!s.startsWith('@')) sels.push(s); }
  ok('the sheet has rules', sels.length > 40, sels.length);
  const loose = [];
  for (const s of sels) for (const part of splitTop(s)) if (!/^html[^ ]*\[data-cc-page="[a-z]+"\]/.test(part.trim())) loose.push(part.trim());
  ok('no selector applies without html[data-cc-page]', loose.length === 0, loose.slice(0, 4).join(' | '));
  const names = new Set([...clean.matchAll(/\[data-cc-page="([a-z]+)"\]/g)].map((x) => x[1]));
  const known = new Set([...js.matchAll(/, "([a-z]+)", (?:"cc\.|null)/g)].map((x) => x[1]));
  const orphans = [...names].filter((n) => !known.has(n));
  ok('every page the sheet names is one pages.js stamps', orphans.length === 0, orphans.join(', '));
}

// pages.js in a minimal browser: the route, localStorage as a map and two buttons.
function run(route, store, buttons) {
  const attrs = {};
  const ctx = {
    location: { pathname: route }, navigator: { language: 'de-AT' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null) },
    setTimeout: () => 0,
    window: { addEventListener: () => {} },
    document: {
      readyState: 'complete',
      documentElement: {
        lang: 'de', classList: { contains: () => false },
        setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; },
      },
      getElementById: (id) => (buttons || {})[id] || null,
      querySelector: () => null,
      addEventListener: () => {},
    },
  };
  vm.runInNewContext(js, ctx);
  return attrs['data-cc-page'];
}
const btn = (type, name, value) => ({ type, name, value, attrs: {}, hasAttribute(k) { return k in this.attrs; }, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; } });

console.log('\nThe page name follows its area');
ok('the VM editor is named with the VM area on', run('/VMs/UpdateVM', {}) === 'vmform');
ok('and not with it off', run('/VMs/UpdateVM', { 'cc.enable.vms': '0' }) === undefined);
ok('the user editor rides the Settings and Tools area', run('/Users/UserEdit', {}) === 'useredit' && run('/Users/UserEdit', { 'cc.enable.settings': '0' }) === undefined);
ok('Disk Stats needs the Shares area, which is off until switched on', run('/Stats', {}) === undefined && run('/Stats', { 'cc.enable.shares': '1' }) === 'stats');
ok('master theming off names no page', run('/Tools/Syslog', { 'cc.theming': '0' }) === undefined);
ok('a page that is not on the list is left alone', run('/Docker', {}) === undefined);

console.log('\nCaptions only on buttons that do not submit');
{
  const erase = btn('button', '', 'Erase Pool'), remove = btn('button', '', 'Remove Pool');
  run('/Main/Device', {}, { eraseButton: erase, removeButton: remove });
  ok('Erase Pool reads in German', erase.value === 'Pool löschen', erase.value);
  ok('Remove Pool reads in German', remove.value === 'Pool entfernen', remove.value);
  ok('the original caption is kept for turning the area off', erase.getAttribute('data-cc-orig') === 'Erase Pool');
  const named = btn('submit', 'cmdErase', 'Erase Pool');
  run('/Main/Device', {}, { eraseButton: named });
  ok('a submit button, whose value is sent, keeps its caption', named.value === 'Erase Pool', named.value);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
