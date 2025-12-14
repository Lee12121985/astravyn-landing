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
  nationality: el('nationality'), // NEW
  state: el('state'), // NEW
  city: el('city'), // NEW
  pincode: el('pincode'), // NEW
  profession: el('profession'),
  income: el('income'),
  height: el('height'), // NEW
  religion: el('religion'), // NEW
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
  saveStatus: el('save-status')
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

  // New Location Fields
  if (els.nationality) {
    els.nationality.value = data.nationality || '';
    // Trigger change to populate state
    els.nationality.dispatchEvent(new Event('change'));

    if (data.state && els.state) {
      els.state.value = data.state;
      // Trigger change to populate city
      els.state.dispatchEvent(new Event('change'));

      if (data.city && els.city) {
        els.city.value = data.city;
      }
    }
  }
  if (els.pincode) els.pincode.value = data.pincode || '';
  if (els.profession) els.profession.value = data.profession || '';
  if (els.income) els.income.value = data.income || '';
  if (els.height) els.height.value = data.height || ''; // NEW
  if (els.religion) els.religion.value = data.religion || ''; // NEW
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

    // 3. Update Profile Avatar Instantly (DOM)
    const navImg = document.getElementById('nav-avatar-img');
    const navWrap = document.getElementById('nav-avatar-photo');
    const navInit = document.getElementById('nav-avatar-initial');

    // Only update if this is the first photo (which becomes the main avatar)
    if (navImg && navWrap && navInit && currentPhotos.length === 1) {
      navImg.src = url;
      navWrap.style.display = ''; // visible
      navInit.style.display = 'none'; // hidden
    } else if (navImg && currentPhotos.length > 1) {
      // If we already have photos, maybe we don't force update avatar to the *new* one unless logic changes.
      // But user request says "Replace initial-letter avatar with uploaded image". 
      // This implies the case where it was initial-letter (0 photos).
      // If user wants NEW photo to always be avatar, we'd need to reorder array. 
      // For now, we assume the "no photo exists" case.
    }

    setStatus("Active");
    showToast("Profile photo updated successfully");
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
    income: els.income.value,
    height: els.height.value ? Number(els.height.value) : null, // NEW
    religion: els.religion.value, // NEW
    maritalStatus: els.maritalStatus.value,
    interests,
    bio: els.bio.value.trim(),
    isVisible: els.isVisible.checked,
    photos: currentPhotos,
    // Legacy support (use first photo as main avatar)
    photoURL: currentPhotos.length > 0 ? currentPhotos[0].url : null,
    uid: currentUser.uid,
    // Location Fields
    nationality: els.nationality.value,
    state: els.state.value,
    city: els.city.value,
    pincode: els.pincode.value,

    // Normalized fields for search
    gender_normalized: (els.gender.value || '').toLowerCase(),
    religion_normalized: (els.religion.value || '').toLowerCase(),
    city_normalized: els.city.value.trim().toLowerCase(), // Use specific city field
    displayNameLower: els.displayName.value.trim().toLowerCase(), // Derived field for search
    updatedAt: serverTimestamp()
  };

  try {
    if (!currentUser || !currentUser.uid) throw new Error("No user ID found for save");

    // ALWAYS use setDoc with merge:true to handle both Create and Update in one go
    // This ensures we write to the canonical 'datingProfiles' collection
    const ref = doc(db, 'datingProfiles', currentUser.uid);

    // Merge data. createdAt is only set if it doesn't exist (handled by merge? No, merge overwrites. 
    // But we are passing createdAt: serverTimestamp() every time here. 
    // Ideally we only set createdAt on creation. 
    // However, existing logic passed it. Let's keep it simple: setDoc with merge updates fields.

    await setDoc(ref, data, { merge: true });
    currentProfileDocId = currentUser.uid;

    if (!silent) {
      setStatus("Ready");
      showToast("Profile saved successfully!");
    }
  } catch (e) {
    console.error("Profile save failed:", e);
    setStatus("Error", true);
    if (!silent) showToast("Failed to save profile.", 'error');
  }
}

// --- Location Data & Logic ---
import { indianLocations } from './india-locations.js';

const locationData = {
  India: indianLocations,
  USA: {
    California: ["Los Angeles", "San Francisco", "San Diego"],
    NewYork: ["New York City", "Buffalo"],
    Texas: ["Houston", "Austin", "Dallas"]
  },
  UAE: {
    Dubai: ["Dubai"],
    AbuDhabi: ["Abu Dhabi"],
    Sharjah: ["Sharjah"]
  },
  UK: {
    London: ["London"],
    Manchester: ["Manchester"]
  },
  Canada: {
    Ontario: ["Toronto", "Ottawa"],
    BC: ["Vancouver", "Victoria"]
  },
  Australia: {
    NSW: ["Sydney"],
    Victoria: ["Melbourne"]
  }
};

function initLocationDropdowns() {
  const natSelect = els.nationality;
  const stateSelect = els.state;
  const citySelect = els.city;

  if (!natSelect || !stateSelect || !citySelect) return;

  // 1. Nationality Change
  natSelect.addEventListener('change', () => {
    const nat = natSelect.value;
    stateSelect.innerHTML = '<option value="">Select State</option>';
    citySelect.innerHTML = '<option value="">Select City</option>';
    citySelect.disabled = true;

    if (nat && locationData[nat]) {
      stateSelect.disabled = false;
      Object.keys(locationData[nat]).forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st.replace(/([A-Z])/g, ' $1').trim(); // Space out CamelCase if needed
        stateSelect.appendChild(opt);
      });
    } else {
      stateSelect.disabled = true;
    }
    // Auto-update hidden location field
    updateCombinedLocation();
  });

  // 2. State Change
  stateSelect.addEventListener('change', () => {
    const nat = natSelect.value;
    const st = stateSelect.value;
    citySelect.innerHTML = '<option value="">Select City</option>';

    if (nat && st && locationData[nat][st]) {
      citySelect.disabled = false;
      locationData[nat][st].forEach(ct => {
        const opt = document.createElement('option');
        opt.value = ct;
        opt.textContent = ct;
        citySelect.appendChild(opt);
      });
    } else {
      citySelect.disabled = true;
    }
    updateCombinedLocation();
  });

  // 3. City Change
  citySelect.addEventListener('change', updateCombinedLocation);
}

function updateCombinedLocation() {
  const city = els.city.value;
  // Fallback: if city selected, use it. Else state, else nationality.
  // Main location field used for simple display/search
  if (els.location) {
    els.location.value = city || els.state.value || els.nationality.value || '';
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

// Init Dropdowns
initLocationDropdowns();

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
