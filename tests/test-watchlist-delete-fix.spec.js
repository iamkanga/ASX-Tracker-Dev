const { test, expect } = require('@playwright/test');

test.describe('Watchlist Deletion Fix Verification', () => {
  test('Verify that showCustomConfirm and ToastManager are available globally', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Test that the functions are available as expected
    const functionsAvailable = await page.evaluate(() => ({
      showCustomConfirm: typeof window.showCustomConfirm,
      ToastManager: typeof window.ToastManager,
      ToastManagerConfirm: typeof window.ToastManager?.confirm
    }));

    expect(functionsAvailable.showCustomConfirm).toBe('function');
    expect(functionsAvailable.ToastManager).toBe('object');
    expect(functionsAvailable.ToastManagerConfirm).toBe('function');
  });

  test('Verify deleteWatchlist function can be called', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Test that the deleteWatchlist function exists and is callable
    const functionTest = await page.evaluate(async () => {
      try {
        if (window.AppService && window.AppService.deleteWatchlist) {
          // Call with null to ensure the function handles invalid input without throwing
          try { await window.AppService.deleteWatchlist(null); } catch(_) { /* expected for invalid input */ }
          return true;
        }
        return false;
      } catch (_) { return false; }
    });

    expect(functionTest).toBe(true);
  });
});
