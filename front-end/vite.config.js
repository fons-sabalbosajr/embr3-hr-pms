// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  // In dev we keep base as '/'. In production, allow overriding via VITE_BASE_PATH (ensure it ends with a slash).
  const isProd = mode === "production";
  const rawBase = env.VITE_BASE_PATH || "/";
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
