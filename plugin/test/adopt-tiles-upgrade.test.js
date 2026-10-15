// An install that adopts the badge colours gets the logo tile and icon tint switches turned on
// once, in the browser (cc-theme.js) and in the engine's mirror (store.LoadConfig), so its logos
// look the same after the upgrade. A marker makes it run once, and a switch turned off later
// stays off.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const theme = fs.readFileSync(path.join(DIR, 'scripts/cc-theme.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const step = new Function(grabFn(theme, 'keepAdoptedTiles') + '; return keepAdoptedTiles;')();
function store(init) {
  const s = Object.assign({}, init), writes = [];
  return { s, writes, getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); writes.push(k); } };
}

console.log('\nAn install that adopted keeps its tiles and its tint');
{
  const ls = store({ 'cc.iconbgrainbow': '1', 'cc.iconbg': '0', 'cc.icontint': '0', 'cc.styledocker': '0', 'ccd.iconbg': '0', 'cc.stylevms': '1', 'ccv.iconbg': '0', 'cc.styleplugin': '0' });
  step(ls);
  ok('both global switches go on', ls.s['cc.iconbg'] === '1' && ls.s['cc.icontint'] === '1');
  ok('an area with colours of its own gets them too', ls.s['ccd.iconbg'] === '1' && ls.s['ccd.icontint'] === '1' && ls.s['ccp.iconbg'] === '1' && ls.s['ccp.icontint'] === '1');
  ok('an area that follows the global keys keeps its own as they were', ls.s['ccv.iconbg'] === '0' && !('ccv.icontint' in ls.s));
  ok('the step is marked done', ls.s['cc.iconadoptsplit'] === '1');
  ls.s['cc.iconbg'] = '0'; ls.writes.length = 0;
  step(ls);
  ok('a second run writes nothing, so a switch turned off since stays off', ls.writes.length === 0 && ls.s['cc.iconbg'] === '0');
}

console.log('\nEvery other install is left as it is');
{
  const off = store({ 'cc.iconbgrainbow': '0', 'cc.iconbg': '0' });
  step(off);
  ok('adopting off: the switches stay, the step is marked done', off.s['cc.iconbg'] === '0' && !('cc.icontint' in off.s) && off.s['cc.iconadoptsplit'] === '1');
  const fresh = store({});
  step(fresh);
  ok('a fresh install gets no key at all', fresh.writes.length === 0);
  ok('it runs on every page, after the Tools split', /try \{ splitToolsKeys\(localStorage\); \} catch \(e\) \{\}\s*\/\/[\s\S]*?try \{ keepAdoptedTiles\(localStorage\); \} catch \(e\) \{\}/.test(theme));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
