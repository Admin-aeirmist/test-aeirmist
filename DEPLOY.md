# Aeirmist Production Deployment Guide (DEPLOY.md)

This document is the operational checklist for moving Aeirmist from local development to a production VPS (Ubuntu 24.04 LTS).

---

## 1. Prerequisites on the Server
- Fresh Ubuntu 24.04 LTS VPS (1-2 vCPU, 2-4GB RAM minimum).
- Domain DNS pointing to your VPS IP:
  - `api.aeirmist.com` -> `<VPS_IP>` (Points to Backend API & WebSockets)
  - `aeirmist.com` -> Cloudflare Pages (Frontend Web)

---

## 2. Server Initial Setup (Run Once)

```bash
# Update system & install essentials
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban ca-certificates

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Caddy (Automated HTTPS Reverse Proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Configure Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Clone & Configure Application

```bash
# Clone repository
git clone https://github.com/<your-repo>/aeirmist.git /var/www/aeirmist
cd /var/www/aeirmist

# Switch to production branch
git checkout migration-pg-redis

# Create production .env
cp .env.example .env
nano .env
```

Ensure production `.env` has:
```env
NODE_ENV=production
PORT=4000
API_BASE_URL=https://api.aeirmist.com
POSTGRES_USER=aeirmist_prod
POSTGRES_PASSWORD=<STRONG_RANDOM_PASSWORD>
POSTGRES_DB=aeirmist_prod
DATABASE_URL=postgres://aeirmist_prod:<STRONG_RANDOM_PASSWORD>@127.0.0.1:5432/aeirmist_prod
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=<STRONG_RANDOM_64_CHAR_SECRET>
CORS_ORIGINS=https://aeirmist.com,capacitor://localhost
STORAGE_DRIVER=local
STORAGE_PATH=/var/www/aeirmist/storage/uploads
PUBLIC_MEDIA_URL=https://api.aeirmist.com/media
```

---

## 4. Start Infrastructure & Run Migrations

```bash
# 1. Start PostgreSQL 16 & Redis 7
docker compose up -d

# 2. Install backend dependencies and run migrations
cd backend
npm ci --production=false
npm run db:migrate
npm run build
```

---

## 5. Process Manager (PM2 / Systemd)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start Aeirmist Universal API
pm2 start dist/index.js --name "aeirmist-api" -i max
pm2 save
pm2 startup
```

---

## 6. Caddy Reverse Proxy Configuration (`/etc/caddy/Caddyfile`)

Edit `/etc/caddy/Caddyfile`:
```caddy
api.aeirmist.com {
    # Automatic SSL certificate via Let's Encrypt / ZeroSSL

    # Static media folder with high performance caching
    handle_path /media/* {
        root * /var/www/aeirmist/storage/uploads
        file_server
        header Cache-Control "public, max-age=31536000, immutable"
    }

    # API and WebSockets reverse proxy
    handle {
        reverse_proxy 127.0.0.1:4000 {
            # WebSockets support enabled by default in Caddy
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

---

## 7. Automated Daily Database Backups

Add a cron job to automatically dump and prune databases:
```bash
crontab -e
```
Add:
```cron
# Run daily database backup at 3:00 AM UTC
0 3 * * * /var/www/aeirmist/scripts/backup-db.sh >> /var/log/aeirmist-backup.log 2>&1
```

---

## 8. Verification Checklist
- [ ] `curl -s https://api.aeirmist.com/health` returns `{"status":"healthy"}`
- [ ] Database reports `"database":"up"` and `"redis":"up"`
- [ ] Media upload test returns accessible CDN URL
- [ ] Socket.IO client successfully establishes connection
