@echo off
rem notion2 local services: its own Postgres (5433) and Redis (6380), loopback only.
rem Safe to run again when they are already up.
rem Data lives in data\ (gitignored). Override PGBIN / REDIS_DIR if installed elsewhere.
cd /d "%~dp0"
if not defined PGBIN set "PGBIN=%ProgramFiles%\PostgreSQL\16\bin"
if not defined REDIS_DIR set "REDIS_DIR=data\redis\Redis-8.10.3-Windows-x64-msys2"
if not defined NOTION2_PG_PORT set "NOTION2_PG_PORT=5433"
if not defined NOTION2_REDIS_PORT set "NOTION2_REDIS_PORT=6380"

if not exist "%PGBIN%\pg_ctl.exe" (
  echo PostgreSQL not found at "%PGBIN%". Set PGBIN.
  exit /b 1
)
if not exist "%REDIS_DIR%\redis-server.exe" (
  echo Redis not found at "%REDIS_DIR%". Set REDIS_DIR.
  exit /b 1
)

"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p %NOTION2_PG_PORT% -q
if errorlevel 1 "%PGBIN%\pg_ctl.exe" -D data\pg -o "-p %NOTION2_PG_PORT% -c listen_addresses=127.0.0.1" -l data\pg-log\pg.log start

"%REDIS_DIR%\redis-cli.exe" -p %NOTION2_REDIS_PORT% ping >nul 2>&1
if errorlevel 1 start "" /b "%REDIS_DIR%\redis-server.exe" --port %NOTION2_REDIS_PORT% --bind 127.0.0.1 --dir data/redis --logfile redis.log
exit /b 0
