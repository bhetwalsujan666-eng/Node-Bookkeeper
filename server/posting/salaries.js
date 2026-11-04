// server/posting/salaries.js — salary payments and the old-record migration
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey, party, rd } = require('../accounts');
const { MODES } = require('./receipts');
const { loadDb, upsert } = require('../store');

// ---- Salary payments: a Payment voucher  Dr Salary & Wages (or Salary Payable)  Cr Cash/Bank. New staff names are saved to the staff list in db.json. ----
function salaryParts(d, x) {
  const amt = rd(+x.amount || 0), typed = String(x.staff || '').trim(), ex = loadDb().staff.find(r => nkey(r.name) === nkey(typed)), staff = ex ? ex.name : typed,
  acct = d.accounts.find(a => a.code === x.account && a.type === 'A'), dr = d.accounts.find(a => a.code === String(x.debitAccount || '6000'));
  if (!staff) return { error: 'Enter the staff name' }; if (!x.date || amt <= 0) return { error: 'Date and an amount above zero are required' };
  if (!acct) return { error: 'Choose the cash or bank account the salary was paid from' }; if (!dr) return { error: 'The salary account no longer exists' };
  const mode = MODES.includes(x.mode) ? x.mode : 'Cash', ref = String(x.instrument || '').trim(), note = String(x.note || '').trim(), period = String(x.period || '').trim();
  const fee = mode === 'Fonepay' ? rd(Math.max(+x.fee || 0, 0)) : 0, pf = mode === 'Fonepay' ? { fee } : {}, fn = fee ? ' (Fonepay charge ' + fee + ')' : '', out = rd(amt + fee),
    feeL = fee ? [{ account: party(d, 'Fonepay Charges', 'X', 'Operating Expenses', 6000), dr: fee, cr: 0, desc: 'Fonepay charge' }] : []; // our expense; the staff member still receives the full amount
  return {
    sal: { staff, period, mode, instrument: ref, account: acct.code, debitAccount: dr.code, amount: amt, note, ...pf },
    narration: `Salary paid to ${staff}` + (period ? ' for ' + period : '') + ` by ${mode}${fn}` + (note ? ' - ' + note : ''),
    lines: [{ account: dr.code, dr: amt, cr: 0, desc: staff + ' - ' + dr.name }, ...feeL, { account: acct.code, dr: 0, cr: out, desc: acct.name }]
  };
}

// ---- One-time conversion of old records: supplier-style "other" payments charged to Salary & Wages / Salary Payable become salary payments (same accounting, same voucher no.) ----
const migratable = d => d.vouchers.filter(v => v.pmt && v.pmt.other && ['6000', '2040'].includes(v.pmt.debitAccount));

function migrateSalaries(d) { const list = migratable(d); list.forEach(v => { const p = v.pmt; v.sal = { staff: p.payee, period: '', mode: p.mode, instrument: p.instrument, account: p.account, debitAccount: p.debitAccount, amount: p.amount, note: p.note, ...(p.fee !== undefined ? { fee: p.fee } : {}) }; delete v.pmt; upsert('staff', { name: p.payee }); }); return list; }

module.exports = { migratable, migrateSalaries, salaryParts };
