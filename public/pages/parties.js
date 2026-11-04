// pages/parties.js — Parties page
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, F, esc, post } from '../lib/dom.js';
import { D, load } from '../lib/state.js';

export async function saveParty() { const j = await post('/api/db/parties', { name: F('dn'), type: F('dt'), pan: F('dp'), address: F('da'), phone: F('dph'), email: F('de') }); if (j) load(); }

export const editParty = i => { const p = D.db.parties[i];['dn:name', 'dt:type', 'dp:pan', 'da:address', 'dph:phone', 'de:email'].forEach(x => { const [id, k] = x.split(':'); $('#' + id).value = p[k] || ''; }); scrollTo(0, 0); };

export async function delParty(i) { if (confirm('Remove this party from the database? Ledgers and bills are not affected.')) { await fetch('/api/db/parties/' + encodeURIComponent(D.db.parties[i].name), { method: 'DELETE' }); load(); } }

export const parties = () => `<p class="sub">Suppliers and customers saved here fill in automatically on the bill forms. New names are added when you save a bill.</p>
    <div class="card"><div class="row">${['dn:Name:w2', 'dp:PAN/VAT no.', 'da:Address:w2', 'dph:Phone', 'de:Email'].map(x => { const [i, l, c] = x.split(':'); return `<label class="${c || ''}">${l}<input id="${i}"></label>`; }).join('')}<label>Type<select id="dt"><option value="supplier">Supplier</option><option value="customer">Customer</option><option value="both">Both</option></select></label>
    <button class="p" onclick="saveParty()">Save / update</button></div></div>
    <div class="card"><div class="tw"><table><tr><th>Name</th><th>Type</th><th>PAN/VAT</th><th>Address</th><th>Phone</th><th>Email</th><th></th></tr>${D.db.parties.map((p, i) => `<tr><td><b>${esc(p.name)}</b></td><td><span class="chip">${esc(p.type)}</span></td><td>${esc(p.pan)}</td><td>${esc(p.address)}</td><td>${esc(p.phone)}</td><td>${esc(p.email)}</td><td class="act"><button onclick="editParty(${i})">Edit</button><button class="d" title="Remove" onclick="delParty(${i})">Delete</button></td></tr>`).join('') || '<tr><td class="empty" colspan="7">No parties yet. They are added when you save a bill, or fill the form above.</td></tr>'}</table></div></div>`;
