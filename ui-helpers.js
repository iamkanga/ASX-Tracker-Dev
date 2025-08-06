// --- Number Formatting Helper (migrated from script.js) ---
/**
 * Formats a user-entered number for display in form fields, preserving up to 3 decimals, stripping trailing zeros.
 * Returns an empty string for null/NaN/undefined.
 * @param {number|string} value
 * @returns {string}
 */
export function formatUserDecimalStrict(value) {
    if (value === null || value === undefined || isNaN(Number(value))) return '';
    // Always show up to 3 decimals, but strip trailing zeros (e.g., 1.50 -> 1.5, 2.000 -> 2)
    let num = Number(value);
    let str = num.toFixed(3);
    // Remove trailing zeros and decimal if not needed
    str = str.replace(/\.0+$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1');
    return str;
}
// --- Share/Watchlist UI Clearing Helpers (added for modularization) ---
/**
 * Clears the share list UI (table and mobile cards).
 */
export function clearShareList() {
    const shareTableBody = document.querySelector('#shareTable tbody');
    if (shareTableBody) shareTableBody.innerHTML = '';
    const mobileCards = document.querySelectorAll('.mobile-card');
    mobileCards.forEach(card => card.remove());
}

/**
 * Clears the share list UI (alias for clearShareList for legacy code).
 */
export function clearShareListUI() {
    clearShareList();
}

/**
 * Clears the watchlist dropdown UI.
 */
export function clearWatchlistUI() {
    const watchlistSelect = document.getElementById('watchlistSelect');
    if (watchlistSelect) watchlistSelect.innerHTML = '';
}
// --- Selection Helpers (migrated from script.js) ---
/**
 * Selects a share in both table and mobile card views.
 * @param {string} shareId
 * @param {function} logDebug
 * @param {function} deselectCurrentShare
 * @param {object} context (optional) - pass { selectedShareDocId } to update selection state
 */
export function selectShare(shareId, logDebug, deselectCurrentShare, context = window) {
    logDebug('Selection: Attempting to select share with ID: ' + shareId);
    deselectCurrentShare();

    const tableRow = document.querySelector('#shareTable tbody tr[data-doc-id="' + shareId + '"]');
    const mobileCard = document.querySelector('.mobile-card[data-doc-id="' + shareId + '"]');

    if (tableRow) {
        tableRow.classList.add('selected');
        logDebug('Selection: Selected table row for ID: ' + shareId);
    }
    if (mobileCard) {
        mobileCard.classList.add('selected');
        logDebug('Selection: Selected mobile card for ID: ' + shareId);
    }
    context.selectedShareDocId = shareId;
}

/**
 * Deselects any currently selected share in both table and mobile card views.
 * @param {function} logDebug
 * @param {object} context (optional) - pass { selectedShareDocId } to update selection state
 */
export function deselectCurrentShare(logDebug, context = window) {
    const currentlySelected = document.querySelectorAll('.share-list-section tr.selected, .mobile-card.selected');
    logDebug('Selection: Attempting to deselect ' + currentlySelected.length + ' elements.');
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    context.selectedShareDocId = null;
    logDebug('Selection: Share deselected. selectedShareDocId is now null.');
}
// --- UI Helper Functions (Modularized) ---
// These helpers were moved from script.js for maintainability.

// --- UI State Management Helpers (migrated from script.js) ---
// These are helpers used for compact view, main content padding, and button state

/**
 * Adjusts the main content padding based on the visibility of the sidebar or other overlays.
 * Ensures the main content is not hidden behind fixed UI elements.
 */
export function adjustMainContentPadding() {
    const mainContent = document.getElementById('mainContent');
    const appSidebar = document.getElementById('appSidebar');
    if (!mainContent) return;
    if (appSidebar && appSidebar.classList.contains('open')) {
        mainContent.style.paddingLeft = '260px';
    } else {
        mainContent.style.paddingLeft = '';
    }
}

/**
 * Applies or removes the compact view mode for the main content area.
 * @param {boolean} enable True to enable compact view, false to disable.
 */
export function applyCompactViewMode(enable) {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    if (enable) {
        mainContent.classList.add('compact-view');
    } else {
        mainContent.classList.remove('compact-view');
    }
}

/**
 * Updates the enabled/disabled state of main action buttons based on app state.
 * E.g., disables buttons if no share is selected, or if in a modal, etc.
 */
export function updateMainButtonsState() {
    const saveShareBtn = document.getElementById('saveShareBtn');
    const deleteShareBtn = document.getElementById('deleteShareBtn');
    if (saveShareBtn) saveShareBtn.disabled = false;
    if (deleteShareBtn) deleteShareBtn.disabled = false;
}

/**
 * Updates the state of the compact view toggle button (active/inactive).
 * @param {boolean} isActive True if compact view is active, false otherwise.
 */
export function updateCompactViewButtonState(isActive) {
    const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');
    if (!toggleCompactViewBtn) return;
    if (isActive) {
        toggleCompactViewBtn.classList.add('active');
    } else {
        toggleCompactViewBtn.classList.remove('active');
    }
}
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
