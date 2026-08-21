@echo off
chcp 65001 >nul
REM Nhap goi dong bo do ben kia gui toi.
REM Dung: dong-bo-nhap.cmd <duong dan file .json>
REM Khong truyen gi thi tu lay file moi nhat trong thu muc dong-bo\
setlocal
call "%~dp0scripts\node-env.cmd"
if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%NODE_EXE%" --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs ./scripts/dong-bo-nhap.ts %*
echo.
pause
