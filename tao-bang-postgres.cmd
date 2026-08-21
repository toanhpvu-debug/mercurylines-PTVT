@echo off
chcp 65001 >nul
REM Tao bang trong PostgreSQL theo schema (chay migration).
REM Truoc khi chay: dat DATABASE_URL trong .env thanh chuoi ket noi PostgreSQL.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" node_modules\prisma\build\index.js migrate deploy
if errorlevel 1 (
  echo.
  echo Tao bang that bai. Kiem tra DATABASE_URL va PostgreSQL da chay chua.
  pause
  exit /b 1
)
"%NODE_EXE%" node_modules\prisma\build\index.js generate
echo.
echo Da tao xong bang. Buoc tiep theo: chuyen-sang-postgres.cmd
pause
