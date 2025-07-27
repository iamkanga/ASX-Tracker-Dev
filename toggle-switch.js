document.addEventListener('DOMContentLoaded', function () {
    const hideCheckbox = document.getElementById('sidebarHideCheckbox');
    const showCheckbox = document.getElementById('sidebarShowCheckbox');

    function updateCheckboxes(source) {
        if (source === hideCheckbox && hideCheckbox.checked) {
            showCheckbox.checked = false;
            // Add your logic for 'Hide' here
        } else if (source === showCheckbox && showCheckbox.checked) {
            hideCheckbox.checked = false;
            // Add your logic for 'Show' here
        }
    }

    if (hideCheckbox && showCheckbox) {
        hideCheckbox.addEventListener('change', function () {
            updateCheckboxes(hideCheckbox);
        });
        showCheckbox.addEventListener('change', function () {
            updateCheckboxes(showCheckbox);
        });
    }
});
// Sidebar Hide/Show checkbox logic
// Only one checkbox can be checked at a time, and applies live price logic
document.addEventListener('DOMContentLoaded', function () {
    const hideCheckbox = document.getElementById('sidebarHideCheckbox');
    const showCheckbox = document.getElementById('sidebarShowCheckbox');

    // Reference to global state and Firestore logic
    let showLastLivePriceOnClosedMarket = window.showLastLivePriceOnClosedMarket || false;
    const db = window.firestoreDb;
    const currentUserId = window.firebaseAuth && window.firebaseAuth.currentUser ? window.firebaseAuth.currentUser.uid : null;
    const currentAppId = window.getFirebaseAppId ? window.getFirebaseAppId() : null;

    function setShowLastLivePricePreference(value) {
        showLastLivePriceOnClosedMarket = value;
        window.showLastLivePriceOnClosedMarket = value;
        if (currentUserId && db && window.firestore) {
            const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
            window.firestore.setDoc(userProfileDocRef, { showLastLivePriceOnClosedMarket: value }, { merge: true })
                .then(() => {
                    if (window.logDebug) window.logDebug('Toggle: Saved "Show Last Live Price" preference to Firestore: ' + value);
                })
                .catch((error) => {
                    if (window.showCustomAlert) window.showCustomAlert('Error saving preference: ' + error.message);
                });
        }
        if (window.renderWatchlist) window.renderWatchlist();
        if (window.showCustomAlert) window.showCustomAlert('Last Price Display set to: ' + (value ? 'On (Market Closed)' : 'Off (Market Closed)'), 1500);
        if (window.toggleAppSidebar) window.toggleAppSidebar(false);
    }

    function updateCheckboxes(source) {
        if (source === hideCheckbox && hideCheckbox.checked) {
            showCheckbox.checked = false;
            setShowLastLivePricePreference(false);
        } else if (source === showCheckbox && showCheckbox.checked) {
            hideCheckbox.checked = false;
            setShowLastLivePricePreference(true);
        }
        // Prevent both from being unchecked: always one selected
        if (!hideCheckbox.checked && !showCheckbox.checked) {
            // Default to 'Hide' unchecked, 'Show' checked
            showCheckbox.checked = true;
            setShowLastLivePricePreference(true);
        }
    }

    if (hideCheckbox && showCheckbox) {
        hideCheckbox.addEventListener('change', function () {
            updateCheckboxes(hideCheckbox);
        });
        showCheckbox.addEventListener('change', function () {
            updateCheckboxes(showCheckbox);
        });
        // Initial state: ensure only one is checked
        updateCheckboxes(showCheckbox.checked ? showCheckbox : hideCheckbox);
    }
});
