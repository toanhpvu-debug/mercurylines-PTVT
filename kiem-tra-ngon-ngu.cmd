@echo off
chcp 65001 >nul
REM Kiem tra tu dien hai ngon ngu (lib/i18n/dict): chuoi trong, tham so lech,
REM tieng Anh con chu Viet. Khong dung vao database, chay luc nao cung duoc.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --import ./node_modules/tsx/dist/loader.mjs ./scripts/kiem-tra-ngon-ngu.ts
echo.
pause
