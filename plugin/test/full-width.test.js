// Pages and windows run the full width (GlimStone, "The content column" and "Windows"). The
// settings cards share the page's width instead of standing in fixed 340px columns, a dropdown or
// a one-line field stands beside its name with a width of its own (rule 35), and a window's
// actions sit at the end of its foot with Close first. A grid of cards stands on the page: a
// folder in the folder view has no card around its cards.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const win = (page, e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');

console.log('\nThe settings page uses the width it has');
{
  const page = withUnraid('settings');
  const wrap = { tag: 'div', classes: ['cc-set-wrap'], inside: ['#cc-settings'] };
  ok('the cards fill the row, 340px at the least', val(win(page, wrap, 'grid-template-columns')) === 'repeat(auto-fill, minmax(340px, 1fr))', val(win(page, wrap, 'grid-template-columns')));
  ok('and are no longer packed against the left', !candidates(page, wrap, 'justify-content').length);
}

console.log('\nA dropdown or a one-line field stands beside its name');
{
  const page = withUnraid('settings');
  const dsel = { tag: 'span', classes: ['cc-dsel'], inside: ['#cc-settings'], outside: ['.cc-pop'] };
  ok('a dropdown has a width of its own and gives way before it wraps', val(win(page, dsel, 'flex')) === '0 1 240px' && val(win(page, dsel, 'min-width')) === '120px', val(win(page, dsel, 'flex')));
  ok('it keeps the row\'s end', val(win(page, dsel, 'margin-left')) === 'auto');
  const txt = { tag: 'input', classes: ['cc-set-txt'], attrs: { type: 'text' }, inside: ['#cc-settings'], html: ['cc-popups-on'] };
  const tw = win(page, txt, 'width'), tf = win(page, txt, 'flex');
  ok('a one-line field has a width of its own, past Unraid\'s 100%', tf && tf.value === '0 1 280px' && tw.selector === '#cc-settings .cc-set-txt' && tw.value === 'auto', tw && tw.selector);
  ok('and stands at the end of its row', /auto$/.test(val(win(page, txt, 'margin'))));
  ok('it is filled like the dropdowns, with no line around it', /--cc-surface-chip/.test(val(win(page, txt, 'background'))) && val(win(page, txt, 'border')) === 'none');
  ok('its type sits on the scale, not on Unraid\'s 1.3rem', val(win(page, txt, 'font-size')) === 'var(--cc-text-subline)');
  ok('focus is a lighter fill rather than a coloured line', /--cc-surface-chip/.test(val(win(page, Object.assign({}, txt, { states: { focus: true } }), 'background'))));
  const drop = grabFn(settings, 'dropRow');
  ok('a dropdown row puts the name first and the dropdown after it', /row\.appendChild\(rl\);[\s\S]*row\.appendChild\(ccDsel\(sel\)\)/.test(drop));
  for (const id of ['cc-set-webhook', 'cc-set-iface']) {
    const at = settings.indexOf('id = "' + id + '"');
    const around = settings.slice(settings.lastIndexOf('el("div", "cc-set-row")', at), settings.indexOf('\n', settings.indexOf('Child(', at + 200)));
    ok(id + ' stands in the same row as its name', /el\("span", "cc-set-rl", T\(/.test(around), around.slice(0, 80));
  }
}

console.log('\nA window\'s actions stand at the end of its foot');
{
  const every = withUnraid('every');
  const act = { tag: 'div', classes: ['cc-win-act'], inside: ['.cc-win'] };
  ok('the foot aligns its buttons to the end', val(win(every, act, 'justify-content')) === 'flex-end');
  const btn = { tag: 'span', classes: ['cc-win-btn'], inside: ['.cc-win', '.cc-win-act'] };
  ok('a button keeps its own width instead of filling the row', val(win(every, btn, 'flex')) === '0 0 auto' && val(win(every, btn, 'min-width')) === '96px');
  const docker = withUnraid('docker');
  const pact = { tag: 'div', classes: ['cc-pop-row', 'cc-pop-act'], inside: ['.cc-pop'] };
  ok('the editor windows\' button row does the same', val(win(docker, pact, 'justify-content')) === 'flex-end');
  const pbtn = { tag: 'span', classes: ['cc-btn'], inside: ['.cc-pop', '.cc-pop-act'], outside: ['.cc-menu-plain', '.cc-card-actions', '.cc-search'] };
  ok('and its buttons keep their own width', val(win(docker, pbtn, 'flex')) === '0 0 auto', val(win(docker, pbtn, 'flex')));
  const ask = grabFn(fs.readFileSync(path.join(DIR, 'scripts/cc-theme.js'), 'utf8'), 'ask');
  ok('Close or Cancel comes first and the answer last', /act\.appendChild\(no\); act\.appendChild\(yes\);/.test(ask));
}

console.log('\nA grid of cards stands on the page');
{
  const page = withUnraid('docker');
  const group = { tag: 'div', classes: ['cc-folder-group'], outside: ['.cc-folder-group'] };
  ok('a folder group draws no card of its own', !candidates(page, group, 'background').length && !candidates(page, group, 'background-color').length);
  ok('and no card padding around its cards', !candidates(page, group, 'padding').length);
  const head = { tag: 'div', classes: ['cc-folder-group-head'] };
  ok('its head still names it on a shade', /--cc-bg3/.test(val(win(page, head, 'background'))));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
