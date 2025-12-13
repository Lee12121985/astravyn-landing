import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

/**
 * Initialize a global auth listener.
 * @param {function} onUserLoaded - Callback(user, profile) when user and profile are loaded.
 *                       user: Firebase Auth object
 *                       profile: Firestore document data (role, isBlocked, etc.)
 */
export function initAuthListener(onUserLoaded) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            onUserLoaded(null, null);
            return;
        }

        try {
            const userRef = doc(db, "users", user.uid);
            const snap = await getDoc(userRef);

            if (snap.exists()) {
                const profile = snap.data();

                // Security check on every load
                if (profile.isBlocked) {
                    console.warn("User is blocked. Signing out.");
                    await signOut(auth);
                    // trigger callback as null? or handle block UI?
                    // For now, treat as unauthenticated or handle logic in UI
                    onUserLoaded(null, null);
                    window.location.href = "/login/index.html"; // Hard redirect if blocked
                    return;
                }

                onUserLoaded(user, profile);
            } else {
                console.warn("User authenticated but no Firestore doc found.");
                onUserLoaded(user, null);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            // Still return user object at least
            onUserLoaded(user, null);
        }
    });
}
