@echo off
chcp 65001 >nul
REM Chay Mercury Materials o che do DEVELOPMENT (co hot-reload, dung khi dang sua code).
REM Cham hon production khoang 50 lan - de lam viec hang ngay hay dung chay-app.cmd.
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js. Cai tai https://nodejs.org roi chay lai.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" node_modules\next\dist\bin\next dev %*
