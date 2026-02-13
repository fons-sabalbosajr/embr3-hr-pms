# EMBR3 HR-PMS — Server (Node.js / Express)

> API backend for the EMBR3 HR Personnel Management System

## Quick Start

```bash
npm install
cp .env.example .env   # Fill in your values
npm run dev            # Development (nodemon)
node server.js         # Production
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | 64-char hex for JWT signing |
| `CLIENT_ORIGIN` | Comma-separated allowed front-end origins |
| `STORAGE_PROVIDER` | `local` (VPS disk) or `drive` (Google Drive) |
| `EMAIL_HOST/PORT/USER/PASS` | SMTP config for email sending |

## Deployment

- **VPS (Production)**: See [DEPLOYMENT-VPS.md](../DEPLOYMENT-VPS.md)
- **Render (UAT)**: See [DEPLOYMENT-UAT.md](../DEPLOYMENT-UAT.md)
- **PM2 Config**: See [ecosystem.config.cjs](../ecosystem.config.cjs)

---

## Account Preferences Enhancements (Nov 2025)

### New User Fields
- `avatarUrl`: Stores public link to user's avatar (Google Drive file).
- `changePasswordToken` / `changePasswordExpires`: Used for two-step password change verification.

### New Endpoints (mounted under `/api/users`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/request-password-change` | Yes | Initiate password change; verifies old password, emails confirmation link/token. |
| POST | `/confirm-password-change` | No | Finalize password change using emailed token + new password. |
| POST | `/avatar` | Yes | Upload cropped avatar image. Accepts multipart form-data field `avatar`. |
| PUT  | `/users/profile` | Yes | Alias for profile update (also `/profile`). |
| PUT  | `/users/change-password` | Yes | Legacy direct password change (still supported). |

### Avatar Upload Flow
1. Front-end opens crop modal (using `react-easy-crop`) and produces a square PNG.
2. POST `/api/users/avatar` with multipart form-data.
3. By default, the server stores avatars locally (temporary default while Drive isn’t configured).
  - Generates a single compressed 256x256 JPG in `/uploads/avatars/<userId>/` with a versioned name (e.g., `v1731438200000.jpg`).
  - Cleans up older files in the user’s avatar folder, keeping only the latest.
  - Saves `avatarUrl` pointing to the new file.
4. If `STORAGE_PROVIDER=drive` is explicitly set and configured, uploads go to Google Drive and `avatarUrl` is set to the Drive link.
5. Login responses include `avatarUrl` automatically.

### Environment Variables
| Name | Description |
|------|-------------|
| `GOOGLE_DRIVE_FOLDER_ID_IMAGE` | Preferred target Drive folder for avatar uploads (ideally a folder inside a Shared Drive). |
| `GOOGLE_DRIVE_FOLDER_ID` | Fallback Drive folder ID if `_IMAGE` isn't set. |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Path to the service account JSON key (fallback: `server/config/service-account.json`). |
| `GOOGLE_IMPERSONATE_USER` | Optional. If set with Domain-wide Delegation enabled, the service account will impersonate this user for Drive uploads (supports uploading into the user’s My Drive). |
| `STORAGE_PROVIDER` | `drive` (default) or `local`. Set to `local` to store avatars on the server filesystem. |
| `AVATAR_UPLOAD_DIR` | Local directory for storing avatars when `STORAGE_PROVIDER=local`. Default: `server/uploads`. |
| `EMAIL_*` / `SMTP_URL` | Required for sending password change verification emails. |
- Local storage: if `STORAGE_PROVIDER=local`, the server compresses and resizes avatars with `sharp` (256x256 JPG, quality 82) and writes to `AVATAR_UPLOAD_DIR/avatars`. Files are served at `/uploads/avatars/<file>`. The absolute URL is saved to `avatarUrl`.

### Service Account Setup (disabled by default)
Place Google service account JSON at `server/config/service-account.json`, or set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (or `GOOGLE_SERVICE_ACCOUNT_KEY`) to the JSON path.

For uploads (when you explicitly enable Drive mode):
- Preferred: Use a Shared Drive folder and share it with the service account (Content manager). The code enables `supportsAllDrives` for Team Drives.
- Alternative: Enable Domain-wide Delegation in your Workspace, grant Drive scopes, and set `GOOGLE_IMPERSONATE_USER` to a user email who owns the target folder in My Drive.

### Troubleshooting Google Drive uploads
- Error: "Service Accounts do not have storage quota"
  - Cause: Service accounts have no personal My Drive storage. Uploads to a user's My Drive will fail unless delegated.
  - Fix options:
    1) Use a Shared Drive folder: create or select a Shared Drive, create a folder inside it, share that folder with the service account email as Content manager, and set `GOOGLE_DRIVE_FOLDER_ID_IMAGE` (or `GOOGLE_DRIVE_FOLDER_ID`) to that folder ID.
    2) Domain-wide delegation: enable in Admin Console, grant Drive scope, and set `GOOGLE_IMPERSONATE_USER` to a Workspace user who owns the target folder.
- Error: "Insufficient permission" when uploading/listing
  - Share the target folder with the service account email; ensure the folder ID is correct and not just a link. For Shared Drives, permissions must be granted at the drive or folder.
- Error: "File/Folder not found"
  - Verify you used the folder ID (a string like `0A...Uk9PVA`) not the URL. Ensure the service account or impersonated user has access.
- Note: All Drive calls set `supportsAllDrives=true` and include items from Shared Drives.

### Two-Step Password Change
1. User submits old & new password to `/request-password-change`.
2. Server stores token & expiry, emails link: `/confirm-password-change/:token` and includes token in email body.
3. User either clicks link (public route) or pastes token in modal. Front-end posts token + new password to `/confirm-password-change`.
4. Token fields are cleared; password updated.

### Security Considerations
- Token expiry: 15 minutes.
- MIME/type check enforced by `multer` and controller.
- Public confirmation endpoint only updates password after valid token check.
- Demo users still restricted by existing demo mode enforcement.

### Front-End Additions
- `pages/ConfirmPasswordChange/ConfirmPasswordChange.jsx` handles token-based finalization.
- Avatar cropping integrated into Account Settings (`react-easy-crop` dependency added).

### Maintenance
If you need to disable email sending temporarily, set `DISABLE_EMAIL=true` (tokens will be generated but not emailed).

# Server (Node/Express) – Storage & Backups

This server supports storing uploads and backups either on local disk or in Google Drive using a service account.

## Environment

Required (Drive mode):
- STORAGE_PROVIDER=drive
- GOOGLE_DRIVE_FOLDER_ID=1BLOsfrkUBRR0ZxQgLgxmHHXgDkeO5Oy0
- GOOGLE_SERVICE_ACCOUNT_KEY=absolute/path/to/service-account.json (optional; defaults to `server/config/service-account.json`)

Optional:
- CLIENT_ORIGIN, SERVER_HOST, SERVER_PORT, EMAIL_USER/PASS … (existing)
- GOOGLE_IMPERSONATE_USER (optional; domain-wide delegation)
Local storage is the default. To explicitly use local, set `STORAGE_PROVIDER=local`.
To switch to Drive later, set `STORAGE_PROVIDER=drive` and configure the Drive envs.

## How it works

  - storageList()
  - storageDelete(idOrName)
- Google Drive implementation in `utils/googleDriveStorage.js` handles upload/list/stream/delete.
- Backups are generated by `utils/backupWorker.js`. When `STORAGE_PROVIDER=drive`, results are uploaded to Drive and the BackupJob records `provider=drive`, `fileId`, and `resultPath=drive:<filename>`.

## Routes

- POST /api/dev/backup-jobs: enqueue backup (JSON or CSV)
- GET /api/dev/backup-jobs: list jobs
- GET /api/dev/backup-jobs/:id/download: stream result from Drive/local

## Sharing the Drive Folder

Share the folder with your service account email (from `service-account.json`). Ensure Drive API is enabled on the project.

## Notes

- For very large backups, consider streaming to a temp file then uploading to reduce memory usage.
- Add retention policies or encryption as needed.
# Server API (Calendar Bulk Uploads)

This document supplements the existing backend by describing the new bulk upload endpoints for Local Holidays and Suspension Days.

## Endpoints

### POST /api/local-holidays/bulk-upload
Bulk create local holidays from either a CSV file (multipart/form-data) or a JSON payload containing rows.

Accepts:
1. Multipart form with field `file` (CSV)
2. JSON body: `{ "rows": [ { ...rowFields } ] }`

Flexible headers / keys (case-insensitive):
- name | Name | Holiday | holiday
- date | Date | startDate | StartDate | from | From (required)
- endDate | EndDate | to | To (optional)
- location | Location (optional)
- notes | Notes (optional)

Sample JSON request body:
```json
{
  "rows": [
    { "name": "City Charter Day", "date": "2025-01-05", "location": "Quezon City" },
    { "Holiday": "Festival Week", "from": "2025-02-10", "to": "2025-02-14" }
  ]
}
```

Successful response:
```json
{
  "success": true,
  "count": 2,
  "skipped": 0,
  "invalidRows": []
}
```

### POST /api/suspensions/bulk-upload
Bulk create suspension day entries.

Accepts CSV `file` or JSON `{ rows: [...] }` like above.

Flexible headers / keys:
- title | Title | Subject | subject (required)
- date | Date | startDate | StartDate | from | From (required)
- endDate | EndDate | to | To (optional)
- scope | Scope (defaults to "Local" if missing)
- location | Location (optional)
- referenceType | ReferenceType (defaults to "Memorandum")
- referenceNo | ReferenceNo (optional)
- notes | Notes (optional)
- active | Active (optional; any value "false" (case-insensitive) marks inactive)

Sample JSON:
```json
{
  "rows": [
    { "title": "Office Disinfection", "date": "2025-03-01", "scope": "Local", "active": "false" },
    { "Subject": "Storm Suspension", "from": "2025-07-10", "to": "2025-07-11", "scope": "Regional", "referenceType": "Proclamation" }
  ]
}
```

Successful response:
```json
{
  "success": true,
  "count": 2,
  "skipped": 0,
  "invalidRows": []
}
```

## Validation & Feedback
- Each row is validated for required name/title and a parsable date.
- Invalid rows are reported in `invalidRows` with `{ index, reason }` (first 50 only if large).
- Response includes `count` of inserted documents and `skipped` count.

## Audit Logging
Both bulk upload endpoints create an `AuditLog` entry:
- action: `bulk-upload:local-holidays` or `bulk-upload:suspensions`
- details: `{ inserted, skipped }`

## Preview Workflow (Front-End)
The front-end parses CSV/XLS/XLSX client-side using the `xlsx` library, shows a preview table, then POSTs a JSON `{ rows: [...] }` payload to the server. This prevents partially malformed uploads and lets users review before committing.

## Date Parsing
Dates are parsed with `dayjs(val)`. Use ISO `YYYY-MM-DD` format to avoid locale ambiguities.

## Error Responses
- 400: Missing file or no valid rows.
- 500: Unexpected server error (response contains `message`).

## Future Enhancements (Suggested)
- Optional `dryRun=true` query to validate without inserting.
- Per-row granular error codes.
- Support for ODS (convert client-side then send JSON rows).
- Return inserted document IDs for immediate UI reconciliation.

---
Updated: 2025-11-11

## Email Branding and Logo
- Email From Name: Set `EMAIL_FROM_NAME` to override the sender display. Recommended: `EMAIL_FROM_NAME=EMBR3 DTRMS Personnel`.
- Embed Logo Inline: Set `EMAIL_EMBED_LOGO=true` to embed the logo as CID for intranet reliability. When disabled or CID not supported, code falls back to a public URL.
- Logo Path: If embedding, set `EMAIL_LOGO_PATH=./public/emblogo.svg`. The file `server/public/emblogo.svg` is included for convenience.
- Subject/Branding: Templates updated to use “EMB Region III • DTRMS”. No visible logo attachment will appear with the payslip.
- Resend Policy: Payslip emails allow up to 5 resends; idempotent responses avoid 409 conflicts.

After changing `.env`, restart the server and send a test payslip to verify inline logo rendering and branding.

---

## VPS Deployment Notes

When deploying to a VPS (Hostinger KVM 2):

- Use `npm ci --omit=dev` for production installs
- PM2 manages the Node process: `pm2 start ecosystem.config.cjs`
- Nginx proxies `/api/*` and `/socket.io/*` to port 5000
- Avatars stored locally in `/var/www/embr3-hr-pms/server/uploads/`
- Full guide: [DEPLOYMENT-VPS.md](../DEPLOYMENT-VPS.md)

---

*Last updated: 2026-02-13*
