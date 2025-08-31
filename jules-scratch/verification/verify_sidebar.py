from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # 1. Navigate to the application.
    page.goto("http://localhost:5500")

    # Wait for the main container to be visible
    main_container = page.locator("main.container")
    expect(main_container).to_be_visible()

    # 2. Click the hamburger menu button to open the sidebar.
    hamburger_button = page.locator("#hamburgerBtn")
    expect(hamburger_button).to_be_visible()
    hamburger_button.click()

    # Wait for the sidebar to be visible
    sidebar = page.locator("#appSidebar")
    expect(sidebar).to_be_visible()

    # 3. Take a screenshot of the page with the sidebar open.
    page.screenshot(path="jules-scratch/verification/sidebar_open.png")

    # 4. Click the "Close" button inside the sidebar.
    close_button = page.locator("#closeMenuBtn")
    expect(close_button).to_be_visible()
    close_button.click()

    # Wait for the sidebar to be hidden
    expect(sidebar).to_be_hidden()

    # 5. Take another screenshot to confirm the sidebar is closed.
    page.screenshot(path="jules-scratch/verification/sidebar_closed.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
