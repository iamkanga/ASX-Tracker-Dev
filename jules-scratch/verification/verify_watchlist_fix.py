import asyncio
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Capture console logs
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    try:
        # 1. Navigate to the app
        page.goto("http://localhost:8000/index.html")

        # 2. Sign in
        expect(page.locator("#splashSignInBtn")).to_be_visible(timeout=10000)
        page.click("#splashSignInBtn")

        # Take a screenshot before waiting for the element
        page.screenshot(path="jules-scratch/verification/debug_screenshot.png")
        print("Took debug screenshot.")

        # Wait for sign-in to complete by checking for a known element
        expect(page.locator("#watchlistSelect option[value='__movers']")).to_be_visible(timeout=20000)
        print("Sign-in successful.")

        # 3. Create a new watchlist
        watchlist_name = "Test-Watchlist-No-Dup"
        page.click("#addWatchlistBtn")
        expect(page.locator("#addWatchlistModal")).to_be_visible()
        page.fill("#newWatchlistName", watchlist_name)
        page.click("#saveWatchlistBtn")
        print(f"Created watchlist: {watchlist_name}")

        # Wait for the new watchlist to appear in the select dropdown
        expect(page.locator(f"#watchlistSelect option:has-text('{watchlist_name}')")).to_be_visible(timeout=10000)

        # 4. Reload the page
        page.reload()
        print("Page reloaded.")

        # Wait for the app to load after reload
        expect(page.locator("#watchlistSelect option[value='__movers']")).to_be_visible(timeout=20000)
        print("App loaded after reload.")

        # 5. Verify the new watchlist is not duplicated
        watchlist_options = page.locator(f"#watchlistSelect option:has-text('{watchlist_name}')")
        count = watchlist_options.count()
        print(f"Found '{watchlist_name}' {count} time(s).")
        expect(watchlist_options).to_have_count(1, timeout=5000)
        print("Verification successful: Watchlist is not duplicated.")

        # 6. Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken.")

    finally:
        # 7. Check for console errors
        if console_errors:
            print("\nConsole Errors:")
            for error in console_errors:
                print(error)
            # Optionally, you could raise an exception here to fail the test
            # raise Exception("Console errors found during test execution.")

        browser.close()

with sync_playwright() as playwright:
    run(playwright)
