import { auth } from "../auth/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

export function requireAuth(onReady) {
  const app = document.getElementById("app");

  if (app) app.hidden = true;
  if (document.body) {
    document.body.classList.add("auth-loading");
  }

  onAuthStateChanged(
    auth,
    (user) => {
      if (!user) {
        console.log("[AuthGuard] No user -> redirecting to login");
        window.location.replace("/auth/login.html");
        return;
      }

      if (document.body) {
        document.body.classList.remove("auth-loading");
      }
      if (app) app.hidden = false;

      console.log("[AuthGuard] User authenticated:", user.email);
      onReady(user);
    },
    (error) => {
      console.error("[AuthGuard] Listener error:", error);
      window.location.replace("/auth/login.html");
    }
  );
}

