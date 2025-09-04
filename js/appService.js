// App Service: core CRUD logic extracted from script.js
// Uses window-bound Firebase services and UI helpers.
import { getUserWatchlists, setUserWatchlists, setCurrentSelectedWatchlistIds, getCurrentSelectedWatchlistIds, getUserCashCategories, setUserCashCategories } from './state.js';
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

export async function saveShareData(isSilent = false) {
    try { window.logDebug && window.logDebug('Share Form: saveShareData called.'); } catch(_) {}
    const saveShareBtn = window.saveShareBtn;
    if (saveShareBtn && saveShareBtn.classList && saveShareBtn.classList.contains('is-disabled-icon') && isSilent) { try { window.logDebug && window.logDebug('Auto-Save: Save button is disabled (no changes or no valid name). Skipping silent save.'); } catch(_) {} return; }
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
        const existingShare = (window.allSharesData||[]).find(s => s.id === window.selectedShareDocId);
        if (existingShare && existingShare.watchlistIds) {
            existingWatchlistIds = existingShare.watchlistIds;
        }
    }

    // Prepare watchlist IDs - merge with existing ones if updating
    let finalWatchlistIds = null;
    if (Array.isArray(selectedWatchlistIdsForSave) && selectedWatchlistIdsForSave.length > 0) {
        finalWatchlistIds = selectedWatchlistIdsForSave;
    } else if (selectedWatchlistIdForSave) {
        finalWatchlistIds = [selectedWatchlistIdForSave];
    }

    // If we have existing watchlistIds and new ones, merge them
    if (existingWatchlistIds && Array.isArray(existingWatchlistIds) && finalWatchlistIds && Array.isArray(finalWatchlistIds)) {
        // Merge and deduplicate
        finalWatchlistIds = [...new Set([...existingWatchlistIds, ...finalWatchlistIds])];
        console.log('[DEBUG] Merged watchlistIds:', { existing: existingWatchlistIds, selected: selectedWatchlistIdsForSave || [selectedWatchlistIdForSave], final: finalWatchlistIds });
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
    if (!window.selectedShareDocId) { try { const sharesColUnique = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares'); const dupQuery = firestore.query(sharesColUnique, firestore.where('shareName', '==', shareName)); const dupSnap = await firestore.getDocs(dupQuery); if (!dupSnap.empty) { const existing = dupSnap.docs[0]; window.selectedShareDocId = existing.id; try { window.logDebug && window.logDebug('Uniqueness: Existing share found for code '+shareName+' (ID='+window.selectedShareDocId+'). Converting add into update.'); } catch(_) {} } } catch(e) { console.warn('Uniqueness: lookup failed', e); } }
    if (window.selectedShareDocId) { const existingShare = (window.allSharesData||[]).find(s => s.id === window.selectedShareDocId); if (shareData.currentPrice !== null && existingShare && existingShare.currentPrice !== shareData.currentPrice) { shareData.previousFetchedPrice = existingShare.lastFetchedPrice; shareData.lastFetchedPrice = shareData.currentPrice; } else if (!existingShare || existingShare.lastFetchedPrice === undefined) { shareData.previousFetchedPrice = shareData.currentPrice; shareData.lastFetchedPrice = shareData.currentPrice; } else { shareData.previousFetchedPrice = existingShare.previousFetchedPrice; shareData.lastFetchedPrice = existingShare.lastFetchedPrice; } try { const shareDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', window.selectedShareDocId); await firestore.updateDoc(shareDocRef, { ...shareData, userId: currentUserId }); try { await window.upsertAlertForShare && window.upsertAlertForShare(window.selectedShareDocId, shareName, shareData, false); } catch(_) {} try { const idx = (window.allSharesData||[]).findIndex(s => s.id === window.selectedShareDocId); if (idx !== -1) window.allSharesData[idx] = { ...window.allSharesData[idx], ...shareData, userId: currentUserId }; } catch(_) {} try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Update successful', 1500); } catch(_) {} window.originalShareData = getCurrentFormData ? getCurrentFormData() : null; window.setIconDisabled && window.setIconDisabled(window.saveShareBtn, true); if (!isSilent && window.shareFormSection) { window.shareFormSection.style.setProperty('display', 'none', 'important'); window.shareFormSection.classList.add('app-hidden'); } if (!isSilent) { window.suppressShareFormReopen = true; setTimeout(()=>{ window.suppressShareFormReopen = false; }, 8000); } try { window.deselectCurrentShare && window.deselectCurrentShare(); } catch(_) {} try { await window.fetchLivePrices && window.fetchLivePrices(); } catch(_) {} } catch (error) { console.error('Firestore: Error updating share:', error); try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Error updating share: ' + error.message); } catch(_) {} } } else { shareData.entryDate = new Date().toISOString(); if (shareData.currentPrice === null) { try { const lpLate = (window.livePrices||{})[shareName.toUpperCase()]; if (lpLate && typeof lpLate.live === 'number' && !isNaN(lpLate.live)) shareData.currentPrice = lpLate.live; else if (lpLate && typeof lpLate.lastLivePrice === 'number' && !isNaN(lpLate.lastLivePrice)) shareData.currentPrice = lpLate.lastLivePrice; } catch(_) {} } shareData.lastFetchedPrice = shareData.currentPrice; shareData.previousFetchedPrice = shareData.currentPrice; try { const sharesColRef = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares'); const newDocRef = await firestore.addDoc(sharesColRef, { ...shareData, userId: currentUserId }); window.selectedShareDocId = newDocRef.id; try { await window.upsertAlertForShare && window.upsertAlertForShare(window.selectedShareDocId, shareName, shareData, true); } catch(_) {} try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Added successfully', 1500); } catch(_) {} try { window.logDebug && window.logDebug("Firestore: Share '" + shareName + "' added with ID: " + newDocRef.id); } catch(_) {} window.originalShareData = getCurrentFormData ? getCurrentFormData() : null; window.setIconDisabled && window.setIconDisabled(window.saveShareBtn, true); if (!isSilent && window.shareFormSection) { window.shareFormSection.style.setProperty('display', 'none', 'important'); window.shareFormSection.classList.add('app-hidden'); } if (!isSilent) { window.suppressShareFormReopen = true; setTimeout(()=>{ window.suppressShareFormReopen = false; }, 8000); } try { window.deselectCurrentShare && window.deselectCurrentShare(); } catch(_) {} try { if (window.fetchLivePrices) await window.fetchLivePrices(); } catch(_) {} } catch (error) { console.error('Firestore: Error adding share:', error); try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Error adding share: ' + error.message); } catch(_) {} } }
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
        try { window.showCustomAlert && window.showCustomAlert('Share deleted', 1500, 'success'); } catch(_) {}
        try { window.updateTargetHitBanner && window.updateTargetHitBanner(); } catch(_) {}
        try { window.closeModals && window.closeModals(); } catch(_) {}
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
        }
        try { if (!isSilent) window.closeModals && window.closeModals(); } catch(_) {}
        try { window.originalWatchlistData = window.getCurrentWatchlistFormData ? window.getCurrentWatchlistFormData(watchlistId === null) : null; window.checkWatchlistFormDirtyState && window.checkWatchlistFormDirtyState(watchlistId === null); } catch(_) {}
    } catch (error) {
        console.error('Firestore: Error saving watchlist:', error);
        try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Error saving watchlist: ' + error.message); } catch(_) {}
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
                // Fallback to native confirm if custom confirm fails
                if (window.confirm(`Delete "${watchlistName}"? Shares in this watchlist only will be removed.`)) {
                    performSafeWatchlistDeletion(watchlistId, watchlistName)
                        .then(() => resolve(true))
                        .catch((error) => {
                            console.error('Error in fallback deletion:', error);
                            try { window.showCustomAlert && window.showCustomAlert('Error deleting watchlist: ' + error.message); } catch(_) {}
                            reject(error);
                        });
                } else {
                    try { window.showCustomAlert && window.showCustomAlert('Watchlist deletion cancelled.', 1000); } catch(_) {}
                    resolve(false);
                }
            }
        } catch (confirmError) {
            console.warn('Confirmation dialog not available, falling back to native confirm:', confirmError);
            // Fallback to native confirm if custom confirm fails
            if (window.confirm(`Delete "${watchlistName}"? Shares in this watchlist only will be removed.`)) {
                performSafeWatchlistDeletion(watchlistId, watchlistName)
                    .then(() => resolve(true))
                    .catch((error) => {
                        console.error('Error in fallback deletion:', error);
                        try { window.showCustomAlert && window.showCustomAlert('Error deleting watchlist: ' + error.message); } catch(_) {}
                        reject(error);
                    });
            } else {
                try { window.showCustomAlert && window.showCustomAlert('Watchlist deletion cancelled.', 1000); } catch(_) {}
                resolve(false);
            }
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
            window.showCustomAlert && window.showCustomAlert(`Watchlist "${watchlistName}" deleted successfully! ${sharesToDelete.length} shares removed, ${sharesToUpdate.length} shares updated.`, 3000);
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
            try { if (!isSilent) window.showCustomAlert && window.showCustomAlert("Cash asset '" + assetName + "' updated successfully!", 1500); } catch(_) {}
            try { window.logDebug && window.logDebug("Firestore: Cash asset '" + assetName + "' (ID: " + window.selectedCashAssetDocId + ") updated."); } catch(_) {}
            try {
                // Update state array to reflect change immediately
                const current = getUserCashCategories() || [];
                const idx = current.findIndex(c => c && c.id === window.selectedCashAssetDocId);
                if (idx !== -1) { const next = current.slice(); next[idx] = { ...current[idx], ...cashAssetData, id: window.selectedCashAssetDocId }; setUserCashCategories(next); }
            } catch(_) {}
        } else {
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
        }
        // Clear original data to prevent auto-save on modal close
        window.originalCashAssetData = null;
        window.setIconDisabled && window.setIconDisabled(window.saveCashAssetBtn, true);
                try { if (typeof window.renderCashCategories === 'function') window.renderCashCategories(); } catch(_) {}
        try { if (typeof window.calculateTotalCash === 'function') window.calculateTotalCash(); } catch(_) {}
        if (!isSilent) {
            // Small delay to ensure UI updates are complete before closing modal
            setTimeout(() => {
                // Try to call closeModals function (might be defined globally or in window scope)
                try {
                    // First try window.closeModals
                    if (typeof window.closeModals === 'function') {
                        window.closeModals();
                    }
                    // Then try direct function call if it's in global scope
                    else if (typeof closeModals === 'function') {
                        closeModals();
                    }
                } catch(e) {
                    console.error('Error calling closeModals:', e);
                }

                // Always try to directly close the cash asset modal as fallback
                const cashAssetModal = document.getElementById('cashAssetFormModal');
                if (cashAssetModal) {
                    cashAssetModal.style.display = 'none';
                }
            }, 100);
        }
    } catch (error) {
        console.error('Firestore: Error saving cash asset:', error);
        console.error('Error details:', { message: error.message, code: error.code, stack: error.stack });
        try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('Error saving cash asset: ' + (error.message || 'Unknown error')); } catch(_) {}
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

try { window.AppService = { saveShareData, deleteShare, saveWatchlistChanges, deleteWatchlist, saveCashAsset, deleteCashCategory, deleteAllUserData }; } catch(_) {}


