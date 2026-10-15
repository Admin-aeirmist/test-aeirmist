# Aeirmist PostgreSQL Automated Backup Script
param(
    [string]$BackupDir = "D:\Aeirmist\backups\db",
    [int]$RetentionCount = 14
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "aeirmist_$Timestamp.dump"
$PgDumpPath = "D:\Aeirmist\pgsql\pgsql\bin\pg_dump.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Aeirmist Database Backup Initiated" -ForegroundColor Cyan
Write-Host "  Timestamp: $Timestamp" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

$env:PGPASSWORD = "aeirmist"

try {
    & $PgDumpPath -h 127.0.0.1 -p 5432 -U aeirmist -F c -b -f $BackupFile aeirmist
    if ($LASTEXITCODE -eq 0 -and (Test-Path $BackupFile)) {
        $fileSize = (Get-Item $BackupFile).Length
        $sizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Host "SUCCESS: Backup completed successfully!" -ForegroundColor Green
        Write-Host "File: $BackupFile ($sizeMB MB)" -ForegroundColor Green

        # Retention management - keep last $RetentionCount backups
        $allBackups = Get-ChildItem -Path $BackupDir -Filter "aeirmist_*.dump" | Sort-Object CreationTime -Descending
        if ($allBackups.Count -gt $RetentionCount) {
            $toDelete = $allBackups | Select-Object -Skip $RetentionCount
            foreach ($item in $toDelete) {
                Write-Host "Pruning old backup: $($item.Name)" -ForegroundColor Yellow
                Remove-Item $item.FullName -Force
            }
        }
    } else {
        Write-Error "Backup command failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Error "Backup failed: $_"
}
