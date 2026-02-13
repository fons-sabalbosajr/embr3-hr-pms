# Production Deployment — Hostinger KVM 2 VPS

> **Target**: Ubuntu 24.04 LTS on Hostinger KVM 2  
> **Domain**: `embr3-onlinesystems.cloud`  
> **Architecture**: Nginx reverse-proxy → Node.js API (PM2) + static front-end  

---

## Architecture Overview

```
embr3-onlinesystems.cloud (port 80/443)
    │
    ▼
  Nginx
    ├── /              → front-end static files  (/var/www/embr3-hr-pms/front-end/dist)
    ├── /api/*         → reverse proxy → Node.js  (127.0.0.1:5000)
    ├── /socket.io/*   → WebSocket proxy → Node.js (127.0.0.1:5000)
    └── /uploads/*     → reverse proxy → Node.js  (127.0.0.1:5000)
```

---

## Prerequisites

| Item | Details |
|------|---------|
| VPS | Hostinger KVM 2, Ubuntu 24.04 LTS |
| SSH | `ssh root@embr3-onlinesystems.cloud -p 22` |
| Domain | `embr3-onlinesystems.cloud` pointed to VPS IP (A record) |
| Database | MongoDB Atlas (or local MongoDB) |
| Node.js | v20 LTS (via nvm) |
| Process Manager | PM2 |
| Web Server | Nginx |

---

## Step 1 — Initial Server Setup

```bash
# SSH into VPS
ssh root@embr3-onlinesystems.cloud

# Update packages
apt update && apt upgrade -y

# Install essentials
apt install -y git curl wget build-essential nginx ufw
```

### Firewall (UFW)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'    # ports 80 + 443
ufw --force enable
ufw status
```

---

## Step 2 — Install Node.js via nvm

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Load nvm (or re-open terminal)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node 20 LTS
nvm install 20
nvm alias default 20
nvm use 20

# Verify
node -v   # v20.x.x
npm -v    # 10.x.x
```

---

## Step 3 — Install PM2

```bash
npm install -g pm2

# Enable PM2 to start on boot
pm2 startup systemd
# Copy and run the command it outputs
```

---

## Step 4 — Clone & Setup the App

```bash
# Create web root
mkdir -p /var/www
cd /var/www

# Clone the repository
git clone https://github.com/<your-org>/embr3-hr-pms.git
cd embr3-hr-pms

# Checkout production branch
git checkout main   # or UAT, or your target branch
```

### 4a — Server (API)

```bash
cd /var/www/embr3-hr-pms/server

# Install production dependencies
npm ci --omit=dev

# Create .env from template
cp .env.example .env
nano .env   # Fill in all values (see Environment Variables section below)
```

### 4b — Front-End

```bash
cd /var/www/embr3-hr-pms/front-end

# Install dependencies
npm ci

# Create .env
cp .env.example .env
nano .env   # Set VITE_API_URL, VITE_ENCRYPT_SECRET, etc.

# Build production static files
npm run build
```

### 4c — Create uploads directory

```bash
mkdir -p /var/www/embr3-hr-pms/server/uploads/avatars
chown -R root:root /var/www/embr3-hr-pms/server/uploads
```

---

## Step 5 — Configure Nginx

```bash
# Copy the included nginx config
cp /var/www/embr3-hr-pms/nginx/embr3-hr-pms.conf /etc/nginx/sites-available/embr3-hr-pms

# Enable the site
ln -sf /etc/nginx/sites-available/embr3-hr-pms /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Reload
systemctl reload nginx
```

---

## Step 6 — Start API with PM2

```bash
cd /var/www/embr3-hr-pms

# Start using ecosystem config
pm2 start ecosystem.config.cjs

# Verify it's running
pm2 status
pm2 logs embr3-hr-api --lines 30

# Save PM2 process list (survives reboot)
pm2 save
```

---

## Step 7 — Verify Deployment

```bash
# Check API health
curl -s http://localhost:5000/api/dev/health | head

# Check via Nginx
curl -s http://embr3-onlinesystems.cloud/api/dev/health | head

# Check front-end
curl -s http://embr3-onlinesystems.cloud/ | head -5
```

Open in browser: `http://embr3-onlinesystems.cloud`

---

## Step 8 — SSL with Let's Encrypt (Optional, Recommended)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain certificate (auto-configures Nginx)
certbot --nginx -d embr3-onlinesystems.cloud

# Auto-renewal is set up via systemd timer
certbot renew --dry-run
```

After SSL is active, update these values:

| File | Variable | New Value |
|------|----------|-----------|
| `server/.env` | `CLIENT_ORIGIN` | `https://embr3-onlinesystems.cloud` |
| `server/.env` | `SERVER_PUBLIC_URL` | `https://embr3-onlinesystems.cloud/api` |
| `front-end/.env` | `VITE_API_URL` | `https://embr3-onlinesystems.cloud/api` |

Then rebuild front-end and restart API:

```bash
cd /var/www/embr3-hr-pms/front-end && npm run build
pm2 restart embr3-hr-api
```

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `5000` (Nginx proxies to this) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Random 64-char hex for JWT signing |
| `CLIENT_ORIGIN` | Yes | Front-end URL (e.g., `http://embr3-onlinesystems.cloud`) |
| `STORAGE_PROVIDER` | Yes | `local` (VPS disk) or `drive` (Google Drive) |
| `AVATAR_UPLOAD_DIR` | If local | `/var/www/embr3-hr-pms/server/uploads` |
| `SERVER_PUBLIC_URL` | If local | `http://embr3-onlinesystems.cloud/api` |
| `EMAIL_HOST` | For email | `smtp.gmail.com` |
| `EMAIL_PORT` | For email | `465` |
| `EMAIL_SECURE` | For email | `true` |
| `EMAIL_USER` | For email | Gmail address |
| `EMAIL_PASS` | For email | Gmail app password |
| `DISABLE_EMAIL` | Optional | `false` to enable email |

### Front-End (`front-end/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | `http://embr3-onlinesystems.cloud/api` |
| `VITE_ENCRYPT_SECRET` | Yes | Random 32+ char string for secure storage |
| `VITE_BASE_PATH` | No | `/` (default) |

---

## Routine Operations

### Deploy updates

```bash
cd /var/www/embr3-hr-pms

# Pull latest code
git pull origin main

# Rebuild front-end (if front-end changed)
cd front-end && npm ci && npm run build && cd ..

# Update server deps (if server changed)
cd server && npm ci --omit=dev && cd ..

# Restart API
pm2 restart embr3-hr-api
```

### View logs

```bash
pm2 logs embr3-hr-api            # Live tail
pm2 logs embr3-hr-api --lines 50 # Last 50 lines
journalctl -u nginx --no-pager -n 50  # Nginx logs
```

### Restart / Stop

```bash
pm2 restart embr3-hr-api
pm2 stop embr3-hr-api
pm2 start embr3-hr-api
systemctl restart nginx
```

### Monitor resources

```bash
pm2 monit                      # PM2 resource monitor
htop                           # System resources
df -h                          # Disk usage
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `502 Bad Gateway` | API not running. Check `pm2 status` and `pm2 logs`. |
| `CORS error` in browser | Verify `CLIENT_ORIGIN` in `server/.env` matches the browser URL exactly. |
| Socket.IO not connecting | Check Nginx `location /socket.io/` block has WebSocket upgrade headers. |
| Avatars not loading | Verify `AVATAR_UPLOAD_DIR` exists and check `location /uploads/` in Nginx. |
| Front-end shows blank page | Check `npm run build` succeeded. Verify Nginx `root` path and `try_files`. |
| `EADDRINUSE :5000` | Another process on port 5000. Run `lsof -i :5000` and kill it. |
| Node not found after reboot | nvm not loaded. Add to `~/.bashrc`: `source ~/.nvm/nvm.sh`. |
| PM2 not starting on boot | Re-run `pm2 startup systemd` and `pm2 save`. |

---

## Security Checklist

- [ ] UFW enabled with only SSH + Nginx Full allowed
- [ ] SSH key authentication (disable password auth in `/etc/ssh/sshd_config`)
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] `.env` files not committed to git
- [ ] `NODE_ENV=production` set
- [ ] MongoDB Atlas IP whitelist includes VPS IP
- [ ] Regular `apt update && apt upgrade`
- [ ] PM2 log rotation: `pm2 install pm2-logrotate`

---

## File Structure on VPS

```
/var/www/embr3-hr-pms/
├── ecosystem.config.cjs          ← PM2 process config
├── nginx/
│   └── embr3-hr-pms.conf         ← Nginx site config (template)
├── server/
│   ├── .env                      ← Server secrets (not in git)
│   ├── .env.example              ← Template
│   ├── server.js                 ← Entry point
│   ├── uploads/                  ← Avatar + file storage
│   └── ...
├── front-end/
│   ├── .env                      ← Front-end env vars (not in git)
│   ├── .env.example              ← Template
│   ├── dist/                     ← Built static files (served by Nginx)
│   └── ...
└── landing/                      ← Landing page (optional separate deploy)
```

---

*Last updated: 2026-02-13*
