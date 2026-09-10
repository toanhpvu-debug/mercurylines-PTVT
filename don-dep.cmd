@echo off
chcp 65001 >nul
REM Don rac ban cai tren may nay: cache npm, log doi truoc, tep tam.
REM KHONG dung du lieu (pgdata, uploads, .env), khong dung node_modules.
REM   don-dep.cmd                 don cache npm, log cu, tep tam
REM   don-dep.cmd -CaCacheBuild   them: xoa .next\cache (lan chay sau build lau hon)
setlocal
call "%~dp0scripts\node-env.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\don-dep.ps1" %*
echo.
pause
