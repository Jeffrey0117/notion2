@echo off
rem notion2: build, and only if the build passes, restart the running app.
rem The server reads the client's index.html once at start, so a client build
rem without a restart leaves the browser on a blank page.
cd /d "%~dp0"
if not defined NOTION2_PORT set "NOTION2_PORT=4491"

call pnpm build
if errorlevel 1 (
  echo Build failed. The running app was left alone.
  exit /b 1
)

rem Stop only the process listening on our port.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%NOTION2_PORT% .*LISTENING"') do taskkill /F /PID %%p >nul 2>&1

powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath cmd.exe -ArgumentList '/c \"%~dp0notion2-start.cmd\"' -WorkingDirectory '%~dp0'"
echo notion2 restarting on port %NOTION2_PORT%. Log: data\notion2.log
