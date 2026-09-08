@echo off
chcp 65001 >nul
REM Kiem tra goi dong bo co bo sot bang nao khong (doi chieu voi schema Prisma).
REM Khong dung vao database, chay luc nao cung duoc.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/kiem-tra-dong-bo.ts
echo.
pause
