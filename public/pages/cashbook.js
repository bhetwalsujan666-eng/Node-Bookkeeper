// pages/cashbook.js — Cash book: two-sided entry page that looks like the paper Day Book
// LEFT = receipts (cash coming in, Dr cash), RIGHT = payments (cash going out, Cr cash). One date for the whole entry (AD or BS), every row you save becomes an ordinary voucher.
import { $, esc, post, toast } from '../lib/dom.js';
import { f, rd, ymd } from '../lib/format.js';
import { ad2bs, bs2ad, bsNorm } from '../lib/nepdate.js';
import { D, acc, cashAccs, load, net, per, pre, resolveAcc } from '../lib/state.js';

const aname = c => (acc(c) || {}).name || c;

// ---- entry rows: Particulars (wide) | L.F. | Amount. L.F. is the ledger folio: it fills in by itself with the account code you picked. ----
const erow = side => `<tr data-r="${side}">
  <td class="cacc"><input list="al" class="ca" placeholder="Particulars: type account code or name" oninput="cbLf(this)" onkeydown="cbAcc(event)"><input class="cn" placeholder="Narration (optional)"></td>
  <td class="lf"><span class="lfv"></span></td>
  <td class="n"><input class="cm" type="number" step="any" inputmode="decimal" placeholder="0.00" style="text-align:right" oninput="cbSum('${side}')" onkeydown="cbKey(event,'${side}')"></td>
  <td class="cact"><button class="x" title="Remove row" onclick="this.closest('tr').remove();cbSum('${side}')">×</button></td></tr>`;

export function cbAdd(side) { const tb = $('#cbe-' + side); tb.insertAdjacentHTML('beforeend', erow(side)); return tb.lastElementChild; }

export function cbLf(el) { const c = resolveAcc(el.value); el.closest('tr').querySelector('.lfv').textContent = c || ''; el.style.borderColor = el.value.trim() && !c ? '#B42318' : ''; }

const pend = side => rd([...document.querySelectorAll(`#cbe-${side} .cm`)].reduce((t, i) => t + (+i.value || 0), 0));

export function cbSum(side) { const o = $('#cbt-' + side); if (o) o.textContent = f(pend(side)); cbDay(); }

export function cbKey(e, side) { if (e.key != 'Enter') return; e.preventDefault(); const tr = e.target.closest('tr'); (tr.nextElementSibling || cbAdd(side)).querySelector('.ca').focus(); } // Enter on the amount: next row

export function cbAcc(e) { if (e.key != 'Enter') return; e.preventDefault(); e.target.closest('tr').querySelector('.cm').focus(); } // Enter on the particulars: go to the amount

// ---- the day's balance: opening + what is saved for that date + the rows typed but not saved yet ----
const day = (code, d, pin, pout) => {
  let rin = 0, rout = 0; D.vouchers.forEach(v => { if (v.date == d) v.lines.forEach(l => { if (l.account == code) { rin += l.dr; rout += l.cr; } }); });
  const open = rd(net(code, x => x < d)); rin = rd(rin + pin); rout = rd(rout + pout); return { open, rin, rout, close: rd(open + rin - rout) };
};

const dayHtml = x => `Opening ${f(x.open)} · Receipts ${f(x.rin)} · Payments ${f(x.rout)}`;

const dateNow = () => $('#cbd').value || bs2ad($('#cbbs').value.trim());

export function cbDay() {
  const code = $('#cbacc') && $('#cbacc').value, d = $('#cbd') && dateNow(); if (!code || !d) return; window.cbdt = d;
  const x = day(code, d, pend('in'), pend('out')); $('#cbdl').textContent = d; $('#cbdb').textContent = f(x.close); $('#cbdd').textContent = dayHtml(x);
}

const grab = side => [...document.querySelectorAll(`#cbe-${side} tr[data-r]`)].map(r => ({ t: r.querySelector('.ca').value, n: r.querySelector('.cn').value, m: r.querySelector('.cm').value })).filter(x => x.t.trim() || x.m);

function put(side, rows) {
  if (!rows.length) return; const tb = $('#cbe-' + side);
  rows.forEach((x, i) => { const r = tb.children[i] || cbAdd(side); r.querySelector('.ca').value = x.t; r.querySelector('.cn').value = x.n; r.querySelector('.cm').value = x.m; cbLf(r.querySelector('.ca')); }); cbSum(side);
}

export async function cbSave(side) {
  const code = $('#cbacc').value, R = side == 'in', cash = new Set(cashAccs().map(a => a.code)), items = [], d = dateNow();
  if (!d) return alert('Enter the date at the top (English AD or Nepali BS). A BS date must look like 2083-07-17.');
  for (const r of document.querySelectorAll(`#cbe-${side} tr[data-r]`)) {
    const t = r.querySelector('.ca').value, m = rd(+r.querySelector('.cm').value || 0), n = r.querySelector('.cn').value.trim();
    if (!t.trim() && !m) continue; // empty row: ignored
    const a = resolveAcc(t);
    if (!a) return alert('Account not found: "' + (t.trim() || 'blank') + '". Pick an account from the list while typing, or add it in the Accounts tab.');
    if (a == code) return alert('Particulars cannot be the cash/bank account itself (' + aname(code) + ').');
    if (m <= 0) return alert('Enter an amount for ' + aname(a) + '.');
    items.push({ a, m, n, t });
  } // everything is checked before anything is posted
  if (!items.length) return alert('Nothing to save. Fill in at least one row (particulars and amount).');
  const other = R ? 'out' : 'in', keep = grab(other); let ok = 0;
  for (const x of items) {
    const body = {
      type: cash.has(x.a) ? 'Contra' : R ? 'Receipt' : 'Payment', date: d, bs: ad2bs(d), ref: '', narration: x.n || (R ? 'Received from ' : 'Paid to ') + aname(x.a),
      lines: R ? [{ account: code, dr: x.m, cr: 0 }, { account: x.a, dr: 0, cr: x.m }] : [{ account: x.a, dr: x.m, cr: 0 }, { account: code, dr: 0, cr: x.m }]
    };
    if (!await post('/api/vouchers', body)) break; ok++;
  }
  await load(); put(other, keep); put(side, items.slice(ok)); // rows typed on the other side (and any that failed to save) are kept
  if (ok) toast(ok + (R ? ' receipt' : ' payment') + (ok > 1 ? 's' : '') + ' saved to ' + aname(code));
}

// Vouchers that touch the cash/bank account in the selected period, split into the receipts side and the payments side
function book(code) {
  const IN = [], OUT = [];
  D.vouchers.filter(v => per(v.date) && v.lines.some(l => l.account == code)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(v => {
    const mine = v.lines.filter(l => l.account == code), dr = rd(mine.reduce((t, l) => t + l.dr, 0)), cr = rd(mine.reduce((t, l) => t + l.cr, 0)), rest = v.lines.filter(l => l.account != code);
    const mk = (amt, pick) => { const ac = [...new Set(rest.filter(pick).map(l => l.account))]; return { id: v.id, date: v.date, bs: v.bs, no: v.no, narr: v.narration, who: ac.map(aname).join(', '), lf: ac.join(', '), amt }; };
    if (dr) IN.push(mk(dr, l => l.cr > 0));
    if (cr) OUT.push(mk(cr, l => l.dr > 0));
  });
  return { IN, OUT };
}

const CSS = `<style>
.cbtop{display:flex;flex-wrap:wrap;gap:16px 28px;align-items:flex-end;padding:14px 18px;margin-bottom:16px}
.cbtl{display:flex;flex-wrap:wrap;gap:14px 20px;align-items:flex-end}
.cbtl label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:500;color:var(--mut)}
.cbdt{display:flex;gap:8px}.cbdt input{width:auto;min-width:150px}
.cbday{margin-left:auto;text-align:right}.cbday span{display:block;font-size:12.5px;color:var(--mut)}
.cbday b{display:block;font:650 26px/1.25 var(--ui);font-variant-numeric:tabular-nums;color:var(--ink)}.cbday small{color:var(--mut);font-size:12px}
.cbk{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start;margin-bottom:16px}
.cbk>.card{margin:0}.cbk .in{border-top:3px solid var(--ok)}.cbk .out{border-top:3px solid var(--err)}
.cbk table{table-layout:fixed;width:100%}.cbk .tw{overflow-x:hidden}
.cbk th,.cbk td{padding:10px 12px;overflow-wrap:anywhere}.cbk .tw td:first-child{white-space:normal}
.cbk td input{border-color:var(--line);background:var(--panel-2);padding:7px 10px;min-height:36px}
.cbk td.lf{text-align:center;color:var(--mut);font-size:13px}.cbk .cn{margin-top:5px;min-height:30px;padding:4px 10px;font-size:12.5px}
.cbk .actbar{justify-content:space-between}
@media(max-width:1100px){.cbk{grid-template-columns:1fr}}
</style>`;

export const cashbook = () => {
  const ca = cashAccs(), cur = (ca.find(a => a.code == window.cbc) || ca.find(a => /cash/i.test(a.name)) || ca[0] || {}).code;
  if (!cur) return '<div class="card"><p class="sub" style="margin:0">No cash or bank account found. Add one in the Accounts tab first.</p></div>';
  const dt = window.cbdt || ymd(), x = day(cur, dt, 0, 0), { IN, OUT } = book(cur), open = rd(net(cur, pre)), sIn = rd(IN.reduce((t, e) => t + e.amt, 0)), sOut = rd(OUT.reduce((t, e) => t + e.amt, 0));
  const tl = rd((open > 0 ? open : 0) + sIn), trr = rd((open < 0 ? -open : 0) + sOut), close = rd(tl - trr), total = Math.max(tl, trr);
  const bal = (label, amt) => `<tr class="grp"><td></td><td colspan="2"><b>${label}</b></td><td class="n">${f(amt)}</td><td></td></tr>`;
  const line = (e, pfx) => `<tr><td>${e.date}${e.bs ? '<br><small>' + esc(e.bs) + '</small>' : ''}</td><td>${pfx} ${esc(e.who)}<br><small>${esc(e.no)}${e.narr ? ' · ' + esc(e.narr) : ''}</small></td><td>${esc(e.lf)}</td><td class="n">${f(e.amt)}</td><td class="act"><button onclick="editV(${e.id})">Edit</button> <button class="d" onclick="del(${e.id})">Delete</button></td></tr>`;
  const left = (open > 0 ? bal('To Balance b/d', open) : '') + IN.map(e => line(e, 'To')).join('') + (close < 0 ? bal('To Balance c/d', -close) : '');
  const right = (open < 0 ? bal('By Balance b/d', -open) : '') + OUT.map(e => line(e, 'By')).join('') + (close >= 0 ? bal('By Balance c/d', close) : '');
  const ehead = '<colgroup><col><col style="width:76px"><col style="width:140px"><col style="width:44px"></colgroup><thead><tr><th>Particulars</th><th style="text-align:center">L.F.</th><th class="n">Amount (Rs.)</th><th></th></tr></thead>';
  const lhead = '<colgroup><col style="width:100px"><col><col style="width:84px"><col style="width:120px"><col style="width:150px"></colgroup><thead><tr><th>Date</th><th>Particulars</th><th>L.F.</th><th class="n">Amount (Rs.)</th><th></th></tr></thead>';
  const entry = (side, title, cls, n) => `<div class="card ${cls}"><div class="ch"><h2>${title}</h2><span class="sub sp" style="margin:0">${side == 'in' ? 'Dr' : 'Cr'} ${esc(aname(cur))}</span></div>
    <div class="tw"><table>${ehead}<tbody id="cbe-${side}">${Array.from({ length: n }, () => erow(side)).join('')}</tbody></table></div>
    <div class="actbar"><button onclick="cbAdd('${side}')">+ Add row</button><span class="sub" style="margin:0">Total <b id="cbt-${side}">0.00</b></span><button class="p" onclick="cbSave('${side}')">Save ${side == 'in' ? 'receipts' : 'payments'}</button></div></div>`;
  const list = (title, cls, rows) => `<div class="card ${cls}"><div class="ch"><h2>${title}</h2></div><div class="tw"><table>${lhead}<tbody>${rows || '<tr><td class="empty" colspan="5">Nothing in this period.</td></tr>'}<tr class="t"><td></td><td colspan="2">Total</td><td class="n">${f(total)}</td><td></td></tr></tbody></table></div></div>`;
  const chg = 'setTimeout(cbDay,0)';
  return CSS + `<div class="card cbtop"><div class="cbtl">
      <label>Cash / bank account<select id="cbacc" onchange="window.cbc=this.value;window.cbdt=$('#cbd').value;render()" title="Changing the account clears rows that are not saved yet" style="min-width:220px">${ca.map(a => `<option value="${a.code}" ${a.code == cur ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label>Date: type either the English (AD) or the Nepali (BS) date<div class="cbdt"><input type="date" id="cbd" value="${dt}" oninput="${chg}" onchange="${chg}"><input id="cbbs" placeholder="BS 2083-07-17" value="${ad2bs(dt)}" oninput="${chg}" onchange="${chg}"></div></label></div>
    <div class="cbday"><span>Balance on <b id="cbdl" style="display:inline;font-size:inherit;font-weight:600">${dt}</b></span><b id="cbdb">${f(x.close)}</b><small id="cbdd">${dayHtml(x)}</small></div></div>
    <div class="cbk">${entry('in', 'Receipts · cash in', 'in', 5)}${entry('out', 'Payments · cash out', 'out', 5)}</div>
    <div class="cbk">${list('Cash book: receipts (Dr)', 'in', left)}${list('Cash book: payments (Cr)', 'out', right)}</div>`;
};
