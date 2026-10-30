@echo off
chcp 65001 >nul
rem This site lives on a network share. cmd.exe refuses UNC paths as cwd,
rem so pushd maps a temporary drive letter instead of using cd /d.
pushd "%~dp0"
if errorlevel 1 goto fail
echo.
echo ==========================================
echo  SEYE site - build and pack
echo ==========================================
node release.js
if errorlevel 1 goto fail
popd
echo.
echo  Done. The dist folder is ready.
echo  Drag the dist folder into Netlify - Deploys.
echo.
pause
exit /b 0
:fail
echo.
echo  Build failed. Read the message above.
pause
exit /b 1
