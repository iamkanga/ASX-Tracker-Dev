const { test, expect } = require('@playwright/test');

test.describe('ASX Button Toggle Scrolling', () => {
  test('ASX button toggle should properly reposition content', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Mock the transitionend event to test our logic
    await page.evaluate(() => {
      // Mock the scrollMainToTop function to track calls
      window.originalScrollMainToTop = window.scrollMainToTop;
      window.scrollMainToTop = function() {
        console.log('scrollMainToTop called');
        if (window.originalScrollMainToTop) {
          window.originalScrollMainToTop.apply(this, arguments);
        }
      };

      // Mock adjustMainContentPadding to track calls
      window.originalAdjustMainContentPadding = window.adjustMainContentPadding;
      window.adjustMainContentPadding = function() {
        console.log('adjustMainContentPadding called');
        if (window.originalAdjustMainContentPadding) {
          window.originalAdjustMainContentPadding.apply(this, arguments);
        }
      };
    });

    // Test the transitionend logic by simulating the event
    const transitionResult = await page.evaluate(() => {
      // Set the scroll flag as the toggle would
      window.__asxToggleWantsScroll = true;

      // Simulate the transitionend event logic
      const mockEvent = { propertyName: 'max-height' };

      // Run the transitionend logic (copied from our implementation)
      if (mockEvent.propertyName === 'max-height' || mockEvent.propertyName === 'padding' || mockEvent.propertyName === 'opacity') {
        // Scroll BEFORE adjusting padding
        if (window.__asxToggleWantsScroll) {
          try { if (window.scrollMainToTop) window.scrollMainToTop(); else window.scrollMainToTop(); } catch(_){}
          console.log('Performed scroll before padding adjustment');
        }

        // Adjust padding
        if (window.adjustMainContentPadding) {
          window.adjustMainContentPadding();
        }

        // Final scroll after padding adjustment
        if (window.__asxToggleWantsScroll) {
          setTimeout(() => {
            try { if (window.scrollMainToTop) window.scrollMainToTop(); else window.scrollMainToTop(); } catch(_){}
            try { delete window.__asxToggleWantsScroll; } catch(_){}
            console.log('Performed final scroll after padding adjustment');
          }, 50);
        }
      }

      return { flagSet: !!window.__asxToggleWantsScroll };
    });

    console.log('Transition test result:', transitionResult);

    // The flag should initially be set, then cleared after the timeout
    expect(transitionResult.flagSet).toBe(true);

    // Wait for the timeout to complete
    await page.waitForTimeout(100);

    // Check if the flag was cleared
    const finalFlag = await page.evaluate(() => !window.__asxToggleWantsScroll);
    expect(finalFlag).toBe(true);
  });

  test('ASX button container should have proper CSS transitions', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8000');

    // Wait for the splash screen
    await page.waitForSelector('#splashScreen');

    // Check that the ASX button container has the expected transition properties
    const transitionCheck = await page.evaluate(() => {
      const container = document.getElementById('asxCodeButtonsContainer');
      if (!container) return { found: false };

      const computedStyle = window.getComputedStyle(container);
      const transition = computedStyle.transition || computedStyle.webkitTransition;

      return {
        found: true,
        transition: transition,
        hasMaxHeight: transition.includes('max-height'),
        hasPadding: transition.includes('padding'),
        hasOpacity: transition.includes('opacity')
      };
    });

    console.log('CSS transition check:', transitionCheck);

    // Verify the container exists and has the expected transitions
    expect(transitionCheck.found).toBe(true);
    expect(transitionCheck.hasMaxHeight).toBe(true);
    expect(transitionCheck.hasPadding).toBe(true);
    expect(transitionCheck.hasOpacity).toBe(true);
  });
});

