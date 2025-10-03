// server/socket.js
import { Server } from "socket.io";
import User from "./models/User.js";

let io;
const userSockets = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    path: "/socket.io/",
    cors: {
      origin: process.env.CLIENT_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
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
        await User.findByIdAndUpdate(userIdToDelete, { isOnline: false });
        io.emit("user-status-changed", { userId: userIdToDelete, status: "offline" });
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
