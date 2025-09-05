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
		// Clear forced styles when hiding
		asxCodeButtonsContainer.style.display = '';
		asxCodeButtonsContainer.style.opacity = '';
		asxCodeButtonsContainer.style.maxHeight = '';

	}

	if (!hasButtons) {
		toggleAsxButtonsBtn.style.display = 'none';
		toggleAsxButtonsBtn.setAttribute('aria-disabled', 'true');
	} else {
		toggleAsxButtonsBtn.style.display = 'inline-flex';
		toggleAsxButtonsBtn.removeAttribute('aria-disabled');
	}

	try {
		toggleAsxButtonsBtn.setAttribute('aria-pressed', String(!!shouldShow));
		toggleAsxButtonsBtn.setAttribute('aria-expanded', String(!!shouldShow));
		const labelSpan = toggleAsxButtonsBtn.querySelector('.asx-toggle-label');
		if (labelSpan) labelSpan.textContent = 'ASX Codes';
	} catch(_) {}

	const chevronIcon = toggleAsxButtonsBtn.querySelector('.asx-toggle-triangle');
	if (chevronIcon) chevronIcon.classList.toggle('expanded', shouldShow);

	try { if (window.adjustMainContentPadding) requestAnimationFrame(window.adjustMainContentPadding); } catch(_) {}
}

export function toggleCodeButtonsArrow() {
	const toggleAsxButtonsBtn = document.getElementById('toggleAsxButtonsBtn');
	const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');

	if (!toggleAsxButtonsBtn) {
		console.warn('toggleCodeButtonsArrow: toggleAsxButtonsBtn not found');
		return;
	}

	const selIds = getCurrentSelectedWatchlistIds();
	const current = (selIds && selIds[0]) || null;
	const CASH_ID = (typeof window !== 'undefined' && window.CASH_BANK_WATCHLIST_ID) ? window.CASH_BANK_WATCHLIST_ID : 'cashBank';

	if (current === CASH_ID) {
		toggleAsxButtonsBtn.style.display = 'none';
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
		if (asxCodeButtonsContainer) {
			asxCodeButtonsContainer.classList.remove('app-hidden');
			if (getAsxButtonsExpanded()) {
				asxCodeButtonsContainer.style.display = 'flex';
			}
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
	const hideCashAssetCheckbox = document.getElementById('hideCashAssetCheckbox');
	return {
		name: (cashAssetNameInput && cashAssetNameInput.value ? cashAssetNameInput.value : '').trim(),
		balance: cashAssetBalanceInput ? parseFloat(cashAssetBalanceInput.value) : NaN,
		comments: comments,
		isHidden: !!(hideCashAssetCheckbox && hideCashAssetCheckbox.checked)
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
    let sorted = Array.isArray(categories) ? [...categories] : [];
    if (field === 'balance') {
        sorted.sort((a,b)=>{
            const aN = (typeof a.balance === 'number' && !isNaN(a.balance)) ? a.balance : (order==='asc'?Infinity:-Infinity);
            const bN = (typeof b.balance === 'number' && !isNaN(b.balance)) ? b.balance : (order==='asc'?Infinity:-Infinity);
            return order==='asc' ? aN-bN : bN-aN;
        });
    } else if (field === 'name') {
        sorted.sort((a,b)=> (a.name||'').toUpperCase().localeCompare((b.name||'').toUpperCase()));
        if (order==='desc') sorted.reverse();
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
            try { showAddEditCashCategoryModal(category.id); } catch(_) {}
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
    const hideCashAssetCheckbox = document.getElementById('hideCashAssetCheckbox');
    if (!cashAssetFormModal) return;

    function addCommentSection(container, title, text, focus) {
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.className = 'comment-section';
        const titleInput = document.createElement('input');
        titleInput.className = 'comment-title-input';
        titleInput.placeholder = 'Title';
        titleInput.value = typeof title === 'string' ? title : '';
        const textArea = document.createElement('textarea');
        textArea.className = 'comment-text-input';
        textArea.placeholder = 'Comment';
        textArea.value = typeof text === 'string' ? text : '';
        wrap.appendChild(titleInput);
        wrap.appendChild(textArea);
        container.appendChild(wrap);
        if (focus) {
            try { titleInput.focus(); } catch(_) {}
        }
    }

    if (assetIdToEdit) {
        const asset = (getUserCashCategories()||[]).find(a=>a && a.id===assetIdToEdit);
        if (!asset) { try { window.showCustomAlert && window.showCustomAlert('Cash asset not found.'); } catch(_) {} return; }
        try { window.selectedCashAssetDocId = assetIdToEdit; } catch(_) {}
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
                const commentsTitle = document.querySelector('#cashAssetFormModal .comments-form-container h3');
                if (commentsTitle) {
                    // Force styles with JavaScript - using inline styles that can't be overridden
                    commentsTitle.setAttribute('style',
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
                    const addButton = commentsTitle.querySelector('.add-section-icon');
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
                        console.error('Add button not found in comments title');
                    }

                    console.log('Comments title found:', commentsTitle);
                    console.log('Comments title text:', commentsTitle.textContent);
                    console.log('Comments title innerHTML:', commentsTitle.innerHTML);
                    console.log('Add button found:', addButton);
                    console.log('Add button computed styles:', addButton ? window.getComputedStyle(addButton) : 'N/A');
                    console.log('Add button display:', addButton ? window.getComputedStyle(addButton).display : 'N/A');
                    console.log('Add button visibility:', addButton ? window.getComputedStyle(addButton).visibility : 'N/A');
                    console.log('Add button opacity:', addButton ? window.getComputedStyle(addButton).opacity : 'N/A');
                    console.log('Add button classList:', addButton ? addButton.classList : 'N/A');
                    console.log('Add button innerHTML:', addButton ? addButton.innerHTML : 'N/A');
                    console.log('Comments title styles after JS:', window.getComputedStyle(commentsTitle));
                    console.log('Comments title display:', window.getComputedStyle(commentsTitle).display);
                    console.log('Comments title background:', window.getComputedStyle(commentsTitle).backgroundColor);
                    console.log('Comments title color:', window.getComputedStyle(commentsTitle).color);
                    console.log('Comments title border:', window.getComputedStyle(commentsTitle).border);
                    console.log('Comments title border-radius:', window.getComputedStyle(commentsTitle).borderRadius);
                    console.log('Comments title padding:', window.getComputedStyle(commentsTitle).padding);
                    console.log('Comments title font-size:', window.getComputedStyle(commentsTitle).fontSize);
                    console.log('Comments title flex-direction:', window.getComputedStyle(commentsTitle).flexDirection);
                    console.log('Comments title justify-content:', window.getComputedStyle(commentsTitle).justifyContent);
                } else {
                    console.error('Comments title not found');
                }
            }, 200);
        }
        if (addCashAssetCommentBtn) try { addCashAssetCommentBtn.classList.remove('hidden'); } catch(_) {}
        if (hideCashAssetCheckbox) hideCashAssetCheckbox.checked = !!asset.isHidden;
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
                const commentsTitle = document.querySelector('#cashAssetFormModal .comments-form-container h3');
                if (commentsTitle) {
                    commentsTitle.setAttribute('style',
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

                    const addButton = commentsTitle.querySelector('.add-section-icon');
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
                        console.error('Add button not found in comments title (add mode)');
                    }
                }
            }, 200);
        }
        if (addCashAssetCommentBtn) try { addCashAssetCommentBtn.classList.remove('hidden'); } catch(_) {}
        if (hideCashAssetCheckbox) hideCashAssetCheckbox.checked = false;
        try { window.selectedCashAssetDocId = null; } catch(_) {}
    }

    try { window.setIconDisabled && window.setIconDisabled(document.getElementById('saveCashAssetBtn'), true); } catch(_) {}
    try { window.showModal ? window.showModal(cashAssetFormModal) : cashAssetFormModal.classList.remove('app-hidden'); cashAssetFormModal.style.display='flex'; } catch(_) {}

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

    try { (cashAssetNameInput || {}).focus && cashAssetNameInput.focus(); } catch(_) {}
    try { window.checkCashAssetFormDirtyState && window.checkCashAssetFormDirtyState(); } catch(_) {}
}

try { window.showAddEditCashCategoryModal = showAddEditCashCategoryModal; } catch(_) {}

