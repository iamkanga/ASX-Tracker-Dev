from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=False) # Run in headed mode
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5500")
        page.wait_for_timeout(5000) # Wait for 5 seconds to see the browser
        page.screenshot(path="jules-scratch/verification/headed_mode.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
