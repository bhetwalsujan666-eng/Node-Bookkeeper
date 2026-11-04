// pages/index.js — V = { page renderers } assembled from the page modules
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import { coa } from './accounts.js';
import { bills } from './bills.js';
import { dash } from './dashboard.js';
import { daybook } from './daybook.js';
import { ledger } from './ledger.js';
import { parties } from './parties.js';
import { pay } from './payments.js';
import { rcv } from './receipts.js';
import { rec } from './records.js';
import { reg } from './registers.js';
import { sal } from './salary.js';
import { settings } from './settings.js';
import { stmt } from './statements.js';
import { bs, pl, tb } from './trial.js';
import { cashbook } from './cashbook.js';
import { refunds } from './refunds.js';
import { voucher } from './voucher.js';

// pick by typed name (datalist). Resolves to the exact stored name.
export const pickByName = (list, val, setter) => {
  const hit = list.find(x => x.name.toLowerCase() === String(val).trim().toLowerCase());
  if (hit && hit.name !== setter.current) setter.set(hit.name);
};

export const V = {
  pickByName,
  stmt,
  dash,
  rec,
  sal,
  parties,
  settings,
  rcv,
  pay,
  reg,
  bills,
  voucher,
  daybook,
  ledger,
  tb,
  pl,
  bs,
  coa,
  cash: cashbook,
  refund: refunds
};
