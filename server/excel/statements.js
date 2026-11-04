// server/excel/statements.js — trial balance / income statement / balance sheet and party statements
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { nkey, rd } = require('../accounts');
const { frame, fx, getExcelJS, put } = require('./workbook');
const { payables } = require('../posting/payables');
const { receivables } = require('../posting/receivables');
const { COMPANY } = require('../settings');
const { loadDb } = require('../store');

// ---- Financial statements to Excel (tb = Trial Balance, pl = Income Statement, bs = Balance Sheet) ----
const bal = (d, a, from, to) => { const bs = 'ALE'.includes(a.type); let s = 0; for (const v of d.vouchers) if (v.date <= to && (bs || v.date >= from)) for (const l of v.lines) if (l.account === a.code) s += l.dr - l.cr; return rd(s); };

const priorPL = (d, from) => rd(d.vouchers.filter(v => v.date < from).reduce((t, v) => t + v.lines.reduce((u, l) => { const a = d.accounts.find(x => x.code === l.account); return a && 'IX'.includes(a.type) ? u + l.dr - l.cr : u; }, 0), 0));

function sec(s, st, title, list, sign, extra = []) {
  put(s, 'A' + st.r, title, { b: 1 }); st.r++; const first = st.r; let tot = 0;
  [...new Set(list.map(a => a.group))].forEach(g => {
    const rows = list.filter(a => a.group === g).map(a => ({ c: a.code, n: a.name, v: sign * bal(st.d, a, st.from, st.to) })).filter(x => x.v); if (!rows.length) return;
    put(s, 'B' + st.r, g, { b: 1 }); st.r++; rows.forEach(x => { put(s, 'A' + st.r, x.c); put(s, 'B' + st.r, x.n); put(s, 'D' + st.r, x.v, { n: 1 }); tot += x.v; st.r++; });
  });
  extra.forEach(x => { put(s, 'B' + st.r, x.n); put(s, 'D' + st.r, x.v, { n: 1 }); tot += x.v; st.r++; });
  const t = st.r; put(s, 'B' + t, 'Total ' + title, { b: 1 }); fx(s, 'E' + t, `SUM(D${first}:D${t - 1})`, tot, 1); st.r += 2; return { cell: 'E' + t, v: rd(tot) };
}

function statementXlsx(kind, d, from, to) {
  const { wb, s } = frame({ tb: 'Trial Balance', pl: 'Income Statement', bs: 'Balance Sheet' }[kind]); put(s, 'A5', `Period: ${from} to ${to} (AD)`);
  const st = { r: 7, d, from, to }, ofT = t => d.accounts.filter(a => t.includes(a.type));
  if (kind === 'tb') {
    ['Code', 'Account', '', 'Debit', 'Credit'].forEach((h, i) => put(s, 'ABCDE'[i] + '6', h, { b: 1 }));
    const rows = ofT('ALEIX').map(a => ({ c: a.code, n: a.name, v: bal(d, a, from, to) })), p = priorPL(d, from); if (p) rows.push({ c: '', n: "Prior years' profit/(loss) carried forward", v: p });
    const live = rows.filter(x => x.v); let dr = 0, cr = 0;
    live.forEach((x, i) => { const r = 7 + i; put(s, 'A' + r, x.c); put(s, 'B' + r, x.n); put(s, (x.v > 0 ? 'D' : 'E') + r, Math.abs(x.v), { n: 1 }); if (x.v > 0) dr += x.v; else cr -= x.v; });
    const t = 7 + live.length; put(s, 'B' + t, 'Total', { b: 1 }); fx(s, 'D' + t, `SUM(D7:D${t - 1})`, dr, 1); fx(s, 'E' + t, `SUM(E7:E${t - 1})`, cr, 1); put(s, 'B' + (t + 1), 'Difference (should be 0)'); fx(s, 'D' + (t + 1), `D${t}-E${t}`, dr - cr);
  } else if (kind === 'pl') {
    const inc = sec(s, st, 'Income', ofT('I'), -1), dc = sec(s, st, 'Direct Costs', ofT('X').filter(a => a.group === 'Direct Costs'), 1);
    const g = st.r; put(s, 'B' + g, 'Gross Profit', { b: 1 }); fx(s, 'E' + g, `${inc.cell}-${dc.cell}`, inc.v - dc.v, 1); st.r += 2;
    const op = sec(s, st, 'Operating Expenses', ofT('X').filter(a => a.group !== 'Direct Costs'), 1), n = st.r; put(s, 'B' + n, 'Net Profit / (Loss)', { b: 1 }); fx(s, 'E' + n, `E${g}-${op.cell}`, inc.v - dc.v - op.v, 1);
  } else {
    const A = sec(s, st, 'Assets', ofT('A'), 1), L = sec(s, st, 'Liabilities', ofT('L'), -1), cur = -ofT('IX').reduce((t, a) => t + bal(d, a, from, to), 0);
    const E = sec(s, st, 'Equity', ofT('E'), -1, [{ n: "Prior years' profit/(loss)", v: -priorPL(d, from) }, { n: 'Current period profit/(loss)', v: rd(cur) }]), t = st.r;
    put(s, 'B' + t, 'Total Liabilities + Equity', { b: 1 }); fx(s, 'E' + t, `${L.cell}+${E.cell}`, L.v + E.v, 1); put(s, 'B' + (t + 1), 'Difference vs Assets (should be 0)'); fx(s, 'E' + (t + 1), `${A.cell}-E${t}`, A.v - L.v - E.v);
  }
  return wb;
}

// ---- Statements of account for a supplier, customer, staff member or expense account (JSON for the page, Excel for the Statements folder) ----
function stmtData(d, kind, name, from, to) {
  const nk = nkey(name), byDate = (a, b) => a.date.localeCompare(b.date) || a.id - b.id; let cols, sub = '', entries = [];
  if (kind === 'customer' || kind === 'supplier') {
    const C = kind === 'customer', r = (C ? receivables(d) : payables(d)).find(x => nkey(x.name) === nk); if (!r) return null; name = r.name; sub = r.pan ? 'PAN/VAT ' + r.pan : '';
    cols = C ? { a: 'Billed (Dr)', b: 'Received (Cr)', bal: 'Balance (they owe us)' } : { a: 'Billed (Cr)', b: 'Paid (Dr)', bal: 'Balance (we owe)' };
    entries = r.statement.map(e => ({ date: e.date, bs: e.bs || '', no: e.no, ref: e.ref || '', text: e.narration || '', a: C ? e.dr : e.cr, b: C ? e.cr : e.dr, bal: e.bal }));
  }
  else if (kind === 'staff') {
    const st = loadDb().staff.find(x => nkey(x.name) === nk), vs = d.vouchers.filter(v => v.sal && nkey(v.sal.staff) === nk).sort(byDate); if (!st && !vs.length) return null; name = st ? st.name : vs[0].sal.staff; sub = st && st.designation || ''; cols = { a: 'Salary paid', b: 'Fonepay charge', bal: 'Total paid to date' }; let run = 0;
    vs.forEach(v => { run = rd(run + v.sal.amount); entries.push({ date: v.date, bs: v.bs || '', no: v.no, ref: v.sal.instrument || '', text: [v.sal.period ? 'Salary for ' + v.sal.period : 'Salary', v.sal.mode, v.sal.note].filter(Boolean).join(' · '), a: v.sal.amount, b: v.sal.fee || 0, bal: run }); });
  }
  else if (kind === 'expense') {
    const a = d.accounts.find(x => x.type === 'X' && nkey(x.name) === nk); if (!a) return null; name = a.name; sub = a.group; cols = { a: 'Debit', b: 'Credit', bal: 'Balance' }; let run = 0;
    d.vouchers.slice().sort(byDate).forEach(v => v.lines.filter(l => l.account === a.code).forEach(l => { run = rd(run + l.dr - l.cr); entries.push({ date: v.date, bs: v.bs || '', no: v.no, ref: v.ref || '', text: v.narration || l.desc || '', a: l.dr, b: l.cr, bal: run }); }));
  }
  else return null;
  const before = entries.filter(e => e.date < from), rows = entries.filter(e => e.date >= from && e.date <= to), opening = before.length ? before[before.length - 1].bal : 0;
  return { kind, name, sub, from, to, cols, opening, rows, closing: rows.length ? rows[rows.length - 1].bal : opening, a: rd(rows.reduce((t, e) => t + e.a, 0)), b: rd(rows.reduce((t, e) => t + e.b, 0)) };
}

const STM_LABEL = { customer: 'Customer', supplier: 'Supplier', staff: 'Staff', expense: 'Expense' };

function pstatementXlsx(S) {
  const ExcelJS = getExcelJS(); const wb = new ExcelJS.Workbook(), s = wb.addWorksheet('Statement'), co = COMPANY, thin = { style: 'thin' }, bd = { top: thin, bottom: thin, left: thin, right: thin };
  s.columns = [12, 12, 11, 46, 16, 16, 20].map(width => ({ width }));
  const m = (r, t, o = {}) => { s.mergeCells(`A${r}:G${r}`); const c = s.getCell('A' + r); c.value = t; c.alignment = { horizontal: 'center', wrapText: true }; c.font = { bold: !!o.b, size: o.size || 10 }; };
  m(1, co.name, { b: 1, size: 16 }); m(2, `${co.addr} | Tel: ${co.tel} | ${co.email}`); m(3, 'VAT No.: ' + (co.vat || '________')); m(4, 'STATEMENT OF ACCOUNT', { b: 1, size: 13 });
  m(5, `${STM_LABEL[S.kind]}: ${S.name}${S.sub ? '  (' + S.sub + ')' : ''}`, { b: 1 }); m(6, `Period: ${S.from} to ${S.to}`);
  const H = 8;['Date (AD)', 'Date (BS)', 'Voucher', 'Particulars', S.cols.a, S.cols.b, S.cols.bal].forEach((t, i) => { const c = s.getRow(H).getCell(i + 1); c.value = t; c.font = { bold: true }; c.alignment = { horizontal: i > 3 ? 'right' : 'left', wrapText: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6E3' } }; });
  let r = H + 1; const add = (vals, bold) => { const row = s.getRow(r++); vals.forEach((v, i) => { const c = row.getCell(i + 1); c.value = v === '' ? null : v; if (i > 3) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'right' }; } else c.alignment = { wrapText: true, vertical: 'top' }; if (bold) c.font = { bold: true }; }); };
  add(['', '', '', 'Opening balance', '', '', S.opening], 1);
  S.rows.forEach(e => add([e.date, e.bs, e.no, e.text + (e.ref ? '  [' + e.ref + ']' : ''), e.a || '', e.b || '', e.bal]));
  add(['', '', '', 'Total for the period', S.a, S.b, ''], 1); add(['', '', '', 'Closing balance', '', '', S.closing], 1);
  for (let i = H; i < r; i++) for (let c = 1; c <= 7; c++) s.getRow(i).getCell(c).border = bd; s.views = [{ state: 'frozen', ySplit: H }]; return wb;
}

module.exports = { STM_LABEL, pstatementXlsx, statementXlsx, stmtData };
