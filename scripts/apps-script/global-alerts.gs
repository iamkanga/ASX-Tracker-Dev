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
// Central Firestore GLOBAL_MOVERS document path
const GLOBAL_MOVERS_DOC_SEGMENTS = ['artifacts', APP_ID, 'alerts', 'GLOBAL_MOVERS'];
// Central Firestore daily 52-week hit history document
// Full path: /artifacts/{APP_ID}/alerts/HI_LO_52W_HITS
const DAILY_HILO_HITS_DOC_SEGMENTS = ['artifacts', APP_ID, 'alerts', 'HI_LO_52W_HITS'];
// Central Firestore daily GLOBAL_MOVERS hit history document
// Full path: /artifacts/{APP_ID}/alerts/GLOBAL_MOVERS_HITS
const DAILY_MOVERS_HITS_DOC_SEGMENTS = ['artifacts', APP_ID, 'alerts', 'GLOBAL_MOVERS_HITS'];
// Central Firestore daily CUSTOM TRIGGER hit history document
// Full path: /artifacts/{APP_ID}/alerts/CUSTOM_TRIGGER_HITS
const DAILY_CUSTOM_HITS_DOC_SEGMENTS = ['artifacts', APP_ID, 'alerts', 'CUSTOM_TRIGGER_HITS'];

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

    // Append persistent daily hit history so intra-scan hits are not lost
    try {
      appendDailyHiLoHits_(filteredHighs, filteredLows);
    } catch (persistErr) {
      Logger.log('[HiLo][DailyHits] Persist error: %s', persistErr && persistErr.message || persistErr);
    }

    // NEW: duplicate portfolio-relevant 52W hits into CUSTOM_TRIGGER_HITS
    try {
      duplicateHiLoHitsIntoCustom_(filteredHighs, filteredLows);
    } catch (dupErr) {
      Logger.log('[HiLo][Dup->Custom] Error: %s', dupErr && dupErr.message || dupErr);
    }

    // Backfill duplicates for users who added shares after earlier hits today (idempotent)
    try {
      reconcileCustomDuplicatesFromDailyHits_();
    } catch (reconErr) {
      Logger.log('[HiLo][Recon->Custom] Error: %s', reconErr && reconErr.message || reconErr);
    }

    // Backward-compatible email path removed from frequent scan.
    // The scan now only updates Firestore documents and daily history.
    // Email summarization is consolidated into the daily digest only.
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

// ================== DAILY 52W HITS PERSISTENCE ==================
/** Format a YYYY-MM-DD key in ASX timezone for daily partitioning. */
function getSydneyDayKey_(dateOpt) {
  const d = dateOpt || new Date();
  return Utilities.formatDate(d, ASX_TIME_ZONE, 'yyyy-MM-dd');
}

/** Fetch current daily 52-week hit history document from Firestore. */
function fetchDailyHiLoHits_() {
  const res = _fetchFirestoreDocument_(DAILY_HILO_HITS_DOC_SEGMENTS);
  if (!res.ok) {
    if (res.notFound) return { ok: true, data: { dayKey: getSydneyDayKey_(), highHits: [], lowHits: [] }, updateTime: null };
    return { ok: false, error: res.error || ('status=' + res.status) };
  }
  const data = res.data || {};
  return { ok: true, data: { dayKey: data.dayKey || getSydneyDayKey_(), highHits: data.highHits || [], lowHits: data.lowHits || [] }, updateTime: res.updateTime || null };
}

/** Commit full daily hits payload (overwrites arrays intentionally). */
function writeDailyHiLoHits_(payload) {
  const now = new Date();
  const body = {
    dayKey: payload.dayKey || getSydneyDayKey_(),
    highHits: Array.isArray(payload.highHits) ? payload.highHits : [],
    lowHits: Array.isArray(payload.lowHits) ? payload.lowHits : [],
    updatedAt: now
  };
  const mask = ['dayKey','highHits','lowHits','updatedAt'];
  return commitCentralDoc_(DAILY_HILO_HITS_DOC_SEGMENTS, body, mask);
}

/** Append today's 52W High/Low hits to the daily history document with de-duplication. */
function appendDailyHiLoHits_(highsArr, lowsArr) {
  const todayKey = getSydneyDayKey_();
  const current = fetchDailyHiLoHits_();
  if (!current.ok) { Logger.log('[HiLo][DailyHits] fetch failed: %s', current.error); return; }
  let highHits = current.data.highHits || [];
  let lowHits = current.data.lowHits || [];
  let dayKey = current.data.dayKey || todayKey;
  if (dayKey !== todayKey) {
    // New day: reset lists for clean slate
    highHits = [];
    lowHits = [];
    dayKey = todayKey;
  }
  const nowIso = new Date().toISOString();
  const seenHigh = new Set(highHits.map(h => h && h.code));
  const seenLow = new Set(lowHits.map(h => h && h.code));
  // Normalize existing seen sets to canonical uppercase codes (defensive)
  const _normCode = (c) => (c || '').toString().trim().toUpperCase();
  const seenHighNorm = new Set(Array.from(seenHigh).map(_normCode));
  const seenLowNorm = new Set(Array.from(seenLow).map(_normCode));

  function normHiLoItem(e) {
    if (!e) return null;
    const code = (e.code || e.shareCode || '').toString().trim().toUpperCase();
    if (!code) return null;
    return {
      code,
      name: e.name || e.companyName || null,
      live: (e.live!=null && !isNaN(e.live)) ? Number(e.live) : (e.livePrice!=null && !isNaN(e.livePrice)? Number(e.livePrice): null),
      high52: (e.high52!=null && !isNaN(e.high52)) ? Number(e.high52) : (e.High52!=null && !isNaN(e.High52)? Number(e.High52): null),
      low52: (e.low52!=null && !isNaN(e.low52)) ? Number(e.low52) : (e.Low52!=null && !isNaN(e.Low52)? Number(e.Low52): null),
      t: nowIso
    };
  }

  (Array.isArray(highsArr) ? highsArr : []).forEach(e => {
    const item = normHiLoItem(e);
  if (!item) return;
  const c = _normCode(item.code);
  item.code = c;
  if (!seenHighNorm.has(c)) { highHits.push(item); seenHighNorm.add(c); }
  });
  (Array.isArray(lowsArr) ? lowsArr : []).forEach(e => {
    const item = normHiLoItem(e);
  if (!item) return;
  const c = _normCode(item.code);
  item.code = c;
  if (!seenLowNorm.has(c)) { lowHits.push(item); seenLowNorm.add(c); }
  });

  writeDailyHiLoHits_({ dayKey, highHits, lowHits });
}

// (Test harness removed for production)

function sendHiLoEmailIfAny_(results, settings) {
  // Disabled: email sending for hi/lo from frequent scan moved to daily digest only.
  // Keep a lightweight log for diagnostics.
  try {
    const highsCount = (results && Array.isArray(results.highs)) ? results.highs.length : 0;
    const lowsCount = (results && Array.isArray(results.lows)) ? results.lows.length : 0;
    if (!highsCount && !lowsCount) return;
    console.log('[sendHiLoEmailIfAny_] Disabled email send – hi/lo results:', { highs: highsCount, lows: lowsCount });
  } catch (e) { console.log('[sendHiLoEmailIfAny_] Disabled function error:', e); }
}

function sendMoversEmailIfAny_(results, settings) {
  // Disabled: email sending for movers from frequent scan moved to daily digest only.
  try {
    const upCount = (results && Array.isArray(results.up)) ? results.up.length : 0;
    const downCount = (results && Array.isArray(results.down)) ? results.down.length : 0;
    if (!upCount && !downCount) return;
    console.log('[sendMoversEmailIfAny_] Disabled email send – movers results:', { up: upCount, down: downCount });
  } catch (e) { console.log('[sendMoversEmailIfAny_] Disabled function error:', e); }
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

    // Append persistent daily movers hits so intra-scan events are retained per day
    try {
      appendDailyMoversHits_(upMovers, downMovers);
    } catch (persistErr) {
      Logger.log('[Movers][DailyHits] Persist error: %s', persistErr && persistErr.message || persistErr);
    }

    // NEW: duplicate portfolio-relevant movers into CUSTOM_TRIGGER_HITS
    try {
      duplicateMoversIntoCustom_(upMovers, downMovers);
    } catch (dupErr) {
      Logger.log('[Movers][Dup->Custom] Error: %s', dupErr && dupErr.message || dupErr);
    }

    // Backfill duplicates for users who added shares after earlier hits today (idempotent)
    try {
      reconcileCustomDuplicatesFromDailyHits_();
    } catch (reconErr) {
      Logger.log('[Movers][Recon->Custom] Error: %s', reconErr && reconErr.message || reconErr);
    }

    // Email sending removed from frequent movers scan.
    // Frequent runs should only persist the movers to Firestore.
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

// ================== DAILY MOVERS HITS PERSISTENCE ==================
/** Fetch current day's GLOBAL_MOVERS hits document from Firestore. */
function fetchDailyMoversHits_() {
  const res = _fetchFirestoreDocument_(DAILY_MOVERS_HITS_DOC_SEGMENTS);
  if (!res.ok) {
    if (res.notFound) return { ok: true, data: { dayKey: getSydneyDayKey_(), upHits: [], downHits: [] }, updateTime: null };
    return { ok: false, error: res.error || ('status=' + res.status) };
  }
  const data = res.data || {};
  return { ok: true, data: { dayKey: data.dayKey || getSydneyDayKey_(), upHits: data.upHits || [], downHits: data.downHits || [] }, updateTime: res.updateTime || null };
}

/** Commit full daily movers hits payload (overwrites arrays intentionally). */
function writeDailyMoversHits_(payload) {
  const now = new Date();
  const body = {
    dayKey: payload.dayKey || getSydneyDayKey_(),
    upHits: Array.isArray(payload.upHits) ? payload.upHits : [],
    downHits: Array.isArray(payload.downHits) ? payload.downHits : [],
    updatedAt: now
  };
  const mask = ['dayKey','upHits','downHits','updatedAt'];
  return commitCentralDoc_(DAILY_MOVERS_HITS_DOC_SEGMENTS, body, mask);
}

/** Append today's movers (up/down) hits to the daily history doc with de-dup by code. */
function appendDailyMoversHits_(upArr, downArr) {
  const todayKey = getSydneyDayKey_();
  const current = fetchDailyMoversHits_();
  if (!current.ok) { Logger.log('[Movers][DailyHits] fetch failed: %s', current.error); return; }
  let upHits = current.data.upHits || [];
  let downHits = current.data.downHits || [];
  let dayKey = current.data.dayKey || todayKey;
  if (dayKey !== todayKey) {
    // New day: reset lists
    upHits = []; downHits = []; dayKey = todayKey;
  }
  const nowIso = new Date().toISOString();
  const seenUp = new Set(upHits.map(h => h && h.code));
  const seenDown = new Set(downHits.map(h => h && h.code));
  // Normalize existing seen sets to uppercase codes
  const _normCode = (c) => (c || '').toString().trim().toUpperCase();
  const seenUpNorm = new Set(Array.from(seenUp).map(_normCode));
  const seenDownNorm = new Set(Array.from(seenDown).map(_normCode));

  function normMoverItem(e) {
    if (!e) return null;
    const code = (e.code || e.shareCode || '').toString().trim().toUpperCase();
    if (!code) return null;
    // Prefer provided fields; compute pct if needed
    const live = (e.live!=null && !isNaN(e.live)) ? Number(e.live) : null;
    const prev = (e.prevClose!=null && !isNaN(e.prevClose)) ? Number(e.prevClose) : (e.prev!=null && !isNaN(e.prev) ? Number(e.prev) : null);
    const change = (e.change!=null && !isNaN(e.change)) ? Number(e.change) : (live!=null && prev!=null ? Number(live - prev) : null);
    const pct = (e.pct!=null && !isNaN(e.pct)) ? Number(e.pct) : ((change!=null && prev) ? Number((change/prev)*100) : null);
    const direction = (e.direction || (change!=null ? (change>0?'up':'down') : null)) || null;
    return { code, name: e.name || e.companyName || null, live: live, prevClose: prev, change: change, pct: pct, direction: direction, t: nowIso };
  }

  (Array.isArray(upArr) ? upArr : []).forEach(e => {
  const item = normMoverItem(e);
  if (!item) return;
  const c = _normCode(item.code);
  item.code = c;
  if (!seenUpNorm.has(c)) { upHits.push(item); seenUpNorm.add(c); }
  });
  (Array.isArray(downArr) ? downArr : []).forEach(e => {
  const item = normMoverItem(e);
  if (!item) return;
  const c = _normCode(item.code);
  item.code = c;
  if (!seenDownNorm.has(c)) { downHits.push(item); seenDownNorm.add(c); }
  });

  writeDailyMoversHits_({ dayKey, upHits, downHits });
}

// ================== PORTFOLIO DUPLICATION -> CUSTOM HITS ==================
/** For each user, if any of their shares' codes appear in today's up/down movers, append into CUSTOM_TRIGGER_HITS. */
function duplicateMoversIntoCustom_(upArr, downArr) {
  try {
    const moversSet = new Set();
    (Array.isArray(upArr) ? upArr : []).forEach(e => { const c=(e&&e.code||'').toString().toUpperCase(); if(c) moversSet.add(c); });
    (Array.isArray(downArr) ? downArr : []).forEach(e => { const c=(e&&e.code||'').toString().toUpperCase(); if(c) moversSet.add(c); });
    if (moversSet.size === 0) return;
    // Build quick map for name/live when present
    const infoMap = {};
    function num(v){ const n=Number(v); return isFinite(n)? n : null; }
    (Array.isArray(upArr)?upArr:[]).concat(Array.isArray(downArr)?downArr:[]).forEach(e=>{
      if (!e || !e.code) return; const c = String(e.code).toUpperCase();
      if (!infoMap[c]) infoMap[c] = { name: e.name || null, live: num(e.live) };
    });
    // Iterate users and their shares
    const pending = [];
    const nowIso = new Date().toISOString();
    const sharesCg = _listCollectionGroup_('shares');
    if (!sharesCg.ok) { Logger.log('[DupMovers] shares CG list failed: %s', sharesCg.error); return; }
    (sharesCg.docs || []).forEach(d => {
      try {
        const name = d.name || '';
        const parts = name.split('/');
        const usersIdx = parts.lastIndexOf('users');
        if (usersIdx < 0 || usersIdx+2 >= parts.length) return;
        const uid = parts[usersIdx+1];
        const shareId = parts[parts.length-1];
        const f = _fromFsFields_(d.fields || {});
        // Skip if alerts for this share are explicitly disabled
        try {
          const alertDoc = _fetchFirestoreDocument_(['artifacts', APP_ID, 'users', uid, 'alerts', shareId]);
          if (alertDoc && alertDoc.ok && alertDoc.data && alertDoc.data.enabled === false) return;
        } catch(_){}
        const rawCode = (f.shareName || f.shareCode || f.code || '').toString().trim();
        const code = rawCode ? rawCode.toUpperCase() : null; if (!code) return;
        if (!moversSet.has(code)) return;
        const meta = infoMap[code] || {};
        const direction = (Array.isArray(upArr) && upArr.some(x=> (x.code||'').toString().toUpperCase()===code)) ? 'up' : ((Array.isArray(downArr) && downArr.some(x=> (x.code||'').toString().toUpperCase()===code)) ? 'down' : null);
        pending.push({ code, name: meta.name || f.companyName || null, live: meta.live || null, intent: 'mover', direction, userId: uid, shareId, t: nowIso });
      } catch(_){ }
    });
    if (pending.length) appendDailyCustomHits_(pending);
  } catch (e) { Logger.log('[DupMovers] EX', e); }
}

/** For each user, if any of their shares' codes appear in today's 52W highs/lows, append into CUSTOM_TRIGGER_HITS. */
function duplicateHiLoHitsIntoCustom_(highsArr, lowsArr) {
  try {
    const hiLoSet = new Set();
    (Array.isArray(highsArr)?highsArr:[]).forEach(e=>{ const c=(e&&e.code||'').toString().toUpperCase(); if(c) hiLoSet.add(c); });
    (Array.isArray(lowsArr)?lowsArr:[]).forEach(e=>{ const c=(e&&e.code||'').toString().toUpperCase(); if(c) hiLoSet.add(c); });
    if (hiLoSet.size === 0) return;
    const infoMap = {};
    function num(v){ const n=Number(v); return isFinite(n)? n : null; }
    (Array.isArray(highsArr)?highsArr:[]).concat(Array.isArray(lowsArr)?lowsArr:[]).forEach(e=>{
      if (!e || !e.code) return; const c = String(e.code).toUpperCase();
      if (!infoMap[c]) infoMap[c] = { name: e.name || null, live: num(e.live) };
    });
    const pending = [];
    const nowIso = new Date().toISOString();
    const sharesCg = _listCollectionGroup_('shares');
    if (!sharesCg.ok) { Logger.log('[DupHiLo] shares CG list failed: %s', sharesCg.error); return; }
    (sharesCg.docs || []).forEach(d => {
      try {
        const name = d.name || '';
        const parts = name.split('/');
        const usersIdx = parts.lastIndexOf('users');
        if (usersIdx < 0 || usersIdx+2 >= parts.length) return;
        const uid = parts[usersIdx+1];
        const shareId = parts[parts.length-1];
        const f = _fromFsFields_(d.fields || {});
        // Skip if alerts for this share are explicitly disabled
        try {
          const alertDoc = _fetchFirestoreDocument_(['artifacts', APP_ID, 'users', uid, 'alerts', shareId]);
          if (alertDoc && alertDoc.ok && alertDoc.data && alertDoc.data.enabled === false) return;
        } catch(_){}
        const rawCode = (f.shareName || f.shareCode || f.code || '').toString().trim();
        const code = rawCode ? rawCode.toUpperCase() : null; if (!code) return;
        if (!hiLoSet.has(code)) return;
        const meta = infoMap[code] || {};
        const wasHigh = (Array.isArray(highsArr)?highsArr:[]).some(e=> (e&&String(e.code).toUpperCase())===code);
        const intent = wasHigh ? '52w-high' : '52w-low';
        pending.push({ code, name: meta.name || f.companyName || null, live: meta.live || null, intent, userId: uid, shareId, t: nowIso });
      } catch(_){ }
    });
    if (pending.length) appendDailyCustomHits_(pending);
  } catch (e) { Logger.log('[DupHiLo] EX', e); }
}

// ================== DAILY CUSTOM TRIGGER HITS ==================
/** Fetch current day's CUSTOM_TRIGGER_HITS document from Firestore. */
function fetchDailyCustomHits_() {
  const res = _fetchFirestoreDocument_(DAILY_CUSTOM_HITS_DOC_SEGMENTS);
  if (!res.ok) {
    if (res.notFound) return { ok: true, data: { dayKey: getSydneyDayKey_(), hits: [] }, updateTime: null };
    return { ok: false, error: res.error || ('status=' + res.status) };
  }
  const data = res.data || {};
  return { ok: true, data: { dayKey: data.dayKey || getSydneyDayKey_(), hits: data.hits || [] }, updateTime: res.updateTime || null };
}

/** Write/overwrite CUSTOM_TRIGGER_HITS doc. */
function writeDailyCustomHits_(payload) {
  const now = new Date();
  const body = {
    dayKey: payload.dayKey || getSydneyDayKey_(),
    hits: Array.isArray(payload.hits) ? payload.hits : [],
    updatedAt: now
  };
  const mask = ['dayKey','hits','updatedAt'];
  return commitCentralDoc_(DAILY_CUSTOM_HITS_DOC_SEGMENTS, body, mask);
}

/** Append to CUSTOM_TRIGGER_HITS with de-dup on (userId, code). */
function appendDailyCustomHits_(newHitsArr) {
  const todayKey = getSydneyDayKey_();
  const current = fetchDailyCustomHits_();
  if (!current.ok) { Logger.log('[CustomHits] fetch failed: %s', current.error); return; }
  let hits = current.data.hits || [];
  let dayKey = current.data.dayKey || todayKey;
  if (dayKey !== todayKey) { hits = []; dayKey = todayKey; }
  const nowIso = new Date().toISOString();
  // De-duplication key includes intent so same code can appear once per intent per user per day.
  const _normCode = (c) => (c || '').toString().trim().toUpperCase();
  // Normalize intent: map legacy names, coerce missing to explicit 'none' to avoid empty-key collisions
  const _normIntent = (i) => {
    if (!i) return 'none';
    const s = i.toString().trim().toLowerCase();
    if (s === 'global-mover') return 'mover';
    return s || 'none';
  };
  const seen = new Set(hits.map(h => {
    if (!h) return '';
    const uid = (h.userId || '');
    const code = _normCode(h.code || '');
    const intentRaw = (h.intent || '');
    const intent = _normIntent(intentRaw);
    return uid + '|' + code + '|' + intent;
  }));
    (Array.isArray(newHitsArr) ? newHitsArr : []).forEach(h => {
    if (!h || !h.code) return;
    const uid = (h.userId || '') + '';
    const code = _normCode(h.code);
    const intent = _normIntent(h.intent || null);
    const key = uid + '|' + code + '|' + intent;
    if (seen.has(key)) return;
    const item = {
      code: code,
      name: h.name || null,
      live: (h.live!=null && !isNaN(h.live)) ? Number(h.live) : null,
      target: (h.target!=null && !isNaN(h.target)) ? Number(h.target) : null,
      direction: h.direction || null,
      intent: intent || 'none',
      userId: uid || null,
      shareId: h.shareId || null,
      t: h.t || nowIso,
      userIntent: h.userIntent || null
    };
    hits.push(item); seen.add(key);
  });
  writeDailyCustomHits_({ dayKey, hits });
}

/**
 * Reconcile portfolio-based duplicates from today's daily hits into CUSTOM_TRIGGER_HITS.
 * This ensures that if a user adds a portfolio share later in the day, they still see
 * the corresponding movers/52w events under Custom Triggers. Idempotent.
 */
function reconcileCustomDuplicatesFromDailyHits_() {
  try {
    // Fetch today's daily hits docs
    const hiloRes = fetchDailyHiLoHits_();
    const moversRes = fetchDailyMoversHits_();
    if (!hiloRes.ok && !moversRes.ok) { Logger.log('[CustomRecon] Failed to fetch daily hits'); return; }
    const highHits = (hiloRes && hiloRes.ok && Array.isArray(hiloRes.data.highHits)) ? hiloRes.data.highHits : [];
    const lowHits  = (hiloRes && hiloRes.ok && Array.isArray(hiloRes.data.lowHits)) ? hiloRes.data.lowHits : [];
    const upHits   = (moversRes && moversRes.ok && Array.isArray(moversRes.data.upHits)) ? moversRes.data.upHits : [];
    const downHits = (moversRes && moversRes.ok && Array.isArray(moversRes.data.downHits)) ? moversRes.data.downHits : [];

    // Build quick lookup sets and info maps
    const toCode = (c) => (c==null? '' : String(c)).trim().toUpperCase();
    const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };
    const hiSet = new Set(highHits.map(h => toCode(h && h.code)));
    const loSet = new Set(lowHits.map(h => toCode(h && h.code)));
    const upSet = new Set(upHits.map(h => toCode(h && h.code)));
    const dnSet = new Set(downHits.map(h => toCode(h && h.code)));
    if (hiSet.size===0 && loSet.size===0 && upSet.size===0 && dnSet.size===0) return; // nothing to do

    // Info maps for name/live
    const info = {};
    function putInfo(arr) {
      (Array.isArray(arr)?arr:[]).forEach(h => {
        if (!h) return; const c = toCode(h.code); if (!c) return;
        if (!info[c]) info[c] = { name: h.name || null, live: num(h.live) };
      });
    }
    putInfo(highHits); putInfo(lowHits); putInfo(upHits); putInfo(downHits);

    const pending = [];
    const nowIso = new Date().toISOString();
    const sharesCg = _listCollectionGroup_('shares');
    if (!sharesCg.ok) { Logger.log('[CustomRecon] shares CG list failed: %s', sharesCg.error); return; }
    (sharesCg.docs || []).forEach(d => {
      try {
        const name = d.name || '';
        const parts = name.split('/');
        const usersIdx = parts.lastIndexOf('users');
        if (usersIdx < 0 || usersIdx+2 >= parts.length) return;
        const uid = parts[usersIdx+1];
        const shareId = parts[parts.length-1];
        const f = _fromFsFields_(d.fields || {});
        // Skip if alerts for this share are explicitly disabled
        try {
          const alertDoc = _fetchFirestoreDocument_(['artifacts', APP_ID, 'users', uid, 'alerts', shareId]);
          if (alertDoc && alertDoc.ok && alertDoc.data && alertDoc.data.enabled === false) return;
        } catch(_){}
        const rawCode = (f.shareName || f.shareCode || f.code || '').toString().trim();
        const code = rawCode ? rawCode.toUpperCase() : null; if (!code) return;
        if (hiSet.has(code)) { const meta = info[code] || {}; pending.push({ code, name: meta.name || f.companyName || null, live: meta.live || null, intent: '52w-high', userId: uid, shareId, t: nowIso }); }
        if (loSet.has(code)) { const meta = info[code] || {}; pending.push({ code, name: meta.name || f.companyName || null, live: meta.live || null, intent: '52w-low', userId: uid, shareId, t: nowIso }); }
        if (upSet.has(code)) { const meta = info[code] || {}; pending.push({ code, name: meta.name || f.companyName || null, live: meta.live || null, intent: 'mover', direction: 'up', userId: uid, shareId, t: nowIso }); }
        if (dnSet.has(code)) { const meta = info[code] || {}; pending.push({ code, name: meta.name || f.companyName || null, live: meta.live || null, intent: 'mover', direction: 'down', userId: uid, shareId, t: nowIso }); }
      } catch(_){ }
    });

    if (pending.length) appendDailyCustomHits_(pending);
  } catch (e) {
    Logger.log('[CustomRecon] EX %s', e && e.message || e);
  }
}

/**
 * Scan all users' enabled custom target alerts against current Prices sheet and persist hits.
 * Rule: direction 'above' -> live >= target; 'below' -> live <= target. target>0 required.
 */
function runCustomTriggersScan() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const priceRows = fetchAllAsxData_(ss) || [];
    if (!priceRows.length) { console.log('[CustomScan] No price data; abort.'); return; }
    // Build quick lookup map by code
    const priceMap = {};
    priceRows.forEach(r => { if (r && r.code) priceMap[String(r.code).toUpperCase()] = r; });

    // Iterate via collection group to avoid user-list dependency
    const sharesCg = _listCollectionGroup_('shares');
    if (!sharesCg.ok) { console.log('[CustomScan] Failed to list shares (CG):', sharesCg.error); return; }
    const pendingHits = [];
    (sharesCg.docs || []).forEach(d => {
      try {
        const docName = d.name || '';
        const parts = docName.split('/');
        const usersIdx = parts.lastIndexOf('users');
        if (usersIdx < 0 || usersIdx+2 >= parts.length) return;
        const userId = parts[usersIdx+1];
        const shareId = parts[parts.length-1];
        const fields = _fromFsFields_(d.fields || {});
        // Per-share alert disable check (default enabled if alert doc missing)
        let disabled = false;
        try {
          const alertDoc = _fetchFirestoreDocument_(['artifacts', APP_ID, 'users', userId, 'alerts', shareId]);
          if (alertDoc && alertDoc.ok && alertDoc.data && alertDoc.data.enabled === false) disabled = true;
        } catch(_){}
        if (disabled) return;
        const rawCode = (fields.shareName || fields.shareCode || fields.code || '').toString().trim();
        const code = rawCode ? rawCode.toUpperCase() : null; if (!code) return;
        function _sanitizeTarget_(v){
          if (v === null || v === undefined) return NaN;
          if (typeof v === 'number') return v;
          let s = String(v).trim(); if (!s) return NaN;
          s = s.replace(/\$/g,'');
          const centsMatch = /^([0-9]+)c$/i.exec(s);
          if (centsMatch) { const centsVal = Number(centsMatch[1]); return isFinite(centsVal) ? (centsVal/100) : NaN; }
          s = s.replace(/cents?/i,''); s = s.replace(/,/g,''); s = s.replace(/[^0-9.+-]/g,'');
          if (!s) return NaN; const n = Number(s); return isFinite(n) ? n : NaN;
        }
        const tgt = _sanitizeTarget_(fields.targetPrice);
        if (!isFinite(tgt) || tgt <= 0) return;
        const direction = (fields.targetDirection || '').toString().trim().toLowerCase();
        if (direction !== 'above' && direction !== 'below') return;
        const p = priceMap[code]; if (!p || p.livePrice == null || isNaN(p.livePrice)) return;
        const live = Number(p.livePrice);
        const hit = (direction === 'above') ? (live >= tgt) : (live <= tgt);
        if (!hit) return;
        pendingHits.push({ code, name: p.name || fields.companyName || null, live, target: tgt, direction, intent: 'target-hit', userIntent: (function(){ const ui = (fields.intent==null? null : String(fields.intent)); return (ui && ui.trim()) ? ui : null; })(), userId, shareId, t: new Date().toISOString() });
      } catch (e) { Logger.log('[CustomScan] CG share eval error: %s', e && e.message || e); }
    });

    if (pendingHits.length) {
      appendDailyCustomHits_(pendingHits);
      console.log('[CustomScan] Appended hits:', pendingHits.length);
    } else {
      console.log('[CustomScan] No hits this cycle.');
    }
  } catch (err) {
    console.error('[CustomScan] ERROR:', err && err.stack || err);
  }
}

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

/** List all documents under a collection using REST (shallow). Returns array of {name, fields}. */
function _listFirestoreCollection_(collectionPathSegments, options) {
  const token = ScriptApp.getOAuthToken();
  const collPath = collectionPathSegments.map(encodeURIComponent).join('/');
  const url = FIRESTORE_BASE + '/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents/' + collPath;
  try {
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
    // Use pageSize to avoid huge payloads; paginate if nextPageToken appears
    let pageToken = null; const out = [];
    for (let i=0;i<20;i++) { // safety cap
      const fullUrl = url + '?pageSize=100' + (pageToken ? ('&pageToken=' + encodeURIComponent(pageToken)) : '');
      const resp = UrlFetchApp.fetch(fullUrl, { method: 'get', headers, muteHttpExceptions: true });
      const status = resp.getResponseCode(); const text = resp.getContentText();
      if (status === 404) return { ok: true, docs: [] };
      let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch(_) {}
      if (status >= 200 && status < 300 && parsed) {
        const docs = parsed.documents || [];
        docs.forEach(d => out.push({ name: d.name, fields: d.fields || {}, updateTime: d.updateTime || null, createTime: d.createTime || null }));
        pageToken = parsed.nextPageToken || null;
        if (!pageToken) break;
      } else {
        return { ok: false, status, error: text };
      }
    }
    return { ok: true, docs: out };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}

// Advanced helper: run a collection group query using Firestore REST runQuery API
// Returns only docs under /artifacts/{APP_ID}/users/ to avoid cross-app bleed.
function _listCollectionGroup_(collectionId) {
  try {
    const token = ScriptApp.getOAuthToken();
    const url = FIRESTORE_BASE + '/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents:runQuery';
    const body = { structuredQuery: { from: [{ collectionId: collectionId, allDescendants: true }], limit: 1000 } };
    const resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    const status = resp.getResponseCode();
    const text = resp.getContentText() || '';
    if (status < 200 || status >= 300) return { ok: false, status, error: text };
    let parsed = []; try { parsed = text ? JSON.parse(text) : []; } catch(_) {}
    const docs = [];
    const appPath = '/artifacts/' + APP_ID + '/users/';
    (parsed || []).forEach(row => {
      const doc = row && row.document;
      if (!doc || !doc.name) return;
      if (doc.name.indexOf(appPath) === -1) return;
      docs.push({ name: doc.name, fields: doc.fields || {}, updateTime: doc.updateTime || null, createTime: doc.createTime || null });
    });
    return { ok: true, docs };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
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
  // Also reset daily 52-week hit history in Firestore
  try {
    const dayKey = getSydneyDayKey_();
    writeDailyHiLoHits_({ dayKey, highHits: [], lowHits: [] });
    console.log(`[${now}] Daily 52-week hit history reset for ${dayKey}.`);
  } catch (e) {
    console.error('Failed to reset daily 52-week hit history:', e);
  }
  // Reset daily GLOBAL_MOVERS hits in Firestore as well
  try {
    const dayKey2 = getSydneyDayKey_();
    writeDailyMoversHits_({ dayKey: dayKey2, upHits: [], downHits: [] });
    console.log(`[${now}] Daily GLOBAL_MOVERS hit history reset for ${dayKey2}.`);
  } catch (e) {
    console.error('Failed to reset daily GLOBAL_MOVERS hit history:', e);
  }
  // Reset daily CUSTOM_TRIGGER_HITS
  try {
    const dayKey3 = getSydneyDayKey_();
    writeDailyCustomHits_({ dayKey: dayKey3, hits: [] });
    console.log(`[${now}] Daily CUSTOM_TRIGGER_HITS reset for ${dayKey3}.`);
  } catch (e) {
    console.error('Failed to reset daily CUSTOM_TRIGGER_HITS:', e);
  }
}

/**
 * Debug helper: returns counts and small samples from the three daily hits docs.
 * Useful to call from Apps Script editor to quickly confirm whether hits are being appended.
 */
function debugDailyHitsParity() {
  try {
    const movers = _fetchFirestoreDocument_(DAILY_MOVERS_HITS_DOC_SEGMENTS) || {};
    const hilo = _fetchFirestoreDocument_(DAILY_HILO_HITS_DOC_SEGMENTS) || {};
    const custom = _fetchFirestoreDocument_(DAILY_CUSTOM_HITS_DOC_SEGMENTS) || {};
    const out = {
      dayKey: getSydneyDayKey_(),
      movers: { ok: movers.ok === true, dayKey: (movers.data && movers.data.dayKey) || null, upCount: (movers.data && Array.isArray(movers.data.upHits) ? movers.data.upHits.length : null), downCount: (movers.data && Array.isArray(movers.data.downHits) ? movers.data.downHits.length : null), upSample: (movers.data && Array.isArray(movers.data.upHits) ? movers.data.upHits.slice(0,5) : []), downSample: (movers.data && Array.isArray(movers.data.downHits) ? movers.data.downHits.slice(0,5) : []) },
      hilo: { ok: hilo.ok === true, dayKey: (hilo.data && hilo.data.dayKey) || null, highCount: (hilo.data && Array.isArray(hilo.data.highHits) ? hilo.data.highHits.length : null), lowCount: (hilo.data && Array.isArray(hilo.data.lowHits) ? hilo.data.lowHits.length : null), highSample: (hilo.data && Array.isArray(hilo.data.highHits) ? hilo.data.highHits.slice(0,5) : []), lowSample: (hilo.data && Array.isArray(hilo.data.lowHits) ? hilo.data.lowHits.slice(0,5) : []) },
      custom: { ok: custom.ok === true, dayKey: (custom.data && custom.data.dayKey) || null, totalHits: (custom.data && Array.isArray(custom.data.hits) ? custom.data.hits.length : null), sample: (custom.data && Array.isArray(custom.data.hits) ? custom.data.hits.slice(0,10) : []) }
    };
    Logger.log('[debugDailyHitsParity] %s', JSON.stringify(out));
    return out;
  } catch (e) {
    Logger.log('[debugDailyHitsParity] Error: %s', e && e.message || e);
    return { ok: false, error: String(e) };
  }
}

// ================== DIAGNOSTIC RUNNER (ONE-CLICK) ==================
/**
 * Runs all scans and reconciliation in sequence and returns a compact summary for testing.
 * Usage: runAllAlertScansAndReconcile() from the Apps Script editor.
 */
function runAllAlertScansAndReconcile() {
  const startedAt = new Date().toISOString();
  let steps = [];
  try { runGlobal52WeekScan(); steps.push('runGlobal52WeekScan:OK'); } catch(e){ steps.push('runGlobal52WeekScan:ERR:' + (e && e.message || e)); }
  try { runGlobalMoversScan(); steps.push('runGlobalMoversScan:OK'); } catch(e){ steps.push('runGlobalMoversScan:ERR:' + (e && e.message || e)); }
  try { runCustomTriggersScan(); steps.push('runCustomTriggersScan:OK'); } catch(e){ steps.push('runCustomTriggersScan:ERR:' + (e && e.message || e)); }
  try { reconcileCustomDuplicatesFromDailyHits_(); steps.push('reconcileCustomDuplicatesFromDailyHits:OK'); } catch(e){ steps.push('reconcileCustomDuplicatesFromDailyHits:ERR:' + (e && e.message || e)); }
  const parity = (function(){ try { return debugDailyHitsParity(); } catch(e){ return { ok:false, error:String(e) }; } })();
  const out = { ok: true, startedAt, finishedAt: new Date().toISOString(), steps, parity };
  Logger.log('[Diag Runner] %s', JSON.stringify(out));
  return out;
}

// ================== DAILY COMBINED EMAIL DIGEST ==================
function sendCombinedDailyDigest_() {
  // Only send digest on ASX trading weekdays (Mon-Fri). Abort on Saturday/Sunday in ASX timezone.
  try {
    const now = new Date();
    // 'u' returns ISO day number 1..7 (Mon=1 .. Sun=7)
    const isoDay = Number(Utilities.formatDate(now, ASX_TIME_ZONE, 'u'));
    if (isoDay === 6 || isoDay === 7) { // Saturday (6) or Sunday (7)
      console.log('[DailyDigest] Today is weekend in ASX timezone (isoDay=' + isoDay + '); skipping email send.');
      return;
    }
  } catch (dayErr) {
    console.log('[DailyDigest] Failed to determine ASX weekday, proceeding cautiously:', dayErr);
    // If timezone check fails, proceed (safe default) — this is conservative; alternatively could abort.
  }
  // Check settings and email recipient
  const settingsRes = fetchGlobalSettingsFromFirestore({ noCache: true });
  if (!settingsRes.ok || !settingsRes.data) { console.log('[DailyDigest] Settings fetch failed or empty'); return; }
  const settings = settingsRes.data;
  if (!settings.emailAlertsEnabled) { console.log('[DailyDigest] Email alerts disabled; skipping.'); return; }
  const recipient = settings.alertEmailRecipients || ALERT_RECIPIENT;
  if (!recipient) { console.log('[DailyDigest] No recipient configured; skipping.'); return; }

  // Fetch sources: movers hits, 52w hits, custom hits
  const moversHitsRes = _fetchFirestoreDocument_(DAILY_MOVERS_HITS_DOC_SEGMENTS, { noCache: true });
  const moversHits = (moversHitsRes && moversHitsRes.ok && moversHitsRes.data) ? moversHitsRes.data : { upHits: [], downHits: [], dayKey: getSydneyDayKey_() };
  const hiloHitsRes = _fetchFirestoreDocument_(DAILY_HILO_HITS_DOC_SEGMENTS, { noCache: true });
  const hiloHits = (hiloHitsRes && hiloHitsRes.ok && hiloHitsRes.data) ? hiloHitsRes.data : { highHits: [], lowHits: [], dayKey: getSydneyDayKey_() };
  const customHitsRes = _fetchFirestoreDocument_(DAILY_CUSTOM_HITS_DOC_SEGMENTS, { noCache: true });
  const customHits = (customHitsRes && customHitsRes.ok && customHitsRes.data) ? customHitsRes.data : { hits: [], dayKey: getSydneyDayKey_() };

  const sydneyDateStr = Utilities.formatDate(new Date(), ASX_TIME_ZONE, 'dd-MM-yyyy');
  const num = v => (v!=null && isFinite(v)) ? Number(v) : null;

  // Sort as requested
  const losers = (Array.isArray(moversHits.downHits) ? moversHits.downHits.slice() : []).sort((a,b)=> Math.abs(num(b.pct)||0) - Math.abs(num(a.pct)||0));
  const gainers = (Array.isArray(moversHits.upHits) ? moversHits.upHits.slice() : []).sort((a,b)=> (num(b.pct)||0) - (num(a.pct)||0));
  const lows = (Array.isArray(hiloHits.lowHits) ? hiloHits.lowHits.slice() : []).sort((a,b)=> (num(b.live)||0) - (num(a.live)||0));
  const highs = (Array.isArray(hiloHits.highHits) ? hiloHits.highHits.slice() : []).sort((a,b)=> (num(b.live)||0) - (num(a.live)||0));
  const customs = Array.isArray(customHits.hits) ? customHits.hits.slice() : [];

  // HTML helpers
  function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
  function td(v){ return '<td style="padding:6px 10px;border-bottom:1px solid #eee;">' + esc(v==null?'' : v) + '</td>'; }
  function fmtMoney(n){ const x = num(n); return x==null? '' : ('$' + x.toFixed(x<1?4:2)); }
  function fmtPct(n){ const x = num(n); return x==null? '' : ((x>=0?'+':'') + x.toFixed(2) + '%'); }

  function table(title, rows, headersHtml) {
    return (
      '<h3 style="margin:16px 0 8px 0;font-family:Arial,Helvetica,sans-serif;">' + esc(title) + '</h3>' +
      '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif;font-size:13px;">' +
        '<thead><tr style="text-align:left;background:#fafafa;">' + headersHtml + '</tr></thead>' +
        '<tbody>' + rows.join('') + '</tbody>' +
      '</table>'
    );
  }

  // Sections
  const losersRows = losers.map(o => ('<tr>' + td(o.code) + td(esc(o.name||'')) + td(fmtMoney(o.live)) + td(fmtPct(o.pct)) + td(fmtMoney(o.change)) + '</tr>'));
  const gainersRows = gainers.map(o => ('<tr>' + td(o.code) + td(esc(o.name||'')) + td(fmtMoney(o.live)) + td(fmtPct(o.pct)) + td(fmtMoney(o.change)) + '</tr>'));
  const lowsRows = lows.map(o => ('<tr>' + td(o.code) + td(esc(o.name||'')) + td(fmtMoney(o.live)) + td(fmtMoney(o.low52)) + td(fmtMoney(o.high52)) + '</tr>'));
  const highsRows = highs.map(o => ('<tr>' + td(o.code) + td(esc(o.name||'')) + td(fmtMoney(o.live)) + td(fmtMoney(o.low52)) + td(fmtMoney(o.high52)) + '</tr>'));
  const customRows = customs.map(o => ('<tr>' + td(o.code) + td(esc(o.name||'')) + td(fmtMoney(o.live)) + td(fmtMoney(o.target)) + td(o.direction||'') + td(o.intent||'') + '</tr>'));

  const hdrMovers = td('Code')+td('Name')+td('Price')+td('% Change')+td('Δ');
  const hdrHiLo = td('Code')+td('Name')+td('Price')+td('52W Low')+td('52W High');
  const hdrCustom = td('Code')+td('Name')+td('Price')+td('Target')+td('Direction')+td('Intent');

  const parts = [];
  // Order per requirement
  parts.push(table('Global Movers — Losers', losersRows, hdrMovers));
  parts.push(table('Global Movers — Gainers', gainersRows, hdrMovers));
  parts.push(table('52-Week Lows', lowsRows, hdrHiLo));
  parts.push(table('52-Week Highs', highsRows, hdrHiLo));
  if (customRows.length) parts.push(table('Custom Triggers', customRows, hdrCustom));

  const counts = `Movers: ${gainersRows.length} up, ${losersRows.length} down | 52-Week: ${highsRows.length} high, ${lowsRows.length} low`;
  const subject = `ASX Daily Briefing — ${sydneyDateStr} (${counts})`;
  const htmlBody = (
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.4;">' +
    `<h2 style="margin:0 0 12px 0;">ASX Daily Briefing — ${esc(sydneyDateStr)}</h2>` +
    parts.join('<div style="height:14px;"></div>') +
    '<div style="margin-top:16px;color:#666;font-size:12px;">This email is generated automatically from your ASX Alerts settings.</div>' +
    '</div>'
  );

  MailApp.sendEmail({ to: recipient, subject, htmlBody });
}

// Public wrapper for trigger safety: Apps Script triggers call global functions.
function sendCombinedDailyDigest() {
  try { sendCombinedDailyDigest_(); }
  catch (e) { console.error('sendCombinedDailyDigest wrapper failed:', e); }
}

// Public wrapper for trigger: reconcile daily duplicates periodically
function reconcileCustomDuplicatesFromDailyHits() {
  try { reconcileCustomDuplicatesFromDailyHits_(); }
  catch (e) { console.error('reconcileCustomDuplicatesFromDailyHits wrapper failed:', e); }
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
  // Route all per-alert emails through a disabled noop to avoid accidental sends.
  try { console.log('[sendAlertEmail] Disabled send to', recipient, subject); }
  catch (e) { console.error('[sendAlertEmail] Disabled function error:', e); }
}

// ===============================================================
// ================== TRIGGER MANAGEMENT HELPERS =================
// ===============================================================

function createTriggers() {
  // --- Helper: find triggers by handler name ---
  function _getTriggersByHandler_(handlerName) {
    return ScriptApp.getProjectTriggers().filter(t => {
      try { return t.getHandlerFunction && t.getHandlerFunction() === handlerName; } catch (_) { return false; }
    });
  }

  // --- Helper: ensure a time-based trigger exists for a handler (idempotent) ---
  function _ensureTimeTrigger_(handlerName, scheduleFn) {
    const existing = _getTriggersByHandler_(handlerName);
    if (existing && existing.length > 0) {
      console.log('[Triggers] Existing trigger(s) found for ' + handlerName + ': ' + existing.length);
      return;
    }
    // Always enforce Sydney timezone on the builder so project-level timezone is irrelevant.
    let builder = ScriptApp.newTrigger(handlerName).timeBased().inTimezone(ASX_TIME_ZONE);
    builder = scheduleFn && typeof scheduleFn === 'function' ? scheduleFn(builder) || builder : builder;
    builder.create();
    console.log('[Triggers] Created time-based trigger for ' + handlerName);
  }

  // --- 1) Preserve existing triggers as-is (to avoid behavior changes) ---
  // Note: These may create duplicates if run repeatedly, but we keep them
  // unchanged per existing behavior. Only movers/52w are made idempotent below.
  // Minute-based triggers cannot be combined with atHour/nearMinute; use one or the other.
  ScriptApp.newTrigger('checkMarketAlerts').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('checkMarketAlerts').timeBased().everyMinutes(30).create();
  // Daily triggers must specify a recurrence interval before atHour/nearMinute.
  // Explicitly set timezone to Australia/Sydney so project-level timezone is not required.
  ScriptApp.newTrigger('captureDailyClosePrice').timeBased().inTimezone(ASX_TIME_ZONE).everyDays(1).atHour(16).nearMinute(5).create();
  ScriptApp.newTrigger('dailyResetTrigger').timeBased().inTimezone(ASX_TIME_ZONE).everyDays(1).atHour(3).nearMinute(0).create();

  // --- 2) Fix Issue #2: Ensure Global Movers recurring trigger is active (idempotent) ---
  _ensureTimeTrigger_('runGlobalMoversScan', b => b.everyMinutes(10));

  // --- 3) Fix Issue #1: Replace failing misnamed 52-week trigger and ensure correct one ---
  // Remove any stale triggers pointing to a non-existent function name
  const stale52w = _getTriggersByHandler_('runGlobal52WeekScanScheduled');
  stale52w.forEach(t => { try { ScriptApp.deleteTrigger(t); console.log('[Triggers] Deleted stale 52W trigger (runGlobal52WeekScanScheduled).'); } catch(_){} });
  // Ensure a recurring trigger exists for the correct function name
  _ensureTimeTrigger_('runGlobal52WeekScan', b => b.everyMinutes(30));

  // --- 4) Ensure a separate daily digest trigger at ~16:15 Sydney time (idempotent) ---
  // Force timezone to Australia/Sydney so this fires correctly regardless of project settings.
  _ensureTimeTrigger_('sendCombinedDailyDigest', b => b.inTimezone(ASX_TIME_ZONE).everyDays(1).atHour(16).nearMinute(15));

  // --- 5) Ensure custom triggers scan runs periodically (idempotent) ---
  _ensureTimeTrigger_('runCustomTriggersScan', b => b.everyMinutes(15));

  // --- 6) Ensure reconciliation of daily duplicates runs periodically (idempotent) ---
  _ensureTimeTrigger_('reconcileCustomDuplicatesFromDailyHits', b => b.everyMinutes(30));

  console.log('Triggers ensured (market alerts unchanged; movers ensured; 52W ensured + stale removed).');
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

