@echo off
REM Tim node.exe kha dung va dat vao bien NODE_EXE.
REM May nay chua cai Node.js he thong nen phai dung ban di kem Playwright.
REM KHONG ghim cung so phien ban: Playwright cap nhat la duong dan doi.
REM
REM Dung: call "%~dp0scripts\node-env.cmd"  roi dung "%NODE_EXE%"

set "NODE_EXE="

REM 1) Node cai san trong he thong (uu tien)
where node >nul 2>&1 && set "NODE_EXE=node" && goto :eof

REM 2) Ban di kem Playwright - lay phien ban moi nhat theo thu tu giam dan
if exist "%LOCALAPPDATA%\ms-playwright-go" (
  for /f "delims=" %%d in ('dir /b /ad /o-n "%LOCALAPPDATA%\ms-playwright-go" 2^>nul') do (
    if exist "%LOCALAPPDATA%\ms-playwright-go\%%d\node.exe" (
      set "NODE_EXE=%LOCALAPPDATA%\ms-playwright-go\%%d\node.exe"
      goto :eof
    )
  )
)

REM 3) Cac vi tri cai dat thong thuong
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe" & goto :eof
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe" & goto :eof

REM Khong tim thay - de trong, ben goi tu bao loi
goto :eof
