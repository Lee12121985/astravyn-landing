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
 * Ensure a user profile exists and update lastLogin/apps/role safely.
 * - Creates users/{uid} if missing; otherwise only updates lastLogin + fields.
 * - Does NOT overwrite createdAt on existing docs.
 * - Keeps role if already set; defaults to admin@astravyn.com => admin, else user.
 * - Adds apps map (timesheet, dating, aiStudio).
 * - Seeds datingProfiles/{uid} with minimal required fields (merge-safe).
 */
export async function createOrSyncUserProfile(user, opts = {}) {
  if (!user || !user.uid) return;

  const uid = user.uid;
  const email = (user.email || "").toLowerCase();
  const phoneNumber = user.phoneNumber || "";
  const displayName =
    user.displayName ||
    (email ? email.split("@")[0] : phoneNumber ? `User ${phoneNumber.slice(-4)}` : "Astravyn User");
  const photoURL = user.photoURL || "";

  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? snap.data() : {};

  const role =
    existing.role ||
    (email === "admin@astravyn.com" ? "admin" : "user");

  const defaultApps = {
    timesheet: true,
    dating: true,
    aiStudio: true,
  };
  const mergedApps = { ...defaultApps, ...(existing.apps || {}), ...(opts.apps || {}) };

  const payload = {
    uid,
    email: email || "",
    displayName,
    role,
    apps: mergedApps,
    accountStatus: existing.accountStatus || "active",
    isPremium: existing.isPremium || false,
    profileId: existing.profileId || uid,
    lastLogin: serverTimestamp(),
  };

  if (!snap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });

  // Minimal dating profile (merge-safe)
  await setDoc(
    doc(db, "datingProfiles", uid),
    {
      userId: uid,
      name: displayName,
      gender: existing.gender || null,
      preference: existing.preference || null,
      bio: existing.bio || "New to Astravyn.",
      photos: existing.photos || (photoURL ? [photoURL] : []),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Create/Update Firestore user record after signup
 */
export async function createUserDoc(user) {
  if (!user.email) return;

  // Auto-set admin role for your business email
  const role = user.email.toLowerCase() === "admin@astravyn.com" ? "admin" : "user";
  await createOrSyncUserProfile(user, {
    apps: { timesheet: true, dating: true, aiStudio: true },
  });
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

/**
 * Check and link additional authentication providers to current user
 * @param {Object} user - Firebase Auth user object
 * @param {string} email - Email to check for other providers
 * @returns {Object} - Object with linked providers info
 */
export async function checkAndLinkProviders(user, email) {
  if (!user || !email) return { linked: false, providers: [] };
  
  try {
    const { fetchSignInMethodsForEmail } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
    const { auth } = await import('./firebase-config.js');
    
    const methods = await fetchSignInMethodsForEmail(auth, email);
    const userProviders = user.providerData.map(p => p.providerId);
    const availableProviders = [];
    
    // Check which providers are available but not linked
    if (methods.includes('google.com') && !userProviders.includes('google.com')) {
      availableProviders.push('google.com');
    }
    if (methods.includes('password') && !userProviders.includes('password')) {
      availableProviders.push('password');
    }
    if (methods.includes('phone') && !userProviders.includes('phone')) {
      availableProviders.push('phone');
    }
    
    return {
      linked: false,
      providers: availableProviders,
      allMethods: methods,
      currentProviders: userProviders
    };
  } catch (err) {
    console.warn('Provider check failed:', err);
    return { linked: false, providers: [], error: err.message };
  }
}
