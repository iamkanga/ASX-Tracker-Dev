// Centralized application state module
// Exports state variables and setter functions, and mirrors values to window for non-module scripts

// Core state variables
export let allSharesData = [];
export let livePrices = {};
export let userWatchlists = [];
export let currentSelectedWatchlistIds = [];
export let sharesAtTargetPrice = [];
export let currentSortOrder = 'entryDate-desc';
export let allAsxCodes = [];

// Window exposure for compatibility with non-module scripts (e.g., rendering.js)
if (typeof window !== 'undefined') {
    window.allSharesData = allSharesData;
    window.livePrices = livePrices;
    window.userWatchlists = userWatchlists;
    window.currentSelectedWatchlistIds = currentSelectedWatchlistIds;
    window.sharesAtTargetPrice = sharesAtTargetPrice;
    window.currentSortOrder = currentSortOrder;
    window.allAsxCodes = allAsxCodes;
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

