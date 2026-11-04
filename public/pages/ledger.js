// pages/ledger.js — Ledger page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from '../lib/dom.js';
import { f } from '../lib/format.js';
import { D, acc, net, per, pre } from '../lib/state.js';

export const ledger = () => {
  const c = window.lc || D.accounts[0].code, a = acc(c), isB = 'ALE'.includes(a.type);
  let run = isB ? net(c, pre) : 0; const open = run;
  const items = D.vouchers.filter(v => per(v.date)).sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id).flatMap(v => v.lines.filter(l => l.account == c).map(l => ({ v, l })));
  const bal = n => f(Math.abs(n)) + (n >= 0 ? ' Dr' : ' Cr');
  return `<div class="card"><div class="row" style="grid-template-columns:minmax(220px,420px)"><label>Account<select onchange="lc=this.value;render()">${D.accounts.map(x => `<option value="${x.code}" ${x.code == c ? 'selected' : ''}>${x.code} ${esc(x.name)}</option>`).join('')}</select></label></div></div>
    <div class="card"><div class="tw"><table><tr><th>Date</th><th>Voucher</th><th>Narration</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr>
    <tr class="grp"><td colspan="5">Opening balance</td><td class="n">${bal(open)}</td></tr>` + items.map(({ v, l }) => {
    run += l.dr - l.cr;
    return `<tr><td>${v.date}</td><td>${v.no}</td><td>${esc(v.narration)}</td><td class="n">${l.dr ? f(l.dr) : ''}</td><td class="n">${l.cr ? f(l.cr) : ''}</td><td class="n">${bal(run)}</td></tr>`;
  }).join('') +
    `<tr class="t"><td colspan="5">Closing balance</td><td class="n">${bal(run)}</td></tr></table></div></div>`;
};
