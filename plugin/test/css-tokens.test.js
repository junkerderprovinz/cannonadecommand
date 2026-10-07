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

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
