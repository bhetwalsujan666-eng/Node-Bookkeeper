// server/routes/data.js — GET /api/data
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { ownerState } = require('../files');
const { send } = require('../http');
const { payables } = require('../posting/payables');
const { receivables } = require('../posting/receivables');
const { FOLDERS } = require('../settings');
const { loadDb, loadSet } = require('../store');
const { paymentPurchases } = require('../posting/purchasebook');
const { registerReview } = require('../posting/review');
const { refundRows } = require('../posting/refunds');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'GET' && u === '/api/data') return send(res, 200, { ...d, db: loadDb(), settings: { ...loadSet(), folders: FOLDERS, folderOwner: ownerState() }, receivables: receivables(d), payables: payables(d), payPurchases: paymentPurchases(d), review: registerReview(d), refundRows: refundRows(d) });
}

module.exports = { handle };
