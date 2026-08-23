// Static source-slice regression test for the "Badge-Einstellungen übernehmen" (adopt
// rainbow/accent) toggle added to settings.js's logoToggles() in v4.33.0.
//
// Context: v4.32.4-v4.32.7 deliberately made Hintergrund's/Einfärben's OWN picked colour win
// over Rainbow mode's rotating colour unconditionally (icon-rainbow-priority.test.js pins that).
// That was the right fix for the original complaint, but it removed a capability an install
// could previously rely on: making the icon FOLLOW Rainbow (or the plain accent) like every
// other badge. The user proposed the exact fix — a third, independent toggle per control
// ("Badge-Einstellungen übernehmen") — and this file pins that it actually landed:
//  1. logoToggles() builds ONE such toggle for Hintergrund and ONE for Einfärben, each wired to
//     its own io.get*Rainbow()/set*Rainbow() pair, and dims/disables that control's own colour
//     picker while adopting (the SAME opacity/pointer-events convention the pre-existing
//     Intensität row already uses for "this control is not currently in effect").
//  2. All THREE call sites logoToggles() is used from (the global "Logos & Icons" card, the
//     Docker-specific card, and the generic per-area card VMs/Plugins/Settings share via
//     buildStyleCards()) wire real getters/setters — not stubs — using the SAME storage-key
//     family the rest of the Hintergrund/Einfärben controls already use (cc.iconbg/iconbgcolor/
//     icontint/iconcolor and the P+-prefixed area-local mirrors), so a fix to one call site can't
//     silently leave another one dead.
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

console.log('\nlogoToggles(): the adopt-rainbow toggle exists for BOTH controls, independently');
{
  const lt = fnBody('logoToggles');
  ok('logoToggles() is found in source', !!lt);
  const body = lt || '';
  ok('reads io.getBgRainbow() to seed the background adopt toggle', /io\.getBgRainbow\(\)/.test(body));
  ok('writes io.setBgRainbow(v) on change', /io\.setBgRainbow\(v\)/.test(body));
  ok('reads io.getTintRainbow() to seed the tint adopt toggle', /io\.getTintRainbow\(\)/.test(body));
  ok('writes io.setTintRainbow(v) on change', /io\.setTintRainbow\(v\)/.test(body));
  ok('the shared "Badge-Einstellungen übernehmen" / "Adopt badge settings" label is used for the background row', (body.match(/Badge-Einstellungen übernehmen/g) || []).length >= 2);
  ok('the shared English label "Adopt badge settings" is used', (body.match(/Adopt badge settings/g) || []).length >= 2);

  // The two new rows must actually be appended into the card, or the toggle is unreachable.
  ok('the background adopt row is appended', /into\.appendChild\(bgRbRow\)/.test(body));
  ok('the tint adopt row is appended', /into\.appendChild\(tintRbRow\)/.test(body));

  // The "not currently in effect" convention: sync() must dim + inert the OWN colour picker row
  // while that control adopts — the exact opacity/pointer-events pattern the pre-existing
  // Intensität row already uses when Einfärben itself is off.
  ok('sync() dims the background colour picker while Hintergrund adopts', /bgPickRow\.style\.opacity = bgAdopt \? "\.4" : ""/.test(body));
  ok('sync() makes the background colour picker inert while Hintergrund adopts', /bgPickRow\.style\.pointerEvents = bgAdopt \? "none" : ""/.test(body));
  ok('sync() dims the tint colour picker while Einfärben adopts', /tintPickRow\.style\.opacity = tintAdopt \? "\.4" : ""/.test(body));
  ok('sync() makes the tint colour picker inert while Einfärben adopts', /tintPickRow\.style\.pointerEvents = tintAdopt \? "none" : ""/.test(body));

  // Returned handles, so a caller can still reach the toggles directly if it ever needs to.
  ok('the returned handle exposes bgRainbowToggle', /bgRainbowToggle: bgRbTg/.test(body));
  ok('the returned handle exposes tintRainbowToggle', /tintRainbowToggle: tintRbTg/.test(body));
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
    ok(labels[i] + ': wires getBgRainbow', /getBgRainbow:/.test(body));
    ok(labels[i] + ': wires setBgRainbow', /setBgRainbow:/.test(body));
    ok(labels[i] + ': wires getTintRainbow', /getTintRainbow:/.test(body));
    ok(labels[i] + ': wires setTintRainbow', /setTintRainbow:/.test(body));
  });

  // Storage-key scheme: the two global-card call sites (global + Docker) read/write the SAME
  // cc.* keys the rest of the Hintergrund/Einfärben controls on those cards already use; the
  // generic per-area card's setters always write the AREA-LOCAL P+ key (picking a colour means
  // "this area uses its own style", mirroring setBgColor/setColor/setBg/setTint immediately
  // above them in the same call), gated read-side by the SAME adopt-aware ga() ternary those
  // sibling getters already use.
  [sites[0], sites[1]].forEach((body, i) => {
    ok(labels[i] + ': getBgRainbow reads the global cc.iconbgrainbow key', /get\("cc\.iconbgrainbow", "0"\) === "1"/.test(body));
    ok(labels[i] + ': setBgRainbow writes the global cc.iconbgrainbow key', /set\("cc\.iconbgrainbow", v \? "1" : "0"\)/.test(body));
    ok(labels[i] + ': getTintRainbow reads the global cc.icontintrainbow key', /get\("cc\.icontintrainbow", "0"\) === "1"/.test(body));
    ok(labels[i] + ': setTintRainbow writes the global cc.icontintrainbow key', /set\("cc\.icontintrainbow", v \? "1" : "0"\)/.test(body));
  });
  {
    const body = sites[2];
    ok(labels[2] + ': getBgRainbow is adopt-gated (ga() ? global cc.* : area-local P+ key), matching getBgColor/getColor right above it', /ga\(\) \? get\("cc\.iconbgrainbow", "0"\) : get\(P \+ "iconbgrainbow", "0"\)/.test(body));
    ok(labels[2] + ': setBgRainbow always writes the AREA-LOCAL P+iconbgrainbow key and calls useOwn(), mirroring setBgColor', /set\(P \+ "iconbgrainbow", v \? "1" : "0"\); useOwn\(\)/.test(body));
    ok(labels[2] + ': getTintRainbow is adopt-gated the same way', /ga\(\) \? get\("cc\.icontintrainbow", "0"\) : get\(P \+ "icontintrainbow", "0"\)/.test(body));
    ok(labels[2] + ': setTintRainbow always writes the AREA-LOCAL P+icontintrainbow key and calls useOwn()', /set\(P \+ "icontintrainbow", v \? "1" : "0"\); useOwn\(\)/.test(body));
  }
}

console.log('\nThe live preview reflects the adopt state instead of a stale own-colour underneath the toggle');
{
  // gpaint() (global card), tintPrev() (Docker card) and tp() (generic per-area card) each build
  // the {bg, bgColor, tint, color, ...} object logoPreview().set() consumes — every one of them
  // must substitute the effective accent while adopting, or flipping the toggle would leave the
  // settings-page preview showing whatever colour happened to be stored underneath it.
  ['gpaint', 'tintPrev', 'tp'].forEach(name => {
    const b = fnBody(name);
    ok(name + '() is found in source', !!b, name);
    ok(name + '() reads the background adopt state', /iconbgrainbow/.test(b || ''), name);
    ok(name + '() reads the tint adopt state', /icontintrainbow/.test(b || ''), name);
  });
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
