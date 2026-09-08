@echo off
chcp 65001 >nul
REM Bat che do TU CHAY: dang nhap Windows la app co san, khong phai mo cmd.
REM Tao mot viec trong Task Scheduler + loi tat ngoai Desktop.
REM Khong can quyen quan tri.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts	u-khoi-dong.ps1" -ViecCanLam bat
echo.
pause
