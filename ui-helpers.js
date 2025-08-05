// Helper to format decimals: always show 2 decimals, show 3 only if user entered it
export function formatUserDecimalStrict(value) {
    if (value === null || isNaN(value)) return '';
    let str = value.toString();
    if (!str.includes('.')) return value.toFixed(2); // No decimals entered
    let [intPart, decPart] = str.split('.');
    if (decPart.length === 3) {
        // User entered 3 decimals
        return intPart + '.' + decPart;
    } else if (decPart.length === 2) {
        return intPart + '.' + decPart;
    } else if (decPart.length === 1) {
        return intPart + '.' + decPart.padEnd(2, '0');
    } else {
        // More than 3 decimals, round to 3
        return Number(value).toFixed(3);
    }
}

// Adjusts the top padding of the main content area to prevent it from being hidden by the fixed header.
export function adjustMainContentPadding() {
    const appHeader = document.getElementById('appHeader');
    const mainContainer = document.querySelector('main.container');
    if (appHeader && mainContainer) {
        const headerHeight = appHeader.offsetHeight;
        mainContainer.style.paddingTop = `${headerHeight}px`;
        logDebug('Layout: Adjusted main content padding-top to: ' + headerHeight + 'px (Full Header Height).');
    } else {
        console.warn('Layout: Could not adjust main content padding-top: appHeader or mainContainer not found.');
    }
}

// Helper to ensure compact mode class is always applied
export function applyCompactViewMode() {
    const mobileShareCardsContainer = document.getElementById('mobileShareCards');
    const currentMobileViewMode = window.currentMobileViewMode || 'default';
    if (mobileShareCardsContainer) {
        if (currentMobileViewMode === 'compact') {
            mobileShareCardsContainer.classList.add('compact-view');
        } else {
            mobileShareCardsContainer.classList.remove('compact-view');
        }
    }
}

// Enables or disables the 'Toggle Compact View' button based on screen width.
export function updateCompactViewButtonState() {
    const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');
    if (!toggleCompactViewBtn) return;
    // Always enable the button, regardless of screen width
    toggleCompactViewBtn.disabled = false;
    toggleCompactViewBtn.title = "Toggle between default and compact card view.";
    logDebug(`UI State: Compact view button enabled for all screen widths.`);
}

// Show a modal dialog
export function showModal(modalElement) {
    if (modalElement) {
        if (typeof window.pushAppState === 'function') {
            window.pushAppState({ modalId: modalElement.id }, '', '');
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

// Hide a modal dialog
export function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        logDebug('Modal: Hiding modal: ' + modalElement.id);
    }
}

// Clear the watchlist UI
export function clearWatchlistUI() {
    const watchlistSelect = document.getElementById('watchlistSelect');
    if (!watchlistSelect) { console.error('clearWatchlistUI: watchlistSelect element not found.'); return; }
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';
    if (window.userWatchlists) window.userWatchlists = [];
    if (window.currentSelectedWatchlistIds) window.currentSelectedWatchlistIds = [];
    logDebug('UI: Watchlist UI cleared.');
}

// Clear the share list UI (table and mobile cards)
export function clearShareListUI() {
    const shareTableBody = document.querySelector('#shareTable tbody');
    const mobileShareCardsContainer = document.getElementById('mobileShareCards');
    if (!shareTableBody) { console.error('clearShareListUI: shareTableBody element not found.'); return; }
    if (!mobileShareCardsContainer) { console.error('clearShareListUI: mobileShareCardsContainer element not found.'); return; }
    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';
    logDebug('UI: Share list UI cleared.');
}

// Clear the share list data (array) and UI
export function clearShareList() {
    clearShareListUI();
    const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    if (asxCodeButtonsContainer) asxCodeButtonsContainer.innerHTML = '';
    if (typeof window.deselectCurrentShare === 'function') window.deselectCurrentShare();
    logDebug('UI: Full share list cleared (UI + buttons).');
}
// --- UI Helper Functions (Modularized) ---
// These helpers were moved from script.js for maintainability.

// Custom logging function to control verbosity
export function logDebug(message, ...optionalParams) {
    // DEBUG_MODE is expected to be defined in script.js
    if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
        console.log(message, ...optionalParams);
    }
}

/**
 * Helper function to apply/remove a disabled visual state to non-button elements (like spans/icons).
 * This adds/removes the 'is-disabled-icon' class, which CSS then styles.
 * @param {HTMLElement} element The element to disable/enable.
 * @param {boolean} isDisabled True to disable, false to enable.
 */
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

// Custom Dialog (Alert) Function
export function showCustomAlert(message, duration = 1000) {
    const customDialogModal = document.getElementById('customDialogModal');
    const customDialogMessage = document.getElementById('customDialogMessage');
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const dialogButtonsContainer = document.querySelector('#customDialogModal .custom-dialog-buttons');

    logDebug('showCustomAlert: confirmBtn found: ' + !!confirmBtn + ', cancelBtn found: ' + !!cancelBtn + ', dialogButtonsContainer found: ' + !!dialogButtonsContainer);

    if (!customDialogModal || !customDialogMessage || !confirmBtn || !cancelBtn || !dialogButtonsContainer) {
        console.error('Custom dialog elements not found. Cannot show alert.');
        console.log('ALERT (fallback): ' + message);
        return;
    }
    customDialogMessage.textContent = message;

    dialogButtonsContainer.style.display = 'none'; // Explicitly hide the container
    logDebug('showCustomAlert: dialogButtonsContainer display set to: ' + dialogButtonsContainer.style.display);

    if (typeof showModal === 'function') {
        showModal(customDialogModal);
    } else if (customDialogModal && customDialogModal.style) {
        customDialogModal.style.display = 'block';
    }
    if (window.autoDismissTimeout) { clearTimeout(window.autoDismissTimeout); }
    window.autoDismissTimeout = setTimeout(() => {
        if (typeof hideModal === 'function') {
            hideModal(customDialogModal);
        } else if (customDialogModal && customDialogModal.style) {
            customDialogModal.style.display = 'none';
        }
        window.autoDismissTimeout = null;
    }, duration);
    logDebug('Alert: Showing alert: "' + message + '"');
}

// Date Formatting Helper Functions (Australian Style)
export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
