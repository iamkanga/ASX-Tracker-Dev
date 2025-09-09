const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const fileUrl = 'file://' + indexPath;
  const outPath = path.resolve(__dirname, '..', 'modal-screenshot.png');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });

    // Wait briefly for scripts to initialize
    await page.waitForTimeout(1000);

    // Force open the Cash Asset modal by manipulating DOM
    await page.evaluate(() => {
      try {
        const modal = document.getElementById('cashAssetFormModal');
        if (!modal) return;
        modal.style.display = 'block';
        const content = modal.querySelector('.modal-content');
        if (content) {
          // center modal and make sure it's visible
          content.style.margin = '5% auto';
        }
        // If the app uses aria-hidden or classes to manage visibility, try removing app-hidden
        modal.classList.remove('app-hidden');
      } catch (e) {
        // ignore
      }
    });

    // Wait for the modal content to appear
    await page.waitForSelector('#cashAssetFormModal .modal-content', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Screenshot just the modal content
    const modalHandle = await page.$('#cashAssetFormModal .modal-content');
    if (!modalHandle) {
      console.error('Modal content not found');
      await browser.close();
      process.exit(2);
    }

    await modalHandle.screenshot({ path: outPath });
    console.log('SCREENSHOT_SAVED:' + outPath);
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e);
    try { await browser.close(); } catch(_){}
    process.exit(3);
  }
})();
