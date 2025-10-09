// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  // In dev we keep base as '/' so you can visit http://host:port/ directly without Vite's base warning loop.
  // In production (build output to be deployed behind a reverse proxy path) we set the intended base.
  // Allow overriding via VITE_BASE_PATH (ensure it ends with a slash) else default to '/hrpms/' in prod.
  const isProd = mode === "production";
  const rawBase = env.VITE_BASE_PATH || (isProd ? "/hrpms/" : "/");
  const normalizedBase = rawBase.endsWith("/") ? rawBase : rawBase + "/";

  return {
    base: normalizedBase,
    plugins: [react()],
    server: {
      host: env.VITE_HOST || "0.0.0.0", // bind to all for LAN access
      port: parseInt(env.VITE_PORT) || 5175,
      proxy: {
        "/api": {
          target: env.VITE_SERVER_URL || "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
