@echo off
chcp 65001 >nul
REM Dung PostgreSQL cho may moi: tao tai khoan, tao database, tao bang, chep du lieu.
REM Chay MOT LAN sau khi da cai PostgreSQL 17.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\cai-postgres.ps1" %*
echo.
pause
