// PM2 Ecosystem Config – EMBR3 HR-PMS
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "embr3-hr-api",
      cwd: "./server",
      script: "server.js",
      interpreter: "node",
      node_args: "--env-file=.env",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
