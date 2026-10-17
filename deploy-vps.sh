#!/bin/bash
# ==============================================================================
# Aeirmist 1-Click 24/7 VPS Cloud Deployment Script
# Supports: Ubuntu, Debian, CentOS, AlmaLinux, Rocky Linux
# ==============================================================================

set -e

echo ""
echo "========================================================"
echo "    🌌 Aeirmist 24/7 Cloud Automated VPS Deployment    "
echo "========================================================"
echo ""

# 1. Install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not detected. Installing Docker via official script..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
    systemctl enable --now docker
    echo "✅ Docker installed successfully!"
else
    echo "✅ Docker is already installed."
fi

# 2. Check docker compose plugin
if ! docker compose version &> /dev/null; then
    echo "📦 Installing docker compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin || yum install -y docker-compose-plugin
fi

# 3. Environment configuration
if [ ! -f .env ]; then
    echo "⚙️ Creating .env configuration from .env.docker.example..."
    cp .env.docker.example .env
    echo "ℹ️ Please update .env with your specific secrets if needed."
fi

# 4. Pull & Build Docker Containers
echo "🔨 Building and launching Aeirmist platform services..."
docker compose build --pull
docker compose up -d

# 5. Verify Health
echo "⏳ Verifying services health..."
sleep 5

for i in {1..12}; do
    STATUS=$(docker inspect --format='{{json .State.Health.Status}}' aeirmist-app 2>/dev/null || echo "starting")
    if [[ "$STATUS" == "\"healthy\"" ]]; then
        echo ""
        echo "========================================================"
        echo " 🎉 Aeirmist is LIVE and RUNNING 24/7 in Docker!       "
        echo "========================================================"
        echo "📡 Local Health:   http://localhost:4000/health"
        echo "🌐 Public Domain:  https://aeirmist.com"
        echo ""
        echo "Useful Commands:"
        echo "  - View live logs:     docker compose logs -f app"
        echo "  - Restart services:   docker compose restart"
        echo "  - Stop platform:      docker compose down"
        echo "========================================================"
        exit 0
    fi
    echo "Waiting for app container health check ($i/12)..."
    sleep 3
done

echo "⚠️ App is starting up. Check logs using: docker compose logs -f app"
