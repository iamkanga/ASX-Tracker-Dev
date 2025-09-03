import { setAllAsxCodes } from './state.js';
import { auth, authFunctions } from '../firebase.js';

// Functions referenced inside the auth state callback come from script.js and UI helpers.
// They are attached on window for backwards compatibility; we safely dereference them here.
function getGlobal(name) {
    try { return window[name]; } catch (_) { return undefined; }
}

export function setupAuthListener(authParam = auth, authFunctionsParam = authFunctions) {
    if (!authParam || !authFunctionsParam || typeof authFunctionsParam.onAuthStateChanged !== 'function') return;
    authFunctionsParam.onAuthStateChanged(authParam, async (user) => {
        // Delegate to script.js handler to keep business logic centralized there.
        const handler = getGlobal('__handleAuthStateChange');
        if (typeof handler === 'function') {
            try {
                await handler(user);
            } catch (e) {
                console.warn('Auth: __handleAuthStateChange failed', e);
            }
            return;
        }
        // Fallback: minimal behavior if handler is unavailable
        try {
            if (user) {
                const updateMainButtonsState = getGlobal('updateMainButtonsState');
                const adjustMainContentPadding = getGlobal('adjustMainContentPadding') || (window.UI && window.UI.adjustMainContentPadding);
                if (typeof updateMainButtonsState === 'function') updateMainButtonsState(true);
                if (typeof adjustMainContentPadding === 'function') adjustMainContentPadding();
            } else {
                const clearShareList = getGlobal('clearShareList');
                const clearWatchlistUI = getGlobal('clearWatchlistUI');
                const applyTheme = getGlobal('applyTheme');
                if (typeof clearShareList === 'function') clearShareList();
                if (typeof clearWatchlistUI === 'function') clearWatchlistUI();
                if (typeof applyTheme === 'function') applyTheme('system-default');
            }
        } catch (_) {}
    });
}


