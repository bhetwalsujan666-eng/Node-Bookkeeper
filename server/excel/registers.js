// server/excel/registers.js — VAT registers (IRD templates)
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const path = require('path');
const { rd } = require('../accounts');
const { getExcelJS } = require('./workbook');
const { COMPANY } = require('../settings');
const { ROOT } = require('../store');

// Fills the official IRD VAT register templates (templates/*.xlsx) from the saved bills
async function purchaseRegisterXlsx(bills, from, to, d) {
  const ExcelJS = getExcelJS(); let t1 = 'खरिद खाता (Purchase Book)', t2 = '(नियम २३ को उपनियम (१) को खण्ड (ख) संग सम्बन्धित)';
  try { const tw = new ExcelJS.Workbook(); await tw.xlsx.readFile(path.join(ROOT, 'templates', 'purchase-register.xlsx')); const g = a => { const v = tw.worksheets[0].getCell(a).value; return v && typeof v === 'object' ? (v.richText ? v.richText.map(x => x.text).join('') : v.result || '') : v; }; t1 = g('A1') || t1; t2 = g('A2') || t2; } catch { }
  const wb = new ExcelJS.Workbook(), s = wb.addWorksheet('Purchase Register'), n = bills.length, thin = { style: 'thin' }, bd = { top: thin, bottom: thin, left: thin, right: thin }, NUM = '#,##0.00';
  s.columns = [11, 11, 10, 10, 26, 14, 14, 16, 14, 12, 3, 14, 14, 13, 13, 30].map(width => ({ width }));
  const mid = (a, v, o = {}) => { const c = s.getCell(a); c.value = v; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.font = { bold: !!o.b, size: o.size || 10 }; return c; };
  s.mergeCells('A1:O1'); mid('A1', t1, { b: 1, size: 14 }); s.mergeCells('A2:O2'); mid('A2', t2);
  s.mergeCells('A4:O4'); s.getCell('A4').value = `करदाता दर्ता नं (PAN) : ${COMPANY.vat || '…...'}        करदाताको नाम: ${COMPANY.name}         साल    ${from.slice(0, 4)}      कर अवधि: ${from} देखि ${to} सम्म (AD)`;
  [['A5:F5', 'बीजक / प्रज्ञापनपत्र नम्बर'], ['G5:G6', 'जम्मा खरिद मूल्य (रु)'], ['H5:H6', 'कर छुट हुने वस्तु वा सेवाको खरिद / पैठारी मूल्य (रु)'], ['I5:K5', 'करयोग्य खरिद (पूंजीगत बाहेक)'], ['L5:M5', 'करयोग्य पैठारी (पूंजीगत बाहेक)'], ['N5:O5', 'पूंजीगत करयोग्य खरिद / पैठारी']].forEach(([r, t]) => { s.mergeCells(r); mid(r.split(':')[0], t, { b: 1 }); });
  ['मिति (AD)', 'मिति (BS)', 'बीजक नं.', 'प्रज्ञापनपत्र नं.', 'आपूर्तिकर्ताको नाम', 'आपूर्तिकर्ताको स्थायी लेखा नम्बर'].forEach((t, i) => mid(String.fromCharCode(65 + i) + '6', t, { b: 1 }));
  [['I', 'मूल्य (रु)'], ['J', 'कर (रु)'], ['K', ''], ['L', '10% margin मूल्य (रु)'], ['M', 'sales taxable amt'], ['N', 'sales 13% vat'], ['O', 'total कर (रु)']].forEach(([c, t]) => mid(c + '6', t, { b: 1 }));
  const link = b => d.bills.find(x => x.kind === 'sales' && x.purchaseId === b.id);
  bills.forEach((b, i) => {
    const sb = link(b), r = s.getRow(7 + i), who = [b.customer, b.passenger].filter(Boolean).join(' / ') || b.note || '';
    [b.date, b.bs || '', b.billNo, '', b.supplier, b.supplierPan || '', b.total, b.nonTax, b.taxable, b.vat, null, sb ? rd(sb.nonTax + sb.taxable - b.nonTax - b.taxable) : null, sb ? sb.taxable : null, sb ? sb.vat : null, sb ? rd(sb.vat - b.vat) : null]
      .forEach((v, c) => { const cell = r.getCell(c + 1); cell.value = v === '' ? null : v; if (c >= 6) { cell.numFmt = NUM; cell.alignment = { horizontal: 'right' }; } else cell.alignment = { wrapText: true, vertical: 'top' }; });
    const w = r.getCell(16); w.value = who || null; w.font = { italic: true, color: { argb: 'FF555555' } }; w.alignment = { wrapText: true, vertical: 'top' };
  }); // outside the bordered table
  s.getCell('P6').value = 'ग्राहक / यात्री'; s.getCell('P6').font = { bold: true }; s.getCell('P6').alignment = { horizontal: 'left', vertical: 'middle' };
  const t = s.getRow(7 + n); t.getCell(1).value = 'जम्मा'; t.font = { bold: true };
  [[7, 'total'], [8, 'nonTax'], [9, 'taxable'], [10, 'vat']].forEach(([c, k]) => { const L = String.fromCharCode(64 + c); t.getCell(c).value = { formula: n ? `SUM(${L}7:${L}${6 + n})` : '0', result: rd(bills.reduce((a, b) => a + b[k], 0)) }; t.getCell(c).numFmt = NUM; });
  [[12, b => { const sb = link(b); return sb ? sb.nonTax + sb.taxable - b.nonTax - b.taxable : 0; }], [13, b => (link(b) || {}).taxable || 0], [14, b => (link(b) || {}).vat || 0], [15, b => { const sb = link(b); return sb ? sb.vat - b.vat : 0; }]].forEach(([c, fn]) => { const L = String.fromCharCode(64 + c); t.getCell(c).value = { formula: n ? `SUM(${L}7:${L}${6 + n})` : '0', result: rd(bills.reduce((a, b) => a + fn(b), 0)) }; t.getCell(c).numFmt = NUM; });
  for (let r = 5; r <= 7 + n; r++) for (let c = 1; c <= 15; c++) s.getCell(r, c).border = bd; // table borders stop at column O
  for (let r = 5; r <= 6; r++) for (let c = 1; c <= 15; c++) s.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6E3' } };
  s.getRow(6).height = 32; s.views = [{ state: 'frozen', ySplit: 6 }]; return wb;
}

async function registerXlsx(kind, bills, from, to, d) {
  if (kind === 'purchase') return purchaseRegisterXlsx(bills, from, to, d);
  const ExcelJS = getExcelJS(); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(ROOT, 'templates', kind + '-register.xlsx'));
  const s = wb.worksheets[0], P = kind === 'purchase', ncol = P ? 16 : 15, amt = P ? [9, 10, 11, 12] : [8, 9, 10, 11], base = s.getRow(7), n = bills.length;
  const widths = P ? [11, 10, 10, 24, 14, 32, 8, 8, 14, 14, 14, 12, 12, 10, 12, 10] : [11, 10, 24, 14, 32, 8, 8, 14, 14, 14, 12, 14, 12, 14, 12];
  widths.forEach((x, i) => s.getColumn(i + 1).width = x);
  s.getCell('A4').value = `करदाता दर्ता नं (PAN) : ${COMPANY.vat || '…...'}        करदाताको नाम: ${COMPANY.name}         साल    ${from.slice(0, 4)}      कर अवधि: ${from} देखि ${to} सम्म (AD)`;
  const styles = []; for (let c = 1; c <= ncol; c++) styles[c] = JSON.parse(JSON.stringify(base.getCell(c).style || {}));
  bills.forEach((b, i) => {
    const r = s.getRow(7 + i), m = b.bs || b.date;
    const vals = P ? [m, b.billNo, '', b.supplier, b.supplierPan || '', b.particulars || '', 1, 'Nos', b.total, b.nonTax, b.taxable, b.vat]
      : [m, b.billNo, b.customer, b.customerVat || '', b.particulars || '', 1, 'Nos', b.total, b.nonTax, b.taxable, b.vat];
    for (let c = 1; c <= ncol; c++) {
      const cell = r.getCell(c); cell.style = JSON.parse(JSON.stringify(styles[c])); cell.value = vals[c - 1] === undefined ? null : vals[c - 1];
      if (amt.includes(c)) cell.numFmt = '#,##0.00'; else cell.alignment = { wrapText: true, vertical: 'top' };
    }
  });
  const t = s.getRow(7 + n); t.getCell(1).value = 'जम्मा'; t.font = { bold: true };
  amt.forEach((c, k) => { const L = String.fromCharCode(64 + c), key = ['total', 'nonTax', 'taxable', 'vat'][k]; t.getCell(c).value = { formula: n ? `SUM(${L}7:${L}${6 + n})` : '0', result: rd(bills.reduce((a, b) => a + b[key], 0)) }; t.getCell(c).numFmt = '#,##0.00'; });
  return wb;
}

// Excel for the review panel. which = 'review': hand-made vouchers, purchase-book style.
// which = 'leftout': payments made with no invoice, every cell yellow, fuel on its own sheet first (to review with Deepak sir). Data comes from registerReview(d).
function reviewXlsx(R, from, to, which) {
  const ExcelJS = getExcelJS(), wb = new ExcelJS.Workbook(), thin = { style: 'thin' }, bd = { top: thin, bottom: thin, left: thin, right: thin }, NUM = '#,##0.00';
  const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6E3' } }, YEL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  const inP = x => x.date >= from && x.date <= to, byDate = (a, b) => a.date.localeCompare(b.date) || String(a.no).localeCompare(String(b.no), undefined, { numeric: true });
  const J = R.journals.filter(inP).sort(byDate), X = R.excluded.filter(inP).sort(byDate);
  // cols: [header, width, sum?]; rows: arrays in the same order; yellow fills every data cell
  const sheet = (name, title, cols, rows, yellow) => {
    const s = wb.addWorksheet(name), last = String.fromCharCode(64 + cols.length), n = rows.length;
    s.columns = cols.map(c => ({ width: c[1] }));
    s.mergeCells(`A1:${last}1`); s.getCell('A1').value = title; s.getCell('A1').font = { bold: true, size: 14 }; s.getCell('A1').alignment = { horizontal: 'center' };
    s.mergeCells(`A2:${last}2`); s.getCell('A2').value = `${COMPANY.name}  |  PAN: ${COMPANY.vat || '…...'}  |  ${from} to ${to} (AD)`; s.getCell('A2').alignment = { horizontal: 'center' };
    cols.forEach((c, i) => { const h = s.getCell(4, i + 1); h.value = c[0]; h.font = { bold: true }; h.fill = HEAD; h.border = bd; h.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
    rows.forEach((r, i) => r.forEach((v, c) => {
      const cell = s.getCell(5 + i, c + 1); cell.value = v === '' ? null : v; cell.border = bd;
      if (typeof v === 'number') { cell.numFmt = NUM; cell.alignment = { horizontal: 'right', vertical: 'top' }; } else cell.alignment = { wrapText: true, vertical: 'top' };
      if (yellow) cell.fill = YEL;
    }));
    if (!n) { s.mergeCells(`A5:${last}5`); s.getCell('A5').value = 'None in this period'; s.getCell('A5').font = { italic: true }; }
    else {
      const t = s.getRow(5 + n); t.getCell(1).value = 'जम्मा'; t.font = { bold: true };
      cols.forEach((c, i) => { if (!c[2]) return; const L = String.fromCharCode(65 + i); t.getCell(i + 1).value = { formula: `SUM(${L}5:${L}${4 + n})`, result: rd(rows.reduce((a, r) => a + (+r[i] || 0), 0)) }; t.getCell(i + 1).numFmt = NUM; });
      for (let c = 1; c <= cols.length; c++) t.getCell(c).border = bd;
    }
    s.views = [{ state: 'frozen', ySplit: 4 }];
  };
  if (which === 'leftout') {
    const lo = x => [x.bs || '', x.date, x.no, x.payee, x.account, x.note];
    sheet('Fuel to review', 'Fuel payments with no VAT bill or bill no. (to review with Deepak sir)',
      [['मिति (BS)', 12], ['मिति (AD)', 12], ['Voucher no.', 12], ['Paid to', 28], ['Charged to', 26], ['Note', 30], ['Amount', 14, 1], ['VAT inside amount (13/113)', 16, 1], ['Decision (Deepak sir)', 26]],
      X.filter(x => x.fuel).map(x => [...lo(x), x.amount, x.vatInTotal, '']), true);
    sheet('Other left out', 'Other payments made with no invoice: left out of the purchase book',
      [['मिति (BS)', 12], ['मिति (AD)', 12], ['Voucher no.', 12], ['Paid to', 28], ['Charged to', 26], ['Note', 30], ['Amount', 14, 1], ['Why left out', 56], ['Decision (Deepak sir)', 26]],
      X.filter(x => !x.fuel).map(x => [...lo(x), x.amount, x.reason, '']), true);
    return wb;
  }
  // Vouchers not yet linked to a VAT bill show the figures the page pre-fills (VAT / 13% = taxable).
  sheet('Review vouchers', 'Review: purchases that are not purchase bills',
    [['मिति (BS)', 12], ['मिति (AD)', 12], ['Voucher no.', 12], ['Invoice no.', 14], ['Supplier', 26], ['PAN', 13], ['Particulars', 36], ['Total', 14, 1], ['Exempt', 14, 1], ['Taxable', 14, 1], ['VAT', 12, 1], ['Status', 24], ['Credited to', 28], ['Problem', 46]],
    J.map(j => {
      const t = j.taxInv, fu = !t && j.fuel && j.fuel.inBook ? j.fuel : null, tx = j.vat > 0 ? rd(j.vat / .13) : 0, nonTax = t ? +t.nonTax || 0 : fu ? 0 : rd(j.exp - tx), taxable = t ? +t.taxable || 0 : fu ? fu.taxable : tx, vat = t ? +t.vat || 0 : fu ? fu.vat : j.vat;
      return [j.bs || '', j.date, j.no, t ? t.billNo : fu ? j.no : '', t ? t.supplier : fu ? 'Fuel (no VAT bill)' : '', t ? t.supplierPan || '' : '', j.narration, rd(nonTax + taxable + vat), nonTax, taxable, vat, j.status, j.credits.join(', '), j.problem || ''];
    }));
  return wb;
}

module.exports = { registerXlsx, reviewXlsx };
