// The arrange lock in the header: exactly one lock on every page, and the lock stays a plain
// toggle while everything around it wiggles and drags.
const fs = require('fs');
const path = require('path');
const HEADER = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand', 'scripts', 'header.js');
const src = fs.readFileSync(process.argv[2] || HEADER, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const body = (name) => { const i = src.indexOf('function ' + name + '('); return i < 0 ? '' : src.slice(i, src.indexOf('\n  }\n', i)); };

console.log('\nOne lock per page');
{
  const lock = body('ccArrangeLock');
  ok('Unraid\'s own lock is found anywhere in the menu, so the Docker tab gets no second one', /var native = document\.querySelector\("#menu \.nav-item\.LockButton"\)/.test(lock));
  ok('the look-alike is only added where Unraid has none', /if \(native\) \{\s*if \(injected\) injected\.remove\(\);/.test(lock));
}

console.log('\nThe lock while arranging');
{
  ok('both locks are recognised', /function isNavLock\(it\) \{ return it\.id === "cc-lock-item" \|\| it\.classList\.contains\("LockButton"\); \}/.test(src));
  ok('the lock does not wiggle', /if \(!isNavLock\(it\)\) it\.classList\.add\("cc-nav-wiggle"\)/.test(body('enterReorder')));
  ok('a press on the lock never starts a drag', /if \(e\.button !== 0 \|\| isNavLock\(it\)\) return;/.test(body('wireNavItem')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
