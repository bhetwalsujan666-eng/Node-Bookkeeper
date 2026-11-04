// lib/dom.js — DOM helpers, toast, downloads, API post(), sidebar and table-scrollbar behaviour
// (split out of the old single-file index.html by migrate.js; code is unchanged)

export const $ = s => document.querySelector(s);

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const badAD = d => d && +d.slice(0, 4) > 2060 && (alert('The Date (AD) field says year ' + d.slice(0, 4) + ', which looks like a BS date. Put the English (AD) date there and type the BS date in the BS field.'), true);

export const toast = (m, k) => { const t = $('#toast'); t.innerHTML = esc(m) + (k ? '<br><a href="#" style="color:#fff;font-weight:600" onclick="goRec(\'' + k + '\');return false">View in Records →</a>' : ''); t.style.display = 'block'; clearTimeout(window.tt); window.tt = setTimeout(() => t.style.display = 'none', 7000); };

export async function getFile(url) {
  const r = await fetch(url); if (!r.ok) return alert((await r.json()).error || 'Download failed');
  const saved = r.headers.get('X-Saved-To'); if (saved) return toast('Saved to ' + decodeURIComponent(saved));
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = (/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition')) || [])[1] || 'file.xlsx'; a.click();
  toast("Downloaded by the browser. Set a storage folder (and keep its switch on) in Settings to save elsewhere.");
}

export const F = id => $('#' + id).value;

export const N = id => +F(id) || 0;

export async function post(url, body, method = 'POST') { if (badAD(body.date)) return null; const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) { alert(j.error); return null; } return j; }

export function filt(inp, tbody) { const q = inp.value.trim().toLowerCase(); document.querySelectorAll('#' + tbody + ' tr[data-q]').forEach(r => r.hidden = !!q && !r.dataset.q.includes(q)); }

// ---- Collapsible sidebar: wide screens remember the choice; narrow screens start collapsed ----
export const NARROW = matchMedia('(max-width:1180px)');

export let sideTmp = null; // temporary choice on a narrow screen (not remembered)

export const sideStore = {
  get() { try { return localStorage.getItem('sideCollapsed') === '1'; } catch (e) { return false; } },
  set(v) { try { localStorage.setItem('sideCollapsed', v ? '1' : '0'); } catch (e) { } }
};

export let sideForce = null; // a page (e.g. an open VAT register) can force the sidebar closed

export const setSideForce = v => (sideForce = v);

export function applySide() {
  const c = sideForce ?? (NARROW.matches ? (sideTmp ?? true) : sideStore.get()), b = $('#sbtog'), lbl = c ? 'Expand menu' : 'Collapse menu';
  document.querySelector('.app').classList.toggle('sc', c);
  b.setAttribute('aria-expanded', String(!c)); b.title = lbl; b.setAttribute('aria-label', lbl);
}

export function toggleSide() { sideForce = null; const c = document.querySelector('.app').classList.contains('sc'); if (NARROW.matches) sideTmp = !c; else sideStore.set(!c); applySide(); }

// ---- Scrollbar above any table wider than its card, mirrored with the one below ----
export const twRO = new ResizeObserver(es => es.forEach(e => syncTW(e.target.closest('.tw'))));

export function syncTW(tw) {
  if (!tw || !tw.isConnected) return;
  let bar = tw.previousElementSibling;
  if (!bar || !bar.classList.contains('tws')) {
    bar = document.createElement('div'); bar.className = 'tws'; bar.hidden = true; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<div></div>'; tw.before(bar);
    bar.addEventListener('scroll', () => { if (Math.abs(tw.scrollLeft - bar.scrollLeft) >= 1) tw.scrollLeft = bar.scrollLeft; });
    tw.addEventListener('scroll', () => { if (Math.abs(tw.scrollLeft - bar.scrollLeft) >= 1) bar.scrollLeft = tw.scrollLeft; });
    twRO.observe(tw); const t = tw.querySelector('table'); if (t) twRO.observe(t);
  }
  const wide = tw.scrollWidth > tw.clientWidth + 1; bar.hidden = !wide;
  if (wide) { bar.firstChild.style.width = tw.scrollWidth + 'px'; bar.scrollLeft = tw.scrollLeft; }
}

export let twQueued = false;

export const syncAllTW = () => { if (twQueued) return; twQueued = true; requestAnimationFrame(() => { twQueued = false; document.querySelectorAll('#m .tw').forEach(syncTW); }); };

export const setSideTmp = v => (sideTmp = v);
