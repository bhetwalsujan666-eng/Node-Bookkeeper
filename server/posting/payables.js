// server/posting/payables.js — per-supplier payables picture
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey, rd } = require('../accounts');
const { loadDb } = require('../store');

// Per-supplier picture for the Payments made page (same idea as receivables()): the statement is the supplier's ledger account,
// each purchase bill's paid/due comes from the payments: those tied to a bill go to it, the rest are applied to the oldest bills first.
function payables(d) {
  const db = loadDb(), map = new Map(), get = n => { const k = nkey(n); if (!k) return null; if (!map.has(k)) map.set(k, { name: String(n).trim(), pan: '', bills: [], pmts: [] }); return map.get(k); };
  db.parties.filter(p => p.type !== 'customer').forEach(p => { const c = get(p.name); if (c) c.pan = p.pan || ''; });
  d.bills.forEach(x => { if (x.kind !== 'purchase') return; const c = get(x.supplier); if (!c) return; c.bills.push(x); if (!c.pan) c.pan = x.supplierPan || ''; });
  d.vouchers.filter(v => v.pmt && !v.pmt.other).forEach(v => get(v.pmt.supplier).pmts.push(v));
  const vs = d.vouchers.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return [...map.values()].map(c => {
    const acct = d.accounts.find(a => a.group === 'Sundry Creditors' && nkey(a.name) === nkey(c.name)); let bal = 0, billed = 0, paidAmt = 0, hand = 0; const statement = [];
    if (acct) vs.forEach(v => v.lines.filter(l => l.account === acct.code).forEach(l => {
      bal = rd(bal + l.cr - l.dr); billed += l.cr; paidAmt += l.dr; if (!v.pmt && !d.bills.some(x => x.voucherId === v.id)) hand += l.dr; // debits made by hand also count as money paid
      statement.push({ date: v.date, bs: v.bs, no: v.no, vid: v.id, type: v.type, ref: v.ref, narration: v.narration, cr: l.cr, dr: l.dr, bal, pmt: !!v.pmt, billId: (d.bills.find(x => x.voucherId === v.id) || {}).id });
    }));
    const bills = c.bills.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true })), paid = new Map(bills.map(x => [x.id, 0])); let free = hand;
    c.pmts.forEach(v => { const amt = v.pmt.amount, id = v.pmt.billId; if (id != null && paid.has(id)) paid.set(id, paid.get(id) + amt); else free += amt; });
    bills.forEach(x => { const over = paid.get(x.id) - x.total; if (over > 0) { free += over; paid.set(x.id, x.total); } });
    bills.forEach(x => { const take = Math.min(free, rd(x.total - paid.get(x.id))); if (take > 0) { paid.set(x.id, rd(paid.get(x.id) + take)); free = rd(free - take); } });
    return {
      name: c.name, pan: c.pan, billed: rd(billed), paid: rd(paidAmt), balance: bal, advance: rd(free), statement,
      bills: bills.map(x => { const pd = rd(paid.get(x.id)), due = rd(x.total - pd); return { id: x.id, billNo: x.billNo, date: x.date, bs: x.bs, voucher: x.voucher, total: x.total, paid: pd, due, status: due <= .004 ? 'Paid' : pd > .004 ? 'Partial' : 'Unpaid' }; })
    };
  })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

module.exports = { payables };
