# Project Planner — EMBR3 HR PMS

## Product Summary
EMBR3 HR PMS is a web-based HR + DTR + payroll support system. The app focuses on:
- Authentication and account management (including avatar + password workflows)
- Employee master records + supporting documents
- Daily Time Record (DTR): logs, data views, requests, work calendars, generation logs
- Payroll support: payslip request workflow + PDF generation + email sending
- Admin controls: settings, deduction types, notifications, reports/audit logs, backups
- Calendar inputs: local holidays and suspension days (including bulk uploads)
- Real-time presence and targeted updates via Socket.IO

## Repo Structure
- `front-end/` — main React 18 + Vite app using Ant Design
- `server/` — Node (ESM) + Express + Mongoose API + Socket.IO
- `landing/` — separate Vite app (currently mostly template)
- `utils/` / `front-end/utils/` — shared utilities (PDFs, secure storage, sockets)

## Architecture (Runtime)
### Client (React/Vite)
- Axios wrapper with interceptors for JWT auth, 401/403 handling, and demo write blocking
- Encrypted storage for user/token and other persisted state (CryptoJS AES)
- Router respects `import.meta.env.BASE_URL` (supports subpath deployments)
- Vite dev proxy uses `/api` → backend (default `http://localhost:5000`)

### Server (Express/Mongoose)
- Express app mounts module routes under `/api/*` (see “API Surface Map”)
- JWT middleware enriches `req.user` from Mongo with many permission flags
- Authorization uses centralized permission middleware
- Cross-cutting system modes:
  - Maintenance mode (non-developer users receive 503)
  - Demo mode enforcement (demo users may be read-only or blocked by action registry)
- Upload storage provider supports local disk or Google Drive
- Email via Nodemailer with retries; can be disabled via env

### Database
- MongoDB via Mongoose models in `server/models/`
- Settings stored as a singleton document (`Settings.getSingleton()`)

### Realtime (Socket.IO)
- Presence tracking by user id
- Client announces identity after login and on reconnect
- Server broadcasts presence changes and can target emits per-user

## Source-of-Truth Files (When Planning Changes)
- Server route mounting: `server/app.js`
- Server bootstrap and port binding: `server/server.js`
- Auth enrichment: `server/middleware/authMiddleware.js`
- Permission checks: `server/middleware/permissionMiddleware.js`
- Demo enforcement: `server/middleware/demoEnforcement.js`
- Maintenance enforcement: `server/middleware/maintenanceMiddleware.js`
- Socket presence: `server/socket.js`
- Front-end axios client: `front-end/src/api/axiosInstance.js`
- Front-end auth state: `front-end/src/context/AuthContext.jsx`
- Secure storage: `front-end/utils/secureStorage.js`
- Render blueprint: `render.yaml`

## API Surface Map (Route Prefixes)
Mounted in `server/app.js`:
- `/api/users` (auth/account, avatar, password flows)
- `/api/public` (public endpoints)
- `/api/protected` (protected helper endpoints)
- `/api/employees`
- `/api/dtr`
- `/api/dtrlogs` (generation logs + log routes)
- `/api/dtrdatas`
- `/api/dtr-requests`
- `/api/trainings`
- `/api/employee-docs`
- `/api/employee-salaries`
- `/api/payslip-requests`
- `/api/settings`
- `/api/deduction-types`
- `/api/local-holidays`
- `/api/suspensions`
- `/api/notifications`
- `/api/uploads`
- `/api/features`
- `/api/bug-report`
- `/api/dev` (developer tools, backups, audits, diagnostics)

## Roles & Access Model
User access is a combination of:
- `userType` (special “developer” handling)
- `isAdmin`
- granular boolean permissions (e.g., `canViewDTR`, `canProcessPayroll`, etc.)
- `isDemo` + demo settings restrictions (when demo mode is active)

Planning implication: every feature should be designed with an explicit “who can do this?” answer.

## Operational Health Checks
- Render health check is configured as `/api/dev/health` (public route in dev router)
- Additional internal health endpoint exists at `/healthz` (returns DB status, uptime)

## Environments & Deployment
Render UAT blueprint exists via `render.yaml`:
- API service: `server/` → `node server.js`
- Web service: `front-end/` → `npm run build` → `dist/`

Critical env vars:
- Server:
  - `MONGO_URI`, `JWT_SECRET`
  - `CLIENT_ORIGIN` (comma-separated allowed)
  - Email: `DISABLE_EMAIL`, `SMTP_URL` OR `EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASS`
  - Storage: `STORAGE_PROVIDER=drive|local`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (or JSON/path), `GOOGLE_DRIVE_FOLDER_ID_IMAGE`
- Front-end:
  - `VITE_API_URL` (static hosting: must end with `/api`; dev can rely on `/api` proxy)
  - `VITE_ENCRYPT_SECRET` (required; do not ship default placeholder)
  - `VITE_BASE_PATH` (if hosted under a subpath)

## Release Checklist Template
### Local readiness
- [ ] `server` boots and connects to Mongo
- [ ] `front-end` boots and can call `/api/*` via Vite proxy
- [ ] Login works; permissions arrive and UI gating matches

### UAT readiness (Render)
- [ ] API health check passes: `/api/dev/health`
- [ ] CORS is correct: `CLIENT_ORIGIN` matches web URL
- [ ] Web points to API: `VITE_API_URL=https://<api>/api`
- [ ] `VITE_ENCRYPT_SECRET` is set (non-placeholder)

### Feature verification
- [ ] Demo mode: demo user cannot bypass write restrictions
- [ ] Maintenance mode: non-developer receives 503
- [ ] Avatar upload works for the chosen provider (local or drive)
- [ ] Payslip PDF generation works; email behavior matches `DISABLE_EMAIL`
- [ ] Backup job can run and download result

## Definition of Done
- Permissions defined (server) + enforced (server) + reflected (UI)
- Demo/maintenance modes remain correct
- Secure storage used for sensitive client state
- 401/403/503 behaviors are handled (no broken navigation)
- Deployment/env var changes documented where required
