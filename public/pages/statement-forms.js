// pages/statement-forms.js — Statements page actions
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, F, esc } from '../lib/dom.js';
import { f } from '../lib/format.js';
import { render } from '../lib/state.js';
import { stmtDates } from './statements.js';

export function pickStmt(i) { window.stn = window.stl[i].n; window.stlist = false; render(); }

export function sqFilter() {
  const q = $('#sq').value.trim().toLowerCase().split(/\s+/).filter(Boolean); let vis = [];
  document.querySelectorAll('#smbody tr[data-q]').forEach(r => { const ok = q.every(w => r.dataset.q.includes(w)); r.hidden = !ok; if (ok) vis.push(r); });
  if (q.length && vis.length == 1 && window.stl[+vis[0].dataset.i].n != window.stn) { const v = $('#sq').value; window.stn = window.stl[+vis[0].dataset.i].n; render(); const e = $('#sq'); e.value = v; e.focus(); e.setSelectionRange(v.length, v.length); sqFilter(); }
} // exactly one match: show its statement

export function setStmtDates() { window.stf = F('sdf'); window.stt = F('sdt'); render(); }

export function stmtUrl(x) { const d = stmtDates(); return `/api/${x}pstatement/${window.stk || 'supplier'}?name=${encodeURIComponent(window.stn)}&from=${d.from}&to=${d.to}`; }

export async function loadStmt() {
  const box = $('#smain'); if (!box || !window.stn) return; const want = window.stn + '|' + stmtDates().from + '|' + stmtDates().to, r = await fetch(stmtUrl('')); if (!$('#smain') || want != window.stn + '|' + stmtDates().from + '|' + stmtDates().to) return;
  const S = await r.json(); if (!r.ok) { box.innerHTML = '<p class="sub">' + esc(S.error) + '</p>'; return; }
  box.innerHTML = `<div class="vat" style="margin:0 0 12px"><div><span>Opening balance</span><b>${f(S.opening)}</b></div><div><span>${esc(S.cols.a)}</span><b>${f(S.a)}</b></div><div><span>${esc(S.cols.b)}</span><b>${f(S.b)}</b></div><div class="net"><span>Closing balance</span><b>${f(S.closing)}</b></div></div>
  <div class="tw"><table><thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="n">${esc(S.cols.a)}</th><th class="n">${esc(S.cols.b)}</th><th class="n">${esc(S.cols.bal)}</th></tr></thead><tbody>
  <tr><td></td><td></td><td><i>Opening balance</i></td><td></td><td></td><td class="n">${f(S.opening)}</td></tr>${S.rows.map(e => `<tr><td>${e.date}${e.bs ? '<br><small>' + esc(e.bs) + '</small>' : ''}</td><td><b>${esc(e.no)}</b>${e.ref ? '<br><small>' + esc(e.ref) + '</small>' : ''}</td><td>${esc(e.text)}</td><td class="n">${e.a ? f(e.a) : ''}</td><td class="n">${e.b ? f(e.b) : ''}</td><td class="n">${f(e.bal)}</td></tr>`).join('') || '<tr><td class="empty" colspan="6">No entries in this period.</td></tr>'}</tbody></table></div>`;
}

export function pickStmtByName(v) { const i = (window.stl || []).findIndex(x => x.n === String(v).trim()); if (i >= 0 && window.stl[i].n !== window.stn) { window.stn = window.stl[i].n; render(); } }
