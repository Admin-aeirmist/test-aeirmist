#!/usr/bin/env bash
# ==============================================================================
# Aeirmist PostgreSQL Automated Backup Script (Linux / VPS)
# ==============================================================================
set -euo pipefail

# 1. Load environment variables from .env
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

DB_USER="${POSTGRES_USER:-aeirmist}"
DB_NAME="${POSTGRES_DB:-aeirmist}"
DB_HOST="127.0.0.1"
DB_PORT="5432"
BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/aeirmist_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Starting Aeirmist PostgreSQL backup..."
PGPASSWORD="${POSTGRES_PASSWORD:-aeirmist_secure_2026}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "✅ Backup successfully created at: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"

# 2. Prune backups older than 14 days
echo "🧹 Pruning backups older than 14 days..."
find "$BACKUP_DIR" -type f -name "aeirmist_*.sql.gz" -mtime +14 -exec rm -f {} \;
echo "✨ Backup job finished cleanly!"
