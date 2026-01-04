@echo off
REM Astravyn Local Development Startup

echo.
echo ========================================
echo Astravyn Local Development Server
echo ========================================
echo.
echo Starting Firebase Emulators...
echo This window will show emulator logs.
echo.
echo In another terminal window, run:
echo   node proxy-server.js
echo.
echo Then access admin at:
echo   http://admin.astravyn.local/admin/landing.html
echo.
echo ========================================
echo.

firebase emulators:start --project astravyn-landing
