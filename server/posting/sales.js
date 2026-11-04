// server/posting/sales.js — sales bill validation and posting
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { catName, party, rd, split } = require('../accounts');

const { loadSet } = require('../store');
const { PAN_RE, BS_RE } = require('./vatrules');

const salesBad = s => {
  const t = rd(+s.total || 0), n = +s.nonTax || 0, pan = String(s.customerVat || '').trim();
  if (!s.customer || !s.date || t <= 0 || t < n) return 'Customer, date and a bill total (not less than the non-taxable amount) are required';
  if (n < 0) return 'Non-taxable amount cannot be negative';
  if (s.bs && !BS_RE.test(String(s.bs).trim())) return 'Date (BS) must look like 2083-07-15 (year-month-day)';
  if (pan && !PAN_RE.test(pan)) return "Buyer's PAN/VAT no. must be 9 digits";
  if (t > n && !String(loadSet().company.vat || '').trim()) return 'Your own PAN/VAT no. is not set in Settings. An unregistered person must not issue an invoice that collects VAT (VAT Act s.15)';
  return null;
};

function salesParts(d, s, billNo) {
  const nonTax = +s.nonTax || 0, total = rd(+s.total || 0), { taxable, vat } = split(nonTax, total), cat = catName(s.category),
  sacc = party(d, cat + ' Sales', 'I', 'Income', 4100), cus = party(d, s.customer.trim(), 'A', 'Sundry Debtors', 1200);
  return {
    nonTax, total, taxable, vat, cat, notes: ['bill no. ' + billNo], narration: `${cat} Sales - bill ${billNo} - ${s.customer}` + (s.passenger ? ' - ' + s.passenger : ''),
    lines: [{ account: cus, dr: total, cr: 0, desc: s.customer }, { account: sacc, dr: 0, cr: nonTax, desc: 'Non Taxable' }, { account: sacc, dr: 0, cr: taxable, desc: 'Taxable' }, { account: '2020', dr: 0, cr: vat, desc: 'VAT 13%' }].filter(l => l.dr || l.cr)
  };
}

module.exports = { salesBad, salesParts };
