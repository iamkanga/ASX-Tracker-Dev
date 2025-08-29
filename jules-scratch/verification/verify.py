import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # List to store console messages
        console_messages = []
        page.on("console", lambda msg: console_messages.append(msg.text))

        # 1. Navigate to the local server
        await page.goto("http://localhost:8080/index.html")

        # 2. Wait for the splash screen to be visible and take a screenshot
        splash_screen = page.locator("#splashScreen")
        await expect(splash_screen).to_be_visible(timeout=10000)
        await page.screenshot(path="jules-scratch/verification/01_splash_screen.png")

        # 3. Check for the "Sign in with Google" button
        sign_in_button = page.locator("#splashSignInBtn")
        await expect(sign_in_button).to_be_visible()
        await expect(sign_in_button).to_have_text("Sign in with Google")

        # 4. Click the sign-in button and wait for the popup
        popup = None
        try:
            async with page.expect_popup() as popup_info:
                await sign_in_button.click()
            popup = await popup_info.value
            await popup.wait_for_load_state()
        except Exception as e:
            print(f"Error handling popup: {e}")
            await page.screenshot(path="jules-scratch/verification/03_popup_error.png")

        # 5. Verify the popup is as expected
        if popup:
            await expect(popup).to_have_title("Sign in - Google Accounts")
            await page.screenshot(path="jules-scratch/verification/02_signin_popup.png")
            await popup.close()
        else:
            print("Popup did not appear as expected.")
            # If the popup didn't appear, fail the test
            raise Exception("Sign-in popup did not appear.")

        # 6. Verify the console logs for single initialization
        diag_log = "[Diag] Overlay singleton check executed. Build marker present."
        count = console_messages.count(diag_log)

        print(f"'{diag_log}' was logged {count} time(s).")

        if count != 1:
            raise Exception(f"Expected diagnostic message to be logged once, but it was logged {count} times.")

        print("Verification successful: Initialization message found once, and sign-in popup appeared.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
