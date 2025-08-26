import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')

        # Go to the local file
        await page.goto(f'file://{file_path}')

        # Wait for the page to be fully loaded
        await page.wait_for_load_state('networkidle')

        # Forcefully remove the splash screen and show the main content
        await page.evaluate("document.getElementById('splashScreen').remove()")
        await page.evaluate("document.querySelector('main.container').classList.remove('app-hidden')")
        await page.evaluate("document.getElementById('appHeader').classList.remove('app-hidden')")

        # Call the function to show the portfolio view
        await page.evaluate("window.showPortfolioView && window.showPortfolioView()")

        # Wait for the portfolio cards to be rendered
        await page.wait_for_selector('.portfolio-card', state='visible', timeout=5000)

        # Add a small delay to ensure rendering after DOM manipulation
        await page.wait_for_timeout(500)

        # Take a screenshot
        await page.screenshot(path='jules-scratch/verification/verification.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
