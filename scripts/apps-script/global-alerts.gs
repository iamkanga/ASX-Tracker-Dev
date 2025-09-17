/**
 * Apps Script for automated alert processing and data management, and for serving data to a web app.
 * Version: 2.3.0 (Central Commit Helper + Movers Market Hours Guard + Secrets Cleanup)
 *
 * Includes:
 *  - Centralized 52-week high/low scan (global document)
 *  - Centralized global movers scan (directional % / $ change) with market hours guard
 *  - Generic Firestore commit helper (commitCentralDoc_)
 *  - Settings sheet readers & helpers
 *  - Legacy per-user alert processing utilities (retained)
 */

// ======================== CONFIGURATION ========================
const PRICE_SHEET_NAME = 'Prices';
const SETTINGS_SHEET_NAME = 'Settings';
// Dedicated vertical key/value global configuration sheet (Option A)
const GLOBAL_SETTINGS_SHEET_NAME = 'GlobalConfig';
const ALERT_LOG_SHEET_NAME = 'Alerts';
const SUPPRESSION_LOG_SHEET_NAME = 'SuppressionLog';

const ALERT_RECIPIENT = 'iamkanga@gmail.com'; // Default fallback recipient (consider externalizing)
const ASX_TIME_ZONE = 'Australia/Sydney';

// Firestore / App identity (align APP_ID with frontend currentAppId / Firebase projectId)
const FIREBASE_PROJECT_ID = 'asx-watchlist-app';
const APP_ID = 'asx-watchlist-app';

// Base Firestore REST endpoint
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';

// ===============================================================
// TEMPORARY TEST OVERRIDES
// Set to true to disable market hours guards for manual after-hours testing.
// Remember to set back to false (or remove) before committing to production.
const TEMP_DISABLE_MARKET_HOURS_GUARD = true; // <<< TEMPORARY

// ===============================================================
// ============= GENERIC FIRESTORE COMMIT UTILITIES ==============
// ===============================================================

/** Convert a plain JS value into Firestore Value format. */
function _toFsValue_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(_toFsValue_) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  const t = typeof v;
  if (t === 'string') return { stringValue: v };
  if (t === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (t === 'boolean') return { booleanValue: v };
  // Allow pre-encoded Firestore value objects to pass through
  if (v && (v.stringValue || v.integerValue || v.doubleValue || v.booleanValue || v.arrayValue || v.mapValue || v.nullValue || v.timestampValue)) return v;
  // Object -> mapValue
  const fields = {};
  Object.keys(v).forEach(k => fields[k] = _toFsValue_(v[k]));
  return { mapValue: { fields } };
}

/** Recursively collect updateMask field paths from a plain object. */
function _collectFieldPaths_(prefix, obj, out) {
  Object.keys(obj).forEach(k => {
    const val = obj[k];
    const path = prefix ? (prefix + '.' + k) : k;
    const isPlainObj = val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) &&
      !(val.stringValue || val.integerValue || val.doubleValue || val.booleanValue || val.arrayValue || val.mapValue || val.nullValue || val.timestampValue);
    if (isPlainObj) {
      _collectFieldPaths_(path, val, out);
    } else {
      out.push(path);
    }
  });
}

/**
 * Upserts a central Firestore document via REST using ScriptApp OAuth token.
 * @param {string[]} docPathSegments e.g. ['artifacts', APP_ID, 'alerts', 'HI_LO_52W']
 * @param {Object} plainData Plain object of fields (primitives, Date, arrays, nested objects)
 * @param {string[]=} explicitMask Optional explicit updateMask paths
 * @returns {{ok:boolean,status:number,body?:object,error?:string}}
 */
function commitCentralDoc_(docPathSegments, plainData, explicitMask) {
  try {
    const token = ScriptApp.getOAuthToken();
    const docPath = docPathSegments.map(encodeURIComponent).join('/');
    const docName = 'projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents/' + docPath;
    // Build fields
    const fields = {};
    Object.keys(plainData || {}).forEach(k => fields[k] = _toFsValue_(plainData[k]));
    // Build update mask if not provided
    let fieldPaths = explicitMask && explicitMask.length ? explicitMask.slice() : [];
    if (!fieldPaths.length) _collectFieldPaths_('', plainData, fieldPaths);

    const body = {
      writes: [ {
        update: { name: docName, fields },
        updateMask: { fieldPaths }
      } ]
    };

    const resp = UrlFetchApp.fetch(FIRESTORE_BASE + '/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents:commit', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    const status = resp.getResponseCode();
    const text = resp.getContentText() || '';
    let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch(_){ }
    if (status >= 200 && status < 300) {
      Logger.log('[CentralCommit] OK %s doc=%s', status, docPath);
      return { ok: true, status, body: parsed };
    }
    Logger.log('[CentralCommit] ERROR %s doc=%s\n%s', status, docPath, text);
    return { ok: false, status, error: text, body: parsed };
  } catch (err) {
    Logger.log('[CentralCommit] EXCEPTION %s', err && err.stack || err);
    return { ok: false, status: 0, error: String(err) };
  }
}

// ===============================================================
// ================= 52-WEEK HIGH / LOW SCAN =====================
// ===============================================================

function runGlobal52WeekScan() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settings = getSettingsFromSheet_(ss, { sheetName: GLOBAL_SETTINGS_SHEET_NAME });
    if (!settings) { Logger.log('[HiLo] Settings not found'); return; }
    const allAsxData = fetchAllAsxData_(ss);

    const minPrice = Number(settings.hiLoMinimumPrice || 0) || 0;
    const minMarketCap = Number(settings.hiLoMinimumMarketCap || 0) || 0;
    const emailEnabled = !!settings.emailAlertsEnabled;

    const highObjs = []; const lowObjs = [];
    allAsxData.forEach(stock => {
      if (!stock.code || isNaN(stock.livePrice) || stock.livePrice < minPrice || (stock.marketCap!=null && stock.marketCap < minMarketCap)) return;
      const reachedLow = (!isNaN(stock.low52) && stock.livePrice <= stock.low52);
      const reachedHigh = (!isNaN(stock.high52) && stock.livePrice >= stock.high52);
      if (reachedLow || reachedHigh) {
        // Normalize object shape for frontend cards
        const o = {
          code: stock.code,
          name: stock.name || stock.companyName || null,
            live: isNaN(stock.livePrice)? null : stock.livePrice,
          high52: isNaN(stock.high52)? null : stock.high52,
          low52: isNaN(stock.low52)? null : stock.low52,
          marketCap: (stock.marketCap!=null && !isNaN(stock.marketCap)) ? stock.marketCap : null,
          prevClose: (stock.prevClose!=null && !isNaN(stock.prevClose)) ? stock.prevClose : null
        };
        if (reachedLow) lowObjs.push(o);
        if (reachedHigh) highObjs.push(o);
      }
    });

    writeGlobalHiLoDoc_(highObjs, lowObjs); // Persist rich objects

    // Backward-compatible email expects arrays of codes only
    const highsCodes = highObjs.map(o=>o.code);
    const lowsCodes  = lowObjs.map(o=>o.code);
    if (emailEnabled && (highsCodes.length || lowsCodes.length)) {
      sendHiLoEmailIfAny_({ highs: highsCodes, lows: lowsCodes }, settings);
    }
  } catch (e) {
    console.error('[HiLo] Scan error', e);
  }
}

function fetchAllAsxData_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(PRICE_SHEET_NAME);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values.shift();
  const map = headers.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});
  const nameKey = ['Company Name','CompanyName','Name'].find(k=> map[k]!=null);
  const prevKey = map['PrevDayClose']!=null ? 'PrevDayClose' : (map['PrevClose']!=null ? 'PrevClose' : null);
  return values.map(r => ({
    code: r[map['ASX Code']],
    name: nameKey ? r[map[nameKey]] : null,
    livePrice: parseFloat(r[map['LivePrice']]),
    high52: parseFloat(r[map['High52']]),
    low52: parseFloat(r[map['Low52']]),
    marketCap: parseFloat(r[map['MarketCap']]),
    prevClose: prevKey ? parseFloat(r[map[prevKey]]) : null
  }));
}

function writeGlobalHiLoDoc_(highsArr, lowsArr) {
  // Accept either arrays of codes (string) or rich objects
  function normalizeEntry(e) {
    if (e == null) return null;
    if (typeof e === 'string') return { code: e.trim().toUpperCase() };
    const code = (e.code || e.shareCode || '').toString().trim().toUpperCase();
    if (!code) return null;
    return {
      code,
      name: e.name || e.companyName || null,
      live: (e.live!=null && !isNaN(e.live)) ? Number(e.live) : (e.livePrice!=null && !isNaN(e.livePrice)? Number(e.livePrice): null),
      high52: (e.high52!=null && !isNaN(e.high52)) ? Number(e.high52) : (e.High52!=null && !isNaN(e.High52)? Number(e.High52): null),
      low52: (e.low52!=null && !isNaN(e.low52)) ? Number(e.low52) : (e.Low52!=null && !isNaN(e.Low52)? Number(e.Low52): null),
      marketCap: (e.marketCap!=null && !isNaN(e.marketCap)) ? Number(e.marketCap) : null,
      prevClose: (e.prevClose!=null && !isNaN(e.prevClose)) ? Number(e.prevClose) : null
    };
  }
  const highsObjs = (Array.isArray(highsArr)? highsArr : []).map(normalizeEntry).filter(Boolean);
  const lowsObjs  = (Array.isArray(lowsArr)? lowsArr : []).map(normalizeEntry).filter(Boolean);
  const data = {
    updatedAt: new Date(),
    highs: highsObjs,
    lows: lowsObjs,
    highCodes: highsObjs.map(o=>o.code), // backward-compatible simple arrays
    lowCodes: lowsObjs.map(o=>o.code)
  };
  // Provide explicit mask so we don't accumulate stale fields
  const mask = ['updatedAt','highs','lows','highCodes','lowCodes'];
  return commitCentralDoc_(['artifacts', APP_ID, 'alerts', 'HI_LO_52W'], data, mask);
}

function test_writeGlobalHiLoDoc_() {
  const r = writeGlobalHiLoDoc_(['ABC','BHP','CBA'], ['XYZ','QQQ']);
  Logger.log('HiLo test commit: %s', JSON.stringify(r));
}

function sendHiLoEmailIfAny_(results, settings) {
  const recipient = settings.alertEmailRecipients || ALERT_RECIPIENT;
  if (!recipient) return;
  const highsCount = results.highs.length; const lowsCount = results.lows.length;
  if (!highsCount && !lowsCount) return;
  let subject = 'ASX 52-Week Alert Summary';
  let body = 'The following stocks have hit 52-week price points:\n\n';
  if (highsCount) { body += `--- 52-WEEK HIGHS (${highsCount}) ---\n` + results.highs.join('\n') + '\n\n'; }
  if (lowsCount) { body += `--- 52-WEEK LOWS (${lowsCount}) ---\n` + results.lows.join('\n') + '\n\n'; }
  body += `Filters Applied:\n- Minimum Price: $${settings.hiLoMinimumPrice || 'N/A'}\n- Minimum Market Cap: $${(settings.hiLoMinimumMarketCap||0).toLocaleString()}\n`;
  MailApp.sendEmail(recipient, subject, body);
}

// ===============================================================
// ================== GLOBAL MOVERS (CENTRAL) ====================
// ===============================================================

function runGlobalMoversScan() {
  try {
    // Market hours guard (Sydney ~10:00 to 16:59) – adjust if needed
    const now = new Date();
    const hourSydney = Number(Utilities.formatDate(now, ASX_TIME_ZONE, 'HH'));
    if (!TEMP_DISABLE_MARKET_HOURS_GUARD) {
      if (hourSydney < 10 || hourSydney >= 17) {
        console.log('[MoversScan] Outside market hours (' + hourSydney + 'h). Skipping.');
        return;
      }
    } else {
      console.log('[MoversScan][TEMP] Market hours guard disabled for manual test (hour=' + hourSydney + ').');
    }
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const settings = getSettingsFromSheet_(spreadsheet, { sheetName: GLOBAL_SETTINGS_SHEET_NAME });
    if (!settings) { console.log('[MoversScan] Settings not found; aborting.'); return; }
    const thresholds = normalizeDirectionalThresholds_(settings);
    if (!thresholds.anyActive) {
      console.log('[MoversScan] No directional thresholds configured; clearing doc.');
      writeGlobalMoversDoc_([], [], thresholds);
      return;
    }
    const priceRows = fetchPriceRowsForMovers_(spreadsheet);
    if (!priceRows.length) { console.log('[MoversScan] No price data rows; aborting.'); return; }
    const { upMovers, downMovers } = evaluateMovers_(priceRows, thresholds);
    console.log('[MoversScan] Evaluation complete', { up: upMovers.length, down: downMovers.length, total: upMovers.length + downMovers.length, thresholds });
    writeGlobalMoversDoc_(upMovers, downMovers, thresholds);
  } catch (err) {
    console.error('[MoversScan] ERROR:', err && err.stack || err);
  }
}

function normalizeDirectionalThresholds_(settings) {
  function numOrNull(v) { if (v === '' || v == null) return null; const n = Number(v); return (!isFinite(n) || n <= 0) ? null : n; }
  const upPercent = numOrNull(settings.globalPercentIncrease);
  const upDollar = numOrNull(settings.globalDollarIncrease);
  const downPercent = numOrNull(settings.globalPercentDecrease);
  const downDollar = numOrNull(settings.globalDollarDecrease);
  const minimumPrice = numOrNull(settings.globalMinimumPrice);
  const anyActive = !!(upPercent || upDollar || downPercent || downDollar);
  return { upPercent, upDollar, downPercent, downDollar, minimumPrice, anyActive };
}

function fetchPriceRowsForMovers_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(PRICE_SHEET_NAME);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift();
  const map = {}; headers.forEach((h,i)=> map[h]=i);
  const codeIdx = map['ASX Code'];
  const liveIdx = map['LivePrice'];
  const prevIdx = map['PrevDayClose'] != null ? map['PrevDayClose'] : map['PrevClose'];
  const nameIdx = (map['Company Name']!=null) ? map['Company Name'] : (map['CompanyName']!=null ? map['CompanyName'] : (map['Name']!=null ? map['Name'] : null));
  if (codeIdx == null || liveIdx == null || prevIdx == null) return [];
  const rows = [];
  values.forEach(r => {
    const codeRaw = r[codeIdx]; if (!codeRaw) return;
    const live = r[liveIdx]; const prev = r[prevIdx];
    if (live == null || prev == null || live === '' || prev === '' || prev === 0) return;
    const liveNum = Number(live); const prevNum = Number(prev);
    if (!isFinite(liveNum) || !isFinite(prevNum) || prevNum === 0) return;
    rows.push({ code: String(codeRaw).trim().toUpperCase(), live: liveNum, prev: prevNum, name: (nameIdx!=null? r[nameIdx] : null) });
  });
  return rows;
}

function evaluateMovers_(rows, thresholds) {
  const upObjs = []; const downObjs = [];
  const seenUp = new Set(); const seenDown = new Set();
  rows.forEach(row => {
    const { code, live, prev } = row;
    if (!code) return;
    if (thresholds.minimumPrice && live < thresholds.minimumPrice) return;
    const change = live - prev; if (change === 0) return;
    const pct = (change / prev) * 100; const absChange = Math.abs(change);
    const directionUp = change > 0;
    const qualifiesUp = directionUp && ((thresholds.upPercent && pct >= thresholds.upPercent) || (thresholds.upDollar && absChange >= thresholds.upDollar));
    const qualifiesDown = !directionUp && ((thresholds.downPercent && Math.abs(pct) >= thresholds.downPercent) || (thresholds.downDollar && absChange >= thresholds.downDollar));
    if (qualifiesUp || qualifiesDown) {
      const obj = {
        code,
        name: row.name || null,
        live,
        prevClose: prev,
        change,
        pct,
        absChange: absChange,
        direction: directionUp ? 'up' : 'down'
      };
      if (qualifiesUp && !seenUp.has(code)) { upObjs.push(obj); seenUp.add(code); }
      if (qualifiesDown && !seenDown.has(code)) { downObjs.push(obj); seenDown.add(code); }
    }
  });
  // Sort each by percent magnitude descending
  upObjs.sort((a,b)=> b.pct - a.pct);
  downObjs.sort((a,b)=> Math.abs(b.pct) - Math.abs(a.pct));
  return { upMovers: upObjs, downMovers: downObjs };
}

function writeGlobalMoversDoc_(upMovers, downMovers, thresholds) {
  // upMovers / downMovers expected as arrays of rich objects from evaluateMovers_
  function norm(o){
    if (!o) return null;
    if (typeof o === 'string') return { code: o.toUpperCase() };
    const code = (o.code||'').toString().trim().toUpperCase(); if (!code) return null;
    return {
      code,
      name: o.name || null,
      live: (o.live!=null && !isNaN(o.live)) ? Number(o.live) : null,
      prevClose: (o.prevClose!=null && !isNaN(o.prevClose)) ? Number(o.prevClose) : (o.prev!=null && !isNaN(o.prev)? Number(o.prev): null),
      change: (o.change!=null && !isNaN(o.change)) ? Number(o.change) : (o.live!=null && o.prevClose!=null ? Number(o.live - o.prevClose) : null),
      pct: (o.pct!=null && !isNaN(o.pct)) ? Number(o.pct) : (o.change!=null && o.prevClose ? (o.change / o.prevClose)*100 : null),
      absChange: (o.absChange!=null && !isNaN(o.absChange)) ? Number(o.absChange) : (o.change!=null ? Math.abs(o.change) : null),
      direction: o.direction || ( (o.change!=null && o.change>0) ? 'up':'down')
    };
  }
  const upObjs = (Array.isArray(upMovers)? upMovers: []).map(norm).filter(Boolean);
  const downObjs = (Array.isArray(downMovers)? downMovers: []).map(norm).filter(Boolean);
  const upCodes = upObjs.map(o=>o.code);
  const downCodes = downObjs.map(o=>o.code);
  const data = {
    updatedAt: new Date(),
    upCount: upCodes.length,
    downCount: downCodes.length,
    totalCount: upCodes.length + downCodes.length,
    up: upObjs,
    down: downObjs,
    upCodes: upCodes, // backward compatible arrays of codes
    downCodes: downCodes,
    upSample: upCodes.slice(0,50),
    downSample: downCodes.slice(0,50),
    thresholds: {
      upPercent: thresholds.upPercent ?? null,
      upDollar: thresholds.upDollar ?? null,
      downPercent: thresholds.downPercent ?? null,
      downDollar: thresholds.downDollar ?? null,
      minimumPrice: thresholds.minimumPrice ?? null
    }
  };
  const mask = [ 'updatedAt','upCount','downCount','totalCount','up','down','upCodes','downCodes','upSample','downSample',
    'thresholds.upPercent','thresholds.upDollar','thresholds.downPercent','thresholds.downDollar','thresholds.minimumPrice' ];
  return commitCentralDoc_(['artifacts', APP_ID, 'alerts', 'GLOBAL_MOVERS'], data, mask);
}

function test_runGlobalMoversScan() { runGlobalMoversScan(); }

// ===============================================================
// ================= SETTINGS / SHARED HELPERS ==================
// ===============================================================

function getSettingsFromSheet_(spreadsheet, options) {
  const targetSheetName = (options && options.sheetName) ? options.sheetName : SETTINGS_SHEET_NAME;
  const sheet = spreadsheet.getSheetByName(targetSheetName);
  if (!sheet) {
    Logger.log('[SettingsDebug] Sheet "%s" not found.', targetSheetName);
    return null;
  }

  const debug = !(options && options.debug === false); // default ON for now
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) {
    if (debug) Logger.log('[SettingsDebug] Sheet "%s" is empty.', targetSheetName);
    return {};
  }

  // Expected canonical (camelCase) keys used by code elsewhere.
  const expectedKeys = [
    'globalPercentIncrease',
    'globalDollarIncrease',
    'globalPercentDecrease',
    'globalDollarDecrease',
    'globalMinimumPrice',
    'hiLoMinimumPrice',
    'hiLoMinimumMarketCap',
    'emailAlertsEnabled',
    'alertEmailRecipients'
  ];

  function normalizeKey_(k) {
    if (k == null) return '';
    const trimmed = String(k).trim();
    if (!trimmed) return '';
    // Collapse punctuation / whitespace to single spaces then camelCase.
    const parts = trimmed.replace(/[^A-Za-z0-9]+/g, ' ').split(' ').filter(Boolean);
    if (!parts.length) return '';
    return parts.map((p,i)=> i===0 ? p.charAt(0).toLowerCase()+p.slice(1) : p.charAt(0).toUpperCase()+p.slice(1).toLowerCase()).join('');
  }

  const settings = {};              // canonical camelCase -> value
  const rawKeyMap = {};             // raw label -> value
  const normalizedCollisions = {};  // track if multiple raw keys map to same normalized key
  const debugRows = [];             // for logging

  // Each row: first cell = key, second cell = value (ignore others)
  values.forEach((row, idx) => {
    if (!row || row.length < 2) return;
    const rawKey = row[0];
    if (rawKey == null || rawKey === '') return;
    const value = row[1];
    const norm = normalizeKey_(rawKey);
    if (norm) {
      if (settings.hasOwnProperty(norm) && settings[norm] !== value) {
        // collision
        normalizedCollisions[norm] = normalizedCollisions[norm] || [];
        normalizedCollisions[norm].push({ row: idx+1, rawKey, value });
      }
      settings[norm] = value;
    }
    rawKeyMap[rawKey] = value;
    debugRows.push({ row: idx+1, rawKey: String(rawKey), normalized: norm, value });
  });

  if (debug) {
    Logger.log('================ [SettingsDebug] BEGIN =================');
  Logger.log('[SettingsDebug] Sheet: %s | Rows scanned: %s', targetSheetName, values.length);
    Logger.log('[SettingsDebug] Raw rows (row#, rawKey => normalized => value):');
    debugRows.forEach(r => Logger.log('  #%s  "%s" => %s => %s', r.row, r.rawKey, r.normalized || '(none)', r.value));
    Logger.log('[SettingsDebug] Canonical settings object (post-normalization): %s', JSON.stringify(settings));
    if (Object.keys(normalizedCollisions).length) {
      Logger.log('[SettingsDebug] COLLISIONS detected (multiple raw keys mapped to same normalized key): %s', JSON.stringify(normalizedCollisions));
    }
    expectedKeys.forEach(k => {
      if (settings.hasOwnProperty(k)) {
        Logger.log('[SettingsDebug] ✔ Found expected key "%s" = %s', k, settings[k]);
      } else {
        Logger.log('[SettingsDebug] ✖ Missing expected key "%s"', k);
      }
    });
    Logger.log('[SettingsDebug] Raw key map (exact labels as in sheet): %s', JSON.stringify(rawKeyMap));
    Logger.log('================ [SettingsDebug] END ===================');
  }

  // Provide access to raw metadata for deeper diagnostics if needed.
  settings._raw = rawKeyMap;
  settings._debugInfo = {
    rowCount: values.length,
    collisions: normalizedCollisions,
    expectedKeysMissing: expectedKeys.filter(k => !settings.hasOwnProperty(k)),
    timestamp: new Date().toISOString()
  };
  return settings;
}

// ===============================================================
// ========== LEGACY PER-USER ALERT PROCESSING (UNCHANGED) ======
// ===============================================================

function checkMarketAlerts() {
  const now = new Date();
  const asxTime = Utilities.formatDate(now, ASX_TIME_ZONE, 'HH');
  // TEMP: Disable market hours guard if override flag enabled
  if (TEMP_DISABLE_MARKET_HOURS_GUARD || (asxTime >= 10 && asxTime < 16)) {
    console.log(`[${now}] Checking market alerts...`);
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const priceData = fetchAllPriceData(spreadsheet, PRICE_SHEET_NAME);
      if (!priceData || priceData.length === 0) { console.error('No price data found. Exiting.'); return; }
      const alertRules = fetchAlertRules(spreadsheet, SETTINGS_SHEET_NAME);
      if (!alertRules || Object.keys(alertRules).length === 0) { console.log('No user alerts configured. Exiting.'); return; }
      const suppressionLog = getSuppressionLog(spreadsheet, SUPPRESSION_LOG_SHEET_NAME);
      processAlerts(priceData, alertRules, suppressionLog, spreadsheet);
    } catch (e) { console.error(`Error in checkMarketAlerts: ${e.message}`); }
  } else {
    console.log(`[${now}] Market is closed. Skipping alert check (override OFF).`);
  }
}

function captureDailyClosePrice() {
  const now = new Date();
  console.log(`[${now}] Capturing daily closing prices...`);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const priceSheet = spreadsheet.getSheetByName(PRICE_SHEET_NAME);
  if (!priceSheet) { console.error(`Price data sheet "${PRICE_SHEET_NAME}" not found.`); return; }
  const range = priceSheet.getDataRange();
  const values = range.getValues();
  if (values.length === 0) return;
  const headers = values[0];
  const headersMap = headers.reduce((acc, header, index) => { acc[header.replace(/[^a-zA-Z0-9]/g, '')] = index; return acc; }, {});
  const livePriceColIndex = headersMap['LivePrice'];
  const prevCloseColIndex = headersMap['PrevDayClose'];
  if (livePriceColIndex === undefined || prevCloseColIndex === undefined) { console.error('Missing essential columns.'); return; }
  for (let i = 1; i < values.length; i++) {
    const livePrice = values[i][livePriceColIndex];
    if (livePrice !== null && livePrice !== '') priceSheet.getRange(i + 1, prevCloseColIndex + 1).setValue(livePrice);
  }
  console.log(`[${now}] Daily closing prices captured.`);
}

function dailyResetTrigger() {
  const now = new Date();
  console.log(`[${now}] Clearing daily suppression log...`);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const suppressionLogSheet = spreadsheet.getSheetByName(SUPPRESSION_LOG_SHEET_NAME);
  if (suppressionLogSheet) {
    suppressionLogSheet.clear();
    suppressionLogSheet.appendRow(['UserID', 'ASXCode', 'TriggerTime']);
    console.log(`[${now}] Suppression log cleared.`);
  } else {
    console.error(`Suppression log sheet "${SUPPRESSION_LOG_SHEET_NAME}" not found.`);
  }
}

function fetchAllPriceData(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return null;
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const data = [];
  const headersMap = headers.reduce((acc, header, index) => { acc[header.replace(/[^a-zA-Z0-9]/g, '')] = index; return acc; }, {});
  const asxCodeColIndex = headersMap['ASXCode'];
  const livePriceColIndex = headersMap['LivePrice'];
  const prevCloseColIndex = headersMap['PrevClose'];
  if (asxCodeColIndex === undefined || livePriceColIndex === undefined || prevCloseColIndex === undefined) { console.error('Missing essential columns.'); return null; }
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const asxCode = row[asxCodeColIndex];
    if (asxCode && row[livePriceColIndex] !== '') {
      data.push({
        ASXCode: String(asxCode).trim().toUpperCase(),
        LivePrice: parseFloat(row[livePriceColIndex]),
        PrevClose: parseFloat(row[prevCloseColIndex]),
      });
    }
  }
  return data;
}

function fetchAlertRules(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) { console.error(`Settings sheet "${sheetName}" not found.`); return null; }
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return null;
  const headers = values[0];
  const rules = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const userRules = headers.reduce((acc, header, index) => { acc[header] = row[index]; return acc; }, {});
    if (userRules.UserID) rules[userRules.UserID] = userRules;
  }
  return rules;
}

function getSuppressionLog(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const suppressionSet = new Set();
  if (sheet) {
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) { if (values[i][1]) suppressionSet.add(values[i][1].toUpperCase()); }
  }
  return suppressionSet;
}

function processAlerts(priceData, alertRules, suppressionLog, spreadsheet) {
  const alertLogSheet = spreadsheet.getSheetByName(ALERT_LOG_SHEET_NAME);
  const suppressionLogSheet = spreadsheet.getSheetByName(SUPPRESSION_LOG_SHEET_NAME);
  if (!alertLogSheet || !suppressionLogSheet) { console.error('Alerts or SuppressionLog sheets not found.'); return; }
  const now = new Date();
  const userID = Object.keys(alertRules)[0];
  const rules = alertRules[userID];
  for (const stock of priceData) {
    const asxCode = stock.ASXCode;
    const livePrice = stock.LivePrice;
    const prevClose = stock.PrevClose;
    if (suppressionLog.has(asxCode)) continue;
    if (livePrice >= rules.Min_Price_Threshold_Fall && prevClose > 0) {
      const percentageChange = ((livePrice - prevClose) / prevClose) * 100;
      let alertTriggered = false; let alertType = ''; let alertMessage = '';
      if (percentageChange <= -rules.Fall_Percentage_Threshold) { alertTriggered = true; alertType='Fall Alert'; alertMessage = `Price fell by ${(-percentageChange).toFixed(2)}% to $${livePrice.toFixed(2)}`; }
      if (percentageChange >= rules.Rise_Percentage_Threshold) { alertTriggered = true; alertType='Rise Alert'; alertMessage = `Price rose by ${percentageChange.toFixed(2)}% to $${livePrice.toFixed(2)}`; }
      if (alertTriggered) {
        console.log(`Alert Triggered for ${asxCode}: ${alertType}`);
        alertLogSheet.appendRow([now, userID, asxCode, alertType, alertMessage]);
        suppressionLogSheet.appendRow([userID, asxCode, now]);
        const subject = `Alert for ${asxCode}: ${alertType}`;
        const body = `${asxCode} - ${alertMessage}\n\nThis alert was triggered at ${now}`;
        sendAlertEmail(ALERT_RECIPIENT, subject, body);
      }
    }
  }
}

function sendAlertEmail(recipient, subject, body) {
  try { MailApp.sendEmail(recipient, subject, body); console.log(`Email sent to ${recipient} (${subject})`); }
  catch (e) { console.error('Failed to send email:', e); }
}

// ===============================================================
// ================== TRIGGER MANAGEMENT HELPERS =================
// ===============================================================

function createTriggers() {
  ScriptApp.newTrigger('checkMarketAlerts').timeBased().everyMinutes(5).atHour(10).create();
  ScriptApp.newTrigger('checkMarketAlerts').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('captureDailyClosePrice').timeBased().atHour(16).nearMinute(5).create();
  ScriptApp.newTrigger('dailyResetTrigger').timeBased().atHour(3).nearMinute(0).create();
  ScriptApp.newTrigger('runGlobalMoversScan').timeBased().everyMinutes(10).create();
  console.log('Triggers created (market alerts, close capture, daily reset, movers scan).');
}

function deleteTriggers() {
  const all = ScriptApp.getProjectTriggers();
  all.forEach(t => { try { ScriptApp.deleteTrigger(t); } catch(_){} });
  console.log('All triggers deleted.');
}

// ===============================================================
// ================== PUBLIC PRICE FEED (doGet) ==================
// ===============================================================
// Provides a lightweight JSON (or JSONP) feed of current price data sourced
// from the Prices sheet for consumption by the web client. Designed to match
// the flexible field-name heuristics in priceService.js (ASXCode, CompanyName,
// LivePrice, PrevClose, High52, Low52, etc.).
//
// Query Params:
//   stockCode=ABC   (optional; returns only that code if present)
//   compact=true    (optional; omit less-used fields like MarketCap / PE)
//   callback=fnName (optional; JSONP wrapper to bypass strict CORS scenarios)
//
// NOTE: Apps Script Web Apps do not allow arbitrary custom CORS headers; for
// local development where the browser blocks reading the response, either:
//   1) Deploy this Web App with access = "Anyone" (anonymous) so the response
//      is a direct 200 JSON (not a login HTML redirect that triggers CORS), or
//   2) Use a CORS proxy (window.LIVE_PRICE_CORS_PROXY) already supported in
//      priceService.js, or
//   3) Use JSONP: append &callback=__priceFeedCb and adapt the client (optional).
//
// Security: Data here is non-sensitive market snapshot; ensure no user-specific
// fields are leaked. Only sheet-derived columns are exposed.

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const requestedCode = params.stockCode ? String(params.stockCode).trim().toUpperCase() : '';
    const compact = params.compact === 'true' || params.compact === '1';
    const callback = params.callback ? String(params.callback).trim() : '';

    const data = buildPriceFeedArray_(requestedCode, { compact });
    const json = JSON.stringify(data);

    // JSONP fallback if callback specified
    if (callback) {
      const wrapped = `${callback}(${json});`;
      return ContentService.createTextOutput(wrapped).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const errorPayload = JSON.stringify({ error: true, message: String(err && err.message || err) });
    return ContentService.createTextOutput(errorPayload).setMimeType(ContentService.MimeType.JSON);
  }
}

function buildPriceFeedArray_(singleCode, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PRICE_SHEET_NAME);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift();
  const map = headers.reduce((acc,h,i)=>{ acc[h] = i; return acc; }, {});

  function col(nameVariants) {
    for (let i=0;i<nameVariants.length;i++) {
      const n = nameVariants[i];
      if (map[n] != null) return map[n];
    }
    return null;
  }

  const idxCode = col(['ASX Code','ASXCode','Code']);
  const idxCompany = col(['Company Name','CompanyName','Name']);
  const idxLive = col(['LivePrice','Last','Last Price','LastPrice','Last Trade','LastTrade']);
  const idxPrev = col(['PrevDayClose','PrevClose','Previous Close','Last Close']);
  const idxHigh52 = col(['High52','52WeekHigh','High 52','52 High']);
  const idxLow52 = col(['Low52','52WeekLow','Low 52','52 Low']);
  const idxMktCap = col(['MarketCap','Market Cap']);
  const idxPE = col(['PE','PE Ratio']);

  const out = [];
  values.forEach(r => {
    const rawCode = idxCode != null ? r[idxCode] : '';
    if (!rawCode) return;
    const code = String(rawCode).trim().toUpperCase();
    if (!code) return;
    if (singleCode && code !== singleCode) return;
    function num(idx) {
      if (idx == null) return null; const v = r[idx];
      if (v === '' || v == null) return null;
      const n = Number(v); return isNaN(n) ? null : n;
    }
    const obj = {
      ASXCode: code,
      CompanyName: idxCompany!=null ? (r[idxCompany] || null) : null,
      LivePrice: num(idxLive),
      PrevClose: num(idxPrev),
      High52: num(idxHigh52),
      Low52: num(idxLow52)
    };
    if (!options || !options.compact) {
      if (idxMktCap != null) obj.MarketCap = num(idxMktCap);
      if (idxPE != null) obj.PE = num(idxPE);
    }
    out.push(obj);
  });
  return out;
}

