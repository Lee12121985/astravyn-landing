// dating/profile.js
// Profile editor: load current user's data, allow edit + multiple photo upload

import { auth, db, storage } from '../js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

const el = id => document.getElementById(id);

// Form Elements
const els = {
  displayName: el('displayName'),
  age: el('age'),
  gender: el('gender'),
  location: el('location'),
  profession: el('profession'),
  income: el('income'), // NEW
  maritalStatus: el('maritalStatus'),
  interests: el('interests'),
  bio: el('bio'),
  isVisible: el('isVisible'),
  galleryGrid: el('photo-gallery-grid'),
  photoFile: el('photoFile'),
  uploadBtn: el('uploadPhotoBtn'),
  photoURL: el('photoURL'),
  addUrlBtn: el('addUrlBtn'),
  saveBtn: el('saveProfile'),
  status: el('profile-status'),
  saveStatus: el('save-status') // NEW
};

let currentUser = null;
let currentProfileDocId = null;
let currentPhotos = []; // Array of { url, path }

function setStatus(msg, isError = false) {
  // Top status chip
  if (els.status) {
    els.status.textContent = msg;
    els.status.style.background = isError ? 'rgba(248, 113, 113, 0.2)' : 'var(--glass-bg)';
    els.status.style.color = isError ? '#f87171' : 'white';
  }
}

// Toast Notification
function showToast(msg, type = 'success') {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    background: ${type === 'error' || type === true ? '#ef4444' : '#10b981'};
    color: white; padding: 12px 24px; border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    z-index: 9999; transition: opacity 0.3s ease; font-weight:500; font-family:sans-serif;
  `;
  div.textContent = msg;
  document.body.appendChild(div);

  // Fade out
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

// 1. Fetch Profile
async function findProfileForUid(uid) {
  const docRef = doc(db, 'datingProfiles', uid);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) return { docId: snap.id, data: snap.data() };
  } catch (e) { console.warn(e); }
  return null;
}

// 2. Populate Form
function populateForm(data) {
  if (els.displayName) els.displayName.value = data.displayName || '';
  if (els.age) els.age.value = data.age || '';
  if (els.gender) els.gender.value = data.gender || '';
  if (els.location) els.location.value = data.location || '';
  if (els.profession) els.profession.value = data.profession || '';
  if (els.income) els.income.value = data.income || ''; // NEW
  if (els.maritalStatus) els.maritalStatus.value = data.maritalStatus || '';
  if (els.interests) els.interests.value = (data.interests || []).join(', ');
  if (els.bio) els.bio.value = data.bio || '';
  if (els.isVisible) els.isVisible.checked = !!data.isVisible;

  // Handle Photos
  currentPhotos = data.photos || [];
  // Fallback for migration: if photos array empty but photoURL exists
  if (currentPhotos.length === 0 && data.photoURL) {
    currentPhotos.push({ url: data.photoURL, path: null });
  }
  renderGallery();
}

// 3. Render Gallery
function renderGallery() {
  if (!els.galleryGrid) return;

  // Clear only the photo slots (keep the "+" slots if we want, but for now we replace content)
  // Actually, to match the UI, we should keep the grid layout. 
  // We will re-generate the grid: filled slots first, then empty slots.

  els.galleryGrid.innerHTML = '';

  const maxPhotos = 5;

  // 1. Render existing photos
  currentPhotos.forEach((photo, index) => {
    const div = document.createElement('div');
    div.className = 'photo-slot';
    div.style.position = 'relative';
    div.style.borderStyle = 'solid';
    div.style.borderColor = 'rgba(255,255,255,0.2)';
    div.innerHTML = '';

    // Image
    const img = document.createElement('img');
    img.src = photo.url;

    // Delete Button
    const btn = document.createElement('button');
    btn.innerHTML = '&times;';
    btn.style.cssText = `position:absolute; top:-6px; right:-6px; background:var(--neon-pink); color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.3); z-index:10;`;
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      deletePhoto(index);
    };

    div.appendChild(img);
    div.appendChild(btn);
    els.galleryGrid.appendChild(div);
  });

  // 2. Render empty slots
  for (let i = currentPhotos.length; i < maxPhotos; i++) {
    const div = document.createElement('div');
    div.className = 'photo-slot';
    div.innerHTML = '<span style="font-size:1.5rem;color:rgba(255,255,255,0.2);">+</span>';
    // Click on empty slot triggers upload
    div.onclick = () => els.photoFile.click();
    els.galleryGrid.appendChild(div);
  }

  // Limit check UI
  const isFull = currentPhotos.length >= maxPhotos;
  if (els.uploadBtn) els.uploadBtn.disabled = isFull;
}

// 4. Delete Photo Logic
async function deletePhoto(index) {
  if (!confirm("Delete this photo?")) return;
  const photo = currentPhotos[index];

  // Remove from array locally
  currentPhotos.splice(index, 1);
  renderGallery();

  // If it has a storage path, delete from storage (optional, can do now or just leave orphan)
  if (photo.path) {
    setStatus("Deleting image...");
    try {
      const ref = storageRef(storage, photo.path);
      await deleteObject(ref);
    } catch (e) { console.warn("Storage delete failed", e); }
  }

  // Save profile to sync removal
  await saveProfile(true);
  showToast("Photo deleted.");
}

// 5. Upload Logic
async function handleFileUpload(file) {
  if (!currentUser) return setStatus("Please sign in.", true);
  setStatus("Uploading...");

  try {
    const path = `datingProfiles/${currentUser.uid}/${Date.now()}_${file.name}`;
    const ref = storageRef(storage, path);

    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);

    // Add to local state
    currentPhotos.push({ url, path });
    renderGallery();

    // Save
    await saveProfile(true);
    setStatus("Active");
    showToast("Photo uploaded successfully!");
  } catch (e) {
    console.error("Upload error details:", e);
    setStatus("Upload failed", true);
    showToast("Upload failed: " + e.message, 'error');
  }
}

// 6. Save Profile
async function saveProfile(silent = false) {
  if (!currentUser) return;
  if (!silent) setStatus("Saving...");

  const interests = (els.interests.value || '').split(',').map(s => s.trim()).filter(Boolean);

  const data = {
    displayName: els.displayName.value.trim(),
    age: els.age.value ? Number(els.age.value) : null,
    gender: els.gender.value,
    location: els.location.value.trim(),
    profession: els.profession.value.trim(),
    income: els.income.value, // NEW
    maritalStatus: els.maritalStatus.value,
    interests,
    bio: els.bio.value.trim(),
    isVisible: els.isVisible.checked,
    photos: currentPhotos,
    // Legacy support (use first photo as main avatar)
    photoURL: currentPhotos.length > 0 ? currentPhotos[0].url : null,
    uid: currentUser.uid,
    updatedAt: serverTimestamp()
  };

  try {
    if (currentProfileDocId) {
      await updateDoc(doc(db, 'datingProfiles', currentProfileDocId), data);
    } else {
      const ref = doc(db, 'datingProfiles', currentUser.uid);
      await setDoc(ref, { createdAt: serverTimestamp(), ...data }, { merge: true });
      currentProfileDocId = currentUser.uid;
    }
    if (!silent) {
      setStatus("Ready");
      showToast("Profile saved successfully!");
    }
  } catch (e) {
    console.error(e);
    setStatus("Error", true);
    if (!silent) showToast("Failed to save profile.", 'error');
  }
}

// 7. Event Listeners
if (els.uploadBtn) els.uploadBtn.addEventListener('click', () => els.photoFile.click());
if (els.photoFile) els.photoFile.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFileUpload(e.target.files[0]);
});
if (els.addUrlBtn) els.addUrlBtn.addEventListener('click', async () => {
  const url = els.photoURL.value.trim();
  if (!url) return;
  currentPhotos.push({ url, path: null });
  renderGallery();
  els.photoURL.value = '';
  await saveProfile(true);
  showToast("Photo URL added.");
});

if (els.saveBtn) els.saveBtn.addEventListener('click', () => saveProfile(false));

// Auth Init
onAuthStateChanged(auth, async user => {
  if (!user) {
    setStatus('Sign in required', true);
    currentUser = null;
    return;
  }
  currentUser = user;
  setStatus('Loading...');
  const found = await findProfileForUid(user.uid);
  if (found) {
    currentProfileDocId = found.docId;
    populateForm(found.data);
    setStatus('Ready');
  } else {
    // New user
    setStatus('New Profile');
  }
});
