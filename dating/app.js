// dating/app.js
// Frontend renderer for Firestore dating profiles
// dating/app.js
// Frontend renderer for Firestore dating profiles
import { fetchProfilesOnce, listenProfilesRealtime, updateUserSettings, getUserSettings, sendLike, checkInteractionStatus, fetchLikedProfiles, fetchConnectedProfiles } from "./firebase-helpers.js";
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
          // Connect Request
          const result = await sendLike(auth.currentUser.uid, targetId, 'connect_request');
          btn.textContent = 'Sent';
          btn.disabled = true;
          if (result.isMatch) {
            showToast("It's a Match! You can now chat.", "success");
          } else {
            showToast("Connection request sent!");
          }

        } else if (action === 'shortlist') {
          // Like logic
          const result = await sendLike(auth.currentUser.uid, targetId, 'like');
          btn.textContent = 'Liked';
          btn.disabled = true;
          if (result.isMatch) {
            showToast("It's a Match!", "success");
          } else {
            showToast("Profile liked!");
          }
        }
      } catch (err) {
        console.error("Action error", err);
        showToast("Action failed", 'error');
      }
    });
  });
}

// Profile Details Modal
// Profile Details Modal
window.showProfileDetails = async function (id) {
  // Ensure modal exists (inject if missing)
  let modal = document.getElementById('public-profile-modal');
  if (!modal) {
    const modalHtml = `
    <div id="public-profile-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 800px;"> <!-- Widened -->
        <button class="modal-close" id="modal-close-btn">&times;</button>
        <div class="modal-gallery" id="modal-gallery" style="scroll-snap-type: x mandatory; display: flex; overflow-x: auto;">
          <!-- Images injected here -->
        </div>
        <div class="modal-body">
          <div class="modal-title-row">
            <div>
              <div class="modal-name" id="modal-name" style="font-size: 2rem;">Name</div>
              <div class="modal-meta" id="modal-meta" style="font-size: 1.1rem; color: var(--neon-cyan);">Age · Location</div>
            </div>
          </div>
          <div class="tag-list" id="modal-tags"></div>
          
          <div style="margin-top:1.5rem; display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; font-size:0.95rem;">
             <div>
               <div style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.3rem;">Profession</div>
               <div id="modal-prof" style="color:white; font-weight:600;">-</div>
             </div>
             <div>
               <div style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.3rem;">Education</div>
               <div id="modal-edu" style="color:white; font-weight:600;">-</div>
             </div>
             <div>
               <div style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.3rem;">Marital Status</div>
               <div id="modal-ms" style="color:white; font-weight:600;">-</div>
             </div>
             <div>
               <div style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.3rem;">Height</div>
               <div id="modal-height" style="color:white; font-weight:600;">-</div>
             </div>
          </div>

          <div style="margin-top:1.5rem;">
            <div style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">About</div>
            <p id="modal-bio" style="line-height:1.6; color:var(--text-main); font-size:1rem;"></p>
          </div>

          <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn btn-ghost" style="flex: 1; border-color: var(--neon-pink); color: var(--neon-pink);" id="modal-like-btn">
              <span>♥</span> Like
            </button>
            <button class="btn btn-primary" style="flex: 2;" id="modal-connect-btn">Connect Request</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('public-profile-modal');

    // Attach Close Listeners immediately
    const closeBtn = document.getElementById('modal-close-btn');
    closeBtn.onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    };
  }

  // Open Modal
  modal.classList.add('open');
  document.getElementById('modal-name').textContent = "Loading...";

  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'datingProfiles', id));

    if (snap.exists()) {
      const p = snap.data();
      document.getElementById('modal-name').textContent = p.displayName || "Unknown";
      document.getElementById('modal-meta').textContent = `${p.age || "?"} · ${p.location || "Unknown"}`;
      document.getElementById('modal-prof').textContent = p.profession || "Not specified";
      document.getElementById('modal-edu').textContent = p.education || "Not specified";
      document.getElementById('modal-ms').textContent = p.maritalStatus || "Not specified";
      document.getElementById('modal-height').textContent = p.height ? `${p.height} cm` : "N/A";
      document.getElementById('modal-bio').textContent = p.bio || "No bio available.";

      // Tags
      const tagsContainer = document.getElementById('modal-tags');
      tagsContainer.innerHTML = (p.interests || []).map(i => `<span class="tag">${escapeHtml(i)}</span>`).join("");

      // Gallery (All Photos)
      const gallery = document.getElementById('modal-gallery');
      let photosHtml = '';

      // Add photos from array
      if (p.photos && p.photos.length > 0) {
        p.photos.forEach(photo => {
          photosHtml += `<div style="flex:0 0 100%; height:400px; scroll-snap-align: center;">
                            <img src="${photo.url}" style="width:100%; height:100%; object-fit:contain; background:#000;">
                          </div>`;
        });
      } else if (p.photoURL) {
        // Fallback to single photoURL if no array
        photosHtml = `<div style="flex:0 0 100%; height:400px; scroll-snap-align: center;">
                          <img src="${p.photoURL}" style="width:100%; height:100%; object-fit:contain; background:#000;">
                       </div>`;
      } else {
        // Fallback text
        photosHtml = `<div style="flex:0 0 100%; height:400px; display:flex; align-items:center; justify-content:center; background:var(--primary-grad);">
                          <span style="font-size:4rem; color:white; font-weight:800;">${(p.displayName || "U").charAt(0)}</span>
                       </div>`;
      }

      // If multiple photos, maybe show a hint? The horizontal scroll handles it.
      gallery.innerHTML = photosHtml;


      // Button Actions
      const connectBtn = document.getElementById('modal-connect-btn');
      const likeBtn = document.getElementById('modal-like-btn');

      // Reset buttons
      connectBtn.disabled = false;
      connectBtn.textContent = "Connect Request";
      likeBtn.disabled = false;
      likeBtn.innerHTML = "<span>♥</span> Like";

      connectBtn.onclick = async () => {
        if (!auth.currentUser) return showToast("Login required", "error");
        const res = await sendLike(auth.currentUser.uid, id, 'connect_request');
        connectBtn.textContent = "Sent";
        connectBtn.disabled = true;
        showToast(res.isMatch ? "It's a Match!" : "Request Sent");
      };

      likeBtn.onclick = async () => {
        if (!auth.currentUser) return showToast("Login required", "error");
        const res = await sendLike(auth.currentUser.uid, id, 'like');
        likeBtn.innerHTML = "<span>♥</span> Liked";
        likeBtn.disabled = true;
        showToast("Liked!");
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
  const nameInput = document.getElementById('search-name');

  // Cache of loaded profiles for client-side filtering
  let cachedProfiles = [];
  let nameDebounce = null;

  // Slider UI
  if (ageSlider && ageDisplay) {
    ageSlider.addEventListener('input', (e) => {
      ageDisplay.textContent = `${e.target.value} - 60`; // Simplification
    });
  }

  // Height Slider UI
  const heightSlider = document.getElementById('search-height-slider');
  const heightDisplay = document.getElementById('height-display');
  if (heightSlider && heightDisplay) {
    heightSlider.addEventListener('input', (e) => {
      heightDisplay.textContent = `${e.target.value} cm`;
    });
  }

  if (btn) {
    // Reset Logic
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        // Reset Inputs
        if (ageSlider) { ageSlider.value = 24; ageDisplay.textContent = "24 - 60"; }
        if (heightSlider) { heightSlider.value = 160; heightDisplay.textContent = "160 cm"; }
        if (locSelect) locSelect.value = "any";
        document.getElementById('search-name').value = "";
        document.getElementById('search-community').value = "any";
        document.getElementById('search-education').value = "any";
        document.getElementById('search-profession').value = "any";

        showToast("Filters reset");
      });
    }

    btn.addEventListener('click', async () => {
      const minAge = ageSlider ? ageSlider.value : 18;
      const location = locSelect ? locSelect.value : 'any';
      const name = document.getElementById('search-name').value.trim();
      const community = document.getElementById('search-community').value;
      const education = document.getElementById('search-education').value;
      const profession = document.getElementById('search-profession').value;

      container.innerHTML = '<div style="color:var(--text-muted); text-align:center; grid-column:1/-1;">Searching...</div>';

      const filters = {};
      if (minAge) filters.minAge = minAge;
      if (location !== 'any') filters.location = location;
      if (name) filters.name = name;
      if (community !== 'any') filters.community = community;
      if (education !== 'any') filters.education = education;
      if (profession !== 'any') filters.profession = profession;

      const results = await fetchProfilesOnce({ limitCount: 20, filters });
      // update cache for client-side filtering
      cachedProfiles = results;
      renderProfiles(container, results);

      showToast(`Found ${results.length} matches`);
    });
  }

  // Apply client-side filters to cachedProfiles and render
  function applyClientFilters() {
    const minAge = ageSlider ? ageSlider.value : null;
    const location = locSelect ? locSelect.value : 'any';
    const community = document.getElementById('search-community') ? document.getElementById('search-community').value : 'any';
    const education = document.getElementById('search-education') ? document.getElementById('search-education').value : 'any';
    const profession = document.getElementById('search-profession') ? document.getElementById('search-profession').value : 'any';
    const rawName = nameInput ? nameInput.value.trim() : '';
    const term = rawName.toLowerCase();

    let results = cachedProfiles.slice();

    if (minAge) results = results.filter(p => (p.age || 0) >= Number(minAge));
    if (location && location !== 'any') results = results.filter(p => (p.location || '') === location);
    if (community && community !== 'any') results = results.filter(p => (p.community || '') === community);
    if (education && education !== 'any') results = results.filter(p => (p.education || '') === education);
    if (profession && profession !== 'any') results = results.filter(p => (p.profession || '') === profession);

    if (term && term.length > 0) {
      results = results.filter(p => {
        const dn = (p.displayName || '').toString().toLowerCase();
        const fn = ((p.firstName || '') + ' ' + (p.lastName || '')).trim().toLowerCase();
        return (dn.includes(term) || fn.includes(term));
      });
    }

    renderProfiles(container, results);
  }

  // Debounced name input handling for instant filtering
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      if (nameDebounce) clearTimeout(nameDebounce);
      nameDebounce = setTimeout(() => {
        // If we don't have a sufficiently large cache, fetch a wider set then apply
        if (!cachedProfiles || cachedProfiles.length < 20) {
          fetchProfilesOnce({ limitCount: 100 }).then(res => {
            cachedProfiles = res;
            applyClientFilters();
          });
        } else {
          applyClientFilters();
        }
      }, 220);
    });
  }

  // Initial Load - fetch a larger set to enable client-side name filtering immediately
  fetchProfilesOnce({ limitCount: 100 }).then(res => { cachedProfiles = res; renderProfiles(container, res); });
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

function setHeroStatsFromProfiles(datingProfiles) {
  const elMatches = document.getElementById('stat-matches');
  const elVerified = document.getElementById('stat-verified');
  const elNew = document.getElementById('stat-new');

  if (elMatches) elMatches.textContent = datingProfiles.length + "+";
  if (elVerified) elVerified.textContent = Math.floor(datingProfiles.length * 0.8) + "+";
  if (elNew) elNew.textContent = Math.floor(datingProfiles.length * 0.3) + "+";
}

// Settings Page Logic
function initSettingsPage() {
  const toggles = [
    { id: 'st-match-notif', key: 'notifications.match' },
    { id: 'st-msg-notif', key: 'notifications.message' },
    { id: 'st-view-notif', key: 'notifications.view' },
    { id: 'st-show-name', key: 'privacy.showFullName' },
    { id: 'st-screen-prot', key: 'privacy.screenshotProtection' }
  ];

  onAuthStateChanged(auth, async user => {
    if (!user) return;

    // Load Settings
    const settings = await getUserSettings(user.uid);

    toggles.forEach(t => {
      const el = document.getElementById(t.id);
      if (el) {
        // Resolve nested key safely
        const keys = t.key.split('.');
        const val = keys.length === 2
          ? (settings[keys[0]] && settings[keys[0]][keys[1]])
          : settings[t.key];

        el.checked = !!val; // default to false if undefined, or true?
        // UI Defaults:
        if (settings[keys[0]] === undefined && (t.id === 'st-match-notif' || t.id === 'st-msg-notif')) {
          el.checked = true; // Default ON
        }

        // Listener
        el.addEventListener('change', async () => {
          // Construct updates
          const updates = {};
          // We need to be careful not to overwrite entire objects if we use setDoc merge, 
          // but Firestore merge is shallow on top level maps usually unless using dot notation
          // Helper uses setDoc with merge.
          // Let's re-read current state to be safe or use dot notation update if helper supported it.
          // Helper uses setDoc({settings}, {merge:true}). Ideally pass { "notifications.match": true }

          updates[t.key] = el.checked;

          await updateUserSettings(user.uid, updates);
          showToast("Settings saved");
        });
      }
    });
  }
    });

// Account Actions
// 1. Change Password
const changePwdBtn = document.querySelector('button[onclick*="Change Password"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Change Password'));
if (changePwdBtn) {
  changePwdBtn.onclick = async () => {
    if (confirm("Send a password reset email to your registered address?")) {
      try {
        // Basic implementation: send reset email
        const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        await sendPasswordResetEmail(auth, user.email);
        showToast("Password reset email sent!", "success");
      } catch (e) {
        console.error(e);
        showToast("Error sending email: " + e.message, "error");
      }
    }
  };
}

// 2. Download Data
const downloadBtn = document.querySelector('button[onclick*="Download Data"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Download Data'));
if (downloadBtn) {
  downloadBtn.onclick = () => {
    if (confirm("Download a copy of your personal data?")) {
      // Create a JSON blob
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "astravyn_data_" + user.uid + ".json");
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      showToast("Download started", "success");
    }
  };
}

// 3. Deactivate
const deactivateBtn = document.querySelector('button[onclick*="Deactivate Profile"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Deactivate Profile'));
if (deactivateBtn) {
  deactivateBtn.onclick = async () => {
    const ans = prompt("Type 'DEACTIVATE' to confirm disabling your profile. This will hide you from searches.");
    if (ans === 'DEACTIVATE') {
      await updateUserSettings(user.uid, { isVisible: false, deactivated: true });
      showToast("Profile deactivated. You are now invisible.", "success");
      setTimeout(() => {
        signOut(auth).then(() => window.location.href = '../login/index.html');
      }, 2000);
    } else if (ans !== null) {
      showToast("Deactivation cancelled", "error");
    }
  };
}

  });
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
      if (!confirm("Are you sure you want to log out?")) return;
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
  } else if (page === 'likes') {
    if (container) {
      onAuthStateChanged(auth, async user => {
        if (user) {
          const profiles = await fetchLikedProfiles(user.uid);
          renderProfiles(container, profiles);
        }
      });
    }
  } else if (page === 'connects') {
    if (container) {
      onAuthStateChanged(auth, async user => {
        if (user) {
          const profiles = await fetchConnectedProfiles(user.uid);
          renderProfiles(container, profiles);
        }
      });
    }
  } else if (page === 'settings') {
    initSettingsPage();
  }
});
