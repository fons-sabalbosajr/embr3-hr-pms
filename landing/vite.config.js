// landing/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/hrpms": {
        target: "http://10.14.77.107:5175", // HRPMS app
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hrpms/, "/hrpms"),
      },
    },
  },
});
