// js/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js';

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
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { app, auth, db, storage, analytics };
