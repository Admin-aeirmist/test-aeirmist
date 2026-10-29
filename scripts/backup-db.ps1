# Aeirmist PostgreSQL Automated Backup Script
param(
    [string]$BackupDir = "D:\Aeirmist\backups\db",
    [int]$RetentionCount = 14
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Read credentials securely from .env - never hardcode passwords in scripts
# ---------------------------------------------------------------------------
$EnvFile = "D:\Aeirmist\.env"
if (-not (Test-Path $EnvFile)) {
    Write-Error "BLOCKED: .env not found at $EnvFile - cannot proceed without credentials."
    exit 1
}

$pgPassword = $null
$pgUser     = "aeirmist"
$pgDb       = "aeirmist"
$pgHost     = "127.0.0.1"
$pgPort     = "5432"

foreach ($line in (Get-Content $EnvFile)) {
    if ($line -match '^\s*POSTGRES_PASSWORD=(.+)$') { $pgPassword = $Matches[1].Trim() }
    if ($line -match '^\s*POSTGRES_USER=(.+)$')     { $pgUser     = $Matches[1].Trim() }
    if ($line -match '^\s*POSTGRES_DB=(.+)$')       { $pgDb       = $Matches[1].Trim() }
}

if (-not $pgPassword) {
    Write-Error "BLOCKED: POSTGRES_PASSWORD not found in .env - cannot run backup."
    exit 1
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "aeirmist_$Timestamp.dump"
$PgDumpPath = "D:\Aeirmist\pgsql\pgsql\bin\pg_dump.exe"
$PgRestorePath = "D:\Aeirmist\pgsql\pgsql\bin\pg_restore.exe"

if (-not (Test-Path $PgDumpPath)) {
    Write-Error "BLOCKED: pg_dump not found at $PgDumpPath"
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Aeirmist Database Backup Initiated" -ForegroundColor Cyan
Write-Host "  Timestamp: $Timestamp" -ForegroundColor Gray
Write-Host "  Destination: $BackupFile" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

# Set password via environment variable (not exposed in command-line arguments)
$env:PGPASSWORD = $pgPassword

try {
    # Custom compressed format (-Fc)
    & $PgDumpPath -h $pgHost -p $pgPort -U $pgUser -d $pgDb -Fc -f $BackupFile
    $dumpExitCode = $LASTEXITCODE

    if ($dumpExitCode -ne 0) {
        Write-Error "Backup command failed with exit code $dumpExitCode"
        exit $dumpExitCode
    }

    if (-not (Test-Path $BackupFile)) {
        Write-Error "Backup failed: Output file was not created: $BackupFile"
        exit 1
    }

    $fileItem = Get-Item $BackupFile
    if ($fileItem.Length -eq 0) {
        Write-Error "Backup failed: Output file is 0 bytes: $BackupFile"
        exit 1
    }

    # Verify archive integrity via pg_restore -l
    if (Test-Path $PgRestorePath) {
        Write-Host "Verifying archive integrity with pg_restore -l..." -ForegroundColor Gray
        $tocCount = (& $PgRestorePath -l $BackupFile | Measure-Object).Count
        if ($LASTEXITCODE -ne 0 -or $tocCount -lt 10) {
            Write-Error "Archive integrity check failed (Exit code: $LASTEXITCODE, TOC: $tocCount entries)"
            exit 1
        }
        Write-Host "Archive integrity: VERIFIED ($tocCount TOC entries readable)" -ForegroundColor Green
    }

    $sizeKB = [math]::Round($fileItem.Length / 1KB, 2)
    Write-Host "SUCCESS: Backup completed and verified successfully!" -ForegroundColor Green
    Write-Host "File: $BackupFile ($sizeKB KB)" -ForegroundColor Green

    # Retention management - keep last $RetentionCount backups
    $allBackups = Get-ChildItem -Path $BackupDir -Filter "aeirmist_*.dump" | Sort-Object CreationTime -Descending
    if ($allBackups.Count -gt $RetentionCount) {
        $toDelete = $allBackups | Select-Object -Skip $RetentionCount
        foreach ($item in $toDelete) {
            Write-Host "Pruning old backup: $($item.Name)" -ForegroundColor Yellow
            Remove-Item $item.FullName -Force
        }
    }
} catch {
    Write-Error "Backup process encountered an error: $_"
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
