// server/posting/receivables.js — per-customer receivables picture
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey, rd } = require('../accounts');
const { loadDb } = require('../store');

// Per-customer picture for the Payments page. The statement is the customer's ledger account (so it always agrees with the Balance Sheet);
// each bill's paid/due is worked out from the receipts: those tied to a bill go to it, the rest are applied to the oldest bills first.
function receivables(d) {
  const db = loadDb(), map = new Map(), get = n => { const k = nkey(n); if (!k) return null; if (!map.has(k)) map.set(k, { name: String(n).trim(), pan: '', bills: [], rcpts: [], pending: [] }); return map.get(k); };
  db.parties.filter(p => p.type !== 'supplier').forEach(p => { const c = get(p.name); if (c) c.pan = p.pan || ''; });
  d.bills.forEach(x => { const c = get(x.customer); if (!c) return; if (x.kind === 'sales') { c.bills.push(x); if (!c.pan) c.pan = x.customerVat || ''; } else if (!x.sold) c.pending.push(x); });
  d.vouchers.filter(v => v.rcpt && !v.rcpt.other).forEach(v => get(v.rcpt.customer).rcpts.push(v));
  const vs = d.vouchers.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return [...map.values()].map(c => {
    const acct = d.accounts.find(a => a.group === 'Sundry Debtors' && nkey(a.name) === nkey(c.name)); let bal = 0, dr = 0, cr = 0, hand = 0; const statement = [];
    if (acct) vs.forEach(v => v.lines.filter(l => l.account === acct.code).forEach(l => {
      bal = rd(bal + l.dr - l.cr); dr += l.dr; cr += l.cr; if (!v.rcpt && !d.bills.some(x => x.voucherId === v.id)) hand += l.cr; // credits made by hand (e.g. older Receipt vouchers) also count as money received
      statement.push({ date: v.date, bs: v.bs, no: v.no, vid: v.id, type: v.type, ref: v.ref, narration: v.narration, dr: l.dr, cr: l.cr, bal, rcpt: !!v.rcpt, billId: (d.bills.find(x => x.voucherId === v.id) || {}).id });
    }));
    const bills = c.bills.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true })), paid = new Map(bills.map(x => [x.id, 0])); let free = hand;
    c.rcpts.forEach(v => { const amt = v.rcpt.amount, id = v.rcpt.billId; if (id != null && paid.has(id)) paid.set(id, paid.get(id) + amt); else free += amt; });
    bills.forEach(x => { const over = paid.get(x.id) - x.total; if (over > 0) { free += over; paid.set(x.id, x.total); } });
    bills.forEach(x => { const take = Math.min(free, rd(x.total - paid.get(x.id))); if (take > 0) { paid.set(x.id, rd(paid.get(x.id) + take)); free = rd(free - take); } });
    return {
      name: c.name, pan: c.pan, dr: rd(dr), cr: rd(cr), balance: bal, advance: rd(free), statement,
      bills: bills.map(x => { const pd = rd(paid.get(x.id)), due = rd(x.total - pd); return { id: x.id, billNo: x.billNo, date: x.date, bs: x.bs, voucher: x.voucher, total: x.total, paid: pd, due, status: due <= .004 ? 'Paid' : pd > .004 ? 'Partial' : 'Unpaid' }; }),
      pending: c.pending.map(x => ({ id: x.id, billNo: x.billNo, supplier: x.supplier, date: x.date, total: x.total, passenger: x.passenger, category: x.category }))
    };
  })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

module.exports = { receivables };
