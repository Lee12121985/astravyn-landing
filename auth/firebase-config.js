import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Live Firebase configuration for astravyn-landing project.
const firebaseConfig = {
  apiKey: "AIzaSyDPljICCsPxIH9TtNYJ9VvIg6YvYwPis3E",
  authDomain: "astravyn-landing.firebaseapp.com",
  projectId: "astravyn-landing",
  storageBucket: "astravyn-landing.firebasestorage.app",
  messagingSenderId: "90590064470",
  appId: "1:90590064470:web:740aa9cd5213ac9f50f0f7",
  measurementId: "G-DV0M3HKV6B"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Persist session across tabs/apps.
setPersistence(auth, browserLocalPersistence);

// Emulator wiring for localhost and local subdomains.
const isLocal = window.location.hostname === "localhost" || 
                window.location.hostname === "127.0.0.1" ||
                window.location.hostname.endsWith(".astravyn.local");
if (isLocal) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

// Expose a single global instance.
window.firebase = window.firebase || {};
window.firebase.auth = auth;
window.firebase.firestore = db;

export { auth, db };
export const googleProvider = new GoogleAuthProvider();

