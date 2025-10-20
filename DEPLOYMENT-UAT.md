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
    - `CLIENT_ORIGIN` (set to the static site URL)

- Web: `embr3-hr-pms-uat-web` (Static Site)
  - Root: `front-end`
  - Build: `npm run build`
  - Publish: `dist`
  - Env vars:
    - `VITE_BASE_PATH=/`
    - `VITE_API_URL` (e.g. `https://embr3-hr-pms-uat-api.onrender.com/api` after API is live)

## Steps

1. Push changes to UAT branch.
2. In Render, create a new Blueprint instance from the repo. Ensure branch is `UAT`.
3. After initial deploy of the API, copy its public URL and set `VITE_API_URL` on the Static Site service.
4. Set `CLIENT_ORIGIN` on the API service to the Static Site public URL.
5. Redeploy the Static Site (to pick up VITE_API_URL) and API if needed.

## Notes

- The server reads PORT (Render) or SERVER_PORT (local) with a fallback to 5000.
- CORS is restricted by `CLIENT_ORIGIN` env var.
- If your API doesn’t expose `/api/dev/health`, either create it or change `healthCheckPath` in `render.yaml`.
