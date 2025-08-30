import { initializeFirebaseAndAuth } from './firebase.js';
import { formatMoney, formatPercent, formatAdaptivePrice, formatAdaptivePercent, formatDate, calculateUnfrankedYield, calculateFrankedYield, isAsxMarketOpen, escapeCsvValue, formatWithCommas } from './utils.js';

// Global function to open the ASX search modal and populate the code
window.showStockSearchModal = function(asxCode) {
    if (!stockSearchModal || !asxSearchInput) return;
    showModal(stockSearchModal);
    try { scrollMainToTop(); } catch(_) {}
    asxSearchInput.value = asxCode || '';
    asxSearchInput.focus();
    if (asxCode && typeof displayStockDetailsInSearchModal === 'function') {
        displayStockDetailsInSearchModal(asxCode);
    }
    // Optionally close sidebar if open
    if (typeof toggleAppSidebar === 'function') toggleAppSidebar(false);
};
// Build Marker: 2025-08-17T00:00Z v2.0.0 (Modal architecture reset: external Global  movers heading, singleton overlay)
// Deploy bump marker: 2025-08-18T12:00Z (no functional change)
// If you do NOT see this line in DevTools Sources, you're viewing a stale cached script.
// Copilot update: 2025-07-29 - change for sync test
// Note: Helpers are defined locally in this file. Import removed to avoid duplicate identifier collisions.
// --- IN-APP BACK BUTTON HANDLING FOR MOBILE PWAs ---
// Push a new state when opening a modal or navigating to a new in-app view
function pushAppState(stateObj = {}, title = '', url = '') {
    history.pushState(stateObj, title, url);
}

// Listen for the back button (popstate event)
window.addEventListener('popstate', function(event) {
    // Let the unified stack-based handler manage modals. Only handle sidebar here.
    if (window.appSidebar && window.appSidebar.classList.contains('open')) {
        if (window.toggleAppSidebar) {
            window.toggleAppSidebar(false); // Explicitly close the sidebar
        }
        return; // Exit after handling the sidebar
    }
    // Defer modal handling to the stack popstate handler below.
});
// Keep main content padding in sync with header height changes (e.g., viewport resize)
window.addEventListener('resize', () => requestAnimationFrame(adjustMainContentPadding));
document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(adjustMainContentPadding));
// Diagnostic: overlay listener singleton self-check
document.addEventListener('DOMContentLoaded', () => {
    try {
        const ov = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
        if (ov) {
            // Attempt to enumerate known listener types by dispatch test events counter (best-effort)
            let fired = 0;
            const testHandler = () => { fired++; };
            ov.addEventListener('mousedown', testHandler, { once: true });
            const evt = new Event('mousedown');
            ov.dispatchEvent(evt);
            // fired should be 1 because our once listener ran; actual sidebar close listener also runs silently
            // Provide console confirmation marker for QA
            console.log('[Diag] Overlay singleton check executed. Build marker present.');
        } else {
            console.warn('[Diag] Overlay element not found during singleton check.');
        }
    } catch(e) { console.warn('[Diag] Overlay singleton check failed', e); }
});

// --- 52-Week Alert Card Dynamic Theming & Mute Button Fix ---
// Helper to apply dynamic theme class to 52-week alert card
function applyLow52AlertTheme(card, type) {
    if (!card) return;
    card.classList.remove('low52-low', 'low52-high');
    if (type === 'low') card.classList.add('low52-low');
    else if (type === 'high') card.classList.add('low52-high');
    // Always ensure .low52-alert-card is present
    card.classList.add('low52-alert-card');
}

// Simplified mute button handler after layout fix
function fixLow52MuteButton(card) {
    if (!card) return;
    const muteBtn = card.querySelector('.low52-mute-btn');
    if (muteBtn) {
        // A simple click listener is now sufficient
        muteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Custom mute logic (toggle hidden/minimized)
            card.classList.add('low52-card-hidden');
            // Optionally: persist mute state if needed
        });
    }
}

// Title mutation observer guard to restore if emptied by outside DOM ops
try {
    (function installTitleGuard(){
        if (window.__titleGuardInstalled) return; window.__titleGuardInstalled = true;
        const host = document.getElementById('dynamicWatchlistTitle'); if(!host) return;
        const obs = new MutationObserver(()=>{
            try {
                const span = document.getElementById('dynamicWatchlistTitleText');
                if (!span) return;
                if (!span.textContent || !span.textContent.trim()) {
                    let wid = currentSelectedWatchlistIds && currentSelectedWatchlistIds[0];
                    let expected;
                    if (wid === '__movers') expected = 'Movers';
                    else if (wid === 'portfolio') expected = 'Portfolio';
                    else if (wid === CASH_BANK_WATCHLIST_ID) expected = 'Cash & Assets';
                    else if (wid === ALL_SHARES_ID) expected = 'All Shares';
                    else {
                        const wl = (userWatchlists||[]).find(w=>w.id===wid);
                        expected = (wl && wl.name) ? wl.name : 'Share Watchlist';
                    }
                    span.textContent = expected;
                    console.warn('[TitleGuard] Restored empty dynamic title to:', expected);
                }
            } catch(_) {}
        });
        obs.observe(host, { childList:true, characterData:true, subtree:true });
    })();
} catch(_) {}

// --- (Aggressive Enforcement Patch Removed) ---
// The previous patch has been removed as the root cause of the UI issues,
// a syntax error in index.html, has been corrected. The standard application
// logic should now function as intended.
// --- END REMOVED PATCH ---


// [Copilot Update] Source control helper
let sourceControlMakeAvailableCount = 0;
function makeFilesAvailableToSourceControl() {
    sourceControlMakeAvailableCount++;
    if (window && window.showCustomAlert) {
        window.showCustomAlert('Files are ready for source control. (Count: ' + sourceControlMakeAvailableCount + ')', 2000);
    } else {
        console.log('Files are ready for source control. (Count: ' + sourceControlMakeAvailableCount + ')');
    }
}
// End Copilot source control helper

// --- 52-Week Low Alert State ---
let sharesAt52WeekLow = [];
const triggered52WeekLowSet = new Set();
// Load muted 52-week alerts from session storage
let __low52MutedMap = {};
try {
    const stored = sessionStorage.getItem('low52MutedMap');
    if (stored) {
        __low52MutedMap = JSON.parse(stored);
    }
} catch (e) {
    __low52MutedMap = {};
}
window.__low52MutedMap = __low52MutedMap;

// Helper: Sort shares by percentage change
function sortSharesByPercentageChange(shares) {
    return shares.slice().sort((a, b) => {
        const liveA = livePrices[a.shareName?.toUpperCase()]?.live;
        const prevA = livePrices[a.shareName?.toUpperCase()]?.prevClose;
        const liveB = livePrices[b.shareName?.toUpperCase()]?.live;
        const prevB = livePrices[b.shareName?.toUpperCase()]?.prevClose;
        const pctA = (prevA && liveA) ? ((liveA - prevA) / prevA) : 0;
        const pctB = (prevB && liveB) ? ((liveB - prevB) / prevB) : 0;
        return pctB - pctA; // Descending
    });
}

// Lean live prices hook: only resort when sort actually depends on live data
function onLivePricesUpdated() {
    try {
        if (currentSortOrder && (currentSortOrder.startsWith('percentageChange') || currentSortOrder.startsWith('dividendAmount'))) {
            sortShares();
        } else {
            renderWatchlist();
        }
        if (typeof renderPortfolioList === 'function') {
            const section = document.getElementById('portfolioSection');
            if (section && section.style.display !== 'none') {
                renderPortfolioList();
            }
        }
    } catch (e) {
        console.error('Live Price: onLivePricesUpdated error:', e);
    }
}

// Compatibility stub (legacy callsites may invoke)
function forceApplyCurrentSort() { /* legacy no-op retained */ }

// On full page load (including reload), ensure main content starts at the top
window.addEventListener('load', () => {
    try { scrollMainToTop(true); } catch(_) {}
});
//  This script interacts with Firebase Firestore for data storage.

// --- GLOBAL VARIABLES ---
let DEBUG_MODE = false; // Quiet by default; enable via window.toggleDebug(true)
window.toggleDebug = (on) => { DEBUG_MODE = !!on; console.log('Debug mode', DEBUG_MODE ? 'ENABLED' : 'DISABLED'); };

// Custom logging function to control verbosity
function logDebug(message, ...optionalParams) {
    if (DEBUG_MODE) {
        // This line MUST call the native console.log, NOT logDebug itself.
        console.log(message, ...optionalParams); 
    }
}
// --- END DEBUG LOGGING SETUP ---

let db;
let auth = null;
let currentUserId = null;
let currentAppId;
let firestore;
let authFunctions;
let selectedShareDocId = null;
let allSharesData = []; // Kept in sync by the onSnapshot listener
// Prevent duplicate sign-in attempts
let authInProgress = false;
// Helper: normalize and check membership for multi-watchlist support with backward compatibility
function shareBelongsTo(share, watchlistId) {
    if (!share) return false;
    if (Array.isArray(share.watchlistIds)) {
        return share.watchlistIds.includes(watchlistId);
    }
    return share.watchlistId === watchlistId;
}

// Helper: ensure we don't render duplicates when transient optimistic updates or race conditions occur
function dedupeSharesById(items) {
    try {
        const map = new Map();
        for (const it of items || []) {
            if (it && it.id) map.set(it.id, it);
        }
        return Array.from(map.values());
    } catch (e) {
        console.warn('Dedupe: Failed to dedupe shares by id:', e);
        return Array.isArray(items) ? items : [];
    }
}
let currentDialogCallback = null;
let autoDismissTimeout = null;
let lastTapTime = 0;
let tapTimeout;
let selectedElementForTap = null;
let longPressTimer;
const LONG_PRESS_THRESHOLD = 500; // Time in ms for long press detection (desktop only; mobile long-press disabled)
let touchStartX = 0;
let touchStartY = 0;
const TOUCH_MOVE_THRESHOLD = 10; // Pixels for touch movement to cancel long press
const KANGA_EMAIL = 'iamkanga@gmail.com';
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = []; // Stores all watchlists for the user
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
// Guard: track if an initial forced movers selection was applied so later routines do not override
let __forcedInitialMovers = false;
let __moversFallbackScheduled = false;

function ensureMoversPlaceholder() {
    try {
        const tbody = document.querySelector('#shareTable tbody');
        if (!tbody) return false;
        if (!tbody.querySelector('tr.__movers-loading')) {
            const tr = document.createElement('tr');
            tr.className='__movers-loading';
            const td = document.createElement('td');
            td.colSpan = 50;
            td.textContent = 'Loading movers…';
            td.style.opacity='0.65';
            td.style.fontStyle='italic';
            td.style.textAlign='center';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        return true;
    } catch(_) { return false; }
}

function scheduleMoversFallback() {
    if (__moversFallbackScheduled) return; __moversFallbackScheduled = true;
    setTimeout(()=>{
        try {
            const wantMovers = localStorage.getItem('lastSelectedView') === '__movers';
            const haveMovers = currentSelectedWatchlistIds && currentSelectedWatchlistIds[0] === '__movers';
            if (wantMovers && !haveMovers) {
                // Fallback to All Shares (user request) while preserving intent logs
                currentSelectedWatchlistIds = [ALL_SHARES_ID];
                if (typeof watchlistSelect !== 'undefined' && watchlistSelect) watchlistSelect.value = ALL_SHARES_ID;
                try { setLastSelectedView(ALL_SHARES_ID); } catch(_) {}
                try { localStorage.setItem('lastWatchlistSelection', JSON.stringify(currentSelectedWatchlistIds)); } catch(_) {}
                if (typeof renderWatchlist === 'function') { try { renderWatchlist(); } catch(_) {} }
                console.warn('[Movers restore][fallback->allShares] Movers failed to attach; defaulted to All Shares.');
                try { scrollMainToTop(); } catch(_) {}
            }
        } catch(e) { console.warn('[Movers fallback] failed', e); }
    }, 2500);
}
// Restore last explicit watchlist (including virtual '__movers') from localStorage before any render logic
try {
    const lsLastWatch = localStorage.getItem('lastWatchlistSelection');
    if (lsLastWatch) {
        const parsed = JSON.parse(lsLastWatch);
        if (Array.isArray(parsed) && parsed.length) {
            currentSelectedWatchlistIds = parsed;
        }
    }
} catch(_) {}
// Initialize dismissal and sort state from localStorage as early as possible to avoid flashes/defaults
try { targetHitIconDismissed = localStorage.getItem('targetHitIconDismissed') === 'true'; } catch(e) {}
// Restore last selected view (persisted)
try {
    const lastView = localStorage.getItem('lastSelectedView');
    if (lastView === '__movers') {
        // Immediate forced selection BEFORE any data. Will re-render later as data arrives.
        currentSelectedWatchlistIds = ['__movers'];
        __forcedInitialMovers = true;
    try { console.log('[Movers init] Forced initial Movers selection before data load'); } catch(_) {}
        // Set select value if present
        if (typeof watchlistSelect !== 'undefined' && watchlistSelect) { watchlistSelect.value = '__movers'; }
    // Insert placeholder (retry a few frames if table not yet present)
    let tries = 0; (function attempt(){ if (ensureMoversPlaceholder()) return; if (++tries < 10) requestAnimationFrame(attempt); })();
        // Schedule an early render/enforce even if data empty; later data loads will call render again.
        setTimeout(()=>{ try { if (typeof renderWatchlist==='function') renderWatchlist(); enforceMoversVirtualView(true); } catch(_) {} }, 50);
        try { updateMainTitle(); } catch(e) {}
        try { ensureTitleStructure(); } catch(e) {}
        try { updateTargetHitBanner(); } catch(e) {}
    // Schedule fallback to All Shares if movers never attaches
    scheduleMoversFallback();
    } else if (lastView === 'portfolio') {
        currentSelectedWatchlistIds = ['portfolio'];
    if (typeof watchlistSelect !== 'undefined' && watchlistSelect) { watchlistSelect.value = 'portfolio'; }
        // Defer actual DOM switch until initial data load completes; hook into data load readiness
        window.addEventListener('load', () => {
            setTimeout(() => { if (typeof showPortfolioView === 'function') showPortfolioView(); }, 300);
        });

    // Keep header and alerts consistent after portfolio render
    try { updateMainTitle(); } catch(e) {}
    try { ensureTitleStructure(); } catch(e) {}
    try { updateTargetHitBanner(); } catch(e) {}
    } else if (lastView && lastView !== 'portfolio') {
        currentSelectedWatchlistIds = [lastView];
        if (typeof watchlistSelect !== 'undefined' && watchlistSelect) { watchlistSelect.value = lastView; }
        try { updateMainTitle(); } catch(e) {}
        try { ensureTitleStructure(); } catch(e) {}
        try { updateTargetHitBanner(); } catch(e) {}
    }
} catch(e) { /* ignore */ }
const ALL_SHARES_ID = 'all_shares_option'; // Special ID for the "Show All Shares" option
const CASH_BANK_WATCHLIST_ID = 'cashBank'; // NEW: Special ID for the "Cash & Assets" option
let currentSortOrder = 'entryDate-desc'; // Default sort order
try { const lsSort = localStorage.getItem('lastSortOrder'); if (lsSort) { currentSortOrder = lsSort; } } catch(e) {}
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu
let originalShareData = null; // Stores the original share data when editing for dirty state check
let originalWatchlistData = null; // Stores original watchlist data for dirty state check in watchlist modals
let currentEditingWatchlistId = null; // NEW: Stores the ID of the watchlist being edited in the modal
// Guard against unintended re-opening of the Share Edit modal shortly after save
let suppressShareFormReopen = false;

// App version (displayed in UI title bar)
// REMINDER: Before each release, update APP_VERSION here, in the splash screen, and any other version displays.
// Release: 2025-08-26 - Portfolio card redesign (updated)
const APP_VERSION = '2.10.30';

// Persisted set of share IDs to hide from totals (Option A)
let hiddenFromTotalsShareIds = new Set();
try {
    const stored = localStorage.getItem('hiddenFromTotalsShareIds');
    if (stored) {
        JSON.parse(stored).forEach(id => hiddenFromTotalsShareIds.add(id));
    }
} catch (e) { /* ignore parse errors */ }

function persistHiddenFromTotals() {
    try { localStorage.setItem('hiddenFromTotalsShareIds', JSON.stringify(Array.from(hiddenFromTotalsShareIds))); } catch(_) {}
}

// Wire splash version display and Force Update helper
document.addEventListener('DOMContentLoaded', function () {
    // Splash version display
    try {
        const splashVerEl = document.getElementById('splashAppVersion');
    if (splashVerEl) splashVerEl.textContent = 'v' + APP_VERSION;
    } catch (e) { /* ignore */ }

    // Force Update button handler - posts SKIP_WAITING to waiting worker or triggers update
    try {
        const forceBtn = document.getElementById('forceUpdateBtn');
        async function requestSWUpdate() {
            if (!('serviceWorker' in navigator)) {
                console.log('[SW] Service Worker not supported in this browser.');
                if (window.showCustomAlert) window.showCustomAlert('Service worker not supported in this browser.', 3000);
                return;
            }
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (!reg) {
                    console.log('[SW] No service worker registration found.');
                    if (window.showCustomAlert) window.showCustomAlert('No service worker registered.', 3000);
                    return;
                }
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    console.log('[SW] Sent SKIP_WAITING to waiting worker.');
                    if (window.showCustomAlert) window.showCustomAlert('Updating app... Reloading when ready.', 2500);
                    return;
                }
                // No waiting worker -> check for update which may install a new worker
                await reg.update();
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    if (window.showCustomAlert) window.showCustomAlert('New update found — activating.', 2500);
                } else {
                    if (window.showCustomAlert) window.showCustomAlert('No update available.', 2000);
                }
            } catch (err) {
                console.error('[SW] Force update failed', err);
                if (window.showCustomAlert) window.showCustomAlert('Update request failed.', 3000);
            }
        }

        if (forceBtn) {
            forceBtn.addEventListener('click', function () { requestSWUpdate(); }, { passive: true });
        }
        // Expose helper for console debugging
        window.requestServiceWorkerUpdate = requestSWUpdate;
    } catch (e) { /* ignore */ }
});

// Service Worker / Version diagnostics helper
async function getAppVersionReport() {
    const report = { APP_VERSION };
    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            report.registration = !!reg;
            if (reg) {
                report.scope = reg.scope || null;
                report.activeScript = reg.active && reg.active.scriptURL ? reg.active.scriptURL : null;
                report.waitingScript = reg.waiting && reg.waiting.scriptURL ? reg.waiting.scriptURL : null;
                report.installingScript = reg.installing && reg.installing.scriptURL ? reg.installing.scriptURL : null;
            }
            if (navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL) {
                report.controllerScript = navigator.serviceWorker.controller.scriptURL;
            }
        }
    } catch (e) {
        report.swError = String(e);
    }
    // Inspect cache names for APP_VERSION token
    try {
        if (window.caches && typeof caches.keys === 'function') {
            const keys = await caches.keys();
            report.caches = keys;
            // Find caches that contain the APP_VERSION token (loose match)
            report.versionedCaches = keys.filter(k => k && k.indexOf(String(APP_VERSION)) !== -1);
        }
    } catch (e) {
        report.cacheError = String(e);
    }
    return report;
}

// Update splash element title with SW diagnostic info for quick visibility
(async function annotateSplashWithSW(){
    try {
        const el = document.getElementById('splashAppVersion');
        if (!el) return;
        const rep = await getAppVersionReport();
        const parts = [];
        if (rep.controllerScript) parts.push('controller:' + rep.controllerScript.split('/').pop());
        if (rep.activeScript) parts.push('active:' + rep.activeScript.split('/').pop());
        if (Array.isArray(rep.versionedCaches) && rep.versionedCaches.length) parts.push('cache:' + rep.versionedCaches.join(','));
        if (parts.length) el.title = parts.join(' | ');
    } catch(_) {}
})();

// Expose reporter to console for manual inspection
window.getAppVersionReport = getAppVersionReport;

// Remember prior movers selection across auth resets: stash in sessionStorage before clearing localStorage (if any external code clears it)
try {
    if (localStorage.getItem('lastSelectedView') === '__movers') {
        sessionStorage.setItem('preResetLastSelectedView','__movers');
    }
} catch(_) {}
if (targetHitIconBtn) {
    targetHitIconBtn.addEventListener('click', () => {
        logDebug('Target Alert: Icon button clicked. Opening details modal.');
        showTargetHitDetailsModal();
    });
}
let firebaseServices;
document.addEventListener('DOMContentLoaded', () => {
    firebaseServices = initializeFirebaseAndAuth();
    db = firebaseServices.db;
    auth = firebaseServices.auth;
    currentAppId = firebaseServices.currentAppId;
    firestore = firebaseServices.firestore;
    authFunctions = firebaseServices.authFunctions;
    window._firebaseInitialized = firebaseServices.firebaseInitialized;

    if (window._firebaseInitialized) {
        initializeAppLogic();
    } else {
        console.error('Firebase initialization failed. App logic will not run.');
        const errorDiv = document.getElementById('firebaseInitError');
        if (errorDiv) {
            errorDiv.style.display = 'block';
        }
    }
});
