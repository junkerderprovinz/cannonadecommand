// The (i) glyph shows keyboard focus with CannonadeCommand's 3px accent halo. It has no fill
// of its own, so an opacity step alone reads exactly like hover (GlimStone asks for visible
// focus here; CC answers with its halo, since it draws no rings or borders anywhere).
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\nThe halo');
const tokens = clean(read('sheets/CannonadeCommand.Tokens.css'));
const body = (/(^|\})\s*\.cc-info:focus-visible \{([^}]*)\}/.exec(tokens) || [])[2] || '';
ok('Tokens.css, loaded on every page, gives .cc-info a focus-visible rule', body.length > 0);
ok('it draws the 3px accent halo', /box-shadow: 0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\) !important;/.test(body));
ok('with a plain fallback for a browser without color-mix', /box-shadow: 0 0 0 3px rgba\(252, 196, 25, \.42\) !important;/.test(body));
ok('round, following the ring the glyph draws', /border-radius: 50%;/.test(body));
ok('and no outline ring', /outline: none !important;/.test(body));
ok('focused, the glyph is at full strength', /opacity: 1 !important;/.test(body));

console.log('\nNothing takes it away again');
const files = ['sheets/CannonadeCommand.Tokens.css', 'sheets/CannonadeCommand.Shares.css', 'sheets/CannonadeCommand.Header.css', 'styles/docker.css', 'scripts/settings.js'];
for (const f of files) {
  const src = clean(read(f));
  const hits = [];
  const re = /([^{}]*\.cc-info[^{}]*:focus[^{}]*)\{([^}]*)\}/g; let m;
  while ((m = re.exec(src))) if (/box-shadow\s*:\s*none/.test(m[2]) || /outline\s*:\s*(?!none\b)\S/.test(m[2])) hits.push(m[1].trim());
  ok(path.basename(f) + ': no focus rule on the (i) clears the halo or draws a ring', hits.length === 0, hits.join(' | '));
}
ok('the shared infoIcon() makes the glyph reachable by Tab', /s\.setAttribute\("tabindex", "0"\)/.test(read('scripts/cc-theme.js')));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
