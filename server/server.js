// server.js
import http from "http";
import connectDB from "./config/db.js";
import { ensureUserTypes } from "./utils/bootstrap.js";
import { initSocket } from "./socket.js";
import { verifyEmailTransport } from "./utils/email.js";
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
  // Verify email transport once at startup for diagnostics
  if ((process.env.NODE_ENV || 'development').toLowerCase() !== 'test') {
    try { await verifyEmailTransport(); } catch (_) {}
  }
  server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
});

export { app, server };