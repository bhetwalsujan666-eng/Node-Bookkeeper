#!/usr/bin/env node
// bundle.js: packs the whole project into ONE markdown file (tree + every file's content).
// Usage (run from the project root, next to server/ and public/):
//     node bundle.js              -> writes PROJECT_BUNDLE.md
//     node bundle.js out.md       -> writes out.md
// Then upload that single .md file to the chat.

const fs = require('fs'), path = require('path');

const ROOT = process.cwd();
const OUT = process.argv[2] || 'PROJECT_BUNDLE.md';

// Never walked into
const SKIP_DIRS = new Set(['node_modules', '.git', '.vscode', '.idea', 'dist', 'build', '_original']);
// Listed in the tree but content NOT included (your private data / generated / binary)
const SKIP_CONTENT = [/\.txt$/, /^server_backup\.js$/, /^index_backup\.html$/, /^data\.json/, /^db\.json/, /^settings\.json/, /\.bak-/, /^\.owner$/, /package-lock\.json$/, /\.xlsx$/, /\.(png|jpe?g|gif|webp|ico|woff2?|pdf|zip)$/i];
// Content included only for these types
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.md', '.txt']);

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); }
    else if (e.name !== OUT && e.name !== 'bundle.js') files.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);

// ---- tree ----
const tree = {};
files.forEach(f => f.split('/').reduce((n, part, i, a) => n[part] = i === a.length - 1 ? null : (n[part] || {}), tree));
const lines = [];
(function draw(n, prefix) {
  const keys = Object.keys(n).sort((a, b) => (n[a] ? 0 : 1) - (n[b] ? 0 : 1) || a.localeCompare(b));
  keys.forEach((k, i) => {
    const last = i === keys.length - 1;
    lines.push(prefix + (last ? '└── ' : '├── ') + k + (n[k] ? '/' : ''));
    if (n[k]) draw(n[k], prefix + (last ? '    ' : '│   '));
  });
})(tree, '');

// ---- bundle ----
const out = [];
out.push('# Project bundle', '', `Generated ${new Date().toISOString()} from \`${path.basename(ROOT)}\``, '', '## File tree', '', '```', path.basename(ROOT) + '/', ...lines, '```', '');
let included = 0, skipped = [];
for (const f of files) {
  const name = path.basename(f), ext = path.extname(f).toLowerCase();
  if (SKIP_CONTENT.some(r => r.test(name)) || f === 'migrate.js' || !TEXT_EXT.has(ext)) { skipped.push(f); continue; }
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const fence = '`'.repeat(Math.max(3, (text.match(/`+/g) || []).reduce((m, s) => Math.max(m, s.length), 0) + 1));
  out.push(`## FILE: ${f}`, '', fence + ext.slice(1), text.replace(/\s+$/, ''), fence, '');
  included++;
}
if (skipped.length) out.push('## Files listed but not included (data / binary / generated)', '', ...skipped.map(f => '- ' + f), '');

fs.writeFileSync(path.join(ROOT, OUT), out.join('\n'));
const kb = Math.round(fs.statSync(path.join(ROOT, OUT)).size / 1024);
console.log(`Wrote ${OUT}: ${included} files, ${kb} KB, ${skipped.length} skipped.`);
