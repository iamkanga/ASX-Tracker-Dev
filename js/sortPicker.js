import { getCurrentSortOrder, setCurrentSortOrder, getCurrentSelectedWatchlistIds } from './state.js';

// Sort Picker module

// NOTE: Instead of keeping a separate, possibly stale set of constants here,
// we'll dynamically read the live `#sortSelect` DOM options when opening the
// picker so the modal always mirrors the canonical source defined in
// `script.js` (renderSortSelect()). Keep fallback arrays in case the DOM
// isn't present (e.g., during unit tests).
const STOCK_OPTIONS = [];
const PORTFOLIO_OPTIONS = [];
const CASH_OPTIONS = [];

function buildRow(opt, currentValue) {
    const div = document.createElement('div');
    div.className = 'sort-picker-row';
    if (opt.value === currentValue) div.classList.add('active');
    div.tabIndex = 0;
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', opt.text);

    // Use a contextual icon for the left side depending on the field being sorted
    // Keep icons semantically consistent with header: percentage -> percent, dividend -> money bill,
    // capitalGain -> small graph, totalDollar -> coins, asset name -> tag
    let leftIcon = 'fa-sort';
    if (opt.value.startsWith('starRating')) leftIcon = 'fa-star';
    else if (opt.value.startsWith('percentageChange')) leftIcon = 'fa-percentage';
    else if (opt.value.startsWith('dayDollar')) leftIcon = 'fa-dollar-sign';
    else if (opt.value.startsWith('totalDollar')) leftIcon = 'fa-coins';
    else if (opt.value.startsWith('capitalGain')) leftIcon = 'fa-chart-line';
    else if (opt.value.startsWith('shareName')) leftIcon = null; // special: render ASX image if available, fallback to hashtag
    else if (opt.value.startsWith('name')) leftIcon = 'fa-house';
    else if (opt.value.startsWith('entryDate') || opt.value.startsWith('lastUpdated')) leftIcon = 'fa-calendar-alt';
    else if (opt.value.startsWith('dividendAmount')) leftIcon = 'fa-money-bill-wave';

    // Direction indicator: use solid triangle characters and theme colors.
    // Special-case alphabetical sorts (shareName, name): A-Z should show green ▲, Z-A red ▼.
    const parts = opt.value.split('-');
    const fieldKey = parts[0] || '';
    const isDesc = opt.value.endsWith('-desc');
    let triangleChar;
    let triangleClass;
    const isAlpha = (fieldKey === 'shareName' || fieldKey === 'name');
    if (isAlpha) {
        // For alphabetical: asc (A-Z) -> green ▲; desc (Z-A) -> red ▼
        const isAsc = opt.value.endsWith('-asc');
        triangleChar = isAsc ? '\u25B2' : '\u25BC';
        // Reuse existing CSS classes where 'desc' class maps to green and 'asc' to red
        triangleClass = isAsc ? 'sort-picker-triangle desc' : 'sort-picker-triangle asc';
    } else {
        // Numeric/monetary sorts: desc -> green ▲ (H-L), asc -> red ▼ (L-H)
        triangleChar = isDesc ? '\u25B2' : '\u25BC';
        triangleClass = isDesc ? 'sort-picker-triangle desc' : 'sort-picker-triangle asc';
    }

    // If leftIcon is null for shareName, render an inline ASX image if available, otherwise fallback to hashtag
        // Use inline SVG for the ASX mark so it can inherit color via `currentColor`.
        // Keep the hashtag fallback for older clients.
        const iconHtml = (leftIcon === null)
                ? `<svg class="sort-asx-icon" width="20" height="20" viewBox="0 0 24 24" role="img" aria-label="ASX" xmlns="http://www.w3.org/2000/svg"><text x="12" y="16" font-family="Inter, Arial, Helvetica, sans-serif" font-size="9" fill="currentColor" text-anchor="middle" font-weight="700">ASX</text></svg>` +
                    `<i class="fas fa-hashtag sort-asx-fallback" aria-hidden="true"></i>`
                : `<i class="fas ${leftIcon}"></i>`;

    div.innerHTML = `
        <div class="sort-picker-row-content">
            <div class="sort-picker-icon">${iconHtml}</div>
            <div class="sort-picker-label">${opt.text}</div>
            <div class="sort-picker-direction"><span class="${triangleClass}">${triangleChar}</span></div>
        </div>
    `;
    return div;
}

// Local helper to update the header button text to reflect current sort
async function updateSortPickerButtonText(retryCount = 0) {
    try {
        console.log('[DEBUG] updateSortPickerButtonText called (retry:', retryCount, ')');
        // Wait for the startup sort handshake if present (bounded to avoid blocking forever)
        try {
            if (window && window.__userSortReady) {
                console.log('[DEBUG] updateSortPickerButtonText: awaiting __userSortReady (bounded 1000ms)');
                // Wait bounded, but if it times out schedule a follow-up refresh when the handshake resolves
                const raced = await Promise.race([window.__userSortReady.then(() => 'resolved'), new Promise(res => setTimeout(() => res('timeout'), 1000))]);
                console.log('[DEBUG] updateSortPickerButtonText: after awaiting __userSortReady, outcome=', raced, 'currentSortOrder=', (typeof getCurrentSortOrder === 'function' ? getCurrentSortOrder() : window.currentSortOrder));
                // If our bounded wait timed out but the handshake exists and hasn't resolved yet,
                // attach a one-time listener to refresh header when it does resolve.
                try {
                    if (raced === 'timeout' && !window.__userSortReadyResolved) {
                        // Attach a one-shot resolver that updates header once the handshake resolves.
                        (async function attachFollowUp(){
                            try {
                                await window.__userSortReady;
                                // Small delay to allow DOM updates that renderSortSelect may perform
                                setTimeout(() => {
                                    try { updateSortPickerButtonText(); } catch(_) {}
                                }, 40);
                            } catch(_) {}
                        })();
                    }
                } catch(_) {}
            }
        } catch (err) {
            console.log('[DEBUG] updateSortPickerButtonText: __userSortReady await failed or timed out', err);
        }

        const current = getCurrentSortOrder();
        console.log('[DEBUG] Current sort order:', current);

        const textEl = document.getElementById('sortPickerBtnText');
        const iconEl = document.getElementById('sortIcon');
        const labelSpan = document.getElementById('sortPickerLabel');

        console.log('[DEBUG] DOM elements found - textEl:', !!textEl, 'iconEl:', !!iconEl, 'labelSpan:', !!labelSpan);

        // If critical elements are missing, retry after a longer delay (max 3 retries)
        if ((!textEl || !iconEl || !labelSpan) && retryCount < 3) {
            console.log('[DEBUG] Critical DOM elements missing, retrying in 100ms (attempt', retryCount + 1, 'of 3)');
            setTimeout(() => updateSortPickerButtonText(retryCount + 1), 100);
            return;
        }

        let found = null;
        try {
            const liveSelect = document.getElementById('sortSelect');
            if (liveSelect && liveSelect.options && liveSelect.options.length > 0) {
                const liveOptions = Array.from(liveSelect.options).map(o => ({ value: o.value, text: o.textContent }));
                found = liveOptions.find(o => o.value === current) || null;
                console.log('[DEBUG] Found option from DOM select:', found);
            }
        } catch(_) {
            console.log('[DEBUG] Failed to get option from DOM select');
            found = null;
        }

        // If we found the option in the DOM, use it; otherwise attempt to find the option
        // inside the published SORT_SOURCE arrays. This keeps the header in sync when
        // the DOM select may be hidden or rebuilt later.
        if (!found) {
            try {
                const s = window.SORT_SOURCE;
                const all = [];
                // Prefer labels from the active view to avoid mismatched text for identical values
                let sel = [];
                try { sel = getCurrentSelectedWatchlistIds() || []; } catch(_) { sel = []; }
                const inPortfolio = Array.isArray(sel) && sel.includes('portfolio');
                if (s) {
                    if (inPortfolio && Array.isArray(s.portfolioOptions)) all.push(...s.portfolioOptions);
                    if (Array.isArray(s.stockOptions)) all.push(...s.stockOptions);
                    if (!inPortfolio && Array.isArray(s.portfolioOptions)) all.push(...s.portfolioOptions);
                    if (Array.isArray(s.cashOptions)) all.push(...s.cashOptions);
                }
                const hit = all.find(o => o.value === current);
                if (hit) found = hit;
                console.log('[DEBUG] Found option from SORT_SOURCE:', found);
            } catch(_) {
                console.log('[DEBUG] Failed to get option from SORT_SOURCE');
                found = null;
            }
        }

        if (textEl) {
            console.log('[DEBUG] Updating text element');
            // keep icon node intact; write actual label text into dedicated span so icon isn't removed
                // Determine triangle direction consistently with modal logic:
                // - Alphabetical sorts (shareName/name): asc (A→Z) -> ▲, desc (Z→A) -> ▼
                // - Numeric/monetary sorts: desc (High→Low) -> ▲, asc (Low→High) -> ▼
                let triChar = '';
                try {
                    const val = found && found.value ? found.value : '';
                    const parts = val.split('-');
                    const fieldKey = parts[0] || '';
                    const isDesc = val.endsWith('-desc');
                    const isAsc = val.endsWith('-asc');
                    const isAlpha = (fieldKey === 'shareName' || fieldKey === 'name');
                    if (isAlpha) {
                        triChar = isAsc ? '\u25B2' : '\u25BC';
                    } else {
                        triChar = isDesc ? '\u25B2' : '\u25BC';
                    }
                } catch(_) {
                    triChar = (found && found.value && found.value.endsWith('-desc')) ? '\u25B2' : '\u25BC';
                }
            if (labelSpan) {
                console.log('[DEBUG] Updating label span with:', found ? found.text : 'Sort List');
                labelSpan.textContent = found ? found.text : 'Sort List';
                // Clean/recreate tri span inside the label span and apply themed color
                if (labelSpan) {
                    const existingTri = labelSpan.querySelector('.sort-title-triangle');
                    if (existingTri) existingTri.remove();
                    const triSpan = document.createElement('span');
                    triSpan.className = 'sort-title-triangle';
                    triSpan.textContent = found ? triChar : '';
                    // Theme: match the color of the watchlist title text if available
                    try {
                        const titleEl = document.getElementById('dynamicWatchlistTitleText') || document.getElementById('dynamicWatchlistTitle');
                        if (titleEl) {
                            const cs = window.getComputedStyle(titleEl);
                            if (cs && cs.color) triSpan.style.color = cs.color;
                        }
                    } catch(_) {}
                    labelSpan.appendChild(triSpan);
                }
                console.log('[DEBUG] Label span updated successfully');
            }
        } else {
            console.log('[DEBUG] textEl not found!');
        }
    // Update header icon span with a matching left icon based on the sort field
        if (iconEl) {
            console.log('[DEBUG] Updating icon element');
            try {
                let leftIcon = 'fa-sort';
                const val = found ? found.value : '';
                if (val.startsWith('starRating')) leftIcon = 'fa-star';
                else if (val.startsWith('percentageChange')) leftIcon = 'fa-percentage';
                else if (val.startsWith('dayDollar')) leftIcon = 'fa-dollar-sign';
                else if (val.startsWith('totalDollar')) leftIcon = 'fa-coins';
                else if (val.startsWith('capitalGain')) leftIcon = 'fa-chart-line';
                else if (val.startsWith('shareName')) leftIcon = null; // use ASX image
                else if (val.startsWith('name')) leftIcon = 'fa-house';
                else if (val.startsWith('entryDate') || val.startsWith('lastUpdated')) leftIcon = 'fa-calendar-alt';
                else if (val.startsWith('dividendAmount')) leftIcon = 'fa-money-bill-wave';
                // If leftIcon is null, render ASX image with a hidden fallback hashtag
                if (leftIcon === null) {
                    // Inline SVG uses currentColor so we can theme it by setting iconEl.style.color below
                    iconEl.innerHTML = `<svg class="sort-asx-icon" width="20" height="20" viewBox="0 0 24 24" role="img" aria-label="ASX" xmlns="http://www.w3.org/2000/svg"><text x="12" y="16" font-family="Inter, Arial, Helvetica, sans-serif" font-size="9" fill="currentColor" text-anchor="middle" font-weight="700">ASX</text></svg>` +
                                       `<i class="fas fa-hashtag sort-asx-fallback" aria-hidden="true"></i>`;
                } else {
                    iconEl.innerHTML = `<i class="fas ${leftIcon}"></i>`;
                }
                // Ensure the icon color matches the title font color (white/black as needed)
                try {
                    const titleEl = document.getElementById('dynamicWatchlistTitleText') || document.getElementById('dynamicWatchlistTitle');
                    if (titleEl) {
                        const cs = window.getComputedStyle(titleEl);
                        if (cs && cs.color) {
                            // Apply to container
                            iconEl.style.color = cs.color;
                            // Also explicitly set on any inline SVG child to be extra robust
                            try {
                                const svgChild = iconEl.querySelector('svg');
                                if (svgChild) svgChild.style.color = cs.color;
                            } catch(_) {}
                        }
                    }
                } catch(_) {}
                console.log('[DEBUG] Icon element updated successfully with icon:', leftIcon);
            } catch(_) {
                console.log('[DEBUG] Failed to update icon');
                iconEl.innerHTML = '';
            }
        } else {
            console.log('[DEBUG] iconEl not found!');
        }
        console.log('[DEBUG] updateSortPickerButtonText completed successfully');
    } catch(error) {
        console.error('[DEBUG] updateSortPickerButtonText failed:', error);
    }
}

// Make the function globally accessible for script.js
window.updateSortPickerButtonText = updateSortPickerButtonText;


    // Auto-initialize on DOM ready so the header button is wired without requiring manual bootstrapping
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { try { initSortPicker(); } catch(_) {} }, { once: true });
        } else {
            try { initSortPicker(); } catch(_) {}
        }
    } catch(_) {}
export function openSortPicker() {
    // Set a short-lived sentinel so global click handlers can ignore the initial
    // click that triggered opening the modal. This avoids immediate-close races.
    try { window.__sortPickerOpeningUntil = Date.now() + 200; setTimeout(()=>{ try{ window.__sortPickerOpeningUntil = 0; }catch(_){} }, 250); } catch(_) {}
    const modal = document.getElementById('sortPickerModal');
    const list = document.getElementById('sortPickerList');
    const btn = document.getElementById('sortPickerBtn');
    if (!modal || !list || !btn) return console.warn('Sort Picker: DOM elements missing.');

    // Determine options based on selected watchlist by reading the live #sortSelect
    const sel = getCurrentSelectedWatchlistIds();
    // We'll fetch the freshest current sort order immediately before rendering rows
    // to avoid a lagging highlight that uses a stale value.
    let current = (typeof getCurrentSortOrder === 'function') ? getCurrentSortOrder() : (window.currentSortOrder || '');
    list.innerHTML = '';

    // Prefer authoritative JS arrays published by renderSortSelect() if available.
    // This avoids parsing DOM options and keeps ordering identical to the source.
    let liveOptions = [];
    try {
        const src = window.SORT_SOURCE;
        if (src && (Array.isArray(src.stockOptions) || Array.isArray(src.portfolioOptions) || Array.isArray(src.cashOptions))) {
            // Merge unique options preserving order: stock, portfolio, cash as built by renderSortSelect
            const merged = [];
            const pushIfNew = (arr) => {
                (arr||[]).forEach(o => {
                    if (!merged.find(m => m.value === o.value)) merged.push({ value: o.value, text: o.text });
                });
            };
            pushIfNew(src.stockOptions);
            pushIfNew(src.portfolioOptions);
            pushIfNew(src.cashOptions);
            liveOptions = merged;
        } else {
            // Fallback to DOM options when SORT_SOURCE is not available
            const liveSelect = document.getElementById('sortSelect');
            if (liveSelect && liveSelect.options && liveSelect.options.length > 0) {
                liveOptions = Array.from(liveSelect.options).map(o => ({ value: o.value, text: o.textContent }));
            }
        }
    } catch(_) {
        liveOptions = [];
    }

    // Choose which options to render according to the current view
    let optionsToShow = [];
    if (Array.isArray(sel) && sel.includes('portfolio')) {
        // Limit to Portfolio-relevant fields
        optionsToShow = liveOptions.filter(o => ['dayDollar-desc','dayDollar-asc','percentageChange-desc','percentageChange-asc','capitalGain-desc','capitalGain-asc','totalDollar-desc','totalDollar-asc','shareName-asc','shareName-desc'].includes(o.value));
        // Enforce Portfolio-specific labels regardless of the underlying select's current label set
        optionsToShow = optionsToShow.map(o => {
            if (o.value && o.value.startsWith('dayDollar')) return { ...o, text: 'Daily P/L' };
            if (o.value && o.value.startsWith('percentageChange')) return { ...o, text: 'Daily Change' };
            return o;
        });
    } else if (Array.isArray(sel) && (sel.includes('cash') || sel.includes('cashBank') || sel.includes('cash-assets') || sel.includes('__cash') || sel.includes('cash-bank') || sel.includes('cash_bank') || sel.includes('CASH') || sel.includes('CASH_BANK'))) {
        // Cash & Assets: only name and balance sorts
        optionsToShow = liveOptions.filter(o => ['name-asc','name-desc','totalDollar-desc','totalDollar-asc'].includes(o.value));
    } else {
        // Main watchlist: ensure Date Added appears last
        const preferredOrder = ['percentageChange-desc','percentageChange-asc','dayDollar-desc','dayDollar-asc','shareName-asc','shareName-desc','starRating-desc','starRating-asc','dividendAmount-desc','dividendAmount-asc','entryDate-desc','entryDate-asc'];
        optionsToShow = preferredOrder.map(val => liveOptions.find(o => o.value === val)).filter(Boolean);
    }

    // Re-read current sort order right before building rows to ensure we use live state
    try { current = (typeof getCurrentSortOrder === 'function') ? getCurrentSortOrder() : (window.currentSortOrder || ''); } catch(_) {}

    optionsToShow.forEach(opt => {
        const row = buildRow(opt, current);
        row.onclick = () => {
            try {
                // Mark this as a user-initiated change so the startup lock doesn't ignore it.
                try { window.__userInitiatedSortChange = true; setTimeout(()=>{ try{ window.__userInitiatedSortChange = false; }catch(_){} }, 400); } catch(_) {}
                setCurrentSortOrder(opt.value);
            } catch(_) {}

            // Try to update native select to keep canonical state; don't fail the flow if this errors
            try {
                const native = document.getElementById('sortSelect');
                if (native) {
                    native.value = opt.value;
                    const ev = new Event('change', { bubbles: true });
                    native.dispatchEvent(ev);
                }
            } catch (e) {
                console.warn('Sort Picker: Failed to update native sortSelect', e);
            }

            // Always update header text and trigger the render pipeline
            try { updateSortPickerButtonText(); } catch(_) {}
            try { if (typeof window.sortShares === 'function') window.sortShares(); else if (typeof window.renderWatchlist === 'function') window.renderWatchlist(); } catch(_) {}
            try { if (typeof window.renderPortfolioList === 'function') window.renderPortfolioList(); } catch(_) {}
            try { if (typeof window.renderCashCategories === 'function') window.renderCashCategories(); } catch(_) {}

            // Ensure main content sits directly below any changed header layout after sort (universal fix requirement)
            try { if (window.repositionMainContentUnderHeader) window.repositionMainContentUnderHeader(); else if (window.adjustMainContentPadding) window.adjustMainContentPadding(); } catch(_) {}

            // Hide modal and return focus to button
            try {
                const modalEl = document.getElementById('sortPickerModal');
                if (window.UI && typeof window.UI.hideModal === 'function') window.UI.hideModal(modalEl);
                else if (typeof hideModal === 'function') hideModal(modalEl);
                else if (modalEl) { modalEl.classList.remove('show'); modalEl.classList.add('app-hidden'); modalEl.style.setProperty('display','none','important'); }
            } catch(_) {}
            try { const btn = document.getElementById('sortPickerBtn'); if (btn) { btn.setAttribute('aria-expanded','false'); if (window.safeFocus) window.safeFocus(btn); else try { btn.focus({ preventScroll:true }); } catch(_) { btn.focus(); } } } catch(_) {}
        };
        row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); } };
        list.appendChild(row);
    });

    // Show modal using existing helper if present (prefer window.UI)
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            window.UI.showModal(modal);
        } else if (typeof showModal === 'function') {
            showModal(modal);
        } else {
            // Fallback: remove load-time hiding and set display
            modal.classList.remove('app-hidden');
            modal.classList.add('show');
            modal.style.setProperty('display', 'flex', 'important');
        }
    } catch (e) {
        try { modal.classList.remove('app-hidden'); modal.style.setProperty('display', 'flex', 'important'); } catch(_){}
    }
}

// Wire header button and update visible text from current state
export function initSortPicker() {
    const btn = document.getElementById('sortPickerBtn');
    const textEl = document.getElementById('sortPickerBtnText');
    // initSortPicker invoked
    if (!btn) return;

    // Check if DOM elements are ready before proceeding
    const labelSpan = document.getElementById('sortPickerLabel');
    const iconEl = document.getElementById('sortIcon');
    if (!textEl || !labelSpan || !iconEl) {
        console.log('[DEBUG] initSortPicker: DOM elements not ready, retrying in 100ms');
        setTimeout(() => initSortPicker(), 100);
        return;
    }

    console.log('[DEBUG] initSortPicker: All DOM elements ready, proceeding with initialization');

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        // Prevent the app-global click handlers from seeing this click and
        // immediately closing the modal (race condition on open).
        try { e.stopImmediatePropagation(); e.stopPropagation(); } catch(_) {}
        openSortPicker();
        try { btn.setAttribute('aria-expanded', 'true'); } catch(_) {}
        setTimeout(()=>{
            const first = document.querySelector('#sortPickerList .sort-picker-row');
            if (first) { try { if (window.safeFocus) window.safeFocus(first); else try { first.focus({ preventScroll:true }); } catch(_) { first.focus(); } } catch(_) {} }
        },30);
    });

    // Close button inside modal should hide and return focus
    try {
        const closeBtn = document.getElementById('closeSortPickerBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                try { e.preventDefault(); e.stopPropagation(); } catch(_){}
                const modal = document.getElementById('sortPickerModal');
                try { if (window.UI && window.UI.hideModal) window.UI.hideModal(modal); else if (typeof hideModal === 'function') hideModal(modal); else { modal.classList.remove('show'); modal.classList.add('app-hidden'); modal.style.setProperty('display','none','important'); } } catch(_){}
                try { btn.setAttribute('aria-expanded','false'); if (window.safeFocus) window.safeFocus(btn); else try { btn.focus({ preventScroll:true }); } catch(_) { btn.focus(); } } catch(_){}
            });
        }
    } catch(_) {}

    // Sync text with current sort on init
    updateSortPickerButtonText();
}

export default { openSortPicker, initSortPicker };

// Global one-time binding to handle click-outside (overlay) and Escape key for Sort Picker
if (!window.__sortPickerGlobalBound) {
    window.__sortPickerGlobalBound = true;
    try {
        const modal = document.getElementById('sortPickerModal');
        const btn = document.getElementById('sortPickerBtn');
        window.addEventListener('click', (e) => {
            try {
                if (e.target === modal) {
                    try { hideModal(modal); } catch(_) { if (modal) modal.classList.add('app-hidden'); }
                    if (btn) btn.setAttribute('aria-expanded','false');
                    if (btn) { try { if (window.safeFocus) window.safeFocus(btn); else try { btn.focus({ preventScroll:true }); } catch(_) { btn.focus(); } } catch(_) {} }
                }
            } catch(_) {}
        });
        window.addEventListener('keydown', (e) => {
            try {
                // Use class-based visibility check rather than inline styles.
                if (e.key === 'Escape' && modal && !modal.classList.contains('app-hidden')) {
                    try { hideModal(modal); } catch(_) { modal.classList.add('app-hidden'); }
                    if (btn) btn.setAttribute('aria-expanded','false');
                    if (btn) { try { if (window.safeFocus) window.safeFocus(btn); else try { btn.focus({ preventScroll:true }); } catch(_) { btn.focus(); } } catch(_) {} }
                }
            } catch(_) {}
        });
    } catch(_) {}
}
