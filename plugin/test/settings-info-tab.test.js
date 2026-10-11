// The settings page ends in an Info tab with GlimStone's three cards in its order: Version, Help
// and About. Every version links to its own release page, the update check shows its verdict on
// its own button, and each version appears once: the footer line under the page and the version
// in the Docker gear menu are gone.
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
const docker = read('scripts/docker.js');
const css = read('styles/docker.css');
const consts = ['REPO', 'GLS_REPO', 'LATEST_API', 'GLS_VER'].map((n) => (new RegExp('  var ' + n + ' = [^;]+;').exec(settings) || [''])[0]).join('\n');

class Node {
  constructor(tag, cls, txt) { this.tag = tag; this.cls = new Set((cls || '').split(' ').filter(Boolean)); this.textContent = txt == null ? '' : String(txt); }
  get classList() { const c = this.cls; return { add: (...a) => a.forEach((x) => c.add(x)), remove: (...a) => a.forEach((x) => c.delete(x)), contains: (x) => c.has(x) }; }
}
const el = (t, c, x) => new Node(t, c, x);

console.log('\nThe last tab is Info, with three cards in GlimStone order');
{
  ok('Info is pushed after every area', /SECS\.push\(\{ id: "info", t: T\("Info", "Info"\), w: wrapInfo, key: null \}\);/.test(settings));
  ok('the Info tab has a glyph', /^\s+info: \["/m.test(settings));
  ok('its cards stand on the page', /root\.appendChild\(wrapInfo\);/.test(settings));
  const block = settings.slice(settings.indexOf('// The Info tab in GlimStone'), settings.indexOf('refreshTabs();', settings.indexOf('// The Info tab in GlimStone')));
  const order = [...block.matchAll(/card\(T\("([^"]+)", "([^"]+)"\)\)/g)].map((m) => m[2]);
  ok('Version, Help, About', order.join(',') === 'Version,Help,About', order.join(','));
  ok('the engine version comes from the state call', /api\("GET", "state"\)\.then\(function \(st\) \{/.test(block));
  ok('an unreachable engine says so', /T\("nicht erreichbar", "not reachable"\)/.test(block));
  for (const url of ['https://buymeacoffee.com/junkerderprovinz', 'https://www.paypal.com/donate/?hosted_button_id=76FVV52TKXTUS', 'https://junkerderprovinz.github.io/junkerderprovinz/', 'REPO + "/issues"', 'REPO + "/issues/new/choose"']) {
    ok('About and Help reach ' + url, block.includes(url));
  }
  const coffee = block.indexOf('buymeacoffee'), paypal = block.indexOf('paypal.com'), crypto = block.indexOf('github.io/junkerderprovinz');
  ok('the give row runs coffee, PayPal, crypto', coffee < paypal && paypal < crypto);
  ok('every outside link opens in a new tab without an opener', /a\.target = "_blank"; a\.rel = "noopener noreferrer";/.test(grabFn(settings, 'linkBtn')));
}

console.log('\nEvery version links to its release page');
{
  ok('GlimStone is 3.4.1', /var GLS_VER = "3\.4\.1";/.test(settings));
  const verLink = new Function('el', grabFn(settings, 'verLink') + '\nreturn verLink;')(el);
  const ui = verLink('1.2.3', 'https://github.com/junkerderprovinz/cannonadecommand');
  ok('a release number is a link', ui.tag === 'a' && ui.textContent === 'v1.2.3');
  ok('to its own tag', ui.href === 'https://github.com/junkerderprovinz/cannonadecommand/releases/tag/v1.2.3');
  ok('a leading v is not doubled', verLink('v0.9.0', 'R').href === 'R/releases/tag/v0.9.0');
  const dev = verLink('dev', 'R');
  ok('a dev build has no link', dev.tag === 'span' && dev.textContent === 'dev');
  ok('GlimStone links to its own repository', /verLink\(GLS_VER, GLS_REPO\)/.test(settings) && /var GLS_REPO = "https:\/\/github\.com\/junkerderprovinz\/glimstone";/.test(settings));
  const cmp = new Function(grabFn(settings, 'verCmp') + '\nreturn verCmp;')();
  ok('a newer patch is newer', cmp('1.0.1', '1.0.0') > 0);
  ok('the minor outranks the patch', cmp('1.1.0', '1.0.9') > 0 && cmp('1.0.9', '1.1.0') < 0);
  ok('the same version is not newer', cmp('v1.2.0', '1.2.0') === 0);
  ok('any release is newer than a dev build', cmp('0.9.0', 'dev') > 0);
}

console.log('\nThe update check shows its verdict on the button');
(async () => {
  const run = async (answer) => {
    const fails = [];
    const btn = el('span', 'cc-btn cc-set-check');
    const fetch = () => answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    const check = new Function('fetch', 'T', 'failed', 'CC_VER', consts + '\n' + grabFn(settings, 'verCmp') + '\n' + grabFn(settings, 'checkUpdates') + '\nreturn checkUpdates;')(
      fetch, (d, e) => e, (c, m) => fails.push([c, m]), '1.0.0');
    await check(btn);
    return { btn, fails };
  };
  const json = (o) => ({ ok: true, json: () => Promise.resolve(o) });
  const cur = await run(json({ tag_name: 'v1.0.0' }));
  ok('the latest release turns it green', cur.btn.classList.contains('cc-set-chk-ok') && cur.btn.textContent === 'Up to date');
  const newer = await run(json({ tag_name: 'v1.1.0' }));
  ok('a newer release turns it orange with the number', newer.btn.classList.contains('cc-set-chk-new') && newer.btn.textContent === 'v1.1.0 available');
  ok('and leaves green behind', !newer.btn.classList.contains('cc-set-chk-ok'));
  const down = await run({ ok: false, status: 403, json: () => Promise.resolve({}) });
  ok('a failed check turns it red', down.btn.classList.contains('cc-set-chk-bad') && down.btn.textContent === 'Check failed');
  ok('and shakes it with the reason in a toast', down.fails.length === 1 && down.fails[0][0] === down.btn && /HTTP 403/.test(down.fails[0][1]));
  const off = await run(new Error('offline'));
  ok('a network error is a failure too', off.btn.classList.contains('cc-set-chk-bad') && off.fails.length === 1);
  ok('it asks the latest release of this repository', /var LATEST_API = "https:\/\/api\.github\.com\/repos\/junkerderprovinz\/cannonadecommand\/releases\/latest";/.test(settings));
  for (const [cls, tok] of [['ok', 'ok'], ['new', 'warn'], ['bad', 'err']]) {
    ok('the ' + cls + ' verdict takes the ' + tok + ' state colour and its ink', new RegExp('#cc-settings \\.cc-set-check\\.cc-set-chk-' + cls + ' \\{ background: var\\(--cc-' + tok + ', [^)]+\\); color: var\\(--cc-' + tok + '-fg').test(css));
  }

  console.log('\nEach version appears once');
  ok('the footer line is gone', !/verLine|cc-set-version-foot/.test(settings) && !/\.cc-set-version\b/.test(css));
  ok('the gear menu shows no version', !/CC_VER|UI v|daemonVersion/.test(docker));
  ok('the gear menu keeps the engine status', /"engine up · " \+ containers\.length/.test(docker) && /"engine down, daemon not reachable"/.test(docker));

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
