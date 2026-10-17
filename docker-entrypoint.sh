#!/bin/sh
set -e

echo "=========================================="
echo "   🚀 Starting Aeirmist Cloud Platform    "
echo "=========================================="

# Extract DB host and port from DATABASE_URL
DB_HOST="postgres"
DB_PORT="5432"

if [ -n "$DATABASE_URL" ]; then
  # Strip protocol and credentials
  NO_PROTO=$(echo "$DATABASE_URL" | sed -e 's|^[a-zA-Z]*://||')
  HOST_PORT_DB=$(echo "$NO_PROTO" | sed -e 's|.*@||' -e 's|/.*||')
  
  if echo "$HOST_PORT_DB" | grep -q ":"; then
    DB_HOST=$(echo "$HOST_PORT_DB" | cut -d: -f1)
    DB_PORT=$(echo "$HOST_PORT_DB" | cut -d: -f2)
  else
    DB_HOST="$HOST_PORT_DB"
  fi
fi

echo "⏳ Checking PostgreSQL connection at ${DB_HOST}:${DB_PORT}..."
MAX_RETRIES=30
RETRY_COUNT=0

until nc -z -v -w5 "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ [Error] Could not connect to PostgreSQL after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "⏳ Waiting for PostgreSQL ($RETRY_COUNT/$MAX_RETRIES)..."
  sleep 2
done
echo "✅ PostgreSQL is reachable!"

# Ensure upload directory exists
mkdir -p /app/backend/storage/uploads
mkdir -p /app/storage/uploads

# Apply Database Schema migrations / push
echo "🔄 Synchronizing PostgreSQL database schema..."
cd /app/backend
npx drizzle-kit push || echo "⚠️ Warning: Drizzle push completed with exit code $? (continuing startup)..."

echo "🌐 Serving Aeirmist Client SPA and Universal API on port ${PORT:-4000}..."
exec node dist/index.js
