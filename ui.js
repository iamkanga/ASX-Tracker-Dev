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

    function toggleAppSidebar(forceState = null) {
        const appSidebar = $id('appSidebar');
        const sidebarOverlay = $('.sidebar-overlay');
        const hamburgerBtn = $id('hamburgerBtn');
        if (!appSidebar || !sidebarOverlay || !hamburgerBtn) return;

        console.log('Sidebar: toggleAppSidebar called. Current open state: ' + appSidebar.classList.contains('open') + ', Force state: ' + forceState);
        const isDesktop = window.innerWidth > 768;
        const isOpen = appSidebar.classList.contains('open');

        if (forceState === true || (forceState === null && !isOpen)) {
            if (!isDesktop) {
                if (typeof window.pushAppState === 'function') {
                    window.pushAppState({ sidebarOpen: true }, '', '#sidebar');
                }
            }
            appSidebar.classList.add('open');
            sidebarOverlay.classList.add('open');
            if (appSidebar) {
                appSidebar.scrollTop = 0;
            }
            if (!isDesktop) {
                document.body.style.overflow = 'hidden';
            }
            if (isDesktop) {
                document.body.classList.add('sidebar-active');
                sidebarOverlay.style.pointerEvents = 'none';
            } else {
                document.body.classList.remove('sidebar-active');
                sidebarOverlay.style.pointerEvents = 'auto';
            }
            hamburgerBtn.setAttribute('aria-expanded','true');
        } else if (forceState === false || (forceState === null && isOpen)) {
            appSidebar.classList.remove('open');
            sidebarOverlay.classList.remove('open');
            document.body.classList.remove('sidebar-active');
            document.body.style.overflow = '';
            sidebarOverlay.style.pointerEvents = 'none';
            if (appSidebar) {
                appSidebar.scrollTop = 0;
            }
            hamburgerBtn.setAttribute('aria-expanded','false');
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
        ToastManager,
        toggleAppSidebar
    });
    window.toggleAppSidebar = toggleAppSidebar;

    document.addEventListener('DOMContentLoaded', () => {
        const hamburgerBtn = $id('hamburgerBtn');
        const appSidebar = $id('appSidebar');
        const closeMenuBtn = $id('closeMenuBtn');
        const sidebarOverlay = $('.sidebar-overlay');

        if (hamburgerBtn && appSidebar && closeMenuBtn && sidebarOverlay) {
            if (!hamburgerBtn.dataset.sidebarBound) {
                hamburgerBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const willOpen = !appSidebar.classList.contains('open');
                    toggleAppSidebar();
                    if (willOpen && typeof window.pushAppStateEntry === 'function') {
                        window.pushAppStateEntry('sidebar','sidebar');
                    }
                });
                hamburgerBtn.dataset.sidebarBound = '1';
            }
            closeMenuBtn.addEventListener('click', () => {
                toggleAppSidebar(false);
            });

            if (sidebarOverlay._unifiedHandler) {
                sidebarOverlay.removeEventListener('mousedown', sidebarOverlay._unifiedHandler, true);
            }
            const unifiedHandler = (e) => {
                if (e.target !== sidebarOverlay) return;
                if (!appSidebar.classList.contains('open')) return;
                try { toggleAppSidebar(false); } catch(err){ console.warn('Sidebar close failed', err); }
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                e.stopPropagation();
                if (e.preventDefault) e.preventDefault();
            };
            sidebarOverlay.addEventListener('mousedown', unifiedHandler, true);
            sidebarOverlay._unifiedHandler = unifiedHandler;

            const mainContent = $id('mainContent') || $('main');
            const firstFocusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            function trapFocus(e){
                if (!appSidebar.classList.contains('open')) return;
                const focusables = Array.from(appSidebar.querySelectorAll(firstFocusableSelector)).filter(el=>!el.disabled && el.offsetParent!==null);
                if (!focusables.length) return;
                const first = focusables[0];
                const last = focusables[focusables.length-1];
                if (e.key === 'Tab') {
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
            document.addEventListener('keydown', trapFocus, true);

            const __origToggle = toggleAppSidebar;
            window.toggleAppSidebar = function(force){
                __origToggle(force);
                const isOpen = appSidebar.classList.contains('open');
                if (mainContent) mainContent.setAttribute('aria-hidden', isOpen ? 'true':'false');
                if (isOpen) {
                    setTimeout(()=>{
                        const first = appSidebar.querySelector(firstFocusableSelector);
                        if (first) first.focus();
                    },30);
                } else {
                    if (mainContent) mainContent.removeAttribute('inert');
                }
            };

            document.addEventListener('click', (event) => {
                const isDesktop = window.innerWidth > 768;
                if (!isDesktop) return;
                if (!appSidebar.classList.contains('open')) return;
                if (!appSidebar.contains(event.target) && !hamburgerBtn.contains(event.target)) {
                    toggleAppSidebar(false);
                    event.stopPropagation();
                    event.preventDefault();
                }
            }, true);

            window.addEventListener('resize', () => {
                if (appSidebar.classList.contains('open')) {
                    toggleAppSidebar(false);
                }
            });

            const menuButtons = appSidebar.querySelectorAll('.menu-button-item');
            menuButtons.forEach(button => {
                button.addEventListener('click', (event) => {
                    const clickedButton = event.currentTarget;
                    const closesMenu = clickedButton.dataset.actionClosesMenu !== 'false';
                    if (closesMenu) toggleAppSidebar(false);
                });
            });
        }
    });
})();
