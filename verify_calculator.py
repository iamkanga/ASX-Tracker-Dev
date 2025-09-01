import re
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        await page.goto("http://localhost:8000")

        # Wait for the network to be idle. This is the key to ensuring the app
        # is fully loaded, authenticated, and the UI is stable before we interact with it.
        await page.wait_for_load_state('networkidle', timeout=20000)

        # Now that the app is stable, the hamburger button should be visible.
        await page.click("#hamburgerBtn")

        # The sidebar is open, so now we can click the calculator button.
        await page.click("#standardCalcBtn")

        # Verify the modal appeared
        await expect(page.locator("#calculatorModal")).to_be_visible()

        # Perform the calculation: 8 * 5
        await page.click("button[data-value='8']")
        await page.click("button[data-action='multiply']")
        await page.click("button[data-value='5']")
        await page.click("button[data-action='calculate']")

        # Verify the result
        result_text = await page.locator("#calculatorResult").text_content()
        print(f"Calculator result: {result_text}")

        await expect(page.locator("#calculatorResult")).to_have_text("40")

        print("Test passed: Calculator correctly shows 40.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
