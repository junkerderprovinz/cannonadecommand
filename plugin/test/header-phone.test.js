// At phone width the menu bar wraps instead of running off the screen's edge: Unraid keeps both
// tiles as one clipped row each below 768px, so tabs and icons were cut off at 390px. The tabs
// that have a glyph show only the glyph there, except the open one, and keep their name as the
// link's aria-label. The user list and the settings tiles follow the same house rules on every
// width: a page has no heading, the page action floats, and a tile is one button.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const css = read('sheets/CannonadeCommand.Header.css');
const header = read('scripts/header.js');
const media = (src, from) => { const at = src.indexOf(from); const open = src.lastIndexOf('@media (max-width: 767.98px) {', at); return src.slice(open, src.indexOf('\n}\n', at)); };

console.log('\nThe menu bar on a phone');
{
  const phone = media(css, 'Below 768px Unraid keeps both tiles');
  ok('the menu is a wrapping flex row', /#menu \{ display: flex !important; flex-wrap: wrap !important;/.test(phone));
  ok('both tiles wrap and never clip', /#menu \.nav-tile\.right \{[^}]*flex-wrap: wrap !important;[^}]*overflow: visible !important;/.test(phone));
  ok('each takes a line of its own', /#menu \.nav-tile\.right \{[^}]*width: 100% !important;/.test(phone));
  ok('a closed tab with a glyph shows only the glyph', /:not\(\.active\) > a:has\(> svg\.cc-tab-ico\) > span\.cc-tab-label \{ display: none; \}/.test(phone));
  const hides = phone.split('\n').filter((l) => l.includes('span.cc-tab-label { display: none'));
  ok('the open tab keeps its name', hides.length > 0 && hides.every((l) => l.includes(':not(.active)')));
  ok('a tab keeps its name for screen readers', header.includes('a.setAttribute("aria-label", node.textContent.trim());'));
}

console.log('\nThe user list');
{
  ok('/Users gets the settings page treatment of /Settings/Users', /var usersPg = \/\^\\\/Users\(\\\/\|\$\)\/\.test\(p0\);/.test(header) && header.includes('|| usersPg ||'));
  ok('its page title goes, the section titles stay', css.includes('html.cc-userlist #displaybox div.title:has(+ div#title.title) { display: none !important; }'));
  ok('adding a user floats in the bottom right corner', css.includes('form[action$="/UserAdd"] input[type="submit"] {\n  position: fixed; right: 24px; bottom: 24px;'));
  ok('one step taller, the key button', /form\[action\$="\/UserAdd"\] input\[type="submit"\] \{[^}]*height: 40px !important;/.test(css));
  ok('and the list keeps room below it', css.includes('html.cc-userlist #displaybox { padding-bottom: 96px; }'));
  ok('Fertig rests grey as the secondary action', /form\[action\$="\/UserAdd"\] input\[type="button"\]:not\(:hover\) \{\s*background: rgba\(128, 128, 128, \.18\) !important;/.test(css));
}

console.log('\nA settings tile without its badge');
{
  const sg = read('sheets/CannonadeCommand.SettingsGrid.css');
  const val = (e, prop) => { const c = candidates('every', Object.assign({ attrs: {}, states: {}, html: ['cc-popups-on', 'cc-settingsgrid-heads-on', 'cc-settingsgrid-tint'] }, e), prop); return c.length ? c[c.length - 1].value : null; };
  const tile = { tag: 'a', classes: [], inside: ['#displaybox', '.Panel'] };
  ok('its name is neutral ink, not a blue link', val(tile, 'color') === 'var(--cc-text-chip, #cfcfcf)' && val(tile, 'text-decoration') === 'none');
  ok('the whole tile fills one step up under the pointer', val(Object.assign({}, tile, { states: { hover: true } }), 'background') === 'var(--cc-hover-wash, rgba(128, 128, 128, .18))');
  ok('keyboard focus is the accent halo', /0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)/.test(val(Object.assign({}, tile, { states: { 'focus-visible': true } }), 'box-shadow') || ''));
  ok('with the badges on, the halo sits around the badge', sg.includes('html.cc-settingsgrid-on #displaybox .Panel > a:focus-visible > span,'));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
