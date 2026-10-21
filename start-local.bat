@echo off
setlocal
cd /d "%~dp0"
title English Grammar Quiz - Sites Vinext Local Runner

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo Server stopped with error.
    pause
)
