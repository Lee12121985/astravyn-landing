/**
 * Auto Guard - Blocks page access until user is authenticated
 * This script MUST load before any page content to prevent content flash
 */

import { auth } from "/auth/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Public pages that don't require authentication
const PUBLIC_PATHS = [
  "/auth/login.html",
  "/auth/signup.html",
  "/",
  "/index.html",
  "/landing/index.html"
];

// Get current path
const currentPath = window.location.pathname;

// Check if current page is public
if (PUBLIC_PATHS.includes(currentPath)) {
  // Public page - just remove loading class
  document.body.classList.remove("auth-loading");
  console.log("[Auth Guard] Public page, no authentication required");
} else {
  // Protected page - check authentication
  console.log("[Auth Guard] Protected page, checking authentication...");
  
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Not authenticated - redirect to login with return URL
      console.log("[Auth Guard] User not authenticated, redirecting to login");
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/auth/login.html?returnTo=${returnTo}`);
    } else {
      // Authenticated - show page
      console.log(`[Auth Guard] User authenticated: ${user.email}`);
      document.body.classList.remove("auth-loading");
    }
  });
}
