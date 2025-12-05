# Authorization & Authentication Notes (AUTH_NOTES.md)

## Firebase Initialization
- **Config File**: `js/firebase-config.js`
- **Initialized Services**: Auth, Firestore, Storage.
- **Project ID**: `astravyn-landing`

## Authentication Code Location
- **Core Logic**: `js/auth.js`
  - `signUp(email, password, name)`: Creates Auth user & Firestore user doc.
  - `signIn(email, password)`: Logs in & checks if blocked.
  - `logout()`: Signs out.
  - `requireAuth()`: Route guard for protected pages.
  - `requireAdmin()`: Route guard for admin pages.
  - `monitorAuthState()`: Real-time user listener.

## Page Protection Status
| Page | Path | Protection Level | Guard Used |
| :--- | :--- | :--- | :--- |
| **Landing** | `index.html` | Public | None |
| **Login** | `login/index.html` | Public | None (Redirects if logged in? No) |
| **Signup** | `signup/index.html` | Public | None |
| **AI Studio** | `ai/index.html` | Protected | `requireAuth` (planned/implemented) |
| **Dating App** | `dating/index.html` | Protected | `requireAuth` (implied) |
| **Admin Panel** | `admin/index.html` | Admin Only | `requireAdmin` |
| **TimeSheet** | `timesheet/index.html`| Public | None |

## Admin Role Strategy
- **Assignment**: Hardcoded check in `signUp` function.
  - If `email === "admin@astravin.com"`, set `role: "admin"`.
  - Else, set `role: "user"`.
- **Privileges**:
  - **Admin**: Full read/write access to all collections (enforced by Firestore Rules & client checks).
  - **User**: Read/write access ONLY to `users/{ownUid}` and specific app data (e.g. implementation specific).
