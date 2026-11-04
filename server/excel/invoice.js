// server/excel/invoice.js — sales invoice and purchase bill workbooks
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { box, frame, put, words } = require('./workbook');
const { COMPANY } = require('../settings');
const { load, loadDb } = require('../store');

function invoiceXlsx(b, co = COMPANY) {
  const { wb, s } = frame('Tax Invoice', co);
  put(s, 'A6', 'M/S', { b: 1 }); put(s, 'B6', b.customer); put(s, 'D6', 'Bill No.', { b: 1 }); put(s, 'E6', b.billNo);
  put(s, 'A7', b.seller ? "Seller's VAT No." : "Buyer's VAT No.", { b: 1 }); put(s, 'B7', b.customerVat || ''); put(s, 'D7', 'Date', { b: 1 }); put(s, 'E7', b.date);
  put(s, 'A8', 'Payment', { b: 1 }); put(s, 'B8', 'Cash / Credit / Cheque'); put(s, 'D8', 'Miti (BS)', { b: 1 }); put(s, 'E8', b.bs || '');
  ['H.S Code', 'Descriptions', 'Rate', 'Non Taxable Amount', 'Taxable Amount'].forEach((h, i) => put(s, 'ABCDE'[i] + '10', h, { b: 1 }));
  const pb = b.kind === 'sales' ? (load().bills.find(x => x.id === b.purchaseId) || {}) : {}, cat = b.category || pb.category || '', from = pb.supplier ? (cat ? cat + ' purchase' : 'Purchase') + ' from ' + pb.supplier : '', pt = String(b.particulars || '').trim(), dup = from && pt.toLowerCase() === (cat + ' purchase').toLowerCase(), pax = String(b.passenger || '').trim(); put(s, 'B11', [from, dup ? '' : pt, pax ? 'Client Name: ' + pax : ''].filter(Boolean).join('\n'), { w: 1 }); put(s, 'D11', b.nonTax, { n: 1 }); put(s, 'E11', b.taxable, { n: 1 }); s.getRow(11).height = 90;
  const rows = [['Sub Total', b.nonTax, b.taxable], ['Discount', 0, 0], ['Non Taxable', b.nonTax], ['Taxable', null, b.taxable], ['VAT 13%', null, b.vat], ...(b.roundOff ? [['Round Off', null, b.roundOff]] : []), ['Total', null, b.total]], last = 11 + rows.length, dr = last + 2;
  rows.forEach(([l, x, y], i) => { const r = 12 + i; put(s, 'C' + r, l, { b: 1 }); if (x != null) put(s, 'D' + r, x, { n: 1 }); if (y != null) put(s, 'E' + r, y, { n: 1 }); });
  s.mergeCells(`A12:B${last}`); put(s, 'A12', 'Total in Words: ' + words(b.total), { w: 1 }); box(s, 10, last);
  s.mergeCells(`A${dr}:E${dr}`); put(s, 'A' + dr, 'Declaration: No claims or discrepancy shall be considered unless brought to our notice in writing within three days. Please check passport name, validity date & visa; reconfirm flight time before departure. E. & O. E.', { w: 1 }); s.getRow(dr).height = 45;
  put(s, 'D' + (dr + 2), 'For: ' + co.name, { b: 1 }); return wb;
}

// Purchase bill = the supplier's tax invoice as received (exact amounts), on our company header
const purchaseBillXlsx = x => {
  const p = loadDb().parties.find(r => r.name.toLowerCase() === String(x.supplier).toLowerCase()) || {};
  return invoiceXlsx({ ...x, customer: x.supplier, customerVat: x.supplierPan || p.pan || '', seller: true });
}; // our company header; M/S and VAT/PAN fields hold the seller's details

module.exports = { invoiceXlsx, purchaseBillXlsx };
