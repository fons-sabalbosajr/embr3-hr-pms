# QA Agent — EMBR3 HR PMS

## Mission
Validate the system end-to-end with emphasis on:
- Permission-gated modules (many boolean flags on user)
- DTR and payroll correctness (dates, totals, document outputs)
- Demo mode and maintenance mode behavior
- Storage (encrypted client storage; avatar storage provider)
- Email delivery flows and safe fallbacks
- Regression protection for core navigation and authentication

## Test Environments
### Local
- Front-end: `front-end/` → `npm run dev`
- Server: `server/` → `npm run dev`
- MongoDB: local or remote test database

### UAT (Render)
- Verify CORS origin (`CLIENT_ORIGIN`) matches static site URL
- Verify `VITE_API_URL` points to API + `/api`

Quick UAT probes:
- `GET /api/dev/health` should return `ok`
- `GET /healthz` should return JSON with `db: connected` when healthy

## Automated Tests
- Server: from `server/` run `npm test`
- Front-end: no formal test suite in repo; rely on lint + manual regression

## High-Risk Areas (Prioritize)
1) Auth/session expiry (401 interceptor behavior) and unauthorized handling (403)
2) Permission gating: menu visibility + API blocking alignment
3) DTR date/time logic and generation outputs
4) Payslip PDF generation outputs + email sending/resend policy
5) Demo mode write blocking (client + server) and maintenance mode 503 behavior
6) Uploads/avatars (local vs Drive) and caching
7) Bulk upload endpoints (CSV/JSON) for holidays/suspensions
8) Backup jobs generation + download
9) Socket presence (online/offline transitions)

## Smoke Test Checklist (Every Deploy)
### Access & Navigation
- Login with valid user
- Logout clears session and returns to `/auth`
- Session expiry forces redirect for protected routes
- Unauthorized permissions redirect to `/unauthorized`

### Core Modules
- Employees: list → view → create/edit (with correct permission)
- DTR: view logs/data; generate/export where applicable
- Trainings: view/edit based on permissions
- Payslip requests: create/request/list; generate PDF preview
- Settings: view/update only with settings permission

### System Controls
- Maintenance mode enabled → non-developer receives 503 with message
- Demo mode enabled → demo user write operations are blocked as configured

Demo mode specifics:
- Demo enforcement applies to write methods (POST/PUT/PATCH/DELETE)
- Bug report submissions should remain allowed even when demo is read-only

### Realtime
- Online indicator updates when user logs in
- Logout emits offline status

## Permission Matrix Verification (Sampling)
Use at least three test accounts:
- Admin/developer (should pass most checks)
- Non-admin with limited flags (e.g., DTR view only)
- Demo user (`isDemo=true`)

For each account:
- Attempt access to each major module page
- Confirm UI blocks match server enforcement (403)

## DTR Functional Checks
- Validate date filtering and pagination behaviors
- Validate work calendar and holiday/suspension effects if the module uses them
- Validate DTR request submission (employee-facing route if applicable)

Edge cases:
- Cross-month cutoffs
- Holidays/suspensions overlapping with work calendar
- Missing biometric logs (and reminder email workflow if enabled)

## Payslip Functional Checks
- Regular and Contract PDF generation renders without missing fields
- Position acronym mapping (if configured) affects designation line
- Email sending:
  - When `DISABLE_EMAIL=true`, app should not crash; should log/skip
  - When enabled, verify deliverability and template correctness

## Uploads / Avatars
- Upload/crop avatar
- Confirm avatar URL resolves and updates immediately (cache-bust)
- If using Drive provider, verify link is publicly viewable as intended

## Bulk Uploads (Holidays/Suspensions)
- Upload valid CSV
- Upload mixed valid/invalid rows and confirm server reports invalid rows
- Confirm data appears in UI and affects downstream logic (where relevant)

Header flexibility to validate (case-insensitive, aliases):
- Holidays: `name/holiday`, `date/from`, optional `endDate/to`, `location`, `notes`
- Suspensions: `title/subject`, `date/from`, optional `endDate/to`, `scope`, `active`, `referenceType`, `referenceNo`, `notes`

## Backup Jobs
- Trigger backup job (if available in UI)
- Verify job status transitions
- Download and validate file content format

## Bug Report Quality Bar
When filing defects include:
- Role/account used + permission flags
- Exact URL and action performed
- Expected vs actual
- Server response code/body (especially 401/403/503)
- Screenshots of UI state
- If DTR/Payroll: include date range, employee id, and input data

If the issue involves permissions/demo/maintenance:
- Include the account’s flags (e.g., `canViewDTR`, `isDemo`, `userType`, `isAdmin`)
- Include server response payload and HTTP status (403 vs 503 matters)
