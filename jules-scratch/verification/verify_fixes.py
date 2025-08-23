import asyncio
from playwright.async_api import async_playwright
import os
import http.server
import socketserver
import multiprocessing

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
    # Start the server in a separate process
    server_process = multiprocessing.Process(target=run_server)
    server_process.start()
    await asyncio.sleep(1)

    browser = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            # Add an initialization script to capture the auth handler
            await page.add_init_script('''
                window.capturedAuthHandler = null;
                Object.defineProperty(window, 'authFunctions', {
                    configurable: true,
                    get() {
                        return this._authFunctions;
                    },
                    set(value) {
                        if (value && value.onAuthStateChanged) {
                            const realOnAuthStateChanged = value.onAuthStateChanged;
                            value.onAuthStateChanged = (auth, handler) => {
                                window.capturedAuthHandler = handler;
                            };
                        }
                        this._authFunctions = value;
                    }
                });
            ''')

            # Listen for console events and print them
            page.on("console", handle_console_message)

            # Navigate to the local server
            await page.goto(f'http://localhost:{PORT}/index.html')

            # Wait for the handler to be captured
            await page.wait_for_function('window.capturedAuthHandler != null')

            # Now, manually trigger the authentication state change with a mock user
            await page.evaluate('''() => {
                const mockUser = { uid: 'test-user-id', email: 'test@example.com' };
                window.capturedAuthHandler(mockUser);
            }''')

            # Add a dummy share to the watchlist to make the ASX buttons appear
            await page.evaluate('''() => {
                window.allSharesData = [{id: '1', shareName: 'BHP', starRating: 3, watchlistIds: ['all_shares_option']}];
                if (typeof window.renderWatchlist === 'function') {
                    window.renderWatchlist();
                }
            }''')

            # Wait for the main content to be visible after initialization
            await page.wait_for_selector('main.container:not(.app-hidden)')

            # Hide the splash screen before taking the screenshot
            await page.evaluate("() => { document.getElementById('splashScreen').style.display = 'none'; }")

            # Check if the sort select and toggle button are in the DOM
            sort_select_visible = await page.is_visible("#sortSelect")
            print(f"Sort select visible: {sort_select_visible}")
            toggle_btn_visible = await page.is_visible("#toggleAsxButtonsBtn")
            print(f"Toggle button visible: {toggle_btn_visible}")

            # Take a screenshot of the page
            await page.screenshot(path='jules-scratch/verification/verification.png')

    finally:
        if browser:
            await browser.close()
        server_process.terminate()
        server_process.join()


if __name__ == "__main__":
    asyncio.run(main())
