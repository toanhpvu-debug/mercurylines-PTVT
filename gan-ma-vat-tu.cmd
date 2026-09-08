@echo off
chcp 65001 >nul
REM Gan bo phan - nhom thiet bi - chuc danh cho danh muc vat tu, va de xuat ma moi.
REM Khong co --dong-y thi CHI DE XUAT, khong sua gi.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/gan-ma-vat-tu.ts %*
echo.
pause
