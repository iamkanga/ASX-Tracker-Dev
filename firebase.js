// This script assumes that the Firebase SDKs are imported in index.html and attached to the window object.
// e.g., window.firebase.app, window.firestore, window.authFunctions

let db;
let auth;
let currentUserId = null;
let currentAppId;
let isSignInInProgress = false;

let app;
let uiCallbacks = {};

// --- Global state variables moved from script.js ---
let allSharesData = [];
let userCashCategories = [];
let livePrices = {};
let globalExternalPriceRows = [];

let unsubscribeShares = null;
let unsubscribeCashCategories = null;
let unsubscribeAlerts = null;
let unsubscribeGlobalSummary = null;

let globalPercentIncrease = null;
let globalDollarIncrease = null;
let globalPercentDecrease = null;
let globalDollarDecrease = null;
let globalMinimumPrice = null;

let globalAlertSummary = null;
let sharesAtTargetPrice = [];
let sharesAtTargetPriceMuted = [];
let alertsEnabledMap = new Map();
let userPreferences = {};

let livePriceFetchInterval = null;
const LIVE_PRICE_FETCH_INTERVAL_MS = 5 * 60 * 1000;

let sharesAt52WeekLow = [];
const triggered52WeekLowSet = new Set();

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwwMEss5DIYblLNbjIbt_TAzWh54AwrfQlVwCrT_P0S9xkAoXhAUEUg7vSEPYUPOZp/exec';

// --- Initialization ---
export function initializeFirebaseAndAuth(firebaseApp, callbacks) {
    app = firebaseApp;
    db = window.firestore.getFirestore(app);
    auth = window.authFunctions.getAuth(app);
    currentAppId = window.getFirebaseAppId();
    uiCallbacks = callbacks;

    window.authFunctions.onAuthStateChanged(auth, onAuthStateChangedObserver);
}

// --- Auth Functions ---
async function signIn() {
    if (isSignInInProgress) {
        console.log("Sign-in already in progress.");
        return;
    }
    isSignInInProgress = true;
    const provider = new window.authFunctions.GoogleAuthProvider();
    try {
        await window.authFunctions.signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error during sign in:", error);
        uiCallbacks.showCustomAlert('Google Sign-In failed: ' + error.message);
    } finally {
        isSignInInProgress = false;
    }
}

function signOut() {
    window.authFunctions.signOut(auth);
}

async function onAuthStateChangedObserver(user) {
    if (user) {
        currentUserId = user.uid;
        uiCallbacks.logDebug('AuthState: User signed in: ' + user.uid);

        // Pass user info to script.js to handle UI changes
        uiCallbacks.updateUIForUser(user);

        // Load data
        await loadUserWatchlistsAndSettings();
        await loadShares();
        await loadCashCategories();
        await loadTriggeredAlertsListener();
        startGlobalSummaryListener();
        await fetchLivePrices({ cacheBust: true });
        startLivePriceUpdates();

    } else {
        currentUserId = null;
        uiCallbacks.logDebug('AuthState: User signed out.');

        // Let script.js handle UI changes for signed-out state
        uiCallbacks.updateUIForSignOut();

        // Unsubscribe from listeners
        if (unsubscribeShares) unsubscribeShares();
        if (unsubscribeCashCategories) unsubscribeCashCategories();
        if (unsubscribeAlerts) unsubscribeAlerts();
        stopGlobalSummaryListener();
        stopLivePriceUpdates();

        // Reset state
        allSharesData = [];
        userCashCategories = [];
        livePrices = {};
    }
}

// --- Data Loading and Persistence ---

async function loadUserWatchlistsAndSettings() {
    // ... implementation from script.js
    // This will call uiCallbacks for UI updates.
    // e.g., uiCallbacks.renderWatchlistSelect(...)
    if (!db || !currentUserId) {
        console.warn('User Settings: Firestore DB or User ID not available for loading settings. Skipping.');
        return;
    }
    let userWatchlists = [];
    const watchlistsColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
    const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');

    try {
        const querySnapshot = await window.firestore.getDocs(window.firestore.query(watchlistsColRef));
        querySnapshot.forEach(doc => { userWatchlists.push({ id: doc.id, name: doc.data().name }); });

        uiCallbacks.updateUserWatchlists(userWatchlists);

        const userProfileSnap = await window.firestore.getDoc(userProfileDocRef);
        if (userProfileSnap.exists()) {
            const settingsData = userProfileSnap.data();
            uiCallbacks.applySettings(settingsData);
        }

        await migrateOldSharesToWatchlist();

    } catch (error) {
        console.error('User Settings: Error loading user watchlists and settings:', error);
        uiCallbacks.showCustomAlert('Error loading user settings: ' + error.message);
    }
}

async function loadShares() {
    if (unsubscribeShares) {
        unsubscribeShares();
        unsubscribeShares = null;
    }

    if (!db || !currentUserId) {
        allSharesData = [];
        return;
    }

    const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
    let q = window.firestore.query(sharesCol);

    unsubscribeShares = window.firestore.onSnapshot(q, (querySnapshot) => {
        let fetchedShares = [];
        querySnapshot.forEach((doc) => {
            fetchedShares.push({ id: doc.id, ...doc.data() });
        });
        allSharesData = dedupeSharesById(fetchedShares);
        uiCallbacks.onSharesUpdated(allSharesData);
    }, (error) => {
        console.error('Firestore Listener: Error listening to shares:', error);
        uiCallbacks.showCustomAlert('Error loading shares in real-time: ' + error.message);
    });
}

async function loadCashCategories() {
    if (unsubscribeCashCategories) {
        unsubscribeCashCategories();
        unsubscribeCashCategories = null;
    }

    if (!db || !currentUserId) {
        userCashCategories = [];
        uiCallbacks.onCashCategoriesUpdated(userCashCategories);
        return;
    }

    const cashCategoriesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
    const q = window.firestore.query(cashCategoriesCol);

    unsubscribeCashCategories = window.firestore.onSnapshot(q, (querySnapshot) => {
        let fetchedCategories = [];
        querySnapshot.forEach((doc) => {
            fetchedCategories.push({ id: doc.id, ...doc.data() });
        });
        userCashCategories = fetchedCategories;
        uiCallbacks.onCashCategoriesUpdated(userCashCategories);
    }, (error) => {
        console.error('Firestore Listener: Error listening to cash categories:', error);
        uiCallbacks.showCustomAlert('Error loading cash categories in real-time: ' + error.message);
    });
}

async function fetchLivePrices(opts = {}) {
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?_ts=${Date.now()}`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        const newLivePrices = {};
        data.forEach(item => {
            const codeRaw = item.ASXCode || item.ASX_Code || item['ASX Code'] || item.Code || item.code;
            if (!codeRaw) return;
            const code = String(codeRaw).toUpperCase().trim();
            if (!code) return;

            const liveParsed = parseFloat(item.LivePrice || item['Live Price'] || item.live || item.price || item.Last || item['Last Price'] || item.LastPrice || item['Last Trade'] || item.LastTrade);
            const prevParsed = parseFloat(item.PrevClose || item['Prev Close'] || item.previous || item.prev || item.prevClose || item['Previous Close'] || item.Close || item['Last Close']);

            if (!isNaN(liveParsed)) {
                newLivePrices[code] = {
                    live: liveParsed,
                    prevClose: isNaN(prevParsed) ? null : prevParsed,
                };
            }
        });
        livePrices = newLivePrices;
        uiCallbacks.onLivePricesUpdated(livePrices);
    } catch (e) {
        console.error('Live Price: Fetch error', e);
    }
}

function startLivePriceUpdates() {
    if (livePriceFetchInterval) clearInterval(livePriceFetchInterval);
    livePriceFetchInterval = setInterval(() => fetchLivePrices({ cacheBust: true }), LIVE_PRICE_FETCH_INTERVAL_MS);
}

function stopLivePriceUpdates() {
    if (livePriceFetchInterval) {
        clearInterval(livePriceFetchInterval);
        livePriceFetchInterval = null;
    }
}

async function saveShareData(shareData, shareId) {
    if (!db || !currentUserId) return;
    const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
    if (shareId) {
        const shareDocRef = window.firestore.doc(sharesCol, shareId);
        await window.firestore.updateDoc(shareDocRef, shareData);
    } else {
        await window.firestore.addDoc(sharesCol, { ...shareData, entryDate: new Date().toISOString() });
    }
}

async function deleteShare(shareId) {
    if (!db || !currentUserId) return;
    const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', shareId);
    await window.firestore.deleteDoc(shareDocRef);
}

async function saveCashAsset(cashAssetData, assetId) {
    if (!db || !currentUserId) return;
    const cashCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
    if (assetId) {
        const assetDocRef = window.firestore.doc(cashCol, assetId);
        await window.firestore.updateDoc(assetDocRef, { ...cashAssetData, lastUpdated: new Date().toISOString() });
    } else {
        await window.firestore.addDoc(cashCol, { ...cashAssetData, lastUpdated: new Date().toISOString() });
    }
}

async function deleteCashCategory(categoryId) {
    if (!db || !currentUserId) return;
    const assetDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', categoryId);
    await window.firestore.deleteDoc(assetDocRef);
}

async function saveWatchlistChanges(newName, watchlistId) {
    if (!db || !currentUserId) return;
    const watchlistsCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
    if (watchlistId) {
        const watchlistDocRef = window.firestore.doc(watchlistsCol, watchlistId);
        await window.firestore.updateDoc(watchlistDocRef, { name: newName });
    } else {
        await window.firestore.addDoc(watchlistsCol, { name: newName, createdAt: new Date().toISOString(), userId: currentUserId });
    }
}

async function deleteWatchlist(watchlistId) {
    if (!db || !currentUserId) return;
    const watchlistDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistId);
    await window.firestore.deleteDoc(watchlistDocRef);
}

async function persistUserPreference(key, value) {
    if (!db || !currentUserId) return;
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    await window.firestore.setDoc(userProfileDocRef, { [key]: value }, { merge: true });
}

async function toggleAlertEnabled(shareId) {
    if (!db || !currentUserId) return;
    const alertDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/alerts', shareId);
    const docSnap = await window.firestore.getDoc(alertDocRef);
    const currentEnabled = docSnap.exists() ? docSnap.data().enabled : true;
    await window.firestore.setDoc(alertDocRef, { enabled: !currentEnabled }, { merge: true });
}

async function loadTriggeredAlertsListener() {
    if (unsubscribeAlerts) unsubscribeAlerts();
    if (!db || !currentUserId) return;
    const alertsCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/alerts');
    unsubscribeAlerts = window.firestore.onSnapshot(alertsCol, (qs) => {
        alertsEnabledMap.clear();
        qs.forEach(doc => {
            alertsEnabledMap.set(doc.id, doc.data().enabled !== false);
        });
        uiCallbacks.recomputeTriggeredAlerts(alertsEnabledMap);
    });
}

function startGlobalSummaryListener() {
    if (unsubscribeGlobalSummary) unsubscribeGlobalSummary();
    if (!db || !currentUserId) return;
    const summaryRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/alerts/GA_SUMMARY`);
    unsubscribeGlobalSummary = window.firestore.onSnapshot(summaryRef, (snap) => {
        globalAlertSummary = snap.exists() ? snap.data() : null;
        uiCallbacks.onGlobalSummaryUpdated(globalAlertSummary);
    });
}

function stopGlobalSummaryListener() {
    if (unsubscribeGlobalSummary) unsubscribeGlobalSummary();
}

async function migrateOldSharesToWatchlist() {
    // Implementation can be simplified or removed if data is considered stable
    return false;
}

function dedupeSharesById(items) {
    const map = new Map();
    for (const it of items || []) {
        if (it && it.id) map.set(it.id, it);
    }
    return Array.from(map.values());
}


export const firebaseApi = {
    signIn,
    signOut,
    saveShareData,
    deleteShare,
    saveCashAsset,
    deleteCashCategory,
    saveWatchlistChanges,
    deleteWatchlist,
    persistUserPreference,
    toggleAlertEnabled,
};
