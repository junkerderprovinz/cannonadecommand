// The settings tab strip follows GlimStone's one horizontal selector: every tab carries a filled
// glyph, every tab has one width, and the strip wraps instead of scrolling, sharing its rows
// evenly. Its colours follow the tab-strip colour rule: the idle glyph shows the tab's colour, the
// chosen tab is filled with it, and reactive mode rests the idle glyphs until hover or focus.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of clean(css)) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const sel = stack.pop(); if (sel !== undefined && !sel.startsWith('@')) out.push({ sel, body: buf.trim() }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const body = (all, sel) => (all.find((r) => r.sel.split(/,\s*(?![^(]*\))/).includes(sel)) || {}).body || '';
const decl = (b, prop) => { const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(b); return m ? m[1].trim() : null; };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const settings = read('scripts/settings.js');
const css = rules(read('styles/docker.css'));

console.log('\nEvery tab has a glyph, and every glyph is filled');
{
  const table = settings.slice(settings.indexOf('var TAB_GLYPHS = {'), settings.indexOf('\n  };', settings.indexOf('var TAB_GLYPHS = {')));
  const glyphs = {};
  for (const m of table.matchAll(/^\s+(\w+): \["([^"]+)", '([^']+)'\]/gm)) glyphs[m[1]] = { vb: m[2], svg: m[3] };
  const ids = [...settings.matchAll(/\{ id: "(\w+)", t: T\(/g)].map((m) => m[1]);
  ok('the strip has its sections', ids.length >= 10, ids.join(' '));
  const missing = ids.filter((id) => !glyphs[id]);
  ok('every section id has a glyph', missing.length === 0, missing.join(' '));
  const stroked = Object.keys(glyphs).filter((k) => /stroke=|fill="none"/.test(glyphs[k].svg));
  ok('no glyph is a stroked outline', stroked.length === 0, stroked.join(' '));
  ok('every glyph names a four-number viewBox', Object.values(glyphs).every((g) => g.vb.split(' ').length === 4));
  ok('each tab is built with its glyph and its label', /b\.appendChild\(tabGlyph\(sc\.id\)\); b\.appendChild\(el\("span", null, sc\.t\)\);/.test(settings));
  ok('the glyph inks on currentColor and hides from screen readers', /svg\.setAttribute\("aria-hidden", "true"\);/.test(grabFn(settings, 'tabGlyph')) && /"fill", "currentColor"/.test(grabFn(settings, 'tabGlyph')));
}

console.log('\nOne width, and a strip that wraps into even rows');
{
  const perRow = new Function(grabFn(settings, 'tabsPerRow') + '\nreturn tabsPerRow;')();
  ok('tabs that fit stay on one row', perRow(5, 150, 6, 1200) === 5);
  ok('eleven tabs that fit seven to a row go six and five', perRow(11, 150, 6, 1200) === 6);
  ok('seven that fit four go four and three', perRow(7, 100, 6, 4 * 106 - 6) === 4);
  ok('six that fit four go three and three', perRow(6, 100, 6, 4 * 106 - 6) === 3);
  ok('a box narrower than one tab still gives one per row', perRow(4, 300, 6, 200) === 1);
  const size = grabFn(settings, 'sizeSetTabs');
  ok('every shown tab is pinned to the widest one', /b\.style\.minWidth = w \+ "px"/.test(size) && /var bw = Math\.ceil\(b\.getBoundingClientRect\(\)\.width\); w = Math\.max\(w, bw\);/.test(size));
  // The tabs at their measured widths, in a strip of a given room.
  const run = (widths, room) => {
    const style = () => { const s = { removeProperty(k) { delete s[k === 'min-width' ? 'minWidth' : k === 'flex-wrap' ? 'flexWrap' : k]; } }; return s; };
    const tabBtns = widths.map((wd) => ({ style: style(), getBoundingClientRect: () => ({ width: wd }) }));
    const tabRow = { style: style() };
    const root = { clientWidth: room };
    new Function('tabBtns', 'tabRow', 'root', 'getComputedStyle', 'TAB_GAP', grabFn(settings, 'tabsPerRow') + grabFn(settings, 'sizeSetTabs') + '; sizeSetTabs();')(tabBtns, tabRow, root, () => ({ paddingLeft: '0', paddingRight: '0' }), 6);
    return { row: tabRow.style, tabs: tabBtns.map((b) => b.style) };
  };
  // Eleven tabs at widths the compact padding gives them, 1109px with the gaps.
  const eleven = [104, 117, 75, 104, 87, 92, 70, 126, 109, 104, 61];
  const fits = run(eleven, 1240);
  ok('at 1280px the eleven tabs stay on one row at their own widths', fits.row.flexWrap === 'nowrap' && fits.row.width === '100%' && fits.tabs.every((t) => t.flex === '1 0 auto' && !t.minWidth), JSON.stringify(fits.row));
  const wide = run(eleven, 1500);
  ok('with room for the widest width on every tab they are all one width', !wide.row.flexWrap && wide.tabs.every((t) => t.minWidth === '126px'));
  const narrow = run(eleven, 900);
  ok('below that the strip wraps into even rows at one width', !narrow.row.flexWrap && narrow.tabs.every((t) => t.minWidth === '126px' && /calc\(\(100% - 6 \* 6px\) \/ 6\)/.test(t.flex)), narrow.tabs[0].flex);
  const tab = body(css, '.cc-set-tab');
  ok('a tab is a compact pill', decl(tab, 'padding') === '0 12px !important' && decl(tab, 'gap') === '6px', decl(tab, 'padding'));
  ok('in the label\'s own case', decl(tab, 'text-transform') === 'none !important');
  const labels = [...settings.matchAll(/\{ id: "(\w+)", t: T\("([^"]+)", "([^"]+)"\)/g)].map((m) => m[2] + '|' + m[3]);
  ok('every tab carries the plain name of its Unraid tab', labels.every((l) => !/-Tab\b| tabs?\b/.test(l)), labels.join(' '));
  ok('the old pin is cleared before measuring', size.indexOf('removeProperty("min-width")') < size.indexOf('getBoundingClientRect'));
  ok('the sizing reruns when an area is switched off', /if \(activeHidden\) showSec\(0\);\s*sizeSetTabs\(\);/.test(settings));
  ok('and when the window resizes', /window\.__ccSetSizeTabs\(\); window\.__ccSetAlignSearch\(\);/.test(settings));
  const strip = body(css, '.cc-set-tabs');
  ok('the strip wraps', decl(strip, 'flex-wrap') === 'wrap', strip);
  ok('the strip never scrolls sideways', !/overflow/.test(strip));
  ok('the strip hugs its tabs', decl(strip, 'width') === 'fit-content' && decl(strip, 'max-width') === '100%');
  ok('the gap matches TAB_GAP', decl(strip, 'gap') === '6px' && /var TAB_GAP = 6;/.test(settings));
}

console.log('\nA tab shows only while its area is on');
{
  const off = (/  var OFF_BY_DEFAULT = [^;]+;/.exec(settings) || [''])[0];
  const areaOn = (store) => new Function('localStorage', off + '\n' + grabFn(settings, 'areaOn') + '\nreturn areaOn;')({ getItem: (k) => (k in store ? store[k] : null) });
  const fresh = areaOn({});
  ok('the start tab, the header and the shares are off until switched on', !fresh('cc.enable.main') && !fresh('cc.enable.header') && !fresh('cc.enable.shares'));
  ok('the other areas are on until switched off', fresh('cc.enable.docker') && fresh('cc.enable.plugins'));
  ok('General and Info have no switch and always show', fresh(null));
  const set = areaOn({ 'cc.enable.header': '1', 'cc.enable.docker': '0' });
  ok('a stored value wins either way', set('cc.enable.header') && !set('cc.enable.docker'));
  const defaults = [...settings.matchAll(/\["(cc\.enable\.\w+)", T\("[^"]+", "[^"]+"\), "0"\]/g)].map((m) => m[1]).sort().join(' ');
  ok('the areas card agrees on which start off', defaults === 'cc.enable.header cc.enable.main cc.enable.shares', defaults);
}

console.log('\nThe tab-strip colour rule');
{
  ok('an idle glyph carries the tab colour', /^var\(--cc-rb-c, var\(--cc-accent/.test(decl(body(css, '.cc-set-tabico'), 'color') || ''));
  ok('the chosen tab is filled with it', /^var\(--cc-rb-c, var\(--cc-accent/.test(decl(body(css, '.cc-set-tab-on'), 'background') || ''));
  ok('the chosen glyph takes the fill ink', decl(body(css, '.cc-set-tab-on .cc-set-tabico'), 'color') === 'inherit');
  ok('reactive rests an idle glyph', decl(body(css, '#cc-settings.cc-set-reactive .cc-set-tab:not(.cc-set-tab-on) .cc-set-tabico'), 'color') === 'inherit');
  ok('reactive shows it again on hover and focus', /^var\(--cc-rb-c/.test(decl(body(css, '#cc-settings.cc-set-reactive .cc-set-tab:not(.cc-set-tab-on):is(:hover, :focus-visible) .cc-set-tabico'), 'color') || ''));
  ok('an idle tab answers the pointer by a colour step', /color-mix/.test(decl(body(css, '.cc-set-tab:not(.cc-set-tab-on):hover'), 'background') || ''));
  const paint = grabFn(settings, 'paintSetTabs');
  ok('the painter only stamps vars, never an inline fill', !/"background"|"color"/.test(paint));
  ok('the painter takes positions from the shared rbColor, flag palette included', /window\.CCTheme\.rbColor/.test(paint));
  ok('the painter marks reactive mode on the root', /root\.classList\.toggle\("cc-set-reactive", get\("cc\.rbmode", "all"\) === "active"\)/.test(paint));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
