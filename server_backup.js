// Zero-dependency server: `node server.js` then open http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path');
const DB = path.join(__dirname, 'data.json');
// [code, name, type (A/L/E/I/X), group]
const seed = [
 ['1000','Cash in Hand','A','Current Assets'],['1010','Bank Account','A','Current Assets'],
 ['1020','Sundry Debtors (Customers)','A','Current Assets'],['1030','Advance to Suppliers (Airlines/Hotels)','A','Current Assets'],
 ['1040','TDS Receivable','A','Current Assets'],['1050','VAT Receivable (Input VAT)','A','Current Assets'],
 ['1060','Prepaid Expenses','A','Current Assets'],['1100','Furniture & Fixtures','A','Fixed Assets'],
 ['1110','Computers & Equipment','A','Fixed Assets'],['1190','Accumulated Depreciation','A','Fixed Assets'],
 ['2000','Sundry Creditors (Airlines/Hotels/Agents)','L','Current Liabilities'],['2010','Customer Advances (Booking Deposits)','L','Current Liabilities'],
 ['2020','VAT Payable (Output VAT)','L','Current Liabilities'],['2030','TDS Payable','L','Current Liabilities'],
 ['2040','Salary Payable','L','Current Liabilities'],['2050','SSF/PF Payable','L','Current Liabilities'],
 ['2060','Accrued Expenses','L','Current Liabilities'],['2100','Loan Payable','L','Long-term Liabilities'],
 ['3000','Share Capital','E','Equity'],['3010','Retained Earnings','E','Equity'],
 ['4000','Tour Package Income','I','Income'],['4010','Air Ticketing Commission','I','Income'],
 ['4020','Hotel Booking Commission','I','Income'],['4030','Visa & Service Charges','I','Income'],['4040','Other Income','I','Income'],
 ['5000','Hotel & Accommodation Cost','X','Direct Costs'],['5010','Transport & Vehicle Hire','X','Direct Costs'],
 ['5020','Guide & Porter Fees','X','Direct Costs'],['5030','Permits & Entry Fees','X','Direct Costs'],
 ['6000','Salary & Wages','X','Operating Expenses'],['6010','Office Rent','X','Operating Expenses'],
 ['6020','Electricity & Water','X','Operating Expenses'],['6030','Telephone & Internet','X','Operating Expenses'],
 ['6040','Marketing & Advertising','X','Operating Expenses'],['6050','Office Expenses & Stationery','X','Operating Expenses'],
 ['6060','Bank Charges','X','Operating Expenses'],['6070','Professional & Audit Fees','X','Operating Expenses'],
 ['6080','Depreciation','X','Operating Expenses'],['6090','Travel & Meals','X','Operating Expenses']];
const EXTRA = []; // extra accounts to add to older data files (none now: purchase/sales accounts are created per category)
// Edit your company details here (shown on Excel bills)
const COMPANY_DEFAULT = { name: 'Shivam Group Holiday Pvt. Ltd.', addr: 'Lazimpat, Kathmandu, Nepal', tel: '977-1-4535752, 4535859', email: 'shivamholidaygrp@gmail.com', vat: '600850814' }; // defaults only: edit these in the Settings page
const COMPANY = { ...COMPANY_DEFAULT };
const rd = n => Math.round(n * 100) / 100;
const split = (nonTax, total) => { const g = total - nonTax, taxable = rd(g / 1.13); return { taxable, vat: rd(g - taxable) }; };
const W = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'], TY = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
const w = n => n < 20 ? W[n] : n < 100 ? TY[n / 10 | 0] + ' ' + W[n % 10] : [[1e7,'Crore'],[1e5,'Lakh'],[1e3,'Thousand'],[100,'Hundred']].filter(([v]) => n >= v).slice(0,1).map(([v,t]) => (w(n / v | 0) + ' ' + t + ' ' + w(n % v))).join('');
const words = n => { const r = Math.floor(n), p = Math.round((n - r) * 100); return ('Rupees ' + w(r) + (p ? ' and ' + w(p) + ' Paisa' : '') + ' only').replace(/\s+/g, ' '); };
const post = (d, type, date, bs, ref, narration, lines) => { const p = PFX[type]; d.seq[p] = (d.seq[p] || 0) + 1;
  const v = { type, date, bs, ref, narration, lines: lines.filter(l => l.dr || l.cr), no: p + '-' + String(d.seq[p]).padStart(4, '0'), id: Date.now() + d.vouchers.length }; d.vouchers.push(v); return v; };
const party = (d, name, type, group, from) => { let a = d.accounts.find(x => x.group === group && x.name.toLowerCase() === name.toLowerCase());
  if (!a) { const code = String(Math.max(from - 1, ...d.accounts.filter(x => x.group === group).map(x => +x.code)) + 1); a = { code, name, type, group }; d.accounts.push(a); } return a.code; };
let ExcelJS;
function frame(title, co = COMPANY) { ExcelJS = ExcelJS || require('exceljs'); const wb = new ExcelJS.Workbook(), s = wb.addWorksheet(title); s.columns = [{width:9},{width:44},{width:14},{width:18},{width:18}];
  const m = (r, t, b, size) => { s.mergeCells(`A${r}:E${r}`); const c = s.getCell('A' + r); c.value = t; c.alignment = { horizontal: 'center', wrapText: true }; c.font = { bold: !!b, size: size || 10 }; };
  m(1, co.name, 1, 16); m(2, `${co.addr} | Tel: ${co.tel} | ${co.email}`); m(3, 'VAT No.: ' + (co.vat || '________')); m(4, title.toUpperCase(), 1, 13); return { wb, s }; }
const put = (s, a, v, o = {}) => { const c = s.getCell(a); c.value = v; if (o.b) c.font = { bold: true }; if (o.n) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'right' }; } if (o.w) c.alignment = { wrapText: true, vertical: 'top' }; };
const box = (s, r1, r2) => { for (let r = r1; r <= r2; r++) for (const c of 'ABCDE') s.getCell(c + r).border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }; };
function invoiceXlsx(b, co = COMPANY) { const { wb, s } = frame('Tax Invoice', co);
  put(s,'A6','M/S',{b:1}); put(s,'B6',b.customer); put(s,'D6','Bill No.',{b:1}); put(s,'E6',b.billNo);
  put(s,'A7', b.seller ? "Seller's VAT No." : "Buyer's VAT No.",{b:1}); put(s,'B7',b.customerVat || ''); put(s,'D7','Date',{b:1}); put(s,'E7',b.date);
  put(s,'A8','Payment',{b:1}); put(s,'B8','Cash / Credit / Cheque'); put(s,'D8','Miti (BS)',{b:1}); put(s,'E8',b.bs || '');
  ['H.S Code','Descriptions','Rate','Non Taxable Amount','Taxable Amount'].forEach((h, i) => put(s, 'ABCDE'[i] + '10', h, { b: 1 }));
    const pb = b.kind === 'sales' ? (load().bills.find(x => x.id === b.purchaseId) || {}) : {}, cat = b.category || pb.category || '', from = pb.supplier ? (cat ? cat + ' purchase' : 'Purchase') + ' from ' + pb.supplier : '', pt = String(b.particulars || '').trim(), dup = from && pt.toLowerCase() === (cat + ' purchase').toLowerCase(), pax = String(b.passenger || '').trim(); put(s,'B11',[from, dup ? '' : pt, pax ? 'Client Name: ' + pax : ''].filter(Boolean).join('\n'),{w:1}); put(s,'D11',b.nonTax,{n:1}); put(s,'E11',b.taxable,{n:1}); s.getRow(11).height = 90;
  [['Sub Total',b.nonTax,b.taxable],['Discount',0,0],['Non Taxable',b.nonTax],['Taxable',null,b.taxable],['VAT 13%',null,b.vat],['Total',null,b.total]].forEach(([l, x, y], i) => { const r = 12 + i; put(s,'C'+r,l,{b:1}); if (x != null) put(s,'D'+r,x,{n:1}); if (y != null) put(s,'E'+r,y,{n:1}); });
  s.mergeCells('A12:B17'); put(s,'A12','Total in Words: ' + words(b.total),{w:1}); box(s, 10, 17);
  s.mergeCells('A19:E19'); put(s,'A19','Declaration: No claims or discrepancy shall be considered unless brought to our notice in writing within three days. Please check passport name, validity date & visa; reconfirm flight time before departure. E. & O. E.',{w:1}); s.getRow(19).height = 45;
  put(s,'D21','For: ' + co.name,{b:1}); return wb; }
function jvXlsx(v, d) { const { wb, s } = frame(v.type === 'Receipt' ? 'Receipt Voucher' : v.type === 'Payment' ? 'Payment Voucher' : 'Journal Voucher'); put(s,'A6','Voucher No.: ' + v.no,{b:1}); put(s,'D6','Date: ' + v.date + (v.bs ? ' (' + v.bs + ' BS)' : ''),{b:1});
  ['S.N.','Description','L.F. No.','Debit','Credit'].forEach((h, i) => put(s, 'ABCDE'[i] + '8', h, { b: 1 }));
  const nm = c => (d.accounts.find(a => a.code === c) || {}).name || c; let r = 9, n = 0;
  if (v.heading) { put(s,'B'+r,v.heading,{b:1}); r++; }
  v.lines.forEach(l => { put(s,'A'+r,++n); put(s,'B'+r,(l.cr ? '      ' : '') + (l.desc || nm(l.account))); if (l.dr) put(s,'D'+r,l.dr,{n:1}); if (l.cr) put(s,'E'+r,l.cr,{n:1}); r++; });
  (v.notes || []).forEach(x => { put(s,'B'+r,'      ' + x); r++; });
  const t = r, sum = k => rd(v.lines.reduce((a, l) => a + l[k], 0)); put(s,'B'+t,'Total',{b:1}); fx(s,'D'+t,`SUM(D9:D${t-1})`,sum('dr'),1); fx(s,'E'+t,`SUM(E9:E${t-1})`,sum('cr'),1); box(s, 8, t);
  s.mergeCells(`A${t+1}:E${t+1}`); put(s,'A'+(t+1),'Rs. in words: ' + words(sum('dr'))); s.mergeCells(`A${t+2}:E${t+2}`); put(s,'A'+(t+2),'Details: ' + (v.narration || '') + (v.ref ? ' (Ref ' + v.ref + ')' : ''),{w:1});
  put(s,'A'+(t+5),'Prepared by',{b:1}); put(s,'C'+(t+5),'Checked by',{b:1}); put(s,'E'+(t+5),'Approved by',{b:1}); return wb; }
// Fills the official IRD VAT register templates (templates/*.xlsx) from the saved bills
async function purchaseRegisterXlsx(bills, from, to, d) {
  ExcelJS = ExcelJS || require('exceljs'); let t1 = 'खरिद खाता (Purchase Book)', t2 = '(नियम २३ को उपनियम (१) को खण्ड (ख) संग सम्बन्धित)';
  try { const tw = new ExcelJS.Workbook(); await tw.xlsx.readFile(path.join(__dirname, 'templates', 'purchase-register.xlsx')); const g = a => { const v = tw.worksheets[0].getCell(a).value; return v && typeof v === 'object' ? (v.richText ? v.richText.map(x => x.text).join('') : v.result || '') : v; }; t1 = g('A1') || t1; t2 = g('A2') || t2; } catch {}
  const wb = new ExcelJS.Workbook(), s = wb.addWorksheet('Purchase Register'), n = bills.length, thin = { style: 'thin' }, bd = { top: thin, bottom: thin, left: thin, right: thin }, NUM = '#,##0.00';
  s.columns = [11, 11, 10, 10, 26, 14, 14, 16, 14, 12, 3, 14, 14, 13, 13, 30].map(width => ({ width }));
  const mid = (a, v, o = {}) => { const c = s.getCell(a); c.value = v; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.font = { bold: !!o.b, size: o.size || 10 }; return c; };
  s.mergeCells('A1:O1'); mid('A1', t1, { b: 1, size: 14 }); s.mergeCells('A2:O2'); mid('A2', t2);
  s.mergeCells('A4:O4'); s.getCell('A4').value = `करदाता दर्ता नं (PAN) : ${COMPANY.vat || '…...'}        करदाताको नाम: ${COMPANY.name}         साल    ${from.slice(0, 4)}      कर अवधि: ${from} देखि ${to} सम्म (AD)`;
  [['A5:F5', 'बीजक / प्रज्ञापनपत्र नम्बर'], ['G5:G6', 'जम्मा खरिद मूल्य (रु)'], ['H5:H6', 'कर छुट हुने वस्तु वा सेवाको खरिद / पैठारी मूल्य (रु)'], ['I5:K5', 'करयोग्य खरिद (पूंजीगत बाहेक)'], ['L5:M5', 'करयोग्य पैठारी (पूंजीगत बाहेक)'], ['N5:O5', 'पूंजीगत करयोग्य खरिद / पैठारी']].forEach(([r, t]) => { s.mergeCells(r); mid(r.split(':')[0], t, { b: 1 }); });
  ['मिति (AD)', 'मिति (BS)', 'बीजक नं.', 'प्रज्ञापनपत्र नं.', 'आपूर्तिकर्ताको नाम', 'आपूर्तिकर्ताको स्थायी लेखा नम्बर'].forEach((t, i) => mid(String.fromCharCode(65 + i) + '6', t, { b: 1 }));
  [['I', 'मूल्य (रु)'], ['J', 'कर (रु)'], ['K', ''], ['L', '10% margin मूल्य (रु)'], ['M', 'sales taxable amt'], ['N', 'sales 13% vat'], ['O', 'total कर (रु)']].forEach(([c, t]) => mid(c + '6', t, { b: 1 }));
  const link = b => d.bills.find(x => x.kind === 'sales' && x.purchaseId === b.id);
  bills.forEach((b, i) => { const sb = link(b), r = s.getRow(7 + i), who = [b.customer, b.passenger].filter(Boolean).join(' / ');
    [b.date, b.bs || '', b.billNo, '', b.supplier, b.supplierPan || '', b.total, b.nonTax, b.taxable, b.vat, null, sb ? rd(sb.nonTax + sb.taxable - b.nonTax - b.taxable) : null, sb ? sb.taxable : null, sb ? sb.vat : null, sb ? rd(sb.vat - b.vat) : null]
      .forEach((v, c) => { const cell = r.getCell(c + 1); cell.value = v === '' ? null : v; if (c >= 6) { cell.numFmt = NUM; cell.alignment = { horizontal: 'right' }; } else cell.alignment = { wrapText: true, vertical: 'top' }; });
    const w = r.getCell(16); w.value = who || null; w.font = { italic: true, color: { argb: 'FF555555' } }; w.alignment = { wrapText: true, vertical: 'top' }; }); // outside the bordered table
  s.getCell('P6').value = 'ग्राहक / यात्री'; s.getCell('P6').font = { bold: true }; s.getCell('P6').alignment = { horizontal: 'left', vertical: 'middle' };
  const t = s.getRow(7 + n); t.getCell(1).value = 'जम्मा'; t.font = { bold: true };
  [[7, 'total'], [8, 'nonTax'], [9, 'taxable'], [10, 'vat']].forEach(([c, k]) => { const L = String.fromCharCode(64 + c); t.getCell(c).value = { formula: n ? `SUM(${L}7:${L}${6 + n})` : '0', result: rd(bills.reduce((a, b) => a + b[k], 0)) }; t.getCell(c).numFmt = NUM; });
  [[12, b => { const sb = link(b); return sb ? sb.nonTax + sb.taxable - b.nonTax - b.taxable : 0; }], [13, b => (link(b) || {}).taxable || 0], [14, b => (link(b) || {}).vat || 0], [15, b => { const sb = link(b); return sb ? sb.vat - b.vat : 0; }]].forEach(([c, fn]) => { const L = String.fromCharCode(64 + c); t.getCell(c).value = { formula: n ? `SUM(${L}7:${L}${6 + n})` : '0', result: rd(bills.reduce((a, b) => a + fn(b), 0)) }; t.getCell(c).numFmt = NUM; });
  for (let r = 5; r <= 7 + n; r++) for (let c = 1; c <= 15; c++) s.getCell(r, c).border = bd; // table borders stop at column O
  for (let r = 5; r <= 6; r++) for (let c = 1; c <= 15; c++) s.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6E3' } };
  s.getRow(6).height = 32; s.views = [{ state: 'frozen', ySplit: 6 }]; return wb; }
async function registerXlsx(kind, bills, from, to, d) {
  if (kind === 'purchase') return purchaseRegisterXlsx(bills, from, to, d);
  ExcelJS = ExcelJS || require('exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(__dirname, 'templates', kind + '-register.xlsx'));
  const s = wb.worksheets[0], P = kind === 'purchase', ncol = P ? 16 : 15, amt = P ? [9, 10, 11, 12] : [8, 9, 10, 11], base = s.getRow(7), n = bills.length;
  const widths = P ? [11,10,10,24,14,32,8,8,14,14,14,12,12,10,12,10] : [11,10,24,14,32,8,8,14,14,14,12,14,12,14,12];
  widths.forEach((x, i) => s.getColumn(i + 1).width = x);
  s.getCell('A4').value = `करदाता दर्ता नं (PAN) : ${COMPANY.vat || '…...'}        करदाताको नाम: ${COMPANY.name}         साल    ${from.slice(0, 4)}      कर अवधि: ${from} देखि ${to} सम्म (AD)`;
  const styles = []; for (let c = 1; c <= ncol; c++) styles[c] = JSON.parse(JSON.stringify(base.getCell(c).style || {}));
  bills.forEach((b, i) => { const r = s.getRow(7 + i), m = b.bs || b.date;
    const vals = P ? [m, b.billNo, '', b.supplier, b.supplierPan || '', b.particulars || '', 1, 'Nos', b.total, b.nonTax, b.taxable, b.vat]
                   : [m, b.billNo, b.customer, b.customerVat || '', b.particulars || '', 1, 'Nos', b.total, b.nonTax, b.taxable, b.vat];
    for (let c = 1; c <= ncol; c++) { const cell = r.getCell(c); cell.style = JSON.parse(JSON.stringify(styles[c])); cell.value = vals[c - 1] === undefined ? null : vals[c - 1];
      if (amt.includes(c)) cell.numFmt = '#,##0.00'; else cell.alignment = { wrapText: true, vertical: 'top' }; } });
  const t = s.getRow(7 + n); t.getCell(1).value = 'जम्मा'; t.font = { bold: true };
  amt.forEach((c, k) => { const L = String.fromCharCode(64 + c), key = ['total', 'nonTax', 'taxable', 'vat'][k]; t.getCell(c).value = { formula: n ? `SUM(${L}7:${L}${6 + n})` : '0', result: rd(bills.reduce((a, b) => a + b[key], 0)) }; t.getCell(c).numFmt = '#,##0.00'; });
  return wb; }
const os = require('os');
// ---- Settings (settings.json): storage folder, auto-save switches, company details ----
const HOTEL_CATS = ['Hotel - Ramada', 'Hotel - Aloft']; // hotels whose booking/billing goes through a chain's tech platform; add more under Settings > Categories
const SETF = path.join(__dirname, 'settings.json'), FOLDERS = ['JV', 'PV', 'PMV', 'SV', 'RV', 'Statements', 'Registers', 'TrialBalance', 'IncomeStatement', 'BalanceSheet']; // add a name here for any new downloadable statement
const loadSet = () => { let s = {}; try { s = JSON.parse(fs.readFileSync(SETF)); } catch {} return { folder: s.folder || '', auto: { jv: true, pv: true, pmv: true, stm: true, sv: true, rv: true, registers: true, tb: true, pl: true, bs: true, ...s.auto }, company: { ...COMPANY_DEFAULT, ...s.company }, hotelCats: !!s.hotelCats, categories: (() => { const base = s.categories || ['Ticket', 'Hotel', 'Food', 'Other']; return s.hotelCats ? base : [...base, ...HOTEL_CATS.filter(c => !base.some(b => b.toLowerCase() === c.toLowerCase()))]; })() }; };
// ---- Which copy of the app owns the storage folder. A marker file (.owner) holds the path of the data.json that uses the folder; a second copy of the project
// (same settings.json, different location) is refused write access, so it cannot overwrite or delete the first copy's Excel files. ----
const OWNER_F = '.owner';
const ownerState = root => { root = root === undefined ? loadSet().folder : root; if (!root) return { ok: true }; try { const m = path.join(path.resolve(root), OWNER_F); if (!fs.existsSync(m)) return { ok: true, fresh: true }; const o = fs.readFileSync(m, 'utf8').trim(); return o === path.resolve(DB) ? { ok: true } : { ok: false, owner: o }; } catch { return { ok: true }; } };
const claimFolder = root => { try { fs.writeFileSync(path.join(path.resolve(root), OWNER_F), path.resolve(DB)); } catch (e) { console.log('Could not mark the storage folder:', e.message); } };
const canWrite = () => { const s = ownerState(); if (s.fresh) claimFolder(loadSet().folder); if (!s.ok) console.log('The storage folder belongs to another copy of the app (' + s.owner + '): not writing files there.'); return s.ok; };
const store = (sub, name, buf) => { if (!canWrite()) throw new Error('the storage folder belongs to another copy of the app'); const dir = path.join(loadSet().folder, sub); fs.mkdirSync(dir, { recursive: true }); const p = path.join(dir, name); fs.writeFileSync(p, Buffer.from(buf)); return p; };
const autoStore = (key, sub, name, buf) => { try { const s = loadSet(); return s.folder && s.auto[key] ? store(sub, name, buf) : null; } catch (e) { console.log('Auto-save failed:', e.message); return null; } };
const autoSaveVoucher = async (v, d) => { const k = vkey(v); if (!k) return null; try { return autoStore(k[0], k[1], v.no + '.xlsx', await jvXlsx(v, d).xlsx.writeBuffer()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };
const autoSaveInvoice = async b => { try { return autoStore('sv', 'SV', 'Invoice_' + String(b.billNo).replace(/[^\w.-]/g, '_') + '.xlsx', await invoiceXlsx(b).xlsx.writeBuffer()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };
// ---- Master data (db.json): reusable entries. To add a collection (items, banks, ...) add it to SCHEMA; the /api/db/<name> routes then work for it. ----
const DBF = path.join(__dirname, 'db.json');
const SCHEMA = { parties: { key: 'name', fields: ['name', 'type', 'pan', 'address', 'phone', 'email'] }, staff: { key: 'name', fields: ['name', 'designation', 'phone'] }, banks: { key: 'name', fields: ['name', 'bank', 'account', 'chequeFormat', 'ledger', 'linked'] } }; // banks are managed through /api/banks (each one also needs a ledger account) // type: supplier | customer | both
const loadDb = () => { let x; try { x = JSON.parse(fs.readFileSync(DBF)); } catch { x = { version: 1 }; } for (const c in SCHEMA) x[c] = x[c] || []; return x; };
const saveDb = x => fs.writeFileSync(DBF, JSON.stringify(x, null, 1));
function upsert(coll, rec) { const db = loadDb(), S = SCHEMA[coll], k = String(rec[S.key] || '').trim(); if (!k) return null;
  let e = db[coll].find(r => String(r[S.key]).toLowerCase() === k.toLowerCase()); if (!e) db[coll].push(e = { [S.key]: k });
  S.fields.forEach(f => { if (rec[f] !== undefined && f !== S.key) e[f] = rec[f]; }); saveDb(db); return e; }
const touchParty = (name, pan, role) => { name = (name || '').trim(); if (!name) return; const db = loadDb(); let e = db.parties.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (!e) db.parties.push(e = { name, type: role, pan: '', address: '', phone: '', email: '' }); else if (e.type !== role) e.type = 'both';
  if (pan && !e.pan) e.pan = pan; saveDb(db); };
// ---- Financial statements to Excel (tb = Trial Balance, pl = Income Statement, bs = Balance Sheet) ----
const bal = (d, a, from, to) => { const bs = 'ALE'.includes(a.type); let s = 0; for (const v of d.vouchers) if (v.date <= to && (bs || v.date >= from)) for (const l of v.lines) if (l.account === a.code) s += l.dr - l.cr; return rd(s); };
const priorPL = (d, from) => rd(d.vouchers.filter(v => v.date < from).reduce((t, v) => t + v.lines.reduce((u, l) => { const a = d.accounts.find(x => x.code === l.account); return a && 'IX'.includes(a.type) ? u + l.dr - l.cr : u; }, 0), 0));
const fx = (s, a, formula, result, bold) => { const c = s.getCell(a); c.value = { formula, result: rd(result) }; c.numFmt = '#,##0.00'; if (bold) c.font = { bold: true }; };
function sec(s, st, title, list, sign, extra = []) { put(s, 'A' + st.r, title, { b: 1 }); st.r++; const first = st.r; let tot = 0;
  [...new Set(list.map(a => a.group))].forEach(g => { const rows = list.filter(a => a.group === g).map(a => ({ c: a.code, n: a.name, v: sign * bal(st.d, a, st.from, st.to) })).filter(x => x.v); if (!rows.length) return;
    put(s, 'B' + st.r, g, { b: 1 }); st.r++; rows.forEach(x => { put(s, 'A' + st.r, x.c); put(s, 'B' + st.r, x.n); put(s, 'D' + st.r, x.v, { n: 1 }); tot += x.v; st.r++; }); });
  extra.forEach(x => { put(s, 'B' + st.r, x.n); put(s, 'D' + st.r, x.v, { n: 1 }); tot += x.v; st.r++; });
  const t = st.r; put(s, 'B' + t, 'Total ' + title, { b: 1 }); fx(s, 'E' + t, `SUM(D${first}:D${t - 1})`, tot, 1); st.r += 2; return { cell: 'E' + t, v: rd(tot) }; }
function statementXlsx(kind, d, from, to) {
  const { wb, s } = frame({ tb: 'Trial Balance', pl: 'Income Statement', bs: 'Balance Sheet' }[kind]); put(s, 'A5', `Period: ${from} to ${to} (AD)`);
  const st = { r: 7, d, from, to }, ofT = t => d.accounts.filter(a => t.includes(a.type));
  if (kind === 'tb') { ['Code', 'Account', '', 'Debit', 'Credit'].forEach((h, i) => put(s, 'ABCDE'[i] + '6', h, { b: 1 }));
    const rows = ofT('ALEIX').map(a => ({ c: a.code, n: a.name, v: bal(d, a, from, to) })), p = priorPL(d, from); if (p) rows.push({ c: '', n: "Prior years' profit/(loss) carried forward", v: p });
    const live = rows.filter(x => x.v); let dr = 0, cr = 0;
    live.forEach((x, i) => { const r = 7 + i; put(s, 'A' + r, x.c); put(s, 'B' + r, x.n); put(s, (x.v > 0 ? 'D' : 'E') + r, Math.abs(x.v), { n: 1 }); if (x.v > 0) dr += x.v; else cr -= x.v; });
    const t = 7 + live.length; put(s, 'B' + t, 'Total', { b: 1 }); fx(s, 'D' + t, `SUM(D7:D${t - 1})`, dr, 1); fx(s, 'E' + t, `SUM(E7:E${t - 1})`, cr, 1); put(s, 'B' + (t + 1), 'Difference (should be 0)'); fx(s, 'D' + (t + 1), `D${t}-E${t}`, dr - cr);
  } else if (kind === 'pl') { const inc = sec(s, st, 'Income', ofT('I'), -1), dc = sec(s, st, 'Direct Costs', ofT('X').filter(a => a.group === 'Direct Costs'), 1);
    const g = st.r; put(s, 'B' + g, 'Gross Profit', { b: 1 }); fx(s, 'E' + g, `${inc.cell}-${dc.cell}`, inc.v - dc.v, 1); st.r += 2;
    const op = sec(s, st, 'Operating Expenses', ofT('X').filter(a => a.group !== 'Direct Costs'), 1), n = st.r; put(s, 'B' + n, 'Net Profit / (Loss)', { b: 1 }); fx(s, 'E' + n, `E${g}-${op.cell}`, inc.v - dc.v - op.v, 1);
  } else { const A = sec(s, st, 'Assets', ofT('A'), 1), L = sec(s, st, 'Liabilities', ofT('L'), -1), cur = -ofT('IX').reduce((t, a) => t + bal(d, a, from, to), 0);
    const E = sec(s, st, 'Equity', ofT('E'), -1, [{ n: "Prior years' profit/(loss)", v: -priorPL(d, from) }, { n: 'Current period profit/(loss)', v: rd(cur) }]), t = st.r;
    put(s, 'B' + t, 'Total Liabilities + Equity', { b: 1 }); fx(s, 'E' + t, `${L.cell}+${E.cell}`, L.v + E.v, 1); put(s, 'B' + (t + 1), 'Difference vs Assets (should be 0)'); fx(s, 'E' + (t + 1), `${A.cell}-E${t}`, A.v - L.v - E.v); }
  return wb; }
// After deletions, numbering continues from the highest remaining number (so deleting the latest entries frees their numbers)
const resync = d => { const m = {}; d.vouchers.forEach(v => { const [p, n] = v.no.split('-'); m[p] = Math.max(m[p] || 0, +n); }); Object.values(PFX).forEach(p => { d.seq[p] = m[p] || 0; }); d.seq.SB = d.bills.filter(b => b.kind === 'sales').reduce((a, b) => Math.max(a, parseInt(b.billNo) || 0), 0); };
const catName = c => String(c || 'Other').replace(/\s*(purchase|sales)\s*$/i, '').trim() || 'Other'; // "Hotel Purchase" -> "Hotel"
const saveSet = s => fs.writeFileSync(SETF, JSON.stringify(s, null, 1));
const vkey = v => v.type === 'Sales' ? ['sv', 'SV'] : v.type === 'Journal' ? ['jv', 'JV'] : v.type === 'Receipt' ? ['rv', 'RV'] : v.type === 'Payment' ? ['pmv', 'PMV'] : null; // which switch/folder a voucher's Excel goes to
// Purchase bill = the supplier's tax invoice as received (exact amounts), on our company header
const purchaseBillXlsx = x => { const p = loadDb().parties.find(r => r.name.toLowerCase() === String(x.supplier).toLowerCase()) || {};
  return invoiceXlsx({ ...x, customer: x.supplier, customerVat: x.supplierPan || p.pan || '', seller: true }); }; // our company header; M/S and VAT/PAN fields hold the seller's details
const autoSaveBill = async b => { try { return autoStore('pv', 'PV', 'PurchaseBill_' + String(b.billNo).replace(/[^\w.-]/g, '_') + '.xlsx', await purchaseBillXlsx(b).xlsx.writeBuffer()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };
// ---- Excel files that belong to a record. They are rewritten when the record is edited and deleted with it. ----
const nkey = x => String(x || '').trim().toLowerCase();
const safeName = x => String(x).replace(/[^\w.-]/g, '_');
const vFile = v => { const k = vkey(v); return { key: k ? k[0] : 'jv', sub: k ? k[1] : 'JV', name: safeName(v.no) + '.xlsx' }; };
const bFile = b => b.kind === 'purchase' ? { key: 'pv', sub: 'PV', name: 'PurchaseBill_' + safeName(b.billNo) + '.xlsx' } : { key: 'sv', sub: 'SV', name: 'Invoice_' + safeName(b.billNo) + '.xlsx' };
const folderPath = (sub, name) => { const root = loadSet().folder; if (!root || !canWrite()) return null; const r = path.resolve(root), p = path.resolve(r, sub, name); return p.startsWith(r + path.sep) ? p : null; };
const rmFile = (sub, name) => { try { const p = folderPath(sub, name); if (p && fs.existsSync(p)) { fs.unlinkSync(p); return p; } } catch (e) { console.log('Could not delete file:', e.message); } return null; };
const dropVoucher = v => [...new Set([vFile(v).sub, 'JV', ...(v.type === 'Payment' ? ['PV'] : [])])].map(sub => rmFile(sub, vFile(v).name)).filter(Boolean); // JV folder too: older downloads of other voucher types landed there
const dropBill = b => [rmFile(bFile(b).sub, bFile(b).name)].filter(Boolean);
// Rewrite a file after an edit: if it already exists it is refreshed; otherwise it is only created when the auto-save switch is on (and onlyIfExists is false)
const refresh = async (f, make, onlyIfExists) => { try { const p = folderPath(f.sub, f.name); if (p && fs.existsSync(p)) { fs.writeFileSync(p, Buffer.from(await make())); return p; } return onlyIfExists ? null : autoStore(f.key, f.sub, f.name, await make()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };
const resaveVoucher = async (v, d) => { const r = await refresh(vFile(v), async () => jvXlsx(v, d).xlsx.writeBuffer(), !vkey(v) || d.bills.some(b => b.voucherId === v.id && b.kind === 'sales')); if (v.type === 'Payment') rmFile('PV', vFile(v).name); return r; }; // payment vouchers used to live in PV
const resaveBill = b => refresh(bFile(b), async () => (b.kind === 'purchase' ? purchaseBillXlsx(b) : invoiceXlsx(b)).xlsx.writeBuffer());
// ---- Shared validation / posting rules, used by both "create" and "edit" ----
function cleanLines(d, raw) { const lines = (raw || []).filter(l => l.account && (+l.dr || +l.cr)).map(l => ({ account: l.account, dr: +l.dr || 0, cr: +l.cr || 0 }));
  if (lines.length < 2) return { error: 'At least two lines needed' };
  const bad = lines.find(l => !d.accounts.some(a => a.code === l.account)); if (bad) return { error: 'Unknown account: ' + bad.account };
  const dr = lines.reduce((t, l) => t + l.dr, 0), cr = lines.reduce((t, l) => t + l.cr, 0);
  if (Math.abs(dr - cr) > 0.005) return { error: `Debit (${dr}) and credit (${cr}) must be equal` };
  return { lines }; }
const purchaseBad = p => { const total = rd((+p.nonTax || 0) + (+p.taxable || 0) + (+p.vat || 0)); return !p.supplier || !p.billNo || !p.date || total <= 0 ? 'Supplier, bill no., date and amounts are required' : null; };
function purchaseParts(d, p) { const nonTax = +p.nonTax || 0, taxable = +p.taxable || 0, vat = +p.vat || 0, total = rd(nonTax + taxable + vat), cat = catName(p.category),
    pacc = party(d, cat + ' Purchase', 'X', 'Direct Costs', 5100), sup = party(d, p.supplier.trim(), 'L', 'Sundry Creditors', 2200);
  return { nonTax, taxable, vat, total, cat, heading: cat + ' Purchase', notes: ['bill no. ' + p.billNo].concat(p.passenger ? [p.passenger] : []),
    narration: `${cat} Purchase - ${p.supplier} bill no. ${p.billNo}` + (p.passenger ? ' - ' + p.passenger : ''),
    lines: [{ account: pacc, dr: nonTax, cr: 0, desc: 'Non Taxable' }, { account: pacc, dr: taxable, cr: 0, desc: 'Taxable' }, { account: '1050', dr: vat, cr: 0, desc: 'VAT' }, { account: sup, dr: 0, cr: total, desc: p.supplier }].filter(l => l.dr || l.cr) }; }
const purchaseFields = (p, x) => ({ category: x.cat, supplier: p.supplier, supplierPan: p.supplierPan, billNo: p.billNo, date: p.date, bs: p.bs, customer: p.customer, passenger: p.passenger, particulars: p.particulars, nonTax: x.nonTax, taxable: x.taxable, vat: x.vat, total: x.total });
const salesBad = s => { const t = rd(+s.total || 0), n = +s.nonTax || 0; return !s.customer || !s.date || t <= 0 || t < n ? 'Customer, date and a bill total (not less than the non-taxable amount) are required' : null; };
function salesParts(d, s, billNo) { const nonTax = +s.nonTax || 0, total = rd(+s.total || 0), { taxable, vat } = split(nonTax, total), cat = catName(s.category),
    sacc = party(d, cat + ' Sales', 'I', 'Income', 4100), cus = party(d, s.customer.trim(), 'A', 'Sundry Debtors', 1200);
  return { nonTax, total, taxable, vat, cat, notes: ['bill no. ' + billNo], narration: `${cat} Sales - bill ${billNo} - ${s.customer}` + (s.passenger ? ' - ' + s.passenger : ''),
    lines: [{ account: cus, dr: total, cr: 0, desc: s.customer }, { account: sacc, dr: 0, cr: nonTax, desc: 'Non Taxable' }, { account: sacc, dr: 0, cr: taxable, desc: 'Taxable' }, { account: '2020', dr: 0, cr: vat, desc: 'VAT 13%' }].filter(l => l.dr || l.cr) }; }
// ---- Payments received from customers: a Receipt voucher  Dr Cash/Bank  Cr <customer's debtor account> ----
const MODES = ['Cash', 'Cheque', 'Fonepay', 'Bank transfer'];
function receiptParts(d, x) { const amt = rd(+x.amount || 0), payer = String(x.payer || '').trim(), acct = d.accounts.find(a => a.code === x.account && a.type === 'A');
  let cust = String(x.customer || '').trim(), cr = null; // cr = a non-customer account to credit (payer is not a recorded client)
  if (x.creditAccount) { cr = d.accounts.find(a => a.code === String(x.creditAccount)); if (!cr) return { error: 'The account to credit no longer exists' }; if (cr.group === 'Sundry Debtors') { cust = cr.name; cr = null; } }
  if (!x.date || amt <= 0) return { error: 'Date and an amount above zero are required' };
  if (!acct) return { error: 'Choose the cash or bank account the money went into' };
  const mode = MODES.includes(x.mode) ? x.mode : 'Cash', ref = String(x.instrument || '').trim(), note = String(x.note || '').trim();
  if (cr) { // payment from someone who is not a recorded customer: Dr Cash/Bank  Cr <chosen account>
    if (!payer) return { error: 'Enter who the payment was received from' };
    if (cr.code === acct.code) return { error: 'The account credited must be different from the account the money went into' };
    return { rcpt: { customer: '', other: true, payer, creditAccount: cr.code, mode, instrument: ref, billId: null, account: acct.code, amount: amt, note },
      narration: `Received from ${payer} by ${mode} - credited to ${cr.name}` + (note ? ' - ' + note : ''),
      lines: [{ account: acct.code, dr: amt, cr: 0, desc: acct.name }, { account: cr.code, dr: 0, cr: amt, desc: payer }] }; }
  if (!cust) return { error: 'Choose a customer, or choose another account to credit' };
  const bill = x.billId ? d.bills.find(y => String(y.id) === String(x.billId) && y.kind === 'sales') : null;
  if (bill && nkey(bill.customer) !== nkey(cust)) return { error: 'That bill belongs to a different customer' };
  const cus = party(d, cust, 'A', 'Sundry Debtors', 1200), name = d.accounts.find(a => a.code === cus).name;
  return { rcpt: { customer: name, ...(payer ? { payer } : {}), mode, instrument: ref, billId: bill ? bill.id : null, account: acct.code, amount: amt, note },
    narration: `Received from ${payer && nkey(payer) !== nkey(name) ? payer + ' on behalf of ' : ''}${name} by ${mode}` + (bill ? ' against bill ' + bill.billNo : '') + (note ? ' - ' + note : ''),
    lines: [{ account: acct.code, dr: amt, cr: 0, desc: acct.name }, { account: cus, dr: 0, cr: amt, desc: name }] }; }
// Per-customer picture for the Payments page. The statement is the customer's ledger account (so it always agrees with the Balance Sheet);
// each bill's paid/due is worked out from the receipts: those tied to a bill go to it, the rest are applied to the oldest bills first.
function receivables(d) { const db = loadDb(), map = new Map(), get = n => { const k = nkey(n); if (!k) return null; if (!map.has(k)) map.set(k, { name: String(n).trim(), pan: '', bills: [], rcpts: [], pending: [] }); return map.get(k); };
  db.parties.filter(p => p.type !== 'supplier').forEach(p => { const c = get(p.name); if (c) c.pan = p.pan || ''; });
  d.bills.forEach(x => { const c = get(x.customer); if (!c) return; if (x.kind === 'sales') { c.bills.push(x); if (!c.pan) c.pan = x.customerVat || ''; } else if (!x.sold) c.pending.push(x); });
  d.vouchers.filter(v => v.rcpt && !v.rcpt.other).forEach(v => get(v.rcpt.customer).rcpts.push(v));
  const vs = d.vouchers.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return [...map.values()].map(c => { const acct = d.accounts.find(a => a.group === 'Sundry Debtors' && nkey(a.name) === nkey(c.name)); let bal = 0, dr = 0, cr = 0, hand = 0; const statement = [];
    if (acct) vs.forEach(v => v.lines.filter(l => l.account === acct.code).forEach(l => { bal = rd(bal + l.dr - l.cr); dr += l.dr; cr += l.cr; if (!v.rcpt && !d.bills.some(x => x.voucherId === v.id)) hand += l.cr; // credits made by hand (e.g. older Receipt vouchers) also count as money received
      statement.push({ date: v.date, bs: v.bs, no: v.no, vid: v.id, type: v.type, ref: v.ref, narration: v.narration, dr: l.dr, cr: l.cr, bal, rcpt: !!v.rcpt, billId: (d.bills.find(x => x.voucherId === v.id) || {}).id }); }));
    const bills = c.bills.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true })), paid = new Map(bills.map(x => [x.id, 0])); let free = hand;
    c.rcpts.forEach(v => { const amt = v.rcpt.amount, id = v.rcpt.billId; if (id != null && paid.has(id)) paid.set(id, paid.get(id) + amt); else free += amt; });
    bills.forEach(x => { const over = paid.get(x.id) - x.total; if (over > 0) { free += over; paid.set(x.id, x.total); } });
    bills.forEach(x => { const take = Math.min(free, rd(x.total - paid.get(x.id))); if (take > 0) { paid.set(x.id, rd(paid.get(x.id) + take)); free = rd(free - take); } });
    return { name: c.name, pan: c.pan, dr: rd(dr), cr: rd(cr), balance: bal, advance: rd(free), statement,
      bills: bills.map(x => { const pd = rd(paid.get(x.id)), due = rd(x.total - pd); return { id: x.id, billNo: x.billNo, date: x.date, bs: x.bs, voucher: x.voucher, total: x.total, paid: pd, due, status: due <= .004 ? 'Paid' : pd > .004 ? 'Partial' : 'Unpaid' }; }),
      pending: c.pending.map(x => ({ id: x.id, billNo: x.billNo, supplier: x.supplier, date: x.date, total: x.total, passenger: x.passenger, category: x.category })) }; })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())); }
// ---- One payment by several cheques (maybe from different banks): pmt.splits = [{ account, instrument, amount }, ...]. pmt.account / pmt.instrument stay as the first cheque's / all cheque numbers
// so older screens keep working; the voucher gets one credit line per bank account. ----
function chequeSplits(d, x, mode, amt, acct, ref) { if (!Array.isArray(x.more) || !x.more.length) return {};
  if (mode !== 'Cheque') return { error: 'More than one cheque can only be used when the mode is Cheque' };
  const extra = []; for (const m of x.more) { const a = d.accounts.find(y => y.code === String(m.account) && y.type === 'A'), n = rd(+m.amount || 0);
    if (!a) return { error: 'Choose the bank account for every extra cheque' }; if (n <= 0) return { error: 'Enter an amount for every extra cheque' };
    extra.push({ account: a.code, instrument: String(m.instrument || '').trim(), amount: n }); }
  const first = rd(amt - extra.reduce((t, y) => t + y.amount, 0));
  if (first <= 0.004) return { error: 'The extra cheques add up to the whole payment (or more), so nothing is left for the first cheque' };
  return { splits: [{ account: acct.code, instrument: ref, amount: first }, ...extra] }; }
const splitCredits = (d, splits) => { const by = new Map(); splits.forEach(y => by.set(y.account, rd((by.get(y.account) || 0) + y.amount))); return [...by].map(([account, cr]) => ({ account, dr: 0, cr, desc: (d.accounts.find(a => a.code === account) || {}).name || account })); }; // one credit line per bank account
const splitNote = (d, splits) => ' (' + splits.map(y => (y.instrument || 'no cheque no.') + ' ' + ((d.accounts.find(a => a.code === y.account) || {}).name || y.account) + ' ' + y.amount.toFixed(2)).join('; ') + ')';
// ---- Payments made to suppliers: a Payment voucher  Dr <supplier's creditor account>  Cr Cash/Bank ----
// A payment can be for any amount (part of a bill, several bills, or more than is owed). If the payee is not a recorded supplier,
// it is charged to whichever account is chosen instead (Advance to Suppliers, an expense, etc.) and marked `other`.
function paymentParts(d, x) { const amt = rd(+x.amount || 0), payee = String(x.payee || '').trim(), acct = d.accounts.find(a => a.code === x.account && a.type === 'A');
  let sup = String(x.supplier || '').trim(), dr = null;
  if (x.debitAccount) { dr = d.accounts.find(a => a.code === String(x.debitAccount)); if (!dr) return { error: 'The account to charge no longer exists' }; if (dr.group === 'Sundry Creditors') { sup = dr.name; dr = null; } }
  if (!x.date || amt <= 0) return { error: 'Date and an amount above zero are required' };
  if (!acct) return { error: 'Choose the cash or bank account the money was paid from' };
  const mode = MODES.includes(x.mode) ? x.mode : 'Cash', ref = String(x.instrument || '').trim(), note = String(x.note || '').trim();
  const fee = mode === 'Fonepay' ? rd(Math.max(+x.fee || 0, 0)) : 0, pf = mode === 'Fonepay' ? { fee } : {}, fn = fee ? ' (Fonepay charge ' + fee + ')' : '', out = rd(amt + fee),
    feeL = fee ? [{ account: party(d, 'Fonepay Charges', 'X', 'Operating Expenses', 6000), dr: fee, cr: 0, desc: 'Fonepay charge' }] : []; // the charge is our expense; the supplier still receives the full amount
  const sp = chequeSplits(d, x, mode, amt, acct, ref); if (sp.error) return sp; // one payment by several cheques / banks: x.more = the cheques after the first
  const crL = sp.splits ? splitCredits(d, sp.splits) : [{ account: acct.code, dr: 0, cr: out, desc: acct.name }], sn = sp.splits ? splitNote(d, sp.splits) : '', instr = sp.splits ? sp.splits.map(y => y.instrument).filter(Boolean).join(', ') : ref, spf = sp.splits ? { splits: sp.splits } : {};
  if (dr) { // payee is not a recorded supplier: Dr <chosen account>  Cr Cash/Bank
    if (!payee) return { error: 'Enter who the payment was made to' };
    if (dr.code === acct.code) return { error: 'The account charged must be different from the account the money was paid from' };
    return { pmt: { supplier: '', other: true, payee, debitAccount: dr.code, mode, instrument: instr, billId: null, account: acct.code, amount: amt, note, ...pf, ...spf },
      narration: `Paid to ${payee} by ${mode}${sn}${fn} - charged to ${dr.name}` + (note ? ' - ' + note : ''),
      lines: [{ account: dr.code, dr: amt, cr: 0, desc: payee }, ...feeL, ...crL] }; }
  if (!sup) return { error: 'Choose a supplier, or choose another account to charge' };
  const bill = x.billId ? d.bills.find(y => String(y.id) === String(x.billId) && y.kind === 'purchase') : null;
  if (bill && nkey(bill.supplier) !== nkey(sup)) return { error: 'That bill belongs to a different supplier' };
  const cid = party(d, sup, 'L', 'Sundry Creditors', 2200), name = d.accounts.find(a => a.code === cid).name;
  return { pmt: { supplier: name, ...(payee ? { payee } : {}), mode, instrument: instr, billId: bill ? bill.id : null, account: acct.code, amount: amt, note, ...pf, ...spf },
    narration: `Paid to ${name}${payee && nkey(payee) !== nkey(name) ? ' (via ' + payee + ')' : ''} by ${mode}${sn}${fn}` + (bill ? ' against bill ' + bill.billNo : '') + (note ? ' - ' + note : ''),
    lines: [{ account: cid, dr: amt, cr: 0, desc: name }, ...feeL, ...crL] }; }
// Per-supplier picture for the Payments made page (same idea as receivables()): the statement is the supplier's ledger account,
// each purchase bill's paid/due comes from the payments: those tied to a bill go to it, the rest are applied to the oldest bills first.
function payables(d) { const db = loadDb(), map = new Map(), get = n => { const k = nkey(n); if (!k) return null; if (!map.has(k)) map.set(k, { name: String(n).trim(), pan: '', bills: [], pmts: [] }); return map.get(k); };
  db.parties.filter(p => p.type !== 'customer').forEach(p => { const c = get(p.name); if (c) c.pan = p.pan || ''; });
  d.bills.forEach(x => { if (x.kind !== 'purchase') return; const c = get(x.supplier); if (!c) return; c.bills.push(x); if (!c.pan) c.pan = x.supplierPan || ''; });
  d.vouchers.filter(v => v.pmt && !v.pmt.other).forEach(v => get(v.pmt.supplier).pmts.push(v));
  const vs = d.vouchers.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return [...map.values()].map(c => { const acct = d.accounts.find(a => a.group === 'Sundry Creditors' && nkey(a.name) === nkey(c.name)); let bal = 0, billed = 0, paidAmt = 0, hand = 0; const statement = [];
    if (acct) vs.forEach(v => v.lines.filter(l => l.account === acct.code).forEach(l => { bal = rd(bal + l.cr - l.dr); billed += l.cr; paidAmt += l.dr; if (!v.pmt && !d.bills.some(x => x.voucherId === v.id)) hand += l.dr; // debits made by hand also count as money paid
      statement.push({ date: v.date, bs: v.bs, no: v.no, vid: v.id, type: v.type, ref: v.ref, narration: v.narration, cr: l.cr, dr: l.dr, bal, pmt: !!v.pmt, billId: (d.bills.find(x => x.voucherId === v.id) || {}).id }); }));
    const bills = c.bills.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true })), paid = new Map(bills.map(x => [x.id, 0])); let free = hand;
    c.pmts.forEach(v => { const amt = v.pmt.amount, id = v.pmt.billId; if (id != null && paid.has(id)) paid.set(id, paid.get(id) + amt); else free += amt; });
    bills.forEach(x => { const over = paid.get(x.id) - x.total; if (over > 0) { free += over; paid.set(x.id, x.total); } });
    bills.forEach(x => { const take = Math.min(free, rd(x.total - paid.get(x.id))); if (take > 0) { paid.set(x.id, rd(paid.get(x.id) + take)); free = rd(free - take); } });
    return { name: c.name, pan: c.pan, billed: rd(billed), paid: rd(paidAmt), balance: bal, advance: rd(free), statement,
      bills: bills.map(x => { const pd = rd(paid.get(x.id)), due = rd(x.total - pd); return { id: x.id, billNo: x.billNo, date: x.date, bs: x.bs, voucher: x.voucher, total: x.total, paid: pd, due, status: due <= .004 ? 'Paid' : pd > .004 ? 'Partial' : 'Unpaid' }; }) }; })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())); }
// ---- Salary payments: a Payment voucher  Dr Salary & Wages (or Salary Payable)  Cr Cash/Bank. New staff names are saved to the staff list in db.json. ----
function salaryParts(d, x) { const amt = rd(+x.amount || 0), typed = String(x.staff || '').trim(), ex = loadDb().staff.find(r => nkey(r.name) === nkey(typed)), staff = ex ? ex.name : typed,
    acct = d.accounts.find(a => a.code === x.account && a.type === 'A'), dr = d.accounts.find(a => a.code === String(x.debitAccount || '6000'));
  if (!staff) return { error: 'Enter the staff name' }; if (!x.date || amt <= 0) return { error: 'Date and an amount above zero are required' };
  if (!acct) return { error: 'Choose the cash or bank account the salary was paid from' }; if (!dr) return { error: 'The salary account no longer exists' };
  const mode = MODES.includes(x.mode) ? x.mode : 'Cash', ref = String(x.instrument || '').trim(), note = String(x.note || '').trim(), period = String(x.period || '').trim();
  const fee = mode === 'Fonepay' ? rd(Math.max(+x.fee || 0, 0)) : 0, pf = mode === 'Fonepay' ? { fee } : {}, fn = fee ? ' (Fonepay charge ' + fee + ')' : '', out = rd(amt + fee),
    feeL = fee ? [{ account: party(d, 'Fonepay Charges', 'X', 'Operating Expenses', 6000), dr: fee, cr: 0, desc: 'Fonepay charge' }] : []; // our expense; the staff member still receives the full amount
  return { sal: { staff, period, mode, instrument: ref, account: acct.code, debitAccount: dr.code, amount: amt, note, ...pf },
    narration: `Salary paid to ${staff}` + (period ? ' for ' + period : '') + ` by ${mode}${fn}` + (note ? ' - ' + note : ''),
    lines: [{ account: dr.code, dr: amt, cr: 0, desc: staff + ' - ' + dr.name }, ...feeL, { account: acct.code, dr: 0, cr: out, desc: acct.name }] }; }
// ---- One-time conversion of old records: supplier-style "other" payments charged to Salary & Wages / Salary Payable become salary payments (same accounting, same voucher no.) ----
const migratable = d => d.vouchers.filter(v => v.pmt && v.pmt.other && ['6000', '2040'].includes(v.pmt.debitAccount));
function migrateSalaries(d) { const list = migratable(d); list.forEach(v => { const p = v.pmt; v.sal = { staff: p.payee, period: '', mode: p.mode, instrument: p.instrument, account: p.account, debitAccount: p.debitAccount, amount: p.amount, note: p.note, ...(p.fee !== undefined ? { fee: p.fee } : {}) }; delete v.pmt; upsert('staff', { name: p.payee }); }); return list; }
// ---- Bank accounts: each one has its own ledger account, so every cheque shows which bank it was paid from. ----
// chequeFormat = the digits that never change on that bank's cheques, x = a digit that does, e.g. 7895xxxx. Several cheque books: separate with commas. Digits only (7895) = "starts with".
const fmtParts = f => String(f || '').split(/[,;]+/).map(x => x.toLowerCase().replace(/[\s-]/g, '').replace(/[#*?]/g, 'x')).filter(Boolean).map(s => ({ s, pre: !s.includes('x') }));
const fmtBad = f => fmtParts(f).some(p => !/^[0-9x]+$/.test(p.s) || !/\d/.test(p.s)) ? 'The cheque number format can only contain digits and x, for example 7895xxxx' : null;
const fmtHit = (p, run) => p.pre ? run.startsWith(p.s) : run.length === p.s.length && [...p.s].every((c, i) => c === 'x' || c === run[i]);
const fmtBoth = (a, b) => { if (!a.pre && !b.pre && a.s.length !== b.s.length) return false; if ((a.pre && !b.pre && b.s.length < a.s.length) || (b.pre && !a.pre && a.s.length < b.s.length)) return false;
  for (let i = 0, n = Math.min(a.s.length, b.s.length); i < n; i++) if (a.s[i] !== 'x' && b.s[i] !== 'x' && a.s[i] !== b.s[i]) return false; return true; }; // could one cheque number fit both formats?
const banksFor = (banks, instr) => { const runs = String(instr || '').match(/\d+/g) || []; return banks.filter(b => fmtParts(b.chequeFormat).some(p => runs.some(r => fmtHit(p, r)))); }; // banks whose format fits a cheque number
const nextBankCode = d => { for (let c = 1011; c < 1020; c++) if (!d.accounts.some(a => a.code === String(c))) return String(c); return String(Math.max(...d.accounts.map(a => +a.code || 0).filter(c => c < 2000)) + 1); };
const bankAcctName = n => /bank/i.test(n) ? n : 'Bank - ' + n; // "bank" in the name is what puts it in the Paid from lists
// Old cheque payments (payments made + salaries) whose cheque number fits exactly one bank's format. Ones already on a bank account chosen on purpose are only flagged, never moved.
function bankMatch(d) { const banks = loadDb().banks.filter(b => d.accounts.some(a => a.code === b.ledger)), chosen = new Set(banks.filter(b => !b.linked).map(b => b.ledger)), nmA = c => (d.accounts.find(a => a.code === c) || {}).name || c, out = { banks: banks.filter(b => fmtParts(b.chequeFormat).length).length, change: [], check: [], none: [] };
  if (!out.banks) return out;
  d.vouchers.filter(v => (v.pmt || v.sal) && (v.pmt || v.sal).mode === 'Cheque').sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(v => { const p = v.pmt || v.sal; if (p.splits) return; const hit = banksFor(banks, p.instrument),
      row = { id: v.id, no: v.no, date: v.date, bs: v.bs || '', who: v.sal ? p.staff : p.other ? p.payee : p.supplier, cheque: p.instrument || '', amount: p.amount, from: nmA(p.account) };
    if (hit.length === 1) { if (p.account === hit[0].ledger) return; if (chosen.has(p.account)) out.check.push({ ...row, note: 'Recorded as ' + row.from + ', but the number fits ' + hit[0].name }); else out.change.push({ ...row, to: nmA(hit[0].ledger), toCode: hit[0].ledger }); }
    else if (hit.length > 1) out.check.push({ ...row, note: banksFor(banks, p.instrument).length > 1 && chqRuns(p.instrument).length > 1 && chqRuns(p.instrument).every(r => banksFor(banks, r).length === 1) ? 'Cheques from different banks in one payment: use “Split old payments made with several cheques” below' : 'The number fits more than one bank format' });
    else if (!chosen.has(p.account)) out.none.push({ ...row, note: p.instrument ? 'No bank format fits this number' : 'No cheque number recorded' }); });
  return out; }
// ---- Old payments made where ONE voucher holds several cheque numbers that belong to different banks (e.g. "7895001, 4410002").
// splitScan lists them (cheque -> bank by the formats above); the person types each cheque's amount; splitApply turns the voucher into a split payment (one credit line per bank, totals unchanged). ----
const chqRuns = s => [...new Set(String(s || '').match(/\d+/g) || [])];
function splitScan(d) { const banks = loadDb().banks.filter(b => d.accounts.some(a => a.code === b.ledger) && fmtParts(b.chequeFormat).length), nmA = c => (d.accounts.find(a => a.code === c) || {}).name || c, out = { banks: banks.length, rows: [], check: [] };
  if (!banks.length) return out;
  d.vouchers.filter(v => v.pmt && !v.pmt.splits && v.pmt.mode === 'Cheque').sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(v => { const p = v.pmt, runs = chqRuns(p.instrument); if (runs.length < 2) return;
    const hits = runs.map(r => ({ r, b: banksFor(banks, r) })), ok = hits.filter(h => h.b.length === 1);
    if (new Set(ok.map(h => h.b[0].ledger)).size < 2) return; // fewer than two banks recognised: not a multi-bank payment (the match tool above deals with single-bank ones)
    const row = { id: v.id, no: v.no, date: v.date, bs: v.bs || '', who: p.other ? p.payee : p.supplier, ref: p.instrument || '', total: p.amount, from: nmA(p.account), parts: ok.map(h => ({ cheque: h.r, ledger: h.b[0].ledger, bank: h.b[0].name })) };
    const cr = v.lines.filter(l => l.cr > 0);
    if (ok.length !== hits.length) out.check.push({ ...row, note: 'Cheque no. ' + hits.filter(h => h.b.length !== 1).map(h => h.r).join(', ') + ' fits no bank format (or more than one); add its format above or split by hand' });
    else if (!(cr.length === 1 && cr[0].account === p.account && Math.abs(cr[0].cr - p.amount) < .005)) out.check.push({ ...row, note: 'The voucher lines were changed by hand; edit this payment and add the cheques yourself' });
    else out.rows.push(row); });
  return out; }
function splitPlan(d, items) { const scan = splitScan(d), plan = []; // validates everything first; nothing is changed here
  for (const it of items) { const row = scan.rows.find(r => r.id === it.id); if (!row) return { error: 'A payment in the list can no longer be split (it was changed or already split). Check again.' };
    const parts = row.parts.map(pt => { const g = (it.parts || []).find(y => String(y.cheque) === pt.cheque); return { account: pt.ledger, instrument: pt.cheque, amount: rd(+(g && g.amount) || 0) }; });
    if (parts.some(y => y.amount <= 0)) return { error: 'Enter an amount for every cheque of ' + row.no };
    const sum = rd(parts.reduce((t, y) => t + y.amount, 0)); if (Math.abs(sum - row.total) > .004) return { error: `The cheques of ${row.no} add up to ${sum.toFixed(2)} but the payment is ${row.total.toFixed(2)}` };
    plan.push({ row, parts }); }
  return { plan }; }
function splitApply(d, plan) { const done = [];
  plan.forEach(({ row, parts }) => { const v = d.vouchers.find(y => y.id === row.id), p = v.pmt, i = v.lines.findIndex(l => l.cr > 0 && l.account === p.account);
    v.lines.splice(i, 1, ...splitCredits(d, parts)); p.splits = parts; p.account = parts[0].account; p.instrument = parts.map(y => y.instrument).join(', '); v.ref = p.instrument;
    v.narration = String(v.narration || '').replace(/ by Cheque\b/, m => m + splitNote(d, parts)); done.push(v); }); // only the credit side is rebuilt; the supplier/charge side, amounts and dates stay
  return done; }
// ---- Rebuild the Excel files of vouchers and bills from data.json (for example after another copy of the app overwrote them) ----
async function rebuildFiles(d, createMissing) { const s = loadSet(); if (!s.folder) return { error: 'Set a storage folder first' }; if (!ownerState().ok) return { error: 'This storage folder belongs to another copy of the app. Save settings and take it over first.' };
  let vouchers = 0, bills = 0; const known = new Set();
  for (const v of d.vouchers) { const f = vFile(v); known.add(f.sub + '/' + f.name); const only = !createMissing || !vkey(v) || d.bills.some(b => b.voucherId === v.id && b.kind === 'sales');
    if (await refresh(f, async () => jvXlsx(v, d).xlsx.writeBuffer(), only)) vouchers++; }
  for (const b of d.bills) { const f = bFile(b); known.add(f.sub + '/' + f.name); if (await refresh(f, async () => (b.kind === 'purchase' ? purchaseBillXlsx(b) : invoiceXlsx(b)).xlsx.writeBuffer(), !createMissing)) bills++; }
  const orphans = []; for (const sub of ['JV', 'PV', 'PMV', 'SV', 'RV']) { try { fs.readdirSync(path.join(path.resolve(s.folder), sub)).forEach(n => { if (/^[A-Z]+-\d+\.xlsx$/i.test(n) && !known.has(sub + '/' + n)) orphans.push(sub + '/' + n); }); } catch {} }
  return { vouchers, bills, orphans: orphans.slice(0, 60), orphanCount: orphans.length }; }
const pvToPmv = d => { const out = []; d.vouchers.filter(v => v.type === 'Payment').forEach(v => { const a = folderPath('PV', safeName(v.no) + '.xlsx'), b = folderPath('PMV', safeName(v.no) + '.xlsx'); if (a && b && fs.existsSync(a) && !fs.existsSync(b)) out.push([a, b]); }); return out; };
// ---- Statements of account for a supplier, customer, staff member or expense account (JSON for the page, Excel for the Statements folder) ----
function stmtData(d, kind, name, from, to) { const nk = nkey(name), byDate = (a, b) => a.date.localeCompare(b.date) || a.id - b.id; let cols, sub = '', entries = [];
  if (kind === 'customer' || kind === 'supplier') { const C = kind === 'customer', r = (C ? receivables(d) : payables(d)).find(x => nkey(x.name) === nk); if (!r) return null; name = r.name; sub = r.pan ? 'PAN/VAT ' + r.pan : '';
    cols = C ? { a: 'Billed (Dr)', b: 'Received (Cr)', bal: 'Balance (they owe us)' } : { a: 'Billed (Cr)', b: 'Paid (Dr)', bal: 'Balance (we owe)' };
    entries = r.statement.map(e => ({ date: e.date, bs: e.bs || '', no: e.no, ref: e.ref || '', text: e.narration || '', a: C ? e.dr : e.cr, b: C ? e.cr : e.dr, bal: e.bal })); }
  else if (kind === 'staff') { const st = loadDb().staff.find(x => nkey(x.name) === nk), vs = d.vouchers.filter(v => v.sal && nkey(v.sal.staff) === nk).sort(byDate); if (!st && !vs.length) return null; name = st ? st.name : vs[0].sal.staff; sub = st && st.designation || ''; cols = { a: 'Salary paid', b: 'Fonepay charge', bal: 'Total paid to date' }; let run = 0;
    vs.forEach(v => { run = rd(run + v.sal.amount); entries.push({ date: v.date, bs: v.bs || '', no: v.no, ref: v.sal.instrument || '', text: [v.sal.period ? 'Salary for ' + v.sal.period : 'Salary', v.sal.mode, v.sal.note].filter(Boolean).join(' · '), a: v.sal.amount, b: v.sal.fee || 0, bal: run }); }); }
  else if (kind === 'expense') { const a = d.accounts.find(x => x.type === 'X' && nkey(x.name) === nk); if (!a) return null; name = a.name; sub = a.group; cols = { a: 'Debit', b: 'Credit', bal: 'Balance' }; let run = 0;
    d.vouchers.slice().sort(byDate).forEach(v => v.lines.filter(l => l.account === a.code).forEach(l => { run = rd(run + l.dr - l.cr); entries.push({ date: v.date, bs: v.bs || '', no: v.no, ref: v.ref || '', text: v.narration || l.desc || '', a: l.dr, b: l.cr, bal: run }); })); }
  else return null;
  const before = entries.filter(e => e.date < from), rows = entries.filter(e => e.date >= from && e.date <= to), opening = before.length ? before[before.length - 1].bal : 0;
  return { kind, name, sub, from, to, cols, opening, rows, closing: rows.length ? rows[rows.length - 1].bal : opening, a: rd(rows.reduce((t, e) => t + e.a, 0)), b: rd(rows.reduce((t, e) => t + e.b, 0)) }; }
const STM_LABEL = { customer: 'Customer', supplier: 'Supplier', staff: 'Staff', expense: 'Expense' };
function pstatementXlsx(S) { ExcelJS = ExcelJS || require('exceljs'); const wb = new ExcelJS.Workbook(), s = wb.addWorksheet('Statement'), co = COMPANY, thin = { style: 'thin' }, bd = { top: thin, bottom: thin, left: thin, right: thin };
  s.columns = [12, 12, 11, 46, 16, 16, 20].map(width => ({ width }));
  const m = (r, t, o = {}) => { s.mergeCells(`A${r}:G${r}`); const c = s.getCell('A' + r); c.value = t; c.alignment = { horizontal: 'center', wrapText: true }; c.font = { bold: !!o.b, size: o.size || 10 }; };
  m(1, co.name, { b: 1, size: 16 }); m(2, `${co.addr} | Tel: ${co.tel} | ${co.email}`); m(3, 'VAT No.: ' + (co.vat || '________')); m(4, 'STATEMENT OF ACCOUNT', { b: 1, size: 13 });
  m(5, `${STM_LABEL[S.kind]}: ${S.name}${S.sub ? '  (' + S.sub + ')' : ''}`, { b: 1 }); m(6, `Period: ${S.from} to ${S.to}`);
  const H = 8; ['Date (AD)', 'Date (BS)', 'Voucher', 'Particulars', S.cols.a, S.cols.b, S.cols.bal].forEach((t, i) => { const c = s.getRow(H).getCell(i + 1); c.value = t; c.font = { bold: true }; c.alignment = { horizontal: i > 3 ? 'right' : 'left', wrapText: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6E3' } }; });
  let r = H + 1; const add = (vals, bold) => { const row = s.getRow(r++); vals.forEach((v, i) => { const c = row.getCell(i + 1); c.value = v === '' ? null : v; if (i > 3) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'right' }; } else c.alignment = { wrapText: true, vertical: 'top' }; if (bold) c.font = { bold: true }; }); };
  add(['', '', '', 'Opening balance', '', '', S.opening], 1);
  S.rows.forEach(e => add([e.date, e.bs, e.no, e.text + (e.ref ? '  [' + e.ref + ']' : ''), e.a || '', e.b || '', e.bal]));
  add(['', '', '', 'Total for the period', S.a, S.b, ''], 1); add(['', '', '', 'Closing balance', '', '', S.closing], 1);
  for (let i = H; i < r; i++) for (let c = 1; c <= 7; c++) s.getRow(i).getCell(c).border = bd; s.views = [{ state: 'frozen', ySplit: H }]; return wb; }
const load = () => { let d; try { d = JSON.parse(fs.readFileSync(DB)); } catch { d = { accounts: seed.map(([code,name,type,group]) => ({code,name,type,group})), vouchers: [], seq: {} }; }
  d.bills = d.bills || []; EXTRA.forEach(([code,name,type,group]) => { if (!d.accounts.some(a => a.code === code)) d.accounts.push({code,name,type,group}); }); return d; };
const save = d => fs.writeFileSync(DB, JSON.stringify(d, null, 1));
const send = (res, c, o) => { res.writeHead(c, {'Content-Type':'application/json'}); res.end(JSON.stringify(o)); };
const PFX = { Journal:'JV', Payment:'PV', Receipt:'RV', Purchase:'PB', Sales:'SV', Contra:'CV' };

http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (!u.startsWith('/api/')) { res.writeHead(200, {'Content-Type':'text/html'}); return res.end(fs.readFileSync(path.join(__dirname,'public','index.html'))); }
  let b = ''; req.on('data', c => b += c);
  req.on('end', async () => {
    try {
      const d = load(); Object.assign(COMPANY, loadSet().company);
      { const wh = res.writeHead.bind(res); res.writeHead = (c, h = {}) => wh(c, res._saved ? { ...h, 'X-Saved-To': encodeURIComponent(res._saved) } : h); } // tells the browser the file went to the storage folder
      if (req.method === 'GET' && u === '/api/data') return send(res, 200, { ...d, db: loadDb(), settings: { ...loadSet(), folders: FOLDERS, folderOwner: ownerState() }, receivables: receivables(d), payables: payables(d) });
      if (req.method === 'POST' && u === '/api/vouchers') {
        const v = JSON.parse(b);
        if (!v.date) return send(res, 400, { error: 'Date is required' });
        const c = cleanLines(d, v.lines); if (c.error) return send(res, 400, c); v.lines = c.lines;
        const p = PFX[v.type] || 'JV'; d.seq[p] = (d.seq[p] || 0) + 1;
        v.no = p + '-' + String(d.seq[p]).padStart(4, '0'); v.id = Date.now();
        d.vouchers.push(v); save(d); return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
      }
      if (req.method === 'PUT' && u.startsWith('/api/vouchers/')) { // edit a hand-made voucher (number, id and type stay the same)
        const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id);
        if (!v) return send(res, 404, { error: 'Voucher not found' });
        if (v.rcpt) return send(res, 400, { error: 'This is a customer payment. Edit it on the Payments received page.' });
        if (v.pmt) return send(res, 400, { error: 'This is a supplier payment. Edit it on the Payments made page.' });
        if (v.sal) return send(res, 400, { error: 'This is a salary payment. Edit it on the Salary payment page.' });
        if (d.bills.some(y => y.voucherId === v.id)) return send(res, 400, { error: 'This voucher was made from a bill. Edit the bill instead.' });
        const x = JSON.parse(b); if (!x.date) return send(res, 400, { error: 'Date is required' });
        const c = cleanLines(d, x.lines); if (c.error) return send(res, 400, c);
        Object.assign(v, { date: x.date, bs: x.bs, ref: x.ref, narration: x.narration, lines: c.lines }); save(d);
        return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
      }
      if (req.method === 'DELETE' && u.startsWith('/api/vouchers/')) { // removes the voucher, its bill (if any) and the Excel files of both
        const id = u.split('/').pop(), gone = d.vouchers.filter(v => String(v.id) === id), goneBills = d.bills.filter(x => String(x.voucherId) === id);
        d.vouchers = d.vouchers.filter(v => String(v.id) !== id);
        goneBills.forEach(g => { d.bills.forEach(x => { if (x.id === g.purchaseId) x.sold = null; }); d.vouchers.forEach(v => { if (v.rcpt && v.rcpt.billId === g.id) v.rcpt.billId = null; if (v.pmt && v.pmt.billId === g.id) v.pmt.billId = null; }); });
        d.bills = d.bills.filter(x => String(x.voucherId) !== id); resync(d); save(d);
        return send(res, 200, { files: [...gone.flatMap(dropVoucher), ...goneBills.flatMap(dropBill)] });
      }
      if (req.method === 'POST' && u === '/api/receipts') {
        const x = JSON.parse(b), r = receiptParts(d, x); if (r.error) return send(res, 400, r);
        const v = post(d, 'Receipt', x.date, x.bs, r.rcpt.instrument, r.narration, r.lines); v.rcpt = r.rcpt; touchParty(r.rcpt.customer, '', 'customer'); save(d);
        return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
      }
      if (req.method === 'PUT' && u.startsWith('/api/receipts/')) {
        const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id && y.rcpt); if (!v) return send(res, 404, { error: 'Payment not found' });
        const x = JSON.parse(b), r = receiptParts(d, x); if (r.error) return send(res, 400, r);
        Object.assign(v, { date: x.date, bs: x.bs, ref: r.rcpt.instrument, narration: r.narration, lines: r.lines, rcpt: r.rcpt }); touchParty(r.rcpt.customer, '', 'customer'); save(d);
        return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
      }
      if (req.method === 'GET' && (u.startsWith('/api/pstatement/') || u.startsWith('/api/xlsx/pstatement/'))) {
        const xl = u.startsWith('/api/xlsx/'), kind = u.split('/').pop(), q = new URL(req.url, 'http://x').searchParams, from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31', S = stmtData(d, kind, q.get('name') || '', from, to);
        if (!S) return send(res, 404, { error: 'No such ' + (STM_LABEL[kind] || 'account').toLowerCase() }); if (!xl) return send(res, 200, S);
        const buf = await pstatementXlsx(S).xlsx.writeBuffer(), fname = `${STM_LABEL[kind]}_${safeName(S.name)}_${from}_${to}.xlsx`; res._saved = autoStore('stm', 'Statements', fname, buf);
        res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` }); return res.end(Buffer.from(buf));
      }
      if (req.method === 'PUT' && /^\/api\/payments\/\d+\/fee$/.test(u)) { // add the Fonepay charge to an old payment (re-posts that voucher in place)
        const id = u.split('/')[3], v = d.vouchers.find(y => String(y.id) === id && y.pmt && y.pmt.mode === 'Fonepay'); if (!v) return send(res, 404, { error: 'Fonepay payment not found' });
        const p = v.pmt, r = paymentParts(d, { supplier: p.supplier, debitAccount: p.debitAccount || '', payee: p.payee, date: v.date, amount: p.amount, mode: p.mode, account: p.account, instrument: p.instrument, billId: p.billId, note: p.note, fee: JSON.parse(b).fee });
        if (r.error) return send(res, 400, r); Object.assign(v, { narration: r.narration, lines: r.lines, pmt: r.pmt }); save(d);
        return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
      }
      if (req.method === 'GET' && u === '/api/xlsx/fonepay') { ExcelJS = ExcelJS || require('exceljs'); const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Fonepay charges to update'), nmA = c => (d.accounts.find(a => a.code === c) || {}).name || c;
        ws.columns = [['Date (AD)', 12], ['Date (BS)', 12], ['Voucher', 10], ['Paid to', 30], ['Applied to', 28], ['Cheque / Transaction ID', 22], ['Paid from', 18], ['Amount paid', 14], ['Fonepay charge (fill in)', 22]].map(([header, width]) => ({ header, width }));
        d.vouchers.filter(v => (v.pmt || v.sal) && (v.pmt || v.sal).mode === 'Fonepay' && (v.pmt || v.sal).fee === undefined).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(v => { const p = v.pmt || v.sal, bill = p.billId && d.bills.find(x => x.id === p.billId);
          const row = ws.addRow([v.date, v.bs || '', v.no, v.sal ? p.staff : p.other ? p.payee : p.supplier, v.sal ? 'Salary' + (p.period ? ' for ' + p.period : '') : p.other ? 'Charged to ' + nmA(p.debitAccount) : bill ? 'Bill ' + bill.billNo : 'Oldest bills first', p.instrument || '', nmA(p.account), p.amount, null]); row.getCell(8).numFmt = '#,##0.00'; });
        ws.getRow(1).font = { bold: true }; const buf = await wb.xlsx.writeBuffer(), fname = 'Fonepay_charges_to_update.xlsx'; res._saved = autoStore('stm', 'Statements', fname, buf);
        res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` }); return res.end(Buffer.from(buf)); }
      if (req.method === 'POST' && u === '/api/payments') {
        const x = JSON.parse(b), r = paymentParts(d, x); if (r.error) return send(res, 400, r);
        const v = post(d, 'Payment', x.date, x.bs, r.pmt.instrument, r.narration, r.lines); v.pmt = r.pmt; touchParty(r.pmt.supplier, '', 'supplier'); save(d);
        return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
      }
      if (req.method === 'PUT' && u.startsWith('/api/payments/')) {
        const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id && y.pmt); if (!v) return send(res, 404, { error: 'Payment not found' });
        const x = JSON.parse(b), r = paymentParts(d, x); if (r.error) return send(res, 400, r);
        Object.assign(v, { date: x.date, bs: x.bs, ref: r.pmt.instrument, narration: r.narration, lines: r.lines, pmt: r.pmt }); touchParty(r.pmt.supplier, '', 'supplier'); save(d);
        return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
      }
      if (req.method === 'GET' && u === '/api/migrate') return send(res, 200, { salaries: migratable(d).map(v => ({ no: v.no, date: v.date, payee: v.pmt.payee, amount: v.pmt.amount })), files: pvToPmv(d).length });
      if (req.method === 'POST' && u === '/api/migrate') { const stamp = new Date().toISOString().replace(/[:.]/g, '-'); [DB, DBF].forEach(f => { if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak-' + stamp); });
        const mv = pvToPmv(d); mv.forEach(([a, b]) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.renameSync(a, b); }); const done = migrateSalaries(d); save(d); return send(res, 200, { converted: done.length, moved: mv.length, backup: stamp }); }
      if (u.startsWith('/api/banks')) { const db = loadDb(), code = decodeURIComponent(u.split('/')[3] || ''), me = db.banks.find(x => x.ledger === code);
        if (req.method === 'DELETE') { if (!me) return send(res, 404, { error: 'Bank account not found' });
          const used = d.vouchers.some(v => v.lines.some(l => l.account === code)); db.banks = db.banks.filter(x => x !== me); saveDb(db);
          if (!me.linked && !used) { d.accounts = d.accounts.filter(a => a.code !== code); save(d); } return send(res, 200, { kept: !!(me.linked || used) }); } // a ledger account that has entries (or that existed before) is kept
        if (req.method === 'POST' || req.method === 'PUT') { const x = JSON.parse(b), bank = String(x.bank || '').trim(), account = String(x.account || '').trim(), fmt = String(x.chequeFormat || '').trim();
          if (req.method === 'PUT' && !me) return send(res, 404, { error: 'Bank account not found' });
          if (!bank) return send(res, 400, { error: 'Enter the bank name' }); if (fmt && fmtBad(fmt)) return send(res, 400, { error: fmtBad(fmt) });
          const name = bank + (account ? ' - ' + account : ''), others = db.banks.filter(y => y !== me), chq = [...new Set(fmtParts(fmt).map(p => p.s))].join(', ');
          if (others.some(y => nkey(y.name) === nkey(name))) return send(res, 400, { error: 'That bank account is already in the list' });
          const clash = others.find(y => fmtParts(chq).some(a => fmtParts(y.chequeFormat).some(z => fmtBoth(a, z)))); if (clash) return send(res, 400, { error: `That cheque format overlaps with ${clash.name} (${clash.chequeFormat}), so a cheque number could not be matched to one bank.` });
          if (me) { const acct = d.accounts.find(a => a.code === code), nn = bankAcctName(name);
            if (!me.linked && acct && acct.name !== nn) { if (d.accounts.some(a => a !== acct && nkey(a.name) === nkey(nn))) return send(res, 400, { error: 'An account called "' + nn + '" already exists' });
              d.vouchers.forEach(v => v.lines.forEach(l => { if (l.account === code && l.desc === acct.name) l.desc = nn; })); acct.name = nn; } // keep old vouchers' wording in step
            Object.assign(me, { name, bank, account, chequeFormat: chq }); save(d); saveDb(db); return send(res, 200, me); }
          let acct; if (x.ledger) { acct = d.accounts.find(a => a.code === String(x.ledger) && a.type === 'A');
            if (!acct || !(/cash|bank|fonepay|wallet/i.test(acct.name) || acct.group === 'Bank Accounts')) return send(res, 400, { error: 'Choose an existing bank account from the list' }); if (db.banks.some(y => y.ledger === acct.code)) return send(res, 400, { error: 'That ledger account is already used by another bank account' }); }
          else { const nn = bankAcctName(name); if (d.accounts.some(a => nkey(a.name) === nkey(nn))) return send(res, 400, { error: 'An account called "' + nn + '" already exists. Pick it under "Ledger account" instead of creating a new one.' });
            acct = { code: nextBankCode(d), name: nn, type: 'A', group: 'Bank Accounts' }; d.accounts.push(acct); }
          const rec = { name, bank, account, chequeFormat: chq, ledger: acct.code, linked: !!x.ledger }; db.banks.push(rec); save(d); saveDb(db); return send(res, 200, rec); } }
      if (u === '/api/bank-match') { if (req.method === 'GET') return send(res, 200, bankMatch(d));
        if (req.method === 'POST') { const m = bankMatch(d), stamp = new Date().toISOString().replace(/[:.]/g, '-'); if (!m.change.length) return send(res, 200, { moved: 0, files: 0, backup: null });
          fs.copyFileSync(DB, DB + '.bak-' + stamp); const done = [];
          m.change.forEach(r => { const v = d.vouchers.find(y => y.id === r.id), p = v && (v.pmt || v.sal); if (!p) return; let hit = false;
            v.lines.forEach(l => { if (l.account === p.account && l.cr > 0) { l.account = r.toCode; l.desc = r.to; hit = true; } }); if (hit) { p.account = r.toCode; done.push(v); } }); // only the "paid from" side of the voucher moves; amounts and dates stay
          save(d); let files = 0; for (const v of done) if (await refresh(vFile(v), async () => jvXlsx(v, d).xlsx.writeBuffer(), true)) files++; // refresh voucher Excel files that already exist
          return send(res, 200, { moved: done.length, skipped: m.change.length - done.length, files, backup: stamp }); } }
      if (req.method === 'POST' && u === '/api/rebuild-files') { const r = await rebuildFiles(d, !!JSON.parse(b || '{}').missing); return send(res, r.error ? 400 : 200, r); }
      if (u === '/api/bank-split') { if (req.method === 'GET') return send(res, 200, splitScan(d));
        if (req.method === 'POST') { const items = JSON.parse(b).items; if (!Array.isArray(items) || !items.length) return send(res, 400, { error: 'Nothing to split' });
          const pl = splitPlan(d, items); if (pl.error) return send(res, 400, pl); const stamp = new Date().toISOString().replace(/[:.]/g, '-'); fs.copyFileSync(DB, DB + '.bak-' + stamp);
          const done = splitApply(d, pl.plan); save(d); let files = 0; for (const v of done) if (await refresh(vFile(v), async () => jvXlsx(v, d).xlsx.writeBuffer(), true)) files++; // refresh voucher Excel files that already exist
          return send(res, 200, { split: done.length, files, backup: stamp }); } }
      if (req.method === 'POST' && u === '/api/salaries') {
        const x = JSON.parse(b), r = salaryParts(d, x); if (r.error) return send(res, 400, r);
        const v = post(d, 'Payment', x.date, x.bs, r.sal.instrument, r.narration, r.lines); v.sal = r.sal; upsert('staff', { name: r.sal.staff }); save(d);
        return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d) });
      }
      if (req.method === 'PUT' && /^\/api\/salaries\/\d+\/fee$/.test(u)) { // add the Fonepay charge to an old salary payment
        const id = u.split('/')[3], v = d.vouchers.find(y => String(y.id) === id && y.sal && y.sal.mode === 'Fonepay'); if (!v) return send(res, 404, { error: 'Fonepay salary payment not found' });
        const p = v.sal, r = salaryParts(d, { staff: p.staff, period: p.period, date: v.date, amount: p.amount, mode: p.mode, account: p.account, instrument: p.instrument, note: p.note, debitAccount: p.debitAccount, fee: JSON.parse(b).fee });
        if (r.error) return send(res, 400, r); Object.assign(v, { narration: r.narration, lines: r.lines, sal: r.sal }); save(d);
        return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
      }
      if (req.method === 'PUT' && u.startsWith('/api/salaries/')) {
        const id = u.split('/').pop(), v = d.vouchers.find(y => String(y.id) === id && y.sal); if (!v) return send(res, 404, { error: 'Salary payment not found' });
        const x = JSON.parse(b), r = salaryParts(d, x); if (r.error) return send(res, 400, r);
        Object.assign(v, { date: x.date, bs: x.bs, ref: r.sal.instrument, narration: r.narration, lines: r.lines, sal: r.sal }); upsert('staff', { name: r.sal.staff }); save(d);
        return send(res, 200, { ...v, saved: await resaveVoucher(v, d) });
      }
      if (req.method === 'POST' && u === '/api/accounts') {
        const a = JSON.parse(b);
        if (!a.code || !a.name || !'ALEIX'.includes(a.type)) return send(res, 400, { error: 'Code, name and type required' });
        if (d.accounts.some(x => x.code === a.code)) return send(res, 400, { error: 'Code already exists' });
        d.accounts.push({ code: a.code, name: a.name, type: a.type, group: a.group || a.name }); save(d); return send(res, 200, {});
      }
      if (req.method === 'POST' && u === '/api/purchase') {
        const p = JSON.parse(b), bad = purchaseBad(p); if (bad) return send(res, 400, { error: bad });
        const x = purchaseParts(d, p), v = post(d, 'Journal', p.date, p.bs, p.billNo, x.narration, x.lines);
        v.purchase = true; v.heading = x.heading; v.notes = x.notes;
        const pbl = { id: v.id, kind: 'purchase', voucherId: v.id, voucher: v.no, ...purchaseFields(p, x), sold: null }; d.bills.push(pbl);
        touchParty(p.supplier, p.supplierPan, 'supplier'); touchParty(p.customer, '', 'customer'); save(d); return send(res, 200, { ...v, saved: await autoSaveVoucher(v, d), savedBill: await autoSaveBill(pbl) });
      }
      if (req.method === 'PUT' && u.startsWith('/api/purchase/')) { // edit a purchase bill: its journal voucher is rebuilt in place (same voucher no.)
        const id = u.split('/').pop(), bill = d.bills.find(y => String(y.id) === id && y.kind === 'purchase'), v = bill && d.vouchers.find(y => y.id === bill.voucherId);
        if (!bill || !v) return send(res, 404, { error: 'Purchase bill not found' });
        const p = JSON.parse(b), bad = purchaseBad(p); if (bad) return send(res, 400, { error: bad });
        if (nkey(p.supplier) !== nkey(bill.supplier) && d.vouchers.some(y => y.pmt && y.pmt.billId === bill.id)) return send(res, 400, { error: 'Payments are recorded against this bill. Edit or delete those payments before changing the supplier.' });
        const old = { ...bill }, x = purchaseParts(d, p);
        Object.assign(v, { date: p.date, bs: p.bs, ref: p.billNo, narration: x.narration, lines: x.lines, heading: x.heading, notes: x.notes });
        Object.assign(bill, purchaseFields(p, x)); touchParty(p.supplier, p.supplierPan, 'supplier'); touchParty(p.customer, '', 'customer');
        save(d); if (old.billNo !== bill.billNo) dropBill(old);
        for (const sb of d.bills.filter(y => y.kind === 'sales' && y.purchaseId === bill.id)) await resaveBill(sb); // the sales invoice quotes the purchase supplier/category
        return send(res, 200, { ...v, saved: await resaveVoucher(v, d), savedBill: await resaveBill(bill) });
      }
      if (req.method === 'POST' && u === '/api/sales') {
        const s = JSON.parse(b), bad = salesBad(s); if (bad) return send(res, 400, { error: bad });
        const billNo = s.billNo || String(d.seq.SB = (d.seq.SB || 0) + 1).padStart(3, '0'), x = salesParts(d, s, billNo);
        const v = post(d, 'Sales', s.date, s.bs, billNo, x.narration, x.lines); v.notes = x.notes;
        const bill = { id: v.id, kind: 'sales', category: x.cat, voucherId: v.id, voucher: v.no, billNo, customer: s.customer, customerVat: s.customerVat, date: s.date, bs: s.bs, passenger: s.passenger, particulars: s.particulars, nonTax: x.nonTax, taxable: x.taxable, vat: x.vat, total: x.total, purchaseId: s.purchaseId };
        d.bills.push(bill); const pb = d.bills.find(y => y.id === s.purchaseId); if (pb) pb.sold = billNo; touchParty(s.customer, s.customerVat, 'customer'); save(d); return send(res, 200, { ...bill, saved: await autoSaveInvoice(bill) });
      }
      if (req.method === 'PUT' && u.startsWith('/api/sales/')) { // edit a sales bill: its sales voucher is rebuilt in place (same voucher no.)
        const id = u.split('/').pop(), bill = d.bills.find(y => String(y.id) === id && y.kind === 'sales'), v = bill && d.vouchers.find(y => y.id === bill.voucherId);
        if (!bill || !v) return send(res, 404, { error: 'Sales bill not found' });
        const s = JSON.parse(b), bad = salesBad(s); if (bad) return send(res, 400, { error: bad });
        const billNo = String(s.billNo || bill.billNo).trim();
        if (nkey(s.customer) !== nkey(bill.customer) && d.vouchers.some(y => y.rcpt && y.rcpt.billId === bill.id)) return send(res, 400, { error: 'Payments are recorded against this bill. Edit or delete those payments before changing the customer.' });
        const old = { ...bill }, x = salesParts(d, s, billNo);
        Object.assign(v, { date: s.date, bs: s.bs, ref: billNo, narration: x.narration, lines: x.lines, notes: x.notes });
        Object.assign(bill, { category: x.cat, billNo, customer: s.customer, customerVat: s.customerVat, date: s.date, bs: s.bs, passenger: s.passenger, particulars: s.particulars, nonTax: x.nonTax, taxable: x.taxable, vat: x.vat, total: x.total });
        const pb = d.bills.find(y => y.id === bill.purchaseId); if (pb) pb.sold = billNo;
        touchParty(s.customer, s.customerVat, 'customer'); resync(d); save(d); if (old.billNo !== billNo) dropBill(old);
        return send(res, 200, { ...bill, saved: await resaveBill(bill), voucherSaved: await resaveVoucher(v, d) });
      }
      if (req.method === 'DELETE' && u.startsWith('/api/accounts/')) { const c = u.split('/').pop();
        if (d.vouchers.some(v => v.lines.some(l => l.account === c))) return send(res, 400, { error: 'This account has entries. Delete those vouchers first.' });
        d.accounts = d.accounts.filter(a => a.code !== c); save(d); return send(res, 200, {}); }
      if (u.startsWith('/api/categories')) { const s = loadSet();
        if (req.method === 'POST') { const raw = String(JSON.parse(b).name || '').trim(); if (!raw) return send(res, 400, { error: 'Enter a category name' }); const n = catName(raw);
          if (!s.categories.some(c => c.toLowerCase() === n.toLowerCase())) s.categories.push(n); }
        else if (req.method === 'DELETE') { const n = decodeURIComponent(u.split('/').pop()).toLowerCase(); s.categories = s.categories.filter(c => c.toLowerCase() !== n); }
        s.hotelCats = true; saveSet(s); return send(res, 200, s.categories); }
      if (req.method === 'POST' && u === '/api/settings') {
        const x = JSON.parse(b), s = loadSet(); let folder = (x.folder || '').trim();
        if (folder) { folder = path.resolve(folder.replace(/^~(?=$|\/)/, os.homedir()));
          try { FOLDERS.forEach(f => fs.mkdirSync(path.join(folder, f), { recursive: true })); fs.accessSync(folder, fs.constants.W_OK); } catch (e) { return send(res, 400, { error: 'Cannot use that folder: ' + e.message }); }
          const st = ownerState(folder); if (!st.ok && !x.takeOver) return send(res, 409, { error: 'That storage folder is already used by another copy of the app (' + st.owner + '). Saving files there from this copy could overwrite that copy\'s files. Choose a different folder.' }); }
        s.folder = folder; s.auto = Object.fromEntries(['jv', 'pv', 'pmv', 'stm', 'sv', 'rv', 'registers', 'tb', 'pl', 'bs'].map(k => [k, !!(x.auto && x.auto[k])])); s.company = { ...s.company, ...x.company };
        fs.writeFileSync(SETF, JSON.stringify(s, null, 1)); if (folder) claimFolder(folder); return send(res, 200, s);
      }
      const dm = u.match(/^\/api\/db\/(\w+)(?:\/(.+))?$/);
      if (dm && SCHEMA[dm[1]]) {
        if (req.method === 'POST') { const e = upsert(dm[1], JSON.parse(b)); return e ? send(res, 200, e) : send(res, 400, { error: SCHEMA[dm[1]].key + ' is required' }); }
        if (req.method === 'DELETE' && dm[2]) { const db = loadDb(), k = decodeURIComponent(dm[2]).toLowerCase(), key = SCHEMA[dm[1]].key; db[dm[1]] = db[dm[1]].filter(r => String(r[key]).toLowerCase() !== k); saveDb(db); return send(res, 200, {}); }
      }
      if (req.method === 'GET' && u.startsWith('/api/xlsx/statement/')) {
        const kind = u.split('/').pop(), q = new URL(req.url, 'http://x').searchParams, from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31';
        const meta = { tb: 'TrialBalance', pl: 'IncomeStatement', bs: 'BalanceSheet' }[kind]; if (!meta) return send(res, 404, { error: 'Unknown statement' });
        const buf = await statementXlsx(kind, d, from, to).xlsx.writeBuffer(), fname = `${meta}_${from}_${to}.xlsx`; res._saved = autoStore(kind, meta, fname, buf);
        res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` }); return res.end(Buffer.from(buf));
      }
      if (req.method === 'GET' && u.startsWith('/api/xlsx/register/')) {
        const kind = u.split('/').pop(), q = new URL(req.url, 'http://x').searchParams, from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31';
        if (!['purchase', 'sales'].includes(kind)) return send(res, 404, { error: 'Unknown register' });
        const rows = d.bills.filter(x => x.kind === kind && x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date) || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true }));
        const buf = await (await registerXlsx(kind, rows, from, to, d)).xlsx.writeBuffer(); res._saved = autoStore('registers', 'Registers', `${kind === 'purchase' ? 'Purchase' : 'Sales'}_Register_${from}_${to}.xlsx`, buf);
        res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${kind === 'purchase' ? 'Purchase' : 'Sales'}_Register_${from}_${to}.xlsx"` }); return res.end(Buffer.from(buf));
      }
      if (req.method === 'GET' && u.startsWith('/api/xlsx/')) {
        const [, , , kind, id] = u.split('/'); let wb, name, key, sub;
        if (kind === 'bill') { const x = d.bills.find(y => String(y.id) === id); if (!x) return send(res, 404, { error: 'Not found' }); if (x.kind === 'purchase') { wb = purchaseBillXlsx(x); name = 'PurchaseBill_' + x.billNo; key = 'pv'; sub = 'PV'; } else { wb = invoiceXlsx(x); name = 'Invoice_' + x.billNo; key = 'sv'; sub = 'SV'; } }
        else { const v = d.vouchers.find(y => String(y.id) === id); if (!v) return send(res, 404, { error: 'Not found' }); wb = jvXlsx(v, d); name = v.no; [key, sub] = vkey(v) || ['jv', 'JV']; }
        const buf = await wb.xlsx.writeBuffer(); res._saved = autoStore(key, sub, name.replace(/[^\w.-]/g, '_') + '.xlsx', buf);
        res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]/g, '_')}.xlsx"` }); return res.end(Buffer.from(buf));
      }
      send(res, 404, { error: 'Not found' });
    } catch (e) { send(res, 500, { error: e.message }); }
  });
}).listen(3000, () => console.log('Accounts app running at http://localhost:3000'));
