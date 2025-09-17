import { getAllSharesData, getAllAsxCodes, getLivePrices, setLivePrices } from './state.js';

export async function fetchLivePrices(opts = {}) {
    try { if (typeof window.logDebug === 'function') window.logDebug('Live Price: Fetching from Apps Script...'); } catch(_) {}
    try {
        window._portfolioLastUpdated = new Date().toLocaleString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        const defaultAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbwwwMEss5DIYblLNbjIbt_TAzWh54AwrfQlVwCrT_P0S9xkAoXhAUEUg7vSEPYUPOZp/exec';
        const baseUrl = (typeof window.GOOGLE_APPS_SCRIPT_URL !== 'undefined' && window.GOOGLE_APPS_SCRIPT_URL)
            ? window.GOOGLE_APPS_SCRIPT_URL
            : ((typeof window.appsScriptUrl !== 'undefined' && window.appsScriptUrl)
                ? window.appsScriptUrl
                : defaultAppsScriptUrl);
        if (!baseUrl) throw new Error('Apps Script URL not defined');
        const qs = new URLSearchParams();
        if (opts && opts.cacheBust) qs.set('_ts', Date.now().toString());
        if (opts && opts.stockCode) qs.set('stockCode', String(opts.stockCode).toUpperCase());
        const url = qs.toString() ? (baseUrl + (baseUrl.includes('?') ? '&' : '?') + qs.toString()) : baseUrl;
        // Attempt direct fetch first
        let data;
        const tryFetchJson = async (requestUrl) => {
            const resp = await fetch(requestUrl, { cache: 'no-store' });
            if (!resp || !resp.ok) throw new Error('HTTP ' + (resp ? resp.status : 'N/A'));
            return resp.json();
        };

        const buildProxyUrl = (proxyBase, targetUrl) => {
            if (!proxyBase) return null;
            // Two common proxy styles:
            // 1) https://corsproxy.io/?<encoded-url>
            // 2) https://cors.isomorphic-git.org/<raw-url>
            if (proxyBase.includes('?')) return proxyBase + encodeURIComponent(targetUrl);
            if (proxyBase.endsWith('/')) return proxyBase + targetUrl;
            return proxyBase + '/' + targetUrl;
        };

        const isLocalDev = (() => {
            try {
                const o = (typeof location !== 'undefined') ? location.origin : '';
                return o.startsWith('http://localhost') || o.startsWith('http://127.0.0.1') || o.startsWith('file://');
            } catch(_) { return false; }
        })();

        try {
            data = await tryFetchJson(url);
        } catch (directErr) {
            // If CORS blocks in dev, try an optional proxy fallback
            const proxyBase = (typeof window.LIVE_PRICE_CORS_PROXY !== 'undefined' && window.LIVE_PRICE_CORS_PROXY)
                || (typeof window.CORS_PROXY !== 'undefined' && window.CORS_PROXY)
                || (typeof window.appsScriptCorsProxy !== 'undefined' && window.appsScriptCorsProxy) || '';
            const proxyUrl = buildProxyUrl(proxyBase, url);
            if (isLocalDev && proxyUrl) {
                console.warn('Live Price: Direct fetch failed, retrying via CORS proxy…', directErr && (directErr.message || directErr));
                try {
                    data = await tryFetchJson(proxyUrl);
                } catch (proxyErr) {
                    // Re-throw original context with proxy attempt details
                    const err = new Error('Live Price fetch failed (direct and via proxy). Direct=' + (directErr && directErr.message) + ' Proxy=' + (proxyErr && proxyErr.message));
                    err.directError = directErr; err.proxyError = proxyErr; throw err;
                }
            } else {
                // No proxy configured or not local dev—surface the original error
                throw directErr;
            }
        }
        
        if (!Array.isArray(data)) {
            console.warn('Live Price: Response not an array, got:', data);
            window._livePricesLoaded = true; if (typeof window.hideSplashScreenIfReady === 'function') window.hideSplashScreenIfReady(); return;
        }
        if (typeof window.DEBUG_MODE !== 'undefined' && window.DEBUG_MODE && data[0]) console.log('Live Price: Sample keys', Object.keys(data[0]));

        const allSharesData = getAllSharesData();
        const haveShares = Array.isArray(allSharesData) && allSharesData.length > 0;
        const portfolioNeeded = haveShares ? new Set(allSharesData.filter(s => s && s.shareName).map(s => s.shareName.toUpperCase())) : new Set();
        const globalNeeded = window._globalNeededCodes || new Set();
        const needed = new Set([...portfolioNeeded, ...globalNeeded]);
        const LOG_LIMIT = 30;
        let skipped = 0, skippedLogged = 0, accepted = 0, surrogate = 0, filtered = 0;
        const newLivePrices = {};
        window.globalExternalPriceRows = [];

        const numOrNull = v => {
            if (v === null || v === undefined) return 0;
            if (typeof v === 'string') {
                const t = v.trim();
                if (!t || t.toUpperCase() === '#N/A') return 0;
                const parsed = parseFloat(t.replace(/,/g,''));
                return isNaN(parsed) ? 0 : parsed;
            }
            if (typeof v === 'number') return isNaN(v) ? 0 : v;
            return 0;
        };

        data.forEach(item => {
            if (!item) return;
            const codeRaw = item.ASXCode || item.ASX_Code || item['ASX Code'] || item.Code || item.code;
            if (!codeRaw) return;
            const code = String(codeRaw).toUpperCase().trim();
            if (!code) return;
            const liveParsed = numOrNull(
                item.LivePrice || item['Live Price'] || item.live || item.price ||
                item.Last || item['Last Price'] || item.LastPrice || item['Last Trade'] || item.LastTrade
            );
            const prevParsed = numOrNull(
                item.PrevClose || item['Prev Close'] || item.previous || item.prev || item.prevClose ||
                item['Previous Close'] || item.Close || item['Last Close']
            );
            if (needed && !needed.has(code)) {
                if (liveParsed !== null && prevParsed !== null) {
                    window.globalExternalPriceRows.push({ code, live: liveParsed, prevClose: prevParsed });
                }
                filtered++; return;
            }
            const peParsed = numOrNull(item.PE || item['PE Ratio'] || item.pe);
            const high52Parsed = numOrNull(item.High52 || item['High52'] || item['High 52'] || item['52WeekHigh'] || item['52 High']);
            const low52Parsed = numOrNull(item.Low52 || item['Low52'] || item['Low 52'] || item['52WeekLow'] || item['52 Low']);

            const hasLive = liveParsed !== null;
            const hasPrev = prevParsed !== null;
            const effectiveLive = hasLive ? liveParsed : (hasPrev ? prevParsed : NaN);
            if (isNaN(effectiveLive)) {
                skipped++; if (typeof window.DEBUG_MODE !== 'undefined' && window.DEBUG_MODE && skippedLogged < LOG_LIMIT) { console.warn('Live Price skip (no usable price)', code, item); skippedLogged++; }
                return;
            }
            if (!hasLive && hasPrev) surrogate++;
            accepted++;

            const shareData = haveShares ? allSharesData.find(s => s && s.shareName && s.shareName.toUpperCase() === code) : null;
            const targetPrice = shareData && !isNaN(parseFloat(shareData.targetPrice)) ? parseFloat(shareData.targetPrice) : undefined;
            const dir = shareData && shareData.targetDirection ? shareData.targetDirection : 'below';
            let hit = false;
            if (targetPrice !== undefined) hit = dir === 'above' ? (effectiveLive >= targetPrice) : (effectiveLive <= targetPrice);

            const companyName = (item.CompanyName || item['Company Name'] || item.Name || item.name || '').toString().trim() || null;
            const allAsxCodesLocal = getAllAsxCodes();
            if (companyName && Array.isArray(allAsxCodesLocal) && !allAsxCodesLocal.some(c => c.code === code)) {
                allAsxCodesLocal.push({ code, name: companyName });
            }

            newLivePrices[code] = {
                live: effectiveLive,
                prevClose: hasPrev ? prevParsed : null,
                PE: peParsed,
                High52: high52Parsed,
                Low52: low52Parsed,
                targetHit: hit,
                lastLivePrice: effectiveLive,
                lastPrevClose: hasPrev ? prevParsed : null,
                surrogateFromPrevClose: (!hasLive && hasPrev) || undefined,
                companyName: companyName || undefined
            };
        });

        setLivePrices(newLivePrices);
        console.log('[GlobalAlerts] About to call evaluateGlobalPriceAlerts from priceService.js');
        try { if (typeof window.evaluateGlobalPriceAlerts === 'function') window.evaluateGlobalPriceAlerts(); } catch(_) {}
        
        // Call recomputeTriggeredAlerts to update target hit notifications
        try { 
            if (typeof window.recomputeTriggeredAlerts === 'function') {
                window.recomputeTriggeredAlerts(); 
                console.log('[PriceService] Called recomputeTriggeredAlerts');
            }
        } catch(e) { 
            console.warn('[PriceService] Failed to call recomputeTriggeredAlerts:', e); 
        }
        if (typeof window.DEBUG_MODE !== 'undefined' && window.DEBUG_MODE) {
            const parts = [`accepted=${accepted}`];
            if (surrogate) parts.push(`surrogate=${surrogate}`);
            if (skipped) parts.push(`skipped=${skipped}`);
            if (filtered) parts.push(`filtered=${filtered}`);
            if (skipped > LOG_LIMIT) parts.push(`skippedNotLogged=${skipped - LOG_LIMIT}`);
            console.log('Live Price: Summary ' + parts.join(', '));
        }

        window.sharesAt52WeekLow = [];
        if (Array.isArray(allSharesData)) {
            const livePricesLocal = getLivePrices();
            allSharesData.forEach(share => {
                const code = (share.shareName || '').toUpperCase();
                const lpObj = livePricesLocal ? livePricesLocal[code] : undefined;
                if (!lpObj || lpObj.live == null || isNaN(lpObj.live) || lpObj.Low52 == null || isNaN(lpObj.Low52)) return;
                const isMuted = !!(window.__low52MutedMap && window.__low52MutedMap[code + '_low']);
                if (lpObj.live <= lpObj.Low52 && !(window.triggered52WeekLowSet && window.triggered52WeekLowSet.has(code))) {
                    let displayName = code;
                    const allAsxCodesLocal2 = getAllAsxCodes();
                    if (Array.isArray(allAsxCodesLocal2)) {
                        const match = allAsxCodesLocal2.find(c => c.code === code);
                        if (match && match.name) displayName = match.name;
                    }
                    if (!displayName && share.companyName) displayName = share.companyName;
                    window.sharesAt52WeekLow.push({ code, name: displayName, live: lpObj.live, low52: lpObj.Low52, type: 'low', muted: isMuted });
                    try { if (window.triggered52WeekLowSet) window.triggered52WeekLowSet.add(code); } catch(_) {}
                }
            });
        }
        if (Array.isArray(window.sharesAt52WeekLow)) {
            // Removed CBA test card injection
        }
        try { if (typeof window.onLivePricesUpdated === 'function') window.onLivePricesUpdated(); } catch(_) {}
        window._livePricesLoaded = true;
        try { if (typeof window.hideSplashScreenIfReady === 'function') window.hideSplashScreenIfReady(); } catch(_) {}
        try { if (typeof window.recomputeTriggeredAlerts === 'function') window.recomputeTriggeredAlerts(); } catch(_) {}
        try { if (typeof window.updateTargetHitBanner === 'function') window.updateTargetHitBanner(); } catch(_) {}

        // Update the live price timestamp in the header on successful fetch
        try {
            if (typeof window.updateLivePriceTimestamp === 'function') {
                window.updateLivePriceTimestamp(Date.now());
            }
        } catch(_) {}
    } catch (e) {
        console.error('Live Price: Fetch error', e);
        window._livePricesLoaded = true;
        try { if (typeof window.hideSplashScreenIfReady === 'function') window.hideSplashScreenIfReady(); } catch(_) {}
    }
}


