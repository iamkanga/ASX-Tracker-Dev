from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5501?test=true")
    page.screenshot(path="jules-scratch/verification/page_load.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
