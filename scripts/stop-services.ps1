# Aeirmist Graceful Service Shutdown Script
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "      Stopping Aeirmist Full-Stack        " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow

# Stop Cloudflared
$cf = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cf) {
    Write-Host "Stopping Cloudflare Tunnel..." -ForegroundColor Yellow
    $cf | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Stop Node backend
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    Write-Host "Stopping Node backend processes..." -ForegroundColor Yellow
    $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Stop Redis
$redis = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
if ($redis) {
    Write-Host "Stopping Redis Server..." -ForegroundColor Yellow
    $redis | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Stop PostgreSQL
$pg = Get-Process -Name "postgres" -ErrorAction SilentlyContinue
if ($pg) {
    Write-Host "Stopping PostgreSQL..." -ForegroundColor Yellow
    $pg | Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Host "All Aeirmist services stopped successfully." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Yellow
