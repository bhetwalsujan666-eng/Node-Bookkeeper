// server/routes/payments.js — /api/payments CRUD + /fee
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { autoSaveVoucher, resaveVoucher } = require('../files');
const { send } = require('../http');
const { post } = require('../posting/lines');
const { paymentParts } = require('../posting/payments');
const { save, touchParty, upsert } = require('../store');
const { dupInvoice } = require('../posting/review');

// the same supplier invoice must not be claimed twice
const dupInv = (d, r, selfId) => r.pmt.inv && dupInvoice(d, { supplier: r.pmt.payee, billNo: r.pmt.inv.billNo }, selfId) ? { error: `Invoice ${r.pmt.inv.billNo} from ${r.pmt.payee} is already in the purchase book` } : null;

async function handle({ req, res, u, b, d }) {
  if (req.method === 'PUT' && /^\/api\/payments\/\d+\/fee$/.test(u)) { // add the Fonepay charge to an old payment (re-posts that voucher in place)
    const id = u.split('/')[3], v = d.vouchers.find(y => String(y.id) === id && y.pmt && y.pmt.mode === 'Fonepay'); if (!v) return send(res, 404, { error: 'Fonepay payment not found' });
    const p = v.pmt, r = paymentParts(d, { supplier: p.supplier, debitAccount: p.debitAccount || '', payee: p.payee, date: v.date, amount: p.amount, mode: p.mode, account: p.account, instrument: p.instrument, billId: p.billId, note: p.note, paidBy: p.paidBy, byStaff: p.byStaff, inv: p.inv, fee: JSON.parse(b).fee });
    if (r.error) return send(res, 400, r); Object.assign(v, { narration: r.narration, lines: r.lines, pmt: r.pmt }); save(d);
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
  }
  if (req.method === 'POST' && u === '/api/payments') {
    const x = JSON.parse(b), r = paymentParts(d, x), dp = r.error ? null : dupInv(d, r); if (r.error || dp) return send(res, 400, r.error ? r : dp);
    if (r.pmt.paidBy) upsert('staff', { name: r.pmt.paidBy });
    const v = post(d, 'Payment', x.date, x.bs, r.pmt.instrument, r.narration, r.lines); v.pmt = r.pmt; touchParty(r.pmt.supplier, '', 'supplier'); save(d);
    return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
  }
  if (req.method === 'PUT' && u.startsWith('/api/payments/')) {
    const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id && y.pmt); if (!v) return send(res, 404, { error: 'Payment not found' });
    const x = JSON.parse(b), r = paymentParts(d, x), dp = r.error ? null : dupInv(d, r, v.id); if (r.error || dp) return send(res, 400, r.error ? r : dp);
    if (r.pmt.paidBy) upsert('staff', { name: r.pmt.paidBy });
    Object.assign(v, { date: x.date, bs: x.bs, ref: r.pmt.instrument, narration: r.narration, lines: r.lines, pmt: r.pmt }); touchParty(r.pmt.supplier, '', 'supplier'); save(d);
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
  }
}

module.exports = { handle };
