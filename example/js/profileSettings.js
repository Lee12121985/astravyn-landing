import { auth, db } from './firebase-config.js';
import { 
  updateProfile, 
  linkWithPopup, 
  GoogleAuthProvider, 
  linkWithPhoneNumber, 
  RecaptchaVerifier,
  PhoneAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  unlink
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

let modal = null;
let nameInput = null;
let providersList = null;
let notificationArea = null;
let recaptchaVerifier = null;

export function initProfileSettings() {
  // Inject Modal HTML if not exists
  if (!document.getElementById('profile-settings-modal')) {
    const modalHTML = `
      <div id="profile-settings-modal" class="modal-overlay" style="display:none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Profile Settings</h2>
            <button id="close-profile-modal" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div id="profile-notification" class="notification"></div>
            
            <div class="form-group">
              <label>Display Name</label>
              <div style="display:flex; gap:10px;">
                <input type="text" id="profile-display-name" class="input-field" placeholder="Your Name" />
                <button id="save-profile-name" class="btn-primary-small">Save</button>
              </div>
            </div>

            <hr class="divider" />

            <h3>Linked Accounts</h3>
            <p class="small-text">Link multiple login methods to access your account easily.</p>
            <div id="linked-providers-list" class="providers-list">
              <!-- Providers injected here -->
            </div>
            
            <!-- Hidden container for Phone Auth reCAPTCHA -->
            <div id="recaptcha-container-profile"></div>
          </div>
        </div>
      </div>
      <style>
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.7); z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          background: #0f172a; border: 1px solid #1e293b;
          border-radius: 16px; width: 90%; max-width: 420px;
          padding: 0; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          color: #fff; font-family: 'Inter', sans-serif;
        }
        .modal-header {
          padding: 16px 20px; border-bottom: 1px solid #1e293b;
          display: flex; justify-content: space-between; align-items: center;
        }
        .modal-header h2 { margin: 0; font-size: 18px; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; }
        .close-btn:hover { color: #fff; }
        .modal-body { padding: 20px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-size: 13px; color: #94a3b8; }
        .input-field {
          flex: 1; background: #1e293b; border: 1px solid #334155;
          color: #fff; padding: 8px 12px; border-radius: 6px; outline: none;
        }
        .input-field:focus { border-color: #3b82f6; }
        .btn-primary-small {
          background: #3b82f6; color: white; border: none; padding: 8px 16px;
          border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;
        }
        .btn-primary-small:hover { background: #2563eb; }
        .divider { border: 0; border-top: 1px solid #1e293b; margin: 20px 0; }
        .small-text { font-size: 12px; color: #64748b; margin-top: -10px; margin-bottom: 15px; }
        .provider-item {
          display: flex; justify-content: space-between; align-items: center;
          background: #1e293b; padding: 12px; border-radius: 8px; margin-bottom: 8px;
        }
        .provider-info { display: flex; align-items: center; gap: 10px; font-size: 14px; }
        .status-linked { color: #10b981; font-size: 12px; font-weight: 600; }
        .btn-link { 
          background: transparent; border: 1px solid #334155; color: #94a3b8; 
          padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; 
        }
        .btn-link:hover { border-color: #475569; color: #fff; }
        .notification { 
          margin-bottom: 15px; padding: 10px; border-radius: 6px; font-size: 13px; display: none; 
        }
        .notification.success { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #059669; }
        .notification.error { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #dc2626; }
      </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  modal = document.getElementById('profile-settings-modal');
  nameInput = document.getElementById('profile-display-name');
  providersList = document.getElementById('linked-providers-list');
  notificationArea = document.getElementById('profile-notification');

  // Event Listeners
  document.getElementById('close-profile-modal').onclick = closeProfileModal;
  document.getElementById('save-profile-name').onclick = updateDisplayName;
  
  // click outside to close
  modal.onclick = (e) => {
    if (e.target === modal) closeProfileModal();
  };
}

export function openProfileSettings() {
  if (!modal) initProfileSettings();
  const user = auth.currentUser;
  if (!user) return;

  modal.style.display = 'flex';
  nameInput.value = user.displayName || '';
  notificationArea.style.display = 'none';
  
  renderProviders(user);
}

function closeProfileModal() {
  modal.style.display = 'none';
}

function showNotification(msg, type='success') {
  notificationArea.textContent = msg;
  notificationArea.className = `notification ${type}`;
  notificationArea.style.display = 'block';
  setTimeout(() => {
    notificationArea.style.display = 'none';
  }, 4000);
}

async function updateDisplayName() {
  const user = auth.currentUser;
  const newName = nameInput.value.trim();
  
  if (!user) return;
  if (!newName) return showNotification('Name cannot be empty', 'error');

  try {
    const btn = document.getElementById('save-profile-name');
    const oldText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    // Update Auth Profile
    await updateProfile(user, { displayName: newName });
    
    // Update Firestore User Doc
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { displayName: newName }, { merge: true });

    // Update Firestore Dating Profile (if exists)
    try {
      const datingRef = doc(db, 'datingProfiles', user.uid);
      await updateDoc(datingRef, { displayName: newName }, { merge: true });
    } catch (e) {
      console.log('No dating profile to update or error', e);
    }

    showNotification('Profile updated successfully!', 'success');
    btn.textContent = oldText;
    btn.disabled = false;
    
    // Update UI name immediately if possible (re-render header?)
    // simplified: just let the auth listener handle it or reload
  } catch (err) {
    console.error(err);
    showNotification('Failed to update profile: ' + err.message, 'error');
    document.getElementById('save-profile-name').disabled = false;
  }
}

function renderProviders(user) {
  const providerData = user.providerData;
  const linkedProviderIds = providerData.map(p => p.providerId);
  
  let html = '';

  // GOOGLE
  const isGoogle = linkedProviderIds.includes('google.com');
  html += `
    <div class="provider-item">
      <div class="provider-info">
        <span>${isGoogle ? '🟢' : '⚪'}</span>
        <span>Google Account</span>
      </div>
      ${isGoogle 
        ? '<span class="status-linked">Linked</span>' 
        : '<button class="btn-link" onclick="window.linkGoogle()">Link</button>'}
    </div>
  `;

  // PHONE
  const isPhone = linkedProviderIds.includes('phone');
  html += `
    <div class="provider-item">
      <div class="provider-info">
        <span>${isPhone ? '🟢' : '⚪'}</span>
        <span>Phone Number</span>
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        ${isPhone ? '<span class="status-linked">Linked</span>' : ''}
        ${!isPhone ? '<button class="btn-link" onclick="window.linkPhone()">Link</button>' : ''}
      </div>
    </div>
  `;

  // EMAIL/PASSWORD
  const isPassword = linkedProviderIds.includes('password');
  const userEmail = user.email || '';
  html += `
    <div class="provider-item">
      <div class="provider-info">
        <span>${isPassword ? '🟢' : '⚪'}</span>
        <span>Email/Password</span>
        ${userEmail ? `<span style="font-size:12px; color:#64748b;">(${userEmail})</span>` : ''}
      </div>
      ${isPassword 
        ? '<span class="status-linked">Linked</span>' 
        : '<button class="btn-link" onclick="window.linkPassword()">Link</button>'}
    </div>
  `;

  providersList.innerHTML = html;
}

// Global handlers for HTML onclicks
window.linkGoogle = async () => {
  const user = auth.currentUser;
  try {
    const provider = new GoogleAuthProvider();
    await linkWithPopup(user, provider);
    showNotification('Google account linked successfully!', 'success');
    renderProviders(auth.currentUser);
  } catch (error) {
    console.error(error);
    if (error.code === 'auth/credential-already-in-use') {
      showNotification('This Google account is already used by another user.', 'error');
    } else {
      showNotification('Failed to link Google: ' + error.message, 'error');
    }
  }
};

window.linkPhone = async () => {
  const user = auth.currentUser;
  const phone = prompt("Enter phone number (e.g., +919876543210):");
  if (!phone) return;

  try {
    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-profile', {
        'size': 'invisible'
      });
    }
    
    const confirmation = await linkWithPhoneNumber(user, phone, recaptchaVerifier);
    const code = prompt("Enter the 6-digit OTP sent to " + phone);
    if (!code) return;

    await confirmation.confirm(code);
    showNotification('Phone number linked successfully!', 'success');
    renderProviders(auth.currentUser);
  } catch (error) {
    console.error(error);
    showNotification('Failed to link phone: ' + error.message, 'error');
    if (recaptchaVerifier) recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
};

window.linkPassword = async () => {
  const user = auth.currentUser;
  if (!user || !user.email) {
    showNotification('Email address is required to link a password.', 'error');
    return;
  }

  // Prompt for password (twice for confirmation)
  const password = prompt("Enter a new password (minimum 6 characters):");
  if (!password) return;

  if (password.length < 6) {
    showNotification('Password must be at least 6 characters long.', 'error');
    return;
  }

  const confirmPassword = prompt("Confirm your password:");
  if (!confirmPassword) return;

  if (password !== confirmPassword) {
    showNotification('Passwords do not match. Please try again.', 'error');
    return;
  }

  try {
    // Create email/password credential and link it to the current user
    const credential = EmailAuthProvider.credential(user.email, password);
    await linkWithCredential(user, credential);
    showNotification('Password linked successfully! You can now sign in with email and password.', 'success');
    renderProviders(auth.currentUser);
  } catch (error) {
    console.error('Password linking error:', error);
    if (error.code === 'auth/credential-already-in-use') {
      showNotification('This email/password is already used by another account.', 'error');
    } else if (error.code === 'auth/email-already-in-use') {
      showNotification('This email is already linked to this account.', 'error');
    } else {
      showNotification('Failed to link password: ' + (error.message || error.code), 'error');
    }
  }
};
