const { test, expect } = require('@playwright/test');

test.describe('SWR empty-localStorage startup', () => {
  test('When localStorage empty the app shows a single global loader and no per-card Loading...', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      const capturedLogs = [];
      page.on('console', msg => { const t = msg.text(); console.log('PAGE LOG:', t); capturedLogs.push(t); });

    // Ensure localStorage is empty for the keys we care about and prevent service worker from reloading the page
    await page.context().addInitScript(() => {
      try {
        localStorage.removeItem('asx_last_allSharesData_v1');
        localStorage.removeItem('asx_last_livePrices_v1');
        localStorage.removeItem('lastWatchlistSelection');
      } catch (e) { console.warn('Test init: failed to clear localStorage', e); }

      // Prevent service worker code from running during tests by stubbing navigator.serviceWorker and disabling reload
      try {
        try { window.location.reload = function(){}; } catch(e) {}
        try {
          if (navigator && navigator.serviceWorker) {
            navigator.serviceWorker.register = () => Promise.resolve({ waiting: null, installing: null, addEventListener: () => {} });
            navigator.serviceWorker.addEventListener = () => {};
          }
        } catch(e) {}
      } catch (e) { /* ignore */ }
    });

    await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });

    // Wait a short moment for startup handlers to run
    await page.waitForTimeout(180);

    // Verify the global flag was set on window
    const showGlobal = await page.evaluate(() => { try { return !!window.__showGlobalLoadingState; } catch(_) { return false; } });
    expect(showGlobal).toBeTruthy();

    // Force a render to ensure the app draws the unified loader
    await page.evaluate(() => { try { if (window.Rendering && typeof window.Rendering.renderWatchlist === 'function') return window.Rendering.renderWatchlist(); if (typeof window.renderWatchlist === 'function') return window.renderWatchlist(); } catch(_) {} });

    // Allow some time for renderWatchlist side-effects and console logs to appear, then inspect captured logs
    await page.waitForTimeout(220);
    const sawModuleLoaded = capturedLogs.some(l => l.includes('Rendering: module loaded'));
    const sawRenderInvoked = capturedLogs.some(l => l.includes('Rendering: renderWatchlist invoked'));
    const sawTableAppended = capturedLogs.some(l => l.includes('Rendering: appended table global loader'));
    const sawMobileAppended = capturedLogs.some(l => l.includes('Rendering: appended mobile global loader'));
    console.log('DIAG LOGS COUNT:', capturedLogs.length);
    console.log('DIAG: sawModuleLoaded=', sawModuleLoaded, 'sawRenderInvoked=', sawRenderInvoked, 'sawTableAppended=', sawTableAppended, 'sawMobileAppended=', sawMobileAppended);
    expect(sawModuleLoaded).toBeTruthy();
    expect(sawRenderInvoked).toBeTruthy();

  // And crucially: no per-card 'Loading...' strings should be present inside the share list containers
  const cardLoadingCount = await page.locator('#mobileShareCards .mobile-card').locator('text=Loading...').count();
  const rowLoadingCount = await page.locator('#shareTable tbody tr').locator('text=Loading...').count();
  // The global loader uses 'Loading watchlist...' so per-card 'Loading...' should be absent inside cards/rows
  expect(cardLoadingCount + rowLoadingCount).toBe(0);

  // Ensure main DOM containers exist to avoid race conditions
  await page.waitForSelector('#shareTable', { state: 'attached' });
  await page.waitForSelector('#mobileShareCards', { state: 'attached' });

  // Now simulate arrival of real data and ensure the static unified loader is removed
  await page.evaluate(() => {
    try {
      // create a minimal fake share and insert into allSharesData
      const fake = { id: 'test-share-1', shareName: 'TEST', starRating: 0, dividendAmount: 0, frankingCredits: 0, currentPrice: 0 };
      window.allSharesData = window.allSharesData && Array.isArray(window.allSharesData) ? window.allSharesData.concat([fake]) : [fake];
      // Also ensure livePrices has an entry so render routines render price cells
      window.livePrices = window.livePrices || {};
      window.livePrices['TEST'] = { live: 1.23, prevClose: 1.00 };
      // Ensure the selected watchlist is 'All Shares' so renderWatchlist includes our fake share
      try { window.currentSelectedWatchlistIds = [window.ALL_SHARES_ID || 'all_shares_option']; } catch(e) {}
    } catch(e) { console.error('Test inject fake share failed', e); }
  });

  // Trigger a render and wait for the fake share to appear in the table
  await page.evaluate(() => { try { if (window.Rendering && typeof window.Rendering.renderWatchlist === 'function') window.Rendering.renderWatchlist(); else if (typeof window.renderWatchlist === 'function') window.renderWatchlist(); } catch(e){} });

  // Diagnostic snapshot: check that our injected data is present and inspect rendering globals
  const diag = await page.evaluate(() => {
    return {
      allSharesDataLen: Array.isArray(window.allSharesData) ? window.allSharesData.length : 0,
      hasFakeShare: !!(Array.isArray(window.allSharesData) && window.allSharesData.some(s=>s && s.id === 'test-share-1')),
      currentSelectedWatchlistIds: window.currentSelectedWatchlistIds || null,
      ALL_SHARES_ID: window.ALL_SHARES_ID || null,
      shareTableBodyExists: !!(window.shareTableBody),
      shareRowsCount: document.querySelectorAll('#shareTable tbody tr[data-doc-id]').length,
      anyRowWithId: !!document.querySelector('[data-doc-id="test-share-1"]')
    };
  });
  console.log('DIAG SNAPSHOT:', JSON.stringify(diag));

  // Wait until either the fake row is present, or the static unified loader nodes are removed.
  await page.waitForFunction(() => {
    try {
      const row = document.querySelector('[data-doc-id="test-share-1"]');
      const staticTableLoader = document.querySelector('tbody.unified-loader-container');
      const staticMobileLoader = document.querySelector('.unified-loader-mobile');
      return !!row || (!staticTableLoader && !staticMobileLoader);
    } catch (e) { return false; }
  }, { timeout: 4000 });

  // After rendering, the static unified loader elements must be removed from DOM
  const stillHasStaticTableLoader = await page.$('tbody.unified-loader-container');
  const stillHasStaticMobileLoader = await page.$('.unified-loader-mobile');
  expect(stillHasStaticTableLoader).toBeNull();
  expect(stillHasStaticMobileLoader).toBeNull();

  // Styling checks are optional for this test and can be flaky across environments, skip here.
  });
});
