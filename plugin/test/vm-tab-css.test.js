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

console.log('\nVM icon logo badge: a configured icon colour wins over the rainbow palette (#T6)');
{
  // The bug: both the non-reactive-rainbow rule and the reactive-hover rule put --cc-rb-c (the
  // per-row rainbow rotation colour) BEFORE --cc-iconbg-color (the user's picked Logo-Hintergrund
  // colour) in the var() fallback chain, so Rainbow mode always outran a configured icon colour.
  // Decided fix, live-tested and confirmed with the user: the icon logo's OWN badge represents the
  // app's identity, not a rotating value indicator, so --cc-iconbg-color must be first, --cc-rb-c
  // only the fallback for rows with no icon colour configured.
  const nonReactiveSel = 'html.cc-vms-on.cc-vm-iconbg.cc-vm-rainbow:not(.cc-vm-rbneutral) #kvm_list td.vm-name .outer > span.hand';
  const reactiveHoverSel = 'html.cc-vms-on.cc-vm-iconbg.cc-vm-rbneutral #kvm_list tr:hover td.vm-name .outer > span.hand';
  const reactiveRestSel = 'html.cc-vms-on.cc-vm-iconbg.cc-vm-rbneutral #kvm_list td.vm-name .outer > span.hand';
  const nrBody = ruleBody(css, nonReactiveSel);
  const rhBody = ruleBody(css, reactiveHoverSel);
  const rrBody = ruleBody(css, reactiveRestSel);
  ok('non-reactive rainbow rule exists', nrBody != null);
  ok('non-reactive: --cc-iconbg-color comes before --cc-rb-c', /background:\s*var\(--cc-iconbg-color,\s*var\(--cc-rb-c,/.test(nrBody || ''), nrBody);
  ok('reactive hover rule exists', rhBody != null);
  ok('reactive hover: --cc-iconbg-color comes before --cc-rb-c', /background:\s*var\(--cc-iconbg-color,\s*var\(--cc-rb-c,/.test(rhBody || ''), rhBody);
  ok('reactive REST state is still flat grey, untouched by this fix', /background:\s*#2e2e2e/.test(rrBody || ''), rrBody);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
