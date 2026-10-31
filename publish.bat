@echo off
chcp 65001 >nul
rem Thin wrapper. The real logic is publish.js - it locates git itself, because this
rem machine has no system Git (only WorkBuddy's PortableGit, which is not on cmd's PATH).
rem pushd, not cd /d: this folder may live on a UNC network share.
pushd "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [STOP] Node.js not found. Install Node 18+ from https://nodejs.org
  echo.
  popd
  pause
  exit /b 1
)

node publish.js %*

popd
pause
