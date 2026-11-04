// server/http.js — HTTP helpers: send(), readBody(), serveStatic()
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const fs = require('fs'), path = require('path');

const send = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };

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
}

module.exports = { readBody, send, serveStatic };
