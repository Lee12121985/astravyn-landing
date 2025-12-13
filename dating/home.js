import { auth, db } from '../js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const selfProfileContainer = document.getElementById('self-profile-container');
const heroDefaultContent = document.getElementById('hero-default-content');

// Helper to escape HTML to prevent XSS
function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

async function renderSelfProfile(user) {
    if (!selfProfileContainer) return;

    try {
        const snap = await getDoc(doc(db, 'datingProfiles', user.uid));
        if (snap.exists()) {
            const data = snap.data();
            const displayName = data.displayName || 'Me';
            const photoURL = data.photoURL;
            const bio = data.bio || 'No bio added yet.';
            const location = data.location || '';
            const age = data.age ? `, ${data.age}` : '';

            // Hide default hero, show profile view
            if (heroDefaultContent) heroDefaultContent.style.display = 'none';
            selfProfileContainer.style.display = 'flex';

            const avatarInner = photoURL
                ? `<img src="${escapeHtml(photoURL)}" style="width:100%;height:100%;object-fit:cover;">`
                : `<div class="self-avatar-fallback">${displayName.charAt(0)}</div>`;

            selfProfileContainer.innerHTML = `
                <div style="flex:0 0 120px;height:120px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,0.1);">
                    ${avatarInner}
                </div>
                <div style="flex:1;">
                    <h1 class="hero-title" style="margin-bottom:0.5rem; font-size: 2.2rem;">${escapeHtml(displayName)}${age}</h1>
                    <div style="font-size:0.9rem;color:var(--text-soft);margin-bottom:0.8rem;">
                        ${location ? `📍 ${escapeHtml(location)}` : ''} 
                        ${data.profession ? `· 💼 ${escapeHtml(data.profession)}` : ''}
                    </div>
                    <p class="hero-text" style="margin-bottom:1rem;font-style:italic;">"${escapeHtml(bio)}"</p>
                    <a href="profile.html" class="btn btn-primary btn-sm">Edit Profile</a>
                </div>
            `;
        } else {
            // No profile doc yet
            if (heroDefaultContent) heroDefaultContent.style.display = 'block';
            selfProfileContainer.style.display = 'none';
        }
    } catch (e) {
        console.error("Error loading self profile", e);
    }
}

onAuthStateChanged(auth, user => {
    if (user) {
        renderSelfProfile(user);
    }
});
