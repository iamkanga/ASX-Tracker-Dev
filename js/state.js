// Centralized application state module
// Exports state variables and setter functions, and mirrors values to window for non-module scripts

// Core state variables
let allSharesData = [];
let livePrices = {};
let userWatchlists = [];
let userCashCategories = [];
let currentSelectedWatchlistIds = [];
let sharesAtTargetPrice = [];
let currentSortOrder = 'entryDate-desc';
let allAsxCodes = [];
let watchlistSortOrders = {}; // Stores sort order per watchlist
let currentMobileViewMode = 'default'; // Stores view mode preference

// Window exposure for compatibility with non-module scripts (e.g., rendering.js)
if (typeof window !== 'undefined') {
    window.allSharesData = allSharesData;
    window.livePrices = livePrices;
    window.userWatchlists = userWatchlists;
    window.userCashCategories = userCashCategories;
    window.currentSelectedWatchlistIds = currentSelectedWatchlistIds;
    window.sharesAtTargetPrice = sharesAtTargetPrice;
    window.currentSortOrder = currentSortOrder;
    window.allAsxCodes = allAsxCodes;
    window.watchlistSortOrders = watchlistSortOrders;
    window.currentMobileViewMode = currentMobileViewMode;
}

// Setter helpers keep window mirrors in sync
export function setAllSharesData(data) {
    allSharesData = Array.isArray(data) ? data : [];
    if (typeof window !== 'undefined') window.allSharesData = allSharesData;
}

export function setLivePrices(data) {
    livePrices = data && typeof data === 'object' ? data : {};
    if (typeof window !== 'undefined') window.livePrices = livePrices;
}

export function setUserWatchlists(data) {
    userWatchlists = Array.isArray(data) ? data : [];
    if (typeof window !== 'undefined') window.userWatchlists = userWatchlists;
}

export function setUserCashCategories(data) {
    userCashCategories = Array.isArray(data) ? data : [];
    if (typeof window !== 'undefined') window.userCashCategories = userCashCategories;
}

export function setCurrentSelectedWatchlistIds(ids) {
    currentSelectedWatchlistIds = Array.isArray(ids) ? ids : [];
    if (typeof window !== 'undefined') window.currentSelectedWatchlistIds = currentSelectedWatchlistIds;
}

export function setSharesAtTargetPrice(items) {
    sharesAtTargetPrice = Array.isArray(items) ? items : [];
    if (typeof window !== 'undefined') window.sharesAtTargetPrice = sharesAtTargetPrice;
}

export function setCurrentSortOrder(value) {
    currentSortOrder = typeof value === 'string' && value ? value : 'entryDate-desc';
    if (typeof window !== 'undefined') window.currentSortOrder = currentSortOrder;
}

export function setAllAsxCodes(codes) {
    allAsxCodes = Array.isArray(codes) ? codes : [];
    if (typeof window !== 'undefined') window.allAsxCodes = allAsxCodes;
}

export function setWatchlistSortOrders(orders) {
    watchlistSortOrders = (orders && typeof orders === 'object') ? orders : {};
    if (typeof window !== 'undefined') window.watchlistSortOrders = watchlistSortOrders;
}

// Set a single watchlist's sort order in-memory
export function setWatchlistSortOrder(watchlistId, sortOrder) {
    try {
        if (!watchlistId) return;
        watchlistSortOrders = watchlistSortOrders || {};
        watchlistSortOrders[watchlistId] = sortOrder;
        if (typeof window !== 'undefined') window.watchlistSortOrders = watchlistSortOrders;
    } catch(_) {}
}

// Getters
export function getAllSharesData() { return allSharesData; }
export function getLivePrices() { return livePrices; }
export function getUserWatchlists() { return userWatchlists; }
export function getUserCashCategories() { return userCashCategories; }
export function getCurrentSelectedWatchlistIds() { return currentSelectedWatchlistIds; }
export function getSharesAtTargetPrice() { return sharesAtTargetPrice; }
export function getCurrentSortOrder() { return currentSortOrder; }
export function getAllAsxCodes() { return allAsxCodes; }
export function getWatchlistSortOrders() { return watchlistSortOrders; }

// View mode state management
export function setCurrentMobileViewMode(mode) {
    currentMobileViewMode = mode && (mode === 'compact' || mode === 'default') ? mode : 'default';
    if (typeof window !== 'undefined') window.currentMobileViewMode = currentMobileViewMode;
}

export function getCurrentMobileViewMode() {
    return currentMobileViewMode;
}

