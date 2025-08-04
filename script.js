// --- ASX Code Data Loading ---
async function loadAsxCodes() {
    try {
        const response = await fetch('asx_codes.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        // Basic CSV parsing (assuming format: "Code","Name")
        allAsxCodes = csvText.split('\n').slice(1).map(line => {
            const parts = line.split('","');
            if (parts.length === 2) {
                const code = parts[0].replace(/"/g, '').trim();
                const name = parts[1].replace(/"/g, '').trim();
                if (code && name) {
                    return { code, name };
                }
            }
            return null;
        }).filter(Boolean); // Filter out any null entries from parsing errors
        logDebug('ASX codes loaded successfully:', allAsxCodes.length, 'codes found.');
    } catch (error) {
        console.error('Error loading ASX codes:', error);
        showCustomAlert('Could not load ASX codes for autocomplete.');
    }
}

document.addEventListener('DOMContentLoaded', loadAsxCodes);

// --- GLOBAL VARIABLES ---
const DEBUG_MODE = false; // Set to 'false' to disable most console.log messages in production

// Custom logging function to control verbosity
function logDebug(message, ...optionalParams) {
    if (DEBUG_MODE) {
        console.log(message, ...optionalParams); 
    }
}
// --- END DEBUG LOGGING SETUP ---

let db;
let auth = null;
let currentUserId = null;
let currentAppId;
let selectedShareDocId = null;
let allSharesData = []; // Kept in sync by the onSnapshot listener
let currentDialogCallback = null;
let autoDismissTimeout = null;
let lastTapTime = 0;
let tapTimeout;
let selectedElementForTap = null;
let longPressTimer;
const LONG_PRESS_THRESHOLD = 500; // Time in ms for long press detection
let touchStartX = 0;
let touchStartY = 0;
const TOUCH_MOVE_THRESHOLD = 10; // Pixels for touch movement to cancel long press
const KANGA_EMAIL = 'iamkanga@gmail.com';
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = []; // Stores all watchlists for the user
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
const ALL_SHARES_ID = 'all_shares_option'; // Special ID for the "Show All Shares" option
const CASH_BANK_WATCHLIST_ID = 'cashBank';
const PORTFOLIO_WATCHLIST_ID = 'portfolio'; // NEW: Special ID for the Portfolio
let currentSortOrder = 'entryDate-desc'; // Default sort order
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu
let originalShareData = null; // Stores the original share data when editing for dirty state check
let originalWatchlistData = null; // Stores original watchlist data for dirty state check in watchlist modals
let currentEditingWatchlistId = null; // NEW: Stores the ID of the watchlist being edited in the modal


// Live Price Data
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzktFj2KTZ7Z77L6XOIo0zxjmN-nVvEE2cuq_iZFQLZjT4lnli3pILhH15H9AzNWL0/exec';
let livePrices = {}; 
let livePriceFetchInterval = null;
const LIVE_PRICE_FETCH_INTERVAL_MS = 5 * 60 * 1000;

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10',
    'Muted Blue', 'Muted Brown', 'Muted Pink', 'Muted Green', 'Muted Purple', 'Muted Orange', 'Muted Cyan', 'Muted Magenta', 'Muted Gold', 'Muted Grey'
];
let currentCustomThemeIndex = -1;
let currentActiveTheme = 'system-default';
let savedSortOrder = null;
let savedTheme = null;

let unsubscribeShares = null;
let unsubscribeCashCategories = null;
let unsubscribePortfolio = null; // NEW

let sharesAtTargetPrice = [];
let currentMobileViewMode = 'default'; 
let targetHitIconDismissed = false;
let showLastLivePriceOnClosedMarket = false;
let wasShareDetailOpenedFromTargetAlerts = false;
let userCashCategories = [];
let selectedCashAssetDocId = null;
let originalCashAssetData = null;
let cashAssetVisibility = {};
const hideCashAssetCheckbox = document.getElementById('hideCashAssetCheckbox');
let portfolioHoldings = []; // NEW: For portfolio data

// --- UI Element References ---
const appHeader = document.getElementById('appHeader');
const mainContainer = document.querySelector('main.container');
const mainTitle = document.getElementById('mainTitle');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
const newShareBtn = document.getElementById('newShareBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
const toggleAsxButtonsBtn = document.getElementById('toggleAsxButtonsBtn');
const shareFormSection = document.getElementById('shareFormSection');
const formCloseButton = document.querySelector('.form-close-button');
const formTitle = document.getElementById('formTitle');
const formCompanyName = document.getElementById('formCompanyName');
const saveShareBtn = document.getElementById('saveShareBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const addShareLivePriceDisplay = document.getElementById('addShareLivePriceDisplay');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const shareRatingSelect = document.getElementById('shareRating');
const commentsFormContainer = document.getElementById('dynamicCommentsArea');
const modalStarRating = document.getElementById('modalStarRating');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const tableContainer = document.querySelector('.table-container');
const loadingIndicator = document.getElementById('loadingIndicator');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalCompanyName = document.getElementById('modalCompanyName');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
const modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const modalNewsLink = document.getElementById('modalNewsLink');
const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
const modalFoolLink = document.getElementById('modalFoolLink');
const modalListcorpLink = document.getElementById('modalListcorpLink');
const modalCommSecLink = document.getElementById('modalCommSecLink');
const commSecLoginMessage = document.getElementById('commSecLoginMessage');
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const calcCloseButton = document.querySelector('.calc-close-button');
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividend = document.getElementById('calcEstimatedDividend');
const sortSelect = document.getElementById('sortSelect');
const customDialogModal = document.getElementById('customDialogModal');
const customDialogMessage = document.getElementById('customDialogMessage');
const calculatorModal = document.getElementById('calculatorModal');
const calculatorInput = document.getElementById('calculatorInput');
const calculatorResult = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('.calculator-buttons');
const watchlistSelect = document.getElementById('watchlistSelect');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAllUserDataBtn = document.getElementById('deleteAllUserDataBtn');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn');
const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
const modalLivePriceDisplaySection = document.querySelector('.live-price-display-section'); 
const targetHitIconBtn = document.getElementById('targetHitIconBtn');
const targetHitIconCount = document.getElementById('targetHitIconCount');
const targetHitDetailsModal = document.getElementById('targetHitDetailsModal');
const targetHitModalTitle = document.getElementById('targetHitModalTitle');
const targetHitSharesList = document.getElementById('targetHitSharesList');
const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');
const targetHitModalCloseTopBtn = document.getElementById('targetHitModalCloseTopBtn');
const alertModalMinimizeBtn = document.getElementById('alertModalMinimizeBtn');
const alertModalDismissAllBtn = document.getElementById('alertModalDismissAllBtn');
const targetAboveCheckbox = document.getElementById('targetAboveCheckbox');
const targetBelowCheckbox = document.getElementById('targetBelowCheckbox');
const showLastLivePriceToggle = document.getElementById('showLastLivePriceToggle');
const splashScreen = document.getElementById('splashScreen');
const searchStockBtn = document.getElementById('searchStockBtn');
const stockSearchModal = document.getElementById('stockSearchModal');
const stockSearchTitle = document.getElementById('stockSearchTitle');
const asxSearchInput = document.getElementById('asxSearchInput');
const asxSuggestions = document.getElementById('asxSuggestions');
const searchResultDisplay = document.getElementById('searchResultDisplay');
const searchModalActionButtons = document.querySelector('#stockSearchModal .modal-action-buttons-footer');
const searchModalCloseButton = document.querySelector('.search-close-button');
let currentSelectedSuggestionIndex = -1;
let currentSearchShareData = null;
const splashKangarooIcon = document.getElementById('splashKangarooIcon');
const splashSignInBtn = document.getElementById('splashSignInBtn');
const alertPanel = document.getElementById('alertPanel');
const alertList = document.getElementById('alertList');
const closeAlertPanelBtn = document.getElementById('closeAlertPanelBtn');
const clearAllAlertsBtn = document.getElementById('clearAllAlertsBtn');
const stockWatchlistSection = document.getElementById('stockWatchlistSection');
const cashAssetsSection = document.getElementById('cashAssetsSection');
const cashCategoriesContainer = document.getElementById('cashCategoriesContainer');
const addCashCategoryBtn = document.getElementById('addCashCategoryBtn');
const saveCashBalancesBtn = document.getElementById('saveCashBalancesBtn');
const totalCashDisplay = document.getElementById('totalCashDisplay');
const addCashAssetSidebarBtn = document.getElementById('addCashAssetSidebarBtn');
const cashAssetFormModal = document.getElementById('cashAssetFormModal');
const cashFormTitle = document.getElementById('cashFormTitle');
const cashAssetNameInput = document.getElementById('cashAssetName');
const cashAssetBalanceInput = document.getElementById('cashAssetBalance');
const saveCashAssetBtn = document.getElementById('saveCashAssetBtn');
const deleteCashAssetBtn = document.getElementById('deleteCashAssetBtn');
const cashAssetFormCloseButton = document.querySelector('.cash-form-close-button');
const cashAssetCommentsContainer = document.getElementById('cashAssetCommentsArea');
const addCashAssetCommentBtn = document.getElementById('addCashAssetCommentBtn');
const cashAssetDetailModal = document.getElementById('cashAssetDetailModal');
const modalCashAssetName = document.getElementById('modalCashAssetName');
const detailCashAssetName = document.getElementById('detailCashAssetName');
const detailCashAssetBalance = document.getElementById('detailCashAssetBalance');
const detailCashAssetLastUpdated = document.getElementById('detailCashAssetLastUpdated');
const editCashAssetFromDetailBtn = document.getElementById('editCashAssetFromDetailBtn');
const deleteCashAssetFromDetailBtn = document.getElementById('deleteCashAssetFromDetailBtn');
const modalCashAssetCommentsContainer = document.getElementById('modalCashAssetCommentsContainer');
let sidebarOverlay = document.querySelector('.sidebar-overlay');
if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.classList.add('sidebar-overlay');
    document.body.appendChild(sidebarOverlay);
}
const formInputs = [
    shareNameInput, currentPriceInput, targetPriceInput,
    dividendAmountInput, frankingCreditsInput, shareRatingSelect
];
const cashFormInputs = [
    cashAssetNameInput, cashAssetBalanceInput
];

// --- PORTFOLIO UI ELEMENTS ---
const portfolioSection = document.getElementById('portfolioSection');
const addPortfolioBtn = document.getElementById('addPortfolioBtn');
const portfolioModal = document.getElementById('portfolioModal');
const portfolioModalCloseButton = document.querySelector('.portfolio-modal-close-button');
const portfolioAsxCodeInput = document.getElementById('portfolioAsxCode');
const portfolioAsxSuggestions = document.getElementById('portfolioAsxSuggestions');
const portfolioQuantityInput = document.getElementById('portfolioQuantity');
const portfolioAvgPriceInput = document.getElementById('portfolioAvgPrice');
const savePortfolioBtn = document.getElementById('savePortfolioBtn');

// --- PORTFOLIO FUNCTIONS ---

function renderPortfolioTable() {
    const tableBody = document.querySelector('#portfolioTable tbody');
    const emptyMsg = document.getElementById('portfolioEmptyMessage');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!portfolioHoldings || portfolioHoldings.length === 0) {
        if (emptyMsg) emptyMsg.style.display = '';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';
    portfolioHoldings.forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.code}</td>
            <td>${entry.qty}</td>
            <td>${Number(entry.avg).toFixed(2)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function showPortfolioModal() {
    if (portfolioModal) {
        portfolioModal.style.display = 'block';
        document.body.classList.add('modal-open');
        clearPortfolioForm();
    }
}

function hidePortfolioModal() {
    if (portfolioModal) {
        portfolioModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

function clearPortfolioForm() {
    if (portfolioAsxCodeInput) portfolioAsxCodeInput.value = '';
    if (portfolioQuantityInput) portfolioQuantityInput.value = '';
    if (portfolioAvgPriceInput) portfolioAvgPriceInput.value = '';
    if (portfolioAsxSuggestions) portfolioAsxSuggestions.innerHTML = '';
}

if (addPortfolioBtn) {
    addPortfolioBtn.addEventListener('click', showPortfolioModal);
}
if (portfolioModalCloseButton) {
    portfolioModalCloseButton.addEventListener('click', hidePortfolioModal);
}
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && portfolioModal && portfolioModal.style.display === 'block') {
        hidePortfolioModal();
    }
});

if (portfolioAsxCodeInput && portfolioAsxSuggestions) {
    portfolioAsxCodeInput.addEventListener('input', function () {
        const val = portfolioAsxCodeInput.value.trim().toUpperCase();
        if (!val || !Array.isArray(allAsxCodes)) {
            portfolioAsxSuggestions.innerHTML = '';
            return;
        }
        const matches = allAsxCodes.filter(c => c.code.startsWith(val)).slice(0, 8);
        if (matches.length === 0) {
            portfolioAsxSuggestions.innerHTML = '';
            return;
        }
        portfolioAsxSuggestions.innerHTML = matches.map(c => `<div class="suggestion-item" data-code="${c.code}">${c.code} - ${c.name}</div>`).join('');
    });
    portfolioAsxSuggestions.addEventListener('click', function (e) {
        const target = e.target.closest('.suggestion-item');
        if (target) {
            portfolioAsxCodeInput.value = target.dataset.code;
            portfolioAsxSuggestions.innerHTML = '';
            portfolioQuantityInput.focus();
        }
    });
}

if (savePortfolioBtn) {
    savePortfolioBtn.addEventListener('click', async function () {
        const code = (portfolioAsxCodeInput?.value || '').toUpperCase().trim();
        const qty = Number(portfolioQuantityInput?.value) || 0;
        const avg = Number(portfolioAvgPriceInput?.value) || 0;
        if (!code || qty <= 0 || avg <= 0) {
            showCustomAlert && showCustomAlert('Please enter ASX code, quantity, and average price.');
            return;
        }

        if (!db || !currentUserId || !window.firestore) {
            showCustomAlert('Error: Not logged in or database not available.');
            return;
        }
        const portfolioData = {
            code: code,
            qty: qty,
            avg: avg,
            userId: currentUserId,
            createdAt: new Date().toISOString()
        };
        try {
            const portfolioColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/portfolio');
            await window.firestore.addDoc(portfolioColRef, portfolioData);
            
            hidePortfolioModal();
            clearPortfolioForm();
            showCustomAlert && showCustomAlert('Added to portfolio!');
        } catch (error) {
            console.error('Firestore: Error saving portfolio item:', error);
            showCustomAlert('Error saving to portfolio: ' + error.message);
        }
    });
}

async function loadPortfolio() {
    if (unsubscribePortfolio) {
        unsubscribePortfolio();
        unsubscribePortfolio = null;
    }

    if (!db || !currentUserId || !window.firestore) {
        portfolioHoldings = [];
        renderPortfolioTable();
        return;
    }

    try {
        const portfolioCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/portfolio');
        const q = window.firestore.query(portfolioCol, window.firestore.orderBy('createdAt', 'desc'));

        unsubscribePortfolio = window.firestore.onSnapshot(q, (querySnapshot) => {
            let fetchedHoldings = [];
            querySnapshot.forEach((doc) => {
                fetchedHoldings.push({ id: doc.id, ...doc.data() });
            });
            portfolioHoldings = fetchedHoldings;
            renderPortfolioTable();
        });
    } catch (error) {
        console.error('Error setting up portfolio listener:', error);
    }
}

// --- END PORTFOLIO FUNCTIONS ---

// --- GLOBAL HELPER FUNCTIONS ---

function formatUserDecimalStrict(value) {
    if (value === null || isNaN(value)) return '';
    let str = value.toString();
    if (!str.includes('.')) return value.toFixed(2);
    let [intPart, decPart] = str.split('.');
    if (decPart.length === 3) {
        return intPart + '.' + decPart;
    } else if (decPart.length === 2) {
        return intPart + '.' + decPart;
    } else if (decPart.length === 1) {
        return intPart + '.' + decPart.padEnd(2, '0');
    } else {
        return Number(value).toFixed(3);
    }
}

function adjustMainContentPadding() {
    if (appHeader && mainContainer) {
        const headerHeight = appHeader.offsetHeight; 
        mainContainer.style.paddingTop = `${headerHeight}px`;
    }
}

function setIconDisabled(element, isDisabled) {
    if (!element) return;
    if (isDisabled) {
        element.classList.add('is-disabled-icon');
    } else {
        element.classList.remove('is-disabled-icon');
    }
}

function closeModals() {
    // ... (existing closeModals function)
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator();
    deselectCurrentShare();
    deselectCurrentCashAsset();
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    hideContextMenu();
    if (alertPanel) hideModal(alertPanel);
}

function showCustomAlert(message, duration = 1000) {
    // ... (existing showCustomAlert function)
    if (!customDialogModal || !customDialogMessage) return;
    customDialogMessage.textContent = message;
    showModal(customDialogModal);
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); }
    autoDismissTimeout = setTimeout(() => { hideModal(customDialogModal); autoDismissTimeout = null; }, duration);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- DATA LOADING & RENDERING ---

async function loadShares() {
    if (unsubscribeShares) {
        unsubscribeShares();
        unsubscribeShares = null;
    }
    if (!db || !currentUserId || !window.firestore) {
        allSharesData = [];
        renderWatchlist();
        return;
    }
    const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
    unsubscribeShares = window.firestore.onSnapshot(sharesCol, (querySnapshot) => {
        let fetchedShares = [];
        querySnapshot.forEach((doc) => {
            fetchedShares.push({ id: doc.id, ...doc.data() });
        });
        allSharesData = fetchedShares;
        sortShares();
        renderAsxCodeButtons();
    });
}

async function loadCashCategories() {
    if (unsubscribeCashCategories) {
        unsubscribeCashCategories();
        unsubscribeCashCategories = null;
    }
    if (!db || !currentUserId || !window.firestore) {
        userCashCategories = [];
        renderCashCategories();
        return;
    }
    const cashCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
    unsubscribeCashCategories = window.firestore.onSnapshot(cashCol, (querySnapshot) => {
        let fetchedCategories = [];
        querySnapshot.forEach((doc) => {
            fetchedCategories.push({ id: doc.id, ...doc.data() });
        });
        userCashCategories = fetchedCategories;
        renderWatchlist();
    });
}

function renderWatchlistSelect() {
    if (!watchlistSelect) return;
    const currentSelectedValue = watchlistSelect.value;
    
    watchlistSelect.innerHTML = '<option value="" disabled>Watch List</option>';

    const portfolioOption = document.createElement('option');
    portfolioOption.value = PORTFOLIO_WATCHLIST_ID;
    portfolioOption.textContent = 'Portfolio';
    watchlistSelect.appendChild(portfolioOption);

    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    userWatchlists.forEach(watchlist => {
        if (watchlist.id !== CASH_BANK_WATCHLIST_ID) {
            const option = document.createElement('option');
            option.value = watchlist.id;
            option.textContent = watchlist.name;
            watchlistSelect.appendChild(option);
        }
    });

    const cashBankOption = document.createElement('option');
    cashBankOption.value = CASH_BANK_WATCHLIST_ID;
    cashBankOption.textContent = 'Cash & Assets';
    watchlistSelect.appendChild(cashBankOption);

    if (Array.from(watchlistSelect.options).some(opt => opt.value === currentSelectedValue)) {
        watchlistSelect.value = currentSelectedValue;
    } else {
        watchlistSelect.value = ALL_SHARES_ID;
    }
}

function renderWatchlist() {
    const selectedWatchlistId = watchlistSelect.value;
    
    stockWatchlistSection.classList.add('app-hidden');
    cashAssetsSection.classList.add('app-hidden');
    if (portfolioSection) portfolioSection.classList.add('app-hidden');

    if (selectedWatchlistId === PORTFOLIO_WATCHLIST_ID) {
        if (portfolioSection) portfolioSection.classList.remove('app-hidden');
        mainTitle.textContent = 'Portfolio';
        renderPortfolioTable();
        sortSelect.classList.add('app-hidden');
    } else if (selectedWatchlistId === CASH_BANK_WATCHLIST_ID) {
        cashAssetsSection.classList.remove('app-hidden');
        mainTitle.textContent = 'Cash & Assets';
        renderCashCategories();
        sortSelect.classList.remove('app-hidden');
    } else {
        stockWatchlistSection.classList.remove('app-hidden');
        const selectedWatchlist = userWatchlists.find(wl => wl.id === selectedWatchlistId);
        mainTitle.textContent = selectedWatchlist ? selectedWatchlist.name : 'All Shares';
        sortShares();
        sortSelect.classList.remove('app-hidden');
    }
    updateAddHeaderButton();
}

// ... (rest of the functions, like sortShares, renderAsxCodeButtons, etc.)
// Make sure to call loadPortfolio() in onAuthStateChanged

// --- AUTHENTICATION ---
if (window.firebaseAuth && window.authFunctions) {
    window.authFunctions.onAuthStateChanged(window.firebaseAuth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            // ... (user logged in logic)
            await loadUserWatchlistsAndSettings();
            await loadShares();
            await loadCashCategories();
            await loadPortfolio(); // NEW
            await fetchLivePrices();
            startLivePriceUpdates();
        } else {
            currentUserId = null;
            // ... (user logged out logic)
            if (unsubscribeShares) unsubscribeShares();
            if (unsubscribeCashCategories) unsubscribeCashCategories();
            if (unsubscribePortfolio) unsubscribePortfolio(); // NEW
            portfolioHoldings = []; // NEW
            // ...
        }
    });
}

// ... (the very rest of the file)