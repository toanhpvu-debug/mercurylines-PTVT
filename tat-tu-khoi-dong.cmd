@echo off
chcp 65001 >nul
REM Tat che do tu chay: lan sau mo may app se KHONG tu len.
REM App dang chay van chay tiep - muon tat han thi bam dup dung-app.cmd.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts	u-khoi-dong.ps1" -ViecCanLam tat
echo.
pause
