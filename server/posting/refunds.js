// server/posting/refunds.js — refunds RECEIVED from suppliers (debit note) and refunds PAID to customers (credit note)
// Any bill type, nothing is mandatory except the party, date and amount. VAT rules and register entry apply only when a VAT amount is given.
const { catName, party, rd } = require('../accounts');
const { PAN_RE, BS_RE } = require('./vatrules');
const { MODES } = require('./receipts');

const RO_CODE = '9991'; // Round Off ledger account

// received: Dr cash/bank (or supplier account)  Cr <Category> Purchase, Cr 1050 input VAT      (reverses a purchase)
// paid:     Dr <Category> Sales, Dr 2020 output VAT  Cr cash/bank (or customer account)         (reverses a sale)
function refundParts(d, x) {
  const kind = x.kind === 'paid' ? 'paid' : 'received', R = kind === 'received', name = String(x.party || '').trim(), pan = String(x.pan || '').trim(),
    nonTax = rd(+x.nonTax || 0), taxable = rd(+x.taxable || 0), vat = rd(+x.vat || 0), roundOff = rd(+x.roundOff || 0), total = rd(nonTax + taxable + vat + roundOff);
  if (!name) return { error: R ? 'Enter the supplier the refund is received from' : 'Enter the customer the refund is paid to' };
  if (!x.date) return { error: 'Date is required' };
  if (nonTax < 0 || taxable < 0 || vat < 0) return { error: 'Amounts cannot be negative' };
  if (Math.abs(roundOff) > 10) return { error: 'Round off looks too large (more than 10). Check the amount' };
  if (total <= 0) return { error: 'Enter the refund amount' };
  if (x.bs && !BS_RE.test(String(x.bs).trim())) return { error: 'Date (BS) must look like 2083-07-15 (year-month-day)' };
  if (pan && !PAN_RE.test(pan)) return { error: 'PAN/VAT no. must be 9 digits' };
  if (vat > 0) { // VAT features only when VAT is given
    if (R && !pan) return { error: 'Supplier PAN/VAT no. is required when the refund has VAT, so it can go in the purchase book' };
    if (taxable <= 0) return { error: 'The refund has VAT but no taxable amount' };
    if (Math.abs(vat - rd(taxable * 0.13)) > 1) return { error: `VAT (${vat}) does not match 13% of the taxable amount (${rd(taxable * 0.13)}). Check the amounts` };
  }
  const settle = x.settle === 'party' ? 'party' : 'cash', acct = settle === 'cash' ? d.accounts.find(a => a.code === String(x.account) && a.type === 'A') : null;
  if (settle === 'cash' && !acct) return { error: R ? 'Choose the cash or bank account the refund went into' : 'Choose the cash or bank account the refund was paid from' };
  const cat = catName(x.category), mode = MODES.includes(x.mode) ? x.mode : 'Cash', instrument = String(x.instrument || '').trim(), note = String(x.note || '').trim(), noteNo = String(x.noteNo || '').trim(), billNo = String(x.billNo || '').trim(), particulars = String(x.particulars || '').trim();
  const main = R ? party(d, cat + ' Purchase', 'X', 'Direct Costs', 5100) : party(d, cat + ' Sales', 'I', 'Income', 4100), pty = R ? party(d, name, 'L', 'Sundry Creditors', 2200) : party(d, name, 'A', 'Sundry Debtors', 1200),
    pname = d.accounts.find(a => a.code === pty).name, side = settle === 'cash' ? acct.code : pty, sideDesc = settle === 'cash' ? acct.name : pname, vatAcc = R ? '1050' : '2020';
  if (roundOff && !d.accounts.some(a => a.code === RO_CODE)) d.accounts.push({ code: RO_CODE, name: 'Round Off', type: 'X', group: 'Operating Expenses' });
  const lines = [
    { account: main, ...(R ? { dr: 0, cr: nonTax } : { dr: nonTax, cr: 0 }), desc: 'Non Taxable (refund)' }, { account: main, ...(R ? { dr: 0, cr: taxable } : { dr: taxable, cr: 0 }), desc: 'Taxable (refund)' },
    { account: vatAcc, ...(R ? { dr: 0, cr: vat } : { dr: vat, cr: 0 }), desc: 'VAT (refund)' },
    ...(roundOff ? [{ account: RO_CODE, ...(R ? (roundOff > 0 ? { dr: 0, cr: roundOff } : { dr: -roundOff, cr: 0 }) : (roundOff > 0 ? { dr: roundOff, cr: 0 } : { dr: 0, cr: -roundOff })), desc: 'Round off' }] : []),
    { account: side, ...(R ? { dr: total, cr: 0 } : { dr: 0, cr: total }), desc: sideDesc }
  ].filter(l => l.dr || l.cr);
  const how = settle === 'cash' ? ` by ${mode}` : R ? ' - adjusted in the supplier account' : ' - adjusted in the customer account';
  return {
    type: settle === 'cash' ? (R ? 'Receipt' : 'Payment') : 'Journal', ref: noteNo || instrument, heading: cat + ' Refund ' + (R ? 'received' : 'paid'), notes: [(R ? 'Debit note' : 'Credit note') + (noteNo ? ' ' + noteNo : ''), ...(billNo ? ['against bill ' + billNo] : [])],
    narration: (R ? `Refund received from ${pname}` : `Refund paid to ${pname}`) + (billNo ? ` against bill ${billNo}` : '') + how + (particulars ? ' - ' + particulars : '') + (note ? ' - ' + note : ''),
    refund: { kind, party: pname, pan, noteNo, billNo, category: cat, particulars, nonTax, taxable, vat, roundOff, total, settle, mode, account: settle === 'cash' ? acct.code : '', instrument, note },
    lines
  };
}

// Refunds that carry VAT go into the registers as MINUS rows: refund received -> purchase book, refund paid -> sales book
const refundRows = d => d.vouchers.filter(v => v.refund && v.refund.vat > 0).map(v => {
  const r = v.refund, R = r.kind === 'received';
  return { id: 'RF' + v.id, kind: R ? 'purchase' : 'sales', refund: true, voucher: v.no, date: v.date, bs: v.bs, billNo: r.noteNo || v.no, supplier: r.party, supplierPan: r.pan, customer: r.party, customerVat: r.pan,
    particulars: (R ? 'Refund received' : 'Refund paid') + (r.billNo ? ' against bill ' + r.billNo : '') + (r.particulars ? ' - ' + r.particulars : ''), nonTax: -r.nonTax || 0, taxable: -r.taxable || 0, vat: -r.vat, total: -r.total };
});

module.exports = { refundParts, refundRows };
