// Regression test for the v4.35.1 hotfix (item B): the Docker-tab icon-background ("Hintergrund")
// badge colour silently never painted on a real container icon, in ANY mode — live-confirmed by a
// Playwright verification pass on the real box, in BOTH the reported scenarios:
//
//   (a) Docker's own custom Hintergrund colour, with the AREA'S OWN toggle on, Rainbow off.
//   (b) the global master "Badge-Einstellungen übernehmen" adopt toggle on (follows Rainbow/accent).
//
// Two INDEPENDENT root causes, both pinned here:
//
//   BUG 1 — .cc-docker-iconbg class-gating never checked the master adopt toggle. The three call
//   sites that toggle .cc-docker-iconbg onto the native table / classic Grid / Folder view
//   (applyEnhanceClasses(), renderGrid(), renderFolderView()) all tested the raw per-area toggle
//   alone (`effc("iconbg") === "1"`), even though the Settings page's own "Badge-Einstellungen
//   übernehmen" switch documents that turning it on implicitly turns Hintergrund on too ("AN:
//   Hintergrund UND Icons folgen zusammen Regenbogen … bzw. der Akzentfarbe"). With adopt ON but
//   the area's own toggle never separately flipped on, .cc-docker-iconbg never reached the DOM at
//   all — live-confirmed via getComputedStyle/--cc-iconbg-color inspection on the real box (the
//   variable WAS being computed correctly by bgColor()/applyIconTint(), the class gate is what
//   silently dropped it) — so NEITHER the rainbow-gated NOR the reactive-hover CSS rule could ever
//   fire, in every render path. Fixed with one shared iconBgOn() helper
//   (effc("iconbg")==="1" || iconBgAdopts()) used at all three call sites, so the same fix can't
//   drift out of sync between them again.
//
//   BUG 2 — .cc-card-ico (classic Grid AND every folder-view density — Grid/Detailliert/Liste all
//   reuse card()/folderChip()/folderListRow()) never had the table-view row's equivalent base rule.
//   Only a Rainbow-GATED rule existed (`.cc-grid-holder.cc-docker-iconbg.cc-rainbow .cc-card-ico`);
//   with Rainbow off (plain accent mode) and Reactive off, NO rule ever applied the configured/
//   adopted colour to .cc-card-ico — it fell through to its unconditional grey default forever,
//   live-confirmed the same way. Fixed by adding the missing unconditional base rule, mirroring the
//   table-view row's own base+refinement split (line ~60/75 in docker.css) exactly.
//
// Both fixes were verified LIVE on the real box (Playwright, real hover, real CDP cascade
// inspection) before being written here — this file pins the mechanism in the shipped source so it
// cannot regress silently again.
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

console.log('\nBUG 1 fix — iconBgOn(): the shared gate, effc("iconbg")==="1" || iconBgAdopts()');
{
  reset();
  ok('both off: iconBgOn() is false', api.iconBgOn() === false);

  reset(); localStorage.setItem('cc.iconbg', '1');
  ok('local per-area toggle ON, adopt off: iconBgOn() is true (unchanged, pre-existing behaviour)', api.iconBgOn() === true);

  reset(); localStorage.setItem('cc.iconbgrainbow', '1');
  ok('THE FIX: master adopt ON, local toggle never separately set: iconBgOn() is STILL true', api.iconBgOn() === true);
  ok('…even though the raw per-area check alone would have said false (the exact live bug)', api.effc('iconbg') !== '1');

  reset(); localStorage.setItem('cc.iconbgrainbow', '1'); localStorage.setItem('cc.iconbg', '0');
  ok('adopt ON with the local toggle explicitly OFF: still true (adopt wins, matches the Settings page copy)', api.iconBgOn() === true);

  reset(); localStorage.setItem('cc.styledocker', '0'); localStorage.setItem('ccd.iconbg', '1');
  ok('Docker on its OWN style (cc.styledocker=0): the per-area ccd. prefix still reaches iconBgOn()', api.iconBgOn() === true);
}

console.log('\nBUG 1 fix — all THREE .cc-docker-iconbg class-gating call sites use the shared helper, not a re-inlined check');
{
  const sites = [
    ['applyEnhanceClasses() — native table/list view', /tb\.classList\.toggle\("cc-docker-iconbg",\s*iconBgOn\(\)\)/],
    ['renderGrid() — classic Grid view', /gridHolder\.classList\.toggle\("cc-docker-iconbg",\s*iconBgOn\(\)\)/],
    ['renderFolderView() — every folder density', /gridHolder\.classList\.toggle\("cc-docker-iconbg",\s*iconBgOn\(\)\)/],
  ];
  // renderGrid/renderFolderView share an identical call-site line, so count occurrences instead of
  // relying on a second regex match to prove BOTH sites (not just one) were fixed.
  const matches = src.match(/classList\.toggle\("cc-docker-iconbg",\s*iconBgOn\(\)\)/g) || [];
  ok('exactly 3 call sites now gate on iconBgOn() (table + classic Grid + Folder view)', matches.length === 3, String(matches.length));
  ok('zero call sites still re-inline the old, un-adopt-aware check', !/classList\.toggle\("cc-docker-iconbg",\s*effc\("iconbg"\)\s*===\s*"1"\)/.test(src));
}

console.log('\nBUG 2 fix — .cc-card-ico gets an UNCONDITIONAL base Hintergrund rule, not just the Rainbow-gated refinement');
{
  const base = css.match(/\.cc-grid-holder\.cc-docker-iconbg \.cc-card-ico\s*\{([^}]*)\}/);
  ok('the new base rule exists (.cc-docker-iconbg alone, no .cc-rainbow required)', !!base);
  const baseBody = base ? base[1] : '';
  ok('base rule: background uses the --cc-iconbg-color/--cc-accent chain', /--cc-iconbg-color/.test(baseBody) && /--cc-accent/.test(baseBody));
  ok('base rule: is !important (must beat the plain grey default at the SAME .cc-card-ico selector)', /!important/.test(baseBody));
  ok('base rule: does NOT reference --cc-rb-c (that fallback belongs only to the Rainbow-gated refinement)', !/--cc-rb-c/.test(baseBody));

  const rainbow = css.match(/\.cc-grid-holder\.cc-docker-iconbg\.cc-rainbow \.cc-card-ico\s*\{([^}]*)\}/);
  ok('the pre-existing Rainbow-gated refinement is still present, unchanged in shape', !!rainbow);
  const rbBody = rainbow ? rainbow[1] : '';
  ok('refinement rule: still adds the --cc-rb-c fallback step ahead of --cc-accent', /--cc-iconbg-color.*--cc-rb-c.*--cc-accent/.test(rbBody.replace(/\s+/g, ' ')));

  // base rule must appear BEFORE the rainbow refinement so a real browser's higher-specificity
  // .cc-rainbow selector is the one seen "last wins on equal specificity" as a second line of
  // defence — mirrors the table-view row's own base(60)-then-refinement(75) source order exactly.
  ok('base rule is declared before the Rainbow refinement (same order as the table-view row pair)', css.indexOf(base[0]) < css.indexOf(rainbow[0]));

  // Reactive mode's own rest/hover pair (higher specificity again) must still exist untouched —
  // this fix must not have collided with or duplicated that pair.
  ok('reactive-mode REST rule (neutral grey) is untouched', /html\.cc-shares-rbneutral\.cc-docker-on \.cc-grid-holder\.cc-docker-iconbg \.cc-card-ico\s*\{\s*background:\s*rgba\(128, 128, 128, \.18\)\s*!important;\s*\}/.test(css));
  ok('reactive-mode HOVER rule (real colour) is untouched', /html\.cc-shares-rbneutral\.cc-docker-on \.cc-grid-holder\.cc-docker-iconbg \.cc-card:hover \.cc-card-ico/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
