@echo off
chcp 65001 >nul
REM Kiem tra bo tach du lieu phieu nhan (BDN scan / phieu giao / bang dan tay).
REM Khong dung vao database, khong can Windows OCR.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --import ./node_modules/tsx/dist/loader.mjs ./scripts/kiem-tra-doc-phieu.ts
echo.
pause
