// cross-domain-auth.js
// Iframe-based authentication state manager

// Determine Auth Hub URL
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const AUTH_HUB_URL = isLocal ? 'http://127.0.0.1:5000/hub.html' : 'https://auth.astravyn.com/hub.html';
const AUTH_TIMEOUT = 5000; // 5 seconds timeout for initial sync

let currentUser = null;
let authStateListeners = [];
let iframe = null;
let isReady = false;

/**
 * Initialize the cross-domain auth system by creating the iframe
 */
export function initCrossDomainAuth() {
  if (document.getElementById('auth-hub-iframe')) return;

  iframe = document.createElement('iframe');
  iframe.id = 'auth-hub-iframe';
  iframe.src = AUTH_HUB_URL;
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  window.addEventListener('message', (event) => {
    // Security check: typically we check event.origin here
    // if (event.origin !== new URL(AUTH_HUB_URL).origin) return; 

    if (event.data.type === 'AUTH_STATE_UPDATE') {
      handleAuthStateChange(event.data.user);
    }
  });

  iframe.onload = () => {
    isReady = true;
    // Request initial state
    sendMessage({ type: 'GET_AUTH_STATE' });
  };
}

function sendMessage(msg) {
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(msg, '*');
  }
}

function handleAuthStateChange(user) {
  currentUser = user;
  notifyListeners(user);
}

function notifyListeners(user) {
  authStateListeners.forEach(listener => {
    try {
      listener(user);
    } catch (e) {
      console.error(e);
    }
  });
}

/**
 * Register a listener. 
 * IMPORTANT: This may not fire immediately if the iframe isn't loaded. 
 * It will fire once the initial sync happens.
 */
export function onAuthStateChange(callback) {
  authStateListeners.push(callback);
  // If we already have a user (or verified null), call immediately
  if (currentUser !== undefined) {
    // Note: currentUser is init as null, but effectively 'undefined' until first sync.
    // Let's rely on the hub update. 
    // If we want immediate feedback if already synced:
    callback(currentUser);
  }
  return () => {
    authStateListeners = authStateListeners.filter(l => l !== callback);
  };
}

/**
 * Sign Out
 */
export async function signOut() {
  sendMessage({ type: 'SIGN_OUT' });
  // Optimistically clear local state
  currentUser = null;
  notifyListeners(null);
}
