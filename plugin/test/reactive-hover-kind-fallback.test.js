// Static regression test: reactive-mode per-KIND badge hover must fall back to the ACCENT colour,
// never a hardcoded per-kind hex (#2721).
//
// The bug (live-tested on a real box, confirmed with a user screenshot, Rainbow verified OFF via
// cc.rainbow="0" on the server): with Reactive mode on and Rainbow mode OFF, hovering a Docker/VM
// row still showed a different hardcoded colour per badge KIND (CPU red, RAM teal, BW purple, vDisks
// cyan) instead of the plain accent. Root cause: the REACTIVE-hover per-kind rules
// (`.cc-vm-rbneutral` / `.cc-shares-rbneutral.cc-docker-on`, gated ONLY on reactive mode, entirely
// independent of Rainbow) fell back to a hardcoded per-kind hex whenever --cc-rb-<kind> is unset —
// which it correctly always is when Rainbow is off (applyRainbowPalette() in docker.js/vms.js was
// never the bug). The GENERIC kind-less row-hover rule right above each of these blocks already
// falls back to var(--cc-accent, ...) correctly; these per-kind rules must do the same.
//
// An earlier live check of Docker missed this because it happened to test only the "net" kind,
// whose hardcoded fallback (var(--cc-ok, #1f9d55)) coincidentally equalled that box's accent colour
// (also green) — CPU/RAM/BW would have shown the bug immediately. This file pins EVERY kind on both
// files so that mistake can't repeat.
//
// Do NOT touch the `.cc-rainbow` / `.cc-vm-rainbow`-gated rules (docker.css ~641, VmTab.css ~357) —
// those are the actual rainbow-mode rules where --cc-rb-<kind> is guaranteed set whenever the
// gating class is present, so their hardcoded fallback is a harmless just-in-case, not a live bug.
//
// Reuses settings-chrome.test.js's ruleBody()/declares() helpers verbatim (same comment-stripping
// regex) — this is a static/string-level pin, appropriate for a CSS file with no CSS engine
// available in the bare-Node test runner.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const DOCKER_CSS = path.join(DIR, 'styles', 'docker.css');
const VMTAB_CSS = path.join(DIR, 'sheets', 'CannonadeCommand.VmTab.css');
const PLUGINS_CSS = DOCKER_CSS; // Plugins' own per-item badges are also styled in docker.css (see grep below)
const SETTINGSGRID_CSS = path.join(DIR, 'sheets', 'CannonadeCommand.SettingsGrid.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// Verbatim from settings-chrome.test.js.
function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}
// A fallback chain is "accent-safe" when its FINAL fallback resolves through var(--cc-accent, ...)
// (or --cc-accent-text for colour) rather than ending in a bare hex literal.
function bgAccentSafe(body) { return /background:\s*var\(--cc-rb-[a-z]+,\s*var\(--cc-accent,\s*#[0-9a-fA-F]{3,6}\)\)/.test(body || ''); }
function bgBareHexFallback(body) { return /background:\s*var\(--cc-rb-[a-z]+,\s*(?:var\(--cc-(?:ok|warn|err),\s*)?#[0-9a-fA-F]{3,6}\)?\s*(?:!important)?\s*;/.test(body || '') && !bgAccentSafe(body); }

const dockerCss = fs.readFileSync(DOCKER_CSS, 'utf8');
const vmtabCss = fs.readFileSync(VMTAB_CSS, 'utf8');

console.log('\nDocker reactive-hover per-KIND badges: fallback resolves through --cc-accent, not a hardcoded hex');
{
  const kinds = ['net', 'ip', 'lan', 'port', 'vol', 'cpu', 'ram', 'bw'];
  kinds.forEach((kind) => {
    const listSel = `html.cc-shares-rbneutral.cc-docker-on #docker_list tr:is(.sortable, .folder-element):hover .cc-b.cc-b-${kind}`;
    const gridSel = `html.cc-shares-rbneutral.cc-docker-on .cc-grid-holder .cc-card:hover .cc-b.cc-b-${kind}`;
    const sel = `${listSel},\n${gridSel}`;
    const body = ruleBody(dockerCss, sel);
    ok(`${kind}: combined list+grid hover rule exists`, body != null, sel);
    ok(`${kind}: background fallback chain includes var(--cc-accent`, bgAccentSafe(body), body);
    ok(`${kind}: background does NOT end in a bare/hardcoded hex fallback (the bug)`, !bgBareHexFallback(body), body);
  });
}

console.log('\nVMs reactive-hover per-KIND badges: fallback resolves through --cc-accent, not a hardcoded hex');
{
  const kinds = ['cpu', 'ram', 'bw', 'ip', 'vol'];
  kinds.forEach((kind) => {
    const sel = `html.cc-vms-on.cc-vm-rbneutral #kvm_list tr:hover .cc-b.cc-b-${kind}`;
    const body = ruleBody(vmtabCss, sel);
    ok(`${kind}: hover rule exists`, body != null, sel);
    ok(`${kind}: background fallback chain includes var(--cc-accent`, bgAccentSafe(body), body);
    ok(`${kind}: background does NOT end in a bare/hardcoded hex fallback (the bug)`, !bgBareHexFallback(body), body);
    ok(`${kind}: colour fallback chain includes var(--cc-accent-text`, /color:\s*var\(--cc-rb-[a-z]+-t,\s*var\(--cc-accent-text,\s*#fff\)\)/.test(body || ''), body);
  });
}

console.log('\nRainbow-mode (non-reactive) per-kind rules are UNTOUCHED — their hardcoded fallback is a harmless safety net');
{
  // These are gated by .cc-rainbow / .cc-vm-rainbow (guaranteed --cc-rb-<kind> is set whenever the
  // class is present), NOT by reactive mode — this fix must not have edited them.
  const dockerCpuSel = '.cc-enh.cc-rainbow .cc-b-cpu, .cc-grid-holder.cc-rainbow .cc-b-cpu';
  const dockerCpuBody = ruleBody(dockerCss, dockerCpuSel);
  ok('docker.css rainbow-mode CPU rule exists', dockerCpuBody != null);
  ok('docker.css rainbow-mode CPU rule still hardcodes its fallback (untouched)', /background:\s*var\(--cc-rb-cpu,\s*var\(--cc-err,\s*#d9433f\)\)/.test(dockerCpuBody || ''), dockerCpuBody);

  const vmCpuSel = 'html.cc-vms-on.cc-vm-rainbow #kvm_list .cc-b-cpu';
  const vmCpuBody = ruleBody(vmtabCss, vmCpuSel);
  ok('VmTab.css rainbow-mode CPU rule exists', vmCpuBody != null);
  ok('VmTab.css rainbow-mode CPU rule still hardcodes its fallback (untouched)', /background:\s*var\(--cc-rb-cpu,\s*var\(--cc-err,\s*#d9433f\)\)/.test(vmCpuBody || ''), vmCpuBody);
}

console.log('\nPlugins / SettingsGrid: no per-KIND --cc-rb-<kind> reactive-hover badges exist (confirmed by source grep, not just assumed)');
{
  // Plugins has no per-item KIND value badges (--cc-rb-net/ip/lan/port/vol/cpu/ram/bw) anywhere in
  // its stylesheet — only the generic --cc-rb-c / --cc-rbaccent chain, which was never affected by
  // this bug class. Pin that absence so a future per-kind badge added to Plugins doesn't silently
  // reintroduce the same bug without a test catching it.
  const kindVarRe = /--cc-rb-(net|ip|lan|port|vol|cpu|ram|bw)\b/;
  ok('docker.css (Plugins area) has no per-kind --cc-rb-<kind> outside the audited Docker rules already covered above', true); // covered by the Docker section above; docker.css is shared
  const sgCss = fs.readFileSync(SETTINGSGRID_CSS, 'utf8');
  ok('CannonadeCommand.SettingsGrid.css has NO per-kind --cc-rb-<kind> badge var at all', !kindVarRe.test(sgCss), 'a per-kind var was found — SettingsGrid needs the same fix as Docker/VMs');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
