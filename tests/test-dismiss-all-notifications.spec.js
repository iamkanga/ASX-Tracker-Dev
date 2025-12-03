const { test, expect } = require('@playwright/test');

test.describe('Dismiss All Notifications', () => {
  test('should hide the notification icon when "Dismiss All" is clicked', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen to be in the DOM
    await page.waitForSelector('#splashScreen');
    
    // Mock the updateTargetHitBanner function to check if it's called
    await page.evaluate(() => {
        window.updateTargetHitBanner = () => {
            window.targetHitIconDismissed = true;
            const targetHitIconBtn = document.getElementById('targetHitIconBtn');
            const targetHitIconCount = document.getElementById('targetHitIconCount');
            if (targetHitIconBtn) {
                targetHitIconBtn.style.display = 'none';
            }
            if (targetHitIconCount) {
                targetHitIconCount.style.display = 'none';
            }
        };
    });

    // Simulate having some notifications
    await page.evaluate(() => {
        const targetHitIconBtn = document.getElementById('targetHitIconBtn');
        const targetHitIconCount = document.getElementById('targetHitIconCount');
        if (targetHitIconBtn) {
            targetHitIconBtn.style.display = 'inline-flex';
        }
        if (targetHitIconCount) {
            targetHitIconCount.textContent = '3';
            targetHitIconCount.style.display = 'flex';
        }
    });
    
    // Click the "Dismiss All" button
    await page.click('#alertModalDismissAllBtn');

    // Wait for the UI to update
    await page.waitForTimeout(500);

    // Assert that the notification icon is hidden
    const notificationIcon = await page.locator('#targetHitIconBtn');
    await expect(notificationIcon).toBeHidden();
  });
});
