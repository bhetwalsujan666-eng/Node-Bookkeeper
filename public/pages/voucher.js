// pages/voucher.js — New voucher page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, badAD, esc, toast } from '../lib/dom.js';
import { f, ymd } from '../lib/format.js';
import { FR, TO, load, nm, resolveAcc, setTab } from '../lib/state.js';

export const showErr = m => { $('#msg').innerHTML = `<span class="err">${esc(m)}</span>`; alert(m); };

export function addLine(l) {
  $('#ls').insertAdjacentHTML('beforeend', `<tr><td><input list="al" class="ac" placeholder="Type code or name" value="${l ? esc(nm(l.account)) : ''}" oninput="calc()"></td>
  <td class="n"><input class="dr" type="number" step="any" style="text-align:right" value="${l && l.dr ? l.dr : ''}" oninput="calc()"></td><td class="n"><input class="cr" type="number" step="any" style="text-align:right" value="${l && l.cr ? l.cr : ''}" oninput="calc()"></td>
  <td><button class="x" title="Remove line" onclick="this.closest('tr').remove();calc()">×</button></td></tr>`);
}

export function calc() {
  let d = 0, c = 0; document.querySelectorAll('#ls tr').forEach(r => { const ac = r.querySelector('.ac'); ac.style.borderColor = ac.value && !resolveAcc(ac.value) ? '#B42318' : ''; d += +r.querySelector('.dr').value || 0; c += +r.querySelector('.cr').value || 0; });
  $('#tot').innerHTML = `<span>Debit <b>${f(d)}</b></span><span>Credit <b>${f(c)}</b></span>` + (Math.abs(d - c) < .005 && d > 0 ? '<span class="ok"><b>Balanced</b></span>' : !d && !c ? '<span>Enter debit and credit amounts</span>' : `<span class="err"><b>Difference ${f(d - c)}</b></span>`);
}

export async function save() {
  if (badAD($('#vd').value)) return;
  const rows = [...document.querySelectorAll('#ls tr')].map(r => ({ t: r.querySelector('.ac').value, dr: r.querySelector('.dr').value, cr: r.querySelector('.cr').value }));
  const bad = rows.filter(r => (+r.dr || +r.cr) && !resolveAcc(r.t));
  if (bad.length) return showErr('Account not found: ' + bad.map(r => '"' + (r.t || 'blank') + '"').join(', ') + '. Pick an account from the list while typing, or add it in the Accounts tab.');
  const lines = rows.map(r => ({ account: resolveAcc(r.t), dr: r.dr, cr: r.cr }));
  const body = { type: $('#vt').value, date: $('#vd').value, bs: $('#vb').value, ref: $('#vr').value, narration: $('#vn').value, lines };
  const ed = window.ev, r = await fetch('/api/vouchers' + (ed ? '/' + ed.id : ''), { method: ed ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) return showErr(j.error);
  if (ed) { window.ev = null; setTab('daybook'); await load(); return toast('Updated ' + j.no + (j.saved ? '\nExcel refreshed: ' + j.saved : '')); }
  await load(); const out = body.date < FR() || body.date > TO(); $('#msg').innerHTML = `<span class="ok">Saved ${j.no}${j.saved ? ' → ' + esc(j.saved) : ''}</span>` + (out ? ' <span class="err">but its date is outside the From/To period at the top, so it will not show in reports until you change that period.</span>' : '');
}

export const voucher = () => {
  const ev = window.ev || {}; return `${window.ev ? `<div class="note">Editing <b>${esc(ev.no)}</b>. Saving updates the ledgers and reports. The voucher number and type stay the same.</div>` : ''}<div class="card"><div class="row">
   <label>Type<select id="vt" ${window.ev ? 'disabled' : ''}>${['Journal', 'Payment', 'Receipt', 'Purchase', 'Sales', 'Contra'].map(t => `<option ${t == ev.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
   <label>Date (AD)<input type="date" id="vd" value="${ev.date || ymd()}"></label>
   <label>Date (BS, optional)<input id="vb" placeholder="2083-06-30" value="${esc(ev.bs)}"></label>
   <label>Bill / Ref no.<input id="vr" value="${esc(ev.ref)}"></label><label class="w4">Narration<input id="vn" value="${esc(ev.narration)}"></label></div></div>
   <div class="card"><div class="tw" style="margin-bottom:0"><table><thead><tr><th>Account</th><th class="n" style="width:170px">Debit</th><th class="n" style="width:170px">Credit</th><th style="width:44px"></th></tr></thead><tbody id="ls"></tbody></table></div>
   <div style="margin-top:14px"><button onclick="addLine()">+ Add line</button></div></div>
   <div class="bar"><span id="tot"></span><span class="sp"><span id="msg"></span> ${window.ev ? '<button onclick="window.ev=null;render()">Cancel</button> ' : ''}<button class="p" onclick="save()">${window.ev ? 'Update voucher' : 'Save voucher'}</button></span></div>`;
};
