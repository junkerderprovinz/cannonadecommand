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
// colour for the resolved background, instead of a separately-adopted hue.
//
// v4.35.0 adds two more fixes on top, both from live feedback (items 4 + 5 of that round):
//  · Item 4 — the master toggle used to dim+disable only the two COLOUR PICKER rows while
//    adopting, leaving the Hintergrund/Einfärben SWITCHES themselves fully clickable and full
//    opacity (jdp: they must grey out and refuse clicks too). Fixed via toggle()'s own existing
//    disabled contract (_setDisabled — opacity/grayscale/cursor + flip() refuses to fire). Also
//    renamed the "Einfärben"/"Colourise" label to "Icons"/"Icons" (display label only — every
//    storage key, getter/setter name and internal variable keeps its old name).
//  · Item 5 — the toggle was redundant, repeated on every area card (Docker/Plugins/VMs/Settings)
//    when it only ever needs to exist once (jdp: "sonst ist er redundant"). logoToggles() gained
//    an io.hideAdoptRow flag; the Docker-specific card and the generic per-area card
//    (buildStyleCards, reused for VMs/Plugins/Settings/Favorites) both set it and no longer show
//    their own copy — ONLY the global "Logos & Icons" card still does. Adopt-rainbow became a
//    PURELY GLOBAL concept: the generic per-area card's getAdopt() now always reads the plain
//    cc.iconbgrainbow key (matching what the Docker card already did), no longer gated by that
//    area's own "use own style vs. adopt global style" state, and its setAdopt() is unreachable
//    dead code (no UI can call it any more).
//
// This file pins that the redesigned UI actually landed:
//  1. logoToggles() builds exactly ONE such toggle when NOT hidden, wired to
//     io.getAdopt()/setAdopt(), sitting BEFORE the Hintergrund row (i.e. at the top of the card),
//     dims/disables BOTH colour pickers AND both switches while adopting, and builds nothing at
//     all (no adoptTg, no adoptRow) when io.hideAdoptRow is set.
//  2. All THREE call sites logoToggles() is used from (the global "Logos & Icons" card, the
//     Docker-specific card, and the generic per-area card VMs/Plugins/Settings/Favorites share via
//     buildStyleCards()) wire real getters/setters — not stubs — using the SAME storage-key
//     family the rest of the Hintergrund/Einfärben controls already use (cc.iconbg/iconbgcolor/
//     icontint/iconcolor/iconbgrainbow and the P+-prefixed area-local mirrors), so a fix to one
//     call site can't silently leave another one dead. cc.icontintrainbow no longer exists
//     anywhere — it was retired as part of the single-toggle redesign. Only the global call site
//     omits hideAdoptRow; the other two set it.
//
// Deliberately a static/string-level pin (no DOM harness): logoToggles() is a heavy DOM builder
// (el()/toggle()/inlinePicker()/infoIcon()), and the READ-SIDE colour resolution this toggle
// drives is already exhaustively function-level tested in icon-pipeline.test.js /
// vms-icon-pipeline.test.js / plugins-icon-pipeline.test.js / settingsgrid-icon-pipeline.test.js.
// This file only has to prove the UI actually calls through to those storage keys. The one thing
// a static slice genuinely cannot see — whether the adopt row is ACTUALLY present/absent in the
// rendered DOM per card — is covered separately, with a real (if minimal) DOM harness, in
// adopt-rainbow-row-dom.test.js.
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

console.log('\nv4.35.0 item 4: "Einfärben" is renamed to "Icons" EVERYWHERE it is a visible label (comments already stripped out of `code`)');
ok('zero remaining visible "Einfärben" strings', !/Einfärben/.test(code));
ok('zero remaining visible "Colourise" strings', !/Colourise/.test(code));
ok('the tint row now uses the "Icons"/"Icons" label pair', /T\("Icons", "Icons"\)/.test(code));

console.log('\nlogoToggles(): ONE master adopt toggle when not hidden, positioned above BOTH colour-picker rows, NOTHING built when io.hideAdoptRow is set');
{
  const lt = fnBody('logoToggles');
  ok('logoToggles() is found in source', !!lt);
  const body = lt || '';
  ok('reads io.getAdopt() to seed the master toggle', /io\.getAdopt\(\)/.test(body));
  ok('writes io.setAdopt(v) on change', /io\.setAdopt\(v\)/.test(body));
  ok('the "Badge-Einstellungen übernehmen" German label is used exactly ONCE (one toggle, not two)', (body.match(/Badge-Einstellungen übernehmen/g) || []).length === 1);
  ok('the English label "Adopt badge settings" is used exactly ONCE', (body.match(/Adopt badge settings/g) || []).length === 1);
  ok('io.hideAdoptRow gates whether the adopt toggle/row are built at all', /hideAdopt\s*=\s*!!io\.hideAdoptRow/.test(body));
  ok('adoptTg/adoptRow are only built inside the !hideAdopt branch', /if \(!hideAdopt\) \{[\s\S]*adoptTg = toggle\(/.test(body));

  // Structural placement: adoptRow must be appended to `into` BEFORE bgRow (the master toggle
  // sits at the very top of the card, above Hintergrund's own on/off row and both pickers) —
  // conditionally now, since it may not exist at all.
  const intoAppends = [...body.matchAll(/into\.appendChild\((\w+)\)/g)].map(m => m[1]);
  ok('the adopt row is appended into the card (when it exists)', intoAppends.includes('adoptRow'), intoAppends.join(','));
  ok('the adopt row append is guarded (only fires when adoptRow was actually built)', /if \(adoptRow\) into\.appendChild\(adoptRow\)/.test(body));
  ok('the adopt row is the FIRST thing appended — above Hintergrund, its picker, Einfärben and its picker', intoAppends[0] === 'adoptRow', intoAppends.join(','));
  ok('exactly ONE adopt-toggle row exists (no leftover per-control rows)', intoAppends.filter(n => /Rb(Row)?$/i.test(n)).length === 0, intoAppends.join(','));

  // "not currently in effect" convention: sync() must dim + inert BOTH colour picker rows AND
  // BOTH switches while the ONE master toggle adopts (item 4 — the switches used to stay fully
  // clickable/opaque while their own picker greyed out beside them).
  ok('sync() guards adoptTg._setOn for the hidden case (adoptTg may be null)', /if \(adoptTg\) adoptTg\._setOn/.test(body));
  ok('sync() dims the background colour picker while adopting', /bgPickRow\.style\.opacity = adopting \? "\.4" : ""/.test(body));
  ok('sync() makes the background colour picker inert while adopting', /bgPickRow\.style\.pointerEvents = adopting \? "none" : ""/.test(body));
  ok('sync() disables the Hintergrund SWITCH itself while adopting (item 4)', /bgTg\._setDisabled\(adopting\)/.test(body));
  ok('sync() dims the tint colour picker while adopting', /tintPickRow\.style\.opacity = adopting \? "\.4" : ""/.test(body));
  ok('sync() makes the tint colour picker inert while adopting', /tintPickRow\.style\.pointerEvents = adopting \? "none" : ""/.test(body));
  ok('sync() disables the Icons (tint) SWITCH itself while adopting (item 4)', /tintTg\._setDisabled\(adopting\)/.test(body));

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

  console.log('\n  v4.35.0 item 5: ONLY the global card keeps the visible row — the other two hide it and go purely global');
  ok(labels[0] + ': does NOT set hideAdoptRow (the ONE card that still shows the switch)', !/hideAdoptRow/.test(sites[0]), sites[0]);
  ok(labels[1] + ': sets hideAdoptRow: true', /hideAdoptRow:\s*true/.test(sites[1]), sites[1]);
  ok(labels[2] + ': sets hideAdoptRow: true', /hideAdoptRow:\s*true/.test(sites[2]), sites[2]);

  // Storage-key scheme: ALL THREE call sites now read the SAME plain cc.iconbgrainbow key,
  // unconditionally — the global and Docker cards already did (unchanged); the generic per-area
  // card used to be adopt-gated (ga() ? global cc.* : area-local P+ key) and is now purely global
  // too, matching what its (now hidden) row's getAdopt() has to answer for sync()'s dimming logic
  // to make any sense at all.
  sites.forEach((body, i) => {
    ok(labels[i] + ': getAdopt reads the global cc.iconbgrainbow key, unconditionally', /getAdopt: function \(\) \{ return get\("cc\.iconbgrainbow", "0"\) === "1"; \}/.test(body), body);
  });
  ok(labels[0] + ': setAdopt writes the global cc.iconbgrainbow key', /setAdopt: function \(v\) \{ set\("cc\.iconbgrainbow", v \? "1" : "0"\); \}/.test(sites[0]), sites[0]);
  ok(labels[1] + ': setAdopt writes the global cc.iconbgrainbow key', /setAdopt: function \(v\) \{ set\("cc\.iconbgrainbow", v \? "1" : "0"\); \}/.test(sites[1]), sites[1]);
  ok(labels[2] + ': setAdopt is now unreachable dead code — a genuine no-op, not a P+ key write', /setAdopt: function \(\) \{\}/.test(sites[2]), sites[2]);
  ok(labels[2] + ': setAdopt no longer writes the area-local P+iconbgrainbow key', !/set\(P \+ "iconbgrainbow"/.test(sites[2]), sites[2]);

  // getBgColor/getColor etc. are UNAFFECTED by item 5 — an area's own Hintergrund/Icons COLOURS
  // can still be its own; only whether they follow rainbow became global. The generic card's
  // still-adopt-gated colour getters prove that distinction survived the edit.
  ok(labels[2] + ': getBgColor is STILL adopt-gated by ga() (own vs. adopted STYLE, unrelated to item 5)', /getBgColor: function \(\) \{ return ga\(\) \?/.test(sites[2]), sites[2]);
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
  // tp() (the generic per-area card's preview) is the one that used to be adopt-gated by ga() —
  // pin that it now reads the plain global key too, matching cBLT's getAdopt() right above it.
  const tpBody = fnBody('tp') || '';
  ok('tp() reads cc.iconbgrainbow unconditionally now (item 5), not ga()-gated', /var adopt9 = get\("cc\.iconbgrainbow", "0"\) === "1";/.test(tpBody), tpBody);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
