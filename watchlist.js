// --- WATCHLIST MODULE ---
// Handles watchlist dropdowns, rendering, and management

// Exported variables and functions
export let userWatchlists = [];
export let currentSelectedWatchlistIds = [];
export const ALL_SHARES_ID = 'all_shares_option';
export let watchlistSelect = document.getElementById('watchlistSelect');

// Helper: Render the main watchlist dropdown
export function renderWatchlistSelect() {
    if (!watchlistSelect) {
        watchlistSelect = document.getElementById('watchlistSelect');
        if (!watchlistSelect) return;
    }
    // Clear existing options
    watchlistSelect.innerHTML = '';
    // Add Portfolio option
    const portfolioOption = document.createElement('option');
    portfolioOption.value = 'portfolio';
    portfolioOption.textContent = 'Portfolio';
    watchlistSelect.appendChild(portfolioOption);
    // Add user watchlists
    userWatchlists.forEach(wl => {
        const opt = document.createElement('option');
        opt.value = wl.id;
        opt.textContent = wl.name;
        watchlistSelect.appendChild(opt);
    });
    // Add event listener for change
    watchlistSelect.addEventListener('change', () => {
        if (watchlistSelect.value === 'portfolio') {
            if (window.showPortfolioView) window.showPortfolioView();
        } else {
            if (window.showWatchlistView) window.showWatchlistView();
        }
    });
}

// Helper: Populate the share form's watchlist select
export function populateShareWatchlistSelect() {
    const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
    if (!shareWatchlistSelect) return;
    shareWatchlistSelect.innerHTML = '';
    userWatchlists.forEach(wl => {
        const opt = document.createElement('option');
        opt.value = wl.id;
        opt.textContent = wl.name;
        shareWatchlistSelect.appendChild(opt);
    });
}

// Diagnostics: Ensure Portfolio option is present
export function ensurePortfolioOptionPresent() {
    if (!watchlistSelect) {
        watchlistSelect = document.getElementById('watchlistSelect');
        if (!watchlistSelect) return;
    }
    const hasPortfolio = Array.from(watchlistSelect.options).some(opt => opt.value === 'portfolio');
    if (!hasPortfolio) {
        const portfolioOption = document.createElement('option');
        portfolioOption.value = 'portfolio';
        portfolioOption.textContent = 'Portfolio';
        watchlistSelect.appendChild(portfolioOption);
        if (window.showCustomAlert) {
            window.showCustomAlert('Portfolio option was missing and has been restored!', 2500);
        } else {
            alert('Portfolio option was missing and has been restored!');
        }
    }
}

// --- END WATCHLIST MODULE ---
// Watchlist-related logic extracted from script.js
// This module will handle watchlist dropdowns, rendering, and management

// Main function: Render the watchlist based on current selection
export function renderWatchlist() {
    // Use window references for globals
    const currentSelectedWatchlistIds = window.currentSelectedWatchlistIds || [];
    const ALL_SHARES_ID = window.ALL_SHARES_ID || 'all_shares_option';
    const CASH_BANK_WATCHLIST_ID = window.CASH_BANK_WATCHLIST_ID || 'cashBank';
    const userWatchlists = window.userWatchlists || [];
    const allSharesData = window.allSharesData || [];
    const shareTableBody = document.querySelector('#shareTable tbody');
    const mobileShareCardsContainer = document.getElementById('mobileShareCards');
    const tableContainer = document.querySelector('.table-container');
    const stockWatchlistSection = document.getElementById('stockWatchlistSection');
    const cashAssetsSection = document.getElementById('cashAssetsSection');
    const mainTitle = document.getElementById('mainTitle');
    const sortSelect = document.getElementById('sortSelect');
    const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn');
    const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');
    const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
    const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    const targetHitIconBtn = document.getElementById('targetHitIconBtn');
    const currentMobileViewMode = window.currentMobileViewMode || 'default';
    const currentUserId = window.currentUserId;
    // --- Compact View Display Logic ---
    const isCompactView = currentMobileViewMode === 'compact';
    const isMobileView = window.innerWidth <= 768;
    if (isCompactView) {
        if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'grid';
        if (tableContainer) tableContainer.style.display = 'none';
    } else if (isMobileView) {
        if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'flex';
        if (tableContainer) tableContainer.style.display = 'none';
    } else {
        if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'none';
        if (tableContainer) tableContainer.style.display = '';
    }
    const selectedWatchlistId = currentSelectedWatchlistIds[0];
    // Hide both sections initially
    if (stockWatchlistSection) stockWatchlistSection.classList.add('app-hidden');
    if (cashAssetsSection) cashAssetsSection.classList.add('app-hidden');
    // Clear previous content (only for elements that will be conditionally displayed)
    if (selectedWatchlistId !== CASH_BANK_WATCHLIST_ID) {
        // Stock Watchlist Logic
        if (stockWatchlistSection) stockWatchlistSection.classList.remove('app-hidden');
        const selectedWatchlist = userWatchlists.find(wl => wl.id === selectedWatchlistId);
        if (selectedWatchlistId === ALL_SHARES_ID) {
            if (mainTitle) mainTitle.textContent = 'All Shares';
        } else if (selectedWatchlist) {
            if (mainTitle) mainTitle.textContent = selectedWatchlist.name;
        } else {
            if (mainTitle) mainTitle.textContent = 'Share Watchlist';
        }
        if (sortSelect) sortSelect.classList.remove('app-hidden');
        if (refreshLivePricesBtn) refreshLivePricesBtn.classList.remove('app-hidden');
        if (toggleCompactViewBtn) toggleCompactViewBtn.classList.remove('app-hidden');
        if (exportWatchlistBtn) exportWatchlistBtn.classList.remove('app-hidden');
        if (asxCodeButtonsContainer) asxCodeButtonsContainer.classList.remove('app-hidden');
        if (targetHitIconBtn) targetHitIconBtn.classList.remove('app-hidden');
        // Render shares
        let sharesToRender = [];
        if (selectedWatchlistId === ALL_SHARES_ID) {
            sharesToRender = [...allSharesData];
        } else if (currentSelectedWatchlistIds.length === 1) {
            sharesToRender = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
        }
        // Clear previous rows/cards
        if (shareTableBody) shareTableBody.innerHTML = '';
        if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '';
        // Add shares to UI
        if (sharesToRender.length > 0) {
            sharesToRender.forEach(share => {
                if (tableContainer && tableContainer.style.display !== 'none') {
                    if (window.addShareToTable) window.addShareToTable(share);
                }
                if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') {
                    if (window.addShareToMobileCards) window.addShareToMobileCards(share);
                }
            });
        } else {
            // Show empty message
            const emptyWatchlistMessage = document.createElement('p');
            emptyWatchlistMessage.textContent = 'No shares found for the selected watchlists. Add a new share to get started!';
            emptyWatchlistMessage.style.textAlign = 'center';
            emptyWatchlistMessage.style.padding = '20px';
            emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
            if (tableContainer && tableContainer.style.display !== 'none' && shareTableBody) {
                const td = document.createElement('td');
                td.colSpan = 6;
                td.appendChild(emptyWatchlistMessage);
                const tr = document.createElement('tr');
                tr.classList.add('empty-message-row');
                tr.appendChild(td);
                shareTableBody.appendChild(tr);
            }
            if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') {
                mobileShareCardsContainer.appendChild(emptyWatchlistMessage.cloneNode(true));
            }
        }
    } else {
        // Cash & Assets section Logic
        if (cashAssetsSection) cashAssetsSection.classList.remove('app-hidden');
        if (mainTitle) mainTitle.textContent = 'Cash & Assets';
        if (sortSelect) sortSelect.classList.remove('app-hidden');
        if (refreshLivePricesBtn) refreshLivePricesBtn.classList.add('app-hidden');
        if (toggleCompactViewBtn) toggleCompactViewBtn.classList.add('app-hidden');
        if (asxCodeButtonsContainer) asxCodeButtonsContainer.classList.add('app-hidden');
        if (targetHitIconBtn) targetHitIconBtn.classList.add('app-hidden');
        if (exportWatchlistBtn) exportWatchlistBtn.classList.add('app-hidden');
        if (tableContainer) tableContainer.style.display = 'none';
        if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'none';
        // Optionally call window.renderCashCategories if available
        if (window.renderCashCategories) window.renderCashCategories();
    }
    // Optionally update sort dropdown, buttons, etc.
    if (window.renderSortSelect) window.renderSortSelect();
    if (window.updateMainButtonsState) window.updateMainButtonsState(!!currentUserId);
    if (window.adjustMainContentPadding) window.adjustMainContentPadding();
}
