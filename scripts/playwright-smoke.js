const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const fileUrl = 'file://' + indexPath;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Ensure app starts with Cash & Assets selected
  await page.addInitScript(() => {
    try {
      localStorage.setItem('lastWatchlistSelection', JSON.stringify('cashBank'));
    } catch (e) { /* ignore */ }
  });

  const results = { ok: true, errors: [], details: {} };
  try {
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });

    // Wait for sort button
    await page.waitForSelector('#sortPickerBtn', { timeout: 8000 });
    await page.click('#sortPickerBtn');
    await page.waitForSelector('#sortPickerList .sort-picker-row', { timeout: 8000 });

    const labels = await page.$$eval('#sortPickerList .sort-picker-row .sort-picker-label', els => els.map(e => e.textContent.trim()));
    results.details.labels = labels;

    const expectedCash = ['Asset Name (A-Z)', 'Asset Name (Z-A)', 'Balance (H-L)', 'Balance (L-H)'];
    const missing = expectedCash.filter(x => !labels.includes(x));
    if (missing.length) {
      results.ok = false;
      results.errors.push('Cash options missing: ' + missing.join(', '));
    }

    // Check alphabetical arrow characters for first two label rows if present
    const rows = await page.$$('#sortPickerList .sort-picker-row');
    const alphaChecks = [];
    for (const row of rows) {
      const label = await row.$eval('.sort-picker-label', n => n.textContent.trim()).catch(()=>null);
      if (!label) continue;
      if (label.includes('A-Z') || label.includes('Z-A') || label.toLowerCase().includes('code') || label.toLowerCase().includes('asset name')) {
        const tri = await row.$eval('.sort-picker-direction span', n => ({ char: n.textContent.trim(), cls: n.className })).catch(()=>null);
        if (tri) {
          alphaChecks.push({ label, tri });
        }
      }
    }
    results.details.alpha = alphaChecks;

    // Click second option (if exists) to change sort and then reopen to test highlight
    if (rows.length >= 2) {
      const secondLabel = await rows[1].$eval('.sort-picker-label', n => n.textContent.trim());
      await rows[1].click();
      // Reopen
      await page.waitForTimeout(300);
      await page.click('#sortPickerBtn');
      await page.waitForSelector('#sortPickerList .sort-picker-row', { timeout: 5000 });
      const activeLabel = await page.$eval('#sortPickerList .sort-picker-row.active .sort-picker-label', n => n.textContent.trim()).catch(()=>null);
      results.details.clicked = { clicked: secondLabel, activeAfterReopen: activeLabel };
      if (activeLabel !== secondLabel) {
        results.ok = false;
        results.errors.push('Selection highlight did not match clicked option: ' + JSON.stringify(results.details.clicked));
      }
    } else {
      results.details.clickTest = 'not enough rows to test click highlight';
    }

  } catch (e) {
    results.ok = false;
    results.errors.push('Exception during smoke test: ' + String(e));
  } finally {
    await browser.close();
    console.log('SMOKE_RESULT:' + JSON.stringify(results, null, 2));
    process.exit(results.ok ? 0 : 2);
  }
})();
