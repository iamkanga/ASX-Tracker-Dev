from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:8000", wait_until="load")

    # Wait for the renderWatchlist function to be available
    page.wait_for_function('window.renderWatchlist')

    # Manually trigger the render function
    page.evaluate('window.renderWatchlist()')

    # Add a short delay to allow rendering to complete
    time.sleep(1)

    # Take a screenshot of the entire page
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
