// pages/refunds.js — Refunds received from suppliers (debit note) and refunds paid to customers (credit note)
// Works for any kind of bill. Only the party, date and amount are needed; VAT rules and the VAT registers apply only when a VAT amount is entered.
import { $, F, N, esc, post, toast } from '../lib/dom.js';
import { f, rd, ymd } from '../lib/format.js';
import { D, MODES, cashAccs, load, render } from '../lib/state.js';
import { ad2bs } from '../lib/nepdate.js';

const regText = (R, vat) => vat > 0 ? (R ? 'VAT given: goes into the purchase book as a minus row.' : 'VAT given: goes into the sales book as a minus row.') : 'No VAT amount: posted to the books only, not entered in the VAT registers.';

export function rfSet(k) { window.rft = k; window.rfe = null; render(); }

export function rfSettle() { $('#rfcw').hidden = F('rfs') != 'cash'; }

export function rfMode() { const want = { Cash: ['cash'], Cheque: ['bank'], Fonepay: ['fonepay', 'bank'], 'Bank transfer': ['bank'] }[F('rfmo')] || []; for (const w of want) { const a = cashAccs().find(x => x.name.toLowerCase().includes(w)); if (a) { $('#rfac').value = a.code; break; } } }

export function rfCalc() {
  if (document.activeElement && document.activeElement.id == 'rftx') $('#rfv').value = rd(N('rftx') * .13);
  const n = N('rfnt'), t = N('rftx'), v = N('rfv'), r = N('rfr'), R = (window.rfe ? window.rfe.refund.kind : window.rft || 'received') == 'received';
  $('#rfnv').textContent = f(n); $('#rftv').textContent = f(t); $('#rfvv').textContent = f(v); $('#rfrv').textContent = f(r); $('#rftot').textContent = f(rd(n + t + v + r)); $('#rfreg').textContent = regText(R, v);
}

export async function rfSave() {
  const er = window.rfe, kind = er ? er.refund.kind : window.rft || 'received';
  const body = { kind, party: F('rfp'), pan: F('rfpan'), noteNo: F('rfn'), billNo: F('rfb'), category: F('rfc'), date: F('rfd'), bs: F('rfbs'), particulars: F('rfi'), nonTax: N('rfnt'), taxable: N('rftx'), vat: N('rfv'), roundOff: N('rfr'), settle: F('rfs'), mode: F('rfmo'), account: F('rfac'), instrument: F('rfin'), note: F('rfnote') };
  const j = await post(er ? '/api/refunds/' + er.id : '/api/refunds', body, er ? 'PUT' : 'POST'); if (!j) return;
  window.rfe = null; await load(); toast('Refund ' + j.no + (er ? ' updated' : ' recorded') + (j.saved ? '\nSaved to ' + j.saved : ''), 'refund');
}

export const refunds = () => {
  const er = window.rfe, pre = er ? { ...er.refund, date: er.date, bs: er.bs } : {}, kind = er ? er.refund.kind : window.rft || 'received', R = kind == 'received', RF = D.vouchers.filter(v => v.refund).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    inp = (id, l, v = '', x = '', c = '') => `<label class="${c}">${l}<input id="${id}" value="${esc(v)}" ${x}></label>`, nx = 'type="number" step="any"', ca = cashAccs(), dflt = pre.account || (ca.find(a => /cash/i.test(a.name)) || ca[0] || {}).code,
    cats = [...D.settings.categories, ...(pre.category && !D.settings.categories.includes(pre.category) ? [pre.category] : [])], date = pre.date || ymd(), bs = pre.bs || ad2bs(date), settle = pre.settle || 'cash',
    n = +pre.nonTax || 0, t = +pre.taxable || 0, v = +pre.vat || 0, r = +pre.roundOff || 0, nRecv = RF.filter(x => x.refund.kind == 'received').length;
  const chip = x => { const rr = x.refund; return rr.vat > 0 ? `<span class="chip ok">${rr.kind == 'received' ? 'In purchase book' : 'In sales book'}</span>` : '<span class="chip">Not in registers (no VAT)</span>'; };
  const list = `<div class="card"><div class="ch"><h2>Refunds</h2><span class="sub" style="margin:0">All refunds, newest first</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Refund</th><th>Party</th><th>Against bill</th><th>Settled by</th><th class="n">Amount</th><th></th></tr></thead><tbody>${RF.map(x => { const q = x.refund; return `<tr><td>${x.date}${x.bs ? '<br><small>' + esc(x.bs) + '</small>' : ''}</td><td><b>${esc(x.no)}</b></td><td><span class="chip ${q.kind == 'received' ? 'ok' : 'due'}">${q.kind == 'received' ? 'Received' : 'Paid'}</span><br>${chip(x)}</td><td><b>${esc(q.party)}</b>${q.noteNo ? '<br><small>No. ' + esc(q.noteNo) + '</small>' : ''}</td><td>${esc(q.billNo)}</td><td>${q.settle == 'cash' ? esc(q.mode) + '<br><small>' + esc((D.accounts.find(a => a.code == q.account) || {}).name || '') + '</small>' : 'Party account'}</td><td class="n">${f(q.total)}</td><td class="act"><a href="#" onclick="getFile('/api/xlsx/voucher/${x.id}');return false">Excel</a> <button onclick="editV(${x.id})">Edit</button> <button class="d" onclick="del(${x.id})">Delete</button></td></tr>`; }).join('') || '<tr><td class="empty" colspan="8">No refunds yet.</td></tr>'}</tbody></table></div></div>`;
  return `${er ? `<div class="note">Editing refund <b>${esc(er.no)}</b>. Saving updates its voucher, the ledgers, the VAT registers and the Excel file. The refund type and how it was settled stay the same.</div>` : `<div class="seg"><button class="${R ? 'on' : ''}" onclick="rfSet('received')">Refund received<i>${nRecv}</i></button><button class="${R ? '' : 'on'}" onclick="rfSet('paid')">Refund paid<i>${RF.length - nRecv}</i></button></div>`}
  <p class="sub">${R ? 'A supplier (airline, hotel, agent…) gives money back, or credits your account, for a bill you bought. It reduces your purchases (debit note).' : 'You give money back, or credit a customer’s account, for something you sold. It reduces your sales (credit note).'}</p>
  <div class="split"><div class="card">
    <div class="fh">${R ? 'Supplier' : 'Customer'}</div><div class="row">${inp('rfp', R ? 'Supplier (refund received from)' : 'Customer (refund paid to)', pre.party, `list="${R ? 'pls' : 'plc'}" onchange="fillParty('rfp','rfpan')"`, 'w2')}${inp('rfpan', R ? 'Supplier PAN/VAT no. (needed if VAT)' : 'Customer PAN/VAT no. (optional)', pre.pan)}${inp('rfn', R ? 'Supplier credit note no.' : 'Credit note no.', pre.noteNo)}${inp('rfb', 'Original bill no. (optional)', pre.billNo)}</div>
    <div class="fh">Refund</div><div class="row"><label>Category<select id="rfc">${cats.map(c => `<option ${c == pre.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label>Date (AD)<input type="date" id="rfd" value="${date}"></label>${inp('rfbs', 'Date (BS)', bs)}${inp('rfi', 'Particulars (ticket no., route, reason…)', pre.particulars, '', 'w4')}</div>
    <div class="fh">Amounts</div><div class="row">${inp('rfnt', 'Non-taxable', pre.nonTax, nx + ' oninput="rfCalc()"')}${inp('rftx', 'Taxable', pre.taxable, nx + ' oninput="rfCalc()"')}${inp('rfv', 'VAT 13% (leave empty if none)', pre.vat, nx + ' oninput="rfCalc()"')}${inp('rfr', 'Round off (+/−)', pre.roundOff, nx + ' oninput="rfCalc()"')}</div>
    <div class="fh">Settlement</div><div class="row"><label class="w2">${R ? 'The refund is' : 'The refund was'}<select id="rfs" onchange="rfSettle()" ${er ? 'disabled' : ''}><option value="cash" ${settle == 'cash' ? 'selected' : ''}>${R ? 'Received in cash / bank' : 'Paid in cash / bank'}</option><option value="party" ${settle == 'party' ? 'selected' : ''}>${R ? 'Adjusted in the supplier’s account (credit note)' : 'Adjusted in the customer’s account (credit note)'}</option></select></label>${inp('rfnote', 'Note (optional)', pre.note, '', 'w2')}</div>
    <div class="row" id="rfcw" ${settle == 'cash' ? '' : 'hidden'}><label>Mode<select id="rfmo" onchange="rfMode()">${MODES.map(m => `<option ${m == pre.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label>${R ? 'Received in' : 'Paid from'}<select id="rfac">${ca.map(a => `<option value="${a.code}" ${a.code == dflt ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>${inp('rfin', 'Cheque no. / Transaction ID', pre.instrument)}</div>
  </div>
  <aside class="stub"><div class="hd">${R ? 'Refund received' : 'Refund paid'}</div><div class="bd"><dl><dt>Non-taxable</dt><dd id="rfnv">${f(n)}</dd><dt>Taxable</dt><dd id="rftv">${f(t)}</dd><dt>VAT 13%</dt><dd id="rfvv">${f(v)}</dd><dt>Round off</dt><dd id="rfrv">${f(r)}</dd></dl>
    <div class="tt"><span>Refund total</span><b id="rftot">${f(rd(n + t + v + r))}</b></div><p class="sub"><small id="rfreg">${regText(R, v)}</small></p><button class="p wide" onclick="rfSave()">${er ? 'Update refund' : 'Save refund'}</button>${er ? '<button class="wide" onclick="window.rfe=null;render()">Cancel</button>' : ''}</div></aside></div>${list}`;
};
