// server/store.js — data.json / db.json / settings.json load + save, master-data lists
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const fs = require('fs'), path = require('path');
const { EXTRA, seed } = require('./accounts');
const { COMPANY_DEFAULT, HOTEL_CATS } = require('./settings');

const ROOT = path.join(__dirname, '..'); // project folder (data.json, db.json, settings.json and templates/ live here)

const DB = path.join(ROOT, 'data.json');

const SETF = path.join(ROOT, 'settings.json');

const loadSet = () => { let s = {}; try { s = JSON.parse(fs.readFileSync(SETF)); } catch { } return { folder: s.folder || '', auto: { jv: true, pv: true, pmv: true, stm: true, sv: true, rv: true, registers: true, tb: true, pl: true, bs: true, ...s.auto }, company: { ...COMPANY_DEFAULT, ...s.company }, hotelCats: !!s.hotelCats, categories: (() => { const base = s.categories || ['Ticket', 'Hotel', 'Food', 'Other']; return s.hotelCats ? base : [...base, ...HOTEL_CATS.filter(c => !base.some(b => b.toLowerCase() === c.toLowerCase()))]; })() }; };

// ---- Master data (db.json): reusable entries. To add a collection (items, banks, ...) add it to SCHEMA; the /api/db/<name> routes then work for it. ----
const DBF = path.join(ROOT, 'db.json');

const SCHEMA = { parties: { key: 'name', fields: ['name', 'type', 'pan', 'address', 'phone', 'email'] }, staff: { key: 'name', fields: ['name', 'designation', 'phone', 'ledger'] }, banks: { key: 'name', fields: ['name', 'bank', 'account', 'chequeFormat', 'ledger', 'linked'] } }; // banks are managed through /api/banks (each one also needs a ledger account) // type: supplier | customer | both

const loadDb = () => { let x; try { x = JSON.parse(fs.readFileSync(DBF)); } catch { x = { version: 1 }; } for (const c in SCHEMA) x[c] = x[c] || []; return x; };

const saveDb = x => fs.writeFileSync(DBF, JSON.stringify(x, null, 1));

function upsert(coll, rec) {
  const db = loadDb(), S = SCHEMA[coll], k = String(rec[S.key] || '').trim(); if (!k) return null;
  let e = db[coll].find(r => String(r[S.key]).toLowerCase() === k.toLowerCase()); if (!e) db[coll].push(e = { [S.key]: k });
  S.fields.forEach(f => { if (rec[f] !== undefined && f !== S.key) e[f] = rec[f]; }); saveDb(db); return e;
}

const touchParty = (name, pan, role) => {
  name = (name || '').trim(); if (!name) return; const db = loadDb(); let e = db.parties.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (!e) db.parties.push(e = { name, type: role, pan: '', address: '', phone: '', email: '' }); else if (e.type !== role) e.type = 'both';
  if (pan && !e.pan) e.pan = pan; saveDb(db);
};

const saveSet = s => fs.writeFileSync(SETF, JSON.stringify(s, null, 1));

const load = () => {
  let d; try { d = JSON.parse(fs.readFileSync(DB)); } catch { d = { accounts: seed.map(([code, name, type, group]) => ({ code, name, type, group })), vouchers: [], seq: {} }; }
  d.bills = d.bills || []; EXTRA.forEach(([code, name, type, group]) => { if (!d.accounts.some(a => a.code === code)) d.accounts.push({ code, name, type, group }); }); return d;
};

const save = d => fs.writeFileSync(DB, JSON.stringify(d, null, 1));

module.exports = { DB, DBF, ROOT, SCHEMA, SETF, load, loadDb, loadSet, save, saveDb, saveSet, touchParty, upsert };
