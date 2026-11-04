// server/routes/sales.js — /api/sales CRUD
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey } = require('../accounts');
const { autoSaveInvoice, dropBill, resaveBill, resaveVoucher } = require('../files');
const { send } = require('../http');
const { post, resync } = require('../posting/lines');
const { salesBad, salesParts } = require('../posting/sales');
const { save, touchParty } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'POST' && u === '/api/sales') {
    const s = JSON.parse(b), bad = salesBad(s); if (bad) return send(res, 400, { error: bad });
    if (s.billNo && d.bills.some(y => y.kind === 'sales' && nkey(y.billNo) === nkey(s.billNo))) return send(res, 400, { error: `Invoice number ${s.billNo} is already used by another sales bill` });
	const billNo = s.billNo || String(d.seq.SB = (d.seq.SB || 0) + 1).padStart(3, '0'), x = salesParts(d, s, billNo);
    const v = post(d, 'Sales', s.date, s.bs, billNo, x.narration, x.lines); v.notes = x.notes;
    const bill = { id: v.id, kind: 'sales', category: x.cat, voucherId: v.id, voucher: v.no, billNo, customer: s.customer, customerVat: s.customerVat, date: s.date, bs: s.bs, passenger: s.passenger, particulars: s.particulars, nonTax: x.nonTax, taxable: x.taxable, vat: x.vat, total: x.total, purchaseId: s.purchaseId };
    d.bills.push(bill); const pb = d.bills.find(y => y.id === s.purchaseId); if (pb) pb.sold = billNo; touchParty(s.customer, s.customerVat, 'customer'); save(d); return send(res, 200, { ...bill, saved: await autoSaveInvoice(bill) });
  }
  if (req.method === 'PUT' && u.startsWith('/api/sales/')) { // edit a sales bill: its sales voucher is rebuilt in place (same voucher no.)
    const id = u.split('/').pop(), bill = d.bills.find(y => String(y.id) === id && y.kind === 'sales'), v = bill && d.vouchers.find(y => y.id === bill.voucherId);
    if (!bill || !v) return send(res, 404, { error: 'Sales bill not found' });
    const s = JSON.parse(b), bad = salesBad(s); if (bad) return send(res, 400, { error: bad });
    const billNo = String(s.billNo || bill.billNo).trim();
    if (d.bills.some(y => y.kind === 'sales' && y.id !== bill.id && nkey(y.billNo) === nkey(billNo))) return send(res, 400, { error: `Invoice number ${billNo} is already used by another sales bill` });
	if (nkey(s.customer) !== nkey(bill.customer) && d.vouchers.some(y => y.rcpt && y.rcpt.billId === bill.id)) return send(res, 400, { error: 'Payments are recorded against this bill. Edit or delete those payments before changing the customer.' });
    const old = { ...bill }, x = salesParts(d, s, billNo);
    Object.assign(v, { date: s.date, bs: s.bs, ref: billNo, narration: x.narration, lines: x.lines, notes: x.notes });
    Object.assign(bill, { category: x.cat, billNo, customer: s.customer, customerVat: s.customerVat, date: s.date, bs: s.bs, passenger: s.passenger, particulars: s.particulars, nonTax: x.nonTax, taxable: x.taxable, vat: x.vat, total: x.total });
    const pb = d.bills.find(y => y.id === bill.purchaseId); if (pb) pb.sold = billNo;
    touchParty(s.customer, s.customerVat, 'customer'); resync(d); save(d); if (old.billNo !== billNo) dropBill(old);
    return send(res, 200, { ...bill, saved: await resaveBill(bill), voucherSaved: await resaveVoucher(v, d) });
  }
}

module.exports = { handle };
