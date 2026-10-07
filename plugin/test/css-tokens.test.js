// A custom property that names itself in its own value, such as --cc-ok: var(--cc-ok, #1f9d55),
// is a dependency cycle. The browser treats it as invalid, every consumer silently falls back to
// its own literal, and the token stops meaning anything. This pins that no sheet declares one,
// and that the call sites of the semantic tokens carry the token's own colour as their fallback,
// so a page without the token sheet looks the same.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'src');
const TOKENS = path.join(ROOT, 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'sheets', 'CannonadeCommand.Tokens.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function files(dir, exts) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p, exts));
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}
function selfRefs(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  const re = /(--[\w-]+)\s*:\s*([^;{}]*)/g;
  let m;
  while ((m = re.exec(clean))) {
    const name = m[1].replace(/[-]/g, '\\-');
    if (new RegExp('var\\(\\s*' + name + '\\s*[,)]').test(m[2])) found.push(m[1] + ': ' + m[2].trim());
  }
  return found;
}

console.log('\nThe detector itself catches a self-reference and passes a plain value');
ok('a self-referencing declaration is found', selfRefs('html { --a: var(--a, red); }').length === 1);
ok('a reference to a longer name is not one', selfRefs('html { --a: var(--a-b, red); }').length === 0);
ok('a plain value is not one', selfRefs('html { --a: #fff; --b: var(--a); }').length === 0);

const sheets = files(ROOT, ['.css']);
console.log('\nNo sheet declares a custom property in terms of itself (' + sheets.length + ' sheets)');
for (const f of sheets) {
  const hits = selfRefs(fs.readFileSync(f, 'utf8'));
  ok(path.basename(f), hits.length === 0, hits.join(' | '));
}

console.log('\nEvery call site falls back to the colour its token holds');
{
  const tokens = fs.readFileSync(TOKENS, 'utf8');
  const sources = files(ROOT, ['.css', '.js', '.php', '.page']).map((f) => [f, fs.readFileSync(f, 'utf8')]);
  for (const name of ['--cc-ok', '--cc-warn', '--cc-err', '--cc-info']) {
    const m = new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})\\s*;').exec(tokens);
    ok(name + ' is a plain colour in the token sheet', !!m);
    if (!m) continue;
    const want = m[1].toLowerCase(), off = [];
    for (const [f, src] of sources) {
      const re = new RegExp('var\\(\\s*' + name + '\\s*,\\s*(#[0-9a-fA-F]{3,6})', 'g');
      let c;
      while ((c = re.exec(src))) if (c[1].toLowerCase() !== want) off.push(path.basename(f) + ' ' + c[1]);
    }
    ok(name + ' call sites fall back to ' + want, off.length === 0, off.join(', '));
  }
}

// Header.css declares --cc-surface-card dark on :root. The Apps info card, the notification
// items and the Unraid API cards paint it behind text in --cc-text, which the light override
// turns dark, so the card has to turn light with it or the text sits dark on dark.
console.log('\nThe card surface follows the light themes like the text on it');
{
  const tokens = fs.readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const header = fs.readFileSync(path.join(path.dirname(TOKENS), 'CannonadeCommand.Header.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = (/html\.Theme--white,\s*html\.Theme--azure\s*\{([^}]*)\}/.exec(tokens) || [])[1] || '';
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); };
  ok('the light override block is found', light.length > 0);
  ok('Header.css declares the card dark on :root', /:root\s*\{[^}]*--cc-surface-card:\s*#1[0-9a-f]{5}/i.test(header));
  ok('the light override turns --cc-text dark', /--cc-text:\s*#[0-3][0-9a-f]{5}/i.test(light));
  const card = /--cc-surface-card:\s*(#[0-9a-f]{6})/i.exec(light);
  ok('the light override declares --cc-surface-card', !!card);
  ok('and it is a light surface', !!card && lum(card[1]) > 200, card && card[1]);
  ok('the info card reads the token', /#sidenavContent \.cc-ic-card\s*\{[^}]*background:\s*var\(--cc-surface-card/.test(tokens));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
