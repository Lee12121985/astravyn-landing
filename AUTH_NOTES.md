# Authentication & User Data Notes

## Firestore Data Schema
### Collection: `users`
Document ID is the Firebase Auth `uid`.

| Field | Type | Description |
| :--- | :--- | :--- |
| `uid` | string | Matches doc ID |
| `email` | string | User email |
| `role` | string | "admin" or "user" |
| `isBlocked` | boolean | If true, access is denied |
| `createdAt` | timestamp | Server timestamp at signup |
| `displayName` | string | User's full name |
| `photoURL` | string | (Optional) Profile pic URL |
| `lastLogin` | timestamp | Updated on every login |

## Key Files

### Configuration
- `js/firebase-config.js`: Initializes and exports `app`, `auth`, `db`.

### Auth Logic
- `signup/index.html`: Handles user signup. Checks for "admin@astravin.com" to assign "admin" role. Creates `users` document.
- `login/index.html`: Handles login. Updates `lastLogin` and checks `isBlocked`. Signs out if blocked.
- `js/auth-manager.js`: **[NEW]** Global listener. Fetches user profile on load.

## Firestore Security Rules
Located in `firestore.rules`.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read, update, delete: if isOwner(userId) || isAdmin();
      allow create: if request.auth != null;
    }

    match /profiles/{userId} {
      allow read: if request.auth != null;
      allow write: if isOwner(userId) || isAdmin();
    }
    
    match /{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

## Admin Logic
- Use email `admin@astravin.com` to sign up as Admin.
- Admins bypass all rule restrictions (can read/write all docs).
- Logic is enforced via Firestore Rules `isAdmin()` check.
