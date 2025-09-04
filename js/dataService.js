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

        window.unsubscribeShares = fsLocal.onSnapshot(q, async (querySnapshot) => {
            window.logDebug && window.logDebug('Firestore Listener: Shares snapshot received. Processing changes.');
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            setAllSharesData((Array.isArray(fetchedShares) ? fetchedShares : []).filter(Boolean));
            window.logDebug && window.logDebug('Shares: Shares data updated from snapshot. Total shares: ' + (Array.isArray(allSharesData)? allSharesData.length : 0));
            try { window.renderWatchlist && window.renderWatchlist(); } catch(_) {}

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


