from playwright.sync_api import sync_playwright, expect
import re
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5500")

        # Wait for the jules_test variable to be defined on the window object
        page.wait_for_function("window.jules_test")

        print("Successfully found window.jules_test variable.")
        page.screenshot(path="jules-scratch/verification/jules_test_verified.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/jules_test_error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
