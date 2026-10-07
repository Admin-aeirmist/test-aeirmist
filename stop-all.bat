@echo off
title Stop Aeirmist Services
echo =========================================================
echo    Stopping Aeirmist Full-Stack System
echo =========================================================

set PG_BIN=D:\Aeirmist\pgsql\pgsql\bin
set PG_DATA=D:\Aeirmist\pgsql-data

:: 1. Stop PostgreSQL
echo [1/3] Stopping PostgreSQL...
"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" stop >nul 2>&1
echo   -> PostgreSQL stopped.

:: 2. Stop Redis
echo [2/3] Stopping Redis...
taskkill /f /im redis-server.exe >nul 2>&1
echo   -> Redis stopped.

:: 3. Stop Node (Backend on 4000 & Frontend on 5173)
echo [3/3] Stopping Node Servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo   -> Node servers stopped.

echo.
echo =========================================================
echo    All Aeirmist services stopped successfully!
echo =========================================================
exit /b 0
