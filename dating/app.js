// dating/app.js
// Frontend renderer for Firestore dating profiles
import { fetchProfilesOnce, listenProfilesRealtime, updateUserSettings, getUserSettings, addConnection, checkConnectionStatus } from "./firebase-helpers.js";
import { auth, db } from '../js/firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';


// escape helper
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// Toast Notification
function showToast(msg, type = 'info') {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    background: ${type === 'error' ? '#ef4444' : '#10b981'};
    color: white; padding: 12px 24px; border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    z-index: 9999; animation: slideIn 0.3s ease-out;
  `;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

// Create HTML card with animated brand fallback
function createProfileCard(profile) {
  const avatarText = (profile.displayName || "U").charAt(0).toUpperCase();

  // Handle single photoURL vs photos array
  let mainPhoto = profile.photoURL;
  if (profile.photos && profile.photos.length > 0) {
    mainPhoto = profile.photos[0].url;
  }

  // Premium Check
  const isPremium = profile.isPremium || (profile.subscription === 'premium');
  const premiumBadge = isPremium
    ? `<span style="color:#fbbf24; margin-left:6px; display:inline-flex; align-items:center;" title="Premium Member">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>
       </span>`
    : `<span style="color:var(--text-muted); margin-left:6px; font-size: 0.8em; opacity: 0.7;" title="Verified User">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
       </span>`;

  // Animated Brand Fallback
  const photo = mainPhoto
    ? `<img src="${escapeHtml(mainPhoto)}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">`
    : `<div class="profile-card-fallback brand-anim-container">
         <div class="brand-anim-text">ASTRAVYN</div>
         <div class="brand-anim-initial">${avatarText}</div>
       </div>`;

  const interests = (profile.interests || [])
    .slice(0, 2)
    .map(i => `<span class="tag" style="font-size:0.75rem; padding: 2px 8px;">${escapeHtml(i)}</span>`)
    .join(" ");

  return `
    <article class="card profile-card" onclick="window.showProfileDetails('${profile.id}')">
      ${photo}
      
      <div class="profile-info-overlay">
        <div style="display:flex; align-items:center;">
          <h3 class="profile-name" style="margin:0; font-size:1.3rem;">${escapeHtml(profile.displayName || "")}, ${profile.age || ""}</h3>
          ${premiumBadge}
        </div>
        
        <div class="profile-meta" style="margin-bottom:0.5rem; font-size:0.85rem; opacity:0.9;">
         ${escapeHtml(profile.location || "")}
        </div>

        <div class="tag-list" style="margin-bottom:1rem;">${interests}</div>

        <div class="profile-actions" style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
          <button class="btn btn-primary" style="padding: 8px 0; font-size:0.85rem;" data-action="connect" data-id="${profile.id}">Connect</button>
          <button class="btn btn-ghost" style="padding: 8px 0; font-size:0.85rem;" data-action="shortlist" data-id="${profile.id}">Like</button>
        </div>
      </div>
    </article>
  `;
}

// --- Missing Functions Restored ---

// Render List of Profiles
function renderProfiles(container, profiles) {
  if (!profiles || profiles.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">No profiles found matching criteria.</div>`;
    return;
  }
  container.innerHTML = profiles.map(createProfileCard).join("");
  makeInteractive(container);
}

// Add Interaction Listeners (Connect/Like Buttons)
function makeInteractive(container) {
  const btns = container.querySelectorAll('button[data-action]');
  btns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent card click
      e.preventDefault();

      if (!auth.currentUser) {
        showToast("Please sign in first", 'error');
        return;
      }

      const action = btn.dataset.action;
      const targetId = btn.dataset.id;

      try {
        if (action === 'connect') {
          // Check if already connected logic could go here
          await addConnection(auth.currentUser.uid, targetId, 'connect');
          btn.textContent = 'Sent';
          btn.disabled = true;
          showToast("Connection request sent!");
        } else if (action === 'shortlist') {
          // Like logic
          await addConnection(auth.currentUser.uid, targetId, 'like');
          btn.textContent = 'Liked';
          btn.disabled = true;
          showToast("Profile liked!");
        }
      } catch (err) {
        console.error("Action error", err);
        showToast("Action failed", 'error');
      }
    });
  });
}

// Profile Details Modal
window.showProfileDetails = async function (id) {
  const modal = document.getElementById('public-profile-modal');
  if (!modal) return;

  // Show loading state if needed, or fetch data
  // For simplicity, we might need to fetch the doc if we don't have it in memory.
  // Ideally, 'profiles' array should be accessible, but we can fetch single doc.

  // Basic placeholders
  document.getElementById('modal-name').textContent = "Loading...";
  modal.classList.add('open');

  try {
    // We import getting single doc logic or use fetchProfiles logic
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'datingProfiles', id));

    if (snap.exists()) {
      const p = snap.data();
      document.getElementById('modal-name').textContent = p.displayName || "Unknown";
      document.getElementById('modal-meta').textContent = `${p.age || "?"} · ${p.location || "Unknown"}`;
      document.getElementById('modal-bio').textContent = p.bio || "No bio available.";

      // Tags
      const tagsContainer = document.getElementById('modal-tags');
      tagsContainer.innerHTML = (p.interests || []).map(i => `<span class="tag">${escapeHtml(i)}</span>`).join("");

      // Gallery (Simplified: just main photo or fallback)
      const gallery = document.getElementById('modal-gallery');
      let mainPhoto = p.photoURL;
      if (p.photos && p.photos.length > 0) mainPhoto = p.photos[0].url;

      if (mainPhoto) {
        gallery.innerHTML = `<img src="${mainPhoto}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        gallery.innerHTML = `<span style="color:white;font-size:2rem;">${(p.displayName || "U").charAt(0)}</span>`;
      }

      // Enhanced Bio & Details Section
      const bioEl = document.getElementById('modal-bio');
      const detailsHtml = `
        <div style="margin-top:1.5rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem; font-size:0.9rem; color:var(--text-muted);">
           <div>
             <div style="color:var(--text-dim); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Profession</div>
             <div style="color:var(--text-main); font-weight:500;">${escapeHtml(p.profession || "Not specified")}</div>
           </div>
           <div>
             <div style="color:var(--text-dim); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Education</div>
             <div style="color:var(--text-main); font-weight:500;">${escapeHtml(p.education || "Not specified")}</div>
           </div>
           <div>
             <div style="color:var(--text-dim); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Marital Status</div>
             <div style="color:var(--text-main); font-weight:500;">${escapeHtml(p.maritalStatus || "Not specified")}</div>
           </div>
           <div>
             <div style="color:var(--text-dim); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Height</div>
             <div style="color:var(--text-main); font-weight:500;">${escapeHtml(p.height ? p.height + " cm" : "N/A")}</div>
           </div>
        </div>
        <div style="margin-top:1.5rem;">
           <div style="color:var(--text-dim); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">About</div>
           <p style="line-height:1.6; color:var(--text-main); font-size:0.95rem;">${escapeHtml(p.bio || "No bio available.")}</p>
        </div>
      `;
      bioEl.innerHTML = detailsHtml;

      // Close Button
      document.getElementById('modal-close-btn').onclick = () => modal.classList.remove('open');
      // Outside click
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('open');
      };
    }
  } catch (e) {
    console.error("Error fetching details", e);
    showToast("Could not load details", 'error');
    modal.classList.remove('open');
  }
};

// Search Page Logic
function initSearchPage(container) {
  const btn = document.getElementById('btn-search-trigger');
  const ageSlider = document.getElementById('search-age-slider');
  const ageDisplay = document.getElementById('age-display');
  const locSelect = document.getElementById('search-location');

  // Slider UI
  if (ageSlider && ageDisplay) {
    ageSlider.addEventListener('input', (e) => {
      ageDisplay.textContent = `${e.target.value} - 60`; // Simplification
    });
  }

  if (btn) {
    btn.addEventListener('click', async () => {
      const minAge = ageSlider ? ageSlider.value : 18;
      const location = locSelect ? locSelect.value : 'any';

      container.innerHTML = '<div style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Searching...</div>';

      const filters = {};
      if (minAge) filters.minAge = minAge;
      if (location !== 'any') filters.location = location;

      const results = await fetchProfilesOnce({ limitCount: 20, filters });
      renderProfiles(container, results);

      showToast(`Found ${results.length} matches`);
    });
  }

  // Initial Load
  fetchProfilesOnce({ limitCount: 10 }).then(res => renderProfiles(container, res));
}

// Matches Page Logic
function initMatchesPage(container) {
  // Initial Load
  fetchProfilesOnce({ limitCount: 20 }).then(res => renderProfiles(container, res));

  // Listen to filter tabs if they exist
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;
      container.innerHTML = '<div style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Updating...</div>';

      let filters = {};
      if (filter === 'new') filters.isNew = true;
      // if (filter === 'nearby') ...

      const results = await fetchProfilesOnce({ limitCount: 20, filters });
      renderProfiles(container, results);
    });
  });
}

function setHeroStatsFromProfiles(profiles) {
  const elMatches = document.getElementById('stat-matches');
  const elVerified = document.getElementById('stat-verified');
  const elNew = document.getElementById('stat-new');

  if (elMatches) elMatches.textContent = profiles.length + "+";
  if (elVerified) elVerified.textContent = Math.floor(profiles.length * 0.8) + "+";
  if (elNew) elNew.textContent = Math.floor(profiles.length * 0.3) + "+";
}


// --- Original Logic Restored ---

// User Dropdown Menu
function setupUserMenu() {
  const navUser = document.getElementById('nav-user');
  if (!navUser) return;

  // Ensure relative positioning for dropdown
  navUser.style.position = 'relative';

  // Check if dropdown already exists
  if (navUser.querySelector('.nav-dropdown')) return;

  // Create Dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'nav-dropdown';
  dropdown.innerHTML = `
    <button class="nav-dropdown-item" onclick="window.location.href='profile.html'">
      <span>👤</span> Profile
    </button>
    <button class="nav-dropdown-item" onclick="window.location.href='settings.html'">
      <span>⚙️</span> Settings
    </button>
    <div class="nav-dropdown-divider"></div>
    <button class="nav-dropdown-item" id="dd-logout" style="color:#f87171;">
      <span>🚪</span> Logout
    </button>
  `;

  navUser.appendChild(dropdown);

  // Toggle Logic
  navUser.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  // Logout Logic
  const logoutBtn = dropdown.querySelector('#dd-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await signOut(auth);
        window.location.href = '../login/index.html';
      } catch (err) {
        console.error("Logout failed", err);
      }
    });
  }

  // Close when clicking outside
  document.addEventListener('click', () => {
    dropdown.classList.remove('show');
  });
}

// Theme Toggle Logic
function setupThemeToggle() {
  // Check storage, default to NEON
  let savedTheme = localStorage.getItem('astravyn-theme');
  if (!savedTheme) {
    savedTheme = 'neon';
  }

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('astravyn-theme', theme);

    // Update Nav Button
    const navBtn = document.querySelector('.theme-toggle-btn');
    if (navBtn) navBtn.innerHTML = theme === 'light' ? '🌙' : '☀️';

    // Update Settings Checkbox
    const settingsToggle = document.getElementById('st-theme-toggle');
    if (settingsToggle) settingsToggle.checked = (theme === 'neon');
  };

  // Initial Apply
  applyTheme(savedTheme);

  // 1. Navbar Toggle
  const navInner = document.querySelector('.dating-nav-inner');
  if (navInner) {
    let toggleBtn = document.querySelector('.theme-toggle-btn');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.className = 'theme-toggle-btn';
      toggleBtn.title = "Toggle Theme";
      toggleBtn.style.marginLeft = '12px';
      navInner.appendChild(toggleBtn);
    }

    // Update icon initially
    toggleBtn.innerHTML = savedTheme === 'light' ? '🌙' : '☀️';

    toggleBtn.onclick = () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'neon' : 'light';
      applyTheme(next);
    };
  }

  // 2. Settings Page Toggle
  const settingsToggle = document.getElementById('st-theme-toggle');
  if (settingsToggle) {
    // Set initial state
    settingsToggle.checked = (savedTheme === 'neon');

    settingsToggle.addEventListener('change', (e) => {
      const next = e.target.checked ? 'neon' : 'light';
      applyTheme(next);
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupThemeToggle();
  setupUserMenu(); // Init User Menu
  const page = document.body.dataset.page;
  const container = document.querySelector(".matches-grid");

  // Nav active state
  const activeLink = document.querySelector(`a[data-nav="${page}"]`);
  if (activeLink) activeLink.classList.add("active");

  if (page === 'home') {
    if (container) {
      try {
        const profiles = await fetchProfilesOnce({ limitCount: 20 });
        renderProfiles(container, profiles.slice(0, 8));
        setHeroStatsFromProfiles(profiles);
      } catch (e) { console.error(e); }
    }
  } else if (page === 'matches') {
    if (container) initMatchesPage(container);
  } else if (page === 'search') {
    if (container) initSearchPage(container);
  }
});
