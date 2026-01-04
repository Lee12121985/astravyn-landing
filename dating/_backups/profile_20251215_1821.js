// dating/profile.js
// Profile editor – FINAL, CLEAN, SAFE VERSION

import { auth, db, storage } from '../js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

const el = id => document.getElementById(id);

/* ===============================
   ELEMENT REFERENCES
   =============================== */
const els = {
  displayName: el('displayName'),
  age: el('age'),
  gender: el('gender'),
  location: el('location'),
  profession: el('profession'),
  income: el('income'),
  height: el('height'),
  religion: el('religion'),
  maritalStatus: el('maritalStatus'),
  interests: el('interests'),
  bio: el('bio'),
  isVisible: el('isVisible'),

  galleryGrid: el('photo-gallery-grid'),
  photoFile: el('photoFile'),
  uploadBtn: el('uploadPhotoBtn'),
  photoURL: el('photoURL'),
  addUrlBtn: el('addUrlBtn'),
  saveBtn: el('saveProfile')
};

let currentUser = null;
let currentPhotos = []; // [{ url, path }]

/* ===============================
   TOAST
   =============================== */
function toast(msg, error = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:20px; right:20px;
    background:${error ? '#ef4444' : '#10b981'};
    color:#fff; padding:12px 18px;
    border-radius:8px; z-index:9999;
    font-weight:600;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ===============================
   LOAD PROFILE
   =============================== */
async function loadProfile(uid) {
  const snap = await getDoc(doc(db, 'datingProfiles', uid));
  if (!snap.exists()) return;

  const data = snap.data();

  els.displayName.value = data.displayName || '';
  els.age.value = data.age || '';
  els.gender.value = data.gender || '';
  els.location.value = data.location || '';
  els.profession.value = data.profession || '';
  els.income.value = data.income || '';
  els.height.value = data.height || '';
  els.religion.value = data.religion || '';
  els.maritalStatus.value = data.maritalStatus || '';
  els.bio.value = data.bio || '';
  els.isVisible.checked = !!data.isVisible;
  els.interests.value = (data.interests || []).join(', ');

  /* BACKWARD-COMPATIBLE PHOTO LOAD */
  currentPhotos = [];
  if (Array.isArray(data.photos) && data.photos.length) {
    currentPhotos = data.photos.filter(p => p && p.url);
  } else if (data.photoURL) {
    currentPhotos = [{ url: data.photoURL, path: null }];
  }

  renderGallery();
}

/* ===============================
   RENDER GALLERY
   =============================== */
function renderGallery() {
  els.galleryGrid.innerHTML = '';
  const MAX = 5;

  currentPhotos.forEach((photo, index) => {
    const slot = document.createElement('div');
    slot.className = 'photo-slot';

    slot.innerHTML = `
      <img src="${photo.url}" />
      <button class="photo-delete-btn">×</button>
    `;

    slot.querySelector('.photo-delete-btn').onclick = e => {
      e.stopPropagation();
      deletePhoto(index);
    };

    els.galleryGrid.appendChild(slot);
  });

  for (let i = currentPhotos.length; i < MAX; i++) {
    const empty = document.createElement('div');
    empty.className = 'photo-slot';
    empty.innerHTML = `<span style="font-size:1.5rem;opacity:.3">+</span>`;
    empty.onclick = () => els.photoFile.click();
    els.galleryGrid.appendChild(empty);
  }
}

/* ===============================
   UPLOAD PHOTO
   =============================== */
async function uploadPhoto(file) {
  if (!file || !currentUser) return;

  const path = `datingProfiles/${currentUser.uid}/${Date.now()}_${file.name}`;
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);

  currentPhotos.push({ url, path });
  await saveProfile(true);
  renderGallery();
  toast('Photo uploaded');
}

/* ===============================
   DELETE PHOTO (FIXED)
   =============================== */
async function deletePhoto(index) {
  if (!confirm('Delete this photo?')) return;

  const photo = currentPhotos[index];
  if (!photo) return;

  if (photo.path) {
    try {
      await deleteObject(storageRef(storage, photo.path));
    } catch (e) {
      if (e.code !== 'storage/object-not-found') console.warn(e);
    }
  }

  currentPhotos.splice(index, 1);
  await saveProfile(true);
  renderGallery();
  toast('Photo deleted');
}

/* ===============================
   SAVE PROFILE
   =============================== */
async function saveProfile(silent = false) {
  if (!currentUser) return;

  const data = {
    displayName: els.displayName.value.trim(),
    age: els.age.value ? Number(els.age.value) : null,
    gender: els.gender.value,
    location: els.location.value.trim(),
    profession: els.profession.value.trim(),
    income: els.income.value,
    height: els.height.value ? Number(els.height.value) : null,
    religion: els.religion.value,
    maritalStatus: els.maritalStatus.value,
    interests: els.interests.value.split(',').map(s => s.trim()).filter(Boolean),
    bio: els.bio.value.trim(),
    isVisible: els.isVisible.checked,
    photos: currentPhotos,
    photoURL: currentPhotos[0]?.url || null,
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'datingProfiles', currentUser.uid), data, { merge: true });
  if (!silent) toast('Profile saved');
}

/* ===============================
   EVENTS
   =============================== */
els.uploadBtn?.addEventListener('click', () => els.photoFile.click());
els.photoFile?.addEventListener('change', e => uploadPhoto(e.target.files[0]));

els.addUrlBtn?.addEventListener('click', async () => {
  const url = els.photoURL.value.trim();
  if (!url) return;
  currentPhotos.push({ url, path: null });
  els.photoURL.value = '';
  await saveProfile(true);
  renderGallery();
  toast('Photo added');
});

els.saveBtn?.addEventListener('click', () => saveProfile());

/* ===============================
   AUTH INIT
   =============================== */
onAuthStateChanged(auth, user => {
  if (!user) return;
  currentUser = user;
  loadProfile(user.uid);
});
