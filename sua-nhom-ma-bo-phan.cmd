@echo off
chcp 65001 >nul
REM Sua mat hang nhap khi o Nhom cua file ghi MA BO PHAN (E, E1..E10): dung bo phan, doi ma, nguoi giu, bo nhom "E".
REM Khong co --dong-y thi CHI LIET KE, khong sua gi.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/sua-nhom-ma-bo-phan.ts %*
echo.
pause
