// server/routes/statements.js — /api/pstatement/:kind + /api/xlsx/pstatement/:kind
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { STM_LABEL, pstatementXlsx, stmtData } = require('../excel/statements');
const { autoStore, safeName } = require('../files');
const { send } = require('../http');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'GET' && (u.startsWith('/api/pstatement/') || u.startsWith('/api/xlsx/pstatement/'))) {
    const xl = u.startsWith('/api/xlsx/'), kind = u.split('/').pop(), q = new URL(req.url, 'http://x').searchParams, from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31', S = stmtData(d, kind, q.get('name') || '', from, to);
    if (!S) return send(res, 404, { error: 'No such ' + (STM_LABEL[kind] || 'account').toLowerCase() }); if (!xl) return send(res, 200, S);
    const buf = await pstatementXlsx(S).xlsx.writeBuffer(), fname = `${STM_LABEL[kind]}_${safeName(S.name)}_${from}_${to}.xlsx`; res._saved = autoStore('stm', 'Statements', fname, buf);
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` }); return res.end(Buffer.from(buf));
  }
}

module.exports = { handle };
