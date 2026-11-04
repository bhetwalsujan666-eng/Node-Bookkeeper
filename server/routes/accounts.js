// server/routes/accounts.js — /api/accounts CRUD
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { send } = require('../http');
const { save } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'POST' && u === '/api/accounts') {
    const a = JSON.parse(b);
    if (!a.code || !a.name || !'ALEIX'.includes(a.type)) return send(res, 400, { error: 'Code, name and type required' });
    if (d.accounts.some(x => x.code === a.code)) return send(res, 400, { error: 'Code already exists' });
    d.accounts.push({ code: a.code, name: a.name, type: a.type, group: a.group || a.name }); save(d); return send(res, 200, {});
  }
  if (req.method === 'DELETE' && u.startsWith('/api/accounts/')) {
    const c = u.split('/').pop();
    if (d.vouchers.some(v => v.lines.some(l => l.account === c))) return send(res, 400, { error: 'This account has entries. Delete those vouchers first.' });
    d.accounts = d.accounts.filter(a => a.code !== c); save(d); return send(res, 200, {});
  }
}

module.exports = { handle };
