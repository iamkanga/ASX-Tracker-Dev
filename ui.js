export let contextMenuOpen = false;
export let currentContextMenuShareId = null;

function pushAppState(stateObj = {}, title = '', url = '') {
    history.pushState(stateObj, title, url);
}

function showModal(modalElement, dependencies) {
    const { logDebug, initializeShareNameAutocomplete } = dependencies;
    if (modalElement) {
        pushAppState({ modalId: modalElement.id }, '', '');
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) {
            scrollableContent.scrollTop = 0;
        }
        if (modalElement.id === 'shareFormSection') {
            try { if (typeof initializeShareNameAutocomplete === 'function') initializeShareNameAutocomplete(true); } catch (_) { }
        }
        logDebug('Modal: Showing modal: ' + modalElement.id);
    }
}

function hideModal(modalElement, dependencies) {
    const { logDebug } = dependencies;
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        logDebug('Modal: Hiding modal: ' + modalElement.id);
    }
}

function closeModals(dependencies) {
    const { logDebug } = dependencies;
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    logDebug('Modal: All modals closed.');
}

function showCustomAlert(message, duration = 3000, type = 'info') {
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
    } catch (e) {
        console.warn('Toast render failed, using alert fallback.', e);
    }
    try { window.alert(message); } catch (_) { console.log('ALERT:', message); }
}

function showContextMenu(event, shareId, dependencies) {
    const { shareContextMenu, logDebug } = dependencies;
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

function hideContextMenu(dependencies) {
    const { shareContextMenu, deselectCurrentShare, logDebug } = dependencies;
    if (shareContextMenu) {
        shareContextMenu.style.display = 'none';
        contextMenuOpen = false;
        currentContextMenuShareId = null;
        if(deselectCurrentShare) deselectCurrentShare();
        logDebug('Context Menu: Hidden.');
    }
}

export { showModal, hideModal, closeModals, showCustomAlert, showContextMenu, hideContextMenu };
