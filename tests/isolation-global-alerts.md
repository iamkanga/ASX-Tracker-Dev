# Isolation Test: Global Alerts Rendering

This minimal page (`isolation-global-alerts.html`) is used to reproduce and debug the issue where Global Movers and 52W High/Low sections render empty while counts elsewhere indicate data exists.

## Features
- Loads a single snapshot (no realtime listeners) from:
  - `artifacts/{APP_ID}/alerts/GLOBAL_MOVERS_HITS`
  - `artifacts/{APP_ID}/alerts/HI_LO_52W_HITS`
- Renders four sections: Gainers, Losers, 52W Highs, 52W Lows.
- Mock data injection button for offline / no-Firebase testing.
- Raw JSON panel for quick schema inspection.

## Usage
1. (Optional) Open DevTools and set a specific app id:
```js
localStorage.setItem('isolationAppId', 'your-app-id');
```
2. If you have a `firebaseConfig`, define it before loading (quick method: paste into console then reload):
```js
window.firebaseConfig = { /* your Firebase web config */ };
```
3. Open `tests/isolation-global-alerts.html` directly in the browser.
4. Click "Load From Firestore".
5. If Firestore is not configured, use "Inject Mock Data".

## Diagnosis Workflow
- If mock data renders but Firestore load returns empty sections: inspect Firestore docs for field names mismatch (e.g., `upHits` vs `up`, `highHits` vs `highs`).
- Compare the raw JSON shown in the panel with what the main app expects in `script.js` (search for `startGlobalMoversListener` and `startGlobalHiLoListener`).
- Validate that documents exist and security rules allow read access for the current user.

## Next Steps After Reproducing
- Add logging to confirm snapshot existence and field presence.
- Adjust main app mapping logic if backend schema diverged.
- Consider adding a defensive merge layer similar to this isolation page in production code.

---
Generated as part of Step 2 (Isolation) of the remediation plan.
