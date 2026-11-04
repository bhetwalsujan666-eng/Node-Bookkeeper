// server/banks.js — bank accounts, cheque-number formats, bank matching and splitting
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { rd } = require('./accounts');
const { splitCredits, splitNote } = require('./posting/payments');
const { loadDb } = require('./store');

// ---- Bank accounts: each one has its own ledger account, so every cheque shows which bank it was paid from. ----
// chequeFormat = the digits that never change on that bank's cheques, x = a digit that does, e.g. 7895xxxx. Several cheque books: separate with commas. Digits only (7895) = "starts with".
const fmtParts = f => String(f || '').split(/[,;]+/).map(x => x.toLowerCase().replace(/[\s-]/g, '').replace(/[#*?]/g, 'x')).filter(Boolean).map(s => ({ s, pre: !s.includes('x') }));

const fmtBad = f => fmtParts(f).some(p => !/^[0-9x]+$/.test(p.s) || !/\d/.test(p.s)) ? 'The cheque number format can only contain digits and x, for example 7895xxxx' : null;

const fmtHit = (p, run) => p.pre ? run.startsWith(p.s) : run.length === p.s.length && [...p.s].every((c, i) => c === 'x' || c === run[i]);

const fmtBoth = (a, b) => {
  if (!a.pre && !b.pre && a.s.length !== b.s.length) return false; if ((a.pre && !b.pre && b.s.length < a.s.length) || (b.pre && !a.pre && a.s.length < b.s.length)) return false;
  for (let i = 0, n = Math.min(a.s.length, b.s.length); i < n; i++) if (a.s[i] !== 'x' && b.s[i] !== 'x' && a.s[i] !== b.s[i]) return false; return true;
}; // could one cheque number fit both formats?

const banksFor = (banks, instr) => { const runs = String(instr || '').match(/\d+/g) || []; return banks.filter(b => fmtParts(b.chequeFormat).some(p => runs.some(r => fmtHit(p, r)))); }; // banks whose format fits a cheque number

const bankAcctName = n => /bank/i.test(n) ? n : 'Bank - ' + n; // "bank" in the name is what puts it in the Paid from lists

// Old cheque payments (payments made + salaries) whose cheque number fits exactly one bank's format. Ones already on a bank account chosen on purpose are only flagged, never moved.
function bankMatch(d) {
  const banks = loadDb().banks.filter(b => d.accounts.some(a => a.code === b.ledger)), chosen = new Set(banks.filter(b => !b.linked).map(b => b.ledger)), nmA = c => (d.accounts.find(a => a.code === c) || {}).name || c, out = { banks: banks.filter(b => fmtParts(b.chequeFormat).length).length, change: [], check: [], none: [] };
  if (!out.banks) return out;
  d.vouchers.filter(v => (v.pmt || v.sal) && (v.pmt || v.sal).mode === 'Cheque').sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(v => {
    const p = v.pmt || v.sal; if (p.splits || p.byStaff) return; const hit = banksFor(banks, p.instrument),
      row = { id: v.id, no: v.no, date: v.date, bs: v.bs || '', who: v.sal ? p.staff : p.other ? p.payee : p.supplier, cheque: p.instrument || '', amount: p.amount, from: nmA(p.account) };
    if (hit.length === 1) { if (p.account === hit[0].ledger) return; if (chosen.has(p.account)) out.check.push({ ...row, note: 'Recorded as ' + row.from + ', but the number fits ' + hit[0].name }); else out.change.push({ ...row, to: nmA(hit[0].ledger), toCode: hit[0].ledger }); }
    else if (hit.length > 1) out.check.push({ ...row, note: banksFor(banks, p.instrument).length > 1 && chqRuns(p.instrument).length > 1 && chqRuns(p.instrument).every(r => banksFor(banks, r).length === 1) ? 'Cheques from different banks in one payment: use “Split old payments made with several cheques” below' : 'The number fits more than one bank format' });
    else if (!chosen.has(p.account)) out.none.push({ ...row, note: p.instrument ? 'No bank format fits this number' : 'No cheque number recorded' });
  });
  return out;
}

// ---- Old payments made where ONE voucher holds several cheque numbers that belong to different banks (e.g. "7895001, 4410002").
// splitScan lists them (cheque -> bank by the formats above); the person types each cheque's amount; splitApply turns the voucher into a split payment (one credit line per bank, totals unchanged). ----
const chqRuns = s => [...new Set(String(s || '').match(/\d+/g) || [])];

function splitScan(d) {
  const banks = loadDb().banks.filter(b => d.accounts.some(a => a.code === b.ledger) && fmtParts(b.chequeFormat).length), nmA = c => (d.accounts.find(a => a.code === c) || {}).name || c, out = { banks: banks.length, rows: [], check: [] };
  if (!banks.length) return out;
  d.vouchers.filter(v => v.pmt && !v.pmt.splits && !v.pmt.byStaff && v.pmt.mode === 'Cheque').sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(v => {
    const p = v.pmt, runs = chqRuns(p.instrument); if (runs.length < 2) return;
    const hits = runs.map(r => ({ r, b: banksFor(banks, r) })), ok = hits.filter(h => h.b.length === 1);
    if (new Set(ok.map(h => h.b[0].ledger)).size < 2) return; // fewer than two banks recognised: not a multi-bank payment (the match tool above deals with single-bank ones)
    const row = { id: v.id, no: v.no, date: v.date, bs: v.bs || '', who: p.other ? p.payee : p.supplier, ref: p.instrument || '', total: p.amount, from: nmA(p.account), parts: ok.map(h => ({ cheque: h.r, ledger: h.b[0].ledger, bank: h.b[0].name })) };
    const cr = v.lines.filter(l => l.cr > 0);
    if (ok.length !== hits.length) out.check.push({ ...row, note: 'Cheque no. ' + hits.filter(h => h.b.length !== 1).map(h => h.r).join(', ') + ' fits no bank format (or more than one); add its format above or split by hand' });
    else if (!(cr.length === 1 && cr[0].account === p.account && Math.abs(cr[0].cr - p.amount) < .005)) out.check.push({ ...row, note: 'The voucher lines were changed by hand; edit this payment and add the cheques yourself' });
    else out.rows.push(row);
  });
  return out;
}

function splitPlan(d, items) {
  const scan = splitScan(d), plan = []; // validates everything first; nothing is changed here
  for (const it of items) {
    const row = scan.rows.find(r => r.id === it.id); if (!row) return { error: 'A payment in the list can no longer be split (it was changed or already split). Check again.' };
    const parts = row.parts.map(pt => { const g = (it.parts || []).find(y => String(y.cheque) === pt.cheque); return { account: pt.ledger, instrument: pt.cheque, amount: rd(+(g && g.amount) || 0) }; });
    if (parts.some(y => y.amount <= 0)) return { error: 'Enter an amount for every cheque of ' + row.no };
    const sum = rd(parts.reduce((t, y) => t + y.amount, 0)); if (Math.abs(sum - row.total) > .004) return { error: `The cheques of ${row.no} add up to ${sum.toFixed(2)} but the payment is ${row.total.toFixed(2)}` };
    plan.push({ row, parts });
  }
  return { plan };
}

function splitApply(d, plan) {
  const done = [];
  plan.forEach(({ row, parts }) => {
    const v = d.vouchers.find(y => y.id === row.id), p = v.pmt, i = v.lines.findIndex(l => l.cr > 0 && l.account === p.account);
    v.lines.splice(i, 1, ...splitCredits(d, parts)); p.splits = parts; p.account = parts[0].account; p.instrument = parts.map(y => y.instrument).join(', '); v.ref = p.instrument;
    v.narration = String(v.narration || '').replace(/ by Cheque\b/, m => m + splitNote(d, parts)); done.push(v);
  }); // only the credit side is rebuilt; the supplier/charge side, amounts and dates stay
  return done;
}

module.exports = { bankAcctName, bankMatch, fmtBad, fmtBoth, fmtParts, splitApply, splitPlan, splitScan };
