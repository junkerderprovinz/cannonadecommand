// Static regression test: icon logo badge colour vs Rainbow mode priority (#T6).
//
// The bug (live-tested on a real box, confirmed with the user): with Rainbow mode on and
// Reactive mode on, hovering a Docker/Plugin/VM row's icon logo badge showed the rotating
// rainbow colour instead of the colour the user picked in the "Logos & Icons" settings card.
// Traced to every CSS rule painting that badge's background putting --cc-rb-c (the per-row
// rainbow rotation colour, stamped inline by JS) BEFORE --cc-iconbg-color (the configured icon
// colour) in the var() fallback chain, so rainbow always won whenever it was on.
//
// Decided fix: an icon logo's OWN background badge represents the app's identity, not a rotating
// value indicator, so --cc-iconbg-color must come first, with --cc-rb-c only as the fallback for
// rows/tabs that have no icon colour configured. This is scoped ONLY to the icon logo badge —
// every OTHER rainbow-coloured element (CPU/RAM/value badges, tab pills, buttons, ...) keeps
// rainbow-first behaviour unchanged, which this file also pins so the two paths can't be
// conflated by a future edit.
//
// Reuses settings-chrome.test.js's ruleBody()/declares() helpers verbatim (same comment-stripping
// regex) — this is a static/string-level pin, appropriate for a CSS file with no CSS engine
// available in the bare-Node test runner.
//
// #T6 follow-up (v4.32.5): v4.32.4 missed the Settings/Tools category-grid tile badge
// (settingsgrid.js + CannonadeCommand.SettingsGrid.css) — the identical bug, in the one area the
// original fix didn't touch. This file also pins that follow-up fix: the CSS reactive-hover var()
// order (same technique as above) and, since paintGrid()'s plain rainbow paint has no CSS var()
// chain to fall back on (it's a hard inline JS write), a source-sliced assertion on the real
// paintGrid() function body.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const CSS = process.argv[2] || path.join(DIR, 'styles', 'docker.css');
const SG_CSS = path.join(DIR, 'sheets', 'CannonadeCommand.SettingsGrid.css');
const SG_JS = path.join(DIR, 'scripts', 'settingsgrid.js');

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
function iconbgFirst(body) { return /background:\s*var\(--cc-iconbg-color,\s*var\(--cc-rb-c,/.test(body || ''); }

console.log('\nDocker icon logo badge: a configured icon colour wins over the rainbow palette');
{
  const listSel = '.cc-enh.cc-docker-iconbg.cc-rainbow #docker_list tr:is(.sortable, .folder-element) td.ct-name .outer > span.hand';
  const gridSel = '.cc-grid-holder.cc-docker-iconbg.cc-rainbow .cc-card-ico';
  const listHoverSel = 'html.cc-shares-rbneutral.cc-docker-on .cc-enh.cc-docker-iconbg.cc-rainbow #docker_list tr:is(.sortable, .folder-element):hover td.ct-name .outer > span.hand';
  const gridHoverSel = 'html.cc-shares-rbneutral.cc-docker-on .cc-grid-holder.cc-docker-iconbg.cc-rainbow .cc-card:hover .cc-card-ico';
  [
    ['list-mode tile (non-reactive rainbow)', listSel],
    ['grid-mode tile (non-reactive rainbow)', gridSel],
    ['list-mode tile (reactive hover)', listHoverSel],
    ['grid-mode tile (reactive hover)', gridHoverSel],
  ].forEach(([label, sel]) => {
    const body = ruleBody(css, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --cc-iconbg-color comes before --cc-rb-c', iconbgFirst(body), body);
  });
}

console.log('\nPlugins icon logo badge: a configured icon colour wins over the rainbow palette');
{
  const tileSel = 'html.cc-plugins-iconbg.cc-plugins-rainbow .cc-plugico';
  const hoverSel = 'html.cc-shares-rbneutral.cc-on-plugins #plugin_list tr:hover .cc-plugico';
  [
    ['tile (non-reactive rainbow)', tileSel],
    ['tile (reactive hover)', hoverSel],
  ].forEach(([label, sel]) => {
    const body = ruleBody(css, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --cc-iconbg-color comes before --cc-rb-c', iconbgFirst(body), body);
  });
}

console.log('\nSettingsGrid tile badge (CSS): a configured icon colour wins over the rainbow palette (#T6 follow-up)');
{
  // The reactive/neutral hover rules are the ONE place SettingsGrid resolves the badge colour
  // through a CSS var() chain (the plain/non-reactive paint is a hard inline JS write, checked
  // separately below) — same bug, same fix as Docker/VMs/Plugins above, missed in v4.32.4.
  const sgCss = fs.readFileSync(SG_CSS, 'utf8');
  const localHoverSel = 'html.cc-settingsgrid-on.cc-settingsgrid-rbneutral #displaybox .Panel > a:hover > span';
  const globalHoverSel = 'html.cc-shares-rbneutral.cc-settingsgrid-on #displaybox .Panel > a:hover > span';
  const localHoverColorSel = 'html.cc-settingsgrid-on.cc-settingsgrid-rbneutral #displaybox .Panel > a:hover > span > i.PanelIcon,\nhtml.cc-settingsgrid-on.cc-settingsgrid-rbneutral #displaybox .Panel > a:hover > span';
  const globalHoverColorSel = 'html.cc-shares-rbneutral.cc-settingsgrid-on #displaybox .Panel > a:hover > span > i.PanelIcon,\nhtml.cc-shares-rbneutral.cc-settingsgrid-on #displaybox .Panel > a:hover > span';
  [
    ['local reactive hover (cc-settingsgrid-rbneutral)', localHoverSel, localHoverColorSel],
    ['global reactive hover (cc-shares-rbneutral)', globalHoverSel, globalHoverColorSel],
  ].forEach(([label, sel, colorSel]) => {
    const body = ruleBody(sgCss, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --cc-iconbg-color comes before --cc-rb-c', iconbgFirst(body), body);
    const colorBody = ruleBody(sgCss, colorSel);
    ok(label + ': paired glyph-ink rule exists', colorBody != null);
    ok(label + ': paired glyph-ink colour also puts --cc-iconbg-text first', /color:\s*var\(--cc-iconbg-text,\s*var\(--cc-rb-ct,/.test(colorBody || ''), colorBody);
  });
}

console.log('\nSettingsGrid tile badge (JS paintGrid): the plain-rainbow paint defers to a configured icon colour (#T6 follow-up)');
{
  // paintGrid() has no CSS var() chain to fall back on for the plain (non-reactive) rainbow
  // paint — it writes the background as a hard inline style. Source-slice the REAL function
  // body (never re-typed) and pin that its background write is now conditional on whether an
  // icon colour is configured, instead of the old unconditional `s.style.setProperty("background", c, ...)`.
  const sgJs = fs.readFileSync(SG_JS, 'utf8');
  const m = /function paintGrid\(\) \{[\s\S]*?\n  \}\n/.exec(sgJs);
  ok('paintGrid() is found in source', !!m);
  const body = m ? m[0] : '';
  ok('checks whether ccs.iconcolor is a valid configured colour', /ccs\.iconcolor/.test(body), body);
  ok('the background write is conditional (iconSet ? ... : c), not the old unconditional c', /setProperty\("background",\s*bg,\s*"important"\)/.test(body) && !/setProperty\("background",\s*c,\s*"important"\)/.test(body), body);
  ok('when an icon colour is configured, the badge paints with accBg (the resolved icon colour), not the raw rainbow colour', /bg\s*=\s*iconSet\s*\?\s*accBg\s*:\s*c/.test(body), body);
}

console.log('\nDocker icon logo badge reactive-hover (NO icon colour configured): --cc-rb-c is in the fallback chain (v4.33.1 fix)');
{
  // The .cc-rainbow-gated rules above (icon colour configured, wins over the palette) are a
  // DIFFERENT pair from these: these two apply whenever Hintergrund is on regardless of whether
  // an icon colour is configured, and reactive mode's hover previously fell straight from
  // --cc-iconbg-color to the flat --cc-accent, skipping --cc-rb-c entirely — the same class of
  // gap the v4.32.9 fix closed for the per-kind value badges, just missed here. This mattered far
  // more once bgColor() started answering "" while the master adopt toggle is on (the badge's
  // ONLY colour source is then --cc-rb-c), and became directly testable once GRID/FOLDER cards
  // started carrying their own per-card --cc-rb-c (docker-grid-rainbow-stamp.test.js).
  const listNoColorHoverSel = 'html.cc-shares-rbneutral.cc-docker-on .cc-enh.cc-docker-iconbg #docker_list tr:is(.sortable, .folder-element):hover td.ct-name .outer > span.hand';
  const gridNoColorHoverSel = 'html.cc-shares-rbneutral.cc-docker-on .cc-grid-holder.cc-docker-iconbg .cc-card:hover .cc-card-ico';
  [
    ['list-mode tile (reactive hover, no icon colour configured)', listNoColorHoverSel],
    ['grid-mode tile (reactive hover, no icon colour configured)', gridNoColorHoverSel],
  ].forEach(([label, sel]) => {
    const body = ruleBody(css, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --cc-iconbg-color comes before --cc-rb-c, before the flat --cc-accent', iconbgFirst(body), body);
  });
}

console.log('\nGeneric (non-icon) rainbow badges stay rainbow-first — this fix must NOT touch them');
{
  // CPU/RAM value badges and the generic plugin row-badge hover path are NOT icon logo tiles;
  // they must keep --cc-rb-c as the FIRST colour source, exactly as before this fix.
  const cpuSel = '.cc-enh.cc-rainbow .cc-b-cpu, .cc-grid-holder.cc-rainbow .cc-b-cpu';
  const cpuBody = ruleBody(css, cpuSel);
  ok('CPU badge rule exists', cpuBody != null);
  ok('CPU badge: --cc-rb-c is still FIRST (untouched by this fix)', /background:\s*var\(--cc-rb-cpu,/.test(cpuBody || ''), cpuBody);

  const genericPluginHoverSel = 'html.cc-shares-rbneutral.cc-on-plugins #plugin_list tr:hover .cc-b:not(.cc-b-del),\nhtml.cc-shares-rbneutral.cc-on-plugins #plugin_list tr:hover .cc-plugsup';
  const genBody = ruleBody(css, genericPluginHoverSel);
  ok('generic plugin value-badge hover rule exists', genBody != null);
  ok('generic plugin value badge: --cc-rb-c is still FIRST (untouched by this fix)', /background:\s*var\(--cc-rb-c,\s*var\(--cc-accent,/.test(genBody || ''), genBody);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
