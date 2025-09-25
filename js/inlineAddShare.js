// Inline Add/Edit Share: dock the existing modal content into the page flow on mobile when enabled.
// Reuses the exact markup and classes from #shareFormSection so visuals and behavior match the modal.
// No sticky header; the header scrolls naturally with the page.

(function(){
  const MOBILE_MAX = 860;
  const hostId = 'inlineShareFormHost';
  let openState = { open:false, placeholder:null, node:null, originalParent:null };
  const STORAGE_KEYS = ['flag:inlineShareForm','flag:inlineShareFormFinal']; // prefer first; keep compat

  function getFlag(){
    if (typeof window.__inlineShareForm === 'boolean') return window.__inlineShareForm;
    if (typeof window.__inlineShareFormEnabled === 'boolean') return window.__inlineShareFormEnabled;
    // fallback from storage
    for (const k of STORAGE_KEYS) { try { const v = localStorage.getItem(k); if (v === '1' || v === '0') return v === '1'; } catch(_){} }
    return false;
  }
  function setFlag(v){
    window.__inlineShareForm = !!v;
    window.__inlineShareFormEnabled = !!v; // mirror for safety
    try { localStorage.setItem(STORAGE_KEYS[0], v ? '1':'0'); } catch(_){ }
  }
  function isEnabled(){
    return !!getFlag() && window.matchMedia && window.matchMedia('(max-width: '+MOBILE_MAX+'px)').matches;
  }
  function ensureHost(){ return document.getElementById(hostId); }

  function getModal(){ return document.getElementById('shareFormSection'); }

  function dockInline(){
    if(openState.open) return true;
    const host = ensureHost(); if(!host) return false;
    const modal = getModal(); if(!modal) return false;
    // Create a placeholder to restore original position on close
    const placeholder = document.createComment('inline-share-dock');
    const parent = modal.parentNode;
    if (!parent) return false;
    parent.insertBefore(placeholder, modal);
    // Prepare modal element for inline flow
    try {
      modal.classList.remove('modal'); // remove fixed overlay style
      modal.classList.add('inline-docked');
      modal.style.display = '';
      modal.style.position = '';
      modal.style.left = '';
      modal.style.top = '';
      modal.style.width = '';
      modal.style.height = '';
      modal.style.padding = '';
    } catch(_){ }
    // Mount entire modal container into host so descendant selectors (#shareFormSection ...) still apply
    host.innerHTML = '';
    host.appendChild(modal);
    openState.open = true;
    openState.placeholder = placeholder;
    openState.node = modal;
    openState.originalParent = parent;
    document.body.classList.add('inline-share-form-open');
    // Initialize accordion if needed
    try {
      const root = document.getElementById('shareFormAccordion');
      if (root && (!root.dataset.accordionInit || root.dataset.accordionInit === 'false')) {
        if (typeof window.initShareFormAccordion === 'function') window.initShareFormAccordion(true);
      }
    } catch(_){ }
    // Focus first input
    requestAnimationFrame(()=>{
      const field = document.getElementById('shareName');
      if(field) { try { field.focus({ preventScroll:true }); } catch(_) { field.focus(); } }
    });
    // Back stack (optional)
    try { if(typeof window.__appBackStackPush === 'function') window.__appBackStackPush('inlineShareForm', host); } catch(_) {}
    return true;
  }

  function undockInline(){
    if(!openState.open) return;
    const modal = openState.node || getModal();
    if (modal && openState.placeholder && openState.originalParent) {
      // Restore class and position, move element back
      try { modal.classList.remove('inline-docked'); modal.classList.add('modal'); } catch(_){}
      try { openState.originalParent.insertBefore(modal, openState.placeholder); } catch(_){}
      try { openState.placeholder.remove(); } catch(_){}
    }
    try { document.body.classList.remove('inline-share-form-open'); } catch(_){ }
    const host = ensureHost(); if(host) host.innerHTML = '';
    openState.open = false;
    openState.placeholder = null;
    openState.node = null;
    openState.originalParent = null;
    try { if(typeof window.__appBackStackPop === 'function') window.__appBackStackPop('inlineShareForm'); } catch(_){ }
  }

  function openInline(){
    if(!isEnabled()) return false;
    return dockInline();
  }
  function closeInline(){ undockInline(); }

  // Expose helpers
  window.__openInlineShareForm = openInline;
  window.__closeInlineShareForm = closeInline;
  window.__isInlineShareFormOpen = () => openState.open;

  function maybeIntercept(e){
    if(!isEnabled()) return false;
    const opened = openInline();
    if(opened){
      if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation(); else if (e.stopPropagation) e.stopPropagation();
      }
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
        if(maybeIntercept(e)) return; // inline consumed; do not fall back to modal
      }, true); // capture early
      btn.__inlineWired = true;
    });
    // Let the default close handler run (it calls clearForm/closeModals), then undock inline
    document.addEventListener('click', (e)=>{
      const closeEl = e.target && e.target.closest && e.target.closest('#shareFormSection .form-close-button');
      if (closeEl && openState.open) {
        // Do not block the event; schedule undock after handler runs
        setTimeout(()=>{ try { closeInline(); } catch(_) {} }, 0);
      }
    }, false);
  }

  // React to sidebar toggle
  function installFlagObserver(){
    const inlineToggle = document.getElementById('inlineFormToggle');
    if(inlineToggle && !inlineToggle.__inlineHook){
      // init from storage if present
      try {
        for (const k of STORAGE_KEYS) { const v = localStorage.getItem(k); if (v === '1' || v === '0') { inlineToggle.checked = v === '1'; break; } }
      } catch(_){}
      setFlag(!!inlineToggle.checked);
      inlineToggle.addEventListener('change', ()=>{
        setFlag(!!inlineToggle.checked);
        if(!inlineToggle.checked && openState.open) closeInline();
      });
      inlineToggle.__inlineHook = true;
    } else if(!inlineToggle) {
      // derive from storage
      setFlag(getFlag());
    }
  }

  function init(){
    installFlagObserver();
    wireTriggers();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
