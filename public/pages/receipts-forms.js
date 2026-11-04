// pages/receipts-forms.js — Payments received actions
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { $, F, N, post, toast } from '../lib/dom.js';
import { D, cashAccs, load, render } from '../lib/state.js';

export function newPay() { window.rnew = true; window.rc = null; window.er = null; window.rpre = null; render(); scrollTo(0, 0); }

export function rcrChg() { $('#rcnw').hidden = !!F('rcr'); }

export async function saveNewReceipt() {
  const er = window.er, cr = F('rcr'), body = { customer: cr ? '' : F('rcn'), creditAccount: cr, payer: F('rpy'), date: F('rdt'), bs: F('rbs'), amount: N('ram'), mode: F('rmo'), account: F('rac'), instrument: F('rin'), note: F('rnt') };
  const j = await post(er ? '/api/receipts/' + er.id : '/api/receipts', body, er ? 'PUT' : 'POST'); if (!j) return; window.er = null; window.rpre = null; window.rnew = false; window.rc = cr ? null : body.customer; await load();
  toast('Payment ' + j.no + (er ? ' updated' : ' recorded') + (j.saved ? '\nSaved to ' + j.saved : ''), 'received');
}

export function pickCust(i) { window.rnew = false; window.rc = D.receivables[i].name; window.er = null; window.rpre = null; render(); if (window.matchMedia && matchMedia('(max-width:1000px)').matches) $('#cdet').scrollIntoView(); }

export function rmode() { const want = { Cash: ['cash'], Cheque: ['bank'], Fonepay: ['fonepay', 'bank'], 'Bank transfer': ['bank'] }[$('#rmo').value] || []; for (const w of want) { const a = cashAccs().find(x => x.name.toLowerCase().includes(w)); if (a) { $('#rac').value = a.code; break; } } }

export function rcvBill(id, due) { window.er = null; window.rpre = { billId: id, amount: due }; render(); $('#ram').focus(); }

export async function saveReceipt() {
  const er = window.er, body = { customer: window.rc, date: F('rdt'), bs: F('rbs'), amount: N('ram'), mode: F('rmo'), account: F('rac'), instrument: F('rin'), billId: F('rbl') || null, note: F('rnt'), payer: er && er.rcpt.payer || '' };
  const j = await post(er ? '/api/receipts/' + er.id : '/api/receipts', body, er ? 'PUT' : 'POST'); if (!j) return; window.er = null; window.rpre = null; await load();
  toast('Payment ' + j.no + (er ? ' updated' : ' recorded') + (j.saved ? '\nSaved to ' + j.saved : ''), 'received');
}

export function pickCustByName(v) { const c = D.receivables.find(x => x.name.toLowerCase() === String(v).trim().toLowerCase()); if (c && c.name !== window.rc) { window.rc = c.name; window.rnew = false; window.er = null; render(); } }
