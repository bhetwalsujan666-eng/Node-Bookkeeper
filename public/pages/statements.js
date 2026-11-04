// pages/statements.js — Statements page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from '../lib/dom.js';
import { f } from '../lib/format.js';
import { D, FR, TO, cum, net } from '../lib/state.js';

// ---- Statements page ----
export const SK = [['supplier', 'Suppliers'], ['customer', 'Customers'], ['staff', 'Staff'], ['expense', 'Expenses']];

export function stmtList(k) {
  const key = x => String(x || '').trim().toLowerCase();
  if (k == 'supplier') return D.payables.map(x => ({ n: x.name, s: f(x.balance), t: 'we owe', sub: x.pan }));
  if (k == 'customer') return D.receivables.map(x => ({ n: x.name, s: f(x.balance), t: 'they owe', sub: x.pan }));
  if (k == 'staff') return D.db.staff.slice().sort((a, b) => a.name.localeCompare(b.name)).map(x => ({ n: x.name, s: f(D.vouchers.filter(v => v.sal && key(v.sal.staff) == key(x.name)).reduce((t, v) => t + v.sal.amount, 0)), t: 'paid', sub: x.designation }));
  return D.accounts.filter(a => a.type == 'X').map(a => ({ n: a.name, s: f(net(a.code, cum)), t: 'to date', sub: a.group }));
}

export function stmtDates() { return { from: window.stf || FR(), to: window.stt || TO() }; }

export const stmt = () => {
  const k = window.stk || 'supplier', L = stmtList(k), d = stmtDates(), sel = L.find(x => x.n == window.stn); window.stl = L;
  const open = !!window.stlist, tabs = `<div class="seg">${SK.map(([id, t]) => `<button class="${id == k ? 'on' : ''}" onclick="window.stk='${id}';window.stn=null;window.stlist=false;render()">${t}</button>`).join('')}</div>`;
  // picker bar: always visible, collapsed by default
  const bar = `<div class="card" style="padding:14px 18px;margin-bottom:16px">
      <div class="fl" style="flex-wrap:wrap;align-items:center">
        <label style="flex-direction:row;align-items:center;gap:8px;margin:0;white-space:nowrap;font-weight:500">${SK.find(x => x[0] == k)[1]}
          <input type="search" id="spick2" list="stmtlist" placeholder="Type a name…"
                 value="${sel ? esc(sel.n) : ''}" onchange="pickStmtByName(this.value)" style="min-width:300px">
        </label>
        <datalist id="stmtlist">${L.map(x => `<option value="${esc(x.n)}">`).join('')}</datalist>
        <button onclick="window.stlist=!window.stlist;render()">${open ? '▴ Hide list' : '▾ Show list'}</button>
        ${sel ? `<button class="p" onclick="getFile(stmtUrl('xlsx/'))">Download Excel</button>` : ''}
        <span class="sub" style="margin:0 0 0 auto">${L.length} ${SK.find(x => x[0] == k)[1].toLowerCase()}</span>
      </div>
    </div>`;
  // the expandable list (only when toggled open)
  const list = !open ? '' : `<div class="card">
      <input type="search" id="sq" placeholder="Search by name…" oninput="sqFilter()" style="margin-bottom:12px">
      <div class="tw"><table><thead><tr><th>Name</th><th class="n">Balance</th></tr></thead><tbody id="smbody">${L.map((x, i) => `<tr class="click ${sel && sel.n == x.n ? 'sel' : ''}" data-i="${i}" data-q="${esc((x.n + ' ' + (x.sub || '')).toLowerCase())}" onclick="pickStmt(${i})"><td><b>${esc(x.n)}</b>${x.sub ? '<br><small>' + esc(x.sub) + '</small>' : ''}</td><td class="n">${x.s}<br><small>${x.t}</small></td></tr>`).join('') || '<tr><td class="empty" colspan="2">Nothing here yet.</td></tr>'}</tbody></table></div>
    </div>`;
  // the statement below the bar
  const stmt = `<div class="card"><div class="ch">
        <h2>${sel ? 'Statement: ' + esc(sel.n) : 'Statement'}</h2>
        ${sel ? `<div class="fl" style="margin-left:auto">
          <label style="margin:0">From<input type="date" id="sdf" value="${d.from}" onchange="setStmtDates()"></label>
          <label style="margin:0">To<input type="date" id="sdt" value="${d.to}" onchange="setStmtDates()"></label>
        </div>` : ''}
      </div>
      ${sel ? '<div id="smain"><p class="sub">Loading…</p></div>'
            : `<p class="sub" style="margin:0">Pick a ${SK.find(x => x[0] == k)[1].toLowerCase().replace(/s$/, '')} above${open ? ', or click a name in the list' : ' (use “Show list” to browse with balances)'} to see its statement.</p>`}
    </div>`;
  return tabs + bar + list + stmt;
};
