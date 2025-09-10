import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";


import authRoutes from "./routes/authRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import dtrRoutes from "./routes/dtrRoutes.js";
import dtrLogRoutes from "./routes/dtrLogRoutes.js";
import dtrDataRoutes from "./routes/dtrDataRoutes.js";
import trainingRoutes from "./routes/trainingRoutes.js";
import employeeDocRoutes from "./routes/employeeDocRoutes.js";

import { setSocketInstance } from "./socket.js";

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 5000;
const HOST = process.env.SERVER_HOST || "0.0.0.0";

// 1. Create HTTP server
const server = http.createServer(app);

// 2. Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// 3. Make the `io` instance globally available
setSocketInstance(io);

// 4. Socket.IO listeners
io.on("connection", (socket) => {
  //console.log("Socket connected:", socket.id);

  // socket.emit("newNotification", { message: "Welcome notification!" });

  socket.on("disconnect", () => {
    //console.log("Socket disconnected:", socket.id);
  });
});

// 5. Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "20mb" })); // or larger if needed
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// 6. Routes
app.use("/api/users", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/dtr", dtrRoutes);
app.use("/api/dtrlogs", dtrLogRoutes);
app.use("/api/dtrdatas", dtrDataRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/employee-docs", employeeDocRoutes);

// 7. Start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => console.error("MongoDB connection error:", err));
