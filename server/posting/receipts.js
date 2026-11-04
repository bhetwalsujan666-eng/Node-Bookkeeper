// server/posting/receipts.js — payments received from customers
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey, party, rd } = require('../accounts');

// ---- Payments received from customers: a Receipt voucher  Dr Cash/Bank  Cr <customer's debtor account> ----
const MODES = ['Cash', 'Cheque', 'Fonepay', 'Bank transfer'];

function receiptParts(d, x) {
  const amt = rd(+x.amount || 0), payer = String(x.payer || '').trim(), acct = d.accounts.find(a => a.code === x.account && a.type === 'A');
  let cust = String(x.customer || '').trim(), cr = null; // cr = a non-customer account to credit (payer is not a recorded client)
  if (x.creditAccount) { cr = d.accounts.find(a => a.code === String(x.creditAccount)); if (!cr) return { error: 'The account to credit no longer exists' }; if (cr.group === 'Sundry Debtors') { cust = cr.name; cr = null; } }
  if (!x.date || amt <= 0) return { error: 'Date and an amount above zero are required' };
  if (!acct) return { error: 'Choose the cash or bank account the money went into' };
  const mode = MODES.includes(x.mode) ? x.mode : 'Cash', ref = String(x.instrument || '').trim(), note = String(x.note || '').trim();
  if (cr) { // payment from someone who is not a recorded customer: Dr Cash/Bank  Cr <chosen account>
    if (!payer) return { error: 'Enter who the payment was received from' };
    if (cr.code === acct.code) return { error: 'The account credited must be different from the account the money went into' };
    return {
      rcpt: { customer: '', other: true, payer, creditAccount: cr.code, mode, instrument: ref, billId: null, account: acct.code, amount: amt, note },
      narration: `Received from ${payer} by ${mode} - credited to ${cr.name}` + (note ? ' - ' + note : ''),
      lines: [{ account: acct.code, dr: amt, cr: 0, desc: acct.name }, { account: cr.code, dr: 0, cr: amt, desc: payer }]
    };
  }
  if (!cust) return { error: 'Choose a customer, or choose another account to credit' };
  const bill = x.billId ? d.bills.find(y => String(y.id) === String(x.billId) && y.kind === 'sales') : null;
  if (bill && nkey(bill.customer) !== nkey(cust)) return { error: 'That bill belongs to a different customer' };
  const cus = party(d, cust, 'A', 'Sundry Debtors', 1200), name = d.accounts.find(a => a.code === cus).name;
  return {
    rcpt: { customer: name, ...(payer ? { payer } : {}), mode, instrument: ref, billId: bill ? bill.id : null, account: acct.code, amount: amt, note },
    narration: `Received from ${payer && nkey(payer) !== nkey(name) ? payer + ' on behalf of ' : ''}${name} by ${mode}` + (bill ? ' against bill ' + bill.billNo : '') + (note ? ' - ' + note : ''),
    lines: [{ account: acct.code, dr: amt, cr: 0, desc: acct.name }, { account: cus, dr: 0, cr: amt, desc: name }]
  };
}

module.exports = { MODES, receiptParts };
