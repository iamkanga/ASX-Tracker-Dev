// App Service: core CRUD logic extracted from script.js
// Uses window-bound Firebase services and UI helpers.
import { userWatchlists, setCurrentSelectedWatchlistIds, currentSelectedWatchlistIds } from './state.js';

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
    return await (async()=>{ return window.saveShareData(isSilent); })();
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
    const isDuplicate = userWatchlists.some(w => w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistId);
    if (isDuplicate) { try { if (!isSilent) window.showCustomAlert && window.showCustomAlert('A watchlist with this name already exists!'); } catch(_) {} console.warn('Save Watchlist: duplicate name.'); return; }
    const { db, firestore, currentAppId, currentUserId } = window;
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
            try { setCurrentSelectedWatchlistIds([newDocRef.id]); await window.saveLastSelectedWatchlistIds(currentSelectedWatchlistIds); } catch(_) {}
            try { if (!userWatchlists.some(w => w.id === newDocRef.id)) userWatchlists.push({ id: newDocRef.id, name: newName }); userWatchlists.sort((a, b) => a.name.localeCompare(b.name)); } catch(_) {}
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
    const { db, firestore, currentAppId, currentUserId } = window;
    if (!watchlistId) { try { window.showCustomAlert && window.showCustomAlert('Error: Cannot delete watchlist. ID is missing or invalid.', 2000); } catch(_) {} return; }
    if (watchlistId === window.ALL_SHARES_ID || watchlistId === window.CASH_BANK_WATCHLIST_ID) { try { window.showCustomAlert && window.showCustomAlert('Cannot delete this special watchlist.', 2000); } catch(_) {} return; }
    try {
        const sharesColRef = firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
        const q = firestore.query(sharesColRef, firestore.where('watchlistId', '==', watchlistId));
        const querySnapshot = await firestore.getDocs(q);
        const batch = firestore.writeBatch(db);
        querySnapshot.forEach(doc => { const shareRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', doc.id); batch.delete(shareRef); });
        await batch.commit();
        const watchlistDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistId);
        await firestore.deleteDoc(watchlistDocRef);
        try { window.showCustomAlert && window.showCustomAlert('Watchlist deleted successfully!', 2000); } catch(_) {}
        try { window.closeModals && window.closeModals(); } catch(_) {}
        try { setCurrentSelectedWatchlistIds([window.ALL_SHARES_ID]); await window.saveLastSelectedWatchlistIds(currentSelectedWatchlistIds); } catch(_) {}
        try { await window.loadUserWatchlistsAndSettings(); } catch(_) {}
    } catch (error) {
        console.error('Firestore: Error deleting watchlist:', error);
        try { window.showCustomAlert && window.showCustomAlert('Error deleting watchlist: ' + error.message); } catch(_) {}
    }
}

export async function saveCashAsset(isSilent = false) {
    return await (async()=>{ return window.saveCashAsset(isSilent); })();
}

export async function deleteCashCategory(categoryId) {
    const { db, firestore, currentAppId, currentUserId } = window;
    if (!db || !currentUserId || !firestore) { try { window.showCustomAlert && window.showCustomAlert('Firestore not available. Cannot delete cash category.'); } catch(_) {} return; }
    try {
        const categoryDocRef = firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', categoryId);
        await firestore.deleteDoc(categoryDocRef);
        try { window.showCustomAlert && window.showCustomAlert('Category deleted successfully!', 1500); } catch(_) {}
        try { window.logDebug && window.logDebug('Firestore: Cash category (ID: ' + categoryId + ') deleted.'); } catch(_) {}
    } catch (error) {
        console.error('Firestore: Error deleting cash category:', error);
        try { window.showCustomAlert && window.showCustomAlert('Error deleting cash category: ' + error.message); } catch(_) {}
    }
}

export async function deleteAllUserData() {
    return await (async()=>{ return window.deleteAllUserData(); })();
}

try { window.AppService = { saveShareData, deleteShare, saveWatchlistChanges, deleteWatchlist, saveCashAsset, deleteCashCategory, deleteAllUserData }; } catch(_) {}


