// pages/receipts.js — Payments received page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from '../lib/dom.js';
import { f, ymd } from '../lib/format.js';
import { D, MODES, cashAccs } from '../lib/state.js';

export const rcv = () => {
  const R = D.receivables, key = x => String(x || '').trim().toLowerCase(), sel = R.find(c => key(c.name) == key(window.rc)), er = window.er, today = ymd(),
    pre = er ? { date: er.date, bs: er.bs, amount: er.rcpt.amount, mode: er.rcpt.mode, account: er.rcpt.account, instrument: er.rcpt.instrument, billId: er.rcpt.billId, note: er.rcpt.note, payer: er.rcpt.payer, credit: er.rcpt.creditAccount } : (window.rpre || {}),
    inp = (id, l, v = '', x = '', c = '') => `<label class="${c}">${l}<input id="${id}" value="${esc(v)}" ${x}></label>`, ca = cashAccs(), dflt = pre.account || (ca.find(a => /cash/i.test(a.name)) || ca[0] || {}).code,
    pos = x => Math.max(x, 0), bal = n => f(Math.abs(n)) + (n >= 0 ? ' Dr' : ' Cr'),
    tot = R.reduce((t, c) => t + pos(c.balance), 0), adv = R.reduce((t, c) => t + pos(-c.balance), 0), dues = R.filter(c => c.balance > .004).length,
    state = c => c.balance > .004 ? '<span class="chip due">Due</span>' : c.balance < -.004 ? '<span class="chip">Advance</span>' : c.dr ? '<span class="chip ok">Settled</span>' : '',
    stChip = b => b.status == 'Paid' ? '<span class="chip ok">Paid</span>' : b.status == 'Partial' ? '<span class="chip due">Part paid</span>' : '<span class="chip due">Unpaid</span>';
  const credAccs = D.accounts.filter(a => !ca.some(c => c.code == a.code) && a.group != 'Sundry Debtors'), groups = [...new Set(credAccs.map(a => a.group))],
    newForm = () => `<div class="card" id="cdet"><div class="ch"><h2>${er ? 'Edit payment ' + esc(er.no) : 'New payment received'}</h2></div>
        <p class="sub"><small>Use this for money that did not come from one of your recorded customers, such as a transfer from another company. Choose where it should be credited: a customer's account (type the name; a new customer is added automatically), or any other account.</small></p>
        <div class="row">${inp('rpy', 'Received from (payer)', pre.payer, 'placeholder="e.g. ABC Trading Pvt. Ltd."', 'w2')}
          <label class="w2">Credit to<select id="rcr" onchange="rcrChg()"><option value="">A customer's account</option>${groups.map(g => `<optgroup label="${esc(g)}">${credAccs.filter(a => a.group == g).map(a => `<option value="${a.code}" ${a.code == pre.credit ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
          <label class="w4" id="rcnw" ${pre.credit ? 'hidden' : ''}>Customer name<input id="rcn" list="plc" value="${esc(er && !pre.credit ? er.rcpt.customer : '')}" placeholder="Whose bills is this payment for?"></label>
          <label>Date (AD)<input type="date" id="rdt" value="${pre.date || today}"></label>${inp('rbs', 'Date (BS)', pre.bs)}${inp('ram', 'Amount received', pre.amount, 'type="number" step="any"')}
          <label>Mode<select id="rmo" onchange="rmode()">${MODES.map(m => `<option ${m == pre.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label>Received in<select id="rac">${ca.map(a => `<option value="${a.code}" ${a.code == dflt ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>${inp('rin', 'Cheque no. / Transaction ID', pre.instrument)}${inp('rnt', 'Note (optional)', pre.note, '', 'w2')}</div>
        <div class="actbar"><button class="p" onclick="saveNewReceipt()">${er ? 'Update payment' : 'Save payment'}</button><button onclick="window.er=null;window.rnew=false;render()">Cancel</button></div></div>`,
    others = D.vouchers.filter(v => v.rcpt && v.rcpt.other).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    otherCard = !others.length ? '' : `<div class="card"><div class="ch"><h2>Other payments received</h2><span class="sub" style="margin:0">Not from a recorded customer</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Received from</th><th>Credited to</th><th>Mode</th><th class="n">Amount</th><th></th></tr></thead><tbody>${others.map(v => { const ac = D.accounts.find(a => a.code == v.rcpt.creditAccount); return `<tr><td>${v.date}${v.bs ? '<br><small>' + esc(v.bs) + '</small>' : ''}</td><td><b>${v.no}</b>${v.ref ? '<br><small>' + esc(v.ref) + '</small>' : ''}</td><td>${esc(v.rcpt.payer)}${v.rcpt.note ? '<br><small>' + esc(v.rcpt.note) + '</small>' : ''}</td><td>${esc(ac ? ac.name : v.rcpt.creditAccount)}</td><td>${esc(v.rcpt.mode)}</td><td class="n">${f(v.rcpt.amount)}</td><td class="act"><a href="#" onclick="getFile('/api/xlsx/voucher/${v.id}');return false">Excel</a> <button onclick="editV(${v.id})">Edit</button> <button class="d" onclick="del(${v.id})">Delete</button></td></tr>`; }).join('')}</tbody></table></div></div>`;
  const detail = window.rnew ? newForm() : !sel ? '<div class="card"><p class="sub" style="margin:0">Pick a customer above to see their statement and record a payment, or use <b>New payment</b> for money from someone who is not a recorded customer.</p></div>' : `
      <div class="card" id="cdet"><div class="ch"><h2>${esc(sel.name)}</h2>${sel.pan ? `<span class="chip">PAN/VAT ${esc(sel.pan)}</span>` : ''}${state(sel)}</div>
        <div class="vat" style="margin:0"><div><span>Billed</span><b>${f(sel.dr)}</b></div><div><span>Received</span><b>${f(sel.cr)}</b></div><div class="net"><span>${sel.balance < -.004 ? 'Advance / overpaid' : 'Outstanding'}</span><b>${f(Math.abs(sel.balance))}</b></div></div></div>
      <div class="card"><div class="ch"><h2>${er ? 'Edit payment ' + esc(er.no) : 'Record payment received'}</h2></div>
        <div class="row"><label>Date (AD)<input type="date" id="rdt" value="${pre.date || today}"></label>${inp('rbs', 'Date (BS)', pre.bs)}${inp('ram', 'Amount received', pre.amount, 'type="number" step="any"')}
          <label>Mode<select id="rmo" onchange="rmode()">${MODES.map(m => `<option ${m == pre.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label>Received in<select id="rac">${ca.map(a => `<option value="${a.code}" ${a.code == dflt ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>${inp('rin', 'Cheque no. / Transaction ID', pre.instrument)}
          <label>Against bill<select id="rbl"><option value="">Auto (oldest bill first)</option>${sel.bills.filter(b => b.due > .004 || b.id == pre.billId).map(b => `<option value="${b.id}" ${b.id == pre.billId ? 'selected' : ''}>${esc(b.billNo)} · ${b.date} · due ${f(b.due)}</option>`).join('')}</select></label>${inp('rnt', 'Note (optional)', pre.note, '', 'w2')}</div>
        <div class="actbar"><button class="p" onclick="saveReceipt()">${er ? 'Update payment' : 'Save payment'}</button>${er ? '<button onclick="window.er=null;render()">Cancel</button>' : ''}</div></div>
      <div class="card"><div class="ch"><h2>Bills</h2></div><div class="tw"><table><thead><tr><th>Date</th><th>Bill no.</th><th class="n">Total</th><th class="n">Received</th><th class="n">Due</th><th>Status</th><th></th></tr></thead><tbody>${sel.bills.map(b => `<tr><td>${b.date}</td><td><b>${esc(b.billNo)}</b></td><td class="n">${f(b.total)}</td><td class="n">${f(b.paid)}</td><td class="n">${f(b.due)}</td><td>${stChip(b)}</td><td class="act">${b.due > .004 ? `<button onclick="rcvBill(${b.id}, ${b.due})">Receive</button>` : ''}</td></tr>`).join('') || '<tr><td class="empty" colspan="7">No sales bills for this customer yet.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="ch"><h2>Statement</h2></div><div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="n">Billed (Dr)</th><th class="n">Received (Cr)</th><th class="n">Balance</th><th></th></tr></thead><tbody>${sel.statement.map(x => `<tr><td>${x.date}${x.bs ? '<br><small>' + esc(x.bs) + '</small>' : ''}</td><td><b>${x.no}</b>${x.ref ? '<br><small>' + esc(x.ref) + '</small>' : ''}</td><td>${esc(x.narration)}</td><td class="n">${x.dr ? f(x.dr) : ''}</td><td class="n">${x.cr ? f(x.cr) : ''}</td><td class="n">${bal(x.bal)}</td>
        <td class="act">${x.rcpt ? `<a href="#" onclick="getFile('/api/xlsx/voucher/${x.vid}');return false">Excel</a> <button onclick="editV(${x.vid})">Edit</button> <button class="d" onclick="del(${x.vid})">Delete</button>` : x.billId ? `<a href="#" onclick="getFile('/api/xlsx/bill/${x.billId}');return false">Bill Excel</a> <button onclick="editBill(${x.billId})">Edit bill</button>` : `<button onclick="editV(${x.vid})">Edit</button>`}</td></tr>`).join('') || '<tr><td class="empty" colspan="7">Nothing yet.</td></tr>'}</tbody></table></div></div>
      ${sel.pending.length ? `<div class="card"><div class="ch"><h2>Purchased for this customer, not billed yet</h2></div><div class="tw"><table><tbody>${sel.pending.map(x => `<tr><td>${x.date}</td><td><b>${esc(x.supplier)}</b><br><small>Bill ${esc(x.billNo)}${x.passenger ? ' · ' + esc(x.passenger) : ''}</small></td><td class="n">${f(x.total)}</td><td class="act"><button onclick="tab='bills';makeSale(${x.id})">Create sales bill</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  return `<div class="card" style="padding:14px 18px;margin-bottom:16px">
      <div class="fl" style="flex-wrap:wrap;align-items:center">
        <label style="flex-direction:row;align-items:center;gap:8px;margin:0;white-space:nowrap;font-weight:500">Customer
          <input type="search" id="cpick" list="custlist" placeholder="Type a name…"
                 value="${sel ? esc(sel.name) : ''}" oninput="pickCustByName(this.value)" style="min-width:300px">
        </label>
        <datalist id="custlist">${R.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <button class="p" onclick="newPay()">+ New payment</button>
        <span class="sub" style="margin:0 0 0 auto">${dues} with dues · total receivable ${f(tot)}</span>
      </div>
    </div>
    ${detail}`;
};
