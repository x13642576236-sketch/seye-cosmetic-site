@echo off
chcp 65001 >nul
title SEYE Control Room
rem Double-click this file to start the control room.
rem Keep this file ASCII-only: cmd.exe reads .bat with the legacy codepage,
rem so Chinese characters here break the parser and the window closes silently.
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

node console\server.js
set RC=%ERRORLEVEL%

popd
echo.
echo  Console stopped. Exit code: %RC%
pause
