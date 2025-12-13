// dating/firebase-helpers.js
// Firestore helpers for Astravyn Dating module

import { db } from '../js/firebase-config.js';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// Fetch profiles with advanced filters
export async function fetchProfilesOnce({ limitCount = 24, filters = {} } = {}) {
  let q = query(
    collection(db, 'datingProfiles'),
    where('isVisible', '==', true)
  );

  // Apply filters
  if (filters.gender) {
    q = query(q, where('gender', '==', filters.gender));
  }

  // Note: Firestore requires composite indexes for multiple range/equality checks.
  // We'll do client-side filtering for some complex combos to keep it simple without managing indexes,
  // or construct specific queries. For now, let's try basic Firestore constraints.

  if (filters.location) {
    // Exact match for now
    q = query(q, where('location', '==', filters.location));
  }

  // Order by update time
  // Note: Requires composite index if filtering by isVisible. Temporarily disabled for dev.
  // q = query(q, orderBy('updatedAt', 'desc'));
  q = query(q, limit(limitCount));

  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Client-side filtering for range fields (age) to avoid index explosion during dev
  if (filters.minAge) {
    results = results.filter(p => (p.age || 0) >= Number(filters.minAge));
  }
  if (filters.maxAge) {
    results = results.filter(p => (p.age || 0) <= Number(filters.maxAge));
  }

  if (filters.isNew) {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    results = results.filter(p => {
      const ca = p.createdAt;
      if (!ca) return false;
      const t = (typeof ca === 'object' && ca.toMillis) ? ca.toMillis() : new Date(ca).getTime();
      return (now - t) <= dayMs;
    });
  }

  return results;
}

// Update user settings in their profile doc
export async function updateUserSettings(uid, settings) {
  const { doc, updateDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  const ref = doc(db, 'datingProfiles', uid);
  // Merge into a 'settings' map
  await setDoc(ref, { settings }, { merge: true });
}

// Get user settings
export async function getUserSettings(uid) {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  const ref = doc(db, 'datingProfiles', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().settings || {};
  }
  return {};
}

// Live listener (auto updates when admin edits profile)
export function listenProfilesRealtime(callback, { limitCount = 50, filters = {} } = {}) {
  let q = query(
    collection(db, 'datingProfiles'),
    where('isVisible', '==', true),
    // orderBy('updatedAt', 'desc'),
    limit(limitCount)
  );

  if (filters.city) {
    q = query(
      collection(db, 'datingProfiles'),
      where('isVisible', '==', true),
      where('location', '==', filters.city),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
  }

  const unsub = onSnapshot(
    q,
    snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(data);
    },
    err => {
      console.error("Realtime listener error", err);
      callback([], err);
    }
  );

  return unsub;
}

// Connections & Likes
export async function addConnection(fromUid, toUid, type = 'connect') {
  const { addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

  // Basic check to prevent duplicates could be done here or via rules/unique IDs
  // For MVP we just add a new doc
  await addDoc(collection(db, 'connections'), {
    fromUid,
    toUid,
    type, // 'connect' or 'like'
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function checkConnectionStatus(fromUid, toUid) {
  // Check if we already connected/liked
  // Note: Firestore query requires composite index for multiple fields usually, 
  // but let's try a simple query.
  const q = query(
    collection(db, 'connections'),
    where('fromUid', '==', fromUid),
    where('toUid', '==', toUid),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty; // true if exists
}
