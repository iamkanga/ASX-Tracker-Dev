const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const fileUrl = 'file://' + indexPath;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.evaluate(() => {
      // Hide splash screen or any overlay that may block clicks in the headless run
      try { const splash = document.getElementById('splashScreen'); if (splash) { splash.style.display = 'none'; } } catch(_) {}
      const modal = document.getElementById('cashAssetFormModal');
      if (modal) {
        modal.style.display = 'block';
        modal.classList.remove('app-hidden');
        const content = modal.querySelector('.modal-content');
        if (content) content.style.margin = '5% auto';
      }
    });
    await page.waitForTimeout(200);
    // Click add button to add a comment via UI
    const addBtn = await page.$('#cashAssetFormModal #addCashAssetCommentBtn');
    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(250);
    }

    // Take screenshot after adding
    const modalHandle = await page.$('#cashAssetFormModal .modal-content');
    if (modalHandle) await modalHandle.screenshot({ path: path.resolve(__dirname, '..', 'modal-after-add.png') });

    // Dump computed styles for first comment
    const out = await page.evaluate(() => {
      function pickComputed(el, props) {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const res = { tag: el.tagName, id: el.id || null, classList: Array.from(el.classList || []), inlineStyle: el.getAttribute('style') || null };
        (props||[]).forEach(p => { try { res[p] = cs.getPropertyValue(p); } catch(e) { res[p] = null; } });
        try { const r = el.getBoundingClientRect(); res.rect = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; } catch(_) { res.rect = null; }
        res.innerHTML = el.innerHTML ? el.innerHTML.slice(0, 800) : null;
        return res;
      }
      const props = ['display','visibility','opacity','margin-left','padding-left','left','right','top','width','font-size','background-color','border','box-shadow','justify-content','align-items','flex','flex-basis'];
      const result = {};
      result.commentSection = pickComputed(document.querySelector('#cashAssetFormModal .comment-section'), props);
      result.commentTop = pickComputed(document.querySelector('#cashAssetFormModal .comment-section-top'), props);
      result.titleInput = pickComputed(document.querySelector('#cashAssetFormModal .comment-section-top .comment-title-input'), props);
      result.deleteBtn = pickComputed(document.querySelector('#cashAssetFormModal .comment-section-top .comment-delete-btn'), props);
      result.commentsTitleContainer = pickComputed(document.querySelector('#cashAssetFormModal .comments-title-container'), props);
      result.addButton = pickComputed(document.querySelector('#cashAssetFormModal #addCashAssetCommentBtn'), props);
      return result;
    });

    fs.writeFileSync(path.resolve(__dirname, '..', 'modal-after-add.json'), JSON.stringify(out, null, 2));
    console.log('SCREENSHOT_SAVED:', path.resolve(__dirname, '..', 'modal-after-add.png'));
    console.log('JSON_SAVED:', path.resolve(__dirname, '..', 'modal-after-add.json'));
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e);
    try { await browser.close(); } catch(_) {}
    process.exit(2);
  }
})();
