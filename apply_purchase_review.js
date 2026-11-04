#!/usr/bin/env node
// apply_purchase_review.js
// Adds "Review: new payments (not to a recorded supplier)" to the VAT registers page, so every payment made through
// New payment (fuel excluded) can be reviewed and added to / removed from the purchase register.
//   * payments WITH tax-invoice details (pmt.inv): added as a normal VAT bill (invoice no., PAN, taxable, VAT as typed on the payment)
//   * payments WITHOUT an invoice: same as before (13/113 rule, flag v.fuelBook)
// Run from the project root (next to server/ and public/):   node apply_purchase_review.js
// Every file is backed up as <file>.bak-review first. Nothing is written unless ALL anchors match exactly once.

const fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const edits = []; // { file, find, replace } or { file, from, to, replace } (region) or { file, append }
const sub = (file, find, replace) => edits.push({ file, find, replace });
const region = (file, from, to, replace) => edits.push({ file, from, to, replace });
const append = (file, text) => edits.push({ file, append: text });

// ---------------------------------------------------------------- server/posting/purchasebook.js
sub('server/posting/purchasebook.js',
  "const isBookablePayment = (d, v) => !!(v.pmt && v.pmt.other && eligible(d.accounts.find(x => x.code === v.pmt.debitAccount)));",
  `// A payment to someone who is not a recorded supplier that carries TAX INVOICE details typed on the payment (pmt.inv; its VAT is already in 1050). Fuel keeps its own review.
// Returned in the same shape as a purchase-book invoice, or null.
const invPay = (d, v) => v.pmt && v.pmt.other && v.pmt.inv && !isFuelPayment(d, v)
  ? { supplier: v.pmt.payee, supplierPan: v.pmt.inv.supplierPan || '', billNo: v.pmt.inv.billNo || '', nonTax: +v.pmt.inv.nonTax || 0, taxable: +v.pmt.inv.taxable || 0, vat: +v.pmt.inv.vat || 0 } : null;

// (a payment that has tax invoice details goes through the invoice route below, never the 13/113 one, so its VAT is not counted twice)
const isBookablePayment = (d, v) => !!(v.pmt && v.pmt.other && eligible(d.accounts.find(x => x.code === v.pmt.debitAccount))) && !invPay(d, v);`);

sub('server/posting/purchasebook.js',
  "function paymentPurchases(d) { return [...invoiceVouchers(d), ...fuelVouchers(d)]; }",
  `// New payments with tax invoice details that were reviewed and added by hand (v.invBook): a normal VAT bill in the purchase book
function invPayVouchers(d) {
  return d.vouchers.filter(v => v.invBook).map(v => ({ v, t: invPay(d, v) })).filter(x => x.t && !vatBillProblem(x.t)).map(({ v, t }) => ({
    id: 'pi' + v.id, kind: 'purchase', fromPayment: 'payment', voucher: v.no, voucherId: v.id, billNo: t.billNo, supplier: t.supplier, supplierPan: t.supplierPan, date: v.date, bs: v.bs || '', category: 'Payment ' + v.no,
    particulars: v.pmt.note || v.narration || '', note: 'Payment ' + v.no + ' (new payment, tax invoice reviewed and added)', nonTax: t.nonTax, taxable: t.taxable, vat: t.vat, total: Math.round((t.nonTax + t.taxable + t.vat) * 100) / 100
  }));
}

function paymentPurchases(d) { return [...invoiceVouchers(d), ...invPayVouchers(d), ...fuelVouchers(d)]; }`);

sub('server/posting/purchasebook.js', "module.exports = { NOT_PURCHASE, eligible,", "module.exports = { NOT_PURCHASE, invPay, eligible,");

// ---------------------------------------------------------------- server/posting/review.js
sub('server/posting/review.js',
  "const { eligible, isFuel, isFuelPayment, fuelJournal, isBookablePayment, vatInTotal, leftOutReason, vatBillProblem } = require('./purchasebook');",
  "const { eligible, isFuel, isFuelPayment, fuelJournal, isBookablePayment, invPay, vatInTotal, leftOutReason, vatBillProblem } = require('./purchasebook');");

sub('server/posting/review.js',
  "if (isF) fuel.push(row); else others.push(row);",
  `const it = invPay(d, v); // tax invoice typed on the payment: shown with its own figures, added by invoice (not 13/113)
    if (it) {
      const dup = dupInvoice(d, it, v.id) || d.vouchers.some(y => y.id !== v.id && y.invBook && y.pmt && y.pmt.inv && nkey(y.pmt.payee) === nkey(it.supplier) && nkey(y.pmt.inv.billNo) === nkey(it.billNo));
      row.inv = it; row.invProblem = vatBillProblem(it) || (dup ? \`Invoice \${it.billNo} from \${it.supplier} is already in the purchase book\` : null);
      row.inBook = !!v.invBook && !vatBillProblem(it); row.reason = row.invProblem || 'Tax invoice entered on this payment: review it, then add it to the purchase book';
    }
    if (isF) fuel.push(row); else others.push(row);`);

// ---------------------------------------------------------------- server/routes/vouchers.js
sub('server/routes/vouchers.js',
  "const { isBookablePayment, isFuelJournal } = require('../posting/purchasebook');",
  "const { isBookablePayment, isFuelJournal, invPay, vatBillProblem } = require('../posting/purchasebook');\nconst { nkey } = require('../accounts');");

sub('server/routes/vouchers.js',
  "  const fb = /^\\/api\\/vouchers\\/([^/]+)\\/fuelbook$/.exec(u);",
  `  // ---- New payments that carry tax invoice details: add / remove in the purchase book (flag v.invBook). Fuel and no-invoice payments use /fuelbook below.
  const invBad = (d, v) => { // null = can be added
    const t = invPay(d, v); if (!t) return 'This payment has no tax invoice details (or it is a fuel payment, which has its own review).';
    const dup = dupInvoice(d, t, v.id) || d.vouchers.some(y => y.id !== v.id && y.invBook && y.pmt && y.pmt.inv && nkey(y.pmt.payee) === nkey(t.supplier) && nkey(y.pmt.inv.billNo) === nkey(t.billNo));
    return vatBillProblem(t) || (dup ? \`Invoice \${t.billNo} from \${t.supplier} is already in the purchase book\` : null);
  };
  const ib = /^\\/api\\/vouchers\\/([^/]+)\\/invbook$/.exec(u);
  if (ib && (req.method === 'POST' || req.method === 'DELETE')) {
    const v = d.vouchers.find(y => String(y.id) === ib[1]); if (!v) return send(res, 404, { error: 'Voucher not found' });
    if (req.method === 'DELETE') { delete v.invBook; save(d); return send(res, 200, { ok: true }); }
    const bad = invBad(d, v); if (bad) return send(res, 400, { error: bad });
    v.invBook = true; delete v.fuelBook; save(d); return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && u === '/api/invbook') { // add several at once: { ids: [...] }
    const ids = (JSON.parse(b).ids || []).map(String); let added = 0, skipped = 0;
    d.vouchers.forEach(v => { if (!ids.includes(String(v.id))) return; if (v.invBook) return; if (invBad(d, v)) { skipped++; return; } v.invBook = true; delete v.fuelBook; added++; });
    save(d); return send(res, 200, { added, skipped });
  }
  const fb = /^\\/api\\/vouchers\\/([^/]+)\\/fuelbook$/.exec(u);`);

// ---------------------------------------------------------------- public/pages/payments.js (help text only)
sub('public/pages/payments.js',
  "13% VAT is then claimed automatically and the payment appears in the purchase book.",
  "13% VAT is then claimed automatically. Review the payment under VAT registers → Review and add it to the purchase book.");

// ---------------------------------------------------------------- public/pages/registers.js
region('public/pages/registers.js',
  '  // 3. Every other payment made with no invoice',
  '  // 4. Saved bills with problems',
  `  // 3. New payments (made to someone who is not a recorded supplier), fuel excluded (it has its own section above): review, then add to / remove from the purchase book
  const nInvNew = oth.filter(x => x.inv && !x.inBook && !x.invProblem), nIn = oth.filter(x => x.inBook).length, nTot = rd(oth.reduce((t, x) => t + (+x.amount || 0), 0));
  const payments = sec('rev-payments', 'Review: new payments (not to a recorded supplier)', \`\${oth.length} payment\${oth.length == 1 ? '' : 's'} · \${nIn} in purchase book · \${f(nTot)}\`,
    \`<div class="ch">\${mxBtn('rev-payments')}\${nInvNew.length ? \`<button class="p sp" onclick="invAddAll([\${nInvNew.map(x => x.id).join(',')}])">Add all \${nInvNew.length} with tax invoice</button>\` : ''}\${loBtn()}</div><p class="note">Payments made through <b>New payment</b> (money paid to someone who is not a recorded supplier); fuel is reviewed in the section above. <b>With a tax invoice</b>: the invoice no., PAN, taxable amount and VAT typed on the payment are shown, and the VAT is already in 1050 VAT Receivable. Press <b>Add to purchase book</b> to enter it as a VAT bill (it needs a 9-digit PAN, an invoice no. and VAT above zero, and the invoice must not be in the book already). <b>Without an invoice</b>: not in the purchase book unless you review it and add it by hand (for example permits and entry fees); the VAT is then worked out as 13/113 of the amount paid and the voucher number replaces the bill number. That changes the register only. Salary, loans, bank charges, depreciation and advances cannot be added. To correct invoice details, edit the payment on Payments made.</p>
    <div class="tw" style="max-height:none"><table>\${th('Voucher', 'Date', 'Paid to', 'Charged to', 'Note', 'Tax invoice', '#Amount', '#Taxable', '#VAT', 'Purchase book')}\${oth.length ? oth.map(x => {
      const i = x.inv, tx = i ? i.taxable : x.canBook ? x.taxable : null, vt = i ? i.vat : x.canBook ? x.vatInTotal : null,
        act = x.inBook ? \`<span class="chip ok">In purchase book</span> <button onclick="\${i ? 'invRemove' : 'fuelRemove'}(\${x.id})">Remove</button>\`
          : i ? (x.invProblem ? \`<span class="err">\${esc(x.invProblem)}</span><br><small>Edit the payment on Payments made</small>\` : \`<button class="p" onclick="invAdd(\${x.id})">Add to purchase book</button>\`)
          : x.canBook ? \`<button class="p" onclick="fuelAdd(\${x.id})">Add to purchase book</button><br><small>\${esc(x.reason)}</small>\` : \`<small>\${esc(x.reason)}</small>\`;
      return \`<tr><td>\${esc(x.no)}</td><td>\${esc(x.bs || x.date)}</td><td>\${esc(x.payee)}</td><td>\${esc(x.account)}</td><td><small>\${esc(x.note)}</small></td><td>\${i ? \`\${esc(i.billNo)}<br><small>PAN \${esc(i.supplierPan)}</small>\` : '<small>No invoice</small>'}</td><td class="n">\${f(x.amount)}</td><td class="n">\${tx == null ? '' : f(tx)}</td><td class="n">\${vt == null ? '' : f(vt)}</td><td style="white-space:nowrap">\${act}</td></tr>\`;
    }).join('') : empty(10, 'No new payments in this period')}</table></div>\`);

`);

append('public/pages/registers.js', `
// ---- New payments with a tax invoice: add / remove in the purchase book ----
export async function invAdd(id) { const r = await fetch('/api/vouchers/' + id + '/invbook', { method: 'POST' }), j = await r.json().catch(() => ({})); if (!r.ok) return alert(j.error || 'Could not add this payment'); await load(); toast('Added to the purchase book'); }

export async function invRemove(id) { if (!confirm('Remove this payment from the purchase book? The payment itself is not changed.')) return; await fetch('/api/vouchers/' + id + '/invbook', { method: 'DELETE' }); await load(); }

export async function invAddAll(ids) { if (!confirm(ids.length + ' payment(s) with a tax invoice will be added to the purchase book. Continue?')) return; const j = await post('/api/invbook', { ids }); if (!j) return; await load(); toast(j.added + ' payment(s) added to the purchase book' + (j.skipped ? ', ' + j.skipped + ' skipped (see the problem shown on the row)' : '')); }
`);

// ---------------------------------------------------------------- run
if (rd('server/posting/purchasebook.js').includes('invPayVouchers')) { console.log('Already applied. Nothing to do.'); process.exit(0); }

const cache = {}, problems = [];
for (const e of edits) {
  let src; try { src = cache[e.file] ?? (cache[e.file] = rd(e.file)); } catch { problems.push(`${e.file}: file not found (run from the project root)`); continue; }
  if (e.append) { cache[e.file] = src.replace(/\s*$/, '\n') + e.append; continue; }
  if (e.find !== undefined) {
    const n = src.split(e.find).length - 1; if (n !== 1) { problems.push(`${e.file}: expected 1 match, found ${n} for: ${e.find.slice(0, 90)}…`); continue; }
    cache[e.file] = src.replace(e.find, () => e.replace);
  } else {
    const a = src.indexOf(e.from), b = src.indexOf(e.to); if (a < 0 || b < a || src.split(e.from).length !== 2 || src.split(e.to).length !== 2) { problems.push(`${e.file}: region markers not found exactly once: ${e.from.trim().slice(0, 60)}…`); continue; }
    cache[e.file] = src.slice(0, a) + e.replace + src.slice(b);
  }
}
if (problems.length) { console.error('Nothing was changed. These anchors did not match (the file differs from the one I read):\n - ' + problems.join('\n - ')); process.exit(1); }

for (const f of Object.keys(cache)) { fs.copyFileSync(path.join(ROOT, f), path.join(ROOT, f + '.bak-review')); fs.writeFileSync(path.join(ROOT, f), cache[f]); console.log('patched', f); }
console.log('\nDone. Restart the server (node server.js) and hard-refresh the browser (Ctrl+Shift+R).');
