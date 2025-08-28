import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// YOUR FIREBASE CONFIGURATION - Replace with your actual Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyAyIWoTYlzTkaSZ9x-ySiHtzATBM9XFrYw",
    authDomain: "asx-watchlist-app.firebaseapp.com",
    projectId: "asx-watchlist-app",
    storageBucket: "asx-watchlist-app.firebaseapp.com",
    messagingSenderId: "671024168765",
    appId: "1:671024168765:web:f2b62cd0e77a126c0ecf54",
    measurementId: "G-J24BTJ34D2"
};

let firebaseApp;
let auth;
let db;
let firebaseInitialized = false;
const currentAppId = firebaseConfig.projectId || 'default-app-id';


if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        firebaseInitialized = true;
        console.log("Firebase: Initialized successfully with config from firebase.js.");

        // Listen for auth state changes and dispatch a custom event
        onAuthStateChanged(auth, (user) => {
            console.log('Firebase: Auth state changed, dispatching event.', user ? user.uid : 'No user');
            const event = new CustomEvent('authStateChanged', { detail: { user } });
            document.dispatchEvent(event);
        });

    } catch (error) {
        console.error("Firebase: Failed to initialize app with provided config:", error);
    }
} else {
    console.error("Firebase: Configuration is missing or invalid (apiKey or projectId). Firebase will not initialize.");
}

// Export the initialized services and functions
export {
    auth,
    db,
    firebaseInitialized,
    currentAppId,
    GoogleAuthProvider
};

// Also re-export all the functions from the sub-modules for convenience
export * from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
