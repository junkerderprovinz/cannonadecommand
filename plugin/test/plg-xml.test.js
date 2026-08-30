// The .plg is XML, and Unraid parses it BEFORE it does anything else. A single raw
// ampersand or "<" anywhere in the file — including in the prose of a CHANGES entry —
// makes `plugin install` fail with "XML file doesn't exist or xml parse error" and the
// release is dead on arrival for every box.
//
// That is not hypothetical: v4.31.0 shipped with `"Logos & Icons"` in its changelog and
// could not be installed at all. The convention warned about exactly this; a warning in a
// document is not a gate, so here is the gate.
//
// No XML library is used on purpose: this must run on the same bare Node the other
// WebGUI tests use. It walks the file character by character with the handful of rules
// that actually decide whether an XML parser accepts it.
const fs = require('fs');
const path = require('path');
const PLG = process.argv[2] || path.join(__dirname, '..', 'cannonadecommand.plg');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const raw = fs.readFileSync(PLG, 'utf8');

// The embedded .txz blob is megabytes of base64 and cannot contain either character, so
// scanning it is pure cost. Cut it out and check everything else.
const blobStart = raw.indexOf('<INLINE>');
const blobEnd = raw.lastIndexOf('</INLINE>');
const text = (blobStart >= 0 && blobEnd > blobStart)
  ? raw.slice(0, blobStart) + raw.slice(blobEnd)
  : raw;

console.log('\nThe plugin manifest is well-formed XML');
{
  // Every "&" must open a real entity reference, and every "<" must open a real tag,
  // a closing tag, a comment, a CDATA section, a doctype or a processing instruction.
  const badAmp = [];
  const badLt = [];
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') { line++; continue; }
    if (c === '&') {
      const m = /^&(#[0-9]+|#x[0-9a-fA-F]+|[A-Za-z_][A-Za-z0-9._-]*);/.exec(text.slice(i, i + 40));
      if (!m) badAmp.push({ line, near: text.slice(Math.max(0, i - 45), i + 25).replace(/\n/g, ' ') });
    } else if (c === '<') {
      const nxt = text.slice(i, i + 9);
      if (!/^<[A-Za-z/!?]/.test(nxt)) badLt.push({ line, near: text.slice(Math.max(0, i - 45), i + 25).replace(/\n/g, ' ') });
    }
  }
  ok('no raw "&" outside an entity reference', badAmp.length === 0, badAmp.length ? JSON.stringify(badAmp.slice(0, 3)) : '');
  ok('no raw "<" that does not open a tag', badLt.length === 0, badLt.length ? JSON.stringify(badLt.slice(0, 3)) : '');
}

console.log('\nThe CHANGES block Unraid renders as markdown');
{
  const m = /<CHANGES>([\s\S]*?)<\/CHANGES>/.exec(raw);
  ok('the CHANGES block exists', !!m);
  if (m) {
    const body = m[1];
    const headers = body.split('\n').filter(l => /^### /.test(l));
    ok('every version header is "### X.Y.Z"', headers.every(h => /^### \d+\.\d+\.\d+$/.test(h)), JSON.stringify(headers.filter(h => !/^### \d+\.\d+\.\d+$/.test(h)).slice(0, 3)));
    ok('there is at least one version header', headers.length > 0);

    // The markdown rules below are checked on the NEWEST entry only — the one this
    // release actually ships. Older entries are history: they installed fine on real
    // boxes, and rewriting them to satisfy a later rule would be editing the past.
    const lines = body.split('\n');
    const first = lines.findIndex(l => /^### \d+\.\d+\.\d+$/.test(l));
    let last = lines.length;
    for (let i = first + 1; i < lines.length; i++) { if (/^### \d+\.\d+\.\d+$/.test(lines[i])) { last = i; break; } }
    const newest = lines.slice(first, last);
    const amp = newest.filter(l => /&(?!(#[0-9]+|#x[0-9a-fA-F]+|[A-Za-z_][A-Za-z0-9._-]*);)/.test(l));
    ok('the newest entry has no unescaped "&" (this is what killed v4.31.0)', amp.length === 0, JSON.stringify(amp.slice(0, 2)));
    ok('the newest entry has no raw "<"', newest.every(l => l.indexOf('<') < 0));
    // A bullet must not START with "#": Unraid renders CHANGES as markdown and the
    // "### X.Y.Z" version headers are the one deliberate exception.
    const badBullet = newest.filter(l => /^- \s*#/.test(l));
    ok('no bullet in the newest entry starts with "#"', badBullet.length === 0, JSON.stringify(badBullet.slice(0, 2)));
  }
}

console.log('\nThe version entity and the newest CHANGES entry agree');
{
  const v = /<!ENTITY version\s+"([^"]+)">/.exec(raw);
  ok('the version entity is a 3-digit SemVer', !!v && /^\d+\.\d+\.\d+$/.test(v[1]), v ? v[1] : 'missing');
  const m = /<CHANGES>\s*### (\d+\.\d+\.\d+)/.exec(raw);
  ok('CHANGES opens with a version header', !!m, m ? m[1] : 'missing');
  if (v && m) ok('and it is THIS version (a bump without a changelog entry is a silent release)', v[1] === m[1], v[1] + ' vs ' + m[1]);
}

console.log('\nThe embedded package is the one the version claims');
{
  const v = /<!ENTITY version\s+"([^"]+)">/.exec(raw)[1];
  ok('the txz FILE stanza names this version', raw.indexOf('cannonadecommand-' + v + '-x86_64-1.txz') > 0 || raw.indexOf('&txz;') > 0);
  ok('the embedded blob is present and non-trivial', blobStart >= 0 && blobEnd - blobStart > 100000, String(blobEnd - blobStart));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
