// server/routes/parties.js — /api/db/<collection> (parties and any other master list except staff)
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { send } = require('../http');
const { SCHEMA, loadDb, saveDb, upsert } = require('../store');

const makeHandler = accept => async function handle({ req, res, u, b, d }) {
  const dm = u.match(/^\/api\/db\/(\w+)(?:\/(.+))?$/);
  if (dm && SCHEMA[dm[1]] && accept(dm[1])) {
    if (req.method === 'POST') { const e = upsert(dm[1], JSON.parse(b)); return e ? send(res, 200, e) : send(res, 400, { error: SCHEMA[dm[1]].key + ' is required' }); }
    if (req.method === 'DELETE' && dm[2]) { const db = loadDb(), k = decodeURIComponent(dm[2]).toLowerCase(), key = SCHEMA[dm[1]].key; db[dm[1]] = db[dm[1]].filter(r => String(r[key]).toLowerCase() !== k); saveDb(db); return send(res, 200, {}); }
  }
};

module.exports = { handle: makeHandler(n => n !== 'staff'), makeHandler };
