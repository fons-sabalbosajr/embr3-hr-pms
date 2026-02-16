# Production Deployment Guide

## Prerequisites (VPS)

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt install -y nodejs` |
| PM2 | latest | `sudo npm i -g pm2` |
| Nginx | latest | `sudo apt install -y nginx` |
| Git | latest | `sudo apt install -y git` |
| Certbot | latest | `sudo apt install -y certbot python3-certbot-nginx` |

## First-time Setup

### 1. Clone the repo

```bash
sudo mkdir -p /var/www/embr3-hr-pms
sudo chown $USER:$USER /var/www/embr3-hr-pms
git clone <your-repo-url> /var/www/embr3-hr-pms
cd /var/www/embr3-hr-pms
git checkout main
```

### 2. Configure the server

```bash
cd /var/www/embr3-hr-pms/server
cp .env.example .env
nano .env   # fill in MONGO_URI, JWT_SECRET, email creds, etc.
```

Key env vars to set:
- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — random 64-char hex string (`openssl rand -hex 32`)
- `CLIENT_ORIGIN` — `https://embr3-onlinesystems.cloud`
- `EMAIL_USER` / `EMAIL_PASS` — Gmail app password
- `MESSAGE_ENCRYPTION_KEY` — `openssl rand -hex 32`

### 3. Configure the front-end

```bash
cd /var/www/embr3-hr-pms/front-end
nano .env.production
# Set VITE_ENCRYPT_SECRET and VITE_KEY_SALT to random secrets
```

### 4. Build & start

```bash
# Server
cd /var/www/embr3-hr-pms/server
npm ci --omit=dev

# Front-end
cd /var/www/embr3-hr-pms/front-end
npm ci && npm run build

# Start API with PM2
cd /var/www/embr3-hr-pms
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable boot persistence
```

### 5. Set up Nginx

```bash
sudo cp /var/www/embr3-hr-pms/nginx.conf /etc/nginx/sites-available/embr3-hr-pms
sudo ln -sf /etc/nginx/sites-available/embr3-hr-pms /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Enable HTTPS (SSL)

```bash
sudo certbot --nginx -d embr3-onlinesystems.cloud -d www.embr3-onlinesystems.cloud
# Certbot auto-renews via systemd timer
```

After Certbot succeeds, update `CLIENT_ORIGIN` in `.env` to use `https://`.

### 7. Create uploads directory

```bash
mkdir -p /var/www/embr3-hr-pms/server/uploads
```

## Subsequent Deploys

```bash
cd /var/www/embr3-hr-pms
bash deploy.sh
```

Or manually:
```bash
git pull origin main
cd server && npm ci --omit=dev
cd ../front-end && npm ci && npm run build
cd .. && pm2 restart ecosystem.config.cjs
```

## Monitoring

```bash
pm2 status          # process status
pm2 logs embr3-hr-api   # live logs
pm2 monit           # resource monitor
```

## Health Check

```bash
curl -sf http://127.0.0.1:5000/healthz | jq
curl -sf https://embr3-onlinesystems.cloud/api/dev/health | jq
```
