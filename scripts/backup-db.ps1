# ==============================================================================
# Aeirmist PostgreSQL Automated Backup Script (Windows PowerShell)
# ==============================================================================
param(
  [string]$BackupDir = "backups"
)

$ErrorActionPreference = "Stop"

# Load .env variables
$EnvPath = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $EnvPath) {
  Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)$") {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
  }
}

$DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "aeirmist" }
$DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "aeirmist" }
$DbPass = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "aeirmist_secure_2026" }

$TargetDir = Join-Path $PSScriptRoot "..\" $BackupDir
if (!(Test-Path $TargetDir)) {
  New-Item -ItemType Directory -Path $TargetDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $TargetDir "aeirmist_$Timestamp.sql"

Write-Host "📦 Starting Aeirmist PostgreSQL backup..." -ForegroundColor Cyan

$env:PGPASSWORD = $DbPass

# Run pg_dump either natively or inside docker container
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
  pg_dump -h 127.0.0.1 -p 5432 -U $DbUser $DbName > $BackupFile
} else {
  # Docker container execution fallback
  docker exec -t aeirmist-postgres pg_dump -U $DbUser $DbName > $BackupFile
}

Write-Host "✅ Backup completed at: $BackupFile" -ForegroundColor Green
