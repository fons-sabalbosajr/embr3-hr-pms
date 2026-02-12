# Developer Agent — EMBR3 HR PMS

## Mission
Implement features and fixes safely within the existing patterns of this repo:
- React 18 + Vite + Ant Design in `front-end/`
- Node (ESM) + Express + Mongoose in `server/`
- Encrypted browser storage and strict permission gating
- Demo mode and maintenance mode enforcement
- Optional Google Drive storage + email sending

## Quick Start (Local)
### Prerequisites
- Node.js 20.x
- MongoDB (local or remote)

### Server
From `server/`:
- Install: `npm install`
- Dev: `npm run dev` (nodemon)
- Tests: `npm test`

Minimum env expected (example):
- `MONGO_URI=...`
- `JWT_SECRET=...`
- `CLIENT_ORIGIN=http://localhost:5175`

### Front-end
From `front-end/`:
- Install: `npm install`
- Dev: `npm run dev`

Front-end env:
- `VITE_ENCRYPT_SECRET=...` (required)
- Optional for dev: `VITE_SERVER_URL=http://localhost:5000` (Vite proxy target)
- Optional for static hosting: `VITE_API_URL=https://<api-host>/api`
- Optional base path: `VITE_BASE_PATH=/` (or `/hrpms/`)

Recommended local ports (from repo config):
- Vite dev server: `5175`
- API server: `5000`

## Architectural Conventions (Follow These)
### Front-end HTTP
- Always use the shared Axios client: `front-end/src/api/axiosInstance.js`
  - It attaches JWT token automatically (session-first, legacy local fallback)
  - It handles `401` auto-logout and `403` unauthorized redirects
  - It includes client-side demo enforcement (blocks some writes for demo users)

When creating new API wrappers:
- Add them under `front-end/src/api/` (pattern already used: `employeeAPI.js`, `dtrAPI.js`, etc.)
- Keep endpoints aligned to server mounts in `server/app.js`

### Browser Storage (Security)
- Do not use `localStorage.setItem` / `sessionStorage.setItem` directly for sensitive data.
- Use `front-end/utils/secureStorage.js`:
  - `secureSessionStore/secureSessionGet` for per-tab auth state
  - `secureStore/secureGet` only when values must persist across tabs

Important: the secure storage module has a placeholder fallback secret (`PLEASE_SET_VITE_ENCRYPT_SECRET`).
Never rely on the fallback in real environments.

### Routing / Base Path
- The app uses `BrowserRouter` with `basename={import.meta.env.BASE_URL}`.
- Any hard-coded redirects must respect `import.meta.env.BASE_URL`.

### Authentication & Permissions (Server)
- JWT validation happens in auth middleware; it enriches `req.user` by loading fields from Mongo.
- Authorization is enforced via `requirePermissions()` middleware.
- “Developer” users are treated as privileged (similar to admin) in permission middleware.

When adding a new protected route:
1) Ensure token verification runs
2) Apply `requirePermissions([...])` for the capability
3) Keep the permission keys consistent with the existing user schema flags

If you need a new permission key:
1) Add the boolean field on the `User` model
2) Ensure auth middleware selects it (it selects a long list explicitly)
3) Use `requirePermissions(["newPermissionKey"])` on the route
4) Gate the UI using the existing `hasPermission()` helper in `AuthContext`

### Demo Mode & Maintenance Mode
- Demo mode blocks write requests for `isDemo` users depending on settings.
- Maintenance mode returns `503` for non-developer users when enabled.

When introducing a new write endpoint:
- Ensure it is compatible with demo enforcement patterns (URL should match registry if it must be blocked)
- Make sure maintenance behavior is acceptable (usually handled globally)

Notes:
- Server enforces demo mode in `server/middleware/demoEnforcement.js` (write requests only, with a bug-report exception).
- Client also enforces demo rules in the axios request interceptor; treat it as UX, not security.

### Socket.IO Events
- Server maintains presence per-user and broadcasts status changes.
- Front-end announces identity via `store-user` on login and reconnect.

If you add new realtime events:
- Prefer targeted emits (per user) when applicable
- Avoid sending sensitive payloads over broadcast

## Feature Implementation Patterns
### Avatars / Uploads
- Server supports local disk or Google Drive storage.
- Avatar uploads are resized/compressed server-side.
- Front-end expects `avatarUrl` and cache-busts after update.

### Payslips
- PDF generation exists as utilities (Regular/Contract variants).
- Email sending uses Nodemailer and can be disabled with `DISABLE_EMAIL=true`.

Pay attention to:
- `VITE_POSITION_ACRONYMS` (optional front-end env mapping long titles → acronyms)
- PDF generation utilities under repo `utils/` and/or module-specific utilities

### DTR
- DTR domain includes logs/data/request flows; ensure permissions align (`canViewDTR`, `canProcessDTR`).
- Be careful with date/time handling (prefer existing libs/patterns used in repo).

## Code Style Expectations
- Preserve ESM modules on the server (`type: module`).
- Keep changes minimal and consistent with existing patterns.
- Avoid introducing new libraries unless necessary; match existing dependencies (axios, dayjs/moment, antd).

## Testing & Validation
- Server: run `npm test` (Jest + Supertest patterns).
- Front-end: run `npm run lint` and smoke-test the impacted screens.

Minimal manual smoke checklist per change:
- Login still works
- No broken redirects (401/403)
- Permission-gated UI remains consistent
- Demo/maintenance behaviors unchanged (or intentionally updated)

API health checks during dev:
- `/api/dev/health` (used by Render health check)
- `/healthz` (DB status + uptime)

## Deployment Notes (Render)
- UAT blueprint uses Node 20 for both services.
- Static site must set `VITE_API_URL` to API URL ending with `/api`.
- API must set `CLIENT_ORIGIN` to the static site URL (comma-separated allowed).

Common deployment gotchas:
- `VITE_API_URL` missing `/api` → client calls the wrong base
- `CLIENT_ORIGIN` missing scheme/host or trailing slashes mismatched → CORS failures
- Drive mode enabled without folder permissions → avatar/backup uploads fail
