import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')

        # Navigate to the local HTML file
        await page.goto(f'file://{file_path}')

        # Wait for the target hit icon to be visible
        target_hit_icon = page.locator('#targetHitIconBtn')
        await target_hit_icon.wait_for(state='visible')

        # Click the target hit icon to open the modal
        await target_hit_icon.click()

        # Wait for the modal to be visible
        modal = page.locator('#targetHitDetailsModal')
        await modal.wait_for(state='visible')

        # Take a screenshot of the modal
        await modal.screenshot(path='jules-scratch/verification/verification.png')

        await browser.close()

asyncio.run(main())
