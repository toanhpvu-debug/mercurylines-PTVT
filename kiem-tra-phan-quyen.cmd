@echo off
chcp 65001 >nul
REM Kiem tra ma tran phan quyen duyet yeu cau vat tu.
REM Khong dung vao database nen chay luc nao cung duoc.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --import ./node_modules/tsx/dist/loader.mjs ./scripts/kiem-tra-phan-quyen.ts
echo.
pause
