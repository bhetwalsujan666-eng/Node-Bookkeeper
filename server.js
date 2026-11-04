// Zero-dependency server: `node server.js` then open http://localhost:5000
// Entry point only: the code now lives in ./server (http, store, excel/, posting/, banks, files, routes/).
const http = require('http');
const { readBody, serveStatic } = require('./server/http');
const { dispatch } = require('./server/routes');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (!u.startsWith('/api/')) return serveStatic(res, u);   // the page, /app.js, /pages/*.js, /styles/*.css ...
  readBody(req).then(b => dispatch(req, res, u, b));
}).listen(PORT, () => console.log('Accounts app running at http://localhost:' + PORT));
