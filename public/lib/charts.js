// lib/charts.js — plain SVG/HTML charts
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { esc } from './dom.js';
import { K, PAL, f } from './format.js';

export const hbars = (items, col = 'var(--pine)') => { const mx = Math.max(...items.map(i => Math.abs(i.v)), 1); return items.length ? items.map(i => `<div class="hb" title="${esc(i.l)}: ${f(i.v)}"><span>${esc(i.l)}</span><div><i style="width:${Math.max(Math.abs(i.v) / mx * 100, 1.5)}%;background:${col}"></i></div><b>${K(i.v)}</b>${i.s ? `<small>${esc(i.s)}</small>` : ''}</div>`).join('') : '<p class="sub" style="margin:0">Nothing to show for this period.</p>'; };

export function barChart(labels, series) {
  const W = 720, H = 250, L = 50, B = 26, T = 10, all = series.flatMap(s => s.vals), mx = Math.max(...all, 1), mn = Math.min(...all, 0), raw = (mx - mn) / 4, p = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(x => x * p).find(x => x >= raw), top = Math.ceil(mx / step) * step, bot = Math.floor(mn / step) * step;
  const y = v => T + (top - v) / ((top - bot) || 1) * (H - T - B), gw = (W - L - 8) / labels.length, bw = Math.min(26, gw * .8 / series.length);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" style="width:100%;height:auto;display:block">`;
  for (let v = bot; v <= top + 1e-9; v += step) s += `<line x1="${L}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="#E4E2DB"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#656A77">${K(v)}</text>`;
  labels.forEach((lb, i) => {
    const x0 = L + i * gw + (gw - bw * series.length) / 2;
    series.forEach((se, j) => { const v = se.vals[i]; s += `<rect x="${x0 + j * bw}" y="${Math.min(y(v), y(0))}" width="${bw - 2}" height="${Math.abs(y(v) - y(0))}" rx="2" fill="${v < 0 ? '#B42318' : se.color}"><title>${esc(lb)} · ${esc(se.name)}: ${f(v)}</title></rect>`; });
    s += `<text x="${L + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#656A77">${esc(lb)}</text>`;
  });
  return s + '</svg>' + (series.length > 1 ? `<div class="lg">${series.map(x => `<span><i style="background:${x.color}"></i>${esc(x.name)}</span>`).join('')}</div>` : '');
}

export function donut(items) {
  const tot = items.reduce((s, i) => s + i.v, 0); if (!tot) return '<p class="sub" style="margin:0">Nothing to show for this period.</p>'; let off = 25;
  const arcs = items.map((i, k) => { const q = i.v / tot * 100, a = `<circle r="15.915" cx="21" cy="21" fill="none" stroke="${PAL[k % PAL.length]}" stroke-width="7" stroke-dasharray="${q} ${100 - q}" stroke-dashoffset="${off}"><title>${esc(i.l)}: ${f(i.v)} (${q.toFixed(1)}%)</title></circle>`; off -= q; return a; }).join('');
  return `<div class="dn"><svg viewBox="0 0 42 42" width="170" height="170" role="img">${arcs}<text x="21" y="22.5" text-anchor="middle" font-size="4.2" font-weight="600" fill="#1E2230">${K(tot)}</text></svg><div>${items.map((i, k) => `<div class="lgi"><i style="background:${PAL[k % PAL.length]}"></i>${esc(i.l)}<b>${(i.v / tot * 100).toFixed(0)}%</b></div>`).join('')}</div></div>`;
}
