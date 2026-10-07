@echo off
title Aeirmist Full Stack Launcher
echo =========================================================
echo    Starting Aeirmist Full-Stack System (Postgres, Redis, Backend, Frontend)
echo =========================================================

set REDIS_PATH=C:\Users\Junaed Islam Jim\AppData\Local\Microsoft\WinGet\Packages\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\Redis-8.10.1-Windows-x64-msys2\redis-server.exe
set PG_BIN=D:\Aeirmist\pgsql\pgsql\bin
set PG_DATA=D:\Aeirmist\pgsql-data

:: 1. Start Redis
echo [1/4] Checking and starting Redis on port 6379...
netstat -ano | findstr :6379 | findstr LISTENING >nul
if errorlevel 1 (
    start "Aeirmist Redis Server" /min "%REDIS_PATH%"
    timeout /t 2 /nobreak >nul
    echo   -> Redis started!
) else (
    echo   -> Redis is already running!
)

:: 2. Start PostgreSQL
echo [2/4] Checking and starting PostgreSQL on port 5432...
netstat -ano | findstr :5432 | findstr LISTENING >nul
if errorlevel 1 (
    "%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -l "%PG_DATA%\server.log" start
    timeout /t 2 /nobreak >nul
    echo   -> PostgreSQL started!
) else (
    echo   -> PostgreSQL is already running!
)

:: 3. Start Backend API
echo [3/4] Starting Backend API on port 4000...
netstat -ano | findstr :4000 | findstr LISTENING >nul
if errorlevel 1 (
    cd /d D:\Aeirmist\backend
    start "Aeirmist Backend API" /min node dist/index.js
    timeout /t 2 /nobreak >nul
    echo   -> Backend started on http://localhost:4000!
) else (
    echo   -> Backend API is already running!
)

:: 4. Start Frontend
echo [4/4] Starting Vite Frontend on port 5173...
netstat -ano | findstr :5173 | findstr LISTENING >nul
if errorlevel 1 (
    cd /d D:\Aeirmist
    start "Aeirmist Vite Frontend" /min npx vite --port 5173
    timeout /t 2 /nobreak >nul
    echo   -> Frontend started on http://localhost:5173!
) else (
    echo   -> Frontend is already running!
)

echo.
echo =========================================================
echo    All services are running!
echo    - Frontend:  http://localhost:5173
echo    - API Health: http://localhost:4000/health
echo =========================================================
exit /b 0
