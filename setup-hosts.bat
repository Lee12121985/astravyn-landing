@echo off
REM Astravyn Local Development Setup
REM This script adds host entries to Windows hosts file

echo Astravyn Local Development Setup
echo ==================================
echo.
echo This script will add the following entries to your hosts file:
echo   127.0.0.1 landing.astravyn.local
echo   127.0.0.1 time.astravyn.local
echo   127.0.0.1 dating.astravyn.local
echo   127.0.0.1 studio.astravyn.local
echo   127.0.0.1 auth.astravyn.local
echo   127.0.0.1 admin.astravyn.local
echo   127.0.0.1 api.astravyn.local
echo   127.0.0.1 cdn.astravyn.local
echo.
echo IMPORTANT: Run this script as Administrator!
echo.
pause

REM Check if running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: This script must be run as Administrator!
  echo Please right-click this file and select "Run as administrator"
  pause
  exit /b 1
)

set HOSTS_FILE=%WINDIR%\System32\drivers\etc\hosts

REM Check if entries already exist
findstr /c:"landing.astravyn.local" "%HOSTS_FILE%" >nul
if %errorlevel% equ 0 (
  echo.
  echo NOTICE: Host entries already exist in hosts file!
  echo Skipping duplicate entries.
  pause
  exit /b 0
)

REM Add entries to hosts file
echo. >> "%HOSTS_FILE%"
echo REM Astravyn Local Development Subdomains >> "%HOSTS_FILE%"
echo 127.0.0.1 landing.astravyn.local >> "%HOSTS_FILE%"
echo 127.0.0.1 time.astravyn.local >> "%HOSTS_FILE%"
echo 127.0.0.1 dating.astravyn.local >> "%HOSTS_FILE%"
echo 127.0.0.1 studio.astravyn.local >> "%HOSTS_FILE%"
echo 127.0.0.1 auth.astravyn.local >> "%HOSTS_FILE%"
echo 127.0.0.1 admin.astravyn.local >> "%HOSTS_FILE%"
echo 127.0.0.1 api.astravyn.local >> "%HOSTS_FILE%"
echo 127.0.0.1 cdn.astravyn.local >> "%HOSTS_FILE%"

echo.
echo SUCCESS! Host entries have been added to:
echo %HOSTS_FILE%
echo.
echo Next steps:
echo 1. Start Firebase emulators: firebase emulators:start
echo 2. Open another terminal and run: node proxy-server.js (as Administrator)
echo 3. Access admin at: http://admin.astravyn.local/admin/landing.html
echo.
pause
