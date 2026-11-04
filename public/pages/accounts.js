// pages/accounts.js — Chart of accounts page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, esc } from '../lib/dom.js';
import { D, load } from '../lib/state.js';

export async function addAcc() {
  const g = i => $('#' + i).value, r = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: g('ac1'), name: g('ac2'), type: g('ac3'), group: g('ac4') }) });
  if (!r.ok) return alert((await r.json()).error); load();
}

export async function delAcc(code) { if (!confirm('Delete account ' + code + '?')) return; const r = await fetch('/api/accounts/' + code, { method: 'DELETE' }); if (!r.ok) return alert((await r.json()).error); load(); }

export const coa = () => `<div class="card"><div class="row" style="grid-template-columns:100px minmax(180px,1fr) 150px minmax(180px,1fr) auto"><label>Code<input id="ac1"></label><label>Name<input id="ac2"></label>
    <label>Type<select id="ac3"><option value="A">Asset</option><option value="L">Liability</option><option value="E">Equity</option><option value="I">Income</option><option value="X">Expense</option></select></label>
    <label>Group<input id="ac4" placeholder="e.g. Current Assets"></label><button class="p" onclick="addAcc()">Add account</button></div></div>
    <div class="card"><div class="tw"><table><tr><th>Code</th><th>Name</th><th>Type</th><th>Group</th><th></th></tr>${D.accounts.map(a => `<tr><td>${a.code}</td><td>${esc(a.name)}</td><td>${{ A: 'Asset', L: 'Liability', E: 'Equity', I: 'Income', X: 'Expense' }[a.type] || a.type}</td><td>${esc(a.group)}</td><td class="act">${D.vouchers.some(v => v.lines.some(l => l.account == a.code)) ? '' : `<button class="d" onclick="delAcc('${a.code}')">Delete</button>`}</td></tr>`).join('')}</table></div></div>`;
