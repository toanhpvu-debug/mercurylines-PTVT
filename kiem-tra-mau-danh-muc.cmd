@echo off
chcp 65001 >nul
REM Kiem tra file Excel mau co nhap lai duoc khong (dung mau -> dua qua bo doc).
REM Khong dung vao database, chay luc nao cung duoc.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/kiem-tra-mau-danh-muc.ts
echo.
pause
