// server/routes/xlsx.js — /api/xlsx/{voucher,bill,statement,register,fonepay}/...
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { invoiceXlsx, purchaseBillXlsx } = require('../excel/invoice');
const { registerXlsx, reviewXlsx } = require('../excel/registers');
const { statementXlsx } = require('../excel/statements');
const { jvXlsx } = require('../excel/voucher');
const { getExcelJS } = require('../excel/workbook');
const { autoStore, vkey } = require('../files');
const { send } = require('../http');
const { paymentPurchases } = require('../posting/purchasebook');
const { registerReview } = require('../posting/review');
const { refundRows } = require('../posting/refunds');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'GET' && u === '/api/xlsx/fonepay') {
    const ExcelJS = getExcelJS(); const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Fonepay charges to update'), nmA = c => (d.accounts.find(a => a.code === c) || {}).name || c;
    ws.columns = [['Date (AD)', 12], ['Date (BS)', 12], ['Voucher', 10], ['Paid to', 30], ['Applied to', 28], ['Cheque / Transaction ID', 22], ['Paid from', 18], ['Amount paid', 14], ['Fonepay charge (fill in)', 22]].map(([header, width]) => ({ header, width }));
    d.vouchers.filter(v => (v.pmt || v.sal) && (v.pmt || v.sal).mode === 'Fonepay' && (v.pmt || v.sal).fee === undefined).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(v => {
      const p = v.pmt || v.sal, bill = p.billId && d.bills.find(x => x.id === p.billId);
      const row = ws.addRow([v.date, v.bs || '', v.no, v.sal ? p.staff : p.other ? p.payee : p.supplier, v.sal ? 'Salary' + (p.period ? ' for ' + p.period : '') : p.other ? 'Charged to ' + nmA(p.debitAccount) : bill ? 'Bill ' + bill.billNo : 'Oldest bills first', p.instrument || '', nmA(p.account), p.amount, null]); row.getCell(8).numFmt = '#,##0.00';
    });
    ws.getRow(1).font = { bold: true }; const buf = await wb.xlsx.writeBuffer(), fname = 'Fonepay_charges_to_update.xlsx'; res._saved = autoStore('stm', 'Statements', fname, buf);
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` }); return res.end(Buffer.from(buf));
  }
  if (req.method === 'GET' && u.startsWith('/api/xlsx/statement/')) {
    const kind = u.split('/').pop(), q = new URL(req.url, 'http://x').searchParams, from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31';
    const meta = { tb: 'TrialBalance', pl: 'IncomeStatement', bs: 'BalanceSheet' }[kind]; if (!meta) return send(res, 404, { error: 'Unknown statement' });
    const buf = await statementXlsx(kind, d, from, to).xlsx.writeBuffer(), fname = `${meta}_${from}_${to}.xlsx`; res._saved = autoStore(kind, meta, fname, buf);
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` }); return res.end(Buffer.from(buf));
  }
  if (req.method === 'GET' && (u === '/api/xlsx/review' || u === '/api/xlsx/leftout')) {
    const lo = u.endsWith('leftout'), q = new URL(req.url, 'http://x').searchParams, from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31', fname = `${lo ? 'Payments_Left_Out' : 'Purchase_Review'}_${from}_${to}.xlsx`;
    const buf = await reviewXlsx(registerReview(d), from, to, lo ? 'leftout' : 'review').xlsx.writeBuffer(); res._saved = autoStore('registers', 'Registers', fname, buf);
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` }); return res.end(Buffer.from(buf));
  }
  if (req.method === 'GET' && u.startsWith('/api/xlsx/register/')) {
    const kind = u.split('/').pop(), q = new URL(req.url, 'http://x').searchParams, from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31';
    if (!['purchase', 'sales'].includes(kind)) return send(res, 404, { error: 'Unknown register' });
    const rows = [...d.bills, ...paymentPurchases(d), ...refundRows(d)].filter(x => x.kind === kind && x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date) || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true }));
    const buf = await (await registerXlsx(kind, rows, from, to, d)).xlsx.writeBuffer(); res._saved = autoStore('registers', 'Registers', `${kind === 'purchase' ? 'Purchase' : 'Sales'}_Register_${from}_${to}.xlsx`, buf);
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${kind === 'purchase' ? 'Purchase' : 'Sales'}_Register_${from}_${to}.xlsx"` }); return res.end(Buffer.from(buf));
  }
  if (req.method === 'GET' && u.startsWith('/api/xlsx/')) {
    const [, , , kind, id] = u.split('/'); let wb, name, key, sub;
    if (kind === 'bill') { const x = d.bills.find(y => String(y.id) === id); if (!x) return send(res, 404, { error: 'Not found' }); if (x.kind === 'purchase') { wb = purchaseBillXlsx(x); name = 'PurchaseBill_' + x.billNo; key = 'pv'; sub = 'PV'; } else { wb = invoiceXlsx(x); name = 'Invoice_' + x.billNo; key = 'sv'; sub = 'SV'; } }
    else { const v = d.vouchers.find(y => String(y.id) === id); if (!v) return send(res, 404, { error: 'Not found' }); wb = jvXlsx(v, d); name = v.no;[key, sub] = vkey(v) || ['jv', 'JV']; }
    const buf = await wb.xlsx.writeBuffer(); res._saved = autoStore(key, sub, name.replace(/[^\w.-]/g, '_') + '.xlsx', buf);
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]/g, '_')}.xlsx"` }); return res.end(Buffer.from(buf));
  }
}

module.exports = { handle };
