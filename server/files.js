// server/files.js — Excel files in the storage folder: ownership, auto-save, rewrite, delete, rebuild
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const fs = require('fs'), path = require('path');
const { invoiceXlsx, purchaseBillXlsx } = require('./excel/invoice');
const { jvXlsx } = require('./excel/voucher');
const { DB, loadSet } = require('./store');

// ---- Which copy of the app owns the storage folder. A marker file (.owner) holds the path of the data.json that uses the folder; a second copy of the project
// (same settings.json, different location) is refused write access, so it cannot overwrite or delete the first copy's Excel files. ----
const OWNER_F = '.owner';

const ownerState = root => { root = root === undefined ? loadSet().folder : root; if (!root) return { ok: true }; try { const m = path.join(path.resolve(root), OWNER_F); if (!fs.existsSync(m)) return { ok: true, fresh: true }; const o = fs.readFileSync(m, 'utf8').trim(); return o === path.resolve(DB) ? { ok: true } : { ok: false, owner: o }; } catch { return { ok: true }; } };

const claimFolder = root => { try { fs.writeFileSync(path.join(path.resolve(root), OWNER_F), path.resolve(DB)); } catch (e) { console.log('Could not mark the storage folder:', e.message); } };

const canWrite = () => { const s = ownerState(); if (s.fresh) claimFolder(loadSet().folder); if (!s.ok) console.log('The storage folder belongs to another copy of the app (' + s.owner + '): not writing files there.'); return s.ok; };

const store = (sub, name, buf) => { if (!canWrite()) throw new Error('the storage folder belongs to another copy of the app'); const dir = path.join(loadSet().folder, sub); fs.mkdirSync(dir, { recursive: true }); const p = path.join(dir, name); fs.writeFileSync(p, Buffer.from(buf)); return p; };

const autoStore = (key, sub, name, buf) => { try { const s = loadSet(); return s.folder && s.auto[key] ? store(sub, name, buf) : null; } catch (e) { console.log('Auto-save failed:', e.message); return null; } };

const autoSaveVoucher = async (v, d) => { const k = vkey(v); if (!k) return null; try { return autoStore(k[0], k[1], v.no + '.xlsx', await jvXlsx(v, d).xlsx.writeBuffer()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };

const autoSaveInvoice = async b => { try { return autoStore('sv', 'SV', 'Invoice_' + String(b.billNo).replace(/[^\w.-]/g, '_') + '.xlsx', await invoiceXlsx(b).xlsx.writeBuffer()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };

const vkey = v => v.type === 'Sales' ? ['sv', 'SV'] : v.type === 'Journal' ? ['jv', 'JV'] : v.type === 'Receipt' ? ['rv', 'RV'] : v.type === 'Payment' ? ['pmv', 'PMV'] : null; // which switch/folder a voucher's Excel goes to

const autoSaveBill = async b => { try { return autoStore('pv', 'PV', 'PurchaseBill_' + String(b.billNo).replace(/[^\w.-]/g, '_') + '.xlsx', await purchaseBillXlsx(b).xlsx.writeBuffer()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };

const safeName = x => String(x).replace(/[^\w.-]/g, '_');

const vFile = v => { const k = vkey(v); return { key: k ? k[0] : 'jv', sub: k ? k[1] : 'JV', name: safeName(v.no) + '.xlsx' }; };

const bFile = b => b.kind === 'purchase' ? { key: 'pv', sub: 'PV', name: 'PurchaseBill_' + safeName(b.billNo) + '.xlsx' } : { key: 'sv', sub: 'SV', name: 'Invoice_' + safeName(b.billNo) + '.xlsx' };

const folderPath = (sub, name) => { const root = loadSet().folder; if (!root || !canWrite()) return null; const r = path.resolve(root), p = path.resolve(r, sub, name); return p.startsWith(r + path.sep) ? p : null; };

const rmFile = (sub, name) => { try { const p = folderPath(sub, name); if (p && fs.existsSync(p)) { fs.unlinkSync(p); return p; } } catch (e) { console.log('Could not delete file:', e.message); } return null; };

const dropVoucher = v => [...new Set([vFile(v).sub, 'JV', ...(v.type === 'Payment' ? ['PV'] : [])])].map(sub => rmFile(sub, vFile(v).name)).filter(Boolean); // JV folder too: older downloads of other voucher types landed there

const dropBill = b => [rmFile(bFile(b).sub, bFile(b).name)].filter(Boolean);

// Rewrite a file after an edit: if it already exists it is refreshed; otherwise it is only created when the auto-save switch is on (and onlyIfExists is false)
const refresh = async (f, make, onlyIfExists) => { try { const p = folderPath(f.sub, f.name); if (p && fs.existsSync(p)) { fs.writeFileSync(p, Buffer.from(await make())); return p; } return onlyIfExists ? null : autoStore(f.key, f.sub, f.name, await make()); } catch (e) { console.log('Auto-save failed:', e.message); return null; } };

const resaveVoucher = async (v, d) => { const r = await refresh(vFile(v), async () => jvXlsx(v, d).xlsx.writeBuffer(), !vkey(v) || d.bills.some(b => b.voucherId === v.id && b.kind === 'sales')); if (v.type === 'Payment') rmFile('PV', vFile(v).name); return r; }; // payment vouchers used to live in PV

const resaveBill = b => refresh(bFile(b), async () => (b.kind === 'purchase' ? purchaseBillXlsx(b) : invoiceXlsx(b)).xlsx.writeBuffer());

// ---- Rebuild the Excel files of vouchers and bills from data.json (for example after another copy of the app overwrote them) ----
async function rebuildFiles(d, createMissing, from) {
  const s = loadSet(); if (!s.folder) return { error: 'Set a storage folder first' }; if (!ownerState().ok) return { error: 'This storage folder belongs to another copy of the app. Save settings and take it over first.' };
  let vouchers = 0, bills = 0; const known = new Set();
  for (const v of d.vouchers) {
    const f = vFile(v); known.add(f.sub + '/' + f.name); if (from && v.date < from) continue; const only = !createMissing || !vkey(v) || d.bills.some(b => b.voucherId === v.id && b.kind === 'sales');
    if (await refresh(f, async () => jvXlsx(v, d).xlsx.writeBuffer(), only)) vouchers++;
  }
  for (const b of d.bills) { const f = bFile(b); known.add(f.sub + '/' + f.name); if (from && b.date < from) continue; if (await refresh(f, async () => (b.kind === 'purchase' ? purchaseBillXlsx(b) : invoiceXlsx(b)).xlsx.writeBuffer(), !createMissing)) bills++; }
  const orphans = []; for (const sub of ['JV', 'PV', 'PMV', 'SV', 'RV']) { try { fs.readdirSync(path.join(path.resolve(s.folder), sub)).forEach(n => { if (/^[A-Z]+-\d+\.xlsx$/i.test(n) && !known.has(sub + '/' + n)) orphans.push(sub + '/' + n); }); } catch { } }
  return { vouchers, bills, orphans: orphans.slice(0, 60), orphanCount: orphans.length };
}

const pvToPmv = d => { const out = []; d.vouchers.filter(v => v.type === 'Payment').forEach(v => { const a = folderPath('PV', safeName(v.no) + '.xlsx'), b = folderPath('PMV', safeName(v.no) + '.xlsx'); if (a && b && fs.existsSync(a) && !fs.existsSync(b)) out.push([a, b]); }); return out; };

module.exports = { autoSaveBill, autoSaveInvoice, autoSaveVoucher, autoStore, claimFolder, dropBill, dropVoucher, ownerState, pvToPmv, rebuildFiles, refresh, resaveBill, resaveVoucher, safeName, vFile, vkey };
