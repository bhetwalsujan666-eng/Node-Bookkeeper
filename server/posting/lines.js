// server/posting/lines.js — voucher numbering and posting: cleanLines(), PFX, post(), resync()
// (split out of the old single-file server.js by migrate.js; code is unchanged)

const post = (d, type, date, bs, ref, narration, lines) => {
  const p = PFX[type]; d.seq[p] = (d.seq[p] || 0) + 1;
  const v = { type, date, bs, ref, narration, lines: lines.filter(l => l.dr || l.cr), no: p + '-' + String(d.seq[p]).padStart(4, '0'), id: Date.now() + d.vouchers.length }; d.vouchers.push(v); return v;
};

// After deletions, numbering continues from the highest remaining number (so deleting the latest entries frees their numbers)
const resync = d => { const m = {}; d.vouchers.forEach(v => { const [p, n] = v.no.split('-'); m[p] = Math.max(m[p] || 0, +n); }); Object.values(PFX).forEach(p => { d.seq[p] = m[p] || 0; }); d.seq.SB = d.bills.filter(b => b.kind === 'sales').reduce((a, b) => Math.max(a, parseInt(b.billNo) || 0), 0); };

// ---- Shared validation / posting rules, used by both "create" and "edit" ----
function cleanLines(d, raw) {
  const lines = (raw || []).filter(l => l.account && (+l.dr || +l.cr)).map(l => ({ account: l.account, dr: +l.dr || 0, cr: +l.cr || 0 }));
  if (lines.length < 2) return { error: 'At least two lines needed' };
  const bad = lines.find(l => !d.accounts.some(a => a.code === l.account)); if (bad) return { error: 'Unknown account: ' + bad.account };
  const dr = lines.reduce((t, l) => t + l.dr, 0), cr = lines.reduce((t, l) => t + l.cr, 0);
  if (Math.abs(dr - cr) > 0.005) return { error: `Debit (${dr}) and credit (${cr}) must be equal` };
  return { lines };
}

const PFX = { Journal: 'JV', Payment: 'PV', Receipt: 'RV', Purchase: 'PB', Sales: 'SV', Contra: 'CV' };

module.exports = { PFX, cleanLines, post, resync };
