import { getAllSharesData, getLivePrices } from './state.js';
import { formatMoney, formatPercent, formatAdaptivePrice } from '../utils.js';

// Inject styles dynamically
function injectSnapshotStyles() {
    if (document.getElementById('snapshot-styles')) return;

    const style = document.createElement('style');
    style.id = 'snapshot-styles';
    style.textContent = `
        .snapshot-grid {
            display: grid;
            /* Reduced min-width to allow 3 columns on typical mobile screens (approx 360px+) */
            grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
            gap: 6px;
            padding: 10px;
            width: 100%;
            box-sizing: border-box;
        }

        .snapshot-card {
            background: var(--card-bg);
            border-radius: 8px;
            padding: 8px; /* Slightly reduced padding */
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 70px; /* Reduced min-height */
            border-left: 5px solid var(--accent-color, #ccc); /* Slightly thinner border */
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .snapshot-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .snapshot-card.gain {
            border-left-color: var(--positive, #06FF4F);
        }

        .snapshot-card.loss {
            border-left-color: var(--negative, #FF3131);
        }

        .snapshot-code {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--text-color);
            margin-bottom: 0;
            line-height: 1.1;
        }

        .snapshot-price {
            font-size: 1.25rem; /* Adjusted for 3-col layout */
            font-weight: 800;
            margin: 0 0 1px 0; /* Tighter spacing */
            color: var(--text-color);
            line-height: 1.1;
        }

        .snapshot-change-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.75rem; /* Adjusted for 3-col layout */
            font-weight: 600;
            margin-top: 0; /* Removed top margin to bring closer to price */
        }

        .snapshot-change.gain { color: var(--positive, #06FF4F); }
        .snapshot-change.loss { color: var(--negative, #FF3131); }

        /* Ensure container takes full width/height as needed */
        #snapshot-view-container {
            width: 100%;
            min-height: 80vh;
            background: var(--bg-color);
        }
        
        /* Mobile tweak to ensure 3 columns fit on smaller devices if needed */
        @media (max-width: 360px) {
            .snapshot-grid {
                grid-template-columns: repeat(3, 1fr);
                gap: 4px;
                padding: 8px;
            }
            .snapshot-code { font-size: 0.85rem; }
            .snapshot-price { font-size: 1.1rem; }
            .snapshot-change-row { font-size: 0.7rem; }
        }
    `;
    document.head.appendChild(style);
}

// Main Render Logic
function renderSnapshotView() {
    // 1. Container Setup
    let container = document.getElementById('snapshot-view-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'snapshot-view-container';
        const main = document.querySelector('main') || document.body;
        main.appendChild(container);
    }

    // 2. Hide other sections
    const sectionsToHide = ['#stockWatchlistSection', '#portfolioSection', '#cashAssetsSection'];
    sectionsToHide.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
    });

    // Show snapshot container
    container.style.display = 'block';
    container.innerHTML = '<div class="snapshot-grid"></div>';
    const grid = container.querySelector('.snapshot-grid');

    // 3. Get Data
    const allShares = getAllSharesData() || [];
    const prices = getLivePrices() || {};

    // Filter for 'portfolio' watchlist
    const portfolioShares = allShares.filter(share => {
        if (share.watchlistId === 'portfolio') return true;
        if (Array.isArray(share.watchlistIds) && share.watchlistIds.includes('portfolio')) return true;
        return false;
    });

    // 4. Sort Alphabetically (A-Z)
    portfolioShares.sort((a, b) => {
        const nameA = (a.shareName || '').toUpperCase();
        const nameB = (b.shareName || '').toUpperCase();
        return nameA.localeCompare(nameB);
    });

    // 5. Render Cards
    portfolioShares.forEach(share => {
        const code = share.shareName || '???';
        const priceData = prices[code] || {};

        // Price Logic
        const currentPrice = priceData.live !== undefined ? priceData.live : (priceData.lastLivePrice || 0);

        // Change Logic
        const prevClose = priceData.prevClose !== undefined ? priceData.prevClose : (priceData.lastPrevClose || 0);
        let changeAmt = 0;
        let changePct = 0;

        if (currentPrice > 0 && prevClose > 0) {
            changeAmt = currentPrice - prevClose;
            changePct = (changeAmt / prevClose) * 100;
        }

        // Formatting
        const priceStr = formatAdaptivePrice(currentPrice);
        const changeAmtStr = (changeAmt > 0 ? '+' : '') + formatAdaptivePrice(changeAmt);
        const changePctStr = (changePct > 0 ? '+' : '') + formatPercent(changePct);

        // Styling Classes
        let statusClass = '';
        if (changeAmt > 0) statusClass = 'gain';
        else if (changeAmt < 0) statusClass = 'loss';

        // Build Card
        const card = document.createElement('div');
        card.className = `snapshot-card ${statusClass}`;
        card.innerHTML = `
            <div class="snapshot-code">${code}</div>
            <div class="snapshot-price">$${priceStr}</div>
            <div class="snapshot-change-row">
                <span class="snapshot-change ${statusClass}">${changeAmtStr}</span>
                <span class="snapshot-change ${statusClass}">${changePctStr}</span>
            </div>
        `;

        // Add Click Handler
        card.addEventListener('click', () => {
            console.log('[Snapshot] Card clicked:', share.id);
            if (typeof selectShare === 'function') {
                console.log('[Snapshot] calling selectShare');
                selectShare(share.id);
                if (typeof showShareDetails === 'function') {
                    console.log('[Snapshot] calling showShareDetails');
                    showShareDetails();
                } else {
                    console.warn('[Snapshot] showShareDetails not found');
                }
            } else {
                console.warn('[Snapshot] selectShare not found');
            }
        });

        grid.appendChild(card);
    });
}
// Expose for external updates (e.g. live prices)
window.renderSnapshotView = renderSnapshotView;

// Sort Button Management
let sortObserver = null;
let isInternalSortUpdate = false;

function updateSortButtonForSnapshot() {
    isInternalSortUpdate = true;
    const iconEl = document.getElementById('sortIcon');
    const labelSpan = document.getElementById('sortPickerLabel');

    if (iconEl) {
        // Use ASX icon
        iconEl.innerHTML = `<svg class="sort-asx-icon" width="20" height="20" viewBox="0 0 24 24" role="img" aria-label="ASX" xmlns="http://www.w3.org/2000/svg"><text x="12" y="16" font-family="Inter, Arial, Helvetica, sans-serif" font-size="9" fill="currentColor" text-anchor="middle" font-weight="700">ASX</text></svg>`;
        iconEl.style.color = 'inherit';
    }

    if (labelSpan) {
        labelSpan.textContent = 'ASX Code';
        // Remove existing triangle if any
        const existingTri = labelSpan.querySelector('.sort-title-triangle');
        if (existingTri) existingTri.remove();

        const triSpan = document.createElement('span');
        triSpan.className = 'sort-title-triangle desc'; // Green up arrow
        triSpan.textContent = '\u25B2';
        labelSpan.appendChild(triSpan);
    }

    // Re-enable flag after a tick
    setTimeout(() => { isInternalSortUpdate = false; }, 0);
}

function restoreSortButton() {
    if (window.updateSortPickerButtonText) {
        window.updateSortPickerButtonText();
    }
}

function setupSortObserver() {
    if (sortObserver) return; // Already observing

    const target = document.getElementById('sortPickerBtn');
    if (!target) return;

    sortObserver = new MutationObserver((mutations) => {
        if (isInternalSortUpdate) return;

        // If we detect a change that wasn't us, it means the app updated the sort
        // likely due to user selection. We should exit Snapshot View.
        const container = document.getElementById('snapshot-view-container');
        if (container && container.style.display === 'block') {
            window.toggleSnapshotView(false);
        }
    });

    // Observe subtree because the text is in a span inside the button
    sortObserver.observe(target, { childList: true, subtree: true, characterData: true });
}

function disconnectSortObserver() {
    if (sortObserver) {
        sortObserver.disconnect();
        sortObserver = null;
    }
}

// Global Toggle Function
window.toggleSnapshotView = function (show) {
    injectSnapshotStyles();

    // If show is undefined, toggle based on current state
    const container = document.getElementById('snapshot-view-container');
    const isCurrentlyShown = container && container.style.display === 'block';
    const shouldShow = show !== undefined ? show : !isCurrentlyShown;

    if (shouldShow) {
        renderSnapshotView();
        updateSortButtonForSnapshot();
        setupSortObserver();
    } else {
        if (container) container.style.display = 'none';

        // Restore other sections
        // Restore other sections INTELLIGENTLY based on current context
        const currentIds = (typeof getCurrentSelectedWatchlistIds === 'function')
            ? getCurrentSelectedWatchlistIds()
            : (window.currentSelectedWatchlistIds || []);

        const isPortfolio = currentIds.includes('portfolio');
        // Use global constant or fallback to known ID 'cashBank'
        const CASH_BANK_ID = (typeof CASH_BANK_WATCHLIST_ID !== 'undefined') ? CASH_BANK_WATCHLIST_ID : 'cashBank';
        const isCash = currentIds.includes(CASH_BANK_ID);

        // Always restore stock watchlist section unless it's portfolio or cash
        const stockSection = document.querySelector('#stockWatchlistSection');
        if (stockSection) stockSection.style.display = (!isPortfolio && !isCash) ? '' : 'none';

        // Only restore portfolio section if we are actually IN portfolio mode
        const portfolioSection = document.querySelector('#portfolioSection');
        if (portfolioSection) portfolioSection.style.display = (isPortfolio) ? '' : 'none';

        // Only restore cash section if we are IN cash mode
        const cashSection = document.querySelector('#cashAssetsSection');
        if (cashSection) cashSection.style.display = (isCash) ? '' : 'none';

        disconnectSortObserver();
        restoreSortButton();
    }

    // Update Button Text
    const btnText = document.getElementById('snapshotViewBtnText');
    if (btnText) {
        btnText.textContent = shouldShow ? 'Default View' : 'Snapshot View';
    }

    // Update Button Icon
    const btnIcon = document.querySelector('#snapshotViewBtn i');
    if (btnIcon) {
        btnIcon.className = shouldShow ? 'fas fa-list' : 'fas fa-camera';
    }
};

// Initialize Button Listener (Event Delegation for robustness)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#snapshotViewBtn');
    if (btn) {
        e.preventDefault(); // Prevent any default behavior
        window.toggleSnapshotView();

        // Close sidebar if open (mimic app behavior)
        const sidebar = document.getElementById('appSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('open');
        }
    }
});

// View Manager & Persistence
// View Manager Logic - DEPRECATED/DISABLED to avoid conflict with script.js centralized logic
// The logic for switching views is now handled in script.js via watchlistSelect listeners and setMobileViewMode.

/*
function initializeViewManager() {
    const SNAPSHOT_BTN_ID = 'snapshotViewBtn';
    const COMPACT_BTN_ID = 'toggleCompactViewBtn';
    const SNAPSHOT_PREF_KEY = 'asx_view_pref_portfolio';
    const GENERAL_PREF_KEY = 'asx_view_pref_general';

    let lastContext = null; // 'portfolio' or 'general'

    // Helper to get current context
    function getContext() {
        try {
            // Use the exported function if available, or fallback to global
            const ids = (typeof getCurrentSelectedWatchlistIds === 'function')
                ? getCurrentSelectedWatchlistIds()
                : (window.currentSelectedWatchlistIds || []);

            if (Array.isArray(ids) && ids.includes('portfolio')) return 'portfolio';
            return 'general';
        } catch (e) {
            return 'general';
        }
    }

    // Helper to save state
    function saveState(context, mode) {
        const key = context === 'portfolio' ? SNAPSHOT_PREF_KEY : GENERAL_PREF_KEY;
        localStorage.setItem(key, mode);
    }

    // Helper to load state
    function loadState(context) {
        const key = context === 'portfolio' ? SNAPSHOT_PREF_KEY : GENERAL_PREF_KEY;
        return localStorage.getItem(key) || 'default';
    }

    // Helper to check if Compact View is active
    function isCompactViewActive() {
        // Heuristic: check if body or main table has 'compact-view' class
        // Since we couldn't find the exact class, we'll try to infer from the button text or icon if possible,
        // OR just assume 'default' if we can't tell. 
        // BETTER: Let's assume the button toggles a class on document.body called 'compact-mode' or similar.
        // If we can't find it, we might rely on our own internal tracking if we start from a known state.
        // For now, let's try to detect 'compact' class on body.
        return document.body.classList.contains('compact-view') || document.body.classList.contains('compact-mode');
    }

    // Helper to apply view mode
    function applyViewMode(mode) {
        const snapshotActive = document.getElementById('snapshot-view-container')?.style.display === 'block';

        if (mode === 'snapshot') {
            if (!snapshotActive) window.toggleSnapshotView(true);
        } else if (mode === 'compact') {
            if (snapshotActive) window.toggleSnapshotView(false);
            // Toggle Compact On if not already
            if (!isCompactViewActive()) {
                const btn = document.getElementById(COMPACT_BTN_ID);
                if (btn) btn.click();
            }
        } else { // default
            if (snapshotActive) window.toggleSnapshotView(false);
            // Toggle Compact Off if active
            if (isCompactViewActive()) {
                const btn = document.getElementById(COMPACT_BTN_ID);
                if (btn) btn.click();
            }
        }
    }

    // Update UI based on context
    function updateUI() {
        const context = getContext();
        const snapBtn = document.getElementById(SNAPSHOT_BTN_ID);
        const compactBtn = document.getElementById(COMPACT_BTN_ID);

        // 1. Manage Button Visibility
        if (context === 'portfolio') {
            if (snapBtn) snapBtn.style.display = ''; // Show Snapshot
            if (compactBtn) compactBtn.style.display = 'none'; // Hide Compact (exclusive)
        } else {
            if (snapBtn) snapBtn.style.display = 'none'; // Hide Snapshot
            if (compactBtn) compactBtn.style.display = ''; // Show Compact
        }

        // 2. Handle Context Switch Persistence
        if (context !== lastContext) {
            // If we are LEAVING portfolio context, force close snapshot view
            if (lastContext === 'portfolio' && context !== 'portfolio') {
                window.toggleSnapshotView(false);
            }

            const savedMode = loadState(context);
            // Enforce valid modes per context
            let targetMode = savedMode;
            if (context === 'portfolio' && targetMode === 'compact') targetMode = 'default'; // Portfolio doesn't support compact in this model
            if (context === 'general' && targetMode === 'snapshot') targetMode = 'default'; // General doesn't support snapshot

            applyViewMode(targetMode);
            lastContext = context;
        }
    }

    // Hook into Button Clicks to Save State
    document.addEventListener('click', (e) => {
        const snapBtn = e.target.closest(`#${SNAPSHOT_BTN_ID}`);
        const compactBtn = e.target.closest(`#${COMPACT_BTN_ID}`);

        if (snapBtn) {
            // Toggled Snapshot
            // Wait a tick for toggle to happen
            setTimeout(() => {
                const active = document.getElementById('snapshot-view-container')?.style.display === 'block';
                saveState('portfolio', active ? 'snapshot' : 'default');
            }, 50);
        }

        if (compactBtn) {
            // Toggled Compact
            // Wait a tick
            setTimeout(() => {
                const active = isCompactViewActive(); // We hope this detection works
                // If we are in general context, save it
                if (getContext() === 'general') {
                    saveState('general', active ? 'compact' : 'default');
                }
            }, 50);
        }
    });

    // Poll for context changes (Watchlist switching)
    setInterval(updateUI, 200);

    // Initial run
    updateUI();
}
*/

// Auto-inject styles on load just in case
injectSnapshotStyles();
// No longer auto-initializing view manager.
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initializeViewManager);
// } else {
//     initializeViewManager();
// }
