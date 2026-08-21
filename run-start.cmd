@echo off
chcp 65001 >nul
REM Build lai TU DAU roi chay ban production.
REM Dung khi muon ep build sach; binh thuong dung chay-app.cmd (tu bo qua build
REM neu ma nguon khong doi).
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js. Cai tai https://nodejs.org roi chay lai.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" node_modules\next\dist\bin\next build || exit /b 1
"%NODE_EXE%" node_modules\next\dist\bin\next start %*
