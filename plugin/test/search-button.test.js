// A search on a page starts as a Search button and turns into the field when pressed (GlimStone,
// "Every other search"). Escape empties the field and then turns it back, before the gear menu
// around it closes, and leaving an empty field turns it back too. A field that holds text stays a
// field, so a forgotten filter cannot hide behind the button. The field itself is filled and has
// no line around it.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const docker = read('scripts/docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

let active = null;
class N {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.childNodes = []; this.cls = new Set(); this.listeners = {}; this.innerHTML = ''; this.value = ''; this.textContent = ''; }
  get classList() { const c = this.cls; return { add: (x) => c.add(x), contains: (x) => c.has(x), toggle: (x, f) => { const w = f === undefined ? !c.has(x) : !!f; w ? c.add(x) : c.delete(x); return w; } }; }
  set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(c) { this.childNodes.push(c); return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(type, init) { const ev = Object.assign({ type, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } }, init || {}); (this.listeners[type] || []).forEach((fn) => fn(ev)); return ev; }
  focus() { active = this; }
}
const el = (tag, cls, txt) => { const n = new N(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const t = (k) => ({ search: 'Suche' })[k];
const searchToggle = new Function('el', 't', 'ccGlyph', grabFn(docker, 'searchToggle') + '\nreturn searchToggle;')(el, t, () => '<svg></svg>');

console.log('\nThe gear menu\'s filter starts as a button');
{
  const field = el('input', 'cc-filter');
  let cleared = 0;
  const wrap = searchToggle(field, () => { cleared++; });
  const btn = wrap.childNodes[0];
  ok('a Search button and the field share one place', wrap.cls.has('cc-search') && btn.cls.has('cc-search-btn') && wrap.childNodes[1] === field);
  ok('the button is named "Suche" and carries the search glyph', btn.childNodes[0].textContent === 'Suche' && /<svg/.test(btn.innerHTML));
  ok('with no filter set it shows the button', !wrap.cls.has('cc-search-open'));
  btn.fire('click');
  ok('a press turns it into the field with the caret in it', wrap.cls.has('cc-search-open') && active === field);
  field.value = 'plex';
  let ev = field.fire('keydown', { key: 'Escape' });
  ok('Escape empties a field that holds text and keeps it open', field.value === '' && cleared === 1 && wrap.cls.has('cc-search-open'));
  ok('and the menu around it stays', ev.stopped && ev.prevented);
  ev = field.fire('keydown', { key: 'Escape' });
  ok('Escape on the empty field turns it back into the button', !wrap.cls.has('cc-search-open') && active === btn && ev.stopped);
  btn.fire('click');
  field.fire('blur');
  ok('leaving the empty field turns it back too', !wrap.cls.has('cc-search-open'));
  btn.fire('click'); field.value = 'arr'; field.fire('blur');
  ok('a field that holds text stays a field', wrap.cls.has('cc-search-open'));
  const kept = el('input', 'cc-filter'); kept.value = 'db';
  ok('a menu opened with a filter set shows the field at once', searchToggle(kept, () => {}).cls.has('cc-search-open'));
}

console.log('\nThe menu wires it');
{
  const menu = grabFn(docker, 'buildMenu');
  ok('the filter goes behind the button', /frow\.appendChild\(searchToggle\(filter, function \(\) \{ filterText = ""; applyFilter\(\); \}\)\)/.test(menu));
  ok('the field is named for a screen reader', /filter\.setAttribute\("aria-label", t\("search"\)\)/.test(menu));
  ok('German and English name the button', /filter: "filtern…", search: "Suche"/.test(docker) && /filter: "filter…", search: "Search"/.test(docker));
  ok('the search glyph is in the set', /"Search": \["-0\.001 0 13\.988 13\.988"/.test(read('scripts/cc-theme.js')));
}

console.log('\nThe sheet');
{
  const page = withUnraid('docker');
  const win = (e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
  const field = { tag: 'input', classes: ['cc-filter'], attrs: { type: 'text' }, inside: ['.cc-menu', '.cc-search'], html: ['cc-docker-on'] };
  ok('the closed field is hidden', win(Object.assign({}, field, { outside: ['.cc-search-open'] }), 'display').value === 'none');
  ok('the open one shows', win(Object.assign({}, field, { inside: ['.cc-menu', '.cc-search', '.cc-search-open'] }), 'display').value === 'block');
  const bg = win(field, 'background');
  ok('it is filled, past Unraid\'s transparent input', bg && /--cc-surface-3/.test(bg.value) && bg.selector === 'html .cc-menu .cc-filter', bg && bg.selector);
  const border = candidates(page, field, 'border').pop();
  ok('and has no line around it', border && border.value === 'none' && border.selector === 'html .cc-menu .cc-filter');
  const focus = win(Object.assign({}, field, { states: { focus: true } }), 'background-color');
  ok('focus is a lighter fill, never Unraid\'s white', focus && focus.value === '#383838', focus && focus.value);
  const btn = { tag: 'button', classes: ['cc-btn', 'cc-search-btn'], attrs: { type: 'button' }, inside: ['.cc-menu', '.cc-search', '.cc-search-open'], html: ['cc-docker-on'] };
  ok('the button steps aside once the field is open', win(btn, 'display').value === 'none');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
