from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Set a mobile viewport
    page = browser.new_page(viewport={'width': 375, 'height': 667})

    # Go to the app and wait for the network to be idle
    page.goto("http://localhost:5501", wait_until="networkidle")

    # Use evaluate to remove the splash screen and show the main app
    page.evaluate("() => { \
        const splash = document.getElementById('splashScreen'); \
        if (splash) splash.remove(); \
        const header = document.getElementById('appHeader'); \
        if (header) header.classList.remove('app-hidden'); \
        const main = document.querySelector('main.container'); \
        if (main) main.classList.remove('app-hidden'); \
        document.body.style.overflow = 'auto'; \
    }")

    # Now that the splash screen is gone and the main app is visible,
    # let's wait for a known element in the main app to be visible.
    expect(page.locator("#appHeader")).to_be_visible(timeout=10000)

    # Open the sidebar
    page.locator("#hamburgerBtn").click()
    page.wait_for_timeout(500) # wait for sidebar to open

    # Hide the sidebar overlay
    page.evaluate("() => { \
        const overlay = document.querySelector('.sidebar-overlay'); \
        if (overlay) { \
            overlay.style.display = 'none'; \
        } \
    }")

    # Test Standard Calculator
    # Click the button to open the standard calculator
    page.locator("#standardCalcBtn").click(force=True)
    # Expect the calculator modal to be visible
    expect(page.locator("#calculatorModal")).to_be_visible()
    # Perform a simple calculation: 1 + 2 = 3
    page.get_by_role("button", name="1", exact=True).click()
    page.get_by_role("button", name="+", exact=True).click()
    page.get_by_role("button", name="2", exact=True).click()
    page.get_by_role("button", name="=", exact=True).click()
    # Expect the result to be 3
    expect(page.locator("#calculatorResult")).to_have_text("3")
    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/standard_calculator.png")
    # Close the calculator
    page.locator("#calculatorModal .calc-close-button").click()
    # Expect the modal to be hidden
    expect(page.locator("#calculatorModal")).not_to_be_visible()

    # Test Dividend Calculator
    # Click the button to open the dividend calculator
    page.locator("#dividendCalcBtn").click(force=True)
    # Expect the dividend calculator modal to be visible
    expect(page.locator("#dividendCalculatorModal")).to_be_visible()
    # Fill in the form
    page.locator("#calcCurrentPrice").fill("100")
    page.locator("#calcDividendAmount").fill("5")
    page.locator("#calcFrankingCredits").fill("100")
    # Expect the calculated franked yield to be correct
    expect(page.locator("#calcFrankedYield")).to_have_text("7.14%")
    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/dividend_calculator.png")
    # Close the calculator
    page.locator("#dividendCalculatorModal .calc-close-button").click()
    # Expect the modal to be hidden
    expect(page.locator("#dividendCalculatorModal")).not_to_be_visible()

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
