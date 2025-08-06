import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import http from "http"; // Needed for Socket.IO
import { Server } from "socket.io"; // Socket.IO server

import authRoutes from "./routes/authRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 5000;
const HOST = process.env.SERVER_HOST || "0.0.0.0";

// 1. Create HTTP server
const server = http.createServer(app);

// 2. Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN, // e.g. http://10.14.77.107:5173
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 3. Listen to socket connections
io.on("connection", (socket) => {
  //console.log("Socket connected:", socket.id);

  // You can emit test event
  //socket.emit("newNotification", { message: "Welcome notification!" });

  socket.on("disconnect", () => {
    //console.log("Socket disconnected:", socket.id);
  });
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/users', authRoutes);
app.use('/api/protected', protectedRoutes);

// 4. Connect to Mongo and start the full HTTP + WebSocket server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => console.error("MongoDB connection error:", err));
