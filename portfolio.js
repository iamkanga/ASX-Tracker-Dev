// Portfolio-related logic extracted from script.js
// This module handles portfolio view, rendering, and diagnostics

export function showPortfolioView(mainContainer, stockWatchlistSection, renderPortfolioList) {
    if (!document.getElementById('portfolioSection')) {
        const portfolioSection = document.createElement('div');
        portfolioSection.id = 'portfolioSection';
        portfolioSection.className = 'portfolio-section';
        portfolioSection.innerHTML = '<h2>Portfolio</h2><div id="portfolioListContainer">Loading portfolio...</div>';
        mainContainer.appendChild(portfolioSection);
    }
    stockWatchlistSection.style.display = 'none';
    let portfolioSection = document.getElementById('portfolioSection');
    portfolioSection.style.display = 'block';
    renderPortfolioList();
}

export function showWatchlistView(stockWatchlistSection) {
    let portfolioSection = document.getElementById('portfolioSection');
    if (portfolioSection) portfolioSection.style.display = 'none';
    stockWatchlistSection.style.display = '';
}

export function renderPortfolioList(allSharesData) {
    let portfolioListContainer = document.getElementById('portfolioListContainer');
    if (!portfolioListContainer) return;
    const portfolioShares = allSharesData.filter(share => share.watchlistId === 'portfolio');
    if (portfolioShares.length === 0) {
        portfolioListContainer.innerHTML = '<p>No shares in your portfolio yet.</p>';
        return;
    }
    let html = '<table class="portfolio-table"><thead><tr><th>Code</th><th>Shares</th><th>Avg Price</th><th>Current Price</th><th>Value</th></tr></thead><tbody>';
    portfolioShares.forEach(share => {
        const shares = share.portfolioShares || '';
        const avgPrice = share.portfolioAvgPrice || '';
        const currPrice = share.currentPrice || '';
        const value = (shares && currPrice) ? (Number(shares) * Number(currPrice)).toFixed(2) : '';
        html += `<tr><td>${share.shareName}</td><td>${shares}</td><td>${avgPrice}</td><td>${currPrice}</td><td>${value ? '$'+value : ''}</td></tr>`;
    });
    html += '</tbody></table>';
    portfolioListContainer.innerHTML = html;
}

// Diagnostics for Portfolio option in dropdown
export function ensurePortfolioOptionPresent(watchlistSelect, logDebug, showCustomAlert) {
    if (!watchlistSelect) {
        logDebug('[Portfolio Diagnostics] watchlistSelect not found.');
        return;
    }
    const hasPortfolio = Array.from(watchlistSelect.options).some(opt => opt.value === 'portfolio');
    if (!hasPortfolio) {
        logDebug('[Portfolio Diagnostics] Portfolio option missing from main dropdown. Adding now.');
        const portfolioOption = document.createElement('option');
        portfolioOption.value = 'portfolio';
        portfolioOption.textContent = 'Portfolio';
        watchlistSelect.appendChild(portfolioOption);
        if (showCustomAlert) {
            showCustomAlert('Portfolio option was missing and has been restored!', 2500);
        } else {
            alert('Portfolio option was missing and has been restored!');
        }
    } else {
        logDebug('[Portfolio Diagnostics] Portfolio option present in main dropdown.');
    }
}
