import { db, storage } from '../js/firebase-config.js';
import { requireAdmin } from '../js/auth.js';
import {
    collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, addDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {
    getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

// Storage imported from config

// ... (previous imports)

// DOM Elements
const usersBody = document.getElementById('users-body');
const profilesBody = document.getElementById('profiles-body');
const statusDiv = document.getElementById('status');
// Profiles
const profilesStatusDiv = document.getElementById('profiles-status');
const profilePhotoFileInput = document.getElementById('profile-photo-file'); // Move global for scope
let currentProfilePhotoFile = null;

// File input listener needs to be attached once
if (profilePhotoFileInput) {
    profilePhotoFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        currentProfilePhotoFile = file || null;
        if (file) {
            const img = document.getElementById('profile-photo-preview');
            if (img) {
                img.src = URL.createObjectURL(file);
                img.style.display = 'block';
            }
        }
    });

    const removeBtn = document.getElementById('profile-remove-photo');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            profilePhotoFileInput.value = '';
            currentProfilePhotoFile = null;
            document.getElementById('profile-photo-url').value = '';
            const img = document.getElementById('profile-photo-preview');
            if (img) {
                img.src = '';
                img.style.display = 'none';
            }
        });
    }
}


// Filters
const filterSearch = document.getElementById('filter-search');
const filterRole = document.getElementById('filter-role');
const filterBlock = document.getElementById('filter-block');

const profilesSearch = document.getElementById('profiles-search');
const profilesGender = document.getElementById('profiles-gender');
const profilesMarital = document.getElementById('profiles-marital');
const profilesVisible = document.getElementById('profiles-visible');

// Modal Elements
const profileModal = document.getElementById('profile-modal');
const profileForm = document.getElementById('profile-form');
const closeProfileModalBtn = document.getElementById('close-profile-modal');
const cancelProfileModalBtn = document.getElementById('cancel-profile-modal');

let allUsers = [];
let allProfiles = [];

// Pagination State
let userPage = 1;
let profilePage = 1;
const rowsPerPage = 10;

// Gallery State
let currentProfilePhotos = [];
const profileGalleryContainer = document.getElementById('profile-gallery-container');
const btnAddGalleryPhoto = document.getElementById('btn-add-gallery-photo');
const galleryUploadInput = document.getElementById('gallery-upload-input');


async function init() {
    try {
        await requireAdmin();

        // Setup Event Listeners
        document.getElementById('back-to-landing').addEventListener('click', () => window.location.href = '../index.html');

        // User Filters
        filterSearch.addEventListener('input', renderUsers);
        filterRole.addEventListener('change', renderUsers);
        filterBlock.addEventListener('change', renderUsers);

        // Profile Filters
        profilesSearch.addEventListener('input', renderProfiles);
        profilesGender.addEventListener('change', renderProfiles);
        profilesMarital.addEventListener('change', renderProfiles);
        profilesVisible.addEventListener('change', renderProfiles);

        // Modal
        closeProfileModalBtn.addEventListener('click', closeProfileModal);
        cancelProfileModalBtn.addEventListener('click', closeProfileModal);
        profileForm.addEventListener('submit', handleProfileSave);

        // Bulk Tools listeners
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                const file = csvInput.files?.[0];
                if (!file) {
                    setBulkStatus('Please choose a CSV file first.', true);
                    return;
                }

                setBulkStatus('Reading CSV file…');
                importBtn.disabled = true;
                if (deleteAllBtn) deleteAllBtn.disabled = true;

                try {
                    await importCsvFile(file);
                } finally {
                    importBtn.disabled = false;
                    if (deleteAllBtn) deleteAllBtn.disabled = false;
                }
            });
        }

        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', async () => {
                const ok = confirm(
                    'This will delete ALL documents in the "datingProfiles" collection.\nThis is irreversible. Do you want to continue?'
                );
                if (!ok) return;

                if (deleteAllBtn) deleteAllBtn.disabled = true;
                if (importBtn) importBtn.disabled = true;
                try {
                    await deleteAllDatingProfiles();
                } finally {
                    if (deleteAllBtn) deleteAllBtn.disabled = false;
                    if (importBtn) importBtn.disabled = false;
                }
            });
        }

        // Load Data
        await Promise.all([loadUsers(), loadDatingProfiles()]);

    } catch (error) {
        console.error(error);
        // requireAdmin handles redirect
    }
}

async function loadUsers() {
    statusDiv.textContent = 'Loading users...';
    try {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        allUsers = [];
        snapshot.forEach(doc => allUsers.push({ uid: doc.id, ...doc.data() }));

        document.getElementById('sum-total').textContent = allUsers.length;
        document.getElementById('sum-admins').textContent = allUsers.filter(u => u.role === 'admin').length;
        document.getElementById('sum-blocked').textContent = allUsers.filter(u => u.isBlocked).length;

        renderUsers();
        statusDiv.textContent = `${allUsers.length} users loaded.`;

    } catch (error) {
        console.error("Error loading users:", error);
        statusDiv.textContent = 'Error loading users.';
        statusDiv.classList.add('error');
    }
}

function renderUsers() {
    const term = filterSearch.value.toLowerCase();
    const role = filterRole.value;
    const block = filterBlock.value;

    const filtered = allUsers.filter(user => {
        const matchesTerm = (user.email || '').toLowerCase().includes(term) || (user.displayName || '').toLowerCase().includes(term);
        const matchesRole = role === 'all' || user.role === role;
        const matchesBlock = block === 'all' ||
            (block === 'blocked' && user.isBlocked) ||
            (block === 'active' && !user.isBlocked);
        return matchesTerm && matchesRole && matchesBlock;
    });

    if (filtered.length === 0) {
        usersBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No matching users.</td></tr>';
        document.getElementById('users-pagination').innerHTML = '';
        return;
    }

    // Pagination Slice
    const start = (userPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filtered.slice(start, end);

    renderPagination('users-pagination', filtered.length, userPage, (newPage) => {
        userPage = newPage;
        renderUsers();
    });

    usersBody.innerHTML = pageData.map(user => {
        const created = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        return `
            <tr>
                <td>
                    <div style="font-weight:600">${user.displayName || 'No Name'}</div>
                    <div style="font-size:12px; color:#6b7280">${user.email}</div>
                </td>
                <td>
                    <span class="badge-role ${user.role || 'user'}">${user.role || 'user'}</span>
                </td>
                <td>
                    <span class="badge-blocked ${user.isBlocked}">
                        ${user.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                </td>
                <td>${created}</td>
                <td>
                    <button class="btn-small" onclick="window.toggleBlock('${user.uid}', ${user.isBlocked})">
                        ${user.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <button class="btn-small" onclick="window.toggleRole('${user.uid}', '${user.role || 'user'}')">
                        ${user.role === 'admin' ? 'Demote' : 'Make Admin'}
                    </button>
                    <button class="btn-small btn-danger" onclick="window.deleteUser('${user.uid}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPagination(containerId, totalItems, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button class="btn-small" ${currentPage === 1 ? 'disabled' : ''} id="${containerId}-prev">Prev</button>
        <span style="font-size:12px;color:#cbd5e1;">Page ${currentPage} of ${totalPages}</span>
        <button class="btn-small" ${currentPage === totalPages ? 'disabled' : ''} id="${containerId}-next">Next</button>
    `;

    document.getElementById(`${containerId}-prev`).onclick = () => onPageChange(currentPage - 1);
    document.getElementById(`${containerId}-next`).onclick = () => onPageChange(currentPage + 1);
}



// --- Dating Profiles Logic ---

async function loadDatingProfiles() {
    profilesStatusDiv.textContent = 'Loading dating profiles...';
    try {
        const q = query(collection(db, "datingProfiles"), orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        allProfiles = [];
        snapshot.forEach(doc => allProfiles.push({ docId: doc.id, ...doc.data() }));

        document.getElementById('sum-dating-visible').textContent = allProfiles.filter(p => p.isVisible).length;

        renderProfiles();
        profilesStatusDiv.textContent = `${allProfiles.length} profiles loaded.`;

    } catch (error) {
        console.error("Error loading profiles:", error);
        profilesStatusDiv.textContent = 'Error loading profiles.';
        profilesStatusDiv.classList.add('error');
    }
}

function renderProfiles() {
    const term = profilesSearch.value.toLowerCase();
    const gender = profilesGender.value;
    const marital = profilesMarital.value;
    const vis = profilesVisible.value;

    const filtered = allProfiles.filter(p => {
        const matchesTerm = (p.displayName || '').toLowerCase().includes(term) || (p.location || '').toLowerCase().includes(term);
        const matchesGender = gender === 'all' || (p.gender || '').toLowerCase() === gender;
        const matchesMarital = marital === 'all' || (p.maritalStatus || '').toLowerCase() === marital;
        const matchesVis = vis === 'all' ||
            (vis === 'visible' && p.isVisible) ||
            (vis === 'hidden' && !p.isVisible);
        return matchesTerm && matchesGender && matchesMarital && matchesVis;
    });

    if (filtered.length === 0) {
        profilesBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No matching profiles.</td></tr>';
        document.getElementById('profiles-pagination').innerHTML = '';
        return;
    }

    // Pagination Slice
    const start = (profilePage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filtered.slice(start, end);

    renderPagination('profiles-pagination', filtered.length, profilePage, (newPage) => {
        profilePage = newPage;
        renderProfiles();
    });

    profilesBody.innerHTML = pageData.map(p => {
        const interests = Array.isArray(p.interests) ? p.interests.join(', ') : (p.interests || '');
        return `
            <tr class="profile-row">
                <td>
                    <div style="font-weight:600">${p.displayName || 'Unnamed'}</div>
                    <div style="font-size:11px;color:#6b7280">${p.docId}</div>
                </td>
                <td>${p.age || '-'}</td>
                <td>${p.gender || '-'}</td>
                <td>${p.maritalStatus || '-'}</td>
                <td>${p.location || '-'}</td>
                <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis;">${interests}</td>
                <td>
                    <span class="badge-visible ${p.isVisible}">
                        ${p.isVisible ? 'Visible' : 'Hidden'}
                    </span>
                </td>
                <td>
                    <button class="btn-small" onclick="window.editProfile('${p.docId}')">Edit</button>
                    <button class="btn-small" onclick="window.toggleProfileVisibility('${p.docId}', ${p.isVisible})">
                        ${p.isVisible ? 'Hide' : 'Show'}
                    </button>
                    <button class="btn-small btn-danger" onclick="window.deleteProfile('${p.docId}')" style="margin-left:4px;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Profile Actions & Modal ---

window.editProfile = (docId) => {
    const p = allProfiles.find(x => x.docId === docId);
    if (!p) return;

    currentProfilePhotoFile = null; // Reset file
    if (profilePhotoFileInput) profilePhotoFileInput.value = ''; // Reset input


    // Populate Modal
    document.getElementById('profile-modal-title').textContent = `Edit Profile: ${p.displayName}`;
    document.getElementById('profile-name').value = p.displayName || '';
    document.getElementById('profile-age').value = p.age || '';
    document.getElementById('profile-gender').value = (p.gender || '').toLowerCase(); // Try to match value
    document.getElementById('profile-marital').value = (p.maritalStatus || '').toLowerCase();
    document.getElementById('profile-location').value = p.location || '';
    document.getElementById('profile-pincode').value = p.pincode || '';
    document.getElementById('profile-bio').value = p.bio || '';
    document.getElementById('profile-interests').value = Array.isArray(p.interests) ? p.interests.join(', ') : (p.interests || '');
    document.getElementById('profile-visible').checked = !!p.isVisible;
    document.getElementById('profile-uid').value = p.uid || '';
    document.getElementById('profile-docid').value = docId;

    // Photo preview
    const img = document.getElementById('profile-photo-preview');
    if (p.photoURL) {
        img.src = p.photoURL;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
        img.src = '';
    }

    // Gallery Logic
    currentProfilePhotos = p.photos || [];
    renderGallery();

    profileModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
};

function renderGallery() {
    if (!profileGalleryContainer) return;
    profileGalleryContainer.innerHTML = '';
    currentProfilePhotos.forEach((photo, idx) => {
        const url = typeof photo === 'string' ? photo : photo.url;
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.innerHTML = `
            <img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #334155;">
            <button class="btn-small btn-danger" style="position:absolute;top:-5px;right:-5px;padding:2px 4px;font-size:9px;line-height:1;border-radius:50%;" data-idx="${idx}">x</button>
        `;
        div.querySelector('button').onclick = () => {
            if (confirm('Remove this photo from gallery?')) {
                currentProfilePhotos.splice(idx, 1);
                renderGallery();
            }
        };
        profileGalleryContainer.appendChild(div);
    });
}

// Gallery Upload Listener
if (btnAddGalleryPhoto && galleryUploadInput) {
    btnAddGalleryPhoto.onclick = () => galleryUploadInput.click();
    galleryUploadInput.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        btnAddGalleryPhoto.textContent = "Uploading...";
        btnAddGalleryPhoto.disabled = true;

        try {
            // We need docId to create a path. Use the hidden input value.
            const docId = document.getElementById('profile-docid').value || 'temp-' + Date.now();
            const path = `datingProfiles/${docId}/gallery-${Date.now()}`;
            const refObj = storageRef(storage, path);
            await uploadBytes(refObj, file);
            const url = await getDownloadURL(refObj);

            // Add { url } object as standard for photos array
            currentProfilePhotos.push({ url, createdAt: Date.now() });
            renderGallery();
            galleryUploadInput.value = ''; // reset
            showToast("Photo added to gallery");
        } catch (err) {
            showToast("Gallery upload failed: " + err.message, 'error');
        } finally {
            btnAddGalleryPhoto.textContent = "+ Add to Gallery";
            btnAddGalleryPhoto.disabled = false;
        }
    };
}


function closeProfileModal() {
    profileModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    profileForm.reset();
}

async function handleProfileSave(e) {
    e.preventDefault();
    const docId = document.getElementById('profile-docid').value;
    if (!docId) return;

    const updates = {
        displayName: document.getElementById('profile-name').value,
        age: Number(document.getElementById('profile-age').value),
        gender: document.getElementById('profile-gender').value,
        maritalStatus: document.getElementById('profile-marital').value,
        location: document.getElementById('profile-location').value,
        pincode: document.getElementById('profile-pincode').value,
        bio: document.getElementById('profile-bio').value,
        interests: document.getElementById('profile-interests').value.split(',').map(s => s.trim()).filter(Boolean),
        isVisible: document.getElementById('profile-visible').checked,
        photos: currentProfilePhotos,
    };

    // Photo Upload Logic
    if (currentProfilePhotoFile) {
        profilesStatusDiv.textContent = 'Uploading photo...';
        try {
            const path = `datingProfiles/${docId}-${Date.now()}`;
            const refObj = storageRef(storage, path);
            await uploadBytes(refObj, currentProfilePhotoFile);
            const url = await getDownloadURL(refObj);
            updates.photoURL = url;
        } catch (err) {
            console.error("Photo upload failed", err);
            showToast("Photo upload failed: " + err.message, 'error');
            // continue updating other fields? maybe stop.
            profilesStatusDiv.textContent = 'Upload failed.';
            return;
        }
    }


    // Check if manual photo URL provided
    const manualUrl = document.getElementById('profile-photo-url').value.trim();
    if (manualUrl) {
        updates.photoURL = manualUrl;
    }

    try {
        await updateDoc(doc(db, "datingProfiles", docId), updates);
        closeProfileModal();
        loadDatingProfiles(); // reload
    } catch (err) {
        alert("Error saving profile: " + err.message);
    }
}

window.toggleProfileVisibility = async (docId, currentVal) => {
    try {
        await updateDoc(doc(db, "datingProfiles", docId), { isVisible: !currentVal });
        loadDatingProfiles();
    } catch (e) { alert(e.message); }
};


// ... (Existing Photo Viewer Logic Remains) ...

// ... (previous code)

// --- CSV Import & Bulk Delete ---

const csvInput = document.getElementById('csv-file');
const importBtn = document.getElementById('btn-import-csv');
const deleteAllBtn = document.getElementById('btn-delete-all');
const bulkStatusEl = document.getElementById('bulk-status');

function setBulkStatus(msg, isError = false) {
    if (bulkStatusEl) {
        bulkStatusEl.textContent = msg;
        bulkStatusEl.classList.toggle('error', isError);
    }
}

function parseBoolean(val, def = true) {
    if (val === undefined || val === null) return def;
    const s = String(val).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(s)) return true;
    if (['false', '0', 'no', 'n'].includes(s)) return false;
    return def;
}

function parseInterests(str) {
    if (!str) return [];
    return String(str)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
}

async function importCsvFile(file) {
    return new Promise((resolve, reject) => {
        // Papa is global from CDN
        if (!window.Papa) {
            reject(new Error("PapaParse not loaded"));
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const rows = results.data || [];
                    if (!rows.length) {
                        setBulkStatus('CSV has no data rows.', true);
                        return resolve();
                    }

                    setBulkStatus(`Parsed ${rows.length} rows. Starting import…`);
                    let imported = 0;

                    for (const row of rows) {
                        const displayName = (row.displayName || '').toString().trim();
                        if (!displayName) continue;

                        const age = row.age ? parseInt(row.age, 10) : null;
                        const gender = (row.gender || '').toString().trim().toLowerCase() || null;
                        const maritalStatus = (row.maritalStatus || '').toString().trim().toLowerCase() || null;
                        const location = (row.location || '').toString().trim();
                        const pincode = row.pincode ? row.pincode.toString().trim() : '';
                        const bio = (row.bio || '').toString().trim();
                        const interests = parseInterests(row.interests);
                        const isVisible = parseBoolean(row.isVisible, true);
                        const uid = (row.uid || '').toString().trim() || null;
                        const photoURL = (row.photoURL || '').toString().trim();

                        const data = {
                            uid: uid || null,
                            displayName,
                            age: Number.isFinite(age) ? age : null,
                            gender,
                            maritalStatus,
                            location,
                            pincode,
                            bio,
                            interests,
                            isVisible,
                            photoURL,
                            updatedAt: serverTimestamp()
                        };

                        if (!uid) {
                            data.createdAt = serverTimestamp();
                            await addDoc(collection(db, 'datingProfiles'), data);
                        } else {
                            const ref = doc(db, 'datingProfiles', uid);
                            await setDoc(ref, { createdAt: serverTimestamp(), ...data }, { merge: true });
                        }

                        imported += 1;
                        if (imported % 10 === 0) {
                            setBulkStatus(`Imported ${imported} of ${rows.length} rows…`);
                        }
                    }

                    setBulkStatus(`Import finished. Imported ${imported} of ${rows.length} rows.`);
                    await loadDatingProfiles();
                    resolve();
                } catch (err) {
                    console.error('Import error:', err);
                    setBulkStatus('Import failed. Check console for details.', true);
                    reject(err);
                }
            },
            error: (err) => {
                console.error('Papa parse error:', err);
                setBulkStatus('Could not read CSV file.', true);
                reject(err);
            }
        });
    });
}

// Bulk Delete Logic
async function deleteAllDatingProfiles() {
    setBulkStatus('Fetching datingProfiles documents…');
    const snap = await getDocs(collection(db, 'datingProfiles'));

    if (snap.empty) {
        setBulkStatus('No documents in datingProfiles to delete.');
        return;
    }

    let count = 0;
    for (const docSnap of snap.docs) {
        await deleteDoc(docSnap.ref);
        count += 1;
        if (count % 20 === 0) {
            setBulkStatus(`Deleted ${count} of ${snap.size} documents…`);
        }
    }

    setBulkStatus(`Finished deleting ${count} datingProfiles documents.`);
    await loadDatingProfiles();
}


// Re-expose legacy window functions needed for HTML onclicks

window.toggleBlock = async (uid, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'unblock' : 'block'} this user?`)) return;
    try {
        await updateDoc(doc(db, "users", uid), { isBlocked: !currentStatus });
        loadUsers();
    } catch (e) { alert(e.message); }
};

window.toggleRole = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role to ${newRole}?`)) return;
    try {
        await updateDoc(doc(db, "users", uid), { role: newRole });
        loadUsers();
    } catch (e) { alert(e.message); }
};

window.deleteUser = async (uid) => {
    if (!confirm('Are you sure? This will delete the user data from Firestore. The Auth account will remain but they will be effectively blocked.')) return;
    try {
        await deleteDoc(doc(db, "users", uid));
        try { await deleteDoc(doc(db, "datingProfiles", uid)); } catch (e) { }
        loadUsers();
        loadDatingProfiles();
        showToast("User deleted from Firestore.");
    } catch (e) { showToast(e.message, 'error'); }
};

window.deleteProfile = async (docId) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this dating profile?')) return;
    try {
        await deleteDoc(doc(db, "datingProfiles", docId));
        // Also try to delete from users if it matches? No, maybe they want to keep the account but remove profile.
        // Usually 1:1, but let's stick to just profile.
        loadDatingProfiles();
        showToast("Profile deleted successfully.");
    } catch (e) { showToast(e.message, 'error'); }
};


init();
