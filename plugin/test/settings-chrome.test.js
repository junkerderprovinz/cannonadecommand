// Regression test for the CannonadeCommand settings page's own chrome.
//
// Three things are pinned here, each of them a bug that was reported from the live page:
//
//  1. EVERY COLOUR SWATCH IS THE SAME SIZE. The "selected" swatch used to be marked with
//     `transform: scale(1.18)`, written that way because Rule 5 forbids a ring or a border.
//     It obeyed that rule and broke another one: measured in a browser, the picked swatch
//     rendered 33x35 while its neighbours rendered 28x30, so a row that is one repeated shape
//     had one odd cell in it. The on-state may change COLOUR and it may add a MARK; it may not
//     change the BOX. This test fails if any geometry property comes back into the on-state.
//
//  2. THE FOOTER TOGGLE LIVES IN THE THEMING CARD. cc.footer is a global page setting like
//     Dichte and Kachelgröße, which were moved into that card for exactly this reason. It used
//     to be built into the Kopfbereich area's Stil card, where a global switch does not belong.
//
//  3. EVERY PREVIEW IS THE SHARED ONE. The Docker card and the per-area cards each carried a
//     private copy of the logo-preview recipe, and both painted something the real tabs never
//     paint (a raw tint that ignored cc.iconmode, and an feFlood "badge" that ignored the badge
//     shape). There is ONE builder now — logoPreview — and it runs the tabs' own icon pipeline.
//
// Text/AST-free on purpose: this must run on the same bare Node as every other WebGUI test.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const SETTINGS = process.argv[2] || path.join(DIR, 'scripts', 'settings.js');
const CSS = process.argv[3] || path.join(DIR, 'styles', 'docker.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(SETTINGS, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
// The file is heavily commented, and several of those comments quote the very class names and
// filter primitives these assertions look for (that is the point of the comments — they record
// what went wrong). Assertions about CODE therefore run against a comment-free copy; line numbers
// are preserved so a failure still points at the right line.
const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, m => m.replace(/[^\n]/g, ' '))).join('\n');

// Pull the body of a CSS rule whose selector list matches EXACTLY (comments stripped first,
// so a property named inside a comment can never satisfy or break an assertion).
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

console.log('\nPart 1 — the selected swatch is a MARK, never a different size');
{
  const off = ruleBody(css, '.cc-set-sw');
  const on = ruleBody(css, '.cc-set-sw-on');
  ok('the base .cc-set-sw rule exists', off != null);
  ok('the .cc-set-sw-on rule exists', on != null);
  // The exact regression: a transform on the on-state scales the box.
  ok('the on-state declares NO transform (this is the "active one is bigger" bug)', !declares(on, 'transform'), on || '');
  // …and nothing else that would move or resize it either.
  ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'padding', 'margin', 'flex', 'font-size', 'zoom', 'scale', 'border-width', 'border'].forEach(p => {
    ok('the on-state declares no ' + p, !declares(on, p), on || '');
  });
  ok('the base swatch pins BOTH dimensions, so on and off share one box', declares(off, 'width') && declares(off, 'height'));
  ok('the base swatch is a positioning context for its mark', declares(off, 'position'), off || '');

  // The replacement cue: a filled tick drawn INSIDE the swatch (Rule 5 — selection is filled,
  // never outlined) plus a brightness step. No ring, no border, no outline anywhere near it.
  const mark = ruleBody(css, '.cc-set-sw-on::after');
  ok('the on-state carries a ::after mark instead', mark != null);
  ok('the mark is a background image (the tick), not a drawn box', declares(mark, 'background-image'));
  ok('the mark never eats a click', declares(mark, 'pointer-events'));
  ok('the mark reads its ink from --cc-sw-tick, so it contrasts with the swatch colour', /--cc-sw-tick/.test(mark || ''));
  ok('the on-state still has its brightness step', declares(on, 'filter'));
  ['outline', 'box-shadow'].forEach(p => ok('neither state draws a ' + p + ' (house law: no rings)', !declares(on, p) && !declares(mark, p)));

  // The page-local sheet settings.js injects must not undo any of this.
  const inline = src.slice(src.indexOf('cc-set-xtra'), src.indexOf('document.head.appendChild(st)'));
  ok('the page-local sheet does not re-declare a geometry on .cc-set-sw-on',
    !/\.cc-set-sw-on\{[^}]*(transform|width|height|padding|flex)\s*:/.test(inline.replace(/\s/g, '')), '');
}

console.log('\nPart 2 — one helper marks the selected swatch everywhere');
{
  ok('swMark exists (class + contrast ink in one place)', /function swMark\s*\(/.test(src));
  ok('swMarkRow exists (mark exactly one swatch in a row)', /function swMarkRow\s*\(/.test(src));
  // Nothing may add the class behind the helper's back — that is how the ink would go missing
  // and how the per-area cards ended up marking a swatch the preview was not showing.
  const strays = code.split('\n').map((l, i) => ({ l, n: i + 1 }))
    .filter(o => /cc-set-sw-on/.test(o.l))
    .filter(o => !/function swMark|classList\.toggle\("cc-set-sw-on", !!on\)/.test(o.l));
  ok('every "cc-set-sw-on" write goes through swMark', strays.length === 0,
    strays.map(o => 'L' + o.n + ': ' + o.l.trim().slice(0, 90)).join(' | '));
  // syncSwOn used to sweep EVERY swatch on the page against the GLOBAL accent, which silently
  // un-marked each area card's own pick. It is scoped to the global row now.
  ok('syncSwOn only touches the GLOBAL accent row', /function syncSwOn\(\)[^\n]*cc-set-swrow-global/.test(src));
  ok('the global accent row is the one carrying that class', /cc-set-swatches cc-fill cc-set-swrow-global/.test(src));
}

console.log('\nPart 3 — the footer toggle is a global setting and lives in the Theming card');
{
  const i = code.indexOf('cc.footer');
  ok('the footer toggle still exists', i > 0);
  const around = code.slice(Math.max(0, i - 1200), i + 1200);
  ok('it is appended to themingCard', /themingCard\.appendChild\(cHf\)/.test(around), around.slice(-200));
  ok('it is NOT appended to the Kopfbereich Stil card any more', !/cH\.appendChild\(cHf\)/.test(src));
  ok('its behaviour is unchanged: same key, same default, same live sync',
    /get\("cc\.footer", "1"\) !== "0"/.test(src) && /set\("cc\.footer", v \? "1" : "0"\); syncHeaderBar\(\)/.test(src));
  // the other two globals that were moved there first are still there, so this is one place, not three
  ok('Dichte and Kachelgröße are still in the same card', /themingCard\.appendChild\(segRow\(T\("Dichte"/.test(src) && /themingCard\.appendChild\(tileSizeRow\(\)\)/.test(src));
}

console.log('\nPart 4 — one logo preview, running the tabs own icon pipeline');
{
  ok('logoPreview exists', /function logoPreview\s*\(/.test(src));
  ok('it asks the SHARED pipeline what to do (never a private rule)', /Ci\.plan\(/.test(src));
  ok('it honours per-item pins through the pipeline scope', /Ci\.mode\(scope, it\.name\)/.test(src));
  ok('it repaints when a pending icon lookup lands', /onResolved\(paint\)/.test(src));
  ok('it can swap in the curated glyph/colour artwork like the real tabs do', /Ci\.svgUrl\(it\.name\)/.test(src));
  // The badge is a real box now. An feFlood fills the whole filter region, so it ignored
  // border-radius and rendered a square where the tab shows a rounded tile.
  ok('no feFlood badge is composited inside a filter any more', code.indexOf('feFlood') < 0);
  ok('the badge is a CSS tile with a real radius', /cc-set-tile/.test(src) && /it\.tile\.style\.borderRadius = rad/.test(src));
  ok('the tile follows the global Badge-Form', /function radius\(\)[\s\S]{0,200}cc\.badgeshape/.test(src));
  // and every card that shows logos uses it — no third copy
  ['docker', 'vm', 'plugin'].forEach(s => ok('the global card previews the ' + s + ' area', new RegExp('\\["' + s + '", T\\(').test(src)));
  ok('the Docker card uses the shared preview', /logoPreview\("docker", "cc-set-dockprev"\)/.test(src));
  ok('the per-area cards use the shared preview', /logoPreview\(PSCOPE,/.test(src));
  ok('the per-area badge preview shows the same eight samples as the global card',
    /mkName\("nextcloud"\), mkVal\("CPU", "2\/8"\), mkVal\("RAM", "1\.2G"\), mkName\("plex"\)/.test(src));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
