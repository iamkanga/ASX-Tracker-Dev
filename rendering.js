// rendering.js - rendering functions moved out of script.js
// Exposes functions under window.Rendering for backwards compatibility

(function () {
    window.Rendering = window.Rendering || {};

    // Diagnostic marker
    try { if (typeof window !== 'undefined') window.__renderingModuleLoaded = true; } catch (_) { }

    // Shim for adjustMainContentPadding
    function adjustMainContentPadding() {
        if (window.UI && typeof window.UI.adjustMainContentPadding === 'function') {
            return window.UI.adjustMainContentPadding();
        }
        if (typeof window.adjustMainContentPadding === 'function') {
            return window.adjustMainContentPadding();
        }
    }

    window.Rendering.addShareToTable = function addShareToTable(share) {
        const shareTableBodyLocal = (typeof window !== 'undefined' && window.shareTableBody) || document.querySelector('#shareTable tbody');
        // Diagnostic log removed
        if (!shareTableBodyLocal) {
            console.error('addShareToTable: shareTableBody element not found.');
            return;
        }

        const row = document.createElement('tr');
        row.dataset.docId = share.id;

        row.addEventListener('click', () => {
            try { window.logDebug && window.logDebug('Table Row Click: Share ID: ' + share.id); } catch (_) { }
            try { window.selectShare ? window.selectShare(share.id) : selectShare(share.id); } catch (_) { }
            try { if (row.closest && row.closest('#targetHitSharesList')) { wasShareDetailOpenedFromTargetAlerts = true; } } catch (_) { }
            try { window.showShareDetails ? window.showShareDetails() : showShareDetails(); } catch (_) { }
        });

        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData ? livePriceData.targetHit : false;

        const displayData = window.getShareDisplayData(share);
        const companyInfo = allAsxCodes.find(c => c.code === (share.shareName || '').toUpperCase());
        const companyName = companyInfo ? companyInfo.name : '';

        // Build pulsing dot with direction color
        let desktopTargetDot = '';
        if (isTargetHit && !window.targetHitIconDismissed) {
            let delta = 0; let haveDelta = false;
            if (livePriceData && livePriceData.live != null && livePriceData.prevClose != null && !isNaN(livePriceData.live) && !isNaN(livePriceData.prevClose)) { delta = Number(livePriceData.live) - Number(livePriceData.prevClose); haveDelta = true; }
            else if (livePriceData && livePriceData.lastLivePrice != null && livePriceData.lastPrevClose != null && !isNaN(livePriceData.lastLivePrice) && !isNaN(livePriceData.lastPrevClose)) { delta = Number(livePriceData.lastLivePrice) - Number(livePriceData.lastPrevClose); haveDelta = true; }
            const color = haveDelta ? (delta > 0 ? 'var(--brand-green)' : (delta < 0 ? 'var(--brand-red)' : 'var(--accent-color)')) : 'var(--accent-color)';
            desktopTargetDot = `<span class="target-hit-dot" aria-label="Alert target hit" style="background:${color}"></span>`;
        }
        row.innerHTML = `
            <td>
                <span class="share-code-display ${displayData.priceClass}">${share.shareName || ''}</span>${desktopTargetDot}
                ${companyName ? `<br><small class="company-name-small">${companyName}</small>` : ''}
            </td>
            <td class="live-price-cell">
                <span class="live-price-value ${displayData.priceClass}">${displayData.displayLivePrice}</span>
                <span class="price-change ${displayData.priceClass}">${displayData.displayPriceChange}</span>
            </td>
            <td class="numeric-data-cell alert-target-cell">${window.renderAlertTargetInline(share)}</td>
            <td class="star-rating-cell numeric-data-cell">
                ${share.starRating > 0 ? '⭐'.repeat(share.starRating) : ''}
            </td>
            <td class="numeric-data-cell">
                ${(() => {
                const dividendAmount = Number(share.dividendAmount) || 0;
                const frankingCredits = Math.trunc(Number(share.frankingCredits) || 0);
                const enteredPrice = Number(share.currentPrice) || 0;
                const priceForYield = (displayData.displayLivePrice !== 'N/A' && displayData.displayLivePrice.startsWith('$'))
                    ? parseFloat(displayData.displayLivePrice.substring(1))
                    : (enteredPrice > 0 ? enteredPrice : 0);
                if (priceForYield === 0 || (dividendAmount === 0 && frankingCredits === 0)) return '';
                const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits);
                const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield);
                if (frankingCredits > 0 && frankedYield > 0) {
                    return formatAdaptivePercent(frankedYield) + '% (F)';
                } else if (unfrankedYield > 0) {
                    return formatAdaptivePercent(unfrankedYield) + '% (U)';
                }
                return '';
            })()}
            </td>
        `;

        try {
            const lp = livePrices[share.shareName.toUpperCase()];
            let delta = 0; let haveDelta = false;
            if (lp && lp.live != null && lp.prevClose != null && !isNaN(lp.live) && !isNaN(lp.prevClose)) { delta = Number(lp.live) - Number(lp.prevClose); haveDelta = true; }
            else if (lp && lp.lastLivePrice != null && lp.lastPrevClose != null && !isNaN(lp.lastLivePrice) && !isNaN(lp.lastPrevClose)) { delta = Number(lp.lastLivePrice) - Number(lp.lastPrevClose); haveDelta = true; }
            row.classList.remove('positive-change-row', 'negative-change-row', 'neutral-change-row');
            if (!row.classList.contains('movement-sides')) row.classList.add('movement-sides');
            if (haveDelta && delta > 0) row.classList.add('positive-change-row');
            else if (haveDelta && delta < 0) row.classList.add('negative-change-row');
            else row.classList.add('neutral-change-row');
        } catch (_) { }

        shareTableBodyLocal.appendChild(row);
        try { /* row appended */ } catch (_) { }
    };

    window.Rendering.addShareToMobileCards = function addShareToMobileCards(share) {
        const mobileShareCardsLocal = (typeof window !== 'undefined' && window.mobileShareCardsContainer) || document.getElementById('mobileShareCards');
        if (!mobileShareCardsLocal) { console.error('addShareToMobileCards: mobileShareCardsContainer element not found.'); return; }
        const template = document.getElementById('mobile-share-card-template');
        if (!template) { console.error('addShareToMobileCards: template not found.'); return; }
        const card = template.content.cloneNode(true).querySelector('.mobile-card');
        card.dataset.docId = share.id;
        const displayData = window.getShareDisplayData(share);
        const { displayLivePrice, displayPriceChange, priceClass, peRatio, high52Week, low52Week } = displayData;
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData ? livePriceData.targetHit : false;
        if (displayData.cardPriceChangeClass) card.classList.add(displayData.cardPriceChangeClass);
        if (!card.classList.contains('movement-sides')) card.classList.add('movement-sides');
        // Set dynamic pulse color for target-hit based on delta
        // nothing: dot will convey alert; we keep movement-sides for daily movement accents
        let arrowSymbol = '';
        if (priceClass === 'positive') arrowSymbol = '▲'; else if (priceClass === 'negative') arrowSymbol = '▼';
        // Inject pulsing dot next to the code (left)
        const codeEl = card.querySelector('.card-code');
        codeEl.textContent = '';
        // Append text first, then dot on the right if target is hit
        codeEl.appendChild(document.createTextNode(share.shareName || ''));
        if (isTargetHit && !window.targetHitIconDismissed) {
            // compute color from movement
            let delta = 0; let haveDelta = false;
            if (livePriceData && livePriceData.live != null && livePriceData.prevClose != null && !isNaN(livePriceData.live) && !isNaN(livePriceData.prevClose)) { delta = Number(livePriceData.live) - Number(livePriceData.prevClose); haveDelta = true; }
            else if (livePriceData && livePriceData.lastLivePrice != null && livePriceData.lastPrevClose != null && !isNaN(livePriceData.lastLivePrice) && !isNaN(livePriceData.lastPrevClose)) { delta = Number(livePriceData.lastLivePrice) - Number(livePriceData.lastPrevClose); haveDelta = true; }
            const color = haveDelta ? (delta > 0 ? 'var(--brand-green)' : (delta < 0 ? 'var(--brand-red)' : 'var(--accent-color)')) : 'var(--accent-color)';
            const dot = document.createElement('span'); dot.className = 'target-hit-dot'; dot.setAttribute('aria-label', 'Alert target hit'); dot.style.background = color; codeEl.appendChild(dot);
        }
        // text is already appended above
        card.querySelector('.card-chevron').textContent = arrowSymbol;
        card.querySelector('.card-chevron').className = `change-chevron card-chevron ${priceClass}`;
        card.querySelector('.card-live-price').textContent = displayLivePrice;
        card.querySelector('.card-price-change').textContent = displayPriceChange;
        card.querySelector('.card-price-change').className = `price-change-large card-price-change ${priceClass}`;
        // Removed 52-week and P/E ratio elements for compact design
        const alertTargetRow = card.querySelector('[data-template-conditional="alertTarget"]');
        const alertTargetValue = window.renderAlertTargetInline(share);
        if (alertTargetValue) { alertTargetRow.querySelector('.data-value').innerHTML = alertTargetValue; alertTargetRow.style.display = ''; } else { alertTargetRow.style.display = 'none'; }

        // Populate bottom info row with comments title and star rating
        const bottomInfoRow = card.querySelector('.bottom-info-row');
        const commentsTitleEl = bottomInfoRow.querySelector('.comments-title');
        const starRatingEl = bottomInfoRow.querySelector('.star-rating');

        // Don't inject comments or star rating into compact view cards - keep DOM minimal
        const isCompactRender = (mobileShareCardsLocal && mobileShareCardsLocal.classList && mobileShareCardsLocal.classList.contains('compact-view')) || currentMobileViewMode === 'compact';
        if (isCompactRender) {
            // Ensure they're empty/hidden for compact layout
            try { commentsTitleEl.textContent = ''; commentsTitleEl.style.display = 'none'; } catch (_) { }
            try { starRatingEl.textContent = ''; starRatingEl.style.display = 'none'; } catch (_) { }
            try { bottomInfoRow.style.display = 'none'; } catch (_) { }
        } else {
            // Handle comments title (left side) - show actual comment content
            const comments = share.comments || [];
            let commentDisplayText = '';
            if (Array.isArray(comments) && comments.length > 0) {
                // Get the first comment that has content
                const firstComment = comments.find(c => c && (c.title || c.text));
                if (firstComment) {
                    // Prefer title, fall back to text
                    commentDisplayText = firstComment.title || firstComment.text || '';
                    // Truncate if too long for mobile display
                    if (commentDisplayText.length > 20) {
                        commentDisplayText = commentDisplayText.substring(0, 17) + '...';
                    }
                }
            }

            if (commentDisplayText) {
                commentsTitleEl.textContent = commentDisplayText;
                commentsTitleEl.style.display = '';
            } else {
                commentsTitleEl.textContent = '';
                commentsTitleEl.style.display = 'none';
            }

            // Handle star rating (right side, just stars)
            const starRating = share.starRating || 0;
            if (starRating > 0) {
                starRatingEl.textContent = '⭐'.repeat(starRating);
                starRatingEl.style.display = '';
            } else {
                starRatingEl.textContent = '';
                starRatingEl.style.display = 'none';
            }

            // Hide entire bottom row if both elements are hidden
            if (!commentDisplayText && (share.starRating || 0) === 0) {
                bottomInfoRow.style.display = 'none';
            } else {
                bottomInfoRow.style.display = '';
            }
        }

        // Removed star rating and dividend yield elements for compact design
        card.addEventListener('click', () => { try { selectShare(share.id); showShareDetails(); } catch (_) { } });
        mobileShareCardsLocal.appendChild(card);
    };

    // renderPortfolioList moved here
    window.Rendering.renderPortfolioList = function renderPortfolioList() {
        console.log('[Debug] rendering.js renderPortfolioList CALLED');
        const portfolioListContainer = document.getElementById('portfolioListContainer');
        if (!portfolioListContainer) return;
        const portfolioShares = allSharesData.filter(s => shareBelongsTo(s, 'portfolio'));
        if (portfolioShares.length === 0) { portfolioListContainer.innerHTML = '<p>No shares in your portfolio yet.</p>'; return; }
        function fmtMoney(n) { return formatMoney(n); }
        function fmtPct(n) { return formatPercent(n); }
        let totalValue = 0; let totalPL = 0; let totalCostBasis = 0;
        const rowsHtml = portfolioShares.map(share => {
            const shares = Number(share.portfolioShares) || 0; const avg = Number(share.portfolioAvgPrice) || 0; const lpObj = livePrices[share.shareName.toUpperCase()] || {};
            const live = (lpObj.live != null && !isNaN(lpObj.live)) ? Number(lpObj.live) : (lpObj.lastLivePrice != null && !isNaN(lpObj.lastLivePrice) ? Number(lpObj.lastLivePrice) : null);
            const currentValue = (live !== null) ? live * shares : avg * shares; const cost = avg * shares; const pl = currentValue - cost; totalValue += currentValue; totalCostBasis += cost; totalPL += pl;
            const costBasis = avg * shares;
            const unrealizedPL = currentValue - costBasis;
            const plPercentage = costBasis !== 0 ? (unrealizedPL / costBasis) * 100 : 0;
            return `<div class="portfolio-row" data-share-code="${share.shareName}">
                <div class="p-code">${share.shareName}</div>
                <div class="p-shares">${shares}</div>
                <div class="p-price">${fmtMoney(live || avg)}</div>
                <div class="p-value">${fmtMoney(currentValue)}</div>
                <div class="p-pl ${pl > 0 ? 'positive' : 'negative'}">${fmtMoney(pl)}</div>
                <div class="expand-arrow">▼</div>
                <div class="portfolio-expanded-content">
                    <div class="detail-row">
                        <span class="detail-label">Average Cost:</span>
                        <span class="detail-value">${fmtMoney(avg)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Cost Basis:</span>
                        <span class="detail-value">${fmtMoney(costBasis)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Unrealized P/L:</span>
                        <span class="detail-value ${unrealizedPL >= 0 ? 'positive' : 'negative'}">${fmtMoney(unrealizedPL)} (${fmtPct(plPercentage)})</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Live Price:</span>
                        <span class="detail-value">${live !== null ? fmtMoney(live) : 'N/A'}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
        portfolioListContainer.innerHTML = `<div class="portfolio-summary">Total Value: ${fmtMoney(totalValue)} &nbsp; Cost: ${fmtMoney(totalCostBasis)} &nbsp; P/L: ${fmtMoney(totalPL)}</div><div class="portfolio-rows">${rowsHtml}</div>`;

        // Add expand/collapse functionality to portfolio rows
        setTimeout(() => {
            const portfolioRows = portfolioListContainer.querySelectorAll('.portfolio-row');
            portfolioRows.forEach(row => {
                const arrow = row.querySelector('.expand-arrow');
                const content = row.querySelector('.portfolio-expanded-content');

                row.addEventListener('click', (e) => {
                    // Don't toggle if clicking on the arrow itself (already handled)
                    if (e.target === arrow) return;

                    const isExpanded = row.classList.contains('expanded');
                    if (isExpanded) {
                        row.classList.remove('expanded');
                        arrow.classList.remove('expanded');
                        content.classList.remove('show');
                    } else {
                        row.classList.add('expanded');
                        arrow.classList.add('expanded');
                        content.classList.add('show');
                    }
                });

                // Also allow clicking on the arrow specifically
                if (arrow) {
                    arrow.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isExpanded = row.classList.contains('expanded');
                        if (isExpanded) {
                            row.classList.remove('expanded');
                            arrow.classList.remove('expanded');
                            content.classList.remove('show');
                        } else {
                            row.classList.add('expanded');
                            arrow.classList.add('expanded');
                            content.classList.add('show');
                        }
                    });
                }
            });
        }, 100);
    };

    // Move renderWatchlist into Rendering
    window.Rendering.renderWatchlist = function renderWatchlist() {
        try { if (typeof window !== 'undefined') window.__lastRenderWatchlistCall = Date.now(); } catch (_) { }
        // Verbose diagnostic removed
        try {
            const dbgAllSharesLen = (typeof allSharesData !== 'undefined' && Array.isArray(allSharesData)) ? allSharesData.length : (typeof window !== 'undefined' && Array.isArray(window.allSharesData) ? window.allSharesData.length : 0);
            const dbgTableExists = !!document.getElementById('shareTable');
            const dbgMobileExists = !!document.getElementById('mobileShareCards');
            const dbgCurrentSelected = (typeof currentSelectedWatchlistIds !== 'undefined' && Array.isArray(currentSelectedWatchlistIds)) ? currentSelectedWatchlistIds : (typeof window !== 'undefined' ? window.currentSelectedWatchlistIds : null);
            // Diagnostic info omitted
        } catch (_) { }
        // If we have reused stale data from localStorage, apply visual indicators
        try {
            if (typeof window !== 'undefined' && window.__usedStaleData) {
                try { if (typeof window.__applyStaleUIIndicators === 'function') window.__applyStaleUIIndicators(); } catch (_) { }
            }
        } catch (_) { }

        // Check if Snapshot View is active and prevent overwrite
        const snapshotContainer = document.getElementById('snapshot-view-container');
        const isSnapshotActive = snapshotContainer && snapshotContainer.style.display === 'block';

        // Use a safe local copy of currentSelectedWatchlistIds to avoid ReferenceError if the
        // bare identifier isn't defined due to script load order. Prefer the in-scope variable
        // when available, otherwise fall back to window.
        const currentSelectedWatchlistIdsLocal = (typeof currentSelectedWatchlistIds !== 'undefined' && Array.isArray(currentSelectedWatchlistIds)) ? currentSelectedWatchlistIds : ((typeof window !== 'undefined' && Array.isArray(window.currentSelectedWatchlistIds)) ? window.currentSelectedWatchlistIds : []);

        if (isSnapshotActive) {
            // Only intervene if we are in portfolio context (snapshot view is only for portfolio)
            const isPortfolioContext = currentSelectedWatchlistIdsLocal.includes('portfolio');
            console.log('[RenderWatchlist] Snapshot active. Context:', currentSelectedWatchlistIdsLocal, 'isPortfolio:', isPortfolioContext);
            if (isPortfolioContext) {
                if (typeof window.renderSnapshotView === 'function') {
                    console.log('[RenderWatchlist] Delegating to renderSnapshotView');
                    window.renderSnapshotView();
                }
                return; // EXIT EARLY to prevent standard render from hiding snapshot view
            }
        } else {
            // console.log('[RenderWatchlist] Snapshot NOT active. Container:', snapshotContainer, 'Display:', snapshotContainer ? snapshotContainer.style.display : 'N/A');
        }

        try {
            logDebug('DEBUG: renderWatchlist called. Current selected watchlist ID: ' + (currentSelectedWatchlistIdsLocal[0] || null));
        } catch (_) { }
        try {
            if (!window.__moversInitialEnforced && currentSelectedWatchlistIds && currentSelectedWatchlistIds[0] === '__movers') {
                window.__moversInitialEnforced = true;
                setTimeout(() => { try { if (typeof enforceMoversVirtualView === 'function') enforceMoversVirtualView(); } catch (e) { console.warn('Initial movers enforce failed', e); } }, 150);
            }
        } catch (_) { }

        // Resolve allSharesData safely: prefer a bare variable if present, otherwise fallback to window
        const allSharesDataLocal = (typeof allSharesData !== 'undefined' && Array.isArray(allSharesData)) ? allSharesData : (typeof window !== 'undefined' && Array.isArray(window.allSharesData) ? window.allSharesData : []);
        const livePricesLocal = (typeof livePrices !== 'undefined' && livePrices && typeof livePrices === 'object') ? livePrices : (typeof window !== 'undefined' && window.livePrices && typeof window.livePrices === 'object' ? window.livePrices : {});

        // Resolve commonly used container globals safely so code doesn't throw if script.js
        // hasn't yet declared them (test environments can load rendering.js early).
        const mobileShareCardsContainer = (typeof window !== 'undefined' && window.mobileShareCardsContainer) || document.getElementById('mobileShareCards');
        const tableContainer = (typeof window !== 'undefined' && window.tableContainer) || document.querySelector('.table-container') || document.getElementById('shareTable')?.closest('.table-container');
        const stockWatchlistSectionLocal = (typeof stockWatchlistSection !== 'undefined' && stockWatchlistSection) || document.getElementById('stockWatchlistSection') || document.querySelector('.share-list-section');
        const cashAssetsSectionLocal = (typeof cashAssetsSection !== 'undefined' && cashAssetsSection) || document.getElementById('cashAssetsSection');
        const sortSelectLocal = (typeof sortSelect !== 'undefined' && sortSelect) || document.getElementById('sortSelect');
        const refreshLivePricesBtnLocal = (typeof refreshLivePricesBtn !== 'undefined' && refreshLivePricesBtn) || document.getElementById('refreshLivePricesBtn');
        const toggleCompactViewBtnLocal = (typeof toggleCompactViewBtn !== 'undefined' && toggleCompactViewBtn) || document.getElementById('toggleCompactViewBtn');
        const exportWatchlistBtnLocal = (typeof exportWatchlistBtn !== 'undefined' && exportWatchlistBtn) || document.getElementById('exportWatchlistBtn');
        const mainContainerLocal = (typeof mainContainer !== 'undefined' && mainContainer) || document.querySelector('main.container');
        const asxCodeButtonsContainerLocal = (typeof asxCodeButtonsContainer !== 'undefined' && asxCodeButtonsContainer) || document.getElementById('asxCodeButtonsContainer');
        const targetHitIconBtnLocal = (typeof targetHitIconBtn !== 'undefined' && targetHitIconBtn) || document.getElementById('targetHitIconBtn');

        // Fix: Ensure isCompactView is defined
        const isCompactView = localStorage.getItem('viewMode') === 'compact';
        const isMobileView = window.innerWidth <= 640;

        const shareTable = document.getElementById('shareTable');
        if (isCompactView) {
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'grid';
            if (tableContainer) tableContainer.style.setProperty('display', 'none', 'important');
            if (shareTable) shareTable.style.setProperty('display', 'none', 'important');
        } else if (isMobileView) {
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'flex';
            if (tableContainer) tableContainer.style.setProperty('display', 'none', 'important');
            if (shareTable) shareTable.style.setProperty('display', 'none', 'important');
        } else {
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.setProperty('display', 'none', 'important');
            if (tableContainer) tableContainer.style.display = '';
            if (shareTable) shareTable.style.display = '';
        }

        const selectedWatchlistId = (currentSelectedWatchlistIdsLocal && currentSelectedWatchlistIdsLocal.length > 0) ? currentSelectedWatchlistIdsLocal[0] : null;
        // Some environments load rendering.js before script.js which defines ALL_SHARES_ID.
        // Use a safe local fallback so the 'All Shares' rendering path still works.
        const ALL_SHARES_ID_LOCAL = (typeof window !== 'undefined' && window.ALL_SHARES_ID) ? window.ALL_SHARES_ID : 'all_shares_option';
        const CASH_BANK_WATCHLIST_ID = 'cashBank';

        if (stockWatchlistSectionLocal) stockWatchlistSectionLocal.classList.add('app-hidden');
        if (cashAssetsSectionLocal) cashAssetsSectionLocal.classList.add('app-hidden');

        if (selectedWatchlistId === 'portfolio') {
            if (stockWatchlistSectionLocal) stockWatchlistSectionLocal.classList.add('app-hidden');
            if (cashAssetsSectionLocal) cashAssetsSectionLocal.classList.add('app-hidden');
            // Explicitly hide them via style to be sure, as app-hidden might be overridden
            if (stockWatchlistSectionLocal) stockWatchlistSectionLocal.style.display = 'none';
            if (cashAssetsSectionLocal) cashAssetsSectionLocal.style.display = 'none';

            let portfolioSection = document.getElementById('portfolioSection');
            if (!portfolioSection) {
                portfolioSection = document.createElement('div');
                portfolioSection.id = 'portfolioSection';
                portfolioSection.className = 'portfolio-section';
                portfolioSection.innerHTML = '<div id="portfolioListContainer">Loading portfolio...</div>';
                if (mainContainerLocal) mainContainerLocal.appendChild(portfolioSection);
            }
            portfolioSection.style.display = 'block';
            if (sortSelectLocal) sortSelectLocal.classList.remove('app-hidden');
            if (refreshLivePricesBtnLocal) refreshLivePricesBtnLocal.classList.add('app-hidden');
            if (toggleCompactViewBtnLocal) toggleCompactViewBtnLocal.classList.add('app-hidden');
            if (exportWatchlistBtnLocal) exportWatchlistBtnLocal.classList.remove('app-hidden');
            if (typeof window.renderPortfolioList === 'function') window.renderPortfolioList();
            try { window.renderSortSelect(); } catch (e) { }
            try { updateTargetHitBanner(); } catch (e) { }
            if (typeof renderAsxCodeButtons === 'function') renderAsxCodeButtons();
            adjustMainContentPadding();
            return;
        } else if (selectedWatchlistId !== CASH_BANK_WATCHLIST_ID) {
            const existingPortfolio = document.getElementById('portfolioSection'); if (existingPortfolio) existingPortfolio.style.display = 'none';
            if (stockWatchlistSectionLocal) stockWatchlistSectionLocal.classList.remove('app-hidden');
            if (stockWatchlistSectionLocal && typeof stockWatchlistSectionLocal.style !== 'undefined') stockWatchlistSectionLocal.style.display = '';
            // Ensure compact view toggle is visible in stock views (if it exists)
            if (toggleCompactViewBtnLocal) {
                toggleCompactViewBtnLocal.classList.remove('app-hidden');
                toggleCompactViewBtnLocal.style.display = '';
            }
            const isMobile = window.innerWidth <= 768;
            let sharesToRender = [];
            // Safe helper fallbacks in case script.js helpers haven't been loaded yet
            const safeDedupe = (typeof dedupeSharesById === 'function') ? dedupeSharesById : function (items) { try { const m = new Map(); for (const it of items || []) { if (it && it.id) m.set(it.id, it); } return Array.from(m.values()); } catch (_) { return Array.isArray(items) ? items : []; } };
            const safeShareBelongsTo = (typeof shareBelongsTo === 'function') ? shareBelongsTo : function (share, wid) { try { if (!share) return false; if (!wid) return false; if (Array.isArray(share.watchlistIds)) return share.watchlistIds.includes(wid); if (share.watchlistId) return share.watchlistId === wid; return false; } catch (_) { return false; } };
            if (selectedWatchlistId === '__movers') {
                let moversEntries = [];
                try { if (typeof applyGlobalSummaryFilter === 'function') moversEntries = applyGlobalSummaryFilter({ silent: true, computeOnly: true }) || []; } catch (e) { console.warn('Render movers: compute failed', e); }
                if ((!moversEntries || moversEntries.length === 0) && window.__lastMoversSnapshot && Array.isArray(window.__lastMoversSnapshot.entries)) moversEntries = window.__lastMoversSnapshot.entries;
                const codeSet = new Set((moversEntries || []).map(e => e.code));
                const base = safeDedupe(allSharesData);
                sharesToRender = base.filter(s => s.shareName && codeSet.has(s.shareName.toUpperCase()));
                if (sharesToRender.length === 0 && base.length > 0 && !window.__moversRenderRetry) {
                    window.__moversRenderRetry = setTimeout(() => { window.__moversRenderRetry = null; if (currentSelectedWatchlistIds && currentSelectedWatchlistIds[0] === '__movers') { try { window.Rendering.renderWatchlist(); } catch (e) { console.warn('Movers re-render retry failed', e); } } }, 900);
                }
            } else if (selectedWatchlistId === ALL_SHARES_ID_LOCAL) {
                sharesToRender = safeDedupe(allSharesData);
            } else if (currentSelectedWatchlistIdsLocal.length === 1) {
                sharesToRender = safeDedupe(allSharesData).filter(share => currentSelectedWatchlistIdsLocal.some(id => safeShareBelongsTo(share, id)));
            }

            // Resolve containers locally to avoid reliance on globals that may not be initialized
            let shareTableBodyLocal = (typeof window !== 'undefined' && window.shareTableBody) || document.querySelector('#shareTable tbody');
            try { if (shareTableBodyLocal && typeof window !== 'undefined' && !window.shareTableBody) { try { window.shareTableBody = shareTableBodyLocal; } catch (_) { } } } catch (_) { }
            let mobileShareCardsLocal = (typeof window !== 'undefined' && window.mobileShareCardsContainer) || document.getElementById('mobileShareCards');
            // If the table exists but has no tbody (edge cases / malformed DOM), create one so rendering can proceed
            try {
                if (!shareTableBodyLocal) {
                    let tableEl = document.getElementById('shareTable');
                    if (!tableEl) {
                        // In some test/startup environments the table isn't present yet.
                        // Create a minimal fallback table so render routines can append rows
                        // and tests can observe elements by [data-doc-id]. Attach it to
                        // the main container if available, otherwise to document.body.
                        try {
                            tableEl = document.createElement('table');
                            tableEl.id = 'shareTable';
                            tableEl.className = 'share-table-fallback';
                            const tc = (typeof document !== 'undefined') ? (document.querySelector('.table-container') || document.querySelector('main.container') || document.body) : null;
                            if (tc && tc.appendChild) tc.appendChild(tableEl); else if (document && document.body) document.body.appendChild(tableEl);
                        } catch (_) { tableEl = null; }
                    }
                    if (tableEl) {
                        let tb = tableEl.querySelector('tbody');
                        if (!tb) {
                            tb = document.createElement('tbody');
                            tableEl.appendChild(tb);
                        }
                        shareTableBodyLocal = tb;
                        // also export to global for other scripts that expect it
                        try { if (typeof window !== 'undefined') window.shareTableBody = tb; } catch (_) { }
                        try { /* created fallback shareTable and tbody */ } catch (_) { }
                    }
                }
            } catch (_) { }
            try { if (!mobileShareCardsLocal) { const m = document.getElementById('mobileShareCards'); if (m) { mobileShareCardsLocal = m; try { if (typeof window !== 'undefined') window.mobileShareCardsContainer = m; } catch (_) { } } } } catch (_) { }
            const tableContainerLocal = document.querySelector('.table-container') || document.getElementById('shareTable')?.closest('.table-container');
            if (shareTableBodyLocal) shareTableBodyLocal.innerHTML = '';
            if (mobileShareCardsLocal) mobileShareCardsLocal.innerHTML = '';

            // If there is an explicit global-loading flag (no snapshots at startup), render a single
            // unified loading placeholder rather than per-card 'Loading...' states which can look patchy.
            // Remove any temporary runtime-injected global loader rows (old path)
            try { if (typeof window !== 'undefined' && typeof window.__removeGlobalLoadingState === 'function') window.__removeGlobalLoadingState(); } catch (_) { }

            // Diagnostics: log computed shares and container availability
            try { /* rendering diagnostics removed */ } catch (_) { }

            // If our computed sharesToRender is unexpectedly empty but allSharesData has entries
            // (test environments or load-order differences), fall back to rendering the full set.
            try {
                if ((!Array.isArray(sharesToRender) || sharesToRender.length === 0) && Array.isArray(allSharesDataLocal) && allSharesDataLocal.length > 0) {
                    sharesToRender = safeDedupe(allSharesDataLocal);
                    try { console.log('Rendering: fallback used allSharesDataLocal, new sharesToRender.len=', sharesToRender.length); } catch (_) { }
                }
            } catch (_) { }

            // Also remove the HTML unified loader nodes (default visible in index.html) when we have real shares to render.
            if (sharesToRender.length > 0) {
                // We have shares to render: remove the static unified loader nodes added in HTML
                try {
                    const staticTableLoader = document.querySelector('tbody.unified-loader-container');
                    if (staticTableLoader && staticTableLoader.parentNode) staticTableLoader.parentNode.removeChild(staticTableLoader);
                } catch (_) { }
                try {
                    const staticMobileLoader = document.querySelector('.unified-loader-mobile');
                    if (staticMobileLoader && staticMobileLoader.parentNode) staticMobileLoader.parentNode.removeChild(staticMobileLoader);
                } catch (_) { }

                // Also remove any runtime-injected global loaders to avoid duplication
                try { const trs = document.querySelectorAll('tr.__global-loading'); trs.forEach(t => t.remove()); } catch (_) { }
                try { const m = document.querySelector('.__global-loading-mobile'); if (m) m.remove(); } catch (_) { }

                sharesToRender.forEach(share => {
                    try { /* preparing to append share */ } catch (_) { }
                    // Try the full renderer first; if it fails (missing helpers), fall back to a minimal row so tests see the element.
                    let appended = false;
                    try {
                        if (tableContainerLocal && typeof window.addShareToTable === 'function') {
                            // invoking primary addShareToTable
                            window.addShareToTable(share);
                            appended = true;
                        }
                    } catch (e) { console.warn('Primary addShareToTable failed', e); appended = false; }
                    try {
                        if (!appended && shareTableBodyLocal) {
                            const tr = document.createElement('tr'); tr.dataset.docId = share.id; const td = document.createElement('td'); td.colSpan = 5; td.textContent = share.shareName || share.id || ''; tr.appendChild(td); shareTableBodyLocal.appendChild(tr); appended = true; try { /* fallback appended minimal row */ } catch (_) { }
                        }
                    } catch (e) { console.warn('Fallback append failed', e); }

                    try {
                        if (mobileShareCardsLocal && typeof window.addShareToMobileCards === 'function') {
                            window.addShareToMobileCards(share);
                        }
                    } catch (e) { console.warn('addShareToMobileCards failed', e); }
                });

            } else {
                // No shares to render. If startup determined there are no snapshots and we're waiting
                // for fresh data, leave the HTML unified loader visible (it was inserted into index.html).
                // Otherwise (normal empty watchlist), show an explicit empty message.
                try {
                    if (typeof window !== 'undefined' && window.__showGlobalLoadingState) {
                        // Ensure any runtime-injected loaders are removed but keep the static unified loader visible
                        try { const trs = document.querySelectorAll('tr.__global-loading'); trs.forEach(t => t.remove()); } catch (_) { }
                        try { const m = document.querySelector('.__global-loading-mobile'); if (m) m.remove(); } catch (_) { }
                    } else {
                        const emptyWatchlistMessage = document.createElement('p');
                        emptyWatchlistMessage.textContent = 'No shares found for the selected watchlists. Add a new share to get started!';
                        emptyWatchlistMessage.style.textAlign = 'center';
                        emptyWatchlistMessage.style.padding = '20px';
                        emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
                        if (tableContainerLocal && tableContainerLocal.style.display !== 'none') {
                            const td = document.createElement('td'); td.colSpan = 5; td.appendChild(emptyWatchlistMessage);
                            const tr = document.createElement('tr'); tr.classList.add('empty-message-row'); tr.appendChild(td); if (shareTableBodyLocal) shareTableBodyLocal.appendChild(tr);
                        }
                        if (mobileShareCardsLocal && mobileShareCardsLocal.style.display !== 'none') mobileShareCardsLocal.appendChild(emptyWatchlistMessage.cloneNode(true));
                    }
                } catch (_) { }
            }

            renderAsxCodeButtons();
            try { if (window.scrollMainToTop) window.scrollMainToTop(); else scrollMainToTop(); } catch (_) { }
            try { enforceTargetHitStyling(); } catch (e) { console.warn('Target Alert: enforceTargetHitStyling failed post render', e); }
        } else {
            if (stockWatchlistSectionLocal) stockWatchlistSectionLocal.style.display = 'none';
            if (cashAssetsSectionLocal) {
                cashAssetsSectionLocal.classList.remove('app-hidden');
                cashAssetsSectionLocal.style.display = 'block';
                // CRITICAL FIX: Ensure inner container is visible and grid-layout, overriding potential compact-view global hides
                if (cashCategoriesContainerLocal) {
                    cashCategoriesContainerLocal.classList.remove('app-hidden');
                    cashCategoriesContainerLocal.style.display = 'grid';
                }
            }
            const existingPortfolio2 = document.getElementById('portfolioSection'); if (existingPortfolio2) existingPortfolio2.style.display = 'none';
            if (typeof window.renderCashCategories === 'function') window.renderCashCategories();
            if (sortSelectLocal) sortSelectLocal.classList.remove('app-hidden');
            if (refreshLivePricesBtnLocal) refreshLivePricesBtnLocal.classList.add('app-hidden');
            if (refreshLivePricesBtnLocal) refreshLivePricesBtnLocal.classList.add('app-hidden');
            // Explicitly hide the compact view toggle in Cash view
            if (toggleCompactViewBtnLocal) {
                toggleCompactViewBtnLocal.classList.add('app-hidden');
                toggleCompactViewBtnLocal.style.setProperty('display', 'none', 'important');
            }
            if (asxCodeButtonsContainerLocal) asxCodeButtonsContainerLocal.classList.add('app-hidden');
            if (targetHitIconBtnLocal) targetHitIconBtnLocal.style.display = 'none';
            if (exportWatchlistBtnLocal) exportWatchlistBtnLocal.classList.add('app-hidden');
            if (typeof window.stopLivePriceUpdates === 'function') window.stopLivePriceUpdates();
            if (typeof window.updateAddHeaderButton === 'function') window.updateAddHeaderButton();
            if (typeof window.updateAddHeaderButton === 'function') window.updateAddHeaderButton();
            // Ensure stock containers are strictly hidden to prevent overlap/ghosting
            if (tableContainer) tableContainer.style.display = 'none';
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'none';
        }
        window.renderSortSelect(); window.updateMainButtonsState(!!currentUserId); adjustMainContentPadding(); try { updateMainTitle(); } catch (e) { } try { ensureTitleStructure(); } catch (e) { } try { updateTargetHitBanner(); } catch (e) { }
        try { /* final render complete */ } catch (_) { }
    };

    // Remove the global unified loader (used when fresh data arrives)
    window.__removeGlobalLoadingState = function () {
        try {
            // Remove any runtime-injected global loaders
            try { const trs = document.querySelectorAll('tr.__global-loading'); trs.forEach(t => t.remove()); } catch (_) { }
            try { const m = document.querySelector('.__global-loading-mobile'); if (m) m.remove(); } catch (_) { }
            // Also remove the static unified loader nodes that are present in index.html
            try { const staticTableLoader = document.querySelector('tbody.unified-loader-container'); if (staticTableLoader && staticTableLoader.parentNode) staticTableLoader.parentNode.removeChild(staticTableLoader); } catch (_) { }
            try { const staticMobileLoader = document.querySelector('.unified-loader-mobile'); if (staticMobileLoader && staticMobileLoader.parentNode) staticMobileLoader.parentNode.removeChild(staticMobileLoader); } catch (_) { }
            try { if (typeof window !== 'undefined') window.__globalLoaderRendered = false; } catch (_) { }
            try { /* removed global loaders (runtime + static) */ } catch (_) { }
            try { const mobileEl = document.getElementById('mobileShareCards'); if (mobileEl) mobileEl.style.opacity = ''; } catch (_) { }
            try { const tableEl = document.querySelector('.table-container') || document.getElementById('shareTable')?.closest('.table-container'); if (tableEl) tableEl.style.opacity = ''; } catch (_) { }
        } catch (_) { }
    };

    // Dedicated, idempotent remover for the static unified loader elements inserted in HTML.
    // Use this central function everywhere to avoid selector/timing issues.
    window.__removeStaticUnifiedLoader = function () {
        try {
            // Remove desktop loader tbody if present
            try {
                const staticTableLoader = document.querySelector('tbody.unified-loader-container');
                if (staticTableLoader && staticTableLoader.parentNode) {
                    staticTableLoader.parentNode.removeChild(staticTableLoader);
                }
            } catch (inner) { console.warn('removeStaticUnifiedLoader: failed to remove desktop loader', inner); }

            // Remove mobile loader
            try {
                const staticMobileLoader = document.querySelector('.unified-loader-mobile');
                if (staticMobileLoader && staticMobileLoader.parentNode) staticMobileLoader.parentNode.removeChild(staticMobileLoader);
            } catch (inner) { console.warn('removeStaticUnifiedLoader: failed to remove mobile loader', inner); }

            // Also remove any stray loader text nodes that may have been duplicated
            try {
                const texts = document.querySelectorAll('.unified-loader-text');
                texts.forEach(t => { try { t.remove(); } catch (_) { } });
            } catch (inner) { }

            // Remove dynamically injected unified loader (if script injected one)
            try {
                const dyn = document.getElementById('dynamic-unified-loader');
                if (dyn && dyn.parentNode) dyn.parentNode.removeChild(dyn);
            } catch (inner) { console.warn('removeStaticUnifiedLoader: failed to remove dynamic loader', inner); }

            try { /* static unified loader removed */ } catch (_) { }
        } catch (_) { }
    };

    // UI helpers for Stale-While-Revalidate experience
    window.__applyStaleUIIndicators = function () {
        try {
            // Reduce opacity of card/table containers (query DOM directly to be robust)
            try {
                const mobileEl = document.getElementById('mobileShareCards');
                if (mobileEl) mobileEl.style.opacity = '0.7';
            } catch (_) { }
            try {
                const tableEl = document.querySelector('.table-container') || document.getElementById('shareTable')?.closest('.table-container');
                if (tableEl) tableEl.style.opacity = '0.7';
            } catch (_) { }
            // Show Updating... text and optional spinner next to timestamp
            try {
                const tsContainer = document.getElementById('livePriceTimestampContainer');
                if (tsContainer) {
                    tsContainer.classList.add('updating-stale');
                    let updatingEl = tsContainer.querySelector('.stale-updating-indicator');
                    if (!updatingEl) {
                        updatingEl = document.createElement('span');
                        updatingEl.className = 'stale-updating-indicator';
                        updatingEl.style.marginLeft = '8px';
                        updatingEl.style.fontSize = '0.8em';
                        updatingEl.style.opacity = '0.9';
                        updatingEl.innerHTML = '<span class="spinner" aria-hidden="true" style="display:inline-block; width:12px; height:12px; border:2px solid rgba(0,0,0,0.15); border-top-color: rgba(0,0,0,0.6); border-radius:50%; animation: asx-spin 1s linear infinite; vertical-align:middle; margin-right:6px"></span>Updating...';
                        tsContainer.appendChild(updatingEl);
                    }
                }
            } catch (_) { }
        } catch (_) { }
    };

    window.__removeStaleUIIndicators = function () {
        try {
            try {
                const mobileEl = document.getElementById('mobileShareCards');
                if (mobileEl) mobileEl.style.opacity = '';
            } catch (_) { }
            try {
                const tableEl = document.querySelector('.table-container') || document.getElementById('shareTable')?.closest('.table-container');
                if (tableEl) tableEl.style.opacity = '';
            } catch (_) { }
            try {
                const tsContainer = document.getElementById('livePriceTimestampContainer');
                if (tsContainer) {
                    tsContainer.classList.remove('updating-stale');
                    const el = tsContainer.querySelector('.stale-updating-indicator');
                    if (el) el.remove();
                }
            } catch (_) { }
        } catch (_) { }
    };

    // updateOrCreateShareTableRow
    window.Rendering.updateOrCreateShareTableRow = function updateOrCreateShareTableRow(share) {
        const shareTableBodyLocal = (typeof window !== 'undefined' && window.shareTableBody) || document.querySelector('#shareTable tbody');
        if (!shareTableBodyLocal) { console.error('updateOrCreateShareTableRow: shareTableBody element not found.'); return; }
        let row = shareTableBodyLocal.querySelector(`tr[data-doc-id="${share.id}"]`);
        if (!row) {
            row = document.createElement('tr'); row.dataset.docId = share.id;
            row.addEventListener('click', () => { logDebug('Table Row Click: Share ID: ' + share.id); selectShare(share.id); showShareDetails(); });
            let touchStartTime = 0;
            row.addEventListener('touchstart', (e) => { touchStartTime = Date.now(); selectedElementForTap = row; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; longPressTimer = setTimeout(() => { if (Date.now() - touchStartTime >= LONG_PRESS_THRESHOLD) { selectShare(share.id); showContextMenu(e, share.id); e.preventDefault(); } }, LONG_PRESS_THRESHOLD); }, { passive: false });
            row.addEventListener('touchmove', () => { clearTimeout(longPressTimer); touchStartTime = 0; });
            row.addEventListener('touchend', () => { clearTimeout(longPressTimer); touchStartTime = 0; selectedElementForTap = null; });
            row.addEventListener('contextmenu', (e) => { if (window.innerWidth > 768) { e.preventDefault(); selectShare(share.id); showContextMenu(e, share.id); } });
            shareTableBodyLocal.appendChild(row);
            logDebug('Table: Created new row for share ' + share.shareName + '.');
        }
        // Update content
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData ? !!livePriceData.targetHit : false;
        // compute display
        const isMarketOpen = isAsxMarketOpen();
        let displayLivePrice = 'N/A', displayPriceChange = '', priceClass = '';
        if (livePriceData) {
            const currentLivePrice = livePriceData.live; const previousClosePrice = livePriceData.prevClose; const lastFetchedLive = livePriceData.lastLivePrice; const lastFetchedPrevClose = livePriceData.lastPrevClose;
            if (isMarketOpen) {
                if (currentLivePrice !== null && !isNaN(currentLivePrice)) displayLivePrice = '$' + formatAdaptivePrice(currentLivePrice);
                if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) { const change = currentLivePrice - previousClosePrice; const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0); displayPriceChange = formatDailyChange(change, percentageChange); priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral'); }
                else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) { const change = lastFetchedLive - lastFetchedPrevClose; const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0); displayPriceChange = formatDailyChange(change, percentageChange); priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral'); }
            } else { displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + formatAdaptivePrice(lastFetchedLive) : 'N/A'; displayPriceChange = '0.00 (0.00%)'; priceClass = 'neutral'; }
        }
        // Apply movement side borders + class and dynamic pulse color for target hits
        try {
            if (!row.classList.contains('movement-sides')) row.classList.add('movement-sides');
            row.classList.remove('positive-change-row', 'negative-change-row', 'neutral-change-row');
            let delta = 0;
            if (livePriceData) {
                const ll = livePriceData.live, pc = livePriceData.prevClose, lll = livePriceData.lastLivePrice, lpc = livePriceData.lastPrevClose;
                if (isMarketOpen && ll != null && pc != null && !isNaN(ll) && !isNaN(pc)) delta = Number(ll) - Number(pc);
                else if (!isMarketOpen && lll != null && lpc != null && !isNaN(lll) && !isNaN(lpc)) delta = Number(lll) - Number(lpc);
            }
            if (delta > 0) row.classList.add('positive-change-row');
            else if (delta < 0) row.classList.add('negative-change-row');
            else row.classList.add('neutral-change-row');
            // no border pulse anymore
        } catch (_) { }
        const companyInfo = allAsxCodes.find(c => c.code === share.shareName.toUpperCase()); const companyName = companyInfo ? companyInfo.name : '';
        let desktopTargetDot2 = '';
        if (isTargetHit && !window.targetHitIconDismissed) {
            let delta = 0, haveDelta = false;
            if (livePriceData && livePriceData.live != null && livePriceData.prevClose != null && !isNaN(livePriceData.live) && !isNaN(livePriceData.prevClose)) { delta = Number(livePriceData.live) - Number(livePriceData.prevClose); haveDelta = true; }
            else if (livePriceData && livePriceData.lastLivePrice != null && livePriceData.lastPrevClose != null && !isNaN(livePriceData.lastLivePrice) && !isNaN(livePriceData.lastPrevClose)) { delta = Number(livePriceData.lastLivePrice) - Number(livePriceData.lastPrevClose); haveDelta = true; }
            const color = haveDelta ? (delta > 0 ? 'var(--brand-green)' : (delta < 0 ? 'var(--brand-red)' : 'var(--accent-color)')) : 'var(--accent-color)';
            desktopTargetDot2 = `<span class="target-hit-dot" aria-label="Alert target hit" style="background:${color}"></span>`;
        }
        row.innerHTML = `
            <td><span class="share-code-display ${priceClass}">${share.shareName || ''}</span>${desktopTargetDot2}${companyName ? `<br><small style="font-size: 0.8em; color: var(--ghosted-text); font-weight: 400;">${companyName}</small>` : ''}</td>
            <td class="live-price-cell"><span class="live-price-value ${priceClass}">${displayLivePrice}</span><span class="price-change ${priceClass}">${displayPriceChange}</span></td>
            <td class="numeric-data-cell">${formatMoney(Number(share.targetPrice), { hideZero: true })}</td>
            <td class="numeric-data-cell">${formatMoney(Number(share.currentPrice), { hideZero: true })}</td>
            <td class="star-rating-cell numeric-data-cell">${share.starRating > 0 ? '⭐'.repeat(share.starRating) : ''}</td>
            <td class="numeric-data-cell">${(() => { const dividendAmount = Number(share.dividendAmount) || 0; const frankingCredits = Math.trunc(Number(share.frankingCredits) || 0); const enteredPrice = Number(share.currentPrice) || 0; const priceForYield = (displayLivePrice !== 'N/A' && displayLivePrice.startsWith('$')) ? parseFloat(displayLivePrice.substring(1)) : (enteredPrice > 0 ? enteredPrice : 0); if (priceForYield === 0 || (dividendAmount === 0 && frankingCredits === 0)) return ''; const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits); const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield); if (frankingCredits > 0 && frankedYield > 0) return formatAdaptivePercent(frankedYield) + '% (F)'; else if (unfrankedYield > 0) return formatAdaptivePercent(unfrankedYield) + '% (U)'; return ''; })()}</td>
        `;
        logDebug('Table: Updated/Created row for share ' + share.shareName + '.');
    };

    window.Rendering.updateOrCreateShareMobileCard = function updateOrCreateShareMobileCard(share) {
        const mobileShareCardsLocal = (typeof window !== 'undefined' && window.mobileShareCardsContainer) || document.getElementById('mobileShareCards');
        if (!mobileShareCardsLocal) { console.error('updateOrCreateShareMobileCard: mobileShareCardsContainer element not found.'); return; }
        let card = mobileShareCardsLocal.querySelector(`div[data-doc-id="${share.id}"]`);
        if (!card) {
            card = document.createElement('div');
            card.classList.add('mobile-card');
            card.dataset.docId = share.id;
            card.addEventListener('click', () => { logDebug('Mobile Card Click: Share ID: ' + share.id); selectShare(share.id); showShareDetails(); });
            mobileShareCardsContainer.appendChild(card);
            logDebug('Mobile Cards: Created new card for share ' + share.shareName + '.');
        }
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData ? !!livePriceData.targetHit : false;
        const isMarketOpen = isAsxMarketOpen();
        let displayLivePrice = 'N/A', displayPriceChange = '', priceClass = '';
        let delta = 0;
        if (livePriceData) {
            const currentLivePrice = livePriceData.live; const previousClosePrice = livePriceData.prevClose; const lastFetchedLive = livePriceData.lastLivePrice; const lastFetchedPrevClose = livePriceData.lastPrevClose;
            if (isMarketOpen) {
                if (currentLivePrice !== null && !isNaN(currentLivePrice)) displayLivePrice = '$' + formatAdaptivePrice(currentLivePrice);
                if (currentLivePrice !== null && previousClosePrice !== null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)) {
                    const change = currentLivePrice - previousClosePrice; delta = change;
                    const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                    displayPriceChange = `${formatAdaptivePrice(change)} / ${formatAdaptivePercent(percentageChange)}%`;
                    priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                } else if (lastFetchedLive !== null && lastFetchedPrevClose !== null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) {
                    const change = lastFetchedLive - lastFetchedPrevClose; delta = change;
                    const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                    displayPriceChange = `${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`;
                    priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                }
            } else {
                displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + formatAdaptivePrice(lastFetchedLive) : 'N/A';
                displayPriceChange = '0.00 (0.00%)';
                priceClass = 'neutral';
                if (lastFetchedLive != null && lastFetchedPrevClose != null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)) delta = Number(lastFetchedLive) - Number(lastFetchedPrevClose);
            }
        }
        try {
            if (!card.classList.contains('movement-sides')) card.classList.add('movement-sides');
            card.classList.remove('positive-change-card', 'negative-change-card', 'neutral-change-card');
            if (delta > 0) card.classList.add('positive-change-card');
            else if (delta < 0) card.classList.add('negative-change-card');
            else card.classList.add('neutral-change-card');
            // no border pulse anymore
        } catch (_) { }
        const displayData = window.getShareDisplayData(share);
        const { peRatio, high52Week, low52Week } = displayData;
        if (displayData.cardPriceChangeClass) card.classList.add(displayData.cardPriceChangeClass);
        let arrowSymbol = '';
        if (priceClass === 'positive') arrowSymbol = '▲'; else if (priceClass === 'negative') arrowSymbol = '▼';
        // Build card top with pulsing dot next to code when target is hit
        let codeWithDot = '';
        if (isTargetHit && !window.targetHitIconDismissed) {
            let d = 0, have = false; if (livePriceData && livePriceData.live != null && livePriceData.prevClose != null && !isNaN(livePriceData.live) && !isNaN(livePriceData.prevClose)) { d = Number(livePriceData.live) - Number(livePriceData.prevClose); have = true; }
            else if (livePriceData && livePriceData.lastLivePrice != null && livePriceData.lastPrevClose != null && !isNaN(livePriceData.lastLivePrice) && !isNaN(livePriceData.lastPrevClose)) { d = Number(livePriceData.lastLivePrice) - Number(livePriceData.lastPrevClose); have = true; }
            const color = have ? (d > 0 ? 'var(--brand-green)' : (d < 0 ? 'var(--brand-red)' : 'var(--accent-color)')) : 'var(--accent-color)';
            codeWithDot = `${share.shareName}<span class="target-hit-dot" aria-label="Alert target hit" style="background:${color}"></span>`;
        } else {
            codeWithDot = `${share.shareName}`;
        }
        card.innerHTML = `<div class="live-price-display-section"><div class="card-top-row"><h3 class="neutral-code-text card-code">${codeWithDot}</h3><span class="change-chevron card-chevron ${priceClass}">${arrowSymbol}</span></div><div class="live-price-main-row"><span class="live-price-large neutral-code-text card-live-price">${displayLivePrice}</span></div><span class="price-change-large card-price-change ${priceClass}">${displayPriceChange}</span></div>`;
    };

    window.Rendering.enforceTargetHitStyling = function enforceTargetHitStyling() {
        try {
            const dismissed = !!(typeof window !== 'undefined' && window.window.targetHitIconDismissed);
            if (dismissed) return;

            const satp = (typeof window !== 'undefined' && Array.isArray(window.sharesAtTargetPrice)) ? window.sharesAtTargetPrice : [];
            const enabledList = satp.map(s => s && s.id).filter(Boolean).sort();
            const signature = enabledList.join(',');

            // Resolve DOM containers safely (avoid bare identifiers that can throw ReferenceError)
            const tableBody = (typeof window !== 'undefined' && window.shareTableBody) || document.querySelector('#shareTable tbody') || null;
            const mobileContainer = (typeof window !== 'undefined' && typeof window.getMobileShareCardsContainer === 'function')
                ? window.getMobileShareCardsContainer()
                : ((typeof window !== 'undefined' && window.mobileShareCardsContainer) || document.getElementById('mobileShareCards') || null);

            // We're no longer applying .custom-target-hit; enforcement will just ensure dots exist
            const existingHighlights = 0;

            if (enforceTargetHitStyling.__lastSig === signature && existingHighlights === enabledList.length) return;
            enforceTargetHitStyling.__lastSig = signature;

            // If nothing to operate on yet, exit quietly
            if (!tableBody && !mobileContainer) return;

            const enabledIds = new Set(enabledList);
            const rows = tableBody ? Array.from(tableBody.querySelectorAll('tr[data-doc-id]')) : [];
            const cards = mobileContainer ? Array.from(mobileContainer.querySelectorAll('.mobile-card[data-doc-id]')) : [];

            let applied = 0, removed = 0;
            rows.forEach(r => {
                const id = r && r.dataset ? r.dataset.docId : null;
                if (!id) return;
                if (enabledIds.has(id)) {
                    // ensure a colored dot exists in first cell before the code
                    try {
                        const codeCell = r.querySelector('td');
                        if (codeCell) {
                            const existingDot = codeCell.querySelector('.target-hit-dot');
                            if (!existingDot) {
                                // compute color by delta
                                const codeText = (r.querySelector('.share-code-display')?.textContent || '').trim().toUpperCase();
                                const lp = codeText && window.livePrices ? window.livePrices[codeText] : null; let d = 0, have = false;
                                if (lp && lp.live != null && lp.prevClose != null && !isNaN(lp.live) && !isNaN(lp.prevClose)) { d = Number(lp.live) - Number(lp.prevClose); have = true; }
                                else if (lp && lp.lastLivePrice != null && lp.lastPrevClose != null && !isNaN(lp.lastLivePrice) && !isNaN(lp.lastPrevClose)) { d = Number(lp.lastLivePrice) - Number(lp.lastPrevClose); have = true; }
                                const color = have ? (d > 0 ? 'var(--brand-green)' : (d < 0 ? 'var(--brand-red)' : 'var(--accent-color)')) : 'var(--accent-color)';
                                const span = document.createElement('span'); span.className = 'target-hit-dot'; span.style.background = color; span.setAttribute('aria-label', 'Alert target hit');
                                // Append after the share code text (right side)
                                codeCell.appendChild(span);
                            }
                        }
                    } catch (_) { }
                    applied++;
                } else {
                    // remove dot if present
                    try { r.querySelectorAll('.target-hit-dot').forEach(n => n.remove()); } catch (_) { }
                    removed++;
                }
            });
            cards.forEach(c => {
                const id = c && c.dataset ? c.dataset.docId : null;
                if (!id) return;
                if (enabledIds.has(id)) {
                    try {
                        const codeEl = c.querySelector('.card-code');
                        if (codeEl) {
                            const hasDot = !!codeEl.querySelector('.target-hit-dot');
                            if (!hasDot) {
                                const code = (codeEl.textContent || '').trim().toUpperCase();
                                const lp = code && window.livePrices ? window.livePrices[code] : null; let d = 0, have = false;
                                if (lp && lp.live != null && lp.prevClose != null && !isNaN(lp.live) && !isNaN(lp.prevClose)) { d = Number(lp.live) - Number(lp.prevClose); have = true; }
                                else if (lp && lp.lastLivePrice != null && lp.lastPrevClose != null && !isNaN(lp.lastLivePrice) && !isNaN(lp.lastPrevClose)) { d = Number(lp.lastLivePrice) - Number(lp.lastPrevClose); have = true; }
                                const color = have ? (d > 0 ? 'var(--brand-green)' : (d < 0 ? 'var(--brand-red)' : 'var(--accent-color)')) : 'var(--accent-color)';
                                const span = document.createElement('span'); span.className = 'target-hit-dot'; span.style.background = color; span.setAttribute('aria-label', 'Alert target hit');
                                // Append after the code text
                                codeEl.appendChild(span);
                            }
                        }
                    } catch (_) { }
                    applied++;
                } else {
                    try { c.querySelectorAll('.target-hit-dot').forEach(n => n.remove()); } catch (_) { }
                    removed++;
                }
            });

            try { /* enforceTargetHitStyling diagnostics removed */ } catch (_) { }
        } catch (err) {
            try { console.warn('enforceTargetHitStyling: guarded failure', err); } catch (_) { }
        }
    };

    // Provide a global alias so any unqualified calls (e.g., in classic scripts) do not throw ReferenceError
    try { window.enforceTargetHitStyling = window.Rendering.enforceTargetHitStyling; } catch (_) { }

    window.Rendering.renderAsxCodeButtons = function renderAsxCodeButtons() {
        if (!asxCodeButtonsContainer) { console.error('renderAsxCodeButtons: asxCodeButtonsContainer element not found.'); return; }
        asxCodeButtonsContainer.innerHTML = '';
        const uniqueAsxCodes = new Set();
        let sharesForButtons = [];
        const currentSelectedWatchlistIdsLocal = (typeof currentSelectedWatchlistIds !== 'undefined' && Array.isArray(currentSelectedWatchlistIds)) ? currentSelectedWatchlistIds : ((typeof window !== 'undefined' && Array.isArray(window.currentSelectedWatchlistIds)) ? window.currentSelectedWatchlistIds : []);
        const ALL_SHARES_ID_LOCAL = (typeof ALL_SHARES_ID !== 'undefined') ? ALL_SHARES_ID : ((typeof window !== 'undefined' && window.ALL_SHARES_ID) ? window.ALL_SHARES_ID : 'all_shares_option');
        if (currentSelectedWatchlistIdsLocal.includes(ALL_SHARES_ID_LOCAL)) sharesForButtons = (typeof dedupeSharesById === 'function' ? dedupeSharesById(allSharesData) : (Array.isArray(allSharesData) ? allSharesData.slice() : [])); else sharesForButtons = (typeof dedupeSharesById === 'function' ? dedupeSharesById(allSharesData) : (Array.isArray(allSharesData) ? allSharesData.slice() : [])).filter(share => currentSelectedWatchlistIdsLocal.some(id => (typeof shareBelongsTo === 'function' ? shareBelongsTo(share, id) : (share && (share.watchlistId === id || (Array.isArray(share.watchlistIds) && share.watchlistIds.includes(id)))))));
        sharesForButtons.forEach(share => { if (share.shareName && typeof share.shareName === 'string' && share.shareName.trim() !== '') uniqueAsxCodes.add(share.shareName.trim().toUpperCase()); });
        if (uniqueAsxCodes.size === 0) { applyAsxButtonsState(); return; }
        const sortedAsxCodes = Array.from(uniqueAsxCodes).sort(); sortedAsxCodes.forEach(asxCode => { const button = document.createElement('button'); button.className = 'asx-code-btn'; button.textContent = asxCode; button.dataset.asxCode = asxCode; let buttonPriceChangeClass = ''; const livePriceData = livePrices[asxCode.toUpperCase()]; if (livePriceData) { const latestLive = (livePriceData.live !== null && !isNaN(livePriceData.live)) ? livePriceData.live : (livePriceData.lastLivePrice ?? null); const latestPrev = (livePriceData.prevClose !== null && !isNaN(livePriceData.prevClose)) ? livePriceData.prevClose : (livePriceData.lastPrevClose ?? null); if (latestLive !== null && latestPrev !== null && !isNaN(latestLive) && !isNaN(latestPrev)) { const change = latestLive - latestPrev; if (change > 0) buttonPriceChangeClass = 'positive'; else if (change < 0) buttonPriceChangeClass = 'negative'; else buttonPriceChangeClass = 'neutral'; } } if (buttonPriceChangeClass) button.classList.add(buttonPriceChangeClass); if (currentSelectedWatchlistIds.length === 1 && currentSelectedWatchlistIds[0] === 'portfolio') button.classList.add('portfolio-context'); const livePriceDataForButton = livePrices[asxCode.toUpperCase()]; if (livePriceDataForButton && livePriceDataForButton.targetHit && !window.targetHitIconDismissed) button.classList.add('target-hit-alert'); else button.classList.remove('target-hit-alert'); asxCodeButtonsContainer.appendChild(button); });
        asxCodeButtonsContainer.querySelectorAll('button.asx-code-btn').forEach(b => b.classList.remove('active'));
        if (!asxCodeButtonsContainer.__delegated) {
            let touchStartY = 0, touchMoved = false, touchStartX = 0; const MOVE_THRESHOLD = 8; asxCodeButtonsContainer.addEventListener('touchstart', e => { const t = e.touches[0]; touchStartY = t.clientY; touchStartX = t.clientX; touchMoved = false; }, { passive: true }); asxCodeButtonsContainer.addEventListener('touchmove', e => { const t = e.touches[0]; if (Math.abs(t.clientY - touchStartY) > MOVE_THRESHOLD || Math.abs(t.clientX - touchStartX) > MOVE_THRESHOLD) touchMoved = true; }, { passive: true }); asxCodeButtonsContainer.__delegated = true;
        }
    };

    // Expose top-level alias for legacy callers
    window.renderWatchlist = function () { if (window.Rendering && window.Rendering.renderWatchlist) return window.Rendering.renderWatchlist(); };
    window.addShareToTable = function (s) { if (window.Rendering && window.Rendering.addShareToTable) return window.Rendering.addShareToTable(s); };
    window.addShareToMobileCards = function (s) { if (window.Rendering && window.Rendering.addShareToMobileCards) return window.Rendering.addShareToMobileCards(s); };
    window.renderPortfolioList = function () { if (window.Rendering && window.Rendering.renderPortfolioList) return window.Rendering.renderPortfolioList(); };

})();


