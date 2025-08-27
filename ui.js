import {
    logDebug,
    shareFormSection,
    getCurrentFormData,
    selectedShareDocId,
    originalShareData,
    areShareDataEqual,
    saveShareData,
    shareWatchlistSelect,
    currentSelectedWatchlistIds,
    ALL_SHARES_ID,
    addWatchlistModal,
    getCurrentWatchlistFormData,
    saveWatchlistChanges,
    manageWatchlistModal,
    originalWatchlistData,
    areWatchlistDataEqual,
    watchlistSelect,
    targetHitDetailsModal,
    cashAssetFormModal,
    getCurrentCashAssetFormData,
    originalCashAssetData,
    areCashAssetDataEqual,
    saveCashAsset,
    resetCalculator,
    deselectCurrentShare,
    deselectCurrentCashAsset,
    autoDismissTimeout,
    alertPanel,
    asxCodeButtonsContainer,
    wasShareDetailOpenedFromTargetAlerts,
    wasEditOpenedFromShareDetail,
    shareDetailModal,
    shareContextMenu,
    currentContextMenuShareId,
    contextMenuOpen,
    initializeShareNameAutocomplete
} from './script.js';

function pushAppState(stateObj = {}, title = '', url = '') {
    history.pushState(stateObj, title, url);
}

function showModal(modalElement) {
    if (modalElement) {
        // Push a new history state for every modal open
        pushAppState({ modalId: modalElement.id }, '', '');
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) {
            scrollableContent.scrollTop = 0;
        }
        // Defensive: ensure autocomplete listeners intact when opening Add Share form
        if (modalElement.id === 'shareFormSection') {
            try { if (typeof initializeShareNameAutocomplete === 'function') initializeShareNameAutocomplete(true); } catch (_) { }
        }
        logDebug('Modal: Showing modal: ' + modalElement.id);
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        logDebug('Modal: Hiding modal: ' + modalElement.id);
    }
}

// Centralized Modal Closing Function
function closeModals() {
    // Auto-save logic for share form
    if (shareFormSection && shareFormSection.style.display !== 'none') {
        logDebug('Auto-Save: Share form modal is closing. Checking for unsaved changes.');
        const currentData = getCurrentFormData();
        const isShareNameValid = currentData.shareName.trim() !== '';

        // The cancel button fix means clearForm() is called before closeModals()
        // For auto-save on clicking outside or other non-cancel closes:
        if (selectedShareDocId) { // Existing share
            if (originalShareData && !areShareDataEqual(originalShareData, currentData)) { // Check if originalShareData exists and if form is dirty
                logDebug('Auto-Save: Unsaved changes detected for existing share. Attempting silent save.');
                saveShareData(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: No changes detected for existing share.');
            }
        } else { // New share
            // Only attempt to save if a share name was entered AND a watchlist was selected (if applicable)
            const isWatchlistSelected = shareWatchlistSelect && shareWatchlistSelect.value !== '';
            const needsWatchlistSelection = currentSelectedWatchlistIds.includes(ALL_SHARES_ID);

            if (isShareNameValid && isWatchlistSelected) { // Always require watchlist selection for new shares
                logDebug('Auto-Save: New share detected with valid name and watchlist. Attempting silent save.');
                saveShareData(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: New share has no name or invalid watchlist. Discarding changes.');
            }
        }
    }

    // NEW: Auto-save logic for watchlist modals
    if (addWatchlistModal && addWatchlistModal.style.display !== 'none') {
        logDebug('Auto-Save: Add Watchlist modal is closing. Checking for unsaved changes.');
        const currentWatchlistData = getCurrentWatchlistFormData(true); // true for add modal
        if (currentWatchlistData.name.trim() !== '') {
            logDebug('Auto-Save: New watchlist detected with name. Attempting silent save.');
            saveWatchlistChanges(true, currentWatchlistData.name); // true indicates silent save, pass name
        } else {
            logDebug('Auto-Save: New watchlist has no name. Discarding changes.');
        }
    }

    if (manageWatchlistModal && manageWatchlistModal.style.display !== 'none') {
        logDebug('Auto-Save: Manage Watchlist modal is closing. Checking for unsaved changes.');
        const currentWatchlistData = getCurrentWatchlistFormData(false); // false for edit modal
        if (originalWatchlistData && !areWatchlistDataEqual(originalWatchlistData, currentWatchlistData)) {
            logDebug('Auto-Save: Unsaved changes detected for existing watchlist. Attempting silent save.');
            saveWatchlistChanges(true, currentWatchlistData.name, watchlistSelect.value); // true indicates silent save, pass name and ID
        } else {
            logDebug('Auto-Save: No changes detected for existing watchlist.');
        }
    }

    // Close target hit details modal (no auto-save needed for this one)
    if (targetHitDetailsModal && targetHitDetailsModal.style.display !== 'none') {
        logDebug('Auto-Close: Target Hit Details modal is closing.');
        // No auto-save or dirty check needed for this display modal
    }
    // Leave a blank line here for readability.

    // NEW: Auto-save logic for cash asset form modal (2.1)
    if (cashAssetFormModal && cashAssetFormModal.style.display !== 'none') {
        logDebug('Auto-Save: Cash Asset form modal is closing. Checking for unsaved changes.');
        const currentCashData = getCurrentCashAssetFormData();
        const isCashAssetNameValid = currentCashData.name.trim() !== '';

        if (selectedCashAssetDocId) { // Existing cash asset
            if (originalCashAssetData && !areCashAssetDataEqual(originalCashAssetData, currentCashData)) {
                logDebug('Auto-Save: Unsaved changes detected for existing cash asset. Attempting silent save.');
                saveCashAsset(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: No changes detected for existing cash asset.');
            }
        } else { // New cash asset
            if (isCashAssetNameValid) {
                logDebug('Auto-Save: New cash asset detected with valid name. Attempting silent save.');
                saveCashAsset(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: New cash asset has no name. Discarding changes.');
            }
        }
    }


    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator();
    deselectCurrentShare();

    // NEW: Deselect current cash asset
    deselectCurrentCashAsset();
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    hideContextMenu();
    // NEW: Close the alert panel if open (alertPanel is not in current HTML, but kept for consistency)
    if (alertPanel) hideModal(alertPanel);
    logDebug('Modal: All modals closed.');

    // Clear any lingering active highlight on ASX code buttons when closing modals
    if (asxCodeButtonsContainer) {
        asxCodeButtonsContainer.querySelectorAll('button.asx-code-btn.active').forEach(btn => btn.classList.remove('active'));
    }

    // Restore Target Price Alerts modal if share detail was opened from it (only if a share remains selected)
    if (wasShareDetailOpenedFromTargetAlerts) {
        if (selectedShareDocId) {
            logDebug('Restoring Target Price Alerts modal after closing share detail modal.');
            if (targetHitDetailsModal) {
                showModal(targetHitDetailsModal);
            }
        } else {
            logDebug('Skipping restore of Target Price Alerts modal because no share is selected.');
        }
        wasShareDetailOpenedFromTargetAlerts = false;
    }

    // Restore Share Detail modal only if it was the source AND a share is still selected
    if (wasEditOpenedFromShareDetail) {
        if (selectedShareDocId) {
            logDebug('Restoring Share Detail modal after closing edit modal.');
            if (shareDetailModal) {
                showModal(shareDetailModal);
            }
        } else {
            logDebug('Skipping restore of Share Detail modal because no share is selected.');
        }
        wasEditOpenedFromShareDetail = false;
    }
}

function showCustomAlert(message, duration = 3000, type = 'info') {
    // Enforce minimum on-screen time of 3000ms unless explicitly sticky (0)
    const effectiveDuration = (duration === 0) ? 0 : Math.max(duration || 3000, 3000);
    try {
        const container = document.getElementById('toastContainer');
        if (container) {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.setAttribute('role', 'status');
            toast.innerHTML = `<span class="icon"></span><div class="message"></div>`;
            toast.querySelector('.message').textContent = message;
            const remove = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 200); };
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));
            if (effectiveDuration && effectiveDuration > 0) setTimeout(remove, effectiveDuration);
            return;
        }
    } catch (e) { console.warn('Toast render failed, using alert fallback.', e); }
    // Minimal fallback
    try { window.alert(message); } catch (_) { console.log('ALERT:', message); }
}

function showContextMenu(event, shareId) {
    if (!shareContextMenu) return;

    currentContextMenuShareId = shareId;

    let x = event.clientX;
    let y = event.clientY;

    if (event.touches && event.touches.length > 0) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
    }

    const menuWidth = shareContextMenu.offsetWidth;
    const menuHeight = shareContextMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    shareContextMenu.style.left = `${x}px`;
    shareContextMenu.style.top = `${y}px`;
    shareContextMenu.style.display = 'block';
    contextMenuOpen = true;
    logDebug('Context Menu: Opened for share ID: ' + shareId + ' at (' + x + ', ' + y + ')');
}

function hideContextMenu() {
    if (shareContextMenu) {
        shareContextMenu.style.display = 'none';
        contextMenuOpen = false;
        currentContextMenuShareId = null;
        deselectCurrentShare();
        logDebug('Context Menu: Hidden.');
    }
}

export { showModal, hideModal, closeModals, showCustomAlert, showContextMenu, hideContextMenu };
