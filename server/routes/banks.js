// server/routes/banks.js — /api/banks + /api/bank-match + /api/bank-split
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const fs = require('fs');
const { nextBankCode, nkey } = require('../accounts');
const { bankAcctName, bankMatch, fmtBad, fmtBoth, fmtParts, splitApply, splitPlan, splitScan } = require('../banks');
const { jvXlsx } = require('../excel/voucher');
const { refresh, vFile } = require('../files');
const { send } = require('../http');
const { DB, loadDb, save, saveDb } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (u.startsWith('/api/banks')) {
    const db = loadDb(), code = decodeURIComponent(u.split('/')[3] || ''), me = db.banks.find(x => x.ledger === code);
    if (req.method === 'DELETE') {
      if (!me) return send(res, 404, { error: 'Bank account not found' });
      const used = d.vouchers.some(v => v.lines.some(l => l.account === code)); db.banks = db.banks.filter(x => x !== me); saveDb(db);
      if (!me.linked && !used) { d.accounts = d.accounts.filter(a => a.code !== code); save(d); } return send(res, 200, { kept: !!(me.linked || used) });
    } // a ledger account that has entries (or that existed before) is kept
    if (req.method === 'POST' || req.method === 'PUT') {
      const x = JSON.parse(b), bank = String(x.bank || '').trim(), account = String(x.account || '').trim(), fmt = String(x.chequeFormat || '').trim();
      if (req.method === 'PUT' && !me) return send(res, 404, { error: 'Bank account not found' });
      if (!bank) return send(res, 400, { error: 'Enter the bank name' }); if (fmt && fmtBad(fmt)) return send(res, 400, { error: fmtBad(fmt) });
      const name = bank + (account ? ' - ' + account : ''), others = db.banks.filter(y => y !== me), chq = [...new Set(fmtParts(fmt).map(p => p.s))].join(', ');
      if (others.some(y => nkey(y.name) === nkey(name))) return send(res, 400, { error: 'That bank account is already in the list' });
      const clash = others.find(y => fmtParts(chq).some(a => fmtParts(y.chequeFormat).some(z => fmtBoth(a, z)))); if (clash) return send(res, 400, { error: `That cheque format overlaps with ${clash.name} (${clash.chequeFormat}), so a cheque number could not be matched to one bank.` });
      if (me) {
        const acct = d.accounts.find(a => a.code === code), nn = bankAcctName(name);
        if (!me.linked && acct && acct.name !== nn) {
          if (d.accounts.some(a => a !== acct && nkey(a.name) === nkey(nn))) return send(res, 400, { error: 'An account called "' + nn + '" already exists' });
          d.vouchers.forEach(v => v.lines.forEach(l => { if (l.account === code && l.desc === acct.name) l.desc = nn; })); acct.name = nn;
        } // keep old vouchers' wording in step
        Object.assign(me, { name, bank, account, chequeFormat: chq }); save(d); saveDb(db); return send(res, 200, me);
      }
      let acct; if (x.ledger) {
        acct = d.accounts.find(a => a.code === String(x.ledger) && a.type === 'A');
        if (!acct || !(/cash|bank|fonepay|wallet/i.test(acct.name) || acct.group === 'Bank Accounts')) return send(res, 400, { error: 'Choose an existing bank account from the list' }); if (db.banks.some(y => y.ledger === acct.code)) return send(res, 400, { error: 'That ledger account is already used by another bank account' });
      }
      else {
        const nn = bankAcctName(name); if (d.accounts.some(a => nkey(a.name) === nkey(nn))) return send(res, 400, { error: 'An account called "' + nn + '" already exists. Pick it under "Ledger account" instead of creating a new one.' });
        acct = { code: nextBankCode(d), name: nn, type: 'A', group: 'Bank Accounts' }; d.accounts.push(acct);
      }
      const rec = { name, bank, account, chequeFormat: chq, ledger: acct.code, linked: !!x.ledger }; db.banks.push(rec); save(d); saveDb(db); return send(res, 200, rec);
    }
  }
  if (u === '/api/bank-match') {
    if (req.method === 'GET') return send(res, 200, bankMatch(d));
    if (req.method === 'POST') {
      const m = bankMatch(d), stamp = new Date().toISOString().replace(/[:.]/g, '-'); if (!m.change.length) return send(res, 200, { moved: 0, files: 0, backup: null });
      fs.copyFileSync(DB, DB + '.bak-' + stamp); const done = [];
      m.change.forEach(r => {
        const v = d.vouchers.find(y => y.id === r.id), p = v && (v.pmt || v.sal); if (!p) return; let hit = false;
        v.lines.forEach(l => { if (l.account === p.account && l.cr > 0) { l.account = r.toCode; l.desc = r.to; hit = true; } }); if (hit) { p.account = r.toCode; done.push(v); }
      }); // only the "paid from" side of the voucher moves; amounts and dates stay
      save(d); let files = 0; for (const v of done) if (await refresh(vFile(v), async () => jvXlsx(v, d).xlsx.writeBuffer(), true)) files++; // refresh voucher Excel files that already exist
      return send(res, 200, { moved: done.length, skipped: m.change.length - done.length, files, backup: stamp });
    }
  }
  if (u === '/api/bank-split') {
    if (req.method === 'GET') return send(res, 200, splitScan(d));
    if (req.method === 'POST') {
      const items = JSON.parse(b).items; if (!Array.isArray(items) || !items.length) return send(res, 400, { error: 'Nothing to split' });
      const pl = splitPlan(d, items); if (pl.error) return send(res, 400, pl); const stamp = new Date().toISOString().replace(/[:.]/g, '-'); fs.copyFileSync(DB, DB + '.bak-' + stamp);
      const done = splitApply(d, pl.plan); save(d); let files = 0; for (const v of done) if (await refresh(vFile(v), async () => jvXlsx(v, d).xlsx.writeBuffer(), true)) files++; // refresh voucher Excel files that already exist
      return send(res, 200, { split: done.length, files, backup: stamp });
    }
  }
}

module.exports = { handle };
