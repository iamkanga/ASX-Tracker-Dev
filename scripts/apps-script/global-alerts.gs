/**
 * Apps Script for automated alert processing and data management, and for serving data to a web app.
 * Version: 2.5.1 (Production Final Cleanup)
 *
 * Production Features:
 *  - Centralized 52-week high/low scan (global document)
 *  - Centralized global movers scan (directional % / $ change) with market hours guard
 *  - Generic Firestore commit helper (commitCentralDoc_)
 *  - Settings sheet readers & helpers + self-healing Firestore -> Sheet sync
 *  - Legacy per-user alert processing utilities (retained)
 *
 * Removed for production cleanliness:
 *  - All ad-hoc test harness & diagnostic functions
 *  - Admin Tools custom menu
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

// Central Firestore global settings document path segments
// Full path: /artifacts/{APP_ID}/config/globalSettings
const GLOBAL_SETTINGS_DOC_SEGMENTS = ['artifacts', APP_ID, 'config', 'globalSettings'];

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
    const settingsRes = fetchGlobalSettingsFromFirestore();
    if (!settingsRes.ok) { Logger.log('[HiLo] Failed to load global settings from Firestore: ' + settingsRes.error); return; }
    const settings = settingsRes.data;
    if (!settings) { Logger.log('[HiLo] No settings data returned'); return; }
    const allAsxData = fetchAllAsxData_(ss);
    // Sanitize numeric filters (strip currency symbols, commas, trailing text like 'c', 'cents')
    function sanitizeNumber_(v) {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return isFinite(v) ? v : null;
      let s = String(v).trim();
      if (!s) return null;
      // Common user formats: '0.50', '$0.50', '0.50c', '50c', '0.50 cents'
      s = s.replace(/\$/g,'');
      // If value ends with 'c' and no dollar sign & no decimal, treat as cents
      const centsMatch = /^([0-9]+)c$/i.exec(s);
      if (centsMatch) {
        const centsVal = Number(centsMatch[1]);
        return isFinite(centsVal) ? (centsVal / 100) : null;
      }
      s = s.replace(/cents?/i,'');
      s = s.replace(/,/g,'');
      s = s.replace(/[^0-9.+-]/g,'');
      if (!s) return null;
      const n = Number(s);
      return isFinite(n) ? n : null;
    }
    const rawMinPrice = sanitizeNumber_(settings.hiLoMinimumPrice);
    const rawMinMcap  = sanitizeNumber_(settings.hiLoMinimumMarketCap);
    const appliedMinPrice = (rawMinPrice != null && rawMinPrice > 0) ? rawMinPrice : 0;
    const appliedMinMarketCap = (rawMinMcap != null && rawMinMcap > 0) ? rawMinMcap : 0;
    const emailEnabled = !!settings.emailAlertsEnabled;
    Logger.log('[HiLo] Filters -> minPrice=%s minMcap=%s (raw values price=%s mcap=%s)', appliedMinPrice, appliedMinMarketCap, settings.hiLoMinimumPrice, settings.hiLoMinimumMarketCap);

    const highObjs = []; const lowObjs = [];
    let scanned = 0, afterFilter = 0;
    let skippedBelowPrice = 0, skippedBelowMcap = 0, skippedInvalid = 0;
    allAsxData.forEach(stock => {
      scanned++;
      // Normalize numeric fields from sheet parsing which can produce NaN/null
      const live = (stock.livePrice != null && !isNaN(stock.livePrice)) ? Number(stock.livePrice) : null;
      const mcap = (stock.marketCap != null && !isNaN(stock.marketCap)) ? Number(stock.marketCap) : null;
      if (!stock.code || live == null || live <= 0) { skippedInvalid++; return; }
      if (appliedMinPrice && live < appliedMinPrice) { skippedBelowPrice++; return; }
      if (appliedMinMarketCap && mcap != null && mcap < appliedMinMarketCap) { skippedBelowMcap++; return; }
      afterFilter++;
      const reachedLow = (!isNaN(stock.low52) && stock.low52 != null && live <= stock.low52);
      const reachedHigh = (!isNaN(stock.high52) && stock.high52 != null && live >= stock.high52);
      if (reachedLow || reachedHigh) {
        // Normalize object shape for frontend cards
        const o = {
          code: stock.code,
          name: stock.name || stock.companyName || null,
            live: live,
          high52: isNaN(stock.high52)? null : stock.high52,
          low52: isNaN(stock.low52)? null : stock.low52,
          marketCap: (stock.marketCap!=null && !isNaN(stock.marketCap)) ? stock.marketCap : null,
          prevClose: (stock.prevClose!=null && !isNaN(stock.prevClose)) ? stock.prevClose : null
        };
        if (reachedLow) lowObjs.push(o);
        if (reachedHigh) highObjs.push(o);
      }
    });
    Logger.log('[HiLo] Scan rows -> scanned=%s passedFilters=%s highs=%s lows=%s', scanned, afterFilter, highObjs.length, lowObjs.length);
    if (appliedMinPrice) {
      Logger.log('[HiLo] Skip reasons -> belowPrice=%s belowMcap=%s invalidRows=%s', skippedBelowPrice, skippedBelowMcap, skippedInvalid);
    }
    // Final defensive pass: remove any entries that somehow violate filters (belt & braces)
    function enforcePostFilters(arr) {
      return arr.filter(o => {
        if (!o) return false;
        if (appliedMinPrice && (o.live == null || o.live < appliedMinPrice)) return false;
        if (appliedMinMarketCap && o.marketCap != null && o.marketCap < appliedMinMarketCap) return false;
        if (o.live == null || o.live <= 0) return false;
        return true;
      });
    }
    const filteredHighs = enforcePostFilters(highObjs);
    const filteredLows  = enforcePostFilters(lowObjs);
    const removedHighs = highObjs.length - filteredHighs.length;
    const removedLows  = lowObjs.length - filteredLows.length;
    if (removedHighs || removedLows) {
      Logger.log('[HiLo][PostFilter] Removed highs=%s lows=%s due to late filter enforcement', removedHighs, removedLows);
    }
    // Persist filtered arrays only
    writeGlobalHiLoDoc_(filteredHighs, filteredLows, { minPrice: appliedMinPrice, minMarketCap: appliedMinMarketCap });

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
  // Expand live price detection to handle alternative column headers used in some sheets
  const liveKey = (function(){
    const candidates = ['LivePrice','Last','LastPrice','Last Trade','LastTrade','Last trade'];
    for (let k of candidates) { if (map[k] != null) return k; }
    return 'LivePrice';
  })();
  return values.map(r => ({
    code: r[map['ASX Code']],
    name: nameKey ? r[map[nameKey]] : null,
    livePrice: (map[liveKey] != null) ? parseFloat(r[map[liveKey]]) : parseFloat(r[map['LivePrice']]),
    high52: parseFloat(r[map['High52']]),
    low52: parseFloat(r[map['Low52']]),
    marketCap: parseFloat(r[map['MarketCap']]),
    prevClose: prevKey ? parseFloat(r[map[prevKey]]) : null
  }));
}

function writeGlobalHiLoDoc_(highsArr, lowsArr, filtersMeta) {
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
    lowCodes: lowsObjs.map(o=>o.code),
    filters: filtersMeta ? { minPrice: filtersMeta.minPrice ?? null, minMarketCap: filtersMeta.minMarketCap ?? null } : null
  };
  // Provide explicit mask so we don't accumulate stale fields
  const mask = ['updatedAt','highs','lows','highCodes','lowCodes','filters.minPrice','filters.minMarketCap'];
  return commitCentralDoc_(['artifacts', APP_ID, 'alerts', 'HI_LO_52W'], data, mask);
}

// (Test harness removed for production)

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
    const now = new Date();
    const hourSydney = Number(Utilities.formatDate(now, ASX_TIME_ZONE, 'HH'));
    const inHours = (hourSydney >= 10 && hourSydney < 17);
    if (!inHours) console.log('[MoversScan] Outside market hours (' + hourSydney + 'h) – still executing for freshness.');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    // Guaranteed latest settings via multi-attempt loop
    const guaranteed = fetchGlobalSettingsGuaranteedLatest_(3, 200);
    if (!guaranteed.ok || !guaranteed.data) { console.log('[MoversScan] FAILED settings fetch: ' + (guaranteed.error || 'unknown')); return; }
    const settings = guaranteed.data;
    let thresholds = normalizeDirectionalThresholds_(settings);
    if (!thresholds.anyActive) {
      console.log('[MoversScan] No directional thresholds configured; clearing doc.');
      writeGlobalMoversDoc_([], [], thresholds, { source: 'scan', reason: 'no-thresholds', inHours, settingsSnapshot: settings, settingsUpdateTime: guaranteed.updateTime || null, settingsFetchAttempts: guaranteed.attempts, fetchStrategy: 'guaranteed-loop' + (guaranteed.fallback ? '+fallback' : '') });
      return; }

    const priceRows = fetchPriceRowsForMovers_(spreadsheet);
    if (!priceRows.length) { console.log('[MoversScan] No price data rows; aborting.'); return; }

    // Micro-final read to catch last-millisecond updates
    const microFinal = fetchGlobalSettingsFromFirestore({ noCache: true });
    if (microFinal.ok && microFinal.data && microFinal.updateTime && guaranteed.updateTime && microFinal.updateTime > guaranteed.updateTime) {
      console.log('[MoversScan] Micro-final settings newer: ' + guaranteed.updateTime + ' -> ' + microFinal.updateTime);
      thresholds = normalizeDirectionalThresholds_(microFinal.data);
    }

    const { upMovers, downMovers } = evaluateMovers_(priceRows, thresholds);
    console.log('[MoversScan] Evaluation complete', { up: upMovers.length, down: downMovers.length, total: upMovers.length + downMovers.length, thresholds, inHours, settingsUpdateTime: microFinal.updateTime || guaranteed.updateTime });

  writeGlobalMoversDoc_(upMovers, downMovers, thresholds, { source: 'scan', inHours, settingsSnapshot: settings, settingsUpdateTime: microFinal.updateTime || guaranteed.updateTime || null, settingsFetchAttempts: guaranteed.attempts, fetchStrategy: 'guaranteed-loop+micro-final' + (guaranteed.fallback ? '+fallback' : '') });
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
  // Resolve code column (tolerate slight header variants)
  const codeIdx = (function(){
    const candidates = ['ASX Code','ASXCode','Code'];
    for (let k of candidates) { if (map[k] != null) return map[k]; }
    return map['ASX Code'];
  })();
  // Resolve live price column (support alternative headings)
  const liveIdx = (function(){
    const candidates = ['LivePrice','Last','LastPrice','Last Trade','LastTrade','Last trade','Price','Current'];
    for (let k of candidates) { if (map[k] != null) return map[k]; }
    return map['LivePrice'];
  })();
  // Resolve previous close column (support multiple spellings)
  const prevIdx = (function(){
    const candidates = ['PrevDayClose','PrevClose','Previous Close','PreviousClose','Prev'];
    for (let k of candidates) { if (map[k] != null) return map[k]; }
    return map['PrevDayClose'] != null ? map['PrevDayClose'] : map['PrevClose'];
  })();
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

function writeGlobalMoversDoc_(upMovers, downMovers, thresholds, meta) {
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
    },
    appliedMeta: meta ? {
      source: meta.source || 'scan',
      inHours: meta.inHours === true,
      settingsSnapshot: meta.settingsSnapshot ? sanitizeSettingsSnapshotForMeta_(meta.settingsSnapshot) : null,
      settingsUpdateTime: meta.settingsUpdateTime || null,
      settingsFetchAttempts: meta.settingsFetchAttempts != null ? meta.settingsFetchAttempts : null,
      fetchStrategy: meta.fetchStrategy || null
    } : null
  };
  const mask = [ 'updatedAt','upCount','downCount','totalCount','up','down','upCodes','downCodes','upSample','downSample',
    'thresholds.upPercent','thresholds.upDollar','thresholds.downPercent','thresholds.downDollar','thresholds.minimumPrice',
    'appliedMeta.source','appliedMeta.inHours','appliedMeta.settingsSnapshot.globalPercentIncrease','appliedMeta.settingsSnapshot.globalDollarIncrease','appliedMeta.settingsSnapshot.globalPercentDecrease','appliedMeta.settingsSnapshot.globalDollarDecrease','appliedMeta.settingsSnapshot.globalMinimumPrice','appliedMeta.settingsUpdateTime','appliedMeta.settingsFetchAttempts','appliedMeta.fetchStrategy' ];
  return commitCentralDoc_(['artifacts', APP_ID, 'alerts', 'GLOBAL_MOVERS'], data, mask);
}

// Strip volatile or large fields from settings snapshot to keep doc lean
function sanitizeSettingsSnapshotForMeta_(s){
  if (!s) return null;
  return {
    globalPercentIncrease: s.globalPercentIncrease != null ? Number(s.globalPercentIncrease) : null,
    globalDollarIncrease: s.globalDollarIncrease != null ? Number(s.globalDollarIncrease) : null,
    globalPercentDecrease: s.globalPercentDecrease != null ? Number(s.globalPercentDecrease) : null,
    globalDollarDecrease: s.globalDollarDecrease != null ? Number(s.globalDollarDecrease) : null,
    globalMinimumPrice: s.globalMinimumPrice != null ? Number(s.globalMinimumPrice) : null
  };
}

// (Test harness removed for production)

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

// ===============================================================
// ========== SETTINGS SYNC (Firestore -> Sheet) =================
// ===============================================================
/**
 * Fetch a single Firestore document (native REST) and return plain object of fields.
 * @param {string[]} pathSegments e.g. ['artifacts', APP_ID, 'users', userId, 'settings']
 */
function _fetchFirestoreDocument_(pathSegments, options) {
  const token = ScriptApp.getOAuthToken();
  const docPath = pathSegments.map(encodeURIComponent).join('/');
  const url = FIRESTORE_BASE + '/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents/' + docPath;
  try {
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
    if (options && options.noCache) {
      headers['Cache-Control'] = 'no-cache';
      headers['Pragma'] = 'no-cache';
    }
    const resp = UrlFetchApp.fetch(url, { method: 'get', headers, muteHttpExceptions: true });
    const status = resp.getResponseCode();
    const text = resp.getContentText();
    if (status === 404) return { ok: false, status, notFound: true };
    let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch(_) {}
    if (status >= 200 && status < 300 && parsed) {
      return { ok: true, status, data: _fromFsFields_(parsed.fields || {}), updateTime: parsed.updateTime || null };
    }
    return { ok: false, status, error: text };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}

/** Convert Firestore Value map to plain JS object. */
function _fromFsFields_(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(k => out[k] = _fromFsValue_(fields[k]));
  return out;
}

function _fromFsValue_(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(_fromFsValue_);
  if ('mapValue' in v) return _fromFsFields_(v.mapValue.fields || {});
  return null;
}

// ===============================================================
// ======= FIRESTORE GLOBAL SETTINGS (SOURCE OF TRUTH) ===========
// ===============================================================
/**
 * Fetch global settings from Firestore central document.
 * Path: /artifacts/{APP_ID}/config/globalSettings
 * Expects a flat map of keys compatible with previous sheet-based names, e.g.:
 *  {
 *    globalPercentIncrease: 5,
 *    globalDollarIncrease: 0.15,
 *    globalPercentDecrease: 5,
 *    globalDollarDecrease: 0.15,
 *    globalMinimumPrice: 0.05,
 *    hiLoMinimumPrice: 0.05,
 *    hiLoMinimumMarketCap: 10000000,
 *    emailAlertsEnabled: true,
 *    alertEmailRecipients: "user@example.com"
 *  }
 * @return {{ok:boolean,data?:Object,error?:string,status?:number}}
 */
function fetchGlobalSettingsFromFirestore(options) {
  try {
    const res = _fetchFirestoreDocument_(GLOBAL_SETTINGS_DOC_SEGMENTS, options || {});
    if (!res.ok) {
      if (res.notFound) return { ok:false, error:'Global settings doc not found', status:404 };
      return { ok:false, error: res.error || ('status=' + res.status), status: res.status };
    }
    return { ok:true, data: res.data, status: res.status, updateTime: res.updateTime || null };
  } catch (e) {
    return { ok:false, error:String(e) };
  }
}

function fetchGlobalSettingsGuaranteedLatest_(attempts, delayMs) {
  const maxAttempts = Math.max(1, attempts || 3);
  const sleepMs = Math.min(1000, delayMs == null ? 250 : delayMs);
  let best = null;
  for (let i=0;i<maxAttempts;i++) {
    // First attempt: normal fetch (no cache bust) to avoid any unforeseen param-based routing issues; subsequent attempts use noCache.
    const useNoCache = (i > 0);
    const r = fetchGlobalSettingsFromFirestore(useNoCache ? { noCache: true } : {});
    if (r.ok && r.data) {
      if (!best || !best.updateTime || (r.updateTime && r.updateTime > best.updateTime)) {
        best = { attempt: i+1, updateTime: r.updateTime || null, data: r.data, status: r.status };
      }
    } else {
      console.log('[MoversScan][settings-fetch] attempt=' + (i+1) + ' failed status=' + (r && r.status) + ' err=' + (r && r.error));
    }
    if (i < maxAttempts - 1) Utilities.sleep(sleepMs);
  }
  if (!best) {
    // Final fallback: single direct fetch without cache bust in case earlier failures were due to timing or transient network.
    const fallback = fetchGlobalSettingsFromFirestore();
    if (fallback.ok && fallback.data) {
      console.log('[MoversScan][settings-fetch] fallback single fetch succeeded after primary attempts failed.');
      return { ok:true, data: fallback.data, updateTime: fallback.updateTime || null, attempts: maxAttempts + 1, fallback: true };
    }
    return { ok:false, error:'Failed to fetch settings after attempts=' + maxAttempts + ' + fallback', attempts: maxAttempts, fallbackTried: true };
  }
  return { ok:true, data: best.data, updateTime: best.updateTime, attempts: maxAttempts };
}

/**
 * Sync a user's profile settings document into the central globalSettings document.
 * This is intended to be called by the Apps Script server (privileged) when a user
 * updates their per-user profile settings and client-side writes are blocked by rules.
 *
 * Usage: either call syncUserProfileToCentralGlobalSettings(userId) from other
 * Apps Script code, or expose via doPost/doGet (careful with auth) or a time-based
 * trigger that periodically reconciles changes.
 *
 * Behavior:
 *  - Reads /artifacts/{APP_ID}/users/{userId}/profile/settings via REST helper
 *  - Normalizes the canonical keys used by the backend scans (directional & hi/lo)
 *  - Writes an object to /artifacts/{APP_ID}/config/globalSettings using commitCentralDoc_
 *  - Adds updatedAt and updatedByUserId metadata
 *
 * @param {string} userId Firestore user id to read profile settings from
 * @return {{ok:boolean,status?:number,error?:string,written?:object}}
 */
function syncUserProfileToCentralGlobalSettings(userId) {
  if (!userId) return { ok: false, error: 'userId required' };
  try {
    // Prefer the canonical profile/settings path but fall back to legacy location for compatibility.
    const primaryDocPath = ['artifacts', APP_ID, 'users', userId, 'profile', 'settings'];
    let res = _fetchFirestoreDocument_(primaryDocPath);
    let pathUsed = primaryDocPath.join('/');
    if (!res.ok) {
      if (res.notFound) {
        // Try legacy fallback path used by older clients
        const legacyDocPath = ['artifacts', APP_ID, 'users', userId, 'settings', 'general'];
        const legacyRes = _fetchFirestoreDocument_(legacyDocPath);
        if (legacyRes.ok) {
          res = legacyRes;
          pathUsed = legacyDocPath.join('/');
        }
      }
    }
    if (!res.ok) {
      if (res.notFound) return { ok: false, status: 404, error: 'User profile settings not found', pathTried: pathUsed };
      return { ok: false, status: res.status, error: res.error || 'Failed to fetch user profile settings', pathTried: pathUsed };
    }
    const data = res.data || {};
    // Only copy the expected global keys to avoid crowding central config with user-specific metadata
    const centralPayload = {
      globalPercentIncrease: data.globalPercentIncrease != null ? Number(data.globalPercentIncrease) : null,
      globalDollarIncrease: data.globalDollarIncrease != null ? Number(data.globalDollarIncrease) : null,
      globalPercentDecrease: data.globalPercentDecrease != null ? Number(data.globalPercentDecrease) : null,
      globalDollarDecrease: data.globalDollarDecrease != null ? Number(data.globalDollarDecrease) : null,
      globalMinimumPrice: data.globalMinimumPrice != null ? Number(data.globalMinimumPrice) : null,
      hiLoMinimumPrice: data.hiLoMinimumPrice != null ? Number(data.hiLoMinimumPrice) : null,
      hiLoMinimumMarketCap: data.hiLoMinimumMarketCap != null ? Number(data.hiLoMinimumMarketCap) : null,
      emailAlertsEnabled: (typeof data.emailAlertsEnabled === 'boolean') ? data.emailAlertsEnabled : (data.emailAlertsEnabled != null ? !!data.emailAlertsEnabled : null),
      alertEmailRecipients: data.alertEmailRecipients != null ? String(data.alertEmailRecipients) : null,
      // metadata
      updatedByUserId: userId,
      updatedAt: new Date()
    };

    // Remove nulls from payload - commitCentralDoc_ will accept nulls but we prefer explicit nulls for masking
    // Build an explicit mask covering only the keys we are writing
    const mask = [
      'globalPercentIncrease','globalDollarIncrease','globalPercentDecrease','globalDollarDecrease','globalMinimumPrice',
      'hiLoMinimumPrice','hiLoMinimumMarketCap','emailAlertsEnabled','alertEmailRecipients','updatedByUserId','updatedAt'
    ];

    const commitRes = commitCentralDoc_(GLOBAL_SETTINGS_DOC_SEGMENTS, centralPayload, mask);
    if (!commitRes.ok) {
      // Provide useful diagnostic output for troubleshooting in the execution log
      Logger.log('[SyncUser->Central] commit failed for user=%s path=%s status=%s error=%s', userId, pathUsed, commitRes.status, commitRes.error);
      return { ok: false, status: commitRes.status, error: commitRes.error || 'Failed to commit central settings', written: centralPayload };
    }
    Logger.log('[SyncUser->Central] commit succeeded for user=%s path=%s status=%s', userId, pathUsed, commitRes.status);
    return { ok: true, status: commitRes.status, written: centralPayload, pathUsed };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Convenience wrapper to reconcile the calling user's settings into central globalSettings.
 * This function inspects the active user's email address from Session.getActiveUser().getEmail()
 * or may be called directly with a userId. When run as a triggered Apps Script (or via
 * the web app with appropriate auth), it will write the profile settings into central config.
 *
 * @param {{userId?:string}} options
 * @return {{ok:boolean,error?:string,status?:number}}
 */
function reconcileCurrentUserSettings(options) {
  const userId = (options && options.userId) ? options.userId : null;
  try {
    if (!userId) return { ok: false, error: 'userId required' };
    const res = syncUserProfileToCentralGlobalSettings(userId);
    if (!res.ok) return { ok: false, error: res.error || 'sync failed', status: res.status };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ------------------------------------------------------------------
// Web endpoint: secure on-save trigger
// ------------------------------------------------------------------
/**
 * doPost entrypoint for Apps Script Web App.
 * Expects calls from authenticated users (OAuth) and will attempt to
 * sync that user's profile settings into the central globalSettings doc.
 *
 * Security notes (see deployment section below):
 *  - Deploy the Web App with "Execute as: Me (script owner)" so the script
 *    has privileges to write central documents. Restrict access to only
 *    "Only myself" or to your domain, or use OAuth with ID token checks.
 *  - The function will attempt to resolve a userId either from the request
 *    body (options.userId) or from an authenticated mapping supplied by you.
 *
 * For ease of use, the client should call this endpoint after successfully
 * saving the per-user profile settings document. The client must include
 * its OAuth token in the Authorization header if calling directly via fetch.
 *
 * @param {Object} e Apps Script event object
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  try {
    // Best-effort body parse (support both form and raw JSON)
    // Support payloads from fetch() with JSON body and from form-encoded submits.
    let payload = {};
    try {
      if (e && e.postData && e.postData.contents) {
        // postData.contents is raw text; try JSON.parse first
        try {
          payload = JSON.parse(e.postData.contents);
        } catch (jsonErr) {
          // not JSON - try to parse as URL-encoded form body (userId=...&foo=...)
          try {
            const raw = String(e.postData.contents || '');
            const parts = raw.split('&').map(p => p.split('='));
            payload = {};
            parts.forEach(pair => {
              if (!pair || !pair.length) return;
              const k = decodeURIComponent((pair[0] || '').replace(/\+/g, ' '));
              const v = decodeURIComponent((pair[1] || '').replace(/\+/g, ' '));
              payload[k] = v;
            });
          } catch (_) {
            // fallback to parameters
            payload = e.parameter || {};
          }
        }
      } else if (e && e.parameter && Object.keys(e.parameter).length) {
        payload = e.parameter;
      } else {
        payload = {};
      }
    } catch (err) {
      payload = {};
    }

    // Accept either { userId } or { userId: '...', settings: {...} }
    const userId = (payload && payload.userId) ? String(payload.userId) : null;
    if (!userId) {
      // If client sent an ID token or auth info we could resolve it here - but for now require userId
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'userId required in payload' })).setMimeType(ContentService.MimeType.JSON);
    }

    // If settings were provided inline, attempt to write them directly to the central doc
    // otherwise, sync from the user's profile document in Firestore.
    let result;
    if (payload && payload.settings && typeof payload.settings === 'object') {
      // Normalize and write settings directly
      try {
        // Build central payload similar to syncUserProfileToCentralGlobalSettings
        const s = payload.settings;
        const centralPayload = {
          globalPercentIncrease: s.globalPercentIncrease != null ? Number(s.globalPercentIncrease) : null,
          globalDollarIncrease: s.globalDollarIncrease != null ? Number(s.globalDollarIncrease) : null,
          globalPercentDecrease: s.globalPercentDecrease != null ? Number(s.globalPercentDecrease) : null,
          globalDollarDecrease: s.globalDollarDecrease != null ? Number(s.globalDollarDecrease) : null,
          globalMinimumPrice: s.globalMinimumPrice != null ? Number(s.globalMinimumPrice) : null,
          hiLoMinimumPrice: s.hiLoMinimumPrice != null ? Number(s.hiLoMinimumPrice) : null,
          hiLoMinimumMarketCap: s.hiLoMinimumMarketCap != null ? Number(s.hiLoMinimumMarketCap) : null,
          emailAlertsEnabled: (typeof s.emailAlertsEnabled === 'boolean') ? s.emailAlertsEnabled : (s.emailAlertsEnabled != null ? !!s.emailAlertsEnabled : null),
          alertEmailRecipients: s.alertEmailRecipients != null ? String(s.alertEmailRecipients) : null,
          updatedByUserId: userId,
          updatedAt: new Date()
        };
        const mask = [
          'globalPercentIncrease','globalDollarIncrease','globalPercentDecrease','globalDollarDecrease','globalMinimumPrice',
          'hiLoMinimumPrice','hiLoMinimumMarketCap','emailAlertsEnabled','alertEmailRecipients','updatedByUserId','updatedAt'
        ];
        const commitRes = commitCentralDoc_(GLOBAL_SETTINGS_DOC_SEGMENTS, centralPayload, mask);
        if (!commitRes.ok) {
          result = { ok: false, status: commitRes.status, error: commitRes.error || 'Failed to commit provided settings', written: centralPayload };
        } else {
          result = { ok: true, status: commitRes.status, written: centralPayload };
        }
      } catch (err) {
        result = { ok: false, error: String(err) };
      }
    } else {
      // No inline settings: read the user's profile settings doc and sync
      result = syncUserProfileToCentralGlobalSettings(userId);
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Synchronize a user's settings from Firestore into the legacy Settings sheet (SELF-HEALING).
 *
 * Behavior:
 *  - Firestore is treated as the source of truth for user settings.
 *  - Existing rows are matched by camelCasing column A labels (same normalization
 *    logic as getSettingsFromSheet_). When a key exists, column B is overwritten
 *    with the Firestore value (unless dryRun=true).
 *  - NEW (self-healing): If a Firestore key does NOT exist as a row, the function
 *    will append a new row at the bottom with Column A = the exact key (camelCase)
 *    and Column B = its value. In dryRun mode we do not write, but we report what
 *    would have been created.
 *  - Keys beginning with '_' are treated as metadata and skipped.
 *
 * Returned fields:
 *  ok: success boolean
 *  userId: the resolved user id
 *  dryRun: whether the operation skipped writes
 *  updatedKeys: keys whose existing rows were updated
 *  createdKeys: keys for which new rows were appended (only when dryRun=false)
 *  wouldCreateKeys: keys that would have been created in dryRun mode
 *  skippedKeys: metadata keys ignored (prefix '_')
 *  missingRows: (deprecated) retained for backward compatibility; should be [] now because we self-heal
 *  pathUsed/pathTried: Firestore document path involved
 *  error: present only if ok=false
 *
 * @param {Object=} options { userId: override user id, dryRun: boolean }
 * @return {{ok:boolean,userId?:string,dryRun?:boolean,updatedKeys?:string[],createdKeys?:string[],wouldCreateKeys?:string[],skippedKeys?:string[],missingRows?:string[],pathUsed?:string,pathTried?:string,error?:string}}
 */
function syncUserSettingsFromFirestore(options) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = spreadsheet.getSheetByName(SETTINGS_SHEET_NAME);
  if (!settingsSheet) return { ok:false, error:'Settings sheet not found' };

  const values = settingsSheet.getDataRange().getValues();
  if (!values.length) return { ok:false, error:'Settings sheet empty' };

  // Infer userId: Look for header row containing 'UserID' or first data row value under that header.
  const header = values[0];
  let userIdCol = -1;
  header.forEach((h,i)=> { if (String(h).trim().toLowerCase() === 'userid') userIdCol = i; });
  let inferredUserId = null;
  if (userIdCol >= 0 && values.length > 1) {
    // pick first non-empty user id in data rows
    for (let r=1;r<values.length;r++){ const v = values[r][userIdCol]; if (v) { inferredUserId = String(v).trim(); break; } }
  }
  const userId = (options && options.userId) ? options.userId : inferredUserId;
  if (!userId) return { ok:false, error:'Cannot infer userId (none supplied and none found in sheet).'};

  // Firestore document path (UPDATED): artifacts/{APP_ID}/users/{userId}/profile/settings
  // Legacy (fallback) path previously assumed: artifacts/{APP_ID}/users/{userId}/settings/general
  const primaryDocSegments = ['artifacts', APP_ID, 'users', userId, 'profile', 'settings'];
  let fetchRes = _fetchFirestoreDocument_(primaryDocSegments);
  let pathUsed = primaryDocSegments.join('/');
  if (!fetchRes.ok && fetchRes.notFound) {
    // Attempt legacy fallback for backward compatibility
    const legacyDocSegments = ['artifacts', APP_ID, 'users', userId, 'settings', 'general'];
    const legacyRes = _fetchFirestoreDocument_(legacyDocSegments);
    if (legacyRes.ok) {
      fetchRes = legacyRes;
      pathUsed = legacyDocSegments.join('/');
    }
  }
  if (!fetchRes.ok) {
    if (fetchRes.notFound) return { ok:false, error:'Firestore settings document not found', userId, pathTried: pathUsed };
    return { ok:false, error:'Fetch failed status=' + fetchRes.status + ' ' + (fetchRes.error||''), userId, pathTried: pathUsed };
  }
  const fsData = fetchRes.data || {};

  // Build row map: camelCase(label) -> rowIndex
  function normalizeKey_(k) {
    if (k == null) return '';
    const trimmed = String(k).trim(); if (!trimmed) return '';
    const parts = trimmed.replace(/[^A-Za-z0-9]+/g,' ').split(' ').filter(Boolean);
    if (!parts.length) return '';
    return parts.map((p,i)=> i===0 ? p.charAt(0).toLowerCase()+p.slice(1) : p.charAt(0).toUpperCase()+p.slice(1).toLowerCase()).join('');
  }
  const rowMap = {}; // normKey -> { rowIndex, rawKey }
  for (let r=0; r<values.length; r++) {
    const label = values[r][0];
    if (r===0) continue; // assume first row is header or first label row – still allow if user uses vertical layout
    if (label == null || label === '') continue;
    const norm = normalizeKey_(label);
    if (norm) rowMap[norm] = { rowIndex: r, rawKey: label };
  }

  const dryRun = !!(options && options.dryRun);
  const updatedKeys = []; const skippedKeys = []; const missingRows = []; // missingRows kept for backward compat (will stay empty after self-heal)
  const createdKeys = []; const wouldCreateKeys = [];

  Object.keys(fsData).forEach(k => {
    if (k.startsWith('_')) { skippedKeys.push(k); return; } // skip metadata
    const rowInfo = rowMap[k];
    if (!rowInfo) {
      // Self-healing: append a new row for this key
      if (dryRun) {
        wouldCreateKeys.push(k);
      } else {
        settingsSheet.appendRow([k, fsData[k]]);
        createdKeys.push(k);
      }
      return; // not an update of existing row
    }
    const rowIdx = rowInfo.rowIndex;
    if (!dryRun) settingsSheet.getRange(rowIdx+1, 2).setValue(fsData[k]);
    updatedKeys.push(k);
  });

  return { ok:true, userId, dryRun, updatedKeys, createdKeys, wouldCreateKeys, skippedKeys, missingRows, pathUsed };
}

// (All temporary sync test harnesses & menu removed for production)


function checkMarketAlerts() {
  const now = new Date();
  const asxTime = Utilities.formatDate(now, ASX_TIME_ZONE, 'HH');
  if (asxTime >= 10 && asxTime < 16) {
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
    console.log(`[${now}] Market is closed. Skipping alert check.`);
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
    // Support JSONP callbacks to allow browser clients to bypass strict CORS
    // preflight issues by using a <script> tag insertion as a fallback.
    // Usage: /exec?userId=...&callback=__myCallback
    const params = e && e.parameter ? e.parameter : {};
    const callback = params.callback ? String(params.callback).trim() : '';
    // If callback provided and a userId is present, attempt a synchronous sync and return JSONP.
    if (callback && params.userId) {
      const uid = String(params.userId);
      const res = syncUserProfileToCentralGlobalSettings(uid);
      const json = JSON.stringify(res || { ok: false, error: 'no-result' });
      const wrapped = callback + '(' + json + ');';
      return ContentService.createTextOutput(wrapped).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
  // Otherwise behave as a price feed endpoint as before (non-JSONP GET)
  // reuse `params` and `callback` parsed above
  const requestedCode = params.stockCode ? String(params.stockCode).trim().toUpperCase() : '';
  const compact = params.compact === 'true' || params.compact === '1';

    const data = buildPriceFeedArray_(requestedCode, { compact });
    const json = JSON.stringify(data);

    // JSONP fallback if callback specified (callback variable parsed earlier)
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

