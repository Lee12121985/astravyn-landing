// js/firebase-config.js
// Canonical Firebase configuration - values must match shared/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js';

// Detect if running in local development mode
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === ''
);

// Single Firebase project configuration for all subdomains
const firebaseConfig = {
    apiKey: "AIzaSyDPljICCsPxIH9TtNYJ9VvIg6YvYwPis3E",
    authDomain: "astravyn-landing.firebaseapp.com",
    projectId: "astravyn-landing",
    storageBucket: "astravyn-landing.firebasestorage.app",
    messagingSenderId: "90590064470",
    appId: "1:90590064470:web:740aa9cd5213ac9f50f0f7",
    measurementId: "G-DV0M3HKV6B"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connect to emulators if in local development mode
if (isLocal) {
  try {
    if (!auth._delegate?._config?.emulator) {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      console.log('[Timesheet] Connected to Auth Emulator');
    }
  } catch (error) {
    console.warn('[Timesheet] Auth emulator connection error (may already be connected):', error);
  }
}

// Set persistence to local storage for cross-subdomain auth
try {
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('Failed to set auth persistence:', err);
  });
} catch (e) {
  console.warn('Error setting auth persistence:', e);
}

const db = getFirestore(app);

// Connect to Firestore emulator if in local development mode
if (isLocal) {
  try {
    if (!db._delegate?._settings?.host?.includes('localhost')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      console.log('[Timesheet] Connected to Firestore Emulator');
    }
  } catch (error) {
    console.warn('[Timesheet] Firestore emulator connection error (may already be connected):', error);
  }
}

const storage = getStorage(app);

// Connect to Storage emulator if in local development mode
if (isLocal) {
  try {
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('[Timesheet] Connected to Storage Emulator');
  } catch (error) {
    console.warn('[Timesheet] Storage emulator connection error (may already be connected):', error);
  }
}

// Analytics should not be initialized in emulator mode
const analytics = isLocal ? null : getAnalytics(app);

export { app, auth, db, storage, analytics };
