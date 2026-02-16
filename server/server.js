// server.js
import http from "http";
import connectDB from "./config/db.js";
import { ensureUserTypes } from "./utils/bootstrap.js";
import { initSocket } from "./socket.js";
import { verifyEmailTransport } from "./utils/email.js";
import Settings from "./models/Settings.js";
import app from "./app.js";

// Prefer PORT for Render/Heroku compatibility, fallback to SERVER_PORT and 5000 locally
const PORT = process.env.PORT || process.env.SERVER_PORT || 5000;
const HOST = process.env.SERVER_HOST || "0.0.0.0";
const server = http.createServer(app);

// Initialize Socket.IO Server
initSocket(server);

// --- Start Server ---
connectDB().then(async () => {
  await ensureUserTypes(); // Run bootstrap logic after DB connection

  // Migrate sessionTimeout: bump from old 30-min default to 480 (8h) if unchanged
  try {
    const s = await Settings.getSingleton();
    if (s?.security?.sessionTimeout === 30) {
      s.security.sessionTimeout = 480;
      await s.save();
      console.log("[Migration] sessionTimeout bumped 30m → 480m (8h)");
    }
  } catch (_) {}

  // Start listening ASAP so Render can detect the open port even if email verification is slow
  server.listen(PORT, HOST, () => {
    console.log(
      `Server running at http://${HOST}:${PORT} (env.PORT=${
        process.env.PORT || "unset"
      })`
    );
  });

  // Verify email transport in the background (non-blocking)
  if ((process.env.NODE_ENV || "development").toLowerCase() !== "test") {
    verifyEmailTransport().catch(() => {});
  }
});

export { app, server };
