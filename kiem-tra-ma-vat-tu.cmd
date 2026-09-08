@echo off
chcp 65001 >nul
REM Kiem tra bo sinh va bo soat ma vat tu (D-BSN-IMP-611333, E-2E-BME-0001).
REM Khong dung vao database, chay luc nao cung duoc.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/kiem-tra-ma-vat-tu.ts
echo.
pause
