// ui.js - lightweight UI helpers exposed as window.UI for backwards compatibility
(function(){
    // Internal helpers: safe DOM queries
    function $(sel) { return document.querySelector(sel); }
    function $id(id) { return document.getElementById(id); }

    // ToastManager (moved from script.js)
    const ToastManager = (() => {
        const container = () => $id('toastContainer');
        const makeToast = (opts) => {
            const root = container();
            if (!root) return null;
            const { message, type = 'info', duration = 2000, actions = [] } = opts || {};
            const effectiveDuration = (duration === 0) ? 0 : Math.max(duration || 3000, 3000);
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
            const iconHTML = `<span class="icon"></span>`;
            const msgHTML = `<div class="message"></div>`;
            const actionsHTML = actions.length ? `<div class="actions">${actions.map(a=>`<button class=\"btn ${a.variant||''}\">${a.label}</button>`).join('')}</div>` : '';
            toast.innerHTML = `${iconHTML}${msgHTML}${actionsHTML}`;
            toast.querySelector('.message').textContent = message || '';
            const remove = () => { toast.classList.remove('show'); setTimeout(()=> toast.remove(), 200); };
            const actionBtns = toast.querySelectorAll('.actions .btn');
            actionBtns.forEach((btn, idx) => {
                const cfg = actions[idx];
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try { cfg && typeof cfg.onClick === 'function' && cfg.onClick(); } finally { remove(); }
                });
            });
            root.appendChild(toast);
            requestAnimationFrame(()=> toast.classList.add('show'));
            if (effectiveDuration && effectiveDuration > 0) setTimeout(remove, effectiveDuration);
            return { el: toast, close: remove };
        };
        return {
            info: (message, duration=3000) => makeToast({ message, type:'info', duration }),
            success: (message, duration=3000) => makeToast({ message, type:'success', duration }),
            error: (message, duration=3000) => makeToast({ message, type:'error', duration }),
            confirm: (message, { confirmText='Yes', cancelText='No', onConfirm, onCancel } = {}) => {
                return makeToast({
                    message,
                    type: 'info',
                    duration: 0,
                    actions: [
                        { label: confirmText, variant: 'primary', onClick: () => { onConfirm && onConfirm(true); } },
                        { label: cancelText, variant: 'danger', onClick: () => { onCancel && onCancel(false); } }
                    ]
                });
            }
        };
    })();

    function showCustomAlert(message, duration = 3000, type = 'info') {
        const effectiveDuration = (duration === 0) ? 0 : Math.max(duration || 3000, 3000);
        try {
            const container = $id('toastContainer');
            if (container) {
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.setAttribute('role', 'status');
                toast.innerHTML = `<span class="icon"></span><div class="message"></div>`;
                toast.querySelector('.message').textContent = message;
                const remove = () => { toast.classList.remove('show'); setTimeout(()=> toast.remove(), 200); };
                container.appendChild(toast);
                requestAnimationFrame(()=> toast.classList.add('show'));
                if (effectiveDuration && effectiveDuration > 0) setTimeout(remove, effectiveDuration);
                return;
            }
        } catch (e) { console.warn('Toast render failed, using alert fallback.', e); }
        try { window.alert(message); } catch(_) { console.log('ALERT:', message); }
    }

    function showCustomConfirm(message, callback) {
        const res = ToastManager.confirm(message, {
            confirmText: 'Yes',
            cancelText: 'No',
            onConfirm: () => callback(true),
            onCancel: () => callback(false)
        });
        if (!res) callback(window.confirm(message));
    }

    function showModal(modalElement) {
        if (modalElement) {
            try { if (typeof pushAppState === 'function') pushAppState({ modalId: modalElement.id }, '', ''); } catch(_) {}
            modalElement.style.setProperty('display', 'flex', 'important');
            modalElement.scrollTop = 0;
            const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
            if (scrollableContent) scrollableContent.scrollTop = 0;
            try { if (modalElement.id === 'shareFormSection' && typeof initializeShareNameAutocomplete === 'function') initializeShareNameAutocomplete(true); } catch(_) {}
        }
    }

    function showModalNoHistory(modalElement) {
        if (!modalElement) return;
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) scrollableContent.scrollTop = 0;
    }

    function hideModal(modalElement) {
        if (modalElement) modalElement.style.setProperty('display', 'none', 'important');
    }

    function adjustMainContentPadding() {
        const appHeader = $id('appHeader') || $id('header') || $('.app-header');
        const mainContainer = $id('main') || $('.main-container') || document.querySelector('main');
        if (appHeader && mainContainer) {
            const headerHeight = appHeader.offsetHeight;
            mainContainer.style.paddingTop = `${headerHeight}px`;
        }
    }

    function closeModals() {
        // Keep behavior light here; prefer callers to do auto-save logic before calling closeModals
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal) modal.style.setProperty('display', 'none', 'important');
        });
        try { if (typeof resetCalculator === 'function') resetCalculator(); } catch(_) {}
        try { if (typeof deselectCurrentShare === 'function') deselectCurrentShare(); } catch(_) {}
        try { if (typeof deselectCurrentCashAsset === 'function') deselectCurrentCashAsset(); } catch(_) {}
        try { if (typeof hideContextMenu === 'function') hideContextMenu(); } catch(_) {}
        const alertPanel = $id('alertPanel'); if (alertPanel) hideModal(alertPanel);
        const asxCodeButtonsContainer = $id('asxCodes') || document.querySelector('.asx-code-buttons');
        if (asxCodeButtonsContainer) {
            asxCodeButtonsContainer.querySelectorAll('button.asx-code-btn.active').forEach(btn=>btn.classList.remove('active'));
        }
    }

    // Expose lightweight API on window.UI for backwards-compatible calls from script.js
    window.UI = window.UI || {};
    Object.assign(window.UI, {
        showModal,
        showModalNoHistory,
        hideModal,
        closeModals,
        showCustomAlert,
        showCustomConfirm,
        adjustMainContentPadding,
        ToastManager
    });
})();
