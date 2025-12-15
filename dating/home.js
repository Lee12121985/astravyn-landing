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

            // Show profile view in the left area (keep hero-illustration available)
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

            // If the user has uploaded a photo, clone the existing hero-illustration (marked UI) and
            // place a copy inside the profile container so it displays to the right. We only alter
            // DOM placement — no CSS or layout changes are made.
            if (photoURL) {
                const defaultAside = document.querySelector('#hero-default-content .hero-illustration');
                if (defaultAside) {
                    const asideClone = defaultAside.cloneNode(true);
                    const main = asideClone.querySelector('.hero-illustration-main');
                    if (main) {
                        main.innerHTML = `<img src="${escapeHtml(photoURL)}" alt="Profile photo" style="width:100%;height:180px;object-fit:cover;border-radius:12px;">`;
                    }
                    // Prevent duplicate clones on repeated calls by removing any existing cloned aside
                    const existingClone = selfProfileContainer.querySelector('.hero-illustration');
                    if (existingClone) existingClone.remove();
                    selfProfileContainer.appendChild(asideClone);
                }
                // Also ensure the top-right nav avatar shows this photo if present
                try {
                    const navWrap = document.getElementById('nav-avatar-photo');
                    const navImg = document.getElementById('nav-avatar-img');
                    const navInitial = document.getElementById('nav-avatar-initial');
                    if (navImg && navWrap) {
                        navImg.src = photoURL;
                        navWrap.style.display = '';
                        if (navInitial) navInitial.style.display = 'none';
                    }
                } catch (e) {
                    // no-op
                }
            } else {
                // Ensure no leftover cloned aside when there is no photo
                const existingClone = selfProfileContainer.querySelector('.hero-illustration');
                if (existingClone) existingClone.remove();
            }
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
