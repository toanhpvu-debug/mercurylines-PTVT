@echo off
chcp 65001 >nul
REM Chuyen du lieu tu SQLite sang PostgreSQL.
REM Truoc khi chay:
REM   1. Dat DATABASE_URL trong .env thanh chuoi ket noi PostgreSQL
REM   2. Chay tao-bang-postgres.cmd de tao bang trong
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/chuyen-sang-postgres.ts %*
echo.
pause
