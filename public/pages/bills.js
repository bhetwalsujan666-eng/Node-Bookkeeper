// pages/bills.js — Purchase & sales bills page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from '../lib/dom.js';
import { f, ymd } from '../lib/format.js';
import { D } from '../lib/state.js';

export const bills = () => {
  const s = window.sp || {}, e = window.eb || {}, ek = e.kind, pe = ek == 'purchase' ? e : {}, so = ek == 'sales' ? e : s, today = ymd(), bt = window.bt || 'purchase', inp = (id, l, v = '', x = '', c = '') => `<label class="${c}">${l}<input id="${id}" value="${esc(v)}" ${x}></label>`;
  const catSel = (id, v) => `<label>Category<select id="${id}">${[...D.settings.categories, ...(v && !D.settings.categories.includes(v) ? [v] : [])].map(c => `<option ${c == v ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`, P = D.bills.filter(b => b.kind == 'purchase').reverse(), S = D.bills.filter(b => b.kind == 'sales').reverse(), nx = 'type="number" step="any"';
  const q = (...a) => esc(a.join(' ').toLowerCase()), pst = {}; D.receivables.forEach(c => c.bills.forEach(x => pst[x.id] = x));
  const payChip = id => { const x = pst[id]; return !x ? '' : x.status == 'Paid' ? '<span class="chip ok">Paid</span>' : x.status == 'Partial' ? '<span class="chip due">Part paid · due ' + f(x.due) + '</span>' : '<span class="chip due">Unpaid</span>'; };
  return `<div id="bw" data-k="${bt}"><div class="seg"><button data-k="purchase" class="${bt == 'purchase' ? 'on' : ''}" onclick="setBt('purchase')">Purchase bills<i>${P.length}</i></button><button data-k="sales" class="${bt == 'sales' ? 'on' : ''}" onclick="setBt('sales')">Sales bills<i>${S.length}</i></button></div>

    <div class="pane-p">${ek == 'purchase' ? `<div class="note">Editing purchase bill <b>${esc(e.billNo)}</b> (${esc(e.voucher)}). Saving updates its journal voucher, the ledgers, the reports and the Excel files.${e.sold ? ' A sales bill (' + esc(e.sold) + ') was already made from it; that sales bill is not changed.' : ''}</div>` : ''}<div class="split"><div class="card">
      <div class="fh">Supplier and customer</div><div class="row">${inp('ps', 'Supplier (pick or type new)', pe.supplier, 'list="pls" onchange="fillParty(\'ps\',\'ppan\')"', 'w2')}${inp('ppan', 'Supplier PAN/VAT no.', pe.supplierPan)}${inp('pc', 'Customer (bill to)', pe.customer, 'list="plc"', 'w2')}${inp('pp', 'Passenger name', pe.passenger)}</div>
      <div class="fh">Bill</div><div class="row">${inp('pb', 'Supplier bill no.', pe.billNo)}${catSel('pcat', pe.category)}<label>Date (AD)<input type="date" id="pd" value="${pe.date || today}"></label>${inp('pbs', 'Date (BS)', pe.bs)}</div>
      <div class="fh">Charges</div><div class="row">${inp('pi', 'Particulars (route, ticket no., hotel...)', pe.particulars, '', 'w4')}${inp('pn', 'Non-taxable', pe.nonTax, nx + ' oninput="pcalc()"')}${inp('pt', 'Taxable', pe.taxable, nx + ' oninput="pcalc()"')}${inp('pv', 'VAT 13% (as on bill)', pe.vat, nx + ' oninput="pcalc()"')}${inp('pr', 'Round off (+/−)', pe.roundOff, nx + ' oninput="pcalc()"')}</div>
    </div>
    <aside class="stub"><div class="hd">Purchase bill</div><div class="bd"><dl><dt>Non-taxable</dt><dd id="pnv"></dd><dt>Taxable</dt><dd id="ptv"></dd><dt>VAT 13%</dt><dd id="pvv"></dd><dt>Round off</dt><dd id="prv"></dd></dl>
      <div class="tt"><span>Total</span><b id="ptot"></b></div>${ek == 'purchase' ? '<button class="p wide" onclick="savePurchase()">Update purchase bill</button><button class="wide" onclick="cancelEdit()">Cancel</button>' : '<button class="p wide" onclick="savePurchase()">Save as journal voucher</button>'}</div></aside></div>

</div>

    <div class="pane-s">${ek == 'sales' ? `<div class="note">Editing sales bill <b>${esc(e.billNo)}</b> (${esc(e.voucher)}). Saving updates its sales voucher, the customer's account, the reports and the invoice Excel.</div>` : ''}${s.id ? `<div class="note">Creating a sales bill from purchase bill <b>${esc(s.billNo)}</b> (${esc(s.supplier)}). The amounts below are filled in for you.</div>` : ''}<div class="split"><div class="card">
      <div class="fh">Customer</div><div class="row">${inp('sc', 'Customer (M/S)', so.customer, 'list="plc" onchange="fillParty(\'sc\',\'sv\')"', 'w2')}${inp('sv', "Buyer's VAT/PAN no.", ek == 'sales' ? e.customerVat : '')}${inp('sp2', 'Passenger', so.passenger)}${ek == 'sales' ? '' : `<label class="w2">From purchase bill (optional)<select id="spb" onchange="pickPurchase(this.value)"><option value="">None, enter manually</option>${D.bills.filter(b => b.kind == 'purchase' && (!b.sold || b.id == s.id)).reverse().map(b => `<option value="${b.id}" ${b.id == s.id ? 'selected' : ''}>${esc(b.supplier)} · ${esc(b.billNo)} · ${f(b.total)}</option>`).join('')}</select></label>`}</div>
      <div class="fh">Bill</div><div class="row">${catSel('sct', so.category)}${ek == 'sales' ? inp('sbn', 'Bill no.', e.billNo) : ''}<label>Date (AD)<input type="date" id="sd" value="${ek == 'sales' ? e.date : today}"></label>${inp('sbs', 'Date (BS)', ek == 'sales' ? e.bs : '')}${inp('si', 'Particulars', so.particulars, '', 'w4')}</div>
      <div class="fh">Amounts</div><div class="row">${inp('sn', 'Non-taxable', so.nonTax, nx + ' oninput="scalc(this.id)"')}${inp('sb', 'Purchase total', s.total, nx + ' oninput="scalc(this.id)"')}${inp('sm', 'Markup %', 15, nx + ' oninput="scalc(this.id)"')}${inp('st', 'Bill total', ek == 'sales' ? e.total : '', nx + ' oninput="scalc(this.id)"')}</div>
    </div>
    <aside class="stub"><div class="hd">Sales bill (VAT invoice)</div><div class="bd"><div id="sbd"></div>${ek == 'sales' ? '<button class="p wide" onclick="saveSale()">Update sales bill</button><button class="wide" onclick="cancelEdit()">Cancel</button>' : '<button class="p wide" onclick="saveSale()">Save &amp; download Excel</button><button class="wide" onclick="window.sp=null;render()">Clear</button>'}</div></aside></div>

</div></div>`;
};
