import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const getDevConfig = async (req, res) => {
  try {
    const conn = mongoose.connection;
    const db = {
      connected: conn.readyState === 1,
      name: conn.name || null,
      host: conn.host || null,
      port: conn.port || null,
    };

    const app = {
      node: process.version,
      env: process.env.NODE_ENV || "development",
      serverHost: process.env.SERVER_HOST || "0.0.0.0",
      serverPort: process.env.SERVER_PORT || 5000,
      clientOrigin:
        process.env.CLIENT_ORIGIN ||
        process.env.FRONTEND_URL ||
        process.env.VITE_FRONTEND_URL ||
        null,
    };

    const email = {
      configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      user: process.env.EMAIL_USER ? "[set]" : null,
    };

    const googleKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const google = {
      serviceAccountKey: googleKeyPath
        ? path.basename(googleKeyPath)
        : null,
      configured: Boolean(googleKeyPath),
    };

    // Reflect socket config used in server/socket.js
    const socket = {
      path: "/socket.io",
      pingInterval: 5000,
      pingTimeout: 10000,
      corsOrigin: app.clientOrigin || true,
    };

    res.status(200).json({ app, db, email, google, socket });
  } catch (err) {
    res.status(500).json({ message: "Failed to load dev config", error: err.message });
  }
};
