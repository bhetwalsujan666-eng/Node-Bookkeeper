// server/accounts.js — chart-of-accounts seed and small accounting helpers
// (split out of the old single-file server.js by migrate.js; code is unchanged)

// [code, name, type (A/L/E/I/X), group]
const seed = [
  ['1000', 'Cash in Hand', 'A', 'Current Assets'], ['1010', 'Bank Account', 'A', 'Current Assets'],
  ['1020', 'Sundry Debtors (Customers)', 'A', 'Current Assets'], ['1030', 'Advance to Suppliers (Airlines/Hotels)', 'A', 'Current Assets'],
  ['1040', 'TDS Receivable', 'A', 'Current Assets'], ['1050', 'VAT Receivable (Input VAT)', 'A', 'Current Assets'],
  ['1060', 'Prepaid Expenses', 'A', 'Current Assets'], ['1100', 'Furniture & Fixtures', 'A', 'Fixed Assets'],
  ['1110', 'Computers & Equipment', 'A', 'Fixed Assets'], ['1190', 'Accumulated Depreciation', 'A', 'Fixed Assets'],
  ['2000', 'Sundry Creditors (Airlines/Hotels/Agents)', 'L', 'Current Liabilities'], ['2010', 'Customer Advances (Booking Deposits)', 'L', 'Current Liabilities'],
  ['2020', 'VAT Payable (Output VAT)', 'L', 'Current Liabilities'], ['2030', 'TDS Payable', 'L', 'Current Liabilities'],
  ['2040', 'Salary Payable', 'L', 'Current Liabilities'], ['2050', 'SSF/PF Payable', 'L', 'Current Liabilities'],
  ['2060', 'Accrued Expenses', 'L', 'Current Liabilities'], ['2100', 'Loan Payable', 'L', 'Long-term Liabilities'],
  ['3000', 'Share Capital', 'E', 'Equity'], ['3010', 'Retained Earnings', 'E', 'Equity'],
  ['4000', 'Tour Package Income', 'I', 'Income'], ['4010', 'Air Ticketing Commission', 'I', 'Income'],
  ['4020', 'Hotel Booking Commission', 'I', 'Income'], ['4030', 'Visa & Service Charges', 'I', 'Income'], ['4040', 'Other Income', 'I', 'Income'],
  ['5000', 'Hotel & Accommodation Cost', 'X', 'Direct Costs'], ['5010', 'Transport & Vehicle Hire', 'X', 'Direct Costs'],
  ['5020', 'Guide & Porter Fees', 'X', 'Direct Costs'], ['5030', 'Permits & Entry Fees', 'X', 'Direct Costs'],
  ['6000', 'Salary & Wages', 'X', 'Operating Expenses'], ['6010', 'Office Rent', 'X', 'Operating Expenses'],
  ['6020', 'Electricity & Water', 'X', 'Operating Expenses'], ['6030', 'Telephone & Internet', 'X', 'Operating Expenses'],
  ['6040', 'Marketing & Advertising', 'X', 'Operating Expenses'], ['6050', 'Office Expenses & Stationery', 'X', 'Operating Expenses'],
  ['6060', 'Bank Charges', 'X', 'Operating Expenses'], ['6070', 'Professional & Audit Fees', 'X', 'Operating Expenses'],
  ['6080', 'Depreciation', 'X', 'Operating Expenses'], ['6090', 'Travel & Meals', 'X', 'Operating Expenses']];

const EXTRA = []; // extra accounts to add to older data files (none now: purchase/sales accounts are created per category)

const rd = n => Math.round(n * 100) / 100;

const split = (nonTax, total) => { const g = total - nonTax, taxable = rd(g / 1.13); return { taxable, vat: rd(g - taxable) }; };

const party = (d, name, type, group, from) => {
  let a = d.accounts.find(x => x.group === group && x.name.toLowerCase() === name.toLowerCase());
  if (!a) { const code = String(Math.max(from - 1, ...d.accounts.filter(x => x.group === group).map(x => +x.code)) + 1); a = { code, name, type, group }; d.accounts.push(a); } return a.code;
};

const catName = c => String(c || 'Other').replace(/\s*(purchase|sales)\s*$/i, '').trim() || 'Other'; // "Hotel Purchase" -> "Hotel"

// ---- Excel files that belong to a record. They are rewritten when the record is edited and deleted with it. ----
const nkey = x => String(x || '').trim().toLowerCase();

const nextBankCode = d => { for (let c = 1011; c < 1020; c++) if (!d.accounts.some(a => a.code === String(c))) return String(c); return String(Math.max(...d.accounts.map(a => +a.code || 0).filter(c => c < 2000)) + 1); };

module.exports = { EXTRA, catName, nextBankCode, nkey, party, rd, seed, split };
