// UI helper functions extracted from script.js
// This module will contain utility functions for UI updates, modals, alerts, etc.
// UI Helper Functions migrated from script.js

// Debug logging
export function logDebug(message, ...optionalParams) {
    if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
        console.log(message, ...optionalParams);
    }
}

// Enable/disable icon button
export function setIconDisabled(element, isDisabled) {
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

// Show custom alert modal
export function showCustomAlert(message, duration = 1000) {
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const dialogButtonsContainer = document.querySelector('#customDialogModal .custom-dialog-buttons');
    logDebug('showCustomAlert: confirmBtn found: ' + !!confirmBtn + ', cancelBtn found: ' + !!cancelBtn + ', dialogButtonsContainer found: ' + !!dialogButtonsContainer);
    if (!window.customDialogModal || !window.customDialogMessage || !confirmBtn || !cancelBtn || !dialogButtonsContainer) {
        console.error('Custom dialog elements not found. Cannot show alert.');
        console.log('ALERT (fallback): ' + message);
        return;
    }
    window.customDialogMessage.textContent = message;
    dialogButtonsContainer.style.display = 'none';
    logDebug('showCustomAlert: dialogButtonsContainer display set to: ' + dialogButtonsContainer.style.display);
    showModal(window.customDialogModal);
    if (window.autoDismissTimeout) { clearTimeout(window.autoDismissTimeout); }
    window.autoDismissTimeout = setTimeout(() => { hideModal(window.customDialogModal); window.autoDismissTimeout = null; }, duration);
    logDebug('Alert: Showing alert: "' + message + '"');
}

// Date formatting (Australian style)
export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Show/hide modal helpers
export function showModal(modalElement) {
    if (modalElement) {
        if (typeof pushAppState === 'function') {
            pushAppState({ modalId: modalElement.id }, '', '');
        }
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) {
            scrollableContent.scrollTop = 0;
        }
        logDebug('Modal: Showing modal: ' + modalElement.id);
    }
}

export function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        logDebug('Modal: Hiding modal: ' + modalElement.id);
    }
}

// Add a comment section to a container
export function addCommentSection(container, title = '', text = '', isCashAssetComment = false) {
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
        commentTitleInput.addEventListener('input', isCashAssetComment ? window.checkCashAssetFormDirtyState : window.checkFormDirtyState);
    }
    if (commentTextInput) {
        commentTextInput.addEventListener('input', isCashAssetComment ? window.checkCashAssetFormDirtyState : window.checkFormDirtyState);
    }
    commentSectionDiv.querySelector('.comment-delete-btn').addEventListener('click', (event) => {
        logDebug('Comments: Delete comment button clicked.');
        event.target.closest('.comment-section').remove();
        isCashAssetComment ? window.checkCashAssetFormDirtyState() : window.checkFormDirtyState();
    });
    logDebug('Comments: Added new comment section.');
}

// Clear the share form
export function clearForm() {
    if (!window.formInputs) return;
    window.formInputs.forEach(input => {
        if (input) { input.value = ''; }
    });
    // Explicitly clear portfolio fields
    const portfolioSharesInput = document.getElementById('portfolioShares');
    const portfolioAvgPriceInput = document.getElementById('portfolioAvgPrice');
    if (portfolioSharesInput) portfolioSharesInput.value = '';
    if (portfolioAvgPriceInput) portfolioAvgPriceInput.value = '';
    if (window.commentsFormContainer) {
        window.commentsFormContainer.innerHTML = '';
    }
    if (window.formTitle) window.formTitle.textContent = 'Add New Share';
    if (window.formCompanyName) window.formCompanyName.textContent = '';
    if (window.addShareLivePriceDisplay) {
        window.addShareLivePriceDisplay.style.display = 'none';
        window.addShareLivePriceDisplay.innerHTML = '';
    }
    window.selectedShareDocId = null;
    window.originalShareData = null;
    if (window.deleteShareBtn) {
        window.deleteShareBtn.classList.add('hidden');
        logDebug('clearForm: deleteShareBtn hidden.');
    }
    if (window.shareWatchlistSelect) {
        window.shareWatchlistSelect.value = '';
        window.shareWatchlistSelect.disabled = false;
    }
    setIconDisabled(window.saveShareBtn, true);
    logDebug('Form: Form fields cleared and selectedShareDocId reset. saveShareBtn disabled.');
}

// Add share to table row
export function addShareToTable(share) {
    if (!window.shareTableBody) {
        console.error('addShareToTable: shareTableBody element not found.');
        return;
    }
    const row = document.createElement('tr');
    row.dataset.docId = share.id;
    row.addEventListener('click', () => {
        logDebug('Table Row Click: Share ID: ' + share.id);
        if (typeof window.selectShare === 'function') window.selectShare(share.id);
        if (row.closest('#targetHitSharesList')) {
            window.wasShareDetailOpenedFromTargetAlerts = true;
        }
        if (typeof window.showShareDetails === 'function') window.showShareDetails();
    });
    const livePriceData = window.livePrices[share.shareName.toUpperCase()];
    const isTargetHit = livePriceData ? livePriceData.targetHit : false;
    if (isTargetHit && !window.targetHitIconDismissed) {
        row.classList.add('target-hit-alert');
    } else {
        row.classList.remove('target-hit-alert');
    }
    const displayData = typeof window.getShareDisplayData === 'function' ? window.getShareDisplayData(share) : {};
    const companyInfo = window.allAsxCodes && window.allAsxCodes.find ? window.allAsxCodes.find(c => c.code === share.shareName.toUpperCase()) : null;
    const companyName = companyInfo ? companyInfo.name : '';
    row.innerHTML = `
        <td>
            <span class="share-code-display ${displayData.priceClass || ''}">${share.shareName || ''}</span>
            <span class="company-name">${companyName}</span>
        </td>
        <td>${displayData.displayLivePrice || ''}</td>
        <td>${displayData.displayPriceChange || ''}</td>
        <td>${displayData.yieldDisplayTable || ''}</td>
        <td>${displayData.peRatio || ''}</td>
        <td>${displayData.high52Week || ''} / ${displayData.low52Week || ''}</td>
    `;
    window.shareTableBody.appendChild(row);
}

// Add share to mobile cards
export function addShareToMobileCards(share) {
    if (!window.mobileShareCardsContainer) {
        console.error('addShareToMobileCards: mobileShareCardsContainer element not found.');
        return;
    }
    const card = document.createElement('div');
    card.classList.add('mobile-card');
    card.dataset.docId = share.id;
    const livePriceData = window.livePrices[share.shareName.toUpperCase()];
    const isMarketOpen = typeof window.isAsxMarketOpen === 'function' ? window.isAsxMarketOpen() : false;
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
                displayLivePrice = '$' + currentLivePrice.toFixed(2);
            }
            if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) {
                const change = currentLivePrice - previousClosePrice;
                const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                displayPriceChange = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : '');
            } else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                const change = lastFetchedLive - lastFetchedPrevClose;
                const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                displayPriceChange = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                cardPriceChangeClass = change > 0 ? 'positive-change-card' : (change < 0 ? 'negative-change-card' : '');
            }
        }
    }
    card.innerHTML = `
        <div class="mobile-card-header">
            <span class="share-code-display ${priceClass}">${share.shareName || ''}</span>
        </div>
        <div class="mobile-card-body">
            <span class="live-price">${displayLivePrice}</span>
            <span class="price-change ${priceClass}">${displayPriceChange}</span>
        </div>
    `;
    window.mobileShareCardsContainer.appendChild(card);
}

export function logDebug(message, ...optionalParams) {
    if (window.DEBUG_MODE) {
        console.log(message, ...optionalParams);
    }
}

export function showCustomAlert(message, duration = 1000) {
    // ...implementation from script.js...
}
