// Static source-slice regression test for the "Badge-Einstellungen übernehmen" (adopt
// rainbow/accent) toggle in settings.js's logoToggles().
//
// Context: v4.32.4-v4.32.7 deliberately made Hintergrund's/Einfärben's OWN picked colour win
// over Rainbow mode's rotating colour unconditionally (icon-rainbow-priority.test.js pins that).
// That was the right fix for the original complaint, but it removed a capability an install
// could previously rely on: making the icon FOLLOW Rainbow (or the plain accent) like every
// other badge. v4.33.0's first attempt gave EACH control (Hintergrund, Einfärben) its OWN
// independent adopt toggle — released, then immediately redesigned within minutes: two toggles
// meant Einfärben's adopt state still had to pick ONE flat rotating hue for the icon tint (the
// tint is a single shared SVG filter for the whole page, never per-row), so "rainbow mode" never
// actually looked like a rainbow — every logo showed the identical colour. v4.33.1 collapses both
// into ONE master toggle, positioned at the very TOP of the block (above both colour-picker
// rows): ON makes Hintergrund follow Rainbow/accent (now genuinely per-item via the new
// per-card/per-row rainbow stamping) AND makes Einfärben's ink an automatic black/white contrast
// colour for the resolved background, instead of a separately-adopted hue. This file pins that
// the ONE-toggle UI actually landed:
//  1. logoToggles() builds exactly ONE such toggle, wired to io.getAdopt()/setAdopt(), sitting
//     BEFORE the Hintergrund row (i.e. at the top of the card), and dims/disables BOTH colour
//     pickers while adopting (the SAME opacity/pointer-events convention the pre-existing
//     Intensität row already uses for "this control is not currently in effect").
//  2. All THREE call sites logoToggles() is used from (the global "Logos & Icons" card, the
//     Docker-specific card, and the generic per-area card VMs/Plugins/Settings share via
//     buildStyleCards()) wire real getters/setters — not stubs — using the SAME storage-key
//     family the rest of the Hintergrund/Einfärben controls already use (cc.iconbg/iconbgcolor/
//     icontint/iconcolor/iconbgrainbow and the P+-prefixed area-local mirrors), so a fix to one
//     call site can't silently leave another one dead. cc.icontintrainbow no longer exists
//     anywhere — it was retired as part of the single-toggle redesign.
//
// Deliberately a static/string-level pin (no DOM harness): logoToggles() is a heavy DOM builder
// (el()/toggle()/inlinePicker()/infoIcon()), and the READ-SIDE colour resolution this toggle
// drives is already exhaustively function-level tested in icon-pipeline.test.js /
// vms-icon-pipeline.test.js / plugins-icon-pipeline.test.js / settingsgrid-icon-pipeline.test.js.
// This file only has to prove the UI actually calls through to those storage keys.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts');
const SETTINGS = process.argv[2] || path.join(DIR, 'settings.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(SETTINGS, 'utf8');
// Comment-stripped copy (same technique settings-chrome.test.js uses) so a comment that quotes
// a key name can never satisfy an assertion by accident.
const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, m => m.replace(/[^\n]/g, ' '))).join('\n');

function fnBody(name) {
  const i = code.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = code.indexOf('{', i); k < code.length; k++) { if (code[k] === '{') d++; else if (code[k] === '}') { d--; if (!d) return code.slice(i, k + 1); } }
  return null;
}

console.log('\ncc.icontintrainbow no longer exists ANYWHERE in settings.js (clean breaking retirement)');
ok('zero remaining references to the retired two-toggle key', !/icontintrainbow/.test(code));
ok('zero remaining references to the retired per-control getter/setter names', !/getBgRainbow|setBgRainbow|getTintRainbow|setTintRainbow/.test(code));

console.log('\nlogoToggles(): ONE master adopt toggle, positioned above BOTH colour-picker rows');
{
  const lt = fnBody('logoToggles');
  ok('logoToggles() is found in source', !!lt);
  const body = lt || '';
  ok('reads io.getAdopt() to seed the master toggle', /io\.getAdopt\(\)/.test(body));
  ok('writes io.setAdopt(v) on change', /io\.setAdopt\(v\)/.test(body));
  ok('the "Badge-Einstellungen übernehmen" German label is used exactly ONCE (one toggle, not two)', (body.match(/Badge-Einstellungen übernehmen/g) || []).length === 1);
  ok('the English label "Adopt badge settings" is used exactly ONCE', (body.match(/Adopt badge settings/g) || []).length === 1);

  // Structural placement: adoptRow must be appended to `into` BEFORE bgRow (the master toggle
  // sits at the very top of the card, above Hintergrund's own on/off row and both pickers).
  const intoAppends = [...body.matchAll(/into\.appendChild\((\w+)\)/g)].map(m => m[1]);
  ok('the adopt row is appended into the card', intoAppends.includes('adoptRow'), intoAppends.join(','));
  ok('the adopt row is the FIRST thing appended — above Hintergrund, its picker, Einfärben and its picker', intoAppends[0] === 'adoptRow', intoAppends.join(','));
  ok('exactly ONE adopt-toggle row exists (no leftover per-control rows)', intoAppends.filter(n => /Rb(Row)?$/i.test(n)).length === 0, intoAppends.join(','));

  // "not currently in effect" convention: sync() must dim + inert BOTH colour picker rows while
  // the ONE master toggle adopts — the exact opacity/pointer-events pattern the pre-existing
  // Intensität row already uses when Einfärben itself is off.
  ok('sync() dims the background colour picker while adopting', /bgPickRow\.style\.opacity = adopting \? "\.4" : ""/.test(body));
  ok('sync() makes the background colour picker inert while adopting', /bgPickRow\.style\.pointerEvents = adopting \? "none" : ""/.test(body));
  ok('sync() dims the tint colour picker while adopting', /tintPickRow\.style\.opacity = adopting \? "\.4" : ""/.test(body));
  ok('sync() makes the tint colour picker inert while adopting', /tintPickRow\.style\.pointerEvents = adopting \? "none" : ""/.test(body));

  // Returned handle, so a caller can still reach the toggle directly if it ever needs to.
  ok('the returned handle exposes adoptToggle', /adoptToggle: adoptTg/.test(body));
  ok('the returned handle no longer exposes the retired per-control toggle names', !/bgRainbowToggle|tintRainbowToggle/.test(body));
}

console.log('\nAll THREE logoToggles() call sites wire REAL getters/setters, not stubs');
{
  // Every call site passes an io object; find each one's literal object body by scanning forward
  // from each "logoToggles(" call to its balanced closing ");".
  function callSiteIoBody(fromIndex) {
    const open = code.indexOf('logoToggles(', fromIndex);
    if (open < 0) return null;
    const argsStart = code.indexOf('{', open);
    let d = 0;
    for (let k = argsStart; k < code.length; k++) { if (code[k] === '{') d++; else if (code[k] === '}') { d--; if (!d) return { body: code.slice(argsStart, k + 1), next: k }; } }
    return null;
  }

  const sites = [];
  // Start AFTER the function's own definition (which also textually contains "logoToggles(" in
  // its `function logoToggles(into, io) {` header) so the scan only finds real call sites.
  const def = fnBody('logoToggles');
  let cursor = def ? code.indexOf(def) + def.length : 0;
  for (let n = 0; n < 3; n++) {
    const hit = callSiteIoBody(cursor);
    if (!hit) break;
    sites.push(hit.body);
    cursor = hit.next + 1;
  }
  ok('logoToggles() is called exactly THREE times (global card, Docker card, generic per-area card)', sites.length === 3, String(sites.length));

  const labels = ['global "Logos & Icons" card', 'Docker-specific card', 'generic per-area card (buildStyleCards)'];
  sites.forEach((body, i) => {
    ok(labels[i] + ': wires getAdopt', /getAdopt:/.test(body));
    ok(labels[i] + ': wires setAdopt', /setAdopt:/.test(body));
  });

  // Storage-key scheme: the two global-card call sites (global + Docker) read/write the SAME
  // cc.iconbgrainbow key the rest of the Hintergrund controls on those cards already use; the
  // generic per-area card's setter always writes the AREA-LOCAL P+ key (picking a colour means
  // "this area uses its own style", mirroring setBgColor/setColor/setBg/setTint immediately
  // above it in the same call), gated read-side by the SAME adopt-aware ga() ternary those
  // sibling getters already use.
  [sites[0], sites[1]].forEach((body, i) => {
    ok(labels[i] + ': getAdopt reads the global cc.iconbgrainbow key', /get\("cc\.iconbgrainbow", "0"\) === "1"/.test(body));
    ok(labels[i] + ': setAdopt writes the global cc.iconbgrainbow key', /set\("cc\.iconbgrainbow", v \? "1" : "0"\)/.test(body));
  });
  {
    const body = sites[2];
    ok(labels[2] + ': getAdopt is adopt-gated (ga() ? global cc.* : area-local P+ key), matching getBgColor/getColor right above it', /ga\(\) \? get\("cc\.iconbgrainbow", "0"\) : get\(P \+ "iconbgrainbow", "0"\)/.test(body));
    ok(labels[2] + ': setAdopt always writes the AREA-LOCAL P+iconbgrainbow key and calls useOwn(), mirroring setBgColor', /set\(P \+ "iconbgrainbow", v \? "1" : "0"\); useOwn\(\)/.test(body));
  }
}

console.log('\nThe live preview reflects the adopt state instead of a stale own-colour underneath the toggle');
{
  // gpaint() (global card), tintPrev() (Docker card) and tp() (generic per-area card) each build
  // the {bg, bgColor, tint, color, ...} object logoPreview().set() consumes — every one of them
  // must substitute the effective ink (idealText of the approximated background) while adopting,
  // and force `tint: true` since the ink no longer depends on Einfärben's own on/off, or flipping
  // the toggle would leave the settings-page preview showing a stale colour or no ink at all.
  ['gpaint', 'tintPrev', 'tp'].forEach(name => {
    const b = fnBody(name);
    ok(name + '() is found in source', !!b, name);
    ok(name + '() reads the master adopt state', /iconbgrainbow/.test(b || ''), name);
    ok(name + '() computes the ink via idealText() while adopting', /idealText\(/.test(b || ''), name);
    ok(name + '() no longer references the retired icontintrainbow key', !/icontintrainbow/.test(b || ''), name);
  });
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
