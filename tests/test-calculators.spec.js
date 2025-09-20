const { test, expect } = require('@playwright/test');

test.describe('Calculator Functionality', () => {
  test('Standard Calculator should correctly perform multiplication', async ({ page }) => {
    // Listen for all console events and log them to the test output
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen to be in the DOM
    await page.waitForSelector('#splashScreen');

    // Ensure app is visible and open the calculator via JS so we don't depend on UI click timing
    await page.evaluate(() => {
      try {
        const splash = document.getElementById('splashScreen'); if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
        const main = document.querySelector('main.container'); if (main) main.classList.remove('app-hidden');
        const header = document.getElementById('appHeader'); if (header && header.classList.contains('app-hidden')) header.classList.remove('app-hidden');
        // Prefer a provided helper to open the calculator if available
        if (window.showModal && document.getElementById('calculatorModal')) {
          try { window.showModal(document.getElementById('calculatorModal')); } catch(e) { document.getElementById('calculatorModal').style.display = 'block'; }
        } else if (document.getElementById('calculatorModal')) {
          document.getElementById('calculatorModal').style.display = 'block';
        }
      } catch (e) { /* ignore */ }
    });

    // Wait for internal calculator helpers to be available and call them directly for deterministic behavior
    await page.waitForFunction(() => typeof window.resetCalculator === 'function' && typeof window.updateCalculatorDisplay === 'function', { timeout: 3000 }).catch(() => {});
    await page.evaluate(() => {
      try {
        if (typeof window.resetCalculator === 'function') window.resetCalculator();
        // Use public UI handler if available
        const appendNumber = window.appendNumber || ((n) => { const btn = document.querySelector(`button[data-value="${n}"]`); if (btn) btn.click(); });
        const handleAction = window.handleAction || ((a) => { const btn = document.querySelector(`button[data-action="${a}"]`); if (btn) btn.click(); });

        appendNumber('5');
        handleAction('multiply');
        appendNumber('8');
        handleAction('calculate');
      } catch (e) { console.warn('Calculator test helper failed', e); }
    });

    // Check the result
    const result = await page.locator('#calculatorResult').textContent();
    console.log('Final Calculator DOM Result:', result);
    expect(result).toBe('40');

    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/calculator-result.png' });
  });
});
