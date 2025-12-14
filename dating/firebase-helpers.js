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
  onSnapshot,
  startAt,
  endAt
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


  if (filters.religion) {
    // We can use the normalized field if we saved it, or standard field if exact match
    // For now, let's assume exact match on standard field to match UI values
    q = query(q, where('religion', '==', filters.religion));
  }

  // Name Prefix Search
  // Requires 'displayNameLower' field for case-insensitive partial match
  if (filters.name && filters.name.length > 0) {
    const term = filters.name.toLowerCase();
    q = query(q, orderBy('displayNameLower'), startAt(term), endAt(term + '\uf8ff'));
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
  const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
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
export async function sendLike(fromUid, toUid, type = 'like') {
  const { doc, setDoc, getDoc, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

  // 1. Create "Like" in 'likes' collection
  // Composite ID to prevent duplicates
  const likeId = `${fromUid}_${toUid}`;
  await setDoc(doc(db, 'likes', likeId), {
    fromUserId: fromUid,
    toUserId: toUid,
    type: type, // 'like', 'super_like', 'connect_request'
    status: 'pending',
    timestamp: serverTimestamp()
  });

  // 2. Check for Match (Client-side simulation of backend trigger)
  // Check if target user has already liked us
  const reverseLikeId = `${toUid}_${fromUid}`;
  const reverseSnap = await getDoc(doc(db, 'likes', reverseLikeId));

  if (reverseSnap.exists()) {
    // IT'S A MATCH!
    // Create 'connections' document
    await addDoc(collection(db, 'connections'), {
      users: [fromUid, toUid],
      initiatedAt: serverTimestamp(),
      lastInteractionAt: serverTimestamp(),
      status: 'active',
      metadata: {
        matchType: 'double_opt_in'
      }
    });

    return { isMatch: true };
  }

  return { isMatch: false };
}

export async function checkInteractionStatus(fromUid, toUid) {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  // Check 'likes' collection
  const likeId = `${fromUid}_${toUid}`;
  const snap = await getDoc(doc(db, 'likes', likeId));
  return snap.exists();
}

// Fetch profiles that I have liked
export async function fetchLikedProfiles(uid) {
  const { collection, query, where, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

  // 1. Get List of Likes
  const q = query(
    collection(db, 'likes'),
    where('fromUserId', '==', uid),
    // orderBy('timestamp', 'desc') // Requires composite index
  );

  const snap = await getDocs(q);
  const targetIds = snap.docs.map(d => d.data().toUserId);

  if (targetIds.length === 0) return [];

  // 2. Fetch Profiles for these IDs
  // Ideally use 'in' query in batches of 10, or fetching individual docs parallelly for MVP
  const promises = targetIds.map(id => getDoc(doc(db, 'datingProfiles', id)));
  const profileSnaps = await Promise.all(promises);

  return profileSnaps
    .filter(s => s.exists())
    .map(s => ({ id: s.id, ...s.data() }));
}

// Fetch matches/connections
export async function fetchConnectedProfiles(uid) {
  const { collection, query, where, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

  // 1. Get Connections where users array contains uid
  const q = query(
    collection(db, 'connections'),
    where('users', 'array-contains', uid)
  );

  const snap = await getDocs(q);

  if (snap.empty) return [];

  // Extract the OTHER uid from each connection
  const otherUids = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.users && Array.isArray(data.users)) {
      const friendId = data.users.find(u => u !== uid);
      if (friendId) otherUids.push(friendId);
    }
  });

  if (otherUids.length === 0) return [];

  // 2. Fetch Profiles
  const promises = otherUids.map(id => getDoc(doc(db, 'datingProfiles', id)));
  const profileSnaps = await Promise.all(promises);

  return profileSnaps
    .filter(s => s.exists())
    .map(s => ({ id: s.id, ...s.data() }));
}
