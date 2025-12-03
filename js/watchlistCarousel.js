
import { getUserWatchlists, getCurrentSelectedWatchlistIds, setCurrentSelectedWatchlistIds } from './state.js';
import { toggleCodeButtonsArrow } from './uiService.js';

/**
 * Watchlist Carousel Module
 * Handles sequential navigation between watchlists (Portfolio -> User Watchlists -> Global Movers)
 */

export function init() {
    const prevBtn = document.getElementById('prevWatchlistBtn');
    const nextBtn = document.getElementById('nextWatchlistBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => navigateWatchlist(-1));
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => navigateWatchlist(1));
    }
}

/**
 * Returns the ordered list of watchlist IDs for navigation
 * Order: 'portfolio' -> [user watchlists...] -> '__movers'
 */
function getOrderedWatchlistIds() {
    const userLists = getUserWatchlists() || [];
    // Sort user lists by name for consistent navigation order
    const sortedUserIds = userLists
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(list => list.id);

    return ['portfolio', 'all_shares_option', ...sortedUserIds];
}

/**
 * Navigates to the next or previous watchlist
 * @param {number} direction -1 for previous, 1 for next
 */
function navigateWatchlist(direction) {
    const orderedIds = getOrderedWatchlistIds();
    const currentIds = getCurrentSelectedWatchlistIds();
    const currentId = (currentIds && currentIds.length > 0) ? currentIds[0] : 'portfolio';

    let currentIndex = orderedIds.indexOf(currentId);

    // If current ID not found (e.g. 'all_shares_option'), default to portfolio (index 0)
    if (currentIndex === -1) currentIndex = 0;

    let nextIndex = currentIndex + direction;

    // Handle wrap-around
    if (nextIndex >= orderedIds.length) {
        nextIndex = 0;
    } else if (nextIndex < 0) {
        nextIndex = orderedIds.length - 1;
    }

    const nextId = orderedIds[nextIndex];

    console.log(`[WatchlistCarousel] Navigating from ${currentId} to ${nextId} (Direction: ${direction})`);

    // Update State
    setCurrentSelectedWatchlistIds([nextId]);

    // Update UI based on selection
    if (nextId === 'portfolio') {
        if (typeof window.showPortfolioView === 'function') {
            window.showPortfolioView();
        } else {
            console.warn('[WatchlistCarousel] showPortfolioView not found');
        }
    } else {
        // For standard watchlists and movers
        if (typeof window.showWatchlistView === 'function') {
            window.showWatchlistView();
        }

        // Trigger render
        if (window.Rendering && typeof window.Rendering.renderWatchlist === 'function') {
            window.Rendering.renderWatchlist();
        } else if (typeof window.renderWatchlist === 'function') {
            window.renderWatchlist();
        }
    }

    // Update Header Title
    if (typeof window.updateMainTitle === 'function') {
        window.updateMainTitle();
    }

    // Update Sort Picker Text
    if (typeof window.updateSortPickerButtonText === 'function') {
        window.updateSortPickerButtonText();
    }

    // Update ASX Code Buttons Arrow state
    toggleCodeButtonsArrow();

    // Sync the dropdown if it exists
    const watchlistSelect = document.getElementById('shareWatchlistSelect');
    if (watchlistSelect) {
        watchlistSelect.value = nextId;
    }
}
