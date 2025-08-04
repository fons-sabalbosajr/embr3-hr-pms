// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      host: env.VITE_HOST || 'localhost',   // 👈 Use env variable here
      port: parseInt(env.VITE_PORT) || 5173,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'), // optional: cleaner imports
      },
    },
  };
});
