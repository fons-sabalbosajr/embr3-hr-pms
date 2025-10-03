// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import connectDB from "./config/db.js";
import { ensureUserTypes } from "./utils/bootstrap.js";

// Import your routes
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
import deductionTypeRoutes from "./routes/deductionTypeRoutes.js";
import payslipRequestRoutes from "./routes/payslipRequestRoutes.js";
import dtrGenerationLogRoutes from "./routes/dtrGenerationLogRoutes.js";

// Import the socket initializer
import { initSocket } from "./socket.js";

// --- Basic Setup ---
dotenv.config();
const app = express();
const PORT = process.env.SERVER_PORT || 5000;
const HOST = process.env.SERVER_HOST || "0.0.0.0";
const server = http.createServer(app);

// --- Initialize Socket.IO Server ---
initSocket(server);

// --- Middleware ---
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// --- API Routes ---
app.use("/api/users", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/dtr", dtrRoutes);
app.use("/api/dtrlogs", dtrGenerationLogRoutes);
app.use("/api/dtrlogs", dtrLogRoutes);
app.use("/api/dtrdatas", dtrDataRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/employee-docs", employeeDocRoutes);
app.use("/api/employee-salaries", employeeSalaryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/deduction-types", deductionTypeRoutes);
app.use("/api/payslip-requests", payslipRequestRoutes);

// --- Start Server ---
connectDB().then(async () => {
  await ensureUserTypes(); // Run bootstrap logic after DB connection
  server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
});