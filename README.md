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
