// DOM-shim regression test for the /Main "Array Devices" table WHILE THE ARRAY IS STOPPED.
//
// That state renders a completely different row shape than the started array, and three CC defects
// only ever showed there (reported off a screen recording):
//   1. only HALF the slots got a disk-name badge — device_list/device_info wraps the slot label in an
//      <a href="/Main/Device?name=…"> ONLY when the slot HOLDS a device; an empty slot (DISK_NP, and a
//      never-assigned second parity: DISK_NP_DSBL) prints the label as a BARE TEXT NODE, and stopped
//      rows carry no td.desc either, so both of enhanceMainName's selectors missed them.
//   2. the Identification control overlapped the Temp column (a CSS fix — the assertion here is that
//      ccSlotTip mirrors the full device string into a title so the CC bubble can replace the native
//      hover-reveal that WAS the overlap).
//   3. the Parity/Data separator — a content-free <tr class='tr_last'><td colspan='10'></td></tr> —
//      inherited the totals-bar tint and painted as a bare grey slab; ccVoidRow must stamp exactly the
//      EMPTY tr_last rows and never the ones carrying content (totals bar, the "Slots:" control row).
//
// The markup below is the real emhttp/plugins/dynamix/nchan/device_list output for fsState=Stopped
// (array_offline(), cases DISK_OK / DISK_NP / DISK_NP_DSBL / DISK_NP_MISSING).
const fs = require('fs');
const path = require('path');
const SHARES = process.argv[2] || path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local',
  'emhttp', 'plugins', 'cannonadecommand', 'scripts', 'shares.js');

/* ── minimal DOM shim (text nodes are first-class here — that is the whole point) ───────────── */
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class T {                                     // text node
  constructor(v) { this.nodeType = 3; this.tagName = undefined; this._txt = String(v); this.parentNode = null; }
  get textContent() { return this._txt; }
  set textContent(v) { this._txt = String(v); }
  get nextSibling() { const s = this.parentNode ? this.parentNode.childNodes : []; return s[s.indexOf(this) + 1] || null; }
}
class N {
  constructor(tag) {
    this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.childNodes = []; this.parentNode = null;
    this.classList = new CL(); this.attrs = {}; this.style = {};
  }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() { const s = this.parentNode ? this.parentNode.childNodes : []; return s[s.indexOf(this) + 1] || null; }
  get className() { return [...this.classList.s].join(' '); }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v) { this.childNodes = [new T(v)]; this.childNodes[0].parentNode = this; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) { this.childNodes.splice(i, 1); c.parentNode = null; } return c; }
  replaceChild(nw, old) {
    const i = this.childNodes.indexOf(old); if (i < 0) throw new Error('replaceChild: not a child');
    if (nw.parentNode) nw.parentNode.removeChild(nw);
    this.childNodes[i] = nw; nw.parentNode = this; old.parentNode = null; return old;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  walk(out = []) { for (const c of this.childNodes) if (c.nodeType === 1) { out.push(c); c.walk(out); } return out; }
  // compound matcher: *, tag, .class, [attr], [attr*="value"]
  _matchOne(sel) {
    if (sel === '*') return true;
    const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/); if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const c of (m[2].match(/\.[\w-]+/g) || [])) if (!this.classList.contains(c.slice(1))) return false;
    for (const a of (m[3].match(/\[[^\]]+\]/g) || [])) {
      const body = a.slice(1, -1);
      const sub = body.match(/^([\w-]+)\*=(?:"([^"]*)"|'([^']*)')$/);
      if (sub) { const v = this.getAttribute(sub[1]); if (v == null || v.indexOf(sub[2] !== undefined ? sub[2] : sub[3]) < 0) return false; continue; }
      if (!(body in this.attrs)) return false;
    }
    return true;
  }
  querySelectorAll(sel) {
    const out = [];
    for (const group of sel.split(',')) {
      const parts = group.trim().split(/\s+/);
      const scoped = parts[0] === ':scope';
      if (scoped && parts[1] === '>') {
        const rest = parts.slice(2);
        for (const c of this.children) {
          if (!c._matchOne(rest[0])) continue;
          if (rest.length === 1) { out.push(c); continue; }
          for (const d of c.walk()) if (d._matchOne(rest[rest.length - 1])) out.push(d);   // ":scope > td.desc a[href]"
        }
        continue;
      }
      const last = parts[parts.length - 1];
      for (const d of this.walk()) if (d._matchOne(last)) {
        if (parts.length === 1) { out.push(d); continue; }
        let p = d.parentNode, want = parts.slice(0, -1).reverse(), i = 0;
        while (p && i < want.length) { if (p._matchOne(want[i])) i++; p = p.parentNode; }
        if (i === want.length) out.push(d);
      }
    }
    return out.filter((n, i, a) => a.indexOf(n) === i);
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
class OptionN extends N { constructor() { super('option'); } get text() { return this.textContent; } }
class SelectN extends N {
  constructor() { super('select'); this._si = -1; }
  get options() { return this.children.filter(c => c.tagName === 'OPTION'); }
  get selectedIndex() { return this._si; }
  set selectedIndex(i) { this._si = i; this.options.forEach((o, k) => { o.selected = k === i; }); }
}
global.document = {
  createElement: t => (t === 'select' ? new SelectN() : t === 'option' ? new OptionN() : new N(t)),
  createTextNode: v => new T(v),
  documentElement: new N('html'),
  addEventListener() {}, querySelectorAll: () => [],
};

/* ── load the REAL functions out of shares.js ───────────────────────────────────────────────── */
const src = fs.readFileSync(SHARES, 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found in shares.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + name);
}
const code = ['el', 'enhanceMainName', 'ccSlotTip', 'ccVoidRow'].map(grab).join('\n');
const { enhanceMainName, ccSlotTip, ccVoidRow } =
  new Function('document', code + '\nreturn {enhanceMainName, ccSlotTip, ccVoidRow};')(global.document);

/* ── the DOM device_list actually emits with the array STOPPED ──────────────────────────────── */
const mk = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const txt = (host, v) => { const t = document.createTextNode(v); host.appendChild(t); return t; };
// device_info(): <a class='view'></a><a class='info'><i class='… orb'></i><span>help</span></a> + label
function deviceCell(label, href, sub) {
  const td = mk('td');
  td.appendChild(mk('a', 'view'));
  const info = mk('a', 'info'); info.appendChild(mk('i', 'fa fa-square orb grey-orb')); txt(info, 'Device not present'); td.appendChild(info);
  if (href) { const a = mk('a'); a.setAttribute('href', href); txt(a, label); td.appendChild(a); } else txt(td, label);
  if (sub) {                                     // DISK_NP_MISSING / DISK_WRONG: "<br><span class='diskinfo'><em>Missing</em></span>"
    td.appendChild(mk('br'));
    const s = mk('span', 'diskinfo'); const em = mk('em'); txt(em, sub); s.appendChild(em); td.appendChild(s);
  }
  return td;
}
// assignment(): <form …><input hidden …><select class='slot'>…</select></form>
function assignCell(opts, sel) {
  const td = mk('td'), form = mk('form');
  form.setAttribute('method', 'POST');
  const s = document.createElement('select'); s.className = 'slot'; s.setAttribute('name', 'slotId.0');
  opts.forEach(o => { const op = document.createElement('option'); op.textContent = o; s.appendChild(op); });
  s.selectedIndex = sel;
  form.appendChild(s); td.appendChild(form); return td;
}
const NO_DEV = 'nicht zugewiesen';
const DEV1 = 'WDC_WD161KRYZ-01AGBB0_2PGXKAJH - 16 TB (sdb)';
const DEV2 = 'WDC_WD181KRYZ-01AGBB0_2XG8AAAA - 18 TB (sdc)';

function assignedRow(label) {                    // DISK_OK
  const tr = mk('tr', 'offline');
  tr.appendChild(deviceCell(label, '/Main/Device?name=disk1'));
  tr.appendChild(assignCell([DEV1, NO_DEV, DEV2], 0));
  const temp = mk('td'); txt(temp, '43 °C'); tr.appendChild(temp);
  return tr;
}
function emptyRow(label, sub) {                  // DISK_NP  /  DISK_NP_DSBL  /  DISK_NP_MISSING
  const tr = mk('tr', 'offline');
  tr.appendChild(deviceCell(label, null, sub));
  tr.appendChild(assignCell([NO_DEV, DEV2], 0));
  const rest = mk('td'); rest.setAttribute('colspan', '8'); tr.appendChild(rest);
  return tr;
}
function separatorRow() {                        // <tr class='tr_last'><td colspan='10'></td></tr>
  const tr = mk('tr', 'tr_last'); const td = mk('td'); td.setAttribute('colspan', '10'); tr.appendChild(td); return tr;
}
function slotsRow() {                            // <tr class='tr_last'><td>Slots:</td><td colspan='8'>…</td><td></td></tr>
  const tr = mk('tr', 'tr_last');
  const a = mk('td'); txt(a, 'Slots:'); tr.appendChild(a);
  const b = mk('td'); b.setAttribute('colspan', '8'); b.appendChild(mk('span', 'slots')); tr.appendChild(b);
  tr.appendChild(mk('td'));
  return tr;
}
function totalsRow() {                           // the STARTED-array totals bar — also tr_last, but populated
  const tr = mk('tr', 'tr_last');
  const a = mk('td'); a.appendChild(mk('a', 'info')); tr.appendChild(a);
  const b = mk('td'); txt(b, 'Array of five devices'); tr.appendChild(b);
  return tr;
}
const nameBadge = tr => tr.querySelector('.cc-b-name');

/* ── the tests ──────────────────────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nGround truth: an EMPTY slot has no <a> to tag (this is why half the list stayed unbadged)');
{
  const tr = emptyRow('Parität 2');
  ok('no /Main/Device link in an unassigned row', !tr.querySelector('a[href*="/Main/Device?name="]'));
  ok('and no td.desc either (stopped rows are plain <td>)', !tr.querySelector(':scope > td.desc a[href]'));
}

console.log('\nEVERY slot gets the lg name badge (user: "Die disk namen sind nicht alle in badges")');
{
  const a = assignedRow('Datenträger 1'); enhanceMainName(a);
  const b = nameBadge(a);
  ok('assigned slot: the LINK is tagged (no regression)', !!b && b.tagName === 'A' && b.classList.contains('cc-b'), b && b.tagName);
  ok('assigned label intact', b && b.textContent === 'Datenträger 1', b && JSON.stringify(b.textContent));

  for (const label of ['Parität 2', 'Datenträger 5']) {
    const tr = emptyRow(label); enhanceMainName(tr);
    const n = nameBadge(tr);
    ok('empty slot "' + label + '": bare text is wrapped in a span badge',
      !!n && n.tagName === 'SPAN' && n.classList.contains('cc-b') && n.classList.contains('cc-b-name'), n ? n.tagName : 'NONE');
    ok('empty slot "' + label + '": label text preserved', n && n.textContent === label, n && JSON.stringify(n.textContent));
  }
}

console.log('\nThe MISSING/WRONG sub-line must stay OUT of the name pill');
{
  const tr = emptyRow('Datenträger 6', 'Missing'); enhanceMainName(tr);
  const n = nameBadge(tr);
  ok('badge holds the slot name only', n && n.textContent === 'Datenträger 6', n && JSON.stringify(n.textContent));
  ok('the diskinfo sub-line survives outside the badge', !!tr.querySelector('.diskinfo'));
  ok('and it is NOT inside the badge', !n.querySelector('.diskinfo'));
}

console.log('\nenhanceMainName is idempotent (the nchan refill re-enters it every second)');
{
  const tr = emptyRow('Datenträger 7');
  enhanceMainName(tr); enhanceMainName(tr); enhanceMainName(tr);
  ok('exactly one name badge after three passes', tr.querySelectorAll('.cc-b-name').length === 1,
    tr.querySelectorAll('.cc-b-name').length + ' badges');
}

console.log('\nccSlotTip: the full device string reaches the CC bubble (replaces the overlap-on-hover)');
{
  const tr = assignedRow('Datenträger 1'); ccSlotTip(tr);
  const s = tr.querySelector('select.slot');
  ok('title carries the SELECTED option text', s.getAttribute('title') === DEV1, JSON.stringify(s.getAttribute('title')));

  const e = emptyRow('Datenträger 5'); ccSlotTip(e);
  ok('an unassigned slot tips its placeholder', e.querySelector('select.slot').getAttribute('title') === NO_DEV);

  // ccTipSweep converts [title] -> [data-cc-tip] and strips the title; a later pass must not re-add it
  s.removeAttribute('title'); s.setAttribute('data-cc-tip', DEV1);
  ccSlotTip(tr);
  ok('no churn once ccTipSweep has converted it', s.getAttribute('title') === null, JSON.stringify(s.getAttribute('title')));

  const plain = mk('tr', 'offline'); plain.appendChild(mk('td'));
  ccSlotTip(plain);   // rows without an assignment select must be a no-op, never a throw
  ok('rows without a slot select are a no-op', true);
}

console.log('\nccVoidRow: only the CONTENT-FREE tr_last is the separator');
{
  const sep = separatorRow(); ccVoidRow(sep);
  ok('the Parity/Data separator is stamped', sep.classList.contains('cc-tr-void'));

  const slots = slotsRow(); ccVoidRow(slots);
  ok('the "Slots:" control row keeps its bar', !slots.classList.contains('cc-tr-void'));

  const tot = totalsRow(); ccVoidRow(tot);
  ok('the totals bar keeps its bar', !tot.classList.contains('cc-tr-void'));

  // enhanceMainRow widens the separator's colspan to 11 BEFORE stamping — still empty, still stamped
  sep.children[0].setAttribute('colspan', '11');
  ccVoidRow(sep);
  ok('still stamped after the colspan widening', sep.classList.contains('cc-tr-void'));

  // an NBSP-only cell is not "content" either (the :empty-blind case ccVoidBars exists for)
  const nb = separatorRow(); nb.children[0].textContent = ' '; ccVoidRow(nb);
  ok('an &nbsp;-only cell still counts as empty', nb.classList.contains('cc-tr-void'));

  // and it must UN-stamp if a refill brings content back into the same row object
  const back = separatorRow(); ccVoidRow(back); back.children[0].textContent = 'Slots:'; ccVoidRow(back);
  ok('re-stamping clears when content arrives', !back.classList.contains('cc-tr-void'));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
