// pages/records.js — Records page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, esc, toast } from '../lib/dom.js';
import { f } from '../lib/format.js';
import { D, MODES, load, render, setTab } from '../lib/state.js';
import { payFromName } from './payments-forms.js';

export async function rm(id, ask) { if (!confirm(ask)) return; window.sp = null; if (window.er && window.er.id == id) window.er = null; if (window.pye && window.pye.id == id) window.pye = null; if (window.ev && window.ev.id == id) window.ev = null; if (window.sle && window.sle.id == id) window.sle = null; if (window.eb && window.eb.voucherId == id) window.eb = null; if (window.rfe && window.rfe.id == id) window.rfe = null; const r = await fetch('/api/vouchers/' + id, { method: 'DELETE' }), j = await r.json().catch(() => ({})); await load(); toast(j.files && j.files.length ? 'Deleted. Excel file(s) removed:\n' + j.files.join('\n') : 'Deleted.'); }

export const del = id => rm(id, 'Delete this voucher and its Excel file? This cannot be undone.');

export const delBill = (id, kind) => rm(id, 'Delete this ' + kind + ' bill, its voucher and their Excel files? This cannot be undone.');

// ---- Records page ----
export function recFilter() {
  const g = id => { const e = document.getElementById(id); return e ? e.value : ''; }, q = g('rq').trim().toLowerCase().split(/\s+/).filter(Boolean), c = g('rfc'), a = g('rfa'), p = g('rfp'), m = g('rfm'), d1 = g('rd1'), d2 = g('rd2'); let n = 0, all = 0, tot = 0;
  document.querySelectorAll('#rbody tr[data-q]').forEach(r => { all++; const x = r.dataset, ok = q.every(w => x.q.includes(w)) && (!c || x.c == c) && (!a || x.a == a) && (!p || x.p == p) && (!m || x.m == m) && (!d1 || x.d >= d1) && (!d2 || x.d <= d2); r.hidden = !ok; if (ok) { n++; tot += +x.amt; } });
  const el = $('#rcount'); if (el) el.textContent = `Showing ${n} of ${all} · total ${f(tot)}`;
}

export function goRec(k) { setTab('rec'); window.rt = k; window.eb = null; render(); scrollTo(0, 0); }

export const rec = () => {
  const k = window.rt || 'purchase', q = (...a) => esc(a.join(' ').toLowerCase()), byId = {}, st = {}; D.bills.forEach(b => byId[b.id] = b); D.receivables.forEach(c => c.bills.forEach(x => st[x.id] = x)); D.payables.forEach(c => c.bills.forEach(x => st[x.id] = x));
  const PB = D.bills.filter(b => b.kind == 'purchase').reverse(), SB = D.bills.filter(b => b.kind == 'sales').reverse(), vs = fn => D.vouchers.filter(fn).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id), RV = vs(v => v.rcpt), PM = vs(v => v.pmt), SL = vs(v => v.sal), RF = vs(v => v.refund);
  const secs = [['purchase', 'Purchase bills', PB.length], ['sales', 'Sales bills', SB.length], ['received', 'Payments received', RV.length], ['made', 'Payments made', PM.length], ['salary', 'Salary payments', SL.length], ['refund', 'Refunds', RF.length]];
  const pay = id => { const x = st[id]; return !x ? '' : x.status == 'Paid' ? '<span class="chip ok">Paid</span>' : x.status == 'Partial' ? `<span class="chip due">Part paid · due ${f(x.due)}</span>` : '<span class="chip due">Unpaid</span>'; }, pst = id => st[id] ? st[id].status.toLowerCase() : '';
  const sel = (id, l, opts) => `<select id="${id}" onchange="recFilter()" title="${l}"><option value="">${l}</option>${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t || v)}</option>`).join('')}</select>`, cats = L => [...new Set(L.map(b => b.category || '').filter(Boolean))].sort().map(c => [c]), modes = MODES.map(m => [m]);
  const vact = v => `<a href="#" onclick="getFile('/api/xlsx/voucher/${v.id}');return false">Excel</a> <button onclick="editV(${v.id})">Edit</button> <button class="d" onclick="del(${v.id})">Delete</button>`, dt = (d, bs) => d + (bs ? '<br><small>' + esc(bs) + '</small>' : ''), an = id => (D.accounts.find(a => a.code == id) || {}).name || '';
  const sm = v => `${esc(v.rcpt ? v.rcpt.mode : v.pmt ? v.pmt.mode : v.sal.mode)}${v.ref ? '<br><small>' + esc(v.ref) + '</small>' : ''}${(v.pmt || v.sal || {}).fee ? '<br><small>Fonepay charge ' + f((v.pmt || v.sal).fee) + '</small>' : ''}`;
  const tr = (data, cells) => `<tr data-q="${data.q}" data-d="${data.d}" data-c="${esc(data.c || '')}" data-a="${data.a || ''}" data-p="${data.p || ''}" data-m="${esc(data.m || '')}" data-amt="${data.amt}">${cells.map((c, i) => c.startsWith('N:') ? `<td class="n">${c.slice(2)}</td>` : c.startsWith('A:') ? `<td class="act">${c.slice(2)}</td>` : `<td>${c}</td>`).join('')}</tr>`;
  let head, filters, rows, hint;
  if (k == 'purchase') {
    hint = 'Search supplier, bill no., customer, passenger, sales bill no…'; head = ['Date', 'Supplier', 'Customer / passenger', 'Category', 'Total', 'Sales bill', 'Payment', 'Actions'];
    filters = sel('rfc', 'All categories', cats(PB)) + sel('rfa', 'Sold & not sold', [['sold', 'Sold (sales bill made)'], ['unsold', 'Not sold yet']]) + sel('rfp', 'Any payment status', [['paid', 'Paid'], ['partial', 'Part paid'], ['unpaid', 'Unpaid']]);
    rows = PB.map(b => {
      const sb = SB.find(x => x.purchaseId == b.id), sold = !!(sb || b.sold); return tr({ q: q(b.supplier, b.billNo, b.supplierPan, b.customer, b.passenger, b.particulars, b.category, b.voucher, b.date, b.bs, b.total, sb ? sb.billNo + ' ' + sb.customer : b.sold || ''), d: b.date, c: b.category, a: sold ? 'sold' : 'unsold', p: pst(b.id), amt: b.total },
        [dt(b.date, b.bs), `<b>${esc(b.supplier)}</b><br><small>Bill ${esc(b.billNo)}${b.supplierPan ? ' · PAN ' + esc(b.supplierPan) : ''}</small>`, esc(b.customer || '') + (b.passenger ? '<br><small>' + esc(b.passenger) + '</small>' : ''), esc(b.category || ''), 'N:' + f(b.total),
        sold ? `<span class="chip ok">Sold · ${esc(sb ? sb.billNo : b.sold)}</span>${sb ? '<br><small>' + esc(sb.customer) + '</small>' : ''}` : '<span class="chip">Not sold yet</span>', pay(b.id),
        `A:${sold ? '' : `<button onclick="makeSale(${b.id})">Create sales bill</button> `}<button onclick="editBill(${b.id})">Edit</button><br><a href="#" onclick="getFile('/api/xlsx/voucher/${b.voucherId}');return false\">${b.voucher} Excel</a> · <a href="#" onclick="getFile('/api/xlsx/bill/${b.id}');return false">Bill Excel</a> <button class="d" onclick="delBill(${b.voucherId}, 'purchase')">Delete</button>`]);
    });
  }
  else if (k == 'sales') {
    hint = 'Search customer, bill no., passenger, purchase bill no. or supplier…'; head = ['Date', 'Bill no.', 'Customer', 'Category', 'Made from purchase', 'Total', 'Payment', 'Actions'];
    filters = sel('rfc', 'All categories', cats(SB)) + sel('rfa', 'From purchase or direct', [['sold', 'Made from a purchase bill'], ['unsold', 'Entered directly']]) + sel('rfp', 'Any payment status', [['paid', 'Paid'], ['partial', 'Part paid'], ['unpaid', 'Unpaid']]);
    rows = SB.map(b => {
      const pb = byId[b.purchaseId]; return tr({ q: q(b.billNo, b.customer, b.customerVat, b.passenger, b.particulars, b.category, b.voucher, b.date, b.bs, b.total, pb ? pb.billNo + ' ' + pb.supplier : ''), d: b.date, c: b.category, a: pb ? 'sold' : 'unsold', p: pst(b.id), amt: b.total },
        [dt(b.date, b.bs), `<b>${esc(b.billNo)}</b>`, `<b>${esc(b.customer)}</b>${b.passenger ? '<br><small>' + esc(b.passenger) + '</small>' : ''}`, esc(b.category || ''), pb ? `${esc(pb.supplier)}<br><small>Purchase bill ${esc(pb.billNo)}</small>` : '<small>—</small>', 'N:' + f(b.total), pay(b.id),
        `A:<a href="#" onclick="getFile('/api/xlsx/bill/${b.id}');return false">Excel</a> <button onclick="editBill(${b.id})">Edit</button> <button class="d" onclick="delBill(${b.voucherId}, 'sales')">Delete</button><br><small>${b.voucher}</small>`]);
    });
  }
  else if (k == 'refund') {
    hint = 'Search party, refund no., bill no., voucher, note…'; head = ['Date', 'Voucher', 'Refund', 'Party', 'Against bill', 'Settled by', 'Amount', 'Actions'];
    filters = sel('rfa', 'Received & paid', [['sold', 'Refunds received'], ['unsold', 'Refunds paid']]);
    rows = RF.map(v => {
      const r = v.refund, R = r.kind == 'received'; return tr({ q: q(r.party, r.noteNo, r.billNo, v.no, r.particulars, r.note, r.instrument, v.date, v.bs, r.total), d: v.date, a: R ? 'sold' : 'unsold', amt: r.total },
        [dt(v.date, v.bs), `<b>${v.no}</b>`, `<span class="chip ${R ? 'ok' : 'due'}">${R ? 'Received' : 'Paid'}</span><br><small>${r.vat > 0 ? (R ? 'In purchase book' : 'In sales book') : 'No VAT: not in registers'}</small>`, `<b>${esc(r.party)}</b>${r.noteNo ? '<br><small>No. ' + esc(r.noteNo) + '</small>' : ''}`, esc(r.billNo || ''), r.settle == 'cash' ? esc(r.mode) + '<br><small>' + esc(an(r.account)) + '</small>' : 'Party account', 'N:' + f(r.total), 'A:' + vact(v)]);
    });
  }
  else if (k == 'received') {
    hint = 'Search payer, customer, voucher, cheque / transaction no., bill…'; head = ['Date', 'Voucher', 'Received from', 'Applied to', 'Mode', 'Received in', 'Amount', 'Actions'];
    filters = sel('rfm', 'Any mode', modes) + sel('rfa', 'All payers', [['sold', 'Recorded customers'], ['unsold', 'Other payers']]);
    rows = RV.map(v => {
      const r = v.rcpt, who = r.other ? r.payer : r.customer, to = r.other ? 'Credited to ' + an(r.creditAccount) : r.billId && byId[r.billId] ? 'Bill ' + byId[r.billId].billNo : 'Oldest bills first'; return tr({ q: q(who, r.customer, r.payer, v.no, r.instrument, r.note, to, r.mode, v.date, v.bs, r.amount), d: v.date, a: r.other ? 'unsold' : 'sold', m: r.mode, amt: r.amount },
        [dt(v.date, v.bs), `<b>${v.no}</b>`, `${esc(who)}${!r.other && r.payer && r.payer != r.customer ? '<br><small>paid by ' + esc(r.payer) + '</small>' : ''}${r.note ? '<br><small>' + esc(r.note) + '</small>' : ''}`, esc(to), sm(v), esc(an(r.account)), 'N:' + f(r.amount), 'A:' + vact(v)]);
    });
  }
  else if (k == 'made') {
    hint = 'Search payee, supplier, voucher, cheque / transaction no., bill…'; head = ['Date', 'Voucher', 'Paid to', 'Applied to', 'Mode', 'Paid from', 'Amount', 'Actions'];
    filters = sel('rfm', 'Any mode', modes) + sel('rfa', 'All payees', [['sold', 'Recorded suppliers'], ['unsold', 'Other payees']]);
    rows = PM.map(v => {
      const r = v.pmt, who = r.other ? r.payee : r.supplier, to = r.other ? 'Charged to ' + an(r.debitAccount) : r.billId && byId[r.billId] ? 'Bill ' + byId[r.billId].billNo : 'Oldest bills first'; return tr({ q: q(who, r.supplier, r.payee, v.no, r.instrument, r.note, to, r.mode, v.date, v.bs, r.amount), d: v.date, a: r.other ? 'unsold' : 'sold', m: r.mode, amt: r.amount },
        [dt(v.date, v.bs), `<b>${v.no}</b>`, `${esc(who)}${!r.other && r.payee && r.payee != r.supplier ? '<br><small>via ' + esc(r.payee) + '</small>' : ''}${r.note ? '<br><small>' + esc(r.note) + '</small>' : ''}`, esc(to), sm(v), esc(payFromName(r)), 'N:' + f(r.amount), 'A:' + vact(v)]);
    });
  }
  else {
    hint = 'Search staff name, month, voucher, note…'; head = ['Date', 'Voucher', 'Staff', 'Salary for', 'Mode', 'Paid from', 'Amount', 'Actions']; filters = sel('rfm', 'Any mode', modes);
    rows = SL.map(v => {
      const r = v.sal; return tr({ q: q(r.staff, r.period, v.no, r.instrument, r.note, r.mode, v.date, v.bs, r.amount), d: v.date, m: r.mode, amt: r.amount },
        [dt(v.date, v.bs), `<b>${v.no}</b>`, `<b>${esc(r.staff)}</b>${r.note ? '<br><small>' + esc(r.note) + '</small>' : ''}`, esc(r.period || ''), sm(v), esc(an(r.account)), 'N:' + f(r.amount), 'A:' + vact(v)]);
    });
  }
  return `<div class="seg">${secs.map(([id, t, n]) => `<button class="${id == k ? 'on' : ''}" onclick="window.rt='${id}';render()">${t}<i>${n}</i></button>`).join('')}</div>
    <div class="card"><div class="ch"><div class="fl" style="flex:1"><input type="search" id="rq" placeholder="${hint}" oninput="recFilter()">${filters}<input type="date" id="rd1" title="From date" onchange="recFilter()"><input type="date" id="rd2" title="To date" onchange="recFilter()"><button onclick="render()">Clear</button></div><span class="sub" id="rcount" style="margin:0"></span></div>
    <div class="tw"><table><thead><tr>${head.map(h => `<th class="${h == 'Total' || h == 'Amount' ? 'n' : ''}">${h}</th>`).join('')}</tr></thead><tbody id="rbody">${rows.join('') || `<tr><td class="empty" colspan="8">Nothing here yet.</td></tr>`}</tbody></table></div></div>`;
};
