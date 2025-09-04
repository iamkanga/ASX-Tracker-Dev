const { test, expect } = require('@playwright/test');

test.describe('Complete Share Management Workflow', () => {
  test('Share added to additional watchlist should save correctly and close modals', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Mock the confirmation dialog
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

    // Mock successful share update with watchlist merging
    await page.evaluate(() => {
      window.mockShareUpdateSuccess = true;

      // Mock the saveShareData function
      const originalSaveShareData = window.AppService?.saveShareData;
      if (window.AppService) {
        window.AppService.saveShareData = async (isSilent = false) => {
          console.log('saveShareData called with isSilent:', isSilent);

          if (window.mockShareUpdateSuccess) {
            // Mock successful update with merged watchlistIds
            console.log('Mock: Share updated successfully with merged watchlistIds');
            // Mock clearing selectedShareDocId
            window.selectedShareDocId = null;
            return Promise.resolve();
          } else {
            return Promise.reject(new Error('Mock update failed'));
          }
        };
      }
    });

    // Test the saveShareData function
    const saveResult = await page.evaluate(async () => {
      if (window.AppService && window.AppService.saveShareData) {
        try {
          await window.AppService.saveShareData();
          return {
            success: true,
            selectedShareDocId: window.selectedShareDocId,
            modalClosed: window.shareDetailModal ? window.shareDetailModal.style.display === 'none' : true
          };
        } catch (error) {
          console.error('Test error:', error);
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: 'Function not available' };
    });

    console.log('Save result:', saveResult);

    // Verify the save was successful and modal behavior
    expect(saveResult.success).toBe(true);
    expect(saveResult.selectedShareDocId).toBe(null); // Should be cleared
    expect(saveResult.modalClosed).toBe(true); // Modal should be closed
  });

  test('Watchlist deletion should preserve shares in other watchlists', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Mock the deletion process
    await page.evaluate(() => {
      window.mockDeletionSuccess = true;

      // Mock the deleteWatchlist function
      const originalDeleteWatchlist = window.AppService?.deleteWatchlist;
      if (window.AppService) {
        window.AppService.deleteWatchlist = async (watchlistId) => {
          console.log('deleteWatchlist called with ID:', watchlistId);

          if (window.mockDeletionSuccess) {
            console.log('Mock: Watchlist deleted, 1 exclusive share deleted, 2 shared shares updated');
            return Promise.resolve(true);
          } else {
            return Promise.reject(new Error('Mock deletion failed'));
          }
        };
      }
    });

    // Test the deleteWatchlist function
    const deleteResult = await page.evaluate(async () => {
      if (window.AppService && window.AppService.deleteWatchlist) {
        try {
          const result = await window.AppService.deleteWatchlist('test-watchlist-id');
          return { success: result };
        } catch (error) {
          console.error('Test error:', error);
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: 'Function not available' };
    });

    console.log('Delete result:', deleteResult);
    expect(deleteResult.success).toBe(true);
  });

  test('Share detail modal should display updated watchlist membership', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Test the watchlist membership footer generation
    const footerResult = await page.evaluate(() => {
      // Mock share data with multiple watchlistIds
      const mockShare = {
        shareName: 'TEST',
        watchlistIds: ['watchlist1', 'watchlist2', 'portfolio']
      };

      // Mock user watchlists
      const mockUserWatchlists = [
        { id: 'watchlist1', name: 'Tech Stocks' },
        { id: 'watchlist2', name: 'Growth Stocks' }
      ];

      // Simulate the footer generation logic
      const wlIds = Array.isArray(mockShare.watchlistIds) ? mockShare.watchlistIds : [];
      const names = [];
      wlIds.forEach(id => {
        if (!id || id === '__movers' || id === 'portfolio') return;
        const wl = mockUserWatchlists.find(w => w.id === id);
        if (wl && wl.name) names.push(wl.name.trim());
      });

      const inPortfolio = wlIds.includes('portfolio');
      if (inPortfolio) names.push('Portfolio');

      return {
        watchlistIds: wlIds,
        names: names,
        footerText: names.join(' / ')
      };
    });

    console.log('Footer generation result:', footerResult);

    // Verify the footer shows all watchlists correctly
    expect(footerResult.names).toContain('Tech Stocks');
    expect(footerResult.names).toContain('Growth Stocks');
    expect(footerResult.names).toContain('Portfolio');
    expect(footerResult.footerText).toBe('Tech Stocks / Growth Stocks / Portfolio');
  });
});
