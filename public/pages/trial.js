// pages/trial.js — Trial balance, income statement, balance sheet
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from '../lib/dom.js';
import { f } from '../lib/format.js';
import { D, FR, TO, closing, cum, groups, net, ofType, per, priorPL } from '../lib/state.js';

export const rows = (list, valFn) => list.map(a => ({ a, v: valFn(a) })).filter(x => Math.abs(x.v) > .004);

export const section = (title, list, sign) => { // list of accounts, sign flips Dr-Cr into natural balance
  let tot = 0, h = `<tr class="sec"><th colspan="2">${title}</th></tr>`;
  groups(list).forEach(g => {
    const r = rows(list.filter(a => a.group == g), a => sign * closing(a)); if (!r.length) return;
    h += (g == title ? '' : `<tr class="grp"><td colspan="2">${esc(g)}</td></tr>`) + r.map(x => `<tr><td class="ind">${x.a.code} ${esc(x.a.name)}</td><td class="n">${f(x.v)}</td></tr>`).join(''); tot += r.reduce((s, x) => s + x.v, 0);
  });
  return { h, tot };
};

export const dl = k => `<div class="tool"><button class="p" onclick="getFile('/api/xlsx/statement/${k}?from=${FR()}&to=${TO()}')">Download Excel</button></div>`;

export const collected = () => {
  const got = D.vouchers.filter(v => v.rcpt && !v.rcpt.other && per(v.date)).reduce((t, v) => t + v.rcpt.amount, 0), due = D.accounts.filter(a => a.group == 'Sundry Debtors').reduce((t, a) => t + net(a.code, cum), 0);
  return `<div class="vat" style="max-width:820px"><div><span>Received from customers in this period</span><b>${f(got)}</b></div><div><span>Still receivable from customers (as at ${TO()})</span><b>${f(due)}</b></div></div><p class="sub" style="max-width:820px"><small>Income below is counted when the sales bill is made. The two figures above show how much of what you billed has actually been collected.</small></p>`;
};

export const tb = () => {
  let dr = 0, cr = 0; const p = priorPL();
  const r = ofType('ALEIX').map(a => ({ a, v: closing(a) })).filter(x => Math.abs(x.v) > .004);
  if (Math.abs(p) > .004) r.push({ a: { code: '', name: "Prior years' profit/(loss) carried forward" }, v: p });
  return `<p class="sub">As at ${TO()}</p>${dl('tb')}<div class="card sheet"><div class="tw"><table><tr><th>Account</th><th class="n">Debit</th><th class="n">Credit</th></tr>` + r.map(x => {
    x.v > 0 ? dr += x.v : cr -= x.v;
    return `<tr><td>${x.a.code} ${esc(x.a.name)}</td><td class="n">${x.v > 0 ? f(x.v) : ''}</td><td class="n">${x.v < 0 ? f(-x.v) : ''}</td></tr>`;
  }).join('') +
    `<tr class="t"><td>Total ${Math.abs(dr - cr) < .005 ? '<span class="ok">✓ tallies</span>' : '<span class="err">(does not tally)</span>'}</td><td class="n">${f(dr)}</td><td class="n">${f(cr)}</td></tr></table></div></div>`;
};

export const pl = () => {
  const inc = section('Income', ofType('I'), -1), dc = section('Direct Costs', ofType('X').filter(a => a.group == 'Direct Costs'), 1),
    op = section('Operating Expenses', ofType('X').filter(a => a.group != 'Direct Costs'), 1), gp = inc.tot - dc.tot;
  return `<p class="sub">${FR()} to ${TO()}</p>${dl('pl')}${collected()}<div class="card sheet"><div class="tw"><table>${inc.h}<tr class="t"><td>Total Income</td><td class="n">${f(inc.tot)}</td></tr>${dc.h}
    <tr class="t"><td>Gross Profit</td><td class="n">${f(gp)}</td></tr>${op.h}<tr class="t"><td>Total Operating Expenses</td><td class="n">${f(op.tot)}</td></tr>
    <tr class="t"><td>Net Profit / (Loss)</td><td class="n">${f(gp - op.tot)}</td></tr></table></div></div>`;
};

export const bs = () => {
  const A = section('Assets', ofType('A'), 1), L = section('Liabilities', ofType('L'), -1), E = section('Equity', ofType('E'), -1);
  const cur = -ofType('IX').reduce((s, a) => s + net(a.code, per), 0), pr = -priorPL(), eq = E.tot + cur + pr, rhs = L.tot + eq;
  return `<p class="sub">As at ${TO()}</p>${dl('bs')}<div class="card sheet"><div class="tw"><table>${A.h}<tr class="t"><td>Total Assets</td><td class="n">${f(A.tot)}</td></tr>${L.h}
    <tr class="t"><td>Total Liabilities</td><td class="n">${f(L.tot)}</td></tr>${E.h}<tr><td class="ind">Prior years' profit/(loss)</td><td class="n">${f(pr)}</td></tr>
    <tr><td class="ind">Current period profit/(loss)</td><td class="n">${f(cur)}</td></tr><tr class="t"><td>Total Equity</td><td class="n">${f(eq)}</td></tr>
    <tr class="t"><td>Total Liabilities + Equity ${Math.abs(A.tot - rhs) < .005 ? '<span class="ok">✓ matches assets</span>' : '<span class="err">(does not match assets)</span>'}</td><td class="n">${f(rhs)}</td></tr></table></div></div>`;
};
