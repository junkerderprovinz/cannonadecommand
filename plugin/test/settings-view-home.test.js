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

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
