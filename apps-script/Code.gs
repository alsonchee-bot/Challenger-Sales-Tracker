/**
 * Murano Sell-Thru Tracker: weekly auto-import (Google Apps Script)
 *
 * Every Monday ~11am this script reads new weekly Excel files from one Google Drive folder and from the Monday report emails (Gmail),
 * works out the brand and week from inside each file, and saves them to the tracker's database.
 * It runs on Google's servers under your Google account (free, no Google Cloud billing).
 *
 * One-time setup: see SETUP.md. No passwords are stored in this file.
 */
var CONFIG = {
  FOLDER_ID: '1x6_4xlpTuK2d9FT4htwkXE5ke6_ISC9r',               // the Drive folder the weekly files land in
  BRANDS: ['MAZER', 'PANZERGLASS', 'PITAKA', 'SUDIO'],           // brands to import; everything else is skipped
  MAIL_FROM: 'mis@challenger.sg',                                 // also read Excel attachments from this sender
  LOOKBACK_DAYS: 8,                                               // only look at files changed in the last N days
  SUPABASE_URL: 'https://eobbpalodywqszcrqyzt.supabase.co',
  SUPABASE_KEY: 'sb_publishable_Sz-CZ-ZnVDYRY0CMQR5Jyw_UzsDLEYa', // public key, same one the website uses
  IMPORTER_USER: 'importer',                                      // tracker username used by this script
  MAIL_DOMAIN: '@sellthru.example.com',
  SEND_EMAIL: true                                                // email a summary after each run
};

function importWeekly() { run_(false); }   // the scheduled job
function dryRun() { run_(true); }          // reads and checks files, saves nothing

function installTrigger() {                // run once: schedules importWeekly every Monday around 11am
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'importWeekly') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('importWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(11).create();
  Logger.log('Scheduled: every Monday between 11:00 and 12:00 (' + Session.getScriptTimeZone() + ').');
}

function run_(dry) {
  var res = { started: new Date().toISOString(), saved: [], skipped: [], errors: [] };
  try {
    var since = Date.now() - CONFIG.LOOKBACK_DAYS * 86400000, items = [];
    // 1) Excel files in the Drive folder
    var it = DriveApp.getFolderById(CONFIG.FOLDER_ID).getFiles();
    while (it.hasNext()) {
      var f = it.next();
      if (!/\.xlsx?$/i.test(f.getName())) continue;
      if (f.getLastUpdated().getTime() < since) continue;
      items.push({ name: f.getName(), time: f.getLastUpdated().getTime(), blob: f.getBlob(), key: f.getId() });
    }
    // 2) Excel attachments on the Monday emails from the Challenger report mailer
    GmailApp.search('from:' + CONFIG.MAIL_FROM + ' has:attachment newer_than:' + CONFIG.LOOKBACK_DAYS + 'd').forEach(function (th) {
      th.getMessages().forEach(function (m) {
        m.getAttachments({ includeInlineImages: false, includeAttachments: true }).forEach(function (a, i) {
          if (!/\.xlsx?$/i.test(a.getName())) return;
          items.push({ name: a.getName(), time: m.getDate().getTime(), blob: a.copyBlob(), key: m.getId() + '-' + i });
        });
      });
    });
    items.sort(function (a, b) { return a.time - b.time; }); // oldest first, so the newest copy of a week wins
    var weeks = {};
    items.forEach(function (f) {
      var name = f.name, tmpId = null;
      try {
        tmpId = Drive.Files.create({ name: 'tmp-import-' + f.key, mimeType: 'application/vnd.google-apps.spreadsheet' }, f.blob).id;
        var ss = SpreadsheetApp.openById(tmpId), sheets = ss.getSheets().map(function (s) { return { name: s.getName(), rows: s.getDataRange().getValues() }; });
        var r = parseRows_(sheets, name);
        if (r.errors.length) { res.skipped.push(name + ': ' + r.errors[0]); return; }
        var w = r.week;
        if (CONFIG.BRANDS.indexOf(String(w.brand).toUpperCase()) < 0) { res.skipped.push(name + ': brand ' + w.brand + ' is not in the list'); return; }
        weeks[String(w.brand).toUpperCase() + '|' + w.id] = { w: w, file: name, warns: r.warns };
      } catch (e) {
        res.errors.push(name + ': ' + e.message);
      } finally {
        if (tmpId) { try { DriveApp.getFileById(tmpId).setTrashed(true); } catch (e2) {} }
      }
    });
    var keys = Object.keys(weeks);
    if (keys.length && !dry) {
      var token = signIn_();
      keys.forEach(function (k) {
        var x = weeks[k];
        try { saveWeek_(token, x.w); res.saved.push(x.w.brand + ' ' + x.w.id + ' (' + x.w.outlets.length + ' outlets, ' + x.w.skuIds.length + ' SKUs) from "' + x.file + '"' + (x.warns.length ? ' [' + x.warns.join(' ') + ']' : '')); }
        catch (e) { res.errors.push(x.file + ': ' + e.message); }
      });
    } else if (dry) {
      keys.forEach(function (k) { var x = weeks[k]; res.saved.push('(dry run) ' + x.w.brand + ' ' + x.w.id + ' from "' + x.file + '"'); });
    }
  } catch (e) {
    res.errors.push(String(e && e.message || e));
  }
  report_(res, dry);
}

function signIn_() {
  var pw = PropertiesService.getScriptProperties().getProperty('IMPORTER_PASSWORD');
  if (!pw) throw new Error('Script property IMPORTER_PASSWORD is not set (Project Settings > Script properties).');
  var r = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: CONFIG.SUPABASE_KEY },
    payload: JSON.stringify({ email: CONFIG.IMPORTER_USER + CONFIG.MAIL_DOMAIN, password: pw })
  });
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200 || !j.access_token) throw new Error('Tracker sign-in failed (' + r.getResponseCode() + '): ' + (j.error_description || j.msg || j.message || ''));
  return j.access_token;
}

function saveWeek_(token, w) {
  var r = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/rpc/save_week', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: CONFIG.SUPABASE_KEY, Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ w: w })
  });
  if (r.getResponseCode() >= 300) throw new Error('Save failed (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));
}

function report_(res, dry) {
  var lines = [(dry ? 'DRY RUN. ' : '') + 'Weekly sell-thru import finished.', '',
    'Saved (' + res.saved.length + '):'].concat(res.saved.length ? res.saved.map(function (s) { return ' - ' + s; }) : [' (none)']);
  if (res.skipped.length) lines = lines.concat(['', 'Skipped (' + res.skipped.length + '):'], res.skipped.map(function (s) { return ' - ' + s; }));
  if (res.errors.length) lines = lines.concat(['', 'PROBLEMS (' + res.errors.length + '):'], res.errors.map(function (s) { return ' - ' + s; }));
  lines.push('', 'Tracker: https://challenger-sales-tracker.vercel.app/');
  var text = lines.join('\n');
  Logger.log(text);
  if (CONFIG.SEND_EMAIL) {
    try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), (res.errors.length ? 'PROBLEM: ' : '') + 'Sell-thru import: ' + res.saved.length + ' saved', text); } catch (e) { Logger.log('Email failed: ' + e.message); }
  }
}

/* ---------- parser (same rules as the website importer); pure functions, no Google services ---------- */
function parseRows_(sheets, fname) {
  var out = { file: fname, errors: [], warns: [], week: null };
  var info = null, txt = '';
  sheets.forEach(function (s) { if (s.name === 'Information') info = s; });
  if (info) info.rows.forEach(function (row) { row.forEach(function (v) { if (v !== null && v !== '' && v !== undefined) txt += ' ' + v; }); });
  var m = txt.match(/YWD:\s*(\d{2,4})\s*Wk\s*(\d{1,2})/i) || txt.match(/(\d{2,4})\s*Wk\s*(\d{1,2})/i);
  if (!m) { out.errors.push('Could not find the week on the Information sheet'); return out; }
  var yr = +m[1]; if (yr < 100) yr += 2000; var wk = +m[2];
  var bm = txt.match(/Brand Name:\s*([^;]+)/i), brand = bm ? bm[1].trim() : '';
  if (!brand) { out.errors.push('Brand name not found in the file'); return out; }
  var ex = txt.match(/Executed on:\s*(.*?)(?:\s{2,}|$)/), exm = txt.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),[^+]*\(\+\d\d:\d\d\)/);
  var rows = null, hi = -1;
  for (var si = 0; si < sheets.length && hi < 0; si++) {
    var r = sheets[si].rows;
    for (var i = 0; i < Math.min(r.length, 12); i++) { if (r[i] && String(r[i][1]).trim() === 'Item ID') { hi = i; rows = r; break; } }
  }
  if (hi < 0) { out.errors.push('Could not find the data table (a header row with "Item ID")'); return out; }
  var hdr = rows[hi], sub = rows[hi + 1] || [], outlets = [], cols = [], sohOff = [];
  var kind = function (v) { v = String(v == null ? '' : v).trim().toLowerCase(); return v === 'soh' ? 'soh' : (v === 'sell-thru' || v === 'sell thru' || v === 'sellthru' ? 'st' : ''); };
  var totCol = -1;
  for (var c0 = 0; c0 < hdr.length; c0++) { if (String(hdr[c0]).trim().toLowerCase() === 'total') { totCol = c0; break; } }
  var tSoh = -1, tSt = -1;
  if (totCol >= 0) {
    if (kind(sub[totCol]) === 'soh' && kind(sub[totCol + 1]) === 'st') { tSoh = totCol; tSt = totCol + 1; }
    else if (kind(sub[totCol]) === 'st' && kind(sub[totCol + 1]) === 'soh') { tSt = totCol; tSoh = totCol + 1; }
  }
  var skip = totCol >= 0 ? totCol + 2 : 3;
  for (var c = skip; c < hdr.length; c++) {
    if (hdr[c] != null && String(hdr[c]).trim() !== '') {
      var k1 = kind(sub[c]), k2 = kind(sub[c + 1]);
      if (!((k1 === 'soh' && k2 === 'st') || (k1 === 'st' && k2 === 'soh'))) { out.errors.push('Outlet "' + hdr[c] + '" needs one SOH and one Sell-Thru column side by side'); return out; }
      outlets.push(String(hdr[c]).trim()); cols.push(c); sohOff.push(k1 === 'soh' ? 0 : 1);
    }
  }
  if (!outlets.length) { out.errors.push('No outlet columns found'); return out; }
  var ids = [], descs = [], soh = [], st = [], tot = null, num = function (v) { return typeof v === 'number' ? v : (v == null || v === '' ? 0 : (isNaN(+v) ? 0 : +v)); };
  var O = outlets.length;
  for (var r2 = hi + 2; r2 < rows.length; r2++) {
    var row = rows[r2] || [];
    if (String(row[0]).trim() === 'Total') { if (tSoh >= 0) tot = { soh: num(row[tSoh]), st: num(row[tSt]) }; break; }
    if (row[1] == null || String(row[1]).trim() === '') continue;
    ids.push(String(row[1]).trim()); descs.push(String(row[2] || '').trim());
    for (var o = 0; o < O; o++) { soh.push(num(row[cols[o] + sohOff[o]])); st.push(num(row[cols[o] + 1 - sohOff[o]])); }
  }
  if (!ids.length) { out.errors.push('No SKU rows found under the header'); return out; }
  var ssoh = soh.reduce(function (a, b) { return a + b; }, 0), sst = st.reduce(function (a, b) { return a + b; }, 0);
  if (tot && (tot.soh !== ssoh || tot.st !== sst)) out.warns.push('Outlet columns add up to ' + ssoh + ' on hand / ' + sst + ' sold but the Total row says ' + tot.soh + ' / ' + tot.st + '.');
  out.week = { id: yr + '-W' + (wk < 10 ? '0' : '') + wk, year: yr, week: wk, brand: brand, executed: exm ? exm[0] : (ex ? ex[1] : ''), outlets: outlets, skuIds: ids, skuDescs: descs, soh: soh, st: st, source: fname };
  return out;
}
