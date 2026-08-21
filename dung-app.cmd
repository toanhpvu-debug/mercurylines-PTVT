@echo off
chcp 65001 >nul
REM Tat app dang chay o cong 3000.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dung-app.ps1"
pause
