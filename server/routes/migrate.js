// server/routes/migrate.js — /api/migrate + /api/rebuild-files
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const fs = require('fs'), path = require('path');
const { pvToPmv, rebuildFiles } = require('../files');
const { send } = require('../http');
const { migratable, migrateSalaries } = require('../posting/salaries');
const { DB, DBF, save } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'GET' && u === '/api/migrate') return send(res, 200, { salaries: migratable(d).map(v => ({ no: v.no, date: v.date, payee: v.pmt.payee, amount: v.pmt.amount })), files: pvToPmv(d).length });
  if (req.method === 'POST' && u === '/api/migrate') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');[DB, DBF].forEach(f => { if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak-' + stamp); });
    const mv = pvToPmv(d); mv.forEach(([a, b]) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.renameSync(a, b); }); const done = migrateSalaries(d); save(d); return send(res, 200, { converted: done.length, moved: mv.length, backup: stamp });
  }
  if (req.method === 'POST' && u === '/api/rebuild-files') { const q = JSON.parse(b || '{}'), r = await rebuildFiles(d, !!q.missing, /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : ''); return send(res, r.error ? 400 : 200, r); }
}

module.exports = { handle };
