// The global badge colour is a default with exceptions, as GlimStone's "Defaults and exceptions"
// asks: one card on General says every area follows it and lists only the areas set apart, each
// with a way back, and each area's own tab carries the exception as a switch. The keys keep their
// meaning, an adopt key of "0" being an area with a colour of its own.
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
const between = (a, b) => settings.slice(settings.indexOf(a), settings.indexOf(b, settings.indexOf(a)));
const PREF = between('var ADOPT_PREF = ', ';\n') + ';';
const AREAS = between('var EXC_AREAS = [', '];') + '];';

function store(init) {
  const m = Object.assign({}, init);
  return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
}
class Node {
  constructor(tag, cls, txt) { this.tag = tag; this.cls = cls || ''; this.txt = txt == null ? '' : String(txt); this.children = []; this.style = {}; this.parentNode = null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); }
  querySelectorAll(sel) { const want = sel.replace(/^\./, ''); return this.children.filter((c) => c.cls.split(' ').includes(want)); }
  text() { return this.txt + this.children.map((c) => c.text()).join(' '); }
}

// paintExceptions with its card, against a given store and set of enabled areas.
function paint(init, enabled) {
  const ls = store(init); const picks = []; const backs = [];
  const SECS = ['header', 'main', 'shares', 'docker', 'plugins', 'vms', 'settings', 'tools', 'favorites'].map((id) => ({ id, key: 'cc.enable.' + id }));
  const cExc = new Node('div', 'cc-set-card');
  const env = {
    localStorage: ls, SECS, cExc,
    T: (d, e) => e,
    el: (t, c, x) => new Node(t, c, x),
    get: (k, d) => { const v = ls.getItem(k); return v == null ? d : v; },
    areaOn: (key) => enabled.includes(key.replace('cc.enable.', '')),
    infoIcon: () => new Node('span', 'cc-info'),
    actionBtn: (txt, cls, run) => { const b = new Node('span', cls, txt); b.run = run; return b; },
    areaPicker: (label, items, onPick) => { const p = new Node('span', 'cc-dsel', label); p.items = items; p.onPick = onPick; return p; },
    setOwnColour: (k, own) => backs.push([k, own]),
    render: () => {}, paintSelects: () => {}
  };
  new Function('env', 'with (env) { ' + PREF + '\n' + AREAS + '\n' + grabFn(settings, 'paintExceptions') + '\npaintExceptions(); }')(env);
  return { rows: cExc.children, backs, ls };
}

console.log('\nThe General card shows the default once and only the exceptions');
{
  const all = ['header', 'main', 'shares', 'docker', 'plugins', 'vms', 'settings', 'favorites'];
  const none = paint({}, all);
  ok('with no exception it says every area follows', /^Every area follows the global badge colour/.test(none.rows[0].text()));
  ok('and it lists no area', none.rows.length === 2, none.rows.map((r) => r.text()).join(' | '));
  const picker = none.rows[1].children.find((c) => c.cls === 'cc-dsel');
  ok('the second row adds an exception from every area that follows', picker && picker.items.length === 8);
  const one = paint({ 'cc.styledocker': '0', 'ccd.accent': '#1d99f3' }, all);
  ok('with one exception the lead says so', /except these/.test(one.rows[0].text()));
  ok('the Docker tab is listed under it', one.rows.length === 3 && /Docker tab/.test(one.rows[1].text()));
  const dot = one.rows[1].children[0].children.find((c) => c.cls === 'cc-set-excdot');
  ok('its row shows its own colour', dot && dot.style.background === '#1d99f3');
  const back = one.rows[1] && one.rows[1].children.find((c) => c.run);
  if (back) back.run();
  ok('its button gives it back to the global colour', one.backs.length === 1 && one.backs[0][0] === 'cc.styledocker' && one.backs[0][1] === false);
  ok('the area set apart is no longer offered as a new exception', ((one.rows[2] && one.rows[2].children.find((c) => c.cls === 'cc-dsel')) || { items: [] }).items.every((a) => a[0] !== 'cc.styledocker'));
  const off = paint({ 'cc.stylevms': '0' }, all.filter((a) => a !== 'vms'));
  ok('a switched-off area is not listed', off.rows.length === 2 && !/VMs tab/.test(off.rows.map((r) => r.text()).join(' ')));
  const keys = ['cc.styleheader', 'cc.stylemain', 'cc.styleshares', 'cc.styledocker', 'cc.styleplugin', 'cc.stylevms', 'cc.stylesettings', 'cc.stylefavorites'];
  const full = paint(Object.fromEntries(keys.map((k) => [k, '0'])), all);
  ok('when every area has its own colour there is nothing left to add', full.rows.length === 9 && !full.rows.some((r) => r.children.some((c) => c.cls === 'cc-dsel')));
}

console.log('\nSetting an area apart and back');
{
  const ls = store({ 'cc.accent': '#fcc419' });
  const toggles = [{ on: false }, { on: false }].map((t) => Object.assign(t, { _setOn(v) { t.on = v; } }));
  let synced = 0, painted = 0;
  const env = {
    localStorage: ls, adoptToggles: { 'cc.stylesettings': toggles }, styleCardSync: { 'cc.stylesettings': () => synced++ },
    get: (k, d) => { const v = ls.getItem(k); return v == null ? d : v; }, set: (k, v) => ls.setItem(k, v),
    paintExceptions: () => painted++, syncHeaderBar: () => {}, syncSharesBar: () => {}
  };
  const setOwn = new Function('env', 'with (env) { ' + PREF + '\n' + grabFn(settings, 'setOwnColour') + '\nreturn setOwnColour; }')(env);
  setOwn('cc.stylesettings', true);
  ok('own colour writes "0" to the adopt key', ls.m['cc.stylesettings'] === '0');
  ok('it starts from the global accent', ls.m['ccs.accent'] === '#fcc419');
  ok('both switches on that key follow, Settings and Tools', toggles.every((t) => t.on));
  ok('the area card and the General card repaint', synced === 1 && painted === 1);
  ls.m['ccs.accent'] = '#ff8389';
  setOwn('cc.stylesettings', false);
  ok('going back writes "1"', ls.m['cc.stylesettings'] === '1' && toggles.every((t) => !t.on));
  setOwn('cc.stylesettings', true);
  ok('coming back again keeps the colour it had', ls.m['ccs.accent'] === '#ff8389');
}

console.log('\nEvery area tab carries the exception, never the nine adopt cards');
{
  ok('the adopt label is gone', !/Globale Badge-Farbe übernehmen|Adopt the global badge colour/.test(settings));
  ok('no Stil card carries the old adopt bubble', !/card\(T\("Stil", "Style"\), T\(/.test(settings));
  const rows = [...settings.matchAll(/exceptionRow\("(cc\.style\w+)"/g)].map((m) => m[1]);
  const want = ['cc.styledocker', 'cc.styleplugin', 'cc.stylevms', 'cc.styleheader', 'cc.styleshares', 'cc.stylesettings', 'cc.stylefavorites', 'cc.stylemain'];
  ok('every area key has its exception row', want.every((k) => rows.includes(k)), rows.join(' '));
  ok('Settings and Tools share theirs', rows.filter((k) => k === 'cc.stylesettings').length === 2);
  ok('the switch reads the key inverted', /toggle\(localStorage\.getItem\(key\) === "0", function \(v\) \{ setOwnColour\(key, v\); \}\)/.test(grabFn(settings, 'exceptionRow')));
  ok('a colour picked on an area card sets it apart', /setOwnColour\(adoptKey, true\)/.test(grabFn(settings, 'useOwn')));
  ok('the area picker has no select, so the wheel cannot add an exception', !/select/.test(grabFn(settings, 'areaPicker')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
