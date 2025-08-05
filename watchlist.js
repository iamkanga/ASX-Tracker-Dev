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

// Example placeholder for watchlist rendering
export function renderWatchlist() {
    // TODO: Move actual watchlist rendering logic here from script.js
}
