@echo off
chcp 65001 >nul
REM Doi email - ten - mat khau cua mot tai khoan. Mat khau go vao luc chay.
REM Vi du: doi-tai-khoan.cmd admin@example.com --email-moi=admin@mercurylines.com --mat-khau
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/doi-tai-khoan.ts %*
echo.
pause
