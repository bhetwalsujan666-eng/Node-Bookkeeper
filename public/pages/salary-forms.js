// pages/salary-forms.js — Salary page actions
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, F, N, post, toast } from '../lib/dom.js';
import { f } from '../lib/format.js';
import { D, cashAccs, load, render } from '../lib/state.js';
import { chqOk, chqPick } from './payments-forms.js';

// ---- Salary payment page ----
export function lmode() { $('#lfw').hidden = $('#lmo').value != 'Fonepay'; const want = { Cash: ['cash'], Cheque: ['bank'], Fonepay: ['fonepay', 'bank'], 'Bank transfer': ['bank'] }[$('#lmo').value] || []; for (const w of want) { const a = cashAccs().find(x => x.name.toLowerCase().includes(w)); if (a) { $('#lac').value = a.code; break; } } chqPick('lin', 'lac', 'lmo'); }

export async function saveSalary() {
  if (!chqOk('lin', 'lac', 'lmo')) return; const er = window.sle, body = { staff: F('lnm'), period: F('lpr'), date: F('ldt'), bs: F('lbs'), amount: N('lam'), mode: F('lmo'), account: F('lac'), instrument: F('lin'), note: F('lnt'), debitAccount: F('lde'), fee: N('lfe') };
  const j = await post(er ? '/api/salaries/' + er.id : '/api/salaries', body, er ? 'PUT' : 'POST'); if (!j) return; window.sle = null; window.slp = null; window.sls = null; await load();
  toast('Salary ' + j.no + (er ? ' updated' : ' recorded for ' + body.staff) + (j.saved ? '\nSaved to ' + j.saved : ''), 'salary');
}

export function pickStaff(i) { window.sle = null; window.sls = D.db.staff[i].name; window.slp = { staff: D.db.staff[i].name }; render(); }

export async function saveStaff() { const j = await post('/api/db/staff', { name: F('ldn'), designation: F('ldg'), phone: F('lph'), ledger: F('ldl') }); if (j) { window.sls = j.name; await load(); toast('Staff saved'); } }

export async function delStaff(i) { if (!confirm('Remove this person from the staff list? Their past salary payments stay in the books.')) return; await fetch('/api/db/staff/' + encodeURIComponent(D.db.staff[i].name), { method: 'DELETE' }); window.sls = null; load(); }

export async function migrateOld() {
  const p = await (await fetch('/api/migrate')).json(); if (!p.salaries.length && !p.files) return toast('Nothing to update. No old salary payments or payment voucher files need converting.');
  if (!confirm((p.salaries.length ? p.salaries.length + ' payment(s) will become salary payments:\n\n' + p.salaries.map(x => x.date + '  ' + x.payee + '  ' + f(x.amount)).join('\n') : '') + (p.files ? '\n\n' + p.files + ' payment voucher Excel file(s) will be moved from the PV folder to the PMV folder.' : '') + '\n\nA backup of data.json and db.json is made first. Continue?')) return;
  const j = await (await fetch('/api/migrate', { method: 'POST' })).json(); await load(); toast(j.converted + ' payment(s) converted, ' + j.moved + ' file(s) moved to PMV. Backup files end with .bak-' + j.backup);
}

export function pickStaffByName(v) { const i = D.db.staff.findIndex(x => x.name.toLowerCase() === String(v).trim().toLowerCase()); if (i >= 0 && D.db.staff[i].name !== window.sls) { window.sls = D.db.staff[i].name; window.sle = null; window.slp = null; render(); } }
