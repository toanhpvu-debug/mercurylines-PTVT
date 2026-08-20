@echo off
REM Chay Mercury Materials o che do development.
REM May nay chua cai Node.js he thong -> dung node.exe di kem Playwright.
setlocal
set "NODE_EXE=C:\Users\admin\AppData\Local\ms-playwright-go\1.57.0\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
cd /d "%~dp0"
"%NODE_EXE%" node_modules\next\dist\bin\next dev %*
