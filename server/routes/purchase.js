// server/routes/purchase.js — /api/purchase CRUD
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey } = require('../accounts');
const { autoSaveBill, autoSaveVoucher, dropBill, resaveBill, resaveVoucher } = require('../files');
const { send } = require('../http');
const { post } = require('../posting/lines');
const { purchaseBad, purchaseFields, purchaseParts } = require('../posting/purchase');
const { save, touchParty } = require('../store');
const dupPurchase = (d, p, selfId) => (d.bills.some(x => x.kind === 'purchase' && x.id !== selfId && nkey(x.supplier) === nkey(p.supplier) && nkey(x.billNo) === nkey(p.billNo)) || d.vouchers.some(v => { const t = v.taxInv || (v.pmt && v.pmt.inv && { ...v.pmt.inv, supplier: v.pmt.payee }); return t && nkey(t.supplier) === nkey(p.supplier) && nkey(t.billNo) === nkey(p.billNo); })) ? `Purchase bill ${p.billNo} from ${p.supplier} is already recorded` : null;

async function handle({ req, res, u, b, d }) {
  if (req.method === 'POST' && u === '/api/purchase') {
    const p = JSON.parse(b), bad = purchaseBad(p) || dupPurchase(d,p); if (bad) return send(res, 400, { error: bad });
    const x = purchaseParts(d, p), v = post(d, 'Journal', p.date, p.bs, p.billNo, x.narration, x.lines);
    v.purchase = true; v.heading = x.heading; v.notes = x.notes;
    const pbl = { id: v.id, kind: 'purchase', voucherId: v.id, voucher: v.no, ...purchaseFields(p, x), sold: null }; d.bills.push(pbl);
    touchParty(p.supplier, p.supplierPan, 'supplier'); touchParty(p.customer, '', 'customer'); save(d); return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d), savedBill: await autoSaveBill(pbl) });
  }
  if (req.method === 'PUT' && u.startsWith('/api/purchase/')) { // edit a purchase bill: its journal voucher is rebuilt in place (same voucher no.)
    const id = u.split('/').pop(), bill = d.bills.find(y => String(y.id) === id && y.kind === 'purchase'), v = bill && d.vouchers.find(y => y.id === bill.voucherId);
    if (!bill || !v) return send(res, 404, { error: 'Purchase bill not found' });
    const p = JSON.parse(b), bad = purchaseBad(p) || dupPurchase(d,p, bill.id); if (bad) return send(res, 400, { error: bad });
    if (nkey(p.supplier) !== nkey(bill.supplier) && d.vouchers.some(y => y.pmt && y.pmt.billId === bill.id)) return send(res, 400, { error: 'Payments are recorded against this bill. Edit or delete those payments before changing the supplier.' });
    const old = { ...bill }, x = purchaseParts(d, p);
    Object.assign(v, { date: p.date, bs: p.bs, ref: p.billNo, narration: x.narration, lines: x.lines, heading: x.heading, notes: x.notes });
    Object.assign(bill, purchaseFields(p, x)); touchParty(p.supplier, p.supplierPan, 'supplier'); touchParty(p.customer, '', 'customer');
    save(d); if (old.billNo !== bill.billNo) dropBill(old);
    for (const sb of d.bills.filter(y => y.kind === 'sales' && y.purchaseId === bill.id)) await resaveBill(sb); // the sales invoice quotes the purchase supplier/category
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d), savedBill: await resaveBill(bill) });
  }
}

module.exports = { handle };
