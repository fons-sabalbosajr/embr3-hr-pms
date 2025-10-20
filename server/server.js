// server.js
import http from "http";
import connectDB from "./config/db.js";
import { ensureUserTypes } from "./utils/bootstrap.js";
import { initSocket } from "./socket.js";
import app from "./app.js";

const PORT = process.env.SERVER_PORT || 5000;
const HOST = process.env.SERVER_HOST || "0.0.0.0";
const server = http.createServer(app);

// Initialize Socket.IO Server
initSocket(server);

// --- Start Server ---
connectDB().then(async () => {
  await ensureUserTypes(); // Run bootstrap logic after DB connection
  server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
});

export { app, server };