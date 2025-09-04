const { test, expect } = require('@playwright/test');

test.describe('ASX Button Toggle Scrolling Fix', () => {
  test('ASX button toggle should trigger scroll when clicked', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Mock the scroll functions to track if they're called
    await page.evaluate(() => {
      window.scrollCallCount = 0;
      window.originalScrollMainToTop = window.scrollMainToTop;
      window.scrollMainToTop = function() {
        window.scrollCallCount++;
        console.log('Mock scrollMainToTop called, count:', window.scrollCallCount);
        if (window.originalScrollMainToTop) {
          return window.originalScrollMainToTop.apply(this, arguments);
        }
      };
    });

    // Wait for the ASX toggle button to be available
    await page.waitForSelector('#toggleAsxButtonsBtn', { timeout: 10000 });

    // Click the ASX toggle button
    await page.click('#toggleAsxButtonsBtn');

    // Wait a bit for the transition and scroll to happen
    await page.waitForTimeout(1000);

    // Check if scroll was called
    const scrollCount = await page.evaluate(() => window.scrollCallCount);

    console.log('Scroll call count after toggle:', scrollCount);

    // The scroll should have been called at least once (either by transitionend or fallback)
    expect(scrollCount).toBeGreaterThan(0);
  });

  test('ASX button elements should be properly detected', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Check if the required elements exist
    const elementsExist = await page.evaluate(() => {
      const toggleBtn = document.getElementById('toggleAsxButtonsBtn');
      const container = document.getElementById('asxCodeButtonsContainer');

      return {
        toggleBtn: !!toggleBtn,
        container: !!container,
        toggleBtnTag: toggleBtn ? toggleBtn.tagName : null,
        containerTag: container ? container.tagName : null
      };
    });

    console.log('Element detection results:', elementsExist);

    // Verify both elements exist
    expect(elementsExist.toggleBtn).toBe(true);
    expect(elementsExist.container).toBe(true);
    expect(elementsExist.toggleBtnTag).toBe('BUTTON');
    expect(elementsExist.containerTag).toBe('DIV');
  });

  test('ASX container should have proper CSS transitions', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Check the CSS transition properties
    const transitionProps = await page.evaluate(() => {
      const container = document.getElementById('asxCodeButtonsContainer');
      if (!container) return { found: false };

      const computedStyle = window.getComputedStyle(container);
      const transition = computedStyle.transition;

      return {
        found: true,
        transition: transition,
        hasMaxHeight: transition.includes('max-height'),
        hasPadding: transition.includes('padding'),
        hasOpacity: transition.includes('opacity'),
        duration: transition.match(/(\d+\.?\d*)s/g) // Extract duration values
      };
    });

    console.log('CSS transition properties:', transitionProps);

    // Verify the container has the expected transitions
    expect(transitionProps.found).toBe(true);
    expect(transitionProps.hasMaxHeight).toBe(true);
    expect(transitionProps.hasPadding).toBe(true);
    expect(transitionProps.hasOpacity).toBe(true);
  });
});

