# Local Development Setup for Astravyn

This guide helps you run Astravyn locally with subdomain routing.

## Prerequisites

- Node.js and npm installed
- `http-proxy` package installed (`npm install http-proxy`)
- Windows (this uses .bat scripts for Windows)

## Step 1: Configure Hosts File

The hosts file maps local subdomains to 127.0.0.1 (localhost).

### Option A: Automatic Setup (Recommended)

1. **Right-click** `setup-hosts.bat` and select **"Run as administrator"**
2. Follow the prompts
3. The hosts file will be updated automatically

### Option B: Manual Setup

1. **Open Notepad as Administrator**
   - Right-click Notepad → Run as Administrator

2. **File → Open** and navigate to:
   ```
   C:\Windows\System32\drivers\etc\hosts
   ```

3. **Add these lines** at the bottom:
   ```
   127.0.0.1 landing.astravyn.local
   127.0.0.1 time.astravyn.local
   127.0.0.1 dating.astravyn.local
   127.0.0.1 studio.astravyn.local
   127.0.0.1 auth.astravyn.local
   127.0.0.1 admin.astravyn.local
   127.0.0.1 api.astravyn.local
   127.0.0.1 cdn.astravyn.local
   ```

4. **Save** (Ctrl+S)

## Step 2: Start Firebase Emulators

Open PowerShell and run:

```powershell
firebase emulators:start --project astravyn-landing
```

This starts:
- **Hosting emulator**: Port 5000 (http://localhost:5000)
- **Auth emulator**: Port 9099
- **Firestore emulator**: Port 8080

**Leave this window open**

## Step 3: Start Proxy Server

Open **another PowerShell window** (as Administrator) and run:

```powershell
node proxy-server.js
```

You should see:
```
Astravyn Proxy Server Started
=========================================
Proxy running on http://127.0.0.1:80
Access local pages at:
  Admin Landing:  http://admin.astravyn.local/admin/landing.html
  Admin Login:    http://admin.astravyn.local/admin/login.html
  ...
```

**Keep this window open**

## Step 4: Access Admin Pages

Now you can access all pages using local subdomains:

### Admin Pages
- **Landing**: http://admin.astravyn.local/admin/landing.html
- **Login**: http://admin.astravyn.local/admin/login.html
- **Hub**: http://admin.astravyn.local/admin/hub.html
- **Dashboard**: http://admin.astravyn.local/admin/dashboard.html

### App Pages
- **Landing Page**: http://landing.astravyn.local/landing/index.html
- **Timesheet**: http://time.astravyn.local/timesheet/index.html
- **Dating App**: http://dating.astravyn.local/dating/index.html
- **Studio**: http://studio.astravyn.local/studio/index.html

## Testing Admin Authentication

To test the admin login:

1. Go to http://admin.astravyn.local/admin/login.html
2. Create a test user in Firebase Auth emulator:
   - Go to http://localhost:4000 (Firebase Emulator UI)
   - Create a new user with any email/password
3. Set admin role in Firestore:
   - Go to http://localhost:4000 → Firestore
   - Create document at path: `users/{uid}` where `{uid}` is the user's ID
   - Add field: `role: "admin"`
4. Sign in with the test account

## Troubleshooting

### "Address already in use" on port 80
The proxy server needs port 80. Close other services using it or run proxy-server.js as Administrator.

### "Cannot find module 'http-proxy'"
Install the dependency:
```powershell
npm install http-proxy
```

### Hosts file entries not working
- Clear DNS cache:
  ```powershell
  ipconfig /flushdns
  ```
- Restart browser after updating hosts file
- Verify entries were added: Open hosts file again

### Firebase emulator won't start
```powershell
# Kill any running Node processes
Get-Process node | Stop-Process -Force

# Start fresh
firebase emulators:start --project astravyn-landing
```

## Quick Start Commands

```powershell
# Terminal 1: Start Firebase emulators
firebase emulators:start --project astravyn-landing

# Terminal 2: Start proxy server (as Administrator)
node proxy-server.js
```

Then open your browser to:
```
http://admin.astravyn.local/admin/landing.html
```

## Files in This Setup

- **proxy-server.js** - Routes subdomain requests to localhost:5000
- **setup-hosts.bat** - Adds host entries automatically
- **start-dev.bat** - Shortcut to start Firebase emulators
- **LOCAL-DEV-SETUP.md** - This file

---

**For production**, all requests go to **https://astravyn-landing.web.app** via Firebase Hosting.
