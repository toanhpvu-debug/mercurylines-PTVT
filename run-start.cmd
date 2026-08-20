@echo off
REM Build + chay ban production tren may.
setlocal
set "NODE_EXE=C:\Users\admin\AppData\Local\ms-playwright-go\1.57.0\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
cd /d "%~dp0"
"%NODE_EXE%" node_modules\next\dist\bin\next build || exit /b 1
"%NODE_EXE%" node_modules\next\dist\bin\next start %*
