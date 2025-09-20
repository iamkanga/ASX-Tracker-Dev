const { test, expect } = require('@playwright/test');

test.describe('Watchlist Deletion Fix Verification', () => {
  test('Verify that showCustomConfirm and ToastManager are available globally', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

      // Wait for the app to attach global helpers; tolerate a short startup delay
      await page.waitForFunction(() => typeof window.showCustomConfirm === 'function' && typeof window.ToastManager === 'object', { timeout: 5000 }).catch(() => {});
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

      // Wait for AppService.deleteWatchlist to be available and callable (or at least defined)
      await page.waitForFunction(() => !!(window.AppService && typeof window.AppService.deleteWatchlist === 'function'), { timeout: 5000 }).catch(() => {});
      const functionTest = await page.evaluate(async () => {
        try {
          if (window.AppService && window.AppService.deleteWatchlist) {
            try { await window.AppService.deleteWatchlist(null); } catch(_) { /* expected for invalid input */ }
            return true;
          }
          return false;
        } catch (_) { return false; }
      });
    
      expect(functionTest).toBe(true);
  });
});
