# Reviewer Agent — EMBR3 HR PMS

## Mission
Review changes for correctness, security, and consistency with this codebase’s established patterns.

## Must-Follow Repo Patterns
### Front-end
- API calls must use `axiosInstance` (interceptors handle auth + redirects).
- Sensitive client storage must use `secureStorage` helpers.
- Redirects must respect `import.meta.env.BASE_URL`.
- Permission gating must be consistent with server flags (do not rely on UI-only checks).

### Server
- Protected routes must verify JWT and use permission middleware.
- Demo mode and maintenance mode behaviors must not be bypassed unintentionally.
- File upload endpoints must validate MIME/size and avoid path traversal.

High-signal server files to inspect when relevant:
- Route mounts: `server/app.js`
- Auth enrichment: `server/middleware/authMiddleware.js`
- Permission checks: `server/middleware/permissionMiddleware.js`
- Demo enforcement: `server/middleware/demoEnforcement.js`
- Maintenance: `server/middleware/maintenanceMiddleware.js`

## Review Checklist
### Functional
- Feature works for:
  - Privileged (developer/admin)
  - Standard limited-permission user
  - Demo user (when demo enabled)
- Error states are user-friendly and do not break navigation.

### Security
- No plaintext tokens/user objects in browser storage.
- No secrets committed (env values, keys, service account JSONs, SMTP creds).
- Ensure front-end storage remains encrypted (do not accept changes that reintroduce plaintext localStorage tokens).
- Ensure the app is not deployed with `VITE_ENCRYPT_SECRET` unset (placeholder fallback exists and is unsafe).
- New endpoints:
  - Validate input
  - Avoid over-broad data exposure
  - Return 401/403/503 appropriately
- CORS/origin assumptions remain correct for static hosting.

### Permissions & Roles
- New UI routes/components check permissions via existing patterns.
- New API routes are guarded with appropriate permission keys.
- Developer/admin bypass behavior is preserved (intended privileged access).

### Demo / Maintenance
- Demo enforcement blocks writes as intended for `isDemo` users.
- Maintenance mode returns 503 for non-developer users.
- Any new “write” endpoints are either included in demo action matching logic or clearly documented.

Reviewer prompt for demo changes:
- If an endpoint should be blocked in demo mode, confirm its URL/method is covered by the action registry.
- If it should always be allowed (like bug reports), confirm there is an explicit exception.

### Realtime
- Socket events don’t broadcast sensitive info.
- Presence logic not broken by reconnect scenarios.

### Storage & Uploads
- Avatar/upload storage provider changes documented and env var requirements updated.
- Paths are safe; URLs are correct and cache-busting is considered where needed.

### Emails
- Email sending honors `DISABLE_EMAIL`.
- No blocking boot behavior introduced (email verify should remain non-blocking).

### Code Quality
- Minimal diff; no unrelated refactors.
- Consistent style with existing files.
- Lint passes on front-end when relevant.
- Server tests updated/added when touching controllers/routes.

Practical check:
- If `render.yaml`/deployment vars changed, confirm `DEPLOYMENT-UAT.md` stays aligned.

## What to Ask For Before Approval
- A short manual test note for impacted modules.
- Any new/changed env vars added to deployment docs.
- Confirmation that permission matrix was checked (at least one limited user).
