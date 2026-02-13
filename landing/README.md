# EMBR3 HR-PMS — Landing Page

> Public-facing landing page for the EMBR3 DTRMS Personnel Management System.

## Tech Stack

- React 18 + Vite
- Static site (no API dependency)

## Development

```bash
npm install
npm run dev       # Local dev server
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

## Deployment

For VPS deployment, the landing page can be:

1. **Served as a separate Nginx site** on a subdomain (e.g., `www.embr3-onlinesystems.cloud`)
2. **Included in the main app** by building and placing `dist/` in a `/landing` path

See [DEPLOYMENT-VPS.md](../DEPLOYMENT-VPS.md) for the full VPS guide.

---

*Last updated: 2026-02-13*
