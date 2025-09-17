# ASX Tracker (clean base)

A simple, static web app for tracking ASX shares, powered by Firebase and a lightweight service worker. This repo is trimmed to the essentials for low-friction updates.

## What’s included
- index.html — App shell and Firebase bootstrapping
- script.js — All app logic (watchlists, portfolio, live prices)
- style.css — App styles
- asx_codes.csv — Codes used by search and buttons
- service-worker.js — Offline/cache with safe rules
- manifest.json — PWA metadata
- favicon.png, Kangaicon.jpg, notification_icon.png — Icons/assets

## Removed clutter
Dev helpers and unused files were removed to keep the root clean. See docs/ for any kept notes.

## Running locally (no build)
Service worker requires a local server (not file://). Use one of these options:

- VS Code extension: "Live Server" → Open index.html → "Open with Live Server"
- Python 3 (if installed):
  - PowerShell:
    - cd "c:\Users\Kanga\Desktop\ASX Latest"
    - python -m http.server 5500
  - Then open http://localhost:5500/

## Firebase config
Update the firebaseConfig in index.html with your project values. Without valid config, the UI loads but data features are disabled.

## Notes
- To deploy, upload the folder contents to any static host (HTTPS recommended).
- If you change cached files, bump CACHE_NAME in service-worker.js (or unregister via browser devtools) to force-refresh.

## Global 52‑Week Alerts: quick setup (permissions)
If you see "FirebaseError: Missing or insufficient permissions" when the app tries to read global alerts, grant clients read access to the central alerts docs and ensure the backend can write.

1) Firestore Rules (copy/paste)

Use the Firebase Console (Build → Firestore Database → Rules) and paste this minimal ruleset, then Publish:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }

    // Allow authenticated users to read global alert summaries
    match /artifacts/{appId}/alerts/{docId} {
      allow read: if isSignedIn();
      allow write: if false; // writes come from the backend only
    }

    // Typical user profile protection (adjust if you already have rules)
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}

2) Backend write permission (Apps Script → Firestore)

The scheduled Google Apps Script writes the global docs via the Firestore API. Ensure it can write:
- Enable the "Firestore API" on the script's GCP project (Apps Script Editor → Settings → Cloud Platform (GCP) Project → Open in Cloud Console → APIs & Services → Enable APIs → Firestore API).
- Grant write permission via IAM:
  - In the Firebase project's Google Cloud Console → IAM, add the Apps Script execution identity with role "Cloud Datastore User" (or Firestore User/Editor/Owner). Common identities:
    - If using ScriptApp.getOAuthToken() (default), your Google account executes triggers: your user must have write access to Firestore for this project.
    - If using the script's default service account, it typically ends with `@appspot.gserviceaccount.com` for the project. Grant it "Cloud Datastore User".

3) Verify
- Reload the app while signed in. The global alerts listener should attach without errors.
- Optional: run the Apps Script function `runGlobal52WeekScan` once to populate `artifacts/{APP_ID}/alerts/HI_LO_52W` and related summary docs, then refresh the app to see counts in the Notifications modal/banner.

More detail lives in `docs/global-alerts-setup.md`.
