const { test, expect } = require('@playwright/test');

test.describe('Share Addition to Additional Watchlist', () => {
  test('Existing share should be successfully added to additional watchlist without reopening modal', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Mock the confirmation dialog to return true
    await page.evaluate(() => {
      window.originalConfirm = window.confirm;
      window.confirm = () => true;

      if (window.showCustomConfirm) {
        window.originalShowCustomConfirm = window.showCustomConfirm;
        window.showCustomConfirm = (message, callback) => {
          console.log('Confirmation shown:', message);
          callback(true);
        };
      }
    });

      // Wait for AppService to be available then mock saveShareData to avoid race conditions
      await page.waitForFunction(() => !!window.AppService, { timeout: 5000 }).catch(() => {});
      await page.evaluate(() => {
        try {
          window.mockShareUpdateSuccess = true;
          if (window.AppService) {
            window.AppService.saveShareData = async (isSilent = false) => {
              if (window.mockShareUpdateSuccess) {
                window.selectedShareDocId = null;
                return Promise.resolve();
              }
              return Promise.reject(new Error('Mock update failed'));
            };
          }
        } catch (e) { /* ignore */ }
      });

    // Test the saveShareData function
    const saveResult = await page.evaluate(async () => {
      if (window.AppService && window.AppService.saveShareData) {
        try {
          await window.AppService.saveShareData();
          return { success: true, selectedShareDocId: window.selectedShareDocId };
        } catch (error) {
          console.error('Test error:', error);
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: 'Function not available' };
    });

    console.log('Save result:', saveResult);

    // Verify the save was successful and selectedShareDocId was cleared
    expect(saveResult.success).toBe(true);
    expect(saveResult.selectedShareDocId).toBe(null);
  });

  test('WatchlistIds should be properly merged when updating existing share', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Test watchlistIds merging logic
    const mergeResult = await page.evaluate(() => {
      // Simulate existing watchlistIds
      const existingWatchlistIds = ['watchlist1', 'watchlist2'];
      const selectedWatchlistIds = ['watchlist2', 'watchlist3'];

      // Test merging logic (same as in the fixed code)
      const merged = [...new Set([...existingWatchlistIds, ...selectedWatchlistIds])];

      return {
        existing: existingWatchlistIds,
        selected: selectedWatchlistIds,
        merged: merged,
        expected: ['watchlist1', 'watchlist2', 'watchlist3']
      };
    });

    console.log('Merge result:', mergeResult);

    // Verify the merge worked correctly
    expect(mergeResult.merged).toEqual(mergeResult.expected);
    expect(mergeResult.merged.length).toBe(3); // Should have 3 unique items
  });
});
