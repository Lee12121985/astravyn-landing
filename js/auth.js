// js/auth.js
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
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
        await signOut(auth);
        // UI will update automatically from onAuthStateChanged
      });
    }
  });
}

export function requireAdmin() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        window.location.href = '../login/index.html';
        reject(new Error("Not logged in"));
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          window.location.href = '../index.html';
          reject(new Error("No user profile"));
          return;
        }

        const data = snap.data();
        if (data.role !== 'admin') {
          window.location.href = '../index.html';
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
