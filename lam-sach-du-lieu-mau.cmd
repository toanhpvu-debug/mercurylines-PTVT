@echo off
chcp 65001 >nul
REM Xoa du lieu mau de bat dau nhap du lieu that.
REM Khong co tham so --dong-y thi chi LIET KE, khong xoa gi.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/lam-sach-du-lieu-mau.ts %*
echo.
pause
