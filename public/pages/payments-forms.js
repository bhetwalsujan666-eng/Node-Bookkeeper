// pages/payments-forms.js — Payments made actions, cheque/bank pickers, split cheques
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, F, N, esc, post, toast } from '../lib/dom.js';
import { f, rd } from '../lib/format.js';
import { D, acc, cashAccs, load, render } from '../lib/state.js';
import { fmtHit, fmtParts } from './settings.js';

export const banksFor = instr => { const runs = String(instr || '').match(/\d+/g) || []; return (D.db.banks || []).filter(b => acc(b.ledger) && fmtParts(b.chequeFormat).some(p => runs.some(r => fmtHit(p, r)))); };

export function chqPick(inId, accId, modeId) { if (F(modeId) != 'Cheque') return; const h = banksFor(F(inId)), s = $('#' + accId); if (h.length == 1 && s.querySelector(`option[value="${h[0].ledger}"]`)) s.value = h[0].ledger; }

export function chqOk(inId, accId, modeId) {
  if (F(modeId) != 'Cheque') return true; const h = banksFor(F(inId)); if (h.length != 1 || h[0].ledger == F(accId)) return true;
  return confirm(`Cheque no. ${F(inId)} fits the format of ${h[0].name} (${h[0].chequeFormat}), but "${(acc(F(accId)) || {}).name || 'another account'}" is chosen under Paid from.\n\nSave anyway?`);
}

export const payFromName = p => p.splits ? [...new Set(p.splits.map(y => (acc(y.account) || {}).name || y.account))].join(' + ') : (acc(p.account) || {}).name || ''; // a split payment (several cheques / banks) lists every bank

export const paidFrom = vid => { const v = D.vouchers.find(y => y.id == vid), p = v && (v.pmt || v.sal), a = p && payFromName(p); return a ? `<br><small>Paid from ${esc(a)}</small>` : ''; };

// ---- One payment by several cheques / banks (Payments made). The first cheque uses the normal Paid from + Cheque no. fields; each extra cheque is a row here. ----
export const spRow = (ca, m = {}) => `<div class="row" data-sp style="margin-top:8px;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) auto"><label>Paid from<select data-f="account">${ca.map(a => `<option value="${a.code}" ${a.code == m.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
  <label>Cheque no.<input data-f="instrument" value="${esc(m.instrument || '')}" oninput="spPick(this)"></label><label>Amount<input data-f="amount" type="number" step="any" value="${m.amount ?? ''}" oninput="spSum()"></label>
  <div><button type="button" class="x" title="Remove this cheque" onclick="this.closest('[data-sp]').remove();spSum()">×</button></div></div>`;

export const splitBox = pre => `<div id="ysw" ${pre.mode == 'Cheque' ? '' : 'hidden'} style="margin-top:6px"><div id="ysp">${(pre.more || []).map(m => spRow(cashAccs(), m)).join('')}</div>
  <div class="actbar" style="margin:8px 0 0"><button type="button" onclick="spAdd()">+ Part paid by another cheque / bank</button><span id="ysum" class="sub" style="margin:0">${spText(+pre.amount || 0, (pre.more || []).reduce((t, m) => t + (+m.amount || 0), 0), (pre.more || []).length)}</span></div></div>`;

export function spAdd() { const ca = cashAccs(), other = ca.find(a => /bank/i.test(a.name) && a.code != F('yac')) || ca[0]; $('#ysp').insertAdjacentHTML('beforeend', spRow(ca, { account: other && other.code })); spSum(); $('#ysp').lastElementChild.querySelector('[data-f=instrument]').focus(); }

export function spPick(el) { const h = banksFor(el.value), s = el.closest('[data-sp]').querySelector('[data-f=account]'); if (h.length == 1 && s.querySelector(`option[value="${h[0].ledger}"]`)) s.value = h[0].ledger; }

export const spText = (total, ex, n) => { const first = rd(total - ex); return n ? (first > 0 ? `First cheque: <b>${f(first)}</b> · other cheques: <b>${f(ex)}</b>` : '<b style="color:var(--err)">The other cheques are as much as the whole payment</b>') : 'Use this when one payment is made with more than one cheque, or from more than one bank.'; };

export function spSum() { const o = $('#ysum'); if (!o) return; const rows = [...document.querySelectorAll('#ysp [data-sp]')]; o.innerHTML = spText(N('yam'), rows.reduce((t, r) => t + (+r.querySelector('[data-f=amount]').value || 0), 0), rows.length); }

export function spRows() {
  if (!$('#ysp') || F('ymo') != 'Cheque') return []; const out = [];
  for (const r of document.querySelectorAll('#ysp [data-sp]')) {
    const g = k => r.querySelector('[data-f=' + k + ']').value, amount = +g('amount') || 0, instrument = g('instrument').trim(); if (!amount && !instrument) continue; // empty row: ignored
    if (amount <= 0) { alert('Enter an amount for every extra cheque, or remove the empty one.'); return null; }
    const h = banksFor(instrument); if (h.length == 1 && h[0].ledger != g('account') && !confirm(`Cheque no. ${instrument} fits the format of ${h[0].name} (${h[0].chequeFormat}), but "${(acc(g('account')) || {}).name || 'another account'}" is chosen under Paid from.\n\nSave anyway?`)) return null;
    out.push({ account: g('account'), instrument, amount });
  }
  if (out.length && rd(N('yam') - out.reduce((t, x) => t + x.amount, 0)) <= 0) { alert('The extra cheques add up to the whole payment or more. Nothing is left for the first cheque.'); return null; }
  return out;
}

// Payments made (to suppliers; mirrors Payments received)
export function pickSup(i) { window.pyn = false; window.pys = D.payables[i].name; window.pye = null; window.pyp = null; render(); if (window.matchMedia && matchMedia('(max-width:1000px)').matches) $('#sdet').scrollIntoView(); }

export function newPaid() { window.pyn = true; window.pys = null; window.pye = null; window.pyp = null; render(); scrollTo(0, 0); }

export function paySupBill(id, due) { window.pye = null; window.pyp = { billId: id, amount: due }; render(); $('#yam').focus(); }

export function ymode() { $('#yfw').hidden = $('#ymo').value != 'Fonepay'; if ($('#ysw')) $('#ysw').hidden = $('#ymo').value != 'Cheque'; const want = { Cash: ['cash'], Cheque: ['bank'], Fonepay: ['fonepay', 'bank'], 'Bank transfer': ['bank'] }[$('#ymo').value] || []; for (const w of want) { const a = cashAccs().find(x => x.name.toLowerCase().includes(w)); if (a) { $('#yac').value = a.code; break; } } chqPick('yin', 'yac', 'ymo'); }

// ---- Payments made by staff out of their own pocket: the company owes them ("Due to <name>") until it reimburses them ----
export const staffOwed = code => rd(D.vouchers.reduce((t, v) => t + v.lines.filter(l => l.account == code).reduce((s, l) => s + l.cr - l.dr, 0), 0));

export function ypbChg() { const on = !!F('ypb').trim(); $('#yfr').hidden = on; if ($('#ysw')) $('#ysw').hidden = on || F('ymo') != 'Cheque'; }

export function reimburse(code) { const a = acc(code); window.pyn = true; window.pys = null; window.pye = null; window.pyp = { debit: code, amount: staffOwed(code), payee: a.name.replace(/^Due to /, '') }; render(); scrollTo(0, 0); }

export function ycrChg() { $('#ycnw').hidden = !!F('ycr'); }

export async function savePayment(isNew) {
  const staff = F('ypb').trim(), bySt = F('ysf'); if (staff && bySt) return alert('Choose either "Paid by staff / CEO" or "Paid by staff (own money)", not both.'); if (!staff && !bySt && !chqOk('yin', 'yac', 'ymo')) return; const more = staff || bySt ? [] : spRows(); if (!more) return; const er = window.pye, cr = isNew ? F('ycr') : '', body = { supplier: isNew ? (cr ? '' : F('ycn')) : window.pys, debitAccount: cr, payee: isNew ? F('ypy') : (er && er.pmt.payee || ''), date: F('ydt'), bs: F('ybs'), amount: N('yam'), mode: F('ymo'), account: F('yac'), instrument: F('yin'), billId: isNew ? null : (F('ybl') || null), note: F('ynt'), fee: N('yfe'), more, paidBy: staff, byStaff: bySt, inv: $('#yiv') ? { billNo: F('yiv'), supplierPan: F('yip'), taxable: N('yit') } : undefined };
  const j = await post(er ? '/api/payments/' + er.id : '/api/payments', body, er ? 'PUT' : 'POST'); if (!j) return; window.pye = null; window.pyp = null; if (isNew) { window.pyn = false; window.pys = cr ? null : body.supplier; } await load();
  toast('Payment ' + j.no + (er ? ' updated' : ' recorded') + (j.saved ? '\nSaved to ' + j.saved : ''), 'made');
}

export function pickSupByName(v) { const c = D.payables.find(x => x.name.toLowerCase() === String(v).trim().toLowerCase()); if (c && c.name !== window.pys) { window.pys = c.name; window.pyn = false; window.pye = null; render(); } }
