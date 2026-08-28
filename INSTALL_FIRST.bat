@echo off
chcp 65001 >nul
cd /d "%~dp0"
title YAK POS INSTALL
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install Node.js LTS, then run this file again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)
echo Installing YAK POS...
call npm install
echo.
echo INSTALL COMPLETE
echo Next time double-click START_YAK_POS.bat
pause
