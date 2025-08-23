import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:8000', wait_until='domcontentloaded')

        # Manually hide the splash screen and show the main app
        await page.evaluate("""
            document.getElementById('splashScreen').style.display = 'none';
            document.querySelector('main.container').classList.remove('app-hidden');
            document.getElementById('appHeader').classList.remove('app-hidden');
        """)

        print("Calling loadUserWatchlistsAndSettings")
        await page.evaluate('window.loadUserWatchlistsAndSettings()')
        print("Calling loadUserPreferences")
        await page.evaluate('window.loadUserPreferences()')
        print("Calling restoreViewAndModeFromPreferences")
        await page.evaluate('window.restoreViewAndModeFromPreferences()')
        print("Calling loadTriggeredAlertsListener")
        await page.evaluate('window.loadTriggeredAlertsListener()')
        print("Calling startGlobalSummaryListener")
        await page.evaluate('window.startGlobalSummaryListener()')
        print("Calling fetchLivePrices")
        await page.evaluate('window.fetchLivePrices()')
        print("Calling startLivePriceUpdates")
        await page.evaluate('window.startLivePriceUpdates()')
        print("Calling loadAsxCodesFromCSV")
        await page.evaluate('window.loadAsxCodesFromCSV()')
        print("Calling initializeAppLogic")
        await page.evaluate('window.initializeAppLogic()')

        # Wait for a long time to see if the app loads
        await page.wait_for_timeout(10000)

        await page.screenshot(path='screenshot.png')
        await browser.close()

asyncio.run(main())
