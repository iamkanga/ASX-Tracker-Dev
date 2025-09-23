// ui.js - lightweight UI helpers exposed as window.UI for backwards compatibility
(function(){
    // Internal helpers: safe DOM queries
    function $(sel) { return document.querySelector(sel); }
    function $id(id) { return document.getElementById(id); }
    // Helper: detect if any modal is currently open/visible
    function isAnyModalOpen() {
        try {
            return !!document.querySelector('.modal.show, .modal[style*="display: flex"]');
        } catch(_) { return false; }
    }
    // Body scroll lock (nested-safe): freeze background page scroll while any modal is open
    let __bodyScrollLockCount = 0;
    let __bodyScrollLockRestore = null;
    function lockBodyScroll() {
        try {
            __bodyScrollLockCount++;
            if (__bodyScrollLockCount > 1) return; // already locked
            const docEl = document.documentElement;
            const body = document.body;
            const scrollY = Math.round(window.pageYOffset || window.scrollY || docEl.scrollTop || 0);
            const prev = {
                pos: body.style.position,
                top: body.style.top,
                left: body.style.left,
                right: body.style.right,
                width: body.style.width,
                overflow: body.style.overflow,
                paddingRight: body.style.paddingRight,
                scrollBehavior: docEl.style.scrollBehavior,
            };
            const scrollbarW = Math.max(0, (window.innerWidth || 0) - (docEl.clientWidth || 0));
            docEl.style.scrollBehavior = 'auto'; // avoid smooth scroll side-effects on restore
            body.style.position = 'fixed';
            body.style.top = `-${scrollY}px`;
            body.style.left = '0';
            body.style.right = '0';
            body.style.width = '100%';
            body.style.overflow = 'hidden';
            if (scrollbarW > 0) {
                try {
                    const pr = parseInt(window.getComputedStyle(body).paddingRight, 10) || 0;
                    body.style.paddingRight = (pr + scrollbarW) + 'px';
                } catch(_) {}
            }
            try { body.classList.add('modal-open'); } catch(_) {}
            __bodyScrollLockRestore = function restoreBodyScroll(){
                try { body.classList.remove('modal-open'); } catch(_) {}
                body.style.position = prev.pos || '';
                body.style.top = prev.top || '';
                body.style.left = prev.left || '';
                body.style.right = prev.right || '';
                body.style.width = prev.width || '';
                body.style.overflow = prev.overflow || '';
                body.style.paddingRight = prev.paddingRight || '';
                docEl.style.scrollBehavior = prev.scrollBehavior || '';
                const y = Math.max(0, scrollY);
                // Restore after styles are cleared so it takes effect immediately
                try { window.scrollTo(0, y); } catch(_) {}
            };
        } catch(_) {}
    }
    function unlockBodyScroll() {
        try {
            if (__bodyScrollLockCount > 0) __bodyScrollLockCount--;
            if (__bodyScrollLockCount === 0 && typeof __bodyScrollLockRestore === 'function') {
                const restore = __bodyScrollLockRestore; __bodyScrollLockRestore = null;
                restore();
            }
        } catch(_) {}
    }
    // Import calculation helpers from utils if available on window (script.js exposes via imports)
    try {
        if (!window.calculateUnfrankedYield && typeof calculateUnfrankedYield === 'function') window.calculateUnfrankedYield = calculateUnfrankedYield;
        if (!window.calculateFrankedYield && typeof calculateFrankedYield === 'function') window.calculateFrankedYield = calculateFrankedYield;
    } catch (e) { /* ignore if not present yet */ }

    // Expose safe global fallbacks so other modules can call these even if script.js hasn't attached real implementations yet.
    try {
        if (!window.logDebug) window.logDebug = function(){ try { console.log.apply(console, arguments); } catch(_){} };
    if (!window.showModal) window.showModal = function(m){ try { if (m) { m.style.setProperty('display','flex','important'); /* do not force scrollTop here */ } } catch(_){} };
        if (!window.hideModal) window.hideModal = function(m){ try { if (m) m.style.setProperty('display','none','important'); } catch(_){} };
    if (!window.scrollMainToTop) window.scrollMainToTop = function(instant){
            try {
        // Do not adjust page scroll if a modal is open; avoid perceived "snap to top" while editing in modals
        if (isAnyModalOpen()) return;
                const headerEl = document.getElementById('appHeader') || document.querySelector('.app-header');
                const asxButtonsEl = document.getElementById('asxCodeButtonsContainer') || document.querySelector('.asx-code-buttons');
                const mainEl = document.querySelector('main.container') || document.querySelector('main') || document.body;
                const headerHeight = headerEl ? (headerEl.getBoundingClientRect ? headerEl.getBoundingClientRect().height : headerEl.offsetHeight || 0) : 0;
                const asxExtra = (asxButtonsEl && asxButtonsEl.classList && asxButtonsEl.classList.contains('expanded')) ? (asxButtonsEl.getBoundingClientRect ? asxButtonsEl.getBoundingClientRect().height : (asxButtonsEl.offsetHeight || 0)) : 0;

                // Find the nearest scrollable ancestor for the main content (if any)
                function findScrollableAncestor(el) {
                    try {
                        let node = el;
                        while (node && node !== document.documentElement && node !== document.body) {
                            try {
                                const style = window.getComputedStyle(node);
                                const overflowY = style && (style.overflowY || style.overflow);
                                if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && node.scrollHeight > node.clientHeight) return node;
                            } catch(_) {}
                            node = node.parentElement;
                        }
                    } catch(_) {}
                    return null;
                }

                const scroller = findScrollableAncestor(mainEl) || document.scrollingElement || document.documentElement || document.body;

                // compute where the top of main should be positioned in the document so it sits under the header
                let mainRectTop = 0;
                try { mainRectTop = (mainEl && mainEl.getBoundingClientRect && mainEl.getBoundingClientRect().top) || 0; } catch(_) {}
                const currentYOffset = (window.pageYOffset || window.scrollY || 0);
                const targetY = Math.max(0, Math.round(currentYOffset + mainRectTop - headerHeight - asxExtra));

                // Debug at function entry
                try {
                    if (window.__scrollDebug === true || window.scrollDebug === true) {
                        console.debug('[scrollMainToTop] entry', { headerHeight, asxExtra, mainRectTop, currentYOffset, targetY, mainEl: mainEl && (mainEl.id || mainEl.className || mainEl.tagName) });
                    }
                } catch(_){}

                function doScrollOnce() {
                    try {
                        // Reset known descendant scrollers inside main (instant)
                        try {
                            const descendantSelectors = ['.table-container', '#mobileShareCards', '.portfolio-scroll-wrapper', '#portfolioListContainer', '#shareTable'];
                            descendantSelectors.forEach(sel => {
                                try {
                                    const el = (mainEl && typeof mainEl.querySelector === 'function') ? mainEl.querySelector(sel) : document.querySelector(sel);
                                    if (el && el.scrollHeight > el.clientHeight) {
                                        try { el.scrollTop = 0; } catch(_){}
                                        try { if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch(_){}
                                    }
                                } catch(_){}
                            });
                        } catch(_){}

                        // Also reset the previously-detected scroller (ancestor) if present
                        try {
                            if (scroller && scroller !== document.documentElement && scroller !== document.body) {
                                try { scroller.scrollTop = 0; } catch(_){}
                                try { if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch(_){}
                            }
                        } catch(_){}

                        // Reset document scrolling element to targetY to make sure viewport aligns
                        try {
                            const docEl = document.scrollingElement || document.documentElement || document.body;
                            try { docEl.scrollTop = targetY; } catch(_){}
                            try { if (typeof docEl.scrollTo === 'function') docEl.scrollTo({ top: targetY, left: 0, behavior: 'auto' }); } catch(_){}
                        } catch(_){}

                        // Debug snapshot
                        try { if (window.__scrollDebug || window.scrollDebug) { const docEl2 = document.scrollingElement || document.documentElement || document.body; console.debug('[scrollMainToTop] doScrollOnce', { targetY, headerHeight, asxExtra, scroller: scroller && (scroller.id || scroller.className || scroller.tagName), docTop: docEl2 && docEl2.scrollTop, winYOffset: window.pageYOffset || window.scrollY }); } } catch(_){}

                        // Finally perform smooth window scroll to the computed target
                        try { window.scrollTo({ top: targetY, left: 0, behavior: instant ? 'auto' : 'smooth' }); } catch(_){}
                    } catch(_){}
                }

                // Run multiple times across frames/timeouts to ensure it takes after any reflow
                try { doScrollOnce(); } catch(_){}
                try { requestAnimationFrame(doScrollOnce); } catch(_){}
                try { setTimeout(doScrollOnce, 40); } catch(_){}
                try { setTimeout(doScrollOnce, 160); } catch(_){}
            } catch(_){}
        };
        if (!window.updateAddFormLiveSnapshot) window.updateAddFormLiveSnapshot = function(code){ /* noop until real impl available */ };
    } catch(e) { /* ignore */ }

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

    // Define showCustomAlert inside the IIFE scope
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

    // Safe focus helper to avoid background page jumps when focusing inputs
    try {
        if (!window.safeFocus) {
            window.safeFocus = function(el){
                try {
                    if (!el || typeof el.focus !== 'function') return;
                    try { el.focus({ preventScroll: true }); return; }
                    catch(_) {
                        // If inside a modal, do NOT fall back to plain focus() as it may cause a jump
                        try { if (el.closest && el.closest('.modal')) return; } catch(__) {}
                        // Outside modals it's safe to fall back
                        try { el.focus(); } catch(__) {}
                    }
                } catch(_) {}
            };
        }
    } catch(_) {}


    function showCustomConfirm(message, callback) {
        try {
            const modal = document.getElementById('customConfirmModal');
            const msgEl = document.getElementById('customConfirmMessage');
            const okBtn = document.getElementById('customConfirmOkBtn');
            const cancelBtn = document.getElementById('customConfirmCancelBtn');
            const closeBtn = document.getElementById('customConfirmCloseBtn');
            if (modal && msgEl && okBtn && cancelBtn) {
                msgEl.textContent = String(message || '');

                // Guard against multiple bindings: replaceNode technique for one-time listeners
                function cleanup() {
                    try { modal.classList.remove('show'); modal.style.setProperty('display','none','important'); } catch(_){}
                    // If no more modals remain, unlock body scroll
                    try { if (!isAnyModalOpen()) unlockBodyScroll(); } catch(_) {}
                }

                const onOk = () => { cleanup(); try { callback && callback(true); } catch(_){} };
                const onCancel = () => { cleanup(); try { callback && callback(false); } catch(_){} };

                // Ensure previous listeners are removed by cloning nodes
                const okClone = okBtn.cloneNode(true); okBtn.parentNode.replaceChild(okClone, okBtn);
                const cancelClone = cancelBtn.cloneNode(true); cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);

                // Ensure body scroll is locked while confirm modal is visible (only when opening the first modal)
                try { if (!isAnyModalOpen()) lockBodyScroll(); } catch(_) {}
                const closeClone = closeBtn ? closeBtn.cloneNode(true) : null; if (closeBtn && closeClone) closeBtn.parentNode.replaceChild(closeClone, closeBtn);

                okClone.addEventListener('click', onOk, { once: true });
                cancelClone.addEventListener('click', onCancel, { once: true });
                if (closeClone) closeClone.addEventListener('click', onCancel, { once: true });

                // Dismiss on backdrop click
                const onBackdrop = (e) => { try { if (e.target === modal) onCancel(); } catch(_){} };
                modal.addEventListener('click', onBackdrop, { once: true });

                // ESC to cancel
                const onKey = (e) => { if (e.key === 'Escape') { onCancel(); document.removeEventListener('keydown', onKey); } };
                document.addEventListener('keydown', onKey, { once: true });

                // Show modal centered above others
                try { modal.classList.remove('app-hidden'); } catch(_){}
                modal.style.setProperty('display','flex','important');
                requestAnimationFrame(()=> modal.classList.add('show'));
                return;
            }
        } catch(e) { console.warn('Custom confirm modal unavailable, falling back to toast confirm.', e); }

        // Fallback to Toast-based confirm if modal not available
        try {
            const res = ToastManager && typeof ToastManager.confirm === 'function' && ToastManager.confirm(message, {
                confirmText: 'Confirm',
                cancelText: 'Cancel',
                onConfirm: () => callback && callback(true),
                onCancel: () => callback && callback(false)
            });
            if (res) return;
        } catch(_) {}

        // Last resort: immediately cancel without blocking native confirm
        try { callback && callback(false); } catch(_){}
    }

    function showModal(modalElement) {
        if (!modalElement) return;
        // Push in-app back stack and a browser history state so Back consistently closes modals
    try {
        if (typeof window.stackHasModal === 'function' && window.stackHasModal(modalElement)) {
            // Already on stack, just show without pushing
        } else if (typeof window.__appBackStackPush === 'function') {
            window.__appBackStackPush('modal', modalElement);
            if (window.logBackDebug) window.logBackDebug('MODAL open push (UI)', modalElement && modalElement.id);
        }
    } catch(_) {}
    try { if (typeof pushAppState === 'function') pushAppState({ modalId: modalElement.id || true }, '', '#modal'); } catch(_) {}
    try { if (window.toggleAppSidebar && window.appSidebar && window.appSidebar.classList.contains('open')) window.toggleAppSidebar(false); } catch(_) {}
        // Lock body scroll if this is the first visible modal
        try { if (!isAnyModalOpen()) lockBodyScroll(); } catch(_) {}
        // Unhide any hidden ancestor modals so nested modals are not blocked by parent's app-hidden
        try {
            let anc = modalElement.parentElement;
            while (anc && anc !== document.body) {
                try { if (anc.classList && anc.classList.contains('app-hidden')) anc.classList.remove('app-hidden'); } catch(_){}
                anc = anc.parentElement;
            }
        } catch(_){}
        // Remove any load-time hiding marker so CSS rules like .modal.show can take effect
        try { modalElement.classList.remove('app-hidden'); } catch(_){}
        // Add semantic class for visibility
        try { modalElement.classList.add('show'); } catch(_){}
    modalElement.style.setProperty('display', 'flex', 'important');
        // Do not force modal scroll to top on open; allow user-controlled position
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        // If there is a known reason to reset (e.g., explicit caller intent), handle via a separate helper.
    try { if (modalElement.id === 'shareFormSection' && typeof initializeShareNameAutocomplete === 'function') initializeShareNameAutocomplete(true); } catch(_) {}
    // After showing, trigger keyboard-aware sizing in case a virtual keyboard is present
    try {
        const refresh = window.ModalViewportManager && window.ModalViewportManager.refresh;
        if (typeof refresh === 'function') { requestAnimationFrame(refresh); setTimeout(refresh, 60); }
    } catch(_) {}
    }

    function showModalNoHistory(modalElement) {
        if (!modalElement) return;
        // No stack and no browser history push: used when restoring a previous modal on back
        // Lock body scroll if this is the first visible modal
        try { if (!isAnyModalOpen()) lockBodyScroll(); } catch(_) {}
        try {
            let anc = modalElement.parentElement;
            while (anc && anc !== document.body) {
                try { if (anc.classList && anc.classList.contains('app-hidden')) anc.classList.remove('app-hidden'); } catch(_){}
                anc = anc.parentElement;
            }
        } catch(_){}
        try { modalElement.classList.remove('app-hidden'); } catch(_){}
        try { modalElement.classList.add('show'); } catch(_){}
    modalElement.style.setProperty('display', 'flex', 'important');
        // Do not reset scroll on show without history either.
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
    }

    // Hide a modal visually but keep it on the in-app back stack so it can be restored on Back
    function hideModalKeepStack(modalElement) {
        if (!modalElement) return;
        try { modalElement.classList.remove('show'); } catch(_){}
        modalElement.style.setProperty('display','none','important');
        // If this was the last modal, unlock body scroll after styles settle
        const maybeUnlock = () => { try { if (!isAnyModalOpen()) unlockBodyScroll(); } catch(_) {} };
        try { requestAnimationFrame(maybeUnlock); setTimeout(maybeUnlock, 60); } catch(_) {}
        // Note: do NOT call removeModalFromStack here, so the previous modal remains just beneath top
    }

    function hideModal(modalElement) {
        if (!modalElement) return;
        try { if (typeof window.removeModalFromStack === 'function') window.removeModalFromStack(modalElement); } catch(_) {}
        try { modalElement.classList.remove('show'); } catch(_){}
        try { modalElement.classList.add('app-hidden'); } catch(_){}
        modalElement.style.setProperty('display', 'none', 'important');
        // If no other modals remain visible, unlock body scroll
        const maybeUnlock = () => { try { if (!isAnyModalOpen()) unlockBodyScroll(); } catch(_) {} };
        try { requestAnimationFrame(maybeUnlock); setTimeout(maybeUnlock, 60); } catch(_) {}
    }

    // Core padding adjuster (non-scrolling) retained for backwards compatibility.
    function adjustMainContentPadding() {
        const appHeader = $id('appHeader') || document.querySelector('#appHeader') || document.querySelector('.app-header');
        const mainContainer = document.querySelector('main.container') || $id('main') || document.querySelector('main') || document.querySelector('.main-container');
        if (!appHeader || !mainContainer) return;
        let headerHeight = 0;
        try { headerHeight = Math.ceil(appHeader.getBoundingClientRect().height); } catch(_) { headerHeight = appHeader.offsetHeight || 0; }
        if (!Number.isFinite(headerHeight)) headerHeight = 0;
        const current = parseInt(window.getComputedStyle(mainContainer).paddingTop, 10) || 0;
        if (current !== headerHeight) {
            mainContainer.style.paddingTop = headerHeight + 'px';
        }
        return headerHeight;
    }

    // New universal reposition helper: always recalculates header height THEN scrolls main content to sit directly beneath it.
    function repositionMainContentUnderHeader(opts = {}) {
        const changedHeight = adjustMainContentPadding();
        // Always scroll to top when invoked for explicit UI events (spec requirement)
        // To avoid interrupting user scroll during passive resize, caller can pass { suppressScroll:true }.
        try {
            const modalOpen = (function(){ try { return !!document.querySelector('.modal.show, .modal[style*="display: flex"]'); } catch(_) { return false; } })();
            if (!opts.suppressScroll && !modalOpen) {
                try { if (window.scrollMainToTop) window.scrollMainToTop(true); else window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch(_) {}
            }
        } catch(_) {}
        return changedHeight;
    }

    try { window.repositionMainContentUnderHeader = repositionMainContentUnderHeader; } catch(_) {}

    // Observe header size changes (e.g., ASX code buttons expand/collapse, banner shows) and adjust padding automatically.
    (function installHeaderResizeObserver(){
        try {
            if (window.__headerResizeObserverInstalled) return; // guard
            const appHeader = $id('appHeader') || document.querySelector('#appHeader') || document.querySelector('.app-header');
            if (!appHeader || typeof ResizeObserver === 'undefined') return;
            const ro = new ResizeObserver(()=>{
                // Passive adjust only (no scroll) so user isn't yanked mid-scroll; scroll happens on explicit events.
                try { repositionMainContentUnderHeader({ suppressScroll: true }); } catch(_) {}
            });
            ro.observe(appHeader);
            window.__headerResizeObserverInstalled = true;
        } catch(_) {}
    })();

    // Ensure padding is set early and on resize to avoid header overlap
    try {
        // Run on DOMContentLoaded and on load (covers different loading scenarios)
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(adjustMainContentPadding, 0);
        } else {
            document.addEventListener('DOMContentLoaded', adjustMainContentPadding);
        }
        window.addEventListener('load', adjustMainContentPadding);
        window.addEventListener('resize', function() { // throttle resize
            if (window.__adjustPaddingResizeT) clearTimeout(window.__adjustPaddingResizeT);
            window.__adjustPaddingResizeT = setTimeout(function(){ adjustMainContentPadding(); }, 80);
        });
    } catch (e) { console.warn('UI: Failed to install padding handlers', e); }

    function closeModals() {
        // Keep behavior light here; prefer callers to do auto-save logic before calling closeModals
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal) modal.style.setProperty('display', 'none', 'important');
        });
        try { document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')); } catch(_) {}
        try { unlockBodyScroll(); } catch(_) {}
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
        // Use the locally defined showModal to enforce history+stack push
        showModal: (el)=> showModal(el),
        showModalNoHistory,
        hideModalKeepStack,
        hideModal,
        closeModals,
        showCustomAlert,
        showCustomConfirm,
        adjustMainContentPadding,
        ToastManager,
        // expose for optional diagnostics
        lockBodyScroll,
        unlockBodyScroll
    });
})();

// Calculators UI (Standard & Dividend)
(function(){
    function initCalculators(){
        try{
            // Dividend calc elements
            const dividendCalcBtn = document.getElementById('dividendCalcBtn');
            const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
            const calcCloseButton = document.querySelector('.calc-close-button');
            const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
            const calcDividendAmountInput = document.getElementById('calcDividendAmount');
            const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
            const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
            const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
            const investmentValueSelect = document.getElementById('investmentValueSelect');
            const calcEstimatedDividend = document.getElementById('calcEstimatedDividend');

            // Standard calc elements
            const standardCalcBtn = document.getElementById('standardCalcBtn');
            const calculatorModal = document.getElementById('calculatorModal');
            const calculatorInput = document.getElementById('calculatorInput');
            const calculatorResult = document.getElementById('calculatorResult');
            const calculatorButtons = document.querySelector('.calculator-buttons');

            // State
            var currentCalculatorInput = '';
            var previousCalculatorInput = '';
            var operator = null;
            var resultDisplayed = false;

            function getOperatorSymbol(op){ switch(op){ case 'add': return '+'; case 'subtract': return '-'; case 'multiply': return '×'; case 'divide': return '÷'; default: return ''; }}

            function updateCalculatorDisplay(){ if (!calculatorInput || !calculatorResult) return; calculatorInput.textContent = previousCalculatorInput + (operator ? ' ' + getOperatorSymbol(operator) + ' ' : '') + currentCalculatorInput; if (!resultDisplayed) calculatorResult.textContent = currentCalculatorInput === '' ? '0' : currentCalculatorInput; }

            function calculateResult(){ var prev = parseFloat(previousCalculatorInput); var current = parseFloat(currentCalculatorInput); if (isNaN(prev) || isNaN(current)) return; var res; switch(operator){ case 'add': res = prev + current; break; case 'subtract': res = prev - current; break; case 'multiply': res = prev * current; break; case 'divide': if (current === 0){ showCustomAlert('Cannot divide by zero!'); res = 'Error'; } else { res = prev / current; } break; default: return; } if (typeof res === 'number' && !isNaN(res)) res = parseFloat(res.toFixed(10)); try{ if (calculatorResult) calculatorResult.textContent = res; }catch(_){} previousCalculatorInput = String(res); currentCalculatorInput = ''; }

            function resetCalculator(){ currentCalculatorInput = ''; operator = null; previousCalculatorInput = ''; resultDisplayed = false; try{ if (calculatorInput) calculatorInput.textContent = ''; if (calculatorResult) calculatorResult.textContent = '0'; }catch(_){} logDebug('Calculator: Calculator state reset.'); }

            function appendNumber(num){ if (resultDisplayed) { currentCalculatorInput = num; resultDisplayed = false; } else { if (num === '.' && currentCalculatorInput.includes('.')) return; currentCalculatorInput += num; } updateCalculatorDisplay(); }

            function handleAction(action){
                if (action === 'clear'){ resetCalculator(); return; }
                if (action === 'percentage'){
                    if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
                    var val;
                    if (currentCalculatorInput !== '') val = parseFloat(currentCalculatorInput);
                    else if (previousCalculatorInput !== '') val = parseFloat(previousCalculatorInput);
                    else return;
                    if (isNaN(val)) return;
                    if (operator && previousCalculatorInput !== ''){
                        var prevNum = parseFloat(previousCalculatorInput);
                        if (isNaN(prevNum)) return;
                        // Percentage of the previous number (e.g., prev op % => prev * (current/100))
                        currentCalculatorInput = String(prevNum * (val / 100));
                    } else {
                        // Standalone percentage (e.g., 50 % => 0.5)
                        currentCalculatorInput = String(val / 100);
                    }
                    resultDisplayed = false;
                    updateCalculatorDisplay();
                    return;
                }
                if (['add','subtract','multiply','divide'].includes(action)){
                    if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
                    if (currentCalculatorInput !== ''){
                        if (previousCalculatorInput !== ''){
                            // calculateResult will update previousCalculatorInput variable correctly
                            calculateResult();
                            // Do NOT read back from the DOM (calculatorResult.textContent) here — that may be formatted. Keep the internal numeric state.
                        } else {
                            previousCalculatorInput = currentCalculatorInput;
                        }
                    }
                    operator = action;
                    currentCalculatorInput = '';
                    resultDisplayed = false;
                    updateCalculatorDisplay();
                    return;
                }
                if (action === 'calculate'){
                    if (previousCalculatorInput === '' || currentCalculatorInput === '' || operator === null) return;
                    calculateResult();
                    operator = null;
                    resultDisplayed = true;
                }
            }

            function updateDividendCalculations(){
                try {
                    var currentPrice = parseFloat((calcCurrentPriceInput && calcCurrentPriceInput.value) || '');
                    var dividendAmount = parseFloat((calcDividendAmountInput && calcDividendAmountInput.value) || '');
                    var frankingCredits = parseFloat((calcFrankingCreditsInput && calcFrankingCreditsInput.value) || '');
                    var investmentValue = parseFloat((investmentValueSelect && investmentValueSelect.value) || '');

                    var calcUnfranked = (typeof window !== 'undefined' && typeof window.calculateUnfrankedYield === 'function') ? window.calculateUnfrankedYield : (typeof calculateUnfrankedYield === 'function' ? calculateUnfrankedYield : function(){ return null; });
                    var calcFranked = (typeof window !== 'undefined' && typeof window.calculateFrankedYield === 'function') ? window.calculateFrankedYield : (typeof calculateFrankedYield === 'function' ? calculateFrankedYield : function(){ return null; });
                    var estDivIncome = (typeof window !== 'undefined' && typeof window.estimateDividendIncome === 'function') ? window.estimateDividendIncome : (typeof estimateDividendIncome === 'function' ? estimateDividendIncome : function(){ return null; });
                    var fmtPct = (typeof window !== 'undefined' && typeof window.formatAdaptivePercent === 'function') ? window.formatAdaptivePercent : (typeof formatAdaptivePercent === 'function' ? formatAdaptivePercent : function(v){ return v; });
                    var fmtPrice = (typeof window !== 'undefined' && typeof window.formatAdaptivePrice === 'function') ? window.formatAdaptivePrice : (typeof formatAdaptivePrice === 'function' ? formatAdaptivePrice : function(v){ return v; });

                    var unfrankedYield = calcUnfranked(dividendAmount, currentPrice);
                    var frankedYield = calcFranked(dividendAmount, currentPrice, frankingCredits);
                    var estimatedDividend = estDivIncome(investmentValue, dividendAmount, currentPrice);

                    try { if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = unfrankedYield !== null ? fmtPct(unfrankedYield) + '%' : '-'; } catch(_){}
                    try { if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = frankedYield !== null ? fmtPct(frankedYield) + '%' : '-'; } catch(_){}
                    try { if (calcEstimatedDividend) calcEstimatedDividend.textContent = estimatedDividend !== null ? '$' + fmtPrice(estimatedDividend) : '-'; } catch(_){}
                } catch (e) { console.warn('Dividend calc error', e); }
            }

            // Bind listeners
            if (dividendCalcBtn){ dividendCalcBtn.addEventListener('click', function(){ try{ if (calcDividendAmountInput) calcDividendAmountInput.value = ''; if (calcCurrentPriceInput) calcCurrentPriceInput.value = ''; if (calcFrankingCreditsInput) calcFrankingCreditsInput.value = ''; if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '-'; if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '-'; if (calcEstimatedDividend) calcEstimatedDividend.textContent = '-'; if (investmentValueSelect) investmentValueSelect.value = '10000'; if (dividendCalculatorModal) { if (window.showModal) window.showModal(dividendCalculatorModal); else showModal(dividendCalculatorModal); } if (calcCurrentPriceInput) { try { if (window.safeFocus) window.safeFocus(calcCurrentPriceInput); else try { calcCurrentPriceInput.focus({ preventScroll:true }); } catch(_) { calcCurrentPriceInput.focus(); } } catch(_) {} } try{ if (window.toggleAppSidebar) window.toggleAppSidebar(false); else toggleAppSidebar(false); }catch(_){} }catch(e){console.warn('dividend open failed', e);} }); }
            [calcDividendAmountInput, calcCurrentPriceInput, calcFrankingCreditsInput, investmentValueSelect].forEach(function(input){ if (input){ input.addEventListener('input', updateDividendCalculations); input.addEventListener('change', updateDividendCalculations); } });

            if (standardCalcBtn){ standardCalcBtn.addEventListener('click', function(){ resetCalculator(); if (calculatorModal) showModal(calculatorModal); try{ toggleAppSidebar(false); }catch(_){} }); }

            if (calculatorButtons){ calculatorButtons.addEventListener('click', function(event){ var target = event.target; if (!target || !target.classList || !target.classList.contains('calc-btn') || target.classList.contains('is-disabled-icon')) return; var value = target.dataset.value; var action = target.dataset.action; if (value) appendNumber(value); else if (action) handleAction(action); }); }

            if (calcCloseButton){ calcCloseButton.addEventListener('click', function(){ if (dividendCalculatorModal) hideModal(dividendCalculatorModal); }); }

            // Expose globals expected by script.js
            window.resetCalculator = resetCalculator;
            window.calculateResult = calculateResult;
            window.updateCalculatorDisplay = updateCalculatorDisplay;
            window.appendNumber = appendNumber;
            window.handleAction = handleAction;
            window.updateDividendCalculations = updateDividendCalculations;

        }catch(e){ console.warn('initCalculators failed', e); }
    }

    // Expose additional functions to window.UI
    window.UI = window.UI || {};
    window.UI.initCalculators = initCalculators;
})();

// showCustomAlert is already exposed inside the IIFE via Object.assign

// Keyboard-aware modal viewport manager: ensures modals remain scrollable with on-screen keyboard
(function installKeyboardAwareModals(){
    try {
        if (window.__keyboardAwareModalsInstalled) return;
        window.__keyboardAwareModalsInstalled = true;

        // Hard-disable auto-scroll on input focus inside modals to stop any snapping.
        // Keep a sticky default of false and actively reset to false if toggled elsewhere.
        if (typeof window.ModalFocusAutoScroll === 'undefined') {
            window.ModalFocusAutoScroll = false;
        } else {
            window.ModalFocusAutoScroll = false;
        }

        const isMobileish = () => {
            try { return (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch(_) { return true; }
        };

        function getActiveModal() {
            try {
                // Prefer highest/last .modal.show; fallback to any visible flex modal
                const shown = Array.from(document.querySelectorAll('.modal.show'));
                const candidates = shown.length ? shown : Array.from(document.querySelectorAll('.modal')).filter(m => m && m.style && m.style.display !== 'none');
                // Pick the last-in-DOM to approximate top-most
                return candidates.length ? candidates[candidates.length - 1] : null;
            } catch(_) { return null; }
        }

        function getScrollable(modalEl) {
            if (!modalEl) return null;
            return modalEl.querySelector('.single-scroll-modal') || modalEl.querySelector('.modal-content') || modalEl;
        }

        function setKeyboardVisibleMarker(on) {
            try { document.body.classList.toggle('keyboard-visible', !!on); } catch(_) {}
        }

        function applyViewportSizing() {
            try {
                const modal = getActiveModal();
                const scroller = getScrollable(modal);
                if (!modal || !scroller) return;

                if (window.visualViewport) {
                    const vv = window.visualViewport;
                    const innerH = (window.innerHeight || vv.height || 0);
                    const keyboardLikely = (innerH && (vv.height < innerH - 40));
                    const shouldApply = isMobileish() || keyboardLikely;
                    if (!shouldApply) {
                        // Desktop full-height: don't hard-force height; clear keyboard marker and return
                        setKeyboardVisibleMarker(false);
                        // Clear inline overlay sizing when not applied
                        try { modal.style.removeProperty('top'); } catch(_){ }
                        try { modal.style.removeProperty('height'); } catch(_){ }
                        try { modal.style.removeProperty('min-height'); } catch(_){ }
                        try { modal.style.removeProperty('overflow'); } catch(_){ }
                        try { scroller.style.removeProperty('height'); } catch(_){ }
                        try { scroller.style.removeProperty('max-height'); } catch(_){ }
                        try { scroller.style.removeProperty('padding-bottom'); } catch(_){ }
                        try { scroller.style.removeProperty('scroll-padding-bottom'); } catch(_){ }
                        try { scroller.style.removeProperty('margin-top'); } catch(_){ }
                        return;
                    }
                    // Size and position the overlay (modal) to the visible viewport to avoid any black bands
                    const vvTop = Math.max(0, Math.floor(vv.offsetTop || 0));
                    const vvHeight = Math.max(240, Math.floor(vv.height));
                    try { modal.style.setProperty('top', vvTop + 'px'); } catch(_){ }
                    try { modal.style.setProperty('height', vvHeight + 'px'); } catch(_){ }
                    try { modal.style.setProperty('min-height', vvHeight + 'px'); } catch(_){ }
                    try { modal.style.setProperty('overflow', 'hidden'); } catch(_){ }

                    // Constrain the scrollable content to the visible viewport minus a small frame
                    const framePadding = 8; // should match mobile CSS padding
                    const usable = Math.max(200, vvHeight - (framePadding * 2));
                    scroller.style.maxHeight = usable + 'px';
                    scroller.style.height = usable + 'px';

                    // Estimate keyboard overlap and add extra bottom padding so last inputs clear the keyboard
                    const kbOverlap = Math.max(0, Math.floor((innerH || vvHeight) - vv.height - vvTop));
                    const extra = Math.min(400, Math.max(80, kbOverlap + 48));
                    scroller.style.scrollPaddingBottom = (extra + 32) + 'px';
                    scroller.style.paddingBottom = `calc(16px + ${extra}px)`;
                    // Remove any top margin that could create a black gap while keyboard is shown
                    scroller.style.marginTop = '0px';

                    // Mark body to allow CSS-based tweaks
                    setKeyboardVisibleMarker(kbOverlap > 12);
                } else {
                    // Fallback for non-supporting browsers
                    scroller.style.maxHeight = '100vh';
                    scroller.style.height = '100vh';
                    scroller.style.scrollPaddingBottom = '160px';
                    scroller.style.paddingBottom = '28px';
                }
            } catch(_) {}
        }

        function clearViewportSizingIfNoModal() {
            try {
                const modal = getActiveModal();
                if (!modal) {
                    setKeyboardVisibleMarker(false);
                }
            } catch(_) {}
        }

        function scrollFocusedIntoView(target) {
            try {
                if (!target) return;
                const modal = target.closest && target.closest('.modal');
                const scroller = getScrollable(modal);
                if (!scroller) return;
                // Auto-scroll on focus intentionally disabled unless explicitly enabled by flag.
                if (window.ModalFocusAutoScroll === true) {
                    // Delay slightly so keyboard/viewport settles
                    setTimeout(() => {
                        try {
                            if (typeof target.scrollIntoView === 'function') {
                                // Only auto-scroll if not inside a modal; avoid any snapping within modals
                                const inModal = target && target.closest && target.closest('.modal');
                                if (!inModal) target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
                            }
                            const tRect = target.getBoundingClientRect();
                            const sRect = scroller.getBoundingClientRect();
                            if (tRect.bottom > sRect.bottom - 16 || tRect.top < sRect.top + 16) {
                                const deltaTop = (tRect.top - sRect.top) - 80;
                                const desired = Math.max(0, scroller.scrollTop + deltaTop);
                                try { scroller.scrollTo({ top: desired, behavior: 'smooth' }); } catch(_) { scroller.scrollTop = desired; }
                            }
                        } catch(_) {}
                    }, 140);
                }
            } catch(_) {}
        }

        // Global focus handler for any input/select/textarea inside modals
        // Hard-disable any programmatic scrolling on input focus to prevent snapping.
        document.addEventListener('focusin', (e) => {
            try {
                const t = e.target;
                if (!t || !t.closest || !t.closest('.modal')) return;
                if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) {
                    // Intentionally do nothing: no auto-scroll on focus.
                    return;
                }
            } catch(_) {}
        }, true);

        // Install visualViewport listeners where supported
        if (window.visualViewport) {
            try {
                window.visualViewport.addEventListener('resize', applyViewportSizing);
                window.visualViewport.addEventListener('scroll', applyViewportSizing);
            } catch(_) {}
        } else {
            // Fallback: window resize
            window.addEventListener('resize', applyViewportSizing);
        }

        // When a modal opens, lock body scroll if first modal and re-apply sizing on next frame
        try {
            const origShow = window.showModal;
            window.showModal = function patchedShowModal(m){
                try {
                    // Lock body scroll if no other modals are visible (covers callers using the global window.showModal)
                    try {
                        const anyOpen = !!document.querySelector('.modal.show, .modal[style*="display: flex"]');
                        if (!anyOpen && window.UI && typeof window.UI.lockBodyScroll === 'function') window.UI.lockBodyScroll();
                    } catch(_) {}
                    return (origShow && origShow.call ? origShow.call(window, m) : (origShow ? origShow(m) : null));
                }
                finally { try { requestAnimationFrame(applyViewportSizing); setTimeout(applyViewportSizing, 60); } catch(_) {} }
            };
        } catch(_) {}

        // Also observe DOM changes to .modal.show state and adjust
        try {
            const mo = new MutationObserver(() => { applyViewportSizing(); clearViewportSizingIfNoModal(); });
            mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
        } catch(_) {}

        // Initial pass
        document.addEventListener('DOMContentLoaded', () => { setTimeout(applyViewportSizing, 80); });
        window.addEventListener('load', () => { setTimeout(applyViewportSizing, 120); });

        // Expose for debugging
        try { window.ModalViewportManager = { refresh: applyViewportSizing }; } catch(_) {}
    } catch (e) { /* silent */ }
})();

// Global guard: prevent programmatic scrollIntoView during input focus inside modals (anti-snap hardening)
(function installModalFocusScrollGuards(){
    try {
        if (window.__modalFocusScrollGuardsInstalled) return;
        window.__modalFocusScrollGuardsInstalled = true;

        let focusPhase = false;
        let focusTimer = null;
        const markFocusPhase = () => {
            focusPhase = true;
            if (focusTimer) clearTimeout(focusTimer);
            // Keep window for a short time slice to catch chained handlers (caret, selection)
            focusTimer = setTimeout(() => { focusPhase = false; }, 240);
        };

        document.addEventListener('focusin', (e)=>{
            try {
                const t = e.target;
                if (t && t.closest && t.closest('.modal')) {
                    markFocusPhase();
                }
            } catch(_) {}
        }, true);

        // Patch scrollIntoView to no-op during focus phase inside modals
        const proto = Element.prototype;
        const origSIV = proto.scrollIntoView;
        if (origSIV && !proto.__scrollIntoViewPatchedForModals) {
            Object.defineProperty(proto, '__scrollIntoViewPatchedForModals', { value: true, writable: false });
            proto.scrollIntoView = function patchedScrollIntoView(arg){
                try {
                    const inModal = this && this.closest && this.closest('.modal');
                    if (inModal && focusPhase) {
                        // Suppress scroll snapping triggered by focus/selection in modal
                        return; // no-op
                    }
                } catch(_) {}
                try { return origSIV.apply(this, arguments); } catch(e) { try { return origSIV.call(this, arg); } catch(_) {} }
            };
        }
    } catch(_) {}
})();
