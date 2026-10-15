# Aeirmist High-Availability Background Watchdog
$ErrorActionPreference = "SilentlyContinue"

while ($true) {
    Start-Sleep -Seconds 15
    $pgOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue)
    $redisOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue)
    $tunnelRunning = (Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue)
    $apiOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 4000 -InformationLevel Quiet -WarningAction SilentlyContinue)

    if (-not $pgOpen -or -not $redisOpen -or -not $tunnelRunning -or -not $apiOpen) {
        powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "D:\Aeirmist\scripts\start-services.ps1"
        Start-Sleep -Seconds 10
    }
}
