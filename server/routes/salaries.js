// server/routes/salaries.js — /api/salaries CRUD + /fee
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { autoSaveVoucher, resaveVoucher } = require('../files');
const { send } = require('../http');
const { post } = require('../posting/lines');
const { salaryParts } = require('../posting/salaries');
const { save, upsert } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'POST' && u === '/api/salaries') {
    const x = JSON.parse(b), r = salaryParts(d, x); if (r.error) return send(res, 400, r);
    const v = post(d, 'Payment', x.date, x.bs, r.sal.instrument, r.narration, r.lines); v.sal = r.sal; upsert('staff', { name: r.sal.staff }); save(d);
    return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
  }
  if (req.method === 'PUT' && /^\/api\/salaries\/\d+\/fee$/.test(u)) { // add the Fonepay charge to an old salary payment
    const id = u.split('/')[3], v = d.vouchers.find(y => String(y.id) === id && y.sal && y.sal.mode === 'Fonepay'); if (!v) return send(res, 404, { error: 'Fonepay salary payment not found' });
    const p = v.sal, r = salaryParts(d, { staff: p.staff, period: p.period, date: v.date, amount: p.amount, mode: p.mode, account: p.account, instrument: p.instrument, note: p.note, debitAccount: p.debitAccount, fee: JSON.parse(b).fee });
    if (r.error) return send(res, 400, r); Object.assign(v, { narration: r.narration, lines: r.lines, sal: r.sal }); save(d);
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
  }
  if (req.method === 'PUT' && u.startsWith('/api/salaries/')) {
    const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id && y.sal); if (!v) return send(res, 404, { error: 'Salary payment not found' });
    const x = JSON.parse(b), r = salaryParts(d, x); if (r.error) return send(res, 400, r);
    Object.assign(v, { date: x.date, bs: x.bs, ref: r.sal.instrument, narration: r.narration, lines: r.lines, sal: r.sal }); upsert('staff', { name: r.sal.staff }); save(d);
    return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
  }
}

module.exports = { handle };
