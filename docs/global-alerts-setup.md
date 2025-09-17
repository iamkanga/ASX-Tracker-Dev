# Global 52‑Week Alerts: setup guide

This feature publishes centralized 52‑week High/Low alerts so all clients can read them. The backend job (Google Apps Script) writes documents to Firestore; the client subscribes read‑only.

Key paths:
- Central alerts doc: `artifacts/{APP_ID}/alerts/HI_LO_52W`
- Optional summaries: `artifacts/{APP_ID}/alerts/GA_SUMMARY` and `GA_SUMMARY_COMPREHENSIVE`
- User settings (example): `artifacts/{APP_ID}/users/{uid}/profile/settings`

## 1) Firestore Rules
Paste into the Firestore Rules editor and Publish. Adjust if you already have a ruleset.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }

    // Allow authenticated users to read global alert summaries
    match /artifacts/{appId}/alerts/{docId} {
      allow read: if isSignedIn();
      allow write: if false; // writes come from the backend only
    }

    // Typical user profile protection
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Notes:
- If you need unauthenticated reads, loosen `isSignedIn()` accordingly, but prefer auth.
- If your app also writes user‑generated alerts into `alerts/` per‑user, split paths so central docs remain read‑only to clients.

## 2) Backend write permission (Apps Script → Firestore)
The Apps Script job writes via Firestore REST. Ensure it has permission:

- Enable Firestore API on the script's GCP project: Apps Script Editor → Settings → Cloud Platform (GCP) Project → Open in Cloud Console → APIs & Services → Enable APIs → "Firestore API".
- IAM: Grant the execution identity write access.
  - If executions run as your Google user, give your user an IAM role with Firestore write (e.g., "Cloud Datastore User" or "Editor").
  - If using a service account (e.g., `<project-id>@appspot.gserviceaccount.com`), grant that account the role "Cloud Datastore User" on the Firebase project.

Scopes (appsscript.json):
- Mail: `https://www.googleapis.com/auth/script.send_mail` (if email enabled)
- URL fetch: `https://www.googleapis.com/auth/script.external_request`

## 3) Client runtime config (GAS URL)
The app can read your Apps Script Web App URL from localStorage. In the browser, navigate to your app with `?setGas=1` to be prompted, or set via DevTools:

```
localStorage.setItem('GOOGLE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycb.../exec');
location.reload();
```

## 4) Verify end‑to‑end
- Open the app and sign in. Check the console for the 52‑week listener: no permission errors.
- Manually run `runGlobal52WeekScan` in Apps Script to seed data.
- In Firestore, confirm documents exist at `artifacts/{APP_ID}/alerts/HI_LO_52W`.
- In the app, open the Global Alerts modal: highs/lows should render when data exists.

## 5) Troubleshooting
- "Missing or insufficient permissions": Recheck Firestore Rules and that you're signed in; verify IAM role for the writer identity.
- "INVALID_ARGUMENT" on writes: Verify the document path segments exactly match `artifacts/{APP_ID}/alerts/HI_LO_52W`.
- Live price fetch stuck: confirm the GAS Web App URL is correct and deployed; use `?setGas=1` to update.
