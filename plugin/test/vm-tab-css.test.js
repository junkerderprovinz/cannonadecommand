// Static regression test for CannonadeCommand.VmTab.css's glyph icon rule.
//
// The bug: the `i.img` FA-glyph rule correctly scaled width/height with var(--cc-logo-img), but
// hardcoded font-size to a literal 44px. Since MOST VM rows render as a font glyph rather than an
// <img> (per vms.js's own comments and vmIconPlan forcing spread=0 for non-IMG nodes), the glyph
// itself never resized with Kachelgröße — only its invisible bounding box did. This made
// size-mode changes look broken specifically on the VMs tab. Fix: tie font-size 1:1 to the SAME
// --cc-logo-img token the width/height on the same rule already use (matching docker.css's own
// i.img rule and plugins.js's logoSize(), both also unscaled 1:1).
//
// Reuses settings-chrome.test.js's ruleBody()/declares() helpers verbatim (same comment-stripping
// regex) — this is a static/string-level pin, appropriate for a CSS file with no CSS engine
// available in the bare-Node test runner.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const CSS = process.argv[2] || path.join(DIR, 'sheets', 'CannonadeCommand.VmTab.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = fs.readFileSync(CSS, 'utf8');

// Verbatim from settings-chrome.test.js.
function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}
function declares(body, prop) {
  if (body == null) return false;
  return new RegExp('(^|;)\\s*' + prop + '\\s*:', 'i').test(body);
}

console.log('\nThe VM-row glyph icon rule ties font-size to --cc-logo-img, never a bare pixel literal');
{
  const sel = 'html.cc-vms-on #kvm_list td.vm-name .outer > span.hand i.img';
  const body = ruleBody(css, sel);
  ok('the rule exists', body != null);
  ok('font-size is declared', declares(body, 'font-size'), body);
  ok('font-size is tied to var(--cc-logo-img', /font-size:\s*var\(--cc-logo-img/.test(body || ''), body);
  ok('font-size is NEVER a bare pixel literal (the old 44px regression)', !/font-size:\s*\d/.test(body || ''), body);
  ok('width/height stay tied to the same token (unchanged by this fix)', /width:\s*var\(--cc-logo-img/.test(body || '') && /height:\s*var\(--cc-logo-img/.test(body || ''), body);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
