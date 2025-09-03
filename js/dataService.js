import { allSharesData, setAllSharesData, setSharesAtTargetPrice } from './state.js';

// These functions rely on globals provided by script.js and firebase.js wiring:
// db, firestore, currentAppId, currentUserId, logDebug, renderWatchlist, hideSplashScreen,
// hideSplashScreenIfReady, showCustomAlert, loadingIndicator, userCashCategories,
// renderCashCategories, calculateTotalCash, sortShares, forceApplyCurrentSort,
// renderAsxCodeButtons, livePrices, sharesAtTargetPriceMuted, alertsEnabledMap,
// recomputeTriggeredAlerts, targetHitDetailsModal, hideModal, updateTargetHitBanner

export async function loadTriggeredAlertsListener(db, firestore, currentUserId, currentAppId) {
    if (window.unsubscribeAlerts) { try { window.unsubscribeAlerts(); } catch(_){} window.unsubscribeAlerts = null; }
    if (!db || !currentUserId || !firestore) { console.warn('Alerts: Firestore unavailable for triggered alerts listener'); return; }
    try {
        const alertsCol = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/alerts');
        window.unsubscribeAlerts = firestore.onSnapshot(alertsCol, (qs) => { 
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

export async function loadShares(db, firestore, currentUserId, currentAppId) {
    if (window.unsubscribeShares) {
        window.unsubscribeShares();
        window.unsubscribeShares = null;
        window.logDebug && window.logDebug('Firestore Listener: Unsubscribed from previous shares listener.');
    }

    if (!db || !currentUserId || !firestore) {
        console.warn('Shares: Firestore DB, User ID, or Firestore functions not available for loading shares. Clearing list.');
        setAllSharesData([]);
        window._appDataLoaded = false;
        try { window.hideSplashScreen && window.hideSplashScreen(); } catch(_) {}
        return;
    }
    try {
        const sharesCol = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
        let q = firestore.query(sharesCol);

        window.unsubscribeShares = firestore.onSnapshot(q, async (querySnapshot) => {
            window.logDebug && window.logDebug('Firestore Listener: Shares snapshot received. Processing changes.');
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            setAllSharesData((Array.isArray(fetchedShares) ? fetchedShares : []).filter(Boolean));
            window.logDebug && window.logDebug('Shares: Shares data updated from snapshot. Total shares: ' + (Array.isArray(allSharesData)? allSharesData.length : 0));

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

export async function loadCashCategories(db, firestore, currentUserId, currentAppId) {
    if (window.unsubscribeCashCategories) {
        window.unsubscribeCashCategories();
        window.unsubscribeCashCategories = null;
        window.logDebug && window.logDebug('Firestore Listener: Unsubscribed from previous cash categories listener.');
    }

    if (!db || !currentUserId || !firestore) {
        console.warn('Cash Categories: Firestore DB, User ID, or Firestore functions not available for loading cash categories. Clearing list.');
        window.userCashCategories = [];
        try { window.renderCashCategories && window.renderCashCategories(); } catch(_) {}
        return;
    }

    try {
        const cashCategoriesCol = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
        const q = firestore.query(cashCategoriesCol);

        window.unsubscribeCashCategories = firestore.onSnapshot(q, (querySnapshot) => {
            window.logDebug && window.logDebug('Firestore Listener: Cash categories snapshot received. Processing changes.');
            let fetchedCategories = [];
            querySnapshot.forEach((doc) => {
                const category = { id: doc.id, ...doc.data() };
                fetchedCategories.push(category);
            });

            window.userCashCategories = fetchedCategories;
            window.logDebug && window.logDebug('Cash Categories: Data updated from snapshot. Total categories: ' + (Array.isArray(window.userCashCategories)? window.userCashCategories.length : 0));
            try { window.renderWatchlist && window.renderWatchlist(); } catch(_) {}
            try { window.calculateTotalCash && window.calculateTotalCash(); } catch(_) {}

        }, (error) => {
            console.error('Firestore Listener: Error listening to cash categories:', error);
            try { window.showCustomAlert && window.showCustomAlert('Error loading cash categories in real-time: ' + error.message); } catch(_) {}
        });

    } catch (error) {
        console.error('Cash Categories: Error setting up cash categories listener:', error);
        try { window.showCustomAlert && window.showCustomAlert('Error setting up real-time cash category updates: ' + error.message); } catch(_) {}
    }
}


