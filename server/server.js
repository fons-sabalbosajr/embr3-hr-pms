import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";   // 👈 use centralized db connection

import authRoutes from "./routes/authRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import dtrRoutes from "./routes/dtrRoutes.js";
import dtrLogRoutes from "./routes/dtrLogRoutes.js";
import dtrDataRoutes from "./routes/dtrDataRoutes.js";
import trainingRoutes from "./routes/trainingRoutes.js";
import employeeDocRoutes from "./routes/employeeDocRoutes.js";
import employeeSalaryRoutes from "./routes/employeeSalaryRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";


import { setSocketInstance } from "./socket.js";

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 5000;
const HOST = process.env.SERVER_HOST || "0.0.0.0";

const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io/", // Explicitly set the path
  cors: {
    origin: process.env.CLIENT_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
setSocketInstance(io);

io.on("connection", (socket) => {
  //console.log(`Socket connected: ${socket.id}`);
  socket.on("disconnect", () => {
    //console.log("Socket disconnected:", socket.id);
  });
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Routes
app.use("/api/users", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/dtr", dtrRoutes);
app.use("/api/dtrlogs", dtrLogRoutes);
app.use("/api/dtrdatas", dtrDataRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/employee-docs", employeeDocRoutes);
app.use("/api/employee-salaries", employeeSalaryRoutes);
app.use("/api/settings", settingsRoutes);

// Start server after DB connection
connectDB().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
});
