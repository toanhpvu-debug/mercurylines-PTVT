@echo off
chcp 65001 >nul
REM Doi chieu danh muc vat tu trong app voi file kiem ke goc cua tung tau.
REM Khai bao file nguon o scripts\nguon-kiem-ke.json
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js. Cai tai https://nodejs.org roi chay lai.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/doi-chieu-danh-muc.ts
echo.
pause
