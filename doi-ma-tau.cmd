@echo off
chcp 65001 >nul
REM Doi tien to ma tau, vi du ML-001 -> MLS-001 (doi theo ca ma kho cua tau).
REM Khong co --dong-y thi CHI LIET KE, khong sua gi.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/doi-ma-tau.ts %*
echo.
pause
