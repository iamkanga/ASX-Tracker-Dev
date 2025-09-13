// ui.js - lightweight UI helpers exposed as window.UI for backwards compatibility
(function(){
    // Internal helpers: safe DOM queries
    function $(sel) { return document.querySelector(sel); }
    function $id(id) { return document.getElementById(id); }
    // Import calculation helpers from utils if available on window (script.js exposes via imports)
    try {
        if (!window.calculateUnfrankedYield && typeof calculateUnfrankedYield === 'function') window.calculateUnfrankedYield = calculateUnfrankedYield;
        if (!window.calculateFrankedYield && typeof calculateFrankedYield === 'function') window.calculateFrankedYield = calculateFrankedYield;
    } catch (e) { /* ignore if not present yet */ }

    // Expose safe global fallbacks so other modules can call these even if script.js hasn't attached real implementations yet.
    try {
        if (!window.logDebug) window.logDebug = function(){ try { console.log.apply(console, arguments); } catch(_){} };
        if (!window.showModal) window.showModal = function(m){ try { if (m) { m.style.setProperty('display','flex','important'); m.scrollTop = 0;} } catch(_){} };
        if (!window.hideModal) window.hideModal = function(m){ try { if (m) m.style.setProperty('display','none','important'); } catch(_){} };
        if (!window.scrollMainToTop) window.scrollMainToTop = function(instant){
            try {
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
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
    if (scrollableContent) scrollableContent.scrollTop = 0;
    try { if (modalElement.id === 'shareFormSection' && typeof initializeShareNameAutocomplete === 'function') initializeShareNameAutocomplete(true); } catch(_) {}
    }

    function showModalNoHistory(modalElement) {
        if (!modalElement) return;
        // No stack and no browser history push: used when restoring a previous modal on back
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
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) scrollableContent.scrollTop = 0;
    }

    // Hide a modal visually but keep it on the in-app back stack so it can be restored on Back
    function hideModalKeepStack(modalElement) {
        if (!modalElement) return;
        try { modalElement.classList.remove('show'); } catch(_){}
        modalElement.style.setProperty('display','none','important');
        // Note: do NOT call removeModalFromStack here, so the previous modal remains just beneath top
    }

    function hideModal(modalElement) {
        if (!modalElement) return;
        try { if (typeof window.removeModalFromStack === 'function') window.removeModalFromStack(modalElement); } catch(_) {}
        try { modalElement.classList.remove('show'); } catch(_){}
        try { modalElement.classList.add('app-hidden'); } catch(_){}
        modalElement.style.setProperty('display', 'none', 'important');
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
        if (!opts.suppressScroll) {
            try { if (window.scrollMainToTop) window.scrollMainToTop(true); else window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch(_) {}
        }
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
        ToastManager
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
            if (dividendCalcBtn){ dividendCalcBtn.addEventListener('click', function(){ try{ if (calcDividendAmountInput) calcDividendAmountInput.value = ''; if (calcCurrentPriceInput) calcCurrentPriceInput.value = ''; if (calcFrankingCreditsInput) calcFrankingCreditsInput.value = ''; if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '-'; if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '-'; if (calcEstimatedDividend) calcEstimatedDividend.textContent = '-'; if (investmentValueSelect) investmentValueSelect.value = '10000'; if (dividendCalculatorModal) { if (window.showModal) window.showModal(dividendCalculatorModal); else showModal(dividendCalculatorModal); } try{ if (window.scrollMainToTop) window.scrollMainToTop(); else scrollMainToTop(); }catch(_){} if (calcCurrentPriceInput) calcCurrentPriceInput.focus(); try{ if (window.toggleAppSidebar) window.toggleAppSidebar(false); else toggleAppSidebar(false); }catch(_){} }catch(e){console.warn('dividend open failed', e);} }); }
            [calcDividendAmountInput, calcCurrentPriceInput, calcFrankingCreditsInput, investmentValueSelect].forEach(function(input){ if (input){ input.addEventListener('input', updateDividendCalculations); input.addEventListener('change', updateDividendCalculations); } });

            if (standardCalcBtn){ standardCalcBtn.addEventListener('click', function(){ resetCalculator(); if (calculatorModal) showModal(calculatorModal); try{ if (window.scrollMainToTop) window.scrollMainToTop(); else scrollMainToTop(); }catch(_){} toggleAppSidebar(false); }); }

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
