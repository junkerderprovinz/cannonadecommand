// Two things have to hold for a container icon to carry its Hintergrund colour on
// the Docker tab, whether the colour is the area's own or comes from the global
// "Badge-Einstellungen übernehmen" toggle.
//
// The class gate has to account for that master toggle. The Settings page says
// turning it on carries Hintergrund with it, so the three sites that put
// .cc-docker-iconbg on the native table, the classic Grid and the Folder view go
// through one shared iconBgOn() helper rather than each testing the per-area
// toggle on its own, where the class never reaches the DOM with adopt on alone.
//
// And .cc-card-ico needs the unconditional base rule the table row has. With only
// the rainbow-gated rule, a plain accent and reactive mode off leave the icon on
// its grey default, in the classic Grid and in every folder density, all of which
// build through card(), folderChip() or folderListRow().
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const DOCKER = process.argv[2] || path.join(DIR, 'scripts', 'docker.js');
const CSS = process.argv[3] || path.join(DIR, 'styles', 'docker.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(DOCKER, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

const api = new Function('localStorage',
  grabFn('effc') + '\n' + grabFn('iconBgAdopts') + '\n' + grabFn('iconBgOn') + '\n' +
  'return { effc: effc, iconBgAdopts: iconBgAdopts, iconBgOn: iconBgOn };'
)(localStorage);

console.log('\niconBgOn(): the shared gate, effc("iconbg")==="1" || iconBgAdopts()');
{
  reset();
  ok('both off: iconBgOn() is false', api.iconBgOn() === false);

  reset(); localStorage.setItem('cc.iconbg', '1');
  ok('the per-area toggle on, adopt off: true', api.iconBgOn() === true);

  reset(); localStorage.setItem('cc.iconbgrainbow', '1');
  ok('adopt on, the per-area toggle never set: true', api.iconBgOn() === true);
  ok('...where the per-area check on its own would say false', api.effc('iconbg') !== '1');

  reset(); localStorage.setItem('cc.iconbgrainbow', '1'); localStorage.setItem('cc.iconbg', '0');
  ok('adopt on with the per-area toggle off: true, as the Settings page says', api.iconBgOn() === true);

  reset(); localStorage.setItem('cc.styledocker', '0'); localStorage.setItem('ccd.iconbg', '1');
  ok('with Docker on its own style, the ccd. prefix reaches iconBgOn()', api.iconBgOn() === true);
}

console.log('\nAll three .cc-docker-iconbg call sites go through the shared helper');
{
  // renderGrid() and renderFolderView() write an identical line, so counting the
  // occurrences is what shows both of them, and not one alone, were changed.
  const matches = src.match(/classList\.toggle\("cc-docker-iconbg",\s*iconBgOn\(\)\)/g) || [];
  ok('three call sites gate on iconBgOn(): the table, the classic Grid and the Folder view', matches.length === 3, String(matches.length));
  ok('no call site inlines the check that ignores adopt', !/classList\.toggle\("cc-docker-iconbg",\s*effc\("iconbg"\)\s*===\s*"1"\)/.test(src));
}

console.log('\n.cc-card-ico carries an unconditional base Hintergrund rule, not only the rainbow one');
{
  const base = css.match(/\.cc-grid-holder\.cc-docker-iconbg \.cc-card-ico\s*\{([^}]*)\}/);
  ok('the base rule exists, gated on .cc-docker-iconbg alone', !!base);
  const baseBody = base ? base[1] : '';
  ok('the base rule uses the --cc-iconbg-color to --cc-accent chain', /--cc-iconbg-color/.test(baseBody) && /--cc-accent/.test(baseBody));
  ok('the base rule is !important, to beat the grey default on the same selector', /!important/.test(baseBody));
  ok('the base rule leaves --cc-rb-c to the rainbow rule', !/--cc-rb-c/.test(baseBody));

  const rainbow = css.match(/\.cc-grid-holder\.cc-docker-iconbg\.cc-rainbow \.cc-card-ico\s*\{([^}]*)\}/);
  ok('the rainbow-gated rule is still there', !!rainbow);
  const rbBody = rainbow ? rainbow[1] : '';
  ok('the rainbow rule keeps --cc-rb-c ahead of --cc-accent', /--cc-iconbg-color.*--cc-rb-c.*--cc-accent/.test(rbBody.replace(/\s+/g, ' ')));

  // The base rule comes first so that the rainbow selector also wins on source
  // order, as the table row's own base and refinement pair does.
  ok('the base rule is declared before the rainbow rule', css.indexOf(base[0]) < css.indexOf(rainbow[0]));

  // Reactive mode's rest and hover pair is more specific again and stays as it is.
  ok('the reactive rest rule, the neutral grey, is unchanged', /html\.cc-shares-rbneutral\.cc-docker-on \.cc-grid-holder\.cc-docker-iconbg \.cc-card-ico\s*\{\s*background:\s*rgba\(128, 128, 128, \.18\)\s*!important;\s*\}/.test(css));
  ok('the reactive hover rule, the real colour, is unchanged', /html\.cc-shares-rbneutral\.cc-docker-on \.cc-grid-holder\.cc-docker-iconbg \.cc-card:hover \.cc-card-ico/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
