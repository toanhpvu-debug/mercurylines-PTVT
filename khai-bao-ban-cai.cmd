@echo off
chcp 65001 >nul
REM Khai bao ban cai nay la cua tau nao, hay la ban van phong.
REM   khai-bao-ban-cai.cmd ML-001     (ban cai tren tau)
REM   khai-bao-ban-cai.cmd VANPHONG   (ban cai van phong)
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/khai-bao-ban-cai.ts %*
echo.
pause
