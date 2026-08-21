@echo off
chcp 65001 >nul
REM Chay Mercury Materials o che do production - nhanh gap ~17 lan che do dev.
REM Chi build lai khi ma nguon doi; khong doi thi khoi dong thang trong ~2 giay.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\chay-app.ps1"
echo.
pause
