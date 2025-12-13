// js/userData.js
import { db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * Create/Update Firestore user record after signup
 */
export async function createUserDoc(user) {
  if (!user.email) return;

  // Auto-set admin role for your business email
  const role = (user.email.toLowerCase() === "admin@astravyn.com")
    ? "admin"
    : "user";

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    role,
    isBlocked: false,
    createdAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Fetch user document
 */
export async function getUserData(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Update last login time
 */
export async function updateLastLogin(uid) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { lastLogin: serverTimestamp() });
}
