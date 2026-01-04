# Agent Notes - Astravyn Project

## Project Structure Analysis
- **Framework**: Pure HTML/CSS/JS (ES Modules). Not Next.js/React.
- **Entry Point**: `index.html` (Landing Page).
- **Sub-apps**:
  - `timesheet/index.html`: Standalone Timesheet app (Public).
  - `ai/index.html`: AI Studio (Protected).
- **Firebase**:
  - Initialized in `index.html` (inline script).
  - Initialized in `timesheet/index.html` (inline script).
  - Config is hardcoded in these files.

## Implementation Status
1.  **Centralized Firebase Config**: Created `js/firebase-config.js`.
2.  **Auth System**:
    - `js/auth.js`: Handles signup, login, logout, and route guards (`requireAuth`, `requireAdmin`).
    - `login/index.html`: Login page.
    - `signup/index.html`: Signup page.
3.  **Route Protection**:
    - `ai/index.html`: Added auth check.
    - `dating/index.html`: Protected by default.
    - `admin/index.html`: Protected by `requireAdmin`.
4.  **Dating App**:
    - Located in `dating/`.
    - Features: Onboarding, Discover (Swipe), Matches, Profile.
    - Firestore Collections: `profiles`, `likes`, `matches`.
5.  **Admin Dashboard**:
    - Located in `admin/`.
    - Features: List users, Block/Unblock, Promote/Demote, Delete.

## File Locations
- **Auth Logic**: `js/auth.js`
- **Firebase Config**: `js/firebase-config.js`
- **Dating App**: `dating/index.html`, `dating/app.js`, `dating/style.css`
- **Admin Dashboard**: `admin/index.html`, `admin/app.js`
- **Login/Signup**: `login/index.html`, `signup/index.html`

## Firestore Schema
- **users/{uid}**: `uid`, `email`, `displayName`, `role`, `isBlocked`, `isPremium`, `createdAt`
- **profiles/{uid}**: `uid`, `name`, `age`, `gender`, `bio`, `location`, `interests`, `photos`, `isVisible`
- **likes/{autoId}**: `fromUid`, `toUid`, `type`, `createdAt`
- **matches/{autoId}**: `users` (array), `createdAt`

## Firebase Config Details
- **Project ID**: `astravyn-landing`
- **Auth Domain**: `astravyn-landing.firebaseapp.com`
- **Storage Bucket**: `astravyn-landing.firebasestorage.app`
