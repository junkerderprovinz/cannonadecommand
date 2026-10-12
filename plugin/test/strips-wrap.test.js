// A strip that runs out of room wraps; it never scrolls or slides one part under another
// (GlimStone). At 1600px the menu's tabs ran on under the icon group and the Docker action bar
// scrolled, its pinned view switch covering "Containergröße" with "Mehrfachauswahl" off screen.
const { candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const win = (page, el, prop) => { const c = candidates(page, el, prop); return c.length ? c[c.length - 1] : null; };
const val = (w) => (w ? w.value : '(none)');

console.log('\nThe menu bar');
{
  const html = ['cc-header-on', 'Theme--black'];
  const menu = { tag: 'div', classes: [], attrs: {}, states: {}, html, id: 'menu' };
  ok('the menu is a wrapping flex row, not Unraid\'s two-column grid', val(win('every', menu, 'display')) === 'flex' && val(win('every', menu, 'flex-wrap')) === 'wrap', val(win('every', menu, 'display')));
  const tabs = { tag: 'div', classes: ['nav-tile'], attrs: {}, states: {}, html, inside: ['#menu'] };
  ok('the tab row wraps its tabs', val(win('every', tabs, 'flex-wrap')) === 'wrap');
  ok('and never scrolls them', !/auto|scroll/.test(val(win('every', tabs, 'overflow'))) && !/auto|scroll/.test(val(win('every', tabs, 'overflow-x'))), val(win('every', tabs, 'overflow-x')));
  ok('it takes the room it needs, up to the full width', val(win('every', tabs, 'flex')) === '1 0 auto' && val(win('every', tabs, 'max-width')) === '100%');
  ok('it grows with its rows instead of keeping Unraid\'s one-row height', val(win('every', tabs, 'height')) === 'auto');
  const icons = { tag: 'div', classes: ['nav-tile', 'right'], attrs: {}, states: {}, html, inside: ['#menu'] };
  ok('the icon group keeps its size and moves to the right of its own line', val(win('every', icons, 'flex')) === '0 0 auto' && val(win('every', icons, 'margin-left')) === 'auto');
  ok('under the sidebar theme the menu is left alone', win('every', Object.assign({}, menu, { html: ['cc-header-on', 'Theme--sidebar'] }), 'display') === null);
}

console.log('\nThe Docker action bar');
{
  const bar = { tag: 'div', classes: ['js-actions'], attrs: {}, states: {}, html: ['cc-docker-on'] };
  ok('it wraps its buttons onto a second row', val(win('docker', bar, 'flex-wrap')) === 'wrap');
  ok('and never scrolls', val(win('docker', bar, 'overflow')) === 'visible' && win('docker', bar, 'overflow-x') === null, val(win('docker', bar, 'overflow-x')));
  const adv = { tag: 'span', classes: ['cc-bar-adv'], attrs: {}, states: {}, html: ['cc-docker-on'], inside: ['.js-actions'] };
  ok('the view switch is pinned right on whichever row it lands', val(win('docker', adv, 'margin-left')) === 'auto');
  ok('and no longer sticks over the buttons', win('docker', adv, 'position') === null, val(win('docker', adv, 'position')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
