// server/posting/vatrules.js — shared VAT validation patterns
const PAN_RE = /^\d{9}$/;                          // Nepal PAN/VAT registration number: 9 digits
const BS_RE = /^(20\d\d)[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[0-2])$/; // Bikram Sambat date, e.g. 2083-07-15

module.exports = { BS_RE, PAN_RE };
