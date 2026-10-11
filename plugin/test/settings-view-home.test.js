// Every setting has one home (GlimStone rule 29). The Docker list, grid or folder view lives in
// the Docker tab's gear menu, which writes cc.view and the organizer's saved view mode, so the
// settings page carries no second picker for it.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const settings = read('scripts/settings.js');
const docker = read('scripts/docker.js');

console.log('\nThe view has one home');
ok('the settings page has no view card', !/card\(T\("Ansicht", "View"\)/.test(settings) && !/Standard-Ansicht|Default view/.test(settings));
ok('the settings page never writes cc.view', !/"cc\.view"/.test(settings));
ok('nor the organizer view mode', !/ccViewMode/.test(settings));
ok('the gear menu offers the view', /m\.appendChild\(menuHead\(t\("view"\)\)\)/.test(docker) && /setMode\("list"\)/.test(docker) && /setMode\("grid"\)/.test(docker) && /setMode\("folder"\)/.test(docker));
ok('and saves it locally and on the server', /mode = m; localStorage\.setItem\(VIEW_KEY, m\);/.test(docker) && /ccOrgSavePrefs\(\{ ccViewMode: m \}\)/.test(docker));
const writers = fs.readdirSync(path.join(DIR, 'scripts')).filter((f) => f.endsWith('.js') && f !== 'docker.js' && /setItem\("cc\.view"/.test(read('scripts/' + f)));
ok('no other script writes the view', writers.length === 0, writers.join(' '));

// With no settings card, the gear has to be on screen in every view, or a user in the list
// view can never reach the grid, the folders or "New folder" again.
console.log('\nEvery view has a gear');
{
  const fn = (name) => { const i = docker.indexOf('function ' + name + '('); let d = 0; for (let k = docker.indexOf('{', i); k < docker.length; k++) { if (docker[k] === '{') d++; else if (docker[k] === '}') { d--; if (!d) return docker.slice(i, k + 1); } } return ''; };
  const top = fn('relocateTopBar');
  ok('list: the bar carries a gear in its right-pinned toggle group', /advGrp = jsa\.querySelector\("\.cc-bar-adv"\)/.test(top) && /advGrp\.appendChild\(makeGear\("cc-hgear-home"\)\)/.test(top));
  ok('list: the stale-gear sweep spares it', /if \(!x9\.closest\("\.cc-bar-adv"\)\) x9\.remove\(\)/.test(top));
  ok('card and folder: the bar gear goes, their own tile takes over', /if \(mode !== "list"\) \{ var barGear = document\.querySelector\("div\.js-actions \.cc-hgear-home"\); if \(barGear\) barGear\.remove\(\); return; \}/.test(top));
  ok('card view: a gear tile after the last card', /var gtile = el\("div", "cc-card cc-gear-tile"\); gtile\.appendChild\(hg\)/.test(fn('renderGrid')));
  ok('folder view: a gear of its own', /makeGear\("cc-hgear-grid"\)/.test(fn('renderFolderView')));
  ok('the bar gear has a look of its own in the bar', /div\.js-actions \.cc-bar-adv \.cc-hgear-home \{/.test(read('styles/docker.css')));

  // The bar is docked at the bottom of the window, so a menu hung below the gear would open off screen.
  const place = new Function('window', 'document', 'menu', 'menuAnchor', fn('positionMenu') + '\npositionMenu(); return menu.style;');
  const win = { scrollX: 0, scrollY: 0 }, doc = { documentElement: { clientWidth: 1600, clientHeight: 900 } };
  const at = (top, bottom) => ({ getBoundingClientRect: () => ({ top, bottom, right: 1500 }) });
  const m = () => ({ offsetWidth: 240, offsetHeight: 400, style: {} });
  ok('a gear at the bottom opens its menu upward', place(win, doc, m(), at(860, 884)).top === (860 - 6 - 400) + 'px');
  ok('a gear near the top still opens downward', place(win, doc, m(), at(100, 124)).top === '130px');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
