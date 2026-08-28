@echo off
cd /d "%~dp0"
title YAK POS DEBUG
call npm start
echo.
echo YAK POS stopped. Take a photo of any error above.
pause
