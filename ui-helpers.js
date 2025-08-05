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
