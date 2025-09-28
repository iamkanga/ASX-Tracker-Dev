import { getAllSharesData, setAllSharesData, setSharesAtTargetPrice, setUserWatchlists, setCurrentSelectedWatchlistIds, setCurrentSortOrder, setAllAsxCodes, setLivePrices, setSharesAtTargetPrice as setSATP, setAllSharesData as setShares, setUserCashCategories, setWatchlistSortOrders, getWatchlistSortOrders } from './state.js';
import { db, firestore, currentAppId } from '../firebase.js';

// These functions rely on globals provided by script.js and firebase.js wiring:
// db, firestore, currentAppId, currentUserId, logDebug, renderWatchlist, hideSplashScreen,
// hideSplashScreenIfReady, showCustomAlert, loadingIndicator, userCashCategories,
// renderCashCategories, calculateTotalCash, sortShares, forceApplyCurrentSort,
// renderAsxCodeButtons, livePrices, sharesAtTargetPriceMuted, alertsEnabledMap,
// recomputeTriggeredAlerts, targetHitDetailsModal, hideModal, updateTargetHitBanner

export async function loadTriggeredAlertsListener(dbArg, firestoreArg, currentUserId, currentAppIdArg) {
    const dbLocal = dbArg || db;
    const fsLocal = firestoreArg || firestore;
    const appIdLocal = currentAppIdArg || currentAppId;
    if (window.unsubscribeAlerts) { try { window.unsubscribeAlerts(); } catch(_){} window.unsubscribeAlerts = null; }
    if (!dbLocal || !currentUserId || !fsLocal) { console.warn('Alerts: Firestore unavailable for triggered alerts listener'); return; }
    try {
        const alertsCol = fsLocal.collection(dbLocal, 'artifacts/' + appIdLocal + '/users/' + currentUserId + '/alerts');
        window.unsubscribeAlerts = fsLocal.onSnapshot(alertsCol, (qs) => { 
            const newMap = new Map();
            const alertMetaById = new Map();
            qs.forEach(doc => { 
                const d = doc.data() || {}; 
                newMap.set(doc.id, (d.enabled !== false)); 
                alertMetaById.set(doc.id, { intent: d.intent, direction: d.direction });
            });
            window.alertsEnabledMap = newMap;
            try {
                (allSharesData||[]).forEach(s => {
                    const meta = alertMetaById.get(s.id);
                    if (meta) {
                        if (!s.intent && meta.intent) s.intent = meta.intent;
                        if (!s.targetDirection && meta.direction) s.targetDirection = meta.direction;
                    }
                });
            } catch(_) {}
            try { console.log('[Diag][loadTriggeredAlertsListener] map size:', window.alertsEnabledMap.size); } catch(_){ }
            try { window.recomputeTriggeredAlerts && window.recomputeTriggeredAlerts(); } catch(_) {}
            try { window.renderWatchlist && window.renderWatchlist(); } catch(_) {}
        }, err => console.error('Alerts: triggered alerts listener error', err));
        window.logDebug && window.logDebug('Alerts: Triggered alerts listener active (enabled-state driven).');
    } catch (e) { console.error('Alerts: failed to init triggered alerts listener', e); }
}

export async function loadShares(dbArg, firestoreArg, currentUserId, currentAppIdArg) {
    const dbLocal = dbArg || db;
    const fsLocal = firestoreArg || firestore;
    const appIdLocal = currentAppIdArg || currentAppId;
    if (window.unsubscribeShares) {
        window.unsubscribeShares();
        window.unsubscribeShares = null;
        window.logDebug && window.logDebug('Firestore Listener: Unsubscribed from previous shares listener.');
    }

    if (!dbLocal || !currentUserId || !fsLocal) {
        console.warn('Shares: Firestore DB, User ID, or Firestore functions not available for loading shares. Clearing list.');
        setAllSharesData([]);
        window._appDataLoaded = false;
        try { window.hideSplashScreen && window.hideSplashScreen(); } catch(_) {}
        return;
    }
    try {
        const sharesCol = fsLocal.collection(dbLocal, 'artifacts/' + appIdLocal + '/users/' + currentUserId + '/shares');
        let q = fsLocal.query(sharesCol);

        // Wait briefly for the app to restore saved user settings (notably sort order)
        try {
            if (window.__userSortReady && typeof window.__userSortReady.then === 'function') {
                // Race: wait up to 1000ms for the sort to be applied, then continue
                console.log('[dataService] Waiting for __userSortReady before attaching shares listener...');
                await Promise.race([
                    window.__userSortReady,
                    new Promise(res => setTimeout(res, 1000))
                ]);
                window.logDebug && window.logDebug('dataService: Waited for __userSortReady before attaching shares listener');
                try { console.log('[dataService] After wait, currentSortOrder=', (typeof getCurrentSortOrder === 'function') ? getCurrentSortOrder() : window.currentSortOrder); } catch(_) {}
            }
        } catch(_) {}

        window.unsubscribeShares = fsLocal.onSnapshot(q, async (querySnapshot) => {
            window.logDebug && window.logDebug('Firestore Listener: Shares snapshot received. Processing changes.');
            try { console.log('[SHARES SNAPSHOT] snapshot handler start. currentSortOrder=', (typeof getCurrentSortOrder === 'function') ? getCurrentSortOrder() : window.currentSortOrder); } catch(_) {}
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            // Initialize the hide-from-totals set from persisted share docs.
            try {
                const hiddenIds = (Array.isArray(fetchedShares) ? fetchedShares.filter(s => s && s.isHiddenInPortfolio).map(s => s.id) : []);
                // Prefer to call the module-level API so the local Set instance is updated in script.js
                if (typeof window.applyHiddenFromTotalsIds === 'function') {
                    try { window.applyHiddenFromTotalsIds(hiddenIds); } catch(_) { }
                } else {
                    // Fallback: set on window and persist locally
                    try { window.hiddenFromTotalsShareIds = new Set(hiddenIds || []); } catch(_) {}
                    try { localStorage.setItem('hiddenFromTotalsShareIds', JSON.stringify(Array.from(window.hiddenFromTotalsShareIds || []))); } catch(_) {}
                }
            } catch (e) {
                console.warn('Failed to initialize hiddenFromTotalsShareIds from Firestore', e);
            }

            setAllSharesData((Array.isArray(fetchedShares) ? fetchedShares : []).filter(Boolean));
            window.logDebug && window.logDebug('Shares: Shares data updated from snapshot. Total shares: ' + (Array.isArray(allSharesData)? allSharesData.length : 0));

            // If a save just happened we may be suppressing reopen of the share form.
            // Defer potentially modal-triggering UI updates until suppression clears to avoid
            // snapshot-driven reopen/selection races. We still update state immediately above.
            const runUiUpdates = () => {
                try { window.renderWatchlist && window.renderWatchlist(); } catch(_) {}
                try { window.forceApplyCurrentSort && window.forceApplyCurrentSort(); } catch(_) {}
                try { window.sortShares && window.sortShares(); } catch(_) {}
                try { window.renderAsxCodeButtons && window.renderAsxCodeButtons(); } catch(_) {}
            };

            if (window.suppressShareFormReopen) {
                // Poll for suppression to clear (short lived). If it doesn't clear within
                // a reasonable window, run updates anyway to avoid stalling the UI.
                const maxAttempts = 40; // 40 * 250ms = 10s max
                let attempts = 0;
                const waiter = setInterval(() => {
                    attempts++;
                    if (!window.suppressShareFormReopen || attempts >= maxAttempts) {
                        try { runUiUpdates(); } catch(_) {}
                        try { clearInterval(waiter); } catch(_) {}
                    }
                }, 250);
            } else {
                try { window.renderWatchlist && window.renderWatchlist(); } catch(_) {}
            }

            try {
                if (Array.isArray(allSharesData) && window.alertsEnabledMap && typeof window.alertsEnabledMap === 'object') {
                    allSharesData.forEach(s => {
                        if (s && (s.intent === undefined || s.intent === null || s.intent === '')) {
                            const alertMatch = ((window.sharesAtTargetPrice||[])).concat(window.sharesAtTargetPriceMuted||[]).find(a=>a && a.id===s.id);
                            if (alertMatch && alertMatch.intent) s.intent = alertMatch.intent;
                        }
                    });
                }
            } catch(e){ console.warn('Intent backfill failed', e); }

            try { window.forceApplyCurrentSort && window.forceApplyCurrentSort(); } catch(_) {}
            try { window.sortShares && window.sortShares(); } catch(_) {}

            // Ensure the authoritative saved sort is applied after the first data snapshot
            // Some environments may restore persisted sort order slightly after initial
            // bootstrap; defer a guarded, one-shot re-apply to guarantee the UI reflects
            // the saved sort when data has finished arriving. Use a small timeout so
            // we do not re-enter the current synchronous render stack and avoid recursion.
            try {
                if (!window.__firstSharesSnapshotSortApplied) {
                    window.__firstSharesSnapshotSortApplied = true;
                    setTimeout(() => {
                        try {
                            window.logDebug && window.logDebug('[dataService] One-shot deferred sort re-apply running');
                            if (typeof window.sortShares === 'function') {
                                window.sortShares();
                            }
                        } catch (e) { console.warn('[dataService] Deferred sort re-apply failed', e); }
                    }, 40);
                }
            } catch (e) { /* noop */ }
            try { window.renderAsxCodeButtons && window.renderAsxCodeButtons(); } catch(_) {}

            if (window.loadingIndicator) window.loadingIndicator.style.display = 'none';
            window._appDataLoaded = true;
            try { window.hideSplashScreenIfReady && window.hideSplashScreenIfReady(); } catch(_) {}

        }, (error) => {
            console.error('Firestore Listener: Error listening to shares:', error);
            try { window.showCustomAlert && window.showCustomAlert('Error loading shares in real-time: ' + error.message); } catch(_) {}
            if (window.loadingIndicator) window.loadingIndicator.style.display = 'none';
            window._appDataLoaded = false;
            try { window.hideSplashScreen && window.hideSplashScreen(); } catch(_) {}
        });

    } catch (error) {
        console.error('Shares: Error setting up shares listener:', error);
        try { window.showCustomAlert && window.showCustomAlert('Error setting up real-time share updates: ' + error.message); } catch(_) {}
        if (window.loadingIndicator) window.loadingIndicator.style.display = 'none';
        window._appDataLoaded = false;
        try { window.hideSplashScreen && window.hideSplashScreen(); } catch(_) {}
    }
}

export async function loadCashCategories(dbArg, firestoreArg, currentUserId, currentAppIdArg) {
    const dbLocal = dbArg || db;
    const fsLocal = firestoreArg || firestore;
    const appIdLocal = currentAppIdArg || currentAppId;
    if (window.unsubscribeCashCategories) {
        window.unsubscribeCashCategories();
        window.unsubscribeCashCategories = null;
        window.logDebug && window.logDebug('Firestore Listener: Unsubscribed from previous cash categories listener.');
    }

    if (!dbLocal || !currentUserId || !fsLocal) {
        console.warn('Cash Categories: Firestore DB, User ID, or Firestore functions not available for loading cash categories. Clearing list.');
        window.userCashCategories = [];
        try { window.renderCashCategories && window.renderCashCategories(); } catch(_) {}
        return;
    }

    try {
        const cashCategoriesCol = fsLocal.collection(dbLocal, 'artifacts/' + appIdLocal + '/users/' + currentUserId + '/cashCategories');
        const q = fsLocal.query(cashCategoriesCol);

        window.unsubscribeCashCategories = fsLocal.onSnapshot(q, (querySnapshot) => {
            window.logDebug && window.logDebug('Firestore Listener: Cash categories snapshot received. Processing changes.');
            let fetchedCategories = [];
            querySnapshot.forEach((doc) => {
                const category = { id: doc.id, ...doc.data() };
                fetchedCategories.push(category);
            });

            window.userCashCategories = fetchedCategories;
            try { setUserCashCategories(fetchedCategories); } catch(_) {}
            window.logDebug && window.logDebug('Cash Categories: Data updated from snapshot. Total categories: ' + (Array.isArray(window.userCashCategories)? window.userCashCategories.length : 0));
            try { window.renderWatchlist && window.renderWatchlist(); } catch(_) {}
            try { window.calculateTotalCash && window.calculateTotalCash(); } catch(_) {}
            try { console.log('[Diag][Cash] render invoked. Categories:', JSON.stringify(window.userCashCategories)); } catch(_) {}

        }, (error) => {
            console.error('Firestore Listener: Error listening to cash categories:', error);
            try { window.showCustomAlert && window.showCustomAlert('Error loading cash categories in real-time: ' + error.message); } catch(_) {}
        });

    } catch (error) {
        console.error('Cash Categories: Error setting up cash categories listener:', error);
        try { window.showCustomAlert && window.showCustomAlert('Error setting up real-time cash category updates: ' + error.message); } catch(_) {}
    }
}

// Persistence service for user preferences
export async function saveWatchlistSortOrder(dbArg, firestoreArg, currentUserId, currentAppIdArg, watchlistId, sortOrder) {
    const dbLocal = dbArg || db;
    const fsLocal = firestoreArg || firestore;
    const appIdLocal = currentAppIdArg || currentAppId;

    if (!dbLocal || !currentUserId || !fsLocal || !watchlistId) {
        console.warn('Sort Persistence: Missing required parameters for saving watchlist sort order');
        return;
    }

    try {
        const sortPrefsRef = fsLocal.doc(dbLocal, 'artifacts/' + appIdLocal + '/users/' + currentUserId + '/preferences/sortOrders');
        const updateData = {};
        updateData[watchlistId] = sortOrder;

        await fsLocal.setDoc(sortPrefsRef, updateData, { merge: true });
        console.log('[Sort Persistence] Saved sort order for watchlist', watchlistId + ':', sortOrder);
    } catch (error) {
        console.error('[Sort Persistence] Error saving watchlist sort order:', error);
    }
}

export async function loadWatchlistSortOrders(dbArg, firestoreArg, currentUserId, currentAppIdArg) {
    const dbLocal = dbArg || db;
    const fsLocal = firestoreArg || firestore;
    const appIdLocal = currentAppIdArg || currentAppId;

    if (!dbLocal || !currentUserId || !fsLocal) {
        console.warn('Sort Persistence: Missing required parameters for loading watchlist sort orders');
        return {};
    }

    try {
        const sortPrefsRef = fsLocal.doc(dbLocal, 'artifacts/' + appIdLocal + '/users/' + currentUserId + '/preferences/sortOrders');
        const docSnap = await fsLocal.getDoc(sortPrefsRef);

        if (docSnap.exists()) {
            const sortOrders = docSnap.data();
            console.log('[Sort Persistence] Loaded watchlist sort orders:', sortOrders);
            setWatchlistSortOrders(sortOrders); // Update state
            return sortOrders;
        } else {
            console.log('[Sort Persistence] No saved watchlist sort orders found');
            setWatchlistSortOrders({}); // Reset state
            return {};
        }
    } catch (error) {
        console.error('[Sort Persistence] Error loading watchlist sort orders:', error);
        setWatchlistSortOrders({}); // Reset state on error
        return {};
    }
}

// Helper function to get sort order for a specific watchlist
export function getSortOrderForWatchlist(watchlistId) {
    const sortOrders = getWatchlistSortOrders();
    return sortOrders[watchlistId] || null;
}

// View Mode Persistence Functions
export async function saveViewModePreference(dbArg, firestoreArg, currentUserId, currentAppIdArg, viewMode) {
    const dbLocal = dbArg || db;
    const fsLocal = firestoreArg || firestore;
    const appIdLocal = currentAppIdArg || currentAppId;

    if (!dbLocal || !currentUserId || !fsLocal) {
        console.warn('[View Mode Persistence] Firestore unavailable for saving view mode');
        return false;
    }

    try {
        const userPrefsRef = fsLocal.doc(dbLocal, 'artifacts/' + appIdLocal + '/users/' + currentUserId + '/preferences/viewMode');
        await fsLocal.setDoc(userPrefsRef, {
            mode: viewMode,
            lastUpdated: fsLocal.serverTimestamp()
        });

        return true;
    } catch (error) {
        console.error('[View Mode Persistence] Error saving view mode preference:', error);
        return false;
    }
}

export async function loadViewModePreference(dbArg, firestoreArg, currentUserId, currentAppIdArg) {
    const dbLocal = dbArg || db;
    const fsLocal = firestoreArg || firestore;
    const appIdLocal = currentAppIdArg || currentAppId;

    if (!dbLocal || !currentUserId || !fsLocal) {
        console.warn('[View Mode Persistence] Firestore unavailable for loading view mode');
        return null;
    }

    try {
        const userPrefsRef = fsLocal.doc(dbLocal, 'artifacts/' + appIdLocal + '/users/' + currentUserId + '/preferences/viewMode');
        const docSnap = await fsLocal.getDoc(userPrefsRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const mode = data?.mode;
            if (mode === 'compact' || mode === 'default') {
                return mode;
            }
        }

        return null;
    } catch (error) {
        console.error('[View Mode Persistence] Error loading view mode preference:', error);
        return null;
    }
}


