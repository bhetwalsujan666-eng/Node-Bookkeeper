// server/routes/settings.js — /api/settings
// (split out of the old single-file server.js by migrate.js; code is unchanged)
const fs = require('fs'), os = require('os'), path = require('path');
const { claimFolder, ownerState } = require('../files');
const { send } = require('../http');
const { FOLDERS } = require('../settings');
const { SETF, loadSet } = require('../store');

async function handle({ req, res, u, b, d }) {
  if (req.method === 'POST' && u === '/api/settings') {
    const x = JSON.parse(b), s = loadSet(); let folder = (x.folder || '').trim();
    if (folder) {
      folder = path.resolve(folder.replace(/^~(?=$|\/)/, os.homedir()));
      try { FOLDERS.forEach(f => fs.mkdirSync(path.join(folder, f), { recursive: true })); fs.accessSync(folder, fs.constants.W_OK); } catch (e) { return send(res, 400, { error: 'Cannot use that folder: ' + e.message }); }
      const st = ownerState(folder); if (!st.ok && !x.takeOver) return send(res, 409, { error: 'That storage folder is already used by another copy of the app (' + st.owner + '). Saving files there from this copy could overwrite that copy\'s files. Choose a different folder.' });
    }
    s.folder = folder; s.auto = Object.fromEntries(['jv', 'pv', 'pmv', 'stm', 'sv', 'rv', 'registers', 'tb', 'pl', 'bs'].map(k => [k, !!(x.auto && x.auto[k])])); s.company = { ...s.company, ...x.company };
    fs.writeFileSync(SETF, JSON.stringify(s, null, 1)); if (folder) claimFolder(folder); return send(res, 200, s);
  }
}

module.exports = { handle };
