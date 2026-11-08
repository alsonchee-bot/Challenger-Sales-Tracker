/* Weekly auto-import: reads new sell-thru Excel files from a Google Drive folder
   (read-only service account) and saves them to Supabase via save_week.
   Runs from a Vercel cron (see vercel.json). Safe to run repeatedly: re-saving a week replaces it. */
const crypto = require('crypto');
const { parseBuffer } = require('./_parse.js');

const env = (k, d) => (process.env[k] == null || process.env[k] === '' ? d : process.env[k]);
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function loadKey() {
  let raw = env('GOOGLE_SERVICE_ACCOUNT_JSON', '');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  raw = raw.trim();
  if (raw[0] !== '{') raw = Buffer.from(raw, 'base64').toString('utf8');
  const k = JSON.parse(raw);
  if (!k.client_email || !k.private_key) throw new Error('Service account key is missing client_email or private_key');
  return k;
}

async function driveToken(f, key) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300 }));
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(key.private_key);
  const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + b64u(sig) });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('Google sign-in failed: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}

async function listFiles(f, token, folderId, sinceIso) {
  const q = "'" + folderId + "' in parents and trashed=false and modifiedTime > '" + sinceIso + "' and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel')";
  let out = [], page = '';
  do {
    const u = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100&orderBy=modifiedTime&fields=nextPageToken,files(id,name,modifiedTime,size)&q=' + encodeURIComponent(q) + (page ? '&pageToken=' + page : '');
    const r = await f(u, { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json();
    if (!r.ok) throw new Error('Drive list failed: ' + ((j.error && j.error.message) || r.status));
    out = out.concat(j.files || []); page = j.nextPageToken || '';
  } while (page);
  return out;
}

async function download(f, token, id) {
  const r = await f('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('Download failed (' + r.status + ')');
  return Buffer.from(await r.arrayBuffer());
}

async function saveWeek(f, w) {
  const url = env('SUPABASE_URL', 'https://eobbpalodywqszcrqyzt.supabase.co'), key = env('SUPABASE_KEY', 'sb_publishable_Sz-CZ-ZnVDYRY0CMQR5Jyw_UzsDLEYa');
  const r = await f(url + '/rest/v1/rpc/save_week', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ w }) });
  if (!r.ok) throw new Error('Save failed (' + r.status + '): ' + (await r.text()).slice(0, 200));
}

async function run(f, opts) {
  opts = opts || {};
  const folder = env('DRIVE_FOLDER_ID', '');
  if (!folder) throw new Error('DRIVE_FOLDER_ID is not set');
  const brands = env('SYNC_BRANDS', 'MAZER,PANZERGLASS,PITAKA,SUDIO').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const days = +env('SYNC_DAYS', '14');
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const token = await driveToken(f, loadKey());
  const files = await listFiles(f, token, folder, since); // oldest first, so the newest version of a week is saved last
  const res = { checked: files.length, since, saved: [], skipped: [], errors: [] };
  for (const file of files) {
    try {
      const r = parseBuffer(await download(f, token, file.id), file.name);
      if (r.errors.length) { res.skipped.push({ file: file.name, why: r.errors[0] }); continue; }
      const w = r.week, brand = String(w.brand).toUpperCase();
      if (brands.indexOf(brand) < 0) { res.skipped.push({ file: file.name, why: 'brand ' + brand + ' not in allowed list' }); continue; }
      if (!opts.dry) await saveWeek(f, w);
      res.saved.push({ file: file.name, brand, week: w.id, outlets: w.outlets.length, skus: w.skuIds.length });
    } catch (e) { res.errors.push({ file: file.name, error: String(e.message || e) }); }
  }
  return res;
}

module.exports = async (req, res) => {
  const secret = env('CRON_SECRET', '');
  if (secret && (req.headers.authorization || '') !== 'Bearer ' + secret) { res.statusCode = 401; return res.end('Unauthorized'); }
  try {
    const out = await run(fetch, { dry: /[?&]dry=1/.test(req.url || '') });
    console.log('sync', JSON.stringify(out));
    res.setHeader('Content-Type', 'application/json'); res.statusCode = out.errors.length ? 207 : 200; res.end(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('sync failed', e); res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(e.message || e) }));
  }
};
module.exports.run = run;
