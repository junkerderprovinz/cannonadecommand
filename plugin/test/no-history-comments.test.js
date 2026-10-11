// A comment says why the code is the way it is. Who asked for it, which ticket it came from and
// what it replaced belong in the commit message, so the plugin carries no such marks: no person
// in parentheses, no "user call", no numbered request at the head of a comment.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const ROOT = path.join(__dirname, '..');
function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'out' && e.name !== 'bin' && e.name !== 'node_modules') out.push(...files(p)); }
    else if (/\.(js|css|page|php|sh)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Comment text only: // line comments, /* */ blocks and a shell script's # lines, so a string or a
// selector cannot trip it.
function comments(src, shell) {
  const out = [];
  const re = shell ? /^\s*#[^\n]*/gm : /\/\*[\s\S]*?\*\/|(^|[^:"'\\])\/\/[^\n]*/gm;
  let m;
  while ((m = re.exec(src))) out.push({ text: m[0], line: src.slice(0, m.index).split('\n').length });
  return out;
}
const MARKS = [
  [/\(user\b|\buser call\b|\buser:/i, 'a person in parentheses'],
  [/\bjdp\b/i, 'a person by name'],
  [/(^|\/\/|\/\*|\*)\s*#\d+(\/\w+)?\s*[(:]/m, 'a numbered request at the head of a comment'],
  [/#\d+\/D\d+|\bD-\d{2}\b/, 'a planning id'],
];

console.log('\nThe detector');
{
  const hits = (s) => comments(s).filter((c) => MARKS.some(([re]) => re.test(c.text))).length;
  ok('finds a person in parentheses', hits('x(); // #3 (user): flush right') === 1);
  ok('finds a numbered request in a block comment', hits('/* #10 (user: "style it"): ... */') === 1);
  ok('passes a colour or a selector', hits('a { color: #161616; } /* the #docker_list header */') === 0);
  ok('passes a URL in code', hits('var u = "https://x/#3 (y)";') === 0);
}

console.log('\nNo comment in the plugin carries one');
for (const f of files(ROOT)) {
  if (path.basename(f) === 'no-history-comments.test.js') continue;
  const found = [];
  for (const c of comments(fs.readFileSync(f, 'utf8'), f.endsWith('.sh'))) for (const [re, what] of MARKS) if (re.test(c.text)) found.push(c.line + ': ' + what);
  if (found.length) ok(path.relative(ROOT, f), false, found.slice(0, 4).join(' | '));
}
ok('every file was read', files(ROOT).length > 50, String(files(ROOT).length));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
