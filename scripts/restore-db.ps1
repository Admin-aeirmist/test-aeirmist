# Aeirmist PostgreSQL Restore Script
param(
    [string]$BackupFile = ""
)

$ErrorActionPreference = "Stop"
$PgRestorePath = "D:\Aeirmist\pgsql\pgsql\bin\pg_restore.exe"
$BackupDir = "D:\Aeirmist\backups\db"

if (-not $BackupFile) {
    # Pick latest backup by default
    $latest = Get-ChildItem -Path $BackupDir -Filter "aeirmist_*.dump" | Sort-Object CreationTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Error "No backup files found in $BackupDir"
        exit 1
    }
    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "Specified backup file does not exist: $BackupFile"
    exit 1
}

Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "  Aeirmist Database Restore" -ForegroundColor Yellow
Write-Host "  Target File: $BackupFile" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Yellow

$env:PGPASSWORD = "aeirmist"

try {
    # Restore using clean drop & re-create objects
    & $PgRestorePath -h 127.0.0.1 -p 5432 -U aeirmist -d aeirmist --clean --if-exists --no-owner -v $BackupFile
    Write-Host "Restore operation finished." -ForegroundColor Green
} catch {
    Write-Error "Restore failed: $_"
}
