# VPS Update & Deployment Guide

> How to push updates from your local VS Code to the live VPS server.

---

## Server Quick Reference

| Item            | Value                                             |
| --------------- | ------------------------------------------------- |
| SSH             | `ssh root@72.61.125.232`                          |
| App Directory   | `/var/www/embr3-hr-pms`                           |
| Branch          | `UAT`                                             |
| PM2 Process     | `embr3-hr-api`                                    |
| Live URL        | `https://embr3-onlinesystems.cloud/hrpms`         |
| API URL         | `https://embr3-onlinesystems.cloud/api`           |

---

## Standard Update Workflow

### Step 1 — Commit & push from VS Code

```bash
git add .
git commit -m "describe your changes"
git push origin UAT
```

### Step 2 — SSH into the VPS

```bash
ssh root@72.61.125.232
```

### Step 3 — Pull & deploy

Choose the section below based on **what changed**.

---

## What Changed?

### A. Server code only (controllers, routes, models, middleware, utils)

```bash
cd /var/www/embr3-hr-pms
git pull origin UAT
cd server
npm ci                            # only needed if package.json changed
pm2 restart embr3-hr-api
pm2 logs embr3-hr-api --lines 10 --nostream
```

### B. Front-end code only (components, pages, styles, hooks)

```bash
cd /var/www/embr3-hr-pms
git pull origin UAT
cd front-end
npm ci                            # only needed if package.json changed
npm run build
```

> No PM2 restart needed — Nginx serves the static `dist/` folder directly.

### C. Both server and front-end

```bash
cd /var/www/embr3-hr-pms
git pull origin UAT

# Server
cd server && npm ci && cd ..

# Front-end
cd front-end && npm ci && npm run build && cd ..

# Restart API
pm2 restart embr3-hr-api
pm2 logs embr3-hr-api --lines 10 --nostream
```

### D. Server environment variable changes (.env)

```bash
cd /var/www/embr3-hr-pms/server
nano .env                         # edit the variable
pm2 restart embr3-hr-api
```

### E. Front-end environment variable changes (.env)

```bash
cd /var/www/embr3-hr-pms/front-end
nano .env                         # edit the variable
npm run build                     # MUST rebuild — Vite bakes env vars at build time
```

### F. Nginx configuration changes

```bash
nano /etc/nginx/sites-available/embr3-hr-pms
nginx -t                          # ALWAYS test first!
systemctl reload nginx
```

---

## One-Liner Full Deploy

After `git push origin UAT` from VS Code, SSH into the VPS and run:

```bash
cd /var/www/embr3-hr-pms && git pull origin UAT && cd server && npm ci && cd ../front-end && npm ci && npm run build && cd .. && pm2 restart embr3-hr-api && echo "✅ Deploy complete"
```

---

## Verify After Deploy

```bash
# Check PM2 is running
pm2 status

# Check API health
curl -sf http://localhost:5000/api/dev/health

# Check site loads via Nginx
curl -sI https://embr3-onlinesystems.cloud/hrpms/ | head -5

# Check recent logs for errors
pm2 logs embr3-hr-api --lines 20 --nostream
```

---

## Monitoring Commands

| Action                    | Command                                              |
| ------------------------- | ---------------------------------------------------- |
| PM2 process status        | `pm2 status`                                         |
| Live API logs             | `pm2 logs embr3-hr-api`                              |
| Last 50 log lines         | `pm2 logs embr3-hr-api --lines 50 --nostream`        |
| PM2 resource monitor      | `pm2 monit`                                          |
| Nginx status              | `systemctl status nginx`                             |
| Nginx error log           | `tail -50 /var/log/nginx/error.log`                  |
| Nginx access log          | `tail -50 /var/log/nginx/access.log`                 |
| Health-check log          | `cat /var/log/embr3-health.log`                      |
| Fail2Ban status           | `fail2ban-client status`                             |
| Fail2Ban SSH bans         | `fail2ban-client status sshd`                        |
| SSL certificate expiry    | `certbot certificates`                               |
| SSL dry-run renewal       | `certbot renew --dry-run`                            |
| Disk usage                | `df -h`                                              |
| System resources          | `htop`                                               |
| Check open ports          | `ufw status verbose`                                 |

---

## Rollback a Bad Deploy

```bash
cd /var/www/embr3-hr-pms

# See recent commits
git log --oneline -10

# Roll back to a specific commit
git checkout <commit-hash> -- .

# Rebuild front-end
cd front-end && npm run build && cd ..

# Restart server
pm2 restart embr3-hr-api

echo "✅ Rolled back to <commit-hash>"
```

---

## Troubleshooting

| Symptom                          | Fix                                                                |
| -------------------------------- | ------------------------------------------------------------------ |
| `502 Bad Gateway`                | API not running → `pm2 status` then `pm2 restart embr3-hr-api`    |
| CORS error in browser            | Check `CLIENT_ORIGIN` in `server/.env` matches browser URL origin  |
| Socket.IO not connecting         | Check Nginx `/socket.io/` block has WebSocket upgrade headers      |
| Avatars not loading              | Check `/var/www/embr3-hr-pms/server/uploads/` exists               |
| Front-end shows blank page       | `cd front-end && npm run build` — check for build errors           |
| `EADDRINUSE :5000`               | `lsof -i :5000` and kill the stale process                        |
| Node not found after reboot      | `source ~/.nvm/nvm.sh` or add it to `~/.bashrc`                   |
| PM2 not starting on boot         | `pm2 startup systemd` then `pm2 save`                             |
| Email not sending                | Check `EMAIL_PORT` + `EMAIL_SECURE` pairing (465/true or 587/false)|
| Build error `%BASE_URL%`         | Don't use `%BASE_URL%` in index.html — Vite base handles it       |

---

## Key File Locations on VPS

| File                       | VPS Path                                                  |
| -------------------------- | --------------------------------------------------------- |
| Server code                | `/var/www/embr3-hr-pms/server/`                           |
| Server .env                | `/var/www/embr3-hr-pms/server/.env`                       |
| Front-end source           | `/var/www/embr3-hr-pms/front-end/src/`                    |
| Front-end .env             | `/var/www/embr3-hr-pms/front-end/.env`                    |
| Built front-end (dist)     | `/var/www/embr3-hr-pms/front-end/dist/`                   |
| Uploaded files             | `/var/www/embr3-hr-pms/server/uploads/`                   |
| PM2 ecosystem config       | `/var/www/embr3-hr-pms/ecosystem.config.cjs`              |
| Nginx site config          | `/etc/nginx/sites-available/embr3-hr-pms`                 |
| Nginx security headers     | `/etc/nginx/conf.d/security-headers.conf`                 |
| SSL certificates           | `/etc/letsencrypt/live/embr3-onlinesystems.cloud/`        |
| Fail2Ban config            | `/etc/fail2ban/jail.local`                                |
| Health-check script        | `/usr/local/bin/health-check.sh`                          |
| Health-check log           | `/var/log/embr3-health.log`                               |

---

## Security Stack Summary

| Layer            | Protection                                  |
| ---------------- | ------------------------------------------- |
| Firewall         | UFW — ports 22, 80, 443 only                |
| SSH              | Key-only auth, max 3 retries, no X11        |
| Brute-force      | Fail2Ban on SSH + Nginx                     |
| OS Patches       | Unattended security upgrades                |
| HTTP Headers     | HSTS, X-Frame, XSS, Referrer, Permissions   |
| Rate Limiting    | 10 req/s per IP on `/api/`                  |
| SSL              | Let's Encrypt with auto-renewal             |
| Log Rotation     | PM2 logrotate (10MB, 7 days, compressed)    |
| Health Check     | Cron every 5 min, auto-restarts if down     |

---

*Last updated: 2026-02-13*
