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
// ...existing code...
// --- (Aggressive Enforcement Patch Removed) ---
// The previous patch has been removed as the root cause of the UI issues,
// a syntax error in index.html, has been corrected. The standard application
// logic should now function as intended.
// --- END REMOVED PATCH ---


// [Copilot Update] Source control helper
// This function is a placeholder for automating source control actions (e.g., git add/commit)
// and for tracking how many times files have been made available to source control.
// Usage: Call makeFilesAvailableToSourceControl() after major changes if you want to automate this.
let sourceControlMakeAvailableCount = 0;
function makeFilesAvailableToSourceControl() {
    // This is a placeholder for future automation (e.g., via backend or extension)
    // Instructs the user to use git or triggers a VS Code command if available
    sourceControlMakeAvailableCount++;
    if (window && window.showCustomAlert) {
        window.showCustomAlert('Files are ready for source control. (Count: ' + sourceControlMakeAvailableCount + ')', 2000);
    } else {
        console.log('Files are ready for source control. (Count: ' + sourceControlMakeAvailableCount + ')');
    }
    // To actually add to git, run: git init; git add .; git commit -m "Initial commit"
}
// End Copilot source control helper

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
document.addEventListener('DOMContentLoaded', function () {
    // --- Watchlist logic moved to watchlist.js ---
    // Import and call watchlist functions
    if (window.watchlistModule) {
        window.watchlistModule.renderWatchlistSelect();
    // If we have a persisted lastKnownTargetCount, ensure the notification icon restores pre-live-load
    try { if (typeof updateTargetHitBanner === 'function') updateTargetHitBanner(); } catch(e) { console.warn('Early Target Alert restore failed', e); }
        window.watchlistModule.populateShareWatchlistSelect();
        window.watchlistModule.ensurePortfolioOptionPresent();
        setTimeout(window.watchlistModule.ensurePortfolioOptionPresent, 2000);
    }
    // Automatic closed-market banner and ghosting
    const marketStatusBanner = document.getElementById('marketStatusBanner');
    function formatSydneyDate(d) {
        return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    }
    function isAfterCloseUntilMidnightSydney() {
        const now = new Date();
        const opts = { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'Australia/Sydney' };
        const timeStr = new Intl.DateTimeFormat('en-AU', opts).format(now);
        const [h, m] = timeStr.split(':').map(Number);
        return (h > 16) || (h === 16 && m >= 0);
    }
    function updateMarketStatusUI() {
    const open = isAsxMarketOpen();
        if (marketStatusBanner) {
            if (!open) {
                const now = new Date();
                // Snapshot is the last fetched live as at close; show date to avoid weekend ambiguity
                marketStatusBanner.textContent = `ASX market is closed. Showing final prices from today. (${formatSydneyDate(now)})`;
                marketStatusBanner.classList.remove('app-hidden');
            } else {
                marketStatusBanner.textContent = '';
                marketStatusBanner.classList.add('app-hidden');
            }
        }
    // No global disabling; controls remain enabled regardless of market state
    }
    // Initial status and periodic re-check each minute
    updateMarketStatusUI();
    setInterval(updateMarketStatusUI, 60 * 1000);

    // Ensure Edit Current Watchlist button updates when selection changes
    if (typeof watchlistSelect !== 'undefined' && watchlistSelect) {
        watchlistSelect.addEventListener('change', function () {
            // If Portfolio is selected, show portfolio view
            if (watchlistSelect.value === 'portfolio') {
                showPortfolioView();
                try { localStorage.setItem('lastSelectedView','portfolio'); } catch(e){}
            } else {
                // Default: show normal watchlist view
                showWatchlistView();
                try { localStorage.setItem('lastSelectedView', watchlistSelect.value); } catch(e){}
            }
            updateMainButtonsState(true);
        });
    }

    // Portfolio view logic
    window.showPortfolioView = function() {
        // Hide normal stock watchlist section, show a dedicated portfolio section (create if needed)
        if (!document.getElementById('portfolioSection')) {
            const portfolioSection = document.createElement('div');
            portfolioSection.id = 'portfolioSection';
            portfolioSection.className = 'portfolio-section';
            portfolioSection.innerHTML = '<h2>Portfolio</h2><div class="portfolio-scroll-wrapper"><div id="portfolioListContainer">Loading portfolio...</div></div>';
            mainContainer.appendChild(portfolioSection);
        }
        stockWatchlistSection.style.display = 'none';
        // Ensure selection state reflects Portfolio for downstream filters (e.g., ASX buttons)
        currentSelectedWatchlistIds = ['portfolio'];
        // Reflect in dropdown if present
        if (typeof watchlistSelect !== 'undefined' && watchlistSelect) {
            if (watchlistSelect.value !== 'portfolio') {
                watchlistSelect.value = 'portfolio';
            }
        }
    // Persist user intent
        try { localStorage.setItem('lastSelectedView','portfolio'); } catch(e) {}
        let portfolioSection = document.getElementById('portfolioSection');
        portfolioSection.style.display = 'block';
    renderPortfolioList();
    // Keep header text in sync
    try { updateMainTitle(); } catch(e) {}
    // Ensure sort options and alerts are correct for Portfolio view
    try { renderSortSelect(); } catch(e) {}
    try { updateTargetHitBanner(); } catch(e) {}
        if (typeof renderAsxCodeButtons === 'function') {
            if (asxCodeButtonsContainer) asxCodeButtonsContainer.classList.remove('app-hidden');
            renderAsxCodeButtons();
        }
    };
    window.showWatchlistView = function() {
        // Hide portfolio section if present, show normal stock watchlist section
        let portfolioSection = document.getElementById('portfolioSection');
        if (portfolioSection) portfolioSection.style.display = 'none';
    stockWatchlistSection.style.display = '';
    stockWatchlistSection.classList.remove('app-hidden');
    // Also ensure the table and mobile containers are restored from any previous hide
    if (tableContainer) tableContainer.style.display = '';
    if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = '';
    };
    // Render portfolio list (uses live prices when available)
    window.renderPortfolioList = function() {
        const portfolioListContainer = document.getElementById('portfolioListContainer');
        if (!portfolioListContainer) return;

        // Filter for shares assigned to the Portfolio
    const portfolioShares = allSharesData.filter(s => shareBelongsTo(s, 'portfolio'));
        if (portfolioShares.length === 0) {
            portfolioListContainer.innerHTML = '<p>No shares in your portfolio yet.</p>';
            return;
        }

        // Helper to get a displayable current price for a share (live, last live when closed, then entered price)
        function getDisplayPrice(share) {
            const code = (share.shareName || '').toUpperCase();
            const lp = livePrices ? livePrices[code] : undefined;
            const marketOpen = typeof isAsxMarketOpen === 'function' ? isAsxMarketOpen() : true;
            let price = null;
            if (lp) {
                if (marketOpen && lp.live !== null && !isNaN(lp.live)) {
                    price = Number(lp.live);
                } else if (!marketOpen && lp.lastLivePrice !== null && !isNaN(lp.lastLivePrice)) {
                    price = Number(lp.lastLivePrice);
                }
            }
            if (price === null || isNaN(price)) {
                // Fallback to user-entered currentPrice if available
                price = (share.currentPrice !== null && share.currentPrice !== undefined && !isNaN(Number(share.currentPrice)))
                    ? Number(share.currentPrice)
                    : null;
            }
            return price;
        }

    function fmtMoney(n) { return formatMoney(n); }
    function fmtPct(n) { return formatPercent(n); }

    let totalValue = 0;
    let totalPL = 0;
    let totalCostBasis = 0; // sum of shares * avgPrice for total % calc
    // Build desktop/table HTML
    let htmlTable = '<table class="portfolio-table"><thead><tr><th>Code</th><th>Shares</th><th>Avg<br>Price</th><th>Live</th><th>Value</th><th>P/L</th><th>P/L %</th></tr></thead><tbody>';
    // Build mobile cards markup
    let cards = [];
    let profitPLSum = 0; // sum of positive P/L
    let lossPLSum = 0;   // sum of negative P/L (will stay negative)
        portfolioShares.forEach(share => {
            const shares = (share.portfolioShares !== null && share.portfolioShares !== undefined && !isNaN(Number(share.portfolioShares)))
                ? Math.trunc(Number(share.portfolioShares)) : '';
            const avgPrice = (share.portfolioAvgPrice !== null && share.portfolioAvgPrice !== undefined && !isNaN(Number(share.portfolioAvgPrice)))
                ? Number(share.portfolioAvgPrice) : null;
            const code = (share.shareName || '').toUpperCase();
            const lpObj = livePrices ? livePrices[code] : undefined;
            const marketOpen = typeof isAsxMarketOpen === 'function' ? isAsxMarketOpen() : true;
            let priceNow = null;
            if (lpObj) {
                if (marketOpen && lpObj.live !== null && !isNaN(lpObj.live)) priceNow = Number(lpObj.live);
                else if (!marketOpen && lpObj.lastLivePrice !== null && !isNaN(lpObj.lastLivePrice)) priceNow = Number(lpObj.lastLivePrice);
            }
            if (priceNow === null || isNaN(priceNow)) {
                if (share.currentPrice !== null && share.currentPrice !== undefined && !isNaN(Number(share.currentPrice))) {
                    priceNow = Number(share.currentPrice);
                }
            }
            let dailyChangeClass = '';
            if (lpObj) {
                const latestLive = (lpObj.live !== null && !isNaN(lpObj.live)) ? Number(lpObj.live) : (lpObj.lastLivePrice ?? null);
                const latestPrev = (lpObj.prevClose !== null && !isNaN(lpObj.prevClose)) ? Number(lpObj.prevClose) : (lpObj.lastPrevClose ?? null);
                if (latestLive !== null && latestPrev !== null && !isNaN(latestLive) && !isNaN(latestPrev)) {
                    const dayChange = latestLive - latestPrev;
                    if (dayChange > 0) dailyChangeClass = 'positive'; else if (dayChange < 0) dailyChangeClass = 'negative';
                }
            }
            const rowValue = (typeof shares === 'number' && typeof priceNow === 'number') ? shares * priceNow : null;
            if (typeof rowValue === 'number') totalValue += rowValue;
            const rowPL = (typeof shares === 'number' && typeof priceNow === 'number' && typeof avgPrice === 'number') ? (priceNow - avgPrice) * shares : null;
            if (typeof shares === 'number' && typeof avgPrice === 'number') totalCostBasis += (shares * avgPrice);
            if (typeof rowPL === 'number') {
                totalPL += rowPL;
                if (rowPL > 0) profitPLSum += rowPL; else if (rowPL < 0) lossPLSum += rowPL;
            }
            const rowPLPct = (typeof avgPrice === 'number' && avgPrice > 0 && typeof priceNow === 'number') ? ((priceNow - avgPrice) / avgPrice) * 100 : null;
            const plClass = (typeof rowPL === 'number') ? (rowPL > 0 ? 'positive' : (rowPL < 0 ? 'negative' : 'neutral')) : '';
            const priceColorClass = marketOpen ? 'live-price' : 'last-price';
            const priceCell = (priceNow !== null && priceNow !== undefined) ? ('<span class="price-value '+priceColorClass+'">' + fmtMoney(priceNow) + '</span>') : '';
            htmlTable += `<tr data-doc-id="${share.id}" class="${dailyChangeClass}">
                <td class="code-cell">${share.shareName || ''}</td>
                <td class="num-cell shares-cell">${shares !== '' ? formatWithCommas(shares) : ''}</td>
                <td class="num-cell avg-cell">${avgPrice !== '' ? fmtMoney(avgPrice) : ''}</td>
                <td class="num-cell live-cell ${marketOpen ? 'live' : 'last'} liveprice-cell">${priceCell}</td>
                <td class="num-cell value-cell">${rowValue !== null ? fmtMoney(rowValue) : ''}</td>
                <td class="num-cell pl-cell ${plClass}">${rowPL !== null ? fmtMoney(rowPL) : ''}</td>
                <td class="num-cell plpct-cell ${plClass}">${rowPLPct !== null ? fmtPct(rowPLPct) : ''}</td>
            </tr>`;
            const card = `<div class="portfolio-card ${dailyChangeClass}" data-doc-id="${share.id}">
                <div class="pc-row top">
                    <div class="pc-code ${dailyChangeClass}">${share.shareName || ''}</div>
                    <div class="pc-live ${marketOpen ? 'live' : 'last'}"><span class="val ${priceColorClass}">${priceNow !== null && priceNow !== undefined ? fmtMoney(priceNow) : ''}</span></div>
                    <div class="pc-plpct ${plClass}">${rowPLPct !== null ? fmtPct(rowPLPct) : ''}</div>
                </div>
                <div class="pc-row mid">
                    <div class="pc-shares">${shares !== '' ? shares : ''} @ ${avgPrice !== '' ? fmtMoney(avgPrice) : ''}</div>
                    <div class="pc-value">${rowValue !== null ? fmtMoney(rowValue) : ''}</div>
                </div>
                <div class="pc-row bottom ${plClass}">
                    <div class="pc-pl-label">P/L</div>
                    <div class="pc-pl-val">${rowPL !== null ? fmtMoney(rowPL) : ''}</div>
                </div>
            </div>`;
            cards.push(card);
        });
        // Total row
        const totalPLClass = totalPL > 0 ? 'positive' : (totalPL < 0 ? 'negative' : 'neutral');
        const totalPLPct = (totalCostBasis > 0 && typeof totalPL === 'number') ? (totalPL / totalCostBasis) * 100 : 0;
        htmlTable += `<tr class="portfolio-total-row ${totalPLClass}">
            <td colspan="4" style="text-align:right;font-weight:600;">Total</td>
            <td style="font-weight:700;">${fmtMoney(totalValue)}</td>
            <td class="${totalPLClass}" style="font-weight:700;">${fmtMoney(totalPL)}</td>
            <td class="${totalPLClass}" style="font-weight:700;">${fmtPct(totalPLPct)}</td>
        </tr>`;
        htmlTable += '</tbody></table>';
        const totalsCard = `<div class="portfolio-card total ${totalPLClass} wide">
            <div class="pc-row top"><div class="pc-code">Totals</div></div>
            <div class="pc-row mid"><div class="pc-value-label">Value</div><div class="pc-value">${fmtMoney(totalValue)}</div></div>
            <div class="pc-row bottom ${totalPLClass}"><div class="pc-pl-label">P/L</div><div class="pc-pl-val">${fmtMoney(totalPL)}</div></div>
        </div>`;
    const totalPLPctDisplay = (totalCostBasis > 0) ? fmtPct((totalPL / totalCostBasis) * 100) : '0.00%';
        const profitLossSummary = `<div class="portfolio-summary-bar two-cards">
            <div class="ps-card profit highlight">
                <div class="ps-label">Profit</div>
                <div class="ps-value">${fmtMoney(profitPLSum)}</div>
            </div>
            <div class="ps-card loss highlight">
                <div class="ps-label">Loss</div>
                <div class="ps-value">${fmtMoney(Math.abs(lossPLSum))}</div>
            </div>
        </div>`;
    const htmlCards = `<div class="portfolio-cards">${cards.join('')}<div class="totals-footer-wrapper">${totalsCard}</div></div>`;
        portfolioListContainer.innerHTML = profitLossSummary + htmlTable + htmlCards;

        // Make portfolio rows interactive: click to open details; right-click to open context menu
    const rows = portfolioListContainer.querySelectorAll('table.portfolio-table tbody tr, .portfolio-cards .portfolio-card');
        rows.forEach(row => {
            if (row.classList.contains('portfolio-total-row')) return; // skip totals
            const docId = row.getAttribute('data-doc-id');
            if (!docId) return;
            row.addEventListener('click', () => {
                selectShare(docId);
                showShareDetails();
            });
            row.addEventListener('contextmenu', (e) => {
                if (window.innerWidth > 768) {
                    e.preventDefault();
                    selectShare(docId);
                    showContextMenu(e, docId);
                }
            });
            // Mobile long-press disabled: passive touch handlers only
            row.addEventListener('touchstart', () => { selectedElementForTap = row; }, { passive: true });
            row.addEventListener('touchend', () => { selectedElementForTap = null; }, { passive: true });
        });
    };
});
//  This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

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
// Initialize dismissal and sort state from localStorage as early as possible to avoid flashes/defaults
try { targetHitIconDismissed = localStorage.getItem('targetHitIconDismissed') === 'true'; } catch(e) {}
// Restore last selected view (persisted)
try {
    const lastView = localStorage.getItem('lastSelectedView');
    if (lastView === 'portfolio') {
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

// App version (single source of truth for display)
const APP_VERSION = 'v0.1.5';


// Live Price Data
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwwMEss5DIYblLNbjIbt_TAzWh54AwrfQlVwCrT_P0S9xkAoXhAUEUg7vSEPYUPOZp/exec';
let livePrices = {}; // Stores live price data: {ASX_CODE: {live: price, prevClose: price, PE: value, High52: value, Low52: value, targetHit: boolean, lastLivePrice: value, lastPrevClose: value}} 
let livePriceFetchInterval = null; // To hold the interval ID for live price updates
const LIVE_PRICE_FETCH_INTERVAL_MS = 5 * 60 * 1000; // Fetch every 5 minutes

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10',
    'Muted Blue', 'Muted Brown', 'Muted Pink', 'Muted Green', 'Muted Purple', 'Muted Orange', 'Muted Cyan', 'Muted Magenta', 'Muted Gold', 'Muted Grey'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme string
let savedSortOrder = null; // GLOBAL: Stores the sort order loaded from user settings
let savedTheme = null; // GLOBAL: Stores the theme loaded from user settings

let unsubscribeShares = null; // Holds the unsubscribe function for the Firestore shares listener
let unsubscribeCashCategories = null; // NEW: Holds the unsubscribe function for Firestore cash categories listener
let unsubscribeAlerts = null; // NEW: Holds the unsubscribe function for Firestore alerts listener

// NEW: Global variable to store shares that have hit their target price
let sharesAtTargetPrice = [];
// NEW: Also track triggered but muted alerts so users can unmute from the hub
let sharesAtTargetPriceMuted = [];
// NEW: Remember last shown alert count to avoid icon flicker on reload while prices are loading (persisted)
let lastKnownTargetCount = 0;
try {
    const persisted = parseInt(localStorage.getItem('lastKnownTargetCount') || '0', 10);
    if (!isNaN(persisted) && persisted > 0) lastKnownTargetCount = persisted;
} catch(e) {}

// NEW: Global variable to track the current mobile view mode ('default' or 'compact')
let currentMobileViewMode = 'default'; 

// Helper to ensure compact mode class is always applied
function applyCompactViewMode() {
    if (mobileShareCardsContainer) {
        if (currentMobileViewMode === 'compact') {
            mobileShareCardsContainer.classList.add('compact-view');
        } else {
            mobileShareCardsContainer.classList.remove('compact-view');
        }
    }
    // Re-apply ASX buttons visibility since compact view hides them
    if (typeof applyAsxButtonsState === 'function') {
        applyAsxButtonsState();
    }
    // Adjust layout after view mode change
    requestAnimationFrame(adjustMainContentPadding);
}

// NEW: Global variable to track if the target hit icon is dismissed for the current session
let targetHitIconDismissed = false;
// Removed: manual EOD toggle state; behavior is automatic based on Sydney market hours

// Tracks if share detail modal was opened from alerts
let wasShareDetailOpenedFromTargetAlerts = false;
// Track if the edit form was opened from the share detail modal, so back can return to detail
let wasEditOpenedFromShareDetail = false;

// NEW: Global variable to store cash categories data
let userCashCategories = [];
let selectedCashAssetDocId = null; // NEW: To track which cash asset is selected for editing/details
let originalCashAssetData = null; // NEW: To store original cash asset data for dirty state check
// NEW: Global variable to store visibility state of cash assets (temporary, not persisted)
// This will now be managed directly by the 'isHidden' property on the cash asset object itself.
let cashAssetVisibility = {}; // This object will still track the *current session's* visibility.
// NEW: Reference for the hide/show checkbox in the cash asset form modal
const hideCashAssetCheckbox = document.getElementById('hideCashAssetCheckbox');


// --- UI Element References ---
// Copilot: No-op change to trigger source control detection
const appHeader = document.getElementById('appHeader'); // Reference to the main header
const mainContainer = document.querySelector('main.container'); // Reference to the main content container
// mainTitle removed in favour of dynamicWatchlistTitle only
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn'); // This will become the contextual plus icon
const newShareBtn = document.getElementById('newShareBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
const toggleAsxButtonsBtn = document.getElementById('toggleAsxButtonsBtn'); // NEW: Toggle button for ASX codes
const shareFormSection = document.getElementById('shareFormSection');
const formCloseButton = document.querySelector('.form-close-button');
const formTitle = document.getElementById('formTitle');
const formCompanyName = document.getElementById('formCompanyName'); // NEW: Company name in add/edit form
const saveShareBtn = document.getElementById('saveShareBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const addShareLivePriceDisplay = document.getElementById('addShareLivePriceDisplay'); // NEW: Live price display in add form
const currentPriceInput = document.getElementById('currentPrice'); // Reference (reinstated) to Reference Price input
// Centralized single-code snapshot handling
let _latestAddFormSnapshotReq = 0; // monotonic counter to avoid race conditions
async function updateAddFormLiveSnapshot(code) {
    try {
        if (!code || !GOOGLE_APPS_SCRIPT_URL || !addShareLivePriceDisplay) return;
        const reqId = ++_latestAddFormSnapshotReq;
        const upper = String(code).toUpperCase();
        addShareLivePriceDisplay.dataset.loading = 'true';
        // Lightweight loading indicator (optional)
        addShareLivePriceDisplay.style.display = 'block';
        addShareLivePriceDisplay.innerHTML = '<div class="mini-loading">Loading...</div>';
        const resp = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?stockCode=${encodeURIComponent(upper)}&_ts=${Date.now()}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (reqId !== _latestAddFormSnapshotReq) return; // stale
        if (!Array.isArray(data) || data.length === 0) { addShareLivePriceDisplay.innerHTML = '<p class="ghosted-text">No price data.</p>'; return; }
        let row = data.find(r => {
            const c = r.ASXCode || r.ASX_Code || r['ASX Code'] || r.Code || r.code;
            return c && String(c).toUpperCase().trim() === upper;
        }) || data[0];
        if (row && row !== data[0] && DEBUG_MODE) logDebug('Snapshot: matched exact row for', upper);
        if (row === data[0] && (row.ASXCode || row.Code) && String(row.ASXCode||row.Code).toUpperCase().trim() !== upper && DEBUG_MODE) {
            logDebug('Snapshot: exact match not found, using first row', { requested: upper, first: row.ASXCode||row.Code });
        }
        const live = parseFloat(row.LivePrice ?? row['Live Price'] ?? row.live ?? row.price ?? row.Last ?? row.LastPrice ?? row['Last Price'] ?? row.LastTrade ?? row['Last Trade']);
        const prev = parseFloat(row.PrevClose ?? row['Prev Close'] ?? row.prevClose ?? row.prev ?? row['Previous Close'] ?? row.Close ?? row['Last Close']);
        const pe = parseFloat(row.PE ?? row['PE Ratio'] ?? row.pe);
        const hi = parseFloat(row.High52 ?? row['High52'] ?? row['High 52'] ?? row['52WeekHigh'] ?? row['52 High']);
        const lo = parseFloat(row.Low52 ?? row['Low52'] ?? row['Low 52'] ?? row['52WeekLow'] ?? row['52 Low']);
        const change = (!isNaN(live) && !isNaN(prev)) ? (live - prev) : null;
        const pct = (!isNaN(live) && !isNaN(prev) && prev !== 0) ? ((live - prev) / prev) * 100 : null;
        const priceClass = change === null ? '' : (change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral'));
        // Guard against user switching code mid-flight
        if (shareNameInput && shareNameInput.value.toUpperCase().trim() !== upper) {
            if (DEBUG_MODE) logDebug('Snapshot: Discarding stale update; input changed.', { requested: upper, current: shareNameInput.value });
            return;
        }
        // Prefill reference price field with latest live price (always override for accuracy)
        if (!isNaN(live) && currentPriceInput) {
            currentPriceInput.value = Number(live).toFixed(2);
        }
        addShareLivePriceDisplay.innerHTML = `
            <div class="fifty-two-week-row">
                <span class="fifty-two-week-value low">Low: ${!isNaN(lo) ? formatMoney(lo) : 'N/A'}</span>
                <span class="fifty-two-week-value high">High: ${!isNaN(hi) ? formatMoney(hi) : 'N/A'}</span>
            </div>
            <div class="live-price-main-row">
                <span class="live-price-large ${priceClass}">${!isNaN(live) ? formatMoney(live) : 'N/A'}</span>
                <span class="price-change-large ${priceClass}">${(change !== null && pct !== null) ? `${formatAdaptivePrice(change)} (${formatAdaptivePercent(pct)}%)` : 'N/A'}</span>
            </div>
            <div class="pe-ratio-row">
                <span class="pe-ratio-value">P/E: ${!isNaN(pe) ? formatAdaptivePrice(pe) : 'N/A'}</span>
            </div>`;
        addShareLivePriceDisplay.style.display = 'block';
        addShareLivePriceDisplay.removeAttribute('data-loading');
    } catch (e) {
        if (DEBUG_MODE) console.warn('Snapshot: failed for', code, e);
        if (addShareLivePriceDisplay) {
            addShareLivePriceDisplay.innerHTML = '<p class="ghosted-text">Price unavailable.</p>';
            addShareLivePriceDisplay.style.display = 'block';
            addShareLivePriceDisplay.removeAttribute('data-loading');
        }
    }
}
const shareNameInput = document.getElementById('shareName');
// Removed manual Reference Price input; currentPrice now auto-captured
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const shareRatingSelect = document.getElementById('shareRating');
const commentsFormContainer = document.getElementById('dynamicCommentsArea');
const modalStarRating = document.getElementById('modalStarRating');

// --- ASX Code Toggle Button Functionality ---
// Persisted ASX code buttons expanded state
let asxButtonsExpanded = false;
try { const saved = localStorage.getItem('asxButtonsExpanded'); if (saved === 'true') asxButtonsExpanded = true; } catch(e) {}

function applyAsxButtonsState() {
    if (!asxCodeButtonsContainer || !toggleAsxButtonsBtn) return;
    const isCompact = (typeof currentMobileViewMode !== 'undefined' && currentMobileViewMode === 'compact');
    // If there are no buttons, never show and hide chevron
    const hasButtons = asxCodeButtonsContainer && asxCodeButtonsContainer.querySelector('button.asx-code-btn');
    // In compact mode, still allow showing the buttons (they can be horizontally scrollable)
    const shouldShow = !!hasButtons && asxButtonsExpanded;

    if (shouldShow) {
        asxCodeButtonsContainer.classList.add('expanded');
        asxCodeButtonsContainer.classList.remove('app-hidden');
        asxCodeButtonsContainer.setAttribute('aria-hidden', 'false');
    } else {
        asxCodeButtonsContainer.classList.remove('expanded');
        asxCodeButtonsContainer.setAttribute('aria-hidden', 'true');
    }
    // Chevron visibility and state
    if (!hasButtons) {
        toggleAsxButtonsBtn.style.display = 'none';
        toggleAsxButtonsBtn.setAttribute('aria-disabled', 'true');
        toggleAsxButtonsBtn.classList.remove('expanded');
        toggleAsxButtonsBtn.setAttribute('aria-pressed', 'false');
    } else {
        toggleAsxButtonsBtn.style.display = '';
        toggleAsxButtonsBtn.removeAttribute('aria-disabled');
    toggleAsxButtonsBtn.classList.toggle('expanded', shouldShow);
        toggleAsxButtonsBtn.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
    }
    // After any state change, adjust content padding to account for header height change
    // Use rAF to wait for styles/transition to apply
    requestAnimationFrame(adjustMainContentPadding);
}

if (toggleAsxButtonsBtn && asxCodeButtonsContainer) {
    applyAsxButtonsState();
    toggleAsxButtonsBtn.addEventListener('click', () => {
        asxButtonsExpanded = !asxButtonsExpanded;
        try { localStorage.setItem('asxButtonsExpanded', asxButtonsExpanded ? 'true':'false'); } catch(e) {}
        applyAsxButtonsState();
        console.log('[ASX Toggle] Toggled. Expanded=', asxButtonsExpanded);
        // Schedule padding adjustment after the CSS transition window
        // Transition duration in CSS: 300-400ms; allow a buffer
        setTimeout(adjustMainContentPadding, 450);
        // A second safety call in case the first fires mid-transition
        setTimeout(adjustMainContentPadding, 700);
    // New: Always scroll to top smoothly after toggling for visibility of top cards
    try { window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }); } catch(_) { window.scrollTo(0,0); }
    });
    // Also adjust precisely on transition end of the container
    asxCodeButtonsContainer.addEventListener('transitionend', (ev) => {
        if (ev.propertyName === 'max-height' || ev.propertyName === 'padding' || ev.propertyName === 'opacity') {
            adjustMainContentPadding();
        }
    });
}
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const tableContainer = document.querySelector('.table-container');
const loadingIndicator = document.getElementById('loadingIndicator');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalCompanyName = document.getElementById('modalCompanyName');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
const modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const modalNewsLink = document.getElementById('modalNewsLink');
const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
const modalFoolLink = document.getElementById('modalFoolLink');
const modalListcorpLink = document.getElementById('modalListcorpLink'); // NEW: Reference for Listcorp link
const modalCommSecLink = document.getElementById('modalCommSecLink');
const commSecLoginMessage = document.getElementById('commSecLoginMessage');
// NEW: Auto (read-only) fields in Other Details section of Share Form
const autoEntryDateDisplay = document.getElementById('autoEntryDateDisplay');
const autoReferencePriceDisplay = document.getElementById('autoReferencePriceDisplay');
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const calcCloseButton = document.querySelector('.calc-close-button');
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividend = document.getElementById('calcEstimatedDividend');
const sortSelect = document.getElementById('sortSelect');
// Legacy customDialogModal removed; toast system fully replaces it.
const calculatorModal = document.getElementById('calculatorModal');
const calculatorInput = document.getElementById('calculatorInput');
const calculatorResult = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('.calculator-buttons');
const watchlistSelect = document.getElementById('watchlistSelect');
// Dynamic watchlist title + picker modal + sort display (new UI layer)
const dynamicWatchlistTitle = document.getElementById('dynamicWatchlistTitle');
const dynamicWatchlistTitleText = document.getElementById('dynamicWatchlistTitleText');
const watchlistPickerModal = document.getElementById('watchlistPickerModal');
const watchlistPickerList = document.getElementById('watchlistPickerList');
const closeWatchlistPickerBtn = document.getElementById('closeWatchlistPickerBtn');
// Removed legacy currentSortDisplay element (text summary of sort) now that dropdown itself is visible
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAllUserDataBtn = document.getElementById('deleteAllUserDataBtn');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn');
const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
const shareWatchlistCheckboxes = document.getElementById('shareWatchlistCheckboxes');
const shareWatchlistDropdownBtn = document.getElementById('shareWatchlistDropdownBtn');
const modalLivePriceDisplaySection = document.getElementById('modalLivePriceDisplaySection'); 
const targetHitIconBtn = document.getElementById('targetHitIconBtn'); // NEW: Reference to the icon button
const targetHitIconCount = document.getElementById('targetHitIconCount'); // NEW: Reference to the count span
// NEW: Target Hit Details Modal Elements
const targetHitDetailsModal = document.getElementById('targetHitDetailsModal');
const targetHitModalTitle = document.getElementById('targetHitModalTitle');
// Removed: minimizeTargetHitModalBtn, dismissAllTargetHitsBtn (now explicit buttons at bottom)
const targetHitSharesList = document.getElementById('targetHitSharesList');
const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');

// NEW: References for the reconfigured buttons in the Target Hit Details Modal
const targetHitModalCloseTopBtn = document.getElementById('targetHitModalCloseTopBtn'); // New 'X' button at the top
const alertModalMinimizeBtn = document.getElementById('alertModalMinimizeBtn'); // New "Minimize" button at the bottom
const alertModalDismissAllBtn = document.getElementById('alertModalDismissAllBtn'); // New "Dismiss All" button at the bottom

// NEW: Target Direction Checkbox UI Elements
const targetAboveCheckbox = document.getElementById('targetAboveCheckbox');
const targetBelowCheckbox = document.getElementById('targetBelowCheckbox');
// New Phase 1 segmented toggle buttons (UI-only)
const targetIntentBuyBtn = document.getElementById('targetIntentBuyBtn');
const targetIntentSellBtn = document.getElementById('targetIntentSellBtn');
const targetDirAboveBtn = document.getElementById('targetDirAboveBtn');
const targetDirBelowBtn = document.getElementById('targetDirBelowBtn');
let userManuallyOverrodeDirection = false; // reset per form open
const splashScreen = document.getElementById('splashScreen');
const searchStockBtn = document.getElementById('searchStockBtn'); // NEW: Search Stock button
const stockSearchModal = document.getElementById('stockSearchModal'); // NEW: Stock Search Modal
const stockSearchTitle = document.getElementById('stockSearchTitle'); // NEW: Title for search modal
const asxSearchInput = document.getElementById('asxSearchInput'); // NEW: Search input field
const asxSuggestions = document.getElementById('asxSuggestions'); // NEW: Autocomplete suggestions container
const shareNameSuggestions = document.getElementById('shareNameSuggestions'); // NEW: Autocomplete for share form code input
const searchResultDisplay = document.getElementById('searchResultDisplay'); // NEW: Display area for search results
const searchModalActionButtons = document.querySelector('#stockSearchModal .modal-action-buttons-footer'); // NEW: Action buttons container
const searchModalCloseButton = document.querySelector('.search-close-button'); // NEW: Close button for search modal

// NEW: Global variable for storing loaded ASX code data from CSV
let allAsxCodes = []; // { code: 'BHP', name: 'BHP Group Ltd' }
let currentSelectedSuggestionIndex = -1; // For keyboard navigation in autocomplete
let shareNameAutocompleteBound = false; // Prevent duplicate binding

function initializeShareNameAutocomplete(force=false){
    if (shareNameAutocompleteBound && !force) return;
    if (!shareNameInput || !shareNameSuggestions) return;
    // If already has an input listener tagged, skip unless force
    if (shareNameInput.dataset.autocompleteBound && !force) return;
    shareNameInput.dataset.autocompleteBound = '1';
    shareNameAutocompleteBound = true;
    // Listeners are already defined further below (conditional block). This function can serve as a future hook.
}
let currentSearchShareData = null; // Stores data of the currently displayed stock in search modal
const splashKangarooIcon = document.getElementById('splashKangarooIcon');
const splashSignInBtn = document.getElementById('splashSignInBtn');
const alertPanel = document.getElementById('alertPanel'); // NEW: Reference to the alert panel (not in current HTML, but kept for consistency)
const alertList = document.getElementById('alertList'); // NEW: Reference to the alert list container (not in current HTML, but kept for consistency)
const closeAlertPanelBtn = document.getElementById('closeAlertPanelBtn'); // NEW: Reference to close alert panel button (not in current HTML, but kept for consistency)
const clearAllAlertsBtn = document.getElementById('clearAllAlertsBtn'); // NEW: Reference to clear all alerts button (not in current HTML, but kept for consistency)

// NEW: Cash & Assets UI Elements (1)
const stockWatchlistSection = document.getElementById('stockWatchlistSection');
// Generic number formatting helper (adds commas to large numbers while preserving decimals)
function formatWithCommas(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
    const str = value.toString();
    if (!/^[-+]?\d*(\.\d+)?$/.test(str)) return value; // not a plain number string
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

// Global helpers for consistent numeric formatting across the UI
function formatMoney(val, opts = {}) {
    const { hideZero = false, decimals } = opts; // if decimals supplied explicitly, override adaptive logic
    if (val === null || val === undefined) return '';
    const n = Number(val);
    if (!isFinite(n)) return '';
    if (hideZero && n === 0) return '';
    // Adaptive decimals: < 1 cent show 3 decimals (e.g., $0.005), otherwise 2.
    const useDecimals = (typeof decimals === 'number') ? decimals : (Math.abs(n) < 0.01 && n !== 0 ? 3 : 2);
    const fixed = n.toFixed(useDecimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + parts.join('.');
}

function formatPercent(val, opts = {}) {
    const { maxDecimals = 2 } = opts; // allow specifying maximum decimals
    if (val === null || val === undefined) return '';
    const n = Number(val);
    if (!isFinite(n)) return '';
    // Show whole number when no fractional component (e.g., 100 instead of 100.00)
    if (Math.abs(n % 1) < 1e-9) return n.toFixed(0) + '%';
    return n.toFixed(maxDecimals) + '%';
}

// Lean wrappers for adaptive decimals outside of currency symbol contexts
function formatAdaptivePrice(value) {
    if (value === null || value === undefined || isNaN(value)) return '0.00';
    const absVal = Math.abs(Number(value));
    const decimals = absVal !== 0 && absVal < 0.01 ? 3 : 2;
    return Number(value).toFixed(decimals);
}
function formatAdaptivePercent(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return '0.00';
    const n = Number(pct);
    const abs = Math.abs(n);
    // Use 3 decimals for very small magnitudes (under 0.1%), else 2
    const decimals = (abs > 0 && abs < 0.1) ? 3 : 2;
    return n.toFixed(decimals);
}

// Fallback for missing formatUserDecimalStrict (called in edit form population)
if (typeof window.formatUserDecimalStrict !== 'function') {
    window.formatUserDecimalStrict = function(v){
        if (v === null || v === undefined || v === '') return '';
        const num = Number(v);
        if (isNaN(num)) return '';
        // Keep up to 4 decimals if needed, trim trailing zeros
        let str = num.toFixed(4); // start with 4
        str = str.replace(/\.0+$/,'');
        str = str.replace(/(\.\d*[1-9])0+$/,'$1');
        return str;
    };
}

// ----- Lightweight Back Stack Handling (limit to 2 states) -----
const appBackStack = [];
function pushAppStateEntry(type, ref) {
    appBackStack.push({type, ref});
    if (appBackStack.length > 2) appBackStack.shift();
}
function popAppStateEntry() { return appBackStack.pop(); }

// Hook sidebar open
if (hamburgerBtn && appSidebar) {
    hamburgerBtn.addEventListener('click', ()=>{ pushAppStateEntry('sidebar','sidebar'); });
}
// Override showModal to push (wrap existing if not already wrapped)
if (!window.__origShowModalForBack) {
    window.__origShowModalForBack = showModal;
    showModal = function(m){ pushAppStateEntry('modal', m); window.__origShowModalForBack(m); };
}

window.addEventListener('popstate', ()=>{
    // Not using deep browser history here; rely on our own stack
    const last = popAppStateEntry();
    if (!last) return;
    if (last.type === 'modal') {
        // Smart modal back: hide current modal and restore the previous one (if any)
        const currentModal = last.ref && last.ref.nodeType === 1 ? last.ref : (last.ref ? document.getElementById(last.ref.id || last.ref) : null);
        // Targeted auto-save when backing out of the Share Form modal
        if (currentModal && shareFormSection && currentModal === shareFormSection) {
            try { autoSaveShareFormOnClose(); } catch(e) { console.warn('Auto-save on back (share form) failed', e); }
        }
        if (currentModal && typeof hideModal === 'function') {
            hideModal(currentModal);
        } else {
            // Fallback: hide all if we cannot resolve the modal element
            closeModals();
            return;
        }
        // Peek previous stack entry; if it is also a modal, show it without pushing history
        const prev = appBackStack[appBackStack.length - 1];
        if (prev && prev.type === 'modal') {
            const prevModal = prev.ref && prev.ref.nodeType === 1 ? prev.ref : (prev.ref ? document.getElementById(prev.ref.id || prev.ref) : null);
            if (prevModal) {
                try { showModalNoHistory(prevModal); } catch(e) { console.warn('Failed to restore previous modal on back', e); }
            }
        }
    } else if (last.type === 'sidebar') {
        // Use the unified closer to fully reset layout, overlay, and scroll locks
        if (typeof toggleAppSidebar === 'function') {
            toggleAppSidebar(false);
        } else if (appSidebar) {
            // Fallback: ensure classes and styles are reset to avoid layout gaps
            appSidebar.classList.remove('open');
            document.body.classList.remove('sidebar-active');
            document.body.style.overflow = '';
            if (typeof sidebarOverlay !== 'undefined' && sidebarOverlay) {
                sidebarOverlay.classList.remove('open');
                sidebarOverlay.style.pointerEvents = 'none';
            }
        }
    }
});

// Hardware / browser back key mapping (mobile)
window.addEventListener('keydown', e=>{
    if (e.key === 'Escape') {
        const last = appBackStack[appBackStack.length-1];
        if (last) { e.preventDefault(); history.back(); }
    }
});
const cashAssetsSection = document.getElementById('cashAssetsSection'); // UPDATED ID
const cashCategoriesContainer = document.getElementById('cashCategoriesContainer');
const addCashCategoryBtn = document.getElementById('addCashCategoryBtn'); // This will be removed or repurposed
const saveCashBalancesBtn = document.getElementById('saveCashBalancesBtn'); // This will be removed or repurposed
const totalCashDisplay = document.getElementById('totalCashDisplay');
const addCashAssetSidebarBtn = document.getElementById('addCashAssetSidebarBtn'); // NEW: Sidebar button for cash asset

// NEW: Cash Asset Modal Elements (2.1, 2.2)
const cashAssetFormModal = document.getElementById('cashAssetFormModal');
const cashFormTitle = document.getElementById('cashFormTitle');
const cashAssetNameInput = document.getElementById('cashAssetName');
const cashAssetBalanceInput = document.getElementById('cashAssetBalance');
const saveCashAssetBtn = document.getElementById('saveCashAssetBtn');
const deleteCashAssetBtn = document.getElementById('deleteCashAssetBtn');
const cashAssetFormCloseButton = document.querySelector('.cash-form-close-button'); // NEW: Specific close button for cash asset form
const cashAssetCommentsContainer = document.getElementById('cashAssetCommentsArea'); // NEW: Comments container for cash asset form
const addCashAssetCommentBtn = document.getElementById('addCashAssetCommentBtn'); // NEW: Add comment button for cash asset form

const cashAssetDetailModal = document.getElementById('cashAssetDetailModal');
const modalCashAssetName = document.getElementById('modalCashAssetName');
const detailCashAssetName = document.getElementById('detailCashAssetName');
const detailCashAssetBalance = document.getElementById('detailCashAssetBalance');
const detailCashAssetLastUpdated = document.getElementById('detailCashAssetLastUpdated');
const editCashAssetFromDetailBtn = document.getElementById('editCashAssetFromDetailBtn');
const deleteCashAssetFromDetailBtn = document.getElementById('deleteCashAssetFromDetailBtn');
const modalCashAssetCommentsContainer = document.getElementById('modalCashAssetCommentsContainer'); // NEW: Comments container for cash asset details


let sidebarOverlay = document.querySelector('.sidebar-overlay');
if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.classList.add('sidebar-overlay');
    document.body.appendChild(sidebarOverlay);
}

const formInputs = [
    shareNameInput,
    // currentPriceInput removed (auto mode)
    targetPriceInput,
    dividendAmountInput,
    frankingCreditsInput,
    // Include portfolio-specific fields so Save enables when they change
    document.getElementById('portfolioShares'),
    document.getElementById('portfolioAvgPrice'),
    shareRatingSelect
];

// NEW: Form inputs for Cash Asset Modal
const cashFormInputs = [
    cashAssetNameInput, cashAssetBalanceInput
];


// --- GLOBAL HELPER FUNCTIONS ---
const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwwwMEss5DIYblLNbjIbt_TAzWh54AwrfQlVwCrT_P0S9xkAoXhAUEUg7vSEPYUPOZp/exec';

async function fetchLivePricesAndUpdateUI() {
    logDebug('UI: Refresh Live Prices button clicked.');
    // Show a loading state if needed
    // You may have a function like showLoadingIndicator();
    
    // Call the newly updated live price fetch function
    await fetchLivePrices({ cacheBust: true });

    // Hide the loading state
    // You may have a function like hideLoadingIndicator();
}

/**
 * Fetches live price data from the Google Apps Script Web App.
 * Updates the `livePrices` global object.
 */
async function fetchLivePrices(opts = {}) {
    logDebug('Live Price: Fetching from Apps Script...');
    try {
        // Prefer GOOGLE_APPS_SCRIPT_URL if defined, fallback to appsScriptUrl constant.
    const baseUrl = typeof GOOGLE_APPS_SCRIPT_URL !== 'undefined' ? GOOGLE_APPS_SCRIPT_URL : (typeof appsScriptUrl !== 'undefined' ? appsScriptUrl : null);
    if (!baseUrl) throw new Error('Apps Script URL not defined');
    // Optional query params: cacheBust, stockCode support
    const qs = new URLSearchParams();
    if (opts && opts.cacheBust) qs.set('_ts', Date.now().toString());
    if (opts && opts.stockCode) qs.set('stockCode', String(opts.stockCode).toUpperCase());
    const url = qs.toString() ? (baseUrl + (baseUrl.includes('?') ? '&' : '?') + qs.toString()) : baseUrl;
    const response = await fetch(url, { cache: 'no-store' }); // no-store to avoid stale cached 302 chain
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (!Array.isArray(data)) {
            console.warn('Live Price: Response not an array, got:', data);
            window._livePricesLoaded = true; hideSplashScreenIfReady(); return;
        }
        if (DEBUG_MODE && data[0]) console.log('Live Price: Sample keys', Object.keys(data[0]));

        const haveShares = Array.isArray(allSharesData) && allSharesData.length > 0;
        const needed = haveShares ? new Set(allSharesData.filter(s => s && s.shareName).map(s => s.shareName.toUpperCase())) : null;
        const LOG_LIMIT = 30;
        let skipped = 0, skippedLogged = 0, accepted = 0, surrogate = 0, filtered = 0;
        const newLivePrices = {};

        // Helper: normalize numeric fields; treat null / undefined / '' / '#N/A' as null
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
            if (!codeRaw) return; // no code
            const code = String(codeRaw).toUpperCase().trim();
            if (!code) return;
            if (needed && !needed.has(code)) { filtered++; return; }

            const liveParsed = numOrNull(
                item.LivePrice || item['Live Price'] || item.live || item.price ||
                item.Last || item['Last Price'] || item.LastPrice || item['Last Trade'] || item.LastTrade
            );
            const prevParsed = numOrNull(
                item.PrevClose || item['Prev Close'] || item.previous || item.prev || item.prevClose ||
                item['Previous Close'] || item.Close || item['Last Close']
            );
            const peParsed = numOrNull(item.PE || item['PE Ratio'] || item.pe);
            const high52Parsed = numOrNull(item.High52 || item['High52'] || item['High 52'] || item['52WeekHigh'] || item['52 High']);
            const low52Parsed = numOrNull(item.Low52 || item['Low52'] || item['Low 52'] || item['52WeekLow'] || item['52 Low']);

            const hasLive = liveParsed !== null;
            const hasPrev = prevParsed !== null;
            const effectiveLive = hasLive ? liveParsed : (hasPrev ? prevParsed : NaN);
            if (isNaN(effectiveLive)) {
                skipped++; if (DEBUG_MODE && skippedLogged < LOG_LIMIT) { console.warn('Live Price skip (no usable price)', code, item); skippedLogged++; }
                return;
            }
            if (!hasLive && hasPrev) surrogate++;
            accepted++;

            // Target evaluation
            const shareData = haveShares ? allSharesData.find(s => s && s.shareName && s.shareName.toUpperCase() === code) : null;
            const targetPrice = shareData && !isNaN(parseFloat(shareData.targetPrice)) ? parseFloat(shareData.targetPrice) : undefined;
            const dir = shareData && shareData.targetDirection ? shareData.targetDirection : 'below';
            let hit = false;
            if (targetPrice !== undefined) {
                hit = dir === 'above' ? (effectiveLive >= targetPrice) : (effectiveLive <= targetPrice);
            }

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

        livePrices = newLivePrices;
        if (DEBUG_MODE) {
            const parts = [`accepted=${accepted}`];
            if (surrogate) parts.push(`surrogate=${surrogate}`);
            if (skipped) parts.push(`skipped=${skipped}`);
            if (filtered) parts.push(`filtered=${filtered}`);
            if (skipped > LOG_LIMIT) parts.push(`skippedNotLogged=${skipped - LOG_LIMIT}`);
            console.log('Live Price: Summary ' + parts.join(', '));
        }
        onLivePricesUpdated();
        window._livePricesLoaded = true;
        hideSplashScreenIfReady();
        updateTargetHitBanner();
    } catch (e) {
        console.error('Live Price: Fetch error', e);
        window._livePricesLoaded = true;
        hideSplashScreenIfReady();
    }
}

/**
 * Dynamically adjusts the top padding of the main content area
 * to prevent it from being hidden by the fixed header.
 * Uses scrollHeight to get the full rendered height, including wrapped content.
 */
function adjustMainContentPadding() {
    // Ensure both the header and main content container elements exist.
    if (appHeader && mainContainer) {
        // Get the current rendered height of the fixed header, including any wrapped content.
        // offsetHeight is usually sufficient, but scrollHeight can be more robust if content overflows.
        // For a fixed header, offsetHeight should reflect its full rendered height.
        const headerHeight = appHeader.offsetHeight; 
        
        // Apply this height as padding to the top of the main content container.
        mainContainer.style.paddingTop = `${headerHeight}px`;
        logDebug('Layout: Adjusted main content padding-top to: ' + headerHeight + 'px (Full Header Height).');
    } else {
        console.warn('Layout: Could not adjust main content padding-top: appHeader or mainContainer not found.');
    }
}

/**
 * Helper function to apply/remove a disabled visual state to non-button elements (like spans/icons).
 * This adds/removes the 'is-disabled-icon' class, which CSS then styles.
 * @param {HTMLElement} element The element to disable/enable.
 * @param {boolean} isDisabled True to disable, false to enable.
 */
function setIconDisabled(element, isDisabled) {
    if (!element) {
        console.warn('setIconDisabled: Element is null or undefined. Cannot set disabled state.');
        return;
    }
    if (isDisabled) {
        element.classList.add('is-disabled-icon');
    } else {
        element.classList.remove('is-disabled-icon');
    }
}

// Phase 2 helper: create or update a per-share alert document for the current user
async function upsertAlertForShare(shareId, shareCode, shareData, isNew) {
    if (!db || !currentUserId || !window.firestore) {
        console.warn('Alerts: Firestore not available; skipping alert upsert.');
        return;
    }
    // Collection path: artifacts/{appId}/users/{userId}/alerts
    const alertsCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/alerts');
    // We'll use a deterministic doc id per share to keep one alert document per share
    const alertDocId = shareId; // 1:1 mapping; adjust if multiple alerts per share later
    const alertDocRef = window.firestore.doc(alertsCol, alertDocId);

    // Interpret UI intent and direction
    // Intent: buy when direction is below; sell when direction is above (can extend later to explicit intent buttons)
    const direction = (shareData && shareData.targetDirection) === 'above' ? 'above' : 'below';
    let intent = 'buy';
    try {
        const buyActive = !!(typeof targetIntentBuyBtn !== 'undefined' && targetIntentBuyBtn && targetIntentBuyBtn.classList.contains('is-active'));
        const sellActive = !!(typeof targetIntentSellBtn !== 'undefined' && targetIntentSellBtn && targetIntentSellBtn.classList.contains('is-active'));
        intent = buyActive && !sellActive ? 'buy' : (sellActive && !buyActive ? 'sell' : (direction === 'above' ? 'sell' : 'buy'));
    } catch(_) {
        intent = direction === 'above' ? 'sell' : 'buy';
    }

    const payload = {
        shareId: shareId,
        shareCode: String(shareCode || '').toUpperCase(),
        userId: currentUserId,
        appId: currentAppId,
        intent: intent, // 'buy' | 'sell'
        direction: direction, // 'above' | 'below'
        targetPrice: (typeof shareData?.targetPrice === 'number' && !isNaN(shareData.targetPrice)) ? shareData.targetPrice : null,
        // createdAt added below only when isNew to avoid undefined writes
        updatedAt: window.firestore.serverTimestamp(),
        enabled: true
    };

    if (isNew) {
        payload.createdAt = window.firestore.serverTimestamp();
    }

    // Compute initial targetHit status immediately so the listener can pick it up
    try {
        const codeUpper = String(shareCode || '').toUpperCase();
        const lp = (typeof livePrices === 'object' && livePrices) ? livePrices[codeUpper] : null;
        const latestLive = (lp && lp.live !== null && !isNaN(lp.live)) ? lp.live
            : (lp && lp.lastLivePrice !== null && !isNaN(lp.lastLivePrice)) ? lp.lastLivePrice
            : null;
        const fallbackRef = (typeof shareData?.currentPrice === 'number' && !isNaN(shareData.currentPrice)) ? shareData.currentPrice : null;
        const current = (latestLive !== null) ? latestLive : (fallbackRef !== null ? fallbackRef : null);
        const tPrice = (typeof payload.targetPrice === 'number' && !isNaN(payload.targetPrice)) ? payload.targetPrice : null;
        let isHit = false;
        if (current !== null && tPrice !== null) {
            isHit = direction === 'above' ? (current >= tPrice) : (current <= tPrice);
        }
        payload.targetHit = !!isHit;
        payload.lastEvaluatedAt = window.firestore.serverTimestamp();
    } catch (e) {
        console.warn('Alerts: Failed to compute initial targetHit; defaulting to false.', e);
        payload.targetHit = false;
        payload.lastEvaluatedAt = window.firestore.serverTimestamp();
    }

    // Use setDoc with merge to avoid overwriting createdAt when updating
    await window.firestore.setDoc(alertDocRef, payload, { merge: true });
    logDebug('Alerts: Upserted alert for ' + shareCode + ' with intent ' + intent + ' and direction ' + direction + '.');
}

// Centralized Modal Closing Function
function closeModals() {
    // Auto-save logic for share form
    if (shareFormSection && shareFormSection.style.display !== 'none') {
        logDebug('Auto-Save: Share form modal is closing. Checking for unsaved changes.');
        const currentData = getCurrentFormData();
        const isShareNameValid = currentData.shareName.trim() !== '';
        
        // The cancel button fix means clearForm() is called before closeModals()
        // For auto-save on clicking outside or other non-cancel closes:
        if (selectedShareDocId) { // Existing share
            if (originalShareData && !areShareDataEqual(originalShareData, currentData)) { // Check if originalShareData exists and if form is dirty
                logDebug('Auto-Save: Unsaved changes detected for existing share. Attempting silent save.');
                saveShareData(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: No changes detected for existing share.');
            }
        } else { // New share
            // Only attempt to save if a share name was entered AND a watchlist was selected (if applicable)
            const isWatchlistSelected = shareWatchlistSelect && shareWatchlistSelect.value !== '';
            const needsWatchlistSelection = currentSelectedWatchlistIds.includes(ALL_SHARES_ID);
            
            if (isShareNameValid && isWatchlistSelected) { // Always require watchlist selection for new shares
                logDebug('Auto-Save: New share detected with valid name and watchlist. Attempting silent save.');
                saveShareData(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: New share has no name or invalid watchlist. Discarding changes.');
            }
        }
    }

    // NEW: Auto-save logic for watchlist modals
    if (addWatchlistModal && addWatchlistModal.style.display !== 'none') {
        logDebug('Auto-Save: Add Watchlist modal is closing. Checking for unsaved changes.');
        const currentWatchlistData = getCurrentWatchlistFormData(true); // true for add modal
        if (currentWatchlistData.name.trim() !== '') {
            logDebug('Auto-Save: New watchlist detected with name. Attempting silent save.');
            saveWatchlistChanges(true, currentWatchlistData.name); // true indicates silent save, pass name
        } else {
            logDebug('Auto-Save: New watchlist has no name. Discarding changes.');
        }
    }

    if (manageWatchlistModal && manageWatchlistModal.style.display !== 'none') {
        logDebug('Auto-Save: Manage Watchlist modal is closing. Checking for unsaved changes.');
        const currentWatchlistData = getCurrentWatchlistFormData(false); // false for edit modal
        if (originalWatchlistData && !areWatchlistDataEqual(originalWatchlistData, currentWatchlistData)) {
            logDebug('Auto-Save: Unsaved changes detected for existing watchlist. Attempting silent save.');
            saveWatchlistChanges(true, currentWatchlistData.name, watchlistSelect.value); // true indicates silent save, pass name and ID
        } else {
            logDebug('Auto-Save: No changes detected for existing watchlist.');
        }
    }

    // Close target hit details modal (no auto-save needed for this one)
    if (targetHitDetailsModal && targetHitDetailsModal.style.display !== 'none') {
        logDebug('Auto-Close: Target Hit Details modal is closing.');
        // No auto-save or dirty check needed for this display modal
    }
    // Leave a blank line here for readability.

    // NEW: Auto-save logic for cash asset form modal (2.1)
    if (cashAssetFormModal && cashAssetFormModal.style.display !== 'none') {
        logDebug('Auto-Save: Cash Asset form modal is closing. Checking for unsaved changes.');
        const currentCashData = getCurrentCashAssetFormData();
        const isCashAssetNameValid = currentCashData.name.trim() !== '';

        if (selectedCashAssetDocId) { // Existing cash asset
            if (originalCashAssetData && !areCashAssetDataEqual(originalCashAssetData, currentCashData)) {
                logDebug('Auto-Save: Unsaved changes detected for existing cash asset. Attempting silent save.');
                saveCashAsset(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: No changes detected for existing cash asset.');
            }
        } else { // New cash asset
            if (isCashAssetNameValid) {
                logDebug('Auto-Save: New cash asset detected with valid name. Attempting silent save.');
                saveCashAsset(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: New cash asset has no name. Discarding changes.');
            }
        }
    }


    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator();
    deselectCurrentShare();

    // NEW: Deselect current cash asset
    deselectCurrentCashAsset();
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    hideContextMenu();
    // NEW: Close the alert panel if open (alertPanel is not in current HTML, but kept for consistency)
    if (alertPanel) hideModal(alertPanel);
    logDebug('Modal: All modals closed.');

    // Clear any lingering active highlight on ASX code buttons when closing modals
    if (asxCodeButtonsContainer) {
        asxCodeButtonsContainer.querySelectorAll('button.asx-code-btn.active').forEach(btn=>btn.classList.remove('active'));
    }

    // Restore Target Price Alerts modal if share detail was opened from it (only if a share remains selected)
    if (wasShareDetailOpenedFromTargetAlerts) {
        if (selectedShareDocId) {
            logDebug('Restoring Target Price Alerts modal after closing share detail modal.');
            if (targetHitDetailsModal) {
                showModal(targetHitDetailsModal);
            }
        } else {
            logDebug('Skipping restore of Target Price Alerts modal because no share is selected.');
        }
        wasShareDetailOpenedFromTargetAlerts = false;
    }

    // Restore Share Detail modal only if it was the source AND a share is still selected
    if (wasEditOpenedFromShareDetail) {
        if (selectedShareDocId) {
            logDebug('Restoring Share Detail modal after closing edit modal.');
            if (shareDetailModal) {
                showModal(shareDetailModal);
            }
        } else {
            logDebug('Skipping restore of Share Detail modal because no share is selected.');
        }
        wasEditOpenedFromShareDetail = false;
    }
}

// Toast-based lightweight alert; keeps API but renders a toast instead of blocking modal
function showCustomAlert(message, duration = 3000, type = 'info') {
    // Enforce minimum on-screen time of 3000ms unless explicitly sticky (0)
    const effectiveDuration = (duration === 0) ? 0 : Math.max(duration || 3000, 3000);
    try {
        const container = document.getElementById('toastContainer');
        if (container) {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.setAttribute('role', 'status');
            toast.innerHTML = `<span class="icon"></span><div class="message"></div><button class="close" aria-label="Dismiss">×</button>`;
            toast.querySelector('.message').textContent = message;
            const remove = () => { toast.classList.remove('show'); setTimeout(()=> toast.remove(), 200); };
            toast.querySelector('.close').addEventListener('click', remove);
            container.appendChild(toast);
            requestAnimationFrame(()=> toast.classList.add('show'));
            if (effectiveDuration && effectiveDuration > 0) setTimeout(remove, effectiveDuration);
            return;
        }
    } catch (e) { console.warn('Toast render failed, using alert fallback.', e); }
    // Minimal fallback
    try { window.alert(message); } catch(_) { console.log('ALERT:', message); }
}

// ToastManager: centralized API
const ToastManager = (() => {
    const container = () => document.getElementById('toastContainer');
    const makeToast = (opts) => {
        const root = container();
        if (!root) return null;
        const { message, type = 'info', duration = 2000, actions = [] } = opts || {};
        // Enforce minimum 3000ms for auto-dismiss unless explicitly sticky (0)
        const effectiveDuration = (duration === 0) ? 0 : Math.max(duration || 3000, 3000);
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        const iconHTML = `<span class="icon"></span>`;
        const msgHTML = `<div class="message"></div>`;
        const actionsHTML = actions.length ? `<div class="actions">${actions.map(a=>`<button class=\"btn ${a.variant||''}\">${a.label}</button>`).join('')}</div>` : '';
        const closeHTML = `<button class="close" aria-label="Dismiss">×</button>`;
        toast.innerHTML = `${iconHTML}${msgHTML}${actionsHTML}${closeHTML}`;
        toast.querySelector('.message').textContent = message || '';
        const closeBtn = toast.querySelector('.close');
        const remove = () => { toast.classList.remove('show'); setTimeout(()=> toast.remove(), 200); };
        closeBtn.addEventListener('click', remove);
        // Wire actions
        const actionBtns = toast.querySelectorAll('.actions .btn');
        actionBtns.forEach((btn, idx) => {
            const cfg = actions[idx];
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                try { cfg && typeof cfg.onClick === 'function' && cfg.onClick(); } finally { remove(); }
            });
        });
        root.appendChild(toast);
        requestAnimationFrame(()=> toast.classList.add('show'));
        if (effectiveDuration && effectiveDuration > 0) setTimeout(remove, effectiveDuration);
        return { el: toast, close: remove };
    };
    return {
    info: (message, duration=3000) => makeToast({ message, type:'info', duration }),
    success: (message, duration=3000) => makeToast({ message, type:'success', duration }),
    error: (message, duration=3000) => makeToast({ message, type:'error', duration }),
        confirm: (message, { confirmText='Yes', cancelText='No', onConfirm, onCancel } = {}) => {
            return makeToast({
                message,
                type: 'info',
                duration: 0, // sticky until action
                actions: [
                    { label: confirmText, variant: 'primary', onClick: () => { onConfirm && onConfirm(true); } },
                    { label: cancelText, variant: 'danger', onClick: () => { onCancel && onCancel(false); } }
                ]
            });
        }
    };
})();

// Migrate confirm dialog to toast confirm (non-blocking UX)
function showCustomConfirm(message, callback) {
    const res = ToastManager.confirm(message, {
        confirmText: 'Yes',
        cancelText: 'No',
        onConfirm: () => callback(true),
        onCancel: () => callback(false)
    });
    if (!res) {
        // Fallback to native confirm if container missing
        callback(window.confirm(message));
    }
}

// Date Formatting Helper Functions (Australian Style)
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * A centralized helper function to compute all display-related data for a share.
 * This avoids duplicating complex logic in multiple rendering functions.
 * @param {object} share The share object.
 * @returns {object} An object containing calculated values for display.
 */
function getShareDisplayData(share) {
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const isMarketOpen = isAsxMarketOpen();

    let displayLivePrice = 'N/A';
    let displayPriceChange = '';
    let priceClass = '';
    let cardPriceChangeClass = '';
    let yieldDisplayTable = '';
    let yieldDisplayMobile = '';
    let peRatio = 'N/A';
    let high52Week = 'N/A';
    let low52Week = 'N/A';

    if (livePriceData) {
        const currentLivePrice = livePriceData.live;
        const previousClosePrice = livePriceData.prevClose;
        const lastFetchedLive = livePriceData.lastLivePrice;
        const lastFetchedPrevClose = livePriceData.lastPrevClose;

    peRatio = livePriceData.PE !== null && !isNaN(livePriceData.PE) ? formatAdaptivePrice(livePriceData.PE) : 'N/A';
    high52Week = livePriceData.High52 !== null && !isNaN(livePriceData.High52) ? formatMoney(livePriceData.High52) : 'N/A';
    low52Week = livePriceData.Low52 !== null && !isNaN(livePriceData.Low52) ? formatMoney(livePriceData.Low52) : 'N/A';

    if (isMarketOpen) {
            if (currentLivePrice !== null && !isNaN(currentLivePrice)) {
                displayLivePrice = formatMoney(currentLivePrice);
            }
            if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) {
                const change = currentLivePrice - previousClosePrice;
                const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : '');
            } else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                const change = lastFetchedLive - lastFetchedPrevClose;
                const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : '');
            }
        } else {
            displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? formatMoney(lastFetchedLive) : 'N/A';
            displayPriceChange = '0.00 (0.00%)';
            priceClass = 'neutral';
            cardPriceChangeClass = '';
        }
    }

    // Apply movement background classes consistently
    try {
        let changeVal = null;
        if (livePriceData) {
            if (livePriceData.live != null && livePriceData.prevClose != null && !isNaN(livePriceData.live) && !isNaN(livePriceData.prevClose)) {
                changeVal = livePriceData.live - livePriceData.prevClose;
            } else if (livePriceData.lastLivePrice != null && livePriceData.lastPrevClose != null && !isNaN(livePriceData.lastLivePrice) && !isNaN(livePriceData.lastPrevClose)) {
                changeVal = livePriceData.lastLivePrice - livePriceData.lastPrevClose;
            }
        }
        row.classList.remove('positive-change-row','negative-change-row','neutral-change-row');
    // Ensure unified side border helper present
    if (!row.classList.contains('movement-sides')) row.classList.add('movement-sides');
        if (changeVal > 0) row.classList.add('positive-change-row');
        else if (changeVal < 0) row.classList.add('negative-change-row');
        else row.classList.add('neutral-change-row');
    } catch(_) {}

    return {
        displayLivePrice,
        displayPriceChange,
        priceClass,
        cardPriceChangeClass,
        peRatio,
        high52Week,
        low52Week
    };
}
// --- UI State Management Functions ---

// Accordion (Share Form) Initialization
function initShareFormAccordion(force = false) {
    const root = document.getElementById('shareFormAccordion');
    if (!root) return;
    if (root.dataset.accordionInit && !force) return; // idempotent
    const sections = root.querySelectorAll('.accordion-section');
    sections.forEach(sec => {
        const isCore = sec.getAttribute('data-section') === 'core';
        if (isCore) sec.classList.add('open'); else sec.classList.remove('open');
        const toggleBtn = sec.querySelector('.accordion-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(isCore));
    });
    // Event delegation for reliability
    root.addEventListener('click', (e) => {
        const header = e.target.closest('.accordion-toggle');
        if (!header || !root.contains(header)) return;
        e.preventDefault();
        const section = header.closest('.accordion-section');
        if (!section) return;
        toggleAccordionSection(section);
    });
    root.dataset.accordionInit = 'true';
}

// Watchlist pulse guidance
function updateWatchlistPulse(isNewShareContext = false) {
    if (!shareWatchlistDropdownBtn || !shareWatchlistSelect) return;
    const selected = Array.from(shareWatchlistCheckboxes?.querySelectorAll('input[type="checkbox"]:checked') || []).length > 0 || (shareWatchlistSelect.value && shareWatchlistSelect.value !== '');
    if (isNewShareContext && !selected) {
        shareWatchlistDropdownBtn.classList.add('watchlist-pulse');
    } else {
        shareWatchlistDropdownBtn.classList.remove('watchlist-pulse');
    }
}

// Hook into existing populateShareWatchlistSelect to reapply pulse after population
const originalPopulateShareWatchlistSelect = typeof populateShareWatchlistSelect === 'function' ? populateShareWatchlistSelect : null;
if (originalPopulateShareWatchlistSelect) {
    window.populateShareWatchlistSelect = function(currentShareWatchlistId = null, isNewShare = true) {
        const res = originalPopulateShareWatchlistSelect(currentShareWatchlistId, isNewShare);
        // Defer to ensure DOM checkboxes inserted
        setTimeout(() => updateWatchlistPulse(isNewShare), 30);
        return res;
    };
}

// Monitor checkbox changes
document.addEventListener('change', (e) => {
    if (!shareWatchlistDropdownBtn) return;
    if (e.target && shareWatchlistCheckboxes && shareWatchlistCheckboxes.contains(e.target)) {
        updateWatchlistPulse(true); // assume add flow while editing selection
    }
});

// Remove pulse once dropdown is opened and a selection likely imminent
if (shareWatchlistDropdownBtn) {
    shareWatchlistDropdownBtn.addEventListener('click', () => {
        // Brief delay in case menu opens and user immediately picks
        setTimeout(() => updateWatchlistPulse(true), 500);
    });
}

function toggleAccordionSection(section) {
    const toggleBtn = section.querySelector('.accordion-toggle');
    if (!toggleBtn) return;
    const opening = !section.classList.contains('open');
    section.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', String(opening));
    if (opening && window.innerWidth < 650) {
        setTimeout(() => {
            try { toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e) {}
        }, 30);
    }
}

// Initialize accordion when DOM ready; also on modal open via observer fallback
document.addEventListener('DOMContentLoaded', () => {
    initShareFormAccordion();
});

// MutationObserver safety net: if form content is replaced dynamically later
const accordionObserver = new MutationObserver(() => {
    const root = document.getElementById('shareFormAccordion');
    if (root && !root.dataset.accordionInit) initShareFormAccordion(true);
});
try { accordionObserver.observe(document.body, { childList: true, subtree: true }); } catch(e) {}

/**
 * Adds a single share to the desktop table view.
 * @param {object} share The share object to add.
 */
function addShareToTable(share) {
    if (!shareTableBody) {
        console.error('addShareToTable: shareTableBody element not found.');
        return;
    }

    const row = document.createElement('tr');
    row.dataset.docId = share.id;

    // Add click listener to open share details modal
    row.addEventListener('click', () => {
        logDebug('Table Row Click: Share ID: ' + share.id);
        selectShare(share.id);
        // If this row is inside the Target Price Alerts modal, set the restoration flag
        if (row.closest('#targetHitSharesList')) {
            wasShareDetailOpenedFromTargetAlerts = true;
        }
        showShareDetails();
    });

    // Check if target price is hit for this share
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const isTargetHit = livePriceData ? livePriceData.targetHit : false;

    // Apply target-hit-alert class if target is hit AND not dismissed
    if (isTargetHit && !targetHitIconDismissed) {
        row.classList.add('target-hit-alert');
    } else {
        row.classList.remove('target-hit-alert'); // Ensure class is removed if conditions are not met
    }

    // Use the new helper function to get all display data
    const displayData = getShareDisplayData(share);

    // AGGRESSIVE FIX: Get company name from ASX codes for display in table
    const companyInfo = allAsxCodes.find(c => c.code === share.shareName.toUpperCase());
    const companyName = companyInfo ? companyInfo.name : '';

    row.innerHTML = `
        <td>
            <span class="share-code-display ${displayData.priceClass}">${share.shareName || ''}</span>
            ${companyName ? `<br><small style="font-size: 0.8em; color: var(--ghosted-text); font-weight: 400;">${companyName}</small>` : ''}
        </td>
        <td class="live-price-cell">
            <span class="live-price-value ${displayData.priceClass}">${displayData.displayLivePrice}</span>
            <span class="price-change ${displayData.priceClass}">${displayData.displayPriceChange}</span>
        </td>
        <td class="numeric-data-cell">${formatMoney(Number(share.targetPrice), { hideZero: true })}</td>
    <td class="numeric-data-cell">${formatMoney(Number(share.currentPrice), { hideZero: true })}</td>
        <td class="star-rating-cell numeric-data-cell">
            ${share.starRating > 0 ? '⭐ ' + share.starRating : ''}
        </td>
        <td class="numeric-data-cell">
            ${
                (() => {
                    const dividendAmount = Number(share.dividendAmount) || 0;
                    const frankingCredits = Number(share.frankingCredits) || 0;
                    const enteredPrice = Number(share.currentPrice) || 0;
                    const priceForYield = (displayData.displayLivePrice !== 'N/A' && displayData.displayLivePrice.startsWith('$'))
                                        ? parseFloat(displayData.displayLivePrice.substring(1))
                                        : (enteredPrice > 0 ? enteredPrice : 0);
                    if (priceForYield === 0 || (dividendAmount === 0 && frankingCredits === 0)) return '';
                    const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits);
                    const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield);
                    if (frankingCredits > 0 && frankedYield > 0) {
                        return formatAdaptivePercent(frankedYield) + '% (F)';
                    } else if (unfrankedYield > 0) {
                        return formatAdaptivePercent(unfrankedYield) + '% (U)';
                    }
                    return '';
                })()
            }
        </td>
    `;

    // Apply movement class (positive/negative/neutral)
    try {
        const lp = livePrices[share.shareName.toUpperCase()];
        let change = null;
        if (lp && lp.live != null && lp.prevClose != null && !isNaN(lp.live) && !isNaN(lp.prevClose)) change = lp.live - lp.prevClose;
        row.classList.remove('positive-change-row','negative-change-row','neutral-change-row');
    if (!row.classList.contains('movement-sides')) row.classList.add('movement-sides');
        if (change > 0) row.classList.add('positive-change-row');
        else if (change < 0) row.classList.add('negative-change-row');
        else row.classList.add('neutral-change-row');
    } catch(_) {}

    // Add long press / context menu for desktop
    let touchStartTime = 0;
    row.addEventListener('touchstart', (e) => {
        // Mobile long-hold disabled intentionally: do nothing special
        touchStartTime = Date.now();
        selectedElementForTap = row;
    }, { passive: true });

    row.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dist = Math.sqrt(Math.pow(currentX - touchStartX, 2) + Math.pow(currentY - touchStartY, 2));
        if (dist > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            touchStartTime = 0; // Reset
        }
    });

    row.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (Date.now() - touchStartTime < LONG_PRESS_THRESHOLD && selectedElementForTap === row) {
            // This is a short tap, let the click event handler fire naturally if it hasn't been prevented.
            // No explicit click() call needed here as a short tap naturally dispatches click.
        }
        touchStartTime = 0;
        selectedElementForTap = null;
    });


    // Right-click / Context menu for desktop
    row.addEventListener('contextmenu', (e) => {
        if (window.innerWidth > 768) { // Only enable on desktop
            e.preventDefault();
            selectShare(share.id);
            showContextMenu(e, share.id);
        }
    });

    shareTableBody.appendChild(row);
    logDebug('Table: Added share ' + share.shareName + ' to table.');
}

function addShareToMobileCards(share) {
    if (!mobileShareCardsContainer) {
        console.error('addShareToMobileCards: mobileShareCardsContainer element not found.');
        return;
    }

    const card = document.createElement('div');
    card.classList.add('mobile-card');
    card.dataset.docId = share.id;

    // Check if target price is hit for this share
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const isTargetHit = livePriceData ? livePriceData.targetHit : false;

    // Declare these variables once at the top of the function
    const isMarketOpen = isAsxMarketOpen();
    let displayLivePrice = 'N/A';
    let displayPriceChange = '';
    let priceClass = '';
    let cardPriceChangeClass = ''; // NEW: For subtle background tints and vertical lines

    // Logic to determine display values and card-specific classes
    if (livePriceData) {
        const currentLivePrice = livePriceData.live;
        const previousClosePrice = livePriceData.prevClose;
        const lastFetchedLive = livePriceData.lastLivePrice;
        const lastFetchedPrevClose = livePriceData.lastPrevClose;

    if (isMarketOpen) {
            // Show live data if market is open, or if market is closed but toggle is ON
            if (currentLivePrice !== null && !isNaN(currentLivePrice)) {
                displayLivePrice = '$' + formatAdaptivePrice(currentLivePrice);
            }
            if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) {
                const change = currentLivePrice - previousClosePrice;
                const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0); // Corrected: use previousClosePrice
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : 'neutral-change-card'); // Include neutral class
            } else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                // Fallback to last fetched values if current live/prevClose are null but lastFetched are present
                const change = lastFetchedLive - lastFetchedPrevClose;
                const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : 'neutral-change-card');
            }
        } else {
            // Market closed and toggle is OFF, show zero change
            displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + formatAdaptivePrice(lastFetchedLive) : 'N/A';
            displayPriceChange = '0.00 (0.00%)';
            priceClass = 'neutral';
            cardPriceChangeClass = ''; // No tint/line for neutral or market closed
        }
    }

    // Apply card-specific price change class
    if (cardPriceChangeClass) {
        card.classList.add(cardPriceChangeClass);
    }

    // Apply target-hit-alert class if target is hit AND not dismissed
    if (isTargetHit && !targetHitIconDismissed) {
        card.classList.add('target-hit-alert');
    } else {
        card.classList.remove('target-hit-alert'); // Ensure class is removed if conditions are not met
    }

    // Logic to determine display values
    if (livePriceData) {
        const currentLivePrice = livePriceData.live;
        const previousClosePrice = livePriceData.prevClose;
        const lastFetchedLive = livePriceData.lastLivePrice;
        const lastFetchedPrevClose = livePriceData.lastPrevClose;

    if (isMarketOpen) {
            // Show live data if market is open, or if market is closed but toggle is ON
            if (currentLivePrice !== null && !isNaN(currentLivePrice)) {
                displayLivePrice = '$' + formatAdaptivePrice(currentLivePrice);
            }
            if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) {
                const change = currentLivePrice - previousClosePrice;
                const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0); // Corrected: use previousClosePrice
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
            } else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                // Fallback to last fetched values if current live/prevClose are null but lastFetched are present
                const change = lastFetchedLive - lastFetchedPrevClose;
                const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
            }
        } else {
            // Market closed and toggle is OFF, show zero change
            displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + formatAdaptivePrice(lastFetchedLive) : 'N/A';
            displayPriceChange = '0.00 (0.00%)';
            priceClass = 'neutral';
        }
    }

    // AGGRESSIVE FIX: Get company name from ASX codes for display
    const companyInfo = allAsxCodes.find(c => c.code === share.shareName.toUpperCase());
    const companyName = companyInfo ? companyInfo.name : '';

    // Build directional arrow for displayPriceChange (keep underlying displayPriceChange variable intact for accessibility if needed)
    let arrowSymbol = '';
    if (/^[-+]?\d/.test(displayPriceChange)) { /* heuristic; actual change variable exists above but reused */ }
    try {
        const matchChange = /([-+]?\d*[\d.,]*)(?:\s*\(|$)/.exec(displayPriceChange);
        // We already computed priceClass; use that for arrow
        arrowSymbol = priceClass === 'positive' ? '▲' : (priceClass === 'negative' ? '▼' : '');
    } catch(_) {}
    const enrichedPriceChange = arrowSymbol ? `${arrowSymbol} ${displayPriceChange}` : displayPriceChange;
    card.innerHTML = `
        <div class="live-price-display-section">
            <h3 class="neutral-code-text">${share.shareName || ''}</h3>
            <span class="change-chevron ${priceClass}">${arrowSymbol || ''}</span>
            <div class="live-price-main-row">
                <span class="live-price-large neutral-code-text">${displayLivePrice}</span>
            </div>
            <span class="price-change-large ${priceClass}">${displayPriceChange}</span>
            <div class="fifty-two-week-row">
                <span class="fifty-two-week-value low">Low: ${livePriceData && livePriceData.Low52 !== null && !isNaN(livePriceData.Low52) ? formatMoney(livePriceData.Low52) : 'N/A'}</span>
                <span class="fifty-two-week-value high">High: ${livePriceData && livePriceData.High52 !== null && !isNaN(livePriceData.High52) ? formatMoney(livePriceData.High52) : 'N/A'}</span>
            </div>
            <div class="pe-ratio-row">
                <span class="pe-ratio-value">P/E: ${livePriceData && livePriceData.PE !== null && !isNaN(livePriceData.PE) ? formatAdaptivePrice(livePriceData.PE) : 'N/A'}</span>
            </div>
        </div>
    <p class="data-row"><span class="label-text">Reference Price:</span><span class="data-value">${formatMoney(Number(share.currentPrice), { hideZero: true })}</span></p>
    <p class="data-row"><span class="label-text">Target Price:</span><span class="data-value">${formatMoney(Number(share.targetPrice), { hideZero: true })}</span></p>
        <p class="data-row"><span class="label-text">Star Rating:</span><span class="data-value">${share.starRating > 0 ? '⭐ ' + share.starRating : ''}</span></p>
        <p class="data-row">
            <span class="label-text">Dividend Yield:</span>
            <span class="data-value">
            ${
                // Determine the effective yield for display in mobile cards
                // Prioritize franked yield if franking credits are present and yield is valid, otherwise use unfranked yield
                // Default to empty string if no valid yield can be calculated or if calculated yield is 0
                (() => {
                    const dividendAmount = Number(share.dividendAmount) || 0;
                    const frankingCredits = Number(share.frankingCredits) || 0;
                    const enteredPrice = Number(share.currentPrice) || 0; // Fallback for entered price if live not available

                    // Use the price that is actually displayed for yield calculation if possible
                    // If displayLivePrice is 'N/A', use enteredPrice from share object
                    const priceForYield = (displayLivePrice !== 'N/A' && displayLivePrice.startsWith('$'))
                                        ? parseFloat(displayLivePrice.substring(1))
                                        : (enteredPrice > 0 ? enteredPrice : 0);

                    // If price for yield is 0, or if both dividend and franking are 0, return empty string
                    if (priceForYield === 0 || (dividendAmount === 0 && frankingCredits === 0)) return '';

                    const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits);
                    const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield);

                    if (frankingCredits > 0 && frankedYield > 0) {
                        return formatAdaptivePercent(frankedYield) + '% (Franked)';
                    } else if (unfrankedYield > 0) {
                        return formatAdaptivePercent(unfrankedYield) + '% (Unfranked)';
                    }
                    return ''; // No valid yield or yield is 0, display empty string
                })()
            }
            </span>
        </p>
`;

    card.addEventListener('click', () => {
        logDebug('Mobile Card Click: Share ID: ' + share.id);
        selectShare(share.id);
        showShareDetails();
    });

    // Add long press / context menu for mobile
    let touchStartTime = 0;
    card.addEventListener('touchstart', () => {
        // Long-hold disabled
        touchStartTime = Date.now();
        selectedElementForTap = card;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dist = Math.sqrt(Math.pow(currentX - touchStartX, 2) + Math.pow(currentY - touchStartY, 2));
        if (dist > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            touchStartTime = 0; // Reset
        }
    });

    card.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (Date.now() - touchStartTime < LONG_PRESS_THRESHOLD && selectedElementForTap === card) {
            // This is a short tap, let the click event handler fire naturally if it hasn't been prevented.
            // No explicit click() call needed here as a short tap naturally dispatches click.
        }
        touchStartTime = 0;
        selectedElementForTap = null;
    });

    mobileShareCardsContainer.appendChild(card);
    logDebug('Mobile Cards: Added share ' + share.shareName + ' to mobile cards.');
}
/**
 * Updates an existing share row in the table or creates a new one if it doesn't exist.
 * @param {object} share The share object.
 */
function updateOrCreateShareTableRow(share) {
    if (!shareTableBody) {
        console.error('updateOrCreateShareTableRow: shareTableBody element not found.');
        return;
    }

    let row = shareTableBody.querySelector(`tr[data-doc-id="${share.id}"]`);

    if (!row) {
        row = document.createElement('tr');
        row.dataset.docId = share.id;
        // Add event listeners only once when the row is created
        row.addEventListener('click', () => {
            logDebug('Table Row Click: Share ID: ' + share.id);
            selectShare(share.id);
            showShareDetails();
        });

        let touchStartTime = 0;
        row.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            selectedElementForTap = row;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;

            longPressTimer = setTimeout(() => {
                if (Date.now() - touchStartTime >= LONG_PRESS_THRESHOLD) {
                    selectShare(share.id);
                    showContextMenu(e, share.id);
                    e.preventDefault();
                }
            }, LONG_PRESS_THRESHOLD);
        }, { passive: false });

        row.addEventListener('touchmove', (e) => {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const dist = Math.sqrt(Math.pow(currentX - touchStartX, 2) + Math.pow(currentY - touchStartY, 2));
            if (dist > TOUCH_MOVE_THRESHOLD) {
                clearTimeout(longPressTimer);
                touchStartTime = 0;
            }
        });

        row.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
            if (Date.now() - touchStartTime < LONG_PRESS_THRESHOLD && selectedElementForTap === row) {
                // Short tap handled by click event
            }
            touchStartTime = 0;
            selectedElementForTap = null;
        });

        row.addEventListener('contextmenu', (e) => {
            if (window.innerWidth > 768) {
                e.preventDefault();
                selectShare(share.id);
                showContextMenu(e, share.id);
            }
        });

        shareTableBody.appendChild(row); // Append new rows at the end, sorting will reorder virtually
        logDebug('Table: Created new row for share ' + share.shareName + '.');
    }

    // Always update the content and classes for existing (or newly created) rows
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const isTargetHit = livePriceData ? livePriceData.targetHit : false;

    // Apply target-hit-alert class if target is hit AND not dismissed
    if (isTargetHit && !targetHitIconDismissed) {
        row.classList.add('target-hit-alert');
    } else {
        row.classList.remove('target-hit-alert');
    }

    const isMarketOpen = isAsxMarketOpen();
    let displayLivePrice = 'N/A';
    let displayPriceChange = '';
    let priceClass = '';

    if (livePriceData) {
        const currentLivePrice = livePriceData.live;
        const previousClosePrice = livePriceData.prevClose;
        const lastFetchedLive = livePriceData.lastLivePrice;
        const lastFetchedPrevClose = livePriceData.lastPrevClose;

    if (isMarketOpen) {
            if (currentLivePrice !== null && !isNaN(currentLivePrice)) {
                displayLivePrice = '$' + formatAdaptivePrice(currentLivePrice);
            }
            if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) {
                const change = currentLivePrice - previousClosePrice;
                const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
            } else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                const change = lastFetchedLive - lastFetchedPrevClose;
                const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
            }
        } else {
            displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + formatAdaptivePrice(lastFetchedLive) : 'N/A';
            displayPriceChange = '0.00 (0.00%)';
            priceClass = 'neutral';
        }
    }

    const dividendAmount = Number(share.dividendAmount) || 0;
    const frankingCredits = Number(share.frankingCredits) || 0;
    const enteredPrice = Number(share.currentPrice) || 0;
    const priceForYield = (displayLivePrice !== 'N/A' && displayLivePrice.startsWith('$'))
                            ? parseFloat(displayLivePrice.substring(1))
                            : (enteredPrice > 0 ? enteredPrice : 0);

    const yieldDisplay = (() => {
        // If price for yield is 0, or if both dividend and franking are 0, return empty string
        if (priceForYield === 0 || (dividendAmount === 0 && frankingCredits === 0)) return '';
        const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits);
        const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield);
        if (frankingCredits > 0 && frankedYield > 0) {
            return formatAdaptivePercent(frankedYield) + '% (F)';
        } else if (unfrankedYield > 0) {
            return formatAdaptivePercent(unfrankedYield) + '% (U)';
        }
        return ''; // No valid yield or yield is 0, display empty string
    })();

    const companyInfo = allAsxCodes.find(c => c.code === share.shareName.toUpperCase());
    const companyName = companyInfo ? companyInfo.name : '';

    row.innerHTML = `
        <td>
            <span class="share-code-display ${priceClass}">${share.shareName || ''}</span>
            ${companyName ? `<br><small style="font-size: 0.8em; color: var(--ghosted-text); font-weight: 400;">${companyName}</small>` : ''}
        </td>
        <td class="live-price-cell">
            <span class="live-price-value ${priceClass}">${displayLivePrice}</span>
            <span class="price-change ${priceClass}">${displayPriceChange}</span>
        </td>
    <td class="numeric-data-cell">${formatMoney(Number(share.targetPrice), { hideZero: true })}</td>
    <td class="numeric-data-cell">${formatMoney(Number(share.currentPrice), { hideZero: true })}</td>
        <td class="star-rating-cell numeric-data-cell">
            ${share.starRating > 0 ? '⭐ ' + share.starRating : ''}
        </td>
        <td class="numeric-data-cell">${yieldDisplay}</td>
    `;

    logDebug('Table: Updated/Created row for share ' + share.shareName + '.');
}

/**
 * Updates an existing share card or creates a new one if it doesn't exist.
 * @param {object} share The share object.
 */
function updateOrCreateShareMobileCard(share) {
    if (!mobileShareCardsContainer) {
        console.error('updateOrCreateShareMobileCard: mobileShareCardsContainer element not found.');
        return;
    }

    let card = mobileShareCardsContainer.querySelector(`div[data-doc-id="${share.id}"]`);

    if (!card) {
        card = document.createElement('div');
        card.classList.add('mobile-card');
        card.dataset.docId = share.id;
        // Add event listeners only once when the card is created
        card.addEventListener('click', () => {
            logDebug('Mobile Card Click: Share ID: ' + share.id);
            selectShare(share.id);
            showShareDetails();
        });

    // Mobile long-press disabled: we intentionally do NOT attach context-menu touch handlers.
    // Simple tap already handled by click listener above; no-op touch listeners keep scroll smooth.
    card.addEventListener('touchstart', () => { selectedElementForTap = card; }, { passive: true });
    card.addEventListener('touchend', () => { selectedElementForTap = null; }, { passive: true });

        mobileShareCardsContainer.appendChild(card); // Append new cards at the end, sorting will reorder virtually
        logDebug('Mobile Cards: Created new card for share ' + share.shareName + '.');
    }

    // Always update the content and classes for existing (or newly created) cards
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const isTargetHit = livePriceData ? livePriceData.targetHit : false;

    // Apply target-hit-alert class if target is hit AND not dismissed
    if (isTargetHit && !targetHitIconDismissed) {
        card.classList.add('target-hit-alert');
    } else {
        card.classList.remove('target-hit-alert');
    }

    const isMarketOpen = isAsxMarketOpen();
    let displayLivePrice = 'N/A';
    let displayPriceChange = '';
    let priceClass = '';
    let cardPriceChangeClass = '';

    if (livePriceData) {
        const currentLivePrice = livePriceData.live;
        const previousClosePrice = livePriceData.prevClose;
        const lastFetchedLive = livePriceData.lastLivePrice;
        const lastFetchedPrevClose = livePriceData.lastPrevClose;

        if (isMarketOpen) {
                if (currentLivePrice !== null && !isNaN(currentLivePrice)) {
                    displayLivePrice = '$' + formatAdaptivePrice(currentLivePrice);
                }
                if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) {
                    const change = currentLivePrice - previousClosePrice;
                    const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                    displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                    priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                    cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : 'neutral-change-card');
                } else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                    const change = lastFetchedLive - lastFetchedPrevClose;
                    const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                    displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                    priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                    cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : 'neutral-change-card');
                }
            } else {
                displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + formatAdaptivePrice(lastFetchedLive) : 'N/A';
                if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                    const change = lastFetchedLive - lastFetchedPrevClose;
                    const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                    displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                    priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                    cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : 'neutral-change-card');
                } else {
                    displayPriceChange = '0.00 (0.00%)';
                    priceClass = 'neutral';
                    cardPriceChangeClass = 'neutral-change-card';
                }
            }
    }

    // Apply card-specific price change class
    // Remove previous price change classes before adding current one
    card.classList.remove('positive-change-card', 'negative-change-card', 'neutral-change-card');
    if (cardPriceChangeClass) {
        card.classList.add(cardPriceChangeClass);
    } else if (priceClass === 'neutral') {
        // Tag neutral cards for muted coffee fill styling
        card.classList.add('neutral');
    }
    // Ensure unified side border helper present
    if (!card.classList.contains('movement-sides')) card.classList.add('movement-sides');

    const dividendAmount = Number(share.dividendAmount) || 0;
    const frankingCredits = Number(share.frankingCredits) || 0;
    const enteredPrice = Number(share.currentPrice) || 0;
    const priceForYield = (displayLivePrice !== 'N/A' && displayLivePrice.startsWith('$'))
                            ? parseFloat(displayLivePrice.substring(1))
                            : (enteredPrice > 0 ? enteredPrice : 0);

    const yieldDisplay = (() => {
        // If price for yield is 0, or if both dividend and franking are 0, return empty string
        if (priceForYield === 0 || (dividendAmount === 0 && frankingCredits === 0)) return '';
        const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits);
        const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield);
        if (frankingCredits > 0 && frankedYield > 0) {
            return formatAdaptivePercent(frankedYield) + '% (Franked)';
        } else if (unfrankedYield > 0) {
            return formatAdaptivePercent(unfrankedYield) + '% (Unfranked)';
        }
        return ''; // No valid yield or yield is 0, display empty string
    })();


    // Look up company name for display under percentage change
    const companyInfo = allAsxCodes.find(c => c.code === share.shareName.toUpperCase());
    const companyName = companyInfo ? companyInfo.name : '';

    const arrowSymbol = priceClass === 'positive' ? '▲' : (priceClass === 'negative' ? '▼' : '');
    // Markup: direct grid items without inner container to avoid unwanted box
    card.innerHTML = `
        <h3 class="neutral-code-text card-code">${share.shareName || ''}</h3>
        <span class="change-chevron ${priceClass} card-chevron">${arrowSymbol}</span>
        <span class="live-price-large neutral-code-text card-live-price">${displayLivePrice}</span>
        <span class="price-change-large ${priceClass} card-price-change">${displayPriceChange}</span>
        <p class="data-row"><span class="label-text">Entered Price:</span><span class="data-value">${(val => (val !== null && !isNaN(val) && val !== 0) ? '$' + formatAdaptivePrice(val) : '')(Number(share.currentPrice))}</span></p>
        <p class="data-row"><span class="label-text">Target Price:</span><span class="data-value">${(val => (val !== null && !isNaN(val) && val !== 0) ? '$' + formatAdaptivePrice(val) : '')(Number(share.targetPrice))}</span></p>
        <p class="data-row"><span class="label-text">Star Rating:</span><span class="data-value">${share.starRating > 0 ? '⭐ ' + share.starRating : ''}</span></p>
        <p class="data-row"><span class="label-text">Dividend Yield:</span><span class="data-value">${yieldDisplay}</span></p>
    `;

    // Re-apply selected class if it was previously selected
    if (selectedShareDocId === share.id) {
        card.classList.add('selected');
    }

    logDebug('Mobile Cards: Updated/Created card for share ' + share.shareName + '.');
}

function updateMainButtonsState(enable) {
    logDebug('UI State: Setting main buttons state to: ' + (enable ? 'ENABLED' : 'DISABLED'));
    if (newShareBtn) newShareBtn.disabled = !enable;
    if (standardCalcBtn) standardCalcBtn.disabled = !enable;
    if (dividendCalcBtn) dividendCalcBtn.disabled = !enable;
    if (exportWatchlistBtn) exportWatchlistBtn.disabled = !enable;
    if (addWatchlistBtn) addWatchlistBtn.disabled = !enable;
    if (editWatchlistBtn) {
        const selectedValue = watchlistSelect ? watchlistSelect.value : '';
        // Enable button if there's a selected watchlist and it's not ALL_SHARES or CASH_BANK
        const isAnEditableWatchlistSelected = selectedValue && selectedValue !== ALL_SHARES_ID && selectedValue !== CASH_BANK_WATCHLIST_ID;
        // Remove extra conditions and only check if an editable watchlist is selected
        editWatchlistBtn.disabled = !isAnEditableWatchlistSelected;
        logDebug('Edit Watchlist Button State: ' + (editWatchlistBtn.disabled ? 'disabled' : 'enabled') + 
                ' (selectedValue=' + selectedValue + ', isEditable=' + isAnEditableWatchlistSelected + ')');
    }
    // addShareHeaderBtn is now contextual, its disabled state is managed by updateAddHeaderButton
    if (logoutBtn) setIconDisabled(logoutBtn, !enable); 
    if (themeToggleBtn) themeToggleBtn.disabled = !enable;
    if (colorThemeSelect) colorThemeSelect.disabled = !enable;
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.disabled = !enable;
    // sortSelect and watchlistSelect disabled state is managed by render functions
    if (refreshLivePricesBtn) refreshLivePricesBtn.disabled = !enable;
    
    // NEW: Disable/enable buttons specific to cash section
    // addCashCategoryBtn and saveCashBalancesBtn are removed from HTML/functionality is moved
    if (addCashAssetSidebarBtn) addCashAssetSidebarBtn.disabled = !enable;

    logDebug('UI State: Sort Select Disabled: ' + (sortSelect ? sortSelect.disabled : 'N/A'));
    logDebug('UI State: Watchlist Select Disabled: ' + (watchlistSelect ? watchlistSelect.disabled : 'N/A'));
}

/**
 * Enables or disables the 'Toggle Compact View' button based on screen width.
 * This feature is only intended for mobile views (<= 768px).
 */
function updateCompactViewButtonState() {
    if (!toggleCompactViewBtn) {
        return; // Exit if the button doesn't exist
    }
    // Always enable the button, regardless of screen width
    toggleCompactViewBtn.disabled = false;
    toggleCompactViewBtn.title = "Toggle between default and compact card view.";
    logDebug(`UI State: Compact view button enabled for all screen widths.`);
}

function showModal(modalElement) {
    if (modalElement) {
        // Push a new history state for every modal open
        pushAppState({ modalId: modalElement.id }, '', '');
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) {
            scrollableContent.scrollTop = 0;
        }
        // Defensive: ensure autocomplete listeners intact when opening Add Share form
        if (modalElement.id === 'shareFormSection') {
            try { if (typeof initializeShareNameAutocomplete === 'function') initializeShareNameAutocomplete(true); } catch(_) {}
        }
        logDebug('Modal: Showing modal: ' + modalElement.id);
    }
}

// Helper: Show modal without pushing a new browser/history state (used for modal-to-modal back restore)
function showModalNoHistory(modalElement) {
    if (!modalElement) return;
    modalElement.style.setProperty('display', 'flex', 'important');
    modalElement.scrollTop = 0;
    const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
    if (scrollableContent) scrollableContent.scrollTop = 0;
    logDebug('Modal (no-history): Showing modal: ' + modalElement.id);
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        logDebug('Modal: Hiding modal: ' + modalElement.id);
    }
}

// Extracted: auto-save logic for the share form so we can call it on back as well
function autoSaveShareFormOnClose() {
    if (!(shareFormSection && shareFormSection.style.display !== 'none')) return;
    const currentData = getCurrentFormData();
    const isShareNameValid = currentData.shareName.trim() !== '';
    if (selectedShareDocId) {
        if (originalShareData && !areShareDataEqual(originalShareData, currentData)) {
            logDebug('Auto-Save: Unsaved changes detected for existing share (back). Attempting silent save.');
            saveShareData(true);
        }
    } else {
        const isWatchlistSelected = shareWatchlistSelect && shareWatchlistSelect.value !== '';
        if (isShareNameValid && isWatchlistSelected) {
            logDebug('Auto-Save: New share with valid fields (back). Attempting silent save.');
            saveShareData(true);
        }
    }
}

function clearWatchlistUI() {
    if (!watchlistSelect) { console.error('clearWatchlistUI: watchlistSelect element not found.'); return; }
    // Always include Portfolio as a special option
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';
    const portfolioOption = document.createElement('option');
    portfolioOption.value = 'portfolio';
    portfolioOption.textContent = 'Portfolio';
    watchlistSelect.appendChild(portfolioOption);
    userWatchlists = [];
    currentSelectedWatchlistIds = [];
    logDebug('UI: Watchlist UI cleared.');
}

function clearShareListUI() {
    if (!shareTableBody) { console.error('clearShareListUI: shareTableBody element not found.'); return; }
    if (!mobileShareCardsContainer) { console.error('clearShareListUI: mobileShareCardsContainer element not found.'); return; }
    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';
    logDebug('UI: Share list UI cleared.');
}

function clearShareList() {
    clearShareListUI();
    if (asxCodeButtonsContainer) asxCodeButtonsContainer.innerHTML = '';
    deselectCurrentShare();
    logDebug('UI: Full share list cleared (UI + buttons).');
}

function selectShare(shareId) {
    logDebug('Selection: Attempting to select share with ID: ' + shareId);
    deselectCurrentShare();

    const tableRow = document.querySelector('#shareTable tbody tr[data-doc-id="' + shareId + '"]');
    const mobileCard = document.querySelector('.mobile-card[data-doc-id="' + shareId + '"]');
    const portfolioRow = document.querySelector('#portfolioSection table.portfolio-table tbody tr[data-doc-id="' + shareId + '"]');

    if (tableRow) {
        tableRow.classList.add('selected');
        logDebug('Selection: Selected table row for ID: ' + shareId);
    }
    if (mobileCard) {
        mobileCard.classList.add('selected');
        logDebug('Selection: Selected mobile card for ID: ' + shareId);
    }
    if (portfolioRow) {
        portfolioRow.classList.add('selected');
        logDebug('Selection: Selected portfolio row for ID: ' + shareId);
    }
    selectedShareDocId = shareId;
}

function deselectCurrentShare() {
    const currentlySelected = document.querySelectorAll('.share-list-section tr.selected, .mobile-card.selected, #portfolioSection tr.selected');
    logDebug('Selection: Attempting to deselect ' + currentlySelected.length + ' elements.');
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedShareDocId = null;
    logDebug('Selection: Share deselected. selectedShareDocId is now null.');
}

// NEW: Select/Deselect for Cash Assets (3.1)
function selectCashAsset(assetId) {
    logDebug('Selection: Attempting to select cash asset with ID: ' + assetId);
    deselectCurrentCashAsset();

    const assetCard = document.querySelector('.cash-category-item[data-id="' + assetId + '"]');
    if (assetCard) {
        assetCard.classList.add('selected');
        logDebug('Selection: Selected cash asset card for ID: ' + assetId);
    }
    selectedCashAssetDocId = assetId;
}

function deselectCurrentCashAsset() {
    const currentlySelected = document.querySelectorAll('.cash-category-item.selected');
    logDebug('Selection: Attempting to deselect ' + currentlySelected.length + ' cash asset elements.');
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedCashAssetDocId = null;
    logDebug('Selection: Cash asset deselected. selectedCashAssetDocId is now null.');
}


function addCommentSection(container, title = '', text = '', isCashAssetComment = false) {
    if (!container) { console.error('addCommentSection: comments container not found.'); return; }
    const commentSectionDiv = document.createElement('div');
    commentSectionDiv.className = 'comment-section';
    commentSectionDiv.innerHTML = `
        <div class="comment-section-header">
            <input type="text" class="comment-title-input" placeholder="Comment Title" value="${title}">
            <button type="button" class="comment-delete-btn">&times;</button>
        </div>
        <textarea class="comment-text-input" placeholder="Your comments here...">${text}</textarea>
    `;
    container.appendChild(commentSectionDiv);
    
    const commentTitleInput = commentSectionDiv.querySelector('.comment-title-input');
    const commentTextInput = commentSectionDiv.querySelector('.comment-text-input');
    
    if (commentTitleInput) {
        commentTitleInput.addEventListener('input', isCashAssetComment ? checkCashAssetFormDirtyState : checkFormDirtyState);
    }
    if (commentTextInput) {
        commentTextInput.addEventListener('input', isCashAssetComment ? checkCashAssetFormDirtyState : checkFormDirtyState);
    }

    commentSectionDiv.querySelector('.comment-delete-btn').addEventListener('click', (event) => {
        logDebug('Comments: Delete comment button clicked.');
        event.target.closest('.comment-section').remove();
        isCashAssetComment ? checkCashAssetFormDirtyState() : checkFormDirtyState();
    });
    logDebug('Comments: Added new comment section.');
}

function clearForm() {
    formInputs.forEach(input => {
        if (input) { input.value = ''; }
    });
    // Explicitly clear portfolio fields
    const portfolioSharesInput = document.getElementById('portfolioShares');
    const portfolioAvgPriceInput = document.getElementById('portfolioAvgPrice');
    if (portfolioSharesInput) portfolioSharesInput.value = '';
    if (portfolioAvgPriceInput) portfolioAvgPriceInput.value = '';
    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.innerHTML = ''; // Clears ONLY the dynamically added comments
    }
    formTitle.textContent = 'Add New Share'; // Reset title
    if (formCompanyName) formCompanyName.textContent = ''; // Clear company name
    // NEW: Also clear the live price display when clearing the form
    if (addShareLivePriceDisplay) {
        addShareLivePriceDisplay.style.display = 'none';
        addShareLivePriceDisplay.innerHTML = '';
    }
    // Reset auto displays in Other Details
    try {
        if (autoEntryDateDisplay) { autoEntryDateDisplay.textContent = 'Auto when saved'; autoEntryDateDisplay.classList.add('ghosted-text'); }
        if (autoReferencePriceDisplay) { autoReferencePriceDisplay.textContent = 'Auto when saved'; autoReferencePriceDisplay.classList.add('ghosted-text'); }
    } catch(_) {}
    selectedShareDocId = null;
    originalShareData = null; // IMPORTANT: Reset original data to prevent auto-save of cancelled edits
    if (deleteShareBtn) {
        deleteShareBtn.classList.add('hidden');
        logDebug('clearForm: deleteShareBtn hidden.');
    }
    // Reset shareWatchlistSelect to its default placeholder
    if (shareWatchlistSelect) {
        shareWatchlistSelect.value = ''; // Set to empty string to select the disabled option
        shareWatchlistSelect.disabled = false; // Ensure it's enabled for new share entry
    }
    setIconDisabled(saveShareBtn, true); // Save button disabled on clear
    logDebug('Form: Form fields cleared and selectedShareDocId reset. saveShareBtn disabled.');
    // Reset auto details read-only placeholders
    if (autoEntryDateDisplay) {
        autoEntryDateDisplay.textContent = 'Auto when saved';
        autoEntryDateDisplay.classList.add('ghosted-text');
    }
    if (autoReferencePriceDisplay) {
        autoReferencePriceDisplay.textContent = 'Auto when saved';
        autoReferencePriceDisplay.classList.add('ghosted-text');
    }
}

/**
 * Populates the 'Assign to Watchlist' dropdown in the share form modal.
 * Sets the default selection based on current view or existing share.
 * @param {string|null} currentShareWatchlistId The ID of the watchlist the share is currently in (for editing).
 * @param {boolean} isNewShare True if adding a new share, false if editing.
*/
function populateShareWatchlistSelect(currentShareWatchlistId = null, isNewShare = true) {
    logDebug('populateShareWatchlistSelect called. isNewShare: ' + isNewShare + ', currentShareWatchlistId: ' + currentShareWatchlistId);
    logDebug('Current currentSelectedWatchlistIds: ' + currentSelectedWatchlistIds.join(', '));
    logDebug('User watchlists available: ' + userWatchlists.map(wl => wl.name + ' (' + wl.id + ')').join(', '));

    if (!shareWatchlistSelect) {
        console.error('populateShareWatchlistSelect: shareWatchlistSelect element not found.');
        return;
    }

    // Prepare native select (hidden) as multi-select for data binding; UI uses checkboxes
    try { shareWatchlistSelect.multiple = true; } catch(e) {}
    shareWatchlistSelect.innerHTML = '<option value="" disabled>Select a Watchlist</option>';

    // Always include Portfolio as a special option
    const PORTFOLIO_WATCHLIST_ID = 'portfolio';
    const PORTFOLIO_WATCHLIST_NAME = 'Portfolio';
    const portfolioOption = document.createElement('option');
    portfolioOption.value = PORTFOLIO_WATCHLIST_ID;
    portfolioOption.textContent = PORTFOLIO_WATCHLIST_NAME;
    shareWatchlistSelect.appendChild(portfolioOption);

    // Filter out the "Cash & Assets" option from the share watchlist dropdown
    const stockWatchlists = userWatchlists.filter(wl => wl.id !== CASH_BANK_WATCHLIST_ID);
    stockWatchlists.forEach(watchlist => {
        // Don't duplicate Portfolio if userWatchlists already has it
        if (watchlist.id === PORTFOLIO_WATCHLIST_ID) return;
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        shareWatchlistSelect.appendChild(option);
    });

    let preselectedIds = []; // For multi-select
    let selectedOptionId = ''; // For legacy single-select scenarios
    let disableDropdown = false; // Variable to control if dropdown should be disabled

    if (isNewShare) {
        // For new shares, always default to the blank placeholder and keep the dropdown enabled.
        selectedOptionId = ''; // Forces selection of the disabled placeholder option
        disableDropdown = false; // Always allow user to select a watchlist
        logDebug('Share Form: New share: Watchlist selector forced to blank placeholder, enabled for user selection.');
    } else { // Editing an existing share
        // If editing, prefer the share's existing watchlistIds array if present
        if (selectedShareDocId) {
            const s = allSharesData.find(w => w.id === selectedShareDocId);
            if (s && Array.isArray(s.watchlistIds) && s.watchlistIds.length) {
                preselectedIds = s.watchlistIds.slice();
            }
        }
        // Always honor 'portfolio' explicitly even if userWatchlists doesn't include it
        if (currentShareWatchlistId === 'portfolio') {
            selectedOptionId = 'portfolio';
            if (!preselectedIds.includes('portfolio')) preselectedIds.push('portfolio');
            logDebug('Share Form: Editing share: Detected portfolio watchlist, pre-selecting Portfolio.');
        } else if (currentShareWatchlistId && stockWatchlists.some(wl => wl.id === currentShareWatchlistId)) {
            selectedOptionId = currentShareWatchlistId;
            if (currentShareWatchlistId && !preselectedIds.includes(currentShareWatchlistId)) preselectedIds.push(currentShareWatchlistId);
            logDebug('Share Form: Editing share: Pre-selected to existing share\'s watchlist: ' + selectedOptionId);
        } else if (currentShareWatchlistId) {
            // If the original watchlist isn't in the filtered stock lists, inject a temporary option to preserve it
            const original = userWatchlists.find(wl => wl.id === currentShareWatchlistId);
            if (original && original.id !== CASH_BANK_WATCHLIST_ID) {
                const opt = document.createElement('option');
                opt.value = original.id;
                opt.textContent = original.name + ' (original)';
                shareWatchlistSelect.appendChild(opt);
                selectedOptionId = original.id;
                if (original.id && !preselectedIds.includes(original.id)) preselectedIds.push(original.id);
                console.warn('Share Form: Editing share: Original watchlist not in stock list; temporarily added original to dropdown.');
            } else {
                // Unknown/removed list or Cash; require explicit user choice instead of defaulting silently
                selectedOptionId = '';
                console.warn('Share Form: Editing share: Original watchlist missing or not applicable. Please select a watchlist.');
            }
        } else if (stockWatchlists.length > 0) {
            // No original ID on the share; default to current view if it's Portfolio, else leave blank
            if (Array.isArray(currentSelectedWatchlistIds) && currentSelectedWatchlistIds[0] === 'portfolio') {
                selectedOptionId = 'portfolio';
                if (!preselectedIds.includes('portfolio')) preselectedIds.push('portfolio');
                logDebug('Share Form: Editing share: No original watchlist; defaulting to current view Portfolio.');
            } else {
                selectedOptionId = '';
                logDebug('Share Form: Editing share: No original watchlist set; leaving blank for user to choose.');
            }
        } else {
            selectedOptionId = '';
            console.warn('Share Form: Editing share: No stock watchlists available to select.');
        }
        disableDropdown = false; // Always allow changing watchlist when editing
    }

    // Apply the determined selection(s) and disabled state to native select
    if (preselectedIds.length > 0) {
        Array.from(shareWatchlistSelect.options).forEach(option => {
            option.selected = preselectedIds.includes(option.value);
        });
    } else {
        shareWatchlistSelect.value = selectedOptionId;
    }
    shareWatchlistSelect.disabled = disableDropdown;

    // Explicitly set the 'selected' attribute on the option for visual update reliability
    // This loop is crucial to ensure the visual selection is correctly applied.
    Array.from(shareWatchlistSelect.options).forEach(option => {
        if (preselectedIds.length > 0) {
            option.selected = preselectedIds.includes(option.value);
        } else {
            option.selected = (option.value === selectedOptionId);
        }
    });

    // Build enhanced toggle list
    if (typeof shareWatchlistEnhanced !== 'undefined' && shareWatchlistEnhanced) {
        shareWatchlistEnhanced.innerHTML = '';
        const opts = Array.from(shareWatchlistSelect.options).filter(o => o.value !== '' && o.value !== CASH_BANK_WATCHLIST_ID);
        const selectedSet = new Set(preselectedIds.length ? preselectedIds : (selectedOptionId ? [selectedOptionId] : []));
        opts.forEach(o => {
            const item = document.createElement('div');
            item.className = 'watchlist-enhanced-item';
            const checked = selectedSet.has(o.value);
            item.innerHTML = `
                <span class="watchlist-enhanced-name">${o.textContent || o.value}</span>
                <label class="watchlist-toggle" aria-label="Toggle ${o.textContent || o.value}">
                    <input type="checkbox" value="${o.value}" ${checked ? 'checked' : ''}>
                    <span class="watchlist-toggle-track"><span class="watchlist-toggle-thumb"></span></span>
                </label>`;
            const input = item.querySelector('input');
            input.addEventListener('change', () => {
                const toggled = Array.from(shareWatchlistEnhanced.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
                Array.from(shareWatchlistSelect.options).forEach(opt => { opt.selected = toggled.includes(opt.value); });
                shareWatchlistSelect.value = toggled[0] || '';
                updateWatchlistDropdownButton();
                checkFormDirtyState();
            });
            shareWatchlistEnhanced.appendChild(item);
        });
    }

    // Initialize dropdown button label/state
    if (shareWatchlistDropdownBtn) {
        updateWatchlistDropdownButton();
        shareWatchlistDropdownBtn.setAttribute('aria-expanded','false');
        shareWatchlistDropdownBtn.onclick = (e) => {
            e.stopPropagation();
            if (!shareWatchlistEnhanced) return;
            const isOpen = shareWatchlistEnhanced.style.display === 'block';
            shareWatchlistEnhanced.style.display = isOpen ? 'none' : 'block';
            shareWatchlistDropdownBtn.setAttribute('aria-expanded', String(!isOpen));
        };
        document.addEventListener('click', (evt) => {
            if (!shareWatchlistEnhanced || shareWatchlistEnhanced.style.display !== 'block') return;
            const within = shareWatchlistEnhanced.contains(evt.target) || shareWatchlistDropdownBtn.contains(evt.target);
            if (!within) {
                shareWatchlistEnhanced.style.display='none';
                shareWatchlistDropdownBtn.setAttribute('aria-expanded','false');
            }
        });
    }

    // Listen for native select change too (in case of programmatic changes)
    shareWatchlistSelect.addEventListener('change', () => {
        if (!shareWatchlistEnhanced) return;
        const selected = Array.from(shareWatchlistSelect.options).filter(o => o.selected).map(o => o.value);
        shareWatchlistEnhanced.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = selected.includes(cb.value); });
        updateWatchlistDropdownButton();
        checkFormDirtyState();
    });
}

function updateWatchlistDropdownButton() {
    if (!shareWatchlistDropdownBtn) return;
    let selected = [];
    if (shareWatchlistEnhanced) {
        selected = Array.from(shareWatchlistEnhanced.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
    }
    if (selected.length === 0) { shareWatchlistDropdownBtn.textContent = 'Select Watchlists'; return; }
    const names = selected.map(id => {
        const opt = Array.from(shareWatchlistSelect.options).find(o => o.value === id);
        return opt ? (opt.textContent || opt.innerText || id) : id;
    });
    shareWatchlistDropdownBtn.textContent = names.length <=2 ? names.join(', ') : names.slice(0,2).join(', ') + ' +' + (names.length-2);
}

function showEditFormForSelectedShare(shareIdToEdit = null) {
    if (suppressShareFormReopen) {
        logDebug('Share Form: Suppression active; blocking unintended reopen.');
        return;
    }
    const targetShareId = shareIdToEdit || selectedShareDocId;

    if (!targetShareId) {
        showCustomAlert('Please select a share to edit.');
        return;
    }
    const shareToEdit = allSharesData.find(share => share.id === targetShareId);
    if (!shareToEdit) {
        showCustomAlert('Selected share not found.');
        return;
    }
    selectedShareDocId = targetShareId; 

    // Set the modal title to the share code and the subtitle to the company name
    formTitle.textContent = shareToEdit.shareName || 'N/A';
    const companyInfo = allAsxCodes.find(c => c.code === shareToEdit.shareName.toUpperCase());
    if (formCompanyName) {
        formCompanyName.textContent = companyInfo ? companyInfo.name : '';
    }

    if (shareNameInput) shareNameInput.value = shareToEdit.shareName || '';
    // Removed setting manual currentPrice input (field no longer present)
    if (targetPriceInput) targetPriceInput.value = Number(shareToEdit.targetPrice) !== null && !isNaN(Number(shareToEdit.targetPrice)) ? formatUserDecimalStrict(shareToEdit.targetPrice) : '';
    
    // Reset toggle state helpers
    userManuallyOverrodeDirection = false;
    // Set the correct state for the new target direction checkboxes
    if (targetAboveCheckbox && targetBelowCheckbox) {
        // Default to 'below' if not set
        const savedTargetDirection = shareToEdit.targetDirection || 'below';
        targetAboveCheckbox.checked = (savedTargetDirection === 'above');
        targetBelowCheckbox.checked = (savedTargetDirection === 'below');
        // Sync segmented buttons to match saved state
        try {
            const isAbove = (savedTargetDirection === 'above');
            if (targetDirAboveBtn && targetDirBelowBtn) {
                targetDirAboveBtn.classList.toggle('is-active', isAbove);
                targetDirAboveBtn.setAttribute('aria-pressed', String(isAbove));
                targetDirBelowBtn.classList.toggle('is-active', !isAbove);
                targetDirBelowBtn.setAttribute('aria-pressed', String(!isAbove));
            }
        } catch(_) {}
    }

    if (dividendAmountInput) dividendAmountInput.value = Number(shareToEdit.dividendAmount) !== null && !isNaN(Number(shareToEdit.dividendAmount)) ? formatUserDecimalStrict(shareToEdit.dividendAmount) : '';
    if (frankingCreditsInput) frankingCreditsInput.value = Number(shareToEdit.frankingCredits) !== null && !isNaN(Number(shareToEdit.frankingCredits)) ? Number(shareToEdit.frankingCredits).toFixed(1) : '';

    // Portfolio fields (optional per share)
    const portfolioSharesInput = document.getElementById('portfolioShares');
    const portfolioAvgPriceInput = document.getElementById('portfolioAvgPrice');
    if (portfolioSharesInput) {
        const v = Number(shareToEdit.portfolioShares);
        portfolioSharesInput.value = !isNaN(v) && v !== null ? String(Math.trunc(v)) : '';
    }
    if (portfolioAvgPriceInput) {
        const v = Number(shareToEdit.portfolioAvgPrice);
        portfolioAvgPriceInput.value = !isNaN(v) && v !== null ? formatUserDecimalStrict(v) : '';
    }

    // Set the star rating dropdown
    if (shareRatingSelect) {
        shareRatingSelect.value = shareToEdit.starRating !== undefined && shareToEdit.starRating !== null ? shareToEdit.starRating.toString() : '0';
    }

    // Populate and set selection for the watchlist dropdown
    populateShareWatchlistSelect(shareToEdit.watchlistId, false); // false indicates not a new share

    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.innerHTML = ''; // Clear existing dynamic comment sections
        if (shareToEdit.comments && Array.isArray(shareToEdit.comments) && shareToEdit.comments.length > 0) {
            shareToEdit.comments.forEach(comment => addCommentSection(commentsFormContainer, comment.title, comment.text));
        } else {
            // Add one empty comment section if no existing comments
            addCommentSection(commentsFormContainer); 
        }
    }
    if (deleteShareBtn) {
        deleteShareBtn.classList.add('hidden');
        setIconDisabled(deleteShareBtn, false);
        logDebug('showEditFormForSelectedShare: deleteShareBtn shown and enabled.');
    }

    originalShareData = getCurrentFormData();
    setIconDisabled(saveShareBtn, true); // Save button disabled initially for editing
    logDebug('showEditFormForSelectedShare: saveShareBtn initially disabled for dirty check.');

    // Populate read-only auto fields (Entry Date & Reference Price)
    try {
        if (autoEntryDateDisplay) {
            const ed = shareToEdit.entryDate ? formatDate(shareToEdit.entryDate) : '';
            if (ed) {
                autoEntryDateDisplay.textContent = ed;
                autoEntryDateDisplay.classList.remove('ghosted-text');
            } else {
                autoEntryDateDisplay.textContent = 'Auto when saved';
                autoEntryDateDisplay.classList.add('ghosted-text');
            }
        }
        if (autoReferencePriceDisplay) {
            const rp = (shareToEdit.currentPrice !== undefined && shareToEdit.currentPrice !== null && !isNaN(Number(shareToEdit.currentPrice))) ? Number(shareToEdit.currentPrice) : null;
            if (rp !== null) {
                autoReferencePriceDisplay.textContent = formatMoney(rp);
                autoReferencePriceDisplay.classList.remove('ghosted-text');
            } else {
                autoReferencePriceDisplay.textContent = 'Auto when saved';
                autoReferencePriceDisplay.classList.add('ghosted-text');
            }
        }
    } catch(e) { console.warn('Auto Details: Failed to populate auto fields', e); }

    showModal(shareFormSection);
    shareNameInput.focus();
    logDebug('Form: Opened edit form for share: ' + shareToEdit.shareName + ' (ID: ' + selectedShareDocId + ')');
}

/**
 * Gathers all current data from the share form inputs.
 * @returns {object} An object representing the current state of the form.
 */
function getCurrentFormData() {
    const comments = [];
    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    // Portfolio-specific fields (optional)
    const portfolioSharesEl = document.getElementById('portfolioShares');
    const portfolioAvgPriceEl = document.getElementById('portfolioAvgPrice');
    const portfolioSharesVal = portfolioSharesEl ? parseFloat(portfolioSharesEl.value) : null;
    const portfolioAvgPriceVal = portfolioAvgPriceEl ? parseFloat(portfolioAvgPriceEl.value) : null;

    return {
        shareName: shareNameInput?.value?.trim().toUpperCase() || '',
    currentPrice: null, // Will be auto-derived when saving new/updated share
        targetPrice: parseFloat(targetPriceInput?.value),
        // UPDATED: Get targetDirection from the new checkboxes
        targetDirection: targetAboveCheckbox?.checked ? 'above' : 'below',
        dividendAmount: parseFloat(dividendAmountInput?.value),
        frankingCredits: parseFloat(frankingCreditsInput?.value),
        // Get the selected star rating as a number
        starRating: shareRatingSelect ? parseInt(shareRatingSelect.value) : 0,
        comments: comments,
        // Include legacy single value and the plural array; use checkbox UI as source of truth
        watchlistId: shareWatchlistSelect ? (shareWatchlistSelect.value || null) : null,
        watchlistIds: (() => {
            const els = document.querySelectorAll('#shareWatchlistCheckboxes input.watchlist-checkbox:checked');
            const vals = Array.from(els).map(x => x.value).filter(Boolean);
            if (vals.length > 0) return vals;
            const single = shareWatchlistSelect ? (shareWatchlistSelect.value || null) : null;
            return single ? [single] : null;
        })(),
        // Portfolio fields
        portfolioShares: isNaN(portfolioSharesVal) ? null : Math.trunc(portfolioSharesVal),
        portfolioAvgPrice: isNaN(portfolioAvgPriceVal) ? null : portfolioAvgPriceVal
    };
}

/**
 * Compares two share data objects (original vs. current form data) to check for equality.
 * Handles null/NaN for numbers and deep comparison for comments array.
 * @param {object} data1
 * @param {object} data2
 * @returns {boolean} True if data is identical, false otherwise.
 */
function areShareDataEqual(data1, data2) {
    if (!data1 || !data2) return false;

    const fields = ['shareName', 'currentPrice', 'targetPrice', 'targetDirection', 'dividendAmount', 'frankingCredits', 'watchlistId', 'starRating', 'portfolioShares', 'portfolioAvgPrice']; // Include portfolio fields
    for (const field of fields) {
        let val1 = data1[field];
        let val2 = data2[field];

        if (typeof val1 === 'number' && isNaN(val1)) val1 = null;
        if (typeof val2 === 'number' && isNaN(val2)) val2 = null;

        if (val1 !== val2) {
            return false;
        }
    }
    // Compare watchlistIds arrays if present (order-insensitive)
    const a = Array.isArray(data1.watchlistIds) ? [...data1.watchlistIds].sort() : null;
    const b = Array.isArray(data2.watchlistIds) ? [...data2.watchlistIds].sort() : null;
    if ((a && !b) || (!a && b)) return false;
    if (a && b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    }

    if (data1.comments.length !== data2.comments.length) {
        return false;
    }
    for (let i = 0; i < data1.comments.length; i++) {
        const comment1 = data1.comments[i];
        const comment2 = data2.comments[i];
        if (comment1.title !== comment2.title || comment1.text !== comment2.text) {
            return false;
        }
    }

    return true;
}

/**
 * Checks the current state of the form against the original data (if editing)
 * and the share name validity, then enables/disables the save button accordingly.
 */
function checkFormDirtyState() {
    const currentData = getCurrentFormData();
    const isShareNameValid = currentData.shareName.trim() !== '';
    const isWatchlistSelected = (() => {
        // Prefer the Phase 1 checkbox UI if present
        const checkedCbs = document.querySelectorAll('#shareWatchlistCheckboxes input.watchlist-checkbox:checked');
        if (checkedCbs && checkedCbs.length > 0) return true;

        // Fallback to native select state
        if (!shareWatchlistSelect) return false;
        if (shareWatchlistSelect.multiple) {
            // Some browsers don’t populate selectedOptions reliably when updated programmatically; check option.selected
            const anySelected = Array.from(shareWatchlistSelect.options || []).some(o => o.selected && o.value && o.value !== '');
            if (anySelected) return true;
            return !!(shareWatchlistSelect.value && shareWatchlistSelect.value !== '');
        }
        return shareWatchlistSelect.value !== '';
    })();

    let canSave = isShareNameValid;

    // For NEW shares, always require a watchlist to be explicitly selected in the dropdown.
    // This applies whether in "All Shares" view or a specific watchlist view where the dropdown defaults to blank.
    if (!selectedShareDocId) { // Only for new shares
        canSave = canSave && isWatchlistSelected;
    }

    if (selectedShareDocId && originalShareData) {
        const isDirty = !areShareDataEqual(originalShareData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            logDebug('Dirty State: Existing share: No changes detected, save disabled.');
        }
    } else if (!selectedShareDocId) {
        // For new shares, enable if name is valid and (if from All Shares) watchlist is selected
        // No additional 'isDirty' check needed for new shares beyond initial validity
        // Note: The previous logic for new shares here was redundant with the general 'if (!selectedShareDocId)' block above.
        // Keeping this else-if structure for clarity in differentiating new vs. existing shares in logs/logic.
    }

    setIconDisabled(saveShareBtn, !canSave);
    logDebug('Dirty State: Save button enabled: ' + canSave);
}

/**
 * Saves share data to Firestore. Can be called silently for auto-save.
 * @param {boolean} isSilent If true, no alert messages are shown on success.
 */
async function saveShareData(isSilent = false) {
    logDebug('Share Form: saveShareData called.');
    // Check if the save button would normally be disabled (no valid name or no changes)
    // This prevents saving blank new shares or unchanged existing shares on auto-save.
    if (saveShareBtn.classList.contains('is-disabled-icon') && isSilent) {
        logDebug('Auto-Save: Save button is disabled (no changes or no valid name). Skipping silent save.');
        return;
    }

    const shareName = shareNameInput.value.trim().toUpperCase();
    if (!shareName) { 
        if (!isSilent) showCustomAlert('Code is required!'); 
        console.warn('Save Share: Code is required. Skipping save.');
        return; 
    }

    // Source of truth: checkbox UI; keep hidden select for legacy fallback
    const selectedWatchlistIdForSave = shareWatchlistSelect ? (shareWatchlistSelect.value || null) : null;
    const selectedWatchlistIdsForSave = (() => {
        // Prefer enhanced toggle list
        if (typeof shareWatchlistEnhanced !== 'undefined' && shareWatchlistEnhanced) {
            const toggled = Array.from(shareWatchlistEnhanced.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value).filter(Boolean);
            if (toggled.length > 0) return toggled;
        }
        // Fallback legacy checkbox container
        const cbs = document.querySelectorAll('#shareWatchlistCheckboxes input.watchlist-checkbox:checked');
        const vals = Array.from(cbs).map(cb => cb.value).filter(Boolean);
        if (vals.length > 0) return vals;
        return selectedWatchlistIdForSave ? [selectedWatchlistIdForSave] : null;
    })();
    // For new shares from 'All Shares' view, force watchlist selection
    if (!selectedShareDocId && currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        if (!selectedWatchlistIdForSave || selectedWatchlistIdForSave === '') { // Check for empty string too
            if (!isSilent) showCustomAlert('Please select a watchlist to assign the new share to.');
            console.warn('Save Share: New share from All Shares: Watchlist not selected. Skipping save.');
            return;
        }
    } else if (!selectedShareDocId && !selectedWatchlistIdForSave) { // New share not from All Shares, but no watchlist selected (shouldn't happen if default exists)
         if (!isSilent) showCustomAlert('Please select a watchlist to assign the new share to.');
         console.warn('Save Share: New share: No watchlist selected. Skipping save.');
         return;
    }


    // Auto-capture live or fallback current price (no manual input)
    let currentPrice = NaN;
    try {
        const liveData = livePrices[shareName.toUpperCase()];
        if (liveData && typeof liveData.live === 'number' && !isNaN(liveData.live)) {
            currentPrice = liveData.live;
        } else if (liveData && typeof liveData.lastLivePrice === 'number' && !isNaN(liveData.lastLivePrice)) {
            currentPrice = liveData.lastLivePrice;
        }
    } catch(_) {}
    const targetPrice = parseFloat(targetPriceInput.value);
    const dividendAmount = parseFloat(dividendAmountInput.value);
    const frankingCredits = parseFloat(frankingCreditsInput.value);

    const comments = [];
    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    const shareData = {
        shareName: shareName,
        currentPrice: isNaN(currentPrice) ? null : currentPrice, // auto derived above
        targetPrice: isNaN(targetPrice) ? null : targetPrice,
        // UPDATED: Save the selected target direction from the new checkboxes
        targetDirection: targetAboveCheckbox.checked ? 'above' : 'below',
        dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
        frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
        comments: comments,
        // Use the selected watchlist from the modal dropdown
    watchlistId: selectedWatchlistIdForSave,
    watchlistIds: selectedWatchlistIdsForSave,
    // Portfolio fields (optional)
    portfolioShares: (() => { const el = document.getElementById('portfolioShares'); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? null : Math.trunc(v); })(),
    portfolioAvgPrice: (() => { const el = document.getElementById('portfolioAvgPrice'); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? null : v; })(),
        lastPriceUpdateTime: new Date().toISOString(),
        starRating: shareRatingSelect ? parseInt(shareRatingSelect.value) : 0 // Ensure rating is saved as a number
    };

    if (selectedShareDocId) {
        const existingShare = allSharesData.find(s => s.id === selectedShareDocId);
        if (shareData.currentPrice !== null && existingShare && existingShare.currentPrice !== shareData.currentPrice) {
            shareData.previousFetchedPrice = existingShare.lastFetchedPrice;
            shareData.lastFetchedPrice = shareData.currentPrice;
        } else if (!existingShare || existingShare.lastFetchedPrice === undefined) {
            shareData.previousFetchedPrice = shareData.currentPrice;
            shareData.lastFetchedPrice = shareData.currentPrice;
        } else {
            shareData.previousFetchedPrice = existingShare.previousFetchedPrice;
            shareData.lastFetchedPrice = existingShare.lastFetchedPrice;
        }

        try {
            const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', selectedShareDocId);
            await window.firestore.updateDoc(shareDocRef, shareData);
            // Phase 2: Upsert alert document for this share (intent + direction)
            try {
                await upsertAlertForShare(selectedShareDocId, shareName, shareData, false);
            } catch (e) {
                console.error('Alerts: Failed to upsert alert for share update:', e);
            }
            // Update local cache so reopening reflects new selections immediately
            try {
                const idx = allSharesData.findIndex(s => s.id === selectedShareDocId);
                if (idx !== -1) {
                    allSharesData[idx] = { ...allSharesData[idx], ...shareData };
                }
            } catch(_) {}
            if (!isSilent) showCustomAlert('Update successful', 1500);
            logDebug('Firestore: Share \'' + shareName + '\' (ID: ' + selectedShareDocId + ') updated.');
        originalShareData = getCurrentFormData(); // Update original data after successful save
        setIconDisabled(saveShareBtn, true); // Disable save button after saving
        // NEW: Explicitly hide the share form modal immediately and deselect the share
        if (!isSilent && shareFormSection) {
            shareFormSection.style.setProperty('display', 'none', 'important'); // Instant hide
            shareFormSection.classList.add('app-hidden'); // Ensure it stays hidden with !important class
        }
        // Prevent any stray observers from reopening the form immediately after save
        if (!isSilent) { suppressShareFormReopen = true; setTimeout(()=>{ suppressShareFormReopen = false; }, 8000); }
        deselectCurrentShare(); // Deselect share BEFORE fetching live prices to avoid re-opening details modal implicitly
            // NEW: Explicitly hide the share form modal immediately and deselect the share
            if (!isSilent && shareFormSection) {
                shareFormSection.style.setProperty('display', 'none', 'important'); // Instant hide
                shareFormSection.classList.add('app-hidden'); // Ensure it stays hidden with !important class
            }
            deselectCurrentShare(); // Deselect share BEFORE fetching live prices to avoid re-opening details modal implicitly
            // NEW: Trigger a fresh fetch of live prices and re-render to reflect new target hit status
            await fetchLivePrices(); // This will also trigger renderWatchlist and updateTargetHitBanner
            // Removed secondary toast; single confirmation already shown earlier.
        } catch (error) {
            console.error('Firestore: Error updating share:', error);
            if (!isSilent) showCustomAlert('Error updating share: ' + error.message);
        }
    } else {
        shareData.entryDate = new Date().toISOString();
        // If currentPrice still null attempt a late grab (race with live fetch)
        if (shareData.currentPrice === null) {
            try {
                const liveDataLate = livePrices[shareName.toUpperCase()];
                if (liveDataLate && typeof liveDataLate.live === 'number' && !isNaN(liveDataLate.live)) {
                    shareData.currentPrice = liveDataLate.live;
                } else if (liveDataLate && typeof liveDataLate.lastLivePrice === 'number' && !isNaN(liveDataLate.lastLivePrice)) {
                    shareData.currentPrice = liveDataLate.lastLivePrice;
                }
            } catch(_) {}
        }
        shareData.lastFetchedPrice = shareData.currentPrice;
        shareData.previousFetchedPrice = shareData.currentPrice;

        try {
            const sharesColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
            const newDocRef = await window.firestore.addDoc(sharesColRef, shareData);
            selectedShareDocId = newDocRef.id; // Set selectedShareDocId for the newly added share
            // Phase 2: Create alert document for this new share (intent + direction)
            try {
                await upsertAlertForShare(selectedShareDocId, shareName, shareData, true);
            } catch (e) {
                console.error('Alerts: Failed to create alert for new share:', e);
            }
            if (!isSilent) showCustomAlert('Added successfully', 1500);
            logDebug('Firestore: Share \'' + shareName + '\' added with ID: ' + newDocRef.id);
        originalShareData = getCurrentFormData(); // Update original data after successful save
        setIconDisabled(saveShareBtn, true); // Disable save button after saving
        // NEW: Explicitly hide the share form modal immediately and deselect the share
        if (!isSilent && shareFormSection) {
            shareFormSection.style.setProperty('display', 'none', 'important'); // Instant hide
            shareFormSection.classList.add('app-hidden'); // Ensure it stays hidden with !important class
        }
        // Prevent any stray observers from reopening the form immediately after save
        if (!isSilent) { suppressShareFormReopen = true; setTimeout(()=>{ suppressShareFormReopen = false; }, 8000); }
        deselectCurrentShare(); // Deselect newly added share BEFORE fetching live prices
            // NEW: Explicitly hide the share form modal immediately and deselect the share
            if (!isSilent && shareFormSection) {
                shareFormSection.style.setProperty('display', 'none', 'important'); // Instant hide
                shareFormSection.classList.add('app-hidden'); // Ensure it stays hidden with !important class
            }
            deselectCurrentShare(); // Deselect share BEFORE fetching live prices to avoid re-opening details modal implicitly
            // NEW: Trigger a fresh fetch of live prices and re-render to reflect new target hit status
            await fetchLivePrices(); // This will also trigger renderWatchlist and updateTargetHitBanner
            // Removed secondary toast; single confirmation already shown earlier.
        } catch (error) {
            console.error('Firestore: Error adding share:', error);
            if (!isSilent) showCustomAlert('Error adding share: ' + error.message);
        }
    }
    // Clear any sticky id on details modal so nothing reopens unexpectedly
    try {
        if (shareDetailModal && shareDetailModal.dataset) delete shareDetailModal.dataset.shareId;
    } catch(_) {}
    if (!isSilent) closeModals(); // Only close if not a silent save
}


function showShareDetails() {
    if (!selectedShareDocId) {
        showCustomAlert('Please select a share to view details.');
        return;
    }
    const share = allSharesData.find(s => s.id === selectedShareDocId);
    if (!share) {
        showCustomAlert('Selected share not found.');
        return;
    }
    // Determine price change class for modalShareName
    let modalShareNamePriceChangeClass = 'neutral';
    const livePriceDataForName = livePrices[share.shareName.toUpperCase()];
    if (livePriceDataForName && livePriceDataForName.live !== null && livePriceDataForName.prevClose !== null && !isNaN(livePriceDataForName.live) && !isNaN(livePriceDataForName.prevClose)) {
        const change = livePriceDataForName.live - livePriceDataForName.prevClose;
        if (change > 0) {
            modalShareNamePriceChangeClass = 'positive';
        } else if (change < 0) {
            modalShareNamePriceChangeClass = 'negative';
        } else {
            modalShareNamePriceChangeClass = 'neutral';
        }
    }
    // Set ASX code in modal title
    modalShareName.textContent = share.shareName || 'N/A';

    // --- AGGRESSIVE FIX: Forcefully find and inject the company name into the modal title ---
    if (modalCompanyName) {
        const companyInfo = allAsxCodes.find(c => c.code === share.shareName.toUpperCase());
        if (companyInfo) {
            modalCompanyName.textContent = companyInfo.name;
            logDebug(`Company Name: Found and set name for ${share.shareName}: ${companyInfo.name}`);
        } else {
            modalCompanyName.textContent = ''; // Clear if not found
            logDebug(`Company Name: Could not find company name for ${share.shareName}`);
        }
        // Force visibility
        modalCompanyName.style.setProperty('display', 'block', 'important');
    }

    // Persist the selected share id on the modal so Edit can recover it if selection is cleared
    if (shareDetailModal) {
        try { shareDetailModal.dataset.shareId = selectedShareDocId; } catch(_) {}
    }

    // Get live price data for this share to check target hit status
    const livePriceDataForModalTitle = livePrices[share.shareName.toUpperCase()];
    const isTargetHitForModalTitle = livePriceDataForModalTitle ? livePriceDataForModalTitle.targetHit : false;

    // Apply modal-share-name, price change class.
    let modalTitleClasses = 'modal-share-name ' + modalShareNamePriceChangeClass;
    // Apply target-hit-alert class if target is hit AND not dismissed
    if (isTargetHitForModalTitle && !targetHitIconDismissed) {
        modalTitleClasses += ' target-hit-alert';
    }
    modalShareName.className = modalTitleClasses; // Apply all classes

    const enteredPriceNum = Number(share.currentPrice);

    // Get live price data from the global livePrices object
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const livePrice = livePriceData ? livePriceData.live : undefined;
    const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;
    // Get PE, High52, Low52
    const peRatio = livePriceData ? livePriceData.PE : undefined;
    const high52Week = livePriceData ? livePriceData.High52 : undefined;
    const low52Week = livePriceData ? livePriceData.Low52 : undefined;


    // Display large live price and change in the dedicated section
    // The modalLivePriceDisplaySection is already referenced globally
    if (modalLivePriceDisplaySection) {
        modalLivePriceDisplaySection.classList.remove('positive-change-section', 'negative-change-section');

        // Determine price change class for modal live price section
        let priceChangeClass = 'neutral'; // Default to neutral
        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && 
            prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            if (change > 0) {
                priceChangeClass = 'positive';
            } else if (change < 0) {
                priceChangeClass = 'negative';
            } else {
                priceChangeClass = 'neutral';
            }
        }

    // Clear previous dynamic content
    modalLivePriceDisplaySection.innerHTML = '';

    // 52-Week Low / High
    const fiftyTwoWeekRow = document.createElement('div');
    fiftyTwoWeekRow.classList.add('fifty-two-week-row');

        const lowSpan = document.createElement('h3');
        lowSpan.classList.add('fifty-two-week-value', 'low'); // New classes
    lowSpan.textContent = 'Low: ' + (low52Week !== undefined && low52Week !== null && !isNaN(low52Week) ? formatMoney(low52Week) : 'N/A');
        fiftyTwoWeekRow.appendChild(lowSpan);

        const highSpan = document.createElement('h3');
        highSpan.classList.add('fifty-two-week-value', 'high'); // New classes
    highSpan.textContent = 'High: ' + (high52Week !== undefined && high52Week !== null && !isNaN(high52Week) ? formatMoney(high52Week) : 'N/A');
        fiftyTwoWeekRow.appendChild(highSpan);

        modalLivePriceDisplaySection.appendChild(fiftyTwoWeekRow);

    const currentModalLivePriceLarge = document.createElement('h2');
    currentModalLivePriceLarge.classList.add('modal-share-name', priceChangeClass);
    const currentModalPriceChangeLarge = document.createElement('span');
    currentModalPriceChangeLarge.classList.add('price-change-large', priceChangeClass);
    modalLivePriceDisplaySection.appendChild(currentModalLivePriceLarge);
    modalLivePriceDisplaySection.appendChild(currentModalPriceChangeLarge);

        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
            currentModalLivePriceLarge.textContent = '$' + formatAdaptivePrice(livePrice);
            currentModalLivePriceLarge.style.display = 'inline';
        } else {
            currentModalLivePriceLarge.textContent = 'N/A';
            currentModalLivePriceLarge.style.display = 'inline';
        }

        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && 
            prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0; // Handle division by zero

            currentModalPriceChangeLarge.textContent = ''; // Clear previous content
            const priceChangeSpan = document.createElement('span');
            priceChangeSpan.classList.add('price-change'); // Keep base class for coloring, color already applied to parent
            if (change > 0) {
                priceChangeSpan.textContent = '(+$' + formatAdaptivePrice(change) + ' / +' + formatAdaptivePercent(percentageChange) + '%)';
            } else if (change < 0) {
                priceChangeSpan.textContent = '(-$' + formatAdaptivePrice(Math.abs(change)) + ' / ' + formatAdaptivePercent(percentageChange) + '%)'; // percentageChange is already negative
            } else {
                priceChangeSpan.textContent = '($0.00 / 0.00%)';
            }
            currentModalPriceChangeLarge.appendChild(priceChangeSpan);
            currentModalPriceChangeLarge.style.display = 'inline';
        } else {
            currentModalPriceChangeLarge.textContent = '';
            currentModalPriceChangeLarge.style.display = 'none';
        }

    // P/E Ratio
    const peRow = document.createElement('div');
    peRow.classList.add('pe-ratio-row');
    const peSpan = document.createElement('h3');
    peSpan.classList.add('pe-ratio-value');
    peSpan.textContent = 'P/E: ' + (peRatio !== undefined && peRatio !== null && !isNaN(peRatio) ? formatAdaptivePrice(peRatio) : 'N/A');
        peRow.appendChild(peSpan);
        modalLivePriceDisplaySection.appendChild(peRow);
    }

    // Allow display of prices with up to 3 decimal places
    modalEnteredPrice.textContent = (val => (val !== null && !isNaN(val) && val !== 0) ? '$' + val.toFixed(3) : '')(enteredPriceNum);

    const displayTargetPrice = (val => (val !== null && !isNaN(val) && val !== 0) ? '$' + val.toFixed(3) : '')(Number(share.targetPrice));
    
    // Determine the target notification message based on share.targetDirection
    let targetNotificationMessage = '';
    // Condition should check if a numeric targetPrice exists, including 0
    if (share.targetPrice !== null && !isNaN(Number(share.targetPrice))) { 
        if (share.targetDirection === 'above') {
            targetNotificationMessage = '(Alert will trigger if >= Target)'; // Option 8
        } else { // Default or 'below'
            targetNotificationMessage = '(Alert will trigger if <= Target)'; // Option 7
        }
    }

    /* Hide empty sections for a cleaner view */
    try {
        const dividendsCard = document.querySelector('.detail-card[data-section="dividends"]');
        const hasDividend = share.dividendAmount && !isNaN(Number(share.dividendAmount)) && Number(share.dividendAmount) !== 0;
        const hasFranking = share.frankingCredits && !isNaN(Number(share.frankingCredits)) && Number(share.frankingCredits) !== 0;
        if (dividendsCard) {
            dividendsCard.style.display = (!hasDividend && !hasFranking) ? 'none' : '';
        }
        const commentsCard = document.querySelector('.detail-card[data-section="comments"]');
        if (commentsCard) {
            const hasComments = Array.isArray(share.comments) && share.comments.some(c => c && (c.text || c.comment));
            commentsCard.style.display = hasComments ? '' : 'none';
        }
    } catch(e) { console.warn('Hide Empty Sections: issue applying visibility', e); }

    modalTargetPrice.innerHTML = `
        ${targetNotificationMessage ? `<span class="ghosted-text">${targetNotificationMessage}</span>` : ''}
        ${targetNotificationMessage && displayTargetPrice ? ' ' : ''} ${displayTargetPrice}
    `.trim(); // Trim to remove potential leading/trailing whitespace if parts are empty

    // Ensure dividendAmount and frankingCredits are numbers before formatting
    const displayDividendAmount = Number(share.dividendAmount);
    const displayFrankingCredits = Number(share.frankingCredits);

    modalDividendAmount.textContent = (val => (val !== null && !isNaN(val) && val !== 0) ? '$' + formatAdaptivePrice(val) : '')(displayDividendAmount);
    modalFrankingCredits.textContent = (val => (val !== null && !isNaN(val) && val !== 0) ? val.toFixed(1) + '%' : '')(displayFrankingCredits);

    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;
    const unfrankedYield = calculateUnfrankedYield(displayDividendAmount, priceForYield); 
    // Display unfranked yield only if it's not null/NaN AND not 0
    modalUnfrankedYieldSpan.textContent = unfrankedYield !== null && !isNaN(unfrankedYield) && unfrankedYield !== 0 ? formatAdaptivePercent(unfrankedYield) + '%' : '';

    const frankedYield = calculateFrankedYield(displayDividendAmount, priceForYield, displayFrankingCredits);
    // Display franked yield only if it's not null/NaN AND not 0
    modalFrankedYieldSpan.textContent = frankedYield !== null && !isNaN(frankedYield) && frankedYield !== 0 ? formatAdaptivePercent(frankedYield) + '%' : '';

    // Populate Entry Date after Franked Yield
    modalEntryDate.textContent = formatDate(share.entryDate) || 'N/A';
    modalStarRating.textContent = share.starRating > 0 ? '⭐ ' + share.starRating : '';

    if (modalCommentsContainer) {
        modalCommentsContainer.innerHTML = '';
        if (share.comments && Array.isArray(share.comments) && share.comments.length > 0) {
            share.comments.forEach(comment => {
                if (comment.title || comment.text) {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'modal-comment-item';

                    // Conditional Title Bar
                    if (comment.title && comment.title.trim() !== '') {
                        const titleBar = document.createElement('div');
                        titleBar.classList.add('comment-title-bar'); // New class for styling
                        titleBar.textContent = comment.title;
                        commentDiv.appendChild(titleBar);
                    }

                    const commentTextP = document.createElement('p');
                    commentTextP.textContent = comment.text || '';
                    commentDiv.appendChild(commentTextP);

                    modalCommentsContainer.appendChild(commentDiv);
                }
            });
        } else {
            modalCommentsContainer.innerHTML = '<p style="text-align: center; color: var(--label-color);">No comments for this share.</p>';
        }
    }

    // External Links
    if (modalNewsLink && share.shareName) {
        const newsUrl = 'https://news.google.com/search?q=' + encodeURIComponent(share.shareName) + '%20ASX&hl=en-AU&gl=AU&ceid=AU%3Aen';
        modalNewsLink.href = newsUrl;
        modalNewsLink.innerHTML = 'View ' + share.shareName.toUpperCase() + ' News <i class="fas fa-external-link-alt"></i>';
        modalNewsLink.style.display = 'inline-flex';
        setIconDisabled(modalNewsLink, false);
    } else if (modalNewsLink) {
        modalNewsLink.style.display = 'none';
        setIconDisabled(modalNewsLink, true);
    }

    if (modalMarketIndexLink && share.shareName) {
        const marketIndexUrl = 'https://www.marketindex.com.au/asx/' + share.shareName.toLowerCase();
        modalMarketIndexLink.href = marketIndexUrl;
    // Text no longer includes the ASX code per spec; keep consistent "View on ..." prefix
    modalMarketIndexLink.innerHTML = 'View on MarketIndex.com.au <i class="fas fa-external-link-alt"></i>';
        modalMarketIndexLink.style.display = 'inline-flex';
        setIconDisabled(modalMarketIndexLink, false);
    } else if (modalMarketIndexLink) {
        modalMarketIndexLink.style.display = 'none';
        setIconDisabled(modalMarketIndexLink, true);
    }

    // Fool.com.au Link
    if (modalFoolLink && share.shareName) {
        modalFoolLink.href = `https://www.fool.com.au/quote/${share.shareName}/`;
        modalFoolLink.innerHTML = 'View on Fool.com.au <i class="fas fa-external-link-alt"></i>';
        modalFoolLink.style.display = 'inline-flex';
        setIconDisabled(modalFoolLink, false);
    } else if (modalFoolLink) {
        modalFoolLink.style.display = 'none';
        setIconDisabled(modalFoolLink, true);
    }

    // Listcorp.com Link (NEW)
    if (modalListcorpLink && share.shareName) {
        const listcorpUrl = `https://www.listcorp.com/asx/${share.shareName.toLowerCase()}`;
        modalListcorpLink.href = listcorpUrl;
        modalListcorpLink.innerHTML = `View on Listcorp.com <i class="fas fa-external-link-alt"></i>`;
        modalListcorpLink.style.display = 'inline-flex';
        setIconDisabled(modalListcorpLink, false);
    } else if (modalListcorpLink) {
        modalListcorpLink.style.display = 'none';
        setIconDisabled(modalListcorpLink, true);
    }

    // CommSec.com.au Link (DYNAMIC) + Google Finance
    if (modalCommSecLink && share.shareName) {
        const commsecUrl = `https://www2.commsec.com.au/quotes/summary?stockCode=${encodeURIComponent(share.shareName)}&exchangeCode=ASX`;
        modalCommSecLink.href = commsecUrl;
        modalCommSecLink.innerHTML = 'View on CommSec.com.au <i class="fas fa-external-link-alt"></i>';
        modalCommSecLink.style.display = 'inline-flex';
        setIconDisabled(modalCommSecLink, false);
    } else if (modalCommSecLink) {
        modalCommSecLink.style.display = 'none';
        setIconDisabled(modalCommSecLink, true);
    }

    if (typeof modalGoogleFinanceLink !== 'undefined') {
        try {
            if (modalGoogleFinanceLink && share.shareName) {
                modalGoogleFinanceLink.href = `https://www.google.com/finance/quote/${share.shareName.toUpperCase()}:ASX?hl=en`;
                modalGoogleFinanceLink.style.display = 'inline-flex';
            } else if (modalGoogleFinanceLink) {
                modalGoogleFinanceLink.style.display = 'none';
            }
        } catch(_) {}
    }

    if (modalCommSecLink && commSecLoginMessage) {
        // Move the login message directly after the CommSec link in the DOM, inside the same parent
        if (modalCommSecLink.parentNode && modalCommSecLink.nextSibling !== commSecLoginMessage) {
            modalCommSecLink.parentNode.insertBefore(commSecLoginMessage, modalCommSecLink.nextSibling);
        }
        // Style the login message for subtle, flush display
        commSecLoginMessage.style.display = 'block';
        commSecLoginMessage.style.fontSize = '75%';
        commSecLoginMessage.style.fontWeight = 'normal';
        commSecLoginMessage.style.color = 'var(--label-color, #888)';
        commSecLoginMessage.style.marginTop = '2px';
        commSecLoginMessage.style.marginBottom = '0';
        commSecLoginMessage.style.padding = '0';
    }

    showModal(shareDetailModal);
    logDebug('Details: Displayed details for share: ' + share.shareName + ' (ID: ' + selectedShareDocId + ')');
}

function sortShares() {
    const sortValue = currentSortOrder;
    logDebug('AGGRESSIVE DEBUG: sortShares called with currentSortOrder: ' + sortValue);
    if (!sortValue || sortValue === '') {
        logDebug('Sort: Sort placeholder selected, no explicit sorting applied.');
        renderWatchlist(); 
        return;
    }
    const [field, order] = sortValue.split('-');
    logDebug('AGGRESSIVE DEBUG: Sorting by field: ' + field + ', order: ' + order);
    allSharesData.sort((a, b) => {
        // Handle sorting by percentage change
        if (field === 'percentageChange') {
            logDebug('AGGRESSIVE DEBUG: Percentage change sorting detected');
            const livePriceDataA = livePrices[a.shareName.toUpperCase()];
            const livePriceA = livePriceDataA ? livePriceDataA.live : undefined;
            const prevCloseA = livePriceDataA ? livePriceDataA.prevClose : undefined;

            const livePriceDataB = livePrices[b.shareName.toUpperCase()];
            const livePriceB = livePriceDataB ? livePriceDataB.live : undefined;
            const prevCloseB = livePriceDataB ? livePriceDataB.prevClose : undefined; // Corrected variable name

            let percentageChangeA = null;
            // Only calculate if both livePriceA and prevCloseA are valid numbers and prevCloseA is not zero
            if (livePriceA !== undefined && livePriceA !== null && !isNaN(livePriceA) &&
                prevCloseA !== undefined && prevCloseA !== null && !isNaN(prevCloseA) && prevCloseA !== 0) {
                percentageChangeA = ((livePriceA - prevCloseA) / prevCloseA) * 100;
            }

            let percentageChangeB = null;
            // Only calculate if both livePriceB and prevCloseB are valid numbers and prevCloseB is not zero
            if (livePriceB !== undefined && livePriceB !== null && !isNaN(livePriceB) &&
                prevCloseB !== undefined && prevCloseB !== null && !isNaN(prevCloseB) && prevCloseB !== 0) { // Corrected variable name here
                percentageChangeB = ((livePriceB - prevCloseB) / prevCloseB) * 100;
            }

            // Debugging log for percentage sort
            logDebug('Sort Debug - Percentage: Comparing ' + a.shareName + ' (Change: ' + percentageChangeA + ') vs ' + b.shareName + ' (Change: ' + percentageChangeB + ')');


            // Handle null/NaN percentage changes to push them to the bottom
            // If both are null, their relative order doesn't matter (return 0)
            if (percentageChangeA === null && percentageChangeB === null) return 0;
            // If A is null but B is a number, A goes to the bottom
            if (percentageChangeA === null) return 1; 
            // If B is null but A is a number, B goes to the bottom
            if (percentageChangeB === null) return -1; 

            // Now perform numerical comparison for non-null values
            return order === 'asc' ? percentageChangeA - percentageChangeB : percentageChangeB - percentageChangeA;
        }

        let valA = a[field];
        let valB = b[field];

        if (field === 'currentPrice' || field === 'targetPrice' || field === 'frankingCredits') {
            valA = (typeof valA === 'string' && valA.trim() !== '') ? parseFloat(valA) : valA;
            valB = (typeof valB === 'string' && valB.trim() !== '') ? parseFloat(valB) : valB;
            valA = (valA === null || valA === undefined || isNaN(valA)) ? (order === 'asc' ? Infinity : -Infinity) : valA;
            valB = (valB === null || valB === undefined || isNaN(valB)) ? (order === 'asc' ? Infinity : -Infinity) : valB;
            return order === 'asc' ? valA - valB : valB - valA;
        } else if (field === 'dividendAmount') { // Dedicated logic for dividendAmount (yield)
            // Get live price data for share A
            const livePriceDataA = livePrices[a.shareName.toUpperCase()];
            const livePriceA = livePriceDataA ? livePriceDataA.live : undefined;
            // Price for yield calculation: prefer live price, fall back to entered price
            // Default to 0 if price is invalid or zero to avoid division issues in yield functions
            const priceForYieldA = (livePriceA !== undefined && livePriceA !== null && !isNaN(livePriceA) && livePriceA > 0) ? livePriceA : (Number(a.currentPrice) > 0 ? Number(a.currentPrice) : 0);

            // Get live price data for share B
            const livePriceDataB = livePrices[b.shareName.toUpperCase()];
            const livePriceB = livePriceDataB ? livePriceDataB.live : undefined;
            // Price for yield calculation: prefer live price, fall back to entered price
            // Default to 0 if price is invalid or zero to avoid division issues in yield functions
            const priceForYieldB = (livePriceB !== undefined && livePriceB !== null && !isNaN(livePriceB) && livePriceB > 0) ? livePriceB : (Number(b.currentPrice) > 0 ? Number(b.currentPrice) : 0);

            const dividendAmountA = Number(a.dividendAmount) || 0; // Default to 0 if not a number
            const frankingCreditsA = Number(a.frankingCredits) || 0; // Default to 0 if not a number

            const dividendAmountB = Number(b.dividendAmount) || 0; // Default to 0 if not a number
            const frankingCreditsB = Number(b.frankingCredits) || 0; // Default to 0 if not a number

            // Calculate yields for share A using the determined priceForYieldA
            const frankedYieldA = calculateFrankedYield(dividendAmountA, priceForYieldA, frankingCreditsA);
            const unfrankedYieldA = calculateUnfrankedYield(dividendAmountA, priceForYieldA);

            // Calculate yields for share B using the determined priceForYieldB
            const frankedYieldB = calculateFrankedYield(dividendAmountB, priceForYieldB, frankingCreditsB);
            const unfrankedYieldB = calculateUnfrankedYield(dividendAmountB, priceForYieldB);

            // Determine the effective yield for sorting for A (prioritize franked if > 0, then unfranked)
            let effectiveYieldA = 0; // Default to 0, not null
            if (frankingCreditsA > 0 && frankedYieldA > 0) { // Only use franked if franking > 0 AND yield > 0
                effectiveYieldA = frankedYieldA;
            } else if (unfrankedYieldA > 0) { // Only use unfranked if yield > 0
                effectiveYieldA = unfrankedYieldA;
            }
            // If both are 0 or less, effectiveYieldA remains 0

            // Determine the effective yield for sorting for B (prioritize franked if > 0, then unfranked)
            let effectiveYieldB = 0; // Default to 0, not null
            if (frankingCreditsB > 0 && frankedYieldB > 0) { // Only use franked if franking > 0 AND yield > 0
                effectiveYieldB = frankedYieldB;
            } else if (unfrankedYieldB > 0) { // Only use unfranked if yield > 0
                effectiveYieldB = unfrankedYieldB;
            }
            // If both are 0 or less, effectiveYieldB remains 0

            logDebug(`Sort Debug - Dividend: Comparing ${a.shareName} (Effective Yield A: ${effectiveYieldA}) vs ${b.shareName} (Effective Yield B: ${effectiveYieldB})`);

            // Perform numerical comparison. Since effectiveYieldA/B are now always numbers (0 or positive),
            // we don't need the Infinity/1e10 logic here.
            return order === 'asc' ? effectiveYieldA - effectiveYieldB : effectiveYieldB - effectiveYieldA;
        } else if (field === 'shareName') {
            const nameA = (a.shareName || '').toUpperCase().trim();
            const nameB = (b.shareName || '').toUpperCase().trim();
            if (nameA === '' && nameB === '') return 0;
            // If A is empty, it comes after B (push to bottom)
            if (nameA === '') return 1; 
            // If B is empty, it comes after A (push to bottom)
            if (nameB === '') return -1; 

            return order === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else if (field === 'starRating') {
            const ratingA = a.starRating !== undefined && a.starRating !== null && !isNaN(parseInt(a.starRating)) ? parseInt(a.starRating) : 0;
            const ratingB = b.starRating !== undefined && b.starRating !== null && !isNaN(parseInt(b.starRating)) ? parseInt(b.starRating) : 0;
            return order === 'asc' ? ratingA - ratingB : ratingB - ratingA;
        } else if (field === 'entryDate') {
            // UPDATED: Robust date parsing for sorting
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            
            // Handle invalid dates by pushing them to the end of the list (Infinity for asc, -Infinity for desc)
            const timeA = isNaN(dateA.getTime()) ? (order === 'asc' ? Infinity : -Infinity) : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? (order === 'asc' ? Infinity : -Infinity) : dateB.getTime();

            return order === 'asc' ? timeA - timeB : timeB - timeA;
        } else {
            if (order === 'asc') {
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return 0;
            } else {
                if (valA > valB) return -1;
                if (valA < valB) return 1;
                return 0;
            }
        }
    });
    logDebug('Sort: Shares sorted. Rendering watchlist.');
    renderWatchlist(); 
}

/**
 * Sorts the cash categories based on the currentSortOrder.
 * @returns {Array} The sorted array of cash categories.
 */
function sortCashCategories() {
    const sortValue = currentSortOrder;
    if (!sortValue || sortValue === '') {
        logDebug('Sort: Cash sort placeholder selected, no explicit sorting applied.');
        return [...userCashCategories]; // Return a copy to avoid direct mutation
    }

    const [field, order] = sortValue.split('-');

    // Ensure we're only sorting by relevant fields for cash assets
    if (field !== 'name' && field !== 'balance') {
        logDebug('Sort: Invalid sort field for cash assets: ' + field + '. Defaulting to name-asc.');
        return [...userCashCategories].sort((a, b) => a.name.localeCompare(b.name));
    }

    const sortedCategories = [...userCashCategories].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (field === 'balance') {
            valA = (typeof valA === 'number' && !isNaN(valA)) ? valA : (order === 'asc' ? Infinity : -Infinity);
            valB = (typeof valB === 'number' && !isNaN(valB)) ? valB : (order === 'asc' ? Infinity : -Infinity);
            return order === 'asc' ? valA - valB : valB - valA;
        } else if (field === 'name') {
            const nameA = (a.name || '').toUpperCase().trim();
            const nameB = (b.name || '').toUpperCase().trim();
            return order === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        return 0; // Should not reach here
    });

    logDebug('Sort: Cash categories sorted by ' + field + ' ' + order + '.');
    return sortedCategories;
}

function renderWatchlistSelect() {
    if (!watchlistSelect) { console.error('renderWatchlistSelect: watchlistSelect element not found.'); return; }
    // Store the currently selected value before clearing
    const currentSelectedValue = watchlistSelect.value;
    
    // Set the initial placeholder text to "Watch List"
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';

    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    // Ensure Portfolio is always present as a special option
    if (!watchlistSelect.querySelector('option[value="portfolio"]')) {
        const portfolioOption = document.createElement('option');
        portfolioOption.value = 'portfolio';
        portfolioOption.textContent = 'Portfolio';
        watchlistSelect.appendChild(portfolioOption);
    }

    userWatchlists.forEach(watchlist => {
        // Skip adding "Cash & Assets" if it's already a hardcoded option in HTML
        if (watchlist.id === CASH_BANK_WATCHLIST_ID) {
            return; 
        }
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Add the "Cash & Assets" option explicitly if it's not already in the HTML
    // This assumes it's added in HTML, but as a fallback, we ensure it's there.
    if (!watchlistSelect.querySelector(`option[value="${CASH_BANK_WATCHLIST_ID}"]`)) {
        const cashBankOption = document.createElement('option');
        cashBankOption.value = CASH_BANK_WATCHLIST_ID;
        cashBankOption.textContent = 'Cash & Assets'; // UPDATED TEXT
        watchlistSelect.appendChild(cashBankOption);
    }

    // Attempt to select the watchlist specified in currentSelectedWatchlistIds.
    // This array should already contain the correct ID (e.g., the newly created watchlist's ID)
    // from loadUserWatchlistsAndSettings.
    const desiredWatchlistId = currentSelectedWatchlistIds.length === 1 ? currentSelectedWatchlistIds[0] : '';
    
    if (desiredWatchlistId && Array.from(watchlistSelect.options).some(opt => opt.value === desiredWatchlistId)) {
        watchlistSelect.value = desiredWatchlistId;
    } else {
        // Fallback: Prefer the last selected view from localStorage if valid, especially for 'portfolio'
        try {
            const lsView = localStorage.getItem('lastSelectedView');
            const hasOption = lsView && Array.from(watchlistSelect.options).some(opt => opt.value === lsView);
            if (hasOption) {
                watchlistSelect.value = lsView;
                currentSelectedWatchlistIds = [lsView];
                logDebug('UI Update: Watchlist select applied lastSelectedView from localStorage: ' + lsView);
            } else {
                // Default to All Shares only if no valid preference is found
                watchlistSelect.value = ALL_SHARES_ID;
                currentSelectedWatchlistIds = [ALL_SHARES_ID];
                logDebug('UI Update: Watchlist select defaulted to All Shares as desired ID was not found.');
            }
        } catch(e) {
            // On any error, default to All Shares
            watchlistSelect.value = ALL_SHARES_ID;
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
            logDebug('UI Update: Watchlist select defaulted to All Shares due to error reading localStorage.');
        }
    }
    logDebug('UI Update: Watchlist select dropdown rendered. Selected value: ' + watchlistSelect.value);
    updateMainTitle(); // Update main title based on newly selected watchlist
    updateAddHeaderButton(); // Update the plus button context (and sidebar button context)
}

function renderSortSelect() {
        if (!sortSelect) { console.error('renderSortSelect: sortSelect element not found.'); return; }
    // Store the currently selected value before clearing (used as a fallback)
    const currentSelectedSortValue = sortSelect.value;

        // Set the initial placeholder text to "Sort List"
        sortSelect.innerHTML = '<option value="" disabled selected>Sort List</option>';

        const stockOptions = [
            // Put Percentage Change at the top
            { value: 'percentageChange-desc', text: 'Change % (H-L)' },
            { value: 'percentageChange-asc', text: 'Change % (L-H)' },
            // Then Name (Code)
            { value: 'shareName-asc', text: 'Code (A-Z)' },
            { value: 'shareName-desc', text: 'Code (Z-A)' },
            // Then Date and Rating
            { value: 'entryDate-desc', text: 'Date (H-L)' },
            { value: 'entryDate-asc', text: 'Date (L-H)' },
            { value: 'starRating-desc', text: '⭐ (H-L)' },
            { value: 'starRating-asc', text: '⭐ (L-H)' },
            // Dividend Yield last
            { value: 'dividendAmount-desc', text: 'Yield % (H-L)' },
            { value: 'dividendAmount-asc', text: 'Yield % (L-H)' }
        ];

        const cashOptions = [
            { value: 'name-asc', text: 'Asset Name (A-Z)' },
            { value: 'name-desc', text: 'Asset Name (Z-A)' },
            { value: 'balance-desc', text: 'Balance (High-Low)' },
            { value: 'balance-asc', text: 'Balance (Low-High)' }
        ];

        // Determine which set of options to display
        if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
            cashOptions.forEach(opt => {
                const optionElement = document.createElement('option');
                optionElement.value = opt.value;
                optionElement.textContent = opt.text;
                sortSelect.appendChild(optionElement);
            });
            logDebug('Sort Select: Populated with Cash Asset options.');
        } else {
            stockOptions.forEach(opt => {
                const optionElement = document.createElement('option');
                optionElement.value = opt.value;
                optionElement.textContent = opt.text;
                sortSelect.appendChild(optionElement);
            });
            logDebug('Sort Select: Populated with Stock options.');
        }

        let defaultSortValue = 'entryDate-desc'; // Default for stocks
        if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
            defaultSortValue = 'name-asc'; // Default for cash
        }

        // Prefer an explicitly set currentSortOrder if it's valid for this view
        const optionValues = Array.from(sortSelect.options).map(o => o.value);
        if (currentSortOrder && optionValues.includes(currentSortOrder)) {
            sortSelect.value = currentSortOrder;
            logDebug('Sort: Applied currentSortOrder: ' + currentSortOrder);
        } else if (currentSelectedSortValue && optionValues.includes(currentSelectedSortValue)) {
            sortSelect.value = currentSelectedSortValue;
            currentSortOrder = currentSelectedSortValue;
            logDebug('Sort: Applied previously selected sort order: ' + currentSortOrder);
        } else {
            // If not valid or no previous, apply the default for the current view type
            sortSelect.value = defaultSortValue;
            currentSortOrder = defaultSortValue;
            logDebug('Sort: No valid saved sort order or not applicable, defaulting to: ' + defaultSortValue);
        }

    logDebug('UI Update: Sort select rendered. Sort select disabled: ' + sortSelect.disabled);
    }


function openWatchlistPicker() {
    if (!watchlistPickerModal || !watchlistPickerList) {
        console.warn('Watchlist Picker: Modal elements not found. modal?', !!watchlistPickerModal, ' list?', !!watchlistPickerList);
        return;
    }
    console.log('[WatchlistPicker] Opening picker...');
    watchlistPickerList.innerHTML='';
    const items=[];
    items.push({id:ALL_SHARES_ID,name:'All Shares'});
    items.push({id:'portfolio',name:'Portfolio'});
    userWatchlists.filter(w=>w.id!==ALL_SHARES_ID && w.id!==CASH_BANK_WATCHLIST_ID).forEach(w=>items.push(w));
    items.push({id:CASH_BANK_WATCHLIST_ID,name:'Cash & Assets'});
    items.forEach(it=>{
        const div=document.createElement('div');
        div.className='picker-item'+(currentSelectedWatchlistIds[0]===it.id?' active':'');
        div.textContent=it.name;
        div.tabIndex=0;
        div.onclick=()=>{
            console.log('[WatchlistPicker] Selecting watchlist', it.id);
            currentSelectedWatchlistIds=[it.id];
            if (watchlistSelect) watchlistSelect.value=it.id; // sync hidden select
            try { localStorage.setItem('lastSelectedView', it.id); } catch(e) {}
            // Persist to Firestore as well for cross-device restore
            try { if (typeof saveLastSelectedWatchlistIds === 'function') { saveLastSelectedWatchlistIds(currentSelectedWatchlistIds); } } catch(e) { console.warn('Watchlist Picker: Failed to save selection to Firestore', e); }
            updateMainTitle();
            renderSortSelect();
            renderWatchlist();
            try { updateAddHeaderButton(); updateSidebarAddButtonContext(); } catch(e) {}
            toggleCodeButtonsArrow();
            try { hideModal(watchlistPickerModal); } catch(_) { watchlistPickerModal.classList.add('app-hidden'); watchlistPickerModal.style.display='none'; }
            if (dynamicWatchlistTitle) dynamicWatchlistTitle.setAttribute('aria-expanded','false');
            if (dynamicWatchlistTitleText) dynamicWatchlistTitleText.focus();
        };
        div.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); div.click(); } };
        watchlistPickerList.appendChild(div);
    });
    // Use centralized modal open so history/back works consistently
    try {
        showModal(watchlistPickerModal);
    } catch(e) {
        // Fallback if showModal is unavailable for some reason
        watchlistPickerModal.classList.remove('app-hidden');
        watchlistPickerModal.style.display='flex';
    }
    console.log('[WatchlistPicker] Modal shown. Item count:', watchlistPickerList.children.length);
}
function toggleCodeButtonsArrow() {
    if (!toggleAsxButtonsBtn) return;
    const current=currentSelectedWatchlistIds[0];
    if (current===CASH_BANK_WATCHLIST_ID) {
    toggleAsxButtonsBtn.style.display='none';
    if (asxCodeButtonsContainer) { asxCodeButtonsContainer.classList.add('app-hidden'); asxCodeButtonsContainer.style.display='none'; }
    } else {
    toggleAsxButtonsBtn.style.display='';
    if (asxCodeButtonsContainer) { asxCodeButtonsContainer.classList.remove('app-hidden'); if (asxButtonsExpanded) asxCodeButtonsContainer.style.display='flex'; }
        applyAsxButtonsState();
    }
}
if (dynamicWatchlistTitleText || dynamicWatchlistTitle) {
    const openPicker = () => {
        // If the sidebar (hamburger menu) is open, close it and do not open the picker on this click
        if (appSidebar && appSidebar.classList.contains('open')) {
            if (typeof toggleAppSidebar === 'function') toggleAppSidebar(false);
            return;
        }
        openWatchlistPicker();
        if (dynamicWatchlistTitle) dynamicWatchlistTitle.setAttribute('aria-expanded','true');
        setTimeout(()=>{
            const listEl = document.getElementById('watchlistPickerList');
            const first = listEl && listEl.querySelector('.picker-item');
            if (first) first.focus();
        },30);
    };
    // Bind to the narrow span to keep the click target tight
    const clickable = dynamicWatchlistTitleText || dynamicWatchlistTitle;
    if (clickable && clickable.getAttribute('data-picker-bound') !== 'true') {
        clickable.addEventListener('click', openPicker);
        clickable.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openPicker(); } });
        clickable.setAttribute('role','button');
        clickable.setAttribute('data-picker-bound','true');
    }
}
if (closeWatchlistPickerBtn) closeWatchlistPickerBtn.addEventListener('click', ()=>{ const modalEl=document.getElementById('watchlistPickerModal'); if (modalEl) { try { hideModal(modalEl); } catch(_) { modalEl.classList.add('app-hidden'); } } if (dynamicWatchlistTitle) { dynamicWatchlistTitle.setAttribute('aria-expanded','false'); } if (dynamicWatchlistTitleText) { dynamicWatchlistTitleText.focus(); } });
window.addEventListener('click', e=>{ if(e.target===watchlistPickerModal){ try { hideModal(watchlistPickerModal); } catch(_) { watchlistPickerModal.classList.add('app-hidden'); } if (dynamicWatchlistTitle) dynamicWatchlistTitle.setAttribute('aria-expanded','false'); if (dynamicWatchlistTitleText) dynamicWatchlistTitleText.focus(); } });
window.addEventListener('keydown', e=>{ if(e.key==='Escape' && watchlistPickerModal && watchlistPickerModal.style.display!=='none' && !watchlistPickerModal.classList.contains('app-hidden')){ try { hideModal(watchlistPickerModal); } catch(_) { watchlistPickerModal.classList.add('app-hidden'); } if (dynamicWatchlistTitle) dynamicWatchlistTitle.setAttribute('aria-expanded','false'); if (dynamicWatchlistTitleText) dynamicWatchlistTitleText.focus(); } });

// Wrap loadUserWatchlistsAndSettings to refresh new UI parts after data load
const __origLoadUserWatchlistsAndSettings = loadUserWatchlistsAndSettings;
loadUserWatchlistsAndSettings = async function() {
    await __origLoadUserWatchlistsAndSettings();
    updateMainTitle();
    renderSortSelect();
    toggleCodeButtonsArrow();
};

// Late-binding helper to ensure header interactions are wired when DOM is ready
function bindHeaderInteractiveElements() {
    const titleEl = document.getElementById('dynamicWatchlistTitle');
    const textEl = document.getElementById('dynamicWatchlistTitleText');
    // Bind only to the inner span for a narrower click target
    const clickable = textEl || titleEl;
    if (clickable && clickable.getAttribute('data-picker-bound') !== 'true') {
        const openPicker = () => {
            openWatchlistPicker();
            if (titleEl) titleEl.setAttribute('aria-expanded','true');
            setTimeout(()=>{
                const listEl = document.getElementById('watchlistPickerList');
                const first = listEl && listEl.querySelector('.picker-item');
                if (first) first.focus();
            },30);
        };
        clickable.addEventListener('click', openPicker);
        clickable.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openPicker(); } });
        clickable.setAttribute('role','button');
        clickable.setAttribute('data-picker-bound','true');
    }
    const closeBtn = document.getElementById('closeWatchlistPickerBtn');
    const pickerModal = document.getElementById('watchlistPickerModal');
    if (closeBtn && closeBtn.getAttribute('data-close-bound') !== 'true') {
        closeBtn.addEventListener('click', ()=>{ if (pickerModal) pickerModal.classList.add('app-hidden'); if (titleEl) { titleEl.setAttribute('aria-expanded','false'); } if (textEl) textEl.focus(); });
        closeBtn.setAttribute('data-close-bound','true');
    }
}

/**
 * Renders the watchlist based on the currentSelectedWatchlistIds. (1)
 * Optimized to update existing elements rather than recreating them, reducing flickering.
 */
function renderWatchlist() {
    logDebug('DEBUG: renderWatchlist called. Current selected watchlist ID: ' + currentSelectedWatchlistIds[0]);

    // --- Compact View Display Logic ---
    const isCompactView = currentMobileViewMode === 'compact';
    const isMobileView = window.innerWidth <= 768;
    if (isCompactView) {
        // Compact view: show card container as grid, hide table
        if (mobileShareCardsContainer) {
            mobileShareCardsContainer.style.display = 'grid';
        }
        if (tableContainer) {
            tableContainer.style.display = 'none';
        }
    } else if (isMobileView) {
        // Mobile, not compact: show card container as flex, hide table
        if (mobileShareCardsContainer) {
            mobileShareCardsContainer.style.display = 'flex';
        }
        if (tableContainer) {
            tableContainer.style.display = 'none';
        }
    } else {
        // Desktop: show table, hide card container
        if (mobileShareCardsContainer) {
            mobileShareCardsContainer.style.display = 'none';
        }
        if (tableContainer) {
            tableContainer.style.display = '';
        }
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];

    // Hide both sections initially
    stockWatchlistSection.classList.add('app-hidden');
    cashAssetsSection.classList.add('app-hidden');

    // Clear previous content (only for elements that will be conditionally displayed)
    // We will now manage individual row/card updates, so don't clear the whole tbody/container yet.
    // However, for switching between stock/cash, we might still need to clear.
    if (selectedWatchlistId === 'portfolio') {
        // Portfolio View: hide stock and cash sections, show/create portfolio section and render
        if (stockWatchlistSection) stockWatchlistSection.classList.add('app-hidden');
        if (cashAssetsSection) cashAssetsSection.classList.add('app-hidden');
        let portfolioSection = document.getElementById('portfolioSection');
        if (!portfolioSection) {
            portfolioSection = document.createElement('div');
            portfolioSection.id = 'portfolioSection';
            portfolioSection.className = 'portfolio-section';
            portfolioSection.innerHTML = '<h2>Portfolio</h2><div id="portfolioListContainer">Loading portfolio...</div>';
            if (mainContainer) mainContainer.appendChild(portfolioSection);
        }
        portfolioSection.style.display = 'block';
        // Hide stock-specific containers
        if (tableContainer) tableContainer.style.display = 'none';
        if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'none';
        // Update title
    // Title handled by updateMainTitle
    // Show sort dropdown in portfolio too
    sortSelect.classList.remove('app-hidden');
        refreshLivePricesBtn.classList.add('app-hidden');
        toggleCompactViewBtn.classList.add('app-hidden');
        exportWatchlistBtn.classList.remove('app-hidden'); // Allow export if desired
        // Render the portfolio list
        if (typeof renderPortfolioList === 'function') {
            renderPortfolioList();
        }
    // Update sort options and alerts for portfolio view as well
    try { renderSortSelect(); } catch(e) {}
    try { updateTargetHitBanner(); } catch(e) {}
        // Also render ASX code buttons for portfolio shares
        if (typeof renderAsxCodeButtons === 'function') {
            renderAsxCodeButtons();
        }
        adjustMainContentPadding();
        return;
    } else if (selectedWatchlistId !== CASH_BANK_WATCHLIST_ID) {
    // Hide portfolio section if it exists from previous view
    const existingPortfolio = document.getElementById('portfolioSection');
    if (existingPortfolio) existingPortfolio.style.display='none';
        // Stock Watchlist Logic
        stockWatchlistSection.classList.remove('app-hidden');
        // IMPORTANT: Also clear any inline display:none applied by showPortfolioView
        if (typeof stockWatchlistSection.style !== 'undefined') {
            stockWatchlistSection.style.display = '';
        }
        const selectedWatchlist = userWatchlists.find(wl => wl.id === selectedWatchlistId);
        if (selectedWatchlistId === ALL_SHARES_ID) {
            // Title handled by updateMainTitle
        } else if (selectedWatchlist) {
            // Title handled by updateMainTitle
        } else if (selectedWatchlistId === 'portfolio') {
            // Title handled by updateMainTitle
        } else {
            // Title handled by updateMainTitle
        }

        // Show stock-specific UI elements
        sortSelect.classList.remove('app-hidden');
        refreshLivePricesBtn.classList.remove('app-hidden');
        toggleCompactViewBtn.classList.remove('app-hidden');
        exportWatchlistBtn.classList.remove('app-hidden');
        // startLivePriceUpdates(); // Removed this line to prevent multiple intervals
        updateAddHeaderButton();

        const isMobileView = window.innerWidth <= 768;
        let sharesToRender = [];

        if (selectedWatchlistId === ALL_SHARES_ID) {
            sharesToRender = dedupeSharesById(allSharesData);
            logDebug('Render: Displaying all shares (from ALL_SHARES_ID in currentSelectedWatchlistIds).');
        } else if (currentSelectedWatchlistIds.length === 1) {
            sharesToRender = dedupeSharesById(allSharesData).filter(share => currentSelectedWatchlistIds.some(id => shareBelongsTo(share, id)));
            logDebug('Render: Displaying shares from watchlist: ' + selectedWatchlistId);
        } else {
            logDebug('Render: No specific stock watchlists selected or multiple selected, showing empty state.');
        }

        // --- Optimized DOM Update for Shares ---
        const existingTableRows = Array.from(shareTableBody.children);
        const existingMobileCards = Array.from(mobileShareCardsContainer.children);
        const existingAsxButtons = Array.from(asxCodeButtonsContainer.children);

        const newShareIds = new Set(sharesToRender.map(s => s.id));
        const newAsxCodes = new Set(sharesToRender.map(s => s.shareName.trim().toUpperCase()));

        // Remove old rows/cards/buttons that are no longer in the filtered list
        existingTableRows.forEach(row => {
            if (!newShareIds.has(row.dataset.docId)) {
                row.remove();
            }
        });
        existingMobileCards.forEach(card => {
            if (!newShareIds.has(card.dataset.docId)) {
                card.remove();
            }
        });
        // Clear existing rows and cards before re-rendering in sorted order
        // This ensures the order is always correct based on the sorted `sharesToRender` array
        if (shareTableBody) {
            shareTableBody.innerHTML = '';
        }
        if (mobileShareCardsContainer) {
            mobileShareCardsContainer.innerHTML = '';
        }

        // Re-add shares to the UI in their sorted order
        if (sharesToRender.length > 0) {
            sharesToRender.forEach(share => {
                if (tableContainer && tableContainer.style.display !== 'none') {
                    addShareToTable(share); // Using add functions to ensure new row/card is created in order
                }
                if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') {
                    addShareToMobileCards(share); // Using add functions to ensure new row/card is created in order
                }
            });
        } else {
            // Handle empty message if no shares to render in current view
            const emptyWatchlistMessage = document.createElement('p');
            emptyWatchlistMessage.textContent = 'No shares found for the selected watchlists. Add a new share to get started!';
            emptyWatchlistMessage.style.textAlign = 'center';
            emptyWatchlistMessage.style.padding = '20px';
            emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
            
            if (tableContainer && tableContainer.style.display !== 'none') {
                const td = document.createElement('td');
                td.colSpan = 6;
                td.appendChild(emptyWatchlistMessage);
                const tr = document.createElement('tr');
                tr.classList.add('empty-message-row'); // Add class to easily target for removal later
                tr.appendChild(td);
                shareTableBody.appendChild(tr);
            }
            if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') {
                mobileShareCardsContainer.appendChild(emptyWatchlistMessage.cloneNode(true));
            }
        }
        
        // Re-render ASX Code Buttons separately
        renderAsxCodeButtons();

    } else {
        // Cash & Assets section Logic
        cashAssetsSection.classList.remove('app-hidden');
    const existingPortfolio2 = document.getElementById('portfolioSection');
    if (existingPortfolio2) existingPortfolio2.style.display='none';
    // Title handled by updateMainTitle
        renderCashCategories();
        sortSelect.classList.remove('app-hidden');
        refreshLivePricesBtn.classList.add('app-hidden');
        toggleCompactViewBtn.classList.add('app-hidden');
        asxCodeButtonsContainer.classList.add('app-hidden'); // Ensure hidden in cash view
    // Hide in cash view via inline style to avoid class conflicts
    if (targetHitIconBtn) targetHitIconBtn.style.display = 'none';
        exportWatchlistBtn.classList.add('app-hidden');
        stopLivePriceUpdates();
        updateAddHeaderButton();
        // Ensure stock-specific containers are hidden when showing cash assets
        if (tableContainer) tableContainer.style.display = 'none';
        if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'none';
    }
    // Update sort dropdown options based on selected watchlist type
    renderSortSelect(); // Moved here to ensure it updates for both stock and cash views
    updateMainButtonsState(!!currentUserId); // Ensure button states (like Edit Watchlist) are correct for the current view
    adjustMainContentPadding();
    try { updateMainTitle(); } catch(e) {}
    try { ensureTitleStructure(); } catch(e) {}
    try { updateTargetHitBanner(); } catch(e) {}
}

function renderAsxCodeButtons() {
    if (!asxCodeButtonsContainer) { console.error('renderAsxCodeButtons: asxCodeButtonsContainer element not found.'); return; }
    asxCodeButtonsContainer.innerHTML = '';
    const uniqueAsxCodes = new Set();
    
    let sharesForButtons = [];
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) { 
        sharesForButtons = dedupeSharesById(allSharesData);
    } else {
        sharesForButtons = dedupeSharesById(allSharesData).filter(share => currentSelectedWatchlistIds.some(id => shareBelongsTo(share, id)));
    }

    sharesForButtons.forEach(share => {
        if (share.shareName && typeof share.shareName === 'string' && share.shareName.trim() !== '') {
                uniqueAsxCodes.add(share.shareName.trim().toUpperCase());
        }
    });

    if (uniqueAsxCodes.size === 0) {
        // Let centralized state handler control visibility; just clear contents
        logDebug('UI: No unique ASX codes found for current view.');
        applyAsxButtonsState();
        return;
    }
    const sortedAsxCodes = Array.from(uniqueAsxCodes).sort();
    sortedAsxCodes.forEach(asxCode => {
        const button = document.createElement('button');
        button.className = 'asx-code-btn';
        button.textContent = asxCode;
        button.dataset.asxCode = asxCode;

        // Determine price change class for the button
        let buttonPriceChangeClass = '';
        const livePriceData = livePrices[asxCode.toUpperCase()];
        if (livePriceData) {
            // Fallback logic: use current values else last fetched values
            const latestLive = (livePriceData.live !== null && !isNaN(livePriceData.live)) ? livePriceData.live : (livePriceData.lastLivePrice ?? null);
            const latestPrev = (livePriceData.prevClose !== null && !isNaN(livePriceData.prevClose)) ? livePriceData.prevClose : (livePriceData.lastPrevClose ?? null);
            if (latestLive !== null && latestPrev !== null && !isNaN(latestLive) && !isNaN(latestPrev)) {
                const change = latestLive - latestPrev;
                if (change > 0) buttonPriceChangeClass = 'positive'; else if (change < 0) buttonPriceChangeClass = 'negative'; else buttonPriceChangeClass = 'neutral';
            }
        }
        // Apply color class based on price change
        if (buttonPriceChangeClass) {
            button.classList.add(buttonPriceChangeClass);
        }
        // Additional context class when in portfolio for stronger theme coloring
        if (currentSelectedWatchlistIds.length === 1 && currentSelectedWatchlistIds[0] === 'portfolio') {
            button.classList.add('portfolio-context');
        }

        // Add target-hit-border class if this ASX code has a target hit AND not dismissed
        const livePriceDataForButton = livePrices[asxCode.toUpperCase()];
        if (livePriceDataForButton && livePriceDataForButton.targetHit && !targetHitIconDismissed) {
            button.classList.add('target-hit-alert'); // Use 'target-hit-alert' for consistency with modal/cards
        } else {
            button.classList.remove('target-hit-alert'); // Ensure class is removed
        }

        asxCodeButtonsContainer.appendChild(button);
    });
    // Remove any lingering active state on rebuild
    asxCodeButtonsContainer.querySelectorAll('button.asx-code-btn').forEach(b=>b.classList.remove('active'));
    // Delegated click handler (single)
    if (!asxCodeButtonsContainer.__delegated) {
        asxCodeButtonsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button.asx-code-btn');
            if (!btn) return;
            const code = btn.dataset.asxCode;
            logDebug('ASX Button Click (delegated): ' + code);
            asxCodeButtonsContainer.querySelectorAll('button.asx-code-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            scrollToShare(code);
            // NEW: If the Add/Edit Share form is open, also populate the code field and show a quick live snapshot
            try {
                const formVisible = shareFormSection && shareFormSection.style.display !== 'none' && !shareFormSection.classList.contains('app-hidden');
                if (formVisible && shareNameInput) {
                    const company = Array.isArray(allAsxCodes) ? (allAsxCodes.find(c => c.code === code)?.name || '') : '';
                    shareNameInput.value = code;
                    if (formCompanyName) formCompanyName.textContent = company;
                    checkFormDirtyState();
                    // Fetch a single-stock snapshot to render the small live panel
                    updateAddFormLiveSnapshot(code);
                }
            } catch(_) {}
        });
        asxCodeButtonsContainer.__delegated = true;
    }
    logDebug('UI: Rendered ' + sortedAsxCodes.length + ' code buttons.');
    // Re-apply visibility state centrally and adjust padding via applyAsxButtonsState()
    applyAsxButtonsState();
}

function scrollToShare(asxCode) {
    logDebug('UI: Attempting to scroll to/highlight share with Code: ' + asxCode);
    const targetShare = allSharesData.find(s => s.shareName && s.shareName.toUpperCase() === asxCode.toUpperCase());
    if (targetShare) {
        selectShare(targetShare.id);
        let elementToScrollTo = document.querySelector('#shareTable tbody tr[data-doc-id="' + targetShare.id + '"]');
        if (!elementToScrollTo || window.matchMedia('(max-width: 768px)').matches) {
            elementToScrollTo = document.querySelector('.mobile-card[data-doc-id="' + targetShare.id + '"]');
        }
        if (elementToScrollTo) {
            // Get the height of the fixed header only, as banner is now at bottom
            const fixedHeaderHeight = appHeader ? appHeader.offsetHeight : 0;
            const elementRect = elementToScrollTo.getBoundingClientRect();
            // Calculate scroll position, accounting for the fixed header
            const scrollY = elementRect.top + window.scrollY - fixedHeaderHeight - 10; // 10px buffer for a little space
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
            logDebug('UI: Scrolled to element for share ID: ' + targetShare.id);
        } else {
            console.warn('UI: Element for share ID: ' + targetShare.id + ' not found for scrolling.');
        }
        showShareDetails(); 
    } else {
        showCustomAlert('Share \'' + asxCode + '\' not found.');
        console.warn('UI: Share \'' + asxCode + '\' not found in allSharesData.');
    }
}

const COMPANY_TAX_RATE = 0.30;
function calculateUnfrankedYield(dividendAmount, currentPrice) {
    // Ensure inputs are valid numbers and currentPrice is not zero
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount < 0) { return 0; } // Yield can't be negative, default to 0
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return 0; } // Price must be positive for yield calculation
    return (dividendAmount / currentPrice) * 100;
}

/**
 * Displays detailed stock information in the search modal,
 * and renders action buttons (Add to Watchlist / Edit Existing Share).
 * @param {string} asxCode The ASX code to display.
 */
async function displayStockDetailsInSearchModal(asxCode) {
    if (!searchResultDisplay) {
        console.error('displayStockDetailsInSearchModal: searchResultDisplay element not found.');
        return;
    }

    searchResultDisplay.innerHTML = '<div class="loader"></div><p>Fetching stock data...</p>'; // Show loading spinner
    searchModalActionButtons.innerHTML = ''; // Clear existing buttons
    currentSearchShareData = null; // Reset previous data

    try {
    const encoded = encodeURIComponent(asxCode.trim().toUpperCase());
    if (DEBUG_MODE) logDebug('Search Modal: Fetching', `${GOOGLE_APPS_SCRIPT_URL}?stockCode=${encoded}`);
    const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?stockCode=${encoded}&_ts=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    let data; let rawText;
    try {
        rawText = await response.text();
        if (DEBUG_MODE) logDebug('Search Modal: Raw response text length', rawText.length);
        try {
            data = JSON.parse(rawText);
        } catch(parseErr) {
            if (DEBUG_MODE) console.warn('Search Modal: JSON parse failed, raw snippet:', rawText.slice(0,400));
            throw new Error('Invalid JSON from data source');
        }
    } catch(streamErr) {
        throw streamErr;
    }
        logDebug(`Search: Fetched details for ${asxCode}:`, data);

        // Validate response contains at least one recognizable code key across any row
        const CODE_KEYS = ['ASXCode','ASX_Code','ASX Code','Code','code'];
        const hasAnyRowWithCode = Array.isArray(data) && data.some(r => CODE_KEYS.some(k => r && r[k]));
        if (!Array.isArray(data) || data.length === 0 || !hasAnyRowWithCode) {
            const isValidAsxCode = (allAsxCodes||[]).some(s => s.code === asxCode.toUpperCase());
            if (!isValidAsxCode) {
                searchResultDisplay.innerHTML = `<p class="initial-message">ASX code "${asxCode}" not found in code list. Check spelling.</p>`;
            } else {
                if (DEBUG_MODE && data && data[0]) {
                    console.warn('Search Modal: Unrecognized data shape, sample keys:', Object.keys(data[0]||{}));
                }
                searchResultDisplay.innerHTML = `<p class="initial-message">No live data available for ${asxCode} (source returned unrecognized structure).</p>`;
            }
            return;
        }

        // Prefer exact match row (some endpoints may return array with additional rows)
        const upperReq = asxCode.toUpperCase();
        let stockData = data.find(r => {
            const c = r.ASXCode || r.ASX_Code || r['ASX Code'] || r.Code || r.code;
            return c && String(c).toUpperCase().trim() === upperReq;
        });
        if (!stockData) {
            stockData = data[0];
            logDebug('Search Modal: No exact code match; using first row as fallback.', { requested: upperReq, firstKeys: Object.keys(data[0]||{}) });
        }
        // Resolve company name robustly: treat blank / placeholder API values as missing then fall back to
        // 1) existing share's stored name, 2) allAsxCodes mapping, else empty string.
        (function resolveCompanyName(){
            try {
                let rawName = stockData.CompanyName;
                if (typeof rawName === 'string') rawName = rawName.trim();
                const codeForLookup = (
                    stockData.ASXCode || stockData.ASX_Code || stockData['ASX Code'] ||
                    stockData.Code || stockData.code || asxCode || ''
                ).toUpperCase();
                const looksLikePlaceholder = !rawName || /^(-|N\/?A|N\\A)$/i.test(rawName);
                if (looksLikePlaceholder) {
                    // Existing share (already in watchlist) may have canonical companyName stored
                    const existingShareEntry = allSharesData.find(s => s.shareName.toUpperCase() === codeForLookup);
                    const mappedFromCodes = Array.isArray(allAsxCodes) ? (allAsxCodes.find(c => c.code === codeForLookup)?.name || '') : '';
                    rawName = (existingShareEntry && existingShareEntry.companyName) || mappedFromCodes || '';
                    if (DEBUG_MODE && rawName) logDebug('Search Modal: Applied fallback company name', { code: codeForLookup, resolved: rawName });
                }
                stockData.CompanyName = rawName || '';
            } catch (e) {
                stockData.CompanyName = stockData.CompanyName || '';
                if (DEBUG_MODE) console.warn('Search Modal: Company name resolution failed', e);
            }
        })();

        // Check if the stock is already in the user's watchlist
        const existingShare = allSharesData.find(s => s.shareName.toUpperCase() === asxCode.toUpperCase());

        // Prepare the data to be displayed in the modal (robust multi-key fallbacks matching snapshot logic)
        function pickNumber(obj, keys) {
            for (const k of keys) {
                if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
                    const v = parseFloat(obj[k]);
                    if (!isNaN(v)) return v;
                }
            }
            return NaN;
        }
        const currentLivePrice = pickNumber(stockData, ['LivePrice','Live Price','live','price','Last','LastPrice','Last Price','LastTrade','Last Trade']);
        const previousClosePrice = pickNumber(stockData, ['PrevClose','Prev Close','prevClose','prev','Previous Close','Close','Last Close']);
        const peRatio = pickNumber(stockData, ['PE','PE Ratio','pe']);
        const high52Week = pickNumber(stockData, ['High52','High52','High 52','52WeekHigh','52 High']);
        const low52Week = pickNumber(stockData, ['Low52','Low52','Low 52','52WeekLow','52 Low']);
        if (DEBUG_MODE) logDebug('Search Modal: Normalized numeric fields', { currentLivePrice, previousClosePrice, peRatio, high52Week, low52Week, rawKeys: Object.keys(stockData||{}) });

        // Determine price change class
        let priceClass = '';
        let priceChangeText = 'N/A';
        let displayPrice = 'N/A';

        if (!isNaN(currentLivePrice) && currentLivePrice !== null) {
            displayPrice = `$${formatAdaptivePrice(currentLivePrice)}`;
            if (!isNaN(previousClosePrice) && previousClosePrice !== null) {
                const change = currentLivePrice - previousClosePrice;
                const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                const arrow = change > 0 ? '▲' : (change < 0 ? '▼' : '');
                priceChangeText = `${arrow} ${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
            }
        }

        // Check if the currently displayed stock from search has hit its target (if it's in our allSharesData)
        const correspondingShareInWatchlist = allSharesData.find(s => s.shareName.toUpperCase() === asxCode.toUpperCase());
        const livePriceDataForSearchModal = livePrices[asxCode.toUpperCase()];
        const isTargetHitForSearchModal = correspondingShareInWatchlist && livePriceDataForSearchModal ? livePriceDataForSearchModal.targetHit : false;

        let searchModalTitleClasses = priceClass;
        // Apply target-hit-alert class if target is hit AND not dismissed
        if (isTargetHitForSearchModal && !targetHitIconDismissed) {
            searchModalTitleClasses += ' target-hit-alert';
        }

        // Construct the display HTML
        const resolvedDisplayCode = (stockData.ASXCode || stockData.ASX_Code || stockData['ASX Code'] || stockData.Code || stockData.code || asxCode || '').toUpperCase();
        searchResultDisplay.innerHTML = `
            <div class="text-center mb-4">
                <h3 class="${searchModalTitleClasses} search-modal-code-header" data-code="${resolvedDisplayCode}" data-name="${stockData.CompanyName || ''}" data-company="${stockData.CompanyName || ''}" title="Click to populate Add Share form">${resolvedDisplayCode || 'N/A'} ${stockData.CompanyName ? '- ' + stockData.CompanyName : ''}</h3>
                <span class="text-sm text-gray-500">${stockData.CompanyName ? '' : '(Company Name N/A)'}</span>
                ${DEBUG_MODE ? `<div class="debug-keys">Keys: ${(Object.keys(stockData||{})).slice(0,25).join(', ')}</div>` : ''}
            </div>
            <div class="live-price-display-section">
                <div class="fifty-two-week-row">
                    <h3 class="fifty-two-week-value low">Low: ${!isNaN(low52Week) ? formatMoney(low52Week) : 'N/A'}</h3>
                    <h3 class="fifty-two-week-value high">High: ${!isNaN(high52Week) ? formatMoney(high52Week) : 'N/A'}</h3>
                </div>
                <div class="live-price-main-row">
                        <h2 class="modal-share-name neutral-code-text">${displayPrice}</h2>
                        <span class="price-change-large ${priceClass}">${priceChangeText}</span>
                    </div>
                <div class="pe-ratio-row">
                    <h3 class="pe-ratio-value">P/E: ${!isNaN(peRatio) ? formatAdaptivePrice(peRatio) : 'N/A'}</h3>
                </div>
            </div>
            <div class="external-links-section">
                <h3>External Links</h3>
                <div class="external-link-item">
                    <a id="searchModalNewsLink" href="#" target="_blank" class="external-link">View News <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalMarketIndexLink" href="#" target="_blank" class="external-link">View on MarketIndex.com.au <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalFoolLink" href="#" target="_blank" class="external-link">View on Fool.com.au <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalListcorpLink" href="#" target="_blank" class="external-link">View on Listcorp.com <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalCommSecLink" href="#" target="_blank" class="external-link">View on CommSec.com.au <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalGoogleFinanceLink" href="#" target="_blank" class="external-link">View on Google Finance <i class="fas fa-external-link-alt"></i></a>
                </div>
                <p class="ghosted-text external-links-note">Login may be required for some data sources.</p>
            </div>
        `;

        // Populate external links
        const encodedAsxCode = encodeURIComponent(asxCode);
        const searchModalNewsLink = document.getElementById('searchModalNewsLink');
        const searchModalMarketIndexLink = document.getElementById('searchModalMarketIndexLink');
        const searchModalFoolLink = document.getElementById('searchModalFoolLink');
        const searchModalListcorpLink = document.getElementById('searchModalListcorpLink');
        const searchModalCommSecLink = document.getElementById('searchModalCommSecLink');
    const searchModalGoogleFinanceLink = document.getElementById('searchModalGoogleFinanceLink');

        if (searchModalNewsLink) searchModalNewsLink.href = `https://news.google.com/search?q=${encodedAsxCode}%20ASX&hl=en-AU&gl=AU&ceid=AU%3Aen`;
        if (searchModalMarketIndexLink) searchModalMarketIndexLink.href = `https://www.marketindex.com.au/asx/${asxCode.toLowerCase()}`;
        if (searchModalFoolLink) searchModalFoolLink.href = `https://www.fool.com.au/quote/${asxCode}/`; // Assuming Fool URL structure
        if (searchModalListcorpLink) searchModalListcorpLink.href = `https://www.listcorp.com/asx/${asxCode.toLowerCase()}`;
        if (searchModalCommSecLink) searchModalCommSecLink.href = `https://www.commsec.com.au/markets/company-details.html?code=${asxCode}`;
    if (searchModalGoogleFinanceLink) searchModalGoogleFinanceLink.href = `https://www.google.com/finance/quote/${asxCode.toUpperCase()}:ASX`;

        // Store the fetched data for potential adding/editing (normalize code property fallbacks)
        const resolvedCode = stockData.ASXCode || stockData.ASX_Code || stockData['ASX Code'] || stockData.Code || stockData.code || asxCode;
        currentSearchShareData = {
            shareName: String(resolvedCode || '').toUpperCase(), // legacy consumers
            shareCode: String(resolvedCode || '').toUpperCase(),  // explicit code key for clarity
            companyName: stockData.CompanyName,
            currentPrice: currentLivePrice,
            targetPrice: null,
            dividendAmount: null,
            frankingCredits: null,
            starRating: 0,
            comments: [],
            watchlistId: null
        };

        // Two-step workflow: DO NOT auto-open add/edit form here.
        // User must click the action button rendered below.

    // Render action button (explicit user intent only)
        const actionButton = document.createElement('button');
        actionButton.classList.add('button', 'primary-button'); // Apply base button styles
        
        if (existingShare) {
            actionButton.textContent = 'Edit Share in Tracker';
            actionButton.addEventListener('click', () => {
                hideModal(stockSearchModal); // Close search modal
                // If the user clicks "Add Share to ASX Tracker" for an existing share,
                // we should open the edit form for that existing share.
                showEditFormForSelectedShare(existingShare.id);
            });
        } else {
            actionButton.textContent = 'Add Share to ASX Tracker'; // Changed text to be consistent for new shares
            actionButton.addEventListener('click', () => {
                hideModal(stockSearchModal); // Close search modal
                clearForm(); // Start clean add flow
                userManuallyOverrodeDirection = false;
                formTitle.textContent = 'Add New Share'; // Set title for new share
                if (currentSearchShareData) {
                    if (shareNameInput) shareNameInput.value = currentSearchShareData.shareCode || currentSearchShareData.shareName || '';
                    if (formCompanyName) formCompanyName.textContent = currentSearchShareData.companyName || '';
                }
                populateShareWatchlistSelect(null, true); // Populate and enable watchlist select for new share
                // Default toggles to Buy+Below
                try {
                    if (targetIntentBuyBtn && targetIntentSellBtn) {
                        targetIntentBuyBtn.classList.add('is-active');
                        targetIntentBuyBtn.setAttribute('aria-pressed', 'true');
                        targetIntentSellBtn.classList.remove('is-active');
                        targetIntentSellBtn.setAttribute('aria-pressed', 'false');
                    }
                    if (targetAboveCheckbox && targetBelowCheckbox) {
                        targetAboveCheckbox.checked = false;
                        targetBelowCheckbox.checked = true;
                    }
                    if (targetDirAboveBtn && targetDirBelowBtn) {
                        targetDirAboveBtn.classList.remove('is-active');
                        targetDirAboveBtn.setAttribute('aria-pressed', 'false');
                        targetDirBelowBtn.classList.add('is-active');
                        targetDirBelowBtn.setAttribute('aria-pressed', 'true');
                    }
                } catch(_) {}
                if (commentsFormContainer && commentsFormContainer.querySelectorAll('.comment-section').length === 0) {
                    addCommentSection(commentsFormContainer); // Add initial empty comment section
                }
                // Fetch snapshot to prefill reference price & live view
                try { updateAddFormLiveSnapshot(currentSearchShareData.shareCode); } catch(_) {}
                showModal(shareFormSection); // Show add/edit modal
                if (targetPriceInput) targetPriceInput.focus();
                checkFormDirtyState(); // Recompute dirty state
            });
        }
        searchModalActionButtons.appendChild(actionButton);
        logDebug(`Search: Displayed details and action button for ${asxCode}.`);

    } catch (error) {
        console.error('Search: Error fetching stock details:', error);
        const friendly = (
            /NetworkError|Failed to fetch/i.test(error.message) ? 'Network issue fetching data. Check connection.' :
            /HTTP 4\d\d/.test(error.message) ? 'Request issue (client error). Try again or verify code.' :
            /HTTP 5\d\d/.test(error.message) ? 'Data source temporarily unavailable (server error).' :
            'Unexpected error while fetching data.'
        );
        searchResultDisplay.innerHTML = `<p class="initial-message">${friendly} (${asxCode}).</p>`;
        if (DEBUG_MODE) {
            const pre = document.createElement('pre');
            pre.className = 'debug-block';
            pre.textContent = 'Debug: ' + (error && error.stack ? error.stack : error.message);
            searchResultDisplay.appendChild(pre);
        }
        searchModalActionButtons.innerHTML = '';
    }
}

/**
 * Loads ASX company codes and names from a local CSV file.
 * Assumes CSV has headers 'ASX Code' and 'Company Name'.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of stock objects.
 */
async function loadAsxCodesFromCSV() {
    try {
        const response = await fetch('./asx_codes.csv'); // Assuming the CSV is named asx_codes.csv and is in the root
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        logDebug('CSV: ASX codes CSV loaded successfully. Parsing...');

        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
            console.warn('CSV: ASX codes CSV is empty.');
            return [];
        }

        const headers = lines[0].split(',').map(header => header.trim());
        const asxCodeIndex = headers.indexOf('ASX Code');
        const companyNameIndex = headers.indexOf('Company Name');

        if (asxCodeIndex === -1 || companyNameIndex === -1) {
            throw new Error('CSV: Required headers "ASX Code" or "Company Name" not found in CSV.');
        }

        const parsedCodes = lines.slice(1).map(line => {
            const values = line.split(',');
            // Handle cases where lines might not have enough columns or contain extra commas within quoted fields
            // For simple CSV, splitting by comma is usually sufficient. More robust parsing might use a library.
            const code = values[asxCodeIndex] ? values[asxCodeIndex].trim().toUpperCase() : '';
            const name = values[companyNameIndex] ? values[companyNameIndex].trim() : '';
            return { code: code, name: name };
        }).filter(item => item.code !== ''); // Filter out any entries without a code

        logDebug(`CSV: Successfully parsed ${parsedCodes.length} ASX codes from CSV.`);
        return parsedCodes;

    } catch (error) {
        console.error('CSV: Error loading or parsing ASX codes CSV:', error);
        showCustomAlert('Error loading stock search data: ' + error.message, 3000);
        return [];
    }
}
/**
 * Checks if the Australian Securities Exchange (ASX) is currently open.
 * The market is considered "closed" only from Monday 12:01 AM to Thursday 12:01 AM (Sydney time).
 * @returns {boolean} True if the ASX is open, false otherwise.
 */
function isAsxMarketOpen() {
    // Manual override support: localStorage key 'marketStatusOverride' can be 'open' or 'closed'
    try {
        const override = localStorage.getItem('marketStatusOverride');
        if (override === 'open') return true;
        if (override === 'closed') return false;
    } catch (e) { /* ignore */ }
    // Simplified: treat market as open by default per user preference (always show live styling)
    // Optionally, you can reintroduce custom windows here.
    return true;
}
function calculateFrankedYield(dividendAmount, currentPrice, frankingCreditsPercentage) {
    // Ensure inputs are valid numbers and currentPrice is not zero
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount < 0) { return 0; }
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return 0; }
    if (typeof frankingCreditsPercentage !== 'number' || isNaN(frankingCreditsPercentage) || frankingCreditsPercentage < 0 || frankingCreditsPercentage > 100) { return 0; }

    const unfrankedYield = calculateUnfrankedYield(dividendAmount, currentPrice);
    if (unfrankedYield === 0) return 0; // If unfranked is 0, franked is also 0

    const frankingRatio = frankingCreditsPercentage / 100;
    const frankingCreditPerShare = dividendAmount * (COMPANY_TAX_RATE / (1 - COMPANY_TAX_RATE)) * frankingRatio;
    const grossedUpDividend = dividendAmount + frankingCreditPerShare;

    return (grossedUpDividend / currentPrice) * 100;
}

function estimateDividendIncome(investmentValue, dividendAmountPerShare, currentPricePerShare) {
    if (typeof investmentValue !== 'number' || isNaN(investmentValue) || investmentValue <= 0) { return null; }
    if (typeof dividendAmountPerShare !== 'number' || isNaN(dividendAmountPerShare) || dividendAmountPerShare <= 0) { return null; }
    if (typeof currentPricePerShare !== 'number' || isNaN(currentPricePerShare) || currentPricePerShare <= 0) { return null; }
    const numberOfShares = investmentValue / currentPricePerShare;
    return numberOfShares * dividendAmountPerShare;
}

function updateCalculatorDisplay() {
    calculatorInput.textContent = previousCalculatorInput + (operator ? ' ' + getOperatorSymbol(operator) + ' ' : '') + currentCalculatorInput;
    if (resultDisplayed) { /* nothing */ }
    else { calculatorResult.textContent = currentCalculatorInput === '' ? '0' : currentCalculatorInput; }
}

function calculateResult() {
    let prev = parseFloat(previousCalculatorInput);
    let current = parseFloat(currentCalculatorInput);
    if (isNaN(prev) || isNaN(current)) return;
    let res;
    switch (operator) {
        case 'add': res = prev + current; break;
        case 'subtract': res = prev - current; break;
        case 'multiply': res = prev * current; break;
        case 'divide':
            if (current === 0) { showCustomAlert('Cannot divide by zero!'); res = 'Error'; }
            else { res = prev / current; }
            break;
        default: return;
    }
    if (typeof res === 'number' && !isNaN(res)) { res = parseFloat(res.toFixed(10)); }
    calculatorResult.textContent = res;
    previousCalculatorInput = res.toString();
    currentCalculatorInput = '';
}

function getOperatorSymbol(op) {
    switch (op) {
        case 'add': return '+'; case 'subtract': return '-';
        case 'multiply': return '×'; case 'divide': return '÷';
        default: return '';
    }
}

function resetCalculator() {
    currentCalculatorInput = ''; operator = null; previousCalculatorInput = '';
    resultDisplayed = false; calculatorInput.textContent = ''; calculatorResult.textContent = '0';
    logDebug('Calculator: Calculator state reset.');
}

async function applyTheme(themeName) {
    const body = document.body;
    // Remove all existing theme classes
    body.className = body.className.split(' ').filter(c => !c.endsWith('-theme') && !c.startsWith('theme-')).join(' ');

    logDebug('Theme Debug: Attempting to apply theme: ' + themeName);
    currentActiveTheme = themeName;

    if (themeName === 'system-default') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.removeItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            body.classList.add('dark-theme');
        }
        logDebug('Theme Debug: Reverted to system default theme.');
        // When reverting to system-default, ensure currentCustomThemeIndex is reset to -1
        currentCustomThemeIndex = -1; 
    } else if (themeName === 'light' || themeName === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.setItem('theme', themeName);
        if (themeName === 'dark') {
            body.classList.add('dark-theme');
        }
        logDebug('Theme Debug: Applied explicit default theme: ' + themeName);
        // When applying explicit light/dark, ensure currentCustomThemeIndex is reset to -1
        currentCustomThemeIndex = -1; 
    } else {
        // For custom themes, apply the class and set data-theme attribute
        // The class name is 'theme-' followed by the themeName (e.g., 'theme-bold-1', 'theme-muted-blue')
        body.classList.add('theme-' + themeName.toLowerCase().replace(/\s/g, '-')); // Convert "Muted Blue" to "muted-blue" for class
        body.setAttribute('data-theme', themeName); // Keep the full name in data-theme
        localStorage.setItem('selectedTheme', themeName);
        localStorage.removeItem('theme');
        logDebug('Theme Debug: Applied custom theme: ' + themeName);
        // When applying a custom theme, set currentCustomThemeIndex to its position
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(themeName); 
    }
    
    logDebug('Theme Debug: Body classes after applying: ' + body.className);
    logDebug('Theme Debug: currentCustomThemeIndex after applying: ' + currentCustomThemeIndex);

    if (currentUserId && db && window.firestore) {
        const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
        try {
            await window.firestore.setDoc(userProfileDocRef, { lastTheme: themeName }, { merge: true });
            logDebug('Theme: Saved theme preference to Firestore: ' + themeName);
        } catch (error) {
            console.error('Theme: Error saving theme preference to Firestore:', error);
        }
    }
    updateThemeToggleAndSelector();
}

function updateThemeToggleAndSelector() {
    if (colorThemeSelect) {
        // Set the dropdown value to the current active theme if it's a custom theme
        if (CUSTOM_THEMES.includes(currentActiveTheme)) {
            colorThemeSelect.value = currentActiveTheme;
        } else {
            // If not a custom theme (system-default, light, dark), set dropdown to 'none' (No Custom Theme)
            colorThemeSelect.value = 'none';
        }
        logDebug('Theme UI: Color theme select updated to: ' + colorThemeSelect.value);
    }

    // This part ensures currentCustomThemeIndex is correctly set based on the currentActiveTheme
    // regardless of whether it was set by toggle or dropdown/load.
    // This is crucial for the toggle button to know where it is in the cycle.
    if (CUSTOM_THEMES.includes(currentActiveTheme)) {
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(currentActiveTheme);
    } else {
        currentCustomThemeIndex = -1; // Not a custom theme, so reset index
    }
    logDebug('Theme UI: currentCustomThemeIndex after updateThemeToggleAndSelector: ' + currentCustomThemeIndex);
}

function getDefaultWatchlistId(userId) {
    return userId + '_' + DEFAULT_WATCHLIST_ID_SUFFIX;
}

async function saveLastSelectedWatchlistIds(watchlistIds) {
    if (!db || !currentUserId || !window.firestore) {
        console.warn('Watchlist: Cannot save last selected watchlists: DB, User ID, or Firestore functions not available.');
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
    try {
        await window.firestore.setDoc(userProfileDocRef, { lastSelectedWatchlistIds: watchlistIds }, { merge: true });
        logDebug('Watchlist: Saved last selected watchlist IDs: ' + watchlistIds.join(', '));
    }
    catch (error) {
        console.error('Watchlist: Error saving last selected watchlist IDs:', error);
    }
}

async function saveSortOrderPreference(sortOrder) {
    logDebug('Sort Debug: Attempting to save sort order: ' + sortOrder);
    logDebug('Sort Debug: db: ' + (db ? 'Available' : 'Not Available'));
    logDebug('Sort Debug: currentUserId: ' + currentUserId);
    logDebug('Sort Debug: window.firestore: ' + (window.firestore ? 'Available' : 'Not Available'));

    // Always persist to localStorage as an offline-friendly backup
    try {
        if (sortOrder) {
            localStorage.setItem('lastSortOrder', sortOrder);
        } else {
            localStorage.removeItem('lastSortOrder');
        }
        logDebug('Sort: Saved sort order to localStorage: ' + sortOrder);
    } catch (e) {
        console.warn('Sort: Failed to write sort order to localStorage:', e);
    }

    if (!db || !currentUserId || !window.firestore) {
        console.warn('Sort: Cannot save sort order preference: DB, User ID, or Firestore functions not available. Skipping cloud save.');
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
    try {
            // Ensure the sortOrder is not an empty string or null before saving
            const dataToSave = sortOrder ? { lastSortOrder: sortOrder } : { lastSortOrder: window.firestore.deleteField() };
            await window.firestore.setDoc(userProfileDocRef, dataToSave, { merge: true });
            logDebug('Sort: Saved sort order preference to Firestore: ' + sortOrder);
        } catch (error) {
            console.error('Sort: Error saving sort order preference to Firestore:', error);
        }
}

async function loadUserWatchlistsAndSettings() {
    logDebug('loadUserWatchlistsAndSettings called.'); // Added log for function entry

    if (!db || !currentUserId) {
        console.warn('User Settings: Firestore DB or User ID not available for loading settings. Skipping.');
        window._appDataLoaded = false;
        hideSplashScreenIfReady();
        return;
    }
    userWatchlists = [];
    const watchlistsColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
    const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');

    try {
        logDebug('User Settings: Fetching user watchlists and profile settings...');
        const querySnapshot = await window.firestore.getDocs(window.firestore.query(watchlistsColRef));
        querySnapshot.forEach(doc => { userWatchlists.push({ id: doc.id, name: doc.data().name }); });
        logDebug('User Settings: Found ' + userWatchlists.length + ' existing watchlists (before default check).');

        // Ensure "Cash & Assets" is always an option in `userWatchlists` for internal logic
        if (!userWatchlists.some(wl => wl.id === CASH_BANK_WATCHLIST_ID)) {
            userWatchlists.push({ id: CASH_BANK_WATCHLIST_ID, name: 'Cash & Assets' });
            logDebug('User Settings: Added "Cash & Assets" to internal watchlists array.');
        }

        // If no user-defined watchlists (excluding Cash & Assets), create a default one
        const userDefinedStockWatchlists = userWatchlists.filter(wl => wl.id !== CASH_BANK_WATCHLIST_ID && wl.id !== ALL_SHARES_ID);
        if (userDefinedStockWatchlists.length === 0) {
            const defaultWatchlistId = getDefaultWatchlistId(currentUserId);
            const defaultWatchlistRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists/' + defaultWatchlistId);
            await window.firestore.setDoc(defaultWatchlistRef, { name: DEFAULT_WATCHLIST_NAME, createdAt: new Date().toISOString() });
            userWatchlists.push({ id: defaultWatchlistId, name: DEFAULT_WATCHLIST_NAME });
            // Ensure currentSelectedWatchlistIds points to the newly created default watchlist
            currentSelectedWatchlistIds = [defaultWatchlistId]; 
            logDebug('User Settings: Created default watchlist and set it as current selection.');
        }

        // Sort watchlists (excluding Cash & Assets for sorting, then re-add it if needed)
        userWatchlists.sort((a, b) => {
            if (a.id === CASH_BANK_WATCHLIST_ID) return 1;
            if (b.id === CASH_BANK_WATCHLIST_ID) return -1;
            return a.name.localeCompare(b.name);
        });
        logDebug('User Settings: Watchlists after sorting: ' + userWatchlists.map(wl => wl.name).join(', '));

        const userProfileSnap = await window.firestore.getDoc(userProfileDocRef);
    savedSortOrder = null;
    savedTheme = null;

        if (userProfileSnap.exists()) {
            savedSortOrder = userProfileSnap.data().lastSortOrder;
            savedTheme = userProfileSnap.data().lastTheme;
            const loadedSelectedWatchlistIds = userProfileSnap.data().lastSelectedWatchlistIds;
            // Manual EOD preference removed; behavior is now automatic

            if (loadedSelectedWatchlistIds && Array.isArray(loadedSelectedWatchlistIds) && loadedSelectedWatchlistIds.length > 0) {
                // Filter out invalid or non-existent watchlists from loaded preferences
                // Treat 'portfolio' as a valid special view alongside All Shares and Cash & Assets
                currentSelectedWatchlistIds = loadedSelectedWatchlistIds.filter(id => 
                    id === ALL_SHARES_ID || id === CASH_BANK_WATCHLIST_ID || id === 'portfolio' || userWatchlists.some(wl => wl.id === id)
                );
                logDebug('User Settings: Loaded last selected watchlists from profile: ' + currentSelectedWatchlistIds.join(', '));
            } else {
                logDebug('User Settings: No valid last selected watchlists in profile. Will determine default.');
            }
        } else {
            logDebug('User Settings: User profile settings not found. Will determine default watchlist selection.');
        }

        // Prefer local device's last selected view if available and valid
        try {
            const lsView = localStorage.getItem('lastSelectedView');
            if (lsView) {
                const isValid = (lsView === ALL_SHARES_ID) || (lsView === CASH_BANK_WATCHLIST_ID) || (lsView === 'portfolio') || userWatchlists.some(wl => wl.id === lsView);
                if (isValid) {
                    currentSelectedWatchlistIds = [lsView];
                    logDebug('User Settings: Overriding selection with localStorage lastSelectedView: ' + lsView);
                }
            }
        } catch(e) { /* ignore */ }

        // Determine final currentSelectedWatchlistIds if not set or invalid after loading/filtering
        if (!currentSelectedWatchlistIds || currentSelectedWatchlistIds.length === 0) {
            const firstAvailableStockWatchlist = userWatchlists.find(wl => wl.id !== CASH_BANK_WATCHLIST_ID);
            if (firstAvailableStockWatchlist) {
                currentSelectedWatchlistIds = [firstAvailableStockWatchlist.id];
                logDebug('User Settings: Defaulting currentSelectedWatchlistIds to first available stock watchlist: ' + firstAvailableStockWatchlist.name);
            } else {
                currentSelectedWatchlistIds = [CASH_BANK_WATCHLIST_ID];
                logDebug('User Settings: No stock watchlists found, defaulting to Cash & Assets.');
            }
        }
        logDebug('User Settings: Final currentSelectedWatchlistIds before renderWatchlistSelect: ' + currentSelectedWatchlistIds.join(', '));

        renderWatchlistSelect(); // Populate and select in the header dropdown

        // Also re-populate the share modal dropdown if present
        if (typeof populateShareWatchlistSelect === 'function') {
            populateShareWatchlistSelect();
        }

        // Apply saved sort preference to currentSortOrder; let renderSortSelect enforce it after options are built
        let candidateSort = savedSortOrder;
        if (!candidateSort) {
            try { candidateSort = localStorage.getItem('lastSortOrder') || null; } catch (e) { candidateSort = null; }
            if (candidateSort) logDebug('Sort: Loaded sort order from localStorage fallback: ' + candidateSort);
        }
        if (candidateSort) {
            currentSortOrder = candidateSort;
            logDebug('Sort: Using saved sort order: ' + currentSortOrder);
        } else {
            // Set to default sort for the current view type
            currentSortOrder = currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID) ? 'name-asc' : 'entryDate-desc';
            logDebug('Sort: No saved sort order found, defaulting to: ' + currentSortOrder);
        }
        renderSortSelect(); // Build options, then apply currentSortOrder

        // Apply saved theme or default
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            const localStorageSelectedTheme = localStorage.getItem('selectedTheme');
            const localStorageTheme = localStorage.getItem('theme');

            if (localStorageSelectedTheme) {
                applyTheme(localStorageSelectedTheme);
            } else if (localStorageTheme) {
                applyTheme(localStorageTheme);
            } else {
                applyTheme('system-default');
            }
        }
        updateThemeToggleAndSelector();

    // Removed: manual EOD preference handling

        const migratedSomething = await migrateOldSharesToWatchlist();
        if (!migratedSomething) {
            logDebug('Migration: No old shares to migrate/update, directly setting up shares listener for current watchlist.');
        }

        // Load shares listener and cash categories listener once here
        await loadShares(); // Sets up the listener for shares
        await loadCashCategories(); // Sets up the listener for cash categories

        // Initial render based on selected watchlist (stock or cash)
        renderWatchlist(); // This will now correctly display based on the initial currentSelectedWatchlistIds

        // Strong enforcement: if the last view was Portfolio, ensure Portfolio is shown now
        try {
            const lsViewFinal = localStorage.getItem('lastSelectedView');
            if (lsViewFinal === 'portfolio' && typeof showPortfolioView === 'function') {
                showPortfolioView();
                logDebug('User Settings: Enforced Portfolio view after initial render.');
            }
        } catch(e) { /* ignore */ }

        window._appDataLoaded = true;
        hideSplashScreenIfReady();

    } catch (error) {
        console.error('User Settings: Error loading user watchlists and settings:', error);
        showCustomAlert('Error loading user settings: ' + error.message);
        hideSplashScreen();
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Starts the periodic fetching of live prices.
 */
function startLivePriceUpdates() {
    if (livePriceFetchInterval) {
        clearInterval(livePriceFetchInterval);
        logDebug('Live Price: Cleared existing live price interval.');
    }
    // Always start periodic fetching to keep global live prices fresh regardless of current view
    livePriceFetchInterval = setInterval(() => fetchLivePrices({ cacheBust: true }), LIVE_PRICE_FETCH_INTERVAL_MS);
    logDebug('Live Price: Started live price updates every ' + (LIVE_PRICE_FETCH_INTERVAL_MS / 1000 / 60) + ' minutes.');
}

/**
 * Stops the periodic fetching of live prices.
 */
function stopLivePriceUpdates() {
    if (livePriceFetchInterval) {
        clearInterval(livePriceFetchInterval);
        livePriceFetchInterval = null;
        logDebug('Live Price: Stopped live price updates.');
    }
}

// NEW: Function to update the target hit notification icon
function updateTargetHitBanner() {
    // Now driven by alerts from Firestore; sharesAtTargetPrice is set by the alerts listener
    if (!targetHitIconBtn || !targetHitIconCount || !watchlistSelect || !sortSelect) {
        console.warn('Target Alert: UI elements missing. Cannot update banner/highlights.');
        return;
    }

    // Determine if any triggered shares belong to the currently selected watchlist(s)
    const currentViewHasTargetHits = (Array.isArray(sharesAtTargetPrice) ? sharesAtTargetPrice : []).some(share => {
        if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) return true;
        if (currentSelectedWatchlistIds.length === 1 && currentSelectedWatchlistIds[0] !== CASH_BANK_WATCHLIST_ID) {
            return shareBelongsTo(share, currentSelectedWatchlistIds[0]);
        }
        return false;
    });

    const displayCount = Array.isArray(sharesAtTargetPrice) ? sharesAtTargetPrice.length : 0;
    if (displayCount > 0 && !targetHitIconDismissed) {
        // Diagnostics: capture state before applying changes
        try {
            console.log('[Diag] targetHitIconBtn element:', targetHitIconBtn);
            console.log('[Diag] BEFORE - className:', targetHitIconBtn.className, 'style.display:', targetHitIconBtn.style.display);
        } catch (_) {}

        targetHitIconCount.textContent = String(displayCount);
        // Ensure visibility: drop any hidden class first, then set display
        targetHitIconBtn.classList.remove('app-hidden');
        targetHitIconCount.classList && targetHitIconCount.classList.remove('app-hidden');
        targetHitIconBtn.style.display = 'inline-flex';
        targetHitIconCount.style.display = 'flex';
        // Double-ensure after layout settles (guards against another late add)
        requestAnimationFrame(() => {
            targetHitIconBtn.classList.remove('app-hidden');
            targetHitIconCount.classList && targetHitIconCount.classList.remove('app-hidden');
        });

        // Diagnostics: capture state after applying changes
        try {
            console.log('[Diag] AFTER - className:', targetHitIconBtn.className, 'style.display:', targetHitIconBtn.style.display);
        } catch (_) {}

        logDebug('Target Alert: Showing icon: ' + displayCount + ' triggered alerts.');
    } else {
    // Hide the icon explicitly via inline style and class
    targetHitIconBtn.classList.add('app-hidden');
    targetHitIconBtn.style.display = 'none';
    targetHitIconCount.classList && targetHitIconCount.classList.add('app-hidden');
    targetHitIconCount.style.display = 'none';
        logDebug('Target Alert: No triggered alerts or icon dismissed; hiding icon.');
    }

    // Persist last known count for early UI restore
    lastKnownTargetCount = displayCount;
    try { localStorage.setItem('lastKnownTargetCount', String(lastKnownTargetCount)); } catch(e) {}

    // Highlight dropdowns if the current view has target hits
    if (currentViewHasTargetHits && !targetHitIconDismissed) {
        watchlistSelect.classList.add('target-hit-border');
        sortSelect.classList.add('target-hit-border');
        logDebug('Target Alert: Watchlist and Sort dropdowns highlighted (current view has target hits).');
    } else {
        watchlistSelect.classList.remove('target-hit-border');
        sortSelect.classList.remove('target-hit-border');
        logDebug('Target Alert: Watchlist and Sort dropdowns unhighlighted.');
    }
}

// NEW: Real-time alerts listener to populate sharesAtTargetPrice from Firestore
async function loadTriggeredAlertsListener() {
    if (unsubscribeAlerts) {
        try { unsubscribeAlerts(); } catch(_) {}
        unsubscribeAlerts = null;
        logDebug('Firestore Listener: Unsubscribed from previous alerts listener.');
    }
    if (!db || !currentUserId || !window.firestore) {
        console.warn('Alerts: Firestore DB, User ID, or Firestore functions not available. Clearing triggered alerts.');
        sharesAtTargetPrice = [];
        updateTargetHitBanner();
        return;
    }
    try {
        const alertsCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/alerts');
        // Filter for triggered alerts; additional local filter will enforce enabled !== false
        const q = window.firestore.query(alertsCol, window.firestore.where('targetHit', '==', true));
        unsubscribeAlerts = window.firestore.onSnapshot(q, (querySnapshot) => {
            const enabledShares = [];
            const mutedShares = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data() || {};
                const shareId = data.shareId || doc.id;
                const shareCode = (data.shareCode || '').toUpperCase();
                // Try to hydrate from current shares data for richer UI; fallback to a minimal stub
                let share = allSharesData.find(s => s.id === shareId) || allSharesData.find(s => String(s.shareName || '').toUpperCase() === shareCode);
                if (!share) {
                    share = {
                        id: shareId,
                        shareName: shareCode || '(Unknown)'.toUpperCase(),
                        targetPrice: (typeof data.targetPrice === 'number' && !isNaN(data.targetPrice)) ? data.targetPrice : null,
                        watchlistIds: []
                    };
                }
                // Attach a hint of enabled state for rendering decisions
                share.__alertEnabled = (data.enabled !== false);
                if (share.__alertEnabled) {
                    enabledShares.push(share);
                } else {
                    mutedShares.push(share);
                }
            });
            sharesAtTargetPrice = dedupeSharesById(enabledShares);
            sharesAtTargetPriceMuted = dedupeSharesById(mutedShares);
            updateTargetHitBanner();
            // If the notification hub is open, refresh its contents
            if (targetHitDetailsModal && targetHitDetailsModal.style.display !== 'none') {
                showTargetHitDetailsModal();
            }
        }, (error) => {
            console.error('Firestore Listener: Error listening to alerts:', error);
        });
        logDebug('Alerts: Real-time alerts listener set up.');
    } catch (error) {
        console.error('Alerts: Error setting up alerts listener:', error);
    }
}

// NEW: Helper to enable/disable a specific alert for a share
// Toggle alert enabled flag (if currently enabled -> disable; if disabled -> enable)
async function toggleAlertEnabled(shareId) {
    try {
        if (!db || !currentUserId || !window.firestore) throw new Error('Firestore not available');
        const alertsCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/alerts');
        const alertDocRef = window.firestore.doc(alertsCol, shareId);
        // Fetch current state (gracefully handle missing doc by creating one)
        let currentEnabled = true; // default enabled if field missing
        try {
            const snap = await window.firestore.getDoc(alertDocRef);
            if (snap.exists()) {
                const data = snap.data();
                currentEnabled = (data.enabled !== false); // undefined => true
            } else {
                // If doc missing, create baseline alert doc shell so user can mute/unmute going forward
                await window.firestore.setDoc(alertDocRef, { enabled: true, createdAt: window.firestore.serverTimestamp(), updatedAt: window.firestore.serverTimestamp() }, { merge: true });
                currentEnabled = true;
            }
        } catch(fetchErr) {
            console.warn('Alerts: Could not fetch current alert doc for toggle; assuming enabled.', fetchErr);
        }
        const newEnabled = !currentEnabled; // invert
        await window.firestore.setDoc(alertDocRef, { enabled: newEnabled, updatedAt: window.firestore.serverTimestamp() }, { merge: true });
        showCustomAlert(newEnabled ? 'Alert unmuted' : 'Alert muted', 1000);
    return newEnabled;
    } catch (e) {
        console.error('Alerts: Failed to toggle enabled for share ' + shareId, e);
        showCustomAlert('Failed to update alert. Please try again.', 1500);
    throw e;
    }
}

// NEW: Function to render alerts in the alert panel (currently empty, but planned for future)
function renderAlertsInPanel() {
    // alertList and closeAlertPanelBtn, clearAllAlertsBtn are currently not in index.html, so this function is a placeholder
    // If you add the alert panel back, ensure these elements exist.
    if (!alertPanel) {
        console.warn('Alert Panel: Alert panel elements not found. Skipping renderAlertsInPanel.');
        return;
    }

    // Placeholder for alert rendering logic if you re-introduce the alert panel
    logDebug('Alert Panel: Rendering alerts in panel (placeholder).');
}


/**
 * Toggles the mobile view mode between default (single column) and compact (two columns).
 * Updates the UI to reflect the new mode and saves preference to local storage.
 */
function toggleMobileViewMode() {
    if (!mobileShareCardsContainer) {
        console.error('toggleMobileViewMode: mobileShareCardsContainer not found.');
        return;
    }

    if (currentMobileViewMode === 'default') {
        currentMobileViewMode = 'compact';
        mobileShareCardsContainer.classList.add('compact-view');
        showCustomAlert('Switched to Compact View!', 1000);
        logDebug('View Mode: Switched to Compact View.');
    } else {
        currentMobileViewMode = 'default';
        mobileShareCardsContainer.classList.remove('compact-view');
        showCustomAlert('Switched to Default View!', 1000);
        logDebug('View Mode: Switched to Default View.');
    }
    
    localStorage.setItem('currentMobileViewMode', currentMobileViewMode); // Save preference
    renderWatchlist(); // Re-render to apply new card styling and layout
}

// NEW: Splash Screen Functions
let splashScreenReady = false; // Flag to ensure splash screen is ready before hiding

/**
 * Hides the splash screen with a fade-out effect.
 */
function hideSplashScreen() {
    if (splashScreen) {
        splashScreen.classList.add('hidden'); // Start fade-out
        if (splashKangarooIcon) {
            splashKangarooIcon.classList.remove('pulsing'); // Stop animation
        }
        // Show main app content
        if (mainContainer) {
            mainContainer.classList.remove('app-hidden');
        }
        if (appHeader) { // Assuming header is part of the main app content that needs to be revealed
            appHeader.classList.remove('app-hidden');
        }
        // Temporarily remove overflow hidden from body
        document.body.style.overflow = ''; 

        // REMOVED: splashScreen.addEventListener('transitionend', () => { if (splashScreen.parentNode) { splashScreen.parentNode.removeChild(splashScreen); } }, { once: true });
        logDebug('Splash Screen: Hiding.');
    }
}

/**
 * Checks if all necessary app data is loaded and hides the splash screen if ready.
 * This function is called after each major data loading step.
 */
function hideSplashScreenIfReady() {
    // Only hide if Firebase is initialized, user is authenticated, and all data flags are true
    if (window._firebaseInitialized && window._userAuthenticated && window._appDataLoaded && window._livePricesLoaded) {
        if (splashScreenReady) { // Ensure splash screen itself is ready to be hidden
            logDebug('Splash Screen: All data loaded and ready. Hiding splash screen.');
            hideSplashScreen();
            // If user last viewed portfolio, ensure portfolio view is shown now that data is ready
            try {
                const lastView = localStorage.getItem('lastSelectedView');
                if (lastView === 'portfolio' && typeof showPortfolioView === 'function') {
                    showPortfolioView();
                }
            } catch(e) {}
        } else {
            logDebug('Splash Screen: Data loaded, but splash screen not yet marked as ready. Will hide when ready.');
        }
    } else {
        logDebug('Splash Screen: Not all data loaded yet. Current state: ' +
            'Firebase Init: ' + window._firebaseInitialized +
            ', User Auth: ' + window._userAuthenticated +
            ', App Data: ' + window._appDataLoaded +
            ', Live Prices: ' + window._livePricesLoaded);
    }
}

/**
 * Sets up a real-time Firestore listener for shares.
 * Updates `allSharesData` and triggers UI re-render via `renderWatchlist` (indirectly through `fetchLivePrices` or `sortShares`).
 */
async function loadShares() {
    if (unsubscribeShares) {
        unsubscribeShares();
        unsubscribeShares = null;
        logDebug('Firestore Listener: Unsubscribed from previous shares listener.');
    }

    if (!db || !currentUserId || !window.firestore) {
        console.warn('Shares: Firestore DB, User ID, or Firestore functions not available for loading shares. Clearing list.');
        allSharesData = []; // Clear data if services aren't available
        // renderWatchlist(); // No need to call here, onAuthStateChanged will handle initial render
        window._appDataLoaded = false;
        hideSplashScreen(); 
        return;
    }
    
    try {
        const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
        let q = window.firestore.query(sharesCol); // Listener for all shares, filtering for display done in renderWatchlist

        unsubscribeShares = window.firestore.onSnapshot(q, async (querySnapshot) => { 
            logDebug('Firestore Listener: Shares snapshot received. Processing changes.');
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            allSharesData = dedupeSharesById(fetchedShares);
            logDebug('Shares: Shares data updated from snapshot. Total shares: ' + allSharesData.length);
            
            // AGGRESSIVE FIX: Force apply current sort order after data loads
            forceApplyCurrentSort();
            
            sortShares(); // Sorts allSharesData and calls renderWatchlist
            renderAsxCodeButtons(); // Re-renders ASX buttons based on allSharesData
            
            // REMOVED this line as it's now handled by the fetchLivePrices() call in onAuthStateChanged
            // await fetchLivePrices(); 
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            window._appDataLoaded = true;
            hideSplashScreenIfReady();

        }, (error) => {
            console.error('Firestore Listener: Error listening to shares:', error);
            showCustomAlert('Error loading shares in real-time: ' + error.message);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            window._appDataLoaded = false;
            hideSplashScreen(); 
        });

    } catch (error) {
        console.error('Shares: Error setting up shares listener:', error);
        showCustomAlert('Error setting up real-time share updates: ' + error.message);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        window._appDataLoaded = false;
        hideSplashScreen(); 
    }
}

// NEW: Cash & Assets Functions (3.1)

/**
 * Sets up a real-time Firestore listener for cash categories.
 * Updates `userCashCategories` and triggers UI re-render via `renderWatchlist`.
 */
async function loadCashCategories() {
    if (unsubscribeCashCategories) {
        unsubscribeCashCategories();
        unsubscribeCashCategories = null;
        logDebug('Firestore Listener: Unsubscribed from previous cash categories listener.');
    }

    if (!db || !currentUserId || !window.firestore) {
        console.warn('Cash Categories: Firestore DB, User ID, or Firestore functions not available for loading cash categories. Clearing list.');
        userCashCategories = [];
        renderCashCategories(); // Render with empty data
        return;
    }

    try {
        const cashCategoriesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
        const q = window.firestore.query(cashCategoriesCol);

        unsubscribeCashCategories = window.firestore.onSnapshot(q, (querySnapshot) => {
            logDebug('Firestore Listener: Cash categories snapshot received. Processing changes.');
            let fetchedCategories = [];
            querySnapshot.forEach((doc) => {
                const category = { id: doc.id, ...doc.data() };
                fetchedCategories.push(category);
            });

            userCashCategories = fetchedCategories; // Sort will be applied in renderCashCategories
            logDebug('Cash Categories: Data updated from snapshot. Total categories: ' + userCashCategories.length);
            
            // Trigger a re-render of the overall watchlist, which will then call renderCashCategories if needed
            renderWatchlist(); 
            calculateTotalCash(); // Ensure total is updated whenever categories change

        }, (error) => {
            console.error('Firestore Listener: Error listening to cash categories:', error);
            showCustomAlert('Error loading cash categories in real-time: ' + error.message);
        });

    } catch (error) {
        console.error('Cash Categories: Error setting up cash categories listener:', error);
        showCustomAlert('Error setting up real-time cash category updates: ' + error.message);
    }
}

/**
 * Renders the cash categories in the UI. (1)
 */
function renderCashCategories() {
    if (!cashCategoriesContainer) {
        console.error('renderCashCategories: cashCategoriesContainer element not found.');
        return;
    }
    cashCategoriesContainer.innerHTML = ''; // Clear existing content

    // Sort cash categories before rendering
    const sortedCashCategories = sortCashCategories();

    if (sortedCashCategories.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.classList.add('empty-message');
        emptyMessage.textContent = 'No cash categories added yet. Click "Add Category" to get started!';
        cashCategoriesContainer.appendChild(emptyMessage);
        return;
    }

    sortedCashCategories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.classList.add('cash-category-item');
        categoryItem.dataset.id = category.id;
        // Apply 'hidden' class if asset is marked as hidden in its data
        if (category.isHidden) {
            categoryItem.classList.add('hidden');
        }

        // Header for name and icons (3.1)
        const categoryHeader = document.createElement('div');
        categoryHeader.classList.add('category-header');

        const nameDisplay = document.createElement('span'); // Use span for display
        nameDisplay.classList.add('category-name-display');
        nameDisplay.textContent = category.name || 'Unnamed Asset';
        categoryHeader.appendChild(nameDisplay);

        // No eye icon button creation here anymore, as visibility is controlled by checkbox in modal.
        // Edit and Delete buttons are now only in the modal, so they are not added here.

        categoryItem.appendChild(categoryHeader); // Attach header directly

        // Balance Display (3.1)
    const balanceDisplay = document.createElement('span');
    balanceDisplay.classList.add('category-balance-display');
    // Use shared money formatter for commas and currency symbol
    const balNum = Number(category.balance);
    balanceDisplay.textContent = formatMoney(!isNaN(balNum) ? balNum : 0);
    categoryItem.appendChild(balanceDisplay);

        // Add click listener for details modal (2.2)
        categoryItem.addEventListener('click', () => {
            logDebug('Cash Categories: Card clicked for category ID: ' + category.id);
            selectCashAsset(category.id);
            showCashCategoryDetailsModal(category.id);
        });

        cashCategoriesContainer.appendChild(categoryItem);
    });
    logDebug('Cash Categories: UI rendered.');
    calculateTotalCash(); // Calculate total after rendering
}

/**
 * Adds a new empty cash category to the UI and `userCashCategories` array.
 * This function is now primarily for triggering the modal for a new entry.
 */
function addCashCategoryUI() {
    logDebug('Cash Categories: Add new category UI triggered.');
    // This function now directly opens the modal for a new cash asset.
    showAddEditCashCategoryModal(null); // Pass null to indicate a new asset
}

/**
 * This function is no longer used for saving from the main view,
 * as saving now occurs via the modal.
 * Kept as a placeholder in case its logic is needed elsewhere.
 */
async function saveCashCategories() {
    logDebug('saveCashCategories: This function is deprecated. Saving now handled via modal save.');
    // No longer iterates through UI inputs.
    // The onSnapshot listener handles updates from modal saves.
}

/**
 * Deletes a specific cash category from Firestore.
 * @param {string} categoryId The ID of the category to delete.
 */
async function deleteCashCategory(categoryId) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomAlert('Firestore not available. Cannot delete cash category.');
        return;
    }

    // NEW: Direct deletion without confirmation modal
    try {
        const categoryDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', categoryId);
        await window.firestore.deleteDoc(categoryDocRef);
        showCustomAlert('Category deleted successfully!', 1500);
        logDebug('Firestore: Cash category (ID: ' + categoryId + ') deleted.');
    } catch (error) {
        console.error('Firestore: Error deleting cash category:', error);
        showCustomAlert('Error deleting category: ' + error.message);
    }
}

/**
 * Calculates and displays the total cash balance. (1)
 */
function calculateTotalCash() {
    let total = 0;
    userCashCategories.forEach(category => {
        // Only include assets that are NOT hidden in the total
        if (!category.isHidden) { // Check the 'isHidden' property directly
            if (typeof category.balance === 'number' && !isNaN(category.balance)) {
                total += category.balance;
            }
        }
    });
    if (totalCashDisplay) {
    totalCashDisplay.textContent = formatMoney(total);
    }
    logDebug('Cash Categories: Total cash calculated: $' + formatAdaptivePrice(total));
}

// NEW: Cash Asset Form Modal Functions (2.1)
function showAddEditCashCategoryModal(assetIdToEdit = null) {
    clearCashAssetForm(); // Clear form for new entry or before populating for edit
    selectedCashAssetDocId = assetIdToEdit;

    if (assetIdToEdit) {
        const assetToEdit = userCashCategories.find(asset => asset.id === assetIdToEdit);
        if (!assetToEdit) {
            showCustomAlert('Cash asset not found.');
            return;
        }
        cashFormTitle.textContent = 'Edit Cash Asset';
        cashAssetNameInput.value = assetToEdit.name || '';
    cashAssetBalanceInput.value = Number(assetToEdit.balance) !== null && !isNaN(Number(assetToEdit.balance)) ? formatAdaptivePrice(Number(assetToEdit.balance)) : '';
        setIconDisabled(deleteCashAssetBtn, false); // Enable delete button for existing asset
        
        // Populate comments for editing
        if (cashAssetCommentsContainer) {
            cashAssetCommentsContainer.innerHTML = ''; // Clear existing dynamic comment sections
            if (assetToEdit.comments && Array.isArray(assetToEdit.comments) && assetToEdit.comments.length > 0) {
                assetToEdit.comments.forEach(comment => addCommentSection(cashAssetCommentsContainer, comment.title, comment.text, true));
            } else {
                addCommentSection(cashAssetCommentsContainer, '', '', true); // Add one empty comment section
            }
        }
        // Ensure addCashAssetCommentBtn exists before trying to modify its classList
        if (addCashAssetCommentBtn) {
            addCashAssetCommentBtn.classList.remove('hidden'); // Show add comment button
        }
        // Set checkbox state based on existing asset's isHidden property
        if (hideCashAssetCheckbox) {
            hideCashAssetCheckbox.checked = !!assetToEdit.isHidden; // Convert to boolean
        }
        originalCashAssetData = getCurrentCashAssetFormData(); // Store original data for dirty check
        logDebug('Cash Form: Opened edit form for cash asset: ' + assetToEdit.name + ' (ID: ' + assetIdToEdit + ')');
    } else {
        cashFormTitle.textContent = 'Add New Cash Asset';
        setIconDisabled(deleteCashAssetBtn, true); // Hide delete button for new asset
        if (cashAssetCommentsContainer) {
            cashAssetCommentsContainer.innerHTML = ''; // Clear any previous comments
            addCommentSection(cashAssetCommentsContainer, '', '', true); // Add initial empty comment section for new cash asset
        }
        // Ensure addCashAssetCommentBtn exists before trying to modify its classList
        if (addCashAssetCommentBtn) {
            addCashAssetCommentBtn.classList.remove('hidden'); // Show add comment button
        }
        // For new assets, checkbox should be unchecked by default
        if (hideCashAssetCheckbox) {
            hideCashAssetCheckbox.checked = false;
        }
        originalCashAssetData = null; // No original data for new asset
        logDebug('Cash Form: Opened add new cash asset form.');
    }
    setIconDisabled(saveCashAssetBtn, true); // Save button disabled initially
    showModal(cashAssetFormModal);
    cashAssetNameInput.focus();
    checkCashAssetFormDirtyState(); // Initial dirty state check
}

function clearCashAssetForm() {
    if (cashAssetNameInput) cashAssetNameInput.value = '';
    if (cashAssetBalanceInput) cashAssetBalanceInput.value = '';
    if (cashAssetCommentsContainer) cashAssetCommentsContainer.innerHTML = ''; // Clear comments
    selectedCashAssetDocId = null;
    originalCashAssetData = null; // Reset original data
    setIconDisabled(saveCashAssetBtn, true); // Disable save button
    logDebug('Cash Form: Cash asset form cleared.');
}

function getCurrentCashAssetFormData() {
    const comments = [];
    if (cashAssetCommentsContainer) {
        cashAssetCommentsContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    return {
        name: cashAssetNameInput?.value?.trim() || '',
        balance: parseFloat(cashAssetBalanceInput?.value),
        comments: comments,
        // NEW: Include the isHidden state from the checkbox
        isHidden: hideCashAssetCheckbox?.checked || false
    };
}

function areCashAssetDataEqual(data1, data2) {
    if (!data1 || !data2) return false;
    let balance1 = typeof data1.balance === 'number' && !isNaN(data1.balance) ? data1.balance : null;
    let balance2 = typeof data2.balance === 'number' && !isNaN(data2.balance) ? data2.balance : null;
    
    // NEW: Compare isHidden state
    if (data1.name !== data2.name || balance1 !== balance2 || data1.isHidden !== data2.isHidden) {
        return false;
    }

    // Deep compare comments
    if (data1.comments.length !== data2.comments.length) {
        return false;
    }
    for (let i = 0; i < data1.comments.length; i++) {
        const comment1 = data1.comments[i];
        const comment2 = data2.comments[i];
        if (comment1.title !== comment2.title || comment1.text !== comment2.text) {
            return false;
        }
    }
    return true;
}

function checkCashAssetFormDirtyState() {
    const currentData = getCurrentCashAssetFormData();
    const isNameValid = currentData.name.trim() !== '';
    let canSave = isNameValid;

    if (selectedCashAssetDocId && originalCashAssetData) {
        // For existing assets, enable save if data is dirty (including checkbox state)
        const isDirty = !areCashAssetDataEqual(originalCashAssetData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            logDebug('Dirty State: Existing cash asset: No changes detected, save disabled.');
        }
    } else if (!selectedCashAssetDocId) {
        // For new cash assets, enable if name is valid (no original data to compare against)
        // 'canSave' is already 'isNameValid' here.
    }

    setIconDisabled(saveCashAssetBtn, !canSave);
    logDebug('Dirty State: Cash asset save button enabled: ' + canSave);
}

async function saveCashAsset(isSilent = false) {
    logDebug('Cash Form: saveCashAsset called.');
    if (saveCashAssetBtn.classList.contains('is-disabled-icon') && isSilent) {
        logDebug('Auto-Save: Save button is disabled (no changes or no valid name). Skipping silent save.');
        return;
    }

    const assetName = cashAssetNameInput.value.trim();
    if (!assetName) {
        if (!isSilent) showCustomAlert('Asset name is required!');
        console.warn('Save Cash Asset: Asset name is required. Skipping save.');
        return;
    }

    const assetBalance = parseFloat(cashAssetBalanceInput.value);

    const comments = [];
    if (cashAssetCommentsContainer) {
        cashAssetCommentsContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    const cashAssetData = {
        name: assetName,
        balance: isNaN(assetBalance) ? 0 : assetBalance, // Default to 0 if NaN
        comments: comments, // NEW: Include comments
        userId: currentUserId,
        lastUpdated: new Date().toISOString(),
        // NEW: Save the isHidden state from the checkbox
        isHidden: hideCashAssetCheckbox ? hideCashAssetCheckbox.checked : false
    };

    try {
        if (selectedCashAssetDocId) {
            const assetDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', selectedCashAssetDocId);
            await window.firestore.updateDoc(assetDocRef, cashAssetData);
            if (!isSilent) showCustomAlert('Cash asset \'' + assetName + '\' updated successfully!', 1500);
            logDebug('Firestore: Cash asset \'' + assetName + '\' (ID: ' + selectedCashAssetDocId + ') updated.');
        } else {
            const cashCategoriesColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
            const newDocRef = await window.firestore.addDoc(cashCategoriesColRef, cashAssetData);
            selectedCashAssetDocId = newDocRef.id; // Set selected ID for newly added
            if (!isSilent) showCustomAlert('Cash asset \'' + assetName + '\' added successfully!', 1500);
            logDebug('Firestore: Cash asset \'' + assetName + '\' added with ID: ' + newDocRef.id);
        }
        originalCashAssetData = getCurrentCashAssetFormData(); // Update original data after save
        setIconDisabled(saveCashAssetBtn, true); // Disable save button after saving
        if (!isSilent) closeModals();
    } catch (error) {
        console.error('Firestore: Error saving cash asset:', error);
        if (!isSilent) showCustomAlert('Error saving cash asset: ' + error.message);
    }
}

// NEW: Cash Asset Details Modal Functions (2.2)
function showCashCategoryDetailsModal(assetId) {
    if (!assetId) {
        showCustomAlert('Please select a cash asset to view details.');
        return;
    }
    const asset = userCashCategories.find(a => a.id === assetId);
    if (!asset) {
        showCustomAlert('Selected cash asset not found.');
        return;
    }
    selectedCashAssetDocId = assetId; // Set for potential edit/delete from details modal

    modalCashAssetName.textContent = asset.name || 'N/A';
    detailCashAssetName.textContent = asset.name || 'N/A';
    detailCashAssetBalance.textContent = formatMoney((Number(asset.balance) !== null && !isNaN(Number(asset.balance)) ? Number(asset.balance) : 0));
    detailCashAssetLastUpdated.textContent = formatDate(asset.lastUpdated) || 'N/A';

    // Display comments in details modal
    if (modalCashAssetCommentsContainer) {
        modalCashAssetCommentsContainer.innerHTML = ''; // Clear existing content
        if (asset.comments && Array.isArray(asset.comments) && asset.comments.length > 0) {
            asset.comments.forEach(comment => {
                if (comment.title || comment.text) {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'modal-comment-item';
                    
                    if (comment.title && comment.title.trim() !== '') {
                        const titleBar = document.createElement('div');
                        titleBar.classList.add('comment-title-bar');
                        titleBar.textContent = comment.title;
                        commentDiv.appendChild(titleBar);
                    }
                    
                    const commentTextP = document.createElement('p');
                    commentTextP.textContent = comment.text || '';
                    commentDiv.appendChild(commentTextP);

                    modalCashAssetCommentsContainer.appendChild(commentDiv);
                }
            });
        } else {
            modalCashAssetCommentsContainer.innerHTML = '<p style="text-align: center; color: var(--label-color);">No comments for this asset.</p>';
        }
    }

    showModal(cashAssetDetailModal);
    logDebug('Details: Displayed details for cash asset: ' + asset.name + ' (ID: ' + assetId + ')');
}

// (Removed legacy modal-based showCustomConfirm; migrated to toast confirm above)

/**
 * Updates the main title of the app based on the currently selected watchlist.
 */
function updateMainTitle() {
    if (!watchlistSelect) {
        // Fallback: derive from currentSelectedWatchlistIds if dropdown not mounted yet
        const fallbackId = currentSelectedWatchlistIds && currentSelectedWatchlistIds[0];
        let fallbackText = 'Share Watchlist';
        if (fallbackId === ALL_SHARES_ID) fallbackText = 'All Shares';
        else if (fallbackId === CASH_BANK_WATCHLIST_ID) fallbackText = 'Cash & Assets';
        else if (fallbackId === 'portfolio') fallbackText = 'Portfolio';
        else if (fallbackId) {
            const wl = userWatchlists.find(w=>w.id===fallbackId);
            if (wl) fallbackText = wl.name;
        }
        if (dynamicWatchlistTitleText) dynamicWatchlistTitleText.textContent = fallbackText;
        else if (dynamicWatchlistTitle) dynamicWatchlistTitle.textContent = fallbackText;
        return;
    }
    const selectedValue = watchlistSelect.value;
    const selectedText = watchlistSelect.selectedIndex >=0 ? (watchlistSelect.options[watchlistSelect.selectedIndex]?.textContent || '') : '';
    let titleText;
    if (selectedValue === ALL_SHARES_ID) titleText = 'All Shares';
    else if (selectedValue === CASH_BANK_WATCHLIST_ID) titleText = 'Cash & Assets';
    else if (selectedValue === 'portfolio') titleText = 'Portfolio';
    else {
        // Prefer the select option text if available; otherwise resolve from userWatchlists by id
        if (selectedText && selectedText.trim()) {
            titleText = selectedText.trim();
        } else {
            const wl = userWatchlists && Array.isArray(userWatchlists) ? userWatchlists.find(w => w.id === selectedValue) : null;
            titleText = (wl && wl.name) ? wl.name : 'Share Watchlist';
        }
    }
    if (dynamicWatchlistTitleText) {
        dynamicWatchlistTitleText.textContent = titleText;
    } else if (dynamicWatchlistTitle) {
        dynamicWatchlistTitle.textContent = titleText;
    }
    logDebug('UI: Dynamic title updated to: ' + titleText);
}

// Ensure the dynamic title uses a narrow clickable span and not the whole header
function ensureTitleStructure() {
    const titleEl = document.getElementById('dynamicWatchlistTitle');
    if (!titleEl) return;
    let textEl = document.getElementById('dynamicWatchlistTitleText');
    if (!textEl) {
        // Create the inner span and move any existing text into it
        textEl = document.createElement('span');
        textEl.id = 'dynamicWatchlistTitleText';
        textEl.tabIndex = 0;
        textEl.textContent = titleEl.textContent && titleEl.textContent.trim() ? titleEl.textContent.trim() : 'Share Watchlist';
        // Clear and append
        while (titleEl.firstChild) titleEl.removeChild(titleEl.firstChild);
        titleEl.appendChild(textEl);
    }
    // Constrain click target: disable container pointer events, allow only span
    try {
        titleEl.style.pointerEvents = 'none';
        textEl.style.pointerEvents = 'auto';
        textEl.setAttribute('role','button');
    } catch(e) {}
}

/**
 * Updates the behavior of the main header's plus button and sidebar's "Add New Share" button
 * based on the selected watchlist.
 * If 'Cash & Assets' is selected, they open the cash asset form. Otherwise, they open the share form.
 */
function updateAddHeaderButton() {
    logDebug('DEBUG: updateAddHeaderButton called. Current selected watchlist IDs: ' + currentSelectedWatchlistIds.join(', '));
    if (!addShareHeaderBtn) {
        console.warn('updateAddHeaderButton: addShareHeaderBtn not found.');
        return;
    }

    // Remove existing event listeners from header button to prevent multiple bindings
    addShareHeaderBtn.removeEventListener('click', handleAddShareClick);
    addShareHeaderBtn.removeEventListener('click', handleAddCashAssetClick);

    // Set the appropriate event listener for the header button
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        addShareHeaderBtn.addEventListener('click', handleAddCashAssetClick);
        logDebug('DEBUG: Header Plus Button (addShareHeaderBtn) now opens Add Cash Asset modal.');
    } else {
        addShareHeaderBtn.addEventListener('click', handleAddShareClick);
        logDebug('DEBUG: Header Plus Button (addShareHeaderBtn) now opens Add Share modal.');
    }
    // Ensure the button is enabled as its functionality is now contextual
    addShareHeaderBtn.disabled = false; 

    // Also update the sidebar's "Add New Share" button context
    updateSidebarAddButtonContext();
}

/**
 * Handles click for adding a new share.
 */
function handleAddShareClick() {
    logDebug('UI: Add Share button clicked (contextual).');
    clearForm();
    formTitle.textContent = 'Add New Share';
    userManuallyOverrodeDirection = false;
    try {
        if (targetIntentBuyBtn && targetIntentSellBtn) {
            targetIntentBuyBtn.classList.add('is-active');
            targetIntentBuyBtn.setAttribute('aria-pressed', 'true');
            targetIntentSellBtn.classList.remove('is-active');
            targetIntentSellBtn.setAttribute('aria-pressed', 'false');
        }
        if (targetAboveCheckbox && targetBelowCheckbox) {
            targetAboveCheckbox.checked = false;
            targetBelowCheckbox.checked = true;
        }
        if (targetDirAboveBtn && targetDirBelowBtn) {
            targetDirAboveBtn.classList.remove('is-active');
            targetDirAboveBtn.setAttribute('aria-pressed', 'false');
            targetDirBelowBtn.classList.add('is-active');
            targetDirBelowBtn.setAttribute('aria-pressed', 'true');
        }
    } catch(_) {}
    if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); }
    populateShareWatchlistSelect(null, true); // true indicates new share
    showModal(shareFormSection);
    shareNameInput.focus();
    addCommentSection(commentsFormContainer); // Add an initial empty comment section for new shares
    checkFormDirtyState(); // Check dirty state immediately after opening for new share
}

/**
 * Handles click for adding a new cash asset.
 */
function handleAddCashAssetClick() {
    logDebug('UI: Add Cash Asset button clicked (contextual).');
    // Ensure this specific handleAddCashAssetClick (the standalone one) calls addCashCategoryUI correctly.
    // The previous instructions already ensured addCashCategoryUI calls showAddEditCashCategoryModal(null).
    addCashCategoryUI();
}

/**
 * Updates the sidebar's "Add New Share" button to be contextual.
 * It will open the Share Form or Cash Asset Form based on the selected watchlist.
 */
function updateSidebarAddButtonContext() {
    logDebug('DEBUG: updateSidebarAddButtonContext called. Current selected watchlist IDs: ' + currentSelectedWatchlistIds.join(', '));
    if (!newShareBtn) {
        console.warn('updateSidebarAddButtonContext: newShareBtn not found.');
        return;
    }

    // Remove existing event listeners from sidebar button
    newShareBtn.removeEventListener('click', handleAddShareClick);
    newShareBtn.removeEventListener('click', handleAddCashAssetClick);

    // Set the appropriate event listener for the sidebar button
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        newShareBtn.addEventListener('click', handleAddCashAssetClick);
        // Update the text/icon if needed (optional, but good for clarity)
        const sidebarSpan = newShareBtn.querySelector('span');
        const sidebarIcon = newShareBtn.querySelector('i');
        if (sidebarSpan) sidebarSpan.textContent = 'Add New Cash Asset';
        if (sidebarIcon) sidebarIcon.className = 'fas fa-money-bill-wave'; // Example icon change
        logDebug('DEBUG: Sidebar "Add New Share" button (newShareBtn) now opens Add Cash Asset modal.');
    } else {
        newShareBtn.addEventListener('click', handleAddShareClick);
        // Revert text/icon to original for stock view
        const sidebarSpan = newShareBtn.querySelector('span');
        const sidebarIcon = newShareBtn.querySelector('i');
        if (sidebarSpan) sidebarSpan.textContent = 'Add New Share';
        if (sidebarIcon) sidebarIcon.className = 'fas fa-plus-circle'; // Original icon
        logDebug('DEBUG: Sidebar "Add New Share" button (newShareBtn) now opens Add Share modal.');
    }
}

async function migrateOldSharesToWatchlist() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn('Migration: Firestore DB, User ID, or Firestore functions not available for migration.');
        return false;
    }
    const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
    const q = window.firestore.query(sharesCol);
    let sharesToUpdate = [];
    let anyMigrationPerformed = false;
    try {
        logDebug('Migration: Checking for old shares to migrate/update schema and data types.');
        const querySnapshot = await window.firestore.getDocs(q);
        querySnapshot.forEach(doc => {
            const shareData = doc.data();
            let updatePayload = {};
            let needsUpdate = false;
            if (!shareData.hasOwnProperty('watchlistId')) {
                needsUpdate = true;
                updatePayload.watchlistId = getDefaultWatchlistId(currentUserId);
                logDebug('Migration: Share \'' + doc.id + '\' missing watchlistId. Assigning to default.');
            }
            if ((!shareData.shareName || String(shareData.shareName).trim() === '') && shareData.hasOwnProperty('name') && String(shareData.name).trim() !== '') {
                needsUpdate = true;
                updatePayload.shareName = String(shareData.name).trim();
                updatePayload.name = window.firestore.deleteField();
                logDebug('Migration: Share \'' + doc.id + '\' missing \'shareName\' but has \'name\' (\'' + shareData.name + '\'). Migrating \'name\' to \'shareName\'.');
            }
            const fieldsToConvert = ['currentPrice', 'targetPrice', 'dividendAmount', 'frankingCredits', 'entryPrice', 'lastFetchedPrice', 'previousFetchedPrice'];
            fieldsToConvert.forEach(field => {
                const value = shareData[field];
                const originalValueType = typeof value;
                let parsedValue = value;
                if (originalValueType === 'string' && value.trim() !== '') {
                    parsedValue = parseFloat(value);
                    if (!isNaN(parsedValue)) {
                        if (originalValueType !== typeof parsedValue || value !== String(parsedValue)) {
                            needsUpdate = true;
                            updatePayload[field] = parsedValue;
                            logDebug('Migration: Share \'' + doc.id + '\': Converted ' + field + ' from string \'' + value + '\' (type ' + originalValueType + ') to number ' + parsedValue + '.');
                        }
                    } else {
                        needsUpdate = true;
                        updatePayload[field] = null;
                        console.warn('Migration: Share \'' + doc.id + '\': Field \'' + field + '\' was invalid string \'' + value + '\', setting to null.');
                    }
                } else if (originalValueType === 'number' && isNaN(value)) {
                    needsUpdate = true;
                    updatePayload[field] = null;
                    console.warn('Migration: Share \'' + doc.id + '\': Field \'' + field + '\' was NaN number, setting to null.');
                }
                if (field === 'frankingCredits' && typeof parsedValue === 'number' && !isNaN(parsedValue)) {
                    if (parsedValue > 0 && parsedValue < 1) {
                        needsUpdate = true;
                        updatePayload.frankingCredits = parsedValue * 100;
                        logDebug('Migration: Share \'' + doc.id + '\': Converted frankingCredits from decimal ' + parsedValue + ' to percentage ' + (parsedValue * 100) + '.');
                    }
                }
            });
            const effectiveCurrentPrice = (typeof updatePayload.currentPrice === 'number' && !isNaN(updatePayload.currentPrice)) ? updatePayload.currentPrice :
                                           ((typeof shareData.currentPrice === 'string' ? parseFloat(shareData.currentPrice) : shareData.currentPrice) || null);
            if (!shareData.hasOwnProperty('lastFetchedPrice') || (typeof shareData.lastFetchedPrice === 'string' && isNaN(parseFloat(shareData.lastFetchedPrice)))) {
                needsUpdate = true;
                updatePayload.lastFetchedPrice = effectiveCurrentPrice;
                logDebug('Migration: Share \'' + doc.id + '\': Setting missing lastFetchedPrice to ' + effectiveCurrentPrice + '.');
            }
            if (!shareData.hasOwnProperty('previousFetchedPrice') || (typeof shareData.previousFetchedPrice === 'string' && isNaN(parseFloat(shareData.previousFetchedPrice)))) {
                needsUpdate = true;
                updatePayload.previousFetchedPrice = effectiveCurrentPrice;
                logDebug('Migration: Share \'' + doc.id + '\': Setting missing previousFetchedPrice to ' + effectiveCurrentPrice + '.');
            }
            if (!shareData.hasOwnProperty('lastPriceUpdateTime')) {
                needsUpdate = true;
                updatePayload.lastPriceUpdateTime = new Date().toISOString();
                logDebug('Migration: Share \'' + doc.id + '\': Setting missing lastPriceUpdateTime.');
            }
            if (needsUpdate) { sharesToUpdate.push({ ref: doc.ref, data: updatePayload }); }
        });
        if (sharesToUpdate.length > 0) {
            logDebug('Migration: Performing consolidated update for ' + sharesToUpdate.length + ' shares.');
            for (const item of sharesToUpdate) { await window.firestore.updateDoc(item.ref, item.data); }
            showCustomAlert('Migrated/Updated ' + sharesToUpdate.length + ' old shares.', 2000);
            logDebug('Migration: Migration complete. Setting up shares listener.');
            // No need to call loadShares here, the onSnapshot listener will handle updates automatically
            anyMigrationPerformed = true;
        } else {
            logDebug('Migration: No old shares found requiring migration or schema update.');
        }
        return anyMigrationPerformed;
    } catch (error) {
        console.error('Migration: Error during data migration: ' + error.message);
        showCustomAlert('Error during data migration: ' + error.message);
        // NEW: Hide splash screen on error
        hideSplashScreen();
        return false;
    }
}

function showContextMenu(event, shareId) {
    if (!shareContextMenu) return;
    
    currentContextMenuShareId = shareId;
    
    let x = event.clientX;
    let y = event.clientY;

    if (event.touches && event.touches.length > 0) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
    }

    const menuWidth = shareContextMenu.offsetWidth;
    const menuHeight = shareContextMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    shareContextMenu.style.left = `${x}px`;
    shareContextMenu.style.top = `${y}px`;
    shareContextMenu.style.display = 'block';
    contextMenuOpen = true;
    logDebug('Context Menu: Opened for share ID: ' + shareId + ' at (' + x + ', ' + y + ')');
}

function hideContextMenu() {
    if (shareContextMenu) {
        shareContextMenu.style.display = 'none';
        contextMenuOpen = false;
        currentContextMenuShareId = null;
        deselectCurrentShare();
        logDebug('Context Menu: Hidden.');
    }
}

function toggleAppSidebar(forceState = null) {
    logDebug('Sidebar: toggleAppSidebar called. Current open state: ' + appSidebar.classList.contains('open') + ', Force state: ' + forceState);
    const isDesktop = window.innerWidth > 768;
    const isOpen = appSidebar.classList.contains('open');

    if (forceState === true || (forceState === null && !isOpen)) {
        // On mobile, opening the sidebar is a navigation event that should be caught by the back button.
        if (!isDesktop) {
            // Push a new history state for the sidebar opening
            pushAppState({ sidebarOpen: true }, '', '#sidebar');
        }

        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        // Reset sidebar scroll position to top when opening
        if (appSidebar) {
            appSidebar.scrollTop = 0;
        }
        // Prevent scrolling of main content when sidebar is open on mobile
        if (!isDesktop) {
            document.body.style.overflow = 'hidden';
            logDebug('Sidebar: Mobile: Body overflow hidden.');
        }
        if (isDesktop) {
            document.body.classList.add('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'none';
            logDebug('Sidebar: Desktop: Sidebar opened, body shifted, overlay pointer-events: none.');
        } else {
            document.body.classList.remove('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'auto'; // Ensure overlay is clickable on mobile
            logDebug('Sidebar: Mobile: Sidebar opened, body NOT shifted, overlay pointer-events: auto.');
        }
        logDebug('Sidebar: Sidebar opened.');
    } else if (forceState === false || (forceState === null && isOpen)) {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.classList.remove('sidebar-active');
        document.body.style.overflow = ''; // Restore scrolling
        sidebarOverlay.style.pointerEvents = 'none'; // Reset pointer-events when closed
        // Reset sidebar scroll position to top when closing
        if (appSidebar) {
            appSidebar.scrollTop = 0;
        }
        logDebug('Sidebar: Sidebar closed.');
    }
}

/**
 * Escapes a string for CSV by enclosing it in double quotes and doubling any existing double quotes.
 * @param {any} value The value to escape.
 * @returns {string} The CSV-escaped string.
 */
function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    let stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
    }
    return stringValue;
}

/**
 * Exports the current watchlist data to a CSV file.
 */
function exportWatchlistToCSV() {
    if (!currentUserId || currentSelectedWatchlistIds.length === 0) {
        showCustomAlert('Please sign in and select watchlists to export.');
        return;
    }
    
    // Do not export cash data via this function
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        showCustomAlert('Cash & Assets data cannot be exported via this function. Please switch to a stock watchlist.', 3000); // UPDATED TEXT
        return;
    }

    let sharesToExport = [];
    let exportFileNamePrefix = 'selected_watchlists';

    if (currentSelectedWatchlistIds.length === 1) {
        const selectedWatchlistId = currentSelectedWatchlistIds[0];
        if (selectedWatchlistId === ALL_SHARES_ID) {
            sharesToExport = [...allSharesData];
            exportFileNamePrefix = 'all_shares';
        } else {
            sharesToExport = allSharesData.filter(share => shareBelongsTo(share, selectedWatchlistId));
            const wl = userWatchlists.find(w => w.id === selectedWatchlistId);
            if (wl) { exportFileNamePrefix = wl.name; }
        }
    } else {
        // If multiple stock watchlists are selected, export all shares
        sharesToExport = [...allSharesData];
        exportFileNamePrefix = 'all_shares';
    }

    if (sharesToExport.length === 0) {
        showCustomAlert('No shares in the current selection to export.', 2000);
        return;
    }

    const headers = [
        'Code', 'Entered Price', 'Live Price', 'Price Change', 'Target Price', 'Dividend Amount', 'Franking Credits (%)',
        'Unfranked Yield (%)', 'Franked Yield (%)', 'Entry Date'
    ];

    const csvRows = [];
    csvRows.push(headers.map(escapeCsvValue).join(','));

    sharesToExport.forEach(share => {
        const enteredPriceNum = Number(share.currentPrice);
        const dividendAmountNum = Number(share.dividendAmount);
        const frankingCreditsNum = Number(share.frankingCredits);
        const targetPriceNum = Number(share.targetPrice);

        // Get live price data from the global livePrices object
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const livePrice = livePriceData ? livePriceData.live : undefined;
        const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;

        let priceChange = '';
        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && 
            prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0;
            priceChange = formatAdaptivePrice(change) + ' (' + formatAdaptivePercent(percentageChange) + '%)'; // Include percentage in CSV
        }

        const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

        const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
        const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

        const row = [
            share.shareName || '',
            (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? formatAdaptivePrice(enteredPriceNum) : '',
            (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? formatAdaptivePrice(livePrice) : '',
            priceChange, // Now includes the calculated price change
            (!isNaN(targetPriceNum) && targetPriceNum !== null) ? formatAdaptivePrice(targetPriceNum) : '',
            (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(3) : '',
            (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? frankingCreditsNum.toFixed(1) : '',
            unfrankedYield !== null && !isNaN(unfrankedYield) ? formatAdaptivePercent(unfrankedYield) : '0.00', // Ensure numerical output
            frankedYield !== null && !isNaN(frankedYield) ? formatAdaptivePercent(frankedYield) : '0.00', // Ensure numerical output
            formatDate(share.entryDate) || ''
        ];
        csvRows.push(row.map(escapeCsvValue).join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const formattedDate = new Date().toISOString().slice(0, 10);
    const safeFileNamePrefix = exportFileNamePrefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = safeFileNamePrefix + '_watchlist_' + formattedDate + '.csv';
    
    link.href = URL.createObjectURL(blob);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    showCustomAlert('Exported shares to CSV!', 2000);
    logDebug('Export: Shares exported to CSV with prefix: \'' + exportFileNamePrefix + '\'.');
}

/**
 * Gathers current data from the Add/Manage Watchlist form inputs.
 * @param {boolean} isAddModal True if gathering data from the Add Watchlist modal, false for Manage Watchlist.
 * @returns {object} An object representing the current state of the watchlist form.
 */
function getCurrentWatchlistFormData(isAddModal) {
    if (isAddModal) {
        return {
            name: newWatchlistNameInput ? newWatchlistNameInput.value.trim() : ''
        };
    } else {
        return {
            name: editWatchlistNameInput ? editWatchlistNameInput.value.trim() : ''
        };
    }
}

/**
 * Compares two watchlist data objects to check for equality.
 * @param {object} data1
 * @param {object} data2
 * @returns {boolean} True if data is identical, false otherwise.
 */
function areWatchlistDataEqual(data1, data2) {
    if (!data1 || !data2) return false;
    return data1.name === data2.name;
}

/**
 * Checks the current state of the watchlist form against the original data (if editing)
 * and enables/disables the save button accordingly.
 * @param {boolean} isAddModal True if checking the Add Watchlist modal, false for Manage Watchlist.
 */
function checkWatchlistFormDirtyState(isAddModal) {
    const currentData = getCurrentWatchlistFormData(isAddModal);
    const isNameValid = currentData.name.trim() !== '';
    let canSave = isNameValid;

    if (!isAddModal && originalWatchlistData) { // Only for editing existing watchlists
        const isDirty = !areWatchlistDataEqual(originalWatchlistData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            logDebug('Dirty State: Existing watchlist: No changes detected, save disabled.');
        }
    } else if (isAddModal) {
        // For new watchlists, enable if name is valid
    }

    const targetSaveBtn = isAddModal ? saveWatchlistBtn : saveWatchlistNameBtn;
    setIconDisabled(targetSaveBtn, !canSave);
    logDebug('Dirty State: Watchlist save button enabled: ' + canSave + ' (Modal: ' + (isAddModal ? 'Add' : 'Edit') + ')');
}

/**
 * Saves or updates watchlist data to Firestore. Can be called silently for auto-save.
 * @param {boolean} isSilent If true, no alert messages are shown on success.
 * @param {string} newName The new name for the watchlist.
 * @param {string|null} watchlistId The ID of the watchlist to update, or null if adding new.
 */
async function saveWatchlistChanges(isSilent = false, newName, watchlistId = null) {
    logDebug('Watchlist Form: saveWatchlistChanges called.');

    if (!newName || newName.trim() === '') {
        if (!isSilent) showCustomAlert('Watchlist name is required!');
        console.warn('Save Watchlist: Watchlist name is empty. Skipping save.');
        return;
    }

    // Check for duplicate name (case-insensitive, excluding current watchlist if editing)
    // Check for duplicate name (case-insensitive, excluding current watchlist if editing)
    const isDuplicate = userWatchlists.some(w => {
        const isMatch = w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistId;
        if (isMatch && DEBUG_MODE) {
            logDebug('Save Watchlist: Duplicate name detected against existing watchlist: ' + w.name + ' (ID: ' + w.id + ')');
        }
        return isMatch;
    });

    if (isDuplicate) {
        if (!isSilent) showCustomAlert('A watchlist with this name already exists!');
        // Only log the warning if it's a genuine duplicate that caused a skip.
        console.warn('Save Watchlist: Duplicate watchlist name. Skipping save.');
        return; // Exit the function if it's a duplicate
    }

    try {
        if (watchlistId) { // Editing existing watchlist
            const watchlistDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistId);
            await window.firestore.updateDoc(watchlistDocRef, { name: newName });
            if (!isSilent) showCustomAlert('Watchlist renamed to \'' + newName + '\'!', 1500);
            // --- IMPORTANT FIX: Reload all settings to refresh UI after renaming ---
            await loadUserWatchlistsAndSettings();
            // --- END IMPORTANT FIX ---
            logDebug('Firestore: Watchlist (ID: ' + watchlistId + ') renamed to \'' + newName + '\'.');
        } else { // Adding new watchlist
            const watchlistsColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
            const newDocRef = await window.firestore.addDoc(watchlistsColRef, {
                name: newName,
                createdAt: new Date().toISOString(),
                userId: currentUserId
            });
            if (!isSilent) showCustomAlert('Watchlist \'' + newName + '\' added!', 1500);
            logDebug('Firestore: Watchlist \'' + newName + '\' added with ID: ' + newDocRef.id);

            // Set the newly created watchlist as the current selection and save this preference.
            currentSelectedWatchlistIds = [newDocRef.id];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);

            // --- IMPORTANT FIX: Update in-memory userWatchlists array immediately ---
            // This ensures renderWatchlistSelect has the new watchlist available
            // when loadUserWatchlistsAndSettings is called.
            userWatchlists.push({ id: newDocRef.id, name: newName });
            // Re-sort userWatchlists to ensure the new watchlist is in the correct order for the dropdown
            userWatchlists.sort((a, b) => {
                // Keep "Cash & Assets" at the bottom if it's there
                if (a.id === CASH_BANK_WATCHLIST_ID) return 1;
                if (b.id === CASH_BANK_WATCHLIST_ID) return -1;
                return a.name.localeCompare(b.name);
            });
            logDebug('Firestore: userWatchlists array updated in memory with new watchlist and re-sorted.');
            // --- END IMPORTANT FIX ---

            // Call loadUserWatchlistsAndSettings to fully refresh the watchlist data,
            // update the dropdown, and render the correct watchlist on the main screen.
            await loadUserWatchlistsAndSettings();
        }
        
        // This block now handles both new and edited watchlists.
        // loadUserWatchlistsAndSettings() is responsible for all subsequent UI updates.
        // The 'if (watchlistId)' condition around loadUserWatchlistsAndSettings is removed
        // because it needs to run for new watchlists too for consistent state management.

        if (!isSilent) closeModals(); // Only close if not a silent save
        originalWatchlistData = getCurrentWatchlistFormData(watchlistId === null); // Update original data after successful save
        checkWatchlistFormDirtyState(watchlistId === null); // Disable save button after saving
    } catch (error) {
        console.error('Firestore: Error saving watchlist:', error);
        if (!isSilent) showCustomAlert('Error saving watchlist: ' + error.message);
    }
}


/**
 * Deletes all user-specific data from Firestore for the current user.
 * This is a destructive and irreversible action.
 */
async function deleteAllUserData() {
    if (!db || !currentUserId || !window.firestore) {
        showCustomAlert('Firestore not available. Cannot delete data.');
        return;
    }

    showCustomConfirm('Are you absolutely sure you want to delete ALL your data? This action is irreversible and will permanently remove all shares, watchlists, cash assets, and settings associated with your account.', async (confirmed) => {
        if (!confirmed) {
            showCustomAlert('Data deletion cancelled.', 1000);
            return;
        }

        showCustomAlert('Deleting all data...', 999999); // Show persistent alert during deletion
        if (loadingIndicator) loadingIndicator.style.display = 'flex'; // Show loading spinner

        try {
            const collectionsToDelete = ['shares', 'watchlists', 'cashCategories'];
            const batch = window.firestore.writeBatch(db);

            // 1. Delete documents from collections
            for (const collectionName of collectionsToDelete) {
                const collectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/${collectionName}`);
                const querySnapshot = await window.firestore.getDocs(window.firestore.query(collectionRef));
                querySnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                logDebug(`Firestore: Added ${querySnapshot.docs.length} documents from '${collectionName}' to batch for deletion.`);
            }

            // 2. Delete the user's profile/settings document (if it exists)
            const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
            const profileDocSnap = await window.firestore.getDoc(userProfileDocRef);
            if (profileDocSnap.exists()) {
                batch.delete(userProfileDocRef);
                logDebug('Firestore: Added user profile settings to batch for deletion.');
            }

            // Commit the batch
            await batch.commit();
            logDebug('Firestore: All user data batch committed successfully.');

            // 3. Sign out the user after data deletion
            if (window.firebaseAuth && window.authFunctions) {
                await window.authFunctions.signOut(window.firebaseAuth);
                showCustomAlert('All your data has been permanently deleted. You have been logged out.', 3000);
                logDebug('Auth: User signed out after data deletion.');
            } else {
                showCustomAlert('All your data has been permanently deleted. Please log out manually.', 3000);
                console.warn('Auth: Could not sign out user automatically after data deletion.');
            }

        } catch (error) {
            console.error('Firestore: Error deleting all user data:', error);
            showCustomAlert('Error deleting all data: ' + error.message, 3000);
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            closeModals(); // Close any open modals
        }
    });
}

async function initializeAppLogic() {
    // DEBUG: Log when initializeAppLogic starts
    logDebug('initializeAppLogic: Firebase is ready. Starting app logic.');

    // Initial modal hiding
    if (shareFormSection) shareFormSection.style.setProperty('display', 'none', 'important');
    if (dividendCalculatorModal) dividendCalculatorModal.style.setProperty('display', 'none', 'important');
    if (shareDetailModal) shareDetailModal.style.setProperty('display', 'none', 'important');
    if (addWatchlistModal) addWatchlistModal.style.setProperty('display', 'none', 'important');
    if (manageWatchlistModal) manageWatchlistModal.style.setProperty('display', 'none', 'important');
    // customDialogModal removed
    if (calculatorModal) calculatorModal.style.setProperty('display', 'none', 'important');
    if (shareContextMenu) shareContextMenu.style.setProperty('display', 'none', 'important');
    if (targetHitIconBtn) targetHitIconBtn.style.display = 'none'; // Ensure icon is hidden initially via inline style
    if (alertPanel) alertPanel.style.display = 'none'; // NEW: Ensure alert panel is hidden initially
    // NEW: Hide cash asset modals initially
    if (cashAssetFormModal) cashAssetFormModal.style.setProperty('display', 'none', 'important');
    if (cashAssetDetailModal) cashAssetDetailModal.style.setProperty('display', 'none', 'important');
    if (stockSearchModal) stockSearchModal.style.setProperty('display', 'none', 'important'); // NEW: Hide stock search modal
    // The targetHitDetailsModal itself is hidden by showModal/hideModal, so no explicit line needed for its close button.


    // Service Worker Registration + Robust Auto-Update Flow
    if ('serviceWorker' in navigator) {
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            // Reload to get the new cached assets (CSS/JS)
            window.location.reload();
        });
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' })
                .then(reg => {
                    logDebug('Service Worker: Registered with scope:', reg.scope);
                    // If there is an updated service worker waiting or installing, prompt it to activate
                    function promptUpdate(sw) {
                        if (!sw) return;
                        // Tell the new SW to skip waiting so it becomes active immediately
                        sw.postMessage({ type: 'SKIP_WAITING' });
                    }
                    if (reg.waiting) {
                        promptUpdate(reg.waiting);
                    }
                    if (reg.installing) {
                        reg.installing.addEventListener('statechange', () => {
                            if (reg.installing && reg.installing.state === 'installed') {
                                promptUpdate(reg.installing);
                            }
                        });
                    }
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed') {
                                promptUpdate(newWorker);
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Service Worker: Registration failed:', error);
                });
        });
    }

    // Insert a tiny version badge to the right of the title and keep it there
    try {
        const ensureBadge = () => {
            const title = document.getElementById('dynamicWatchlistTitle');
            if (!title) return;
            let badge = document.getElementById('appVersionBadge');
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'appVersionBadge';
                badge.textContent = APP_VERSION;
                badge.style.marginLeft = '8px';
                badge.style.fontSize = '0.75rem';
                badge.style.fontWeight = '400';
                badge.style.color = 'var(--ghosted-text, #888)';
                badge.style.verticalAlign = 'middle';
                badge.style.letterSpacing = '0.5px';
            }
            if (badge.parentElement !== title) title.appendChild(badge);
        };
        ensureBadge();
        const titleEl = document.getElementById('dynamicWatchlistTitle');
        if (titleEl && typeof MutationObserver !== 'undefined') {
            const mo = new MutationObserver(() => ensureBadge());
            mo.observe(titleEl, { childList: true });
        }
    } catch(e){ console.warn('Version badge insert failed:', e); }

    // NEW: Load saved mobile view mode preference
    const savedMobileViewMode = localStorage.getItem('currentMobileViewMode');
    if (savedMobileViewMode && (savedMobileViewMode === 'default' || savedMobileViewMode === 'compact')) {
        currentMobileViewMode = savedMobileViewMode;
        if (mobileShareCardsContainer) { // Check if element exists before adding class
            if (currentMobileViewMode === 'compact') {
                mobileShareCardsContainer.classList.add('compact-view');
            } else {
                mobileShareCardsContainer.classList.remove('compact-view');
            }
        }
        logDebug('View Mode: Loaded saved preference: ' + currentMobileViewMode + ' view.');
    } else {
        logDebug('View Mode: No saved mobile view preference, defaulting to \'default\'.');
        currentMobileViewMode = 'default'; // Ensure it's explicitly set if nothing saved
        if (mobileShareCardsContainer) { // Check if element exists before removing class
             mobileShareCardsContainer.classList.remove('compact-view'); // Corrected class name
        }
    }


    // Share Name Input to uppercase + live suggestions
    if (shareNameInput) {
        let shareNameSelectedSuggestionIndex = -1;
        shareNameInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
            checkFormDirtyState();

            if (!shareNameSuggestions) return;
            const query = this.value.trim();
            // Lazy-load ASX codes if not loaded yet
            if (allAsxCodes.length === 0 && typeof loadAsxCodesFromCSV === 'function') {
                loadAsxCodesFromCSV().then(codes => {
                    allAsxCodes = codes || [];
                    // Re-run rendering if user is still typing the same query
                    if (shareNameInput.value.trim() === query) {
                        renderShareNameSuggestions(query);
                    }
                }).catch(() => {/* ignore */});
            }
            shareNameSuggestions.innerHTML = '';
            shareNameSelectedSuggestionIndex = -1;

            if (query.length < 2) {
                shareNameSuggestions.classList.remove('active');
                // Clear company name if user deletes input
                if (formCompanyName) formCompanyName.textContent = '';
                return;
            }
            renderShareNameSuggestions(query);
        });

        // Keyboard navigation for shareName suggestions
        shareNameInput.addEventListener('keydown', (e) => {
            if (!shareNameSuggestions || !shareNameSuggestions.classList.contains('active')) return;
            const items = shareNameSuggestions.querySelectorAll('.suggestion-item');
            if (items.length === 0) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                shareNameSelectedSuggestionIndex = (shareNameSelectedSuggestionIndex + 1) % items.length;
                updateShareNameSelectedSuggestion(items, shareNameSelectedSuggestionIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                shareNameSelectedSuggestionIndex = (shareNameSelectedSuggestionIndex - 1 + items.length) % items.length;
                updateShareNameSelectedSuggestion(items, shareNameSelectedSuggestionIndex);
            } else if (e.key === 'Enter') {
                if (shareNameSelectedSuggestionIndex > -1) {
                    e.preventDefault();
                    const code = items[shareNameSelectedSuggestionIndex].dataset.code;
                    const match = allAsxCodes.find(s => s.code === code);
                    if (match) applyShareCodeSelection(match.code, match.name);
                } else if (shareNameInput.value.trim()) {
                    // If user pressed Enter without selecting, try to match the current value
                    const code = shareNameInput.value.trim().toUpperCase();
                    const match = allAsxCodes.find(s => s.code === code);
                    if (match) {
                        e.preventDefault();
                        applyShareCodeSelection(match.code, match.name);
                    }
                }
            } else if (e.key === 'Escape') {
                shareNameSuggestions.classList.remove('active');
            }
        });

        function updateShareNameSelectedSuggestion(items, idx) {
            items.forEach((el, i) => el.classList.toggle('selected', i === idx));
            if (idx > -1) {
                shareNameInput.value = items[idx].dataset.code;
            }
        }

        async function applyShareCodeSelection(code, name) {
            shareNameInput.value = code;
            if (formCompanyName) formCompanyName.textContent = name || '';
            if (shareNameSuggestions) shareNameSuggestions.classList.remove('active');
            // Optionally move focus to next field for quicker entry
            const next = targetPriceInput;
            if (next) next.focus();
            checkFormDirtyState();

            // Fetch live snapshot for the selected code to show context in the form and prefill price
            try {
                updateAddFormLiveSnapshot(code);
            } catch { /* ignore transient errors */ }
        }

        function renderShareNameSuggestions(query) {
            shareNameSuggestions.innerHTML = '';
            const matches = allAsxCodes
                .filter(s => s.code.includes(query) || s.name.toUpperCase().includes(query))
                .slice(0, 8);

            if (matches.length === 0) {
                shareNameSuggestions.classList.remove('active');
                return;
            }

            matches.forEach((s) => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.textContent = `${s.code} - ${s.name}`;
                div.dataset.code = s.code;
                // Use pointerdown for earlier capture (prevents blur race) plus click fallback
                const handler = () => applyShareCodeSelection(s.code, s.name);
                div.addEventListener('pointerdown', handler, { once: true });
                div.addEventListener('click', (e) => {
                    // If pointerdown already fired, ignore
                    if (div.__applied) return; 
                    handler();
                }, { once: true });
                div.__applied = false;
                shareNameSuggestions.appendChild(div);
            });
            shareNameSuggestions.classList.add('active');
        }

        // Keep a lightweight blur handler for clearing company name if field emptied
        shareNameInput.addEventListener('blur', () => {
            setTimeout(() => { // Delay to allow click selection to complete
                if (shareNameSuggestions) shareNameSuggestions.classList.remove('active');
                const asxCode = shareNameInput.value.trim().toUpperCase();
                if (!asxCode && formCompanyName) formCompanyName.textContent = '';
                // Post-blur validation: if a code was intended (from lastSearch) but input empty, restore
                if (!asxCode && window.lastSelectedSearchCode) {
                    const fallback = String(window.lastSelectedSearchCode).toUpperCase();
                    if (fallback.length >= 2) {
                        shareNameInput.value = fallback;
                        const match = (allAsxCodes||[]).find(s=>s.code===fallback);
                        if (match && formCompanyName) formCompanyName.textContent = match.name || '';
                    }
                }
            }, 100);
        });
    }

    // Hide shareName suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (shareNameSuggestions && !shareNameSuggestions.contains(e.target) && e.target !== shareNameInput) {
            shareNameSuggestions.classList.remove('active');
        }
    });

    
    // NEW: Autocomplete Search Input Listeners for Stock Search Modal (Consolidated & Corrected)
    if (asxSearchInput) {
        let currentSuggestions = []; // Stores the current filtered suggestions
        // Helper to centralize quick-add behavior and reduce duplication.
        function quickAddFromSearch(code, name) {
            // Two-step workflow enforcement: only display research; don't open Add Share modal here.
            if (!code) return;
            window.lastSelectedSearchCode = code;
            // Simply trigger the research detail rendering; button inside detail view will open Add Share.
            displayStockDetailsInSearchModal(code);
        }

        asxSearchInput.addEventListener('input', () => {
            const query = asxSearchInput.value.trim().toUpperCase();
            asxSuggestions.innerHTML = ''; // Clear previous suggestions
            currentSelectedSuggestionIndex = -1; // Reset selection

            if (query.length < 2) { // Only show suggestions if query is at least 2 characters
                asxSuggestions.classList.remove('active');
                searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>'; // Reset display
                searchModalActionButtons.innerHTML = ''; // Clear action buttons
                currentSearchShareData = null;
                return;
            }

            // Filter suggestions by code or company name
            currentSuggestions = allAsxCodes.filter(stock => 
                stock.code.includes(query) || stock.name.toUpperCase().includes(query)
            ).slice(0, 10); // Limit to top 10 suggestions

            if (currentSuggestions.length > 0) {
                currentSuggestions.forEach((stock) => {
                    const div = document.createElement('div');
                    div.classList.add('suggestion-item');
                    div.textContent = `${stock.code} - ${stock.name}`;
                    div.dataset.code = stock.code;
                    div.dataset.name = stock.name;
                    // Use pointerdown/mousedown to capture before blur/hide
                    const handler = (ev) => {
                        ev.preventDefault();
                        console.log('[Autocomplete] Select suggestion', stock.code, stock.name);
                        asxSearchInput.value = stock.code;
                        asxSuggestions.classList.remove('active');
                        quickAddFromSearch(stock.code, stock.name);
                    };
                    div.addEventListener('pointerdown', handler, { passive: false });
                    div.addEventListener('mousedown', handler, { passive: false });
                    div.addEventListener('click', handler); // fallback
                    asxSuggestions.appendChild(div);
                });
                asxSuggestions.classList.add('active');
            } else {
                asxSuggestions.classList.remove('active'); // Hide suggestions if no matches
                searchResultDisplay.innerHTML = '<p class="initial-message">No matching stocks found.</p>';
                searchModalActionButtons.innerHTML = '';
                currentSearchShareData = null;
            }
        });

        // Keyboard navigation for suggestions
        asxSearchInput.addEventListener('keydown', (e) => {
            const items = asxSuggestions.querySelectorAll('.suggestion-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault(); // Prevent cursor movement in input
                currentSelectedSuggestionIndex = (currentSelectedSuggestionIndex + 1) % items.length;
                updateSelectedSuggestion(items);
                items[currentSelectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); // Prevent cursor movement in input
                currentSelectedSuggestionIndex = (currentSelectedSuggestionIndex - 1 + items.length) % items.length;
                updateSelectedSuggestion(items);
                items[currentSelectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission
                if (currentSelectedSuggestionIndex > -1) {
                    // Use the code from the selected suggestion's dataset
                    const selectedCode = items[currentSelectedSuggestionIndex].dataset.code;
                    asxSearchInput.value = selectedCode; // Update input field with the selected code
                    asxSuggestions.classList.remove('active'); // Hide suggestions
                    displayStockDetailsInSearchModal(selectedCode); // Display details for the *selected* stock
                } else if (asxSearchInput.value.trim() !== '') {
                    // If no suggestion selected but input has value, search directly
                    displayStockDetailsInSearchModal(asxSearchInput.value.trim().toUpperCase());
                    asxSuggestions.classList.remove('active'); // Hide suggestions
                }
            } else if (e.key === 'Escape') {
                asxSuggestions.classList.remove('active'); // Hide suggestions
                asxSearchInput.value = ''; // Clear input
                searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>';
                searchModalActionButtons.innerHTML = '';
                currentSearchShareData = null;
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (asxSuggestions && !asxSuggestions.contains(e.target) && e.target !== asxSearchInput) {
                asxSuggestions.classList.remove('active');
            }
        });

        // Delegated fallback: clicking the code header in search results populates form
        if (searchResultDisplay) {
            searchResultDisplay.addEventListener('click', (e) => {
                const header = e.target.closest('.search-modal-code-header');
                if (!header) return;
                const code = header.getAttribute('data-code');
                const name = header.getAttribute('data-name');
                console.log('[Autocomplete] Header fallback click', code, name);
                if (!code) return;
                quickAddFromSearch(code, name);
            });
        }

        // Global delegated listener on container to catch any missed clicks (safety net)
        if (asxSuggestions) {
            asxSuggestions.addEventListener('click', (e) => {
                const item = e.target.closest('.suggestion-item');
                if (!item) return;
                const code = item.dataset.code;
                const name = item.dataset.name;
                console.log('[Autocomplete] Delegated suggestion click', code, name);
                if (!code) return;
                // Simulate normal path if direct listener failed
                const stock = { code, name };
                asxSearchInput.value = code;
                asxSuggestions.classList.remove('active');
                quickAddFromSearch(code, name);
            });
        }

        function updateSelectedSuggestion(items) {
            items.forEach((item, index) => {
                if (index === currentSelectedSuggestionIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            // Update input value to selected suggestion for better UX
            if (currentSelectedSuggestionIndex > -1) {
                asxSearchInput.value = items[currentSelectedSuggestionIndex].dataset.code;
            }
        }
    }

    // Add event listeners to all form inputs for dirty state checking
    formInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', checkFormDirtyState);
            input.addEventListener('change', checkFormDirtyState);
            input.addEventListener('focus', function() {
                // Removed: The 'this.select()' call, as it was causing a TypeError on SELECT elements (dropdowns) on focus.
                // The automatic text selection on focus is now bypassed for stability.
            });
        }
    });

    // Phase 1: Direction toggles + legacy checkboxes mutual exclusivity and sync
    const syncDirButtonsFromCheckboxes = () => {
        if (!targetDirAboveBtn || !targetDirBelowBtn) return;
        const isAbove = !!(targetAboveCheckbox && targetAboveCheckbox.checked);
        targetDirAboveBtn.classList.toggle('is-active', isAbove);
        targetDirAboveBtn.setAttribute('aria-pressed', String(isAbove));
        const isBelow = !isAbove;
        targetDirBelowBtn.classList.toggle('is-active', isBelow);
        targetDirBelowBtn.setAttribute('aria-pressed', String(isBelow));
    };

    if (targetAboveCheckbox && targetBelowCheckbox) {
        targetAboveCheckbox.addEventListener('change', () => {
            if (targetAboveCheckbox.checked) {
                targetBelowCheckbox.checked = false;
            }
            syncDirButtonsFromCheckboxes();
            checkFormDirtyState();
        });

        targetBelowCheckbox.addEventListener('change', () => {
            if (targetBelowCheckbox.checked) {
                targetAboveCheckbox.checked = false;
            }
            syncDirButtonsFromCheckboxes();
            checkFormDirtyState();
        });
    }

    // Wire UI segmented direction buttons -> legacy checkboxes
    if (targetDirAboveBtn && targetDirBelowBtn && targetAboveCheckbox && targetBelowCheckbox) {
        targetDirAboveBtn.addEventListener('click', () => {
            userManuallyOverrodeDirection = true;
            targetAboveCheckbox.checked = true;
            targetBelowCheckbox.checked = false;
            syncDirButtonsFromCheckboxes();
            checkFormDirtyState();
        });
        targetDirBelowBtn.addEventListener('click', () => {
            userManuallyOverrodeDirection = true;
            targetAboveCheckbox.checked = false;
            targetBelowCheckbox.checked = true;
            syncDirButtonsFromCheckboxes();
            checkFormDirtyState();
        });
        // Initial sync
        syncDirButtonsFromCheckboxes();
    }

    // Wire Intent buttons: set defaults when user hasn’t manually overridden
    if (targetIntentBuyBtn && targetIntentSellBtn) {
        const setIntentUI = (intent) => {
            const isBuy = intent === 'buy';
            targetIntentBuyBtn.classList.toggle('is-active', isBuy);
            targetIntentBuyBtn.setAttribute('aria-pressed', String(isBuy));
            targetIntentSellBtn.classList.toggle('is-active', !isBuy);
            targetIntentSellBtn.setAttribute('aria-pressed', String(!isBuy));
        };
        targetIntentBuyBtn.addEventListener('click', () => {
            setIntentUI('buy');
            if (!userManuallyOverrodeDirection && targetAboveCheckbox && targetBelowCheckbox) {
                // Buy defaults to Below
                targetAboveCheckbox.checked = false;
                targetBelowCheckbox.checked = true;
                syncDirButtonsFromCheckboxes();
                checkFormDirtyState();
            }
        });
        targetIntentSellBtn.addEventListener('click', () => {
            setIntentUI('sell');
            if (!userManuallyOverrodeDirection && targetAboveCheckbox && targetBelowCheckbox) {
                // Sell defaults to Above
                targetAboveCheckbox.checked = true;
                targetBelowCheckbox.checked = false;
                syncDirButtonsFromCheckboxes();
                checkFormDirtyState();
            }
        });
        // Default to Buy on load
        setIntentUI('buy');
    }
    
    // NEW: Add event listeners for cash asset form inputs for dirty state checking (2.1)
    if (cashAssetNameInput) cashAssetNameInput.addEventListener('input', checkCashAssetFormDirtyState);
    if (cashAssetBalanceInput) cashAssetBalanceInput.addEventListener('input', checkCashAssetFormDirtyState);
    // NEW: Add event listener for the hideCashAssetCheckbox for dirty state checking
    if (hideCashAssetCheckbox) hideCashAssetCheckbox.addEventListener('change', checkCashAssetFormDirtyState);

    formInputs.forEach((inputElement, index) => { // Renamed 'input' to 'inputElement' for clarity
        if (inputElement) {
            inputElement.addEventListener('keydown', function(event) { // 'this' refers to 'inputElement'
                if (event.key === 'Enter') {
                    event.preventDefault();

                    // Case 1: If it's a SELECT element (e.g., shareRatingSelect)
                    if (this.tagName === 'SELECT') {
                        const nextElement = formInputs[index + 1];
                        if (nextElement) {
                            nextElement.focus();
                        } else if (addCommentSectionBtn && addCommentSectionBtn.offsetParent !== null && !addCommentSectionBtn.classList.contains('is-disabled-icon')) {
                            addCommentSectionBtn.click();
                            const newCommentTitleInput = commentsFormContainer.lastElementChild?.querySelector('.comment-title-input');
                            if (newCommentTitleInput) {
                                newCommentTitleInput.focus();
                            }
                        } else if (saveShareBtn && !saveShareBtn.classList.contains('is-disabled-icon')) {
                            saveShareBtn.click();
                        }
                        return; // Stop processing after handling SELECT
                    }

                    // Case 2: If it's an INPUT or TEXTAREA element
                    if (this.tagName === 'INPUT' || this.tagName === 'TEXTAREA') {
                        // Removed: The 'this.select()' call, as it was causing an inexplicable TypeError on SELECT elements.
                        // The original intention was to select text in text inputs, but this is now bypassed for stability.
                        // The focus logic below will still proceed.
                        const nextElement = formInputs[index + 1];
                        if (nextElement) {
                            nextElement.focus();
                        } else if (addCommentSectionBtn && addCommentSectionBtn.offsetParent !== null && !addCommentSectionBtn.classList.contains('is-disabled-icon')) {
                            addCommentSectionBtn.click();
                            const newCommentTitleInput = commentsFormContainer.lastElementChild?.querySelector('.comment-title-input');
                            if (newCommentTitleInput) {
                                newCommentTitleInput.focus();
                            }
                        } else if (saveShareBtn && !saveShareBtn.classList.contains('is-disabled-icon')) {
                            saveShareBtn.click();
                        }
                        return; // Stop processing after handling INPUT/TEXTAREA
                    }

                    // Fallback for any other element type (shouldn't happen with formInputs array)
                    // Or if no specific action was taken, try to focus next general element
                    const nextElement = formInputs[index + 1];
                    if (nextElement) {
                        nextElement.focus();
                    }
                }
            });
        }
    });

    // Add Comment Section Button for Shares
    if (addCommentSectionBtn) {
        setIconDisabled(addCommentSectionBtn, false);
        addCommentSectionBtn.addEventListener('click', () => {
            addCommentSection(commentsFormContainer);
            checkFormDirtyState();
        });
    }

    // NEW: Add Comment Section Button for Cash Assets
    if (addCashAssetCommentBtn) {
        setIconDisabled(addCashAssetCommentBtn, false);
        addCashAssetCommentBtn.addEventListener('click', () => {
            addCommentSection(cashAssetCommentsContainer, '', '', true); // true for cash asset comment
            checkCashAssetFormDirtyState();
        });
    }

    // Close buttons for modals
    document.querySelectorAll('.close-button').forEach(button => {
        if (button.classList.contains('form-close-button')) { // Specific for the share form's 'X' (Cancel button)
            button.addEventListener('click', () => {
                logDebug('Form: Share form close button (X) clicked. Clearing form before closing to cancel edits.');
                clearForm(); // This will reset originalShareData and selectedShareDocId, preventing auto-save
                closeModals(); // Now closeModals won't trigger auto-save for this form
            });
        } else if (button.classList.contains('cash-form-close-button')) { // NEW: Specific for cash asset form's 'X' (Cancel button)
            button.addEventListener('click', () => {
                logDebug('Cash Form: Cash asset form close button (X) clicked. Clearing form before closing to cancel edits.');
                clearCashAssetForm(); // Reset originalCashAssetData and selectedCashAssetDocId
                closeModals();
            });
        }
        else {
            button.addEventListener('click', closeModals); // Other modals still close normally
        }
    });

    // NEW: Close button for stock search modal
    if (searchModalCloseButton) {
        searchModalCloseButton.addEventListener('click', () => {
            logDebug('Search Modal: Close button clicked.');
            asxSearchInput.value = ''; // Clear input on close
            searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>'; // Reset display
            searchModalActionButtons.innerHTML = ''; // Clear action buttons
            asxSuggestions.classList.remove('active'); // Hide suggestions
            currentSelectedSuggestionIndex = -1; // Reset selection
            currentSearchShareData = null; // Clear current search data
            hideModal(stockSearchModal);
        });
    }

    // Global click listener to close modals/context menu if clicked outside
    window.addEventListener('click', (event) => {
        // Handle targetHitDetailsModal minimization specifically.
        // This ensures clicks *outside* the modal content and *not* on the trigger button minimize it.
        if (targetHitDetailsModal && targetHitDetailsModal.style.display !== 'none') {
            const clickedInsideModalContent = targetHitDetailsModal.querySelector('.modal-content').contains(event.target);
            const clickedOnTargetIconButton = (event.target === targetHitIconBtn || targetHitIconBtn.contains(event.target));
            
            if (!clickedInsideModalContent && !clickedOnTargetIconButton) {
                logDebug('Global Click: Clicked outside targetHitDetailsModal (and not on icon). Minimizing it.');
                hideModal(targetHitDetailsModal); // Directly hide the modal
                return; // Prevent further modal closing logic for this click
            }
        }

        // General modal closing logic (for other modals)
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal || event.target === alertPanel ||
            event.target === cashAssetFormModal || event.target === cashAssetDetailModal ||
            event.target === stockSearchModal) {
            closeModals();
        }

        // Context menu closing logic
        if (contextMenuOpen && shareContextMenu && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
        }
    });

    // The event listener for targetHitIconBtn needs to be robust.
    // Ensure it is only added once during initialization and always re-shows the modal.
    // This part should be in `initializeAppLogic` as confirmed previously.
    // Make sure the `initializeAppLogic` function's relevant section looks like this:
    /*
    if (targetHitIconBtn) {
        // Remove existing listeners to prevent multiple bindings if initializeAppLogic runs again
        targetHitIconBtn.removeEventListener('click', showTargetHitDetailsModal);
        targetHitIconBtn.addEventListener('click', (event) => {
            logDebug('Target Alert: Icon button clicked. Opening details modal.');
            // Ensure the modal is explicitly shown
            showModal(targetHitDetailsModal);
        });
    }
    */
    // For this specific update, I will also add the `removeEventListener` directly to the `targetHitIconBtn` section in `initializeAppLogic`.

    // Locate the `targetHitIconBtn` listener setup inside `initializeAppLogic`
    // and replace it with the more robust version if it's not already like this.
    // This is not part of the immediately surrounding code, but essential for the fix.
    // So, this is a reminder for you to check this part in the `initializeAppLogic` function too:
    // **No change in the provided snippet above for the targetHitIconBtn,
    // as it is correctly handled in `initializeAppLogic` as a separate concern.**

    // The fix for this immediate context is primarily the global click listener logic.

    // Google Auth Button (Sign In/Out) - This button is removed from index.html.
    // Its functionality is now handled by splashSignInBtn.

    // NEW: Simplified Splash Sign-In: popup-only with in-progress guard

    // Early environment safety check: mobile + file:// cannot perform Google auth
    try {
        const precheckUA = navigator.userAgent || navigator.vendor || '';
        const precheckIsMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(precheckUA);
        const precheckIsFile = (window.location && window.location.protocol === 'file:');
        if (splashSignInBtn && precheckIsMobile && precheckIsFile) {
            updateSplashSignInButtonState('error', 'Open via web URL');
            splashSignInBtn.disabled = true;
            showCustomAlert('Mobile sign-in can’t run from a file:// URL. Please serve this app over http(s) (e.g., VS Code Live Server) and retry.');
            console.warn('Auth Precheck: Blocking sign-in on mobile file:// context.');
        }
    } catch(_) {}

    if (splashSignInBtn && splashSignInBtn.getAttribute('data-bound') !== 'true') {
        let splashSignInRetryTimer = null;
        let splashSignInInProgress = false;
        splashSignInBtn.setAttribute('data-bound','true');
        splashSignInBtn.addEventListener('click', async () => {
            logDebug('Auth: Splash Screen Sign-In Button Clicked.');
            const currentAuth = window.firebaseAuth;
            if (!currentAuth || !window.authFunctions) {
                console.warn('Auth: Auth service not ready or functions not loaded. Cannot process splash sign-in.');
                showCustomAlert('Authentication service not ready. Please try again in a moment.');
                return;
            }
            try {
                if (splashSignInInProgress) {
                    console.warn('Auth: Sign-in already in progress; ignoring duplicate click.');
                    return;
                }
                splashSignInInProgress = true;
                // Visual feedback
                if (splashKangarooIcon) splashKangarooIcon.classList.add('pulsing');
                splashSignInBtn.disabled = true;
                // Always create a fresh provider per attempt to avoid stale customParameters
                const provider = (window.authFunctions.createGoogleProvider ? window.authFunctions.createGoogleProvider() : window.authFunctions.GoogleAuthProviderInstance);
                if (!provider) {
                    console.error('Auth: GoogleAuthProvider instance not found. Is Firebase module script loaded?');
                    showCustomAlert('Authentication service not ready. Firebase script missing.');
                    splashSignInInProgress = false;
                    return;
                }
                try { provider.addScope('email'); provider.addScope('profile'); } catch(_) {}
                // Popup only
                const resolver = window.authFunctions.browserPopupRedirectResolver;
                if (resolver) {
                    await window.authFunctions.signInWithPopup(currentAuth, provider, resolver);
                } else {
                    await window.authFunctions.signInWithPopup(currentAuth, provider);
                }
                logDebug('Auth: Google Sign-In successful from splash screen.');
                // onAuthStateChanged will transition UI; keep button disabled briefly to avoid double-click
            }
            catch (error) {
                console.error('Auth: Google Sign-In failed from splash screen:', { code: error.code, message: error.message });
                showCustomAlert('Google Sign-In failed: ' + error.message);
                splashSignInInProgress = false;
                splashSignInBtn.disabled = false;
                if (splashKangarooIcon) splashKangarooIcon.classList.remove('pulsing');
            }
        });
    }

    // Removed redirect handling entirely: popup-only auth

    // NEW: Event listener for the top 'X' close button in the Target Hit Details Modal
    if (targetHitModalCloseTopBtn) {
        targetHitModalCloseTopBtn.addEventListener('click', () => {
            hideModal(targetHitDetailsModal); // Standard close, keeps bubble active
            logDebug('Target Alert Modal: Top Close button clicked. Modal hidden.');
        });
    }

    // NEW: Event listener for the "Minimize" button at the bottom of the modal
    if (alertModalMinimizeBtn) {
        alertModalMinimizeBtn.addEventListener('click', () => {
            hideModal(targetHitDetailsModal); // Close the modal
            // The bubble remains visible by default unless explicitly dismissed
            logDebug('Target Alert Modal: Minimize button clicked. Modal hidden, bubble remains active.');
        });
    }

    // NEW: Event listener for the "Dismiss All" button at the bottom of the modal
    if (alertModalDismissAllBtn) {
        alertModalDismissAllBtn.addEventListener('click', () => {
            targetHitIconDismissed = true; // Mark as dismissed for the session
            localStorage.setItem('targetHitIconDismissed', 'true'); // Save dismissal preference
            try { localStorage.setItem('lastKnownTargetCount', '0'); } catch(e) {}
            // No need to explicitly hide the bubble here, updateTargetHitBanner will handle it.
            updateTargetHitBanner(); // Update the bubble (will hide it if no alerts and dismissed)
            hideModal(targetHitDetailsModal); // Close the modal
            showCustomAlert('Target Price Alerts dismissed until next login.', 2000); // User feedback
            renderWatchlist(); // Re-render the watchlist to remove all borders/highlights
            logDebug('Target Alert Modal: Dismiss All button clicked. Alerts dismissed, modal and bubble hidden. Watchlist re-rendered.');
        });
    }

    // NEW: Clear All Alerts button listener (alertPanel is not in current HTML, but kept for consistency)
    if (clearAllAlertsBtn) {
        clearAllAlertsBtn.addEventListener('click', () => {
            logDebug('Alert Panel: Clear All button clicked.');
            sharesAtTargetPrice = []; // Clear all alerts in memory
            // renderAlertsInPanel(); // Commented out as alertPanel is not in HTML
            updateTargetHitBanner(); // Update the main icon count
            showCustomAlert('All alerts cleared for this session.', 1500);
            // hideModal(alertPanel); // Commented out as alertPanel is not in HTML
        });
    }


    // Logout Button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logDebug('Auth: Logout Button Clicked (No Confirmation).');
            const currentAuth = window.firebaseAuth;
            if (!currentAuth || !window.authFunctions) {
                console.warn('Auth: Auth service not ready or functions not loaded. Cannot process logout.');
                showCustomAlert('Authentication service not ready. Please try again in a moment.');
                return;
            }
            try {
                await window.authFunctions.signOut(currentAuth);
                showCustomAlert('Logged out successfully!', 1500);
                logDebug('Auth: User successfully logged out.');
                toggleAppSidebar(false);

                // NEW: Explicitly ensure splash screen is visible for re-authentication
                if (splashScreen) {
                    splashScreen.style.display = 'flex'; // Ensure splash screen is visible
                    splashScreen.classList.remove('hidden'); // Ensure it's not hidden
                    document.body.style.overflow = 'hidden'; // Re-apply overflow hidden
                    if (splashKangarooIcon) {
                        splashKangarooIcon.classList.remove('pulsing'); // Stop animation if signed out
                    }
                    if (splashSignInBtn) {
                        splashSignInBtn.disabled = false; // Enable sign-in button
                        const buttonTextSpan = splashSignInBtn.querySelector('span');
                        if (buttonTextSpan) {
                            buttonTextSpan.textContent = 'Sign in with Google'; // Reset only the text, not the icon
                        }
                    }
                    // Hide main app content
                    if (mainContainer) {
                        mainContainer.classList.add('app-hidden');
                    }
                    if (appHeader) {
                        appHeader.classList.add('app-hidden');
                    }
                    logDebug('Splash Screen: User signed out, splash screen remains visible for sign-in.');
                } else {
                    console.warn('Splash Screen: User signed out, but splash screen element not found. App content might be visible.');
                }
                // NEW: Reset targetHitIconDismissed and clear localStorage entry on logout for a fresh start on next login
                targetHitIconDismissed = false; 
                localStorage.removeItem('targetHitIconDismissed');
                try { localStorage.removeItem('forcedLiveFetchOnce'); } catch(e) {}
                try { localStorage.setItem('lastKnownTargetCount', '0'); } catch(e) {}

            }
            catch (error) {
                console.error('Auth: Logout failed:', error);
                showCustomAlert('Logout failed: ' + error.message);
            }
        });
    }

// Delete All User Data Button
if (deleteAllUserDataBtn) {
    deleteAllUserDataBtn.addEventListener('click', () => {
        logDebug('UI: Delete All User Data button clicked.');
        deleteAllUserData();
        toggleAppSidebar(false); // Close sidebar after action
    });
}

    // Watchlist Select Change Listener
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async (event) => {
            logDebug('Watchlist Select: Change event fired. New value: ' + event.target.value);
            currentSelectedWatchlistIds = [event.target.value];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
            // Just render the watchlist. The listeners for shares/cash are already active.
            renderWatchlist();
        });
    }

    // Sort Select Change Listener
if (sortSelect) {
    sortSelect.addEventListener('change', async (event) => {
        logDebug('Sort Select: Change event fired. New value: ' + event.target.value);
        currentSortOrder = sortSelect.value;
        
        // AGGRESSIVE FIX: Force apply sort immediately for percentage change sorts
        if (currentSortOrder === 'percentageChange-desc' || currentSortOrder === 'percentageChange-asc') {
            logDebug('AGGRESSIVE SORT: Percentage change sort selected, forcing immediate application');
            forceApplyCurrentSort();
        }
        
        // Determine whether to sort shares or cash assets
        if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
            renderCashCategories(); // Re-render cash categories with new sort order
        } else {
            sortShares(); // Sorts allSharesData and calls renderWatchlist
        }
        await saveSortOrderPreference(currentSortOrder);

        // NEW: Scroll to the top of the page after sorting/rendering
        window.scrollTo({ top: 0, behavior: 'smooth' });
        logDebug('Sort: Scrolled to top after sorting.');
    });
}

    // New Share Button (from sidebar) - Now contextual, handled by updateSidebarAddButtonContext
    // The event listener will be set dynamically by updateSidebarAddButtonContext()
    // No direct event listener here anymore.

    // NEW: Add New Cash Asset Button (from sidebar)
    if (addCashAssetSidebarBtn) {
        addCashAssetSidebarBtn.addEventListener('click', () => {
            logDebug('UI: Add New Cash Asset button (sidebar) clicked.');
            addCashCategoryUI(); // This function now directly opens the modal for adding a new cash asset
            toggleAppSidebar(false);
        });
    }

    // Add Share Header Button (from header) - now contextual, handled by updateAddHeaderButton
    // Its click listener is set dynamically in updateAddHeaderButton()

    // Event listener for shareNameInput to toggle saveShareBtn
    if (shareNameInput && saveShareBtn) {
        shareNameInput.addEventListener('input', () => {
            checkFormDirtyState(); 
        });
    }

    // Save Share Button
    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            logDebug('Share Form: Save Share button clicked.');
            // Call the shared save function, not silent
            saveShareData(false);
        });
    }

    // Delete Share Button
    if (deleteShareBtn) {
        deleteShareBtn.addEventListener('click', async () => {
            logDebug('Share Form: Delete Share button clicked (Direct Delete).');
            if (deleteShareBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Share: Delete button was disabled, preventing action.');
                return;
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    // showCustomAlert('Share deleted successfully!', 1500); // Removed as per previous request
                    logDebug('Firestore: Share (ID: ' + selectedShareDocId + ') deleted.');
                    closeModals();
                    updateTargetHitBanner(); // NEW: Update banner after deletion
                } catch (error) {
                    console.error('Firestore: Error deleting share:', error);
                    showCustomAlert('Error deleting share: ' + error.message);
                }
            } else { showCustomAlert('No share selected for deletion.'); }
        });
    }

    // Edit Share From Detail Button
    if (editShareFromDetailBtn) {
        editShareFromDetailBtn.addEventListener('click', () => {
            logDebug('Share Details: Edit Share button clicked.');
            if (editShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn('Edit Share From Detail: Edit button was disabled, preventing action.');
                return;
            }
            // Ensure selectedShareDocId exists even if selection was cleared after save/render
            if (!selectedShareDocId && shareDetailModal && shareDetailModal.dataset && shareDetailModal.dataset.shareId) {
                selectedShareDocId = shareDetailModal.dataset.shareId;
                logDebug('Share Details: Restored selectedShareDocId from modal dataset: ' + selectedShareDocId);
            }
            // Mark that the edit form was opened from share details so back restores it
            wasEditOpenedFromShareDetail = true;
            // Ensure the details modal is recorded just before we open the edit modal
            try { pushAppStateEntry('modal', shareDetailModal); } catch(_) {}
            // Close the detail modal first to avoid overlay conflicts, then open the edit form
            hideModal(shareDetailModal);
            if (typeof showEditFormForSelectedShare === 'function') {
                showEditFormForSelectedShare();
            }
        });
    }

    // Delete Share From Detail Button
    if (deleteShareFromDetailBtn) {
        deleteShareFromDetailBtn.addEventListener('click', async () => {
            logDebug('Share Details: Delete Share button clicked (Direct Delete).');
            if (deleteShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Share From Detail: Delete button was disabled, preventing action.');
                return;
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    // showCustomAlert('Share deleted successfully!', 1500); // Removed as per previous request
                    logDebug('Firestore: Share (ID: ' + selectedShareDocId + ') deleted.');
                    closeModals();
                    updateTargetHitBanner(); // NEW: Update banner after deletion
                } catch (error) {
                    console.error('Firestore: Error deleting share:', error);
                    showCustomAlert('Error deleting share: ' + error.message);
                }
            } else { showCustomAlert('No share selected for deletion.'); }
        });
    }

    // Context Menu Edit Share Button
    if (contextEditShareBtn) {
        contextEditShareBtn.addEventListener('click', () => {
            logDebug('Context Menu: Edit Share button clicked.');
            if (currentContextMenuShareId) {
                const shareIdToEdit = currentContextMenuShareId;
                hideContextMenu();
                showEditFormForSelectedShare(shareIdToEdit);
            } else {
                console.warn('Context Menu: No share ID found for editing.');
            }
        });
    }

    // Context Menu Delete Share Button
    if (contextDeleteShareBtn) {
        contextDeleteShareBtn.addEventListener('click', async () => {
            logDebug('Context Menu: Delete Share button clicked (Direct Delete).');
            if (currentContextMenuShareId) {
                const shareToDeleteId = currentContextMenuShareId;
                hideContextMenu();
                try {
                    const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', shareToDeleteId);
                    await window.firestore.deleteDoc(shareDocRef);
                    // showCustomAlert('Share deleted successfully!', 1500); // Removed as per user request
                    logDebug('Firestore: Share (ID: ' + shareToDeleteId + ') deleted.');
                } catch (error) {
                    console.error('Firestore: Error deleting share:', error);
                    showCustomAlert('Error deleting share: ' + error.message);
                }
            } else {
                showCustomAlert('No share selected for deletion from context menu.');
                console.warn('Context Menu: No share ID found for deletion.');
            }
        });
    }

    // Add Watchlist Button
    if (addWatchlistBtn) {
        addWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Add Watchlist button clicked.');
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            setIconDisabled(saveWatchlistBtn, true); // Disable save button initially
            logDebug('Add Watchlist: saveWatchlistBtn disabled initially.');
            originalWatchlistData = getCurrentWatchlistFormData(true); // Store initial state for dirty check
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false);
            checkWatchlistFormDirtyState(true); // Check dirty state immediately after opening
        });
    }

    // Event listener for newWatchlistNameInput to toggle saveWatchlistBtn (for Add Watchlist Modal)
    if (newWatchlistNameInput && saveWatchlistBtn) {
        newWatchlistNameInput.addEventListener('input', () => {
            checkWatchlistFormDirtyState(true);
        });
    }

    // Save Watchlist Button (for Add Watchlist Modal)
    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', async () => {
            logDebug('Watchlist Form: Save Watchlist button clicked.');
            if (saveWatchlistBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Please enter a watchlist name.');
                console.warn('Save Watchlist: Save button was disabled, preventing action.');
                return;
            }
            const watchlistName = newWatchlistNameInput.value.trim();
            await saveWatchlistChanges(false, watchlistName); // false indicates not silent
        });
    }

    // Edit Watchlist Button
    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Edit Watchlist button clicked.');
            let watchlistToEditId = watchlistSelect.value;

            // Prevent editing "All Shares" or "Cash & Assets"
            if (watchlistToEditId === ALL_SHARES_ID || watchlistToEditId === CASH_BANK_WATCHLIST_ID) {
                showCustomAlert('Cannot edit this special watchlist.', 2000);
                return;
            }

            if (!watchlistToEditId || !userWatchlists.some(w => w.id === watchlistToEditId)) {
                showCustomAlert('Please select a watchlist to edit.');
                return;
            }
            const selectedWatchlistObj = userWatchlists.find(w => w.id === watchlistToEditId);
            const watchlistToEditName = selectedWatchlistObj ? selectedWatchlistObj.name : '';

            logDebug('Edit Watchlist Button Click: Watchlist to edit ID: ' + watchlistToEditId + ', Name: ' + watchlistToEditName);

            // Ensure currentEditingWatchlistId is set for modal actions (delete/save)
            currentEditingWatchlistId = watchlistToEditId;

            editWatchlistNameInput.value = watchlistToEditName;
            // Keep at least one real watchlist + Cash & Assets
            const actualWatchlists = userWatchlists.filter(wl => wl.id !== ALL_SHARES_ID && wl.id !== CASH_BANK_WATCHLIST_ID);
            const isDisabledDelete = actualWatchlists.length <= 1; 
            setIconDisabled(deleteWatchlistInModalBtn, isDisabledDelete); 
            logDebug('Edit Watchlist: deleteWatchlistInModalBtn disabled: ' + isDisabledDelete);
            setIconDisabled(saveWatchlistNameBtn, true); // Disable save button initially
            logDebug('Edit Watchlist: saveWatchlistNameBtn disabled initially.');
            originalWatchlistData = getCurrentWatchlistFormData(false); // Store initial state for dirty check
            showModal(manageWatchlistModal);
            editWatchlistNameInput.focus();
            toggleAppSidebar(false);
            checkWatchlistFormDirtyState(false); // Check dirty state immediately after opening
        });
    }

    // Event listener for editWatchlistNameInput to toggle saveWatchlistNameBtn
    if (editWatchlistNameInput && saveWatchlistNameBtn) {
        editWatchlistNameInput.addEventListener('input', () => {
            checkWatchlistFormDirtyState(false);
        });
    }

    // Save Watchlist Name Button (for Manage Watchlist Modal)
    if (saveWatchlistNameBtn) {
        saveWatchlistNameBtn.addEventListener('click', async () => {
            logDebug('Manage Watchlist Form: Save Watchlist Name button clicked.');
            if (saveWatchlistNameBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Watchlist name cannot be empty or unchanged.');
                console.warn('Save Watchlist Name: Save button was disabled, preventing action.');
                return;
            }
            const newName = editWatchlistNameInput.value.trim();
            const watchlistToEditId = currentEditingWatchlistId; // Use the stored ID
            await saveWatchlistChanges(false, newName, watchlistToEditId); // false indicates not silent
        });
    }

    // Delete Watchlist In Modal Button (for Manage Watchlist Modal)
    if (deleteWatchlistInModalBtn) {
        deleteWatchlistInModalBtn.addEventListener('click', async () => {
            logDebug('Manage Watchlist Form: Delete Watchlist button clicked (Direct Delete).');
            if (deleteWatchlistInModalBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Watchlist In Modal: Delete button was disabled, preventing action.');
                return;
            }

            let watchlistToDeleteId = currentEditingWatchlistId; // Use the stored ID

            // Guard clause: check for null/undefined/empty ID
            if (!watchlistToDeleteId) {
                showCustomAlert('Error: Cannot delete watchlist. ID is missing or invalid.', 2000);
                console.error('DeleteWatchlist: watchlistToDeleteId is null/undefined/empty:', watchlistToDeleteId);
                return;
            }

            // Prevent deleting "All Shares" or "Cash & Assets"
            if (watchlistToDeleteId === ALL_SHARES_ID || watchlistToDeleteId === CASH_BANK_WATCHLIST_ID) {
                showCustomAlert('Cannot delete this special watchlist.', 2000);
                return;
            }

            // Ensure at least one actual watchlist remains (excluding Cash & Assets)
            const actualWatchlists = userWatchlists.filter(wl => wl.id !== ALL_SHARES_ID && wl.id !== CASH_BANK_WATCHLIST_ID);
            if (actualWatchlists.length <= 1) {
                showCustomAlert('Cannot delete the last stock watchlist. Please create another stock watchlist first.', 3000);
                return;
            }

            const watchlistToDeleteName = userWatchlists.find(w => w.id === watchlistToDeleteId)?.name || 'Unknown Watchlist';
            
            try {
                const sharesColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
                const q = window.firestore.query(sharesColRef, window.firestore.where('watchlistId', '==', watchlistToDeleteId));
                const querySnapshot = await window.firestore.getDocs(q);

                const batch = window.firestore.writeBatch(db);
                querySnapshot.forEach(doc => {
                    const shareRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', doc.id);
                    batch.delete(shareRef);
                });
                await batch.commit();
                logDebug('Firestore: Deleted ' + querySnapshot.docs.length + ' shares from watchlist \'" + watchlistToDeleteName + "\'.');

                const watchlistDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistToDeleteId);
                await window.firestore.deleteDoc(watchlistDocRef);
                logDebug('Firestore: Watchlist \'" + watchlistToDeleteName + "\' (ID: ' + watchlistToDeleteId + ') deleted.');

                showCustomAlert('Watchlist \'" + watchlistToDeleteName + "\' and its shares deleted successfully!', 2000);
                closeModals();

                // After deleting a watchlist, switch the current view to "All Shares"
                currentSelectedWatchlistIds = [ALL_SHARES_ID];
                await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds); // Save this preference

                await loadUserWatchlistsAndSettings(); // This will re-render everything correctly
            } catch (error) {
                console.error('Firestore: Error deleting watchlist:', error);
                showCustomAlert('Error deleting watchlist: ' + error.message);
            }
        });
    }

    // Dividend Calculator Button
    if (dividendCalcBtn) {
        dividendCalcBtn.addEventListener('click', () => {
            logDebug('UI: Dividend button clicked. Attempting to open modal.');
            // Corrected references to use unique IDs for dividend calculator inputs
            if (calcDividendAmountInput) calcDividendAmountInput.value = ''; 
            if (calcCurrentPriceInput) calcCurrentPriceInput.value = ''; 
            if (calcFrankingCreditsInput) calcFrankingCreditsInput.value = ''; 
            if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '-'; 
            if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '-'; 
            if (calcEstimatedDividend) calcEstimatedDividend.textContent = '-'; 
            if (investmentValueSelect) investmentValueSelect.value = '10000'; // Reset dropdown
            showModal(dividendCalculatorModal);
            if (calcCurrentPriceInput) calcCurrentPriceInput.focus(); 
            logDebug('UI: Dividend Calculator modal opened.');
            toggleAppSidebar(false);
        });
    }

    // Dividend Calculator Input Listeners
    [calcDividendAmountInput, calcCurrentPriceInput, calcFrankingCreditsInput, investmentValueSelect].forEach(input => {
        if (input) {
            input.addEventListener('input', updateDividendCalculations);
            input.addEventListener('change', updateDividendCalculations);
        }
    });

    function updateDividendCalculations() {
        const currentPrice = parseFloat(calcCurrentPriceInput.value);
        const dividendAmount = parseFloat(calcDividendAmountInput.value);
        const frankingCredits = parseFloat(calcFrankingCreditsInput.value);
        const investmentValue = parseFloat(investmentValueSelect.value);
        
        const unfrankedYield = calculateUnfrankedYield(dividendAmount, currentPrice);
        const frankedYield = calculateFrankedYield(dividendAmount, currentPrice, frankingCredits);
        const estimatedDividend = estimateDividendIncome(investmentValue, dividendAmount, currentPrice);
        
    calcUnfrankedYieldSpan.textContent = unfrankedYield !== null ? formatAdaptivePercent(unfrankedYield) + '%' : '-';
    calcFrankedYieldSpan.textContent = frankedYield !== null ? formatAdaptivePercent(frankedYield) + '%' : '-';
    calcEstimatedDividend.textContent = estimatedDividend !== null ? '$' + formatAdaptivePrice(estimatedDividend) : '-';
    }

    // Standard Calculator Button
    if (standardCalcBtn) {
        standardCalcBtn.addEventListener('click', () => {
            logDebug('UI: Standard Calculator button clicked.');
            resetCalculator();
            showModal(calculatorModal);
            logDebug('UI: Standard Calculator modal opened.');
            toggleAppSidebar(false);
        });
    }

    // Calculator Buttons
    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const target = event.target;
            if (!target.classList.contains('calc-btn') || target.classList.contains('is-disabled-icon')) { return; }
            const value = target.dataset.value;
            const action = target.dataset.action;
            if (value) { appendNumber(value); }
            else if (action) { handleAction(action); }
        });
    }

    function appendNumber(num) {
        if (resultDisplayed) { currentCalculatorInput = num; resultDisplayed = false; }
        else { if (num === '.' && currentCalculatorInput.includes('.')) return; currentCalculatorInput += num; }
        updateCalculatorDisplay();
    }

    function handleAction(action) {
        if (action === 'clear') { resetCalculator(); return; }
        if (action === 'percentage') { 
            if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
            let val;
            if (currentCalculatorInput !== '') {
                val = parseFloat(currentCalculatorInput);
            } else if (previousCalculatorInput !== '') {
                val = parseFloat(previousCalculatorInput);
            } else {
                return;
            }

            if (isNaN(val)) return;

            if (operator && previousCalculatorInput !== '') {
                const prevNum = parseFloat(previousCalculatorInput);
                if (isNaN(prevNum)) return;
                currentCalculatorInput = (prevNum * (val / 100)).toString();
            } else {
                currentCalculatorInput = (val / 100).toString();
            }
            resultDisplayed = false;
            updateCalculatorDisplay();
            return; 
        }
        if (['add', 'subtract', 'multiply', 'divide'].includes(action)) {
            if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
            if (currentCalculatorInput !== '') {
                if (previousCalculatorInput !== '') { calculateResult(); previousCalculatorInput = calculatorResult.textContent; }
                else { previousCalculatorInput = currentCalculatorInput; }
            }
            operator = action; currentCalculatorInput = ''; resultDisplayed = false; updateCalculatorDisplay(); return;
        }
        if (action === 'calculate') {
            if (previousCalculatorInput === '' || currentCalculatorInput === '' || operator === null) { return; }
            calculateResult(); operator = null; resultDisplayed = true;
        }
    }

    // Theme Toggle Button (Random Selection)
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            logDebug('Theme Debug: Random Theme Toggle button clicked.');
            if (CUSTOM_THEMES.length > 0) {
                let randomIndex;
                let newThemeName;
                do {
                    randomIndex = Math.floor(Math.random() * CUSTOM_THEMES.length);
                    newThemeName = CUSTOM_THEMES[randomIndex];
                } while (newThemeName === currentActiveTheme && CUSTOM_THEMES.length > 1); // Ensure a different theme if possible

                logDebug('Theme Debug: Selected random nextThemeName: ' + newThemeName);
                applyTheme(newThemeName);
            } else {
                logDebug('Theme Debug: No custom themes defined. Defaulting to system-default.');
                applyTheme('system-default'); // Fallback if no custom themes defined
            }
        });
    }

    // Color Theme Select Dropdown
    if (colorThemeSelect) {
        colorThemeSelect.addEventListener('change', (event) => {
            logDebug('Theme: Color theme select changed to: ' + event.target.value);
            const selectedTheme = event.target.value;
            // If "No Custom Theme" is selected, apply system-default
            if (selectedTheme === 'none') {
                applyTheme('system-default');
            } else {
                applyTheme(selectedTheme);
            }
        });
    }

    // Revert to Default Theme Button (Toggle Light/Dark)
    if (revertToDefaultThemeBtn) {
        revertToDefaultThemeBtn.addEventListener('click', async (event) => {
            logDebug('Theme Debug: Revert to Default Theme button clicked (now toggling Light/Dark).');
            event.preventDefault(); // Prevent default button behavior

            const body = document.body;
            let targetTheme;

            // Remove all custom theme classes and the data-theme attribute
            body.className = body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');
            body.removeAttribute('data-theme');
            localStorage.removeItem('selectedTheme'); // Clear custom theme preference

            // Determine target theme based on current state (only considering light/dark classes)
            if (currentActiveTheme === 'light') {
                targetTheme = 'dark';
                body.classList.add('dark-theme');
                logDebug('Theme: Toggled from Light to Dark theme.');
            } else if (currentActiveTheme === 'dark') {
                targetTheme = 'light';
                body.classList.remove('dark-theme');
                logDebug('Theme: Toggled from Dark to Light theme.');
            } else { // This handles the very first click, or when currentActiveTheme is 'system-default' or any custom theme
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (systemPrefersDark) {
                    targetTheme = 'light';
                    body.classList.remove('dark-theme');
                    logDebug('Theme: First click from system-default/custom: Toggled from System Dark to Light.');
                } else {
                    targetTheme = 'dark';
                    body.classList.add('dark-theme');
                    logDebug('Theme: First click from system-default/custom: Toggled from System Light to Dark.');
                }
            }
            
            currentActiveTheme = targetTheme; // Update global tracking variable
            localStorage.setItem('theme', targetTheme); // Save preference for light/dark
            
            // Save preference to Firestore
            if (currentUserId && db && window.firestore) {
                const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
                try {
                    await window.firestore.setDoc(userProfileDocRef, { lastTheme: targetTheme }, { merge: true });
                    logDebug('Theme: Saved explicit Light/Dark theme preference to Firestore: ' + targetTheme);
                } catch (error) {
                    console.error('Theme: Error saving explicit Light/Dark theme preference to Firestore:', error);
                }
            }
            updateThemeToggleAndSelector(); // Update dropdown (it should now show "No Custom Theme")
        });
    }

    // System Dark Mode Preference Listener (Keep this as is)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (currentActiveTheme === 'system-default') {
            if (event.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            logDebug('Theme: System theme preference changed and applied (system-default mode).');
            updateThemeToggleAndSelector();
        }
    });

    // Scroll to Top Button
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.innerWidth <= 768) {
                if (window.scrollY > 200) {
                    scrollToTopBtn.style.display = 'flex';
                    scrollToTopBtn.style.opacity = '1';
                } else {
                    scrollToTopBtn.style.opacity = '0';
                    setTimeout(() => {
                        scrollToTopBtn.style.display = 'none';
                    }, 300);
                }
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });
        if (window.innerWidth > 768) {
            scrollToTopBtn.style.display = 'none';
        } else {
            window.dispatchEvent(new Event('scroll'));
        }
        scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); logDebug('UI: Scrolled to top.'); });
    }

    // Hamburger Menu and Sidebar Interactions
    if (hamburgerBtn && appSidebar && closeMenuBtn && sidebarOverlay) {
        logDebug('Sidebar Setup: Initializing sidebar event listeners. Elements found:', {
            hamburgerBtn: !!hamburgerBtn,
            appSidebar: !!appSidebar,
            closeMenuBtn: !!closeMenuBtn,
            sidebarOverlay: !!sidebarOverlay
        });
        
        // Ensure initial state is correct: always start CLOSED after reload
        if (window.innerWidth > 768) {
            document.body.classList.remove('sidebar-active'); // Do not shift body on load
            sidebarOverlay.style.pointerEvents = 'none'; // Overlay non-interactive on desktop when closed
            appSidebar.classList.remove('open'); // Start closed on desktop too
            logDebug('Sidebar: Desktop: Sidebar initialized as closed.');
        } else {
            document.body.classList.remove('sidebar-active'); // No shift on mobile
            sidebarOverlay.style.pointerEvents = 'auto'; // Overlay interactive on mobile
            appSidebar.classList.remove('open'); // Sidebar closed by default on mobile
            logDebug('Sidebar: Mobile: Sidebar initialized as closed.');
        }


        hamburgerBtn.addEventListener('click', (event) => {
            logDebug('UI: Hamburger button CLICKED. Event:', event);
            event.stopPropagation(); // Stop click from propagating to body/window and closing immediately
            toggleAppSidebar(); // This should correctly open/close based on current state
        });
        closeMenuBtn.addEventListener('click', () => {
            logDebug('UI: Close Menu button CLICKED.');
            toggleAppSidebar(false);
        });
        
        // Corrected sidebar overlay dismissal logic for mobile
        sidebarOverlay.addEventListener('click', (event) => {
            logDebug('Sidebar Overlay: Clicked overlay. Attempting to close sidebar.');
            // Ensure the click is actually on the overlay and not bubbling from inside the sidebar
            if (appSidebar.classList.contains('open') && event.target === sidebarOverlay) {
                toggleAppSidebar(false);
            }
        });

        document.addEventListener('click', (event) => {
            const isDesktop = window.innerWidth > 768;
            // Only close sidebar on clicks outside if it's desktop and the click isn't on the sidebar or hamburger button
            if (appSidebar.classList.contains('open') && isDesktop &&
                !appSidebar.contains(event.target) && !hamburgerBtn.contains(event.target)) {
                logDebug('Global Click: Clicked outside sidebar on desktop. Closing sidebar.');
                toggleAppSidebar(false);
            }
            // For mobile, the sidebarOverlay handles clicks outside, and its pointer-events are managed.
            // No additional document click listener needed for mobile sidebar dismissal.
        });

        window.addEventListener('resize', () => {
            logDebug('Window Resize: Resizing window. Closing sidebar if open.');
            const isDesktop = window.innerWidth > 768;
            if (appSidebar.classList.contains('open')) {
                toggleAppSidebar(false);
            }
            if (scrollToTopBtn) {
                if (window.innerWidth > 768) {
                    scrollToTopBtn.style.display = 'none';
                } else {
                    window.dispatchEvent(new Event('scroll'));
                }
            }
            // NEW: Recalculate header height on resize
            adjustMainContentPadding();

            // NEW: Update the compact view button state on resize
            updateCompactViewButtonState();
        });

        const menuButtons = appSidebar.querySelectorAll('.menu-button-item');
        menuButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const clickedButton = event.currentTarget;
                logDebug('Sidebar Menu Item Click: Button \'' + clickedButton.textContent.trim() + '\' clicked.');

                // Handle specific action for the toggle compact view button
                if (clickedButton.id === 'toggleCompactViewBtn') {
                    toggleMobileViewMode();
                }

                const closesMenu = clickedButton.dataset.actionClosesMenu !== 'false';
                if (closesMenu) {
                    toggleAppSidebar(false);
                }
            });
        });
    } else {
        console.warn('Sidebar Setup: Missing one or more sidebar elements (hamburgerBtn, appSidebar, closeMenuBtn, sidebarOverlay). Sidebar functionality might be impaired.');
    }

    // Export Watchlist Button Event Listener
    if (exportWatchlistBtn) {
        exportWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Export Watchlist button clicked.');
            exportWatchlistToCSV();
            toggleAppSidebar(false);
        });
    }

    // Refresh Live Prices Button Event Listener
    if (refreshLivePricesBtn) {
        refreshLivePricesBtn.addEventListener('click', () => {
            logDebug('UI: Refresh Live Prices button clicked.');
            fetchLivePrices();
            showCustomAlert('Refreshing live prices...', 1000);
            toggleAppSidebar(false); // NEW: Close sidebar on refresh
        });
    }

    // NEW: Search Stock Button Listener
    if (searchStockBtn) {
        searchStockBtn.addEventListener('click', () => {
            logDebug('UI: Search Stock button clicked. Opening search modal.');
            // Clear and reset the modal content when opening
            asxSearchInput.value = '';
            searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>';
            searchModalActionButtons.innerHTML = '';
            asxSuggestions.classList.remove('active');
            currentSelectedSuggestionIndex = -1;
            currentSearchShareData = null;
            showModal(stockSearchModal);
            asxSearchInput.focus();
            toggleAppSidebar(false); // Close sidebar
        });
    }
    
    // Removed: Show Last Live Price toggle listener (automatic behavior now)

    // NEW: Cash Asset Form Modal Save/Delete/Edit Buttons (2.1, 2.2)
    if (saveCashAssetBtn) {
        saveCashAssetBtn.addEventListener('click', async () => {
            logDebug('Cash Form: Save Cash Asset button clicked.');
            if (saveCashAssetBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Asset name and balance are required, or no changes made.');
                console.warn('Save Cash Asset: Save button was disabled, preventing action.');
                return;
            }
            await saveCashAsset(false); // Not silent save
        });
    }

    if (deleteCashAssetBtn) {
        deleteCashAssetBtn.addEventListener('click', async () => {
            logDebug('Cash Form: Delete Cash Asset button clicked.');
            if (deleteCashAssetBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Cash Asset: Delete button was disabled, preventing action.');
                return;
            }
            if (selectedCashAssetDocId) {
                await deleteCashCategory(selectedCashAssetDocId); // Use existing delete function
                closeModals();
            } else {
                showCustomAlert('No cash asset selected for deletion.');
            }
        });
    }

    if (editCashAssetFromDetailBtn) {
        editCashAssetFromDetailBtn.addEventListener('click', () => {
            logDebug('Cash Details: Edit Cash Asset button clicked.');
            if (selectedCashAssetDocId) {
                hideModal(cashAssetDetailModal);
                showAddEditCashCategoryModal(selectedCashAssetDocId);
            } else {
                showCustomAlert('No cash asset selected for editing.');
            }
        });
    }

    if (deleteCashAssetFromDetailBtn) {
        deleteCashAssetFromDetailBtn.addEventListener('click', async () => {
            logDebug('Cash Details: Delete Cash Asset button clicked.');
            if (selectedCashAssetDocId) {
                await deleteCashCategory(selectedCashAssetDocId);
                closeModals();
            } else {
                showCustomAlert('No cash asset selected for deletion.');
            }
        });
    }


    // Call adjustMainContentPadding initially and on window load/resize
    // Removed: window.addEventListener('load', adjustMainContentPadding); // Removed, handled by onAuthStateChanged
    // Already added to window.addEventListener('resize') in sidebar section

    // NEW: Set initial state for the compact view button
    updateCompactViewButtonState();
} 
// This closing brace correctly ends the `initializeAppLogic` function here.

// Function to show the target hit details modal (moved to global scope)
function showTargetHitDetailsModal() {
    if (!targetHitDetailsModal || !targetHitSharesList || !sharesAtTargetPrice) {
        console.error('Target Hit Modal: Required elements or data not found.');
        showCustomAlert('Error displaying target hit details. Please try again.', 2000);
        return;
    }
    targetHitSharesList.innerHTML = ''; // Clear previous content

    const makeItem = (share, isMuted) => {
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const currentLivePrice = (livePriceData && livePriceData.live !== null && !isNaN(livePriceData.live)) ? livePriceData.live : null;
        const targetPrice = share.targetPrice;
        const priceClass = (currentLivePrice !== null && targetPrice != null && !isNaN(targetPrice) && currentLivePrice >= targetPrice) ? 'positive' : 'negative';
        const item = document.createElement('div');
        item.classList.add('target-hit-item');
        if (isMuted) item.classList.add('muted');
        item.dataset.shareId = share.id;
        item.innerHTML = `
            <div class="target-hit-item-grid">
                <div class="col-left">
                    <span class="share-name-code ${priceClass}">${share.shareName}</span>
                    <span class="target-price-line">Target: <strong>$${(targetPrice !== null && !isNaN(targetPrice)) ? formatAdaptivePrice(Number(targetPrice)) : 'N/A'}</strong></span>
                </div>
                <div class="col-right">
                    <span class="live-price-display ${priceClass}">${currentLivePrice !== null ? ('$' + formatAdaptivePrice(currentLivePrice)) : ''}</span>
                    <button class="toggle-alert-btn tiny-toggle" data-share-id="${share.id}" title="${isMuted ? 'Unmute Alert' : 'Mute Alert'}">${isMuted ? 'Unmute' : 'Mute'}</button>
                </div>
            </div>
        `;
        // Click to open share details
        item.addEventListener('click', (e) => {
            // If the click is on the toggle button, don't navigate
            if (e.target && e.target.classList && e.target.classList.contains('toggle-alert-btn')) return;
            const sid = item.dataset.shareId;
            if (sid) {
                wasShareDetailOpenedFromTargetAlerts = true;
                hideModal(targetHitDetailsModal);
                selectShare(sid);
                showShareDetails();
            }
        });
        // Mute/unmute button
        const toggleBtn = item.querySelector('.toggle-alert-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    // Optimistic: move item to other section immediately
                    const enabledAfter = await toggleAlertEnabled(share.id);
                    // enabledAfter === true means now active (unmuted)
                    // Rebuild lists optimistically using current arrays then let listener correct if needed
                    if (enabledAfter) {
                        // Move from muted to active
                        sharesAtTargetPrice = dedupeSharesById([...sharesAtTargetPrice, share]);
                        sharesAtTargetPriceMuted = sharesAtTargetPriceMuted.filter(s => s.id !== share.id);
                    } else {
                        sharesAtTargetPriceMuted = dedupeSharesById([...sharesAtTargetPriceMuted, share]);
                        sharesAtTargetPrice = sharesAtTargetPrice.filter(s => s.id !== share.id);
                    }
                    // Re-render minimal (avoid flicker)
                    showTargetHitDetailsModal();
                } catch(err) {
                    console.warn('Toggle alert failed', err);
                }
            });
        }
        return item;
    };

    const hasEnabled = sharesAtTargetPrice.length > 0;
    const hasMuted = Array.isArray(sharesAtTargetPriceMuted) && sharesAtTargetPriceMuted.length > 0;
    if (!hasEnabled && !hasMuted) {
        targetHitSharesList.innerHTML = '<p class="no-alerts-message">No shares currently at target price.</p>';
    } else {
        if (hasEnabled) {
            const enabledHeader = document.createElement('h3');
            enabledHeader.textContent = 'Active Alerts';
            targetHitSharesList.appendChild(enabledHeader);
            sharesAtTargetPrice.forEach(share => targetHitSharesList.appendChild(makeItem(share, false)));
        }
        if (hasMuted) {
            const mutedHeader = document.createElement('h3');
            mutedHeader.textContent = 'Muted Alerts';
            targetHitSharesList.appendChild(mutedHeader);
            sharesAtTargetPriceMuted.forEach(share => targetHitSharesList.appendChild(makeItem(share, true)));
        }
    }

    showModal(targetHitDetailsModal);
    logDebug('Target Hit Modal: Displayed details for ' + sharesAtTargetPrice.length + ' shares.');
}

// NEW: Target hit icon button listener (opens the modal) - moved to global scope
if (targetHitIconBtn) {
    targetHitIconBtn.addEventListener('click', (event) => {
        logDebug('Target Alert: Icon button clicked. Opening details modal.');
        showTargetHitDetailsModal();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    logDebug('script.js DOMContentLoaded fired.');

    // Ensure header interactive bindings are attached even on first load
    try { ensureTitleStructure(); bindHeaderInteractiveElements(); } catch(e) { console.warn('Header binding: failed to bind on DOMContentLoaded', e); }
    // Early notification restore from persisted count
    try { if (typeof updateTargetHitBanner === 'function') updateTargetHitBanner(); } catch(e) { console.warn('Early Target Alert restore failed', e); }

    // Ensure Edit Current Watchlist button updates when watchlist selection changes
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', function() {
            updateMainButtonsState(true);
            try { updateMainTitle(); } catch(e) {}
        });
    }
    // NEW: Initialize splash screen related flags
    window._firebaseInitialized = false;
    window._userAuthenticated = false;
    window._appDataLoaded = false;
    window._livePricesLoaded = false;

    // Show splash screen immediately on DOMContentLoaded
    if (splashScreen) {
        splashScreen.style.display = 'flex'; // Ensure it's visible
        splashScreen.classList.remove('hidden'); // Ensure it's not hidden
        splashScreenReady = true; // Mark splash screen as ready
        document.body.style.overflow = 'hidden'; // Prevent scrolling of underlying content
        logDebug('Splash Screen: Displayed on DOMContentLoaded, body overflow hidden.');
        // If we are returning from a redirect attempt, keep the button in loading state while we complete sign-in
        try {
            if (localStorage.getItem('authRedirectAttempted') === '1' && typeof updateSplashSignInButtonState === 'function') {
                updateSplashSignInButtonState('loading', 'Completing sign-in…');
            }
        } catch(_) {}
    } else {
        console.warn('Splash Screen: Splash screen element not found. App will start without it.');
        // If splash screen not found, set flags to true and hide the splash screen logic.
        // This is a fallback to allow the app to run without the splash screen HTML.
        window._firebaseInitialized = true;
        window._userAuthenticated = false;
        window._appDataLoaded = true;
        window._livePricesLoaded = true;
    } // This closing brace completes the 'else' block for the splash screen check.

    // Initially hide main app content and header
    if (mainContainer) {
        mainContainer.classList.add('app-hidden');
    }
    if (appHeader) {
        appHeader.classList.add('app-hidden');
    }

    if (window.firestoreDb && window.firebaseAuth && window.getFirebaseAppId && window.firestore && window.authFunctions) {
        db = window.firestoreDb;
        auth = window.firebaseAuth;
        currentAppId = window.getFirebaseAppId();
        window._firebaseInitialized = true; // Mark Firebase as initialized
        logDebug('Firebase Ready: DB, Auth, and AppId assigned from window. Setting up auth state listener.');

        // Ensure persistence is set once
        try {
            if (window.authFunctions.setPersistence) {
                const ua = navigator.userAgent || navigator.vendor || '';
                const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
                const targetPersistence = isMobile && window.authFunctions.browserSessionPersistence
                    ? window.authFunctions.browserSessionPersistence
                    : window.authFunctions.browserLocalPersistence;
                if (targetPersistence) {
                    window.authFunctions
                        .setPersistence(auth, targetPersistence)
                        .then(() => logDebug('Auth: Persistence set to ' + (targetPersistence === window.authFunctions.browserSessionPersistence ? 'browserSessionPersistence' : 'browserLocalPersistence') + '.'))
                        .catch((e) => console.warn('Auth: Failed to set persistence, continuing with default.', e));
                }
            }
        } catch (e) {
            console.warn('Auth: Failed to set persistence (outer), continuing with default.', e);
        }

    window.authFunctions.onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                logDebug('AuthState: User signed in: ' + user.uid);
                logDebug('AuthState: User email: ' + user.email);
                try { localStorage.removeItem('authRedirectAttempted'); localStorage.removeItem('authRedirectReturnedNoUser'); } catch(_) {}
                // Use dynamic update instead of hard-coded label so it reflects current selection
                updateMainTitle();
                logDebug('AuthState: Dynamic title initialized via updateMainTitle().');
                updateMainButtonsState(true);
                window._userAuthenticated = true; // Mark user as authenticated

                if (mainContainer) {
                    mainContainer.classList.remove('app-hidden');
                }
                if (appHeader) {
                    appHeader.classList.remove('app-hidden');
                }
                adjustMainContentPadding();

                        // Ensure header click bindings are attached after header becomes visible
                        try { ensureTitleStructure(); bindHeaderInteractiveElements(); } catch(e) { console.warn('Header binding: failed to bind after auth show', e); }

                if (splashKangarooIcon) {
                    splashKangarooIcon.classList.add('pulsing');
                    logDebug('Splash Screen: Started pulsing animation after sign-in.');
                }

                targetHitIconDismissed = localStorage.getItem('targetHitIconDismissed') === 'true';
                // Immediately reflect any persisted target count before live data loads
                try { updateTargetHitBanner(); } catch(e) { console.warn('Auth early Target Alert restore failed', e); }

                // Load user data, then do an initial fetch of live prices before setting the update interval.
                // This ensures the initial view is correctly sorted by percentage change if selected.
                await loadUserWatchlistsAndSettings();
                try { ensureTitleStructure(); } catch(e) {}
                // Start alerts listener (triggered alerts -> Notification Hub)
                await loadTriggeredAlertsListener();
                // On first auth load, force one live fetch even if starting in Cash view to restore alerts
                const forcedOnce = localStorage.getItem('forcedLiveFetchOnce') === 'true';
                await fetchLivePrices({ forceLiveFetch: !forcedOnce, cacheBust: true });
                try { if (!forcedOnce) localStorage.setItem('forcedLiveFetchOnce','true'); } catch(e) {}
                startLivePriceUpdates();

                allAsxCodes = await loadAsxCodesFromCSV();
                logDebug(`ASX Autocomplete: Loaded ${allAsxCodes.length} codes for search.`);
                // After essential data loaded, restore last view (portfolio or watchlist) unless user already interacted
                try {
                    const lastView = localStorage.getItem('lastSelectedView');
                    if (lastView === 'portfolio') {
                        showPortfolioView();
                    } else if (lastView && lastView !== 'portfolio' && typeof watchlistSelect !== 'undefined' && watchlistSelect) {
                        // Attempt to set dropdown so renderWatchlist picks correct list
                        const opt = Array.from(watchlistSelect.options).find(o => o.value === lastView);
                        if (opt) {
                            watchlistSelect.value = lastView;
                            // Ensure internal selection array updated (mimic change)
                            currentSelectedWatchlistIds = [lastView];
                            renderWatchlist();
                            // Ensure the header reflects the restored selection
                            try { updateMainTitle(); } catch(e) {}
                        } else {
                            // Fallback: default to All Shares if stored view isn't present
                            watchlistSelect.value = ALL_SHARES_ID;
                            currentSelectedWatchlistIds = [ALL_SHARES_ID];
                            renderWatchlist();
                            try { updateMainTitle(); } catch(e) {}
                        }
                    }
                } catch(e) {}
            }

            else {
                currentUserId = null;
                // Reset title safely using the inner span, do not expand click target
                try { ensureTitleStructure(); const t = document.getElementById('dynamicWatchlistTitleText'); if (t) t.textContent = 'Share Watchlist'; } catch(e) {}
                logDebug('AuthState: User signed out.');
                updateMainButtonsState(false);
                clearShareList();
                clearWatchlistUI();
                userCashCategories = []; // Clear cash data on logout
                if (cashCategoriesContainer) cashCategoriesContainer.innerHTML = ''; // Clear cash UI
                if (totalCashDisplay) totalCashDisplay.textContent = '$0.00'; // Reset total cash
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                applyTheme('system-default');
                if (unsubscribeShares) {
                    unsubscribeShares();
                    unsubscribeShares = null;
                    logDebug('Firestore Listener: Unsubscribed from shares listener on logout.');
                }
                if (unsubscribeCashCategories) { // NEW: Unsubscribe from cash categories
                    unsubscribeCashCategories();
                    unsubscribeCashCategories = null;
                    logDebug('Firestore Listener: Unsubscribed from cash categories listener on logout.');
                }
                if (unsubscribeAlerts) { // NEW: Unsubscribe from alerts
                    try { unsubscribeAlerts(); } catch(_) {}
                    unsubscribeAlerts = null;
                    logDebug('Firestore Listener: Unsubscribed from alerts listener on logout.');
                }
                stopLivePriceUpdates();
                
                window._userAuthenticated = false; // Mark user as not authenticated
                // If signed out, ensure splash screen is visible for sign-in
                if (splashScreen) {
                    splashScreen.style.display = 'flex'; // Ensure splash screen is visible
                    splashScreen.classList.remove('hidden'); // Ensure it's not hidden
                    document.body.style.overflow = 'hidden'; // Re-apply overflow hidden
                    if (splashKangarooIcon) {
                        splashKangarooIcon.classList.remove('pulsing'); // Stop animation if signed out
                    }
                    if (splashSignInBtn) {
                        splashSignInBtn.disabled = false; // Enable sign-in button
                        const buttonTextSpan = splashSignInBtn.querySelector('span');
                        if (buttonTextSpan) {
                            buttonTextSpan.textContent = 'Sign in with Google'; // Reset only the text, not the icon
                        }
                    }
                    // Hide main app content
                    if (mainContainer) {
                        mainContainer.classList.add('app-hidden');
                    }
                    if (appHeader) {
                        appHeader.classList.add('app-hidden');
                    }
                    logDebug('Splash Screen: User signed out, splash screen remains visible for sign-in.');
                } else {
                    console.warn('Splash Screen: User signed out, but splash screen element not found. App content might be visible.');
                }
                // NEW: Reset targetHitIconDismissed and clear localStorage entry on logout for a fresh start on next login
                targetHitIconDismissed = false; 
                localStorage.removeItem('targetHitIconDismissed');

            }
            if (!window._appLogicInitialized) {
                initializeAppLogic();
                window._appLogicInitialized = true;
            } else {
                // If app logic already initialized, ensure view mode is applied after auth.
                // This handles cases where user signs out and then signs back in,
                // and we need to re-apply the correct mobile view class.
                if (currentMobileViewMode === 'compact' && mobileShareCardsContainer) {
                    mobileShareCardsContainer.classList.add('compact-view');
                } else if (mobileShareCardsContainer) {
                    mobileShareCardsContainer.classList.remove('compact-view');
                }
            }
            // Call renderWatchlist here to ensure correct mobile card rendering after auth state is set
            renderWatchlist();
            try { ensureTitleStructure(); } catch(e) {}
            // Removed: adjustMainContentPadding(); // Removed duplicate call, now handled inside if (user) block
        });
    } else {
        console.error('Firebase: Firebase objects (db, auth, appId, firestore, authFunctions) are not available on DOMContentLoaded. Firebase initialization likely failed in index.html.');
        const errorDiv = document.getElementById('firebaseInitError');
        if (errorDiv) {
                errorDiv.style.display = 'block';
        }
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default');
        // NEW: Call adjustMainContentPadding even if Firebase fails, to ensure some basic layout
        adjustMainContentPadding();
        // NEW: Hide splash screen if Firebase fails to initialize
        hideSplashScreen();
    }
});