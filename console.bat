@echo off
chcp 65001 >nul
title SEYE 控制台
rem 双击这个文件：起一个只在本机运行的小服务，然后自动打开控制台页面。
rem 关掉那个黑窗口，控制台就停了，不影响网站。
pushd "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [STOP] 没找到 Node.js。去 https://nodejs.org 装 18 以上版本。
  echo.
  popd
  pause
  exit /b 1
)

node console\server.js

popd
