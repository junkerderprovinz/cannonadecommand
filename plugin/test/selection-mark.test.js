// Picking rows and switching a setting are two different questions, and GlimStone gives each its
// own control. The Docker list's multi-select is the selection mark: a circle in every shape, a
// shade until picked, then the row's colour with a filled tick in that colour's ink. An on/off
// setting (the Startplan window's watchdog and idle rows, the badge-visibility matrix) is the
// switch. What can quietly break it:
//   · the mark falling back to the operating system's box tinted with accent-color
//   · the tick's ink baked into the CSS, so it vanishes on a light palette slot
//   · the square .cc-cb box or its per-element tick stamp coming back
//   · the marks shown or hidden by display, which moves the row when one comes in and takes the
//     mark out of the Tab order
//   · Ctrl and Shift on a row doing nothing, or a Shift range that ignores the list's order or the
//     rows a filter hides (GlimStone, "Lists")
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rule(css, sel) {
  const re = /([^{}]+)\{([^}]*)\}/g; let m;
  const out = [];
  while ((m = re.exec(css))) if (m[1].split(/,(?![^(]*\))/).map((s) => s.trim()).includes(sel)) out.push(m[2]);
  return out.join(';');
}
const docker = clean(read('styles/docker.css'));
const CHAIN = 'var(--cc-rb-c, var(--cc-rbaccent, var(--cc-accent, #FCC419)))';
const INK = 'var(--cc-rb-ct, var(--cc-rbaccent-text, var(--cc-accent-text, #161616)))';

console.log('\nThe multi-select is the selection mark');
{
  const base = rule(docker, '.cc-bulk-cb');
  ok('the mark is drawn, not the system box', /appearance:\s*none !important/.test(base) && !/accent-color/.test(base), base);
  // A circle is a form, not a shape setting: under Soft or Square the radius tokens shrink to 5px
  // or 0 and would turn the mark into a box, so the winning radius is a plain 50%.
  const { candidates } = require('./cascade');
  const el = { tag: 'input', classes: ['cc-bulk-cb'], attrs: { type: 'checkbox' }, states: {}, html: ['cc-docker-on'], outside: ['.cc-pop'] };
  const c = candidates('docker', el, 'border-radius'), w = c[c.length - 1];
  ok('it is a circle whatever the shape setting', !!w && w.value === '50%', w && w.selector + ' => ' + w.value);
  ok('it is 18px', /width:\s*18px/.test(base) && /height:\s*18px/.test(base));
  ok('it rests as a shade', /background:\s*rgba\(128, 128, 128, \.28\)/.test(base));
  ok('its slot is always there, so a row does not move when its mark comes in', /display:\s*inline-block !important/.test(base) && /opacity:\s*0;/.test(base), base);
  ok('it comes in under the pointer, with the focus in the row, once one is picked, in bulk mode and while it is ticked',
    /html:is\(\.cc-bulkmode-on, \.cc-bulk-picked\) \.cc-bulk-cb,\s*#docker_list tr:is\(:hover, :focus-within\) \.cc-bulk-cb, \.cc-bulk-cb:checked \{ opacity: 1; \}/.test(docker));
  const picked = rule(docker, '.cc-bulk-cb:checked');
  ok('picked, it takes the row\'s colour chain', picked.includes('background: ' + CHAIN), picked);
  const tick = rule(docker, '.cc-bulk-cb:checked::before');
  ok('the tick is painted in the chain\'s ink', tick.includes('background: ' + INK), tick);
  ok('the tick is GlimStone\'s filled IconCheck, as a mask', /mask: url\("data:image\/svg\+xml;utf8,<svg [^"]*viewBox='0\.3 0\.549 13\.399 13\.399'><path d='M4\.381 12\.219 /.test(tick) && /-webkit-mask:/.test(tick));
  ok('the tick is a filled shape, not a stroke', !/stroke/.test(tick));
  ok('a keyboard focus shows the accent halo', /box-shadow:\s*0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)/.test(rule(docker, '.cc-bulk-cb:focus-visible')));
  const js = read('scripts/docker.js');
  ok('docker.js still builds the mark as a checkbox, so the bulk code reads .checked', /el\("input", "cc-bulk-cb"\); bcb\.type = "checkbox";/.test(js));
}

console.log('\nCtrl and Shift pick rows the way a file manager does');
{
  const js = read('scripts/docker.js');
  const grab = (name) => { const i = js.indexOf('function ' + name + '('); let d = 0; for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } } return ''; };
  const skip = /var BULK_SKIP = "[^"]+";/.exec(js)[0];
  class Row {
    constructor(name) { this.name = name; this.style = { display: '' }; this.cb = { checked: false, closest: () => null }; }
    querySelector(sel) { return sel === '.cc-bulk-cb' ? this.cb : null; }
  }
  const rows = ['a', 'b', 'c', 'd', 'e'].map((n) => new Row(n));
  let syncs = 0;
  const api = new Function('rows', 'onSync',
    'var mode = "list", ccBulkSel = {}, ccBulkAnchor = null; ' + skip +
    'function findRows() { return rows; } function rowName(tr) { return tr.name; } function ctxFor(n) { return { id: "id-" + n, image: "img" }; } function ccBulkBarSync() { onSync(); }' +
    ['ccBulkRows', 'ccBulkRowFor', 'ccBulkInRange', 'ccBulkSet', 'ccBulkClick'].map(grab).join('\n') +
    '; return { click: ccBulkClick, rowFor: ccBulkRowFor, sel: function () { return Object.keys(ccBulkSel).sort().join(""); }, setMode: function (m) { mode = m; } };')(rows, () => syncs++);
  const marks = () => rows.filter((r) => r.cb.checked).map((r) => r.name).join('');
  api.click(rows[1], { ctrlKey: true });
  ok('Ctrl and a click picks a row', api.sel() === 'b' && marks() === 'b', api.sel());
  api.click(rows[3], { ctrlKey: true });
  ok('a second one adds to it', api.sel() === 'bd');
  api.click(rows[1], { ctrlKey: true });
  ok('Ctrl on a picked row takes it out again', api.sel() === 'd');
  api.click(rows[0], { shiftKey: true });
  ok('Shift picks the rows from the anchor to this one, in the list\'s order, in place of the rest', api.sel() === 'ab' && marks() === 'ab', api.sel());
  api.click(rows[4], { shiftKey: true });
  ok('a second Shift moves the far end and keeps the anchor', api.sel() === 'bcde', api.sel());
  rows[2].style.display = 'none';
  api.click(rows[0], { shiftKey: true });
  ok('a range drops a row the filter hides, so a bulk action never reaches one out of sight', api.sel() === 'ab' && !rows[2].cb.checked, api.sel());
  rows[2].style.display = '';
  ok('every pick brings the bar up to date', syncs === 6, syncs);
  ok('the selection keeps what the bulk actions need', /ccBulkSel\[name\] = \{ id: cx\.id, image: cx\.image \}/.test(grab('ccBulkSet')));
  const target = (cls, inSkip) => ({ closest: (sel) => (sel === '#docker_list tr' ? rows[0] : inSkip && sel.indexOf(cls) >= 0 ? {} : null) });
  ok('a plain click is no pick', api.rowFor({ target: target('x'), ctrlKey: false, metaKey: false, shiftKey: false, button: 0 }) === null);
  ok('Ctrl, Cmd and Shift with the main button are', ['ctrlKey', 'metaKey', 'shiftKey'].every((k) => api.rowFor(Object.assign({ target: target('x'), ctrlKey: false, metaKey: false, shiftKey: false, button: 0 }, { [k]: true })) === rows[0]));
  ok('a click on a control in the row keeps doing its own job', api.rowFor({ target: target('.cc-actcell', true), ctrlKey: true, button: 0 }) === null && api.rowFor({ target: target('a[href]', true), ctrlKey: true, button: 0 }) === null);
  api.setMode('grid');
  ok('only the list has marks to pick', api.rowFor({ target: target('x'), ctrlKey: true, button: 0 }) === null);
  ok('the page\'s click handler picks before it flashes the actions', /var picked = ccBulkRowFor\(e\);\n\s*if \(picked\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); ccBulkClick\(picked, e\); return; \}\n\s*var hand = /.test(js));
  ok('a Shift and a press on a row starts no text selection', /document\.addEventListener\("mousedown", function \(e\) \{ try \{ if \(!dead && e\.shiftKey && ccBulkRowFor\(e\)\) e\.preventDefault\(\);/.test(js));
  ok('a Shift on the mark itself picks the range too', /if \(bcbShift && ccBulkInRange\(tr\)\) \{ ccBulkClick\(tr, \{ shiftKey: true \}\); return; \}/.test(js));
  ok('html.cc-bulk-picked follows whether anything is picked', /classList\.toggle\("cc-bulk-picked", names\.length > 0\)/.test(js));
  ok('each mark is named for its container', /bcb\.setAttribute\("aria-label", \(LANG === "de" \? "Auswählen: " : "Select "\) \+ name\);/.test(js));
}

console.log('\nAn on/off setting is the switch');
{
  const base = rule(docker, '.cc-cb');
  ok('the 44x24 track of .cc-set-toggle', /width:\s*44px/.test(base) && /height:\s*24px/.test(base), base);
  ok('it rests on the off track', /background:\s*var\(--cc-toggle-track-off, #3a3a3a\)/.test(base));
  const knob = rule(docker, '.cc-cb::before');
  ok('an 18px knob at the pill radius', /width:\s*18px/.test(knob) && /border-radius:\s*var\(--cc-radius-pill\)/.test(knob), knob);
  ok('on, the track takes the colour chain', rule(docker, '.cc-cb:checked').includes('background: ' + CHAIN));
  const on = rule(docker, '.cc-cb:checked::before');
  ok('on, the knob moves across and takes the chain\'s ink', /left:\s*23px/.test(on) && on.includes('background: ' + INK), on);
  ok('a CC window\'s checkbox is the same switch', rule(docker, '.cc-pop input[type="checkbox"]') === base);
}

console.log('\nThe square box and its tick stamp are gone');
for (const f of ['styles/docker.css', 'scripts/docker.js', 'scripts/settings.js']) {
  const src = read(f);
  ok(f + ': no --cc-cb-tick', !/--cc-cb-tick/.test(src));
}
ok('docker.js: no ccTickURL', !/ccTickURL/.test(read('scripts/docker.js')));
ok('settings.js: the matrix cells carry colour and ink only', /function chkCell[^\n]*if \(rainbow && color\) \{ cb\.style\.setProperty\("--cc-rb-c", color\); cb\.style\.setProperty\("--cc-rb-ct", idealText\(color\)\); \} cb\.addEventListener/.test(read('scripts/settings.js')));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
