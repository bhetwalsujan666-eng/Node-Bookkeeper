// server/excel/voucher.js — journal voucher workbook
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { rd } = require('../accounts');
const { box, frame, fx, put, words } = require('./workbook');

function jvXlsx(v, d) {
  const { wb, s } = frame(v.type === 'Receipt' ? 'Receipt Voucher' : v.type === 'Payment' ? 'Payment Voucher' : 'Journal Voucher'); put(s, 'A6', 'Voucher No.: ' + v.no, { b: 1 }); put(s, 'D6', 'Date: ' + v.date + (v.bs ? ' (' + v.bs + ' BS)' : ''), { b: 1 });
  ['S.N.', 'Description', 'L.F. No.', 'Debit', 'Credit'].forEach((h, i) => put(s, 'ABCDE'[i] + '8', h, { b: 1 }));
  const nm = c => (d.accounts.find(a => a.code === c) || {}).name || c; let r = 9, n = 0;
  if (v.heading) { put(s, 'B' + r, v.heading, { b: 1 }); r++; }
  v.lines.forEach(l => { put(s, 'A' + r, ++n); put(s, 'B' + r, (l.cr ? '      ' : '') + (l.desc || nm(l.account))); if (l.dr) put(s, 'D' + r, l.dr, { n: 1 }); if (l.cr) put(s, 'E' + r, l.cr, { n: 1 }); r++; });
  (v.notes || []).forEach(x => { put(s, 'B' + r, '      ' + x); r++; });
  const t = r, sum = k => rd(v.lines.reduce((a, l) => a + l[k], 0)); put(s, 'B' + t, 'Total', { b: 1 }); fx(s, 'D' + t, `SUM(D9:D${t - 1})`, sum('dr'), 1); fx(s, 'E' + t, `SUM(E9:E${t - 1})`, sum('cr'), 1); box(s, 8, t);
  s.mergeCells(`A${t + 1}:E${t + 1}`); put(s, 'A' + (t + 1), 'Rs. in words: ' + words(sum('dr'))); s.mergeCells(`A${t + 2}:E${t + 2}`); put(s, 'A' + (t + 2), 'Details: ' + (v.narration || '') + (v.ref ? ' (Ref ' + v.ref + ')' : ''), { w: 1 });
  put(s, 'A' + (t + 5), 'Prepared by', { b: 1 }); put(s, 'C' + (t + 5), 'Checked by', { b: 1 }); put(s, 'E' + (t + 5), 'Approved by', { b: 1 }); return wb;
}

module.exports = { jvXlsx };
