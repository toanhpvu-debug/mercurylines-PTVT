@echo off
REM Day thay doi ma nguon len GitHub (add + commit + push).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dong-bo-github.ps1"
echo.
pause
