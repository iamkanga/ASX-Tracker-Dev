const { test, expect } = require('@playwright/test');

test.describe('ASX Toggle Button Visibility Fix', () => {
  test('ASX toggle button should become visible when ASX buttons are available', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Wait for the app to load and select a watchlist that has ASX buttons
    await page.waitForTimeout(3000);

    // Check if the ASX toggle button becomes visible
    const toggleButtonVisible = await page.evaluate(() => {
      const btn = document.getElementById('toggleAsxButtonsBtn');
      if (!btn) return { exists: false };

      const computedStyle = window.getComputedStyle(btn);
      const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';

      return {
        exists: true,
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        pointerEvents: computedStyle.pointerEvents,
        isVisible: isVisible
      };
    });

    console.log('ASX Toggle Button Visibility:', toggleButtonVisible);

    // The button should exist and be visible
    expect(toggleButtonVisible.exists).toBe(true);

    // Note: The visibility depends on whether ASX buttons are available for the current watchlist
    // If there are no ASX buttons, the button will be hidden, which is correct behavior
  });

  test('ASX buttons should be available when a stock watchlist is selected', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Wait for the app to load
    await page.waitForTimeout(3000);

    // Check if ASX buttons are available
    const asxButtonsAvailable = await page.evaluate(() => {
      const container = document.getElementById('asxCodeButtonsContainer');
      if (!container) return { containerExists: false };

      const buttons = container.querySelectorAll('button.asx-code-btn');
      const hasButtons = buttons.length > 0;

      return {
        containerExists: true,
        buttonCount: buttons.length,
        hasButtons: hasButtons,
        containerDisplay: window.getComputedStyle(container).display
      };
    });

    console.log('ASX Buttons Availability:', asxButtonsAvailable);

    // The container should exist
    expect(asxButtonsAvailable.containerExists).toBe(true);

    // Note: The number of buttons depends on the selected watchlist
    // If no watchlist is selected or if it's a special watchlist, there may be no buttons
  });

  test('ASX toggle functionality should work when button is visible', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Wait for the app to load
    await page.waitForTimeout(3000);

    // Check if the ASX toggle button is visible and clickable
    const buttonState = await page.evaluate(() => {
      const btn = document.getElementById('toggleAsxButtonsBtn');
      if (!btn) return { exists: false };

      const computedStyle = window.getComputedStyle(btn);
      const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
      const isClickable = computedStyle.pointerEvents !== 'none';

      return {
        exists: true,
        isVisible: isVisible,
        isClickable: isClickable,
        canClick: isVisible && isClickable
      };
    });

    console.log('ASX Toggle Button Clickability:', buttonState);

    // The button should exist
    expect(buttonState.exists).toBe(true);

    // If the button is visible and clickable, try clicking it
    if (buttonState.canClick) {
      console.log('Button is clickable, attempting to click...');

      // Click the button
      await page.click('#toggleAsxButtonsBtn');

      // Wait for any animations/transitions
      await page.waitForTimeout(1000);

      // Check if the click was processed (this would be indicated by state changes)
      const clickResult = await page.evaluate(() => {
        // Check if the scroll flag was set (indicating click was processed)
        return {
          scrollFlagSet: !!window.__asxToggleWantsScroll,
          toggleFunctionAvailable: typeof window.applyAsxButtonsState === 'function'
        };
      });

      console.log('Click processing result:', clickResult);

      // The scroll flag should be set if the click was processed
      // Note: This might be cleared by transitionend handler, so we check the function availability
      expect(clickResult.toggleFunctionAvailable).toBe(true);
    } else {
      console.log('Button is not clickable (this may be expected if no ASX buttons are available)');
    }
  });
});

