// The disk tiles on /Main (CannonadeCommand.Disks.page, .css, disks.js, server/disks.php).
// What can quietly break it:
//   · a rule that is not gated on html.cc-dk-on restyles /Main with the Start area off
//   · a reader that only knows the plain nchan rows and loses a disk once shares.js has badged them
//   · an action that runs anything other than the call Unraid's own control carries
//   · a second view switch, or a key per section that the page switch cannot take back
//   · a table control left in the tile view, where it does nothing
//   · an animation outside the motion gate, or one that keeps running at "off"
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const DIR = path.join(__dirname, '..', 'src', 'cannonadecommand', 'usr', 'local', 'emhttp', 'plugins', 'cannonadecommand');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const js = read('scripts/disks.js');
const css = read('sheets/CannonadeCommand.Disks.css');
const page = read('CannonadeCommand.Disks.page');

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(src, name) { const m = new RegExp('var ' + name + ' = [^\\n]+;').exec(src); if (!m) throw new Error('var not found: ' + name); return m[0]; }

// A small HTML tree with the parts of the DOM the readers use: children, childNodes, tagName,
// getAttribute, parentNode, and closest() for a class or an attribute.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', deg: '\u00b0' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m));
function el(tag, attrs, parent) {
  const n = { nodeType: 1, tagName: tag.toUpperCase(), attrs, children: [], childNodes: [], parentNode: parent };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.closest = (sel) => { for (let c = n; c && c.nodeType === 1; c = c.parentNode) if (sel.split(',').some((p) => matches(c, p.trim()))) return c; return null; };
  return n;
}
function matches(n, sel) {
  if (sel[0] === '.') return (' ' + (n.attrs.class || '') + ' ').includes(' ' + sel.slice(1) + ' ');
  if (sel[0] === '[') return sel.slice(1, -1) in n.attrs;
  return n.tagName === sel.toUpperCase();
}
function parse(html) {
  const root = el('root', {}, null);
  const VOID = new Set(['br', 'img', 'input', 'hr', 'col']);
  const re = /<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/gi;
  let cur = root, m;
  while ((m = re.exec(html))) {
    if (m[1]) { let c = cur; while (c && c.tagName !== m[1].toUpperCase()) c = c.parentNode; if (c && c.parentNode) cur = c.parentNode; continue; }
    if (m[4]) { cur.childNodes.push({ nodeType: 3, nodeValue: decode(m[4]), parentNode: cur }); continue; }
    const attrs = {};
    (m[3] || '').replace(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (x, k, a, b, c) => { attrs[k] = decode(a ?? b ?? c ?? ''); });
    const n = el(m[2], attrs, cur);
    cur.children.push(n); cur.childNodes.push(n);
    if (!VOID.has(m[2].toLowerCase())) cur = n;
  }
  return root;
}
const tbody = (rows) => parse('<tbody>' + rows + '</tbody>').children[0];

// The readers out of disks.js, with the helpers they call.
const READERS = ['kids', 'tag', 'attr', 'hasCls', 'find', 'text', 'clean', 'bytes', 'rate', 'temp', 'parseCall', 'run', 'cells', 'usage', 'fsInfo', 'linkName',
  'kindOf', 'orbState', 'splitId', 'ioText', 'readRow', 'readArray', 'readPool', 'readBoot', 'readUd', 'cardOf', 'act', 'onClick', 'view', 'order'];
function load(env) {
  const src = [grabVar(js, 'POW'), grabVar(js, 'CALLS'), grabVar(js, 'KEY')].concat(READERS.map((n) => grabFn(js, n))).join('\n') + '\nreturn {' + READERS.join(',') + '};';
  return new Function('window', 'location', 'g', src)(env.window || {}, env.location || {}, env.g || (() => null));
}

// Rows as Unraid's devices channel sends them (serials made up).
const PARITY = `<tr><td><a class='view'></a><a class='info'><i id='dev-parity' class='fa fa-circle orb green-orb' style='cursor:pointer' onclick="toggle_state('Device','parity','down')"></i><span>Normaler Betrieb, Datenträger aktiv<br>Zum Herunterfahren des Datenträgers klicken</span></a><a href="/Main/Device?name=parity">Parität</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sde','')"><i class='icon-disk icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>WDC_WD181KRYZ-01AGBB0_TESTPAR1</span> - 18 TB (sde)</td><td>37&#8201;&#176;C</td><td><span class='diskio'>0.0 B/s</span><span class='number'>50,456,947</span></td><td><span class='diskio'>12.5 MB/s</span><span class='number'>44,641,755</span></td><td>0</td><td colspan='4'></td></tr>`;
const DISK1 = `<tr><td><a class='view' href="/Main/Browse?dir=/mnt/disk1"><i class="icon-u-tab" title="Durchsuchen /mnt/disk1"></i></a><a class='info'><i id='dev-disk1' class='fa fa-circle orb grey-orb' style='cursor:pointer' onclick="toggle_state('Device','disk1','up')"></i><span>Datenträger im Standby-Modus (heruntergefahren)<br>Zum Starten des Datenträgers klicken</span></a><a href="/Main/Device?name=disk1">Datenträger 1</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sdf','')"><i class='icon-disk icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>WDC_WD161KRYZ-01AGBB0_TESTDSK1</span> - 16 TB (sdf)</td><td>*</td><td><span class='diskio'>0.0 B/s</span><span class='number'>75,282,084</span></td><td><span class='diskio'>0.0 B/s</span><span class='number'>11,703,195</span></td><td><a class='info'><i class='fa fa-exclamation-triangle orange-text'></i><span>Device errors: 3</span></a>&nbsp;3</td><td>xfs</td><td>16 TB</td><td><div class='usage-disk'><span style='width:87.711422734358%' class=''></span><span>14.0 TB</span></div></td><td><div class='usage-disk'><span style='width:12.288577265642%' class=''></span><span>1.97 TB</span></div></td></tr>`;
const TOTAL = `<tr class='tr_last'><td><a class='info'><i class='fa fa-toggle-down control' onclick="toggle_state('Device','disk*','down')"></i><span>Herunterfahren</span></a></td><td><a class='static'><i class='icon-disks icon'></i></a><span></span>Array aus zwei Datenträgern</td><td>37&#8201;&#176;C</td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td><span class='diskio'>12.5 MB/s</span><span class='number'>2</span></td><td>0</td><td></td><td>16 TB</td><td><div class='usage-disk'><span style='width:87.7%' class=''></span><span>14.0 TB</span></div></td><td><div class='usage-disk'><span style='width:12.3%' class=''></span><span>1.97 TB</span></div></td></tr>`;
// The same disk once shares.js has badged it: a Browse column, the link moved there, cells wrapped.
const DISK1_BADGED = `<tr data-cc-main="1" style="--cc-rb-c: #FF832B; --cc-rb-ct: #161616;"><td><a class="info" data-cc-tip="Datenträger im Standby-Modus (heruntergefahren)
Zum Starten des Datenträgers klicken"><i id="dev-disk1" class="fa fa-circle orb grey-orb" style="cursor:pointer" onclick="toggle_state('Device','disk1','up')"></i><span>Datenträger im Standby-Modus (heruntergefahren)<br>Zum Starten des Datenträgers klicken</span></a><a href="/Main/Device?name=disk1" class="cc-b cc-b-name">Datenträger 1</a></td><td class="cc-browse-col"><a class="view cc-b-browse" href="/Main/Browse?dir=/mnt/disk1"><span class="cc-b-lab">Durchsuchen</span></a></td><td class="desc cc-bcell"><span class="cc-b"><span class="cc-b-v"><a class="info hand" onclick="openTerminal('disklog','sdf','')" data-cc-tip="Datenträgerprotokoll"><i class="icon-disk icon"></i><span>Datenträgerprotokoll</span></a><span style="font-family:bitstream">WDC_WD161KRYZ-01AGBB0_TESTDSK1</span> - 16 TB (sdf)</span></span></td><td>*</td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v"><span class="diskio">0.0 B/s</span><span class="number" style="display: none;">75,282,084</span></span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v"><span class="diskio">0.0 B/s</span><span class="number" style="display: none;">11,703,195</span></span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v"><a class='info'><i class='fa fa-exclamation-triangle orange-text'></i><span>Device errors: 3</span></a>&nbsp;3</span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v">xfs</span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v">16 TB</span></span></td><td><div class="usage-disk"><span style="width: 87.7114%; --cc-slosh-phase: -10.227s;" class="cc-slosh-edge cc-fill-amber"></span><span>14.0 TB</span></div></td><td><div class="usage-disk"><span style="width: 12.2886%; --cc-slosh-phase: -10.227s;" class="cc-slosh-edge cc-fill-amber"></span><span>1.97 TB</span></div></td></tr>`;
const POOL = `<tr class='pool_header' id='pool_cache'><td><a class='view' href="/Main/Browse?dir=/mnt/cache"><i class="icon-u-tab"></i></a><a href="/Main/Device?name=cache">Cache</a></td><td class='desc'><i class="fa fa-bullseye title"></i> Data Partition <a href='/Main/Device?name=cache#poolsummary' title='View pool details'>(ONLINE)</a></td><td colspan='4'></td><td>btrfs</td><td>2 TB</td><td><div class='usage-disk'><span style='width:40.5%' class=''></span><span>811 GB</span></div></td><td><div class='usage-disk'><span style='width:59.5%' class=''></span><span>1.19 TB</span></div></td></tr><tr><td><span style='padding-left:16px'></span><a class='view'></a><a class='info'><i id='dev-cache' class='fa fa-circle orb green-orb' style='cursor:pointer' onclick="toggle_state('Device','cache','down')"></i><span>Normaler Betrieb</span></a><a href="/Main/Device?name=cache">Device 1</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','nvme0n1','')"><i class='icon-nvme icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>Samsung_SSD_9100_PRO_2TB_TESTNVME</span> - 2 TB (nvme0n1)</td><td>40&#8201;&#176;C</td><td><span class='diskio'>8.2 KB/s</span><span class='number'>4</span></td><td><span class='diskio'>53,5 KB/s</span><span class='number'>2</span></td><td>0</td><td colspan='4'></td></tr><tr><td><span style='padding-left:16px'></span><a class='view'></a><a class='info'><i id='dev-cache2' class='fa fa-circle orb grey-orb' style='cursor:pointer' onclick="toggle_state('Device','cache2','up')"></i><span>Standby</span></a><a href="/Main/Device?name=cache2">Device 2</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sdg','')"><i class='icon-nvme icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>Samsung_SSD_850_EVO_500GB_TESTSATA</span> - 500 GB (sdg)</td><td>*</td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td>0</td><td colspan='4'></td></tr>`;
const BOOT = `<tr><td><a class='view' href="/Main/Browse?dir=/boot"><i class="icon-u-tab"></i></a><a class='info'><i class='fa fa-circle orb green-orb'></i><span>Normaler Betrieb</span></a><a href="/Main/Boot?name=flash">Boot(Flash)</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sda','')"><i class='icon-usb icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>SanDisk_Cruzer_Blade_TESTUSB-0:0</span> - 63.1 GB (sda)</td><td>*</td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td>0</td><td>vfat</td><td>63 GB</td><td><div class='usage-disk'><span style='width:5.9%' class=''></span><span>3.71 GB</span></div></td><td><div class='usage-disk'><span style='width:94.1%' class=''></span><span>59.3 GB</span></div></td></tr><tr><td><span class='left'><i class='fa fa-magic title'></i> Internal Boot</span></td><td class='desc'>No internal boot setup detected. Launch <a href="/Tools/Wizards/InternalBootWizard">Internal Boot</a> to configure one.</td><td colspan='8'></td></tr>`;
// A stopped array: the identification cell holds the assignment dropdown.
const STOPPED = `<tr class='offline'><td><a class='view'></a><a class='info'><i class='fa fa-circle orb green-orb'></i><span>x</span></a><a href="/Main/Device?name=disk1">Datenträger 1</a></td><td><form><select class='slot' name='slotId.1'><option value='a' selected>WDC_TEST - 16 TB (sdf)</option></select></form></td><td>*</td><td colspan='3'></td><td>xfs</td><td colspan='3'></td></tr>`;
// Unassigned Devices: a disk row with its partition row, which holds the browse link.
const UD = `<tr class='toggle-disk'><td><a style='cursor:pointer' class='exec info' onclick='spinDownDisk("sdh")'><i id='disk_orb-sdh' class='fa fa-circle green-orb orb'></i><span>Click to spin down device</span></a><a href='/Main/Device?name=sdh'>Elements</a></td><td><a class='info' href="#" onclick="openTerminal('disklog', 'sdh')"><i class='fa fa-hdd-o icon partition-log'></i><span>Disk Log Information</span></a><span class='toggle-hdd' hdd='sdh'></span>WD_Elements_TESTUD01 (sdh)<span id='preclear_x' style='display:block;'></span></td><td class='mount'><button class='mount' onclick='disk_op(this, "umount", "sdh")'>Unmount</button></td><td>31 &deg;C</td><td>1.2 MB/s</td><td>0.0 B/s</td><td><a class='info'><i class='fa fa-gears'></i><span>Settings</span></a></td><td>ntfs</td><td>5 TB</td><td><div class='usage-disk'><span style='margin:0;width:64%' class=''></span><span>3.12 TB</span></div></td><td><div class='usage-disk'><span style='margin:0;width:36%' class=''></span><span>1.76 TB</span></div></td></tr><tr class='toggle-parts toggle-sdh' name='toggle-sdh' style='display:none;'><td></td><td><span><a class='exec underline-icon' title='Browse Disk Share' href='/Main/Browse?dir=/mnt/disks/Elements'><i class='fa fa-external-link'></i> Elements</a></span></td></tr>`;
const UD_NONE = `<tr><td colspan='11' style='text-align:center;'>No Unassigned Disks available.</td></tr>`;

console.log('\nThe hook');
ok('the page is a Buttons hook, so its sheet loads on every page', /^Menu="Buttons:\d+"/m.test(page));
ok('it renders no icon', /^Link="cc-disks-hook"/m.test(page));
ok('it loads disks.js', /scripts\/disks\.js/.test(page));

console.log('\nEvery rule waits for html.cc-dk-on');
{
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const sels = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) { const s = m[1].replace(/^\s*@media[^{]*\{/, '').trim(); if (s && !s.startsWith('@')) sels.push(s); }
  ok('the sheet has rules', sels.length > 40, sels.length);
  const loose = [];
  for (const s of sels) for (const part of splitTop(s)) if (!/^html\.cc-dk-on/.test(part.trim())) loose.push(part.trim());
  ok('no selector applies without the gate', loose.length === 0, loose.slice(0, 4).join(' | '));
  ok('the script sets the gate only where the Start area styles /Main', /function live\(\) \{\s*return g\("cc\.theming", "1"\) !== "0" && g\("cc\.enable\.main", "0"\) !== "0" && pn\(\) === "\/Main" && !!document\.querySelector\("#displaybox nav\.tabs"\);/.test(js));
}

console.log('\nThe motion stays inside the gate and stops at "off"');
{
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  html.cc-dk-on:not'));
  const anims = [...css.matchAll(/^\s*(html[^\n{]*)\{[^}\n]*\banimation:\s*cc-dk-/gm)].map((m) => m[1]);
  ok('there are animations', anims.length >= 6, anims.length);
  ok('each one names the quiet level and none the lively one', anims.every((s) => /:not\(\[data-cc-motion="off"\]\)/.test(s)) && !/data-cc-motion="(wild|subtle)"\]/.test(css));
  ok('they all sit in the no-preference block', anims.every((s) => media.includes(s)));
  const tokens = read('sheets/CannonadeCommand.Tokens.css');
  for (const d of ['spin', 'seek', 'swing', 'blink', 'flow', 'rise', 'stagger']) ok('the platter, arm, LED and entrance read --cc-motion-disk-' + d, css.includes('var(--cc-motion-disk-' + d) && (tokens.match(new RegExp('--cc-motion-disk-' + d + ':', 'g')) || []).length === 4);
  ok('the entrance ends at transform: none', /@keyframes cc-dk-in \{[^}]*\}[^}]*to \{ transform: none;/.test(css));
  ok('a spun-down platter stops where it was', /\.cc-dk-card\.cc-dk-down \.cc-dk-plat \{ animation-play-state: paused; \}/.test(css));
}

console.log('\nThe readers follow Unraid\'s rows');
{
  const R = load({});
  const arr = R.readArray(tbody(PARITY + DISK1 + TOTAL));
  const [par, d1] = arr.disks;
  ok('two disks and the totals row', arr.disks.length === 2 && !!arr.total && !arr.offline);
  ok('parity: name, settings link, device and drive', par.key === 'parity' && par.parity && par.name === 'Parität' && par.href === '/Main/Device?name=parity' && par.dev === 'sde' && par.kind === 'hdd');
  ok('parity: capacity, temperature and rates', par.size === 18e12 && par.temp.c === 37 && par.wr === 12.5e6 && par.rd === 0 && par.wrText === '12.5 MB/s');
  ok('parity: model and serial from the identification', par.model === 'WDC WD181KRYZ-01AGBB0' && par.serial === 'TESTPAR1');
  ok('parity runs toggle_state with the row\'s own arguments', JSON.stringify(par.spin) === JSON.stringify({ fn: 'toggle_state', args: ['Device', 'parity', 'down'] }) && !par.down);
  ok('the disk log runs openTerminal as the row does', JSON.stringify(par.log) === JSON.stringify({ fn: 'openTerminal', args: ['disklog', 'sde', ''] }));
  ok('disk 1 is spun down and has no temperature', d1.down && d1.temp === null);
  ok('disk 1: file system, used, free and the bar width', d1.fs && d1.fs.fs === 'xfs' && d1.fs.used === '14.0 TB' && d1.fs.free === '1.97 TB' && Math.round(d1.fs.pct) === 88);
  ok('disk 1: errors and their tooltip, browse link', d1.errors === 3 && d1.errTip === 'Device errors: 3' && d1.browse === '/Main/Browse?dir=/mnt/disk1');
  ok('the state text keeps its line break', d1.stateTip === 'Datenträger im Standby-Modus (heruntergefahren)\nZum Starten des Datenträgers klicken');
  ok('the totals: label, rates and the array usage', arr.total.label === 'Array aus zwei Datenträgern' && arr.total.wrText === '12.5 MB/s' && arr.total.fs && arr.total.fs.used === '14.0 TB' && arr.total.fs.size === '16 TB');
  const badged = R.readArray(tbody(DISK1_BADGED)).disks[0];
  const keys = ['key', 'name', 'href', 'dev', 'kind', 'size', 'down', 'errors', 'errTip', 'browse', 'rdText', 'reads'];
  ok('a row shares.js has badged reads the same', !!badged && keys.every((k) => JSON.stringify(badged[k]) === JSON.stringify(d1[k])) && JSON.stringify(badged.fs.used) === '"14.0 TB"' && JSON.stringify(badged.spin) === JSON.stringify(d1.spin), badged && keys.filter((k) => JSON.stringify(badged[k]) !== JSON.stringify(d1[k])).join(','));
  ok('the state text comes from the bubble shares.js moved', !!badged && badged.stateTip === d1.stateTip);
  ok('a stopped array is left to the list, which holds the assignments', R.readArray(tbody(STOPPED)).offline);

  const pool = R.readPool(tbody(POOL));
  ok('a pool: its name, status, browse link and file system', pool.key === 'cache' && pool.name === 'Cache' && pool.status === 'ONLINE' && pool.browse === '/Main/Browse?dir=/mnt/cache' && pool.fs.fs === 'btrfs' && pool.fs.used === '811 GB');
  ok('its members, an NVMe stick and a SATA SSD', pool.disks.length === 2 && pool.disks[0].kind === 'nvme' && pool.disks[1].kind === 'ssd' && pool.disks[1].down);
  ok('a decimal comma reads as a decimal', pool.disks[0].wr === 53500);
  ok('the pool summary link is not taken for the settings link', pool.disks[0].href === '/Main/Device?name=cache');

  const boot = R.readBoot(tbody(BOOT));
  ok('the boot flash is a USB stick without a spin control', boot.disks.length === 1 && boot.disks[0].kind === 'usb' && !boot.disks[0].spin && boot.disks[0].href === '/Main/Boot?name=flash');
  ok('the internal boot hint is kept as a note', boot.notes.length === 1);

  const ud = R.readUd(tbody(UD));
  const u = ud.disks[0];
  ok('Unassigned Devices: one disk with its name and device', ud.disks.length === 1 && u.name === 'Elements' && u.dev === 'sdh' && u.kind === 'hdd' && !ud.unknown);
  ok('it spins down through UD\'s own call', JSON.stringify(u.spin) === JSON.stringify({ fn: 'spinDownDisk', args: ['sdh'] }) && !u.down);
  ok('the browse link comes from its partition row', u.browse === '/Main/Browse?dir=/mnt/disks/Elements');
  ok('usage, rate and temperature', u.fs && u.fs.fs === 'ntfs' && u.fs.used === '3.12 TB' && u.rd === 1.2e6 && u.temp.c === 31 && u.serial === 'TESTUD01');
  const none = R.readUd(tbody(UD_NONE));
  ok('no disks: UD\'s own notice is kept', none.disks.length === 0 && !none.unknown && none.notice === 'No Unassigned Disks available.');
  ok('an empty table is left to UD until it has answered', R.readUd(tbody('')).unknown);
}

console.log('\nThe actions run only the row\'s own calls');
{
  const calls = [];
  const win = { toggle_state: (...a) => calls.push(['toggle_state', ...a]), openTerminal: (...a) => calls.push(['openTerminal', ...a]), spinDownDisk: (...a) => calls.push(['spinDownDisk', ...a]), alert: () => calls.push(['alert']) };
  const loc = { href: '/Main' };
  const R = load({ window: win, location: loc });
  const d1 = R.readArray(tbody(DISK1)).disks[0];
  const card = { classList: { add() {} }, __ccDisk: d1 };
  R.act('spin', card);
  ok('spin calls toggle_state(\'Device\', \'disk1\', \'up\')', JSON.stringify(calls.pop()) === JSON.stringify(['toggle_state', 'Device', 'disk1', 'up']));
  R.act('log', card);
  ok('the log calls openTerminal(\'disklog\', \'sdf\', \'\')', JSON.stringify(calls.pop()) === JSON.stringify(['openTerminal', 'disklog', 'sdf', '']));
  R.act('browse', card);
  ok('browse goes where the row\'s browse link goes', loc.href === '/Main/Browse?dir=/mnt/disk1');
  const u = R.readUd(tbody(UD)).disks[0];
  R.act('spin', { classList: { add() {} }, __ccDisk: u });
  ok('a UD disk spins down through spinDownDisk(\'sdh\')', JSON.stringify(calls.pop()) === JSON.stringify(['spinDownDisk', 'sdh']));
  ok('a handler outside the list is never parsed', R.parseCall("alert('x')") === null && R.parseCall('disk_op(this, "umount", "sdh")') === null);

  // A click on the card opens the settings page; one on a badge runs the badge and not the link.
  const tree = parse('<div class="cc-dk-card"><span class="cc-dk-ib" data-act="spin">x</span><span class="cc-info">i</span><b>y</b></div>');
  const cardEl = tree.children[0];
  cardEl.__ccDisk = d1; cardEl.classList = { add() {} };
  const ev = (t) => ({ target: t, stopPropagation() {} });
  loc.href = '/Main';
  R.onClick(ev(cardEl.children[2]));
  ok('a click on the card opens the disk\'s settings', loc.href === '/Main/Device?name=disk1');
  loc.href = '/Main';
  R.onClick(ev(cardEl.children[0]));
  ok('a click on the spin badge spins and stays on the page', loc.href === '/Main' && JSON.stringify(calls.pop()) === JSON.stringify(['toggle_state', 'Device', 'disk1', 'up']));
  R.onClick(ev(cardEl.children[1]));
  ok('a click on the bubble stays on the page', loc.href === '/Main');
}

console.log('\nThe view: one switch and one key for the whole page');
{
  const store = {};
  const R = load({ g: (k, d) => (k in store ? store[k] : d) });
  ok('unset, the page shows tiles', R.view() === 'tiles');
  store['cc.diskview'] = 'list';
  ok('cc.diskview = list shows the list', R.view() === 'list');
  store['cc.diskview.pools'] = 'tiles';
  ok('a key left from a per-section switch changes nothing', R.view() === 'list');
  ok('the page switch writes cc.diskview', /s\(KEY, o\[0\]\)/.test(js) && /var KEY = "cc\.diskview";/.test(js) && !/KEY \+ "\."/.test(js));
  ok('there is one switch, at the right end of the tab bar before Unraid\'s own controls', /nav\.insertBefore\(sw, nav\.querySelector\(":scope > span\.status"\)\)/.test(js) && (js.match(/el\("div", "cc-dk-vsw"\)/g) || []).length === 1);
  const settings = read('scripts/settings.js');
  const row = grabFn(settings, 'diskViewRow');
  ok('the settings row writes the same key and nothing else', /set\("cc\.diskview", v\);/.test(row) && !/del\(/.test(row));
  ok('its bubble points to the switch on the page', /Der Schalter oben im Tab Start stellt dasselbe um\./.test(row) && /The switch at the top of the Main tab changes the same setting\./.test(row));
  ok('it offers Liste and Kacheln with the view glyphs', /\[\["list", T\("Liste", "List"\), "IconViewList"\], \["tiles", T\("Kacheln", "Tiles"\), "IconViewGrid"\]\]/.test(row));
  ok('it has a bubble and a preview right under its selector', /, help\)\);/.test(row) && /viewPreview\(opts, diskSketch\)/.test(row) && /c\.appendChild\(slot\); c\.appendChild\(prev\.el\);/.test(row));
  ok('a section shows "Ruht" only for a spun-down disk, never an active chip', /if \(d\.down\) h \+= '<span class="cc-dk-chip">' \+ glyph\("Moon"\) \+ esc\(t\("resting"\)\)/.test(js) && !/Aktiv/.test(js));
}

console.log('\nThe tile view hides the table controls');
{
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const hide = /([^{}]+)\{\s*display: none !important; \}/g;
  const hidden = [];
  let m;
  while ((m = hide.exec(rules))) hidden.push(...splitTop(m[1]).map((x) => x.trim()));
  ok('Unraid\'s span.status in the tab bar goes in the tile view', hidden.includes('html.cc-dk-on.cc-dk-tiled #displaybox nav.tabs > span.status'));
  // Shares.css shows it in section view with html.cc-shares-on.cc-on-main.cc-sections-main, four classes.
  ok('in section view the hide outranks Shares.css', hidden.includes('html.cc-dk-on.cc-dk-tiled.cc-on-main.cc-sections-main #displaybox .cc-card-head > span.status'));
  ok('only while no disk table of the array, the pools or the boot device shows', /root\.classList\.toggle\("cc-dk-tiled", tiles && !all\.some\(function \(S\) \{\s*return S\.key !== "ud"/.test(js));
  ok('Unassigned Devices keeps its controls, which still act on the tiles', !/cc-ud-ctrls/.test(rules));
}

console.log('\nSmall pools and the boot device share a row');
{
  ok('a pool of three or more devices fills a row alone', /\(p\.disks\.length > 2 \? big : small\)\.push\(box\)/.test(js));
  ok('the boot device joins the small pools under its section title', /small\.push\(group\(wrap, "data-boot", "1", boot\.title/.test(js));
  ok('only in section view, where its own section can step aside', /root\.classList\.contains\("cc-sections-main"\)/.test(js) && /html\.cc-dk-on\.cc-on-main\.cc-sections-main #displaybox section\[role="tabpanel"\]\.cc-dk-merged \{ display: none !important; \}/.test(css));
  ok('a pool in the shared row gets one column per device', /grid\.style\.setProperty\("--cc-dk-n", items\.length\)/.test(js) && /repeat\(var\(--cc-dk-n, 1\), 260px\)/.test(css));
  ok('on a phone every card takes the full width', /@media \(max-width: 600px\) \{[^@]*\.cc-dk-pool\.cc-dk-big \.cc-dk-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(css));

  const R = load({});
  const node = (id) => ({ id, parentNode: null });
  const parent = { children: [] };
  parent.insertBefore = (c, ref) => { if (c.parentNode) c.parentNode.removeChild(c); const i = ref ? parent.children.indexOf(ref) : parent.children.length; parent.children.splice(i, 0, c); c.parentNode = parent; };
  parent.removeChild = (c) => { parent.children.splice(parent.children.indexOf(c), 1); c.parentNode = null; };
  Object.defineProperty(parent, 'lastChild', { get: () => parent.children[parent.children.length - 1] });
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(node);
  [a, b, c].forEach((n) => parent.insertBefore(n, null));
  R.order(parent, [c, a, d]);
  ok('the rows keep the order they are given and lose what is left over', parent.children.map((n) => n.id).join('') === 'cad');
}

console.log('\ndisks.php reads emhttp\'s own files');
{
  let php = null;
  try { execFileSync('php', ['-v'], { stdio: 'ignore' }); php = 'php'; } catch (e) {}
  if (!php) ok('php is not installed here, so the endpoint check is skipped', true);
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-disks-'));
    fs.mkdirSync(path.join(tmp, 'smart'));
    fs.writeFileSync(path.join(tmp, 'disks.ini'), '["parity"]\nname="parity"\ndevice="sde"\nrotational="1"\n["disk1"]\nname="disk1"\ndevice="sdf"\nrotational="1"\nhotTemp="40"\nmaxTemp="50"\n["cache"]\nname="cache"\ndevice="nvme0n1"\nrotational="0"\n["disk2"]\nname="disk2"\ndevice="sdd"\nrotational="1"\n');
    const head = 'smartctl 7.4\n\n=== START OF READ SMART DATA SECTION ===\n';
    const table = 'ID# ATTRIBUTE_NAME          FLAG     VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE\n';
    fs.writeFileSync(path.join(tmp, 'smart', 'parity'), head + 'SMART overall-health self-assessment test result: PASSED\n\n' + table + '  5 Reallocated_Sector_Ct   0x0033   100   100   005    Pre-fail  Always       -       0\n  9 Power_On_Hours          0x0012   098   098   000    Old_age   Always       -       19756\n');
    fs.writeFileSync(path.join(tmp, 'smart', 'disk1'), head + 'SMART overall-health self-assessment test result: PASSED\n\n' + table + '  5 Reallocated_Sector_Ct   0x0033   100   100   005    Pre-fail  Always       -       8\n');
    fs.writeFileSync(path.join(tmp, 'smart', 'disk2'), head + 'SMART overall-health self-assessment test result: FAILED!\n\n' + table + '  5 Reallocated_Sector_Ct   0x0033   100   100   005    Pre-fail  Always       -       8\n');
    fs.writeFileSync(path.join(tmp, 'smart', 'cache'), head + 'SMART overall-health self-assessment test result: PASSED\n\nPercentage Used:                    7%\nPower On Hours:                     1,215\n');
    fs.writeFileSync(path.join(tmp, 'monitor.ini'), '');
    fs.writeFileSync(path.join(tmp, 'dynamix.cfg'), '[display]\nhot="46"\nmax="56"\n');
    const run = () => JSON.parse(execFileSync(php, ['-n', path.join(DIR, 'server', 'disks.php')], { env: Object.assign({}, process.env, { CC_EMHTTP: tmp, CC_DYNAMIX_CFG: path.join(tmp, 'dynamix.cfg'), CC_DYNAMIX_DEFAULT: path.join(tmp, 'none.cfg') }) }).toString());
    let out = run();
    ok('a passing disk is ok, with its power-on hours and the display thresholds', out.sde && out.sde.smart === 'ok' && out.sde.hours === 19756 && out.sde.hot === 46 && out.sde.max === 56, JSON.stringify(out.sde));
    ok('a reallocated sector is a warning that names the attribute', out.sdf && out.sdf.smart === 'warn' && /Reallocated Sector Ct: 8/.test(out.sdf.tip), JSON.stringify(out.sdf));
    ok('a disk\'s own thresholds win', out.sdf.hot === 40 && out.sdf.max === 50);
    ok('a failed self-assessment is a failure', out.sdd && out.sdd.smart === 'fail', JSON.stringify(out.sdd));
    ok('an NVMe disk reports its wear and hours, with the SSD thresholds', out.nvme0n1 && out.nvme0n1.wear === 7 && out.nvme0n1.hours === 1215 && out.nvme0n1.hot === 60 && out.nvme0n1.max === 70, JSON.stringify(out.nvme0n1));
    fs.writeFileSync(path.join(tmp, 'monitor.ini'), '[smart]\ndisk1.ack="true"\n');
    out = run();
    ok('an acknowledged warning stays quiet', out.sdf.smart === 'ok', JSON.stringify(out.sdf));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
