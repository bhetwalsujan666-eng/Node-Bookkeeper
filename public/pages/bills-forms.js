// pages/bills-forms.js — Bills page actions
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, F, N, getFile, post, toast } from '../lib/dom.js';
import { f, rd } from '../lib/format.js';
import { D, load, render, setTab } from '../lib/state.js';

export function pickPurchase(id) { if (id) makeSale(id); else { window.sp = null; render(); } }

export function pcalc() {
  if (document.activeElement.id == 'pt') $('#pv').value = rd(N('pt') * .13);
  $('#pnv').textContent = f(N('pn')); $('#ptv').textContent = f(N('pt')); $('#pvv').textContent = f(N('pv')); $('#prv').textContent = f(N('pr')); $('#ptot').textContent = f(rd(N('pn') + N('pt') + N('pv') + N('pr')));
}

export function scalc(src) {
  if (src != 'st' && N('sb') > 0) $('#st').value = rd(N('sb') * (1 + N('sm') / 100));
  const t = N('st'), n = N('sn'), g = t - n, tx = rd(g / 1.13), vat = rd(g - tx);
  $('#sbd').innerHTML = t > 0 && t >= n ? `<dl><dt>Non-taxable</dt><dd>${f(n)}</dd><dt>Taxable</dt><dd>${f(tx)}</dd><dt>VAT 13%</dt><dd>${f(vat)}</dd></dl><div class="tt"><span>Bill total</span><b>${f(t)}</b></div>` : '<p class="err">Enter a bill total that is not less than the non-taxable amount</p><div class="tt"><span>Bill total</span><b>' + f(t) + '</b></div>';
}

export function fillParty(nid, pid) { const p = D.db.parties.find(x => x.name.toLowerCase() == F(nid).trim().toLowerCase()); if (p && p.pan) $('#' + pid).value = p.pan; }

export async function savePurchase() {
  const ed = window.eb && window.eb.kind == 'purchase', body = { supplier: F('ps'), supplierPan: F('ppan'), category: F('pcat'), billNo: F('pb'), date: F('pd'), bs: F('pbs'), customer: F('pc'), passenger: F('pp'), particulars: F('pi'), nonTax: N('pn'), taxable: N('pt'), vat: N('pv'), roundOff: N('pr') };
  const j = await post(ed ? '/api/purchase/' + window.eb.id : '/api/purchase', body, ed ? 'PUT' : 'POST'); if (!j) return; if (ed) { window.eb = null; setTab('rec'); window.rt = 'purchase'; } await load();
  toast((ed ? 'Purchase bill ' + body.billNo + ' updated (' + j.no + ')' : 'Journal voucher ' + j.no + ' created') + (j.saved ? '\nSaved to ' + j.saved : '') + (j.savedBill ? '\nPurchase bill saved to ' + j.savedBill : ''), ed ? null : 'purchase');
}

export async function saveSale() {
  const ed = window.eb && window.eb.kind == 'sales', body = { purchaseId: window.sp && window.sp.id, category: F('sct'), customer: F('sc'), customerVat: F('sv'), date: F('sd'), bs: F('sbs'), passenger: F('sp2'), particulars: F('si'), nonTax: N('sn'), total: N('st') }; if (ed) body.billNo = F('sbn');
  const j = await post(ed ? '/api/sales/' + window.eb.id : '/api/sales', body, ed ? 'PUT' : 'POST'); if (!j) return;
  if (ed) { window.eb = null; setTab('rec'); window.rt = 'sales'; await load(); return toast('Sales bill ' + j.billNo + ' updated' + (j.saved ? '\nInvoice saved to ' + j.saved : '')); }
  window.sp = null; await load(); j.saved ? toast('Sales bill ' + j.billNo + ' saved to ' + j.saved, 'sales') : getFile('/api/xlsx/bill/' + j.id);
}

// UI helpers for the bills page
export function setBt(k) { window.bt = k; $('#bw').dataset.k = k; document.querySelectorAll('#bw .seg button').forEach(b => b.classList.toggle('on', b.dataset.k == k)); }

export function makeSale(id) { window.sp = D.bills.find(x => x.id == id); window.bt = 'sales'; setTab('bills'); render(); scrollTo(0, 0); }

// Edit: bills and bill-made vouchers open on the bills page, customer payments on the Payments page, anything else on the voucher page
export function editBill(id) { window.eb = D.bills.find(x => x.id == id); window.sp = null; window.bt = window.eb.kind; setTab('bills'); render(); scrollTo(0, 0); }

export function cancelEdit() { window.eb = null; render(); }

export function editV(id) {
  const v = D.vouchers.find(x => x.id == id), b = D.bills.find(x => x.voucherId == id); if (b) return editBill(b.id);
  if (v.sal) { window.sle = v; window.sls = null; setTab('sal'); render(); return scrollTo(0, 0); }
  if (v.rcpt) { window.rnew = !!v.rcpt.other; window.rc = v.rcpt.other ? null : v.rcpt.customer; window.er = v; window.rpre = null; setTab('rcv'); render(); return scrollTo(0, 0); }
  if (v.pmt) { window.pyn = !!v.pmt.other; window.pys = v.pmt.other ? null : v.pmt.supplier; window.pye = v; window.pyp = null; setTab('pay'); render(); return scrollTo(0, 0); }
  window.ev = v; setTab('voucher'); render(); scrollTo(0, 0);
}
