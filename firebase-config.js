
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInAnonymously, signInWithCustomToken, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, FieldValue, deleteField, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// YOUR FIREBASE CONFIGURATION - Replace with your actual Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyAyIWoTYlzTkaSZ9x-ySiHtzATBM9XFrYw", // Replace with your apiKey
    authDomain: "asx-watchlist-app.firebaseapp.com", // Replace with your authDomain
    projectId: "asx-watchlist-app", // Replace with your projectId
    storageBucket: "asx-watchlist-app.firebaseapp.com", // Replace with your storageBucket
    messagingSenderId: "671024168765", // Replace with your messagingSenderId
    appId: "1:671024168765:web:f2b62cd0e77a126c0ecf54", // Replace with your appId
    measurementId: "G-J24BTJ34D2" // Replace with your measurementId
};

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
        console.log("Firebase: Initialized successfully with config.");
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
    collection: collection,
    doc: doc,
    getDoc: getDoc,
    addDoc: addDoc,
    setDoc: setDoc,
    updateDoc: updateDoc,
    deleteDoc: deleteDoc,
    onSnapshot: onSnapshot,
    query: query,
    where: where,
    getDocs: getDocs,
    deleteField: FieldValue.delete,
    writeBatch: writeBatch
} : null;

const authFunctions = firebaseInitialized ? {
    GoogleAuthProviderInstance: new GoogleAuthProvider(),
    signInAnonymously: signInAnonymously,
    signInWithCustomToken: signInWithCustomToken,
    signInWithPopup: signInWithPopup,
    signOut: signOut,
    onAuthStateChanged: onAuthStateChanged
} : null;

export { db, auth, firestore, authFunctions, firebaseInitialized };
