/**
 * Theme Management Module
 * Handles all theme-related functionality including:
 * - Color theme selection and application
 * - Light/dark mode toggling
 * - Theme persistence and restoration
 * - System preference detection
 */

// Debug: Module loaded
console.log('Theme module loaded successfully');

// --- Theme Constants and Variables ---
let currentActiveTheme = 'system-default'; // Tracks current active theme
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10',
    'Muted Blue', 'Muted Brown', 'Muted Pink', 'Muted Green', 'Muted Purple', 'Muted Orange', 'Muted Cyan', 'Muted Magenta', 'Muted Gold', 'Muted Grey'
];

// --- DOM Element References ---
let colorThemeSelect;
let themeToggleBtn;
let revertToDefaultThemeBtn;

// --- External Dependencies ---
let db, auth, firestore, authFunctions, currentUserId, currentAppId;

// --- Utility Functions ---

/**
 * Logs debug messages for theme operations
 * @param {string} message - The debug message
 */
function logDebug(message) {
    if (typeof window !== 'undefined' && window.logDebug) {
        window.logDebug(message);
    } else {
        console.log('[Theme]', message);
    }
}

/**
 * Shows a custom alert message
 * @param {string} message - The message to show
 * @param {number} duration - Duration in milliseconds
 */
function showCustomAlert(message, duration = 3000) {
    if (typeof window !== 'undefined' && window.showCustomAlert) {
        window.showCustomAlert(message, duration);
    } else {
        console.log('ALERT:', message);
    }
}

// --- Theme Functions ---

/**
 * Applies the specified theme to the application
 * @param {string} themeName - The name of the theme to apply
 */
function applyTheme(themeName) {
    const body = document.body;
    currentActiveTheme = themeName;

    // Remove all existing theme classes
    body.className = body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');

    // Remove data-theme attribute for custom themes
    body.removeAttribute('data-theme');

    if (themeName === 'system-default') {
        // System default theme - use system preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }
        logDebug('Theme: Applied system-default theme');
    } else if (themeName === 'light') {
        // Explicit light theme
        body.classList.remove('dark-theme');
        logDebug('Theme: Applied light theme');
    } else if (themeName === 'dark') {
        // Explicit dark theme
        body.classList.add('dark-theme');
        logDebug('Theme: Applied dark theme');
    } else if (CUSTOM_THEMES.includes(themeName)) {
        // Custom theme
        const themeClassName = themeName.toLowerCase().replace(/\s+/g, '-');
    // Ensure any global dark-theme class is removed so custom theme colours are not overridden
    body.classList.remove('dark-theme');
    body.classList.add('theme-' + themeClassName);
        body.setAttribute('data-theme', themeName);
        logDebug('Theme: Applied custom theme: ' + themeName);
    }

    // Save preference
    localStorage.setItem('theme', themeName);

    // Save to Firestore if user is logged in
    if (currentUserId && db && firestore) {
        const userProfileDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
        try {
            firestore.setDoc(userProfileDocRef, { lastTheme: themeName }, { merge: true });
            logDebug('Theme: Saved theme preference to Firestore: ' + themeName);
        } catch (error) {
            console.error('Theme: Error saving theme preference to Firestore:', error);
        }
    }

    // Update UI controls
    updateThemeToggleAndSelector();
}

/**
 * Updates the theme toggle and selector UI elements
 */
function updateThemeToggleAndSelector() {
    if (colorThemeSelect) {
        // Update the dropdown to show "No Custom Theme" if current theme is not a custom theme
        if (!CUSTOM_THEMES.includes(currentActiveTheme)) {
            colorThemeSelect.value = 'none';
        } else {
            colorThemeSelect.value = currentActiveTheme;
        }
    }

    logDebug('Theme: Updated theme toggle and selector UI');
}

/**
 * Applies a theme to low52 alert cards
 * @param {HTMLElement} card - The card element to theme
 * @param {string} type - The alert type ('high' or 'low')
 */
function applyLow52AlertTheme(card, type) {
    console.log('Theme: applyLow52AlertTheme called with type:', type);
    if (!card) {
        console.warn('Theme: applyLow52AlertTheme called with null/undefined card');
        return;
    }
    card.classList.remove('low52-low', 'low52-high');
    if (type === 'low') card.classList.add('low52-low');
    else if (type === 'high') card.classList.add('low52-high');
    // Always ensure .low52-alert-card is present
    card.classList.add('low52-alert-card');
    console.log('Theme: Applied low52 theme classes:', type);
}

// --- Initialization ---

/**
 * Initializes the theme management system
 * Sets up event listeners and applies the initial theme
 */
export function initializeTheme() {
    try {
        console.log('Theme: Initializing theme system...');

        // Get DOM elements (may not be available yet if sidebar not loaded)
        colorThemeSelect = document.getElementById('colorThemeSelect');
        themeToggleBtn = document.getElementById('themeToggleBtn');
        revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');

        console.log('Theme: DOM elements found:', {
            colorThemeSelect: !!colorThemeSelect,
            themeToggleBtn: !!themeToggleBtn,
            revertToDefaultThemeBtn: !!revertToDefaultThemeBtn
        });

        // Get external dependencies
        db = window.db || (typeof window.hubDb !== 'undefined' ? window.hubDb : null);
        auth = window.auth || (typeof window.hubAuth !== 'undefined' ? window.hubAuth : null);
        firestore = window.firestore || (typeof window.hubFs !== 'undefined' ? window.hubFs : null);
        authFunctions = window.authFunctions || (typeof window.hubAuthFx !== 'undefined' ? window.hubAuthFx : null);
        currentUserId = window.currentUserId;
        currentAppId = window.currentAppId;

        // Set up event listeners (only if elements exist)
        setupThemeEventListeners();

        // Apply initial theme
        const savedTheme = localStorage.getItem('theme') || 'system-default';
        console.log('Theme: Applying initial theme:', savedTheme);
        applyTheme(savedTheme);

        console.log('Theme: Theme system initialized successfully');
    } catch (error) {
        console.error('Theme initialization failed:', error);
        // Don't throw - allow app to continue without theme functionality
    }
}

/**
 * Sets up all theme-related event listeners
 */
function setupThemeEventListeners() {
    try {
        // Color theme select change listener
        if (colorThemeSelect) {
            colorThemeSelect.addEventListener('change', (event) => {
                logDebug('Theme: Color theme select changed to: ' + event.target.value);
                const selectedTheme = event.target.value;
                if (selectedTheme === 'none') {
                    applyTheme('system-default');
                } else {
                    applyTheme(selectedTheme);
                }
            });
        }

        // Theme toggle button click listener
        if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            logDebug('Theme Debug: Random Theme Toggle button clicked.');
            if (CUSTOM_THEMES.length > 0) {
                let randomIndex;
                let newThemeName;
                do {
                    randomIndex = Math.floor(Math.random() * CUSTOM_THEMES.length);
                    newThemeName = CUSTOM_THEMES[randomIndex];
                } while (newThemeName === currentActiveTheme && CUSTOM_THEMES.length > 1);

                logDebug('Theme Debug: Selected random nextThemeName: ' + newThemeName);
                applyTheme(newThemeName);
            } else {
                logDebug('Theme Debug: No custom themes defined. Defaulting to system-default.');
                applyTheme('system-default');
            }
        });
    }

    // Revert to default theme button click listener
    if (revertToDefaultThemeBtn) {
        revertToDefaultThemeBtn.addEventListener('click', async (event) => {
            logDebug('Theme Debug: Revert to Default Theme button clicked (now toggling Light/Dark).');
            event.preventDefault();

            const body = document.body;
            let targetTheme;

            // Remove all custom theme classes and the data-theme attribute
            body.className = body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');
            body.removeAttribute('data-theme');
            localStorage.removeItem('selectedTheme');

            // Determine target theme based on current state
            if (currentActiveTheme === 'light') {
                targetTheme = 'dark';
                logDebug('Theme: Will toggle from Light to Dark theme.');
            } else if (currentActiveTheme === 'dark') {
                targetTheme = 'light';
                logDebug('Theme: Will toggle from Dark to Light theme.');
            } else {
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                // If we were following system-default, toggle to the opposite explicit theme
                targetTheme = systemPrefersDark ? 'light' : 'dark';
                logDebug('Theme: System default detected; toggling to explicit: ' + targetTheme);
            }

            // Apply the computed explicit theme immediately so the class changes take effect on first click
            applyTheme(targetTheme);

            // Persist the explicit selection is handled inside applyTheme (localStorage + Firestore attempt)

            updateThemeToggleAndSelector();
        });
    }

    // System dark mode preference listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (currentActiveTheme === 'system-default') {
            if (event.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            logDebug('Theme: System theme preference changed and applied (system-default mode).');
            updateThemeToggleAndSelector();
        }
    });
    } catch (error) {
        console.error('Theme event listener setup failed:', error);
        // Don't throw - allow app to continue
    }
}

// --- Exports ---
export { applyTheme, applyLow52AlertTheme, updateThemeToggleAndSelector };
