// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    base: "/hrpms", // 👈 important for Nginx subpath
    plugins: [react()],
    server: {
      host: env.VITE_HOST || "localhost",
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
