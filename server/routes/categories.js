// server/routes/categories.js — /api/categories
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { catName } = require('../accounts');
const { send } = require('../http');
const { loadSet, saveSet } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (u.startsWith('/api/categories')) {
    const s = loadSet();
    if (req.method === 'POST') {
      const raw = String(JSON.parse(b).name || '').trim(); if (!raw) return send(res, 400, { error: 'Enter a category name' }); const n = catName(raw);
      if (!s.categories.some(c => c.toLowerCase() === n.toLowerCase())) s.categories.push(n);
    }
    else if (req.method === 'DELETE') { const n = decodeURIComponent(u.split('/').pop()).toLowerCase(); s.categories = s.categories.filter(c => c.toLowerCase() !== n); }
    s.hotelCats = true; saveSet(s); return send(res, 200, s.categories);
  }
}

module.exports = { handle };
