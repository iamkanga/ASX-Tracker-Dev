from playwright.sync_api import sync_playwright, expect
import re
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5500")

        # Wait for the splash screen to be visible
        splash_screen = page.locator("#splashScreen")
        expect(splash_screen).to_be_visible()

        # Click the sign-in button
        with context.expect_page() as new_page_info:
            page.get_by_role("button", name="Sign in with Google").click()

        popup = new_page_info.value
        popup.wait_for_load_state()

        # Wait for the body to be present and add a small delay
        popup.wait_for_selector('body')
        time.sleep(2) # 2 second delay

        # I don't have the user's credentials, so I can't complete the login.
        # I will take a screenshot of the popup to see if it renders correctly now.
        popup.screenshot(path="jules-scratch/verification/login_popup_after_wait.png")
        print(f"Popup URL: {popup.url}")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
