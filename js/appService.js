// App Service: thin wrappers that delegate to existing implementations on window
// This lets other modules import a stable API while we gradually migrate logic.

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

export function deleteShare(...args) {
    return callOrWarn('deleteShare', args);
}

export async function saveWatchlistChanges(isSilent = false, newName, watchlistId = null) {
    return await (async()=>{ return window.saveWatchlistChanges(isSilent, newName, watchlistId); })();
}

export function deleteWatchlist(...args) {
    return callOrWarn('deleteWatchlist', args);
}

export async function saveCashAsset(isSilent = false) {
    return await (async()=>{ return window.saveCashAsset(isSilent); })();
}

export async function deleteCashCategory(categoryId) {
    return await (async()=>{ return window.deleteCashCategory(categoryId); })();
}

export async function deleteAllUserData() {
    return await (async()=>{ return window.deleteAllUserData(); })();
}

try { window.AppService = { saveShareData, deleteShare, saveWatchlistChanges, deleteWatchlist, saveCashAsset, deleteCashCategory, deleteAllUserData }; } catch(_) {}


