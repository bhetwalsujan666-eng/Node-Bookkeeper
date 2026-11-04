// server/posting/purchasebook.js — what goes in the purchase register besides purchase bills
// Rule (Deepak sir, Nov 2026): only VAT bills go in the purchase register, with one exception: FUEL paid from the Payments made page may be added to it
// after review, even without a VAT no. or bill no. (the VAT is worked out by us as 13/113 of the amount paid). Every other payment with no invoice stays out.

// Accounts that are NOT purchases of goods/services even though they are debited by a payment:
// salary (6000), bank charges (6060, exempt financial service), depreciation (6080, not cash), accumulated depreciation (1190)
const NOT_PURCHASE = ['6000', '6060', '6080', '1190'];

// Eligible = expenses, fixed assets and prepaid expenses. Advances to suppliers, tax receivable, loans, creditors etc. are not purchases.
const eligible = a => !!a && !NOT_PURCHASE.includes(a.code) && (a.type === 'X' || a.group === 'Fixed Assets' || a.code === '1060');

// Fuel is found from the expense account name, the payee or the note
const FUEL = /fuel|petrol|diesel|तेल|इन्धन/i;
const isFuel = (a, v) => !!a && FUEL.test([a.name, v.pmt.payee, v.pmt.note].join(' '));

// The VAT hidden inside a VAT-inclusive total (13/113). Shown for review only: nothing is claimed from it.
const vatInTotal = amt => Math.round((+amt || 0) * 13 / 113 * 100) / 100;

// Why a payment made without an invoice is left out of the purchase register (every such payment is left out)
function leftOutReason(a, v) {
  if (!eligible(a)) return 'Not a purchase of goods or services (salary, bank charges, depreciation, advances, tax, loans etc.)';
  if (isFuel(a, v)) return 'Fuel with no VAT bill or bill no.: review it, then add it to the purchase book';
  return 'No invoice: payments made without an invoice are not in the purchase book';
}

// null = a proper VAT bill; otherwise what is missing (no VAT no., no bill no. or no VAT = not a VAT bill)
function vatBillProblem(t) {
  const miss = [];
  if (!String(t.supplier || '').trim()) miss.push('supplier name');
  if (!/^\d{9}$/.test(String(t.supplierPan || '').trim())) miss.push('9-digit VAT/PAN number');
  if (!String(t.billNo || '').trim()) miss.push('bill number');
  if (!(+t.vat > 0)) miss.push('VAT amount');
  return miss.length ? 'Not a VAT bill, so it is left out of the purchase book. Missing: ' + miss.join(', ') + '.' : null;
}

// Register lines for purchases that are not purchase bills: hand-made vouchers (e.g. expenses paid by the CEO) linked to a VAT bill.
// Payments made without an invoice are never register lines. Payments against a supplier's bill are not repeated: the bill is already in the register.
// A payment made to someone who is not a recorded supplier, charged to a fuel expense account
const isFuelPayment = (d, v) => !!(v.pmt && v.pmt.other && (a => eligible(a) && isFuel(a, v))(d.accounts.find(x => x.code === v.pmt.debitAccount)));

// Any payment made to someone who is not a recorded supplier, charged to a purchase-type account (permits, entry fees, etc.), that was left out for having no invoice.
// Like fuel, it may be added by hand after review (v.fuelBook is the shared "added by hand" flag): VAT = 13/113 of the amount paid.
// A payment to someone who is not a recorded supplier that carries TAX INVOICE details typed on the payment (pmt.inv; its VAT is already in 1050). Fuel keeps its own review.
// Returned in the same shape as a purchase-book invoice, or null.
const invPay = (d, v) => v.pmt && v.pmt.other && v.pmt.inv && !isFuelPayment(d, v)
  ? { supplier: v.pmt.payee, supplierPan: v.pmt.inv.supplierPan || '', billNo: v.pmt.inv.billNo || '', nonTax: +v.pmt.inv.nonTax || 0, taxable: +v.pmt.inv.taxable || 0, vat: +v.pmt.inv.vat || 0 } : null;

// (a payment that has tax invoice details goes through the invoice route below, never the 13/113 one, so its VAT is not counted twice)
const isBookablePayment = (d, v) => !!(v.pmt && v.pmt.other && eligible(d.accounts.find(x => x.code === v.pmt.debitAccount))) && !invPay(d, v);

// Fuel inside a hand-made voucher (journal typed on the New voucher page, e.g. fuel paid by the CEO): the debit lines to a fuel expense account.
// No supplier bill is needed. If the voucher already debits VAT to 1050 that VAT is used; otherwise VAT = 13/113 of the fuel amount (same rule as fuel payments).
// A voucher that has tax invoice details (v.taxInv) is a normal VAT bill and is never treated as fuel.
function fuelJournal(d, v) {
  if (v.pmt || v.sal || v.rcpt || v.purchase || v.refund || v.taxInv || !['Journal', 'Payment'].includes(v.type)) return null;
  if (d.bills.some(b => b.voucherId === v.id)) return null;
  let amt = 0, vat1050 = 0;
  (v.lines || []).forEach(l => { const a = d.accounts.find(x => x.code === l.account); if (l.account === '1050') vat1050 += l.dr - l.cr; else if (eligible(a) && FUEL.test(a.name)) amt += l.dr - l.cr; });
  amt = Math.round(amt * 100) / 100; vat1050 = Math.round(vat1050 * 100) / 100;
  if (amt <= 0) return null;
  const vat = vat1050 > 0 ? vat1050 : vatInTotal(amt), total = vat1050 > 0 ? Math.round((amt + vat1050) * 100) / 100 : amt;
  return { amount: total, vat, taxable: Math.round((total - vat) * 100) / 100, vatBooked: vat1050 > 0 };
}
const isFuelJournal = (d, v) => !!fuelJournal(d, v);

// The supplier is not recorded on a voucher: take the name from the brackets in the narration, e.g. "Being fuel purchase paid by Ram sir (Hari Petrol Pump)"
const supplierFromNarration = n => { const m = String(n || '').match(/\(([^()]+)\)\s*$/); return m ? m[1].trim() : ''; };

// Fuel payments and fuel vouchers that were reviewed and added (v.fuelBook): VAT as worked out above, voucher no. in place of the bill no., no supplier PAN
function fuelVouchers(d) {
  const pay = d.vouchers.filter(v => v.fuelBook && isBookablePayment(d, v)).map(v => {
    const amt = Math.round((+v.pmt.amount || 0) * 100) / 100, vat = vatInTotal(amt), isF = isFuelPayment(d, v), acc = (d.accounts.find(x => x.code === v.pmt.debitAccount) || {}).name || 'Purchase', fb = typeof v.fuelBook === 'object' ? v.fuelBook : {}, what = isF ? 'Fuel' : acc;
    return { id: 'fu' + v.id, kind: 'purchase', fromPayment: 'fuel', fuel: isF, voucher: v.no, voucherId: v.id, billNo: fb.billNo || v.no, supplier: fb.supplier || v.pmt.payee, supplierPan: '', date: v.date, bs: v.bs || '', category: what,
      particulars: v.pmt.note || v.narration || what, note: what + ', voucher ' + v.no + ' (no supplier bill; VAT worked out as 13/113 of the amount paid)', nonTax: 0, taxable: Math.round((amt - vat) * 100) / 100, vat, total: amt };
  });
  const jv = d.vouchers.filter(v => v.fuelBook && !v.taxInv).map(v => ({ v, f: fuelJournal(d, v) })).filter(x => x.f).map(({ v, f }) => ({
    id: 'fu' + v.id, kind: 'purchase', fromPayment: 'fuel', fuel: true, voucher: v.no, voucherId: v.id, billNo: v.fuelBook.billNo || v.no, supplier: (v.fuelBook.supplier) || supplierFromNarration(v.narration) || 'Fuel purchase', supplierPan: '', date: v.date, bs: v.bs || '', category: 'Fuel',
    particulars: v.narration || 'Fuel', note: 'Fuel, voucher ' + v.no + ' (no VAT bill; ' + (f.vatBooked ? 'VAT as booked to 1050' : 'VAT worked out as 13/113 of the amount') + ')', nonTax: 0, taxable: f.taxable, vat: f.vat, total: f.amount }));
  return [...pay, ...jv];
}

// New payments with tax invoice details that were reviewed and added by hand (v.invBook): a normal VAT bill in the purchase book
function invPayVouchers(d) {
  return d.vouchers.filter(v => v.invBook).map(v => ({ v, t: invPay(d, v) })).filter(x => x.t && !vatBillProblem(x.t)).map(({ v, t }) => ({
    id: 'pi' + v.id, kind: 'purchase', fromPayment: 'payment', voucher: v.no, voucherId: v.id, billNo: t.billNo, supplier: t.supplier, supplierPan: t.supplierPan, date: v.date, bs: v.bs || '', category: 'Payment ' + v.no,
    particulars: v.pmt.note || v.narration || '', note: 'Payment ' + v.no + ' (new payment, tax invoice reviewed and added)', nonTax: t.nonTax, taxable: t.taxable, vat: t.vat, total: Math.round((t.nonTax + t.taxable + t.vat) * 100) / 100
  }));
}

function paymentPurchases(d) { return [...invoiceVouchers(d), ...invPayVouchers(d), ...fuelVouchers(d)]; }

function invoiceVouchers(d) {
  return d.vouchers.filter(v => v.taxInv && !vatBillProblem(v.taxInv)).map(v => {
    const t = v.taxInv, nonTax = +t.nonTax || 0, taxable = +t.taxable || 0, vat = +t.vat || 0;
    return { id: 'jv' + v.id, kind: 'purchase', fromPayment: 'voucher', voucher: v.no, voucherId: v.id, billNo: t.billNo, supplier: t.supplier, supplierPan: t.supplierPan || '', date: v.date, bs: v.bs || '', category: 'Voucher ' + v.no,
      particulars: v.narration || '', note: 'Voucher ' + v.no + ' (paid on the company\'s behalf)', nonTax, taxable, vat, total: Math.round((nonTax + taxable + vat) * 100) / 100 };
  });
}

module.exports = { NOT_PURCHASE, invPay, eligible, isFuel, isFuelPayment, isBookablePayment, fuelJournal, isFuelJournal, vatInTotal, leftOutReason, vatBillProblem, paymentPurchases };
