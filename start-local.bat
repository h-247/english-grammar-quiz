@echo off
setlocal
cd /d "%~dp0"
title Book Manager - Local Server

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo ========================================================
    echo  [!] Book Manager stopped or exited (code: %EXIT_CODE%).
    echo ========================================================
    echo Press any key to close this window...
    pause >nul
)
