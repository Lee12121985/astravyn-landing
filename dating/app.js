import { auth, db } from '../js/firebase-config.js';
import { requireAuth, logout } from '../js/auth.js';
import {
    doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp, or
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

let currentUser = null;
let currentProfile = null;

const appContent = document.getElementById('app-content');
const mainNav = document.getElementById('main-nav');
const userStatus = document.getElementById('user-status');

// Templates
const templates = {
    onboarding: document.getElementById('onboarding-template'),
    discover: document.getElementById('discover-template'),
    matches: document.getElementById('matches-template'),
    profile: document.getElementById('profile-template')
};

async function init() {
    try {
        const user = await requireAuth('../login/index.html');
        currentUser = user;
        userStatus.textContent = `Logged in as ${user.displayName || user.email}`;

        // Check for profile
        const profileSnap = await getDoc(doc(db, "profiles", user.uid));

        if (profileSnap.exists()) {
            currentProfile = profileSnap.data();
            showSection('discover');
            mainNav.style.display = 'flex';
        } else {
            showSection('onboarding');
            mainNav.style.display = 'none';
        }

        setupNav();

    } catch (error) {
        console.error("Init error:", error);
    }
}

function showSection(name) {
    appContent.innerHTML = '';
    const clone = templates[name].content.cloneNode(true);
    appContent.appendChild(clone);

    // Update nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === name);
    });

    // Initialize section specific logic
    if (name === 'onboarding') initOnboarding();
    if (name === 'discover') initDiscover();
    if (name === 'matches') initMatches();
    if (name === 'profile') initProfile();
}

function setupNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showSection(btn.dataset.target);
        });
    });
}

// --- Onboarding ---
function initOnboarding() {
    const form = document.getElementById('onboarding-form');
    // Prefill if editing
    if (currentProfile) {
        Object.keys(currentProfile).forEach(key => {
            if (form.elements[key]) form.elements[key].value = currentProfile[key];
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.uid = currentUser.uid;
        data.interests = data.interests.split(',').map(s => s.trim());
        data.photos = [data.photoUrl]; // Simple array for now
        data.isVisible = true;

        try {
            await setDoc(doc(db, "profiles", currentUser.uid), data, { merge: true });
            currentProfile = data;
            alert('Profile saved!');
            showSection('discover');
            mainNav.style.display = 'flex';
        } catch (err) {
            console.error(err);
            alert('Error saving profile');
        }
    });
}

// --- Discover ---
async function initDiscover() {
    const stack = document.getElementById('card-stack');
    const noMore = document.getElementById('no-more-profiles');
    stack.innerHTML = '<div style="text-align:center; padding:20px;">Finding people...</div>';

    // 1. Get people I've already liked/passed
    const likesSnap = await getDocs(query(collection(db, "likes"), where("fromUid", "==", currentUser.uid)));
    const seenUids = new Set([currentUser.uid]);
    likesSnap.forEach(doc => seenUids.add(doc.data().toUid));

    // 2. Get potential matches (limit 20 for now)
    // Firestore doesn't support "not-in" with large arrays well, so we fetch and filter
    const q = query(collection(db, "profiles"), where("isVisible", "==", true));
    const querySnapshot = await getDocs(q);

    const candidates = [];
    querySnapshot.forEach((doc) => {
        if (!seenUids.has(doc.id)) {
            candidates.push(doc.data());
        }
    });

    stack.innerHTML = '';

    if (candidates.length === 0) {
        noMore.classList.remove('hidden');
        return;
    }

    // Render first candidate
    renderCandidate(candidates[0], stack);
}

function renderCandidate(profile, container) {
    container.innerHTML = `
        <div class="profile-card" style="background-image: url('${profile.photos[0] || 'https://via.placeholder.com/400'}')">
            <div class="profile-info">
                <h2>${profile.name}, ${profile.age}</h2>
                <p>${profile.location || 'Unknown Location'}</p>
                <p style="font-size:14px; opacity:0.8;">${profile.bio || ''}</p>
                <div style="margin-top:8px;">
                    ${(profile.interests || []).map(i => `<span style="background:rgba(255,255,255,0.2); padding:4px 8px; border-radius:4px; font-size:12px; margin-right:4px;">${i}</span>`).join('')}
                </div>
            </div>
        </div>
        <div class="actions">
            <button class="action-btn pass-btn">✕</button>
            <button class="action-btn like-btn">♥</button>
        </div>
    `;

    container.querySelector('.pass-btn').onclick = () => handleAction(profile.uid, 'pass');
    container.querySelector('.like-btn').onclick = () => handleAction(profile.uid, 'like');
}

async function handleAction(targetUid, action) {
    // Record action
    await addDoc(collection(db, "likes"), {
        fromUid: currentUser.uid,
        toUid: targetUid,
        type: action,
        createdAt: serverTimestamp()
    });

    if (action === 'like') {
        // Check for match
        const reverseLike = await getDocs(query(
            collection(db, "likes"),
            where("fromUid", "==", targetUid),
            where("toUid", "==", currentUser.uid),
            where("type", "==", "like")
        ));

        if (!reverseLike.empty) {
            alert("It's a Match! 🎉");
            await addDoc(collection(db, "matches"), {
                users: [currentUser.uid, targetUid],
                createdAt: serverTimestamp()
            });
        }
    }

    // Refresh discover (simple way)
    initDiscover();
}

// --- Matches ---
async function initMatches() {
    const list = document.getElementById('matches-list');
    const noMatches = document.getElementById('no-matches');
    list.innerHTML = 'Loading...';

    const q = query(collection(db, "matches"), where("users", "array-contains", currentUser.uid));
    const snap = await getDocs(q);

    if (snap.empty) {
        list.innerHTML = '';
        noMatches.classList.remove('hidden');
        return;
    }

    noMatches.classList.add('hidden');
    list.innerHTML = '';

    const matches = [];
    for (const d of snap.docs) {
        const data = d.data();
        const otherUid = data.users.find(u => u !== currentUser.uid);
        matches.push(otherUid);
    }

    // Fetch profiles for matches
    // In real app, use batch get or similar. Here loop is okay for MVP.
    for (const uid of matches) {
        const pSnap = await getDoc(doc(db, "profiles", uid));
        if (pSnap.exists()) {
            const p = pSnap.data();
            const div = document.createElement('div');
            div.className = 'match-item';
            div.innerHTML = `
                <img src="${p.photos[0]}" class="avatar">
                <div>
                    <div style="font-weight:600;">${p.name}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${p.location || ''}</div>
                </div>
            `;
            list.appendChild(div);
        }
    }
}

// --- Profile ---
function initProfile() {
    document.getElementById('my-name').textContent = currentProfile.name;
    document.getElementById('my-photo').src = currentProfile.photos[0];

    document.getElementById('edit-profile-btn').onclick = () => {
        showSection('onboarding'); // Reuse onboarding form
    };

    document.getElementById('logout-btn').onclick = async () => {
        await logout();
    };
}

// Start
init();
