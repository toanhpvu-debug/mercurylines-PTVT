@echo off
chcp 65001 >nul
REM Doi ma vat tu sang khuon theo bo phan: D-IMPA-#### / E-SPR-#### ...
REM Them --theo-nhom de xep lai theo khoi cua tung nhom vat tu.
REM Khong co --dong-y thi CHI LIET KE, khong sua gi.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/doi-ma-vat-tu.ts %*
echo.
pause
