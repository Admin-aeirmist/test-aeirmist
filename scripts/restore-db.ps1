# Aeirmist PostgreSQL Restore Script
param(
    [string]$BackupFile = "",
    [string]$TargetDb = ""
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Read credentials securely from .env - never hardcode passwords in scripts
# ---------------------------------------------------------------------------
$EnvFile = "D:\Aeirmist\.env"
if (-not (Test-Path $EnvFile)) {
    Write-Error "BLOCKED: .env not found at $EnvFile"
    exit 1
}

$pgPassword = $null
$pgUser     = "aeirmist"
$defaultDb  = "aeirmist"
$pgHost     = "127.0.0.1"
$pgPort     = "5432"

foreach ($line in (Get-Content $EnvFile)) {
    if ($line -match '^\s*POSTGRES_PASSWORD=(.+)$') { $pgPassword = $Matches[1].Trim() }
    if ($line -match '^\s*POSTGRES_USER=(.+)$')     { $pgUser     = $Matches[1].Trim() }
    if ($line -match '^\s*POSTGRES_DB=(.+)$')       { $defaultDb  = $Matches[1].Trim() }
}

if (-not $pgPassword) {
    Write-Error "BLOCKED: POSTGRES_PASSWORD not found in .env"
    exit 1
}

if (-not $TargetDb) {
    $TargetDb = $defaultDb
}

$PgRestorePath = "D:\Aeirmist\pgsql\pgsql\bin\pg_restore.exe"
$BackupDir = "D:\Aeirmist\backups\db"

if (-not (Test-Path $PgRestorePath)) {
    Write-Error "BLOCKED: pg_restore not found at $PgRestorePath"
    exit 1
}

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
Write-Host "  Target Database: $TargetDb" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Yellow

# Set password via environment variable (not exposed in command-line arguments)
$env:PGPASSWORD = $pgPassword

try {
    # Restore using explicit connection parameters
    & $PgRestorePath -h $pgHost -p $pgPort -U $pgUser -d $TargetDb --clean --if-exists --no-owner -v $BackupFile
    $restoreExit = $LASTEXITCODE
    
    # pg_restore returns 0 on complete success, 1 on non-fatal warnings (e.g. notices/clean warnings on empty objects)
    if ($restoreExit -eq 0 -or $restoreExit -eq 1) {
        Write-Host "SUCCESS: Restore operation completed (exit code $restoreExit)." -ForegroundColor Green
    } else {
        Write-Error "Restore operation failed with exit code $restoreExit"
        exit $restoreExit
    }
} catch {
    Write-Error "Restore failed: $_"
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
