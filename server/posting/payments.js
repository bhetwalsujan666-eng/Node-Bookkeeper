// server/posting/payments.js — payments made to suppliers, cheque splits
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey, party, rd } = require('../accounts');
const { MODES } = require('./receipts');
const { eligible } = require('./purchasebook');
const { purchaseBad } = require('./purchase');
const { loadDb } = require('../store');

// ---- One payment by several cheques (maybe from different banks): pmt.splits = [{ account, instrument, amount }, ...]. pmt.account / pmt.instrument stay as the first cheque's / all cheque numbers
// so older screens keep working; the voucher gets one credit line per bank account. ----
function chequeSplits(d, x, mode, amt, acct, ref) {
  if (!Array.isArray(x.more) || !x.more.length) return {};
  if (mode !== 'Cheque') return { error: 'More than one cheque can only be used when the mode is Cheque' };
  const extra = []; for (const m of x.more) {
    const a = d.accounts.find(y => y.code === String(m.account) && y.type === 'A'), n = rd(+m.amount || 0);
    if (!a) return { error: 'Choose the bank account for every extra cheque' }; if (n <= 0) return { error: 'Enter an amount for every extra cheque' };
    extra.push({ account: a.code, instrument: String(m.instrument || '').trim(), amount: n });
  }
  const first = rd(amt - extra.reduce((t, y) => t + y.amount, 0));
  if (first <= 0.004) return { error: 'The extra cheques add up to the whole payment (or more), so nothing is left for the first cheque' };
  return { splits: [{ account: acct.code, instrument: ref, amount: first }, ...extra] };
}

const splitCredits = (d, splits) => { const by = new Map(); splits.forEach(y => by.set(y.account, rd((by.get(y.account) || 0) + y.amount))); return [...by].map(([account, cr]) => ({ account, dr: 0, cr, desc: (d.accounts.find(a => a.code === account) || {}).name || account })); }; // one credit line per bank account

const splitNote = (d, splits) => ' (' + splits.map(y => (y.instrument || 'no cheque no.') + ' ' + ((d.accounts.find(a => a.code === y.account) || {}).name || y.account) + ' ' + y.amount.toFixed(2)).join('; ') + ')';

// ---- Payments made to suppliers: a Payment voucher  Dr <supplier's creditor account>  Cr Cash/Bank ----
// A payment can be for any amount (part of a bill, several bills, or more than is owed). If the payee is not a recorded supplier,
// it is charged to whichever account is chosen instead (Advance to Suppliers, an expense, etc.) and marked `other`.
function paymentParts(d, x) {
  // paidBy = a staff member (or the CEO) paid out of their own pocket: the credit goes to "Due to <name>" (company owes them) instead of cash/bank
  const amt = rd(+x.amount || 0), payee = String(x.payee || '').trim(), paidBy = String(x.paidBy || '').trim(),
    stf = x.byStaff ? loadDb().staff.find(s => nkey(s.name) === nkey(x.byStaff)) : null;
  if (x.byStaff && paidBy) return { error: 'Choose either Paid by staff / CEO or Paid by staff (own money), not both' };
  if (x.byStaff && !(stf && stf.ledger && d.accounts.some(a => a.code === stf.ledger))) return { error: 'That staff member has no ledger account linked. Link one under Salary payment > Staff details.' };
  const acct = stf ? d.accounts.find(a => a.code === stf.ledger) : paidBy ? { code: party(d, 'Due to ' + paidBy, 'L', 'Staff Payables', 2300), name: 'Due to ' + paidBy } : d.accounts.find(a => a.code === x.account && a.type === 'A');
  let sup = String(x.supplier || '').trim(), dr = null;
  if (x.debitAccount) { dr = d.accounts.find(a => a.code === String(x.debitAccount)); if (!dr) return { error: 'The account to charge no longer exists' }; if (dr.group === 'Sundry Creditors') { sup = dr.name; dr = null; } }
  if (!x.date || amt <= 0) return { error: 'Date and an amount above zero are required' };
  if (!acct) return { error: 'Choose the cash or bank account the money was paid from' };
  const mode = MODES.includes(x.mode) ? x.mode : 'Cash', ref = String(x.instrument || '').trim(), note = String(x.note || '').trim();
  const fee = mode === 'Fonepay' ? rd(Math.max(+x.fee || 0, 0)) : 0, pf = mode === 'Fonepay' ? { fee } : {}, fn = (fee ? ' (Fonepay charge ' + fee + ')' : '') + (paidBy ? ' - paid by ' + paidBy + ' (company owes ' + paidBy + ')' : ''), out = rd(amt + fee),
    feeL = fee ? [{ account: party(d, 'Fonepay Charges', 'X', 'Operating Expenses', 6000), dr: fee, cr: 0, desc: 'Fonepay charge' }] : []; // the charge is our expense; the supplier still receives the full amount
  if ((paidBy || stf) && Array.isArray(x.more) && x.more.length) return { error: 'A payment made by staff cannot be split over several cheques' };
  const sp = stf ? {} : chequeSplits(d, x, mode, amt, acct, ref); if (sp.error) return sp; // one payment by several cheques / banks: x.more = the cheques after the first
  const crL = sp.splits ? splitCredits(d, sp.splits) : [{ account: acct.code, dr: 0, cr: out, desc: acct.name }], sn = sp.splits ? splitNote(d, sp.splits) : (stf ? ' (paid by ' + stf.name + ')' : ''), instr = sp.splits ? sp.splits.map(y => y.instrument).filter(Boolean).join(', ') : ref, spf = sp.splits ? { splits: sp.splits } : {};
  if (dr) { // payee is not a recorded supplier: Dr <chosen account>  Cr Cash/Bank
    if (!payee) return { error: 'Enter who the payment was made to' };
    if (dr.code === acct.code) return { error: 'The account charged must be different from the account the money was paid from' };
    // Tax invoice (optional): the VAT is split out to 1050 VAT Receivable so it can be claimed, and the payment goes in the purchase book as a taxed purchase
    const iv = x.inv || {}; let inv = null, vatL = [], net = amt;
    if (iv.billNo || iv.supplierPan || +iv.taxable) {
      if (!eligible(dr)) return { error: 'VAT can only be claimed on a purchase charged to an expense or asset account' };
      const taxable = rd(+iv.taxable || 0); let vat = rd(taxable * 0.13); if (rd(taxable + vat - amt) > 0 && rd(taxable + vat - amt) <= 1) vat = rd(amt - taxable); // allow a rupee of rounding
      const t = { supplier: payee, supplierPan: String(iv.supplierPan || '').trim(), billNo: String(iv.billNo || '').trim(), taxable, vat, nonTax: rd(amt - taxable - vat) };
      if (t.nonTax < 0) return { error: `Taxable amount (${taxable}) plus 13% VAT (${vat}) is more than the amount paid (${amt})` };
      const bad = purchaseBad({ ...t, date: x.date, bs: x.bs }); if (bad) return { error: bad };
      inv = { billNo: t.billNo, supplierPan: t.supplierPan, taxable, vat, nonTax: t.nonTax }; net = rd(amt - vat);
      vatL = [{ account: '1050', dr: vat, cr: 0, desc: 'Input VAT - invoice ' + t.billNo }];
    }
    return {
      pmt: { supplier: '', other: true, payee, debitAccount: dr.code, mode, instrument: instr, billId: null, account: acct.code, amount: amt, note, ...(paidBy ? { paidBy } : {}), ...(stf ? { byStaff: stf.name } : {}), ...(inv ? { inv } : {}), ...pf, ...spf },
      narration: `Paid to ${payee} by ${mode}${sn}${fn} - charged to ${dr.name}` + (note ? ' - ' + note : ''),
      lines: [{ account: dr.code, dr: net, cr: 0, desc: payee }, ...vatL, ...feeL, ...crL]
    };
  }
  if (x.inv && (x.inv.billNo || x.inv.supplierPan || +x.inv.taxable)) return { error: 'Tax invoice details are only for payments charged to an expense or asset account. For a supplier bill, enter the bill on the Bills page so its VAT is claimed there' };
  if (!sup) return { error: 'Choose a supplier, or choose another account to charge' };
  const bill = x.billId ? d.bills.find(y => String(y.id) === String(x.billId) && y.kind === 'purchase') : null;
  if (bill && nkey(bill.supplier) !== nkey(sup)) return { error: 'That bill belongs to a different supplier' };
  const cid = party(d, sup, 'L', 'Sundry Creditors', 2200), name = d.accounts.find(a => a.code === cid).name;
  return {
    pmt: { supplier: name, ...(payee ? { payee } : {}), ...(paidBy ? { paidBy } : {}), ...(stf ? { byStaff: stf.name } : {}), mode, instrument: instr, billId: bill ? bill.id : null, account: acct.code, amount: amt, note, ...pf, ...spf },
    narration: `Paid to ${name}${payee && nkey(payee) !== nkey(name) ? ' (via ' + payee + ')' : ''} by ${mode}${sn}${fn}` + (bill ? ' against bill ' + bill.billNo : '') + (note ? ' - ' + note : ''),
    lines: [{ account: cid, dr: amt, cr: 0, desc: name }, ...feeL, ...crL]
  };
}

module.exports = { paymentParts, splitCredits, splitNote };
