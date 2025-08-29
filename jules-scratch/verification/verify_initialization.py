from playwright.sync_api import sync_playwright, expect
import re
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Flag to count the number of times the message is logged
    init_count = 0

    def handle_console(msg):
        nonlocal init_count
        print(f"PAGE LOG: {msg.text}")
        if "Firebase: Initialized successfully" in msg.text:
            init_count += 1

    page.on("console", handle_console)

    try:
        page.goto("http://localhost:5500")

        # Wait for the splash screen to be visible
        splash_screen = page.locator("#splashScreen")
        expect(splash_screen).to_be_visible()

        # Wait for a while to let the app initialize
        time.sleep(5)

        if init_count != 1:
            raise Exception(f"Firebase initialized {init_count} times, expected 1.")

        print("Successfully verified that Firebase is initialized only once.")
        page.screenshot(path="jules-scratch/verification/initialization_verified.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/initialization_error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
