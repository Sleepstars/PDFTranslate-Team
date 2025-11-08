# Production Deployment Guide

**Project:** PDFTranslate Team Multi-User System  
**Version:** 1.0.0  
**Date:** 2025-11-08

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Docker Deployment](#docker-deployment)
5. [Manual Deployment](#manual-deployment)
6. [Security Configuration](#security-configuration)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 20 GB SSD
- OS: Linux (Ubuntu 22.04 LTS recommended)

**Recommended:**
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 50+ GB SSD
- OS: Linux (Ubuntu 22.04 LTS)

### Software Requirements

- Docker 24.0+ and Docker Compose 2.0+
- PostgreSQL 16+ (if not using Docker)
- Redis 7+ (if not using Docker)
- Node.js 18+ (for manual deployment)
- Python 3.11+ (for manual deployment)

### Network Requirements

- Ports: 80 (HTTP), 443 (HTTPS), 8000 (Backend API), 3000 (Frontend)
- Outbound internet access for translation APIs
- Domain name (recommended for production)
- SSL/TLS certificate (Let's Encrypt recommended)

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/PDFTranslate-Team.git
cd PDFTranslate-Team
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `.env` file with production values:

```bash
# Database Configuration
PDF_APP_DATABASE_URL=postgresql+asyncpg://pdftranslate:STRONG_PASSWORD@postgres:5432/pdftranslate

# Redis Configuration
PDF_APP_REDIS_URL=redis://redis:6379/0

# Session Security (MUST CHANGE)
PDF_APP_SESSION_SECRET=GENERATE_RANDOM_SECRET_HERE

# Server Configuration
PDF_APP_PORT=8000
PDF_APP_HOST=0.0.0.0

# S3 Storage Configuration
PDF_APP_S3_ENDPOINT=https://s3.your-domain.com
PDF_APP_S3_ACCESS_KEY=YOUR_ACCESS_KEY
PDF_APP_S3_SECRET_KEY=YOUR_SECRET_KEY
PDF_APP_S3_BUCKET=pdftranslate
PDF_APP_S3_REGION=us-east-1

# Frontend Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com

# CORS Configuration (if frontend on different domain)
PDF_APP_CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Logging
PDF_APP_LOG_LEVEL=INFO
```

### 4. Generate Secure Secrets

```bash
# Generate session secret
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate database password
python3 -c "import secrets; print(secrets.token_urlsafe(16))"
```

---

## Database Setup

### Option 1: Using Docker (Recommended)

Database will be automatically created by Docker Compose.

### Option 2: External PostgreSQL

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE pdftranslate;
CREATE USER pdftranslate WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE pdftranslate TO pdftranslate;

# Exit psql
\q
```

Update `.env` with external database URL:
```bash
PDF_APP_DATABASE_URL=postgresql+asyncpg://pdftranslate:STRONG_PASSWORD@your-db-host:5432/pdftranslate
```

---

## Docker Deployment

### 1. Build and Start Services

```bash
# Build images
docker compose build

# Start services in detached mode
docker compose up -d

# Check service status
docker compose ps
```

### 2. Run Database Migrations

```bash
docker compose exec backend pixi run alembic upgrade head
```

### 3. Initialize Default Data

```bash
docker compose exec backend pixi run python scripts/init_db.py
```

This creates:
- Default admin user: `admin@example.com` / `admin123`
- Default Google Translate provider

**⚠️ IMPORTANT: Change the default admin password immediately!**

### 4. Verify Deployment

```bash
# Check backend health
curl http://localhost:8000/health

# Check frontend
curl http://localhost:3000

# View logs
docker compose logs -f
```

### 5. Configure Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/pdftranslate`:

```nginx
# Backend API
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/pdftranslate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d your-domain.com -d www.your-domain.com -d api.your-domain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

---

## Manual Deployment

### 1. Install Dependencies

```bash
# Install Pixi
curl -fsSL https://pixi.sh/install.sh | bash

# Install project dependencies
pixi install
pixi run install-frontend
```

### 2. Build Frontend

```bash
cd Front
npm run build
cd ..
```

### 3. Run Database Migrations

```bash
pixi run alembic upgrade head
pixi run python scripts/init_db.py
```

### 4. Start Services

```bash
# Start backend (use process manager like systemd or supervisor)
pixi run uvicorn app.main:app --host 0.0.0.0 --port 8000

# Start frontend
cd Front && npm start
```

### 5. Setup Systemd Services

Create `/etc/systemd/system/pdftranslate-backend.service`:

```ini
[Unit]
Description=PDFTranslate Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=pdftranslate
WorkingDirectory=/opt/pdftranslate
Environment="PATH=/home/pdftranslate/.pixi/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/pdftranslate/.pixi/bin/pixi run uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/pdftranslate-frontend.service`:

```ini
[Unit]
Description=PDFTranslate Frontend
After=network.target

[Service]
Type=simple
User=pdftranslate
WorkingDirectory=/opt/pdftranslate/Front
Environment="PATH=/home/pdftranslate/.pixi/bin:/usr/local/bin:/usr/bin:/bin"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pdftranslate-backend pdftranslate-frontend
sudo systemctl start pdftranslate-backend pdftranslate-frontend
sudo systemctl status pdftranslate-backend pdftranslate-frontend
```

---

## Security Configuration

### 1. Change Default Credentials

```bash
# Login as admin
# Navigate to user management
# Change admin password
```

### 2. Configure HTTPS

- Use Let's Encrypt for SSL certificates
- Enforce HTTPS redirects in Nginx
- Set `Secure` flag on cookies (automatic in production)

### 3. Configure CORS

Update `.env`:
```bash
PDF_APP_CORS_ORIGINS=https://your-domain.com
```

### 4. Setup Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to backend/database ports from outside
sudo ufw deny 8000/tcp
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp

# Enable firewall
sudo ufw enable
```

### 5. Database Security

```bash
# Restrict PostgreSQL to localhost
# Edit /etc/postgresql/16/main/postgresql.conf
listen_addresses = 'localhost'

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 6. Implement Rate Limiting

Add to Nginx configuration:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        # ... rest of config
    }
}
```

---

## Monitoring & Maintenance

### 1. Health Checks

```bash
# Backend health
curl https://api.your-domain.com/health

# Database connection
docker compose exec backend pixi run python scripts/test_migration.py

# Redis connection
docker compose exec redis redis-cli ping
```

### 2. Log Management

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Rotate logs (configure in docker-compose.yml)
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 3. Performance Monitoring

- Monitor CPU, RAM, disk usage
- Monitor database query performance
- Monitor Redis memory usage
- Monitor API response times

### 4. Quota Reset Verification

Quota resets automatically at UTC midnight. Verify:
```bash
# Check quota reset logs
docker compose logs backend | grep "quota reset"

# Manually check user quotas
docker compose exec backend pixi run python -c "
from app.database import AsyncSessionLocal
from app.models import User
import asyncio

async def check_quotas():
    async with AsyncSessionLocal() as db:
        result = await db.execute('SELECT email, daily_page_used, daily_page_limit FROM users')
        for row in result:
            print(f'{row.email}: {row.daily_page_used}/{row.daily_page_limit}')

asyncio.run(check_quotas())
"
```

---

## Backup & Recovery

### 1. Database Backup

```bash
# Automated daily backup
docker compose exec postgres pg_dump -U pdftranslate pdftranslate > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T postgres psql -U pdftranslate pdftranslate < backup_20251108.sql
```

### 2. S3 Storage Backup

Configure S3 bucket versioning and lifecycle policies.

### 3. Configuration Backup

```bash
# Backup environment and configs
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env docker-compose.yml
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs backend
docker compose logs frontend

# Check port conflicts
sudo netstat -tulpn | grep :8000
sudo netstat -tulpn | grep :3000

# Restart services
docker compose restart
```

### Database Connection Errors

```bash
# Check PostgreSQL status
docker compose ps postgres

# Check connection string
docker compose exec backend env | grep DATABASE_URL

# Test connection
docker compose exec backend pixi run python -c "
from app.database import engine
import asyncio
asyncio.run(engine.connect())
"
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart services
docker compose restart

# Increase memory limits in docker-compose.yml
```

---

## Post-Deployment Checklist

- [ ] Change default admin password
- [ ] Configure SSL/TLS certificates
- [ ] Setup firewall rules
- [ ] Configure automated backups
- [ ] Setup monitoring and alerts
- [ ] Test all critical user flows
- [ ] Document custom configurations
- [ ] Setup log rotation
- [ ] Configure rate limiting
- [ ] Review security audit checklist

---

**Deployment Guide Version:** 1.0  
**Last Updated:** 2025-11-08

