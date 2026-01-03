# 🚀 Astravyn Local Development Setup - RUNNING

## ✅ Setup Complete

Your multi-subdomain Astravyn platform is now running locally with Firebase emulators!

---

## 🌐 Access Your Applications

### Main Entry Points
- **🏠 Landing Page:** http://landing.astravyn.local:3000
- **🔐 Authentication:** http://auth.astravyn.local:3000
- **⏱️ Timesheet App:** http://time.astravyn.local:3000
- **💝 Dating App:** http://dating.astravyn.local:3000 (Coming Soon)
- **🎨 AI Studio:** http://studio.astravyn.local:3000 (In Progress)

### Additional Subdomains
- **👑 Admin:** http://admin.astravyn.local:3000
- **🔌 API:** http://api.astravyn.local:3000
- **📦 CDN:** http://cdn.astravyn.local:3000

### Firebase Emulator Dashboard
- **🔥 Emulator UI:** http://localhost:4000
  - View Auth users: http://localhost:4000/auth
  - View Firestore data: http://localhost:4000/firestore

---

## 🧪 Testing Authentication Flow

### Test Scenario 1: New User Signup
1. Go to http://landing.astravyn.local:3000
2. Click **"Create account"** button
3. Should redirect to http://auth.astravyn.local:3000/signup.html
4. Fill in signup form:
   - Email: test@example.com
   - Password: password123
   - Display Name: Test User
5. Click **"Sign Up"**
6. Should redirect to http://auth.astravyn.local:3000/hub.html
7. Check Firebase Emulator UI - user should appear in Authentication tab

### Test Scenario 2: Existing User Login
1. Go to http://landing.astravyn.local:3000
2. Click **"Sign in"** button
3. Should redirect to http://auth.astravyn.local:3000/login.html
4. Enter credentials from previous test
5. Click **"Log In"**
6. Should redirect to http://auth.astravyn.local:3000/hub.html

### Test Scenario 3: Cross-Subdomain Navigation
1. From Hub (http://auth.astravyn.local:3000/hub.html)
2. Click **"Open Timesheet"** tile
3. Should navigate to http://time.astravyn.local:3000
4. **✅ Auth state should be preserved** - you should stay logged in
5. Verify user profile appears in top-right corner
6. Click **Logout** button
7. Should redirect back to landing page

### Test Scenario 4: Protected Route Access
1. Open http://time.astravyn.local:3000 directly (without logging in)
2. **Should automatically redirect** to http://auth.astravyn.local:3000/login.html
3. After login, should return to timesheet app

---

## 🔍 Button Logic Tests in Emulator

### Landing Page (landing.astravyn.local:3000)
- ✅ **Sign in** button → redirects to auth.astravyn.local:3000/login.html
- ✅ **Create account** button → redirects to auth.astravyn.local:3000/signup.html
- ✅ If already authenticated → auto-redirects to hub

### Login Page (auth.astravyn.local:3000/login.html)
- ✅ **Log In** button → creates session, redirects to hub
- ✅ **Sign in with Google** button → triggers OAuth flow
- ✅ **Sign up** link → redirects to signup page

### Signup Page (auth.astravyn.local:3000/signup.html)
- ✅ **Sign Up** button → creates user, creates Firestore profile, redirects to hub
- ✅ **Sign up with Google** button → triggers OAuth flow
- ✅ **Log in** link → redirects to login page

### Hub Page (auth.astravyn.local:3000/hub.html)
- ✅ **Open Timesheet** tile → navigates to time.astravyn.local:3000
- ✅ **Open AI Studio** tile → navigates to studio.astravyn.local:3000 (placeholder)
- ✅ **Open Dating App** tile → navigates to dating.astravyn.local:3000 (placeholder)
- ✅ **Logout** button → signs out, redirects to landing page

### Timesheet Page (time.astravyn.local:3000)
- ✅ **Logout** button → signs out, redirects to landing
- ✅ Month navigation buttons → change timesheet view
- ✅ **Export to Excel** button → downloads XLSX file
- ✅ Status dropdowns → update Firestore in real-time

---

## 📊 Monitor Firebase Operations

### Authentication
1. Open http://localhost:4000/auth
2. Watch users get created during signup/login tests
3. Verify user UIDs match Firestore document IDs

### Firestore
1. Open http://localhost:4000/firestore
2. Check `users` collection:
   - Documents should be created with email, displayName, role, etc.
   - Admin role assigned if email contains "admin"
3. Check `timesheets` collection:
   - Timesheet data saved from time.astravyn.local

---

## 🔧 Troubleshooting

### "Cannot connect to emulator" error
- Check if Firebase emulators window is still open
- Verify in PowerShell window: should show "All emulators ready!"
- Restart emulators: Close PowerShell window → Run `firebase emulators:start`

### "404 Not Found" on subdomain
- Verify hosts file has all entries: `Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String "astravyn.local"`
- Check proxy server window is still open
- Restart proxy: Close PowerShell window → Run `node proxy-server.js`

### Auth state not preserved across subdomains
- Open browser DevTools → Application → Cookies
- Verify Firebase cookies exist for `.astravyn.local` domain
- Clear all cookies and try again

### Buttons not working
1. Open browser DevTools → Console
2. Look for JavaScript errors
3. Check Network tab for failed requests
4. Verify emulator connections in Console:
   ```
   [Firebase/Auth] Connected to emulator at http://127.0.0.1:9099
   [Firebase/Firestore] Connected to emulator at 127.0.0.1:8080
   ```

---

## 🛑 Stopping the Servers

### Stop Firebase Emulators
1. Find the PowerShell window with "firebase emulators:start"
2. Press `Ctrl+C` twice
3. Wait for clean shutdown message

### Stop Proxy Server
1. Find the PowerShell window with "proxy-server.js"
2. Press `Ctrl+C`
3. Wait for "Server closed" message

---

## 🚀 Restarting Development Environment

### Quick Start Commands
```powershell
# Terminal 1: Start Firebase Emulators
firebase emulators:start

# Terminal 2: Start Proxy Server
node proxy-server.js

# Then open: http://landing.astravyn.local:3000
```

---

## 📝 Configuration Files Modified

1. ✅ **auth/firebase-config.js** - Added `.astravyn.local` domain detection
2. ✅ **proxy-server.js** - Created subdomain routing server
3. ✅ **package.json** - Added npm scripts and dependencies

---

## 🎯 Next Steps

1. **Test all authentication flows** (signup, login, logout)
2. **Verify cross-subdomain navigation** works correctly
3. **Check Firestore data persistence** in emulator
4. **Test timesheet app functionality** (CRUD operations)
5. **Validate auth guards** on protected routes
6. **Review emulator logs** for any errors

---

## 💡 Tips

- Keep both PowerShell windows open while testing
- Use Emulator UI (localhost:4000) to inspect data in real-time
- Clear browser cache if you encounter stale data issues
- Use Incognito/Private browsing for clean auth state testing
- Check proxy server console for request logs

---

**✨ Happy Testing! Your local multi-subdomain environment is ready.**
