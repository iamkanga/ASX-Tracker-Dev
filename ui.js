// --- UI RELATED FUNCTIONS ---

/**
 * Toggles the application sidebar.
 * @param {boolean|null} forceState - True to open, false to close, null to toggle.
 */
export function toggleAppSidebar(forceState = null) {
    const appSidebar = document.getElementById('appSidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    if (!appSidebar || !sidebarOverlay) {
        console.error("Sidebar elements not found");
        return;
    }

    const isOpen = appSidebar.classList.contains('open');

    if (forceState === true || (forceState === null && !isOpen)) {
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.style.overflow = ''; // Restore background scroll
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => toggleAppSidebar());
    }

    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', () => toggleAppSidebar(false));
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => toggleAppSidebar(false));
    }
});
