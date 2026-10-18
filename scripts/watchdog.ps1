# Aeirmist High-Availability Background Watchdog & Network Self-Healer
$ErrorActionPreference = "SilentlyContinue"

$wifiProfile = "Anabia 5G"
$failCount = 0

while ($true) {
    Start-Sleep -Seconds 15

    # 1. Local Stack Health Check (Postgres, Redis, Backend API, Cloudflare Tunnel)
    $pgOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue)
    $redisOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue)
    $tunnelRunning = (Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue)
    $apiOpen = (Test-NetConnection -ComputerName 127.0.0.1 -Port 4000 -InformationLevel Quiet -WarningAction SilentlyContinue)

    if (-not $pgOpen -or -not $redisOpen -or -not $tunnelRunning -or -not $apiOpen) {
        powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "D:\Aeirmist\scripts\start-services.ps1"
        Start-Sleep -Seconds 10
    }

    # 2. Internet Connection & Wi-Fi Self-Healing (Every ~45 seconds)
    $netOnline = (Test-NetConnection -ComputerName 1.1.1.1 -Port 53 -InformationLevel Quiet -WarningAction SilentlyContinue)
    if (-not $netOnline) {
        $netOnline = (Test-NetConnection -ComputerName 8.8.8.8 -Port 53 -InformationLevel Quiet -WarningAction SilentlyContinue)
    }

    if (-not $netOnline) {
        $failCount++
        
        # If internet dropped, attempt to reconnect Wi-Fi
        netsh wlan connect name="$wifiProfile" | Out-Null
        Start-Sleep -Seconds 5

        # If dropped for more than 2 checks, reset the Wi-Fi adapter to clear router cache / DNS freeze
        if ($failCount -ge 2) {
            netsh interface set interface "Wi-Fi" disable | Out-Null
            Start-Sleep -Seconds 2
            netsh interface set interface "Wi-Fi" enable | Out-Null
            Start-Sleep -Seconds 5
            netsh wlan connect name="$wifiProfile" | Out-Null
            $failCount = 0
            
            # Restart cloudflared to force tunnel reconnection over refreshed route
            Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "D:\Aeirmist\scripts\start-services.ps1"
        }
    } else {
        $failCount = 0
    }
}
