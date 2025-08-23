import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Get the absolute path to the HTML file
        html_file_path = os.path.abspath('index.html')

        # Navigate to the local HTML file
        await page.goto(f'file://{html_file_path}')

        # The header is now visible by default, so we can just wait for it.
        header = page.locator('#appHeader')
        await header.wait_for(state='visible', timeout=10000)

        # Take a screenshot of just the header
        await header.screenshot(path='jules-scratch/verification/header_alignment.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
