// server/routes/vouchers.js — /api/vouchers CRUD
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { autoSaveVoucher, dropBill, dropVoucher, resaveVoucher } = require('../files');
const { send } = require('../http');
const { PFX, cleanLines, resync } = require('../posting/lines');
const { save } = require('../store');
const { purchaseBad } = require('../posting/purchase');
const { dupInvoice, taxInvProblem } = require('../posting/review');
const { isBookablePayment, isFuelJournal, invPay, vatBillProblem } = require('../posting/purchasebook');
const { nkey } = require('../accounts');
const canFuel = (d, v) => isBookablePayment(d, v) || isFuelJournal(d, v); // payment made with no invoice (fuel, permits, entry fees...) or hand-made fuel voucher, added by hand

async function handle({ req, res, u, b, d }) {
	  const ti = /^\/api\/vouchers\/([^/]+)\/taxinv$/.exec(u);
  if (ti) {
    const v = d.vouchers.find(y => String(y.id) === ti[1]); if (!v) return send(res, 404, { error: 'Voucher not found' });
    if (req.method === 'DELETE') { delete v.taxInv; save(d); return send(res, 200, { ok: true }); }
    if (req.method === 'POST') {
      const x = JSON.parse(b), t = { supplier: String(x.supplier || '').trim(), supplierPan: String(x.supplierPan || '').trim(), billNo: String(x.billNo || '').trim(), nonTax: +x.nonTax || 0, taxable: +x.taxable || 0, vat: +x.vat || 0 };
      const bad = purchaseBad({ ...t, date: v.date, bs: v.bs }) || (dupInvoice(d, t, v.id) ? `Invoice ${t.billNo} from ${t.supplier} is already in the purchase book` : null) || taxInvProblem(d, v, t);
      if (bad) return send(res, 400, { error: bad });
      v.taxInv = t; delete v.fuelBook; save(d); return send(res, 200, { ok: true }); // a VAT bill replaces any fuel entry, so it is never in the register twice
    }
  }
  // ---- New payments that carry tax invoice details: add / remove in the purchase book (flag v.invBook). Fuel and no-invoice payments use /fuelbook below.
  const invBad = (d, v) => { // null = can be added
    const t = invPay(d, v); if (!t) return 'This payment has no tax invoice details (or it is a fuel payment, which has its own review).';
    const dup = dupInvoice(d, t, v.id) || d.vouchers.some(y => y.id !== v.id && y.invBook && y.pmt && y.pmt.inv && nkey(y.pmt.payee) === nkey(t.supplier) && nkey(y.pmt.inv.billNo) === nkey(t.billNo));
    return vatBillProblem(t) || (dup ? `Invoice ${t.billNo} from ${t.supplier} is already in the purchase book` : null);
  };
  const ib = /^\/api\/vouchers\/([^/]+)\/invbook$/.exec(u);
  if (ib && (req.method === 'POST' || req.method === 'DELETE')) {
    const v = d.vouchers.find(y => String(y.id) === ib[1]); if (!v) return send(res, 404, { error: 'Voucher not found' });
    if (req.method === 'DELETE') { delete v.invBook; save(d); return send(res, 200, { ok: true }); }
    const bad = invBad(d, v); if (bad) return send(res, 400, { error: bad });
    v.invBook = true; delete v.fuelBook; save(d); return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && u === '/api/invbook') { // add several at once: { ids: [...] }
    const ids = (JSON.parse(b).ids || []).map(String); let added = 0, skipped = 0;
    d.vouchers.forEach(v => { if (!ids.includes(String(v.id))) return; if (v.invBook) return; if (invBad(d, v)) { skipped++; return; } v.invBook = true; delete v.fuelBook; added++; });
    save(d); return send(res, 200, { added, skipped });
  }
  const fb = /^\/api\/vouchers\/([^/]+)\/fuelbook$/.exec(u); // add / remove ONE fuel payment in the purchase book
  if (fb && (req.method === 'POST' || req.method === 'DELETE')) {
    const v = d.vouchers.find(y => String(y.id) === fb[1]); if (!v) return send(res, 404, { error: 'Voucher not found' });
    if (req.method === 'DELETE') { delete v.fuelBook; save(d); return send(res, 200, { ok: true }); }
    if (!canFuel(d, v)) return send(res, 400, { error: 'This cannot be added without a VAT bill: it must be a payment to someone who is not a recorded supplier, charged to a purchase/expense account (not salary, loans, bank charges etc.), or a fuel voucher not linked to a tax invoice' });
    const x = (() => { try { return JSON.parse(b || '{}'); } catch { return {}; } })(), sup = String(x.supplier || '').trim(), bn = String(x.billNo || '').trim();
    v.fuelBook = sup || bn ? { supplier: sup, billNo: bn } : true; save(d); return send(res, 200, { ok: true }); // optional supplier / invoice no. typed on the row
  }
  if (req.method === 'POST' && u === '/api/fuelbook') { // add several at once: { ids: [...] }
    const ids = (JSON.parse(b).ids || []).map(String); let added = 0;
    d.vouchers.forEach(v => { if (ids.includes(String(v.id)) && canFuel(d, v) && !v.fuelBook) { v.fuelBook = true; added++; } }); save(d); return send(res, 200, { added });
  }
  if (req.method === 'POST' && u === '/api/vouchers') {
    const v = JSON.parse(b);
    if (!v.date) return send(res, 400, { error: 'Date is required' });
    const c = cleanLines(d, v.lines); if (c.error) return send(res, 400, c); v.lines = c.lines;
    const p = PFX[v.type] || 'JV'; d.seq[p] = (d.seq[p] || 0) + 1;
    v.no = p + '-' + String(d.seq[p]).padStart(4, '0'); v.id = Date.now();
    d.vouchers.push(v); save(d); return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
  }
  if (req.method === 'PUT' && u.startsWith('/api/vouchers/')) { // edit a hand-made voucher (number, id and type stay the same)
    const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id);
    if (!v) return send(res, 404, { error: 'Voucher not found' });
    if (v.rcpt) return send(res, 400, { error: 'This is a customer payment. Edit it on the Payments received page.' });
    if (v.pmt) return send(res, 400, { error: 'This is a supplier payment. Edit it on the Payments made page.' });
    if (v.sal) return send(res, 400, { error: 'This is a salary payment. Edit it on the Salary payment page.' });
    if (v.refund) return send(res, 400, { error: 'This is a refund. Edit it on the Refunds page.' });
    if (d.bills.some(y => y.voucherId === v.id)) return send(res, 400, { error: 'This voucher was made from a bill. Edit the bill instead.' });
    const x = JSON.parse(b); if (!x.date) return send(res, 400, { error: 'Date is required' });
    const c = cleanLines(d, x.lines); if (c.error) return send(res, 400, c);
    Object.assign(v, { date: x.date, bs: x.bs, ref: x.ref, narration: x.narration, lines: c.lines }); save(d);
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
  }
  if (req.method === 'DELETE' && u.startsWith('/api/vouchers/')) { // removes the voucher, its bill (if any) and the Excel files of both
    const id = u.split('/').pop(), gone = d.vouchers.filter(v => String(v.id) === id), goneBills = d.bills.filter(x => String(x.voucherId) === id);
    d.vouchers = d.vouchers.filter(v => String(v.id) !== id);
    goneBills.forEach(g => { d.bills.forEach(x => { if (x.id === g.purchaseId) x.sold = null; }); d.vouchers.forEach(v => { if (v.rcpt && v.rcpt.billId === g.id) v.rcpt.billId = null; if (v.pmt && v.pmt.billId === g.id) v.pmt.billId = null; }); });
    d.bills = d.bills.filter(x => String(x.voucherId) !== id); resync(d); save(d);
    return send(res, 200, { files: [...gone.flatMap(dropVoucher), ...goneBills.flatMap(dropBill)] });
  }
}

module.exports = { handle };
