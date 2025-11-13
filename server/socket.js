// server/socket.js
import { Server } from "socket.io";
import User from "./models/User.js";

let io;
const userSockets = new Map();

export const initSocket = (server) => {
  // Build allowed origins from env (comma-separated)
  const parseAllowedOrigins = (value) =>
    String(value || "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);

  const allowedOrigins = parseAllowedOrigins(
    process.env.CLIENT_ORIGIN ||
      process.env.FRONTEND_URL ||
      process.env.VITE_FRONTEND_URL
  );

  io = new Server(server, {
    path: "/socket.io",
    // Speed up presence updates by tuning heartbeat
    // Shorter intervals detect disconnects faster (lower offline lag)
    pingInterval: 5000, // default 25000
    pingTimeout: 10000, // default 20000
    cors: {
      origin: (origin, callback) => {
        const reqOrigin = (origin || "").replace(/\/$/, "");
        if (!reqOrigin) return callback(null, true);
        if (allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.includes(reqOrigin)) return callback(null, true);
        return callback(new Error(`Socket.IO CORS: ${reqOrigin} not allowed`));
      },
      methods: ["GET", "POST"],
      credentials: false,
    },
  });

  io.on("connection", (socket) => {
    // Send current online users to the newly connected client
    try {
      const onlineUserIds = Array.from(userSockets.keys());
      socket.emit("presence-snapshot", { onlineUserIds });
    } catch (e) {
      // no-op
    }
    // Optionally, the client may reconnect; ensure we can inform others quickly
    // about current online users if needed (new clients will fetch users list anyway)
    // When client logs in and sends store-user
    socket.on("store-user", async (user) => {
      if (user && user._id) {
        if (!userSockets.has(user._id)) {
          userSockets.set(user._id, new Set());
          await User.findByIdAndUpdate(user._id, { isOnline: true });
          io.emit("user-status-changed", { userId: user._id, status: "online" });
        }
        userSockets.get(user._id).add(socket.id);
      }
    });

    // 🔴 Explicit logout event
    socket.on("logout", async (userId) => {
      if (!userId) return;
      if (userSockets.has(userId)) {
        userSockets.delete(userId);
      }
      await User.findByIdAndUpdate(userId, { isOnline: false });
      io.emit("user-status-changed", { userId, status: "offline" });
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      let userIdToDelete;
      for (const [userId, sockets] of userSockets.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userIdToDelete = userId;
          }
          break;
        }
      }

      if (userIdToDelete) {
        userSockets.delete(userIdToDelete);
        const lastSeenAt = new Date();
        await User.findByIdAndUpdate(userIdToDelete, { isOnline: false, lastSeenAt });
        io.emit("user-status-changed", { userId: userIdToDelete, status: "offline", lastSeenAt });
      }
    });
  });

  return io;
};

export const getSocketInstance = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized!");
  }
  return io;
};
