@echo off
chcp 65001 >nul
rem Publish = rebuild + commit + push. Netlify then rebuilds from GitHub by itself.
rem Lives on a network share, so pushd (not cd /d) maps a temporary drive letter.
pushd "%~dp0"
if errorlevel 1 goto fail

echo.
echo ==========================================
echo  SEYE site - publish to live
echo ==========================================
echo.

echo [1/4] check index.html for editor pollution
findstr /C:"data-page-node-id" index.html >nul 2>&1
if not errorlevel 1 goto polluted

echo [2/4] rebuild articles and feeds
node build-articles.js
if errorlevel 1 goto fail

echo [3/4] commit
git add -A
git diff --cached --quiet
if not errorlevel 1 goto nochanges

set "MSG="
set /p MSG=Commit message (Enter = default): 
if not defined MSG set "MSG=content: publish update"
git commit -q -m "%MSG%"
if errorlevel 1 goto fail

echo [4/4] push to GitHub
git push origin main
if errorlevel 1 goto pushfail

echo.
echo  Done. Netlify rebuilds in about a minute.
echo  https://seye-cosmetic-site.netlify.app
echo.
popd
pause
exit /b 0

:polluted
echo.
echo  [STOP] index.html carries data-page-node-id attributes.
echo  A visual editor rewrote it. Fix it first:
echo      git checkout -- index.html
echo  Then run this script again.
echo.
popd
pause
exit /b 1

:nochanges
echo.
echo  Nothing changed. Nothing to upload.
echo.
popd
pause
exit /b 0

:pushfail
echo.
echo  [FAIL] push rejected. Check the network, then run: git push origin main
echo.
popd
pause
exit /b 1

:fail
echo.
echo  [FAIL] See the message above.
echo.
popd
pause
exit /b 1
