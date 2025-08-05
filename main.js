// Main entry point for the ASX Tracker app
// This file imports modules and runs the main logic

import * as watchlistModule from './watchlist.js';
import './script.js'; // Import main app logic (auth, splash, etc.)

// Expose the watchlist module globally for diagnostics and debugging
window.watchlistModule = watchlistModule;

// Example DOMContentLoaded setup for watchlist diagnostics (optional)
document.addEventListener('DOMContentLoaded', function () {
    watchlistModule.renderWatchlistSelect();
    watchlistModule.populateShareWatchlistSelect();
    watchlistModule.ensurePortfolioOptionPresent();
    setTimeout(watchlistModule.ensurePortfolioOptionPresent, 2000);
    // ...other initialization logic if needed...
});
