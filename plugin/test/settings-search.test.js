// The settings search matches the explanations in the bubbles as well as the visible text, shows
// an empty state when nothing matches, and opens with "/". Ctrl+K stays with the command palette.
// The search badge and the "Open" button are secondary, since a view has one filled accent button.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const settings = read('scripts/settings.js');
const header = read('scripts/header.js');

// A row: its visible text and the bubble texts on it and inside it.
class Row {
  constructor(text, tips, own) { this.textContent = text; this.tips = tips || []; this.own = own || null; this.style = { display: '', setProperty(k, v) { this[k] = v; }, removeProperty(k) { this[k] = ''; } }; }
  getAttribute(k) { return k === 'data-tip' ? this.own : null; }
  querySelectorAll() { return this.tips.map((t) => ({ getAttribute: () => t })); }
}
class Card {
  constructor(title, rows) { this.h = new Row(title); this.rows = rows; this.style = new Row('').style; }
  querySelector() { return this.h; }
  querySelectorAll() { return this.rows; }
}

console.log('\nBubble texts are searched too');
const searchText = new Function(grabFn(settings, 'searchText') + '\nreturn searchText;')();
ok('a word only in a bubble inside the row is found', /reloads the page/.test(searchText(new Row('Backup & transfer', ['Import writes them back and reloads the page.']))));
ok('a bubble on the row itself counts', /#fcc419/.test(searchText(new Row('', [], '#FCC419'))));
ok('the visible text still counts', /density/.test(searchText(new Row('Density'))));

console.log('\nThe filter and its empty state');
{
  const cards = [
    new Card('Theming', [new Row('Theming on'), new Row('Motion', ['Off: nothing moves. Wild: main-bar tabs hop on hover.'])]),
    new Card('Notifications', [new Row('Unraid notifications'), new Row('Webhook URL')])
  ];
  const empty = { style: { display: 'none' } }, hint = { textContent: '' };
  const tabRow = new Row('').style;
  let restored = 0;
  const env = {
    root: { querySelectorAll: (sel) => sel === '.cc-set-card' ? cards : [] },
    tabRow: { style: tabRow }, SECS: [{ w: { style: {} } }], searchEmpty: empty, emptyHint: hint,
    T: (d, e) => e, searchText, restore: () => { restored++; }
  };
  const runFilter = new Function('env', 'with (env) { ' + grabFn(settings, 'runFilter') + '\nreturn runFilter; }')(env);
  runFilter('hop');
  ok('a card whose bubble matches stays', cards[0].style.display === '' && cards[0].rows[1].style.display === '');
  ok('its other rows go', cards[0].rows[0].style.display === 'none');
  ok('a card with no match goes', cards[1].style.display === 'none');
  ok('no empty state while something matches', empty.style.display === 'none');
  runFilter('zebra');
  ok('nothing matching shows the empty state', empty.style.display === '');
  ok('which names the query', /zebra/.test(hint.textContent));
  runFilter('  ');
  ok('an empty query restores the tabs', restored === 1);
  const restore = grabFn(settings, 'restore');
  ok('restoring hides the empty state again', /searchEmpty\.style\.display = "none";/.test(restore));
  ok('the empty state is no card, so it never takes a rainbow position or a filter pass', /el\("div", "cc-set-empty"\)/.test(settings) && !/"cc-set-card cc-set-empty"/.test(settings));
}

console.log('\nOpening and closing');
{
  ok('"/" opens the search', /if \(e\.key !== "\/" \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return;/.test(settings));
  ok('but not while typing in a field', /if \(tag === "INPUT" \|\| tag === "TEXTAREA" \|\| tag === "SELECT" \|\| \(t && t\.isContentEditable\)\) return;/.test(settings));
  ok('the key is bound once', /if \(!window\.__ccSetSearchKey\) \{/.test(settings));
  ok('Ctrl+K stays with the command palette', /e\.key === "k" \|\| e\.key === "K"/.test(header) && !/e\.key === "k"|e\.key === "K"/.test(settings));
  ok('Escape clears first and closes on a second press', /if \(setSearch\.value\) \{ setSearch\.value = ""; runFilter\(""\); \} else \{ searchBadge\.classList\.remove\("cc-open"\); setSearch\.blur\(\); \}/.test(settings));
  ok('closing the badge resets the filter', /setSearch\.value = ""; runFilter\(""\); \} \}\);/.test(settings) && !/typeof runFilter/.test(settings));
}

console.log('\nOne filled accent button per view');
{
  const badge = (/"#cc-settings \.cc-set-searchbadge\{([^}]*)\}"/.exec(settings) || [])[1] || '';
  ok('the search badge rests grey', /background:#2e2e2e/.test(badge), badge);
  ok('and takes the colour mode only under the pointer', /\.cc-set-searchbadge:not\(\.cc-open\):hover\{background:var\(--cc-rbaccent,var\(--cc-accent/.test(settings));
  ok('"Open" is a plain secondary button', /el\("button", "cc-btn", T\("Öffnen", "Open"\)\)/.test(settings) && !/cc-btn-accent/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
