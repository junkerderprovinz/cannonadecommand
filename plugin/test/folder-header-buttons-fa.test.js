// Regression test: the folder header's 5 action buttons use REAL Font-Awesome icons, not raw
// emoji text (v4.35.0, item 3 — jdp: "die ganzen buttons der ordner sind nicht im GlimStone").
//
// Investigated live before touching anything (a Playwright screenshot of a minimal reproduction
// using the EXACT shipped .cc-folder-act CSS rule + getComputedStyle on each button): every
// button genuinely computes border:0px none — .cc-folder-act's own CSS was never the bug. The
// visual culprit is the raw emoji glyphs themselves (👁 ▶ ■ ✎ 🗑) — 🗑 in particular rendered as a
// solid filled grey rectangle with a rounded top on this stack, reading exactly like a bordered
// swatch — and none of them follow `color` the way actBtn()'s own FA icons do everywhere else in
// the app (actBtn()'s doc comment already states the rule: "Font-Awesome glyphs, NOT emoji: emoji
// ignore CSS color, FA inherits it"). This file source-slices the REAL folderActBtn() (the new
// helper) and its 5 call sites out of docker.js (never re-typed) and proves the fix landed:
//   1. folderActBtn() builds a real <button class="cc-folder-act..."> with a FontAwesome <i class
//      "fa fa-...">, never a raw emoji text node.
//   2. All 5 folder-header buttons (hide-stopped, bulk-start, bulk-stop, rename, delete) call
//      folderActBtn(), not the old raw-emoji el("button", ..., "👁") shape.
//   3. Zero raw action-glyph emoji (👁 ▶ ■ ✎ 🗑) remain anywhere in docker.js.
//   4. docker.css gives the icon `color: inherit` so it follows .cc-folder-act's own grey-at-rest/
//      accent-on-hover treatment, the same convention .cc-actbtn i.fa already uses.
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

/* ── minimal DOM shim ─────────────────────────────────────────────────────────────────────── */
class CL { constructor() { this.s = new Set(); } add(c) { this.s.add(c); } contains(c) { return this.s.has(c); } }
class N {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; }
  get className() { return this._cls; }
  set className(v) { this._cls = String(v); this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
}
function el(tag, cls, txt) { const n = new N(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

console.log('\nfolderActBtn(): a real FA icon button, never raw emoji text');
{
  const fn = new Function('el', grabFn('folderActBtn') + '\nreturn folderActBtn;')(el);
  const b = fn('cc-folder-act', 'fa-eye', 'Hide stopped');
  ok('is a real <button>', b.tagName === 'BUTTON');
  ok('carries the class it was given', b.classList.contains('cc-folder-act'));
  ok('carries the title/tooltip it was given', b.title === 'Hide stopped');
  ok('has NO raw text content of its own — the icon is the only content', b._txt === '');
  ok('appends exactly ONE child: the <i class="fa fa-...">', b.children.length === 1);
  const icon = b.children[0];
  ok('the child is an <i>', icon.tagName === 'I');
  ok('the child carries "fa" AND the requested glyph class', icon.classList.contains('fa') && icon.classList.contains('fa-eye'));
}

console.log('\nAll 5 folder-header buttons call folderActBtn() — none build a raw emoji button any more');
{
  ok('hide-stopped button: folderActBtn(..., "fa-eye", t("hideStopped"))', /var hsBtn = folderActBtn\("cc-folder-act" \+ \(hsOn \? " cc-folder-act-on" : ""\), "fa-eye", t\("hideStopped"\)\);/.test(src));
  ok('bulk-start button: folderActBtn(..., "fa-play", t("bulkStartAll"))', /var startAllBtn = folderActBtn\("cc-folder-act", "fa-play", t\("bulkStartAll"\)\);/.test(src));
  ok('bulk-stop button: folderActBtn(..., "fa-stop", t("bulkStopAll"))', /var stopAllBtn = folderActBtn\("cc-folder-act", "fa-stop", t\("bulkStopAll"\)\);/.test(src));
  ok('rename button: folderActBtn(..., "fa-pencil", t("renameFolder"))', /var renBtn = folderActBtn\("cc-folder-act", "fa-pencil", t\("renameFolder"\)\);/.test(src));
  ok('delete button: folderActBtn(..., "fa-trash", t("deleteFolder"))', /var delBtn = folderActBtn\("cc-folder-act", "fa-trash", t\("deleteFolder"\)\);/.test(src));
}

console.log('\nZero raw action-glyph emoji remain in LIVE docker.js CODE (comments may still narrate the old bug for posterity)');
{
  // Comment-stripped copy (same technique settings-chrome.test.js / adopt-rainbow-ui.test.js use)
  // so this file's OWN doc comments — which quote the retired glyphs verbatim while explaining the
  // fix — can never satisfy or break the assertion. Scoped to the literal glyphs the folder-header
  // row used to ship (📁 is the UNRELATED "move to folder" button emoji, out of scope for item 3 —
  // jdp's complaint was specifically the header row, not attachMoveButton()'s icon; left untouched
  // on purpose, not missed).
  const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, m => m.replace(/[^\n]/g, ' '))).join('\n');
  ['👁', '▶', '■', '✎', '🗑'].forEach(glyph => {
    ok('"' + glyph + '" no longer appears in any live (non-comment) line of docker.js', code.indexOf(glyph) < 0);
  });
}

console.log('\ndocker.css: the icon follows .cc-folder-act\'s own colour (grey at rest, accent on hover), not a fixed/native colour');
{
  const m = css.match(/\.cc-folder-act i\.fa\s*\{([^}]*)\}/);
  ok('a dedicated .cc-folder-act i.fa rule exists', !!m, css.slice(0, 0));
  const body = m ? m[1] : '';
  ok('it sets color: inherit (follows the button, not a fixed colour)', /color:\s*inherit/.test(body), body);
}

console.log('\nv4.35.1 fix: .cc-folder-act/.cc-card-movebtn background is !important — clears Unraid\'s native button:where() gradient background-image');
{
  // Root cause (live-confirmed via CDP CSS.getMatchedStylesForNode on the real box, v4.35.1): the
  // FA-icon fix above was real, but each button STILL rendered as a solid red/orange boxed swatch —
  // Unraid's own `button:where(:not(.unapi *))` rule (webGui/styles/default-base.css) paints a
  // 4-layer edge gradient through `background: transparent` whenever that declaration lacks
  // !important, even though .cc-folder-act/.cc-card-movebtn have a higher-specificity class
  // selector against that :where()-wrapped (zero-specificity) native rule — .cc-hgear already had
  // !important here and never showed the bug; empirically confirmed adding it is what clears
  // background-image, not border/box-shadow (those were never affected). Source-level pin (this
  // harness has no real browser cascade to assert getComputedStyle against directly) — asserts the
  // actual mechanism, not just presence of the word "important" anywhere in the rule.
  const folderAct = css.match(/\.cc-folder-act\s*\{([^}]*)\}/);
  const moveBtn = css.match(/\.cc-card-movebtn\s*\{([^}]*)\}/);
  ok('.cc-folder-act rule exists', !!folderAct);
  ok('.cc-card-movebtn rule exists', !!moveBtn);
  const faBody = folderAct ? folderAct[1] : '';
  const mbBody = moveBtn ? moveBtn[1] : '';
  ok('.cc-folder-act: background is transparent WITH !important (the actual fix)', /background:\s*transparent\s*!important/.test(faBody), faBody);
  ok('.cc-card-movebtn: background is transparent WITH !important (same latent bug, same fix)', /background:\s*transparent\s*!important/.test(mbBody), mbBody);
  // box-shadow/border were never the bug — pin they stay untouched, so a future edit can't
  // "fix" background again by accidentally weakening these instead.
  ok('.cc-folder-act: box-shadow stays none !important (unrelated to this fix, unchanged)', /box-shadow:\s*none\s*!important/.test(faBody));
  ok('.cc-card-movebtn: box-shadow stays none !important (unrelated to this fix, unchanged)', /box-shadow:\s*none\s*!important/.test(mbBody));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
