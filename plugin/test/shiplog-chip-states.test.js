// CC hides the dot on ShipLog's changelog chip and paints the chip itself, keyed on the dot's
// class. A state without its own rule falls to the grey of an up-to-date chip, so each coloured
// state needs a rule in the plain modes and one for the row hover of the reactive mode.
//
// A string-level check, with the helpers from settings-chrome.test.js.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const css = fs.readFileSync(path.join(DIR, 'styles', 'docker.css'), 'utf8');
const tokens = fs.readFileSync(path.join(DIR, 'sheets', 'CannonadeCommand.Tokens.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}

const ROW = '.cc-enh #docker_list tr:is(.sortable, .folder-element) td.updatecolumn .sl-chip';
const HOVER = 'html.cc-shares-rbneutral.cc-docker-on .cc-enh #docker_list tr:is(.sortable, .folder-element):hover td.updatecolumn .sl-chip';
const STATES = { low: '--cc-ok', mid: '--cc-warn', high: '--cc-err', crit: '--cc-err', info: '--cc-info' };

console.log('\nEvery coloured ShipLog chip state has a colour at rest and on the reactive row hover');
for (const [cls, token] of Object.entries(STATES)) {
  const base = ruleBody(css, `${ROW}:has(.sl-${cls})`);
  const hover = ruleBody(css, `${HOVER}:has(.sl-${cls})`);
  ok(`sl-${cls}: the plain-mode rule reads var(${token}`, (base || '').includes(`var(${token},`), base);
  ok(`sl-${cls}: the reactive hover rule reads var(${token}`, (hover || '').includes(`var(${token},`), hover);
}

console.log('\nThe up-to-date chip stays the neutral grey the pinned one is told apart from');
{
  ok('sl-ok has no colour rule of its own', ruleBody(css, `${ROW}:has(.sl-ok)`) == null);
  ok('the plain chip rests on #4a4a4a', /background:\s*#4a4a4a/.test(ruleBody(css, ROW) || ''));
}

console.log('\n--cc-info resolves to a colour on <html>');
{
  const m = /--cc-info:\s*([^;]+);/.exec(tokens);
  ok('--cc-info is declared', !!m);
  ok('--cc-info is a literal, not a var() that could refer to itself', !!m && /^#[0-9a-fA-F]{6}$/.test(m[1].trim()), m && m[1]);
  ok('--cc-info-fg is declared', /--cc-info-fg:\s*#fff/.test(tokens));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
