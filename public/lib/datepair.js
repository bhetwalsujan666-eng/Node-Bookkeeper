// lib/datepair.js — keeps every AD date field and its BS twin in step, so you can type EITHER one.
// Type or pick the English (AD) date and the Nepali (BS) date fills in; type the BS date (2083-07-17, 2083/7/17) and the AD date fills in.
// Works for every date pair in the app without touching the pages: bills, receipts, payments, salary, voucher and the Cash book rows.
import { ad2bs, bs2ad, bsNorm } from './nepdate.js';

const PAIRS = { pd: 'pbs', sd: 'sbs', rdt: 'rbs', ydt: 'ybs', ldt: 'lbs', vd: 'vb', rfd: 'rfbs', cbd: 'cbbs' }; // AD input id -> BS input id
const REV = Object.fromEntries(Object.entries(PAIRS).map(([a, b]) => [b, a])), G = id => document.getElementById(id);

const twin = el => {
  if (PAIRS[el.id]) return { ad: el, bs: G(PAIRS[el.id]) };
  if (REV[el.id]) return { ad: G(REV[el.id]), bs: el };
  const tr = el.closest && el.closest('tr'); // Cash book rows
  if (tr && el.classList.contains('cd')) return { ad: el, bs: tr.querySelector('.cb2') };
  if (tr && el.classList.contains('cb2')) return { ad: tr.querySelector('.cd'), bs: el };
  return null;
};

function onEdit(e) {
  const el = e.target; if (!(el instanceof HTMLInputElement)) return; const t = twin(el); if (!t || !t.ad || !t.bs) return;
  if (el === t.ad) { const b = ad2bs(el.value); if (b) { t.bs.value = b; t.bs.style.borderColor = ''; t.bs.title = ''; } return; }
  const v = el.value.trim(); if (!v) { el.style.borderColor = ''; return; }
  const n = bsNorm(v);
  if (n) { t.ad.value = bs2ad(n); el.style.borderColor = ''; el.title = ''; if (e.type == 'change') el.value = n; } // tidy 2083/7/5 into 2083-07-05 once you leave the field
  else if (e.type == 'change') { el.style.borderColor = '#B42318'; el.title = 'Not a valid BS date. Use yyyy-mm-dd, for example 2083-07-17'; }
}

document.addEventListener('input', onEdit);
document.addEventListener('change', onEdit);

// A form that opens with today's AD date and an empty BS box gets the BS date filled in (existing BS dates are never overwritten)
const fill = () => { for (const [a, b] of Object.entries(PAIRS)) { const A = G(a), B = G(b); if (A && B && A.value && !B.value) B.value = ad2bs(A.value); } };
const m = document.getElementById('m'); if (m) new MutationObserver(fill).observe(m, { childList: true, subtree: true });
