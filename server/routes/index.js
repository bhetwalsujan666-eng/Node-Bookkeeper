// server/routes/index.js — router: runs the route modules in order, 404 / 500 handling
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { send } = require('../http');
const { COMPANY } = require('../settings');
const { load, loadSet } = require('../store');
const data = require('./data');
const vouchers = require('./vouchers');
const receipts = require('./receipts');
const payments = require('./payments');
const salaries = require('./salaries');
const refunds = require('./refunds');
const purchase = require('./purchase');
const sales = require('./sales');
const accounts = require('./accounts');
const parties = require('./parties');
const staff = require('./staff');
const banks = require('./banks');
const settings = require('./settings');
const categories = require('./categories');
const statements = require('./statements');
const xlsx = require('./xlsx');
const migrate = require('./migrate');

const handlers = [data, vouchers, receipts, payments, salaries, refunds, purchase, sales, accounts, parties, staff, banks, settings, categories, statements, xlsx, migrate];

// Every route module exports handle(ctx). A module that answers the request sends a reply, which stops the loop;
// one that does not match just returns, and the next one is tried. If none answers: 404.
async function dispatch(req, res, u, b) {
  try {
    const d = load();
    Object.assign(COMPANY, loadSet().company);
    { const wh = res.writeHead.bind(res); res.writeHead = (c, h = {}) => wh(c, res._saved ? { ...h, 'X-Saved-To': encodeURIComponent(res._saved) } : h); } // tells the browser the file went to the storage folder
    const ctx = { req, res, u, b, d };
    for (const h of handlers) { await h.handle(ctx); if (res.headersSent) return; }
    send(res, 404, { error: 'Not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
}

module.exports = { dispatch };
