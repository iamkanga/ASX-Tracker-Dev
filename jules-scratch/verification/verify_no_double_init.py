import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Capture console messages
    messages = []
    page.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the index.html file via localhost
    page.goto("http://localhost:8080/index.html")

    # Wait for the splash screen to disappear, which indicates app initialization is likely complete
    # I'll increase the timeout just in case the server is slow to start
    try:
        splash_screen = page.locator("#splashScreen")
        # The splash screen will not disappear without login, so I will just wait for a fixed time
        page.wait_for_timeout(5000)
    except Exception as e:
        print(f"Timeout waiting for splash screen, which is expected without login: {e}")
        # Continue anyway, the console log check is the most important part

    # Check for duplicate Firebase initialization messages
    init_messages = [msg for msg in messages if "Firebase: Initialized successfully" in msg]

    print(f"Found {len(init_messages)} Firebase initialization messages.")
    for msg in messages:
        print(f"- {msg}")

    assert len(init_messages) == 1, f"Expected 1 Firebase init message, but found {len(init_messages)}"

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/no-double-init.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
