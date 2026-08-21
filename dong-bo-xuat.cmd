@echo off
chcp 65001 >nul
REM Xuat goi dong bo. Tren tau: xuat du lieu cua tau. O van phong: xuat danh muc.
REM File goi nam trong thu muc dong-bo\
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/dong-bo-xuat.ts %*
echo.
pause
