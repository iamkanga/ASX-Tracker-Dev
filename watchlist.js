// watchlist.js

// --- EXPORTED VARIABLES ---
export let userWatchlists = [];
export let currentSelectedWatchlistIds = [];
export const ALL_SHARES_ID = 'all_shares_option';
export const CASH_BANK_WATCHLIST_ID = 'cashBank';
export let __forcedInitialMovers = false;

// --- MODULE-SCOPED VARIABLES ---
let watchlistSelect;
let updateMainTitle;
let updateAddHeaderButton;
let setLastSelectedView;
let logDebug;
let shareWatchlistSelect;
let allSharesData;
let selectedShareDocId;
let shareWatchlistEnhanced;
let shareWatchlistDropdownBtn;
let checkFormDirtyState;

// --- INITIALIZATION ---
export function init(dependencies) {
    watchlistSelect = dependencies.watchlistSelect;
    updateMainTitle = dependencies.updateMainTitle;
    updateAddHeaderButton = dependencies.updateAddHeaderButton;
    setLastSelectedView = dependencies.setLastSelectedView;
    logDebug = dependencies.logDebug;
    shareWatchlistSelect = dependencies.shareWatchlistSelect;
    allSharesData = dependencies.allSharesData;
    selectedShareDocId = dependencies.selectedShareDocId;
    shareWatchlistEnhanced = dependencies.shareWatchlistEnhanced;
    shareWatchlistDropdownBtn = dependencies.shareWatchlistDropdownBtn;
    checkFormDirtyState = dependencies.checkFormDirtyState;
}

// --- EXPORTED FUNCTIONS ---
export function renderWatchlistSelect() {
    if (!watchlistSelect) { console.error('renderWatchlistSelect: watchlistSelect element not found.'); return; }
    // Store the currently selected value before clearing
    const currentSelectedValue = watchlistSelect.value;

    // Set the initial placeholder text to "Watch List"
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';

    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    // Ensure Movers virtual option always present (even if counts not ready yet)
    if (!watchlistSelect.querySelector('option[value="__movers"]')) {
        const moversOpt = document.createElement('option');
        moversOpt.value='__movers';
        moversOpt.textContent='Movers';
        watchlistSelect.appendChild(moversOpt);
    }

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
    let desiredWatchlistId = currentSelectedWatchlistIds.length === 1 ? currentSelectedWatchlistIds[0] : '';
    // Highest precedence: persisted Movers intent when __forcedInitialMovers flag set
    try {
        if (__forcedInitialMovers) {
            desiredWatchlistId='__movers';
        } else {
            const persisted = localStorage.getItem('lastSelectedView');
            if (persisted === '__movers') desiredWatchlistId='__movers';
        }
    } catch(_) {}

    if (desiredWatchlistId && Array.from(watchlistSelect.options).some(opt => opt.value === desiredWatchlistId)) {
        watchlistSelect.value = desiredWatchlistId;
    } else {
        // Fallback: Prefer the last selected view from localStorage if valid, especially for 'portfolio'
        try {
            const lsView = localStorage.getItem('lastSelectedView');
            const hasLs = lsView && Array.from(watchlistSelect.options).some(opt => opt.value === lsView);
            if (hasLs) {
                // If persisted is movers, keep it even if data not yet loaded
                watchlistSelect.value = lsView;
                currentSelectedWatchlistIds = [lsView];
                console.log('UI Update: Watchlist select applied lastSelectedView from localStorage: ' + lsView);
            } else {
                watchlistSelect.value = ALL_SHARES_ID;
                currentSelectedWatchlistIds = [ALL_SHARES_ID];
                try { localStorage.setItem('lastWatchlistSelection', JSON.stringify(currentSelectedWatchlistIds)); } catch(_) {}
                console.log('UI Update: Watchlist select defaulted to All Shares (no valid preference).');
            }
        } catch(e) {
            watchlistSelect.value = ALL_SHARES_ID;
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
            console.log('UI Update: Watchlist select defaulted to All Shares due to error reading localStorage.');
        }
    }
    console.log('UI Update: Watchlist select dropdown rendered. Selected value: ' + watchlistSelect.value);
    updateMainTitle(); // Update main title based on newly selected watchlist
    updateAddHeaderButton(); // Update the plus button context (and sidebar button context)
}

export function populateShareWatchlistSelect(currentShareWatchlistId = null, isNewShare = true) {
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


export function ensurePortfolioOptionPresent() {
    if (!watchlistSelect) return;
    const portfolioOption = watchlistSelect.querySelector('option[value="portfolio"]');
    if (!portfolioOption) {
        const option = document.createElement('option');
        option.value = 'portfolio';
        option.textContent = 'Portfolio';
        watchlistSelect.appendChild(option);
    }
}
