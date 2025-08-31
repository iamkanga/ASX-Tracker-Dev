const { test, expect } = require('@playwright/test');

test.describe('Calculator Functionality', () => {
  test('Standard Calculator should correctly perform multiplication', async ({ page }) => {
    // Listen for all console events and log them to the test output
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen to be in the DOM
    await page.waitForSelector('#splashScreen');

    // Use a more forceful evaluate to remove the splash screen and open the calculator
    await page.evaluate(() => {
      const splash = document.getElementById('splashScreen');
      if (splash) splash.remove();
      const calcModal = document.getElementById('calculatorModal');
      if (window.showModal && calcModal) window.showModal(calcModal);
      else if (calcModal) calcModal.style.display = 'flex';
      const main = document.querySelector('main.container');
      if(main) main.classList.remove('app-hidden');
      const header = document.getElementById('appHeader');
      if(header) header.classList.remove('app-hidden');
      document.body.style.overflow = 'auto';
    });

    // The calculator modal should now be visible
    await page.waitForSelector('#calculatorModal', { state: 'visible' });

    // Use dispatchEvent for more robust clicks
    await page.dispatchEvent('button[data-value="5"]', 'click');
    await page.dispatchEvent('button[data-action="multiply"]', 'click');
    await page.dispatchEvent('button[data-value="8"]', 'click');
    await page.dispatchEvent('button[data-action="calculate"]', 'click');

    // Check the result
    const result = await page.locator('#calculatorResult').textContent();
    console.log('Final Calculator DOM Result:', result);
    expect(result).toBe('40');

    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/calculator-result.png' });
  });
});
