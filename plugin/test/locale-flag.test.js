// Regression test for the Display-Settings "Sprache/Language" dropdown flag feature in header.js.
// Loads the REAL ccLocaleCountry / ccLangLabel helpers and pins: the explicit locale -> ISO-country
// map (including the packs whose Unraid locale code is NOT a real country code), the blank-locale
// default (English), and that ONLY the locale <select> gets its parenthetical stripped — every other
// <select> on the site must render its label unchanged.
//
// #92: the flag itself moved from a Unicode regional-indicator emoji pair (which Windows renders as
// two separate letter glyphs, not a ligated flag — confirmed via a user screenshot) to a real bundled
// SVG (images/flags/<iso>.svg, written by ccLangFlagImg as an <img>, not tested here since it's pure
// DOM wiring) — ccLocaleCountry only needs to resolve the right ISO code, which is what these pin.
const fs = require('fs');
const path = require('path');
const HEADER = process.argv[2] || path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local',
  'emhttp', 'plugins', 'cannonadecommand', 'scripts', 'header.js');

const src = fs.readFileSync(HEADER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in header.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(name) {
  const i = src.indexOf('var ' + name + ' = {');
  if (i < 0) throw new Error('var not found in header.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1) + ';'; } }
  throw new Error('unbalanced var: ' + name);
}
const code = [grabVar('CC_LOCALE_COUNTRY'), grabFn('ccLocaleCountry'), grabFn('ccLangLabel')].join('\n');
const api = new Function(code + '\nreturn { ccLocaleCountry: ccLocaleCountry, ccLangLabel: ccLangLabel };')();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nccLocaleCountry: straightforward packs whose Unraid locale code IS a real ISO country code');
{
  ok('de_DE -> de (Germany)', api.ccLocaleCountry('de_DE') === 'de', api.ccLocaleCountry('de_DE'));
  ok('fr_FR -> fr (France)', api.ccLocaleCountry('fr_FR') === 'fr', api.ccLocaleCountry('fr_FR'));
  ok('pt_BR -> br (Brazil, country suffix wins over the pt_PT/Portugal entry)', api.ccLocaleCountry('pt_BR') === 'br', api.ccLocaleCountry('pt_BR'));
  ok('pt_PT -> pt (Portugal)', api.ccLocaleCountry('pt_PT') === 'pt', api.ccLocaleCountry('pt_PT'));
  ok('blank value (Unraid\'s default) -> gb (English/UK)', api.ccLocaleCountry('') === 'gb', api.ccLocaleCountry(''));
}

console.log('\nccLocaleCountry: packs whose Unraid locale code duplicates the LANGUAGE code, not a real country — the explicit map fixes both the "no real territory" and the "real but wrong territory" cases');
{
  ok('da_DA -> dk (Denmark — "DA" alone is not a real ISO territory)', api.ccLocaleCountry('da_DA') === 'dk', api.ccLocaleCountry('da_DA'));
  ok('ja_JA -> jp (Japan — "JA" alone is not a real ISO territory)', api.ccLocaleCountry('ja_JA') === 'jp', api.ccLocaleCountry('ja_JA'));
  ok('ko_KO -> kr (South Korea — "KO" alone is not a real ISO territory)', api.ccLocaleCountry('ko_KO') === 'kr', api.ccLocaleCountry('ko_KO'));
  ok('ar_AR -> sa (not ar -> Argentina, which the naive suffix heuristic would have picked)', api.ccLocaleCountry('ar_AR') === 'sa', api.ccLocaleCountry('ar_AR'));
  ok('bn_BN -> bd (not bn -> Brunei, which the naive suffix heuristic would have picked)', api.ccLocaleCountry('bn_BN') === 'bd', api.ccLocaleCountry('bn_BN'));
}

console.log('\nccLocaleCountry: a value not in the explicit map falls back to the country-suffix heuristic');
{
  ok('unlisted "xx_NL" falls back to its own suffix (nl)', api.ccLocaleCountry('xx_NL') === 'nl', api.ccLocaleCountry('xx_NL'));
  ok('malformed value with no suffix at all falls back to gb', api.ccLocaleCountry('not-a-locale') === 'gb', api.ccLocaleCountry('not-a-locale'));
}

console.log('\nccLangLabel only touches the locale <select> — every other <select> is untouched');
{
  const localeSel = { name: 'locale' };
  const otherSel = { name: 'colview' };
  const deOpt = { value: 'de_DE', text: 'Deutsch (German)' };
  const plainOpt = { value: 'x', text: 'Some other option' };
  // #83 (user: "Bei deutsch steht der text in der klammer noch da"): strips a trailing "(...)" from
  // the NATIVE option text too, not just CC's own "available" entries.
  // #92: no more emoji prefix here at all — the flag is a separate <img> ccLangFlagImg inserts.
  ok('locale select: trailing parenthetical stripped, no emoji prefix', api.ccLangLabel(localeSel, deOpt) === 'Deutsch', api.ccLangLabel(localeSel, deOpt));
  ok('non-locale select: label passes through unchanged, parenthetical untouched', api.ccLangLabel(otherSel, plainOpt) === 'Some other option', api.ccLangLabel(otherSel, plainOpt));
}

console.log(fail ? '\nFAIL  ' + fail + ' of ' + (pass + fail) : '\nOK  ' + pass + ' passed');
process.exit(fail ? 1 : 0);
