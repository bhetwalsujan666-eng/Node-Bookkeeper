// pages/salary.js — Salary payment page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from '../lib/dom.js';
import { f, ymd } from '../lib/format.js';
import { D, MODES, cashAccs } from '../lib/state.js';

export const sal = () => {
  const key = x => String(x || '').trim().toLowerCase(), er = window.sle, today = ymd(), ca = cashAccs(),
    pre = er ? { staff: er.sal.staff, period: er.sal.period, date: er.date, bs: er.bs, amount: er.sal.amount, mode: er.sal.mode, account: er.sal.account, instrument: er.sal.instrument, note: er.sal.note, debit: er.sal.debitAccount, fee: er.sal.fee } : (window.slp || {}),
    dflt = pre.account || (ca.find(a => /cash/i.test(a.name)) || ca[0] || {}).code, inp = (id, l, v = '', x = '', c = '') => `<label class="${c}">${l}<input id="${id}" value="${esc(v)}" ${x}></label>`,
    pays = D.vouchers.filter(v => v.sal).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id), S = D.db.staff.map((s, i) => ({ ...s, i })).sort((a, b) => a.name.localeCompare(b.name)),
    mine = n => pays.filter(v => key(v.sal.staff) == key(n)), sel = S.find(s => key(s.name) == key(window.sls)), mon = today.slice(0, 7), debs = D.accounts.filter(a => a.code == '6000' || a.code == '2040');
  return `<div class="card" style="padding:14px 18px;margin-bottom:16px">
      <div class="fl" style="flex-wrap:wrap;align-items:center">
        <label style="flex-direction:row;align-items:center;gap:8px;margin:0;white-space:nowrap;font-weight:500">Staff
          <input type="search" id="lpick" list="stafflist" placeholder="Type a name…"
                 value="${sel ? esc(sel.name) : ''}" oninput="pickStaffByName(this.value)" style="min-width:280px">
        </label>
        <datalist id="stafflist">${S.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
        <span class="sub" style="margin:0 0 0 auto">${S.length} on the staff list</span>
      </div>
    </div>
    <div class="vat"><div><span>Salary paid this month</span><b>${f(pays.filter(v => v.date.slice(0, 7) == mon).reduce((t, v) => t + v.sal.amount, 0))}</b></div><div><span>Salary paid, all time</span><b>${f(pays.reduce((t, v) => t + v.sal.amount, 0))}</b></div><div><span>Staff on the list</span><b>${S.length}</b></div></div>
    <div class="card"><div class="ch"><h2>${er ? 'Edit salary payment ' + esc(er.no) : 'Record salary payment'}</h2></div>
      <div class="row">${inp('lnm', 'Staff name (pick or type new)', pre.staff, 'list="stf" autocomplete="off"', 'w2')}${inp('lpr', 'Salary for (e.g. Kartik 2083)', pre.period, '', 'w2')}
        <label>Date (AD)<input type="date" id="ldt" value="${pre.date || today}"></label>${inp('lbs', 'Date (BS)', pre.bs)}${inp('lam', 'Amount paid', pre.amount, 'type="number" step="any"')}
        <label>Mode<select id="lmo" onchange="lmode()">${MODES.map(m => `<option ${m == pre.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label id="lfw" ${pre.mode == 'Fonepay' ? '' : 'hidden'}>Fonepay charge<input id="lfe" type="number" step="any" value="${pre.fee ?? ''}" placeholder="0.00"></label>
        <label>Paid from<select id="lac">${ca.map(a => `<option value="${a.code}" ${a.code == dflt ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>${inp('lin', 'Cheque no. / Transaction ID', pre.instrument, `oninput="chqPick('lin','lac','lmo')"`)}
        <label>Charged to<select id="lde">${debs.map(a => `<option value="${a.code}" ${a.code == (pre.debit || '6000') ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>${inp('lnt', 'Note (optional)', pre.note, '', 'w2')}</div>
      <p class="sub" style="margin:8px 0 0"><small>A new staff name is added to the staff list automatically. Use Salary Payable only if the salary was already booked as owed in an earlier journal.</small></p>
      <div class="actbar"><button class="p" onclick="saveSalary()">${er ? 'Update payment' : 'Save payment'}</button>${er ? '<button onclick="window.sle=null;render()">Cancel</button>' : ''}</div></div>
    <div class="card"><div class="ch"><h2>${sel ? 'Staff details: ' + esc(sel.name) : 'Add or update a staff member'}</h2></div><div class="row">${inp('ldn', 'Name', sel ? sel.name : '', '', 'w2')}${inp('ldg', 'Designation', sel ? sel.designation : '')}${inp('lph', 'Phone', sel ? sel.phone : '')}<label>Ledger account<select id="ldl"><option value="">Not linked</option>${D.accounts.filter(a => 'AL'.includes(a.type)).map(a => `<option value="${a.code}" ${sel && sel.ledger == a.code ? 'selected' : ''}>${a.code} ${esc(a.name)}</option>`).join('')}</select></label></div>
      <div class="actbar"><button class="p" onclick="saveStaff()">Save staff</button>${sel ? `<button class="d" onclick="delStaff(${sel.i})">Remove from list</button><button onclick="window.sls=null;render()">Close</button>` : ''}</div></div>
    ${sel ? `<div class="card"><div class="ch"><h2>Payments to ${esc(sel.name)}</h2></div><div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Salary for</th><th>Mode</th><th class="n">Amount</th><th></th></tr></thead><tbody>${mine(sel.name).map(v => `<tr><td>${v.date}${v.bs ? '<br><small>' + esc(v.bs) + '</small>' : ''}</td><td><b>${v.no}</b></td><td>${esc(v.sal.period)}</td><td>${esc(v.sal.mode)}</td><td class="n">${f(v.sal.amount)}</td><td class="act"><button onclick="editV(${v.id})">Edit</button> <button class="d" onclick="del(${v.id})">Delete</button></td></tr>`).join('') || '<tr><td class="empty" colspan="6">No payments yet.</td></tr>'}</tbody></table></div></div>` : ''}`;
};
