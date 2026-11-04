// server/posting/purchase.js — purchase bill validation and posting
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { catName, party, rd } = require('../accounts');

const { PAN_RE, BS_RE } = require('./vatrules');

const RO_CODE = '9991'; // existing Round Off ledger account

const purchaseBad = p => {
  const nonTax = +p.nonTax || 0, taxable = +p.taxable || 0, vat = +p.vat || 0, roundOff = rd(+p.roundOff || 0), total = rd(nonTax + taxable + vat + roundOff), pan = String(p.supplierPan || '').trim();
  if (!p.supplier || !p.billNo || !p.date || total <= 0) return 'Supplier, bill no., date and amounts are required';
  if (nonTax < 0 || taxable < 0 || vat < 0) return 'Amounts cannot be negative';
  if (Math.abs(roundOff) > 10) return 'Round off looks too large (more than 10). Check the amount';
  if (p.bs && !BS_RE.test(String(p.bs).trim())) return 'Date (BS) must look like 2083-07-15 (year-month-day)';
  if (pan && !PAN_RE.test(pan)) return 'Supplier PAN/VAT no. must be 9 digits';
  if (vat > 0 && !pan) return 'Supplier PAN/VAT no. is required when the bill has VAT, otherwise the VAT cannot be claimed (VAT Act s.17(6), s.10(6))';
  if (vat > 0 && taxable <= 0) return 'The bill has VAT but no taxable amount';
  if (taxable > 0 && Math.abs(vat - rd(taxable * 0.13)) > 1) return `VAT on the bill (${vat}) does not match 13% of the taxable amount (${rd(taxable * 0.13)}). Check the amounts against the supplier's invoice (VAT Act s.7)`;
  return null;
};

function purchaseParts(d, p) {
  const nonTax = +p.nonTax || 0, taxable = +p.taxable || 0, vat = +p.vat || 0, roundOff = rd(+p.roundOff || 0), total = rd(nonTax + taxable + vat + roundOff), cat = catName(p.category),
  pacc = party(d, cat + ' Purchase', 'X', 'Direct Costs', 5100), sup = party(d, p.supplier.trim(), 'L', 'Sundry Creditors', 2200);
  if (roundOff && !d.accounts.some(a => a.code === RO_CODE)) d.accounts.push({ code: RO_CODE, name: 'Round Off', type: 'X', group: 'Operating Expenses' }); // only if missing in this data file
  return {
    nonTax, taxable, vat, roundOff, total, cat, heading: cat + ' Purchase', notes: ['bill no. ' + p.billNo].concat(p.passenger ? [p.passenger] : []),
    narration: `${cat} Purchase - ${p.supplier} bill no. ${p.billNo}` + (p.passenger ? ' - ' + p.passenger : ''),
    lines: [{ account: pacc, dr: nonTax, cr: 0, desc: 'Non Taxable' }, { account: pacc, dr: taxable, cr: 0, desc: 'Taxable' }, { account: '1050', dr: vat, cr: 0, desc: 'VAT' }, ...(roundOff ? [{ account: RO_CODE, dr: roundOff > 0 ? roundOff : 0, cr: roundOff < 0 ? -roundOff : 0, desc: 'Round off' }] : []), { account: sup, dr: 0, cr: total, desc: p.supplier }].filter(l => l.dr || l.cr)
  };
}

const purchaseFields = (p, x) => ({ category: x.cat, supplier: p.supplier, supplierPan: p.supplierPan, billNo: p.billNo, date: p.date, bs: p.bs, customer: p.customer, passenger: p.passenger, particulars: p.particulars, nonTax: x.nonTax, taxable: x.taxable, vat: x.vat, roundOff: x.roundOff, total: x.total });

module.exports = { purchaseBad, purchaseFields, purchaseParts };
