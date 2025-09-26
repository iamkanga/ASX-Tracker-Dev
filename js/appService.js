// App Service: core CRUD logic extracted from script.js
// Uses window-bound Firebase services and UI helpers.
import { getUserWatchlists, setUserWatchlists, setCurrentSelectedWatchlistIds, getCurrentSelectedWatchlistIds, getUserCashCategories, setUserCashCategories, getAllSharesData, setAllSharesData, setLivePrices, getLivePrices, getCurrentSortOrder } from './state.js';
import { db, firestore, currentAppId, auth } from '../firebase.js';
import { getCurrentFormData, getCurrentCashAssetFormData } from './uiService.js';

function callOrWarn(fnName, args) {
    try {
        const fn = (typeof window !== 'undefined') ? window[fnName] : undefined;
        if (typeof fn === 'function') return fn.apply(window, args);
        console.error('[AppService] Function not available:', fnName);
    } catch (e) {
        console.error('[AppService] Error calling', fnName, e);
    }
}

export async function saveShareData(isSilent = false, capturedPriceRaw = null) {
    try { window.logDebug && window.logDebug('Share Form: saveShareData called.'); } catch(_) {}
    const saveShareBtn = window.saveShareBtn;
    if (saveShareBtn && saveShareBtn.classList && saveShareBtn.classList.contains('is-disabled-icon') && isSilent) { try { window.logDebug && window.logDebug('Auto-Save: Save button is disabled (no changes or no valid name). Skipping silent save.'); } catch(_) {} return; }

    // For new shares, ensure live price is available before collecting form data
    if (!window.selectedShareDocId) {
        const shareNameInput = document.getElementById('shareName');
        const shareName = shareNameInput ? shareNameInput.value.trim().toUpperCase() : '';

        if (shareName) {
            const livePriceData = (window.livePrices || {})[shareName];
            const currentPriceInput = document.getElementById('currentPrice');

            // If we don't have live price data and the modal input is empty, wait briefly for live price
                if (!livePriceData && (!currentPriceInput || !currentPriceInput.value || parseFloat(currentPriceInput.value) <= 0)) {
                    try { window.logDebug && window.logDebug('[SAVE DEBUG] Waiting for live price data for new share: ' + shareName); } catch(_) {}

                // Wait up to 2 seconds for live price to become available
                let attempts = 0;
                const maxAttempts = 20; // 2 seconds at 100ms intervals

                while (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const updatedLivePriceData = (window.livePrices || {})[shareName];
                    const updatedCurrentPriceInput = document.getElementById('currentPrice');
                    const hasPrice = updatedLivePriceData ||
                                   (updatedCurrentPriceInput && updatedCurrentPriceInput.value && parseFloat(updatedCurrentPriceInput.value) > 0);

                    if (hasPrice) {
                        try { window.logDebug && window.logDebug('[SAVE DEBUG] Live price now available for: ' + shareName); } catch(_) {}
                        break;
                    }

                    attempts++;
                }

                if (attempts >= maxAttempts) {
                    // If we timed out waiting for live price, proceed with save (best-effort)
                    try { window.logDebug && window.logDebug('[SAVE DEBUG] Timeout waiting for live price, proceeding with save anyway'); } catch(_) {}
                }
            }
        }
    }

    // Now collect form data after ensuring live price is available
    const form = getCurrentFormData();
    const shareName = (form && form.shareName ? form.shareName : '').trim().toUpperCase();
    if (!shareName) { try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Code is required!'); } catch(_) {} console.warn('Save Share: Code is required. Skipping save.'); return; }
    const selectedWatchlistIdsForSave = form ? form.watchlistIds : null;
    let selectedWatchlistIdForSave = form ? form.watchlistId : null;
    if (!selectedWatchlistIdForSave && Array.isArray(selectedWatchlistIdsForSave) && selectedWatchlistIdsForSave.length > 0) {
        selectedWatchlistIdForSave = selectedWatchlistIdsForSave[0];
    }
    if (!window.selectedShareDocId && Array.isArray(window.currentSelectedWatchlistIds) && window.currentSelectedWatchlistIds.includes(window.ALL_SHARES_ID)) {
        if (!selectedWatchlistIdForSave || selectedWatchlistIdForSave === '') { try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Please select a watchlist to assign the new share to.'); } catch(_) {} console.warn('Save Share: New share from All Shares: Watchlist not selected. Skipping save.'); return; }
    } else if (!window.selectedShareDocId && !selectedWatchlistIdForSave && !(Array.isArray(selectedWatchlistIdsForSave) && selectedWatchlistIdsForSave.length > 0)) { try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Please select a watchlist to assign the new share to.'); } catch(_) {} console.warn('Save Share: New share: No watchlist selected. Skipping save.'); return; }
    let currentPrice = NaN; try { const lp = (window.livePrices||{})[shareName.toUpperCase()]; if (lp && typeof lp.live === 'number' && !isNaN(lp.live)) currentPrice = lp.live; else if (lp && typeof lp.lastLivePrice === 'number' && !isNaN(lp.lastLivePrice)) currentPrice = lp.lastLivePrice; } catch(_) {}
    const targetPrice = form ? form.targetPrice : NaN; const dividendAmount = form ? form.dividendAmount : NaN; const frankingCredits = form ? form.frankingCredits : NaN;
    const comments = form ? (form.comments || []) : [];
    const currentUserId = (function(){ try { return window.currentUserId || (auth && auth.currentUser && auth.currentUser.uid) || null; } catch(_) { return null; } })();
    if (!currentUserId) { console.error('Save Share: Missing currentUserId; user not authenticated.'); try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('You must be signed in to save.'); } catch(_) {} return; }
    // Check if this is an existing share that we're updating
    let existingWatchlistIds = null;
    if (window.selectedShareDocId) {
        // We're updating an existing share, so we need to merge watchlistIds
        const existingShare = getAllSharesData().find(s => s.id === window.selectedShareDocId);
        if (existingShare && existingShare.watchlistIds) {
            existingWatchlistIds = existingShare.watchlistIds;
        }
    }

    // Prepare watchlist IDs - use new selection for updates
    let finalWatchlistIds = null;
    if (Array.isArray(selectedWatchlistIdsForSave) && selectedWatchlistIdsForSave.length > 0) {
        finalWatchlistIds = selectedWatchlistIdsForSave;
    } else if (selectedWatchlistIdForSave) {
        finalWatchlistIds = [selectedWatchlistIdForSave];
    }

    // For updates, use the new selection directly (don't merge with existing)
    if (existingWatchlistIds && Array.isArray(existingWatchlistIds) && finalWatchlistIds && Array.isArray(finalWatchlistIds)) {
        // Remove duplicates from the new selection
        finalWatchlistIds = [...new Set(finalWatchlistIds)];
        console.log('[DEBUG] Updated watchlistIds:', { existing: existingWatchlistIds, selected: selectedWatchlistIdsForSave || [selectedWatchlistIdForSave], final: finalWatchlistIds });

        // Debug: Track the share data being saved
        console.log('AppService Share Update Debug:', {
            shareId: window.selectedShareDocId,
            shareName: shareName,
            finalWatchlistIds: finalWatchlistIds
        });
    }

    const shareData = {
        shareName: shareName,
        userId: currentUserId,
        currentPrice: isNaN(currentPrice) ? null : currentPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice,
        targetDirection: (form && form.targetDirection) ? form.targetDirection : ((window.targetAboveCheckbox && window.targetAboveCheckbox.checked) ? 'above' : 'below'),
        intent: (function(){
            try {
                const dir = (form && form.targetDirection) ? form.targetDirection : ((window.targetAboveCheckbox && window.targetAboveCheckbox.checked) ? 'above' : 'below');
                const buyActive = !!(window.targetIntentBuyBtn && window.targetIntentBuyBtn.classList.contains('is-active'));
                const sellActive = !!(window.targetIntentSellBtn && window.targetIntentSellBtn.classList.contains('is-active'));
                if (buyActive && !sellActive) return 'buy';
                if (sellActive && !buyActive) return 'sell';
                return dir === 'above' ? 'sell' : 'buy';
            } catch(_) {
                return (window.targetAboveCheckbox && window.targetAboveCheckbox.checked) ? 'sell' : 'buy';
            }
        })(),
        dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
        frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
        comments: comments,
        watchlistId: selectedWatchlistIdForSave,
        watchlistIds: finalWatchlistIds,
        portfolioShares: (form ? form.portfolioShares : null),
        portfolioAvgPrice: (form ? form.portfolioAvgPrice : null),
        lastPriceUpdateTime: new Date().toISOString(),
        starRating: form ? form.starRating : (window.shareRatingSelect ? parseInt(window.shareRatingSelect.value) : 0)
    };

    // Duplicate check: when creating a new share (no selectedShareDocId), block save if a share with
    // the same ASX code already exists. This must run at save time so it also handles selections made
    // via autocomplete.
    if (!window.selectedShareDocId) {
        try {
            const existing = getAllSharesData() || [];
            const codeUpper = (shareData.shareName || '').toUpperCase();
            if (existing.some(s => (s && (s.shareName || '').toUpperCase()) === codeUpper)) {
                // Show clear toast and abort save
                try {
                    if (window.ToastManager && typeof window.ToastManager.info === 'function') {
                        window.ToastManager.info('A share with this code already exists. Save blocked.', 3000);
                    } else if (typeof window.showCustomAlert === 'function') {
                        window.showCustomAlert('A share with this code already exists. Save blocked.', 2500);
                    } else {
                        console.warn('Save blocked: duplicate share', codeUpper);
                    }
                } catch(_) {}
                return; // Abort save to prevent duplicates and data loss
            }
        } catch (e) {
            console.warn('[SaveShare] Duplicate detection failed, proceeding with save. err=', e && e.message ? e.message : e);
        }
    }

    // Set entry price logic
    if (window.selectedShareDocId) {
        // Editing existing share: always ignore entryPrice from form, preserve only original
        const existingShare = getAllSharesData().find(s => s.id === window.selectedShareDocId);
        if (existingShare && existingShare.entryPrice !== undefined) {
            shareData.entryPrice = existingShare.entryPrice;
            shareData.lastFetchedPrice = existingShare.lastFetchedPrice || existingShare.entryPrice;
            shareData.previousFetchedPrice = existingShare.previousFetchedPrice || existingShare.entryPrice;
            console.log('[ENTRY PRICE] Preserved original entry price for edit:', shareData.entryPrice);
        } else {
            // Fallback: if for some reason the share is missing, do not set entryPrice at all
            console.warn('[ENTRY PRICE] Could not find existing share to preserve entry price.');
        }
    } else {
        // Creating new share: set entryPrice from current price only
        try {
            // Prefer the visible modal input value (currentPrice) where possible to preserve exact user-visible formatting
            // First prefer any value passed explicitly from the UI layer (captured at click-time).
            // This avoids a race where updateAddFormLiveSnapshot populates the DOM slightly after the click.
            // Prefer explicit capturedPriceRaw passed from UI. Fall back to DOM input value.
            // Prefer the explicit captured price passed from the UI (captured at click-time).
            // If not provided, do a short micro-retry against the DOM input (#currentPrice)
            // to handle very small races between live snapshot population and the Save click.
            let capturedAtClick = (typeof capturedPriceRaw === 'string' && capturedPriceRaw.length) ? capturedPriceRaw : null;
            const currentPriceInput = (typeof document !== 'undefined') ? document.getElementById('currentPrice') : null;

            if (!capturedAtClick) {
                try {
                    // Try immediate read, then small backoffs (120ms, 300ms)
                    const backoffs = [0, 120, 300];
                    for (const ms of backoffs) {
                        if (ms > 0) await new Promise(r => setTimeout(r, ms));
                        const node = (typeof document !== 'undefined') ? document.getElementById('currentPrice') : null;
                        const v = node && typeof node.value === 'string' ? node.value.trim() : '';
                        if (v && v.length > 0 && !isNaN(parseFloat(v))) {
                            capturedAtClick = v;
                            break;
                        }
                    }
                } catch (e) {
                    // Ignore timing/read errors; we'll fall back below
                }
            }

            const rawEnteredFromDom = (capturedAtClick !== null) ? capturedAtClick : (currentPriceInput && typeof currentPriceInput.value === 'string' ? currentPriceInput.value.trim() : '');
            const parsedFromDom = parseFloat(rawEnteredFromDom);
            const livePrices = window.livePrices || {};
            const shareCode = shareData.shareName?.toUpperCase();

            if (rawEnteredFromDom && !isNaN(parsedFromDom)) {
                shareData.entryPrice = parsedFromDom;
                shareData.enteredPriceRaw = rawEnteredFromDom;
                shareData.lastFetchedPrice = parsedFromDom;
                if (livePrices[shareCode] && livePrices[shareCode].prevClose !== null && !isNaN(livePrices[shareCode].prevClose)) {
                    shareData.previousFetchedPrice = parseFloat(livePrices[shareCode].prevClose);
                } else {
                    // Use entry/current price as previous to produce a 0% baseline until a real prevClose arrives
                    shareData.previousFetchedPrice = parsedFromDom;
                }
                console.log('[ENTRY PRICE] Using DOM currentPrice as entry price for new share:', shareData.entryPrice, 'raw=', shareData.enteredPriceRaw);
            } else if (form && form.currentPrice !== null && form.currentPrice !== undefined && !isNaN(form.currentPrice)) {
                const v = parseFloat(form.currentPrice);
                shareData.entryPrice = v;
                shareData.enteredPriceRaw = (form.currentPrice !== null && form.currentPrice !== undefined) ? String(form.currentPrice) : '';
                shareData.lastFetchedPrice = v;
                if (livePrices[shareCode] && livePrices[shareCode].prevClose !== null && !isNaN(livePrices[shareCode].prevClose)) {
                    shareData.previousFetchedPrice = parseFloat(livePrices[shareCode].prevClose);
                } else {
                    // Use entry/current price as previous to produce a 0% baseline until a real prevClose arrives
                    shareData.previousFetchedPrice = v;
                }
                console.log('[ENTRY PRICE] Using form.currentPrice as entry price for new share:', shareData.entryPrice, 'raw=', shareData.enteredPriceRaw);
            } else {
                // Fallback: try add-form snapshot first, then livePrices if available
                const snap = (typeof window !== 'undefined' && window.__addFormSnapshot && window.__addFormSnapshot.code === shareCode) ? window.__addFormSnapshot : null;
                if (snap && typeof snap.live === 'number' && !isNaN(snap.live)) {
                    const lp = parseFloat(snap.live);
                    const pv = (typeof snap.prev === 'number' && !isNaN(snap.prev)) ? parseFloat(snap.prev) : lp;
                    shareData.entryPrice = lp;
                    shareData.enteredPriceRaw = String(lp);
                    shareData.lastFetchedPrice = lp;
                    shareData.previousFetchedPrice = pv; // use prev from snapshot or entry for 0% baseline
                    console.log('[ENTRY PRICE] Using add-form snapshot live/prev for new share:', shareData.entryPrice, pv);
                } else if (livePrices[shareCode] && typeof livePrices[shareCode].live === 'number' && !isNaN(livePrices[shareCode].live)) {
                    const lp = parseFloat(livePrices[shareCode].live);
                    shareData.entryPrice = lp;
                    shareData.enteredPriceRaw = String(lp);
                    shareData.lastFetchedPrice = lp;
                    // If prevClose unavailable, fall back to live/entry price so percentage change is 0% initially
                    shareData.previousFetchedPrice = (livePrices[shareCode].prevClose && !isNaN(livePrices[shareCode].prevClose)) ? parseFloat(livePrices[shareCode].prevClose) : lp;
                    console.log('[ENTRY PRICE] Using livePrices.live as entry price for new share:', shareData.entryPrice);
                } else {
                    console.log('[ENTRY PRICE] No entry price available from DOM/form/livePrices for new share');
                    shareData.entryPrice = null;
                    shareData.enteredPriceRaw = '';
                    shareData.lastFetchedPrice = null;
                    shareData.previousFetchedPrice = null;
                }
            }
            // No legacy globals to clear; rely on explicit capturedPriceRaw or DOM input
        } catch (e) {
            console.warn('[ENTRY PRICE] Error determining entry price for new share:', e);
        }

        // Ensure currentPrice has a sensible fallback for immediate sorting/rendering
        try {
            const cp = shareData.currentPrice;
            const ep = shareData.entryPrice;
            if ((cp === null || cp === undefined || isNaN(cp)) && (typeof ep === 'number' && !isNaN(ep))) {
                shareData.currentPrice = ep;
                console.log('[ENTRY PRICE] currentPrice set from entryPrice for initial sort fallback:', shareData.currentPrice);
            }
            // Also ensure lastFetchedPrice/previousFetchedPrice are initialized so percentage sort can place provisionals
            const lfp = shareData.lastFetchedPrice;
            if ((lfp === null || lfp === undefined || isNaN(lfp)) && (typeof ep === 'number' && !isNaN(ep))) {
                shareData.lastFetchedPrice = ep;
                console.log('[ENTRY PRICE] lastFetchedPrice set from entryPrice for initial sort fallback:', shareData.lastFetchedPrice);
            }
            const pfp = shareData.previousFetchedPrice;
            if ((pfp === null || pfp === undefined || isNaN(pfp)) && (typeof ep === 'number' && !isNaN(ep))) {
                // Default to 0% change until real prevClose arrives
                shareData.previousFetchedPrice = ep;
                console.log('[ENTRY PRICE] previousFetchedPrice set from entryPrice for 0% provisional change:', shareData.previousFetchedPrice);
            }
        } catch(_) {}
    }

    // Set entry date to current date for new shares
    if (form && form.entryDate) {
        // Convert date string to ISO format
        const entryDate = new Date(form.entryDate);
        if (!isNaN(entryDate.getTime())) {
            shareData.entryDate = entryDate.toISOString();
            console.log('[ENTRY DATE] Using entry date from form:', shareData.entryDate);
        } else {
            console.log('[ENTRY DATE] Invalid entry date provided:', form.entryDate);
        }
    } else {
        // For new shares, use current date as entry date
        shareData.entryDate = new Date().toISOString();
        console.log('[ENTRY DATE] Using current date as entry date:', shareData.entryDate);
    }


    // Check if we're trying to update an existing share
    if (window.selectedShareDocId) {
        // Store the original ID before potentially clearing it
        const originalShareDocId = window.selectedShareDocId;

        // Check if the document exists before attempting update
        const shareDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', originalShareDocId);

        try {
            // Try to get the document to verify it exists
            const docSnapshot = await firestore.getDoc(shareDocRef);

            if (!docSnapshot.exists()) {
                console.warn('Share document does not exist, falling back to creating new share:', originalShareDocId);
                // Clear the selectedShareDocId to force creation of new share
                window.selectedShareDocId = null;
                // Continue to the create new share logic below
            } else {
                // Document exists, proceed with update
                await firestore.updateDoc(shareDocRef, { ...shareData, userId: currentUserId });

                try {
                    await window.upsertAlertForShare && window.upsertAlertForShare(originalShareDocId, shareName, shareData, false);
                } catch(_) {}

                try {
                    const currentShares = getAllSharesData();
                    const idx = currentShares.findIndex(s => s.id === originalShareDocId);
                    if (idx !== -1) {
                        const updatedShares = [...currentShares];
                        updatedShares[idx] = { ...updatedShares[idx], ...shareData, userId: currentUserId };
                        setAllSharesData(updatedShares);
                        // Immediately recompute triggered alerts and refresh the target-hit banner
                        try { if (typeof window.recomputeTriggeredAlerts === 'function') window.recomputeTriggeredAlerts(); } catch(_) {}
                        try { if (typeof window.updateTargetHitBanner === 'function') window.updateTargetHitBanner(); } catch(_) {}
                    }
                } catch(_) {}

                try {
                    if (!isSilent) {
                        console.log('[SHARE UPDATED] Success notification');
                        // Ensure modal is closed first so the toast is visible immediately over the UI
                        try {
                            if (window.shareFormSection) {
                                window.shareFormSection.style.setProperty('display', 'none', 'important');
                                window.shareFormSection.classList.add('app-hidden');
                            }
                            if (typeof window.closeModals === 'function') window.closeModals();
                        } catch(_) {}

                        // Try ToastManager first (top-right toast will now be visible)
                        if (window.ToastManager && typeof window.ToastManager.success === 'function') {
                            window.ToastManager.success('Share updated successfully');
                            console.log('[SHARE UPDATED] Toast notification sent via ToastManager');
                        } else if (window.showCustomAlert && typeof window.showCustomAlert === 'function') {
                            window.showCustomAlert('Share updated successfully', 1500);
                            console.log('[SHARE UPDATED] Toast notification sent via showCustomAlert');
                        } else {
                            console.warn('[SHARE UPDATED] No toast system available');
                        }
                    }
                } catch(error) {
                    console.error('[SHARE UPDATED] Error showing notification:', error);
                }

                // First fetch live prices, then update UI with fresh data
                try {
                    console.log('[UI UPDATE] Fetching live prices first...');
                    const currentShares = getAllSharesData();
                    console.log('[UI UPDATE] Current shares count:', currentShares.length);
                    console.log('[UI UPDATE] Share codes:', currentShares.map(s => s.shareName).filter(Boolean));

                    // Temporarily enable debug mode for live pricing
                    const originalDebugMode = window.DEBUG_MODE;
                    window.DEBUG_MODE = true;

                                    await window.fetchLivePrices && window.fetchLivePrices({ cacheBust: true });

                // Restore original debug mode
                window.DEBUG_MODE = originalDebugMode;

                // Check if we got prices for the updated share
                const shareCode = shareName.toUpperCase();
                const livePrices = window.livePrices || {};
                if (!livePrices[shareCode] || !livePrices[shareCode].live) {
                    console.log('[UI UPDATE] No live price found for updated share', shareCode, '- retrying in 2 seconds...');

                    // Try again after a delay
                    setTimeout(async () => {
                        try {
                            console.log('[UI UPDATE] Retrying live price fetch for', shareCode);
                            const retryDebugMode = window.DEBUG_MODE;
                            window.DEBUG_MODE = true;

                            await window.fetchLivePrices && window.fetchLivePrices({ cacheBust: true, stockCode: shareCode });

                            window.DEBUG_MODE = retryDebugMode;

                            // Check if we got the price on retry
                            const livePricesAfterRetry = window.livePrices || {};
                            if (livePricesAfterRetry[shareCode] && livePricesAfterRetry[shareCode].live) {
                                console.log('[UI UPDATE] SUCCESS: Live price found for', shareCode, 'on retry');
                            } else {
                                console.log('[UI UPDATE] No live price available for', shareCode, '- this may be normal for new shares');
                                console.log('[UI UPDATE] Apps Script may need time to initialize data for', shareCode);

                                // Schedule additional retries for shares without pricing
                                setTimeout(async () => {
                                    console.log('[UI UPDATE] Final attempt for share', shareCode);
                                    try {
                                        await window.fetchLivePrices && window.fetchLivePrices({ cacheBust: true, stockCode: shareCode });
                                        const finalPrices = window.livePrices || {};
                                        if (finalPrices[shareCode] && finalPrices[shareCode].live) {
                                            console.log('[UI UPDATE] SUCCESS: Live price finally available for', shareCode);
                                            if (window.renderWatchlist) window.renderWatchlist();
                                            if (window.renderAsxCodeButtons) window.renderAsxCodeButtons();
                                        } else {
                                            console.log('[UI UPDATE] Live price still unavailable for', shareCode, '- user may need to refresh or try later');
                                        }
                                    } catch(error) {
                                        console.error('[UI UPDATE] Final retry failed for', shareCode, error);
                                    }
                                }, 5000); // 5 second final attempt
                            }

                            // Force UI update again
                            if (window.renderWatchlist) window.renderWatchlist();
                            if (window.renderAsxCodeButtons) window.renderAsxCodeButtons();
                        } catch(error) {
                            console.error('[UI UPDATE] Retry fetch failed:', error);
                        }
                    }, 2000);
                }

                console.log('[UI UPDATE] Live prices fetched, now updating UI');
                } catch(error) {
                    console.error('[UI UPDATE] Error fetching live prices:', error);
                }

                // Update UI immediately after successful share update
                try {
                    console.log('[UI UPDATE] Starting UI update after share update');
                    if (window.sortShares) {
                        console.log('[UI UPDATE] Calling sortShares()');
                        window.sortShares();
                    }
                    if (window.renderWatchlist) {
                        console.log('[UI UPDATE] Calling renderWatchlist()');
                        window.renderWatchlist();
                    }
                    if (window.renderAsxCodeButtons) {
                        console.log('[UI UPDATE] Calling renderAsxCodeButtons()');
                        window.renderAsxCodeButtons();
                    }
                    console.log('[UI UPDATE] UI update completed');
                } catch(error) {
                    console.error('[UI UPDATE] Error during UI update:', error);
                }

                window.originalShareData = getCurrentFormData ? getCurrentFormData() : null;
                window.setIconDisabled && window.setIconDisabled(window.saveShareBtn, true);

                if (!isSilent && window.shareFormSection) {
                    window.shareFormSection.style.setProperty('display', 'none', 'important');
                    window.shareFormSection.classList.add('app-hidden');
                }

                if (!isSilent) {
                    window.suppressShareFormReopen = true;
                    setTimeout(()=>{ window.suppressShareFormReopen = false; }, 8000);
                }

                try {
                    window.deselectCurrentShare && window.deselectCurrentShare();
                } catch(_) {}

                // Ensure modal is closed and cleaned up before returning
                try {
                    const frm = (typeof document !== 'undefined') ? document.getElementById('shareFormSection') : null;
                    if (frm && frm.style) {
                        try { frm.style.setProperty('display', 'none', 'important'); } catch(_) {}
                        try { frm.classList.add('app-hidden'); } catch(_) {}
                    }
                    try { if (window.shareDetailModal && window.shareDetailModal.dataset) delete window.shareDetailModal.dataset.shareId; } catch(_) {}
                    try { if (typeof window.closeModals === 'function') window.closeModals(); } catch(_) {}
                } catch(_) {}

                return;
            }
        } catch (error) {
            console.error('Error updating share:', error);
            if (!isSilent) {
                try {
                    window.showCustomAlert && window.showCustomAlert('Error updating share: ' + error.message);
                } catch(_) {}
            }
            return;
        }
    }

    // Check for duplicate shares when creating a new share (not updating)
    if (!window.selectedShareDocId) {
        console.log('[DUPLICATE CHECK] Creating new share, checking for duplicates...');

        // First, check locally for duplicates (fast and reliable)
        try {
            const currentShares = getAllSharesData();
            const localDuplicate = currentShares.find(share =>
                share.shareName && share.shareName.toLowerCase() === shareName.toLowerCase()
            );

            if (localDuplicate) {
                console.log('[DUPLICATE CHECK] Found local duplicate share:', shareName, '- preventing creation');
                console.log('[DUPLICATE CHECK] Local duplicate details:', {
                    id: localDuplicate.id,
                    name: localDuplicate.shareName,
                    userId: localDuplicate.userId
                });
                if (!isSilent) {
                    try {
                        window.showCustomAlert && window.showCustomAlert(`Share "${shareName}" already exists. You cannot create duplicate shares.`);
                    } catch(_) {}
                }
                console.log('[DUPLICATE CHECK] Local duplicate found - returning early to prevent creation');
                return;
            }
            console.log('[DUPLICATE CHECK] No local duplicate found, proceeding with Firestore check...');
        } catch (error) {
            console.error('[DUPLICATE CHECK] Error in local duplicate check:', error);
            // Continue with Firestore check if local check fails
        }

        // Then check Firestore for duplicates (slower but authoritative)
        try {
            console.log('[DUPLICATE CHECK] Checking Firestore for share:', shareName);
            const sharesQuery = firestore.query(
                firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares'),
                firestore.where('shareName', '==', shareName)
            );
            const querySnapshot = await firestore.getDocs(sharesQuery);
            console.log('[DUPLICATE CHECK] Query returned', querySnapshot.size, 'documents');

            if (!querySnapshot.empty) {
                console.log('[DUPLICATE CHECK] Found Firestore duplicate share:', shareName, '- preventing creation');
                console.log('[DUPLICATE CHECK] Firestore duplicate documents:', querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().shareName
                })));
                if (!isSilent) {
                    try {
                        window.showCustomAlert && window.showCustomAlert(`Share "${shareName}" already exists. You cannot create duplicate shares.`);
                    } catch(_) {}
                }
                console.log('[DUPLICATE CHECK] Firestore duplicate found - returning early to prevent creation');
                return;
            }
            console.log('[DUPLICATE CHECK] No Firestore duplicate found, proceeding with creation...');
        } catch (error) {
            console.error('[DUPLICATE CHECK] Error checking Firestore for duplicates:', error);
            // CRITICAL: Do NOT continue with creation if Firestore check fails
            // This prevents duplicates on mobile with poor network/auth issues
            if (!isSilent) {
                try {
                    window.showCustomAlert && window.showCustomAlert('Unable to verify share uniqueness. Please check your connection and try again.');
                } catch(_) {}
            }
            console.log('[DUPLICATE CHECK] Firestore check failed - preventing creation to avoid duplicates');
            return;
        }

        // Create new share
        try {
            const sharesCollection = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
            // DEBUG: log entry price sources for diagnose
            try { window.logDebug && window.logDebug('[SAVE DEBUG][appService] Creating share:', { shareName: shareName, formCurrentPrice: form ? form.currentPrice : undefined, shareDataEntryPrice: shareData.entryPrice, shareDataEnteredPriceRaw: shareData.enteredPriceRaw, livePricesForCode: (window.livePrices || {})[shareName.toUpperCase()] }); } catch(_) {}

            // Prevent rapid duplicate creates for the same shareName by using a transient guard
            try {
                window.__shareAddInProgress = window.__shareAddInProgress || {};
                const key = (shareName || '').toUpperCase();
                const now = Date.now();
                const last = window.__shareAddInProgress[key] || 0;
                if (now - last < 2000) {
                    try { window.logDebug && window.logDebug('AppService.saveShareData: Suppressing rapid duplicate add for ' + key); } catch(_) {}
                    return;
                }
                window.__shareAddInProgress[key] = now;
                setTimeout(() => { try { if (window.__shareAddInProgress) delete window.__shareAddInProgress[key]; } catch(_) {} }, 3500);
            } catch(_) {}

            // OPTIMISTIC UI: Insert a provisional share into local state so user sees it immediately
            const provisionalId = '__pending:' + Date.now() + ':' + Math.random().toString(36).slice(2,8);
            try {
                const provisionalShare = Object.assign({}, shareData, { id: provisionalId, __provisional: true, userId: currentUserId });
                const currentShares = Array.isArray(getAllSharesData()) ? getAllSharesData() : [];
                // Remove any existing provisional for same code to avoid duplicates
                const filtered = currentShares.filter(s => !(s && s.__provisional && s.shareName === provisionalShare.shareName));
                // If sorting by percentageChange, insert at the correct position immediately
                try {
                    const sortVal = (typeof getCurrentSortOrder === 'function') ? getCurrentSortOrder() : (window.getCurrentSortOrder ? window.getCurrentSortOrder() : '');
                    if (typeof sortVal === 'string' && sortVal.indexOf('percentageChange-') === 0) {
                        const [, dir] = sortVal.split('-');
                        const prices = (typeof getLivePrices === 'function') ? getLivePrices() : (window.livePrices || {});
                        const pct = (share) => {
                            try {
                                const code = (share.shareName || '').toUpperCase();
                                const lp = prices[code];
                                const live = (lp && typeof lp.live === 'number' && !isNaN(lp.live)) ? lp.live
                                            : (lp && typeof lp.lastLivePrice === 'number' && !isNaN(lp.lastLivePrice)) ? lp.lastLivePrice
                                            : (typeof share.lastFetchedPrice === 'number' && !isNaN(share.lastFetchedPrice)) ? share.lastFetchedPrice
                                            : (typeof share.currentPrice === 'number' && !isNaN(share.currentPrice)) ? share.currentPrice
                                            : (typeof share.entryPrice === 'number' && !isNaN(share.entryPrice)) ? share.entryPrice
                                            : null;
                                const prev = (lp && (typeof lp.prevClose === 'number' || typeof lp.lastPrevClose === 'number'))
                                             ? (isNaN(lp.prevClose) ? lp.lastPrevClose : lp.prevClose)
                                             : (typeof share.previousFetchedPrice === 'number' && !isNaN(share.previousFetchedPrice)) ? share.previousFetchedPrice
                                             : (typeof share.entryPrice === 'number' && !isNaN(share.entryPrice)) ? share.entryPrice
                                             : null;
                                if (live !== null && prev !== null && prev !== 0) return ((live - prev) / prev) * 100;
                                if (live !== null && (prev === null || prev === 0)) return 0; // reasonable default
                                return null;
                            } catch (_) { return null; }
                        };
                        const cmp = (a, b) => {
                            // push nulls to end
                            const pa = pct(a);
                            const pb = pct(b);
                            if (pa === null && pb === null) return 0;
                            if (pa === null) return 1;
                            if (pb === null) return -1;
                            const diff = (dir === 'asc') ? (pa - pb) : (pb - pa);
                            if (Math.abs(diff) > Number.EPSILON) return diff;
                            // tie-breaker by shareName
                            const nameA = (a.shareName || '').toUpperCase();
                            const nameB = (b.shareName || '').toUpperCase();
                            return nameA.localeCompare(nameB);
                        };
                        // Find insertion index via binary search
                        let lo = 0, hi = filtered.length;
                        while (lo < hi) {
                            const mid = (lo + hi) >> 1;
                            if (cmp(filtered[mid], provisionalShare) <= 0) {
                                lo = mid + 1;
                            } else {
                                hi = mid;
                            }
                        }
                        const nextArr = filtered.slice();
                        nextArr.splice(lo, 0, provisionalShare);
                        setAllSharesData(nextArr);
                    } else {
                        setAllSharesData([...filtered, provisionalShare]);
                    }
                } catch (insErr) {
                    setAllSharesData([...filtered, provisionalShare]);
                }
                // Seed a provisional livePrices entry so percentage/dollar sorts have data immediately
                try {
                    const code = (provisionalShare.shareName || '').toUpperCase();
                    // Prefer add-form snapshot for the active code to ensure correct immediate placement
                    const snap = (typeof window !== 'undefined' && window.__addFormSnapshot && window.__addFormSnapshot.code === code) ? window.__addFormSnapshot : null;
                    const live = (snap && typeof snap.live === 'number' && !isNaN(snap.live)) ? snap.live
                               : (typeof provisionalShare.lastFetchedPrice === 'number' && !isNaN(provisionalShare.lastFetchedPrice)) ? provisionalShare.lastFetchedPrice
                               : (typeof provisionalShare.currentPrice === 'number' && !isNaN(provisionalShare.currentPrice)) ? provisionalShare.currentPrice : null;
                    const prev = (snap && typeof snap.prev === 'number' && !isNaN(snap.prev)) ? snap.prev
                               : (typeof provisionalShare.previousFetchedPrice === 'number' && !isNaN(provisionalShare.previousFetchedPrice)) ? provisionalShare.previousFetchedPrice : null;
                    if (code && live !== null && prev !== null) {
                        setLivePrices({ [code]: { live, prevClose: prev, lastLivePrice: live, lastPrevClose: prev } });
                    }
                } catch(_) {}
                // Immediately re-apply sort so the provisional appears in the correct position
                try { if (typeof window !== 'undefined' && typeof window.sortShares === 'function') window.sortShares(); } catch(_) {}
            } catch (e) {
                try { window.logDebug && window.logDebug('AppService: provisional insert failed', e); } catch(_) {}
            }

            // Attempt to create the Firestore document
            let docRef;
            try {
                docRef = await firestore.addDoc(sharesCollection, { ...shareData, userId: currentUserId });
            } catch (error) {
                // Remove provisional on failure and notify the user
                try {
                    const currentShares = Array.isArray(getAllSharesData()) ? getAllSharesData() : [];
                    const cleaned = currentShares.filter(s => !(s && s.__provisional && s.shareName === shareName));
                    setAllSharesData(cleaned);
                } catch(_) {}
                console.error('Error creating share:', error);
                if (!isSilent) {
                    try {
                        if (window.ToastManager && typeof window.ToastManager.error === 'function') {
                            window.ToastManager.error('Failed to save share');
                        } else if (window.showCustomAlert && typeof window.showCustomAlert === 'function') {
                            window.showCustomAlert('Failed to save share: ' + (error && error.message ? error.message : 'Unknown error'), 4000);
                        } else {
                            alert('Failed to save share: ' + (error && error.message ? error.message : 'Unknown error'));
                        }
                    } catch(_) {}
                }
                return;
            }

            const newShareId = docRef.id;

            try {
                await window.upsertAlertForShare && window.upsertAlertForShare(newShareId, shareName, shareData, true);
            } catch(_) {}

            // Replace provisional entry (if present) or dedupe and append the created share to local state
            try {
                const created = { ...shareData, id: newShareId, userId: currentUserId };
                const currentShares = Array.isArray(getAllSharesData()) ? getAllSharesData() : [];
                // Remove any provisional entries for this shareName and any existing entries with same id
                const next = currentShares.filter(s => {
                    if (!s) return false;
                    if (s.id === newShareId) return false; // remove duplicates
                    if (s.__provisional && s.shareName === created.shareName) return false; // remove provisional
                    return true;
                });
                next.push(created);
                setAllSharesData(next);
                // Immediately re-apply current sort so the new share appears in the correct position
                try { if (typeof window !== 'undefined' && typeof window.sortShares === 'function') window.sortShares(); } catch(_) {}
            } catch (e) {
                try { window.logDebug && window.logDebug('AppService: failed to replace provisional with created share', e); } catch(_) {}
            }

            try {
                if (!isSilent) {
                    const displayName = shareData.shareName || shareName.toUpperCase();
                    if (window.ToastManager && typeof window.ToastManager.success === 'function') {
                        window.ToastManager.success(`Share ${displayName} added successfully`);
                    } else if (window.showCustomAlert && typeof window.showCustomAlert === 'function') {
                        window.showCustomAlert(`Share ${displayName} added successfully`, 2000);
                    }
                }
            } catch(error) {
                console.error('[SHARE ADDED] Error showing notification:', error);
            }

            // First fetch live prices, then update UI with fresh data
            try {
                console.log('[UI UPDATE] Fetching live prices first...');
                const currentShares = getAllSharesData();
                console.log('[UI UPDATE] Current shares count:', currentShares.length);
                console.log('[UI UPDATE] Share codes:', currentShares.map(s => s.shareName).filter(Boolean));

                const originalDebugMode = window.DEBUG_MODE;
                window.DEBUG_MODE = true;
                await window.fetchLivePrices && window.fetchLivePrices({ cacheBust: true });
                window.DEBUG_MODE = originalDebugMode;

                // Check if we got prices for the new share; schedule retries if not
                const newShareCode = shareName.toUpperCase();
                const livePrices = window.livePrices || {};
                if (!livePrices[newShareCode] || !livePrices[newShareCode].live) {
                    console.log('[UI UPDATE] No live price found for new share', newShareCode, '- retrying in 2 seconds...');
                    setTimeout(async () => {
                        try {
                            const retryDebugMode = window.DEBUG_MODE;
                            window.DEBUG_MODE = true;
                            await window.fetchLivePrices && window.fetchLivePrices({ cacheBust: true, stockCode: newShareCode });
                            window.DEBUG_MODE = retryDebugMode;
                            const livePricesAfterRetry = window.livePrices || {};
                            if (livePricesAfterRetry[newShareCode] && livePricesAfterRetry[newShareCode].live) {
                                console.log('[UI UPDATE] SUCCESS: Live price found for', newShareCode, 'on retry');
                            } else {
                                console.log('[UI UPDATE] No live price available for', newShareCode, '- this may be normal for completely new shares');
                                setTimeout(async () => {
                                    try {
                                        await window.fetchLivePrices && window.fetchLivePrices({ cacheBust: true, stockCode: newShareCode });
                                        const finalPrices = window.livePrices || {};
                                        if (finalPrices[newShareCode] && finalPrices[newShareCode].live) {
                                            console.log('[UI UPDATE] SUCCESS: Live price finally available for', newShareCode);
                                            if (window.renderWatchlist) window.renderWatchlist();
                                            if (window.renderAsxCodeButtons) window.renderAsxCodeButtons();
                                        } else {
                                            console.log('[UI UPDATE] Live price still unavailable for', newShareCode);
                                        }
                                    } catch(error) { console.error('[UI UPDATE] Final retry failed for', newShareCode, error); }
                                }, 5000);
                            }
                            if (window.renderWatchlist) window.renderWatchlist();
                            if (window.renderAsxCodeButtons) window.renderAsxCodeButtons();
                        } catch(error) { console.error('[UI UPDATE] Retry fetch failed:', error); }
                    }, 2000);
                }

                console.log('[UI UPDATE] Live prices fetched, now updating UI');
            } catch(error) {
                console.error('[UI UPDATE] Error fetching live prices:', error);
            }

            // Update UI immediately after successful share creation
            try {
                console.log('[UI UPDATE] Starting UI update after share creation');
                if (window.sortShares) { console.log('[UI UPDATE] Calling sortShares()'); window.sortShares(); }
                if (window.renderWatchlist) { console.log('[UI UPDATE] Calling renderWatchlist()'); window.renderWatchlist(); }
                if (window.renderAsxCodeButtons) { console.log('[UI UPDATE] Calling renderAsxCodeButtons()'); window.renderAsxCodeButtons(); }
                console.log('[UI UPDATE] UI update completed');
            } catch(error) { console.error('[UI UPDATE] Error during UI update:', error); }

            window.originalShareData = getCurrentFormData ? getCurrentFormData() : null;
            window.setIconDisabled && window.setIconDisabled(window.saveShareBtn, true);

            if (!isSilent && window.shareFormSection) {
                window.shareFormSection.style.setProperty('display', 'none', 'important');
                window.shareFormSection.classList.add('app-hidden');
            }

            if (!isSilent) {
                window.suppressShareFormReopen = true;
                setTimeout(()=>{ window.suppressShareFormReopen = false; }, 8000);
            }

            try { window.deselectCurrentShare && window.deselectCurrentShare(); } catch(_) {}

            return;
        } catch (error) {
            console.error('Error creating share (outer):', error);
            if (!isSilent) {
                try { window.showCustomAlert && window.showCustomAlert('Error creating share: ' + (error && error.message ? error.message : error)); } catch(_) {}
            }
            return;
        }
    }

    try { if (window.shareDetailModal && window.shareDetailModal.dataset) delete window.shareDetailModal.dataset.shareId; } catch(_) {}
    try { if (!isSilent && window.closeModals) window.closeModals(); } catch(_) {}

    // Additional safeguard to prevent share detail modal from reopening after save
    try {
        if (window.selectedShareDocId) {
            console.log('[DEBUG] Clearing selectedShareDocId to prevent modal reopening');
            window.selectedShareDocId = null;
        }

        // Force close any open share detail modal
        if (window.shareDetailModal && window.shareDetailModal.style) {
            console.log('[DEBUG] Force closing share detail modal');
            window.shareDetailModal.style.display = 'none';
        }

        // Clear any modal state
        if (window.wasEditOpenedFromShareDetail) {
            console.log('[DEBUG] Clearing wasEditOpenedFromShareDetail flag');
            window.wasEditOpenedFromShareDetail = false;
        }

    } catch(error) {
        console.error('[DEBUG] Error in modal cleanup:', error);
    }
}

export async function deleteShare(shareId) {
    if (!shareId) { try { window.showCustomAlert && window.showCustomAlert('No share selected for deletion.'); } catch(_) {} return; }
    try {
        const { db, firestore, currentAppId, currentUserId } = window;
        if (!db || !firestore || !currentAppId || !currentUserId) throw new Error('Firestore not available');
        const shareDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', shareId);
        await firestore.deleteDoc(shareDocRef);
        try { window.logDebug && window.logDebug('Firestore: Share (ID: ' + shareId + ') deleted.'); } catch(_) {}

        // Remove from local data immediately
        try {
            const currentShares = getAllSharesData();
            const updatedShares = currentShares.filter(s => s.id !== shareId);
            setAllSharesData(updatedShares);
        } catch(_) {}

        try {
            console.log('[SHARE DELETED] Success notification');

            // Try ToastManager first
            if (window.ToastManager && typeof window.ToastManager.success === 'function') {
                window.ToastManager.success('Share deleted');
                console.log('[SHARE DELETED] Toast notification sent via ToastManager');
            } else if (window.showCustomAlert && typeof window.showCustomAlert === 'function') {
                window.showCustomAlert('Share deleted', 1500, 'success');
                console.log('[SHARE DELETED] Toast notification sent via showCustomAlert');
            } else {
                console.warn('[SHARE DELETED] No toast system available');
            }
        } catch(error) {
            console.error('[SHARE DELETED] Error showing notification:', error);
        }
        try { window.updateTargetHitBanner && window.updateTargetHitBanner(); } catch(_) {}
        try { window.closeModals && window.closeModals(); } catch(_) {}

        // Update UI immediately after successful share deletion
        // Note: For deletions, we don't need to fetch live prices as the deleted share won't have prices anyway
        try {
            console.log('[UI UPDATE] Starting UI update after share deletion');
            if (window.sortShares) {
                console.log('[UI UPDATE] Calling sortShares()');
                window.sortShares();
            }
            if (window.renderWatchlist) {
                console.log('[UI UPDATE] Calling renderWatchlist()');
                window.renderWatchlist();
            }
            if (window.renderAsxCodeButtons) {
                console.log('[UI UPDATE] Calling renderAsxCodeButtons()');
                window.renderAsxCodeButtons();
            }
            console.log('[UI UPDATE] UI update completed');
        } catch(error) {
            console.error('[UI UPDATE] Error during UI update:', error);
        }
    } catch (error) {
        console.error('Firestore: Error deleting share:', error);
        try { window.showCustomAlert && window.showCustomAlert('Error deleting share: ' + error.message); } catch(_) {}
    }
}

export async function saveWatchlistChanges(isSilent = false, newName, watchlistId = null) {
    try { window.logDebug && window.logDebug('Watchlist Form: saveWatchlistChanges called.'); } catch(_) {}
    if (!newName || newName.trim() === '') { try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Watchlist name is required!'); } catch(_) {} console.warn('Save Watchlist: empty name.'); return; }
    const isDuplicate = getUserWatchlists().some(w => w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistId);
    if (isDuplicate) { try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('A watchlist with this name already exists!'); } catch(_) {} console.warn('Save Watchlist: duplicate name.'); return; }
    const currentUserId = window.currentUserId;
    try {
        if (watchlistId) {
            const watchlistDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistId);
            await firestore.updateDoc(watchlistDocRef, { name: newName });
            try { if (!isSilent) window.showCustomAlert && window.showCustomAlert("Watchlist renamed to '" + newName + "'!", 1500); } catch(_) {}
            try {
                await window.loadUserWatchlistsAndSettings();
                await window.loadUserPreferences();
                if (Object.keys(window.userPreferences||{}).length === 0) {
                    try { await window.persistUserPreference && window.persistUserPreference('compactViewMode', localStorage.getItem('currentMobileViewMode') || window.currentMobileViewMode); } catch(_) {}
                }
            } catch(_) {}
            try { window.logDebug && window.logDebug("Firestore: Watchlist (ID: " + watchlistId + ") renamed to '" + newName + "'."); } catch(_) {}
        } else {
            const watchlistsColRef = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
            const newDocRef = await firestore.addDoc(watchlistsColRef, { name: newName, createdAt: new Date().toISOString(), userId: currentUserId });
            try { if (!isSilent) window.showCustomAlert && window.showCustomAlert("Watchlist '" + newName + "' added!", 1500); } catch(_) {}
            try { window.logDebug && window.logDebug("Firestore: Watchlist '" + newName + "' added with ID: " + newDocRef.id); } catch(_) {}
            try { setCurrentSelectedWatchlistIds([newDocRef.id]); await window.saveLastSelectedWatchlistIds(getCurrentSelectedWatchlistIds()); } catch(_) {}
            try {
                const uw = getUserWatchlists();
                if (!uw.some(w => w.id === newDocRef.id)) {
                    const next = [...uw, { id: newDocRef.id, name: newName }];
                    next.sort((a, b) => a.name.localeCompare(b.name));
                    setUserWatchlists(next);
                }
            } catch(_) {}
            try { await window.loadUserWatchlistsAndSettings(); } catch(_) {}
            
            // After loadUserWatchlistsAndSettings completes, ensure the newly created watchlist is selected
            // and navigate to it immediately
            try {
                console.log('[WATCHLIST NAV] Setting currentSelectedWatchlistIds to new watchlist:', newDocRef.id);
                setCurrentSelectedWatchlistIds([newDocRef.id]);
                
                // Update the dropdown selection
                const watchlistSelect = document.getElementById('watchlistSelect');
                if (watchlistSelect) {
                    watchlistSelect.value = newDocRef.id;
                    console.log('[WATCHLIST NAV] Set dropdown value to:', newDocRef.id);
                }
                
                // Save the selection to localStorage
                try {
                    localStorage.setItem('lastWatchlistSelection', JSON.stringify([newDocRef.id]));
                    localStorage.setItem('lastSelectedView', newDocRef.id);
                } catch (e) {
                    console.warn('[WATCHLIST NAV] Error saving to localStorage:', e);
                }
                
                // Render the watchlist immediately
                console.log('[WATCHLIST NAV] Rendering watchlist for new watchlist');
                if (window.renderWatchlist) {
                    window.renderWatchlist();
                }
                
                // Update UI elements
                if (window.updateMainTitle) {
                    window.updateMainTitle();
                }
                if (window.updateAddHeaderButton) {
                    window.updateAddHeaderButton();
                }
                
            } catch (error) {
                console.error('[WATCHLIST NAV] Error navigating to new watchlist:', error);
            }
        }
        try { if (!isSilent) window.closeModals && window.closeModals(); } catch(_) {}

                // If watchlist picker is currently open, refresh it
                const pickerModal = document.getElementById('watchlistPickerModal');
                if (pickerModal && !pickerModal.classList.contains('app-hidden')) {
                    console.log('[WATCHLIST NAV] Refreshing watchlist picker');
                    // Close and reopen to refresh the list
                    setTimeout(() => {
                        if (window.openWatchlistPicker) window.openWatchlistPicker();
                    }, 100);
                }

        try { window.originalWatchlistData = window.getCurrentWatchlistFormData ? window.getCurrentWatchlistFormData(watchlistId === null) : null; window.checkWatchlistFormDirtyState && window.checkWatchlistFormDirtyState(watchlistId === null); } catch(_) {}
    } catch (error) {
        console.error('Firestore: Error saving watchlist:', error);
        try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Error saving watchlist: ' + error.message); } catch(_) {}
    }
}

// Update a single cash category's visibility (isHidden) field.
export async function updateCashCategoryVisibility(categoryId, isHidden) {
    if (!categoryId) throw new Error('Missing categoryId');
    try {
        const currentUserId = (function(){ try { return window.currentUserId || (auth && auth.currentUser && auth.currentUser.uid) || null; } catch(_) { return null; } })();
        if (!currentUserId) { throw new Error('User not authenticated'); }
        const categoryDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', categoryId);
        await firestore.updateDoc(categoryDocRef, { isHidden: !!isHidden, lastUpdated: new Date().toISOString() });
        try {
            const current = getUserCashCategories() || [];
            const idx = current.findIndex(c => c && c.id === categoryId);
            if (idx !== -1) { const next = current.slice(); next[idx] = { ...current[idx], isHidden: !!isHidden }; setUserCashCategories(next); }
        } catch(_) {}
        try { window.logDebug && window.logDebug('Firestore: Cash category visibility updated for ' + categoryId + ' -> ' + isHidden); } catch(_) {}
        return true;
    } catch (error) {
        console.error('Error updating cash category visibility:', error);
        throw error;
    }
}

export async function deleteWatchlist(watchlistId) {
    const currentUserId = window.currentUserId;

    if (!watchlistId) {
        try { window.showCustomAlert && window.showCustomAlert('Error: Cannot delete watchlist. ID is missing or invalid.', 2000); } catch(_) {}
        return;
    }
    if (watchlistId === window.ALL_SHARES_ID || watchlistId === window.CASH_BANK_WATCHLIST_ID) {
        try { window.showCustomAlert && window.showCustomAlert('Cannot delete this special watchlist.', 2000); } catch(_) {}
        return;
    }

    // Show confirmation dialog
    const watchlistName = getUserWatchlists().find(w => w.id === watchlistId)?.name || 'Unknown Watchlist';

    return new Promise((resolve, reject) => {
        try {
            if (window.showCustomConfirm) {
                window.showCustomConfirm(
                    `Delete "${watchlistName}"? Shares in this watchlist only will be removed.`,
                    async (confirmed) => {
                        if (!confirmed) {
                            try { window.showCustomAlert && window.showCustomAlert('Watchlist deletion cancelled.', 1000); } catch(_) {}
                            resolve(false);
                            return;
                        }

                        try {
                            await performSafeWatchlistDeletion(watchlistId, watchlistName);
                            resolve(true);
                        } catch (error) {
                            console.error('Error in safe watchlist deletion:', error);
                            try { window.showCustomAlert && window.showCustomAlert('Error deleting watchlist: ' + error.message); } catch(_) {}
                            reject(error);
                        }
                    }
                );
            } else {
                // No confirm UI available; cancel by default to avoid accidental deletion
                try { window.showCustomAlert && window.showCustomAlert('Unable to confirm deletion at this time.', 1500); } catch(_) {}
                resolve(false);
            }
        } catch (confirmError) {
            console.warn('Confirmation dialog not available, falling back to native confirm:', confirmError);
            try { window.showCustomAlert && window.showCustomAlert('Unable to confirm deletion at this time.', 1500); } catch(_) {}
            resolve(false);
        }
    });
}

async function performSafeWatchlistDeletion(watchlistId, watchlistName) {
    const currentUserId = window.currentUserId;

    try {
        const sharesColRef = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');

        // Query all shares to find those that might be affected
        const allSharesQuery = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
        const allSharesSnapshot = await firestore.getDocs(allSharesQuery);
        console.log('[DEBUG] Found', allSharesSnapshot.docs.length, 'total shares to analyze for deletion');

        const sharesToDelete = [];
        const sharesToUpdate = [];

        // Analyze each share to determine if it should be deleted or updated
        allSharesSnapshot.forEach(doc => {
            const shareData = doc.data();
            const shareWatchlistIds = shareData.watchlistIds || [];

            // Check if this share belongs to the watchlist being deleted
            if (shareWatchlistIds.includes(watchlistId)) {
                console.log('[DEBUG] Share', shareData.shareName, 'belongs to watchlist', watchlistId, '- watchlistIds:', shareWatchlistIds);
                if (shareWatchlistIds.length === 1) {
                    // Share belongs only to this watchlist - mark for deletion
                    console.log('[DEBUG] Marking share', shareData.shareName, 'for DELETION (only in this watchlist)');
                    sharesToDelete.push(doc.id);
                } else {
                    // Share belongs to multiple watchlists - mark for update (remove this watchlist ID)
                    const updatedWatchlistIds = shareWatchlistIds.filter(id => id !== watchlistId);
                    console.log('[DEBUG] Marking share', shareData.shareName, 'for UPDATE - removing', watchlistId, 'from watchlistIds:', shareWatchlistIds, '->', updatedWatchlistIds);
                    sharesToUpdate.push({
                        id: doc.id,
                        watchlistIds: updatedWatchlistIds
                    });
                }
            }
        });

        console.log('[DEBUG] Deletion analysis complete - shares to delete:', sharesToDelete.length, 'shares to update:', sharesToUpdate.length);

        // Perform batch operations
        const batch = firestore.writeBatch(db);

        // Delete shares that belong only to this watchlist
        console.log('[DEBUG] Executing batch operations...');
        sharesToDelete.forEach(shareId => {
            console.log('[DEBUG] Batch: DELETE share', shareId);
            const shareRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', shareId);
            batch.delete(shareRef);
        });

        // Update shares that belong to other watchlists (remove this watchlist ID)
        sharesToUpdate.forEach(share => {
            console.log('[DEBUG] Batch: UPDATE share', share.id, 'watchlistIds to', share.watchlistIds);
            const shareRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', share.id);
            batch.update(shareRef, { watchlistIds: share.watchlistIds });
        });

        // Delete the watchlist itself
        console.log('[DEBUG] Batch: DELETE watchlist', watchlistId);
        const watchlistDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistId);
        batch.delete(watchlistDocRef);

        await batch.commit();

        try {
            window.logDebug && window.logDebug(`Firestore: Watchlist "${watchlistName}" deleted. Deleted ${sharesToDelete.length} exclusive shares, updated ${sharesToUpdate.length} shared shares.`);
        } catch(_) {}

        try {
            window.showCustomAlert && window.showCustomAlert(`Watchlist "${watchlistName}" deleted successfully`, 2000);
        } catch(_) {}

        try { window.closeModals && window.closeModals(); } catch(_) {}
        try { setCurrentSelectedWatchlistIds([window.ALL_SHARES_ID]); await window.saveLastSelectedWatchlistIds(getCurrentSelectedWatchlistIds()); } catch(_) {}
        try { await window.loadUserWatchlistsAndSettings(); } catch(_) {}

    } catch (error) {
        console.error('Firestore: Error in safe watchlist deletion:', error);
        throw error;
    }
}

export async function saveCashAsset(isSilent = false) {
    try { window.logDebug && window.logDebug('Cash Form: saveCashAsset called.'); } catch(_) {}

    // Prevent duplicate saves when a modal save is already in progress
    if (window.__modalSaveInProgress) {
        try { window.logDebug && window.logDebug('AppService.saveCashAsset: Skipping because another modal save is in progress.'); } catch(_) {}
        return;
    }
    try { window.__modalSaveInProgress = true; } catch(_) { window.__modalSaveInProgress = true; }



    const saveCashAssetBtn = window.saveCashAssetBtn; if (saveCashAssetBtn && saveCashAssetBtn.classList && saveCashAssetBtn.classList.contains('is-disabled-icon') && isSilent) { try { window.logDebug && window.logDebug('Auto-Save: Save button is disabled (no changes or no valid name). Skipping silent save.'); } catch(_) {} return; }
    const cashForm = getCurrentCashAssetFormData();
    const assetName = (cashForm && cashForm.name ? cashForm.name : '').trim(); if (!assetName) { try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Asset name is required!'); } catch(_) {} console.warn('Save Cash Asset: Asset name is required. Skipping save.'); return; }
    const assetBalance = cashForm ? cashForm.balance : NaN; const comments = cashForm ? (cashForm.comments || []) : [];
    const currentUserId = (function(){ try { return window.currentUserId || (auth && auth.currentUser && auth.currentUser.uid) || null; } catch(_) { return null; } })();
    if (!currentUserId) { console.error('Save Cash Asset: Missing currentUserId; user not authenticated.'); try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('You must be signed in to save.'); } catch(_) {} return; }
    const cashAssetData = { name: assetName, balance: isNaN(assetBalance) ? 0 : assetBalance, comments: comments, userId: currentUserId, lastUpdated: new Date().toISOString(), isHidden: !!(cashForm && cashForm.isHidden) };
    try {
        if (window.selectedCashAssetDocId) {
            const assetDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', window.selectedCashAssetDocId);
            await firestore.updateDoc(assetDocRef, cashAssetData);
            try { if (!isSilent) window.showCustomAlert && window.showCustomAlert(`Cash asset "${assetName}" updated successfully`, 1500); } catch(_) {}
            try { window.logDebug && window.logDebug("Firestore: Cash asset '" + assetName + "' (ID: " + window.selectedCashAssetDocId + ") updated."); } catch(_) {}
            try {
                // Update state array to reflect change immediately
                const current = getUserCashCategories() || [];
                const idx = current.findIndex(c => c && c.id === window.selectedCashAssetDocId);
                if (idx !== -1) { const next = current.slice(); next[idx] = { ...current[idx], ...cashAssetData, id: window.selectedCashAssetDocId }; setUserCashCategories(next); }
            } catch(_) {}
        } else {
            // Prevent rapid duplicate creates for the same asset name by doing a quick local duplicate check
            try {
                const normalizedName = (assetName || '').trim().toLowerCase();
                const current = getUserCashCategories() || [];
                const localDuplicate = current.find(c => c && c.name && String(c.name).trim().toLowerCase() === normalizedName);
                if (localDuplicate) {
                    // Found a local duplicate, avoid creating another document
                    try { window.logDebug && window.logDebug('AppService.saveCashAsset: Local duplicate detected for cash asset: ' + assetName); } catch(_) {}
                    if (!isSilent) try { window.showCustomAlert && window.showCustomAlert(`Cash asset "${assetName}" already exists.`, 2000); } catch(_) {}
                    return;
                }

                // Transient in-progress guard keyed by normalized name to avoid two near-simultaneous adds
                window.__cashAddInProgress = window.__cashAddInProgress || {};
                const last = window.__cashAddInProgress[normalizedName] || 0;
                const now = Date.now();
                if (now - last < 3000) {
                    try { window.logDebug && window.logDebug('AppService.saveCashAsset: Suppressing rapid duplicate add for ' + assetName); } catch(_) {}
                    return;
                }
                window.__cashAddInProgress[normalizedName] = now;
                // Ensure the transient guard is cleared after a short window
                setTimeout(() => { try { if (window.__cashAddInProgress) delete window.__cashAddInProgress[normalizedName]; } catch(_) {} }, 3500);

                const cashCategoriesColRef = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
                const newDocRef = await firestore.addDoc(cashCategoriesColRef, cashAssetData);
                window.selectedCashAssetDocId = newDocRef.id;
                try { if (!isSilent) window.showCustomAlert && window.showCustomAlert("Cash asset '" + assetName + "' added successfully!", 1500); } catch(_) {}
                try { window.logDebug && window.logDebug("Firestore: Cash asset '" + assetName + "' added with ID: " + newDocRef.id); } catch(_) {}
                try {
                    // Optimistically update state so UI reflects immediately
                    const current = getUserCashCategories() || [];
                    setUserCashCategories([...current, { id: newDocRef.id, ...cashAssetData }]);
                } catch(_) {}
            } catch (innerError) {
                // If inner duplicate check or addDoc failed unexpectedly, rethrow to be caught by outer catch
                throw innerError;
            }
        }
        // Clear original data to prevent auto-save on modal close
        window.originalCashAssetData = null;
        window.setIconDisabled && window.setIconDisabled(window.saveCashAssetBtn, true);
                try { if (typeof window.renderCashCategories === 'function') window.renderCashCategories(); } catch(_) {}
        try { if (typeof window.calculateTotalCash === 'function') window.calculateTotalCash(); } catch(_) {}
        // Suppress immediate modal re-open triggered by onSnapshot or UI re-renders
        try {
            if (!isSilent) {
                window.__suppressCashModalReopen = Date.now();
                window.__justSavedCashAssetId = window.selectedCashAssetDocId || null;
                try { window.logDebug && window.logDebug('AppService: Set __suppressCashModalReopen for saved asset ID=' + (window.__justSavedCashAssetId || 'null')); } catch(_) {}
                setTimeout(() => { try { window.__suppressCashModalReopen = 0; window.__justSavedCashAssetId = null; try { window.logDebug && window.logDebug('AppService: Cleared __suppressCashModalReopen'); } catch(_) {} } catch(_) {} }, 1500);
            }
        } catch(_) {}
        if (!isSilent) {
            // Small delay to ensure UI updates are complete before closing modal
            setTimeout(() => {
                // Preferred API: window.UI.closeModals (exposed by ui.js)
                try {
                    if (window.UI && typeof window.UI.closeModals === 'function') {
                        window.UI.closeModals();
                        return;
                    }
                } catch(e) { console.error('Error calling window.UI.closeModals:', e); }

                // Fallbacks: try window.closeModals, then global closeModals
                try {
                    if (typeof window.closeModals === 'function') {
                        window.closeModals();
                        return;
                    } else if (typeof closeModals === 'function') {
                        closeModals();
                        return;
                    }
                } catch(e) { console.error('Error calling closeModals fallback:', e); }

                // Try using UI.hideModal if available for targeted close
                try {
                    if (window.UI && typeof window.UI.hideModal === 'function') {
                        const el = document.getElementById('cashAssetFormModal');
                        if (el) window.UI.hideModal(el);
                    }
                } catch(e) { console.error('Error calling UI.hideModal fallback:', e); }

                // Last resort: directly hide elements with .modal selector
                try {
                    document.querySelectorAll('.modal').forEach(modal => {
                        if (modal) modal.style.setProperty('display', 'none', 'important');
                    });
                } catch(e) { console.error('Error hiding modal elements directly:', e); }

            }, 100);
        }
    } catch (error) {
        console.error('Firestore: Error saving cash asset:', error);
        console.error('Error details:', { message: error.message, code: error.code, stack: error.stack });
        try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Error saving cash asset: ' + (error.message || 'Unknown error')); } catch(_) {}
    }
    finally {
        try { window.__modalSaveInProgress = false; } catch(_) { window.__modalSaveInProgress = false; }
    }
}

export async function deleteCashCategory(categoryId) {
    console.log('🗑️ Delete function called for ID:', categoryId);

    // Use the same pattern as saveCashAsset function with fallbacks
    // Try window object first, then fall back to imported modules
    const db = window.db || db;
    const firestore = window.firestore || firestore;
    const currentAppId = window.currentAppId || currentAppId;
    const currentUserId = (function(){
        try {
            // Try window object first
            if (window.currentUserId) return window.currentUserId;
            // Then try imported auth
            if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
            // Finally return null
            return null;
        } catch(e) {
            console.error('Error getting currentUserId:', e);
            return null;
        }
    })();

    if (!db || !currentUserId || !firestore) {
        console.error('Delete failed: Missing required variables');
        try { window.showCustomAlert && window.showCustomAlert('Firestore not available. Cannot delete cash category.'); } catch(_) {} return;
    }

    try {
        const categoryDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', categoryId);
        await firestore.deleteDoc(categoryDocRef);

        // Don't show the default success message here since the UI handler shows a custom one with the asset name
        try { window.logDebug && window.logDebug('Firestore: Cash category (ID: ' + categoryId + ') deleted.'); } catch(_) {}
        try {
            // Optimistically remove from state
            const current = getUserCashCategories() || [];
            const next = current.filter(c => c && c.id !== categoryId);
            setUserCashCategories(next);
        } catch(e) {
            console.error('Error updating local state:', e);
        }
        try { window.selectedCashAssetDocId = null; } catch(_) {}
    } catch (error) {
        console.error('Firestore: Error deleting cash category:', error);
        try { window.showCustomAlert && window.showCustomAlert('Error deleting cash category: ' + error.message); } catch(_) {}
    }
}

export async function deleteAllUserData() {
    return await (async()=>{ return window.deleteAllUserData(); })();
}

// Update a single share's visibility in portfolio totals (isHiddenInPortfolio)
export async function updateShareHiddenInPortfolio(shareId, isHidden) {
    if (!shareId) throw new Error('Missing shareId');
    try {
        const currentUserId = (function(){ try { return window.currentUserId || (auth && auth.currentUser && auth.currentUser.uid) || null; } catch(_) { return null; } })();
        if (!currentUserId) { throw new Error('User not authenticated'); }
        const shareDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', shareId);
        await firestore.updateDoc(shareDocRef, { isHiddenInPortfolio: !!isHidden, lastUpdated: new Date().toISOString() });

        // Update local cached state if present
        try {
            const current = getAllSharesData() || [];
            const idx = current.findIndex(s => s && s.id === shareId);
            if (idx !== -1) {
                const next = current.slice();
                next[idx] = { ...next[idx], isHiddenInPortfolio: !!isHidden };
                setAllSharesData(next);
            }
        } catch(_) {}

        try { window.logDebug && window.logDebug('Firestore: Share visibility updated for ' + shareId + ' -> ' + isHidden); } catch(_) {}
        return true;
    } catch (error) {
        console.error('Error updating share visibility:', error);
        throw error;
    }
}

try { window.AppService = { saveShareData, deleteShare, saveWatchlistChanges, deleteWatchlist, saveCashAsset, deleteCashCategory, deleteAllUserData, updateCashCategoryVisibility, updateShareHiddenInPortfolio }; } catch(_) {}



