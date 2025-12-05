import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export async function signUp(email, password, name) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: name || "",
            role: email === "admin@astravin.com" ? "admin" : "user",
            isBlocked: false,
            isPremium: false,
            createdAt: serverTimestamp()
        });

        return user;
    } catch (error) {
        console.error("Error signing up:", error);
        throw error;
    }
}

export async function signIn(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if blocked
        const userDoc = await getUserDoc(user.uid);
        if (userDoc && userDoc.isBlocked) {
            await firebaseSignOut(auth);
            throw new Error("Account is blocked.");
        }

        return user;
    } catch (error) {
        console.error("Error signing in:", error);
        throw error;
    }
}

export async function logout() {
    try {
        await firebaseSignOut(auth);
        window.location.href = '/index.html'; // Redirect to home
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
}

export async function getUserDoc(uid) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        return null;
    }
}

export function monitorAuthState(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userData = await getUserDoc(user.uid);
            if (userData && userData.isBlocked) {
                await firebaseSignOut(auth);
                callback(null);
                return;
            }
            callback({ ...user, ...userData }); // Merge auth user and firestore data
        } else {
            callback(null);
        }
    });
}

export function requireAuth(redirectUrl = '/login/index.html') {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (user) {
                const userData = await getUserDoc(user.uid);
                if (userData && userData.isBlocked) {
                    await firebaseSignOut(auth);
                    window.location.href = redirectUrl;
                    reject('Blocked');
                } else {
                    resolve({ ...user, ...userData });
                }
            } else {
                window.location.href = redirectUrl;
                reject('Not authenticated');
            }
        });
    });
}

export function requireAdmin(redirectUrl = '/index.html') {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (user) {
                const userData = await getUserDoc(user.uid);
                if (userData && userData.role === 'admin' && !userData.isBlocked) {
                    resolve({ ...user, ...userData });
                } else {
                    window.location.href = redirectUrl;
                    reject('Not authorized');
                }
            } else {
                window.location.href = '/login/index.html';
                reject('Not authenticated');
            }
        });
    });
}
