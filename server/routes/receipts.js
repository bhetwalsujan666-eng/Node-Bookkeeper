// server/routes/receipts.js — /api/receipts CRUD
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { autoSaveVoucher, resaveVoucher } = require('../files');
const { send } = require('../http');
const { post } = require('../posting/lines');
const { receiptParts } = require('../posting/receipts');
const { save, touchParty } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'POST' && u === '/api/receipts') {
    const x = JSON.parse(b), r = receiptParts(d, x); if (r.error) return send(res, 400, r);
    const v = post(d, 'Receipt', x.date, x.bs, r.rcpt.instrument, r.narration, r.lines); v.rcpt = r.rcpt; touchParty(r.rcpt.customer, '', 'customer'); save(d);
    return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
  }
  if (req.method === 'PUT' && u.startsWith('/api/receipts/')) {
    const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id && y.rcpt); if (!v) return send(res, 404, { error: 'Payment not found' });
    const x = JSON.parse(b), r = receiptParts(d, x); if (r.error) return send(res, 400, r);
    Object.assign(v, { date: x.date, bs: x.bs, ref: r.rcpt.instrument, narration: r.narration, lines: r.lines, rcpt: r.rcpt }); touchParty(r.rcpt.customer, '', 'customer'); save(d);
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
  }
}

module.exports = { handle };
