// pages/daybook.js — Day book page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from '../lib/dom.js';
import { f } from '../lib/format.js';
import { D, nm, per } from '../lib/state.js';

export const daybook = () => `<div class="card"><div class="tw"><table><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="n">Debit</th><th class="n">Credit</th><th></th></tr>` +
  (D.vouchers.filter(v => per(v.date)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(v =>
    v.lines.map((l, i) => `<tr class="${i ? '' : 'vs'}"><td>${i ? '' : v.date + (v.bs ? '<br><small>' + esc(v.bs) + '</small>' : '')}</td><td>${i ? '' : '<b>' + v.no + '</b>' + (v.ref ? '<br><small>' + esc(v.ref) + '</small>' : '')}</td>
      <td>${esc(nm(l.account))}${i == v.lines.length - 1 && v.narration ? '<br><small><i>' + esc(v.narration) + '</i></small>' : ''}</td>
      <td class="n">${l.dr ? f(l.dr) : ''}</td><td class="n">${l.cr ? f(l.cr) : ''}</td><td class="act">${i ? '' : `<a href="#" onclick="getFile('/api/xlsx/voucher/${v.id}');return false">Excel</a> <button onclick="editV(${v.id})">Edit</button> <button class="d" onclick="del(${v.id})">Delete</button>`}</td></tr>`).join('')).join('') || '<tr><td class="empty" colspan="6">No vouchers in this period.</td></tr>') + '</table></div></div>';
