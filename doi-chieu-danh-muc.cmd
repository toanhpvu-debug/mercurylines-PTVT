@echo off
chcp 65001 >nul
REM Doi chieu danh muc vat tu trong app voi file kiem ke goc cua tung tau.
REM Khai bao file nguon o scripts\nguon-kiem-ke.json
setlocal
set "NODE_EXE=C:\Users\admin\AppData\Local\ms-playwright-go\1.57.0\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/doi-chieu-danh-muc.ts
echo.
pause
