// lib/state.js — shared state (D, tab, period), tab/nav config, load() and render()
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, esc, applySide, setSideForce } from './dom.js';
import { fillParty, pcalc, scalc } from '../pages/bills-forms.js';
import { V } from '../pages/index.js';
import { recFilter } from '../pages/records.js';
import { loadStmt } from '../pages/statement-forms.js';
import { addLine, calc } from '../pages/voucher.js';

export let D;

export let tab = 'dash';

export const TABS = { dash: 'Dashboard', rec: 'Records', stmt: 'Statements', sal: 'Salary payment', voucher: 'New voucher', bills: 'Purchase & sales bills', rcv: 'Payments received', pay: 'Payments made', reg: 'VAT registers', daybook: 'Day book', ledger: 'Ledger', tb: 'Trial balance', pl: 'Income statement', bs: 'Balance sheet', coa: 'Accounts', parties: 'Parties', settings: 'Settings', cash: 'Cash book', refund: 'Refunds' };

export const ic = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;

export const IC = {
  dash: ic('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  rec: ic('<path d="M4 4h16v5H4z"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>'),
  stmt: ic('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'),
  sal: ic('<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1"/>'),
  voucher: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  bills: ic('<path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21Z"/><path d="M9 8h6M9 12h6"/>'),
  rcv: ic('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  pay: ic('<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  reg: ic('<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2Z"/><path d="M5 19a2 2 0 0 1 2-2h12"/><path d="M9 7h6M9 11h6"/>'),
  daybook: ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  ledger: ic('<path d="M12 6.5C10.5 5 8 4.5 3 4.5v14c5 0 7.5.5 9 2 1.5-1.5 4-2 9-2v-14c-5 0-7.5.5-9 2Z"/><path d="M12 6.5v14"/>'),
  tb: ic('<path d="M12 3v18M7 21h10"/><path d="M5 7h14"/><path d="m5 7-3 7a4 4 0 0 0 6 0Z"/><path d="m19 7-3 7a4 4 0 0 0 6 0Z"/>'),
  pl: ic('<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  bs: ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M6.5 9h2M6.5 13h2M15.5 9h2M15.5 13h2"/>'),
  coa: ic('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'),
  parties: ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>'),
  settings: ic('<path d="M3 7h9M16 7h5"/><circle cx="14" cy="7" r="2"/><path d="M3 17h5M12 17h9"/><circle cx="10" cy="17" r="2"/>'),
  cash: ic('<path d="M12 7c-2-1.5-5-2-8-2v13c3 0 6 .5 8 2 2-1.5 5-2 8-2V5c-3 0-6 .5-8 2Z"/><path d="M12 7v13"/><circle cx="8" cy="11.5" r="1.2"/><circle cx="16" cy="11.5" r="1.2"/>'),
  refund: ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>')
};

export const TSUB = {
  dash: 'How the business is doing in the selected period.',
  rec: 'Find, edit or delete anything you have entered.',
  stmt: 'Statements for suppliers, customers, staff and expenses.',
  sal: 'Record salary paid to staff.',
  voucher: 'Post a manual journal, payment or receipt voucher.',
  bills: 'Enter supplier bills and make VAT invoices for customers.',
  rcv: 'Money received from customers, and what is still due.',
  pay: 'Money paid to suppliers, and what is still owed.',
  reg: 'Purchase and sales books for your VAT return.',
  daybook: 'Every voucher in date order.',
  ledger: 'All entries for one account, with a running balance.',
  tb: 'Debit and credit balance of every account.',
  pl: 'Income, costs and profit for the period.',
  bs: 'Assets, liabilities and equity as at the end date.',
  coa: 'The accounts available in vouchers and reports.',
  parties: 'Suppliers and customers saved for the bill forms.',
  settings: 'Storage folder, categories, bank accounts and company details.',
  cash: 'Enter cash received (left) and cash paid (right), like the paper Day Book.',
  refund: 'Refunds received from suppliers and refunds paid to customers.'
};

export const NAV = [['Overview', ['dash']], ['Enter', ['voucher', 'cash', 'bills', 'refund', 'rcv', 'pay', 'sal']], ['Records', ['rec', 'stmt', 'daybook']], ['Books', ['ledger', 'reg']], ['Reports', ['tb', 'pl', 'bs']], ['Setup', ['coa', 'parties', 'settings']]];

export const NOPERIOD = ['voucher', 'bills', 'refund', 'rcv', 'pay', 'sal', 'rec', 'stmt', 'coa', 'parties', 'settings'];

export const acc = c => D.accounts.find(a => a.code == c);

export const nm = c => acc(c) ? c + ' ' + acc(c).name : c;

export const FR = () => $('#from').value;

export const TO = () => $('#to').value;

export const cum = d => d <= TO();

export const per = d => d >= FR() && d <= TO();

export const pre = d => d < FR();

export const net = (c, p) => D.vouchers.reduce((s, v) => p(v.date) ? s + v.lines.reduce((t, l) => l.account == c ? t + l.dr - l.cr : t, 0) : s, 0); // Dr - Cr

export const closing = a => net(a.code, 'ALE'.includes(a.type) ? cum : per);

export const priorPL = () => D.accounts.filter(a => 'IX'.includes(a.type)).reduce((s, a) => s + net(a.code, pre), 0); // Dr-Cr; profit = -this

export const ofType = t => D.accounts.filter(a => t.includes(a.type));

export const groups = list => [...new Set(list.map(a => a.group))];

export const hid = () => { const n = D.vouchers.filter(v => v.date < FR() || v.date > TO()).length; return n ? `<div class="warn err">${n} voucher(s) have dates outside ${FR()} to ${TO()}, so they are not fully shown here. <button onclick="showAll()">Show all dates</button></div>` : ''; };

export function quickPeriod(k) {
  const t = new Date(), p = n => String(n).padStart(2, '0'), s = (y, m, d) => y + '-' + p(m) + '-' + p(d), fy = t.getMonth() > 5 && !(t.getMonth() == 6 && t.getDate() < 16) ? t.getFullYear() : t.getFullYear() - 1; $('#pq').value = '';
  if (k == 'all') return showAll();
  const r = { fy: [s(fy, 7, 16), s(fy + 1, 7, 15)], pfy: [s(fy - 1, 7, 16), s(fy, 7, 15)], m: [s(t.getFullYear(), t.getMonth() + 1, 1), s(t.getFullYear(), t.getMonth() + 1, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())] }[k];
  if (!r) return; $('#from').value = r[0]; $('#to').value = r[1]; if (!NOPERIOD.includes(tab)) render();
}

export function showAll() { const ds = D.vouchers.map(v => v.date).sort(); if (!ds.length) return; $('#from').value = ds[0]; $('#to').value = ds[ds.length - 1]; render(); }

export const resolveAcc = t => {
  t = t.trim().toLowerCase(); if (!t) return null; const A = D.accounts;
  const ex = A.find(a => t == a.code || t == a.name.toLowerCase() || t == (a.code + ' ' + a.name).toLowerCase()) || A.find(a => a.code == t.split(' ')[0]); if (ex) return ex.code;
  const part = A.filter(a => a.name.toLowerCase().includes(t)); return part.length == 1 ? part[0].code : null;
};

export async function load() { D = await (await fetch('/api/data')).json(); render(); const o = (D.settings || {}).folderOwner; if (o && !o.ok && !window.ownWarned) { window.ownWarned = 1; alert('Warning: the storage folder (' + D.settings.folder + ') belongs to another copy of this app:\n' + o.owner + '\n\nThis copy will NOT write or delete any files there, so nothing is overwritten. If this is a copy you only wanted to try, set a different storage folder under Settings. If you moved the project, open Settings and press Save settings to take the folder over.'); } }

export function render() {
	if (tab != 'reg') { window.regOpen = null; setSideForce(null); applySide(); }
  $('#nav').innerHTML = NAV.map(([g, ks]) => `<div class="ng">${g}</div>` + ks.map(k => `<button class="${k == tab ? 'on' : ''}" title="${TABS[k]}" aria-label="${TABS[k]}"${k == tab ? ' aria-current="page"' : ''} onclick="tab='${k}';window.eb=window.ev=window.er=window.rnew=window.pye=window.pyn=window.sle=window.sls=window.slp=window.bm=window.bke=window.rfe=null;render()">${IC[k]}<span>${TABS[k]}</span></button>`).join('')).join('');
  $('#pgt').textContent = TABS[tab]; $('#pgs').textContent = TSUB[tab] || ''; document.title = TABS[tab] + ' – Lekha'; { const co = D.settings.company; $('#co').textContent = co.name || ''; $('#cov').textContent = co.vat ? 'PAN/VAT ' + co.vat : ''; } $('#period').classList.toggle('off', NOPERIOD.includes(tab));
  $('#al').innerHTML = D.accounts.map(a => `<option value="${a.code} ${esc(a.name)}">`).join('');
  const pl = t => D.db.parties.filter(p => p.type != t).map(p => `<option value="${esc(p.name)}">`).join(''); $('#pls').innerHTML = pl('customer'); $('#plc').innerHTML = pl('supplier'); $('#stf').innerHTML = D.db.staff.map(p => `<option value="${esc(p.name)}">`).join('');
  $('#m').innerHTML = (NOPERIOD.includes(tab) ? '' : hid()) + V[tab]();
  if (tab == 'voucher') { (window.ev ? window.ev.lines : [null, null]).forEach(l => addLine(l)); calc(); } if (tab == 'bills') { pcalc(); scalc(''); if (!(window.eb && window.eb.kind == 'sales')) fillParty('sc', 'sv'); } if (tab == 'rec') recFilter(); if (tab == 'stmt') loadStmt();
}

// Payments received
export const MODES = ['Cash', 'Cheque', 'Fonepay', 'Bank transfer'];

export const cashAccs = () => { const reg = new Set(((D.db || {}).banks || []).map(b => String(b.ledger))); return D.accounts.filter(a => a.type == 'A' && (/cash|bank|fonepay|wallet/i.test(a.name) || a.group == 'Bank Accounts' || reg.has(String(a.code)))); }; // every bank registered in Settings (or filed under Bank Accounts) is listed, whatever its ledger is called;

export const setTab = v => (tab = v);
