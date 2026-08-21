@echo off
chcp 65001 >nul
REM Khoi phuc du lieu tu mot ban sao luu trong E:\backup-mercury
REM
REM   khoi-phuc-du-lieu.cmd                    chon tu danh sach
REM   khoi-phuc-du-lieu.cmd -MoiNhat           lay ban moi nhat
REM   khoi-phuc-du-lieu.cmd -File "<duong dan>"  chi dinh file zip hoac .dump
REM
REM Truoc khi ghi de, script tu chup lai du lieu hien tai de lui lai duoc.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\khoi-phuc-du-lieu.ps1" %*
echo.
pause
