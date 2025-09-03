import { allSharesData, allAsxCodes, livePrices, setLivePrices } from './state.js';

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
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (!Array.isArray(data)) {
            console.warn('Live Price: Response not an array, got:', data);
            window._livePricesLoaded = true; if (typeof window.hideSplashScreenIfReady === 'function') window.hideSplashScreenIfReady(); return;
        }
        if (typeof window.DEBUG_MODE !== 'undefined' && window.DEBUG_MODE && data[0]) console.log('Live Price: Sample keys', Object.keys(data[0]));

        const haveShares = Array.isArray(allSharesData) && allSharesData.length > 0;
        const needed = haveShares ? new Set(allSharesData.filter(s => s && s.shareName).map(s => s.shareName.toUpperCase())) : null;
        const LOG_LIMIT = 30;
        let skipped = 0, skippedLogged = 0, accepted = 0, surrogate = 0, filtered = 0;
        const newLivePrices = {};
        window.globalExternalPriceRows = [];

        const numOrNull = v => {
            if (v === null || v === undefined) return null;
            if (typeof v === 'string') {
                const t = v.trim();
                if (!t || t.toUpperCase() === '#N/A') return null;
                const parsed = parseFloat(t.replace(/,/g,''));
                return isNaN(parsed) ? null : parsed;
            }
            if (typeof v === 'number') return isNaN(v) ? null : v;
            return null;
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
            if (companyName && Array.isArray(allAsxCodes) && !allAsxCodes.some(c => c.code === code)) {
                allAsxCodes.push({ code, name: companyName });
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
        try { if (typeof window.evaluateGlobalPriceAlerts === 'function') window.evaluateGlobalPriceAlerts(); } catch(_) {}
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
            allSharesData.forEach(share => {
                const code = (share.shareName || '').toUpperCase();
                const lpObj = livePrices ? livePrices[code] : undefined;
                if (!lpObj || lpObj.live == null || isNaN(lpObj.live) || lpObj.Low52 == null || isNaN(lpObj.Low52)) return;
                const isMuted = !!(window.__low52MutedMap && window.__low52MutedMap[code + '_low']);
                if (lpObj.live <= lpObj.Low52 && !window.triggered52WeekLowSet?.has(code)) {
                    let displayName = code;
                    if (Array.isArray(allAsxCodes)) {
                        const match = allAsxCodes.find(c => c.code === code);
                        if (match && match.name) displayName = match.name;
                    }
                    if (!displayName && share.companyName) displayName = share.companyName;
                    window.sharesAt52WeekLow.push({ code, name: displayName, live: lpObj.live, low52: lpObj.Low52, type: 'low', muted: isMuted });
                    try { if (window.triggered52WeekLowSet) window.triggered52WeekLowSet.add(code); } catch(_) {}
                }
            });
        }
        if (Array.isArray(window.sharesAt52WeekLow)) {
            const alreadyHasTest = window.sharesAt52WeekLow.some(item => item && item.code === 'CBA' && item.isTestCard);
            if (!alreadyHasTest) {
                window.sharesAt52WeekLow.unshift({ code: 'CBA', name: 'Commonwealth Bank (Test Card)', type: 'low', low52: 90.00, high52: 120.00, live: 91.23, isTestCard: true, muted: !!(window.__low52MutedMap && window.__low52MutedMap['CBA_low']) });
            }
        }
        try { if (typeof window.onLivePricesUpdated === 'function') window.onLivePricesUpdated(); } catch(_) {}
        window._livePricesLoaded = true;
        try { if (typeof window.hideSplashScreenIfReady === 'function') window.hideSplashScreenIfReady(); } catch(_) {}
        try { if (typeof window.recomputeTriggeredAlerts === 'function') window.recomputeTriggeredAlerts(); } catch(_) {}
        try { if (typeof window.updateTargetHitBanner === 'function') window.updateTargetHitBanner(); } catch(_) {}
    } catch (e) {
        console.error('Live Price: Fetch error', e);
        window._livePricesLoaded = true;
        try { if (typeof window.hideSplashScreenIfReady === 'function') window.hideSplashScreenIfReady(); } catch(_) {}
    }
}


