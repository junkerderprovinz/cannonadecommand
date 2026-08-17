// Regression test for the Display-Settings "Sprache/Language" dropdown flag feature in header.js.
// Loads the REAL ccLocaleFlag / ccLangLabel helpers and pins: the country-code -> flag-emoji
// arithmetic, the blank-locale default (English), and that ONLY the locale <select> gets a flag
// prefix — every other <select> on the site must render its label unchanged.
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
const code = ['ccLocaleFlag', 'ccLangLabel'].map(grabFn).join('\n');
const api = new Function(code + '\nreturn { ccLocaleFlag: ccLocaleFlag, ccLangLabel: ccLangLabel };')();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nFlag emoji is derived arithmetically from the locale\'s country suffix');
{
  ok('de_DE -> German flag', api.ccLocaleFlag('de_DE') === '🇩🇪', api.ccLocaleFlag('de_DE'));
  ok('fr_FR -> French flag', api.ccLocaleFlag('fr_FR') === '🇫🇷', api.ccLocaleFlag('fr_FR'));
  ok('pt_BR -> Brazil flag (country suffix wins over language)', api.ccLocaleFlag('pt_BR') === '🇧🇷', api.ccLocaleFlag('pt_BR'));
  ok('blank value (Unraid\'s default) -> UK flag', api.ccLocaleFlag('') === '🇬🇧', api.ccLocaleFlag(''));
  ok('malformed value with no valid country suffix -> UK flag fallback', api.ccLocaleFlag('not-a-locale') === '🇬🇧', api.ccLocaleFlag('not-a-locale'));
}

console.log('\nccLangLabel only touches the locale <select> — every other <select> is untouched');
{
  const localeSel = { name: 'locale' };
  const otherSel = { name: 'colview' };
  const deOpt = { value: 'de_DE', text: 'Deutsch (German)' };
  const plainOpt = { value: 'x', text: 'Some other option' };
  ok('locale select: label gets the flag prefixed', api.ccLangLabel(localeSel, deOpt) === '🇩🇪 Deutsch (German)', api.ccLangLabel(localeSel, deOpt));
  ok('non-locale select: label passes through unchanged', api.ccLangLabel(otherSel, plainOpt) === 'Some other option', api.ccLangLabel(otherSel, plainOpt));
}

console.log(fail ? '\nFAIL  ' + fail + ' of ' + (pass + fail) : '\nOK  ' + pass + ' passed');
process.exit(fail ? 1 : 0);
