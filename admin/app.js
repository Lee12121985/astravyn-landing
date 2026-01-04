import { db, storage } from '../js/firebase-config.js';
import { requireAdmin } from '../js/auth.js';
import { collection, getDocs, doc, updateDoc, deleteDoc, arrayRemove, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

requireAdmin(); // block non-admin

const tabs = document.querySelectorAll('.sidebar button');
const sections = document.querySelectorAll('.tab');

tabs.forEach(btn => {
	btn.onclick = () => {
		sections.forEach(s => s.classList.remove('active'));
		document.getElementById(btn.dataset.tab).classList.add('active');
	};
});

// GLOBAL STATE
let allProfiles = [];
let filteredProfiles = [];
let currentEditingId = null;

// Photo State
let currentPhotos = []; // Strings (URLs)
let pendingUploads = []; // File Objects
const MAX_PHOTOS = 5;

// Sort State
let sortState = { field: null, direction: 'asc' };

// KPI COUNTS
async function loadCounts() {
	document.getElementById('totalUsers').innerText = (await getDocs(collection(db, 'users'))).size;
	document.getElementById('totalProfiles').innerText = (await getDocs(collection(db, 'datingProfiles'))).size;
	document.getElementById('totalLikes').innerText = (await getDocs(collection(db, 'likes'))).size;
	document.getElementById('totalConnections').innerText = (await getDocs(collection(db, 'connections'))).size;
}

// --- PROFILES LOGIC ---

async function loadProfiles() {
	const snap = await getDocs(collection(db, 'datingProfiles'));
	allProfiles = [];
	snap.forEach(d => {
		allProfiles.push({ id: d.id, ...d.data() });
	});
	filteredProfiles = [...allProfiles];
	applySort(); // apply initial (or none) sort
	renderProfiles();
}

function renderProfiles() {
	const list = filteredProfiles;
	const body = document.getElementById('profilesBody');
	if (!body) return;
	body.innerHTML = '';

	list.forEach(p => {
		const tr = document.createElement('tr');
		tr.className = 'clickable-row';

		// Determine thumbnail (try photos[0] -> photoURL -> placeholder)
		let thumb = null;
		if (p.photos && p.photos.length > 0) thumb = p.photos[0].url;
		else if (p.photoURL) thumb = p.photoURL;

		tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#334155;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">
             ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;">` : (p.displayName?.[0] || '?')}
          </div>
          <span>${escapeHtml(p.displayName || '-')}</span>
        </div>
      </td>
      <td>${escapeHtml(p.gender || '-')}</td>
      <td>${p.age || '-'}</td>
      <td>${escapeHtml(p.location || '-')}</td>
      <td>
        <span style="padding:4px 8px;border-radius:4px;font-size:12px;background:${p.isVisible ? 'rgba(34,197,94,0.2)' : 'rgba(71,85,105,0.4)'};color:${p.isVisible ? '#4ade80' : '#94a3b8'}">
          ${p.isVisible ? 'Visible' : 'Hidden'}
        </span>
      </td>
    `;
		tr.onclick = () => openModal(p);
		body.appendChild(tr);
	});
}

function escapeHtml(text) {
	if (!text) return '';
	return text.toString().replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// --- SORT LOGIC ---
document.querySelectorAll('th[data-sort]').forEach(th => {
	th.onclick = () => {
		const field = th.dataset.sort;
		// Toggle direction if same field, else default asc
		if (sortState.field === field) {
			sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
		} else {
			sortState.field = field;
			sortState.direction = 'asc';
		}

		// Update UI Icons
		document.querySelectorAll('th').forEach(t => t.className = '');
		th.className = `sorted-${sortState.direction}`;

		applySort();
		renderProfiles();
	};
});

function applySort() {
	if (!sortState.field) return;

	filteredProfiles.sort((a, b) => {
		let valA = a[sortState.field];
		let valB = b[sortState.field];

		// Handle nulls
		if (valA === undefined || valA === null) valA = '';
		if (valB === undefined || valB === null) valB = '';

		// Numeric sort for Age
		if (sortState.field === 'age') {
			valA = Number(valA) || 0;
			valB = Number(valB) || 0;
		} else {
			valA = valA.toString().toLowerCase();
			valB = valB.toString().toLowerCase();
		}

		if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
		if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
		return 0;
	});
}


// --- SEARCH LOGIC ---
const searchInput = document.getElementById('profileSearch');
if (searchInput) {
	searchInput.addEventListener('input', (e) => {
		const term = e.target.value.toLowerCase();
		// Filter from *allProfiles* source
		filteredProfiles = allProfiles.filter(p =>
			(p.displayName || '').toLowerCase().includes(term) ||
			(p.location || '').toLowerCase().includes(term) ||
			(p.profession || '').toLowerCase().includes(term)
		);
		// Re-apply sort if active
		applySort();
		renderProfiles();
	});
}

// --- MODAL LOGIC ---
const modal = document.getElementById('editModal');
const btnClose = document.getElementById('btnCloseModal');
const btnCancel = document.getElementById('btnCancel');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById('btnDelete');
const btnAddPhoto = document.getElementById('btnAddPhoto');
const fileInput = document.getElementById('modalPhotoInput');
const photoGrid = document.getElementById('modalPhotoGrid');

function openModal(p) {
	currentEditingId = p.id;
	pendingUploads = []; // Reset

	// Init Photos: Prefer 'photos' array, fallback to 'photoURL'
	currentPhotos = [];
	if (p.photos && Array.isArray(p.photos)) {
		// Extract URLs if object {url: ...} or string
		currentPhotos = p.photos.map(x => (typeof x === 'object' ? x.url : x));
	} else if (p.photoURL) {
		currentPhotos = [p.photoURL];
	}

	// Fill Fields
	document.getElementById('inpName').value = p.displayName || '';
	document.getElementById('inpAge').value = p.age || '';
	document.getElementById('inpGender').value = p.gender || 'Male';
	document.getElementById('inpLocation').value = p.location || '';
	document.getElementById('inpProfession').value = p.profession || '';
	document.getElementById('inpBio').value = p.bio || '';
	document.getElementById('inpInterests').value = Array.isArray(p.interests) ? p.interests.join(', ') : (p.interests || '');
	document.getElementById('inpVisible').checked = !!p.isVisible;

	renderPhotoGrid();
	modal.classList.add('open');
}

function closeModal() {
	modal.classList.remove('open');
	currentEditingId = null;
	pendingUploads = [];
	currentPhotos = [];
}

// ADMIN PHOTO DELETE LOGIC
async function deleteAdminPhoto(url, index) {
	if (!confirm("Permanently delete this photo from storage and database?")) return;

	try {
		// 1. Delete from Storage
		const sRef = ref(storage, url);
		await deleteObject(sRef).catch(err => console.warn("Admin delete warning:", err));

		// 2. Remove from Firestore array
		// We need to fetch the doc again to get the exact object to remove, or filter and update.
		// Filtering is safer if we don't have the object.
		const dRef = doc(db, 'datingProfiles', currentEditingId);
		const snap = await getDoc(dRef);
		if (snap.exists()) {
			const data = snap.data();
			const existingPhotos = data.photos || [];
			// Filter out any photo that matches the URL
			const newPhotos = existingPhotos.filter(p => {
				const pUrl = typeof p === 'object' ? p.url : p;
				return pUrl !== url;
			});

			await updateDoc(dRef, { photos: newPhotos });

			// If simple photoURL was this one, clear it
			if (data.photoURL === url) {
				await updateDoc(dRef, { photoURL: (newPhotos.length > 0 ? (newPhotos[0].url || newPhotos[0]) : "") });
			}
		}

		// 3. Update UI
		currentPhotos.splice(index, 1);
		renderPhotoGrid();
		showToast("Photo deleted", "success");

	} catch (err) {
		console.error("Admin delete failed:", err);
		showToast("Deletion failed: " + err.message, "error");
	}
}

// Renders Current URLs + Pending Files
function renderPhotoGrid() {
	photoGrid.innerHTML = '';

	// 1. Render Current Photos (URLs)
	currentPhotos.forEach((url, idx) => {
		const div = document.createElement('div');
		div.className = `photo-item ${idx === 0 ? 'main' : ''}`;
		div.innerHTML = `
      <img src="${url}">
      <button class="photo-remove" data-idx="${idx}" data-type="url">×</button>
      ${idx === 0 ? '<div class="main-label">MAIN</div>' : ''}
    `;
		photoGrid.appendChild(div);
	});

	// 2. Render Pending Uploads (Files)
	pendingUploads.forEach((file, idx) => {
		// Create temp URL for preview
		const tempUrl = URL.createObjectURL(file);
		const div = document.createElement('div');
		div.className = 'photo-item sending';
		div.innerHTML = `
      <img src="${tempUrl}" style="opacity:0.7">
      <button class="photo-remove" data-idx="${idx}" data-type="file">×</button>
      <div style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,0.5);color:white;font-size:10px;padding:2px 4px;border-radius:3px;">New</div>
    `;
		photoGrid.appendChild(div);
	});

	// Attach Remove Listeners
	photoGrid.querySelectorAll('.photo-remove').forEach(btn => {
		btn.onclick = (e) => {
			const type = btn.dataset.type;
			const idx = parseInt(btn.dataset.idx);
			if (type === 'url') {
				// Invoke async delete
				deleteAdminPhoto(currentPhotos[idx], idx);
			} else {
				// Just remove pending file
				pendingUploads.splice(idx, 1);
				renderPhotoGrid();
			}
		};
	});
}


if (btnClose) btnClose.onclick = closeModal;
if (btnCancel) btnCancel.onclick = closeModal;

if (btnAddPhoto) {
	btnAddPhoto.onclick = () => {
		const totalCurrent = currentPhotos.length + pendingUploads.length;
		if (totalCurrent >= MAX_PHOTOS) {
			showToast(`Maximum ${MAX_PHOTOS} photos allowed`, "error");
			return;
		}
		fileInput.click();
	};
}

if (fileInput) {
	fileInput.onchange = (e) => {
		if (e.target.files && e.target.files.length > 0) {
			// Add files up to limit
			for (const file of e.target.files) {
				const totalCurrent = currentPhotos.length + pendingUploads.length;
				if (totalCurrent >= MAX_PHOTOS) {
					showToast("Limit reached, some photos ignored", "error");
					break;
				}
				pendingUploads.push(file);
			}
			renderPhotoGrid();
			// Reset input so same file selection works again if needed
			fileInput.value = '';
		}
	};
}

if (btnSave) {
	btnSave.onclick = async () => {
		if (!currentEditingId) return;

		const btn = btnSave;
		const originalText = btn.innerText;
		btn.innerText = "Saving...";
		btn.disabled = true;

		try {
			const updates = {
				displayName: document.getElementById('inpName').value,
				age: parseInt(document.getElementById('inpAge').value) || 0,
				gender: document.getElementById('inpGender').value,
				location: document.getElementById('inpLocation').value,
				profession: document.getElementById('inpProfession').value,
				bio: document.getElementById('inpBio').value,
				interests: document.getElementById('inpInterests').value.split(',').map(s => s.trim()).filter(Boolean),
				isVisible: document.getElementById('inpVisible').checked
			};

			// 1. Process New Uploads
			let finalPhotos = [...currentPhotos]; // Start with existing URLs (that weren't removed)

			if (pendingUploads.length > 0) {
				// Upload each file
				for (const file of pendingUploads) {
					const storageRef = ref(storage, `profile_photos/${currentEditingId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
					await uploadBytes(storageRef, file);
					const url = await getDownloadURL(storageRef);
					finalPhotos.push(url);
				}
			}

			// 2. Prepare Photo Fields
			// Save as array of objects {url: ...} to match frontend expectation
			// Or strings? Frontend check: `if (profile.photos && profile.photos.length > 0) mainPhoto = profile.photos[0].url;`
			// So frontend expects array of OBJECTS with 'url' prop.

			const photosObjectArray = finalPhotos.map(u => ({ url: u }));

			updates.photos = photosObjectArray;

			// Sync main photoURL
			if (photosObjectArray.length > 0) {
				updates.photoURL = photosObjectArray[0].url;
			} else {
				updates.photoURL = "";
			}

			await updateDoc(doc(db, 'datingProfiles', currentEditingId), updates);

			// Update Local State for immediate UI refresh
			const idx = allProfiles.findIndex(p => p.id === currentEditingId);
			if (idx !== -1) {
				allProfiles[idx] = { ...allProfiles[idx], ...updates };
				// Re-filter and sort
				const term = searchInput ? searchInput.value.toLowerCase() : '';
				filteredProfiles = allProfiles.filter(p =>
					(p.displayName || '').toLowerCase().includes(term) ||
					(p.location || '').toLowerCase().includes(term) ||
					(p.profession || '').toLowerCase().includes(term)
				);
				applySort();
				renderProfiles();
			}

			showToast("Profile updated successfully", "success");
			closeModal();

		} catch (err) {
			console.error(err);
			showToast("Failed to update profile", "error");
		} finally {
			btn.innerText = originalText;
			btn.disabled = false;
		}
	};
}

if (btnDelete) {
	btnDelete.onclick = async () => {
		if (!confirm("Are you sure you want to delete this profile?")) return;

		try {
			await deleteDoc(doc(db, 'datingProfiles', currentEditingId));

			// Update Local
			allProfiles = allProfiles.filter(p => p.id !== currentEditingId);
			filteredProfiles = filteredProfiles.filter(p => p.id !== currentEditingId);
			applySort();
			renderProfiles();

			showToast("Profile deleted", "success");
			closeModal();
			loadCounts(); // Refresh counts
		} catch (err) {
			console.error(err);
			showToast("Delete failed", "error");
		}
	};
}

// TOAST
function showToast(msg, type = 'success') {
	const t = document.getElementById('toast');
	t.innerText = msg;
	t.className = `toast show ${type}`;
	setTimeout(() => t.className = 'toast', 3000);
}

// OTHER TABLES
async function loadLikes() {
	const snap = await getDocs(collection(db, 'likes'));
	const body = document.getElementById('likesBody');
	if (!body) return;
	body.innerHTML = '';
	snap.forEach(d => {
		const l = d.data();
		body.innerHTML += `<tr>
      <td>${l.fromUserId}</td>
      <td>${l.toUserId}</td>
      <td>${l.status}</td>
      <td>${l.timestamp?.toDate?.().toLocaleString() || ''}</td>
    </tr>`;
	});
}

async function loadConnections() {
	const snap = await getDocs(collection(db, 'connections'));
	const body = document.getElementById('connectionsBody');
	if (!body) return;
	body.innerHTML = '';
	snap.forEach(d => {
		const c = d.data();
		body.innerHTML += `<tr>
      <td>${c.userA || ''}</td>
      <td>${c.userB || ''}</td>
      <td>${c.status || ''}</td>
    </tr>`;
	});
}

// initialize on load
document.addEventListener('DOMContentLoaded', () => {
	loadCounts();
	loadProfiles();
	loadLikes();
	loadConnections();
});