import asyncio
from playwright.async_api import async_playwright
import os
import http.server
import socketserver
import threading

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=".", **kwargs)

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"serving at port {PORT}")
        httpd.serve_forever()

def handle_console_message(msg):
    print(f"Browser console: {msg.text}")

async def main():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()

    # Give the server a moment to start
    await asyncio.sleep(1)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen for console events and print them
        page.on("console", handle_console_message)

        # Navigate to the local server
        await page.goto(f'http://localhost:{PORT}/index.html')

        # Wait for the page to be fully loaded to prevent race conditions
        await page.wait_for_load_state('load')

        # Wait for firebase to be ready
        await page.wait_for_function('window._firebaseInitialized')

        # Wait for initializeAppLogic to be defined
        await page.wait_for_function('typeof window.initializeAppLogic === "function"')

        # Simulate user authentication and initialize the app
        await page.evaluate('''() => {
            window.currentUserId = 'test-user';
            window.db = window.firestoreDb;
            window.auth = window.firebaseAuth;
            window.currentAppId = window.getFirebaseAppId();
            window.initializeAppLogic();
            window._appLogicInitialized = true;
        }''')

        # Inject a dummy 52-week low alert to make the icon visible
        await page.evaluate('''() => {
            window.sharesAt52WeekLow = [{
                code: 'CBA',
                name: 'Commonwealth Bank (Test Card)',
                type: 'low',
                low52: 90.00,
                high52: 120.00,
                live: 91.23,
                isTestCard: true,
                muted: false
            }];
            window.updateTargetHitBanner();
        }''')

        # Wait for the target hit icon to be visible
        target_hit_icon = page.locator('#targetHitIconBtn')
        await target_hit_icon.wait_for(state='visible')

        # Click the target hit icon to open the modal
        await target_hit_icon.click()

        # Add a small delay to handle potential flickering
        await page.wait_for_timeout(500)

        # Wait for the modal to be visible
        modal = page.locator('#targetHitDetailsModal')
        await modal.wait_for(state='visible')

        # Hide the splash screen before taking the screenshot
        await page.evaluate("() => { document.getElementById('splashScreen').style.display = 'none'; }")

        # Take a screenshot of the modal
        await modal.screenshot(path='jules-scratch/verification/verification.png')

        await browser.close()

    # The server thread is a daemon, so it will exit when the main thread exits.
    # No need to explicitly stop it.

if __name__ == "__main__":
    asyncio.run(main())
