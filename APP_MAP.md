# Lekha (लेखा): app map

Accounting + VAT app for a Nepal travel & tours company. Plain Node `http` server (no framework), JSON files for storage, `exceljs` for Excel output, vanilla-JS ES-module frontend. Double-entry: every action ends up as a **voucher** with Dr/Cr lines in `data.json`.

Built from `PROJECT_BUNDLE.md` (generated 2026-11-04). Ignored on purpose: `_original/`, `server_backup.js`, `public/index_backup.html`, the `.txt` notes, `migrate.js` (one-off tool that split the old single-file app), `.bak-*` files, `package-lock.json`, `templates/data.json|db.json`.

## Tree

```
Node/
├── server.js                    entry: serves public/, sends /api/* to server/routes
├── package.json                 "travel-accounts", dependency: exceljs
├── data.json                    books: accounts, vouchers, bills, seq counters
├── db.json                      master lists: parties, staff, banks
├── settings.json                storage folder, auto-save switches, company, categories
├── templates/                   purchase-register.xlsx, sales-register.xlsx (IRD VAT templates)
│
├── public/                      FRONTEND (served as static files)
│   ├── index.html               shell: sidebar #nav, period bar, <main id="m">, loads 5 css + /app.js
│   ├── app.js                   imports every module, copies exports onto window (inline onclick), boots; imports datepair.js
│   ├── lib/
│   │   ├── state.js             shared D (all data), tab, NAV/TABS, period helpers (FR/TO/per/cum/net), load(), render(), cashAccs, MODES
│   │   ├── dom.js               $, esc, toast, post(), getFile(), sidebar, scrollbars above wide tables
│   │   ├── format.js            money / date formatting, palette
│   │   ├── charts.js            SVG bar chart, donut, horizontal bars
│   │   ├── nepdate.js           BS <-> AD conversion (ad2bs, bs2ad, bsNorm, either)
│   │   └── datepair.js          keeps every AD date input and its BS twin in sync, app-wide
│   ├── pages/                   one renderer per tab (index.js maps tab -> renderer)
│   │   ├── index.js             V = { dash, rec, ..., cashbook, refunds }
│   │   ├── dashboard.js         KPI strip + charts
│   │   ├── voucher.js           New voucher (manual journal)
│   │   ├── cashbook.js          Cash book: two-sided receipts/payments entry, each row saved as a voucher
│   │   ├── bills.js             purchase / sales bill forms
│   │   ├── bills-forms.js       bill actions: save, edit, make sale from purchase, editV router
│   │   ├── refunds.js           refunds received from suppliers / paid to customers (render + actions)
│   │   ├── receipts.js          Payments received (render)
│   │   ├── receipts-forms.js    receipts actions
│   │   ├── payments.js          Payments made (render), incl. "Due to staff" card
│   │   ├── payments-forms.js    payments actions, cheque/bank pickers, split cheques, staffOwed, reimburse
│   │   ├── salary.js            Salary payment + staff list (render)
│   │   ├── salary-forms.js      salary + staff actions, old-record migration
│   │   ├── records.js           search / edit / delete of every entry type (bills, payments, salary, refunds)
│   │   ├── statements.js        party / staff / expense statements (render)
│   │   ├── statement-forms.js   statement loading, pickers
│   │   ├── daybook.js, ledger.js, trial.js (TB, P&L, BS)
│   │   ├── registers.js         VAT registers + Review panel (fuel, tax-invoice links, left-out list)
│   │   ├── accounts.js          chart of accounts
│   │   ├── parties.js           suppliers / customers
│   │   └── settings.js          storage, categories, banks + cheque formats, bank match/split, Fonepay, company
│   └── styles/                  tokens.css -> base.css -> layout.css -> components.css -> pages.css
│
└── server/                      BACKEND
    ├── http.js                  send(), readBody(), serveStatic()
    ├── store.js                 load/save data.json, db.json (SCHEMA), settings.json; upsert, touchParty
    ├── settings.js              company defaults, hotel categories, storage sub-folders
    ├── accounts.js              seed chart of accounts, rd(), VAT split(), party() auto-creates ledger accounts
    ├── files.js                 Excel files in storage folder: ownership marker, auto-save, resave, drop, rebuild
    ├── banks.js                 cheque-format matching, bank match, multi-bank split scan/plan/apply
    ├── posting/                 BUSINESS RULES: turn a form into voucher lines
    │   ├── lines.js             voucher numbers (PFX), post(), resync(), cleanLines()
    │   ├── vatrules.js          PAN_RE (9 digits), BS_RE (BS date) shared validators
    │   ├── purchase.js          purchase bill validation + lines
    │   ├── sales.js             sales bill validation + lines (needs own VAT no. in Settings to charge VAT)
    │   ├── receipts.js          receipt: Dr bank, Cr customer (or other account); MODES
    │   ├── payments.js          payment: Dr supplier/other, Cr bank; Fonepay fee; cheque splits; paid-by-staff
    │   ├── salaries.js          salary payment; old-record migration
    │   ├── refunds.js           refund received (debit note) / paid (credit note); refundRows for registers
    │   ├── receivables.js       per-customer bills, paid/due, statement
    │   ├── payables.js          per-supplier bills, paid/due, statement
    │   ├── purchasebook.js      what enters the purchase register besides bills: tax-invoice vouchers, fuel (13/113 rule)
    │   └── review.js            registers Review data + duplicate-invoice and tax-invoice checks
    ├── excel/                   WORKBOOK BUILDERS
    │   ├── workbook.js          frame(), put(), box(), fx(), words()
    │   ├── voucher.js           voucher workbook
    │   ├── invoice.js           sales invoice + purchase bill
    │   ├── registers.js         VAT registers from templates; reviewXlsx
    │   └── statements.js        TB / P&L / BS and party statements
    └── routes/                  HTTP API; each exports handle(ctx), tried in order by index.js
        ├── index.js             dispatch (order: data, vouchers, receipts, payments, salaries, refunds, purchase, sales, accounts, parties, staff, banks, settings, categories, statements, xlsx, migrate)
        ├── data.js              GET /api/data (the single feed for the UI)
        ├── vouchers.js          /api/vouchers CRUD + /:id/taxinv + /:id/fuelbook + /api/fuelbook
        ├── purchase.js, sales.js, receipts.js, payments.js (+/fee), salaries.js (+/fee), refunds.js
        ├── accounts.js, parties.js (generic /api/db/*), staff.js, categories.js, settings.js
        ├── banks.js             /api/banks, /api/bank-match, /api/bank-split
        ├── statements.js        /api/pstatement, /api/xlsx/pstatement
        ├── xlsx.js              /api/xlsx/{voucher,bill,statement,register,review,leftout,fonepay}
        └── migrate.js           /api/migrate, /api/rebuild-files
```

## The one flow everything follows

`page renderer` -> `*-forms.js` action -> `post()` (lib/dom.js) -> `routes/<x>.js` -> `posting/<x>.js` builds lines -> `posting/lines.post()` numbers the voucher -> `store.save()` -> `files.autoSave*/resave*` -> `excel/*` -> frontend `load()` (GET /api/data) -> `render()`.

`GET /api/data` (routes/data.js) returns data.json + db.json + settings + `receivables()` + `payables()` + `payPurchases` (purchasebook) + `review` (review.js) + `refundRows` (refunds.js).

## Features: which files are involved

| Feature | Frontend | Route | Posting / rules | Excel / files |
|---|---|---|---|---|
| Purchase bill | pages/bills.js, bills-forms.js | routes/purchase.js | posting/purchase.js, vatrules.js, lines.js, accounts.js (party, catName) | excel/invoice.js, voucher.js, files.js |
| Sales bill (VAT invoice) | bills.js, bills-forms.js | routes/sales.js | posting/sales.js, vatrules.js, accounts.split (13%) | excel/invoice.js, files.js |
| Sales from a purchase | bills.js (pickPurchase, makeSale), receipts.js "Create sales bill" | routes/sales.js (purchaseId sets `sold`) | | invoice.js reads linked purchase |
| Payments received | receipts.js, receipts-forms.js | routes/receipts.js | posting/receipts.js, receivables.js | voucher.js |
| Payments made | payments.js, payments-forms.js | routes/payments.js | posting/payments.js, payables.js | voucher.js |
| Paid by staff / CEO and reimbursing | payments.js ("Paid by staff", "Due to staff" card), payments-forms.js (staffOwed, reimburse) | routes/payments.js (upserts staff) | posting/payments.js (credits "Due to <name>", group Staff Payables, or the staff member's own `ledger`); store.SCHEMA staff.ledger | |
| Tax invoice on a payment | payments.js (3 invoice boxes) | routes/payments.js (dupInv) | posting/payments.js `pmt.inv`, review.dupInvoice | purchase register |
| Cheque -> bank detection | payments-forms.js (banksFor, chqPick), settings.js (fmtParts/fmtHit, **duplicated**) | | server/banks.js (same rule) | |
| Split cheques / multi-bank | payments-forms.js (splitBox, spRows) | routes/payments.js | payments.js (chequeSplits, splitCredits), banks.js | |
| Fonepay charge | payments.js, salary.js, settings.js (fonepayCard) | payments.js, salaries.js `/fee` | payments.js, salaries.js | xlsx.js `/fonepay` |
| Salary + staff | salary.js, salary-forms.js | routes/salaries.js, staff.js | posting/salaries.js, store.upsert | voucher.js |
| Refunds (debit / credit note) | pages/refunds.js, records.js (refund section) | routes/refunds.js (delete via /api/vouchers) | posting/refunds.js, vatrules.js | registers (minus rows) |
| Cash book | pages/cashbook.js | routes/vouchers.js (POST per row) | lines.cleanLines | voucher.js |
| Manual voucher | pages/voucher.js | routes/vouchers.js | lines.js | voucher.js |
| BS / AD dates | lib/nepdate.js, lib/datepair.js (loaded by app.js, touches every date pair) | | vatrules.BS_RE | |
| Edit / delete anything | records.js, bills-forms.js (editV) | vouchers.js DELETE, each PUT | lines.resync | files.js (resave, drop) |
| VAT registers | pages/registers.js | routes/xlsx.js `/register/` | purchasebook.js (extra purchase rows), refunds.js | excel/registers.js + templates/*.xlsx |
| Registers Review (fuel, tax-invoice links, left-out) | registers.js (review, linkTaxInv, fuelAdd...) | vouchers.js `/taxinv`, `/fuelbook`, `/api/fuelbook`; xlsx.js `/review`, `/leftout` | purchasebook.js, review.js | excel/registers.js (reviewXlsx) |
| Review: new payments (tax invoice or no invoice) | registers.js (invAdd, invRemove, invAddAll, fuelAdd) | vouchers.js `/:id/invbook`, `/api/invbook`, `/:id/fuelbook` | purchasebook.js (invPay, invPayVouchers, isBookablePayment), review.js | flags `v.invBook` (with invoice) / `v.fuelBook` (13/113) |
| TB / P&L / BS | pages/trial.js (state.js net/closing/priorPL) | routes/xlsx.js `/statement/` | | excel/statements.js |
| Party statements | statements.js, statement-forms.js | routes/statements.js | excel/statements.stmtData (receivables / payables) | |
| Dashboard | dashboard.js, lib/charts.js | data.js | state.js helpers | |
| Day book / Ledger / Accounts / Parties | daybook.js, ledger.js, accounts.js, parties.js | data.js, accounts.js, parties.js | | |
| Banks + cheque formats | settings.js (bankCard) | routes/banks.js | server/banks.js, accounts.nextBankCode | |
| Match / split old cheque payments | settings.js | routes/banks.js | server/banks.js | files.refresh |
| Storage folder / ownership | settings.js | routes/settings.js | files.js (ownerState, claimFolder, canWrite) | server/settings.js FOLDERS |
| Rebuild Excel / old-record migration | settings.js, salary-forms.js | routes/migrate.js | salaries.migrateSalaries, files.rebuildFiles | |

## Voucher flags that connect features

A voucher is plain Dr/Cr lines plus an optional marker saying what it is. Most cross-feature logic keys off these:

- `v.pmt` payment made (`other`, `paidBy`, `byStaff`, `splits`, `inv`, `fee`), `v.rcpt` receipt, `v.sal` salary, `v.refund` refund
- `v.purchase` / a bill with `voucherId` made from a bill; `v.taxInv` VAT bill details attached to a hand-made voucher; `v.fuelBook` reviewed fuel / no-invoice payment added to the purchase book (13/113), `v.invBook` new payment with `pmt.inv` added as a VAT bill

## Gotchas

- **Window globals:** `app.js` copies every export onto `window`. Page state lives on `window.*` (`eb`, `ev`, `er`, `pye`, `rc`, `pys`, `rft`, ...). `render()` resets several on tab change. A new page must be added in three places: `pages/index.js` (V), `state.js` (TABS, TSUB, NAV, IC, NOPERIOD) and `app.js` (import + NAMESPACES + SKIP).
- **Duplicated logic:** cheque-format matching lives in both `public/pages/settings.js` and `server/banks.js`; keep them in step. The 13/113 VAT rule lives in `purchasebook.js` only.
- **Hard-coded account codes:** `1050` input VAT, `2020` output VAT, `6000` salary, `2040` salary payable, `6060` bank charges, `6080` depreciation, `1190` accumulated depreciation, `1060` prepaid, `1011-1019` banks, `2300+` staff payables.
- **Purchase-register rule (purchasebook.js):** only real VAT bills (9-digit PAN, bill no., VAT > 0) go in; the one exception is fuel / bookable payments added by hand after review.
- **Circular imports** (state.js <-> pages/*) work because everything is used inside functions.
- **Data is re-read from disk on every request** (`routes/index.dispatch` calls `load()`).
- Port: `server.js` uses `process.env.PORT || 3000` (its comment still says 5000).
