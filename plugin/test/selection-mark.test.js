// Picking rows and switching a setting are two different questions, and GlimStone gives each its
// own control. The Docker list's multi-select is the selection mark: round at the pill radius, a
// shade until picked, then the row's colour with a filled tick in that colour's ink. An on/off
// setting (the Startplan window's watchdog and idle rows, the badge-visibility matrix) is the
// switch. What can quietly break it:
//   · the mark falling back to the operating system's box tinted with accent-color
//   · the tick's ink baked into the CSS, so it vanishes on a light palette slot
//   · the square .cc-cb box or its per-element tick stamp coming back
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rule(css, sel) {
  const re = /([^{}]+)\{([^}]*)\}/g; let m;
  const out = [];
  while ((m = re.exec(css))) if (m[1].split(/,(?![^(]*\))/).map((s) => s.trim()).includes(sel)) out.push(m[2]);
  return out.join(';');
}
const docker = clean(read('styles/docker.css'));
const CHAIN = 'var(--cc-rb-c, var(--cc-rbaccent, var(--cc-accent, #FCC419)))';
const INK = 'var(--cc-rb-ct, var(--cc-rbaccent-text, var(--cc-accent-text, #161616)))';

console.log('\nThe multi-select is the selection mark');
{
  const base = rule(docker, '.cc-bulk-cb');
  ok('the mark is drawn, not the system box', /appearance:\s*none !important/.test(base) && !/accent-color/.test(base), base);
  ok('it is round at the pill radius', /border-radius:\s*var\(--cc-radius-pill\)/.test(base));
  ok('it is 18px', /width:\s*18px/.test(base) && /height:\s*18px/.test(base));
  ok('it rests as a shade', /background:\s*rgba\(128, 128, 128, \.28\)/.test(base));
  ok('it shows only in bulk mode', /display:\s*none !important/.test(base) && /html\.cc-bulkmode-on \.cc-bulk-cb\s*\{\s*display:\s*inline-block !important/.test(docker));
  const picked = rule(docker, '.cc-bulk-cb:checked');
  ok('picked, it takes the row\'s colour chain', picked.includes('background: ' + CHAIN), picked);
  const tick = rule(docker, '.cc-bulk-cb:checked::before');
  ok('the tick is painted in the chain\'s ink', tick.includes('background: ' + INK), tick);
  ok('the tick is GlimStone\'s filled IconCheck, as a mask', /mask: url\("data:image\/svg\+xml;utf8,<svg [^"]*viewBox='0\.3 0\.549 13\.399 13\.399'><path d='M4\.381 12\.219 /.test(tick) && /-webkit-mask:/.test(tick));
  ok('the tick is a filled shape, not a stroke', !/stroke/.test(tick));
  ok('a keyboard focus shows the accent halo', /box-shadow:\s*0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)/.test(rule(docker, '.cc-bulk-cb:focus-visible')));
  const js = read('scripts/docker.js');
  ok('docker.js still builds the mark as a checkbox, so the bulk code reads .checked', /el\("input", "cc-bulk-cb"\); bcb\.type = "checkbox";/.test(js));
}

console.log('\nAn on/off setting is the switch');
{
  const base = rule(docker, '.cc-cb');
  ok('the 44x24 track of .cc-set-toggle', /width:\s*44px/.test(base) && /height:\s*24px/.test(base), base);
  ok('it rests on the off track', /background:\s*var\(--cc-toggle-track-off, #3a3a3a\)/.test(base));
  const knob = rule(docker, '.cc-cb::before');
  ok('an 18px knob at the pill radius', /width:\s*18px/.test(knob) && /border-radius:\s*var\(--cc-radius-pill\)/.test(knob), knob);
  ok('on, the track takes the colour chain', rule(docker, '.cc-cb:checked').includes('background: ' + CHAIN));
  const on = rule(docker, '.cc-cb:checked::before');
  ok('on, the knob moves across and takes the chain\'s ink', /left:\s*23px/.test(on) && on.includes('background: ' + INK), on);
  ok('a CC window\'s checkbox is the same switch', rule(docker, '.cc-pop input[type="checkbox"]') === base);
}

console.log('\nThe square box and its tick stamp are gone');
for (const f of ['styles/docker.css', 'scripts/docker.js', 'scripts/settings.js']) {
  const src = read(f);
  ok(f + ': no --cc-cb-tick', !/--cc-cb-tick/.test(src));
}
ok('docker.js: no ccTickURL', !/ccTickURL/.test(read('scripts/docker.js')));
ok('settings.js: the matrix cells carry colour and ink only', /function chkCell[^\n]*if \(rainbow && color\) \{ cb\.style\.setProperty\("--cc-rb-c", color\); cb\.style\.setProperty\("--cc-rb-ct", idealText\(color\)\); \} cb\.addEventListener/.test(read('scripts/settings.js')));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
