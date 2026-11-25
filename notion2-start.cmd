@echo off
rem notion2: start services, then the built app on the PORT in .env. Log: data\notion2.log
rem Run detached:  powershell Start-Process -WindowStyle Hidden notion2-start.cmd
cd /d "%~dp0"
call "%~dp0notion2-services.cmd"
if errorlevel 1 exit /b 1
ping -n 4 127.0.0.1 >nul
call pnpm start > data\notion2.log 2>&1
