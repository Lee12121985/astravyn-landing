// js/auth.js
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getIdTokenResult,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* -------------------- LOGIN PAGE LOGIC -------------------- */

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePassword");
const messageBox = document.getElementById("loginMessage");

// Only run if we are actually on the login page
if (loginForm) {
  // Show / hide password
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      togglePasswordBtn.textContent = isHidden ? "🙈" : "👁";
    });
  }

  // Handle sign in
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (messageBox) {
      messageBox.textContent = "Signing in...";
      messageBox.style.color = "blue";
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);

      if (messageBox) {
        messageBox.textContent = "Success! Redirecting…";
        messageBox.style.color = "green";
      }

      setTimeout(() => {
        // login/ -> go back to root landing page
        window.location.href = "../index.html";
      }, 800);
    } catch (err) {
      console.error(err);
      if (messageBox) {
        let msg = "Login failed, please try again.";
        if (err.code === "auth/invalid-email") msg = "Invalid email.";
        if (err.code === "auth/user-not-found")
          msg = "No user found with this email.";
        if (err.code === "auth/wrong-password")
          msg = "Incorrect password.";
        if (err.code === "auth/too-many-requests")
          msg = "Too many attempts, please wait and try again.";

        messageBox.textContent = msg;
        messageBox.style.color = "red";
      }
    }
  });
}

/* -------------------- NAVBAR / LANDING PAGE LOGIC -------------------- */

export function setupNavbarAuthUI() {
  const navAuth = document.getElementById("nav-auth");
  if (!navAuth) return;

  onAuthStateChanged(auth, (user) => {
    // Logged out state → show Login button
    if (!user) {
      navAuth.innerHTML = `
        <a href="./login/index.html" class="login-btn">Sign in</a>
      `;
      return;
    }

    // Logged in state → show avatar + name + dropdown
    const name = user.displayName || (user.email ? user.email.split("@")[0] : "User");
    const photo = user.photoURL;
    const initial = name.charAt(0).toUpperCase();

    navAuth.innerHTML = `
      <div class="user-dropdown">
        <div class="user-chip" id="user-chip">
          ${photo
        ? `<img src="${photo}" alt="avatar" class="user-avatar" />`
        : `<div class="user-avatar">${initial}</div>`
      }
          <span class="user-name">${name}</span>
        </div>
        <div class="user-menu" id="user-menu">
          <div class="user-menu-item">${user.email || ""}</div>
          <div class="user-menu-item" id="logout-btn">Sign out</div>
        </div>
      </div>
    `;

    const chip = document.getElementById("user-chip");
    const menu = document.getElementById("user-menu");
    const logoutBtn = document.getElementById("logout-btn");

    if (chip && menu) {
      chip.addEventListener("click", () => {
        const visible = menu.style.display === "block";
        menu.style.display = visible ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (!navAuth.contains(e.target)) {
          menu.style.display = "none";
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        // Clear video player modal state on logout
        try {
          sessionStorage.removeItem('videoPlayerModalState');
        } catch (e) {
          console.warn('Failed to clear modal state on logout:', e);
        }
        await signOut(auth);
        // UI will update automatically from onAuthStateChanged
      });
    }
  });
}

export function requireAuth(redirectPath = null) {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        // Redirect to auth hub with redirect parameter
        const redirectUrl = encodeURIComponent(window.location.href);
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const authHubUrl = isLocal 
          ? `http://127.0.0.1:5000/login.html?redirect=${redirectUrl}`
          : `https://auth.astravyn.com/login.html?redirect=${redirectUrl}`;
        
        // No UI should be shown before auth check - redirect immediately
        window.location.href = authHubUrl;
        reject(new Error("Not logged in"));
        return;
      }

      try {
        // Optional: Check if user profile exists
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          // Check if account is blocked
          if (data.accountStatus && data.accountStatus !== 'active') {
            await signOut(auth);
            window.location.href = redirectPath;
            reject(new Error("Account is blocked"));
            return;
          }
        }

        resolve(user);
      } catch (e) {
        console.error("Auth check error", e);
        // Still resolve with user if Firestore check fails
        resolve(user);
      }
    });
  });
}

export function requireAdmin() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        // Redirect to home page instead of login portal
        const homePage = 'https://astravyn-landing.web.app';

        document.body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:radial-gradient(circle at top, #1a2950 0, #020615 55%, #000 100%);color:#fff;font-family:system-ui,sans-serif;">
            <div style="text-align:center;padding:40px;">
              <div style="font-size:48px;margin-bottom:20px;">🔒</div>
              <h2 style="margin-bottom:12px;">Admin Access Required</h2>
              <p style="color:#94a3b8;margin-bottom:24px;">Please sign in with an admin account.</p>
              <p style="color:#64748b;font-size:14px;">Redirecting to home page...</p>
            </div>
          </div>
        `;

        setTimeout(() => {
          window.location.href = homePage;
        }, 1500);
        reject(new Error("Not logged in"));
        return;
      }

      try {
        // First preference: custom claims
        try {
          const tokenResult = await getIdTokenResult(user, true);
          if (tokenResult.claims && tokenResult.claims.admin === true) {
            resolve(user);
            return;
          }
        } catch (claimErr) {
          console.warn("Admin claim check (token) failed:", claimErr);
        }

        // Fallback: Firestore role check for backward compatibility
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          window.location.href = 'https://astravyn.com';
          reject(new Error("No user profile"));
          return;
        }

        const data = snap.data();
        if (data.role !== 'admin') {
          document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:radial-gradient(circle at top, #1a2950 0, #020615 55%, #000 100%);color:#fff;font-family:system-ui,sans-serif;">
              <div style="text-align:center;padding:40px;">
                <div style="font-size:48px;margin-bottom:20px;">🚫</div>
                <h2 style="margin-bottom:12px;">Access Denied</h2>
                <p style="color:#94a3b8;margin-bottom:24px;">Admin access required. Redirecting...</p>
              </div>
            </div>
          `;
          setTimeout(() => {
            // Detect localhost and use local URLs
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const homePage = isLocalhost
              ? `http://${window.location.hostname}:${window.location.port || '3000'}/index.html`
              : 'https://astravyn-landing.web.app';
            window.location.href = homePage;
          }, 2000);
          reject(new Error("Not authorized"));
          return;
        }

        resolve(user);
      } catch (e) {
        console.error("Admin check error", e);
        reject(e);
      }
    });
  });
}
