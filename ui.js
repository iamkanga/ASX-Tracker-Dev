// ui.js
// Modal and toast / alert UI helpers moved out of script.js
// Exposes APIs on window.UI and also assigns global helpers for backward compatibility.

(function() {
	// Allowed external helpers (pushAppState, logDebug) may live on window; use them if present.
	function _pushAppStateSafe(state, title, url) {
		try {
			if (window && typeof window.pushAppState === 'function') {
				window.pushAppState(state, title, url);
			}
		} catch (e) { /* ignore */ }
	}

	function _logDebugSafe(msg) {
		try {
			if (window && typeof window.logDebug === 'function') {
				window.logDebug(msg);
			}
		} catch (e) { /* ignore */ }
	}

	function showModal(modalElement) {
		if (!modalElement) return;
		try {
			_pushAppStateSafe({ modalId: modalElement.id }, '', '');
		} catch (_) {}
		try {
			modalElement.style.setProperty('display', 'flex', 'important');
			modalElement.scrollTop = 0;
			var scrollableContent = modalElement.querySelector('.modal-body-scrollable');
			if (scrollableContent) scrollableContent.scrollTop = 0;
			// Defensive: reinitialise autocomplete if host app provides it
			try {
				if (modalElement.id === 'shareFormSection' && typeof initializeShareNameAutocomplete === 'function') {
					initializeShareNameAutocomplete(true);
				}
			} catch (_) {}
			_logDebugSafe('Modal: Showing modal: ' + modalElement.id);
		} catch (err) {
			console.warn('showModal: failed', err);
		}
	}

	function showModalNoHistory(modalElement) {
		if (!modalElement) return;
		try {
			modalElement.style.setProperty('display', 'flex', 'important');
			modalElement.scrollTop = 0;
			var scrollableContent = modalElement.querySelector('.modal-body-scrollable');
			if (scrollableContent) scrollableContent.scrollTop = 0;
			_logDebugSafe('Modal (no-history): Showing modal: ' + modalElement.id);
		} catch (err) {
			console.warn('showModalNoHistory: failed', err);
		}
	}

	function hideModal(modalElement) {
		if (!modalElement) return;
		try {
			modalElement.style.setProperty('display', 'none', 'important');
			_logDebugSafe('Modal: Hiding modal: ' + modalElement.id);
		} catch (err) {
			console.warn('hideModal: failed', err);
		}
	}

	// Toast-based lightweight alert; uses #toastContainer if present otherwise falls back to window.alert
	function showCustomAlert(message, duration, type) {
		duration = typeof duration === 'undefined' ? 3000 : duration;
		type = type || 'info';
		var effectiveDuration = (duration === 0) ? 0 : Math.max(duration || 3000, 3000);
		try {
			var container = document.getElementById('toastContainer');
			if (container) {
				var toast = document.createElement('div');
				toast.className = 'toast ' + type;
				toast.setAttribute('role', 'status');
				toast.innerHTML = '<span class="icon"></span><div class="message"></div>';
				toast.querySelector('.message').textContent = message;
				var remove = function() { toast.classList.remove('show'); setTimeout(function(){ try{ toast.remove(); } catch(_){} }, 200); };
				container.appendChild(toast);
				requestAnimationFrame(function(){ toast.classList.add('show'); });
				if (effectiveDuration && effectiveDuration > 0) setTimeout(remove, effectiveDuration);
				return;
			}
		} catch (e) {
			console.warn('Toast render failed, using alert fallback.', e);
		}
		try { window.alert(message); } catch (_) { console.log('ALERT:', message); }
	}

	// Centralized ToastManager
	var ToastManager = (function() {
		var containerEl = function() { return document.getElementById('toastContainer'); };
		function makeToast(opts) {
			var root = containerEl();
			if (!root) return null;
			var message = opts.message || '';
			var type = opts.type || 'info';
			var duration = typeof opts.duration === 'undefined' ? 2000 : opts.duration;
			var actions = opts.actions || [];
			var effectiveDuration = (duration === 0) ? 0 : Math.max(duration || 3000, 3000);
			var toast = document.createElement('div');
			toast.className = 'toast ' + type;
			toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
			var iconHTML = '<span class="icon"></span>';
			var msgHTML = '<div class="message"></div>';
			var actionsHTML = actions.length ? '<div class="actions">' + actions.map(function(a){ return '<button class="btn ' + (a.variant||'') + '">' + a.label + '</button>'; }).join('') + '</div>' : '';
			toast.innerHTML = iconHTML + msgHTML + actionsHTML;
			toast.querySelector('.message').textContent = message;
			var remove = function() { toast.classList.remove('show'); setTimeout(function(){ try{ toast.remove(); } catch(_){} }, 200); };
			var actionBtns = toast.querySelectorAll('.actions .btn');
			actionBtns.forEach(function(btn, idx){
				var cfg = actions[idx];
				btn.addEventListener('click', function(e){
					e.stopPropagation();
					try { cfg && typeof cfg.onClick === 'function' && cfg.onClick(); } finally { remove(); }
				});
			});
			root.appendChild(toast);
			requestAnimationFrame(function(){ toast.classList.add('show'); });
			if (effectiveDuration && effectiveDuration > 0) setTimeout(remove, effectiveDuration);
			return { el: toast, close: remove };
		}
		return {
			info: function(message, duration) { return makeToast({ message: message, type: 'info', duration: duration }); },
			success: function(message, duration) { return makeToast({ message: message, type: 'success', duration: duration }); },
			error: function(message, duration) { return makeToast({ message: message, type: 'error', duration: duration }); },
			confirm: function(message, opts) {
				opts = opts || {};
				var confirmText = opts.confirmText || 'Yes';
				var cancelText = opts.cancelText || 'No';
				var onConfirm = opts.onConfirm;
				var onCancel = opts.onCancel;
				return makeToast({
					message: message,
					type: 'info',
					duration: 0,
					actions: [
						{ label: confirmText, variant: 'primary', onClick: function(){ onConfirm && onConfirm(true); } },
						{ label: cancelText, variant: 'danger', onClick: function(){ onCancel && onCancel(false); } }
					]
				});
			}
		};
	})();

	function showCustomConfirm(message, callback) {
		var res = ToastManager.confirm(message, {
			confirmText: 'Yes',
			cancelText: 'No',
			onConfirm: function() { callback(true); },
			onCancel: function() { callback(false); }
		});
		if (!res) {
			try { callback(window.confirm(message)); } catch (_) { callback(false); }
		}
	}

	// Expose on window for backward compatibility
	window.UI = window.UI || {};
	window.UI.showModal = showModal;
	window.UI.showModalNoHistory = showModalNoHistory;
	window.UI.hideModal = hideModal;
	window.UI.showCustomAlert = showCustomAlert;
	window.UI.ToastManager = ToastManager;
	window.UI.showCustomConfirm = showCustomConfirm;

	// Also attach top-level symbols many parts of app reference
	try { window.showModal = showModal; } catch(_) {}
	try { window.showModalNoHistory = showModalNoHistory; } catch(_) {}
	try { window.hideModal = hideModal; } catch(_) {}
	try { window.showCustomAlert = showCustomAlert; } catch(_) {}
	try { window.ToastManager = ToastManager; } catch(_) {}
	try { window.showCustomConfirm = showCustomConfirm; } catch(_) {}
})();

// Sidebar UI: toggle logic and initialization
(function() {
    // Provide UI-level toggle implementation (actual DOM class changes)
    function _toggleAppSidebarImpl(forceState = null) {
        try {
            var isDesktop = window.innerWidth > 768;
            var isOpen = appSidebar && appSidebar.classList.contains('open');

            if (forceState === true || (forceState === null && !isOpen)) {
                if (!isDesktop) {
                    try { if (typeof pushAppState === 'function') pushAppState({ sidebarOpen: true }, '', '#sidebar'); } catch(_){}
                }
                if (appSidebar) appSidebar.classList.add('open');
                if (sidebarOverlay) sidebarOverlay.classList.add('open');
                if (appSidebar) { appSidebar.scrollTop = 0; }
                if (!isDesktop) {
                    document.body.style.overflow = 'hidden';
                }
                if (isDesktop) {
                    document.body.classList.add('sidebar-active');
                    if (sidebarOverlay) sidebarOverlay.style.pointerEvents = 'none';
                } else {
                    document.body.classList.remove('sidebar-active');
                    if (sidebarOverlay) sidebarOverlay.style.pointerEvents = 'auto';
                }
                if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded','true');
            } else {
                if (appSidebar) appSidebar.classList.remove('open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('open');
                document.body.classList.remove('sidebar-active');
                document.body.style.overflow = '';
                if (appSidebar) appSidebar.scrollTop = 0;
                if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded','false');
            }
        } catch (e) { console.warn('UI._toggleAppSidebarImpl failed', e); }
    }

    // Expose as UI.toggleAppSidebar
    window.UI = window.UI || {};
    window.UI.toggleAppSidebar = function(forceState) { return _toggleAppSidebarImpl(forceState); };

    // Initialization: bind hamburger, overlay, menu buttons, focus trap, resize handlers
    window.UI.initSidebar = function() {
        try {
            if (!(hamburgerBtn && appSidebar && closeMenuBtn && sidebarOverlay)) {
                console.warn('Sidebar Setup: Missing one or more sidebar elements (hamburgerBtn, appSidebar, closeMenuBtn, sidebarOverlay). Sidebar functionality might be impaired.');
                return;
            }

            // Ensure initial state is closed
            if (window.innerWidth > 768) {
                document.body.classList.remove('sidebar-active');
                sidebarOverlay.style.pointerEvents = 'none';
                appSidebar.classList.remove('open');
            } else {
                document.body.classList.remove('sidebar-active');
                sidebarOverlay.style.pointerEvents = 'auto';
                appSidebar.classList.remove('open');
            }

            // Hamburger listener
            if (!hamburgerBtn.dataset.sidebarBound) {
                hamburgerBtn.addEventListener('click', function(event) {
                    event.stopPropagation();
                    var willOpen = !appSidebar.classList.contains('open');
                    // Call the global toggle which will delegate to UI.toggleAppSidebar
                    try { window.toggleAppSidebar(); } catch(_) { window.UI.toggleAppSidebar(); }
                    if (willOpen && typeof pushAppStateEntry === 'function') pushAppStateEntry('sidebar','sidebar');
                });
                hamburgerBtn.dataset.sidebarBound = '1';
            }

            closeMenuBtn.addEventListener('click', function() { window.toggleAppSidebar(false); });

            // Unified overlay handler
            if (sidebarOverlay._unifiedHandler) {
                sidebarOverlay.removeEventListener('mousedown', sidebarOverlay._unifiedHandler, true);
                sidebarOverlay.removeEventListener('click', sidebarOverlay._unifiedHandler, true);
                sidebarOverlay.removeEventListener('touchstart', sidebarOverlay._unifiedHandler, true);
            }
            var unifiedHandler = function(e) {
                if (e.target !== sidebarOverlay) return;
                if (!appSidebar.classList.contains('open')) return;
                try { window.toggleAppSidebar(false); } catch(err){ console.warn('Sidebar close failed', err); }
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                e.stopPropagation();
                if (e.preventDefault) e.preventDefault();
            };
            sidebarOverlay.addEventListener('mousedown', unifiedHandler, true);
            sidebarOverlay._unifiedHandler = unifiedHandler;

            // Focus trap
            var mainContent = document.getElementById('mainContent') || document.querySelector('main');
            var firstFocusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            function trapFocus(e) {
                if (!appSidebar.classList.contains('open')) return;
                var focusables = Array.from(appSidebar.querySelectorAll(firstFocusableSelector)).filter(function(el){ return !el.disabled && el.offsetParent!==null; });
                if (!focusables.length) return;
                var first = focusables[0];
                var last = focusables[focusables.length-1];
                if (e.key === 'Tab') {
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
            document.addEventListener('keydown', trapFocus, true);

            // Desktop outside-click closer (capture)
            document.addEventListener('click', function(event) {
                var isDesktop = window.innerWidth > 768;
                if (!isDesktop) return;
                if (!appSidebar.classList.contains('open')) return;
                if (!appSidebar.contains(event.target) && !hamburgerBtn.contains(event.target)) {
                    window.toggleAppSidebar(false);
                    event.stopPropagation();
                    event.preventDefault();
                }
            }, true);

            window.addEventListener('resize', function() {
                var isDesktop = window.innerWidth > 768;
                if (appSidebar.classList.contains('open')) {
                    window.toggleAppSidebar(false);
                }
                // Callbacks that the app expects to exist
                try { if (typeof adjustMainContentPadding === 'function') adjustMainContentPadding(); } catch(_){}
                try { if (typeof updateCompactViewButtonState === 'function') updateCompactViewButtonState(); } catch(_){}
            });

            // Menu button handlers
            var menuButtons = appSidebar.querySelectorAll('.menu-button-item');
            menuButtons.forEach(function(button){
                button.addEventListener('click', function(event){
                    var clickedButton = event.currentTarget;
                    if (clickedButton.id === 'toggleCompactViewBtn') {
                        try { toggleMobileViewMode(); } catch(_){}
                    }
                    var closesMenu = clickedButton.dataset.actionClosesMenu !== 'false';
                    if (clickedButton.id === 'forceUpdateBtn') {
                        window.toggleAppSidebar(false);
                        try { if (typeof forceHardUpdate === 'function') forceHardUpdate(); } catch(_){}
                        return;
                    }
                    if (closesMenu) window.toggleAppSidebar(false);
                });
            });

        } catch (e) { console.warn('UI.initSidebar failed', e); }
    };

})();


