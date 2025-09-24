// Inline Add Share Form (mobile, non-sticky) integration
// Activated when window.__inlineShareFormEnabled === true AND viewport <= 860px
// Relies on host element: #inlineShareFormHost added to index.html

(function(){
  const MOBILE_MAX = 860;
  const hostId = 'inlineShareFormHost';
  let openState = { open:false, baselineScroll:0 };
  const STORAGE_KEY = 'flag:inlineShareFormFinal';

  function isEnabled(){
    return !!window.__inlineShareFormEnabled && window.matchMedia && window.matchMedia('(max-width: '+MOBILE_MAX+'px)').matches;
  }

  function ensureHost(){ return document.getElementById(hostId); }

  function buildSection(){
    const section = document.createElement('section');
    section.id = 'inlineShareFormSection';
    section.className = 'inline-share-form-panel';
    section.innerHTML = `
      <div class="inline-share-form-header">
        <div class="titles">
          <h2 id="inlineShareFormTitle">Add New Share</h2>
          <p class="company" id="inlineShareCompany">Company (auto)</p>
        </div>
        <div class="inline-share-form-actions" aria-label="Actions">
          <button type="button" class="icon-btn danger" data-inline-share="delete" title="Delete" aria-label="Delete">✕</button>
          <button type="button" class="icon-btn" data-inline-share="save" title="Save" aria-label="Save">💾</button>
          <button type="button" class="icon-btn" data-inline-share="close" title="Close" aria-label="Close">⤫</button>
        </div>
      </div>
      <div class="inline-share-form-accordion" id="inlineShareAccordion">
        ${accordionSection('core','Core Info', `
            <label for="inlineShareCode">ASX Code</label>
            <input id="inlineShareCode" type="text" placeholder="BHP" autocomplete="off" />
            <div class="input-row-inline">
                <div>
                    <label for="inlineWatchlist">Watchlist</label>
                    <input id="inlineWatchlist" type="text" placeholder="Growth"/>
                </div>
                <div>
                    <label for="inlineRating">Rating (1-5)</label>
                    <input id="inlineRating" type="number" min="0" max="5" step="1" placeholder="3" />
                </div>
            </div>
        `, true)}
        ${accordionSection('portfolio','Holdings', `
            <label for="inlineShares">Number of Shares</label>
            <input id="inlineShares" type="number" min="0" step="1" placeholder="1000" />
            <label for="inlineAvgPrice">Average Purchase Price ($)</label>
            <input id="inlineAvgPrice" type="number" min="0" step="0.01" placeholder="23.45" />
        `)}
        ${accordionSection('target','Target & Rating', `
            <label for="inlineTargetPrice">Target Price ($)</label>
            <input id="inlineTargetPrice" type="number" step="0.01" placeholder="25.50" />
            <label for="inlineIntent">Intent</label>
            <input id="inlineIntent" type="text" placeholder="Buy / Sell" />
        `)}
        ${accordionSection('dividends','Dividends', `
            <label for="inlineDivAmount">Dividend Amount (annual $)</label>
            <input id="inlineDivAmount" type="number" step="0.001" placeholder="1.250" />
            <label for="inlineFrank">Franking Credits (%)</label>
            <input id="inlineFrank" type="number" step="0.1" min="0" max="100" placeholder="70" />
        `)}
        ${accordionSection('comments','Comments', `
            <label for="inlineComment1">Comment</label>
            <input id="inlineComment1" type="text" placeholder="Observation" />
            <label for="inlineComment2">Additional</label>
            <input id="inlineComment2" type="text" placeholder="Strategy notes" />
        `)}
      </div>
      <div class="inline-share-form-footer">Scroll & focus inputs: any unexpected scroll anchoring should be eliminated.</div>
    `;
    return section;
  }

  function accordionSection(key,title,inner,open){
    return `<div class="accordion-section ${open?'open':''}" data-section="${key}">
      <button type="button" class="accordion-toggle" aria-expanded="${!!open}" aria-controls="inline-panel-${key}" id="inline-accordion-header-${key}">
        <span>${title}</span><span class="caret">▶</span>
      </button>
      <div id="inline-panel-${key}" class="accordion-panel" role="region" aria-labelledby="inline-accordion-header-${key}">${inner}</div>
    </div>`;
  }

  function initAccordion(root){
    root.addEventListener('click', e => {
      const header = e.target.closest('.accordion-toggle');
      if(!header) return;
      const section = header.closest('.accordion-section');
      if(!section) return;
      const open = section.classList.toggle('open');
      header.setAttribute('aria-expanded', open);
    });
  }

  function openInline(){
    if(!isEnabled()) return false;
    if(openState.open){
      // Scroll existing form into view instead of rebuilding
      const section = document.getElementById('inlineShareFormSection');
      if(section) section.scrollIntoView({ behavior:'smooth', block:'start' });
      return true;
    }
    const host = ensureHost(); if(!host) return false;
    openState.baselineScroll = window.scrollY || document.documentElement.scrollTop;
    const section = buildSection();
    host.appendChild(section);
    initAccordion(section.querySelector('#inlineShareAccordion'));
    openState.open = true;
    document.body.classList.add('inline-share-form-open');
    // Auto focus first input after paint
    requestAnimationFrame(()=>{
      const field = document.getElementById('inlineShareCode');
      if(field) { try { field.focus({ preventScroll:true }); } catch(_) { field.focus(); } }
    });
    // Back stack integration (best-effort)
    try { if(typeof window.__appBackStackPush === 'function') window.__appBackStackPush('inlineShareForm', section); } catch(_) {}
    return true;
  }

  function closeInline(){
    const section = document.getElementById('inlineShareFormSection');
    if(section) section.remove();
    openState.open = false;
    document.body.classList.remove('inline-share-form-open');
    try { if(typeof window.__appBackStackPop === 'function') window.__appBackStackPop('inlineShareForm'); } catch(_) {}
  }

  // Expose public helpers
  window.__openInlineShareForm = openInline;
  window.__closeInlineShareForm = closeInline;
  window.__isInlineShareFormOpen = () => openState.open;

  function maybeIntercept(e){
    if(!isEnabled()) return false;
    const opened = openInline();
    if(opened){
      e && e.preventDefault && e.preventDefault();
      e && e.stopPropagation && e.stopPropagation();
      return true;
    }
    return false;
  }

  function wireTriggers(){
    const headerBtn = document.getElementById('addShareHeaderBtn');
    const newShareBtn = document.getElementById('newShareBtn');
    [headerBtn,newShareBtn].forEach(btn=>{
      if(!btn) return;
      if(btn.__inlineWired) return;
      btn.addEventListener('click', (e)=>{
        if(maybeIntercept(e)) return; // inline consumed
        // fallback to existing modal path (do nothing here)
      }, true); // capture so we pre-empt modal
      btn.__inlineWired = true;
    });
  }

  // Global close delegation for inline form buttons
  document.addEventListener('click', (e)=>{
    const closeBtn = e.target.closest && e.target.closest('[data-inline-share="close"]');
    if(closeBtn){ e.preventDefault(); closeInline(); return; }
    const deleteBtn = e.target.closest && e.target.closest('[data-inline-share="delete"]');
    if(deleteBtn){ e.preventDefault(); closeInline(); return; } // simple; real delete logic can be wired later
    const saveBtn = e.target.closest && e.target.closest('[data-inline-share="save"]');
    if(saveBtn){ e.preventDefault(); /* integrate saveShareData later */ closeInline(); return; }
  });

  // React to flag changes via developer toggle
  function installFlagObserver(){
    const inlineToggle = document.getElementById('inlineFormToggle');
    if(inlineToggle && !inlineToggle.__inlineHook){
      // Load persisted value (if any), else use existing toggle checked state
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if(saved === '1' || saved === '0') {
          inlineToggle.checked = saved === '1';
        }
      } catch(_){}
      window.__inlineShareFormEnabled = inlineToggle.checked;
      inlineToggle.addEventListener('change', ()=>{
        window.__inlineShareFormEnabled = inlineToggle.checked;
        try { localStorage.setItem(STORAGE_KEY, inlineToggle.checked ? '1':'0'); } catch(_){}
        if(!inlineToggle.checked && openState.open) closeInline();
      });
      inlineToggle.__inlineHook = true;
    } else if(!inlineToggle) {
      // Fallback: derive from stored flag when toggle absent (unlikely) so programmatic use still works
      try { window.__inlineShareFormEnabled = localStorage.getItem(STORAGE_KEY) === '1'; } catch(_) {}
    }
  }

  function init(){
    installFlagObserver();
    wireTriggers();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
