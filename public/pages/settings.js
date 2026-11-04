// pages/settings.js — Settings page: company, categories, storage, bank accounts, cheque formats, bank matching/splitting
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, F, esc, post, toast } from '../lib/dom.js';
import { f, rd } from '../lib/format.js';
import { D, acc, load, render } from '../lib/state.js';

export async function rebuildFiles() {
  if (!confirm('Rewrite the Excel files of every voucher and bill from this app\'s data? Files with the same names in the storage folder are replaced.')) return;
  const j = await post('/api/rebuild-files', { missing: $('#rbm').checked, from: $('#rbf').value }); if (!j) return; await load();
  alert(j.vouchers + ' voucher file(s) and ' + j.bills + ' bill file(s) rebuilt.' + (j.orphanCount ? '\n\n' + j.orphanCount + ' file(s) in the folder do not belong to any voucher here (maybe made by another copy). They were left alone:\n' + j.orphans.slice(0, 25).join(', ') + (j.orphanCount > 25 ? ', …' : '') : ''));
}

export async function addCat() { const j = await post('/api/categories', { name: F('newcat') }); if (j) load(); }

export async function delCat(i) { if (!confirm('Remove this category from the list? Existing entries keep their accounts.')) return; await fetch('/api/categories/' + encodeURIComponent(D.settings.categories[i]), { method: 'DELETE' }); load(); }

// ---- Bank accounts and cheque number formats ----
// Same rule as server.js: a cheque number fits a bank when one run of digits in it matches the format (7895xxxx: x = any digit; digits only = "starts with").
export const fmtParts = f => String(f || '').split(/[,;]+/).map(x => x.toLowerCase().replace(/[\s-]/g, '').replace(/[#*?]/g, 'x')).filter(Boolean).map(s => ({ s, pre: !s.includes('x') }));

export const fmtHit = (p, run) => p.pre ? run.startsWith(p.s) : run.length === p.s.length && [...p.s].every((c, i) => c === 'x' || c === run[i]);

export function bankCard() {
  const B = D.db.banks || [], e = B.find(b => b.ledger == window.bke), bkey = window.bke || ''; if (!window.bkfs || window.bkfsFor !== bkey) { window.bkfs = e ? fmtParts(e.chequeFormat).map(p => p.s) : []; window.bkfsFor = bkey; }
  const free = D.accounts.filter(a => a.type == 'A' && (/bank/i.test(a.name) || a.group == 'Bank Accounts') && !B.some(b => b.ledger == a.code));
  return `<div class="card" id="bkcard"><div class="ch"><h2>Bank accounts</h2><span class="sub" style="margin:0">Pick one under “Paid from” on Payments made and Salary payment</span></div>
    <div class="row"><label>Bank name<input id="bkn" value="${esc(e ? e.bank : '')}" placeholder="e.g. Nabil Bank"></label><label>Account no.<input id="bka" value="${esc(e ? e.account : '')}"></label>
      <div class="fld w2"><span>Cheque no. formats <small>(one for each cheque book)</small></span><div id="bkfc" style="display:flex;gap:6px;flex-wrap:wrap;min-height:26px;align-items:center">${bkfChips()}</div>
        <div style="display:flex;gap:8px"><input id="bkf" placeholder="e.g. 7895xxxx, then Enter" onkeydown="bkfKey(event)" onblur="bkfAdd(true)"><button type="button" style="white-space:nowrap" onclick="bkfAdd()">Add format</button></div></div>
      ${!e && free.length ? `<label>Ledger account<select id="bkl"><option value="">Create a new one</option>${free.map(a => `<option value="${a.code}">Use existing: ${esc(a.name)}</option>`).join('')}</select></label>` : ''}
      <div><button class="p" onclick="saveBank()">${e ? 'Update bank account' : 'Add bank account'}</button>${e ? ' <button onclick="window.bke=null;window.bkfs=null;render()">Cancel</button>' : ''}</div></div>
    <p class="sub" style="margin:4px 0 14px"><small>Cheque no. format: type the digits that are the same on every cheque of that bank and <b>x</b> for the digits that change, e.g. <b>7895xxxx</b>. A bank can have <b>several formats</b>, one for each cheque book: type one and press Enter (or Add format), then add the next, e.g. 7895xxxx and 4410xxxx; typing digits only (7895) means “starts with 7895”. It is used to pick the bank when you type a cheque number, and to update old records below. Each bank account gets its own ledger account, so it shows in the ledger, trial balance and balance sheet.</small></p>
    <div class="tw"><table><thead><tr><th>Bank</th><th>Account no.</th><th>Cheque no. formats</th><th>Ledger account</th><th></th></tr></thead><tbody>${B.map(b => `<tr><td><b>${esc(b.bank)}</b></td><td>${esc(b.account)}</td><td>${fmtParts(b.chequeFormat).map(p => `<span class="chip" style="margin:0 4px 4px 0" title="${esc(fmtHint(p.s))}">${esc(p.s)}</span>`).join('') || '—'}</td><td>${esc((acc(b.ledger) || {}).name || '')}<br><small>${esc(b.ledger)}</small></td><td class="act"><button onclick="editBank('${b.ledger}')">Edit</button> <button class="d" onclick="delBank('${b.ledger}')">Remove</button></td></tr>`).join('') || '<tr><td class="empty" colspan="5">No bank accounts yet.</td></tr>'}</tbody></table></div></div>`;
}

export async function saveBank() { if (!bkfAdd()) return; const e = window.bke, j = await post('/api/banks' + (e ? '/' + e : ''), { bank: F('bkn'), account: F('bka'), chequeFormat: window.bkfs.join(', '), ledger: e || !$('#bkl') ? '' : F('bkl') }, e ? 'PUT' : 'POST'); if (!j) return; window.bke = null; window.bkfs = null; await load(); toast('Bank account ' + (e ? 'updated' : 'added') + ': ' + j.name); }

export function editBank(code) { window.bke = code; window.bkfs = null; render(); $('#bkcard').scrollIntoView({ block: 'start' }); $('#bkn').focus(); }

export async function delBank(code) { if (!confirm('Remove this bank account from the list? Payments already made from it keep their ledger account.')) return; const r = await fetch('/api/banks/' + encodeURIComponent(code), { method: 'DELETE' }), j = await r.json(); if (!r.ok) return alert(j.error); if (window.bke == code) { window.bke = null; window.bkfs = null; } await load(); toast(j.kept ? 'Removed from the list. Its ledger account is kept because it has entries.' : 'Bank account removed.'); }

export async function bankScan() { const r = await fetch('/api/bank-match'); window.bm = await r.json(); render(); $('#bmcard').scrollIntoView({ block: 'start' }); }

export async function bankApply() {
  if (!confirm(window.bm.change.length + ' cheque payment(s) will be moved to the bank account their cheque number belongs to. Amounts and dates stay the same; only the “paid from” account changes.\n\nA backup of data.json is made first. Continue?')) return;
  const j = await post('/api/bank-match', {}); if (!j) return; window.bm = null; await load(); toast(j.moved + ' payment(s) moved to their bank account' + (j.files ? ', ' + j.files + ' voucher Excel file(s) refreshed' : '') + (j.skipped ? '. ' + j.skipped + ' skipped (no bank line found)' : '') + (j.backup ? '. Backup: data.json.bak-' + j.backup : ''));
}

export function bankMatchCard() {
  const m = window.bm, rows = (L, cols) => `<div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Paid to</th><th>Cheque no.</th><th class="n">Amount</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${L.map(r => `<tr><td>${r.date}${r.bs ? '<br><small>' + esc(r.bs) + '</small>' : ''}</td><td><b>${r.no}</b></td><td>${esc(r.who)}</td><td>${esc(r.cheque) || '—'}</td><td class="n">${f(r.amount)}</td>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const more = (L, t, cols) => L.length ? `<details style="margin:10px 0 0"><summary style="cursor:pointer;font-weight:600;font-size:13px">${L.length} ${t}</summary>${rows(L, cols)}</details>` : '';
  const body = !m ? '' : !m.banks ? '<p class="sub" style="margin:12px 0 0">Add a cheque no. format to at least one bank account above first.</p>' : `<div style="margin-top:14px">
    <p class="sub" style="margin:0 0 10px"><b>${m.change.length}</b> cheque payment(s) will move to the bank their cheque number belongs to. <b>${m.check.length}</b> need your check and <b>${m.none.length}</b> have no matching bank; those are left as they are.</p>
    ${m.change.length ? rows(m.change, [['Now', r => esc(r.from)], ['Will be', r => '<b>' + esc(r.to) + '</b>']]) : '<p class="sub" style="margin:0">Nothing to move: every cheque that fits a bank format is already on that bank.</p>'}
    ${more(m.check, 'to check', [['Paid from', r => esc(r.from)], ['Why', r => esc(r.note)]])}${more(m.none, 'with no matching bank', [['Paid from', r => esc(r.from)], ['Why', r => esc(r.note)]])}
    <div class="actbar">${m.change.length ? `<button class="p" onclick="bankApply()">Move ${m.change.length} payment(s)</button>` : ''}<button onclick="window.bm=null;render()">Close</button></div></div>`;
  return `<div class="card" id="bmcard"><div class="ch"><h2>Match old cheque payments to banks</h2></div><p class="sub" style="margin:0 0 10px">Looks at every old payment made and salary payment paid by cheque and, using the cheque no. formats above, works out which bank account it came from. You see the list first; nothing changes until you press Move. Ledgers, trial balance and the voucher Excel files are updated, and a backup of data.json is made first. Run it again any time, for example after adding another bank.</p><button onclick="bankScan()">Check old cheque payments</button>${body}</div>`;
}

// ---- Several cheque number formats for one bank (chips) ----
export const fmtHint = s => s.includes('x') ? `Any ${s.length}-digit cheque number that matches ${s} (x = any digit)` : `Any cheque number starting with ${s}`;

export const bkfChips = () => (window.bkfs || []).map((s, i) => `<span class="chip" title="${esc(fmtHint(s))}">${esc(s)} <a href="#" title="Remove this format" onclick="bkfDel(${i});return false">×</a></span>`).join(' ') || '<small>No format yet</small>';

export function bkfAdd(silent) {
  const el = $('#bkf'); if (!el) return true; const parts = fmtParts(el.value); if (!parts.length) return true;
  if (parts.some(p => !/^[0-9x]+$/.test(p.s) || !/\d/.test(p.s))) { if (!silent) alert('A cheque number format can only contain digits and x, for example 7895xxxx'); return false; }
  parts.forEach(p => { if (!window.bkfs.includes(p.s)) window.bkfs.push(p.s); }); el.value = ''; $('#bkfc').innerHTML = bkfChips(); return true;
}

export function bkfDel(i) { window.bkfs.splice(i, 1); $('#bkfc').innerHTML = bkfChips(); }

export function bkfKey(e) { if (e.key == 'Enter' || e.key == ',') { e.preventDefault(); bkfAdd(); } }

// ---- Old payments with several cheque numbers from different banks in one voucher: type each cheque's amount, then split ----
export async function splitScanUI() { window.bsp = await (await fetch('/api/bank-split')).json(); render(); $('#bspcard').scrollIntoView({ block: 'start' }); }

export function splitSum(id) {
  const r = window.bsp.rows.find(x => x.id == id), ins = [...document.querySelectorAll(`[data-sv="${id}"]`)], sum = rd(ins.reduce((t, i) => t + (+i.value || 0), 0)), o = $('#bsr' + id);
  o.innerHTML = !sum ? '<small>Type each cheque’s amount</small>' : Math.abs(sum - r.total) < .005 ? '<span class="chip ok">Adds up</span>' : `<small style="color:var(--err)">${f(sum)} entered · ${f(r.total - sum)} ${sum > r.total ? 'too much' : 'to go'}</small>`;
}

export function splitType(el, id) {
  const r = window.bsp.rows.find(x => x.id == id), ins = [...document.querySelectorAll(`[data-sv="${id}"]`)]; el.dataset.auto = '';
  if (ins.length == 2) { const o = ins.find(i => i !== el); if (!o.value || o.dataset.auto) { const v = rd(r.total - (+el.value || 0)); o.value = el.value && v > 0 ? v : ''; o.dataset.auto = '1'; } } // two cheques: the second is filled in with what is left
  splitSum(id);
}

export async function bankSplitApply() {
  const items = [];
  for (const r of window.bsp.rows) {
    const vals = [...document.querySelectorAll(`[data-sv="${r.id}"]`)].map(i => ({ cheque: i.dataset.ch, amount: +i.value || 0 })); if (!vals.some(v => v.amount)) continue;
    if (vals.some(v => v.amount <= 0)) return alert(`Enter an amount for every cheque of ${r.no}, or clear them all to leave it for later.`);
    const sum = rd(vals.reduce((t, v) => t + v.amount, 0)); if (Math.abs(sum - r.total) > .004) return alert(`${r.no}: the cheques add up to ${f(sum)} but the payment is ${f(r.total)}.`);
    items.push({ id: r.id, parts: vals });
  }
  if (!items.length) return alert('Type the amount of each cheque first. Payments left empty stay as they are.');
  if (!confirm(items.length + ' payment(s) will be split so each cheque is booked to its own bank account. The supplier, total amount and date stay the same; only the “paid from” side is divided.\n\nA backup of data.json is made first. Continue?')) return;
  const j = await post('/api/bank-split', { items }); if (!j) return; window.bsp = null; await load(); toast(j.split + ' payment(s) split by bank' + (j.files ? ', ' + j.files + ' voucher Excel file(s) refreshed' : '') + '. Backup: data.json.bak-' + j.backup);
}

export function bankSplitCard() {
  const m = window.bsp,
    amt = (r, p) => `<div style="margin:0 0 8px"><b>${esc(p.cheque)}</b> <small>· ${esc(p.bank)}</small><br><input type="number" step="any" placeholder="Amount" style="width:150px;margin-top:3px" data-sv="${r.id}" data-ch="${esc(p.cheque)}" oninput="splitType(this,${r.id})"></div>`,
    who = r => `<td>${r.date}${r.bs ? '<br><small>' + esc(r.bs) + '</small>' : ''}</td><td><b>${r.no}</b></td><td>${esc(r.who)}<br><small>Cheque field: ${esc(r.ref)}</small></td>`,
    body = !m ? '' : m.error ? `<p class="sub" style="margin:12px 0 0;color:var(--err)">The server did not understand this request (${esc(m.error)}). It is probably still running the old server.js: replace it with the new server.js, stop the server and start it again with <b>node server.js</b>, then press Check old payments.</p>` : m.banks < 2 ? '<p class="sub" style="margin:12px 0 0">Add a cheque no. format to at least two bank accounts above first.</p>' : `<div style="margin-top:14px">
      <p class="sub" style="margin:0 0 10px"><b>${m.rows.length}</b> payment(s) can be split. ${m.check.length ? `<b>${m.check.length}</b> need a look by hand.` : ''}</p>
      ${m.rows.length ? `<div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Paid to</th><th>Now paid from</th><th class="n">Payment</th><th>Cheques and their amounts</th><th></th></tr></thead><tbody>${m.rows.map(r => `<tr>${who(r)}<td>${esc(r.from)}</td><td class="n">${f(r.total)}</td><td>${r.parts.map(p => amt(r, p)).join('')}</td><td id="bsr${r.id}"><small>Type each cheque’s amount</small></td></tr>`).join('')}</tbody></table></div>` : '<p class="sub" style="margin:0">No old payment has cheque numbers from different banks in one voucher.</p>'}
      ${m.check.length ? `<details style="margin:10px 0 0"><summary style="cursor:pointer;font-weight:600;font-size:13px">${m.check.length} to check by hand</summary><div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Paid to</th><th class="n">Payment</th><th>Why</th></tr></thead><tbody>${m.check.map(r => `<tr>${who(r)}<td class="n">${f(r.total)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      <div class="actbar">${m.rows.length ? '<button class="p" onclick="bankSplitApply()">Split the payments I filled in</button>' : ''}<button onclick="window.bsp=null;render()">Close</button></div></div>`;
  return `<div class="card" id="bspcard"><div class="ch"><h2>Split old payments made with several cheques</h2></div><p class="sub" style="margin:0 0 10px">Finds old payments where one voucher lists cheque numbers from <b>different banks</b> (for example “7895001, 4410002”). Each cheque is matched to its bank by the formats above; you type the amount of each cheque, and the payment is split so every bank’s ledger shows its own cheque. The supplier, total, date and bill stay the same. Payments you leave empty are not touched, and a backup of data.json is made first.</p><button onclick="splitScanUI()">Check old payments</button>${body}</div>`;
}

export function fonepayCard() {
  const L = D.vouchers.filter(v => (v.pmt || v.sal) && (v.pmt || v.sal).mode == 'Fonepay' && (v.pmt || v.sal).fee === undefined).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return `<div class="card"><div class="ch"><h2>Fonepay charges to update</h2><button class="sp" onclick="getFile('/api/xlsx/fonepay')">Download list (Excel)</button></div><p class="sub" style="margin:0 0 10px">Payments made and salary payments paid by Fonepay before the charge field existed. Type the charge you paid (0 if there was none) and press Save. The payment is re-posted in the ledgers, day book and income statement, and the row leaves this list.</p>
  <div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Paid to</th><th class="n">Amount</th><th style="width:150px">Fonepay charge</th><th></th></tr></thead><tbody>${L.map(v => { const p = v.pmt || v.sal; return `<tr><td>${v.date}${v.bs ? '<br><small>' + esc(v.bs) + '</small>' : ''}</td><td><b>${v.no}</b>${v.sal ? '<br><small>Salary</small>' : ''}</td><td>${esc(v.sal ? p.staff : p.other ? p.payee : p.supplier)}${p.instrument ? '<br><small>' + esc(p.instrument) + '</small>' : ''}</td><td class="n">${f(p.amount)}</td><td><input id="ff${v.id}" type="number" step="any" placeholder="0.00" onkeydown="if(event.key=='Enter')saveFee(${v.id})"></td><td class="act"><button class="p" onclick="saveFee(${v.id})">Save</button> <button onclick="editV(${v.id})">Edit</button></td></tr>`; }).join('') || '<tr><td class="empty" colspan="6">No Fonepay payments need updating.</td></tr>'}</tbody></table></div></div>`;
}

export async function saveFee(id) { const el = $('#ff' + id), v = D.vouchers.find(x => x.id == id); if (el.value === '') return alert('Enter the Fonepay charge (0 if there was none).'); const r = await fetch('/api/' + (v.sal ? 'salaries/' : 'payments/') + id + '/fee', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fee: +el.value }) }), j = await r.json(); if (!r.ok) return alert(j.error); await load(); toast('Fonepay charge saved for ' + j.no); }

export async function saveSettings() {
  const own = (D.settings || {}).folderOwner, same = own && !own.ok && F('sf') == D.settings.folder; // the folder is marked as belonging to another copy of the app
  if (same && !confirm('This storage folder is marked as used by another copy of the app:\n' + own.owner + '\n\nTake it over for THIS copy? Only do this if the other copy is no longer used (for example you moved the project folder). Otherwise press Cancel and choose a different folder.')) return;
  const j = await post('/api/settings', { takeOver: !!same, folder: F('sf'), auto: { jv: $('#aj').checked, pv: $('#av').checked, pmv: $('#apm').checked, stm: $('#ast').checked, sv: $('#as').checked, rv: $('#arv').checked, registers: $('#ar').checked, tb: $('#at').checked, pl: $('#ap').checked, bs: $('#ab').checked }, company: { name: F('cn'), vat: F('cv'), addr: F('ca'), tel: F('ct'), email: F('ce') } }); if (j) { await load(); toast('Settings saved' + (j.folder ? '. Folders ready in ' + j.folder : '. No storage folder set, so nothing will be auto-saved.')); }
}

export const settings = () => {
  const s = D.settings, c = s.company, chk = (id, k, sub) => `<label class="chk"><input type="checkbox" id="${id}" ${s.auto[k] ? 'checked' : ''}> Auto-save <b>${sub}</b></label>`;
  return `<div class="card"><div class="ch"><h2>Storage folder</h2></div>${s.folderOwner && !s.folderOwner.ok ? `<div style="background:#fdecea;border:1px solid #f1b5ae;color:#8a1f13;border-radius:8px;padding:10px 12px;margin:0 0 12px;font-size:13px"><b>This folder belongs to another copy of the app</b> (${esc(s.folderOwner.owner)}). This copy is not writing or deleting any files there. Choose a different folder, or if you moved the project, press <b>Save settings</b> to take the folder over.</div>` : ''}<div class="row"><label class="w4">Folder on this computer (full path)<input id="sf" value="${esc(s.folder)}" placeholder="/home/you/Documents/Accounts"></label></div>
    <div class="row" style="margin-top:10px">${chk('aj', 'jv', 'JV')}${chk('av', 'pv', 'PV')}${chk('apm', 'pmv', 'PMV')}${chk('ast', 'stm', 'Statements')}${chk('as', 'sv', 'SV')}${chk('arv', 'rv', 'RV')}${chk('ar', 'registers', 'Registers')}${chk('at', 'tb', 'TrialBalance')}${chk('ap', 'pl', 'IncomeStatement')}${chk('ab', 'bs', 'BalanceSheet')}</div>
    <p class="sub" style="margin:10px 0 0"><small>Sub-folders created inside it automatically: ${s.folders.join(', ')}. Journal vouchers and sales bills are saved here when you create them. With a switch on, every Excel button for that item saves into this folder instead of your browser's Downloads folder; with it off (or no folder set), the browser downloads it as usual. A browser cannot browse folders for the server, so type the path.</small></p>
    <div class="actbar" style="margin-top:10px"><button onclick="rebuildFiles()" ${s.folder && !(s.folderOwner && !s.folderOwner.ok) ? '' : 'disabled'}>Rebuild Excel files from this data</button><label style="display:inline-flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="rbm" style="width:auto"> Also create files that are missing</label><label style="display:inline-flex;gap:6px;align-items:center;font-size:13px">Only vouchers and bills dated from <input type="date" id="rbf" style="width:auto"> <small>(leave empty for all)</small></label></div>
    <p class="sub" style="margin:6px 0 0"><small>Use this to repair the voucher and bill files in the folder, for example if another copy of the app overwrote them. Each file is rewritten from this app's data, so it always matches the ledger.</small></p></div>
    <div class="card"><div class="ch"><h2>Categories</h2><span class="sub" style="margin:0">Shown on purchase and sales bills</span></div><p>${s.categories.map((c, i) => `<span class="chip" style="margin:0 6px 6px 0">${esc(c)} <a href="#" title="Remove" onclick="delCat(${i});return false">×</a></span>`).join('')}</p>
    <div class="row" style="grid-template-columns:minmax(170px,260px) auto;justify-content:start"><label>Add category (e.g. Visa)<input id="newcat"></label><button onclick="addCat()">Add</button></div><p class="sub" style="margin:8px 0 0"><small>Each category gets its own "&lt;name&gt; Purchase" and "&lt;name&gt; Sales" accounts the first time it is used. Removing one only takes it off the list; old entries keep their accounts.</small></p></div>
    ${bankCard()}${bankMatchCard()}${bankSplitCard()}
    <div class="card"><div class="ch"><h2>Company</h2><span class="sub" style="margin:0">Printed on Excel bills and registers</span></div><div class="row">${[['cn', 'Name', c.name, 'w2'], ['cv', 'PAN/VAT no.', c.vat, ''], ['ca', 'Address', c.addr, 'w2'], ['ct', 'Phone', c.tel, ''], ['ce', 'Email', c.email, '']].map(([id, l, v, w]) => `<label class="${w}">${l}<input id="${id}" value="${esc(v)}"></label>`).join('')}</div></div>
    ${fonepayCard()}<div class="card"><div class="ch"><h2>Update old records</h2></div><p class="sub" style="margin:0 0 10px">Salaries you entered earlier on the Payments made page (charged to Salary &amp; Wages) are converted into salary payments and the names are added to the staff list. Totals and ledgers do not change. A backup of data.json and db.json is made first.</p><button onclick="migrateOld()">Check &amp; update old records</button></div>
    <button class="p" onclick="saveSettings()">Save settings</button>`;
};
