// server/routes/staff.js — /api/db/staff
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const { makeHandler } = require('./parties');

module.exports = { handle: makeHandler(n => n === 'staff') };
