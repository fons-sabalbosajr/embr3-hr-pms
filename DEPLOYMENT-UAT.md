# UAT Deployment (Render)

This repo includes a Render blueprint (`render.yaml`) to deploy both the API and the frontend from the UAT branch.

## Services

- API: `embr3-hr-pms-uat-api` (Node web service)
  - Root: `server`
  - Start: `node server.js`
  - Exposes PORT assigned by Render
  - Health check: `/api/dev/health` (ensure the route exists or adjust)
  - Required env vars (set in Render):
    - `MONGO_URI`
    - `JWT_SECRET`
    - `CLIENT_ORIGIN` (set to the static site URL; supports comma-separated list if multiple origins)
    - Email (choose SMTP_URL or granular): `SMTP_URL` or `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`
    - `DISABLE_EMAIL` (set to `false` to enable emails)
    - Optional Google Drive: `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` or `GOOGLE_SERVICE_ACCOUNT_KEY`, and `GOOGLE_DRIVE_FOLDER_ID`

- Web: `embr3-hr-pms-uat-web` (Static Site)
  - Root: `front-end`
  - Build: `npm run build`
  - Publish: `dist`
  - Env vars:
    - `VITE_BASE_PATH=/`
    - `VITE_API_URL` (e.g. `https://embr3-hr-pms-uat-api.onrender.com/api` after API is live)
    - `VITE_ENCRYPT_SECRET` (required for secureStorage encryption; use a random strong secret)
    - `VITE_KEY_SALT` (optional, additional obfuscation salt)

## Steps

1. Push changes to UAT branch.
2. In Render, create a new Blueprint instance from the repo. Ensure branch is `UAT`.
3. After initial deploy of the API, copy its public URL and set `VITE_API_URL` on the Static Site service (must end with `/api`).
4. Set `CLIENT_ORIGIN` on the API service to the Static Site public URL (e.g., `https://embr3-hr-pms-uat-web.onrender.com`).
5. Set `VITE_ENCRYPT_SECRET` (and optional `VITE_KEY_SALT`) on the Static Site service.
6. Configure email env vars on the API service if sending payslips.
7. Redeploy the Static Site (to pick up `VITE_API_URL`) and the API if you changed API env vars.

## Notes

- The server reads PORT (Render) or SERVER_PORT (local) with a fallback to 5000.
- CORS is restricted by `CLIENT_ORIGIN` env var.
- If your API doesn’t expose `/api/dev/health`, either create it or change `healthCheckPath` in `render.yaml`.
- Socket.IO defaults to long-polling; no sticky sessions needed. If enabling WebSocket upgrades later, ensure sticky sessions on Render and configure a Redis adapter for multi-instance setups.

### SMTP on Render
- Many cloud platforms restrict or rate-limit outbound SMTP, and Gmail may block or require static IPs/OAuth. Recommended: use a transactional provider (SendGrid, Mailgun, Brevo) via SMTP or HTTP API.
- If you must use SMTP and see timeouts during boot verify, set `EMAIL_VERIFY_ON_BOOT=false` to skip the startup verification (sending still uses your configuration and will log errors if it fails at runtime).
- Set email via either:
  - `SMTP_URL` (e.g., `smtps://user:pass@smtp.example.com:465` or `smtp+starttls://user:pass@smtp.example.com:587`), or
  - granular `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`.

## Quick checks

After deploy, verify:

```bash
# API health
curl -sSf https://<api-service>.onrender.com/api/dev/health

# Frontend fetch
curl -sSf https://<web-service>.onrender.com/
```
