// js/userDisplay.js
// Reusable utility for displaying user info and logout functionality across all apps
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

/**
 * Renders user display in a container with customizable options
 * @param {string} containerId - ID of the container element
 * @param {Object} options - Configuration options
 * @param {boolean} options.showAvatar - Show user avatar (default: true)
 * @param {boolean} options.showEmail - Show user email (default: false)
 * @param {boolean} options.showDropdown - Show dropdown menu (default: false)
 * @param {string} options.style - Style variant: 'minimal', 'badge', 'dropdown', 'inline' (default: 'inline')
 * @param {Function} options.onLogout - Callback when user logs out
 * @param {Function} options.onRender - Callback after rendering with user object
 */
export function renderUserDisplay(containerId, options = {}) {
  const {
    showAvatar = true,
    showEmail = false,
    showDropdown = false,
    style = 'inline',
    onLogout = null,
    onRender = null
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Container ${containerId} not found`);
    return;
  }

  // Set up auth state listener
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      container.innerHTML = '';
      if (onRender) onRender(null);
      return;
    }

    const name = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    const email = user.email || '';
    const photoURL = user.photoURL;
    const initial = name.charAt(0).toUpperCase();

    let html = '';

    switch (style) {
      case 'minimal':
        // Minimal header badge style (for AI Studio)
        html = `
          <div class="user-display-minimal" style="display:flex;align-items:center;gap:8px;">
            ${showAvatar ? (photoURL
            ? `<img src="${photoURL}" alt="avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
            : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">${initial}</div>`
          ) : ''}
            <span style="color:#fff;font-size:14px;">${name}</span>
            <button id="${containerId}-logout" class="logout-btn-minimal" style="padding:6px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;">Logout</button>
          </div>
        `;
        break;

      case 'badge':
        // Status badge style (for Timesheet)
        html = `
          <div class="user-display-badge" style="display:flex;align-items:center;gap:8px;">
            <span class="status-dot" style="background:#10b981;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
            ${showAvatar ? (photoURL
            ? `<img src="${photoURL}" alt="avatar" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" />`
            : `<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px;">${initial}</div>`
          ) : ''}
            <span class="status-text" style="color:#fff;font-size:13px;">${name}</span>
            ${showEmail ? `<span style="color:rgba(255,255,255,0.7);font-size:12px;">${email}</span>` : ''}
            <button id="${containerId}-logout" class="logout-btn" style="margin-left:8px;padding:4px 10px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;">Logout</button>
          </div>
        `;
        break;

      case 'dropdown':
        // Dropdown menu style (for Landing page - already implemented, but can be used elsewhere)
        html = `
          <div class="user-dropdown">
            <div class="user-chip" id="${containerId}-chip">
              ${showAvatar ? (photoURL
            ? `<div class="user-avatar"><img src="${photoURL}" alt="avatar" /></div>`
            : `<div class="user-avatar">${initial}</div>`
          ) : ''}
              <span class="user-name">${name}</span>
            </div>
            ${showDropdown ? `
              <div class="user-menu" id="${containerId}-menu" style="display:none;">
                ${showEmail ? `<div class="user-menu-item muted">${email}</div>` : ''}
                <div class="user-menu-item" id="${containerId}-logout">Sign out</div>
              </div>
            ` : ''}
          </div>
        `;
        break;

      case 'inline':
      default:
        // Simple inline style
        html = `
          <div class="user-display-inline" style="display:flex;align-items:center;gap:8px;">
            ${showAvatar ? (photoURL
            ? `<img src="${photoURL}" alt="avatar" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />`
            : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">${initial}</div>`
          ) : ''}
            <span style="color:#fff;font-size:13px;">${name}</span>
            <button id="${containerId}-logout" class="logout-btn-inline" style="padding:4px 10px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;">Logout</button>
          </div>
        `;
        break;
    }

    container.innerHTML = html;

    // Set up logout button
    const logoutBtn = document.getElementById(`${containerId}-logout`);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await signOut(auth);
          if (onLogout) {
            onLogout();
          }
        } catch (err) {
          console.error('Logout error:', err);
        }
      });
    }

    // Set up dropdown toggle if using dropdown style
    if (style === 'dropdown' && showDropdown) {
      const chip = document.getElementById(`${containerId}-chip`);
      const menu = document.getElementById(`${containerId}-menu`);
      if (chip && menu) {
        chip.onclick = (e) => {
          e.stopPropagation();
          const visible = menu.style.display === 'block';
          menu.style.display = visible ? 'none' : 'block';
        };

        // Close menu when clicking outside
        const clickOutsideHandler = (e) => {
          if (!container.contains(e.target)) {
            menu.style.display = 'none';
          }
        };
        document.addEventListener('click', clickOutsideHandler, true);
      }
    }

    if (onRender) onRender(user);
  });
}

/**
 * Sets up a logout button with a given ID
 * @param {string} buttonId - ID of the logout button element
 * @param {Function} onLogout - Optional callback when logout completes
 */
export function setupLogoutButton(buttonId, onLogout = null) {
  const button = document.getElementById(buttonId);
  if (!button) {
    console.warn(`Logout button ${buttonId} not found`);
    return;
  }

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await signOut(auth);
      if (onLogout) {
        onLogout();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
}
