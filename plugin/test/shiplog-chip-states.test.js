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

// enhanceShipLogBubble() stamps --cc-rb-c on all three window buttons in the reactive mode and
// leaves the paint to this rule, so a button missing from it stays grey under the pointer.
console.log('\nIn the reactive mode every button of the changelog window colours on hover');
{
  const HOVER_SEL = 'html.cc-shares-rbneutral .sl-bubble .sl-upd:not(.sl-upd-off):hover, html.cc-shares-rbneutral .sl-bubble .sl-gh:hover, html.cc-shares-rbneutral .sl-bubble .sl-x:hover';
  const body = ruleBody(css, HOVER_SEL);
  ok('one hover rule covers update, repository and close', body != null);
  ok('it paints the stamped --cc-rb-c', /background:\s*var\(--cc-rb-c,/.test(body || ''), body);
  ok('with the stamped ink', /color:\s*var\(--cc-rb-ct,/.test(body || ''), body);
  const js = fs.readFileSync(path.join(DIR, 'scripts', 'docker.js'), 'utf8');
  ok('docker.js stamps the close button too', /querySelectorAll\("\.sl-upd:not\(\.sl-upd-off\), \.sl-gh, \.sl-x"\)/.test(js));
}

// Outside the reactive mode nothing stamps the close button while rainbow is off, so its hover
// falls through to the accent the repository button rests on.
console.log('\nThe close button hovers in the accent like the repository button rests');
{
  const body = ruleBody(css, '.sl-bubble .sl-x:hover');
  ok('a hover rule for the close button exists', body != null);
  ok('it reads the stamp, then the accent', /background:\s*var\(--cc-rb-c,\s*var\(--cc-accent,/.test(body || ''), body);
  ok('with the accent text', /color:\s*var\(--cc-rb-ct,\s*var\(--cc-accent-text,/.test(body || ''), body);
  ok('and outranks ShipLog\'s own neutral hover', /!important/.test(body || ''), body);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
