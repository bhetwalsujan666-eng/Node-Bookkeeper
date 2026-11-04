// server/excel/workbook.js — shared Excel building blocks: frame(), put(), box(), fx(), words()
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { rd } = require('../accounts');
const { COMPANY } = require('../settings');

// exceljs is loaded the first time an Excel file is made, so the app still starts without it installed.
let _ExcelJS;
const getExcelJS = () => _ExcelJS || (_ExcelJS = require('exceljs'));

const W = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

const TY = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const w = n => n < 20 ? W[n] : n < 100 ? TY[n / 10 | 0] + ' ' + W[n % 10] : [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand'], [100, 'Hundred']].filter(([v]) => n >= v).slice(0, 1).map(([v, t]) => (w(n / v | 0) + ' ' + t + ' ' + w(n % v))).join('');

const words = n => { const r = Math.floor(n), p = Math.round((n - r) * 100); return ('Rupees ' + w(r) + (p ? ' and ' + w(p) + ' Paisa' : '') + ' only').replace(/\s+/g, ' '); };

function frame(title, co = COMPANY) {
  const ExcelJS = getExcelJS(); const wb = new ExcelJS.Workbook(), s = wb.addWorksheet(title); s.columns = [{ width: 9 }, { width: 44 }, { width: 14 }, { width: 18 }, { width: 18 }];
  const m = (r, t, b, size) => { s.mergeCells(`A${r}:E${r}`); const c = s.getCell('A' + r); c.value = t; c.alignment = { horizontal: 'center', wrapText: true }; c.font = { bold: !!b, size: size || 10 }; };
  m(1, co.name, 1, 16); m(2, `${co.addr} | Tel: ${co.tel} | ${co.email}`); m(3, 'VAT No.: ' + (co.vat || '________')); m(4, title.toUpperCase(), 1, 13); return { wb, s };
}

const put = (s, a, v, o = {}) => { const c = s.getCell(a); c.value = v; if (o.b) c.font = { bold: true }; if (o.n) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'right' }; } if (o.w) c.alignment = { wrapText: true, vertical: 'top' }; };

const box = (s, r1, r2) => { for (let r = r1; r <= r2; r++) for (const c of 'ABCDE') s.getCell(c + r).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; };

const fx = (s, a, formula, result, bold) => { const c = s.getCell(a); c.value = { formula, result: rd(result) }; c.numFmt = '#,##0.00'; if (bold) c.font = { bold: true }; };

module.exports = { box, frame, fx, getExcelJS, put, words };
