const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const fileUrl = 'file://' + indexPath;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(fileUrl, { waitUntil: 'load' });
    // Ensure modal is visible
    await page.evaluate(() => {
      try {
        const modal = document.getElementById('cashAssetFormModal');
        if (modal) {
          modal.style.display = 'block';
          modal.classList.remove('app-hidden');
          const content = modal.querySelector('.modal-content');
          if (content) content.style.margin = '5% auto';
        }
      } catch (e) {}
    });
    await page.waitForTimeout(250);

    const out = await page.evaluate(() => {
      function pickComputed(el, props) {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const res = { tag: el.tagName, id: el.id || null, classList: Array.from(el.classList || []), inlineStyle: el.getAttribute('style') || null };
        props.forEach(p => { try { res[p] = cs.getPropertyValue(p); } catch(e) { res[p] = null; } });
        try { const r = el.getBoundingClientRect(); res.rect = { x: r.x, y: r.y, width: r.width, height: r.height }; } catch(_) { res.rect = null; }
        res.innerHTML = el.innerHTML ? el.innerHTML.slice(0, 400) : null;
        return res;
      }
      const props = ['display','visibility','opacity','margin-left','padding-left','left','right','top','width','font-size','background-color','border','box-shadow','justify-content','align-items','flex','flex-basis'];
      const result = {};
      result.commentsTitleContainer = pickComputed(document.querySelector('#cashAssetFormModal .comments-title-container'), props);
      result.addButton = pickComputed(document.querySelector('#cashAssetFormModal #addCashAssetCommentBtn'), props);
      result.addButtonIcon = pickComputed(document.querySelector('#cashAssetFormModal #addCashAssetCommentBtn i'), props);
      result.commentsArea = pickComputed(document.querySelector('#cashAssetFormModal .comments-area'), props);
      result.firstComment = pickComputed(document.querySelector('#cashAssetFormModal .comment-section'), props);
      result.firstCommentTop = pickComputed(document.querySelector('#cashAssetFormModal .comment-section-top'), props);
      result.firstCommentTitleInput = pickComputed(document.querySelector('#cashAssetFormModal .comment-section-top .comment-title-input'), props);
      result.firstCommentDeleteBtn = pickComputed(document.querySelector('#cashAssetFormModal .comment-section-top .comment-delete-btn'), props);
      // also capture computed style of modal-content and modal header
      result.modalContent = pickComputed(document.querySelector('#cashAssetFormModal .modal-content'), props);
      result.cashFormTitle = pickComputed(document.querySelector('#cashAssetFormModal #cashFormTitle'), props);
      result.rawHtmlSample = document.querySelector('#cashAssetFormModal') ? document.querySelector('#cashAssetFormModal').innerHTML.slice(0,2000) : null;
      return result;
    });
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e);
    try { await browser.close(); } catch(_) {}
    process.exit(2);
  }
})();
