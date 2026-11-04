// server/routes/refunds.js — /api/refunds (create + edit). Delete uses the normal DELETE /api/vouchers/:id
const { autoSaveVoucher, resaveVoucher } = require('../files');
const { send } = require('../http');
const { post } = require('../posting/lines');
const { refundParts } = require('../posting/refunds');
const { save, touchParty } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'POST' && u === '/api/refunds') {
    const x = JSON.parse(b), r = refundParts(d, x); if (r.error) return send(res, 400, r);
    const v = post(d, r.type, x.date, x.bs, r.ref, r.narration, r.lines); v.refund = r.refund; v.heading = r.heading; v.notes = r.notes;
    touchParty(r.refund.party, r.refund.pan, r.refund.kind === 'received' ? 'supplier' : 'customer'); save(d);
    return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
  }
  if (req.method === 'PUT' && u.startsWith('/api/refunds/')) {
    const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id && y.refund); if (!v) return send(res, 404, { error: 'Refund not found' });
    const x = JSON.parse(b), r = refundParts(d, x); if (r.error) return send(res, 400, r);
    if (r.type !== v.type) return send(res, 400, { error: 'The refund type or settlement (cash/bank or party account) cannot be changed on an existing refund. Delete it and enter a new one.' });
    Object.assign(v, { date: x.date, bs: x.bs, ref: r.ref, narration: r.narration, lines: r.lines, refund: r.refund, heading: r.heading, notes: r.notes });
    touchParty(r.refund.party, r.refund.pan, r.refund.kind === 'received' ? 'supplier' : 'customer'); save(d);
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
  }
}

module.exports = { handle };
