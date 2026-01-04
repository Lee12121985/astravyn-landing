/**
 * Shared Auth Guard - ONE auth check for entire Astravyn platform
 * Used by: timesheet, admin, studio, dating apps
 * ✅ Single Firebase instance
 * ✅ Cross-subdomain compatible
 * ✅ Mobile/PWA ready
 */

import { auth } from "/auth/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

/**
 * Require authentication before running app logic
 * @param {Function} onSuccess - Callback when user is authenticated
 * @param {string} loginUrl - Optional custom login URL (default: /auth/login.html)
 */
export function requireAuth(onSuccess, loginUrl = "/auth/login.html") {
  // Hide page content until auth resolves
  if (document.body) {
    document.body.classList.add("auth-checking");
  }

  onAuthStateChanged(
    auth,
    (user) => {
      if (!user) {
        // User not authenticated - redirect to login with return URL
        const returnTo = encodeURIComponent(window.location.href);
        const redirectUrl = `${loginUrl}?returnTo=${returnTo}`;
        
        console.log("[Auth Guard] No user detected, redirecting to login");
        window.location.replace(redirectUrl);
        return;
      }

      // User authenticated - show page and run app logic
      if (document.body) {
        document.body.classList.remove("auth-checking");
      }
      
      console.log("[Auth Guard] User authenticated:", user.email);
      onSuccess(user);
    },
    (error) => {
      // Auth error - redirect to login
      console.error("[Auth Guard] Auth state error:", error);
      window.location.replace(loginUrl);
    }
  );
}
