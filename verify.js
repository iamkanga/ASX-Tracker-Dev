const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log(`Browser Console: ${text}`);
    consoleLogs.push(text);
  });

  try {
    // 1. Open the application
    await page.goto('http://localhost:8000');
    await page.waitForLoadState('networkidle');

    // 2. Check for Firebase initialization message
    const firebaseInitMessages = consoleLogs.filter(log => log.includes('Firebase: Initialized successfully with config from firebase.js.'));
    assert.strictEqual(firebaseInitMessages.length, 1, `Expected 1 Firebase initialization message, but found ${firebaseInitMessages.length}`);
    console.log('✅ Firebase services initialized only once.');

    // 3. Test Sign-in functionality
    await page.click('#splashSignInBtn');
    // The sign-in process is mocked and should complete quickly
    await page.waitForSelector('#appHeader:not(.app-hidden)', { timeout: 15000 });
    const headerVisible = await page.isVisible('#appHeader');
    assert.ok(headerVisible, 'Sign-in failed, app header not visible.');
    console.log('✅ Sign-in successful.');

    // 4. Test Watchlist creation and persistence
    const newWatchlistName = `Test Watchlist ${Date.now()}`;

    // Open the "Add Watchlist" modal
    await page.click('#addWatchlistBtn');
    await page.waitForSelector('#addWatchlistModal[style*="display: flex"]');

    // Fill in the name and save
    await page.fill('#newWatchlistName', newWatchlistName);
    await page.click('#saveWatchlistBtn');

    // Wait for the new watchlist to appear in the select dropdown
    await page.waitForSelector(`option[value*="${newWatchlistName.replace(/\s/g, '_')}"]`);
    console.log(`✅ Watchlist "${newWatchlistName}" created successfully.`);

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify the watchlist is still there and not duplicated
    await page.waitForSelector('#watchlistSelect');
    const watchlistOptions = await page.$$eval('#watchlistSelect option', options => options.map(o => o.textContent));
    const matchingWatchlists = watchlistOptions.filter(name => name === newWatchlistName);

    assert.strictEqual(matchingWatchlists.length, 1, `Expected 1 watchlist named "${newWatchlistName}", but found ${matchingWatchlists.length}`);
    console.log(`✅ Watchlist "${newWatchlistName}" persisted correctly without duplication after reload.`);

    console.log('All tests passed!');

  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
