#!/usr/bin/env node
'use strict';
/*
 * migrate.js — splits the two-file accounts app into the modular layout.
 *
 *   server.js        ->  server.js (entry) + server/**           (CommonJS, same Node, no new runtime deps)
 *   public/index.html ->  public/index.html (shell) + styles/*.css + lib/*.js + pages/*.js + app.js   (ES modules)
 *
 * How it stays safe: nothing is retyped. Both files are parsed with a real JavaScript parser (acorn), every
 * top-level declaration is moved *verbatim* to the module named in the tables below, and each module's
 * require()/import lines are computed from the variables its code really uses (eslint-scope). A name that is
 * not in a table stops the run, so nothing can be silently dropped.
 *
 * Usage (from the project root, where server.js lives):
 *     npm i -D acorn eslint-scope        # one time, only needed to run this script
 *     node migrate.js --dry              # parse + report, writes nothing
 *     node migrate.js                    # do it (originals are saved in ./_original first)
 *     node migrate.js --restore          # put the two original files back
 *   options: --server <file>  --html <file>  --root <dir>  --report (print CSS classification)
 */
const fs = require('fs'), path = require('path'), cp = require('child_process');

// ───────────────────────────── CLI / paths ─────────────────────────────
const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const ROOT = path.resolve(opt('root') || process.cwd());
const DRY = flag('dry');
const P = (...a) => path.join(ROOT, ...a);
const ORIG = P('_original');
const warnings = [];
const warn = m => { warnings.push(m); console.log('  ! ' + m); };
const fail = m => { throw new Error(m); };

let acorn, eslintScope;
try { acorn = require('acorn'); eslintScope = require('eslint-scope'); }
catch { console.error('migrate.js needs two small dev tools. Run once:\n    npm i -D acorn eslint-scope\nthen run it again.'); process.exit(1); }

// ───────────────────────────── file helpers ─────────────────────────────
const readNorm = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const written = [];
function put(rel, text) {                      // write a project file (and keep a copy of anything non-empty it replaces)
  const f = P(rel); written.push([rel, text.split('\n').length - (text.endsWith('\n') ? 1 : 0)]);
  if (DRY) return;
  if (fs.existsSync(f) && fs.statSync(f).size > 0 && fs.readFileSync(f, 'utf8') !== text) {
    const b = path.join(ORIG, 'overwritten', rel);
    if (!fs.existsSync(b)) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(f, b); }
  }
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text);
}

// ───────────────────────────── parsing helpers ─────────────────────────────
const parse = (code, label) => { try { return acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true }); } catch (e) { fail(`${label}: syntax error — ${e.message}`); } };
const analyze = ast => eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
function walk(n, fn, parent) {
  if (!n || typeof n.type !== 'string') return;
  fn(n, parent);
  for (const k in n) { if (k === 'loc' || k === 'range') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x, fn, n)); else if (v && typeof v.type === 'string') walk(v, fn, n); }
}
const protectedRanges = ast => { const r = []; walk(ast, n => { if (n.type === 'TemplateLiteral' || (n.type === 'Literal' && typeof n.value === 'string' && n.loc.start.line !== n.loc.end.line)) r.push([n.start, n.end]); }); return r; };
function dedent(text, offset, remove, prot) {  // strip `remove` leading spaces from every line except those inside template/multi-line strings
  if (!remove) return text; let pos = offset; const re = new RegExp('^ {1,' + remove + '}');
  return text.split('\n').map((line, i) => { const ls = pos; pos += line.length + 1; if (i === 0 || prot.some(([a, b]) => ls > a && ls < b)) return line; return line.replace(re, ''); }).join('\n');
}
const patternNames = p => !p ? [] : p.type === 'Identifier' ? [p.name] : p.type === 'ObjectPattern' ? p.properties.flatMap(x => patternNames(x.value || x.argument)) : p.type === 'ArrayPattern' ? p.elements.flatMap(patternNames) : p.type === 'AssignmentPattern' ? patternNames(p.left) : p.type === 'RestElement' ? patternNames(p.argument) : [];

/* Split a program into one chunk per top-level declaration. A chunk keeps its leading comments, and a trailing
 * same-line // comment. `const a = 1, b = 2;` becomes two chunks. */
function chunkProgram(src, ast, remove) {
  const prot = protectedRanges(ast), out = []; let prevEnd = 0;
  const leadOf = (a, b) => src.slice(a, b).split('\n').map(s => s.trim()).filter(Boolean).join('\n');
  for (const n of ast.body) {
    const eol = src.indexOf('\n', n.end), rest = src.slice(n.end, eol < 0 ? src.length : eol), tm = /^[ \t]*(\/\/.*)?$/.exec(rest);
    const endAll = tm ? n.end + rest.length : n.end, trail = tm && tm[1] ? ' ' + tm[1].trim() : '', lead = leadOf(prevEnd, n.start); prevEnd = endAll;
    const base = { pos: n.start, lead, trail: '', node: n, src };
    if (n.type === 'VariableDeclaration') {
      const single = n.declarations.length === 1; let gapStart = n.start;
      n.declarations.forEach((d, i) => {
        const last = i === n.declarations.length - 1, init = d.init, req = init && init.type === 'CallExpression' && init.callee.name === 'require' && init.arguments[0] && init.arguments[0].type === 'Literal';
        let lead2 = i === 0 ? lead : leadOf(gapStart, d.start).replace(/^,\s*/, '');
        const text = single ? src.slice(n.start, n.end) : `${n.kind} ${src.slice(d.start, d.end)};`;
        out.push({ ...base, pos: d.start, kind: n.kind, names: patternNames(d.id), lead: lead2.replace(/^[,\s]+/, ''), decl: single ? dedent(text, n.start, remove, prot) : dedent(text, d.start - n.kind.length - 1, remove, prot), trail: last ? trail : '', requireOf: req ? init.arguments[0].value : null, declNode: d });
        gapStart = d.end;
      });
    } else if (n.type === 'FunctionDeclaration') {
      out.push({ ...base, kind: 'function', names: [n.id.name], decl: dedent(src.slice(n.start, n.end), n.start, remove, prot), trail });
    } else {
      out.push({ ...base, kind: 'stmt', names: [], decl: dedent(src.slice(n.start, n.end), n.start, remove, prot), trail });
    }
  }
  return out;
}
const chunkText = c => (c.lead ? c.lead + '\n' : '') + (c.exportKw ? 'export ' : '') + c.decl + c.trail;

/* Free (unresolved) identifiers of a piece of code, plus its top-level declared names. */
function freeNames(code, label) {
  const ast = parse(code, label), sm = analyze(ast);
  const free = new Set(), writes = new Map();
  for (const r of sm.globalScope.through) { free.add(r.identifier.name); if (r.isWrite()) { if (!writes.has(r.identifier.name)) writes.set(r.identifier.name, []); writes.get(r.identifier.name).push(r.identifier); } }
  return { ast, free, writes };
}
const requireFn = (from, to) => { let r = path.posix.relative(path.posix.dirname(from), to).replace(/\.js$/, ''); return r.startsWith('.') ? r : './' + r; };
const importFn = (from, to) => { let r = path.posix.relative(path.posix.dirname(from), to); return r.startsWith('.') ? r : './' + r; };
function findCycle(graph) {                      // graph: Map(file -> Set(file)); returns a cycle path or null
  const state = new Map(), stack = [];
  const dfs = f => { state.set(f, 1); stack.push(f); for (const g of graph.get(f) || []) { if (state.get(g) === 1) return stack.slice(stack.indexOf(g)).concat(g); if (!state.get(g)) { const c = dfs(g); if (c) return c; } } stack.pop(); state.set(f, 2); return null; };
  for (const f of graph.keys()) if (!state.get(f)) { const c = dfs(f); if (c) return c; }
  return null;
}
const indent = (t, n) => t.split('\n').map(l => l ? ' '.repeat(n) + l : l).join('\n');

// ═════════════════════════════════════════════════════════════════════════════
//  SERVER  —  where every top-level name of server.js goes
// ═════════════════════════════════════════════════════════════════════════════
// [file, what it holds, [names moved here verbatim]]   (names the script adds itself are listed in INJECT below)
const SERVER_SPEC = [
  ['server/http.js', 'HTTP helpers: send(), readBody(), serveStatic()', ['send']],
  ['server/store.js', 'data.json / db.json / settings.json load + save, master-data lists', ['DB', 'DBF', 'SETF', 'load', 'save', 'loadDb', 'saveDb', 'loadSet', 'saveSet', 'SCHEMA', 'upsert', 'touchParty']],
  ['server/accounts.js', 'chart-of-accounts seed and small accounting helpers', ['seed', 'EXTRA', 'rd', 'split', 'nkey', 'party', 'catName', 'nextBankCode']],
  ['server/settings.js', 'constants and defaults: storage folders, hotel categories, company details', ['FOLDERS', 'HOTEL_CATS', 'COMPANY_DEFAULT', 'COMPANY']],
  ['server/excel/workbook.js', 'shared Excel building blocks: frame(), put(), box(), fx(), words()', ['W', 'TY', 'w', 'words', 'frame', 'put', 'box', 'fx']],
  ['server/excel/voucher.js', 'journal voucher workbook', ['jvXlsx']],
  ['server/excel/invoice.js', 'sales invoice and purchase bill workbooks', ['invoiceXlsx', 'purchaseBillXlsx']],
  ['server/excel/statements.js', 'trial balance / income statement / balance sheet and party statements', ['bal', 'priorPL', 'sec', 'statementXlsx', 'stmtData', 'STM_LABEL', 'pstatementXlsx']],
  ['server/excel/registers.js', 'VAT registers (IRD templates)', ['purchaseRegisterXlsx', 'registerXlsx']],
  ['server/posting/lines.js', 'voucher numbering and posting: cleanLines(), PFX, post(), resync()', ['PFX', 'post', 'resync', 'cleanLines']],
  ['server/posting/purchase.js', 'purchase bill validation and posting', ['purchaseBad', 'purchaseParts', 'purchaseFields']],
  ['server/posting/sales.js', 'sales bill validation and posting', ['salesBad', 'salesParts']],
  ['server/posting/receipts.js', 'payments received from customers', ['MODES', 'receiptParts']],
  ['server/posting/payments.js', 'payments made to suppliers, cheque splits', ['chequeSplits', 'splitCredits', 'splitNote', 'paymentParts']],
  ['server/posting/salaries.js', 'salary payments and the old-record migration', ['salaryParts', 'migratable', 'migrateSalaries']],
  ['server/posting/receivables.js', 'per-customer receivables picture', ['receivables']],
  ['server/posting/payables.js', 'per-supplier payables picture', ['payables']],
  ['server/banks.js', 'bank accounts, cheque-number formats, bank matching and splitting', ['fmtParts', 'fmtBad', 'fmtHit', 'fmtBoth', 'banksFor', 'bankAcctName', 'bankMatch', 'chqRuns', 'splitScan', 'splitPlan', 'splitApply']],
  ['server/files.js', 'Excel files in the storage folder: ownership, auto-save, rewrite, delete, rebuild', ['OWNER_F', 'ownerState', 'claimFolder', 'canWrite', 'store', 'autoStore', 'autoSaveVoucher', 'autoSaveInvoice', 'autoSaveBill', 'vkey', 'safeName', 'vFile', 'bFile', 'folderPath', 'rmFile', 'dropVoucher', 'dropBill', 'refresh', 'resaveVoucher', 'resaveBill', 'rebuildFiles', 'pvToPmv']],
];
// code the script writes itself (needed because the pieces used to share one file)
const INJECT = {
  'server/http.js': { names: ['readBody', 'serveStatic'], code: `
// Reads a request body (same behaviour as the old inline req.on('data') loop).
const readBody = req => new Promise(resolve => { let b = ''; req.on('data', c => b += c); req.on('end', () => resolve(b)); });

// Static files from ./public. Anything that is not a real file inside public/ gets the app shell (index.html),
// exactly as the old single-file server answered every non-API URL.
const PUBLIC = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(res, u) {
  let rel; try { rel = decodeURIComponent(u); } catch { rel = '/'; }
  const file = path.resolve(PUBLIC, '.' + rel), inside = file.startsWith(PUBLIC + path.sep);
  if (inside && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  return res.end(fs.readFileSync(path.join(PUBLIC, 'index.html')));
}` },
  'server/store.js': { names: ['ROOT'], code: `
const ROOT = path.join(__dirname, '..'); // project folder (data.json, db.json, settings.json and templates/ live here)`, first: true },
  'server/excel/workbook.js': { names: ['getExcelJS'], code: `
// exceljs is loaded the first time an Excel file is made, so the app still starts without it installed.
let _ExcelJS;
const getExcelJS = () => _ExcelJS || (_ExcelJS = require('exceljs'));`, first: true },
};
const ROUTE_FILES = [  // order = order the router tries them (statements must stay before xlsx: /api/xlsx/pstatement/ before the generic /api/xlsx/)
  ['data', 'GET /api/data'], ['vouchers', '/api/vouchers CRUD'], ['receipts', '/api/receipts CRUD'], ['payments', '/api/payments CRUD + /fee'],
  ['salaries', '/api/salaries CRUD + /fee'], ['purchase', '/api/purchase CRUD'], ['sales', '/api/sales CRUD'], ['accounts', '/api/accounts CRUD'],
  ['parties', '/api/db/<collection> (parties and any other master list except staff)'], ['staff', '/api/db/staff'],
  ['banks', '/api/banks + /api/bank-match + /api/bank-split'], ['settings', '/api/settings'], ['categories', '/api/categories'],
  ['statements', '/api/pstatement/:kind + /api/xlsx/pstatement/:kind'], ['xlsx', '/api/xlsx/{voucher,bill,statement,register,fonepay}/...'],
  ['migrate', '/api/migrate + /api/rebuild-files'],
];
const GROUP_OF = { data: 'data', vouchers: 'vouchers', receipts: 'receipts', payments: 'payments', salaries: 'salaries', purchase: 'purchase', sales: 'sales', accounts: 'accounts', settings: 'settings', categories: 'categories', banks: 'banks', 'bank-match': 'banks', 'bank-split': 'banks', migrate: 'migrate', 'rebuild-files': 'migrate', db: 'db' };
const NODE_GLOBALS = new Set('require module exports __dirname __filename process console Buffer setTimeout clearTimeout setInterval clearInterval setImmediate URL URLSearchParams Math JSON Date Object Array String Number Boolean Set Map WeakMap Error TypeError Promise parseInt parseFloat isNaN isFinite undefined NaN Infinity RegExp Symbol encodeURIComponent decodeURIComponent encodeURI decodeURI escape unescape globalThis arguments'.split(' '));

function routeGroup(src, st) {
  const txt = (st.type === 'IfStatement' ? src.slice(st.test.start, st.test.end) : src.slice(st.start, st.end)).replace(/\\/g, '');
  if (/\/api\/(xlsx\/)?pstatement/.test(txt)) return 'statements';
  if (/\/api\/xlsx/.test(txt)) return 'xlsx';
  const m = /\/api\/([\w-]+)/.exec(txt); if (m) { if (GROUP_OF[m[1]]) return GROUP_OF[m[1]]; fail('Unknown API path /api/' + m[1] + ' — add it to GROUP_OF in migrate.js'); }
  if (/^dm\b/.test(txt)) return 'db';
  fail('Could not tell which API a block belongs to:\n' + txt.slice(0, 200));
}

function splitServer(srcRaw) {
  console.log('\n— server.js');
  let src = srcRaw.replace(/\r\n/g, '\n');
  if (/^\/ /.test(src)) { warn('server.js line 1 starts with a single "/" (a broken comment, so the file would not start). Fixed to "//".'); src = src.replace(/^\/ /, '// '); }
  const ast = parse(src, 'server.js'), chunks = chunkProgram(src, ast, 0), prot = protectedRanges(ast);

  // 1. builtin requires become imports where needed
  const provider = new Map();                  // name -> { builtin } | { file }
  const body = [];
  let headerComment = '';
  for (const c of chunks) {
    if (c.requireOf) { for (const n of c.names) provider.set(n, { builtin: c.requireOf }); if (c.lead && !headerComment) headerComment = c.lead; continue; }
    body.push(c);
  }
  // 2. the http.createServer(...) statement is taken apart separately
  const srv = body.find(c => c.kind === 'stmt' && /createServer/.test(c.decl));
  if (!srv) fail('Could not find the http.createServer(...) statement.');
  const rest = body.filter(c => c !== srv && !(c.names.length === 1 && c.names[0] === 'ExcelJS'));   // `let ExcelJS;` is replaced by getExcelJS()

  // 3. assign every declaration to its module
  const fileOf = new Map(); for (const [f, , names] of SERVER_SPEC) for (const n of names) { if (fileOf.has(n)) fail(`"${n}" is listed in two server modules`); fileOf.set(n, f); }
  const have = new Set(rest.flatMap(c => c.names));
  for (const [n, f] of fileOf) if (!have.has(n)) warn(`server map: "${n}" (${f}) is not in server.js — ignored`);
  const unmapped = rest.filter(c => c.names.length && !c.names.every(n => fileOf.has(n))).flatMap(c => c.names.filter(n => !fileOf.has(n)));
  const strays = rest.filter(c => !c.names.length);
  if (unmapped.length || strays.length) fail('Not placed in any server module: ' + [...unmapped, ...strays.map(c => 'statement @' + c.node.loc.start.line)].join(', ') + '\n   → add them to SERVER_SPEC in migrate.js');

  // 4. text fixes needed because pieces no longer share one scope
  const fixText = t => t
    .replace(/ExcelJS = ExcelJS \|\| require\('exceljs'\);/g, 'const ExcelJS = getExcelJS();')   // lazy exceljs, now a function
    .replace(/\b__dirname\b/g, 'ROOT');                                                      // data files stay in the project root
  const mods = new Map();                      // file -> { file, desc, parts:[{pos,text}], names:Set }
  const modOf = f => { if (!mods.has(f)) { const s = SERVER_SPEC.find(x => x[0] === f); mods.set(f, { file: f, desc: s ? s[1] : '', parts: [], declared: new Set(), exportsExtra: [] }); } return mods.get(f); };
  for (const [f] of SERVER_SPEC) modOf(f);
  for (const c of rest) {
    const m = modOf(fileOf.get(c.names[0])); c.decl = fixText(c.decl);
    m.parts.push({ pos: c.pos, text: chunkText(c) }); c.names.forEach(n => m.declared.add(n));
  }
  for (const [f, inj] of Object.entries(INJECT)) { const m = modOf(f); inj.names.forEach(n => m.declared.add(n)); m.parts.push({ pos: inj.first ? -1 : 1e12, text: inj.code.trim() }); }

  // 5. the route table: every `if (...) {...}` block of the old handler, verbatim, grouped by API
  const call = srv.node.expression, fn = call.callee.object.arguments[0];
  const onEnd = fn.body.body.find(s => s.type === 'ExpressionStatement' && s.expression.type === 'CallExpression' && s.expression.callee.property && s.expression.callee.property.name === 'on' && s.expression.arguments[0] && s.expression.arguments[0].value === 'end');
  if (!onEnd) fail('Could not find req.on("end", ...) inside the server handler.');
  const tryS = onEnd.expression.arguments[1].body.body[0]; if (!tryS || tryS.type !== 'TryStatement') fail('Expected a try { ... } inside req.on("end").');
  const st = tryS.block.body, pre = st.slice(0, 3), last = st[st.length - 1], routes = st.slice(3, -1);
  if (!(pre[0].type === 'VariableDeclaration' && pre[1].type === 'ExpressionStatement' && pre[2].type === 'BlockStatement')) fail('Unexpected start of the request handler (expected: const d = load(); Object.assign(COMPANY, ...); { writeHead wrapper }).');
  if (!/404/.test(src.slice(last.start, last.end))) fail('Expected the last statement of the handler to be the 404 reply.');
  const endOf = n => { const eol = src.indexOf('\n', n.end), r = src.slice(n.end, eol < 0 ? src.length : eol), m = /^[ \t]*(\/\/.*)?$/.exec(r); return m ? n.end + r.length : n.end; };
  const sliceStm = (n, from, remove) => dedent(src.slice(from, endOf(n)), from, remove, prot);
  const groups = new Map(); let prevEnd = tryS.block.body[3].start, prevNode = pre[2];
  for (const s of routes) {
    const g = routeGroup(src, s);
    // keep comment lines that sit directly above the block
    const between = src.slice(endOf(prevNode), s.start).split('\n').map(x => x.trim()).filter(Boolean).join('\n    ');
    const text = (between ? '  ' + between.replace(/\n {4}/g, '\n  ') + '\n' : '') + '  ' + sliceStm(s, s.start, 4);
    if (!groups.has(g)) groups.set(g, []); groups.get(g).push(text); prevNode = s;
  }
  const preText = pre.map(s => '    ' + sliceStm(s, s.start, 2)).join('\n');
  const catchText = src.slice(tryS.handler.body.start, tryS.handler.body.end), fallbackText = sliceStm(last, last.start, 2);
  const tail = call.arguments;                  // .listen(5000, cb)
  const port = src.slice(tail[0].start, tail[0].end);

  const handleWrap = (blocks, extra) => `async function handle({ req, res, u, b, d }) {\n${blocks.join('\n')}\n}`;
  const routeMods = [];
  for (const [g, desc] of ROUTE_FILES) {
    const file = `server/routes/${g}.js`;
    const m = { file, desc: desc, parts: [], declared: new Set(['handle']), exportsExtra: ['handle'], route: true };
    if (g === 'staff') { m.custom = `const { makeHandler } = require('./parties');\n\nmodule.exports = { handle: makeHandler(n => n === 'staff') };\n`; m.requires = ['server/routes/parties.js']; }
    else if (g === 'parties') {
      const blocks = (groups.get('db') || []).map(t => t.replace('if (dm && SCHEMA[dm[1]])', 'if (dm && SCHEMA[dm[1]] && accept(dm[1]))'));
      if (!blocks.some(t => t.includes('accept(dm[1])'))) fail('Could not find `if (dm && SCHEMA[dm[1]])` in the /api/db block.');
      m.parts.push({ pos: 0, text: `const makeHandler = accept => async function handle({ req, res, u, b, d }) {\n${blocks.join('\n')}\n};` });
      m.declared.add('makeHandler'); m.exportsExtra = ['makeHandler']; m.tailExports = `module.exports = { handle: makeHandler(n => n !== 'staff'), makeHandler };`;
    } else {
      const blocks = groups.get(g); if (!blocks) fail('No routes found for ' + g);
      m.parts.push({ pos: 0, text: handleWrap(blocks.map(fixText)) });
    }
    routeMods.push(m); mods.set(file, m);
  }
  for (const g of groups.keys()) if (!ROUTE_FILES.some(([x]) => x === g) && g !== 'db') fail('Route group without a file: ' + g);
  // blocks that used the lazy ExcelJS need the same text fix
  for (const m of routeMods) m.parts.forEach(p => { p.text = fixText(p.text); });

  // router index
  const idx = { file: 'server/routes/index.js', desc: 'router: runs the route modules in order, 404 / 500 handling', declared: new Set(['dispatch']), exportsExtra: ['dispatch'], parts: [], localNames: new Set(routeMods.map(m => path.basename(m.file, '.js'))), extraRequires: routeMods.map(m => `const ${path.basename(m.file, '.js')} = require('./${path.basename(m.file, '.js')}');`) };
  idx.parts.push({ pos: 0, text: `const handlers = [${routeMods.map(m => path.basename(m.file, '.js')).join(', ')}];` });
  idx.parts.push({ pos: 1, text: `// Every route module exports handle(ctx). A module that answers the request sends a reply, which stops the loop;\n// one that does not match just returns, and the next one is tried. If none answers: 404.\nasync function dispatch(req, res, u, b) {\n  try {\n${preText}\n    const ctx = { req, res, u, b, d };\n    for (const h of handlers) { await h.handle(ctx); if (res.headersSent) return; }\n    ${fallbackText}\n  } catch (e) ${catchText}\n}` });
  mods.set(idx.file, idx);
  return { src, mods, provider, headerComment, port, fileOf, routeMods, srv };
}

// builds all server modules + returns {file: text}
function emitServer(S) {
  const outFiles = {}, { mods, provider } = S;
  const declaredIn = new Map(); for (const m of mods.values()) for (const n of m.declared) if (!m.route && m.file !== 'server/routes/index.js') declaredIn.set(n, m.file);
  // route modules / router import the other modules the same way
  const imports = new Map(), graph = new Map(), needed = new Map();
  const entryNeeds = { 'server/http.js': ['send', 'readBody', 'serveStatic'], 'server/routes/index.js': ['dispatch'] };
  for (const [f, ns] of Object.entries(entryNeeds)) needed.set(f, new Set(ns));
  const bodies = new Map();
  for (const m of mods.values()) {
    if (m.custom) { bodies.set(m.file, m.custom); graph.set(m.file, new Set(m.requires || [])); continue; }
    const body = m.parts.sort((a, b) => a.pos - b.pos).map(p => p.text).join('\n\n');
    const { free } = freeNames(body, m.file), im = new Map(); // source -> Set(names)
    for (const n of free) {
      if (NODE_GLOBALS.has(n) || (m.localNames && m.localNames.has(n))) continue;
      const bi = provider.get(n); if (bi && bi.builtin) { (im.get('builtin:' + bi.builtin) || im.set('builtin:' + bi.builtin, new Set()).get('builtin:' + bi.builtin)).add(n); continue; }
      const f = declaredIn.get(n); if (!f) fail(`${m.file}: uses "${n}" which is not defined anywhere (not declared in server.js).`);
      if (f === m.file) continue;
      (im.get(f) || im.set(f, new Set()).get(f)).add(n);
      if (!needed.has(f)) needed.set(f, new Set()); needed.get(f).add(n);
    }
    imports.set(m.file, im); bodies.set(m.file, body);
    graph.set(m.file, new Set([...im.keys()].filter(k => !k.startsWith('builtin:'))));
  }
  for (const m of mods.values()) if (m.route) { graph.get('server/routes/index.js').add(m.file); }
  const cyc = findCycle(graph); if (cyc) fail('Circular require between modules: ' + cyc.join(' → ') + '\n   → move a function so the cycle disappears (edit SERVER_SPEC).');

  for (const m of mods.values()) {
    const head = `// ${m.file} — ${m.desc}\n// (split out of the old single-file server.js by migrate.js; code is unchanged)\n`;
    if (m.custom) { outFiles[m.file] = head + m.custom; continue; }
    const im = imports.get(m.file), lines = [];
    const bi = [...im.keys()].filter(k => k.startsWith('builtin:')).sort();
    if (bi.length) lines.push(bi.map(k => [...im.get(k)].map(n => `${n} = require('${k.slice(8)}')`)).flat().join(', ').replace(/^/, 'const ') + ';');
    for (const f of [...im.keys()].filter(k => !k.startsWith('builtin:')).sort()) lines.push(`const { ${[...im.get(f)].sort().join(', ')} } = require('${requireFn(m.file, f)}');`);
    if (m.extraRequires) lines.push(...m.extraRequires);
    const exp = [...new Set([...(needed.get(m.file) || []), ...(m.route ? m.exportsExtra : [])])].sort();
    const tail = m.tailExports || `module.exports = { ${exp.join(', ')} };`;
    outFiles[m.file] = head + (lines.length ? lines.join('\n') + '\n' : '') + '\n' + bodies.get(m.file) + '\n\n' + tail + '\n';
  }
  return outFiles;
}

function serverEntry(S) {
  const hc = (S.headerComment || '// Zero-dependency server: `node server.js` then open http://localhost:5000').replace(/localhost:3000/g, 'localhost:5000');
  return `${hc}
// Entry point only: the code now lives in ./server (http, store, excel/, posting/, banks, files, routes/).
const http = require('http');
const { readBody, serveStatic } = require('./server/http');
const { dispatch } = require('./server/routes');

const PORT = process.env.PORT || ${S.port};
http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (!u.startsWith('/api/')) return serveStatic(res, u);   // the page, /app.js, /pages/*.js, /styles/*.css ...
  readBody(req).then(b => dispatch(req, res, u, b));
}).listen(PORT, () => console.log('Accounts app running at http://localhost:' + PORT));
`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  CLIENT  —  public/index.html  ->  shell + styles/ + lib/ + pages/ + app.js
// ═════════════════════════════════════════════════════════════════════════════
const CLIENT_SPEC = [
  ['public/lib/dom.js', 'DOM helpers, toast, downloads, API post(), sidebar and table-scrollbar behaviour',
    ['$', 'esc', 'F', 'N', 'toast', 'getFile', 'post', 'filt', 'badAD', 'NARROW', 'sideTmp', 'sideStore', 'applySide', 'toggleSide', 'twRO', 'syncTW', 'twQueued', 'syncAllTW']],
  ['public/lib/format.js', 'number / date formatting', ['ymd', 'f', 'f0', 'K', 'PAL', 'rd']],
  ['public/lib/state.js', 'shared state (D, tab, period), tab/nav config, load() and render()',
    ['D', 'tab', 'ic', 'IC', 'TABS', 'TSUB', 'NAV', 'NOPERIOD', 'acc', 'nm', 'FR', 'TO', 'cum', 'per', 'pre', 'net', 'closing', 'priorPL', 'ofType', 'groups', 'hid', 'quickPeriod', 'showAll', 'resolveAcc', 'load', 'render', 'MODES', 'cashAccs']],
  ['public/lib/charts.js', 'plain SVG/HTML charts', ['hbars', 'barChart', 'donut']],
  ['public/pages/index.js', 'V = { page renderers } assembled from the page modules', ['pickByName']],
  ['public/pages/dashboard.js', 'Dashboard', ['dash']],
  ['public/pages/records.js', 'Records page', ['rec', 'recFilter', 'goRec', 'rm', 'del', 'delBill']],
  ['public/pages/statements.js', 'Statements page', ['stmt', 'SK', 'stmtList', 'stmtDates']],
  ['public/pages/statement-forms.js', 'Statements page actions', ['pickStmt', 'pickStmtByName', 'sqFilter', 'setStmtDates', 'stmtUrl', 'loadStmt']],
  ['public/pages/salary.js', 'Salary payment page', ['sal']],
  ['public/pages/salary-forms.js', 'Salary page actions', ['lmode', 'saveSalary', 'pickStaff', 'pickStaffByName', 'saveStaff', 'delStaff', 'migrateOld']],
  ['public/pages/voucher.js', 'New voucher page', ['voucher', 'showErr', 'addLine', 'calc', 'save']],
  ['public/pages/bills.js', 'Purchase & sales bills page', ['bills']],
  ['public/pages/bills-forms.js', 'Bills page actions', ['savePurchase', 'saveSale', 'setBt', 'makeSale', 'editBill', 'cancelEdit', 'editV', 'pcalc', 'scalc', 'fillParty', 'pickPurchase']],
  ['public/pages/receipts.js', 'Payments received page', ['rcv']],
  ['public/pages/receipts-forms.js', 'Payments received actions', ['saveReceipt', 'saveNewReceipt', 'rmode', 'rcrChg', 'rcvBill', 'newPay', 'pickCust', 'pickCustByName']],
  ['public/pages/payments.js', 'Payments made page', ['pay']],
  ['public/pages/payments-forms.js', 'Payments made actions, cheque/bank pickers, split cheques', ['savePayment', 'spAdd', 'spRows', 'ymode', 'ycrChg', 'paySupBill', 'newPaid', 'pickSup', 'pickSupByName', 'banksFor', 'chqPick', 'chqOk', 'payFromName', 'paidFrom', 'spRow', 'splitBox', 'spPick', 'spText', 'spSum']],
  ['public/pages/registers.js', 'VAT register page', ['reg']],
  ['public/pages/daybook.js', 'Day book page', ['daybook']],
  ['public/pages/ledger.js', 'Ledger page', ['ledger']],
  ['public/pages/trial.js', 'Trial balance, income statement, balance sheet', ['tb', 'pl', 'bs', 'rows', 'section', 'dl', 'collected']],
  ['public/pages/accounts.js', 'Chart of accounts page', ['coa', 'addAcc', 'delAcc']],
  ['public/pages/parties.js', 'Parties page', ['parties', 'saveParty', 'editParty', 'delParty']],
  ['public/pages/settings.js', 'Settings page: company, categories, storage, bank accounts, cheque formats, bank matching/splitting',
    ['settings', 'saveSettings', 'rebuildFiles', 'addCat', 'delCat', 'fmtParts', 'fmtHit', 'fmtHint', 'bkfChips', 'bkfAdd', 'bkfDel', 'bkfKey', 'bankCard', 'saveBank', 'editBank', 'delBank', 'bankScan', 'bankApply', 'bankMatchCard', 'splitScanUI', 'splitSum', 'splitType', 'bankSplitApply', 'bankSplitCard', 'fonepayCard', 'saveFee']],
  ['public/app.js', 'entry point: imports everything, exposes handlers, boots', ['t', 'y']],
];
const BROWSER_GLOBALS = new Set('window document alert confirm prompt fetch location history navigator localStorage sessionStorage setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame matchMedia scrollTo scrollBy addEventListener removeEventListener ResizeObserver MutationObserver IntersectionObserver URL URLSearchParams FormData Blob File FileReader Math JSON Date Object Array String Number Boolean Set Map WeakMap Error Promise parseInt parseFloat isNaN isFinite undefined NaN Infinity RegExp Symbol encodeURIComponent decodeURIComponent encodeURI decodeURI console globalThis arguments Intl Event CustomEvent HTMLElement Node Element getComputedStyle open print'.split(' '));

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS_FILES = ['tokens', 'base', 'layout', 'components', 'pages'];   // load order
const CSS_DESC = { tokens: 'design tokens (:root variables)', base: 'reset, body, links, inputs, buttons', layout: 'app shell: sidebar, top bar, main, responsive layout', components: 'cards, chips, tables, segmented switch, bill stub, voucher bar, VAT strip, toast', pages: 'forms, dashboard, picker bars and other page-specific rules' };
const CSS_CLASSIFY = [   // first match on the rule's first selector wins
  ['tokens', /^:root$/],
  ['base', /^(\*|\[hidden\]|html|body|::selection|a|a:hover|:focus-visible|input|select|textarea|button)(?![\w-])/],
  ['pages', /^(\.card \.row|\.row|\.fld|\.fh|\.dash|\.hb|\.lg|\.dn|\.lgi|\.fl|\.ag|#bw|\.split|#sbd|#ls)(?![\w-])/],
  ['layout', /^(\.sc|\.app|\.side|\.brand|\.tog|\.ng|\.co|\.top|\.period|main)(?![\w-])/],
  ['components', /^(\.card|\.tws?|\.sub|\.sheet|\.tool|\.err|\.ok|\.warn|\.note|\.chip|\.chk|table|th|td|tr|tbody|\.act|\.actbar|\.md|\.lc|\.seg|\.stub|\.bar|#tot|\.vat|#toast|#rbody|\.tw|@keyframes)(?![\w-])/],
];
function splitBlocks(css) {          // top-level items of a stylesheet / of an @media body: { pre (comments), head, body|null, text }
  const items = []; let i = 0, depth = 0, start = 0, inStr = null, headEnd = -1;
  for (; i < css.length; i++) {
    const c = css[i];
    if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
    if (c === '/' && css[i + 1] === '*') { i = css.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '{') { if (depth === 0) headEnd = i; depth++; }
    else if (c === '}') { depth--; if (depth === 0) { items.push({ raw: css.slice(start, i + 1), headEnd: headEnd - start }); start = i + 1; } }
  }
  if (css.slice(start).trim()) items.push({ raw: css.slice(start), headEnd: -1, tail: true });
  return items.map(it => {
    if (it.tail) return { pre: css.slice(start).trim(), head: '', body: null, tail: true };
    const head0 = it.raw.slice(0, it.headEnd), m = /^((?:\s*\/\*[\s\S]*?\*\/)*)\s*([\s\S]*)$/.exec(head0);
    return { pre: m[1].trim(), head: m[2].trim(), body: it.raw.slice(it.headEnd + 1, it.raw.length - 1) };
  });
}
const SECTION = /^\/\*\s*([-=]{3,})\s*(.*?)\s*[-=]{3,}\s*\*\/$/;
function classifyCss(css) {
  const out = Object.fromEntries(CSS_FILES.map(f => [f, []])), report = [], lastSection = {};
  let section = '';
  const place = (file, text, sec) => { const o = out[file]; if (sec && lastSection[file] !== sec) { o.push(`/* ---------- ${sec} ---------- */`); lastSection[file] = sec; } o.push(text); };
  const fileFor = head => { const first = head.split(',')[0].trim(); const hit = CSS_CLASSIFY.find(([, re]) => re.test(first)); return hit ? hit[0] : null; };
  const comments = pre => { // split leading comments into section markers (update `section`) and ordinary comments (kept)
    const keep = []; for (const m of pre.match(/\/\*[\s\S]*?\*\//g) || []) { const s = SECTION.exec(m); if (s) section = s[2]; else keep.push(m); } return keep.join('\n'); };
  const dd = t => t.replace(/^    /gm, '');
  for (const it of splitBlocks(css)) {
    if (it.tail) { comments(it.pre); continue; }
    const keep = comments(it.pre);
    if (/^@(media|supports)/.test(it.head)) {
      const inner = splitBlocks(it.body), per = {};
      for (const r of inner) { const k = comments(r.pre); const f = fileFor(r.head) || (warn(`CSS: no file for "${r.head}" inside ${it.head} — put in components`), 'components'); report.push([f, `${it.head} { ${r.head} }`]); (per[f] = per[f] || []).push((k ? k + '\n' : '') + `${r.head} {${r.body}}`); }
      for (const f of CSS_FILES) if (per[f]) place(f, (keep && f === Object.keys(per)[0] ? keep + '\n' : '') + `${it.head} {\n${per[f].map(t => '  ' + dd(t).replace(/\n/g, '\n  ')).join('\n\n')}\n}`, section);
    } else {
      let f = fileFor(it.head); if (!f) { warn(`CSS: no file for "${it.head}" — put in components`); f = 'components'; }
      report.push([f, it.head]); place(f, (keep ? keep + '\n' : '') + dd(`${it.head} {${it.body}}`), section);
    }
  }
  return { out, report };
}

function splitHtml(htmlRaw) {
  console.log('\n— index.html');
  const html = htmlRaw.replace(/\r\n/g, '\n');
  const styles = html.match(/<style>([\s\S]*?)<\/style>/g) || [], scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  if (styles.length !== 1 || scripts.length !== 1) fail(`Expected exactly one <style> and one inline <script> in the HTML (found ${styles.length} and ${scripts.length}).`);
  const css = styles[0].slice(7, -8), js = scripts[0].slice(8, -9);
  return { html, css, js };
}

function splitClientJs(jsRaw) {
  const js = jsRaw.replace(/^\n+/, '').replace(/\s+$/, '') + '\n', ast = parse(js, 'inline <script>'), prot = protectedRanges(ast);
  const chunks = chunkProgram(js, ast, 4);
  const fileOf = new Map(); for (const [f, , names] of CLIENT_SPEC) for (const n of names) { if (fileOf.has(n)) fail(`"${n}" is in two client modules`); fileOf.set(n, f); }
  // V = { ... }: each page renderer becomes its own export
  const vIdx = chunks.findIndex(c => c.names.length === 1 && c.names[0] === 'V'); if (vIdx < 0) fail('Could not find `const V = {...}`.');
  const vChunk = chunks[vIdx], obj = vChunk.declNode.init; if (obj.type !== 'ObjectExpression') fail('V is not an object literal.');
  const vKeys = [], vParts = []; let prev = obj.start + 1;
  for (const p of obj.properties) {
    if (p.type !== 'Property' || p.computed || p.kind !== 'init') fail('Unexpected member in V.');
    const key = p.key.name || p.key.value, eol = js.indexOf('\n', p.end), rest = js.slice(p.end, eol < 0 ? js.length : eol), m = /^[ \t]*,?[ \t]*(\/\/.*)?$/.exec(rest);
    const end = m ? p.end + rest.length : p.end, trail = m && m[1] ? ' ' + m[1].trim() : '';
    const lead = js.slice(prev, p.start).replace(/^[\s,]+/, '').split('\n').map(s => s.trim()).filter(Boolean).join('\n'); prev = end;
    const val = dedent(js.slice(p.value.start, p.value.end), p.value.start, 6, prot);
    vKeys.push(key); vParts.push({ pos: p.start, kind: 'const', names: [key], lead, decl: `const ${key} = ${val};`, trail, exportKw: true });
  }
  const rest = chunks.filter((c, i) => i !== vIdx);
  const unmapped = []; for (const c of [...rest, ...vParts]) { if (c.kind === 'stmt') continue; for (const n of c.names) if (!fileOf.has(n)) unmapped.push(n); }
  if (unmapped.length) fail('Not placed in any client module: ' + unmapped.join(', ') + '\n   → add them to CLIENT_SPEC in migrate.js');
  const have = new Set([...rest, ...vParts].flatMap(c => c.names)); for (const [n, f] of fileOf) if (!have.has(n)) warn(`client map: "${n}" (${f}) is not in the page script — ignored`);
  return { chunks: rest, vParts, vKeys, fileOf, js };
}

function emitClient(C) {
  const { chunks, vParts, vKeys, fileOf } = C, mods = new Map();
  const modOf = f => { if (!mods.has(f)) mods.set(f, { file: f, parts: [], declared: new Set(), lets: new Set() }); return mods.get(f); };
  for (const [f] of CLIENT_SPEC) modOf(f);
  const app = modOf('public/app.js');
  const everything = [...chunks, ...vParts];
  const letNames = new Set(everything.filter(c => c.kind === 'let').flatMap(c => c.names));
  for (const c of everything) {
    const m = modOf(c.kind === 'stmt' ? 'public/app.js' : fileOf.get(c.names[0]));
    const isApp = m === app; c.exportKw = !isApp;
    m.parts.push({ pos: c.pos, text: chunkText(c) }); c.names.forEach(n => { m.declared.add(n); if (c.kind === 'let') m.lets.add(n); });
  }
  const idxM = modOf('public/pages/index.js');
  idxM.parts.push({ pos: 1e12, text: `export const V = {\n  ${['pickByName', ...vKeys.filter(k => k !== 'pickByName')].join(',\n  ')}\n};` }); idxM.declared.add('V');
  const declaredIn = new Map(); for (const m of mods.values()) for (const n of m.declared) declaredIn.set(n, m.file);
  // pass 1: find which `let` variables are assigned from another module -> those get a setter
  const setters = new Map(), exportNames = new Map();
  const bodyOf = m => m.parts.sort((a, b) => a.pos - b.pos).map(p => p.text).join('\n\n');
  const pass = new Map();
  for (const m of mods.values()) { const body = bodyOf(m), r = freeNames(body, m.file); pass.set(m.file, r); for (const [n] of r.writes) if (letNames.has(n)) setters.set(n, 'set' + n[0].toUpperCase() + n.slice(1)); }
  for (const [n, s] of setters) if (declaredIn.has(s)) fail(`setter name ${s} clashes with an existing name`);
  const outFiles = {}, deps = new Map(); const exportsOf = new Map();
  for (const m of mods.values()) {
    let body = bodyOf(m);
    // the home module of a mutable `let` gets its setter; other modules' `x = v` become setX(v)
    for (const n of m.lets) if (setters.has(n)) { const s = setters.get(n); body += `\n\nexport const ${s} = v => (${n} = v);`; m.declared.add(s); declaredIn.set(s, m.file); }
    const r = freeNames(body, m.file); let repl = [];
    for (const [n, ids] of r.writes) if (setters.has(n) && !m.declared.has(n)) {
      const parents = new Map(); walk(r.ast, (node, par) => parents.set(node, par));
      for (const id of ids) { const ae = parents.get(id); if (!ae || ae.type !== 'AssignmentExpression' || ae.operator !== '=' || ae.left !== id) fail(`${m.file}: only plain "${n} = value" assignments can be converted (line ${id.loc.start.line})`); repl.push([ae.start, ae.end, `${setters.get(n)}(${body.slice(ae.right.start, ae.right.end)})`]); }
    }
    repl.sort((a, b) => b[0] - a[0]); for (let i = 1; i < repl.length; i++) if (repl[i][1] > repl[i - 1][0]) fail(m.file + ': nested assignments to a shared variable');
    for (const [a, b, t] of repl) body = body.slice(0, a) + t + body.slice(b);
    const r2 = freeNames(body, m.file), im = new Map(), unknown = [];
    for (const n of r2.free) {
      if (BROWSER_GLOBALS.has(n)) continue;
      const f = declaredIn.get(n); if (!f) { unknown.push(n); continue; } if (f === m.file) continue;
      if (!im.has(f)) im.set(f, new Set()); im.get(f).add(n);
    }
    if (unknown.length) warn(`${m.file}: uses ${unknown.join(', ')} which are not declared in the page script (treated as browser globals)`);
    deps.set(m.file, im); outFiles[m.file] = { body, im, desc: (CLIENT_SPEC.find(x => x[0] === m.file) || [])[1] || '' };
    exportsOf.set(m.file, m.declared);
  }
  // app.js: namespace imports + window mirror for inline onclick="..." handlers
  const libPages = [...mods.keys()].filter(f => f !== 'public/app.js').sort((a, b) => (a.includes('/lib/') ? 0 : 1) - (b.includes('/lib/') ? 0 : 1) || a.localeCompare(b));
  const nsName = f => 'm_' + f.replace(/^public\//, '').replace(/\.js$/, '').replace(/[^\w]/g, '_');
  const lets = [...letNames];
  const appHead = libPages.map(f => `import * as ${nsName(f)} from '${importFn('public/app.js', f)}';`).join('\n');
  const live = lets.filter(n => [...mods.values()].some(m => m.lets.has(n) && m.file !== 'public/app.js')).map(n => { const f = declaredIn.get(n); return `  ['${n}', () => ${nsName(f)}.${n}${setters.has(n) ? `, v => ${nsName(f)}.${setters.get(n)}(v)` : ''}]`; });
  const skip = [...new Set([...vKeys.filter(k => k !== 'pickByName'), ...lets, ...setters.values()])];
  const expose = `
// Inline handlers (onclick="save()", onchange="...tab...") run in the global scope. The old single <script> put every
// top-level name there, so mirror the same names on window. Page renderers (dash, rec, ...) were never global and are skipped.
const NAMESPACES = [${libPages.map(nsName).join(', ')}];
const SKIP = new Set(${JSON.stringify(skip)});
for (const ns of NAMESPACES) for (const k of Object.keys(ns)) {
  if (SKIP.has(k)) continue;
  try { Object.defineProperty(window, k, { value: ns[k], writable: true, configurable: true, enumerable: true }); } catch (e) { console.warn('could not expose', k, e.message); }
}
// Shared variables that handlers read or assign directly (e.g. onclick="tab='rec'; render()") stay live through accessors.
for (const [k, get, set] of [
${live.join(',\n')}
]) Object.defineProperty(window, k, { get, set: set || (() => {}), configurable: true });
`;
  return { outFiles, appHead, expose, deps, nsName, libPages, skip };
}

// ═════════════════════════════════════════════════════════════════════════════
//  main
// ═════════════════════════════════════════════════════════════════════════════
const big = f => { try { return fs.statSync(f).size > 2000; } catch { return false; } };
function pickSources() {
  const s = opt('server') ? path.resolve(opt('server')) : [P('_original/server.js'), P('server.js')].find(big);
  const h = opt('html') ? path.resolve(opt('html')) : [P('_original/index.html'), P('public/index.html'), P('index.html'), P('index_1.html')].find(f => big(f) && /<style>/.test(fs.readFileSync(f, 'utf8')));
  if (!s) fail('Cannot find the original server.js (run from the project folder, or pass --server <file>).');
  if (!h) fail('Cannot find the original index.html with the inline <style>/<script> (pass --html <file>).');
  return { s, h };
}
function restore() {
  for (const [from, to] of [['_original/server.js', 'server.js'], ['_original/index.html', 'public/index.html']]) {
    if (!fs.existsSync(P(from))) fail('Nothing to restore: ' + from + ' does not exist.');
    fs.mkdirSync(path.dirname(P(to)), { recursive: true }); fs.copyFileSync(P(from), P(to)); console.log('restored ' + to);
  }
  console.log('Done. The old two-file app is back (the new server/ and public/ module files are left in place; delete them if you do not want them).');
}

function main() {
  if (flag('restore')) return restore();
  const { s, h } = pickSources();
  console.log(`Root: ${ROOT}${DRY ? '   (DRY RUN: nothing will be written)' : ''}\nserver source: ${path.relative(ROOT, s)}\nhtml source:   ${path.relative(ROOT, h)}`);
  const serverSrc = fs.readFileSync(s, 'utf8'), htmlSrc = fs.readFileSync(h, 'utf8');
  if (!DRY) { fs.mkdirSync(ORIG, { recursive: true }); if (!fs.existsSync(P('_original/server.js'))) fs.writeFileSync(P('_original/server.js'), serverSrc); if (!fs.existsSync(P('_original/index.html'))) fs.writeFileSync(P('_original/index.html'), htmlSrc); }

  // ---- build everything in memory first, so a problem stops the run before any file is touched
  const S = splitServer(serverSrc.replace(/\r\n/g, '\n')), serverFiles = emitServer(S);
  const H = splitHtml(htmlSrc), { out: cssOut, report } = classifyCss(H.css);
  if (flag('report')) { console.log('\nCSS classification:'); for (const [f, sel] of report) console.log('  ' + f.padEnd(11) + sel.slice(0, 90)); }
  const C = splitClientJs(H.js), E = emitClient(C);

  const header = (file, desc) => `// ${file.replace(/^public\//, '')} — ${desc}\n// (split out of the old single-file index.html by migrate.js; code is unchanged)\n`;
  const clientFiles = {};
  for (const [f, o] of Object.entries(E.outFiles)) {
    const imports = [...o.im.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([from, names]) => `import { ${[...names].sort().join(', ')} } from '${importFn(f, from)}';`).join('\n');
    if (f === 'public/app.js') clientFiles[f] = header(f, o.desc) + E.appHead + '\n' + imports + '\n' + E.expose + '\n// ---- boot (was the end of the old <script>) ----\n' + o.body + '\n';
    else clientFiles[f] = header(f, o.desc) + (imports ? imports + '\n' : '') + '\n' + o.body + '\n';
  }
  // CSS files
  const cssFiles = {};
  for (const f of CSS_FILES) cssFiles[`public/styles/${f}.css`] = `/* styles/${f}.css — ${CSS_DESC[f]}\n   (split out of the old index.html <style> by migrate.js; load order: ${CSS_FILES.join(' → ')}) */\n\n${cssOut[f].join('\n\n')}\n`;
  // HTML shell
  const shell = H.html
    .replace(/<style>[\s\S]*?<\/style>/, CSS_FILES.map(f => `<link rel="stylesheet" href="/styles/${f}.css">`).join('\n  '))
    .replace(/<script>[\s\S]*?<\/script>/, '<script type="module" src="/app.js"></script>');

  // ---- verify generated code parses
  for (const [f, t] of [...Object.entries(serverFiles), ['server.js', serverEntry(S)]]) { try { parse(t.replace(/^#!.*/, ''), f); } catch (e) { fail('generated ' + e.message); } }
  for (const [f, t] of Object.entries(clientFiles)) parse(t, f);

  // ---- write
  console.log('\nWriting:');
  put('server.js', serverEntry(S));
  for (const [f, t] of Object.entries(serverFiles)) put(f, t);
  put('public/index.html', shell);
  for (const [f, t] of Object.entries(cssFiles)) put(f, t);
  for (const [f, t] of Object.entries(clientFiles)) put(f, t);
  for (const [f, n] of written) console.log('  ' + f.padEnd(36) + String(n).padStart(5) + ' lines');

  if (!DRY) selfTest();
  console.log(`\n${DRY ? 'Dry run finished' : 'Migration finished'} — ${written.length} files${warnings.length ? `, ${warnings.length} note(s) above` : ''}.`);
  if (!DRY) console.log('Originals saved in ./_original  (node migrate.js --restore puts them back).\nStart it:  node server.js   then open http://localhost:5000');
}
function selfTest() {   // load every server module in a child process (catches typos / missing exports at once)
  const files = written.map(w => w[0]).filter(f => /^server(\/|\.js)/.test(f) && f !== 'server.js');
  const code = `for (const f of ${JSON.stringify(files)}) require('./' + f); console.log('  self-test: all ${files.length} server modules load');`;
  const r = cp.spawnSync(process.execPath, ['-e', code], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.log(r.stderr || r.stdout); fail('self-test failed — run  node migrate.js --restore  and send me the message above'); }
  console.log(r.stdout.trim());
}

try { main(); } catch (e) { console.error('\n✗ ' + e.message); process.exit(1); }
