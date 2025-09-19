// rendering.js - rendering functions moved out of script.js
// Exposes functions under window.Rendering for backwards compatibility

(function(){
    window.Rendering = window.Rendering || {};

    window.Rendering.addShareToTable = function addShareToTable(share) {
        if (!shareTableBody) {
            console.error('addShareToTable: shareTableBody element not found.');
            return;
        }

        const row = document.createElement('tr');
        row.dataset.docId = share.id;

        row.addEventListener('click', () => {
            try { window.logDebug && window.logDebug('Table Row Click: Share ID: ' + share.id); } catch(_){}
            try { window.selectShare ? window.selectShare(share.id) : selectShare(share.id); } catch(_){}
            try { if (row.closest && row.closest('#targetHitSharesList')) { wasShareDetailOpenedFromTargetAlerts = true; } } catch(_){}
            try { window.showShareDetails ? window.showShareDetails() : showShareDetails(); } catch(_){}
        });

        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData ? livePriceData.targetHit : false;
        if (isTargetHit && !targetHitIconDismissed) {
            row.classList.add('target-hit-alert');
        } else {
            row.classList.remove('target-hit-alert');
        }

        const displayData = getShareDisplayData(share);
        const companyInfo = allAsxCodes.find(c => c.code === (share.shareName || '').toUpperCase());
        const companyName = companyInfo ? companyInfo.name : '';

        const desktopTargetDot = (isTargetHit && !targetHitIconDismissed) ? '<span class="target-hit-dot" aria-label="Alert target hit"></span>' : '';
        row.innerHTML = `
            <td>
                ${desktopTargetDot}<span class="share-code-display ${displayData.priceClass}">${share.shareName || ''}</span>
                ${companyName ? `<br><small class="company-name-small">${companyName}</small>` : ''}
            </td>
            <td class="live-price-cell">
                <span class="live-price-value ${displayData.priceClass}">${displayData.displayLivePrice}</span>
                <span class="price-change ${displayData.priceClass}">${displayData.displayPriceChange}</span>
            </td>
            <td class="numeric-data-cell alert-target-cell">${renderAlertTargetInline(share)}</td>
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
            let change = null;
            if (lp && lp.live != null && lp.prevClose != null && !isNaN(lp.live) && !isNaN(lp.prevClose)) change = lp.live - lp.prevClose;
            row.classList.remove('positive-change-row','negative-change-row','neutral-change-row');
            if (!row.classList.contains('movement-sides')) row.classList.add('movement-sides');
            if (change > 0) row.classList.add('positive-change-row');
            else if (change < 0) row.classList.add('negative-change-row');
            else row.classList.add('neutral-change-row');
        } catch(_) {}

        shareTableBody.appendChild(row);
        logDebug('Table: Added share ' + share.shareName + ' to table.');
    };

    window.Rendering.addShareToMobileCards = function addShareToMobileCards(share) {
        if (!mobileShareCardsContainer) { console.error('addShareToMobileCards: mobileShareCardsContainer element not found.'); return; }
        const template = document.getElementById('mobile-share-card-template');
        if (!template) { console.error('addShareToMobileCards: template not found.'); return; }
        const card = template.content.cloneNode(true).querySelector('.mobile-card');
        card.dataset.docId = share.id;
        const displayData = getShareDisplayData(share);
        const { displayLivePrice, displayPriceChange, priceClass, peRatio, high52Week, low52Week } = displayData;
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData ? livePriceData.targetHit : false;
        if (displayData.cardPriceChangeClass) card.classList.add(displayData.cardPriceChangeClass);
        if (isTargetHit && !targetHitIconDismissed) card.classList.add('target-hit-alert');
        let arrowSymbol = '';
        if (priceClass === 'positive') arrowSymbol = '▲'; else if (priceClass === 'negative') arrowSymbol = '▼';
        card.querySelector('.card-code').textContent = share.shareName || '';
        card.querySelector('.card-chevron').textContent = arrowSymbol;
        card.querySelector('.card-chevron').className = `change-chevron card-chevron ${priceClass}`;
        card.querySelector('.card-live-price').textContent = displayLivePrice;
        card.querySelector('.card-price-change').textContent = displayPriceChange;
        card.querySelector('.card-price-change').className = `price-change-large card-price-change ${priceClass}`;
        // Removed 52-week and P/E ratio elements for compact design
        const alertTargetRow = card.querySelector('[data-template-conditional="alertTarget"]');
        const alertTargetValue = renderAlertTargetInline(share);
        if (alertTargetValue) { alertTargetRow.querySelector('.data-value').innerHTML = alertTargetValue; alertTargetRow.style.display = ''; } else { alertTargetRow.style.display = 'none'; }
        
        // Populate bottom info row with comments title and star rating
        const bottomInfoRow = card.querySelector('.bottom-info-row');
        const commentsTitleEl = bottomInfoRow.querySelector('.comments-title');
        const starRatingEl = bottomInfoRow.querySelector('.star-rating');

        // Don't inject comments or star rating into compact view cards - keep DOM minimal
        const isCompactRender = (mobileShareCardsContainer && mobileShareCardsContainer.classList && mobileShareCardsContainer.classList.contains('compact-view')) || currentMobileViewMode === 'compact';
        if (isCompactRender) {
            // Ensure they're empty/hidden for compact layout
            try { commentsTitleEl.textContent = ''; commentsTitleEl.style.display = 'none'; } catch(_){}
            try { starRatingEl.textContent = ''; starRatingEl.style.display = 'none'; } catch(_){}
            try { bottomInfoRow.style.display = 'none'; } catch(_){}
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
        card.addEventListener('click', () => { logDebug('Mobile Card Click: Share ID: ' + share.id); selectShare(share.id); showShareDetails(); });
        mobileShareCardsContainer.appendChild(card);
        logDebug('Mobile Cards: Added share ' + share.shareName + ' to mobile cards using template.');
    };

    // renderPortfolioList moved here
    window.Rendering.renderPortfolioList = function renderPortfolioList() {
        const portfolioListContainer = document.getElementById('portfolioListContainer');
        if (!portfolioListContainer) return;
        const portfolioShares = allSharesData.filter(s => shareBelongsTo(s, 'portfolio'));
        if (portfolioShares.length === 0) { portfolioListContainer.innerHTML = '<p>No shares in your portfolio yet.</p>'; return; }
        function fmtMoney(n){ return formatMoney(n); }
        function fmtPct(n){ return formatPercent(n); }
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
                <div class="p-pl ${pl>0?'positive':'negative'}">${fmtMoney(pl)}</div>
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
                        <span class="detail-value ${unrealizedPL>=0?'positive':'negative'}">${fmtMoney(unrealizedPL)} (${fmtPct(plPercentage)})</span>
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
        try {
            logDebug('DEBUG: renderWatchlist called. Current selected watchlist ID: ' + currentSelectedWatchlistIds[0]);
        } catch(_){}
        try {
            if (!window.__moversInitialEnforced && currentSelectedWatchlistIds && currentSelectedWatchlistIds[0] === '__movers') {
                window.__moversInitialEnforced = true;
                setTimeout(()=>{ try { if (typeof enforceMoversVirtualView === 'function') enforceMoversVirtualView(); } catch(e){ console.warn('Initial movers enforce failed', e); } }, 150);
            }
        } catch(_) {}

        const isCompactView = currentMobileViewMode === 'compact';
        const isMobileView = window.innerWidth <= 768;
        if (isCompactView) {
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'grid';
            if (tableContainer) tableContainer.style.display = 'none';
        } else if (isMobileView) {
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'flex';
            if (tableContainer) tableContainer.style.display = 'none';
        } else {
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'none';
            if (tableContainer) tableContainer.style.display = '';
        }

        const selectedWatchlistId = currentSelectedWatchlistIds[0];

        stockWatchlistSection.classList.add('app-hidden');
        cashAssetsSection.classList.add('app-hidden');

        if (selectedWatchlistId === 'portfolio') {
            if (stockWatchlistSection) stockWatchlistSection.classList.add('app-hidden');
            if (cashAssetsSection) cashAssetsSection.classList.add('app-hidden');
            let portfolioSection = document.getElementById('portfolioSection');
            if (!portfolioSection) {
                portfolioSection = document.createElement('div');
                portfolioSection.id = 'portfolioSection';
                portfolioSection.className = 'portfolio-section';
                portfolioSection.innerHTML = '<div id="portfolioListContainer">Loading portfolio...</div>';
                if (mainContainer) mainContainer.appendChild(portfolioSection);
            }
            portfolioSection.style.display = 'block';
            sortSelect.classList.remove('app-hidden');
            refreshLivePricesBtn.classList.add('app-hidden');
            toggleCompactViewBtn.classList.add('app-hidden');
            exportWatchlistBtn.classList.remove('app-hidden');
            if (typeof window.renderPortfolioList === 'function') window.renderPortfolioList();
            try { renderSortSelect(); } catch(e) {}
            try { updateTargetHitBanner(); } catch(e) {}
            if (typeof renderAsxCodeButtons === 'function') renderAsxCodeButtons();
            adjustMainContentPadding();
            return;
        } else if (selectedWatchlistId !== CASH_BANK_WATCHLIST_ID) {
            const existingPortfolio = document.getElementById('portfolioSection'); if (existingPortfolio) existingPortfolio.style.display='none';
            stockWatchlistSection.classList.remove('app-hidden');
            if (typeof stockWatchlistSection.style !== 'undefined') stockWatchlistSection.style.display = '';
            const isMobile = window.innerWidth <= 768;
            let sharesToRender = [];
            if (selectedWatchlistId === '__movers') {
                let moversEntries = [];
                try { if (typeof applyGlobalSummaryFilter === 'function') moversEntries = applyGlobalSummaryFilter({ silent: true, computeOnly: true }) || []; } catch(e){ console.warn('Render movers: compute failed', e); }
                if ((!moversEntries || moversEntries.length === 0) && window.__lastMoversSnapshot && Array.isArray(window.__lastMoversSnapshot.entries)) moversEntries = window.__lastMoversSnapshot.entries;
                const codeSet = new Set((moversEntries||[]).map(e=>e.code));
                const base = dedupeSharesById(allSharesData);
                sharesToRender = base.filter(s => s.shareName && codeSet.has(s.shareName.toUpperCase()));
                if (sharesToRender.length === 0 && base.length > 0 && !window.__moversRenderRetry) {
                    window.__moversRenderRetry = setTimeout(()=>{ window.__moversRenderRetry = null; if (currentSelectedWatchlistIds && currentSelectedWatchlistIds[0] === '__movers') { try { window.Rendering.renderWatchlist(); } catch(e){ console.warn('Movers re-render retry failed', e); } } }, 900);
                }
            } else if (selectedWatchlistId === ALL_SHARES_ID) {
                sharesToRender = dedupeSharesById(allSharesData);
            } else if (currentSelectedWatchlistIds.length === 1) {
                sharesToRender = dedupeSharesById(allSharesData).filter(share => currentSelectedWatchlistIds.some(id => shareBelongsTo(share, id)));
            }

            if (shareTableBody) shareTableBody.innerHTML = '';
            if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '';

            if (sharesToRender.length > 0) {
                sharesToRender.forEach(share => {
                    if (tableContainer && tableContainer.style.display !== 'none') window.addShareToTable(share);
                    if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') window.addShareToMobileCards(share);
                });
            } else {
                const emptyWatchlistMessage = document.createElement('p');
                emptyWatchlistMessage.textContent = 'No shares found for the selected watchlists. Add a new share to get started!';
                emptyWatchlistMessage.style.textAlign = 'center';
                emptyWatchlistMessage.style.padding = '20px';
                emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
                if (tableContainer && tableContainer.style.display !== 'none') {
                    const td = document.createElement('td'); td.colSpan = 5; td.appendChild(emptyWatchlistMessage);
                    const tr = document.createElement('tr'); tr.classList.add('empty-message-row'); tr.appendChild(td); shareTableBody.appendChild(tr);
                }
                if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') mobileShareCardsContainer.appendChild(emptyWatchlistMessage.cloneNode(true));
            }

            renderAsxCodeButtons();
            try { if (window.scrollMainToTop) window.scrollMainToTop(); else scrollMainToTop(); } catch(_) {}
            try { enforceTargetHitStyling(); } catch(e) { console.warn('Target Alert: enforceTargetHitStyling failed post render', e); }
        } else {
            cashAssetsSection.classList.remove('app-hidden');
            const existingPortfolio2 = document.getElementById('portfolioSection'); if (existingPortfolio2) existingPortfolio2.style.display='none';
            renderCashCategories(); sortSelect.classList.remove('app-hidden'); refreshLivePricesBtn.classList.add('app-hidden'); toggleCompactViewBtn.classList.add('app-hidden'); asxCodeButtonsContainer.classList.add('app-hidden'); if (targetHitIconBtn) targetHitIconBtn.style.display = 'none'; exportWatchlistBtn.classList.add('app-hidden'); stopLivePriceUpdates(); updateAddHeaderButton(); if (tableContainer) tableContainer.style.display = 'none'; if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'none';
        }
        renderSortSelect(); updateMainButtonsState(!!currentUserId); adjustMainContentPadding(); try { updateMainTitle(); } catch(e) {} try { ensureTitleStructure(); } catch(e) {} try { updateTargetHitBanner(); } catch(e) {}
    };

    // updateOrCreateShareTableRow
    window.Rendering.updateOrCreateShareTableRow = function updateOrCreateShareTableRow(share) {
        if (!shareTableBody) { console.error('updateOrCreateShareTableRow: shareTableBody element not found.'); return; }
        let row = shareTableBody.querySelector(`tr[data-doc-id="${share.id}"]`);
        if (!row) {
            row = document.createElement('tr'); row.dataset.docId = share.id;
            row.addEventListener('click', () => { logDebug('Table Row Click: Share ID: ' + share.id); selectShare(share.id); showShareDetails(); });
            let touchStartTime = 0;
            row.addEventListener('touchstart', (e)=>{ touchStartTime = Date.now(); selectedElementForTap = row; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; longPressTimer = setTimeout(()=>{ if (Date.now()-touchStartTime>=LONG_PRESS_THRESHOLD){ selectShare(share.id); showContextMenu(e, share.id); e.preventDefault(); } }, LONG_PRESS_THRESHOLD); }, { passive:false });
            row.addEventListener('touchmove', ()=>{ clearTimeout(longPressTimer); touchStartTime = 0; });
            row.addEventListener('touchend', ()=>{ clearTimeout(longPressTimer); touchStartTime = 0; selectedElementForTap = null; });
            row.addEventListener('contextmenu', (e)=>{ if (window.innerWidth>768){ e.preventDefault(); selectShare(share.id); showContextMenu(e, share.id); } });
            shareTableBody.appendChild(row);
            logDebug('Table: Created new row for share ' + share.shareName + '.');
        }
        // Update content
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData ? livePriceData.targetHit : false;
        if (isTargetHit && !targetHitIconDismissed) row.classList.add('target-hit-alert'); else row.classList.remove('target-hit-alert');
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
        const companyInfo = allAsxCodes.find(c => c.code === share.shareName.toUpperCase()); const companyName = companyInfo ? companyInfo.name : '';
        const desktopTargetDot2 = (isTargetHit && !targetHitIconDismissed) ? '<span class="target-hit-dot" aria-label="Alert target hit"></span>' : ''; 
        row.innerHTML = `
            <td>${desktopTargetDot2}<span class="share-code-display ${priceClass}">${share.shareName || ''}</span>${companyName ? `<br><small style="font-size: 0.8em; color: var(--ghosted-text); font-weight: 400;">${companyName}</small>` : ''}</td>
            <td class="live-price-cell"><span class="live-price-value ${priceClass}">${displayLivePrice}</span><span class="price-change ${priceClass}">${displayPriceChange}</span></td>
            <td class="numeric-data-cell">${formatMoney(Number(share.targetPrice), { hideZero: true })}</td>
            <td class="numeric-data-cell">${formatMoney(Number(share.currentPrice), { hideZero: true })}</td>
            <td class="star-rating-cell numeric-data-cell">${share.starRating>0? '⭐'.repeat(share.starRating):''}</td>
            <td class="numeric-data-cell">${(() => { const dividendAmount = Number(share.dividendAmount) || 0; const frankingCredits = Math.trunc(Number(share.frankingCredits) || 0); const enteredPrice = Number(share.currentPrice) || 0; const priceForYield = (displayLivePrice!=='N/A' && displayLivePrice.startsWith('$')) ? parseFloat(displayLivePrice.substring(1)) : (enteredPrice>0?enteredPrice:0); if (priceForYield===0 || (dividendAmount===0 && frankingCredits===0)) return ''; const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits); const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield); if (frankingCredits>0 && frankedYield>0) return formatAdaptivePercent(frankedYield)+'% (F)'; else if (unfrankedYield>0) return formatAdaptivePercent(unfrankedYield)+'% (U)'; return ''; })()}</td>
        `;
        logDebug('Table: Updated/Created row for share ' + share.shareName + '.');
    };

    window.Rendering.updateOrCreateShareMobileCard = function updateOrCreateShareMobileCard(share) {
        if (!mobileShareCardsContainer) { console.error('updateOrCreateShareMobileCard: mobileShareCardsContainer element not found.'); return; }
        let card = mobileShareCardsContainer.querySelector(`div[data-doc-id="${share.id}"]`);
        if (!card) { card = document.createElement('div'); card.classList.add('mobile-card'); card.dataset.docId = share.id; card.addEventListener('click', ()=>{ logDebug('Mobile Card Click: Share ID: '+share.id); selectShare(share.id); showShareDetails(); }); mobileShareCardsContainer.appendChild(card); logDebug('Mobile Cards: Created new card for share ' + share.shareName + '.'); }
        const livePriceData = livePrices[share.shareName.toUpperCase()]; const isTargetHit = livePriceData ? livePriceData.targetHit : false; if (isTargetHit && !targetHitIconDismissed) card.classList.add('target-hit-alert'); else card.classList.remove('target-hit-alert'); const isMarketOpen = isAsxMarketOpen(); let displayLivePrice='N/A', displayPriceChange='', priceClass=''; if (livePriceData){ const currentLivePrice = livePriceData.live; const previousClosePrice=livePriceData.prevClose; const lastFetchedLive=livePriceData.lastLivePrice; const lastFetchedPrevClose=livePriceData.lastPrevClose; if (isMarketOpen){ if (currentLivePrice!==null && !isNaN(currentLivePrice)) displayLivePrice = '$'+formatAdaptivePrice(currentLivePrice); if (currentLivePrice!==null && previousClosePrice!==null && !isNaN(currentLivePrice) && !isNaN(previousClosePrice)){ const change=currentLivePrice-previousClosePrice; const percentageChange=(previousClosePrice!==0?(change/previousClosePrice)*100:0); displayPriceChange = `${formatAdaptivePrice(change)} / ${formatAdaptivePercent(percentageChange)}%`; priceClass = change>0?'positive':(change<0?'negative':'neutral'); } else if (lastFetchedLive!==null && lastFetchedPrevClose!==null && !isNaN(lastFetchedLive) && !isNaN(lastFetchedPrevClose)){ const change=lastFetchedLive-lastFetchedPrevClose; const percentageChange=(lastFetchedPrevClose!==0?(change/lastFetchedPrevClose)*100:0); displayPriceChange=`${formatAdaptivePrice(change)} (${formatAdaptivePercent(percentageChange)}%)`; priceClass = change>0?'positive':(change<0?'negative':'neutral'); } } else { displayLivePrice = lastFetchedLive!==null && !isNaN(lastFetchedLive) ? '$'+formatAdaptivePrice(lastFetchedLive) : 'N/A'; displayPriceChange='0.00 (0.00%)'; priceClass='neutral'; } }
    const displayData = getShareDisplayData(share); const { peRatio, high52Week, low52Week } = displayData; if (displayData.cardPriceChangeClass) card.classList.add(displayData.cardPriceChangeClass); let arrowSymbol=''; if (priceClass==='positive') arrowSymbol='▲'; else if (priceClass==='negative') arrowSymbol='▼'; card.innerHTML = `<div class="live-price-display-section"><div class="card-top-row"><h3 class="neutral-code-text card-code">${share.shareName}</h3><span class="change-chevron card-chevron ${priceClass}">${arrowSymbol}</span></div><div class="live-price-main-row"><span class="live-price-large neutral-code-text card-live-price">${displayLivePrice}</span></div><span class="price-change-large card-price-change ${priceClass}">${displayPriceChange}</span></div>`;
    };

    window.Rendering.enforceTargetHitStyling = function enforceTargetHitStyling() {
        try {
            const dismissed = !!(typeof window !== 'undefined' && window.targetHitIconDismissed);
            if (dismissed) return;

            const satp = (typeof window !== 'undefined' && Array.isArray(window.sharesAtTargetPrice)) ? window.sharesAtTargetPrice : [];
            const enabledList = satp.map(s => s && s.id).filter(Boolean).sort();
            const signature = enabledList.join(',');

            // Resolve DOM containers safely (avoid bare identifiers that can throw ReferenceError)
            const tableBody = (typeof window !== 'undefined' && window.shareTableBody) || document.querySelector('#shareTable tbody') || null;
            const mobileContainer = (typeof window !== 'undefined' && typeof window.getMobileShareCardsContainer === 'function')
                ? window.getMobileShareCardsContainer()
                : ((typeof window !== 'undefined' && window.mobileShareCardsContainer) || document.getElementById('mobileShareCards') || null);

            const existingHighlights = ((tableBody ? tableBody.querySelectorAll('tr.target-hit-alert').length : 0)
                + (mobileContainer ? mobileContainer.querySelectorAll('.mobile-card.target-hit-alert').length : 0));

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
                    if (!r.classList.contains('target-hit-alert')) { r.classList.add('target-hit-alert'); applied++; }
                } else if (r.classList.contains('target-hit-alert')) { r.classList.remove('target-hit-alert'); removed++; }
            });
            cards.forEach(c => {
                const id = c && c.dataset ? c.dataset.docId : null;
                if (!id) return;
                if (enabledIds.has(id)) {
                    if (!c.classList.contains('target-hit-alert')) { c.classList.add('target-hit-alert'); applied++; }
                } else if (c.classList.contains('target-hit-alert')) { c.classList.remove('target-hit-alert'); removed++; }
            });

            try { console.log('[Diag][enforceTargetHitStyling] applied:', applied, 'removed:', removed, 'enabledIdsCount:', enabledIds.size); } catch(_) {}
        } catch (err) {
            try { console.warn('enforceTargetHitStyling: guarded failure', err); } catch(_) {}
        }
    };

    // Provide a global alias so any unqualified calls (e.g., in classic scripts) do not throw ReferenceError
    try { window.enforceTargetHitStyling = window.Rendering.enforceTargetHitStyling; } catch(_) {}

    window.Rendering.renderAsxCodeButtons = function renderAsxCodeButtons() {
        if (!asxCodeButtonsContainer) { console.error('renderAsxCodeButtons: asxCodeButtonsContainer element not found.'); return; }
        asxCodeButtonsContainer.innerHTML = '';
        const uniqueAsxCodes = new Set();
        let sharesForButtons = [];
        if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) sharesForButtons = dedupeSharesById(allSharesData); else sharesForButtons = dedupeSharesById(allSharesData).filter(share => currentSelectedWatchlistIds.some(id => shareBelongsTo(share, id)));
        sharesForButtons.forEach(share => { if (share.shareName && typeof share.shareName === 'string' && share.shareName.trim() !== '') uniqueAsxCodes.add(share.shareName.trim().toUpperCase()); });
        if (uniqueAsxCodes.size === 0) { applyAsxButtonsState(); return; }
        const sortedAsxCodes = Array.from(uniqueAsxCodes).sort(); sortedAsxCodes.forEach(asxCode => { const button = document.createElement('button'); button.className = 'asx-code-btn'; button.textContent = asxCode; button.dataset.asxCode = asxCode; let buttonPriceChangeClass = ''; const livePriceData = livePrices[asxCode.toUpperCase()]; if (livePriceData) { const latestLive = (livePriceData.live !== null && !isNaN(livePriceData.live)) ? livePriceData.live : (livePriceData.lastLivePrice ?? null); const latestPrev = (livePriceData.prevClose !== null && !isNaN(livePriceData.prevClose)) ? livePriceData.prevClose : (livePriceData.lastPrevClose ?? null); if (latestLive !== null && latestPrev !== null && !isNaN(latestLive) && !isNaN(latestPrev)) { const change = latestLive - latestPrev; if (change > 0) buttonPriceChangeClass = 'positive'; else if (change < 0) buttonPriceChangeClass = 'negative'; else buttonPriceChangeClass = 'neutral'; } } if (buttonPriceChangeClass) button.classList.add(buttonPriceChangeClass); if (currentSelectedWatchlistIds.length === 1 && currentSelectedWatchlistIds[0] === 'portfolio') button.classList.add('portfolio-context'); const livePriceDataForButton = livePrices[asxCode.toUpperCase()]; if (livePriceDataForButton && livePriceDataForButton.targetHit && !targetHitIconDismissed) button.classList.add('target-hit-alert'); else button.classList.remove('target-hit-alert'); asxCodeButtonsContainer.appendChild(button); });
        asxCodeButtonsContainer.querySelectorAll('button.asx-code-btn').forEach(b=>b.classList.remove('active'));
        if (!asxCodeButtonsContainer.__delegated) {
            let touchStartY=0, touchMoved=false, touchStartX=0; const MOVE_THRESHOLD=8; asxCodeButtonsContainer.addEventListener('touchstart', e=>{ const t=e.touches[0]; touchStartY=t.clientY; touchStartX=t.clientX; touchMoved=false; }, { passive:true }); asxCodeButtonsContainer.addEventListener('touchmove', e=>{ const t=e.touches[0]; if (Math.abs(t.clientY-touchStartY)>MOVE_THRESHOLD||Math.abs(t.clientX-touchStartX)>MOVE_THRESHOLD) touchMoved=true; }, { passive:true }); asxCodeButtonsContainer.__delegated = true; }
    };

    // Expose top-level alias for legacy callers
    window.renderWatchlist = function(){ if (window.Rendering && window.Rendering.renderWatchlist) return window.Rendering.renderWatchlist(); };
    window.addShareToTable = function(s){ if (window.Rendering && window.Rendering.addShareToTable) return window.Rendering.addShareToTable(s); };
    window.addShareToMobileCards = function(s){ if (window.Rendering && window.Rendering.addShareToMobileCards) return window.Rendering.addShareToMobileCards(s); };
    window.renderPortfolioList = function(){ if (window.Rendering && window.Rendering.renderPortfolioList) return window.Rendering.renderPortfolioList(); };

})();


