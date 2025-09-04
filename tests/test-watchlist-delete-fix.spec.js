const { test, expect } = require('@playwright/test');

test.describe('Watchlist Deletion Fix Verification', () => {
  test('Verify that showCustomConfirm and ToastManager are available globally', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Test that the functions are available
    const functionsAvailable = await page.evaluate(() => {
      return {
        showCustomConfirm: typeof window.showCustomConfirm,
        ToastManager: typeof window.ToastManager,
        ToastManagerConfirm: typeof window.ToastManager?.confirm
      };
    });

    console.log('Function availability:', functionsAvailable);

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
          console.log('deleteWatchlist function found');

          // Test with an invalid ID to see if it handles errors properly
          const result = await window.AppService.deleteWatchlist(null);
          console.log('Function returned (should be undefined for invalid ID):', result);
          return true;
        } else {
          console.error('deleteWatchlist function not found');
          return false;
        }
      } catch (error) {
        console.error('Error calling deleteWatchlist:', error);
        return false;
      }
    });

    expect(functionTest).toBe(true);
  });
});
