// Centralized application state module
// Exports state variables and setter functions, and mirrors values to window for non-module scripts

// Core state variables
let allSharesData = [];
let livePrices = {};
let userWatchlists = [];
let userCashCategories = [];
let currentSelectedWatchlistIds = [];
let sharesAtTargetPrice = [];
let currentSortOrder = 'entryDate-desc';
let allAsxCodes = [];
let watchlistSortOrders = {}; // Stores sort order per watchlist
let currentMobileViewMode = 'default'; // Stores view mode preference

// Window exposure for compatibility with non-module scripts (e.g., rendering.js)
if (typeof window !== 'undefined') {
    window.allSharesData = allSharesData;
    window.livePrices = livePrices;
    window.userWatchlists = userWatchlists;
    window.userCashCategories = userCashCategories;
    window.currentSelectedWatchlistIds = currentSelectedWatchlistIds;
    window.sharesAtTargetPrice = sharesAtTargetPrice;
    window.currentSortOrder = currentSortOrder;
    window.allAsxCodes = allAsxCodes;
    window.watchlistSortOrders = watchlistSortOrders;
    window.currentMobileViewMode = currentMobileViewMode;
}

// Setter helpers keep window mirrors in sync
export function setAllSharesData(data) {
    allSharesData = Array.isArray(data) ? data : [];
    if (typeof window !== 'undefined') window.allSharesData = allSharesData;
}

export function setLivePrices(data) {
    // Merge incoming live price updates into the existing livePrices map
    // This avoids wiping previously-known prices when the fetch returns a partial set
    // prevHadData needs to be visible to the diagnostics block below, so
    // declare it in this outer scope and set it inside the merge try.
    let prevHadData = false;
    try {
        const incomingIsObject = data && typeof data === 'object';
        const incomingKeys = incomingIsObject ? Object.keys(data) : [];
        prevHadData = livePrices && Object.keys(livePrices).length > 0;

        if (!incomingIsObject || incomingKeys.length === 0) {
            // Nothing useful returned — do not wipe existing livePrices (prevents transient Loading... states)
            if (typeof window !== 'undefined') window.livePrices = livePrices;
        } else {
            // Merge so we preserve older entries that weren't part of this fetch
            livePrices = Object.assign({}, (livePrices || {}), data);
            if (typeof window !== 'undefined') window.livePrices = livePrices;
        }
        // Recompute whether we now have any data after merge
        // (keep original prevHadData variable semantics for downstream logic)
    } catch (mergeErr) {
        console.warn('setLivePrices: merge failed, falling back to replace', mergeErr);
        livePrices = data && typeof data === 'object' ? data : {};
        if (typeof window !== 'undefined') window.livePrices = livePrices;
    }

    // Robust re-apply strategy for percentage-based sorts:
    // - Wait for a reasonable fraction of shares to have live prices (coverage threshold)
    // - Retry a few times with increasing delays to handle slow fetches
    // - Once threshold met (or retries exhausted), explicitly call window.sortShares()
    try {
        const nowHasData = livePrices && Object.keys(livePrices).length > 0;
        if (!prevHadData && nowHasData) {
                const sortIsPercentage = typeof currentSortOrder === 'string' && (
                    currentSortOrder.includes('percentage') || currentSortOrder.includes('percentageChange')
                );
                if (!sortIsPercentage) return;

                try { if (typeof window !== 'undefined' && window.__VERBOSE_DIAG) console.log('[DIAG] livePrices first arrival - attempting robust reapply for ->', currentSortOrder); } catch(_) {}

            // Compute coverage helper: fraction of shares in allSharesData that have livePrices entries
            const computeCoverage = () => {
                try {
                    const all = Array.isArray(allSharesData) && allSharesData.length > 0 ? allSharesData.length : 0;
                    if (all === 0) return 0;
                    let have = 0;
                    for (let i = 0; i < allSharesData.length; i++) {
                        const s = allSharesData[i];
                        const code = (s && s.shareName) ? String(s.shareName).trim().toUpperCase() : '';
                        if (code && livePrices && typeof livePrices === 'object' && livePrices[code] && (livePrices[code].live !== undefined || livePrices[code].lastLivePrice !== undefined)) have++;
                    }
                    return have / all;
                } catch (_) { return 0; }
            };

            const COVERAGE_THRESHOLD = 0.60; // require 60% coverage before treating data as representative
            const attempts = [60, 160, 360, 760]; // ms delays

            const tryApply = (idx) => {
                try {
                    const cov = computeCoverage();
                    try { if (typeof window !== 'undefined' && window.__VERBOSE_DIAG) console.log('[DIAG] livePrices coverage check:', cov, 'attempt:', idx + 1); } catch(_) {}
                    const enough = cov >= COVERAGE_THRESHOLD || idx >= attempts.length - 1;
                    if (enough) {
                        // If we have an authoritative sort lock, prefer calling sortShares directly to avoid being ignored
                        try {
                            if (typeof window !== 'undefined' && typeof window.sortShares === 'function') {
                                if (typeof window !== 'undefined' && window.__VERBOSE_DIAG) console.log('[DIAG] livePrices reapply: invoking sortShares() (coverage:', cov, ')');
                                try { window.sortShares(); } catch (sErr) { console.warn('livePrices reapply: sortShares failed', sErr); }
                            } else {
                                // Fallback: setCurrentSortOrder to trigger existing pathways
                                try { setCurrentSortOrder(currentSortOrder); } catch (e) { console.warn('Failed to reapply sort on livePrices arrival', e); }
                            }
                        } catch (callErr) { if (typeof window !== 'undefined' && window.__VERBOSE_DIAG) console.warn('livePrices reapply: unexpected error', callErr); }
                    } else {
                        // Retry after delay
                        setTimeout(() => tryApply(idx + 1), attempts[idx]);
                    }
                } catch (err) {
                    // On any error, perform a best-effort single reapply
                    try { if (typeof window !== 'undefined' && window.__VERBOSE_DIAG) console.warn('livePrices reapply: coverage check failed, performing best-effort reapply', err); if (typeof window !== 'undefined' && typeof window.sortShares === 'function') window.sortShares(); else setCurrentSortOrder(currentSortOrder); } catch (_) {}
                }
            };

            // Start attempts
            tryApply(0);
        }
    } catch (outerErr) { console.warn('setLivePrices: diagnostics failure', outerErr); }
}

export function setUserWatchlists(data) {
    userWatchlists = Array.isArray(data) ? data : [];
    if (typeof window !== 'undefined') window.userWatchlists = userWatchlists;
}

export function setUserCashCategories(data) {
    userCashCategories = Array.isArray(data) ? data : [];
    if (typeof window !== 'undefined') window.userCashCategories = userCashCategories;
}

export function setCurrentSelectedWatchlistIds(ids) {
    currentSelectedWatchlistIds = Array.isArray(ids) ? ids : [];
    if (typeof window !== 'undefined') window.currentSelectedWatchlistIds = currentSelectedWatchlistIds;
}

export function setSharesAtTargetPrice(items) {
    sharesAtTargetPrice = Array.isArray(items) ? items : [];
    if (typeof window !== 'undefined') window.sharesAtTargetPrice = sharesAtTargetPrice;
}

export function setCurrentSortOrder(value) {
    // Normalize and set
    const normalized = (typeof value === 'string' && value) ? value : 'entryDate-desc';

    // If an initial authoritative sort lock is active, ignore incoming
    // calls that try to change the sort away from the authoritative value
    // unless they are user-initiated. This prevents race conditions during
    // startup where different modules briefly stomp the saved sort.
    try {
        if (typeof window !== 'undefined' && window.__initialSortLocked) {
            const authoritative = window.__initialAuthoritativeSort;
            const userInitiated = !!window.__userInitiatedSortChange;
            if (authoritative && normalized !== authoritative && !userInitiated) {
                // Record the attempted overwrite for diagnostics and ignore it
                try {
                    if (window.__LOG_SORT_SET_CALLS) {
                        if (!Array.isArray(window.__sortSetTrace)) window.__sortSetTrace = [];
                        window.__sortSetTrace.push({ ts: Date.now(), sort: normalized, ignored: true, note: 'initial-lock' });
                    }
                } catch (_) {}
                console.log('[DIAG] Ignored setCurrentSortOrder ->', normalized, 'because initial authoritative sort is locked ->', authoritative);
                return;
            }
        }
    } catch (_) {}

    currentSortOrder = normalized;
    if (typeof window !== 'undefined') window.currentSortOrder = currentSortOrder;

    // Temporary diagnostic hook: when enabled, log every call and a short stack to trace unexpected overwrites
    try {
        if (typeof window !== 'undefined' && window.__VERBOSE_DIAG) {
            try {
                // Lightweight stack capture without throwing an error
                const stack = (new Error()).stack || '';
                const shortStack = stack.split('\n').slice(2, 7).join('\n');
                // Only create the global trace array when verbose diagnostics are enabled
                try {
                    if (!Array.isArray(window.__sortSetTrace)) window.__sortSetTrace = [];
                    window.__sortSetTrace.push({ ts: Date.now(), sort: currentSortOrder, stack: shortStack });
                } catch (_) {}
                console.log('[DIAG] setCurrentSortOrder called ->', currentSortOrder, '\nStack (top frames):\n' + shortStack);
            } catch (sErr) {
                try { if (!Array.isArray(window.__sortSetTrace)) window.__sortSetTrace = []; window.__sortSetTrace.push({ ts: Date.now(), sort: currentSortOrder }); } catch(_) {}
                console.log('[DIAG] setCurrentSortOrder called ->', currentSortOrder);
            }
        }
    } catch(_) {}
}

// Expose simple helpers to access trace data from the Console for diagnostics
if (typeof window !== 'undefined') {
    try {
        // Safe helpers: return empty arrays if diagnostics were never enabled
        window.getSortSetTrace = function() { return Array.isArray(window.__sortSetTrace) ? window.__sortSetTrace.slice() : []; };
        window.clearSortSetTrace = function() { if (Array.isArray(window.__sortSetTrace)) { window.__sortSetTrace.length = 0; } };
        // Ensure a simple toggle exists for verbose diagnostics without changing other flags
        if (typeof window.__VERBOSE_DIAG === 'undefined') window.__VERBOSE_DIAG = false;
    } catch(_) {}
}

export function setAllAsxCodes(codes) {
    allAsxCodes = Array.isArray(codes) ? codes : [];
    if (typeof window !== 'undefined') window.allAsxCodes = allAsxCodes;
}

export function setWatchlistSortOrders(orders) {
    watchlistSortOrders = (orders && typeof orders === 'object') ? orders : {};
    if (typeof window !== 'undefined') window.watchlistSortOrders = watchlistSortOrders;
}

// Set a single watchlist's sort order in-memory
export function setWatchlistSortOrder(watchlistId, sortOrder) {
    try {
        if (!watchlistId) return;
        watchlistSortOrders = watchlistSortOrders || {};
        watchlistSortOrders[watchlistId] = sortOrder;
        if (typeof window !== 'undefined') window.watchlistSortOrders = watchlistSortOrders;
    } catch(_) {}
}

// Getters
export function getAllSharesData() { return allSharesData; }
export function getLivePrices() { return livePrices; }
export function getUserWatchlists() { return userWatchlists; }
export function getUserCashCategories() { return userCashCategories; }
export function getCurrentSelectedWatchlistIds() { return currentSelectedWatchlistIds; }
export function getSharesAtTargetPrice() { return sharesAtTargetPrice; }
export function getCurrentSortOrder() { return currentSortOrder; }
export function getAllAsxCodes() { return allAsxCodes; }
export function getWatchlistSortOrders() { return watchlistSortOrders; }

// View mode state management
export function setCurrentMobileViewMode(mode) {
    currentMobileViewMode = mode && (mode === 'compact' || mode === 'default') ? mode : 'default';
    if (typeof window !== 'undefined') window.currentMobileViewMode = currentMobileViewMode;
}

export function getCurrentMobileViewMode() {
    return currentMobileViewMode;
}

