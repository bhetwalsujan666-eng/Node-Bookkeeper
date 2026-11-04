// pages/dashboard.js — Dashboard
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { barChart, donut, hbars } from '../lib/charts.js';
import { K, f0, rd } from '../lib/format.js';
import { D, FR, TO, acc, cashAccs, cum, net, ofType, per } from '../lib/state.js';

export const dash = () => {
  const sales = D.bills.filter(b => b.kind == 'sales' && per(b.date)), purch = D.bills.filter(b => b.kind == 'purchase' && per(b.date)), tot = l => rd(l.reduce((s, b) => s + b.total, 0));
  const inc = -ofType('I').reduce((s, a) => s + net(a.code, per), 0), exp = ofType('X').reduce((s, a) => s + net(a.code, per), 0), profit = inc - exp;
  const cash = cashAccs().reduce((s, a) => s + net(a.code, cum), 0), rec = D.receivables.reduce((t, c) => t + Math.max(c.balance, 0), 0), pay = D.payables.reduce((t, c) => t + Math.max(c.balance, 0), 0);
  const vat = -net('2020', cum) - net('1050', cum), unsold = D.bills.filter(b => b.kind == 'purchase' && !b.sold), unsoldAmt = unsold.reduce((t, b) => t + b.total, 0);
  // months in the selected period
  const months = []; let [y, m] = FR().split('-').map(Number); const [ey, em] = TO().split('-').map(Number);
  while ((y < ey || (y == ey && m <= em)) && months.length < 36) { months.push(y + '-' + String(m).padStart(2, '0')); if (++m > 12) { m = 1; y++; } }
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], lab = months.map(k => MN[+k.slice(5) - 1] + " '" + k.slice(2, 4));
  const byM = l => months.map(k => rd(l.filter(b => b.date.slice(0, 7) == k).reduce((s, b) => s + b.total, 0)));
  const plM = months.map(k => rd(D.vouchers.filter(v => per(v.date) && v.date.slice(0, 7) == k).reduce((s, v) => s + v.lines.reduce((t, l) => { const a = acc(l.account); return a && 'IX'.includes(a.type) ? t + l.cr - l.dr : t; }, 0), 0)));
  // sales by category with margin on bills made from a purchase
  const cat = {}; sales.forEach(b => { const c = b.category || 'Other', pb = D.bills.find(x => x.id == b.purchaseId), e = cat[c] = cat[c] || { v: 0, m: 0, n: 0 }, rev = b.nonTax + b.taxable; e.v += rev; e.n++; if (pb) e.m += rev - (pb.nonTax + pb.taxable); });
  const catItems = Object.entries(cat).sort((a, b) => b[1].v - a[1].v).map(([l, e]) => ({ l, v: e.v, s: e.n + ' bill' + (e.n > 1 ? 's' : '') + (e.m ? ' · margin ' + K(e.m) : '') }));
  const top = (list, key) => { const o = {}; list.forEach(b => o[b[key]] = (o[b[key]] || 0) + b.total); return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, v]) => ({ l, v })); };
  const age = d => Math.floor((Date.now() - new Date(d)) / 864e5), aging = list => { const b = [0, 0, 0, 0]; list.forEach(x => b[age(x.date) <= 30 ? 0 : age(x.date) <= 60 ? 1 : age(x.date) <= 90 ? 2 : 3] += x.due); return ['0–30 days', '31–60 days', '61–90 days', '90+ days'].map((l, i) => ({ l, v: b[i] })); };
  const dueR = D.receivables.flatMap(c => c.bills.filter(b => b.due > .004)), dueP = D.payables.flatMap(c => c.bills.filter(b => b.due > .004));
  let ex = ofType('X').map(a => ({ l: a.name, v: net(a.code, per) })).filter(x => x.v > .004).sort((a, b) => b.v - a.v); if (ex.length > 6) ex = [...ex.slice(0, 6), { l: 'Other expenses', v: ex.slice(6).reduce((s, x) => s + x.v, 0) }];
  const kp = (l, v, s, c = '') => `<div class="${c}"><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  return `<p class="sub">Figures for <b>${FR()}</b> to <b>${TO()}</b> (change the period at the top). Balances such as cash, receivable and payable are as at ${TO()}. Months are English (AD) months.</p>
    <div class="vat k4">${kp('Sales billed', f0(tot(sales)), sales.length + (sales.length == 1 ? ' bill' : ' bills') + ', incl. VAT')}${kp('Purchases billed', f0(tot(purch)), purch.length + (purch.length == 1 ? ' bill' : ' bills') + ', incl. VAT')}${kp('Net profit', f0(profit), 'Income ' + K(inc) + ' − expenses ' + K(exp), 'net')}${kp('Cash &amp; bank', f0(cash), '')}
      ${kp('Receivable from customers', f0(rec), dueR.length + (dueR.length == 1 ? ' unpaid bill' : ' unpaid bills'))}${kp('Payable to suppliers', f0(pay), dueP.length + (dueP.length == 1 ? ' unpaid bill' : ' unpaid bills'))}${kp('VAT ' + (vat >= 0 ? 'payable' : 'credit'), f0(Math.abs(vat)), 'Output − input VAT')}${kp('Purchases not yet sold', unsold.length, f0(unsoldAmt) + ' waiting for a sales bill')}</div>
    <div class="dash">
      <div class="card full"><div class="ch"><h2>Sales vs purchases by month</h2><span class="sub" style="margin:0">Bill totals incl. VAT</span></div>${barChart(lab, [{ name: 'Sales', color: '#27418F', vals: byM(sales) }, { name: 'Purchases', color: '#E0A030', vals: byM(purch) }])}</div>
      <div class="card"><div class="ch"><h2>Profit by month</h2><span class="sub" style="margin:0">Income − expenses (red = loss)</span></div>${barChart(lab, [{ name: 'Profit', color: '#1D7448', vals: plM }])}</div>
      <div class="card"><div class="ch"><h2>Expenses by account</h2></div>${donut(ex)}</div>
      <div class="card"><div class="ch"><h2>Sales by category</h2><span class="sub" style="margin:0">Excl. VAT · margin on bills made from a purchase</span></div>${hbars(catItems, '#27418F')}</div>
      <div class="card"><div class="ch"><h2>Top customers</h2><span class="sub" style="margin:0">By sales billed</span></div>${hbars(top(sales, 'customer'), '#27418F')}<div class="ch" style="margin-top:18px"><h2>Top suppliers</h2><span class="sub" style="margin:0">By purchases billed</span></div>${hbars(top(purch, 'supplier'), '#E0A030')}</div>
      <div class="card full"><div class="ch"><h2>Who owes what, by age of bill</h2><span class="sub" style="margin:0">Unpaid amounts, counted from the bill date</span></div>
        <div class="ag"><div><h3>Customers owe you</h3>${hbars(aging(dueR), '#B42318')}</div><div><h3>You owe suppliers</h3>${hbars(aging(dueP), '#A8730F')}</div></div></div>
    </div>`;
};
