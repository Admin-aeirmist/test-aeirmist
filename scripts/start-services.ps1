# Aeirmist Full-Stack Master Service Launcher
param(
    [switch]$NoTunnel = $false
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "      Starting Aeirmist Full-Stack        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. PostgreSQL (Port 5432)
$pgPortOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue)
if (-not $pgPortOpen) {
    Write-Host "[1/4] Starting PostgreSQL..." -ForegroundColor Yellow
    $pgExe = "D:\Aeirmist\pgsql\pgsql\bin\postgres.exe"
    $pgData = "D:\Aeirmist\pgsql-data"
    $pidFile = "$pgData\postmaster.pid"
    if (Test-Path $pidFile) {
        try {
            $pidVal = (Get-Content $pidFile -TotalCount 1).Trim()
            $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
            if (-not $proc) {
                Write-Host "Removing stale postmaster.pid (PID $pidVal not running)..." -ForegroundColor Yellow
                Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Process -FilePath $pgExe -ArgumentList "-D `"$pgData`"" -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/4] PostgreSQL is already running (Port 5432)." -ForegroundColor Green
}

# 2. Redis (Port 6379)
$redisPortOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue)
if (-not $redisPortOpen) {
    Write-Host "[2/4] Starting Redis Server..." -ForegroundColor Yellow
    $redisExe = "C:\Users\Junaed Islam Jim\AppData\Local\Microsoft\WinGet\Packages\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\Redis-8.10.1-Windows-x64-msys2\redis-server.exe"
    if (Test-Path $redisExe) {
        Start-Process -FilePath $redisExe -WindowStyle Hidden
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Redis executable not found at expected path." -ForegroundColor Red
    }
} else {
    Write-Host "[2/4] Redis is already running (Port 6379)." -ForegroundColor Green
}

# 3. Cloudflare Tunnel
if (-not $NoTunnel) {
    $cloudflaredRunning = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $cloudflaredRunning) {
        Write-Host "[3/4] Starting Cloudflare Tunnel (aeirmist.com)..." -ForegroundColor Yellow
        $tunnelToken = "eyJhIjoiYmQ3MTI0NmViMDkwMTVmZTczN2U0YjZlYmU2OTRjZTciLCJ0IjoiNjAwNTZmNjktNjkwYy00ZDUzLWE5YWEtNGE5NWEwMjE0ODYyIiwicyI6Ii9PRjdqUTByZGd6NUNkQVhMRVRpUDBZZ2wzV2lJQzZNd0NRdVdJZmVqeTA9In0="
        Start-Process -FilePath "D:\Aeirmist\cloudflared.exe" -ArgumentList "tunnel run --token `"$tunnelToken`"" -WindowStyle Hidden
        Start-Sleep -Seconds 2
    } else {
        Write-Host "[3/4] Cloudflare Tunnel is already running." -ForegroundColor Green
    }
}

# 4. Backend API (Port 4000)
$apiPortOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 4000 -InformationLevel Quiet -WarningAction SilentlyContinue)
if (-not $apiPortOpen) {
    Write-Host "[4/4] Starting Backend Node API (Port 4000)..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\Aeirmist\backend && npm start" -WindowStyle Hidden
    Start-Sleep -Seconds 5
} else {
    Write-Host "[4/4] Backend API is already running (Port 4000)." -ForegroundColor Green
}

# Verify Health
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Verifying System Health..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -TimeoutSec 5
    Write-Host "API Status: $($health.status)" -ForegroundColor Green
    Write-Host "Services: DB: $($health.services.database) | Redis: $($health.services.redis) | Storage: $($health.services.storageDriver)" -ForegroundColor Green
} catch {
    Write-Host "API health check failed: $_" -ForegroundColor Yellow
}
Write-Host "Aeirmist is READY!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
