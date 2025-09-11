// UI Service: centralizes UI-related helpers and state shared across modules
// Exposes functions for ASX toggle UI and form data extraction

import { getCurrentSelectedWatchlistIds } from './state.js';
import { getUserCashCategories, getCurrentSortOrder } from './state.js';

// Backed by window to avoid multiple copies across modules and to preserve legacy access
function readAsxExpandedFromStorage() {
	try { return localStorage.getItem('asxButtonsExpanded') === 'true'; } catch(_) { return false; }
}

if (typeof window !== 'undefined' && typeof window.asxButtonsExpanded === 'undefined') {
	window.asxButtonsExpanded = readAsxExpandedFromStorage();
}

export function getAsxButtonsExpanded() {
	return !!(typeof window !== 'undefined' ? window.asxButtonsExpanded : false);
}

export function setAsxButtonsExpanded(value) {
	const next = !!value;
	if (typeof window !== 'undefined') {
		window.asxButtonsExpanded = next;
		try { localStorage.setItem('asxButtonsExpanded', next ? 'true' : 'false'); } catch(_) {}
	}
}

export function applyAsxButtonsState() {
    const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    const toggleAsxButtonsBtn = document.getElementById('toggleAsxButtonsBtn');
    const asxCodeButtonsToggle = document.getElementById('asxCodeButtonsToggle');
	if (!asxCodeButtonsContainer || !toggleAsxButtonsBtn) {
		console.warn('applyAsxButtonsState: Missing elements - container:', !!asxCodeButtonsContainer, 'button:', !!toggleAsxButtonsBtn);
		return;
	}

	// If Cash & Assets view is active, fully hide and disable ASX controls
	try {
		const selIds = getCurrentSelectedWatchlistIds();
		const CASH_ID = (typeof window !== 'undefined' && window.CASH_BANK_WATCHLIST_ID) ? window.CASH_BANK_WATCHLIST_ID : 'cashBank';
		const isCashView = Array.isArray(selIds) && selIds.includes(CASH_ID);

        if (isCashView) {
			toggleAsxButtonsBtn.style.display = 'none';
			toggleAsxButtonsBtn.setAttribute('aria-disabled', 'true');
			toggleAsxButtonsBtn.setAttribute('aria-expanded', 'false');
			toggleAsxButtonsBtn.setAttribute('aria-pressed', 'false');
            if (asxCodeButtonsToggle) {
                asxCodeButtonsToggle.style.display = 'none';
                asxCodeButtonsToggle.setAttribute('aria-disabled', 'true');
                asxCodeButtonsToggle.setAttribute('aria-expanded', 'false');
                asxCodeButtonsToggle.setAttribute('aria-pressed', 'false');
            }
			asxCodeButtonsContainer.classList.add('app-hidden');
			asxCodeButtonsContainer.classList.remove('expanded');
			asxCodeButtonsContainer.setAttribute('aria-hidden', 'true');
			asxCodeButtonsContainer.style.display = 'none';
			return;
		}
	} catch(_) {}

	// FIX: Ensure ASX button state is properly restored from localStorage when switching away from Cash view
	// This fixes the bug where ASX buttons don't show after switching from Cash view
	try {
		// Re-read the state from localStorage to ensure it's current
		const savedState = readAsxExpandedFromStorage();
		if (typeof window !== 'undefined') {
			window.asxButtonsExpanded = savedState;
		}
	} catch(e) {
		console.warn('ASX state restoration failed:', e);
	}

	const hasButtons = !!asxCodeButtonsContainer.querySelector('button.asx-code-btn');
	const shouldShow = !!hasButtons && getAsxButtonsExpanded();

	if (shouldShow) {
		asxCodeButtonsContainer.classList.add('expanded');
		asxCodeButtonsContainer.classList.remove('app-hidden');
		asxCodeButtonsContainer.setAttribute('aria-hidden', 'false');
		// Force display to ensure it overrides any conflicting CSS
		asxCodeButtonsContainer.style.display = 'flex';
		asxCodeButtonsContainer.style.opacity = '1';
		asxCodeButtonsContainer.style.maxHeight = '500px';

    } else {
        asxCodeButtonsContainer.classList.remove('expanded');
        asxCodeButtonsContainer.classList.add('app-hidden');
        asxCodeButtonsContainer.setAttribute('aria-hidden', 'true');
        // Ensure the container is hidden when collapsed or when empty.
        // Use explicit 'none' instead of clearing the inline display so CSS defaults
        // (which may include a visible display like flex) don't leave an empty box.
        asxCodeButtonsContainer.style.display = 'none';
        asxCodeButtonsContainer.style.opacity = '';
        asxCodeButtonsContainer.style.maxHeight = '';

    }

    if (!hasButtons) {
		toggleAsxButtonsBtn.style.display = 'none';
		toggleAsxButtonsBtn.setAttribute('aria-disabled', 'true');
        if (asxCodeButtonsToggle) {
            asxCodeButtonsToggle.style.display = 'none';
            asxCodeButtonsToggle.setAttribute('aria-disabled', 'true');
        }
	} else {
		toggleAsxButtonsBtn.style.display = 'inline-flex';
		toggleAsxButtonsBtn.removeAttribute('aria-disabled');
        if (asxCodeButtonsToggle) {
            asxCodeButtonsToggle.style.display = 'inline-block';
            asxCodeButtonsToggle.removeAttribute('aria-disabled');
        }
	}

	try {
		toggleAsxButtonsBtn.setAttribute('aria-pressed', String(!!shouldShow));
		toggleAsxButtonsBtn.setAttribute('aria-expanded', String(!!shouldShow));
		const labelSpan = toggleAsxButtonsBtn.querySelector('.asx-toggle-label');
		if (labelSpan) labelSpan.textContent = 'ASX Codes';
	} catch(_) {}

    // Reflect state on new header two-line toggle
    try {
        if (asxCodeButtonsToggle) {
            asxCodeButtonsToggle.setAttribute('aria-pressed', String(!!shouldShow));
            asxCodeButtonsToggle.setAttribute('aria-expanded', String(!!shouldShow));
        }
    } catch(_) {}

	const chevronIcon = toggleAsxButtonsBtn.querySelector('.asx-toggle-triangle');
	if (chevronIcon) chevronIcon.classList.toggle('expanded', shouldShow);

    // Universal layout fix: after ASX buttons visibility changes, immediately recalc and reposition main content.
    try {
        if (window.repositionMainContentUnderHeader) {
            requestAnimationFrame(()=> window.repositionMainContentUnderHeader());
        } else if (window.adjustMainContentPadding) {
            requestAnimationFrame(window.adjustMainContentPadding);
        }
    } catch(_) {}
}

export function toggleCodeButtonsArrow() {
    const toggleAsxButtonsBtn = document.getElementById('toggleAsxButtonsBtn');
    const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    const asxCodeButtonsToggle = document.getElementById('asxCodeButtonsToggle');

	if (!toggleAsxButtonsBtn) {
		console.warn('toggleCodeButtonsArrow: toggleAsxButtonsBtn not found');
		return;
	}

	const selIds = getCurrentSelectedWatchlistIds();
	const current = (selIds && selIds[0]) || null;
	const CASH_ID = (typeof window !== 'undefined' && window.CASH_BANK_WATCHLIST_ID) ? window.CASH_BANK_WATCHLIST_ID : 'cashBank';

    if (current === CASH_ID) {
		toggleAsxButtonsBtn.style.display = 'none';
        if (asxCodeButtonsToggle) {
            asxCodeButtonsToggle.style.display = 'none';
            asxCodeButtonsToggle.setAttribute('aria-disabled', 'true');
            asxCodeButtonsToggle.setAttribute('aria-expanded', 'false');
            asxCodeButtonsToggle.setAttribute('aria-pressed', 'false');
        }
		if (asxCodeButtonsContainer) {
			asxCodeButtonsContainer.classList.add('app-hidden');
			asxCodeButtonsContainer.style.display = 'none';
		}
	} else {
		// FIX: Ensure ASX button state is properly restored when switching TO non-cash view
		// This ensures the saved state from localStorage is applied immediately
		try {
			const savedState = readAsxExpandedFromStorage();
			if (typeof window !== 'undefined') {
				window.asxButtonsExpanded = savedState;
			}
		} catch(e) {
			console.warn('ASX state restoration in toggleCodeButtonsArrow failed:', e);
		}

        toggleAsxButtonsBtn.style.display = '';
        if (asxCodeButtonsToggle) {
            asxCodeButtonsToggle.style.display = '';
            asxCodeButtonsToggle.removeAttribute('aria-disabled');
            asxCodeButtonsToggle.setAttribute('aria-pressed', String(!!getAsxButtonsExpanded()));
            asxCodeButtonsToggle.setAttribute('aria-expanded', String(!!getAsxButtonsExpanded()));
        }
        if (asxCodeButtonsContainer) {
            asxCodeButtonsContainer.classList.remove('app-hidden');
            // Explicitly reflect the expanded state in inline style so the
            // container does not remain visible when collapsed.
            asxCodeButtonsContainer.style.display = getAsxButtonsExpanded() ? 'flex' : 'none';
        }
		applyAsxButtonsState();
	}
}

export function getCurrentFormData() {
	const comments = [];
	const commentsFormContainer = document.getElementById('dynamicCommentsArea');
	if (commentsFormContainer) {
		commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
			const titleInput = section.querySelector('.comment-title-input');
			const textInput = section.querySelector('.comment-text-input');
			const title = titleInput ? titleInput.value.trim() : '';
			const text = textInput ? textInput.value.trim() : '';
			if (title || text) comments.push({ title: title, text: text });
		});
	}

	const shareNameInput = document.getElementById('shareName');
	const currentPriceInput = document.getElementById('currentPrice');
	const targetPriceInput = document.getElementById('targetPrice');
	const dividendAmountInput = document.getElementById('dividendAmount');
	const frankingCreditsInput = document.getElementById('frankingCredits');
	const shareRatingSelect = document.getElementById('shareRating');
	const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
	const shareWatchlistEnhanced = document.getElementById('shareWatchlistEnhanced');

	const portfolioSharesEl = document.getElementById('portfolioShares');
	const portfolioAvgPriceEl = document.getElementById('portfolioAvgPrice');
	const portfolioSharesVal = portfolioSharesEl ? parseFloat(portfolioSharesEl.value) : NaN;
	const portfolioAvgPriceVal = portfolioAvgPriceEl ? parseFloat(portfolioAvgPriceEl.value) : NaN;

	return {
		shareName: (shareNameInput && shareNameInput.value ? shareNameInput.value : '').trim().toUpperCase(),
		currentPrice: currentPriceInput ? parseFloat(currentPriceInput.value) : null,
		entryPrice: null, // Will be populated from currentPrice in appService.js
		entryDate: null, // Will be populated with current date in appService.js
		targetPrice: targetPriceInput ? parseFloat(targetPriceInput.value) : NaN,
		targetDirection: (document.getElementById('targetAboveCheckbox') && document.getElementById('targetAboveCheckbox').checked) ? 'above' : 'below',
		dividendAmount: dividendAmountInput ? parseFloat(dividendAmountInput.value) : NaN,
		frankingCredits: frankingCreditsInput ? parseFloat(frankingCreditsInput.value) : NaN,
		starRating: shareRatingSelect ? parseInt(shareRatingSelect.value) : 0,
		comments: comments,
		watchlistId: shareWatchlistSelect ? (shareWatchlistSelect.value || null) : null,
		watchlistIds: (() => {
			try {
				if (shareWatchlistEnhanced) {
					const enhancedVals = Array.from(shareWatchlistEnhanced.querySelectorAll('input[type="checkbox"]:checked')).map(cb=>cb.value).filter(Boolean);
					if (enhancedVals.length) return enhancedVals;
				}
			} catch(_) {}
			const legacyEls = document.querySelectorAll('#shareWatchlistCheckboxes input.watchlist-checkbox:checked');
			const legacyVals = Array.from(legacyEls).map(x => x.value).filter(Boolean);
			if (legacyVals.length) return legacyVals;
			const single = shareWatchlistSelect ? (shareWatchlistSelect.value || null) : null;
			return single ? [single] : null;
		})(),
		portfolioShares: isNaN(portfolioSharesVal) ? null : Math.trunc(portfolioSharesVal),
		portfolioAvgPrice: isNaN(portfolioAvgPriceVal) ? null : portfolioAvgPriceVal
	};
}

export function getCurrentCashAssetFormData() {
	const comments = [];
	const cashAssetCommentsContainer = document.getElementById('cashAssetCommentsContainer') || document.getElementById('cashAssetCommentsArea');
	if (cashAssetCommentsContainer) {
		cashAssetCommentsContainer.querySelectorAll('.comment-section').forEach(section => {
			const titleInput = section.querySelector('.comment-title-input');
			const textInput = section.querySelector('.comment-text-input');
			const title = titleInput ? titleInput.value.trim() : '';
			const text = textInput ? textInput.value.trim() : '';
			if (title || text) comments.push({ title: title, text: text });
		});
	}
    const cashAssetNameInput = document.getElementById('cashAssetName');
    const cashAssetBalanceInput = document.getElementById('cashAssetBalance');
    // The modal checkbox was removed; use the model's isHidden value when editing an existing asset.
    return {
        name: (cashAssetNameInput && cashAssetNameInput.value ? cashAssetNameInput.value : '').trim(),
        balance: cashAssetBalanceInput ? parseFloat(cashAssetBalanceInput.value) : NaN,
        comments: comments,
        isHidden: (function(){
            try {
                if (window.selectedCashAssetDocId) {
                    const current = getUserCashCategories() || [];
                    const found = current.find(c => c && c.id === window.selectedCashAssetDocId);
                    return !!(found && found.isHidden);
                }
            } catch(_) {}
            return false;
        })()
    };
}

// Backwards-compat: expose helpers on window for older code paths
try { window.getCurrentFormData = getCurrentFormData; window.getCurrentCashAssetFormData = getCurrentCashAssetFormData; } catch(_) {}


// Cash & Assets rendering helpers consolidated here
export function renderCashCategories() {
    const cashCategoriesContainer = document.getElementById('cashCategoriesContainer');
    if (!cashCategoriesContainer) { console.error('renderCashCategories: cashCategoriesContainer element not found.'); return; }
    const categories = getUserCashCategories();
    try { console.log('[Diag][Cash] renderCashCategories called. Count=', Array.isArray(categories)?categories.length:'n/a'); } catch(_) {}
    cashCategoriesContainer.innerHTML = '';

    const sortValue = getCurrentSortOrder();
    const [field, order] = (sortValue||'').split('-');
    // Prefer centralized sort function if available (keeps behavior consistent across modules)
    let sorted = Array.isArray(categories) ? [...categories] : [];
    try {
        if (window && typeof window.sortCashCategories === 'function') {
            const maybe = window.sortCashCategories(categories);
            if (Array.isArray(maybe)) {
                sorted = maybe;
            }
        } else {
            // Map UI logical fields to actual model properties
            const sortField = (field === 'totalDollar') ? 'balance' : field;
            if (sortField === 'balance') {
                sorted.sort((a,b)=>{
                    const aN = (typeof a.balance === 'number' && !isNaN(a.balance)) ? a.balance : (order==='asc'?Infinity:-Infinity);
                    const bN = (typeof b.balance === 'number' && !isNaN(b.balance)) ? b.balance : (order==='asc'?Infinity:-Infinity);
                    return order==='asc' ? aN-bN : bN-aN;
                });
            } else if (sortField === 'name') {
                sorted.sort((a,b)=> (a.name||'').toUpperCase().localeCompare((b.name||'').toUpperCase()));
                if (order==='desc') sorted.reverse();
            }
        }
    } catch (e) {
        console.warn('renderCashCategories: error using centralized sorter, falling back to local sort.', e);
    }

    if (!sorted.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.classList.add('empty-message');
        emptyMessage.textContent = 'No cash categories added yet. Click "Add Category" to get started!';
        cashCategoriesContainer.appendChild(emptyMessage);
        return;
    }

    sorted.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.classList.add('cash-category-item');
        categoryItem.dataset.id = category.id;
        if (category.isHidden) categoryItem.classList.add('hidden');

        const categoryHeader = document.createElement('div');
        categoryHeader.classList.add('category-header');
        const nameDisplay = document.createElement('span');
        nameDisplay.classList.add('category-name-display');
        nameDisplay.textContent = category.name || 'Unnamed Asset';
        categoryHeader.appendChild(nameDisplay);

        // Add on-card hide/show toggle (eye icon). Clicking the icon toggles visibility
        try {
            const hideBtn = document.createElement('button');
            hideBtn.type = 'button';
            hideBtn.className = 'hide-toggle-btn';
            hideBtn.title = category.isHidden ? 'Show asset' : 'Hide asset';
            // Use innerHTML to insert the font-awesome eye/eye-slash icons which are present elsewhere in the app
            hideBtn.innerHTML = category.isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
            // Reflect hidden state on the button
            if (category.isHidden) hideBtn.classList.add('hidden-icon');

            // Prevent card click from firing when toggling the icon
            hideBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try { window.logDebug && window.logDebug('Cash Categories: hide toggle clicked for ID=' + category.id); } catch(_) {}

                const newHidden = !Boolean(category.isHidden);

                // Optimistically update UI
                try {
                    category.isHidden = newHidden;
                    if (newHidden) {
                        categoryItem.classList.add('hidden');
                        hideBtn.classList.add('hidden-icon');
                        hideBtn.title = 'Show asset';
                        hideBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                    } else {
                        categoryItem.classList.remove('hidden');
                        hideBtn.classList.remove('hidden-icon');
                        hideBtn.title = 'Hide asset';
                        hideBtn.innerHTML = '<i class="fas fa-eye"></i>';
                    }
                    // Recalculate total immediately and re-render cash categories so hidden items reposition
                    try { if (typeof calculateTotalCash === 'function') calculateTotalCash(); } catch(_) {}
                    try { if (typeof renderCashCategories === 'function') renderCashCategories(); } catch(_) {}
                } catch(_) {}

                // Persist change via AppService if available
                try {
                    if (window.AppService && typeof window.AppService.updateCashCategoryVisibility === 'function') {
                        await window.AppService.updateCashCategoryVisibility(category.id, !!newHidden);
                    } else if (window.AppService && typeof window.AppService.saveCashAsset === 'function') {
                        // Fallback: perform a targeted save by selecting the asset and calling saveCashAsset
                        try { window.selectedCashAssetDocId = category.id; } catch(_) {}
                        // Prepare a shallow form snapshot so saveCashAsset will pick up isHidden
                        // NOTE: getCurrentCashAssetFormData no longer includes a checkbox; rely on category.isHidden to be preserved by AppService before calling save
                        try { await window.AppService.saveCashAsset(true); } catch(e) { throw e; }
                    } else {
                        console.warn('No persistence API available to update cash category visibility.');
                    }
                } catch (err) {
                    console.error('Error persisting cash category visibility change:', err);
                    // Revert optimistic UI change on failure
                    try {
                        category.isHidden = !newHidden;
                        if (category.isHidden) {
                            categoryItem.classList.add('hidden');
                            hideBtn.classList.add('hidden-icon');
                            hideBtn.title = 'Show asset';
                            hideBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                        } else {
                            categoryItem.classList.remove('hidden');
                            hideBtn.classList.remove('hidden-icon');
                            hideBtn.title = 'Hide asset';
                            hideBtn.innerHTML = '<i class="fas fa-eye"></i>';
                        }
                        try { if (typeof calculateTotalCash === 'function') calculateTotalCash(); } catch(_) {}
                        try { if (typeof renderCashCategories === 'function') renderCashCategories(); } catch(_) {}
                    } catch(_) {}
                    try { window.showCustomAlert && window.showCustomAlert('Error saving visibility change'); } catch(_) {}
                }
            });

            categoryHeader.appendChild(hideBtn);
        } catch(_) {}
        categoryItem.appendChild(categoryHeader);

        const balanceDisplay = document.createElement('span');
        balanceDisplay.classList.add('category-balance-display');
        const balNum = Number(category.balance);
        const num = !isNaN(balNum) ? balNum : 0;
        try {
            if (window.formatMoney) {
                balanceDisplay.textContent = window.formatMoney(num);
            } else {
                balanceDisplay.textContent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
            }
        } catch(_) { balanceDisplay.textContent = String(num); }
        categoryItem.appendChild(balanceDisplay);

        categoryItem.addEventListener('click', () => {
            try { window.logDebug && window.logDebug('Cash Categories: Card clicked for category ID: ' + category.id); } catch(_) {}
            try { window.selectCashAsset && window.selectCashAsset(category.id); } catch(_) {}
            try {
                // Diagnostic: record intent to open the modal and the current suppression state
                try { window.logDebug && window.logDebug('UI: Requesting showAddEditCashCategoryModal for ID=' + category.id + ' (suppress=' + (window.__suppressCashModalReopen || 0) + ', justSaved=' + (window.__justSavedCashAssetId || 'null') + ')'); } catch(_) {}
                showAddEditCashCategoryModal(category.id);
            } catch(_) {}
        });

        cashCategoriesContainer.appendChild(categoryItem);
    });
    try { window.logDebug && window.logDebug('Cash Categories: UI rendered.'); } catch(_) {}
    try { calculateTotalCash(); } catch(_) {}
}

export function calculateTotalCash() {
    const totalEl = document.getElementById('totalCashDisplay');
    const categories = getUserCashCategories();
    let total = 0;
    (categories||[]).forEach(category => {
        if (!category.isHidden && typeof category.balance === 'number' && !isNaN(category.balance)) total += category.balance;
    });
    if (totalEl) {
        try {
            if (window.formatMoney) {
                totalEl.textContent = window.formatMoney(total);
            } else {
                totalEl.textContent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(total);
            }
        } catch(_) { totalEl.textContent = String(total); }
    }
    try { window.logDebug && window.logDebug('Cash Categories: Total cash calculated'); } catch(_) {}
}

try { window.renderCashCategories = renderCashCategories; window.calculateTotalCash = calculateTotalCash; } catch(_) {}

// Add button context helpers
export function updateAddHeaderButton() {
    try {
        const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
        if (!addShareHeaderBtn) return;
        addShareHeaderBtn.onclick = null;
        addShareHeaderBtn.addEventListener('click', () => {
            const selIds = getCurrentSelectedWatchlistIds();
            const isCash = Array.isArray(selIds) && selIds.includes((window && window.CASH_BANK_WATCHLIST_ID) ? window.CASH_BANK_WATCHLIST_ID : 'cashBank');
            if (isCash) {
                try { if (window.handleAddCashAssetClick) window.handleAddCashAssetClick(); else renderCashCategories() || null; } catch(_) {}
            } else {
                try { if (window.handleAddShareClick) window.handleAddShareClick(); } catch(_) {}
            }
        });
    } catch(_) {}
}

export function updateSidebarAddButtonContext() {
    try {
        const newShareBtn = document.getElementById('newShareBtn');
        if (!newShareBtn) return;
        newShareBtn.onclick = null;
        newShareBtn.addEventListener('click', () => {
            const selIds = getCurrentSelectedWatchlistIds();
            const isCash = Array.isArray(selIds) && selIds.includes((window && window.CASH_BANK_WATCHLIST_ID) ? window.CASH_BANK_WATCHLIST_ID : 'cashBank');
            if (isCash) {
                try { if (window.handleAddCashAssetClick) window.handleAddCashAssetClick(); } catch(_) {}
            } else {
                try { if (window.handleAddShareClick) window.handleAddShareClick(); } catch(_) {}
            }
        });
    } catch(_) {}
}

export function handleAddShareClick() {
    try { if (window.openAddShareModal) window.openAddShareModal(); } catch(_) {}
}

export function handleAddCashAssetClick() {
    try { if (window.showAddEditCashCategoryModal) window.showAddEditCashCategoryModal(null); else renderCashCategories(); } catch(_) {}
}

try { window.updateAddHeaderButton = updateAddHeaderButton; window.updateSidebarAddButtonContext = updateSidebarAddButtonContext; window.handleAddShareClick = handleAddShareClick; window.handleAddCashAssetClick = handleAddCashAssetClick; } catch(_) {}

// Cash modal open helper (moved from script)
export function showAddEditCashCategoryModal(assetIdToEdit = null) {
    const cashAssetFormModal = document.getElementById('cashAssetFormModal');
    const cashFormTitle = document.getElementById('cashFormTitle');
    const cashAssetNameInput = document.getElementById('cashAssetName');
    const cashAssetBalanceInput = document.getElementById('cashAssetBalance');
    const cashAssetCommentsContainer = document.getElementById('cashAssetCommentsArea') || document.getElementById('cashAssetCommentsContainer');
    const addCashAssetCommentBtn = document.getElementById('addCashAssetCommentBtn');
    const deleteCashAssetBtn = document.getElementById('deleteCashAssetBtn');
    if (!cashAssetFormModal) return;

    function addCommentSection(container, title, text, focus) {
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.className = 'comment-section';

        // Header: title input + delete button
        const header = document.createElement('div');
        header.className = 'comment-section-header';

        const titleInput = document.createElement('input');
        titleInput.className = 'comment-title-input';
        titleInput.placeholder = 'Title';
        titleInput.value = typeof title === 'string' ? title : '';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'comment-delete-btn';
        deleteBtn.title = 'Delete Comment';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt" aria-hidden="true"></i>';

        header.appendChild(titleInput);
        header.appendChild(deleteBtn);

        const textArea = document.createElement('textarea');
        textArea.className = 'comment-text-input';
        textArea.placeholder = 'Comment';
        textArea.value = typeof text === 'string' ? text : '';

        wrap.appendChild(header);
        wrap.appendChild(textArea);
        container.appendChild(wrap);

        if (focus) {
            try { titleInput.focus(); } catch(_) {}
        }

        // Wire up dirty-state listeners and delete behavior
        try { titleInput.addEventListener('input', checkCashAssetFormDirtyState); } catch(_) {}
        try { textArea.addEventListener('input', checkCashAssetFormDirtyState); } catch(_) {}
        try {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                try { wrap.remove(); } catch(_) { if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
                try { checkCashAssetFormDirtyState(); } catch(_) {}
            });
        } catch(_) {}
    }

    if (assetIdToEdit) {
        const asset = (getUserCashCategories()||[]).find(a=>a && a.id===assetIdToEdit);
        if (!asset) { try { window.showCustomAlert && window.showCustomAlert('Cash asset not found.'); } catch(_) {} return; }
        try { window.selectedCashAssetDocId = assetIdToEdit; } catch(_) {}
        // Guard: if a cash asset was just saved, suppress immediate re-open to avoid close->reopen loop
        try {
            if (window.__suppressCashModalReopen && window.__justSavedCashAssetId) {
                // If this open is for the same asset that was just saved, ignore it
                if (assetIdToEdit && window.__justSavedCashAssetId === assetIdToEdit) {
                    try { window.logDebug && window.logDebug('UI: Suppressing immediate reopen of cash modal for just-saved asset ID: ' + assetIdToEdit); } catch(_) {}
                    try { console.trace && console.trace('TRACE: Suppressed cash modal reopen for asset ID: ' + assetIdToEdit); } catch(_) {}
                    return; // Suppress reopen
                }
            }
        } catch(_) {}
        if (cashFormTitle) {
            cashFormTitle.textContent = 'Edit Cash Asset';

            // Force styles with inline styles that can't be overridden - PLAIN TEXT
            cashFormTitle.setAttribute('style',
                'display: block !important; ' +
                'font-size: 2.2em !important; ' +
                'font-weight: 800 !important; ' +
                'margin: 0 !important; ' +
                'padding: 0 !important; ' +
                'color: var(--text-color) !important; ' +
                'background: transparent !important; ' +
                'background-color: transparent !important; ' +
                'border: none !important; ' +
                'border-radius: 0 !important; ' +
                'box-shadow: none !important; ' +
                'text-shadow: none !important; ' +
                'line-height: 1.1 !important; ' +
                'text-align: left !important; ' +
                'width: auto !important; ' +
                'visibility: visible !important; ' +
                'opacity: 1 !important; ' +
                'transition: none !important;'
            );

            // Debug the applied styles
            setTimeout(() => {
                console.log('Main title styles after JS:', window.getComputedStyle(cashFormTitle));
                console.log('Main title display:', window.getComputedStyle(cashFormTitle).display);
                console.log('Main title background:', window.getComputedStyle(cashFormTitle).backgroundColor);
                console.log('Main title color:', window.getComputedStyle(cashFormTitle).color);
                console.log('Main title border:', window.getComputedStyle(cashFormTitle).border);
                console.log('Main title padding:', window.getComputedStyle(cashFormTitle).padding);
                console.log('Main title font-size:', window.getComputedStyle(cashFormTitle).fontSize);
                console.log('Main title font-weight:', window.getComputedStyle(cashFormTitle).fontWeight);
            }, 100);
        }


        if (cashAssetNameInput) cashAssetNameInput.value = asset.name || '';
        if (cashAssetBalanceInput) cashAssetBalanceInput.value = (typeof asset.balance==='number' && !isNaN(asset.balance)) ? String(asset.balance) : '';
        if (deleteCashAssetBtn) try { deleteCashAssetBtn.classList.remove('hidden'); } catch(_) {}
        if (cashAssetCommentsContainer) {
            cashAssetCommentsContainer.innerHTML = '';
            if (Array.isArray(asset.comments) && asset.comments.length) {
                asset.comments.forEach(c=> addCommentSection(cashAssetCommentsContainer, c.title, c.text, false));
            } else {
                addCommentSection(cashAssetCommentsContainer, '', '', true);
            }

            // Force styles and debug the comments title after it's populated
            setTimeout(() => {
                const commentsHeaderRow = document.querySelector('#cashAssetFormModal .comments-form-container .comments-header-row');
                if (commentsHeaderRow) {
                    // Force styles with JavaScript - using inline styles that can't be overridden
                    // Force styles on the header row
                    commentsHeaderRow.setAttribute('style',
                        'display: flex !important; ' +
                        'justify-content: space-between !important; ' +
                        'align-items: center !important; ' +
                        'flex-direction: row !important; ' +
                        'margin: 0 0 12px 0 !important; ' +
                        'font-size: 1rem !important; ' +
                        'font-weight: 600 !important; ' +
                        'color: var(--text-color) !important; ' +
                        'background-color: var(--input-bg) !important; ' +
                        'background: var(--input-bg) !important; ' +
                        'border: 1px solid var(--input-border) !important; ' +
                        'border-radius: 6px !important; ' +
                        'box-shadow: none !important; ' +
                        'text-shadow: none !important; ' +
                        'padding: 12px 14px !important; ' +
                        'width: 100% !important; ' +
                        'min-height: 30px !important; ' +
                        'line-height: 1.4 !important; ' +
                        'box-sizing: border-box !important; ' +
                        'visibility: visible !important; ' +
                        'opacity: 1 !important; ' +
                        'transition: border-color 0.2s ease !important; ' +
                        'cursor: default !important;'
                    );

                    // Force styles on the add button using inline styles
                    const addButton = commentsHeaderRow.querySelector('.add-section-icon');
                    if (addButton) {
                        // Force remove any hidden classes
                        addButton.classList.remove('hidden');
                        addButton.classList.remove('is-disabled-icon');

                        addButton.setAttribute('style',
                            'flex-shrink: 0 !important; ' +
                            'margin-left: auto !important; ' +
                            'display: inline-flex !important; ' +
                            'align-items: center !important; ' +
                            'justify-content: center !important; ' +
                            'visibility: visible !important; ' +
                            'opacity: 1 !important; ' +
                            'background: transparent !important; ' +
                            'border: none !important; ' +
                            'color: #007bff !important; ' +
                            'cursor: pointer !important; ' +
                            'width: 30px !important; ' +
                            'height: 30px !important; ' +
                            'border-radius: 50% !important; ' +
                            'position: static !important;'
                        );

                        const icon = addButton.querySelector('i');
                        if (icon) {
                            icon.setAttribute('style',
                                'display: inline-block !important; ' +
                                'visibility: visible !important; ' +
                                'opacity: 1 !important; ' +
                                'font-size: 1.2em !important; ' +
                                'position: static !important;'
                            );
                        }
                    } else {
                        console.error('Add button not found in comments header row');
                    }

                    console.log('Comments header row found:', commentsHeaderRow);
                    console.log('Comments header row innerHTML:', commentsHeaderRow.innerHTML);
                    console.log('Add button found:', addButton);
                    console.log('Add button computed styles:', addButton ? window.getComputedStyle(addButton) : 'N/A');
                    console.log('Add button display:', addButton ? window.getComputedStyle(addButton).display : 'N/A');
                    console.log('Add button visibility:', addButton ? window.getComputedStyle(addButton).visibility : 'N/A');
                    console.log('Add button opacity:', addButton ? window.getComputedStyle(addButton).opacity : 'N/A');
                    console.log('Add button classList:', addButton ? addButton.classList : 'N/A');
                    console.log('Add button innerHTML:', addButton ? addButton.innerHTML : 'N/A');
                    console.log('Comments header row styles after JS:', window.getComputedStyle(commentsHeaderRow));
                    console.log('Comments header row display:', window.getComputedStyle(commentsHeaderRow).display);
                    console.log('Comments header row background:', window.getComputedStyle(commentsHeaderRow).backgroundColor);
                    console.log('Comments header row color:', window.getComputedStyle(commentsHeaderRow).color);
                    console.log('Comments header row border:', window.getComputedStyle(commentsHeaderRow).border);
                    console.log('Comments header row border-radius:', window.getComputedStyle(commentsHeaderRow).borderRadius);
                    console.log('Comments header row padding:', window.getComputedStyle(commentsHeaderRow).padding);
                    console.log('Comments header row font-size:', window.getComputedStyle(commentsHeaderRow).fontSize);
                    console.log('Comments header row flex-direction:', window.getComputedStyle(commentsHeaderRow).flexDirection);
                    console.log('Comments header row justify-content:', window.getComputedStyle(commentsHeaderRow).justifyContent);
                } else {
                    console.error('Comments header row not found');
                }
            }, 200);
        }
        if (addCashAssetCommentBtn) try { addCashAssetCommentBtn.classList.remove('hidden'); } catch(_) {}
    // isHidden is managed on the card via the on-card toggle; modal does not expose a hide checkbox
        if (deleteCashAssetBtn) {
            try {
                deleteCashAssetBtn.onclick = null;
                deleteCashAssetBtn.onclick = async function() {
                    try {
                        // Get the asset name for the toast notification
                        const assets = getUserCashCategories() || [];
                        const assetToDelete = assets.find(a => a && a.id === window.selectedCashAssetDocId);
                        const assetName = assetToDelete ? assetToDelete.name : 'Cash Asset';

                        // Delete immediately without confirmation
                        if (window.AppService && typeof window.AppService.deleteCashCategory === 'function') {
                            await window.AppService.deleteCashCategory(window.selectedCashAssetDocId);
                        }

                        // Show success toast with asset name
                        try {
                            window.showCustomAlert && window.showCustomAlert(`"${assetName}" deleted successfully!`, 1500);
                        } catch(e) {
                            console.error('Error showing toast:', e);
                        }

                        // Update UI and close modal
                        try { if (typeof window.renderCashCategories === 'function') window.renderCashCategories(); } catch(_) {}
                        try { if (typeof window.calculateTotalCash === 'function') window.calculateTotalCash(); } catch(_) {}
                        try { if (window.closeModals) window.closeModals(); else if (cashAssetFormModal) cashAssetFormModal.style.display='none'; } catch(_) {}
                    } catch(e) {
                        console.error('Delete cash asset failed', e);
                        try { window.showCustomAlert && window.showCustomAlert('Failed to delete cash asset.', 2000); } catch(_) {}
                    }
                };
            } catch(_) {}
        }
    } else {
        if (cashFormTitle) {
            cashFormTitle.textContent = 'Add New Cash Asset';
            // Force styles with inline styles that can't be overridden - PLAIN TEXT
            cashFormTitle.setAttribute('style',
                'display: block !important; ' +
                'font-size: 2.2em !important; ' +
                'font-weight: 800 !important; ' +
                'margin: 0 !important; ' +
                'padding: 0 !important; ' +
                'color: var(--text-color) !important; ' +
                'background: transparent !important; ' +
                'background-color: transparent !important; ' +
                'border: none !important; ' +
                'border-radius: 0 !important; ' +
                'box-shadow: none !important; ' +
                'text-shadow: none !important; ' +
                'line-height: 1.1 !important; ' +
                'text-align: left !important; ' +
                'width: auto !important; ' +
                'visibility: visible !important; ' +
                'opacity: 1 !important; ' +
                'transition: none !important;'
            );
        }
        if (cashAssetNameInput) cashAssetNameInput.value = '';
        if (cashAssetBalanceInput) cashAssetBalanceInput.value = '';
        if (cashAssetCommentsContainer) {
            cashAssetCommentsContainer.innerHTML = '';
            addCommentSection(cashAssetCommentsContainer, '', '', true);

            // Force styles for comments title in add mode
            setTimeout(() => {
                const commentsHeaderRow = document.querySelector('#cashAssetFormModal .comments-form-container .comments-header-row');
                if (commentsHeaderRow) {
                    commentsHeaderRow.setAttribute('style',
                        'display: flex !important; ' +
                        'justify-content: space-between !important; ' +
                        'align-items: center !important; ' +
                        'flex-direction: row !important; ' +
                        'margin: 0 0 12px 0 !important; ' +
                        'font-size: 1rem !important; ' +
                        'font-weight: 600 !important; ' +
                        'color: var(--text-color) !important; ' +
                        'background-color: var(--input-bg) !important; ' +
                        'background: var(--input-bg) !important; ' +
                        'border: 1px solid var(--input-border) !important; ' +
                        'border-radius: 6px !important; ' +
                        'box-shadow: none !important; ' +
                        'text-shadow: none !important; ' +
                        'padding: 12px 14px !important; ' +
                        'width: 100% !important; ' +
                        'min-height: 30px !important; ' +
                        'line-height: 1.4 !important; ' +
                        'box-sizing: border-box !important; ' +
                        'visibility: visible !important; ' +
                        'opacity: 1 !important; ' +
                        'transition: border-color 0.2s ease !important; ' +
                        'cursor: default !important;'
                    );

                    const addButton = commentsHeaderRow.querySelector('.add-section-icon');
                    if (addButton) {
                        // Force remove any hidden classes
                        addButton.classList.remove('hidden');
                        addButton.classList.remove('is-disabled-icon');

                        addButton.setAttribute('style',
                            'flex-shrink: 0 !important; ' +
                            'margin-left: auto !important; ' +
                            'display: inline-flex !important; ' +
                            'align-items: center !important; ' +
                            'justify-content: center !important; ' +
                            'visibility: visible !important; ' +
                            'opacity: 1 !important; ' +
                            'background: transparent !important; ' +
                            'border: none !important; ' +
                            'color: #007bff !important; ' +
                            'cursor: pointer !important; ' +
                            'width: 30px !important; ' +
                            'height: 30px !important; ' +
                            'border-radius: 50% !important; ' +
                            'position: static !important;'
                        );

                        const icon = addButton.querySelector('i');
                        if (icon) {
                            icon.setAttribute('style',
                                'display: inline-block !important; ' +
                                'visibility: visible !important; ' +
                                'opacity: 1 !important; ' +
                                'font-size: 1.2em !important; ' +
                                'position: static !important;'
                            );
                        }
                    } else {
                        console.error('Add button not found in comments header row (add mode)');
                    }
                }
            }, 200);
        }
        if (addCashAssetCommentBtn) try { addCashAssetCommentBtn.classList.remove('hidden'); } catch(_) {}
    // Modal reset: isHidden remains controlled by the card state; no modal checkbox to reset
        try { window.selectedCashAssetDocId = null; } catch(_) {}
    }

    try { window.setIconDisabled && window.setIconDisabled(document.getElementById('saveCashAssetBtn'), true); } catch(_) {}
    try {
        try { window.logDebug && window.logDebug('UI: Showing cash asset modal for ID=' + (assetIdToEdit || 'new')); } catch(_) {}
        try { console.trace && console.trace('TRACE: showAddEditCashCategoryModal called for ID=' + (assetIdToEdit || 'new')); } catch(_) {}
        window.showModal ? window.showModal(cashAssetFormModal) : cashAssetFormModal.classList.remove('app-hidden');
        cashAssetFormModal.style.display='flex';
    } catch(_) {}

    // FINAL FORCE: Ensure add button is visible after modal is shown
    setTimeout(() => {
        const addBtn = document.getElementById('addCashAssetCommentBtn');
        if (addBtn) {
            addBtn.classList.remove('hidden');
            addBtn.classList.remove('is-disabled-icon');
            addBtn.style.display = 'inline-flex';
            addBtn.style.visibility = 'visible';
            addBtn.style.opacity = '1';
            console.log('FINAL FORCE: Add button visibility ensured');
        } else {
            console.error('FINAL FORCE: Add button not found');
        }
    }, 100);

    // FINAL POSITIONING FORCE: ensure comments title, action-row and container reflect desired offsets
    setTimeout(() => {
        try {
            const titleContainer = document.querySelector('#cashAssetFormModal .comments-title-container');
            if (titleContainer) {
                // Move down 15px relative to previous -12px -> 3px
                titleContainer.style.position = 'absolute';
                titleContainer.style.left = '-1px';
                titleContainer.style.top = '23px';
            }

            const commentsForm = document.querySelector('#cashAssetFormModal .comments-form-container');
            if (commentsForm) {
                // Increase top padding so content sits lower (moved down 15px)
                commentsForm.style.paddingTop = '69px';
            }

            const actionRow = document.querySelector('#cashAssetFormModal .comments-form-container .comments-action-row');
            if (actionRow) {
                actionRow.style.position = 'absolute';
                actionRow.style.left = '25px';
                actionRow.style.top = '33px';
            }
            console.log('FINAL POSITIONING FORCE: applied inline styles for cash modal comments');
        } catch (e) { console.error('Error applying final positioning force', e); }
    }, 140);

    // Positioning is handled by CSS; previous JS-based positioning removed.

    try { (cashAssetNameInput || {}).focus && cashAssetNameInput.focus(); } catch(_) {}
    try { window.checkCashAssetFormDirtyState && window.checkCashAssetFormDirtyState(); } catch(_) {}
}

try { window.showAddEditCashCategoryModal = showAddEditCashCategoryModal; } catch(_) {}

// Ensure the comments area positioning is reapplied whenever the cash modal DOM updates
function applyCashCommentsOffsets() {
    try {
        const modal = document.getElementById('cashAssetFormModal');
        if (!modal) return;
        const titleContainer = modal.querySelector('.comments-title-container');
        if (titleContainer) {
            titleContainer.style.position = 'absolute';
            titleContainer.style.left = '-1px';
            titleContainer.style.top = '23px';
        }
        const commentsForm = modal.querySelector('.comments-form-container');
        if (commentsForm) {
            commentsForm.style.paddingTop = '69px';
        }
        const actionRow = modal.querySelector('.comments-form-container .comments-action-row');
        if (actionRow) {
            actionRow.style.position = 'absolute';
            actionRow.style.left = '25px';
            actionRow.style.top = '33px';
        }
        // Debug hook
        try { console.log('applyCashCommentsOffsets executed'); } catch(_) {}
    } catch (e) { try { console.error('applyCashCommentsOffsets error', e); } catch(_) {} }
}

try {
    const cashModal = document.getElementById('cashAssetFormModal');
    if (cashModal) {
        // Observe subtree and attribute changes to reapply positions when elements are added/changed
        const mo = new MutationObserver((mutations) => {
            applyCashCommentsOffsets();
        });
        mo.observe(cashModal, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        // Apply immediately in case modal already present
        setTimeout(applyCashCommentsOffsets, 50);
    }
} catch(_) {}

