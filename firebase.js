import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, serverTimestamp, deleteField, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

export function initializeFirebaseAndAuth() {
    const currentAppId = firebaseConfig.projectId || 'default-app-id';

    let firebaseApp;
    let auth;
    let db;
    let firebaseInitialized = false;

    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
        try {
            firebaseApp = initializeApp(firebaseConfig);
            auth = getAuth(firebaseApp);
            db = getFirestore(firebaseApp);
            firebaseInitialized = true;
            console.log("Firebase: Initialized successfully with config from firebase.js.");
        } catch (error) {
            console.error("Firebase: Failed to initialize app with provided config:", error);
            firebaseInitialized = false;
        }
    } else {
        console.error("Firebase: Configuration is missing or invalid (apiKey or projectId). Firebase will not initialize.");
        const errorDiv = document.getElementById('firebaseInitError');
        if (errorDiv) {
            errorDiv.style.display = 'block';
        }
        firebaseInitialized = false;
    }

    const firestore = firebaseInitialized ? {
        collection,
        doc,
        getDoc,
        addDoc,
        setDoc,
        updateDoc,
        deleteDoc,
        onSnapshot,
        query,
        where,
        getDocs,
        deleteField,
        writeBatch,
        serverTimestamp
    } : null;

    const authFunctions = firebaseInitialized ? {
        GoogleAuthProviderInstance: new GoogleAuthProvider(),
        createGoogleProvider: () => new GoogleAuthProvider(),
        signInAnonymously,
        signInWithCustomToken,
        signInWithPopup,
        signInWithRedirect,
        getRedirectResult,
        signOut,
        onAuthStateChanged,
        setPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        browserPopupRedirectResolver
    } : null;

    // --- TESTING HOOK ---
    // Expose services to the window object ONLY when in a testing environment.
    if (window.Cypress || window.playwright || new URLSearchParams(window.location.search).has('testing_mode')) {
        window.testing_firebaseServices = {
            db: firebaseInitialized ? db : null,
            auth: firebaseInitialized ? auth : null,
            currentAppId,
            firestore,
            authFunctions,
            firebaseInitialized
        };
    }

    return {
        db: firebaseInitialized ? db : null,
        auth: firebaseInitialized ? auth : null,
        currentAppId,
        firestore,
        authFunctions,
        firebaseInitialized
    };
}
