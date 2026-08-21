@echo off
chcp 65001 >nul
REM Sao luu du lieu van hanh (database + file upload + .env + bieu mau Excel).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sao-luu-du-lieu.ps1"
echo.
pause
