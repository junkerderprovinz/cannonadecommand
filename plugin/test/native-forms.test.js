// Unraid's native settings forms (Settings and Tools sub-pages, the device pages, the share edit
// page) are GlimStone cards: forms.js marks Unraid's own markup and Forms.css draws it. These are
// the shared rules every such form depends on, decided through the cascade against Unraid's own
// button rules, plus the promises forms.js makes about the forms it touches.
const fs = require('fs');
const path = require('path');
const { DIR, withUnraid, candidates, parseRules } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const page = withUnraid('every');
const win = (e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');

console.log('\nThe sheet is inert until forms.js opts a page in');
{
  const rules = parseRules(read('sheets/CannonadeCommand.Forms.css'));
  const split = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } return out.concat(cur); };
  const loose = [];
  for (const r of rules) for (const s of split(r.selector)) if (!/^html\.cc-forms-on\b/.test(s.trim())) loose.push(s.trim());
  ok('every selector starts at html.cc-forms-on', loose.length === 0, loose.slice(0, 3).join(' | '));
  const pg = read('CannonadeCommand.Forms.page');
  ok('the page hook loads the sheet by its basename and the script', /Menu="Buttons:\d+"/.test(pg) && /scripts\/forms\.js/.test(pg));
}

console.log('\nA native checkbox is the switch, never a box');
for (const [where, html] of [['a Settings or Tools page', ['cc-tools-on']], ['the share edit page', ['cc-shares-on', 'cc-on-share-detail']]]) {
  const cb = { tag: 'input', classes: [], attrs: { type: 'checkbox' }, inside: ['#displaybox'], html };
  ok(where + ': the 44x24 track', val(win(cb, 'width')) === '44px' && val(win(cb, 'height')) === '24px', val(win(cb, 'width')) + 'x' + val(win(cb, 'height')));
  ok(where + ': the OS box is gone', val(win(cb, 'appearance')) === 'none');
  ok(where + ': the track takes the shape engine', val(win(cb, 'border-radius')) === 'var(--cc-radius-pill)');
  const on = Object.assign({}, cb, { states: { checked: true } });
  ok(where + ': switched on, the colour mode fills it', /--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/.test(val(win(on, 'background'))), val(win(on, 'background')));
}

console.log('\nA native button is a sentence-case badge, neutral at rest');
const formsHtml = ['cc-forms-on', 'cc-tools-on'];
for (const type of ['button', 'submit']) {
  const b = { tag: 'input', classes: [], attrs: { type }, inside: ['#displaybox'], html: formsHtml };
  ok(type + ': no capitals, no tracking', val(win(b, 'text-transform')) === 'none' && val(win(b, 'letter-spacing')) === 'normal', val(win(b, 'text-transform')) + ' / ' + val(win(b, 'letter-spacing')));
  ok(type + ': the neutral fill', val(win(b, 'background')) === 'var(--cc-fm-btn)', val(win(b, 'background')));
  ok(type + ': at the md stage', val(win(b, 'height')) === 'var(--cc-md-h, 30px)', val(win(b, 'height')));
}
{
  const apply = { tag: 'input', classes: ['cc-fm-primary'], attrs: { type: 'submit' }, inside: ['#displaybox'], html: formsHtml };
  ok('the forward action is the filled one', /^var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/.test(val(win(apply, 'background'))), val(win(apply, 'background')));
  const reactive = Object.assign({}, apply, { html: formsHtml.concat(['cc-tools-rbneutral']) });
  ok('in the reactive mode it rests neutral', val(win(reactive, 'background')) === 'var(--cc-fm-btn)', val(win(reactive, 'background')));
  const disabled = Object.assign({}, apply, { states: { disabled: true } });
  ok('disabled, it is a grey badge rather than a dim accent', val(win(disabled, 'background')) === 'var(--cc-fm-btn)', val(win(disabled, 'background')));
  const share = { tag: 'input', classes: [], attrs: { type: 'submit' }, inside: ['#displaybox'], html: ['cc-forms-on', 'cc-shares-on', 'cc-on-share-detail'] };
  ok('a button on the share page is in sentence case too', val(win(share, 'text-transform')) === 'none', val(win(share, 'text-transform')));
}

console.log('\nforms.js leaves the forms working');
{
  const js = read('scripts/forms.js');
  ok('it never submits a form', !/\.submit\(|requestSubmit/.test(js));
  ok('it never renames a field or writes a value', !/\.name\s*=[^=]|\.value\s*=[^=]/.test(js));
  ok('a segment picks its radio by clicking it, so Unraid\'s handlers run', /r\.click\(\)/.test(js));
  ok('CA\'s settings page keeps its own row alignment', /ca_settings/.test(js));
  const tips = js.slice(js.indexOf('var TIPS'), js.indexOf('function active'));
  const pairs = tips.match(/\[\s*"[^"]*",\s*"[^"]*"\s*\]/g) || [];
  ok('every written tip comes in German and English', pairs.length > 10 && pairs.every((p) => /"[^"]+",\s*"[^"]+"/.test(p)));
  const dashes = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  ok('no tip uses a long dash for punctuation', !dashes.test(tips));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
