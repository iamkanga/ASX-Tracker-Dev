// UI helper functions extracted from script.js
// This module will contain utility functions for UI updates, modals, alerts, etc.

export function logDebug(message, ...optionalParams) {
    if (window.DEBUG_MODE) {
        console.log(message, ...optionalParams);
    }
}

export function showCustomAlert(message, duration = 1000) {
    // ...implementation from script.js...
}
