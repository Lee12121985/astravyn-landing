// js/auth-guard.js
// Enforces sign-in on pages that include this module
import { requireAuth } from './auth.js';

// Redirects to login if not authenticated
requireAuth('../login/index.html');
