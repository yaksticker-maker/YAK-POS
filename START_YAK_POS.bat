@echo off
cd /d "%~dp0"
title YAK POS
if not exist "node_modules\electron\package.json" (
  echo YAK POS components are not installed in this folder.
  echo Run INSTALL_FIRST.bat once.
  pause
  exit /b 1
)
call npm start
