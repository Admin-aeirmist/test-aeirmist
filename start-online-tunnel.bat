@echo off
title Aeirmist Online Cloudflare Tunnel (aeirmist.com)
echo =========================================================
echo    Starting Cloudflare Tunnel for aeirmist.com
echo    Route: https://aeirmist.com -> http://localhost:4000
echo =========================================================
cd /d D:\Aeirmist
set TUNNEL_TOKEN=%CLOUDFLARE_TUNNEL_TOKEN%
if "%TUNNEL_TOKEN%"=="" (
  if exist .env (
    for /f "tokens=1,* delims==" %%a in ('type .env ^| findstr /i "^CLOUDFLARE_TUNNEL_TOKEN="') do set TUNNEL_TOKEN=%%b
  )
)

if "%TUNNEL_TOKEN%"=="" (
  echo [ERROR] CLOUDFLARE_TUNNEL_TOKEN not set in environment or .env file!
  pause
  exit /b 1
)

"D:\Aeirmist\cloudflared.exe" tunnel run --token %TUNNEL_TOKEN%
