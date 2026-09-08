@echo off
chcp 65001 >nul
REM Chay Mercury Materials o che do DEVELOPMENT (co hot-reload, dung khi dang sua code).
REM Cham hon production khoang 50 lan - de lam viec hang ngay hay dung chay-app.cmd.
REM
REM File nay chi la vo boc. Phan kiem tra truoc khi chay (Node, node_modules, .env,
REM PostgreSQL con song khong, canh bao neu cong 3000 bi chiem) nam trong
REM scripts\run-dev.ps1: batch khong mo noi ket noi TCP de biet database co tra loi
REM hay khong, ma do dung la cho nguoi dung hay mac ket - app len duoc nhung moi
REM trang deu bao loi. Cung khuon voi chay-app.cmd -> scripts\chay-app.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-dev.ps1" %*
echo.
pause
