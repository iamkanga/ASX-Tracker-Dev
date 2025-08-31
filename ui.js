document.addEventListener('DOMContentLoaded', function () {
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

    // --- Standard Calculator ---
    let currentCalculatorInput = '';
    let operator = null;
    let previousCalculatorInput = '';
    let resultDisplayed = false;

    const calculatorInput = $id('calculatorInput');
    const calculatorResult = $id('calculatorResult');
    const calculatorButtons = $('.calculator-buttons');

    function updateCalculatorDisplay() {
        if (!calculatorInput || !calculatorResult) return;
        calculatorInput.textContent = previousCalculatorInput + (operator ? ' ' + getOperatorSymbol(operator) + ' ' : '') + currentCalculatorInput;
        if (resultDisplayed) { /* nothing */ }
        else { calculatorResult.textContent = currentCalculatorInput === '' ? '0' : currentCalculatorInput; }
    }

    function calculateResult() {
        if (!calculatorResult) return;
        let prev = parseFloat(previousCalculatorInput);
        let current = parseFloat(currentCalculatorInput);
        if (isNaN(prev) || isNaN(current)) return;
        let res;
        switch (operator) {
            case 'add': res = prev + current; break;
            case 'subtract': res = prev - current; break;
            case 'multiply': res = prev * current; break;
            case 'divide':
                if (current === 0) { showCustomAlert('Cannot divide by zero!'); res = 'Error'; }
                else { res = prev / current; }
                break;
            default: return;
        }
        if (typeof res === 'number' && !isNaN(res)) { res = parseFloat(res.toFixed(10)); }
        calculatorResult.textContent = res;
        previousCalculatorInput = res.toString();
        currentCalculatorInput = '';
    }

    function getOperatorSymbol(op) {
        switch (op) {
            case 'add': return '+'; case 'subtract': return '-';
            case 'multiply': return '×'; case 'divide': return '÷';
            default: return '';
        }
    }

    function resetCalculator() {
        currentCalculatorInput = ''; operator = null; previousCalculatorInput = '';
        resultDisplayed = false;
        if(calculatorInput) calculatorInput.textContent = '';
        if(calculatorResult) calculatorResult.textContent = '0';
    }

    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const target = event.target;
            if (!target.classList.contains('calc-btn') || target.classList.contains('is-disabled-icon')) { return; }
            const value = target.dataset.value;
            const action = target.dataset.action;
            if (value) { appendNumber(value); }
            else if (action) { handleAction(action); }
        });
    }

    function appendNumber(num) {
        if (resultDisplayed) { currentCalculatorInput = num; resultDisplayed = false; }
        else { if (num === '.' && currentCalculatorInput.includes('.')) return; currentCalculatorInput += num; }
        updateCalculatorDisplay();
    }

    function handleAction(action) {
        if (action === 'clear') { resetCalculator(); return; }
        if (action === 'percentage') {
            if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
            let val;
            if (currentCalculatorInput !== '') {
                val = parseFloat(currentCalculatorInput);
            } else if (previousCalculatorInput !== '') {
                val = parseFloat(previousCalculatorInput);
            } else {
                return;
            }

            if (isNaN(val)) return;

            if (operator && previousCalculatorInput !== '') {
                const prevNum = parseFloat(previousCalculatorInput);
                if (isNaN(prevNum)) return;
                currentCalculatorInput = (prevNum * (val / 100)).toString();
            } else {
                currentCalculatorInput = (val / 100).toString();
            }
            resultDisplayed = false;
            updateCalculatorDisplay();
            return;
        }
        if (['add', 'subtract', 'multiply', 'divide'].includes(action)) {
            if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
            if (currentCalculatorInput !== '') {
                if (previousCalculatorInput !== '') { calculateResult(); previousCalculatorInput = calculatorResult.textContent; }
                else { previousCalculatorInput = currentCalculatorInput; }
            }
            operator = action; currentCalculatorInput = ''; resultDisplayed = false; updateCalculatorDisplay(); return;
        }
        if (action === 'calculate') {
            if (previousCalculatorInput === '' || currentCalculatorInput === '' || operator === null) { return; }
            calculateResult(); operator = null; resultDisplayed = true;
        }
    }
    // Expose resetCalculator on the UI object for external calls
    window.UI.resetCalculator = resetCalculator;

    // --- Dividend Calculator ---
    const calcDividendAmountInput = $id('calcDividendAmount');
    const calcCurrentPriceInput = $id('calcCurrentPrice');
    const calcFrankingCreditsInput = $id('calcFrankingCredits');
    const investmentValueSelect = $id('investmentValueSelect');
    const calcUnfrankedYieldSpan = $id('calcUnfrankedYield');
    const calcFrankedYieldSpan = $id('calcFrankedYield');
    const calcEstimatedDividend = $id('calcEstimatedDividend');

    function updateDividendCalculations() {
        if (!calcCurrentPriceInput || !calcDividendAmountInput || !calcFrankingCreditsInput || !investmentValueSelect || !calcUnfrankedYieldSpan || !calcFrankedYieldSpan || !calcEstimatedDividend) return;

        const currentPrice = parseFloat(calcCurrentPriceInput.value);
        const dividendAmount = parseFloat(calcDividendAmountInput.value);
        const frankingCredits = parseFloat(calcFrankingCreditsInput.value);
        const investmentValue = parseFloat(investmentValueSelect.value);

        const unfrankedYield = typeof calculateUnfrankedYield === 'function' ? calculateUnfrankedYield(dividendAmount, currentPrice) : null;
        const frankedYield = typeof calculateFrankedYield === 'function' ? calculateFrankedYield(dividendAmount, currentPrice, frankingCredits) : null;
        const estimatedDividend = typeof estimateDividendIncome === 'function' ? estimateDividendIncome(investmentValue, dividendAmount, currentPrice) : null;

        calcUnfrankedYieldSpan.textContent = unfrankedYield !== null ? (formatAdaptivePercent(unfrankedYield) + '%') : '-';
        calcFrankedYieldSpan.textContent = frankedYield !== null ? (formatAdaptivePercent(frankedYield) + '%') : '-';
        calcEstimatedDividend.textContent = estimatedDividend !== null ? ('$' + formatAdaptivePrice(estimatedDividend)) : '-';
    }

    if (calcDividendAmountInput && calcCurrentPriceInput && calcFrankingCreditsInput && investmentValueSelect) {
        [calcDividendAmountInput, calcCurrentPriceInput, calcFrankingCreditsInput, investmentValueSelect].forEach(input => {
            input.addEventListener('input', updateDividendCalculations);
            input.addEventListener('change', updateDividendCalculations);
        });
    }
})();
});
