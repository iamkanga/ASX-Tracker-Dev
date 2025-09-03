import { initializeFirebaseAndAuth } from '../firebase.js';

export function initializeAppEventListeners(callbackOrOptions) {
	// This function is invoked from script.js's DOMContentLoaded listener
	// It initializes Firebase services and returns them via callback
	try { logDebug('script.js DOMContentLoaded fired.'); } catch (_) { try { console.debug('script.js DOMContentLoaded fired.'); } catch(_){} }
	const services = initializeFirebaseAndAuth();
	if (typeof callbackOrOptions === 'function') {
		callbackOrOptions(services);
	} else if (callbackOrOptions && typeof callbackOrOptions.onFirebaseInitialized === 'function') {
		callbackOrOptions.onFirebaseInitialized(services);
	}
}
