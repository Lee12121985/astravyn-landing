# Backend Architecture & Database Schema
**Project:** Astravyn Match (Dating & Matrimony)
**Tech Stack:** Firebase (Firestore + Auth + Cloud Functions)

## 1. Firestore Data Model (Collections)

### `users` (Private User Data)
*Stores sensitive account information and subscription status. Not publicly readable.*
- **Doc ID:** `uid` (from Firebase Auth)
- **Fields:**
  - `email` (string)
  - `phone` (string)
  - `createdAt` (timestamp)
  - `lastLogin` (timestamp)
  - `subscription` (string: 'free', 'premium', 'gold')
  - `subscriptionExpiry` (timestamp)
  - `fcmToken` (string) - For push notifications

### `datingProfiles` (Public Profile Data)
*The main collection for search and public viewing. Highly indexed.*
- **Doc ID:** `uid` (Same as users)
- **Fields:**
  - `displayName` (string)
  - `dob` (timestamp)
  - `age` (number) - Auto-calculated/updated, crucial for filtering
  - `gender` (string)
  - `location` (string) - City name
  - `geoHash` (string) - For radius search (optional)
  - `height` (number) - In cm
  - `education` (string)
  - `profession` (string)
  - `income` (string)
  - `religion` (string)
  - `maritalStatus` (string)
  - `bio` (string)
  - `photos` (array of objects): `[{ url: string, isMain: boolean, uploadedAt: timestamp }]`
  - `interests` (array of strings)
  - `stats`: `{ viewCount: number, likeCount: number }`
  - `visibility` (boolean) - If false, hidden from search

### `interactions` (Likes & Connects)
*Tracks all directed actions between users. Used for the "Likes" and "Connects" pages.*
- **Doc ID:** `auto-generated` or `uid_targetuid`
- **Fields:**
  - `fromUid` (string) - Initiator
  - `toUid` (string) - Receiver
  - `type` (string): `'like'`, `'connect'`, `'block'`
  - `status` (string): `'pending'`, `'accepted'`, `'rejected'`, `'seen'`
  - `timestamp` (timestamp)
  - **Denormalized Data (for list views):**
    - `fromName`, `fromPhoto`
    - `toName`, `toPhoto`

### `matches` (Successful Connections)
*Created when a 'connect' request is accepted or a mutual 'like' occurs.*
- **Doc ID:** `uid1_uid2` (Alphabetically sorted UIDs to ensure uniqueness)
- **Fields:**
  - `participants` (array): `[uid1, uid2]`
  - `matchedAt` (timestamp)
  - `lastMessage` (string)
  - `lastMessageAt` (timestamp)
  - `chatId` (string) - link to Realtime DB or subcollection

### `searches` (Saved Filters & History)
- **Doc ID:** `auto-generated`
- **Fields:**
  - `uid` (string)
  - `name` (string) - e.g. "Doctors in Kochi"
  - `filters` (map): `{ minAge, maxAge, location, profession, religion }`
  - `createdAt` (timestamp)

### `settings` (User Preferences)
- **Doc ID:** `uid`
- **Fields:**
  - `notifications` (map): `{ email: boolean, push: boolean }`
  - `privacy` (map): `{ showOnlineStatus: boolean, incognito: boolean }`
  - `theme` (string): 'light' | 'neon'

---

## 2. Indexing Strategy (Firestore)
*Crucial for the Advanced Search page performance.*

1.  **Composite Index: Location & Age**
    - Collection: `datingProfiles`
    - Fields: `location` (Asc) + `age` (Asc)

2.  **Composite Index: Gender & Age**
    - Collection: `datingProfiles`
    - Fields: `gender` (Asc) + `age` (Asc)

3.  **Composite Index: Profession & Age**
    - Collection: `datingProfiles`
    - Fields: `profession` (Asc) + `age` (Asc)

4.  **Composite Index: Pending Interactions**
    - Collection: `interactions`
    - Fields: `toUid` (Asc) + `type` (Asc) + `timestamp` (Desc)
    - *Purpose: "Show me who liked me recently"*

---

## 3. API / Cloud Function Definitions
*These can be implemented as Firebase Callable Functions to secure logic.*

### Search & Discovery
- **`searchProfiles(filters)`**
  - **Input:** `{ ageRange: [24, 30], location: "Kochi", religion: "Hindu", ... }`
  - **Logic:** Queries `datingProfiles` with composite filters. Handles pagination.
  - **Output:** List of profile objects (sanitized).

### Interaction Logic
- **`sendInteraction(targetUid, type)`**
  - **Input:** `targetUid`, `type` ('like' | 'connect')
  - **Logic:**
    1. Check if blocked.
    2. Check quota (e.g., 5 connects/day).
    3. Create doc in `interactions`.
    4. **Trigger:** If mutual like, create doc in `matches` and notify both.
  - **Output:** `{ success: true, status: 'sent' | 'matched' }`

- **`getInteractions(type, direction)`**
  - **Input:** `type` ('like'), `direction` ('sent' | 'received')
  - **Logic:** Query `interactions` collection where `fromUid` OR `toUid` matches current user.
  - **Output:** List of interaction items.

### Profile Management
- **`updateProfile(data)`**
  - **Input:** Partial profile object.
  - **Logic:** Validate fields (server-side validation of age, content moderation). Update `datingProfiles/{uid}`.
  - **Output:** Updated profile.

### Settings
- **`updateSettings(settingsMap)`**
  - **Input:** `{ notifications: { ... } }`
  - **Logic:** Merge update into `settings/{uid}`.
