// app.js — entry point: imports everything, exposes handlers, boots
// (split out of the old single-file index.html by migrate.js; code is unchanged)
import * as m_lib_charts from './lib/charts.js';
import * as m_lib_dom from './lib/dom.js';
import * as m_lib_format from './lib/format.js';
import * as m_lib_state from './lib/state.js';
import * as m_pages_accounts from './pages/accounts.js';
import * as m_pages_bills_forms from './pages/bills-forms.js';
import * as m_pages_bills from './pages/bills.js';
import * as m_pages_dashboard from './pages/dashboard.js';
import * as m_pages_daybook from './pages/daybook.js';
import * as m_pages_index from './pages/index.js';
import * as m_pages_ledger from './pages/ledger.js';
import * as m_pages_parties from './pages/parties.js';
import * as m_pages_payments_forms from './pages/payments-forms.js';
import * as m_pages_payments from './pages/payments.js';
import * as m_pages_receipts_forms from './pages/receipts-forms.js';
import * as m_pages_receipts from './pages/receipts.js';
import * as m_pages_records from './pages/records.js';
import * as m_pages_registers from './pages/registers.js';
import * as m_pages_salary_forms from './pages/salary-forms.js';
import * as m_pages_salary from './pages/salary.js';
import * as m_pages_settings from './pages/settings.js';
import * as m_pages_statement_forms from './pages/statement-forms.js';
import * as m_pages_statements from './pages/statements.js';
import * as m_pages_trial from './pages/trial.js';
import * as m_pages_voucher from './pages/voucher.js';
import { $, NARROW, applySide, setSideTmp, syncAllTW } from './lib/dom.js';
import { load } from './lib/state.js';
import * as m_pages_cashbook from './pages/cashbook.js';
import * as m_pages_refunds from './pages/refunds.js';
import './lib/datepair.js';

// Inline handlers (onclick="save()", onchange="...tab...") run in the global scope. The old single <script> put every
// top-level name there, so mirror the same names on window. Page renderers (dash, rec, ...) were never global and are skipped.
const NAMESPACES = [m_pages_refunds, m_pages_cashbook, m_lib_charts, m_lib_dom, m_lib_format, m_lib_state, m_pages_accounts, m_pages_bills_forms, m_pages_bills, m_pages_dashboard, m_pages_daybook, m_pages_index, m_pages_ledger, m_pages_parties, m_pages_payments_forms, m_pages_payments, m_pages_receipts_forms, m_pages_receipts, m_pages_records, m_pages_registers, m_pages_salary_forms, m_pages_salary, m_pages_settings, m_pages_statement_forms, m_pages_statements, m_pages_trial, m_pages_voucher];
const SKIP = new Set(["refunds", "cashbook", "stmt","dash","rec","sal","parties","settings","rcv","pay","reg","bills","voucher","daybook","ledger","tb","pl","bs","coa","D","tab","sideTmp","twQueued","setTab","setSideTmp"]);
for (const ns of NAMESPACES) for (const k of Object.keys(ns)) {
  if (SKIP.has(k)) continue;
  try { Object.defineProperty(window, k, { value: ns[k], writable: true, configurable: true, enumerable: true }); } catch (e) { console.warn('could not expose', k, e.message); }
}
// Shared variables that handlers read or assign directly (e.g. onclick="tab='rec'; render()") stay live through accessors.
for (const [k, get, set] of [
  ['D', () => m_lib_state.D],
  ['tab', () => m_lib_state.tab, v => m_lib_state.setTab(v)],
  ['sideTmp', () => m_lib_dom.sideTmp, v => m_lib_dom.setSideTmp(v)],
  ['twQueued', () => m_lib_dom.twQueued]
]) Object.defineProperty(window, k, { get, set: set || (() => {}), configurable: true });

// ---- boot (was the end of the old <script>) ----
NARROW.addEventListener('change', () => { setSideTmp(null); applySide(); });

applySide();

new MutationObserver(syncAllTW).observe($('#m'), { childList: true, subtree: true });

addEventListener('resize', syncAllTW);

const t = new Date();

const y = t.getMonth() > 5 && !(t.getMonth() == 6 && t.getDate() < 16) ? t.getFullYear() : t.getFullYear() - 1; // Shrawan 1 ≈ Jul 16

$('#from').value = y + '-07-16';

$('#to').value = (y + 1) + '-07-15';

load();
